"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type UserRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  legal_name?: string | null;
  display_name?: string | null;
  role?: string | null;
  status?: string | null;
  account_type?: string | null;
  user_type?: string | null;
  white_label_id?: string | null;
  created_at?: string | null;

  totalTracks: number;
  deliveredTracks: number;
  streams: number;
  revenue: number;

  [key: string]: any;
};

export default function AdminUsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      setError("");

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

      if (profileError) {
        throw new Error(profileError.message);
      }

      const { data: releases, error: releasesError } = await supabase
        .from("releases")
        .select("*");

      if (releasesError) {
        throw new Error(releasesError.message);
      }

      const { data: royalties, error: royaltyError } = await supabase
        .from("royalties")
        .select("*");

      if (royaltyError) {
        console.warn("Royalties:", royaltyError.message);
      }

      const { data: deliveries, error: deliveryError } = await supabase
        .from("dsp_deliveries")
        .select("*");

      if (deliveryError) {
        console.warn("DSP deliveries:", deliveryError.message);
      }

      const allReleases = releases || [];
      const allRoyalties = royalties || [];
      const allDeliveries = deliveries || [];

      const mapped: UserRow[] = (profiles || []).map((profile: any) => {
        const userReleases = allReleases.filter(
          (release: any) => release.user_id === profile.id
        );

        const releaseIds = new Set(
          userReleases.map((release: any) => release.id)
        );

        const userDeliveries = allDeliveries.filter((delivery: any) =>
          releaseIds.has(delivery.release_id)
        );

        const userRoyalties = allRoyalties.filter((royalty: any) => {
          if (royalty.user_id === profile.id) {
            return true;
          }

          if (
            royalty.release_id &&
            releaseIds.has(royalty.release_id)
          ) {
            return true;
          }

          return false;
        });

        const totalTracks = userReleases.reduce(
          (sum: number, release: any) =>
            sum + Number(release.track_count || 1),
          0
        );

        const deliveredReleaseIds = new Set(
          userDeliveries
            .filter((delivery: any) => {
              const status = String(
                delivery.status || ""
              ).toLowerCase();

              return [
                "submitted",
                "delivered",
                "approved",
                "live",
                "success",
              ].includes(status);
            })
            .map((delivery: any) => delivery.release_id)
        );

        // Also count locally-live/delivered releases
        userReleases.forEach((release: any) => {
          const status = String(
            release.status || ""
          ).toLowerCase();

          if (
            ["approved", "delivered", "live"].includes(status)
          ) {
            deliveredReleaseIds.add(release.id);
          }
        });

        const streams = userRoyalties.reduce(
          (sum: number, row: any) =>
            sum + Number(row.streams || row.total_streams || 0),
          0
        );

        const revenue = userRoyalties.reduce(
          (sum: number, row: any) =>
            sum +
            Number(
              row.revenue ||
                row.total ||
                row.amount ||
                0
            ),
          0
        );

        return {
          ...profile,
          totalTracks,
          deliveredTracks: deliveredReleaseIds.size,
          streams,
          revenue,
        };
      });

      setUsers(mapped);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load users."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();

    const channel = supabase
      .channel("admin-users-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        loadUsers
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "releases",
        },
        loadUsers
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "royalties",
        },
        loadUsers
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dsp_deliveries",
        },
        loadUsers
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadUsers]);

  async function changeUserStatus(
    user: UserRow,
    newStatus: "active" | "inactive"
  ) {
    try {
      setUpdating(user.id);

      const { error } = await supabase
        .from("profiles")
        .update({
          status: newStatus,
        })
        .eq("id", user.id);

      if (error) {
        throw new Error(error.message);
      }

      await loadUsers();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Unable to update user."
      );
    } finally {
      setUpdating(null);
    }
  }

  function getLegalName(user: UserRow) {
    return (
      user.legal_name ||
      user.full_name ||
      user.display_name ||
      "No legal name"
    );
  }

  function getUserType(user: UserRow) {
    const explicit = String(
      user.account_type ||
        user.user_type ||
        ""
    ).toLowerCase();

    if (explicit.includes("label")) {
      return "Label";
    }

    if (explicit.includes("artist")) {
      return "Artist";
    }

    if (user.white_label_id) {
      return "Label";
    }

    const role = String(user.role || "").toLowerCase();

    if (
      role.includes("label") ||
      role === "white_label_admin"
    ) {
      return "Label";
    }

    return "Artist";
  }

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const q = search.toLowerCase().trim();

      const matchesSearch =
        !q ||
        getLegalName(user).toLowerCase().includes(q) ||
        String(user.email || "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        String(user.status || "").toLowerCase() ===
          statusFilter;

      const matchesType =
        typeFilter === "all" ||
        getUserType(user).toLowerCase() === typeFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType
      );
    });
  }, [users, search, statusFilter, typeFilter]);

  const activeUsers = users.filter(
    (u) => u.status === "active"
  ).length;

  const inactiveUsers = users.filter(
    (u) => u.status !== "active"
  ).length;

  const labels = users.filter(
    (u) => getUserType(u) === "Label"
  ).length;

  const artists = users.filter(
    (u) => getUserType(u) === "Artist"
  ).length;

  return (
    <main className="min-h-screen text-white">
      <div className="mb-7 flex flex-col justify-between gap-5 border-b border-[#172638] pb-6 lg:flex-row lg:items-center">
        <div>
          <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] font-bold text-sky-400">
            USER MANAGEMENT
          </span>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Users
          </h1>

          <p className="mt-1 text-sm text-slate-400">
            Manage artists, labels, accounts and individual catalog performance.
          </p>
        </div>

        <button
          onClick={loadUsers}
          className="rounded-lg border border-[#203246] bg-[#0b1725] px-4 py-2.5 text-sm font-semibold hover:bg-[#102033]"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat title="Total Users" value={users.length} />
        <Stat title="Active" value={activeUsers} />
        <Stat title="Inactive" value={inactiveUsers} />
        <Stat title="Artists" value={artists} />
        <Stat title="Labels" value={labels} />
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[#17283a] bg-[#091522]">
        <div className="flex flex-col gap-3 border-b border-[#17283a] p-5 lg:flex-row">
          <input
            placeholder="Search legal name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-[#203246] bg-[#06101b] px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-sky-500/50"
          />

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-[#203246] bg-[#06101b] px-4 py-3 text-sm"
          >
            <option value="all">All Types</option>
            <option value="artist">Artists</option>
            <option value="label">Labels</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[#203246] bg-[#06101b] px-4 py-3 text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] border-collapse">
            <thead>
              <tr className="border-b border-[#17283a] text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-4">User</th>
                <th className="px-5 py-4">Account Type</th>
                <th className="px-5 py-4">Tracks</th>
                <th className="px-5 py-4">Delivered</th>
                <th className="px-5 py-4">Streams</th>
                <th className="px-5 py-4">Revenue</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-14 text-center text-slate-500"
                  >
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-14 text-center text-slate-500"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const active =
                    user.status === "active";

                  return (
                    <tr
                      key={user.id}
                      className="border-b border-[#132234] transition hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold">
                          {getLegalName(user)}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {user.email || "No email"}
                        </div>

                        <div className="mt-1 font-mono text-[10px] text-slate-700">
                          {user.id}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            getUserType(user) === "Label"
                              ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
                              : "border-sky-500/30 bg-sky-500/10 text-sky-300"
                          }`}
                        >
                          {getUserType(user)}
                        </span>
                      </td>

                      <td className="px-5 py-4 font-semibold">
                        {formatNumber(user.totalTracks)}
                      </td>

                      <td className="px-5 py-4 font-semibold text-emerald-400">
                        {formatNumber(user.deliveredTracks)}
                      </td>

                      <td className="px-5 py-4">
                        {formatNumber(user.streams)}
                      </td>

                      <td className="px-5 py-4 font-semibold">
                        {formatMoney(user.revenue)}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            active
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : "border-red-500/30 bg-red-500/10 text-red-400"
                          }`}
                        >
                          {active ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              router.push(
                                `/admin/users/${user.id}`
                              )
                            }
                            className="rounded-lg border border-[#26384c] bg-[#0c1825] px-3 py-2 text-xs font-semibold hover:bg-[#122235]"
                          >
                            View
                          </button>

                          {active ? (
                            <button
                              disabled={updating === user.id}
                              onClick={() =>
                                changeUserStatus(
                                  user,
                                  "inactive"
                                )
                              }
                              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400"
                            >
                              Inactive
                            </button>
                          ) : (
                            <button
                              disabled={updating === user.id}
                              onClick={() =>
                                changeUserStatus(
                                  user,
                                  "active"
                                )
                              }
                              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-400"
                            >
                              Active
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Stat({
  title,
  value,
}: {
  title: string;
  value: number;
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