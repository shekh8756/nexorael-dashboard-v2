"use client";

import { useEffect, useMemo, useState } from "react";

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
  cover_url?: string | null;
  artwork_url?: string | null;
  artworkUrl?: string | null;
  created_at?: string;
  createdAt?: string;
  [key: string]: any;
};

function normalizeStatus(status?: string) {
  return String(status || "unknown").trim().toLowerCase();
}

function getArtist(release: Release) {
  return (
    release.artist_name ||
    release.artistName ||
    release.artist ||
    "Unknown Artist"
  );
}

function getArtwork(release: Release) {
  return (
    release.artwork_url ||
    release.artworkUrl ||
    release.cover_url ||
    release.coverUrl ||
    release.cover ||
    ""
  );
}

function getToolostId(release: Release) {
  return (
    release.toolost_release_id ||
    release.toolostReleaseId ||
    "—"
  );
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status?: string }) {
  const normalized = normalizeStatus(status);

  let classes =
    "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";

  if (
    normalized === "approved" ||
    normalized === "live" ||
    normalized === "delivered"
  ) {
    classes =
      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  } else if (
    normalized === "submitted" ||
    normalized === "pending" ||
    normalized === "processing" ||
    normalized === "under_review"
  ) {
    classes =
      "bg-blue-500/10 text-blue-400 border-blue-500/20";
  } else if (normalized === "draft") {
    classes =
      "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  } else if (
    normalized === "rejected" ||
    normalized === "failed"
  ) {
    classes =
      "bg-red-500/10 text-red-400 border-red-500/20";
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${classes}`}
    >
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number | string;
  subtitle: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/70 p-5 shadow-lg shadow-black/10">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-500">
            {title}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-white">
            {value}
          </p>

          <p className="mt-1 text-xs text-zinc-600">
            {subtitle}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadReleases() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/releases",
        {
          method: "GET",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Failed to load releases"
        );
      }

      setReleases(
        Array.isArray(data.releases)
          ? data.releases
          : []
      );
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

  /*
   * ---------------------------------------------------------
   * STATISTICS
   * ---------------------------------------------------------
   */

  const statistics = useMemo(() => {
    const total = releases.length;

    const draft = releases.filter(
      (release) =>
        normalizeStatus(release.status) ===
        "draft"
    ).length;

    const submitted = releases.filter(
      (release) => {
        const status = normalizeStatus(
          release.status
        );

        return [
          "submitted",
          "pending",
          "processing",
          "under_review",
        ].includes(status);
      }
    ).length;

    const approved = releases.filter(
      (release) =>
        normalizeStatus(release.status) ===
        "approved"
    ).length;

    const live = releases.filter(
      (release) =>
        normalizeStatus(release.status) ===
        "live"
    ).length;

    const rejected = releases.filter(
      (release) => {
        const status = normalizeStatus(
          release.status
        );

        return (
          status === "rejected" ||
          status === "failed"
        );
      }
    ).length;

    const artists = new Set(
      releases
        .map((release) =>
          getArtist(release)
            .trim()
            .toLowerCase()
        )
        .filter(
          (artist) =>
            artist &&
            artist !== "unknown artist"
        )
    ).size;

    const labels = new Set(
      releases
        .map(
          (release) =>
            release.label ||
            release.label_name ||
            release.labelName
        )
        .filter(Boolean)
    ).size;

    return {
      total,
      draft,
      submitted,
      approved,
      live,
      rejected,
      artists,
      labels,
    };
  }, [releases]);

  /*
   * ---------------------------------------------------------
   * FILTER RELEASES
   * ---------------------------------------------------------
   */

  const filteredReleases = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return releases.filter((release) => {
      const status = normalizeStatus(
        release.status
      );

      if (
        statusFilter !== "all" &&
        status !== statusFilter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        release.title,
        getArtist(release),
        release.type,
        release.upc,
        getToolostId(release),
        release.label,
        release.label_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    releases,
    search,
    statusFilter,
  ]);

  /*
   * ---------------------------------------------------------
   * STATUS SUMMARY
   * ---------------------------------------------------------
   */

  const statusRows = [
    {
      label: "Draft",
      value: statistics.draft,
      color: "bg-yellow-400",
    },
    {
      label: "Pending Review",
      value: statistics.submitted,
      color: "bg-blue-400",
    },
    {
      label: "Approved",
      value: statistics.approved,
      color: "bg-emerald-400",
    },
    {
      label: "Live",
      value: statistics.live,
      color: "bg-green-400",
    },
    {
      label: "Rejected",
      value: statistics.rejected,
      color: "bg-red-400",
    },
  ];

  return (
    <main className="min-h-screen bg-[#07090f] text-white">
      <div className="mx-auto max-w-[1600px] px-5 py-7 md:px-8 lg:px-10">

        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <header className="flex flex-col gap-5 border-b border-white/10 pb-7 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-400">
                ADMIN
              </span>

              <span className="text-xs text-zinc-600">
                Nexorael Music Distribution
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Admin Dashboard
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              Manage releases, artists, labels and
              distribution activity.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadReleases}
              disabled={loading}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Refreshing..."
                : "↻ Refresh"}
            </button>

            <a
              href="/admin/releases"
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Manage Releases
            </a>
          </div>
        </header>

        {/* ================================================= */}
        {/* ERROR */}
        {/* ================================================= */}

        {error && (
          <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-red-400">
                Unable to load releases
              </p>

              <p className="mt-1 text-xs text-red-400/70">
                {error}
              </p>
            </div>

            <button
              onClick={loadReleases}
              className="rounded-lg border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10"
            >
              Retry
            </button>
          </div>
        )}

        {/* ================================================= */}
        {/* MAIN STATS */}
        {/* ================================================= */}

        <section className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Releases"
            value={statistics.total}
            subtitle="All releases in catalog"
            icon="🎵"
          />

          <StatCard
            title="Pending Review"
            value={statistics.submitted}
            subtitle="Waiting for review"
            icon="⏳"
          />

          <StatCard
            title="Approved"
            value={statistics.approved}
            subtitle="Approved releases"
            icon="✓"
          />

          <StatCard
            title="Live Releases"
            value={statistics.live}
            subtitle="Currently live"
            icon="🌐"
          />
        </section>

        {/* ================================================= */}
        {/* SECONDARY STATS */}
        {/* ================================================= */}

        <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Draft Releases"
            value={statistics.draft}
            subtitle="Incomplete releases"
            icon="📝"
          />

          <StatCard
            title="Rejected"
            value={statistics.rejected}
            subtitle="Needs attention"
            icon="⚠️"
          />

          <StatCard
            title="Artists"
            value={statistics.artists}
            subtitle="Unique artists"
            icon="🎤"
          />

          <StatCard
            title="Labels"
            value={statistics.labels}
            subtitle="Labels in releases"
            icon="🏷️"
          />
        </section>

        {/* ================================================= */}
        {/* QUICK ACTIONS */}
        {/* ================================================= */}

        <section className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <a
            href="/admin/releases"
            className="rounded-xl border border-white/10 bg-zinc-950 p-4 transition hover:border-blue-500/30 hover:bg-blue-500/5"
          >
            <div className="text-xl">🎵</div>
            <p className="mt-3 text-sm font-semibold">
              Releases
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Manage catalog
            </p>
          </a>

          <a
            href="/admin/artists"
            className="rounded-xl border border-white/10 bg-zinc-950 p-4 transition hover:border-blue-500/30 hover:bg-blue-500/5"
          >
            <div className="text-xl">🎤</div>
            <p className="mt-3 text-sm font-semibold">
              Artists
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Manage artists
            </p>
          </a>

          <a
            href="/admin/users"
            className="rounded-xl border border-white/10 bg-zinc-950 p-4 transition hover:border-blue-500/30 hover:bg-blue-500/5"
          >
            <div className="text-xl">👥</div>
            <p className="mt-3 text-sm font-semibold">
              Users
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              User management
            </p>
          </a>

          <a
            href="/admin/white-labels"
            className="rounded-xl border border-white/10 bg-zinc-950 p-4 transition hover:border-blue-500/30 hover:bg-blue-500/5"
          >
            <div className="text-xl">🏷️</div>
            <p className="mt-3 text-sm font-semibold">
              White Labels
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Partner labels
            </p>
          </a>

          <a
            href="/admin/royalties"
            className="rounded-xl border border-white/10 bg-zinc-950 p-4 transition hover:border-blue-500/30 hover:bg-blue-500/5"
          >
            <div className="text-xl">💰</div>
            <p className="mt-3 text-sm font-semibold">
              Royalties
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Revenue management
            </p>
          </a>

          <a
            href="/admin/withdrawals"
            className="rounded-xl border border-white/10 bg-zinc-950 p-4 transition hover:border-blue-500/30 hover:bg-blue-500/5"
          >
            <div className="text-xl">💸</div>
            <p className="mt-3 text-sm font-semibold">
              Withdrawals
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Payout requests
            </p>
          </a>
        </section>

        {/* ================================================= */}
        {/* CONTENT GRID */}
        {/* ================================================= */}

        <section className="mt-7 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">

          {/* RELEASE TABLE */}

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">

            <div className="border-b border-white/10 p-5 md:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                <div>
                  <h2 className="text-xl font-bold">
                    Recent Releases
                  </h2>

                  <p className="mt-1 text-xs text-zinc-600">
                    Latest releases created in
                    Nexorael.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search releases..."
                    className="w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-700 focus:border-blue-500/50 sm:w-56"
                  />

                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value
                      )
                    }
                    className="rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
                  >
                    <option value="all">
                      All Status
                    </option>
                    <option value="draft">
                      Draft
                    </option>
                    <option value="submitted">
                      Submitted
                    </option>
                    <option value="pending">
                      Pending
                    </option>
                    <option value="approved">
                      Approved
                    </option>
                    <option value="live">
                      Live
                    </option>
                    <option value="rejected">
                      Rejected
                    </option>
                  </select>

                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-blue-500" />

                <p className="mt-4 text-sm text-zinc-600">
                  Loading releases...
                </p>
              </div>
            ) : filteredReleases.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-4xl">
                  🎵
                </div>

                <p className="mt-4 font-semibold text-zinc-300">
                  No releases found
                </p>

                <p className="mt-1 text-xs text-zinc-600">
                  Try changing your search or
                  status filter.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">

                <table className="w-full min-w-[950px] text-left">

                  <thead className="border-b border-white/10 bg-black/30">
                    <tr>
                      <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                        Release
                      </th>

                      <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                        Artist
                      </th>

                      <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                        Type
                      </th>

                      <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                        Status
                      </th>

                      <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                        Too Lost ID
                      </th>

                      <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                        UPC
                      </th>

                      <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                        Created
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredReleases.map(
                      (release, index) => {
                        const artwork =
                          getArtwork(release);

                        return (
                          <tr
                            key={
                              release.id ??
                              `${release.title}-${index}`
                            }
                            className="border-b border-white/5 transition hover:bg-white/[0.025]"
                          >

                            {/* RELEASE */}

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">

                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                                  {artwork ? (
                                    <img
                                      src={artwork}
                                      alt={
                                        release.title ||
                                        "Artwork"
                                      }
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-lg text-zinc-700">
                                      ♪
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-white">
                                    {release.title ||
                                      "Untitled Release"}
                                  </p>

                                  <p className="mt-1 text-[10px] text-zinc-700">
                                    ID:{" "}
                                    {release.id ??
                                      "—"}
                                  </p>
                                </div>

                              </div>
                            </td>

                            {/* ARTIST */}

                            <td className="px-5 py-4 text-sm text-zinc-300">
                              {getArtist(
                                release
                              )}
                            </td>

                            {/* TYPE */}

                            <td className="px-5 py-4 text-sm capitalize text-zinc-400">
                              {release.type ||
                                "—"}
                            </td>

                            {/* STATUS */}

                            <td className="px-5 py-4">
                              <StatusBadge
                                status={
                                  release.status
                                }
                              />
                            </td>

                            {/* TOO LOST */}

                            <td className="px-5 py-4 font-mono text-xs text-zinc-400">
                              {getToolostId(
                                release
                              )}
                            </td>

                            {/* UPC */}

                            <td className="px-5 py-4 font-mono text-xs text-zinc-500">
                              {release.upc ||
                                "Not generated"}
                            </td>

                            {/* DATE */}

                            <td className="px-5 py-4 text-xs text-zinc-500">
                              {formatDate(
                                release.created_at ||
                                  release.createdAt
                              )}
                            </td>

                          </tr>
                        );
                      }
                    )}
                  </tbody>

                </table>

              </div>
            )}

            {/* TABLE FOOTER */}

            {!loading &&
              filteredReleases.length > 0 && (
                <div className="border-t border-white/10 px-5 py-4">
                  <p className="text-xs text-zinc-600">
                    Showing{" "}
                    <span className="text-zinc-400">
                      {filteredReleases.length}
                    </span>{" "}
                    of{" "}
                    <span className="text-zinc-400">
                      {releases.length}
                    </span>{" "}
                    releases
                  </p>
                </div>
              )}

          </div>

          {/* ================================================= */}
          {/* RIGHT SIDEBAR */}
          {/* ================================================= */}

          <aside className="space-y-6">

            {/* RELEASE STATUS */}

            <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
              <h3 className="font-bold">
                Release Status
              </h3>

              <p className="mt-1 text-xs text-zinc-600">
                Current catalog overview
              </p>

              <div className="mt-5 space-y-4">

                {statusRows.map(
                  (row) => {
                    const percentage =
                      statistics.total >
                      0
                        ? Math.round(
                            (row.value /
                              statistics.total) *
                              100
                          )
                        : 0;

                    return (
                      <div
                        key={row.label}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${row.color}`}
                            />

                            <span className="text-zinc-400">
                              {row.label}
                            </span>
                          </div>

                          <span className="font-semibold text-white">
                            {row.value}
                          </span>
                        </div>

                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                          <div
                            className={`h-full rounded-full ${row.color}`}
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}

              </div>
            </div>

            {/* ADMIN MODULES */}

            <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
              <h3 className="font-bold">
                Admin Modules
              </h3>

              <div className="mt-4 space-y-2">

                <a
                  href="/admin/analytics"
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
                >
                  <span>
                    📊 Analytics
                  </span>

                  <span>→</span>
                </a>

                <a
                  href="/admin/delivery"
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
                >
                  <span>
                    🚚 Delivery
                  </span>

                  <span>→</span>
                </a>

                <a
                  href="/admin/contracts"
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
                >
                  <span>
                    📄 Contracts
                  </span>

                  <span>→</span>
                </a>

                <a
                  href="/admin/bulk-upload"
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
                >
                  <span>
                    📤 Bulk Upload
                  </span>

                  <span>→</span>
                </a>

                <a
                  href="/admin/support"
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
                >
                  <span>
                    🎫 Support
                  </span>

                  <span>→</span>
                </a>

              </div>
            </div>

            {/* SYSTEM INFO */}

            <div className="rounded-2xl border border-blue-500/10 bg-blue-500/[0.03] p-5">
              <div className="flex items-start gap-3">

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  ℹ️
                </div>

                <div>
                  <h3 className="text-sm font-semibold">
                    Nexorael Admin
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    This panel displays releases
                    available through the Nexorael
                    administration system.
                  </p>

                  <p className="mt-3 text-[10px] text-zinc-700">
                    Data source: Admin Releases API
                  </p>
                </div>

              </div>
            </div>

          </aside>

        </section>

      </div>
    </main>
  );
}