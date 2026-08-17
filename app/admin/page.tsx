"use client";

import { useEffect, useState } from "react";

type Release = {
  id?: string | number;
  title?: string;
  status?: string;
  type?: string;
  artist_name?: string;
  artistName?: string;
  toolost_release_id?: string | number;
  toolostReleaseId?: string | number;
  upc?: string | null;
  created_at?: string;
  createdAt?: string;
  [key: string]: any;
};

export default function AdminPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadReleases() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/releases", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Failed to load releases"
        );
      }

      setReleases(data.releases || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load releases"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReleases();
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-10">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Nexorael Admin Dashboard
            </h1>

            <p className="mt-2 text-zinc-400">
              Manage and monitor your music releases.
            </p>
          </div>

          <button
            onClick={loadReleases}
            disabled={loading}
            className="rounded-xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh Releases"}
          </button>
        </div>

        {/* STATS */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">

          <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-400">
              Total Releases
            </p>

            <p className="mt-2 text-3xl font-bold">
              {releases.length}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-400">
              Draft Releases
            </p>

            <p className="mt-2 text-3xl font-bold">
              {
                releases.filter(
                  (release) =>
                    String(release.status || "").toLowerCase() ===
                    "draft"
                ).length
              }
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6">
            <p className="text-sm text-zinc-400">
              Submitted
            </p>

            <p className="mt-2 text-3xl font-bold">
              {
                releases.filter((release) => {
                  const status = String(
                    release.status || ""
                  ).toLowerCase();

                  return (
                    status === "submitted" ||
                    status === "pending" ||
                    status === "processing"
                  );
                }).length
              }
            </p>
          </div>

        </div>

        {/* ERROR */}
        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
            {error}
          </div>
        )}

        {/* RELEASES */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">

          <div className="border-b border-white/10 p-6">
            <h2 className="text-xl font-bold">
              Music Releases
            </h2>

            <p className="mt-1 text-sm text-zinc-400">
              Releases created from the Nexorael distribution dashboard.
            </p>
          </div>

          {loading ? (
            <div className="p-10 text-center text-zinc-400">
              Loading releases...
            </div>
          ) : releases.length === 0 ? (
            <div className="p-10 text-center text-zinc-400">
              No releases found.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[900px] text-left">

                <thead className="border-b border-white/10 bg-black/40">
                  <tr>
                    <th className="px-6 py-4 text-sm font-semibold text-zinc-400">
                      Release
                    </th>

                    <th className="px-6 py-4 text-sm font-semibold text-zinc-400">
                      Artist
                    </th>

                    <th className="px-6 py-4 text-sm font-semibold text-zinc-400">
                      Type
                    </th>

                    <th className="px-6 py-4 text-sm font-semibold text-zinc-400">
                      Status
                    </th>

                    <th className="px-6 py-4 text-sm font-semibold text-zinc-400">
                      Too Lost ID
                    </th>

                    <th className="px-6 py-4 text-sm font-semibold text-zinc-400">
                      UPC
                    </th>

                    <th className="px-6 py-4 text-sm font-semibold text-zinc-400">
                      Created
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {releases.map((release, index) => {

                    const artist =
                      release.artist_name ||
                      release.artistName ||
                      "—";

                    const toolostId =
                      release.toolost_release_id ||
                      release.toolostReleaseId ||
                      "—";

                    const created =
                      release.created_at ||
                      release.createdAt;

                    const status =
                      String(
                        release.status || "unknown"
                      );

                    return (
                      <tr
                        key={
                          release.id ??
                          `${release.title}-${index}`
                        }
                        className="border-b border-white/5 hover:bg-white/[0.03]"
                      >

                        {/* RELEASE */}
                        <td className="px-6 py-5">

                          <div className="font-semibold">
                            {release.title || "Untitled Release"}
                          </div>

                          <div className="mt-1 text-xs text-zinc-500">
                            ID: {release.id ?? "—"}
                          </div>

                        </td>

                        {/* ARTIST */}
                        <td className="px-6 py-5 text-zinc-300">
                          {artist}
                        </td>

                        {/* TYPE */}
                        <td className="px-6 py-5 text-zinc-300">
                          {release.type || "—"}
                        </td>

                        {/* STATUS */}
                        <td className="px-6 py-5">

                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              status.toLowerCase() === "draft"
                                ? "bg-yellow-500/10 text-yellow-400"
                                : status.toLowerCase() === "submitted"
                                ? "bg-green-500/10 text-green-400"
                                : "bg-blue-500/10 text-blue-400"
                            }`}
                          >
                            {status.toUpperCase()}
                          </span>

                        </td>

                        {/* TOO LOST ID */}
                        <td className="px-6 py-5 font-mono text-sm text-zinc-300">
                          {toolostId}
                        </td>

                        {/* UPC */}
                        <td className="px-6 py-5 font-mono text-sm text-zinc-400">
                          {release.upc || "Not generated"}
                        </td>

                        {/* DATE */}
                        <td className="px-6 py-5 text-sm text-zinc-400">
                          {created
                            ? new Date(created).toLocaleString()
                            : "—"}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>

              </table>

            </div>
          )}
        </div>

      </div>
    </main>
  );
}