"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Release = {
  id: string;
  title?: string | null;
  artist_name?: string | null;
  label_name?: string | null;
  status?: string | null;
  type?: string | null;
  created_at?: string | null;
  user_id?: string | null;
  white_label_id?: string | null;
  admin_note?: string | null;
  toolost_release_id?: string | number | null;

  uploaded_by_name?: string | null;
  uploaded_by_email?: string | null;
  white_label_name?: string | null;

  [key: string]: any;
};

type DSPDelivery = {
  id: string;
  release_id: string;
  dsp_name?: string | null;
  dsp?: string | null;
  platform?: string | null;
  status?: string | null;
  live_link?: string | null;
  created_at?: string | null;
};

const DSP_LIST = [
  "Spotify",
  "Apple Music",
  "YouTube Music",
  "Amazon Music",
  "Deezer",
  "TikTok",
  "Instagram / Facebook",
  "Tidal",
  "Pandora",
  "SoundCloud",
  "Boomplay",
  "Audiomack",
];

const STATUS_LIST = [
  "all",
  "draft",
  "pending",
  "under_review",
  "approved",
  "rejected",
  "delivered",
  "live",
  "takedown",
];

export default function AdminReleasesPage() {
  const router = useRouter();

  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [adminProfile, setAdminProfile] =
    useState<any>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [selectedRelease, setSelectedRelease] =
    useState<Release | null>(null);

  const [selectedDSPs, setSelectedDSPs] =
    useState<string[]>([]);

  const [existingDSPs, setExistingDSPs] =
    useState<DSPDelivery[]>([]);

  const [loadingDSPs, setLoadingDSPs] =
    useState(false);

  const [savingDSPs, setSavingDSPs] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState<string | null>(null);

  useEffect(() => {
    checkAdmin();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================
  // ADMIN CHECK
  // ==========================================

  async function checkAdmin() {
  try {
    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    console.log("ADMIN AUTH USER:", userData.user);
    console.log("ADMIN AUTH ERROR:", userError);

    if (userError || !userData.user) {
      console.error(
        "No authenticated user:",
        userError
      );

      router.push("/login");
      return;
    }

    const userId = userData.user.id;

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        "id,role,status,white_label_id,full_name,email"
      )
      .eq("id", userId)
      .maybeSingle();

    console.log(
      "ADMIN PROFILE:",
      profile
    );

    console.log(
      "ADMIN PROFILE ERROR:",
      profileError
    );

    // Do NOT silently redirect.
    // Show the real problem on screen.
    if (profileError) {
      setError(
        `Profile query failed: ${profileError.message}`
      );

      setLoading(false);
      return;
    }

    if (!profile) {
      setError(
        `No profile found for logged-in user. User ID: ${userId}`
      );

      setLoading(false);
      return;
    }

    const userRole = String(
      profile.role || ""
    )
      .trim()
      .toLowerCase();

    const userStatus = String(
      profile.status || ""
    )
      .trim()
      .toLowerCase();

    console.log(
      "ADMIN ROLE:",
      userRole
    );

    console.log(
      "ADMIN STATUS:",
      userStatus
    );

    const allowedRoles = [
      "master_admin",
      "white_label_admin",
      "admin",
    ];

    if (
      !allowedRoles.includes(
        userRole
      )
    ) {
      setError(
        `Admin access denied. Your current role is "${profile.role}".`
      );

      setLoading(false);
      return;
    }

    if (
      userStatus &&
      userStatus !== "active"
    ) {
      setError(
        `Admin access denied. Your account status is "${profile.status}".`
      );

      setLoading(false);
      return;
    }

    setAdminProfile(profile);

    await loadReleases(profile);
  } catch (err) {
    console.error(
      "ADMIN CHECK ERROR:",
      err
    );

    setError(
      err instanceof Error
        ? err.message
        : "Unable to verify admin."
    );

    setLoading(false);
  }
}

  // ==========================================
  // LOAD RELEASES
  // ==========================================

  async function loadReleases(
    profileParam = adminProfile
  ) {
    setLoading(true);
    setError("");

    try {
      let query = supabase
        .from("releases")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

      if (
        profileParam?.role ===
        "white_label_admin"
      ) {
        if (
          !profileParam.white_label_id
        ) {
          setReleases([]);
          setLoading(false);
          return;
        }

        query = query.eq(
          "white_label_id",
          profileParam.white_label_id
        );
      }

      const {
        data: releaseData,
        error: releaseError,
      } = await query;

      if (releaseError) {
        throw new Error(
          releaseError.message
        );
      }

      const {
        data: profilesData,
      } = await supabase
        .from("profiles")
        .select(
          "id,full_name,email,role,white_label_id"
        );

      const {
        data: whiteLabelsData,
      } = await supabase
        .from("white_labels")
        .select(
          "id,name,brand_name,domain"
        );

      const merged =
        (releaseData || []).map(
          (release: any) => {
            const profile =
              profilesData?.find(
                (p) =>
                  p.id ===
                  release.user_id
              );

            const whiteLabel =
              whiteLabelsData?.find(
                (wl) =>
                  wl.id ===
                  release.white_label_id
              );

            return {
              ...release,

              uploaded_by_name:
                profile?.full_name ||
                "-",

              uploaded_by_email:
                profile?.email ||
                "-",

              white_label_name:
                whiteLabel?.name ||
                whiteLabel?.brand_name ||
                "Nexorael Direct",
            };
          }
        );

      setReleases(merged);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load releases."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // OPEN DSP SELECTOR
  // ==========================================

  async function openDSPSelector(
    release: Release
  ) {
    setSelectedRelease(release);
    setSelectedDSPs([]);
    setExistingDSPs([]);
    setLoadingDSPs(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from("dsp_deliveries")
        .select("*")
        .eq("release_id", release.id)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        throw new Error(error.message);
      }

      const rows =
        (data || []) as DSPDelivery[];

      setExistingDSPs(rows);

      const names = rows
        .map(
          (row) =>
            row.dsp_name ||
            row.dsp ||
            row.platform
        )
        .filter(Boolean) as string[];

      setSelectedDSPs(names);
    } catch (err) {
      console.error(err);

      alert(
        err instanceof Error
          ? err.message
          : "Failed to load DSPs."
      );
    } finally {
      setLoadingDSPs(false);
    }
  }

  // ==========================================
  // TOGGLE DSP
  // ==========================================

  function toggleDSP(dsp: string) {
    const alreadyExists =
      existingDSPs.some(
        (item) =>
          (
            item.dsp_name ||
            item.dsp ||
            item.platform
          ) === dsp
      );

    if (alreadyExists) {
      return;
    }

    setSelectedDSPs(
      (current) =>
        current.includes(dsp)
          ? current.filter(
              (item) => item !== dsp
            )
          : [...current, dsp]
    );
  }

  // ==========================================
  // SAVE DSP SELECTION
  // ==========================================

  async function saveDSPSelection() {
    if (!selectedRelease) return;

    if (selectedDSPs.length === 0) {
      alert(
        "Please select at least one DSP."
      );
      return;
    }

    setSavingDSPs(true);

    try {
      const existingNames =
        existingDSPs
          .map(
            (item) =>
              item.dsp_name ||
              item.dsp ||
              item.platform
          )
          .filter(Boolean);

      const newDSPs =
        selectedDSPs.filter(
          (dsp) =>
            !existingNames.includes(dsp)
        );

      if (newDSPs.length === 0) {
        alert(
          "All selected DSPs are already saved."
        );
        return;
      }

      const rows = newDSPs.map(
        (dsp) => ({
          release_id:
            selectedRelease.id,

          dsp_name: dsp,

          status: "pending",
        })
      );

      const {
        error,
      } = await supabase
        .from("dsp_deliveries")
        .insert(rows);

      if (error) {
        throw new Error(error.message);
      }

      alert(
        `${newDSPs.length} DSP(s) saved successfully.`
      );

      await openDSPSelector(
        selectedRelease
      );
    } catch (err) {
      console.error(err);

      alert(
        err instanceof Error
          ? err.message
          : "Failed to save DSP selection."
      );
    } finally {
      setSavingDSPs(false);
    }
  }

  // ==========================================
  // RELEASE ACTION
  // ==========================================

  async function updateReleaseStatus(
    release: Release,
    status: string
  ) {
    let note = "";

    if (
      status === "rejected"
    ) {
      note =
        prompt(
          "Rejection reason:"
        ) || "";

      if (!note) {
        alert(
          "Rejection reason is required."
        );
        return;
      }
    }

    if (
      status === "takedown"
    ) {
      note =
        prompt(
          "Takedown reason:"
        ) || "";

      if (!note) {
        alert(
          "Takedown reason is required."
        );
        return;
      }
    }

    const actionKey =
      `${release.id}-${status}`;

    setActionLoading(actionKey);

    try {
      const response =
        await fetch(
          `/api/admin/releases/${release.id}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              action: status,
              note,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Release action failed."
        );
      }

      alert(
        data.message ||
          "Release updated successfully."
      );

      await loadReleases(
        adminProfile
      );
    } catch (err) {
      console.error(err);

      alert(
        err instanceof Error
          ? err.message
          : "Release action failed."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // ==========================================
  // APPROVE & SUBMIT
  // ==========================================

  async function approveRelease(
    release: Release
  ) {
    const dspCount =
      existingDSPs.length;

    if (dspCount === 0) {
      alert(
        "Please select at least one DSP before approving this release."
      );

      await openDSPSelector(
        release
      );

      return;
    }

    const confirmed =
      confirm(
        `Approve "${release.title || "Untitled"}" and submit it to Too Lost?`
      );

    if (!confirmed) return;

    const actionKey =
      `${release.id}-approve`;

    setActionLoading(actionKey);

    try {
      const response =
        await fetch(
          `/api/admin/releases/${release.id}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              action: "approve",
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Too Lost submission failed."
        );
      }

      alert(
        "Release approved and submitted to Too Lost successfully."
      );

      await loadReleases(
        adminProfile
      );
    } catch (err) {
      console.error(err);

      alert(
        err instanceof Error
          ? err.message
          : "Too Lost submission failed."
      );
    } finally {
      setActionLoading(null);
    }
  }

  // ==========================================
  // FILTER
  // ==========================================

  const filteredReleases =
    releases.filter(
      (release) => {
        const status =
          String(
            release.status || ""
          ).toLowerCase();

        const searchText =
          search
            .toLowerCase()
            .trim();

        const matchesSearch =
          !searchText ||
          String(
            release.title || ""
          )
            .toLowerCase()
            .includes(searchText) ||
          String(
            release.artist_name || ""
          )
            .toLowerCase()
            .includes(searchText) ||
          String(
            release.label_name || ""
          )
            .toLowerCase()
            .includes(searchText) ||
          String(
            release.toolost_release_id ||
              ""
          )
            .toLowerCase()
            .includes(searchText);

        const matchesStatus =
          statusFilter ===
            "all" ||
          status ===
            statusFilter;

        return (
          matchesSearch &&
          matchesStatus
        );
      }
    );

  // ==========================================
  // STATS
  // ==========================================

  const total =
    releases.length;

  const draftCount =
    releases.filter(
      (r) =>
        String(
          r.status || ""
        ).toLowerCase() ===
        "draft"
    ).length;

  const pendingCount =
    releases.filter(
      (r) => {
        const status =
          String(
            r.status || ""
          ).toLowerCase();

        return (
          status ===
            "pending" ||
          status ===
            "under_review" ||
          status ===
            "processing"
        );
      }
    ).length;

  const liveCount =
    releases.filter(
      (r) =>
        String(
          r.status || ""
        ).toLowerCase() ===
        "live"
    ).length;

  // ==========================================
  // UI
  // ==========================================

  return (
    <main className="min-h-screen bg-[#050816] p-6 text-white md:p-10">

      <div className="mx-auto max-w-[1600px]">

        {/* HEADER */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

          <div>

            <h1 className="text-3xl font-bold">
              Release Management
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              Manage releases, DSP distribution,
              approvals and takedowns.
            </p>

          </div>

          <button
            onClick={() =>
              loadReleases(
                adminProfile
              )
            }
            disabled={loading}
            className="rounded-xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-50"
          >
            {loading
              ? "Loading..."
              : "Refresh Releases"}
          </button>

        </div>


        {/* STATS */}

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">

          <Stat
            label="Total Releases"
            value={total}
          />

          <Stat
            label="Draft"
            value={draftCount}
          />

          <Stat
            label="Pending Review"
            value={pendingCount}
          />

          <Stat
            label="Live"
            value={liveCount}
          />

        </div>


        {/* ERROR */}

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
            {error}
          </div>
        )}


        {/* FILTER BAR */}

        <div className="mt-8 rounded-2xl border border-white/10 bg-[#0d1224] p-5">

          <div className="flex flex-col gap-4 lg:flex-row">

            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search title, artist, label or Too Lost ID..."
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-blue-500 lg:flex-1"
            />

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value
                )
              }
              className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
            >
              {STATUS_LIST.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status === "all"
                      ? "All Status"
                      : status
                          .replace(
                            "_",
                            " "
                          )
                          .toUpperCase()}
                  </option>
                )
              )}
            </select>

          </div>

        </div>


        {/* RELEASE TABLE */}

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1224]">

          {loading ? (
            <div className="p-12 text-center text-zinc-500">
              Loading releases...
            </div>
          ) : filteredReleases.length ===
            0 ? (
            <div className="p-12 text-center text-zinc-500">
              No releases found.
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[1450px]">

                <thead className="border-b border-white/10 bg-black/20">

                  <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">

                    <th className="px-5 py-4">
                      Release
                    </th>

                    <th className="px-5 py-4">
                      Artist
                    </th>

                    <th className="px-5 py-4">
                      Label / User
                    </th>

                    <th className="px-5 py-4">
                      Too Lost ID
                    </th>

                    <th className="px-5 py-4">
                      Status
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
                    (release) => {

                      const status =
                        String(
                          release.status ||
                            "draft"
                        ).toLowerCase();

                      const approveLoading =
                        actionLoading ===
                        `${release.id}-approve`;

                      return (
                        <tr
                          key={
                            release.id
                          }
                          className="border-b border-white/5 hover:bg-white/[0.025]"
                        >

                          {/* RELEASE */}

                          <td className="px-5 py-5">

                            <div className="font-semibold">
                              {release.title ||
                                "Untitled Release"}
                            </div>

                            <div className="mt-1 text-xs text-zinc-600">
                              ID:{" "}
                              {release.id}
                            </div>

                          </td>


                          {/* ARTIST */}

                          <td className="px-5 py-5 text-sm text-zinc-300">
                            {release.artist_name ||
                              "—"}
                          </td>


                          {/* LABEL */}

                          <td className="px-5 py-5">

                            <div className="text-sm text-zinc-300">
                              {release.white_label_name ||
                                "Nexorael Direct"}
                            </div>

                            <div className="mt-1 text-xs text-zinc-600">
                              {release.uploaded_by_name ||
                                "-"}
                            </div>

                            <div className="text-xs text-zinc-600">
                              {release.uploaded_by_email ||
                                "-"}
                            </div>

                          </td>


                          {/* TOO LOST */}

                          <td className="px-5 py-5 font-mono text-xs text-zinc-400">

                            {release.toolost_release_id ||
                              "Not connected"}

                          </td>


                          {/* STATUS */}

                          <td className="px-5 py-5">

                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase ${statusClass(
                                status
                              )}`}
                            >
                              {status}
                            </span>

                          </td>


                          {/* CREATED */}

                          <td className="px-5 py-5 text-sm text-zinc-500">

                            {release.created_at
                              ? new Date(
                                  release.created_at
                                ).toLocaleDateString(
                                  "en-IN"
                                )
                              : "—"}

                          </td>


                          {/* ACTIONS */}

                          <td className="px-5 py-5">

                            <div className="flex flex-wrap gap-2">

                              {/* VIEW */}

                              <button
                                onClick={() =>
                                  router.push(
                                    `/releases/${release.id}`
                                  )
                                }
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium hover:bg-white/10"
                              >
                                View
                              </button>


                              {/* DSP */}

                              <button
                                onClick={() =>
                                  openDSPSelector(
                                    release
                                  )
                                }
                                className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/20"
                              >
                                DSP Select
                              </button>


                              {/* APPROVE */}

                              <button
                                onClick={() =>
                                  approveRelease(
                                    release
                                  )
                                }
                                disabled={
                                  approveLoading
                                }
                                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold hover:bg-green-500 disabled:opacity-50"
                              >
                                {approveLoading
                                  ? "Submitting..."
                                  : "Approve & Submit"}
                              </button>


                              {/* REJECT */}

                              <button
                                onClick={() =>
                                  updateReleaseStatus(
                                    release,
                                    "rejected"
                                  )
                                }
                                disabled={
                                  actionLoading ===
                                  `${release.id}-rejected`
                                }
                                className="rounded-lg bg-red-600/90 px-3 py-2 text-xs font-semibold hover:bg-red-500 disabled:opacity-50"
                              >
                                Reject
                              </button>


                              {/* DRAFT */}

                              <button
                                onClick={() =>
                                  updateReleaseStatus(
                                    release,
                                    "draft"
                                  )
                                }
                                disabled={
                                  actionLoading ===
                                  `${release.id}-draft`
                                }
                                className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs font-medium text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-50"
                              >
                                Draft
                              </button>


                              {/* LIVE */}

                              <button
                                onClick={() =>
                                  updateReleaseStatus(
                                    release,
                                    "live"
                                  )
                                }
                                disabled={
                                  actionLoading ===
                                  `${release.id}-live`
                                }
                                className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-xs font-medium text-green-400 hover:bg-green-500/20 disabled:opacity-50"
                              >
                                Live
                              </button>


                              {/* TAKEDOWN */}

                              <button
                                onClick={() =>
                                  updateReleaseStatus(
                                    release,
                                    "takedown"
                                  )
                                }
                                disabled={
                                  actionLoading ===
                                  `${release.id}-takedown`
                                }
                                className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                              >
                                Takedown
                              </button>

                            </div>

                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>
          )}

        </div>

      </div>


      {/* ======================================
          DSP MODAL
      ====================================== */}

      {selectedRelease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">

          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1224] shadow-2xl">

            {/* MODAL HEADER */}

            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0d1224] p-6">

              <div className="flex items-start justify-between gap-4">

                <div>

                  <h2 className="text-xl font-bold">
                    Select DSPs
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    {selectedRelease.title ||
                      "Untitled Release"}

                    {" • "}

                    {selectedRelease.artist_name ||
                      "Unknown Artist"}
                  </p>

                </div>

                <button
                  onClick={() =>
                    setSelectedRelease(
                      null
                    )
                  }
                  className="rounded-lg border border-white/10 px-3 py-2 text-zinc-400 hover:bg-white/5 hover:text-white"
                >
                  ✕
                </button>

              </div>

            </div>


            {/* MODAL CONTENT */}

            <div className="p-6">

              {loadingDSPs ? (
                <div className="p-10 text-center text-zinc-500">
                  Loading DSPs...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                    {DSP_LIST.map(
                      (dsp) => {

                        const selected =
                          selectedDSPs.includes(
                            dsp
                          );

                        const alreadySaved =
                          existingDSPs.some(
                            (item) =>
                              (
                                item.dsp_name ||
                                item.dsp ||
                                item.platform
                              ) === dsp
                          );

                        return (
                          <button
                            key={dsp}
                            type="button"
                            disabled={
                              alreadySaved
                            }
                            onClick={() =>
                              toggleDSP(
                                dsp
                              )
                            }
                            className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${
                              alreadySaved
                                ? "cursor-not-allowed border-green-500/20 bg-green-500/5 opacity-60"
                                : selected
                                ? "border-blue-500 bg-blue-500/10"
                                : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5"
                            }`}
                          >

                            <div>

                              <p className="font-medium">
                                {dsp}
                              </p>

                              <p className="mt-1 text-xs text-zinc-600">

                                {alreadySaved
                                  ? "Already selected"
                                  : selected
                                  ? "Selected"
                                  : "Available"}

                              </p>

                            </div>

                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-md border text-sm ${
                                alreadySaved ||
                                selected
                                  ? "border-blue-500 bg-blue-500 text-white"
                                  : "border-white/20"
                              }`}
                            >
                              {alreadySaved ||
                              selected
                                ? "✓"
                                : ""}
                            </span>

                          </button>
                        );
                      }
                    )}

                  </div>


                  {/* SELECT ALL */}

                  <div className="mt-6 flex flex-wrap gap-3">

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDSPs(
                          DSP_LIST
                        )}
                      className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs hover:bg-white/10"
                    >
                      Select All
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDSPs(
                          existingDSPs
                            .map(
                              (item) =>
                                item.dsp_name ||
                                item.dsp ||
                                item.platform
                            )
                            .filter(
                              Boolean
                            ) as string[]
                        )}
                      className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs hover:bg-white/10"
                    >
                      Clear New Selection
                    </button>

                  </div>


                  {/* MODAL FOOTER */}

                  <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">

                    <div className="text-sm text-zinc-400">

                      <span className="font-semibold text-white">
                        {selectedDSPs.length}
                      </span>{" "}
                      DSPs selected

                    </div>

                    <div className="flex gap-3">

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedRelease(
                            null
                          )
                        }
                        className="rounded-xl border border-white/10 px-5 py-3 text-sm hover:bg-white/5"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={
                          saveDSPSelection
                        }
                        disabled={
                          savingDSPs ||
                          selectedDSPs.length ===
                            0
                        }
                        className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {savingDSPs
                          ? "Saving..."
                          : "Save DSP Selection"}
                      </button>

                    </div>

                  </div>

                </>
              )}

            </div>

          </div>

        </div>
      )}

    </main>
  );
}


// ==========================================
// STATUS CLASS
// ==========================================

function statusClass(
  status?: string | null
) {
  const value =
    String(status || "").toLowerCase();

  if (
    value === "live" ||
    value === "approved" ||
    value === "delivered" ||
    value === "success"
  ) {
    return "bg-green-500/10 text-green-400 border-green-500/20";
  }

  if (
    value === "rejected" ||
    value === "reject" ||
    value === "takedown" ||
    value === "failed"
  ) {
    return "bg-red-500/10 text-red-400 border-red-500/20";
  }

  if (
    value === "pending" ||
    value === "under_review" ||
    value === "processing"
  ) {
    return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  }

  if (
    value === "draft"
  ) {
    return "bg-zinc-500/10 text-zinc-300 border-white/10";
  }

  return "bg-blue-500/10 text-blue-400 border-blue-500/20";
}


// ==========================================
// STAT
// ==========================================

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1224] p-5">

      <p className="text-sm text-zinc-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>

    </div>
  );
}