"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

/* ======================================================
   TYPES
====================================================== */

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

  toolost_release_id?:
    | string
    | number
    | null;

  toolost_status?: string | null;
  toolost_review_note?: string | null;

  uploaded_by_name?: string | null;
uploaded_by_email?: string | null;

/*
 * Admin API normalized fields
 */
user_name?: string | null;
user_email?: string | null;

user?: {
  id?: string | null;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
} | null;

white_label_name?: string | null;

white_label?: {
  id?: string | null;
  name?: string | null;
  brand_name?: string | null;
  status?: string | null;
} | null;

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

  [key: string]: any;
};

type AdminProfile = {
  id: string;

  role?: string | null;
  status?: string | null;

  white_label_id?: string | null;

  full_name?: string | null;
  email?: string | null;
};

/* ======================================================
   DSP LIST
====================================================== */

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

/* ======================================================
   STATUS FILTERS
====================================================== */

const STATUS_LIST = [
  "all",
  "draft",
  "pending",
  "in_review",
  "under_review",
  "needs_docs",
  "approved",
  "rejected",
  "delivered",
  "live",
  "takedown_pending",
  "takedown",
  "takedown_complete",
];

/* ======================================================
   PAGE
====================================================== */

export default function AdminReleasesPage() {
  const router = useRouter();

  const [releases, setReleases] =
    useState<Release[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    adminProfile,
    setAdminProfile,
  ] =
    useState<AdminProfile | null>(
      null
    );

  const [search, setSearch] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState("all");

  /* ====================================================
     DSP MODAL
  ==================================================== */

  const [
    selectedRelease,
    setSelectedRelease,
  ] =
    useState<Release | null>(
      null
    );

  const [
    selectedDSPs,
    setSelectedDSPs,
  ] =
    useState<string[]>([]);

  const [
    existingDSPs,
    setExistingDSPs,
  ] =
    useState<DSPDelivery[]>(
      []
    );

  const [
    loadingDSPs,
    setLoadingDSPs,
  ] =
    useState(false);

  const [
    savingDSPs,
    setSavingDSPs,
  ] =
    useState(false);

  const [
    actionLoading,
    setActionLoading,
  ] =
    useState<string | null>(
      null
    );

  /* ====================================================
     LOAD ON START
  ==================================================== */

  useEffect(() => {
    checkAdmin();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ====================================================
     ADMIN CHECK
  ==================================================== */

  async function checkAdmin() {
    try {
      setLoading(true);
      setError("");

      const {
        data: userData,
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !userData.user
      ) {
        router.replace(
          "/admin-login"
        );

        return;
      }

      const userId =
        userData.user.id;

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

      if (profileError) {
        throw new Error(
          `Profile query failed: ${profileError.message}`
        );
      }

      if (!profile) {
        throw new Error(
          "Admin profile was not found."
        );
      }

      const role =
        String(
          profile.role || ""
        )
          .trim()
          .toLowerCase();

      const status =
        String(
          profile.status || ""
        )
          .trim()
          .toLowerCase();

      const allowedRoles = [
        "master_admin",
        "white_label_admin",
        "admin",
      ];

      if (
        !allowedRoles.includes(
          role
        )
      ) {
        await supabase.auth.signOut();

        router.replace(
          "/admin-login"
        );

        return;
      }

      if (
        status &&
        status !== "active"
      ) {
        throw new Error(
          `Admin account is "${profile.status}".`
        );
      }

      const normalizedProfile: AdminProfile =
        {
          ...profile,
          role,
          status,
        };

      setAdminProfile(
        normalizedProfile
      );

      await loadReleases(
        normalizedProfile
      );
    } catch (err) {
      console.error(
        "ADMIN CHECK:",
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

  /* ====================================================
     LOAD RELEASES

     IMPORTANT:
     Uses our Admin API first.
     That API synchronizes Too Lost statuses.
  ==================================================== */

  const loadReleases =
    useCallback(
      async (
        profileParam?: AdminProfile | null
      ) => {
        const profile =
          profileParam ||
          adminProfile;

        setLoading(true);
        setError("");

        try {
          const response =
            await fetch(
              `/api/admin/releases?t=${Date.now()}`,
              {
                method: "GET",
                cache: "no-store",
              }
            );

          const json =
            await response.json();

          if (
            !response.ok ||
            json?.success === false
          ) {
            throw new Error(
              json?.error ||
                "Unable to load releases."
            );
          }

          /*
           * Support common response wrappers.
           */
          let releaseData: Release[] =
            [];

          if (
            Array.isArray(
              json?.releases
            )
          ) {
            releaseData =
              json.releases;
          } else if (
            Array.isArray(
              json?.data
            )
          ) {
            releaseData =
              json.data;
          } else if (
            Array.isArray(json)
          ) {
            releaseData =
              json;
          }

          /*
           * White-label admins may only
           * see their own white-label releases.
           */
          if (
            String(
              profile?.role || ""
            ).toLowerCase() ===
            "white_label_admin"
          ) {
            const whiteLabelId =
              profile?.white_label_id;

            if (!whiteLabelId) {
              releaseData =
                [];
            } else {
              releaseData =
                releaseData.filter(
                  (release) =>
                    String(
                      release.white_label_id ||
                        ""
                    ) ===
                    String(
                      whiteLabelId
                    )
                );
            }
          }

          setReleases(
            releaseData
          );
        } catch (err) {
          console.error(
            "LOAD RELEASES:",
            err
          );

          setError(
            err instanceof Error
              ? err.message
              : "Failed to load releases."
          );
        } finally {
          setLoading(false);
        }
      },
      [adminProfile]
    );

  /* ====================================================
     FETCH SELECTED DSP RECORDS FOR A RELEASE
  ==================================================== */

  async function fetchReleaseDSPs(
    release: Release
  ): Promise<
    DSPDelivery[]
  > {
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
            action:
              "get_dsps",
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
          "Unable to load DSP selection."
      );
    }

    return Array.isArray(
      data.selected
    )
      ? data.selected
      : [];
  }

  /* ====================================================
     OPEN DSP SELECTOR
  ==================================================== */

  async function openDSPSelector(
    release: Release
  ) {
    setSelectedRelease(
      release
    );

    setSelectedDSPs([]);
    setExistingDSPs([]);

    setLoadingDSPs(true);

    try {
      const selected =
        await fetchReleaseDSPs(
          release
        );

      setExistingDSPs(
        selected
      );

      setSelectedDSPs(
        selected
          .map(
            (
              item: DSPDelivery
            ) =>
              item.dsp_name ||
              item.dsp ||
              item.platform ||
              ""
          )
          .filter(Boolean)
      );
    } catch (err) {
      console.error(err);

      alert(
        err instanceof Error
          ? err.message
          : "Unable to load DSPs."
      );
    } finally {
      setLoadingDSPs(
        false
      );
    }
  }

  /* ====================================================
     TOGGLE DSP
  ==================================================== */

  function toggleDSP(
    dsp: string
  ) {
    const alreadySaved =
      existingDSPs.some(
        (item) =>
          getDSPName(
            item
          ) === dsp
      );

    /*
     * Existing DSP records cannot
     * accidentally be removed here.
     */
    if (alreadySaved) {
      return;
    }

    setSelectedDSPs(
      (current) =>
        current.includes(dsp)
          ? current.filter(
              (item) =>
                item !== dsp
            )
          : [
              ...current,
              dsp,
            ]
    );
  }

  /* ====================================================
     SELECT ALL DSP
  ==================================================== */

  function selectAllDSPs() {
    setSelectedDSPs(
      Array.from(
        new Set([
          ...selectedDSPs,
          ...DSP_LIST,
          ...existingDSPs
            .map(
              getDSPName
            )
            .filter(
              Boolean
            ),
        ])
      )
    );
  }

  /* ====================================================
     CLEAR ONLY NEW DSP SELECTION
  ==================================================== */

  function clearNewDSPSelection() {
    const saved =
      existingDSPs
        .map(getDSPName)
        .filter(
          Boolean
        );

    setSelectedDSPs(
      saved
    );
  }

  /* ====================================================
     SAVE DSP SELECTION
  ==================================================== */

  async function saveDSPs() {
    if (!selectedRelease) {
      return;
    }

    if (
      selectedDSPs.length ===
      0
    ) {
      alert(
        "Please select at least one DSP."
      );

      return;
    }

    setSavingDSPs(true);

    try {
      const response =
        await fetch(
          `/api/admin/releases/${selectedRelease.id}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              action:
                "save_dsps",

              dsps:
                selectedDSPs,
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
            "Unable to save DSP selection."
        );
      }

      const deliveries =
        Array.isArray(
          data.deliveries
        )
          ? data.deliveries
          : [];

      setExistingDSPs(
        deliveries
      );

      setSelectedDSPs(
        deliveries.length
          ? deliveries
              .map(
                getDSPName
              )
              .filter(
                Boolean
              )
          : selectedDSPs
      );

      alert(
        "DSP selection saved successfully."
      );
    } catch (err) {
      console.error(err);

      alert(
        err instanceof Error
          ? err.message
          : "Unable to save DSPs."
      );
    } finally {
      setSavingDSPs(
        false
      );
    }
  }

  /* ====================================================
     RELEASE ACTION
  ==================================================== */

  async function updateReleaseStatus(
    release: Release,
    action: string
  ) {
    let note = "";

    if (
      action ===
      "reject"
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
      action ===
      "takedown"
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
      `${release.id}-${action}`;

    setActionLoading(
      actionKey
    );

    try {
      const response =
        await fetch(
          `/api/admin/releases/${release.id}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action,
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
      setActionLoading(
        null
      );
    }
  }

  /* ====================================================
     APPROVE + SUBMIT TO TOO LOST

     FIX:
     It fetches DSPs for THIS release.
     It no longer depends on whichever modal
     happened to be opened previously.
  ==================================================== */

  async function approveRelease(
    release: Release
  ) {
    try {
      const selectedDSPRecords =
        await fetchReleaseDSPs(
          release
        );

      if (
        selectedDSPRecords.length ===
        0
      ) {
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

      if (!confirmed) {
        return;
      }

      const actionKey =
        `${release.id}-approve`;

      setActionLoading(
        actionKey
      );

      const response =
        await fetch(
          `/api/admin/releases/${release.id}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "approve",
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
        data.message ||
          "Release approved and submitted to Too Lost successfully."
      );

      await loadReleases(
        adminProfile
      );
    } catch (err) {
      console.error(
        "APPROVE RELEASE:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Too Lost submission failed."
      );
    } finally {
      setActionLoading(
        null
      );
    }
  }

  /* ====================================================
     FILTERED RELEASES
  ==================================================== */

  const filteredReleases =
    useMemo(() => {
      const searchText =
        search
          .trim()
          .toLowerCase();

      return releases.filter(
        (release) => {
          const status =
            normalizeStatus(
              release.status
            );

          const matchesSearch =
            !searchText ||
            String(
              release.title ||
                ""
            )
              .toLowerCase()
              .includes(
                searchText
              ) ||
            String(
              release.artist_name ||
                ""
            )
              .toLowerCase()
              .includes(
                searchText
              ) ||
            String(
              release.label_name ||
                release.white_label_name ||
                ""
            )
              .toLowerCase()
              .includes(
                searchText
              ) ||
            String(
  release.user_name ||
    release.user?.name ||
    release.user?.full_name ||
    release.uploaded_by_name ||
    ""
)
              .toLowerCase()
              .includes(
                searchText
              ) ||
            String(
  release.user_email ||
    release.user?.email ||
    release.uploaded_by_email ||
    ""
)
              .toLowerCase()
              .includes(
                searchText
              ) ||
            String(
              release.toolost_release_id ||
                ""
            )
              .toLowerCase()
              .includes(
                searchText
              );

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
    }, [
      releases,
      search,
      statusFilter,
    ]);

  /* ====================================================
     COUNTS
  ==================================================== */

  const stats =
    useMemo(() => {
      let draft = 0;
      let pending = 0;
      let live = 0;
      let needsDocs = 0;

      for (
        const release of releases
      ) {
        const status =
          normalizeStatus(
            release.status
          );

        if (
          status ===
          "draft"
        ) {
          draft += 1;
        }

        if (
          [
            "pending",
            "in_review",
            "under_review",
            "processing",
            "approved",
          ].includes(
            status
          )
        ) {
          pending += 1;
        }

        if (
          status ===
          "live"
        ) {
          live += 1;
        }

        if (
          status ===
          "needs_docs"
        ) {
          needsDocs += 1;
        }
      }

      return {
        total:
          releases.length,

        draft,

        pending,

        live,

        needsDocs,
      };
    }, [releases]);

  /* ====================================================
     UI
  ==================================================== */

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
              Manage releases,
              DSP distribution,
              Too Lost submissions
              and takedowns.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              loadReleases(
                adminProfile
              )
            }
            disabled={loading}
            className="rounded-xl bg-white px-5 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Syncing..."
              : "Refresh Releases"}
          </button>
        </div>

        {/* STATS */}

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat
            label="Total Releases"
            value={
              stats.total
            }
          />

          <Stat
            label="Draft"
            value={
              stats.draft
            }
          />

          <Stat
            label="Pending Review"
            value={
              stats.pending
            }
          />

          <Stat
            label="Needs Docs"
            value={
              stats.needsDocs
            }
          />

          <Stat
            label="Live"
            value={
              stats.live
            }
          />
        </div>

        {/* ERROR */}

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">
            {error}
          </div>
        )}

        {/* FILTER */}

        <div className="mt-8 rounded-2xl border border-white/10 bg-[#0d1224] p-5">
          <div className="flex flex-col gap-4 lg:flex-row">
            <input
              value={
                search
              }
              onChange={(
                e
              ) =>
                setSearch(
                  e.target
                    .value
                )
              }
              placeholder="Search title, artist, label, user or Too Lost ID..."
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-blue-500 lg:flex-1"
            />

            <select
              value={
                statusFilter
              }
              onChange={(
                e
              ) =>
                setStatusFilter(
                  e.target
                    .value
                )
              }
              className="rounded-xl border border-white/10 bg-[#080d19] px-4 py-3 text-sm outline-none"
            >
              {STATUS_LIST.map(
                (
                  status
                ) => (
                  <option
                    key={
                      status
                    }
                    value={
                      status
                    }
                  >
                    {status ===
                    "all"
                      ? "All Status"
                      : formatStatus(
                          status
                        )}
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
              Loading and
              synchronizing
              releases...
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
                    (
                      release
                    ) => {
                      const status =
                        normalizeStatus(
                          release.status
                        );

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

                            <div className="mt-1 max-w-[260px] break-all text-xs text-zinc-600">
                              ID:{" "}
                              {
                                release.id
                              }
                            </div>
                          </td>

                          {/* ARTIST */}

                          <td className="px-5 py-5 text-sm text-zinc-300">
                            {release.artist_name ||
                              "—"}
                          </td>

                          {/* LABEL / USER */}

                          <td className="px-5 py-5">
  {(() => {
    const submitterName =
      release.user_name ||
      release.user?.name ||
      release.user?.full_name ||
      release.uploaded_by_name ||
      "Unknown User";

    const submitterEmail =
      release.user_email ||
      release.user?.email ||
      release.uploaded_by_email ||
      "—";

    const accountName =
      release.white_label_name ||
      release.white_label?.name ||
      release.white_label?.brand_name ||
      "Nexorael Direct";

    const isWhiteLabel =
      Boolean(
        release.white_label_id
      );

    return (
      <div className="min-w-[220px]">
        {/* ACCOUNT / WHITE LABEL */}

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
              isWhiteLabel
                ? "border-purple-500/20 bg-purple-500/10 text-purple-300"
                : "border-blue-500/20 bg-blue-500/10 text-blue-300"
            }`}
          >
            {isWhiteLabel
              ? "WHITE LABEL"
              : "DIRECT ACCOUNT"}
          </span>
        </div>

        <div className="mt-2 text-sm font-semibold text-white">
          {accountName}
        </div>

        {/* WHO SUBMITTED */}

        <div className="mt-2 border-t border-white/5 pt-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-600">
            Submitted By
          </div>

          <div className="mt-1 text-xs font-medium text-zinc-300">
            {submitterName}
          </div>

          <div className="mt-0.5 text-[11px] text-zinc-600">
            {submitterEmail}
          </div>
        </div>

        {/* RELEASE LABEL */}

        {release.label_name && (
          <div className="mt-2 text-[11px] text-zinc-500">
            Release Label:{" "}
            <span className="text-zinc-400">
              {release.label_name}
            </span>
          </div>
        )}
      </div>
    );
  })()}
</td>

                          {/* TOO LOST ID */}

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
                              {formatStatus(
                                status
                              )}
                            </span>

                            {release.toolost_review_note && (
                              <div className="mt-2 max-w-[230px] text-xs text-orange-300">
                                {
                                  release.toolost_review_note
                                }
                              </div>
                            )}
                          </td>

                          {/* CREATED */}

                          <td className="px-5 py-5 text-sm text-zinc-500">
                            {formatDate(
                              release.created_at
                            )}
                          </td>

                          {/* ACTIONS */}

                          <td className="px-5 py-5">
                            <div className="flex flex-wrap gap-2">
                              {/* VIEW */}

                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    `/releases/${release.id}?from=admin`
                                  )
                                }
                                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium hover:bg-white/10"
                              >
                                View
                              </button>

                              {/* DSP */}

                              <button
                                type="button"
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

                              {[
                                "draft",
                                "pending",
                                "under_review",
                                "in_review",
                              ].includes(
                                status
                              ) && (
                                <button
                                  type="button"
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
                              )}

                              {/* REJECT */}

                              {![
                                "live",
                                "takedown",
                                "takedown_pending",
                                "takedown_complete",
                              ].includes(
                                status
                              ) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateReleaseStatus(
                                      release,
                                      "reject"
                                    )
                                  }
                                  disabled={
                                    actionLoading ===
                                    `${release.id}-reject`
                                  }
                                  className="rounded-lg bg-red-600/90 px-3 py-2 text-xs font-semibold hover:bg-red-500 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              )}

                              {/* DRAFT */}

                              {[
                                "pending",
                                "rejected",
                                "approved",
                              ].includes(
                                status
                              ) && (
                                <button
                                  type="button"
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
                              )}

                              {/* TAKEDOWN
                                  Only actual live releases
                                  should be taken down.
                              */}

                              {status ===
                                "live" && (
                                <button
                                  type="button"
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
                              )}

                              {status ===
                                "needs_docs" && (
                                <span className="rounded-lg border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs font-medium text-orange-300">
                                  Documents
                                  Required
                                </span>
                              )}
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

      {/* =================================================
          DSP MODAL
      ================================================= */}

      {selectedRelease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1224] shadow-2xl">
            {/* HEADER */}

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
                  type="button"
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

            {/* CONTENT */}

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
                              getDSPName(
                                item
                              ) ===
                              dsp
                          );

                        return (
                          <button
                            key={
                              dsp
                            }
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
                                {
                                  dsp
                                }
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

                  {/* QUICK ACTIONS */}

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={
                        selectAllDSPs
                      }
                      className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs hover:bg-white/10"
                    >
                      Select All
                    </button>

                    <button
                      type="button"
                      onClick={
                        clearNewDSPSelection
                      }
                      className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs hover:bg-white/10"
                    >
                      Clear New
                      Selection
                    </button>
                  </div>

                  {/* FOOTER */}

                  <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-zinc-400">
                      <span className="font-semibold text-white">
                        {
                          selectedDSPs.length
                        }
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
                          saveDSPs
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

/* ======================================================
   HELPERS
====================================================== */

function getDSPName(
  item: DSPDelivery
) {
  return String(
    item.dsp_name ||
      item.dsp ||
      item.platform ||
      ""
  ).trim();
}

function normalizeStatus(
  status?: string | null
) {
  return String(
    status || "draft"
  )
    .trim()
    .toLowerCase();
}

function formatStatus(
  value?: string | null
) {
  return String(
    value || "draft"
  )
    .replace(
      /_/g,
      " "
    )
    .toUpperCase();
}

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    "en-IN"
  );
}

/* ======================================================
   STATUS STYLE
====================================================== */

function statusClass(
  status?: string | null
) {
  const value =
    normalizeStatus(
      status
    );

  if (
    value === "live" ||
    value === "delivered"
  ) {
    return "bg-green-500/10 text-green-400 border-green-500/20";
  }

  if (
    value === "approved"
  ) {
    return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  }

  if (
    value === "needs_docs"
  ) {
    return "bg-orange-500/10 text-orange-300 border-orange-500/20";
  }

  if (
    value === "rejected" ||
    value === "reject" ||
    value === "failed"
  ) {
    return "bg-red-500/10 text-red-400 border-red-500/20";
  }

  if (
    value === "takedown" ||
    value ===
      "takedown_pending" ||
    value ===
      "takedown_complete"
  ) {
    return "bg-red-500/10 text-red-300 border-red-500/20";
  }

  if (
    value === "pending" ||
    value === "in_review" ||
    value ===
      "under_review" ||
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

/* ======================================================
   STAT
====================================================== */

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