"use client";

import { useEffect, useMemo, useState } from "react";

type Release = {
  id?: string | number;
  title?: string | null;
  status?: string | null;
  type?: string | null;
  artist_name?: string | null;
  artistName?: string | null;
  toolost_release_id?: string | number | null;
  toolostReleaseId?: string | number | null;
  upc?: string | null;
  artwork_url?: string | null;
  artworkUrl?: string | null;
  cover_url?: string | null;
  coverUrl?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  label?: string | null;
  [key: string]: any;
};

type Action =
  | "submit"
  | "approve"
  | "reject"
  | "draft"
  | "takedown";

type ConfirmAction = {
  action: Action;
  release: Release;
} | null;

type TooLostStore = {
  id: string;
  name: string;
};

export default function AdminPage() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [actionLoading, setActionLoading] = useState<string | number | null>(
    null
  );

  const [confirmAction, setConfirmAction] =
    useState<ConfirmAction>(null);

  const [note, setNote] = useState("");
  const [tooLostStores, setTooLostStores] = useState<TooLostStore[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storesError, setStoresError] = useState("");

  async function loadTooLostStores(release: Release) {
    if (!release.id) return;

    try {
      setStoresLoading(true);
      setStoresError("");
      setTooLostStores([]);
      setSelectedStoreIds([]);

      const response = await fetch(
        `/api/admin/releases/${release.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get_dsps" }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load Too Lost stores.");
      }

      const uniqueStores = Array.from(
        new Map(
          (Array.isArray(data.platforms) ? data.platforms : [])
            .filter((store: any) => store?.id && store?.name)
            .map((store: any) => [
              String(store.id),
              { id: String(store.id), name: String(store.name) },
            ])
        ).values()
      ) as TooLostStore[];

      setTooLostStores(uniqueStores);

      const previouslySelected = new Set(
        (Array.isArray(data.selected) ? data.selected : [])
          .map((item: any) => String(item?.toolost_platform_id || ""))
          .filter(Boolean)
      );

      setSelectedStoreIds(
        uniqueStores
          .filter((store) => previouslySelected.has(store.id))
          .map((store) => store.id)
      );
    } catch (err) {
      setStoresError(
        err instanceof Error ? err.message : "Failed to load Too Lost stores."
      );
    } finally {
      setStoresLoading(false);
    }
  }

  function toggleStore(storeId: string) {
    setSelectedStoreIds((current) =>
      current.includes(storeId)
        ? current.filter((id) => id !== storeId)
        : [...current, storeId]
    );
  }

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
      console.error(err);

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

  const filteredReleases = useMemo(() => {
    const query = search.trim().toLowerCase();

    return releases.filter((release) => {
      const status = String(
        release.status || ""
      ).toLowerCase();

      const artist =
        release.artist_name ||
        release.artistName ||
        "";

      const matchesSearch =
        !query ||
        String(release.title || "")
          .toLowerCase()
          .includes(query) ||
        String(artist)
          .toLowerCase()
          .includes(query) ||
        String(
          release.toolost_release_id ||
            release.toolostReleaseId ||
            ""
        )
          .toLowerCase()
          .includes(query) ||
        String(release.upc || "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [releases, search, statusFilter]);

  const totalReleases = releases.length;

  const draftReleases = releases.filter(
    (release) =>
      String(release.status || "").toLowerCase() ===
      "draft"
  ).length;

  const pendingReleases = releases.filter((release) => {
    const status = String(
      release.status || ""
    ).toLowerCase();

    return (
      status === "pending" ||
      status === "submitted" ||
      status === "processing"
    );
  }).length;

  const approvedReleases = releases.filter(
    (release) =>
      String(release.status || "").toLowerCase() ===
      "approved"
  ).length;

  const liveReleases = releases.filter(
    (release) =>
      String(release.status || "").toLowerCase() ===
      "live"
  ).length;

  const rejectedReleases = releases.filter(
    (release) =>
      String(release.status || "").toLowerCase() ===
      "rejected"
  ).length;

  const takedownReleases = releases.filter(
    (release) =>
      String(release.status || "").toLowerCase() ===
      "takedown"
  ).length;

  const artists = new Set(
    releases
      .map(
        (release) =>
          release.artist_name ||
          release.artistName
      )
      .filter(Boolean)
  ).size;

  const labels = new Set(
    releases
      .map((release) => release.label)
      .filter(Boolean)
  ).size;

  function getStatusClass(status: string) {
    switch (status.toLowerCase()) {
      case "draft":
        return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";

      case "pending":
      case "submitted":
      case "processing":
        return "border-blue-500/30 bg-blue-500/10 text-blue-400";

      case "approved":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";

      case "live":
        return "border-green-500/30 bg-green-500/10 text-green-400";

      case "rejected":
        return "border-red-500/30 bg-red-500/10 text-red-400";

      case "takedown":
        return "border-orange-500/30 bg-orange-500/10 text-orange-400";

      default:
        return "border-zinc-500/30 bg-zinc-500/10 text-zinc-400";
    }
  }

  function getArtwork(release: Release) {
    return (
      release.artwork_url ||
      release.artworkUrl ||
      release.cover_url ||
      release.coverUrl ||
      ""
    );
  }

  function openAction(action: Action, release: Release) {
    setNote("");
    setStoresError("");
    setTooLostStores([]);
    setSelectedStoreIds([]);
    setConfirmAction({
      action,
      release,
    });

    if (action === "approve") {
      void loadTooLostStores(release);
    }
  }

  async function executeAction() {
    if (!confirmAction) return;

    const { action, release } = confirmAction;

    if (!release.id) {
      setError("Release ID is missing.");
      return;
    }

    try {
      setActionLoading(release.id);
      setError("");

      const response = await fetch(
        `/api/admin/releases/${release.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            note: note.trim(),
            ...(action === "approve"
              ? { storeIds: selectedStoreIds }
              : {}),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            `Failed to ${action} release`
        );
      }

      setConfirmAction(null);
      setNote("");

      await loadReleases();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${action} release`
      );
    } finally {
      setActionLoading(null);
    }
  }

  function actionLabel(action: Action) {
    switch (action) {
      case "submit":
        return "Submit to Too Lost";

      case "approve":
        return "Approve Release";

      case "reject":
        return "Reject Release";

      case "draft":
        return "Move to Draft";

      case "takedown":
        return "Takedown Release";
    }
  }

  function actionDescription(action: Action) {
    switch (action) {
      case "submit":
        return "This will move the release to Pending Review.";

      case "approve":
        return "This will mark the release as approved.";

      case "reject":
        return "This will mark the release as rejected.";

      case "draft":
        return "This will move the release back to draft.";

      case "takedown":
        return "This will mark the release for takedown.";
    }
  }

  function renderActions(release: Release) {
    const status = String(
      release.status || ""
    ).toLowerCase();

    const busy =
      actionLoading === release.id;

    return (
      <div className="flex flex-wrap gap-2">

        <button
          onClick={() =>
            (window.location.href =
              `/releases/${release.id}`)
          }
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10"
        >
          View
        </button>

        {status === "draft" && (
          <button
            disabled={busy}
            onClick={() =>
              openAction("submit", release)
            }
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? "..." : "Submit"}
          </button>
        )}

        {(status === "pending" ||
          status === "submitted" ||
          status === "processing") && (
          <>
            <button
              disabled={busy}
              onClick={() =>
                openAction("approve", release)
              }
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? "..." : "Approve"}
            </button>

            <button
              disabled={busy}
              onClick={() =>
                openAction("reject", release)
              }
              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {busy ? "..." : "Reject"}
            </button>
          </>
        )}

        {status === "approved" && (
          <button
            disabled={busy}
            onClick={() =>
              openAction("takedown", release)
            }
            className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
          >
            {busy ? "..." : "Takedown"}
          </button>
        )}

        {status === "live" && (
          <button
            disabled={busy}
            onClick={() =>
              openAction("takedown", release)
            }
            className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
          >
            {busy ? "..." : "Takedown"}
          </button>
        )}

        {(status === "rejected" ||
          status === "approved" ||
          status === "pending" ||
          status === "submitted" ||
          status === "processing") && (
          <button
            disabled={busy}
            onClick={() =>
              openAction("draft", release)
            }
            className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-50"
          >
            Draft
          </button>
        )}

      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050609] px-4 py-8 text-white md:px-8">

      <div className="mx-auto max-w-[1500px]">

        {/* HEADER */}

        <div className="flex flex-col gap-5 border-b border-white/10 pb-7 md:flex-row md:items-center md:justify-between">

          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-400">
                ADMIN
              </span>

              <span className="text-xs text-zinc-500">
                Nexorael Music Distribution
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              Release Management
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              Manage your complete music catalog,
              submissions and release status.
            </p>
          </div>

          <button
            onClick={loadReleases}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>

        </div>

        {/* ERROR */}

        {error && (
          <div className="mt-6 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-400">
            <span>{error}</span>

            <button
              onClick={loadReleases}
              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/10"
            >
              Retry
            </button>
          </div>
        )}

        {/* STATS */}

        <div className="mt-7 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">

          <Stat
            label="Total"
            value={totalReleases}
            icon="🎵"
          />

          <Stat
            label="Draft"
            value={draftReleases}
            icon="📝"
          />

          <Stat
            label="Pending"
            value={pendingReleases}
            icon="⏳"
          />

          <Stat
            label="Approved"
            value={approvedReleases}
            icon="✓"
          />

          <Stat
            label="Live"
            value={liveReleases}
            icon="🌐"
          />

          <Stat
            label="Rejected"
            value={rejectedReleases}
            icon="⚠"
          />

          <Stat
            label="Takedown"
            value={takedownReleases}
            icon="🚫"
          />

        </div>

        {/* SECONDARY STATS */}

        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">

          <Stat
            label="Artists"
            value={artists}
            icon="🎤"
          />

          <Stat
            label="Labels"
            value={labels}
            icon="🏷"
          />

          <Stat
            label="Catalog Health"
            value={
              totalReleases > 0
                ? `${Math.round(
                    ((approvedReleases +
                      liveReleases) /
                      totalReleases) *
                      100
                  )}%`
                : "0%"
            }
            icon="📊"
          />

          <Stat
            label="Needs Attention"
            value={
              rejectedReleases +
              draftReleases
            }
            icon="🔔"
          />

        </div>

        {/* RELEASES */}

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0f]">

          {/* TOOLBAR */}

          <div className="flex flex-col gap-4 border-b border-white/10 p-5 md:flex-row md:items-center md:justify-between">

            <div>
              <h2 className="text-lg font-bold">
                All Releases
              </h2>

              <p className="mt-1 text-xs text-zinc-500">
                {filteredReleases.length} of{" "}
                {totalReleases} releases
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search title, artist, UPC..."
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-blue-500/50 sm:w-72"
              />

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value)
                }
                className="rounded-xl border border-white/10 bg-black px-4 py-2.5 text-sm outline-none"
              >
                <option value="all">
                  All Status
                </option>

                <option value="draft">
                  Draft
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

                <option value="takedown">
                  Takedown
                </option>
              </select>

            </div>

          </div>

          {/* TABLE */}

          {loading ? (
            <div className="p-16 text-center text-sm text-zinc-500">
              Loading releases...
            </div>
          ) : filteredReleases.length === 0 ? (
            <div className="p-16 text-center">

              <div className="text-4xl">
                🎵
              </div>

              <p className="mt-4 font-semibold">
                No releases found
              </p>

              <p className="mt-1 text-sm text-zinc-500">
                Try changing your search or status
                filter.
              </p>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[1250px]">

                <thead className="border-b border-white/10 bg-black/30">

                  <tr className="text-left text-xs uppercase tracking-wide text-zinc-500">

                    <th className="px-5 py-4">
                      Release
                    </th>

                    <th className="px-5 py-4">
                      Artist
                    </th>

                    <th className="px-5 py-4">
                      Type
                    </th>

                    <th className="px-5 py-4">
                      Status
                    </th>

                    <th className="px-5 py-4">
                      Too Lost ID
                    </th>

                    <th className="px-5 py-4">
                      UPC
                    </th>

                    <th className="px-5 py-4">
                      Created
                    </th>

                    <th className="px-5 py-4">
                      Actions
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {filteredReleases.map(
                    (release, index) => {

                      const artist =
                        release.artist_name ||
                        release.artistName ||
                        "Unknown Artist";

                      const toolostId =
                        release.toolost_release_id ||
                        release.toolostReleaseId ||
                        "—";

                      const status =
                        String(
                          release.status ||
                            "unknown"
                        );

                      const artwork =
                        getArtwork(release);

                      const created =
                        release.created_at ||
                        release.createdAt;

                      return (
                        <tr
                          key={
                            release.id ??
                            `${release.title}-${index}`
                          }
                          className="border-b border-white/5 align-middle hover:bg-white/[0.02]"
                        >

                          {/* RELEASE */}

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-3">

                              {artwork ? (
                                <img
                                  src={artwork}
                                  alt=""
                                  className="h-12 w-12 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/5 text-xl">
                                  🎵
                                </div>
                              )}

                              <div>
                                <div className="font-semibold">
                                  {release.title ||
                                    "Untitled Release"}
                                </div>

                                <div className="mt-1 max-w-[220px] truncate text-[10px] text-zinc-600">
                                  ID:{" "}
                                  {release.id ||
                                    "—"}
                                </div>
                              </div>

                            </div>

                          </td>

                          {/* ARTIST */}

                          <td className="px-5 py-4 text-sm text-zinc-300">
                            {artist}
                          </td>

                          {/* TYPE */}

                          <td className="px-5 py-4 text-sm text-zinc-400">
                            {release.type ||
                              "Single"}
                          </td>

                          {/* STATUS */}

                          <td className="px-5 py-4">

                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase ${getStatusClass(
                                status
                              )}`}
                            >
                              {status}
                            </span>

                          </td>

                          {/* TOO LOST */}

                          <td className="px-5 py-4 font-mono text-xs text-zinc-400">
                            {toolostId}
                          </td>

                          {/* UPC */}

                          <td className="px-5 py-4 font-mono text-xs text-zinc-500">
                            {release.upc ||
                              "Not generated"}
                          </td>

                          {/* CREATED */}

                          <td className="px-5 py-4 text-xs text-zinc-500">

                            {created
                              ? new Date(
                                  created
                                ).toLocaleDateString()
                              : "—"}

                          </td>

                          {/* ACTIONS */}

                          <td className="px-5 py-4">
                            {renderActions(
                              release
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

        </section>

      </div>

      {/* CONFIRMATION MODAL */}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">

          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101014] p-6 shadow-2xl">

            <div className="flex items-start justify-between">

              <div>
                <h3 className="text-lg font-bold">
                  {actionLabel(
                    confirmAction.action
                  )}
                </h3>

                <p className="mt-2 text-sm text-zinc-400">
                  {actionDescription(
                    confirmAction.action
                  )}
                </p>
              </div>

              <button
                onClick={() =>
                  setConfirmAction(null)
                }
                className="text-xl text-zinc-500 hover:text-white"
              >
                ×
              </button>

            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">

              <div className="font-semibold">
                {confirmAction.release.title ||
                  "Untitled Release"}
              </div>

              <div className="mt-1 text-xs text-zinc-500">
                {confirmAction.release.artist_name ||
                  confirmAction.release.artistName ||
                  "Unknown Artist"}
              </div>

            </div>

            {(confirmAction.action ===
              "reject" ||
              confirmAction.action ===
                "takedown") && (
              <div className="mt-5">

                <label className="mb-2 block text-xs font-semibold text-zinc-400">
                  Reason / Note
                </label>

                <textarea
                  value={note}
                  onChange={(e) =>
                    setNote(e.target.value)
                  }
                  placeholder={
                    confirmAction.action ===
                    "reject"
                      ? "Why is this release being rejected?"
                      : "Why is this release being taken down?"
                  }
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/10 bg-black p-3 text-sm outline-none placeholder:text-zinc-600 focus:border-blue-500/50"
                />

              </div>
            )}

            {confirmAction.action === "approve" && (
              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Too Lost Stores *
                  </label>

                  {tooLostStores.length > 0 && (
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedStoreIds(
                            tooLostStores.map((store) => store.id)
                          )
                        }
                        className="text-blue-400 hover:text-blue-300"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedStoreIds([])}
                        className="text-zinc-400 hover:text-white"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {storesLoading && (
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-400">
                    Loading stores from Too Lost...
                  </div>
                )}

                {!storesLoading && storesError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {storesError}
                  </div>
                )}

                {!storesLoading && !storesError && tooLostStores.length === 0 && (
                  <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
                    Too Lost returned no stores.
                  </div>
                )}

                {!storesLoading && tooLostStores.length > 0 && (
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-3">
                    {tooLostStores.map((store) => {
                      const checked = selectedStoreIds.includes(store.id);

                      return (
                        <label
                          key={store.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                            checked
                              ? "border-emerald-500/40 bg-emerald-500/10 text-white"
                              : "border-white/5 bg-white/[0.02] text-zinc-300 hover:bg-white/5"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStore(store.id)}
                            className="h-4 w-4 accent-emerald-500"
                          />
                          <span className="flex-1">{store.name}</span>
                          <span className="font-mono text-[10px] text-zinc-600">
                            {store.id}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                <p className="mt-2 text-xs text-zinc-500">
                  {selectedStoreIds.length} store(s) selected
                </p>
              </div>
            )}

            <div className="mt-6 flex gap-3">

              <button
                onClick={() =>
                  setConfirmAction(null)
                }
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold hover:bg-white/10"
              >
                Cancel
              </button>

              <button
                disabled={
                  actionLoading !== null ||
                  (confirmAction.action === "approve" &&
                    (storesLoading || selectedStoreIds.length === 0))
                }
                onClick={executeAction}
                className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-50 ${
                  confirmAction.action ===
                  "reject"
                    ? "bg-red-600 hover:bg-red-500"
                    : confirmAction.action ===
                      "takedown"
                    ? "bg-orange-600 hover:bg-orange-500"
                    : confirmAction.action ===
                      "approve"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                {actionLoading !== null
                  ? "Processing..."
                  : "Confirm"}
              </button>

            </div>

          </div>

        </div>
      )}

    </main>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0a0f] p-4">

      <div className="flex items-center justify-between">

        <div>
          <p className="text-xs text-zinc-500">
            {label}
          </p>

          <p className="mt-2 text-2xl font-bold">
            {value}
          </p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sm">
          {icon}
        </div>

      </div>

    </div>
  );
}