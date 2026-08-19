"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();

  const userId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [profile, setProfile] = useState<any>(null);
  const [releases, setReleases] = useState<any[]>([]);
  const [royalties, setRoyalties] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveRevenue, setLiveRevenue] =
  useState<any>(null);

const [revenueLoading, setRevenueLoading] =
  useState(true);

  const loadUser = useCallback(async () => {
    if (!userId) return;

    try {
      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

      if (profileError) {
        throw new Error(profileError.message);
      }

      setProfile(profileData);

      const { data: releaseData } = await supabase
        .from("releases")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", {
          ascending: false,
        });

      const userReleases = releaseData || [];

      setReleases(userReleases);

      const releaseIds = userReleases.map(
        (release: any) => release.id
      );

      const { data: royaltyData } = await supabase
        .from("royalties")
        .select("*")
        .eq("user_id", userId);

      setRoyalties(royaltyData || []);

      if (releaseIds.length > 0) {
        const { data: deliveryData } = await supabase
          .from("dsp_deliveries")
          .select("*")
          .in("release_id", releaseIds)
          .order("created_at", {
            ascending: false,
          });

        setDeliveries(deliveryData || []);
      } else {
        setDeliveries([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUser();

    if (!userId) return;

    const channel = supabase
      .channel(`admin-user-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        loadUser
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "releases",
          filter: `user_id=eq.${userId}`,
        },
        loadUser
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "royalties",
          filter: `user_id=eq.${userId}`,
        },
        loadUser
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dsp_deliveries",
        },
        loadUser
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadUser]);

  const stats = useMemo(() => {
    const totalTracks = releases.reduce(
      (sum, release) =>
        sum + Number(release.track_count || 1),
      0
    );

    const liveTracks = releases.filter((release) =>
      ["live", "delivered", "approved"].includes(
        String(release.status || "").toLowerCase()
      )
    ).length;

    const pending = releases.filter((release) =>
      ["pending", "submitted", "under_review"].includes(
        String(release.status || "").toLowerCase()
      )
    ).length;

    const streams = royalties.reduce(
      (sum, royalty) =>
        sum +
        Number(
          royalty.streams ||
            royalty.total_streams ||
            0
        ),
      0
    );

    const revenue = royalties.reduce(
      (sum, royalty) =>
        sum +
        Number(
          royalty.revenue ||
            royalty.total ||
            royalty.amount ||
            0
        ),
      0
    );

    const dsps = new Set(
      deliveries
        .map(
          (delivery) =>
            delivery.dsp_name ||
            delivery.dsp ||
            delivery.platform
        )
        .filter(Boolean)
    );

    return {
      totalTracks,
      liveTracks,
      pending,
      streams,
      revenue,
      dsps: dsps.size,
    };
  }, [releases, royalties, deliveries]);
const loadLiveRevenue =
  useCallback(async () => {
    if (!userId) return;

    try {
      setRevenueLoading(true);

      const response =
        await fetch(
          `/api/admin/users/${userId}/revenue`,
          {
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        console.error(
          "Revenue API:",
          data
        );

        return;
      }

      setLiveRevenue(data);
    } catch (error) {
      console.error(
        "Live revenue:",
        error
      );
    } finally {
      setRevenueLoading(false);
    }
  }, [userId]);
  function getType() {
    const value = String(
      profile?.account_type ||
        profile?.user_type ||
        ""
    ).toLowerCase();

    if (value.includes("label")) {
      return "Label";
    }

    if (value.includes("artist")) {
      return "Artist";
    }

    if (profile?.white_label_id) {
      return "Label";
    }

    return "Artist";
  }

  if (loading) {
    return (
      <main className="min-h-screen text-white">
        Loading user...
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen text-white">
        User not found.
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white">
      <button
        onClick={() => router.push("/admin/users")}
        className="mb-5 rounded-lg border border-[#203246] bg-[#0b1725] px-4 py-2 text-sm"
      >
        ← Back to Users
      </button>

      <section className="rounded-2xl border border-[#17283a] bg-[#091522] p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row">
          <div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${
                getType() === "Label"
                  ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
                  : "border-sky-500/30 bg-sky-500/10 text-sky-300"
              }`}
            >
              {getType()}
            </span>

            <h1 className="mt-4 text-3xl font-bold">
              {profile.legal_name ||
                profile.full_name ||
                profile.display_name ||
                "User"}
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              {profile.email || "No email"}
            </p>

            <p className="mt-2 font-mono text-xs text-slate-600">
              {profile.id}
            </p>
          </div>

          <span
            className={`h-fit rounded-full border px-3 py-2 text-xs font-bold ${
              profile.status === "active"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-red-500/30 bg-red-500/10 text-red-400"
            }`}
          >
            {String(
              profile.status || "inactive"
            ).toUpperCase()}
          </span>
        </div>
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Card title="Total Tracks" value={stats.totalTracks} />
        <Card title="Delivered / Live" value={stats.liveTracks} />
        <Card title="Pending" value={stats.pending} />
        <Card
  title="Streams"
  value={
    revenueLoading
      ? "..."
      : formatNumber(
          liveRevenue?.summary
            ?.totalStreams || 0
        )
  }
/>

<Card
  title="Revenue"
  value={
    revenueLoading
      ? "..."
      : formatMoney(
          liveRevenue?.summary
            ?.totalRevenue || 0
        )
  }
/>

<Card
  title="Available Balance"
  value={
    revenueLoading
      ? "..."
      : formatMoney(
          liveRevenue?.summary
            ?.availableBalance || 0
        )
  }
/>
        <Card title="DSPs" value={stats.dsps} />
      </div>

      {/* ACCOUNT DETAILS */}

      <section className="mt-6 rounded-2xl border border-[#17283a] bg-[#091522]">
        <Header
          title="Account Details"
          subtitle="Profile and legal information"
        />

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          <Info
            label="Legal Name"
            value={
              profile.legal_name ||
              profile.full_name
            }
          />

          <Info
            label="Email"
            value={profile.email}
          />

          <Info
            label="Account Type"
            value={getType()}
          />

          <Info
            label="Role"
            value={profile.role}
          />

          <Info
            label="Status"
            value={profile.status}
          />

          <Info
            label="Created"
            value={formatDate(profile.created_at)}
          />

          <Info
            label="Phone"
            value={profile.phone}
          />

          <Info
            label="Company / Label"
            value={
              profile.company_name ||
              profile.label_name
            }
          />

          <Info
            label="Country"
            value={profile.country}
          />
        </div>
      </section>

      {/* RELEASES */}

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#17283a] bg-[#091522]">
        <Header
          title="Catalog / Releases"
          subtitle={`${releases.length} release records`}
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-[#17283a] text-left text-xs text-slate-500">
                <th className="p-4">Release</th>
                <th className="p-4">Artist</th>
                <th className="p-4">Type</th>
                <th className="p-4">Too Lost ID</th>
                <th className="p-4">Status</th>
                <th className="p-4">Created</th>
              </tr>
            </thead>

            <tbody>
              {releases.map((release) => (
                <tr
                  key={release.id}
                  className="border-b border-[#132234]"
                >
                  <td className="p-4 font-semibold">
                    {release.title || "Untitled"}
                  </td>

                  <td className="p-4">
                    {release.artist_name || "-"}
                  </td>

                  <td className="p-4">
                    {release.type || "Single"}
                  </td>

                  <td className="p-4">
                    {release.toolost_release_id || "-"}
                  </td>

                  <td className="p-4">
                    <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-xs">
                      {String(
                        release.status || "draft"
                      ).toUpperCase()}
                    </span>
                  </td>

                  <td className="p-4 text-slate-400">
                    {formatDate(release.created_at)}
                  </td>
                </tr>
              ))}

              {releases.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-10 text-center text-slate-500"
                  >
                    No releases found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* DSP DELIVERY */}

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#17283a] bg-[#091522]">
        <Header
          title="DSP Deliveries"
          subtitle="Distribution history for this user's catalog"
        />

        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
          {deliveries.map((delivery) => (
            <div
              key={delivery.id}
              className="rounded-xl border border-[#203246] bg-[#07111d] p-4"
            >
              <div className="font-semibold">
                {delivery.dsp_name ||
                  delivery.dsp ||
                  delivery.platform ||
                  "DSP"}
              </div>

              <div className="mt-2 text-xs text-slate-500">
                Release ID: {delivery.release_id}
              </div>

              <div className="mt-3 text-xs font-semibold text-emerald-400">
                {String(
                  delivery.status || "selected"
                ).toUpperCase()}
              </div>
            </div>
          ))}

          {deliveries.length === 0 && (
            <div className="text-sm text-slate-500">
              No DSP delivery records.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Card({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-[#17283a] bg-[#091522] p-5">
      <div className="text-xs text-slate-500">
        {title}
      </div>

      <div className="mt-2 text-2xl font-bold">
        {value}
      </div>
    </div>
  );
}

function Header({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="border-b border-[#17283a] p-5">
      <h2 className="font-semibold">
        {title}
      </h2>

      <p className="mt-1 text-xs text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: any;
}) {
  return (
    <div className="rounded-xl border border-[#203246] bg-[#07111d] p-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-600">
        {label}
      </div>

      <div className="mt-2 break-words text-sm">
        {value === null ||
        value === undefined ||
        value === ""
          ? "—"
          : String(value)}
      </div>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(
    Number(value || 0)
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}