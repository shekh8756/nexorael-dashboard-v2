"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Release = {
  id: string;
  title?: string | null;
  artist_name?: string | null;
  type?: string | null;
  status?: string | null;
  upc?: string | null;
  catalog_number?: string | null;
  label?: string | null;
  language?: string | null;
  genre?: string | null;
  subgenre?: string | null;
  release_date?: string | null;
  original_release_date?: string | null;
  created_at?: string | null;
  cover_url?: string | null;
  artwork_url?: string | null;
  music_type?: string | null;
  content_id?: boolean | null;
  dsp_count?: number | null;
  countries?: string[] | null;
  [key: string]: any;
};

type Delivery = {
  id: string;
  release_id?: string;
  dsp?: string | null;
  platform?: string | null;
  status?: string | null;
  created_at?: string | null;
  [key: string]: any;
};

export default function ReleaseDetailPage() {
  const params = useParams();

  const releaseId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [release, setRelease] = useState<Release | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!releaseId) return;

    loadRelease();
  }, [releaseId]);

  async function loadRelease() {
    setLoading(true);
    setError("");

    try {
      // --------------------------------------------------
      // STEP 1
      // GET RELEASE
      // IMPORTANT:
      // No Supabase relationship is used here.
      // --------------------------------------------------

      const { data: releaseData, error: releaseError } =
        await supabase
          .from("releases")
          .select("*")
          .eq("id", releaseId)
          .maybeSingle();

      if (releaseError) {
        throw new Error(releaseError.message);
      }

      if (!releaseData) {
        throw new Error("Release not found.");
      }

      setRelease(releaseData);

      // --------------------------------------------------
      // STEP 2
      // GET DSP DELIVERIES SEPARATELY
      // --------------------------------------------------

      const { data: deliveryData, error: deliveryError } =
        await supabase
          .from("dsp_deliveries")
          .select("*")
          .eq("release_id", releaseId)
          .order("created_at", {
            ascending: false,
          });

      // Delivery table error should NOT break release page.
      if (!deliveryError) {
        setDeliveries(deliveryData || []);
      } else {
        console.log(
          "DSP delivery query:",
          deliveryError.message
        );

        setDeliveries([]);
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load release."
      );
    } finally {
      setLoading(false);
    }
  }

  function formatDate(value?: string | null) {
    if (!value) return "—";

    try {
      return new Date(value).toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );
    } catch {
      return value;
    }
  }

  function statusClass(status?: string | null) {
    const value = (status || "").toLowerCase();

    if (
      value.includes("live") ||
      value.includes("approved") ||
      value.includes("delivered") ||
      value.includes("success")
    ) {
      return "bg-green-500/10 text-green-400 border-green-500/20";
    }

    if (
      value.includes("reject") ||
      value.includes("fail") ||
      value.includes("error")
    ) {
      return "bg-red-500/10 text-red-400 border-red-500/20";
    }

    if (
      value.includes("pending") ||
      value.includes("review") ||
      value.includes("processing")
    ) {
      return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    }

    return "bg-zinc-500/10 text-zinc-300 border-white/10";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050816] text-white p-6 md:p-10">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/dashboard"
            className="inline-flex rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            ← Back
          </Link>

          <div className="mt-8 rounded-2xl border border-white/10 bg-[#0d1224] p-8">
            <p className="text-zinc-400">
              Loading release...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#050816] text-white p-6 md:p-10">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/dashboard"
            className="inline-flex rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            ← Back
          </Link>

          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-8">
            <h1 className="text-xl font-semibold text-red-400">
              Unable to load release
            </h1>

            <p className="mt-3 text-sm text-red-300">
              {error}
            </p>

            <button
              onClick={loadRelease}
              className="mt-6 rounded-lg bg-white px-5 py-3 font-semibold text-black"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!release) {
    return null;
  }

  const cover =
    release.cover_url ||
    release.artwork_url ||
    "";

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-7xl p-6 md:p-10">

        {/* HEADER */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              ← Back
            </Link>

            <h1 className="mt-6 text-3xl font-bold">
              {release.title || "Untitled Release"}
            </h1>

            <p className="mt-2 text-zinc-400">
              Release details and delivery status
            </p>
          </div>

          <div
            className={`inline-flex w-fit rounded-full border px-4 py-2 text-sm font-medium ${statusClass(
              release.status
            )}`}
          >
            {(release.status || "draft").toUpperCase()}
          </div>
        </div>

        {/* MAIN RELEASE CARD */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">

          {/* ARTWORK */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1224] p-4">
            <div className="aspect-square overflow-hidden rounded-xl bg-black">
              {cover ? (
                <img
                  src={cover}
                  alt={release.title || "Release artwork"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-600">
                  No Artwork
                </div>
              )}
            </div>

            <div className="mt-4">
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Release ID
              </p>

              <p className="mt-1 break-all text-sm text-zinc-300">
                {release.id}
              </p>
            </div>
          </div>

          {/* DETAILS */}
          <div className="rounded-2xl border border-white/10 bg-[#0d1224] p-6">

            <h2 className="text-xl font-semibold">
              Release Information
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">

              <Info
                label="Title"
                value={release.title}
              />

              <Info
                label="Artist"
                value={release.artist_name}
              />

              <Info
                label="Type"
                value={release.type}
              />

              <Info
                label="Label"
                value={release.label}
              />

              <Info
                label="Language"
                value={release.language}
              />

              <Info
                label="Genre"
                value={release.genre}
              />

              <Info
                label="Subgenre"
                value={release.subgenre}
              />

              <Info
                label="UPC"
                value={release.upc}
              />

              <Info
                label="Catalog Number"
                value={release.catalog_number}
              />

              <Info
                label="Release Date"
                value={formatDate(
                  release.release_date
                )}
              />

              <Info
                label="Original Release Date"
                value={formatDate(
                  release.original_release_date
                )}
              />

              <Info
                label="Created"
                value={formatDate(
                  release.created_at
                )}
              />

            </div>
          </div>
        </div>

        {/* DSP DELIVERIES */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-[#0d1224]">

          <div className="border-b border-white/10 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  DSP Deliveries
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Distribution status for this release
                </p>
              </div>

              <span className="rounded-lg bg-white/5 px-3 py-2 text-sm text-zinc-300">
                {deliveries.length} DSP
                {deliveries.length === 1
                  ? ""
                  : "s"}
              </span>
            </div>
          </div>

          {deliveries.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              No DSP delivery records found.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {delivery.dsp ||
                        delivery.platform ||
                        "DSP"}
                    </p>

                    <p className="mt-1 text-sm text-zinc-500">
                      {delivery.created_at
                        ? formatDate(
                            delivery.created_at
                          )
                        : ""}
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${statusClass(
                      delivery.status
                    )}`}
                  >
                    {(
                      delivery.status ||
                      "pending"
                    ).toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* RELEASE RAW DATA */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-[#0d1224]">

          <details>
            <summary className="cursor-pointer p-6 font-semibold">
              Technical Release Data
            </summary>

            <pre className="max-h-[500px] overflow-auto border-t border-white/10 p-6 text-xs text-green-400">
              {JSON.stringify(
                release,
                null,
                2
              )}
            </pre>
          </details>

        </section>
      </div>
    </main>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value?: any;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </p>

      <p className="mt-2 break-words text-sm text-zinc-200">
        {value === null ||
        value === undefined ||
        value === ""
          ? "—"
          : String(value)}
      </p>
    </div>
  );
}