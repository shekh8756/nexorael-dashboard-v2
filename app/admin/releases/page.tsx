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

  toolost_release_id?: string | number | null;

  toolost_status?: string | null;
  toolost_review_note?: string | null;

  uploaded_by_name?: string | null;
  uploaded_by_email?: string | null;

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
   BULK ELIGIBLE STATUSES
====================================================== */

const BULK_APPROVABLE_STATUSES = [
  "draft",
  "pending",
  "in_review",
  "under_review",
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

  const [releases, setReleases] = useState<Release[]>([]);

  const [loading, setLoading] = useState(true);

  const [apiSyncing, setApiSyncing] = useState(false);

  const [error, setError] = useState("");

  const [adminProfile, setAdminProfile] =
    useState<AdminProfile | null>(null);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  /* ====================================================
     SINGLE DSP MODAL
  ==================================================== */

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
  /* ====================================================
     REVIEW NOTES + DOCUMENT
  ==================================================== */

  const [reviewModalOpen, setReviewModalOpen] =
    useState(false);

  const [reviewReleaseIds, setReviewReleaseIds] =
    useState<string[]>([]);

  const [reviewReleaseTitles, setReviewReleaseTitles] =
    useState<string[]>([]);

  const [reviewNote, setReviewNote] =
    useState("");

  const [reviewFile, setReviewFile] =
    useState<File | null>(null);

  const [reviewExistingFileName, setReviewExistingFileName] =
    useState("");

  const [reviewExistingFileUrl, setReviewExistingFileUrl] =
    useState("");

  const [reviewSaving, setReviewSaving] =
    useState(false);

  const [reviewLoading, setReviewLoading] =
    useState(false);

  const [reviewSavedIds, setReviewSavedIds] =
    useState<string[]>([]);
  /* ====================================================
     BULK RELEASE ACTIONS
  ==================================================== */

  const [bulkSelectedIds, setBulkSelectedIds] =
    useState<string[]>([]);

  const [bulkModalOpen, setBulkModalOpen] =
    useState(false);

  const [bulkDSPs, setBulkDSPs] =
    useState<string[]>([]);

  const [bulkProcessing, setBulkProcessing] =
    useState(false);

  const [bulkProgress, setBulkProgress] = useState({
    done: 0,
    total: 0,
    success: 0,
    failed: 0,
  });

  const [bulkErrors, setBulkErrors] =
    useState<string[]>([]);

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
      } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        router.replace("/admin-login");
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

      const role = String(profile.role || "")
        .trim()
        .toLowerCase();

      const status = String(profile.status || "")
        .trim()
        .toLowerCase();

      const allowedRoles = [
        "master_admin",
        "white_label_admin",
        "admin",
      ];

      if (!allowedRoles.includes(role)) {
        await supabase.auth.signOut();
        router.replace("/admin-login");
        return;
      }

      if (status && status !== "active") {
        throw new Error(
          `Admin account is "${profile.status}".`
        );
      }

      const normalizedProfile: AdminProfile = {
        ...profile,
        role,
        status,
      };

      setAdminProfile(normalizedProfile);

      await loadReleases(normalizedProfile);
    } catch (err) {
      console.error("ADMIN CHECK:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to verify admin."
      );

      setLoading(false);
    }
  }

  /* ====================================================
     LOAD RELEASES - FAST SUPABASE REFRESH
  ==================================================== */

  const loadReleases = useCallback(
    async (
      profileParam?: AdminProfile | null
    ) => {
      const profile =
        profileParam || adminProfile;

      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/admin/releases?t=${Date.now()}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const json = await response.json();

        if (
          !response.ok ||
          json?.success === false
        ) {
          throw new Error(
            json?.error ||
              "Unable to load releases."
          );
        }

        let releaseData: Release[] = [];

        if (Array.isArray(json?.releases)) {
          releaseData = json.releases;
        } else if (Array.isArray(json?.data)) {
          releaseData = json.data;
        } else if (Array.isArray(json)) {
          releaseData = json;
        }

        /* WHITE LABEL ADMIN FILTER */

        if (
          String(
            profile?.role || ""
          ).toLowerCase() ===
          "white_label_admin"
        ) {
          const whiteLabelId =
            profile?.white_label_id;

          if (!whiteLabelId) {
            releaseData = [];
          } else {
            releaseData = releaseData.filter(
              (release) =>
                String(
                  release.white_label_id || ""
                ) === String(whiteLabelId)
            );
          }
        }

        setReleases(releaseData);

        const availableIds = new Set(
          releaseData.map(
            (release) => release.id
          )
        );

        setBulkSelectedIds((current) =>
          current.filter((id) =>
            availableIds.has(id)
          )
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
     TOO LOST API STATUS SYNC
  ==================================================== */

  async function syncTooLostAPI() {
    if (
      apiSyncing ||
      loading ||
      bulkProcessing
    ) {
      return;
    }

    const confirmed = confirm(
      "Sync latest release statuses from Too Lost API?"
    );

    if (!confirmed) {
      return;
    }

    setApiSyncing(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/releases?sync=1&t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const json = await response.json();

      if (
        !response.ok ||
        json?.success === false
      ) {
        throw new Error(
          json?.error ||
            "Too Lost API sync failed."
        );
      }

      let releaseData: Release[] = [];

      if (Array.isArray(json?.releases)) {
        releaseData = json.releases;
      } else if (Array.isArray(json?.data)) {
        releaseData = json.data;
      } else if (Array.isArray(json)) {
        releaseData = json;
      }

      /* WHITE LABEL ADMIN FILTER */

      if (
        String(
          adminProfile?.role || ""
        ).toLowerCase() ===
        "white_label_admin"
      ) {
        const whiteLabelId =
          adminProfile?.white_label_id;

        if (!whiteLabelId) {
          releaseData = [];
        } else {
          releaseData = releaseData.filter(
            (release) =>
              String(
                release.white_label_id || ""
              ) === String(whiteLabelId)
          );
        }
      }

      setReleases(releaseData);

      const availableIds = new Set(
        releaseData.map(
          (release) => release.id
        )
      );

      setBulkSelectedIds((current) =>
        current.filter((id) =>
          availableIds.has(id)
        )
      );

      alert(
        "API Sync completed successfully.\n\nLatest Too Lost release statuses have been updated."
      );
    } catch (err) {
      console.error(
        "TOO LOST API SYNC:",
        err
      );

      const message =
        err instanceof Error
          ? err.message
          : "Too Lost API sync failed.";

      setError(message);
      alert(message);
    } finally {
      setApiSyncing(false);
    }
  }

  /* ====================================================
     GENERIC RELEASE API ACTION
  ==================================================== */

  async function runReleaseAction(
    releaseId: string,
    payload: Record<string, any>
  ) {
    const response = await fetch(
      `/api/admin/releases/${releaseId}`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(payload),
      }
    );

    let data: any = null;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        `API returned invalid response (${response.status}).`
      );
    }

    if (
      !response.ok ||
      !data?.success
    ) {
      throw new Error(
        data?.error ||
          `Request failed (${response.status}).`
      );
    }

    return data;
  }

  /* ====================================================
     FETCH DSP RECORDS
  ==================================================== */

  async function fetchReleaseDSPs(
    release: Release
  ): Promise<DSPDelivery[]> {
    const response = await fetch(
      `/api/admin/releases/${release.id}`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          action: "get_dsps",
        }),
      }
    );

    const data = await response.json();

    if (
      !response.ok ||
      !data.success
    ) {
      throw new Error(
        data.error ||
          "Unable to load DSP selection."
      );
    }

    return Array.isArray(data.selected)
      ? data.selected
      : [];
  }

  /* ====================================================
     OPEN SINGLE DSP SELECTOR
  ==================================================== */

  async function openDSPSelector(
    release: Release
  ) {
    setSelectedRelease(release);
    setSelectedDSPs([]);
    setExistingDSPs([]);
    setLoadingDSPs(true);

    try {
      const selected =
        await fetchReleaseDSPs(
          release
        );

      setExistingDSPs(selected);

      setSelectedDSPs(
        selected
          .map((item: DSPDelivery) =>
            getDSPName(item)
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
      setLoadingDSPs(false);
    }
  }

  /* ====================================================
     SINGLE DSP TOGGLE
  ==================================================== */

  function toggleDSP(dsp: string) {
    const alreadySaved =
      existingDSPs.some(
        (item) =>
          getDSPName(item) === dsp
      );

    if (alreadySaved) {
      return;
    }

    setSelectedDSPs((current) =>
      current.includes(dsp)
        ? current.filter(
            (item) => item !== dsp
          )
        : [...current, dsp]
    );
  }

  function selectAllDSPs() {
    setSelectedDSPs(
      Array.from(
        new Set([
          ...selectedDSPs,
          ...DSP_LIST,
          ...existingDSPs
            .map(getDSPName)
            .filter(Boolean),
        ])
      )
    );
  }

  function clearNewDSPSelection() {
    setSelectedDSPs(
      existingDSPs
        .map(getDSPName)
        .filter(Boolean)
    );
  }

  /* ====================================================
     SAVE SINGLE DSP SELECTION
  ==================================================== */

  async function saveDSPs() {
    if (!selectedRelease) {
      return;
    }

    if (selectedDSPs.length === 0) {
      alert(
        "Please select at least one DSP."
      );

      return;
    }

    setSavingDSPs(true);

    try {
      const data =
        await runReleaseAction(
          selectedRelease.id,
          {
            action: "save_dsps",
            dsps: selectedDSPs,
          }
        );

      const deliveries =
        Array.isArray(
          data.deliveries
        )
          ? data.deliveries
          : [];

      setExistingDSPs(deliveries);

      setSelectedDSPs(
        deliveries.length
          ? deliveries
              .map(getDSPName)
              .filter(Boolean)
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
      setSavingDSPs(false);
    }
  }

  /* ====================================================
     RELEASE STATUS ACTION
  ==================================================== */

  async function updateReleaseStatus(
    release: Release,
    action: string
  ) {
    let note = "";

    if (action === "reject") {
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

    if (action === "takedown") {
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

    setActionLoading(actionKey);

    try {
      const data =
        await runReleaseAction(
          release.id,
          {
            action,
            note,
          }
        );

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
  /* ====================================================
     REVIEW NOTES + DOCUMENT FUNCTIONS
  ==================================================== */

  async function getAdminAccessToken() {
    const {
      data,
      error,
    } = await supabase.auth.getSession();

    if (
      error ||
      !data.session?.access_token
    ) {
      throw new Error(
        "Admin session expired. Please login again."
      );
    }

    return data.session.access_token;
  }

  async function openReviewModal(
    selected: Release[]
  ) {
    if (!selected.length) {
      alert(
        "Please select at least one release."
      );
      return;
    }

    const ids = selected.map(
      (release) => release.id
    );

    const titles = selected.map(
      (release) =>
        release.title ||
        "Untitled Release"
    );

    setReviewReleaseIds(ids);
    setReviewReleaseTitles(titles);

    setReviewNote("");
    setReviewFile(null);

    setReviewExistingFileName("");
    setReviewExistingFileUrl("");

    setReviewModalOpen(true);

    /*
     * Existing review is loaded only for
     * a single release.
     */
    if (selected.length !== 1) {
      return;
    }

    setReviewLoading(true);

    try {
      const accessToken =
        await getAdminAccessToken();

      const response = await fetch(
        `/api/admin/releases/review-info?releaseId=${encodeURIComponent(
          selected[0].id
        )}&t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        data?.success === false
      ) {
        throw new Error(
          data?.error ||
          "Unable to load review information."
        );
      }

      if (data?.review) {
        setReviewNote(
          String(
            data.review.review_note ||
            ""
          )
        );

        setReviewExistingFileName(
          String(
            data.review.file_name ||
            ""
          )
        );

        setReviewExistingFileUrl(
          String(
            data.review.file_url ||
            ""
          )
        );

        setReviewSavedIds(
          (current) =>
            Array.from(
              new Set([
                ...current,
                selected[0].id,
              ])
            )
        );
      }
    } catch (err) {
      console.error(
        "LOAD REVIEW:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Unable to load review information."
      );
    } finally {
      setReviewLoading(false);
    }
  }

  function closeReviewModal() {
    if (reviewSaving) {
      return;
    }

    setReviewModalOpen(false);

    setReviewReleaseIds([]);
    setReviewReleaseTitles([]);

    setReviewNote("");
    setReviewFile(null);

    setReviewExistingFileName("");
    setReviewExistingFileUrl("");
  }

  function handleReviewFile(
    file: File | null
  ) {
    if (!file) {
      setReviewFile(null);
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "text/plain",
    ];

    if (
      !allowedTypes.includes(
        file.type
      )
    ) {
      alert(
        "Only PDF, JPG, PNG and TXT files are allowed."
      );

      return;
    }

    const MAX_FILE_SIZE =
      20 * 1024 * 1024;

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      alert(
        "Maximum document size is 20 MB."
      );

      return;
    }

    if (
      file.name.length >
      255
    ) {
      alert(
        "File name is too long."
      );

      return;
    }

    setReviewFile(file);
  }

  function sanitizeReviewFileName(
    fileName: string
  ) {
    return fileName
      .replace(
        /[^a-zA-Z0-9._-]/g,
        "_"
      )
      .slice(0, 180);
  }

  function getFileTypeFromName(
    fileName: string
  ) {
    const name =
      fileName.toLowerCase();

    if (
      name.endsWith(".pdf")
    ) {
      return "application/pdf";
    }

    if (
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg")
    ) {
      return "image/jpeg";
    }

    if (
      name.endsWith(".png")
    ) {
      return "image/png";
    }

    if (
      name.endsWith(".txt")
    ) {
      return "text/plain";
    }

    return "";
  }

  async function saveReviewInformation() {
    if (
      reviewReleaseIds.length === 0
    ) {
      alert(
        "No release selected."
      );

      return;
    }

    const cleanNote =
      reviewNote.trim();

    if (
      cleanNote.length >
      4000
    ) {
      alert(
        "Review notes cannot exceed 4000 characters."
      );

      return;
    }

    if (
      !cleanNote &&
      !reviewFile &&
      !reviewExistingFileUrl
    ) {
      alert(
        "Please enter review notes or upload a supporting document."
      );

      return;
    }

    setReviewSaving(true);

    try {
      const accessToken =
        await getAdminAccessToken();

      let fileName =
        reviewExistingFileName;

      let fileType =
        reviewExistingFileName
          ? getFileTypeFromName(
              reviewExistingFileName
            )
          : "";

      let fileUrl =
        reviewExistingFileUrl;

      let storagePath = "";

      /*
       * UPLOAD NEW FILE
       */
      if (reviewFile) {
        const safeName =
          sanitizeReviewFileName(
            reviewFile.name
          );

        storagePath =
          `admin-review/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

        const {
          error: uploadError,
        } = await supabase.storage
          .from(
            "release-review-documents"
          )
          .upload(
            storagePath,
            reviewFile,
            {
              upsert: false,

              cacheControl:
                "3600",

              contentType:
                reviewFile.type,
            }
          );

        if (uploadError) {
          throw new Error(
            `Document upload failed: ${uploadError.message}`
          );
        }

        const {
          data: publicData,
        } = supabase.storage
          .from(
            "release-review-documents"
          )
          .getPublicUrl(
            storagePath
          );

        if (
          !publicData?.publicUrl
        ) {
          throw new Error(
            "Unable to generate document public URL."
          );
        }

        fileName =
          reviewFile.name.slice(
            0,
            255
          );

        fileType =
          reviewFile.type.slice(
            0,
            40
          );

        fileUrl =
          publicData.publicUrl;
      }

      /*
       * SAVE INTO ADMIN API
       */
      const response = await fetch(
        "/api/admin/releases/review-info",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${accessToken}`,
          },

          body: JSON.stringify({
            releaseIds:
              reviewReleaseIds,

            reviewNote:
              cleanNote,

            fileName:
              fileName || null,

            fileType:
              fileType || null,

            fileUrl:
              fileUrl || null,

            storagePath:
              storagePath || null,
          }),
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        data?.success === false
      ) {
        throw new Error(
          data?.error ||
          "Unable to save review information."
        );
      }

      setReviewSavedIds(
        (current) =>
          Array.from(
            new Set([
              ...current,
              ...reviewReleaseIds,
            ])
          )
      );

      alert(
        data?.message ||
        "Review information saved successfully."
      );

      closeReviewModal();
    } catch (err) {
      console.error(
        "SAVE REVIEW:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Unable to save review information."
      );
    } finally {
      setReviewSaving(false);
    }
  }
  /* ====================================================
     INDIVIDUAL APPROVE
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
        selectedDSPRecords.length === 0
      ) {
        alert(
          "Please select at least one DSP before approving this release."
        );

        await openDSPSelector(
          release
        );

        return;
      }

      const confirmed = confirm(
        `Approve "${
          release.title ||
          "Untitled"
        }" and submit it to Too Lost?`
      );

      if (!confirmed) {
        return;
      }

      const actionKey =
        `${release.id}-approve`;

      setActionLoading(actionKey);

      const data =
        await runReleaseAction(
          release.id,
          {
            action: "approve",
          }
        );

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
      setActionLoading(null);
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

          const searchable = [
            release.title,
            release.artist_name,
            release.label_name,
            release.white_label_name,
            release.user_name,
            release.user?.name,
            release.user?.full_name,
            release.uploaded_by_name,
            release.user_email,
            release.user?.email,
            release.uploaded_by_email,
            release.toolost_release_id,
          ];

          const matchesSearch =
            !searchText ||
            searchable.some(
              (value) =>
                String(value || "")
                  .toLowerCase()
                  .includes(
                    searchText
                  )
            );

          const matchesStatus =
            statusFilter === "all" ||
            status === statusFilter;

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
     BULK SELECT
  ==================================================== */

  const bulkSelectableReleases =
    useMemo(
      () =>
        filteredReleases.filter(
          (release) =>
            BULK_APPROVABLE_STATUSES.includes(
              normalizeStatus(
                release.status
              )
            )
        ),
      [filteredReleases]
    );

  const selectedBulkReleases =
    useMemo(
      () =>
        releases.filter(
          (release) =>
            bulkSelectedIds.includes(
              release.id
            ) &&
            BULK_APPROVABLE_STATUSES.includes(
              normalizeStatus(
                release.status
              )
            )
        ),
      [
        releases,
        bulkSelectedIds,
      ]
    );

  const allVisibleSelected =
    bulkSelectableReleases.length >
      0 &&
    bulkSelectableReleases.every(
      (release) =>
        bulkSelectedIds.includes(
          release.id
        )
    );

  function toggleBulkRelease(
    releaseId: string
  ) {
    setBulkSelectedIds(
      (current) =>
        current.includes(
          releaseId
        )
          ? current.filter(
              (id) =>
                id !== releaseId
            )
          : [
              ...current,
              releaseId,
            ]
    );
  }

  function toggleAllVisible() {
    const visibleIds =
      bulkSelectableReleases.map(
        (release) =>
          release.id
      );

    if (visibleIds.length === 0) {
      return;
    }

    const everythingSelected =
      visibleIds.every((id) =>
        bulkSelectedIds.includes(id)
      );

    if (everythingSelected) {
      setBulkSelectedIds(
        (current) =>
          current.filter(
            (id) =>
              !visibleIds.includes(id)
          )
      );

      return;
    }

    setBulkSelectedIds(
      (current) =>
        Array.from(
          new Set([
            ...current,
            ...visibleIds,
          ])
        )
    );
  }

  function clearBulkSelection() {
    if (bulkProcessing) {
      return;
    }

    setBulkSelectedIds([]);
  }

  function openBulkModal() {
    if (
      selectedBulkReleases.length === 0
    ) {
      alert(
        "Please select at least one Draft/Pending release."
      );

      return;
    }

    setBulkDSPs([]);
    setBulkErrors([]);

    setBulkProgress({
      done: 0,
      total:
        selectedBulkReleases.length,
      success: 0,
      failed: 0,
    });

    setBulkModalOpen(true);
  }

  function toggleBulkDSP(
    dsp: string
  ) {
    if (bulkProcessing) {
      return;
    }

    setBulkDSPs(
      (current) =>
        current.includes(dsp)
          ? current.filter(
              (item) =>
                item !== dsp
            )
          : [...current, dsp]
    );
  }

  function selectAllBulkDSPs() {
    if (bulkProcessing) {
      return;
    }

    setBulkDSPs([
      ...DSP_LIST,
    ]);
  }

  function clearBulkDSPs() {
    if (bulkProcessing) {
      return;
    }

    setBulkDSPs([]);
  }

  /* ====================================================
     BULK DSP + APPROVE + SUBMIT
  ==================================================== */

  async function bulkApproveAndSubmit() {
    if (bulkProcessing) {
      return;
    }

    const queue = [
      ...selectedBulkReleases,
    ];

    if (queue.length === 0) {
      alert(
        "No eligible releases selected."
      );

      return;
    }

    if (bulkDSPs.length === 0) {
      alert(
        "Please select at least one DSP."
      );

      return;
    }

    const confirmed = confirm(
      `Apply ${bulkDSPs.length} DSP(s) and Approve + Submit ${queue.length} release(s) to Too Lost?\n\nThe releases will be processed in small batches.`
    );

    if (!confirmed) {
      return;
    }

    setBulkProcessing(true);
    setBulkErrors([]);

    setBulkProgress({
      done: 0,
      total: queue.length,
      success: 0,
      failed: 0,
    });

    const failedIds: string[] = [];
    const errors: string[] = [];

    let successCount = 0;
    let failedCount = 0;

    const BATCH_SIZE = 3;

    try {
      for (
        let start = 0;
        start < queue.length;
        start += BATCH_SIZE
      ) {
        const batch =
          queue.slice(
            start,
            start + BATCH_SIZE
          );

        await Promise.all(
          batch.map(
            async (release) => {
              try {
                /* STEP 1: DSP */

                await runReleaseAction(
                  release.id,
                  {
                    action:
                      "save_dsps",
                    dsps:
                      bulkDSPs,
                  }
                );

                /* STEP 2: APPROVE */

                await runReleaseAction(
                  release.id,
                  {
                    action:
                      "approve",
                  }
                );

                successCount += 1;

                setBulkProgress(
                  (current) => ({
                    ...current,
                    done:
                      current.done + 1,
                    success:
                      current.success +
                      1,
                  })
                );
              } catch (err) {
                failedCount += 1;

                failedIds.push(
                  release.id
                );

                const message =
                  err instanceof Error
                    ? err.message
                    : "Unknown error";

                errors.push(
                  `${
                    release.title ||
                    "Untitled"
                  }: ${message}`
                );

                setBulkProgress(
                  (current) => ({
                    ...current,
                    done:
                      current.done + 1,
                    failed:
                      current.failed +
                      1,
                  })
                );
              }
            }
          )
        );
      }

      setBulkErrors(errors);

      setBulkSelectedIds(
        failedIds
      );

      await loadReleases(
        adminProfile
      );

      if (failedCount === 0) {
        alert(
          `${successCount} release(s) processed successfully.\n\nDSP selection saved and releases submitted to Too Lost.`
        );

        setBulkModalOpen(false);
        setBulkDSPs([]);
      } else {
        alert(
          `Bulk process completed.\n\nSuccessful: ${successCount}\nFailed: ${failedCount}\n\nFailed releases remain selected for retry.`
        );
      }
    } finally {
      setBulkProcessing(false);
    }
  }

  /* ====================================================
     COUNTS
  ==================================================== */

  const stats = useMemo(() => {
    let draft = 0;
    let pending = 0;
    let live = 0;
    let needsDocs = 0;

    for (const release of releases) {
      const status =
        normalizeStatus(
          release.status
        );

      if (status === "draft") {
        draft += 1;
      }

      if (
        [
          "pending",
          "in_review",
          "under_review",
          "processing",
          "approved",
        ].includes(status)
      ) {
        pending += 1;
      }

      if (status === "live") {
        live += 1;
      }

      if (
        status === "needs_docs"
      ) {
        needsDocs += 1;
      }
    }

    return {
      total: releases.length,
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
              Manage releases, DSP distribution,
              Too Lost submissions and takedowns.
            </p>
          </div>

          {/* REFRESH + API SYNC */}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                loadReleases(
                  adminProfile
                )
              }
              disabled={
                loading ||
                apiSyncing ||
                bulkProcessing
              }
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Refreshing..."
                : "Refresh Releases"}
            </button>

            <button
              type="button"
              onClick={
                syncTooLostAPI
              }
              disabled={
                apiSyncing ||
                loading ||
                bulkProcessing
              }
              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {apiSyncing
                ? "API Syncing..."
                : "API Sync"}
            </button>
          </div>
        </div>

        {/* STATS */}

        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat
            label="Total Releases"
            value={stats.total}
          />

          <Stat
            label="Draft"
            value={stats.draft}
          />

          <Stat
            label="Pending Review"
            value={stats.pending}
          />

          <Stat
            label="Needs Docs"
            value={stats.needsDocs}
          />

          <Stat
            label="Live"
            value={stats.live}
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
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search title, artist, label, user or Too Lost ID..."
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-blue-500 lg:flex-1"
            />

            <select
              value={
                statusFilter
              }
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="rounded-xl border border-white/10 bg-[#080d19] px-4 py-3 text-sm outline-none"
            >
              {STATUS_LIST.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status === "all"
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

        {/* BULK ACTION BAR */}

        {bulkSelectedIds.length > 0 && (
          <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-blue-500/20 bg-blue-500/[0.07] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="font-semibold text-white">
                {selectedBulkReleases.length}{" "}
                release(s) selected
              </div>
              <button
                type="button"
                onClick={() =>
                  openReviewModal(
                    selectedBulkReleases
                  )
                }
                disabled={
                  bulkProcessing ||
                  reviewSaving ||
                  selectedBulkReleases.length ===
                    0
                }
                className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-5 py-2 text-sm font-semibold text-purple-200 hover:bg-purple-500/20 disabled:opacity-40"
              >
                Review Notes & PDF
              </button>
              <div className="mt-1 text-xs text-zinc-500">
                Bulk DSP selection + Approve &
                Submit
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={
                  clearBulkSelection
                }
                disabled={
                  bulkProcessing
                }
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-40"
              >
                Clear Selection
              </button>

              <button
                type="button"
                onClick={
                  openBulkModal
                }
                disabled={
                  bulkProcessing ||
                  selectedBulkReleases.length ===
                    0
                }
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
              >
                DSP + Approve & Submit
              </button>
            </div>
          </div>
        )}

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
              <table className="w-full min-w-[1500px]">
                <thead className="border-b border-white/10 bg-black/20">
                  <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                    <th className="w-12 px-5 py-4">
                      <input
                        type="checkbox"
                        checked={
                          allVisibleSelected
                        }
                        onChange={
                          toggleAllVisible
                        }
                        disabled={
                          bulkSelectableReleases.length ===
                            0 ||
                          bulkProcessing
                        }
                        className="h-4 w-4 cursor-pointer accent-blue-600"
                        title="Select all eligible visible releases"
                      />
                    </th>

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
                        normalizeStatus(
                          release.status
                        );

                      const approveLoading =
                        actionLoading ===
                        `${release.id}-approve`;

                      const canBulkApprove =
                        BULK_APPROVABLE_STATUSES.includes(
                          status
                        );

                      return (
                        <tr
                          key={
                            release.id
                          }
                          className="border-b border-white/5 hover:bg-white/[0.025]"
                        >
                          <td className="w-12 px-5 py-5">
                            <input
                              type="checkbox"
                              checked={bulkSelectedIds.includes(
                                release.id
                              )}
                              disabled={
                                !canBulkApprove ||
                                bulkProcessing
                              }
                              onChange={() =>
                                toggleBulkRelease(
                                  release.id
                                )
                              }
                              className={`h-4 w-4 accent-blue-600 ${
                                canBulkApprove
                                  ? "cursor-pointer"
                                  : "cursor-not-allowed opacity-30"
                              }`}
                              title={
                                canBulkApprove
                                  ? "Select release"
                                  : "Only Draft/Pending releases can be bulk approved"
                              }
                            />
                          </td>

                          <td className="px-5 py-5">
                            <div className="font-semibold">
                              {release.title ||
                                "Untitled Release"}
                            </div>

                            <div className="mt-1 max-w-[260px] break-all text-xs text-zinc-600">
                              ID: {release.id}
                            </div>
                          </td>

                          <td className="px-5 py-5 text-sm text-zinc-300">
                            {release.artist_name ||
                              "—"}
                          </td>

                          <td className="px-5 py-5">
                            <SubmitterCell
                              release={
                                release
                              }
                            />
                          </td>

                          <td className="px-5 py-5 font-mono text-xs text-zinc-400">
                            {release.toolost_release_id ||
                              "Not connected"}
                          </td>

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

                          <td className="px-5 py-5 text-sm text-zinc-500">
                            {formatDate(
                              release.created_at
                            )}
                          </td>

                          <td className="px-5 py-5">
                            <div className="flex flex-wrap gap-2">
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

                              <button
                                type="button"
                                onClick={() =>
                                  openDSPSelector(
                                    release
                                  )
                                }
                                disabled={
                                  bulkProcessing
                                }
                                className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-40"
                              >
                                DSP Select
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  openReviewModal([
                                    release,
                                  ])
                                }
                                disabled={
                                  bulkProcessing ||
                                  reviewSaving
                                }
                                className="rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-2 text-xs font-medium text-purple-300 hover:bg-purple-500/20 disabled:opacity-40"
                              >
                                {reviewSavedIds.includes(
                                  release.id
                                )
                                  ? "Review ✓"
                                  : "Review Notes & PDF"}
                              </button>
                              {BULK_APPROVABLE_STATUSES.includes(
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
                                    approveLoading ||
                                    bulkProcessing
                                  }
                                  className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold hover:bg-green-500 disabled:opacity-50"
                                >
                                  {approveLoading
                                    ? "Submitting..."
                                    : "Approve & Submit"}
                                </button>
                              )}

                              {![
                                "live",
                                "takedown",
                                "takedown_pending",
                                "takedown_complete",
                              ].includes(status) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateReleaseStatus(
                                      release,
                                      "reject"
                                    )
                                  }
                                  disabled={
                                    bulkProcessing ||
                                    actionLoading ===
                                      `${release.id}-reject`
                                  }
                                  className="rounded-lg bg-red-600/90 px-3 py-2 text-xs font-semibold hover:bg-red-500 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              )}

                              {[
                                "pending",
                                "rejected",
                                "approved",
                              ].includes(status) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateReleaseStatus(
                                      release,
                                      "draft"
                                    )
                                  }
                                  disabled={
                                    bulkProcessing ||
                                    actionLoading ===
                                      `${release.id}-draft`
                                  }
                                  className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs font-medium text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-50"
                                >
                                  Draft
                                </button>
                              )}

                              {status === "live" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateReleaseStatus(
                                      release,
                                      "takedown"
                                    )
                                  }
                                  disabled={
                                    bulkProcessing ||
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
                                  Documents Required
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
          REVIEW NOTES + PDF MODAL
      ================================================= */}

      {reviewModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-purple-500/20 bg-[#0d1224] shadow-2xl">

            {/* HEADER */}

            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0d1224] p-6">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                    Too Lost Review Information
                  </div>

                  <h2 className="mt-2 text-2xl font-bold">
                    Review Notes & PDF
                  </h2>

                  <p className="mt-2 text-sm text-zinc-500">
                    {reviewReleaseIds.length}{" "}
                    release(s) selected
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeReviewModal
                  }
                  disabled={
                    reviewSaving
                  }
                  className="rounded-lg border border-white/10 px-3 py-2 text-zinc-400 hover:bg-white/5 disabled:opacity-40"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* BODY */}

            <div className="p-6">
              {reviewLoading ? (
                <div className="py-14 text-center text-zinc-500">
                  Loading saved review information...
                </div>
              ) : (
                <>
                  {/* RELEASE LIST */}

                  <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Selected Releases
                    </div>

                    <div className="mt-3 max-h-32 overflow-y-auto">
                      {reviewReleaseTitles.map(
                        (
                          title,
                          index
                        ) => (
                          <div
                            key={`${index}-${title}`}
                            className="mb-1 text-sm text-zinc-300"
                          >
                            {index + 1}.{" "}
                            {title}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* NOTES */}

                  <div className="mt-6">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold">
                        Review Notes
                      </label>

                      <span className="text-xs text-zinc-500">
                        {reviewNote.length}
                        /4000
                      </span>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-zinc-500">
                      Add AI approvals, licenses,
                      rights information, sample
                      clearances, label waivers or
                      anything else Too Lost should
                      know.
                    </p>

                    <textarea
                      value={
                        reviewNote
                      }
                      onChange={(
                        event
                      ) =>
                        setReviewNote(
                          event.target.value.slice(
                            0,
                            4000
                          )
                        )
                      }
                      maxLength={4000}
                      rows={8}
                      placeholder="Anything else Too Lost should know?"
                      className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-purple-500"
                    />
                  </div>

                  {/* DOCUMENT */}

                  <div className="mt-6">
                    <label className="text-sm font-semibold">
                      Supporting Document
                    </label>

                    <p className="mt-2 text-xs text-zinc-500">
                      PDF, JPG, PNG or TXT · Maximum
                      20 MB
                    </p>

                    <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/20 p-7 text-center hover:border-purple-500/50 hover:bg-purple-500/[0.04]">
                      <div className="text-3xl">
                        📎
                      </div>

                      <div className="mt-3 text-sm font-semibold">
                        Choose Supporting Document
                      </div>

                      <div className="mt-1 text-xs text-zinc-600">
                        Click to select PDF / Image /
                        Text
                      </div>

                      <input
                        type="file"
                        accept=".pdf,.txt,.jpg,.jpeg,.png,application/pdf,text/plain,image/jpeg,image/png"
                        disabled={
                          reviewSaving
                        }
                        onChange={(
                          event
                        ) =>
                          handleReviewFile(
                            event.target
                              .files?.[0] ||
                              null
                          )
                        }
                        className="hidden"
                      />
                    </label>

                    {/* NEW FILE */}

                    {reviewFile && (
                      <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-green-500/20 bg-green-500/[0.06] p-4">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-green-300">
                            {
                              reviewFile.name
                            }
                          </div>

                          <div className="mt-1 text-xs text-zinc-500">
                            {formatFileSize(
                              reviewFile.size
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={
                            reviewSaving
                          }
                          onClick={() =>
                            setReviewFile(
                              null
                            )
                          }
                          className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5"
                        >
                          Remove
                        </button>
                      </div>
                    )}

                    {/* EXISTING FILE */}

                    {!reviewFile &&
                      reviewExistingFileName && (
                        <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-4">
                          <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                            Saved Document
                          </div>

                          <div className="mt-2 break-all text-sm font-semibold">
                            {
                              reviewExistingFileName
                            }
                          </div>

                          {reviewExistingFileUrl && (
                            <a
                              href={
                                reviewExistingFileUrl
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-block text-xs font-semibold text-blue-400 hover:text-blue-300"
                            >
                              Open Document ↗
                            </a>
                          )}

                          <div className="mt-3 text-xs text-zinc-600">
                            Upload a new document above
                            if you want to replace this
                            file.
                          </div>
                        </div>
                      )}
                  </div>

                  {/* BULK INFO */}

                  {reviewReleaseIds.length >
                    1 && (
                    <div className="mt-6 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.07] p-4 text-sm leading-6 text-yellow-200">
                      The same review notes and
                      supporting document will be saved
                      to all{" "}
                      <strong>
                        {
                          reviewReleaseIds.length
                        }
                      </strong>{" "}
                      selected releases.
                    </div>
                  )}

                  {/* FOOTER */}

                  <div className="mt-7 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-zinc-500">
                      Document will be stored securely
                      in the release review storage.
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={
                          closeReviewModal
                        }
                        disabled={
                          reviewSaving
                        }
                        className="rounded-xl border border-white/10 px-5 py-3 text-sm hover:bg-white/5 disabled:opacity-40"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={
                          saveReviewInformation
                        }
                        disabled={
                          reviewSaving ||
                          (!reviewNote.trim() &&
                            !reviewFile &&
                            !reviewExistingFileUrl)
                        }
                        className="rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {reviewSaving
                          ? "Uploading & Saving..."
                          : reviewReleaseIds.length >
                            1
                          ? `Save to ${reviewReleaseIds.length} Releases`
                          : "Save Review Info"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* =================================================
          SINGLE DSP MODAL
      ================================================= */}

      {selectedRelease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1224] shadow-2xl">
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
                      Clear New Selection
                    </button>
                  </div>

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
                        onClick={saveDSPs}
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

      {/* =================================================
          BULK DSP + APPROVE MODAL
      ================================================= */}

      {bulkModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-blue-500/20 bg-[#0d1224] shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0d1224] p-6">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                    Bulk Processing
                  </div>

                  <h2 className="mt-2 text-2xl font-bold">
                    DSP + Approve & Submit
                  </h2>

                  <p className="mt-2 text-sm text-zinc-500">
                    {selectedBulkReleases.length}{" "}
                    release(s) selected
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    bulkProcessing
                  }
                  onClick={() =>
                    setBulkModalOpen(
                      false
                    )
                  }
                  className="rounded-lg border border-white/10 px-3 py-2 text-zinc-400 hover:bg-white/5 disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.07] p-4 text-sm text-yellow-200">
                Selected DSPs will be applied to
                every selected release before
                approval and Too Lost submission.
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {DSP_LIST.map(
                  (dsp) => {
                    const selected =
                      bulkDSPs.includes(
                        dsp
                      );

                    return (
                      <button
                        key={dsp}
                        type="button"
                        disabled={
                          bulkProcessing
                        }
                        onClick={() =>
                          toggleBulkDSP(
                            dsp
                          )
                        }
                        className={`flex items-center justify-between rounded-xl border p-4 text-left transition ${
                          selected
                            ? "border-blue-500 bg-blue-500/10"
                            : "border-white/10 bg-black/20 hover:border-white/20"
                        } disabled:opacity-50`}
                      >
                        <div>
                          <div className="font-medium">
                            {dsp}
                          </div>

                          <div className="mt-1 text-xs text-zinc-600">
                            {selected
                              ? "Selected"
                              : "Available"}
                          </div>
                        </div>

                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                            selected
                              ? "border-blue-500 bg-blue-500"
                              : "border-white/20"
                          }`}
                        >
                          {selected
                            ? "✓"
                            : ""}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={
                    selectAllBulkDSPs
                  }
                  disabled={
                    bulkProcessing
                  }
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs hover:bg-white/10 disabled:opacity-40"
                >
                  Select All DSPs
                </button>

                <button
                  type="button"
                  onClick={
                    clearBulkDSPs
                  }
                  disabled={
                    bulkProcessing
                  }
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs hover:bg-white/10 disabled:opacity-40"
                >
                  Clear DSPs
                </button>
              </div>

              {bulkProcessing && (
                <div className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      Processing releases...
                    </span>

                    <strong>
                      {bulkProgress.done}/
                      {bulkProgress.total}
                    </strong>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{
                        width: `${
                          bulkProgress.total
                            ? Math.round(
                                (bulkProgress.done /
                                  bulkProgress.total) *
                                  100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  <div className="mt-4 flex gap-5 text-xs">
                    <span className="text-green-400">
                      Success:{" "}
                      {bulkProgress.success}
                    </span>

                    <span className="text-red-400">
                      Failed:{" "}
                      {bulkProgress.failed}
                    </span>
                  </div>
                </div>
              )}

              {bulkErrors.length > 0 && (
                <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4">
                  <div className="font-semibold text-red-300">
                    Failed Releases
                  </div>

                  <div className="mt-3 max-h-40 overflow-y-auto text-xs text-red-300/80">
                    {bulkErrors.map(
                      (item, index) => (
                        <div
                          key={index}
                          className="mb-2"
                        >
                          {item}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              <div className="mt-7 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-zinc-400">
                  <strong className="text-white">
                    {selectedBulkReleases.length}
                  </strong>{" "}
                  releases ·{" "}
                  <strong className="text-white">
                    {bulkDSPs.length}
                  </strong>{" "}
                  DSPs
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={
                      bulkProcessing
                    }
                    onClick={() =>
                      setBulkModalOpen(
                        false
                      )
                    }
                    className="rounded-xl border border-white/10 px-5 py-3 text-sm hover:bg-white/5 disabled:opacity-40"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={
                      bulkProcessing ||
                      bulkDSPs.length ===
                        0 ||
                      selectedBulkReleases.length ===
                        0
                    }
                    onClick={
                      bulkApproveAndSubmit
                    }
                    className="rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {bulkProcessing
                      ? `Processing ${bulkProgress.done}/${bulkProgress.total}...`
                      : "Apply DSPs + Approve & Submit"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ======================================================
   LABEL / USER CELL
====================================================== */

function SubmitterCell({
  release,
}: {
  release: Release;
}) {
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

  const isWhiteLabel = Boolean(
    release.white_label_id
  );

  return (
    <div className="min-w-[220px]">
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
    .replace(/_/g, " ")
    .toUpperCase();
}

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "—";
  }
function formatFileSize(
  bytes: number
) {
  if (
    !Number.isFinite(bytes)
  ) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}
  const date = new Date(value);

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
function formatFileSize(
  bytes: number
) {
  if (!Number.isFinite(bytes)) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}
/* ======================================================
   STATUS STYLE
====================================================== */

function statusClass(
  status?: string | null
) {
  const value =
    normalizeStatus(status);

  if (
    value === "live" ||
    value === "delivered"
  ) {
    return "bg-green-500/10 text-green-400 border-green-500/20";
  }

  if (value === "approved") {
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
    value === "takedown_pending" ||
    value === "takedown_complete"
  ) {
    return "bg-red-500/10 text-red-300 border-red-500/20";
  }

  if (
    value === "pending" ||
    value === "in_review" ||
    value === "under_review" ||
    value === "processing"
  ) {
    return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  }

  if (value === "draft") {
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