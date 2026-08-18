"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Release = {
  id: string;
  title?: string | null;
  artist_name?: string | null;
  label_name?: string | null;
  status?: string | null;
  type?: string | null;
  release_type?: string | null;
  toolost_release_id?: string | number | null;
  upc?: string | null;
  artwork_url?: string | null;
  cover_url?: string | null;
  created_at?: string | null;
  user_id?: string | null;
  admin_note?: string | null;
  white_label_id?: string | null;

  uploaded_by_name?: string | null;
  uploaded_by_email?: string | null;
  white_label_name?: string | null;
};

type Action =
  | "approve"
  | "reject"
  | "draft"
  | "takedown"
  | "submit";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending Review",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  live: "Live",
  takedown: "Takedown",
  delivered: "Delivered",
};

export default function AdminReleasesPage() {
  const router = useRouter();

  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedRelease, setSelectedRelease] =
    useState<Release | null>(null);

  const [action, setAction] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const [adminProfile, setAdminProfile] = useState<any>(null);

  useEffect(() => {
    checkAdmin();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAdmin() {
    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        router.push("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role,status,white_label_id")
        .eq("id", userData.user.id)
        .single();

      if (error || !profile) {
        router.push("/dashboard");
        return;
      }

      const allowedRoles = [
        "master_admin",
        "white_label_admin",
      ];

      if (
        !allowedRoles.includes(profile.role) ||
        profile.status !== "active"
      ) {
        alert("Admin access only.");
        router.push("/dashboard");
        return;
      }

      setAdminProfile(profile);

      await loadReleases(profile);
    } catch (error) {
      console.error(error);
      alert("Unable to verify admin access.");
      setLoading(false);
    }
  }

  async function loadReleases(profileParam = adminProfile) {
    try {
      setRefreshing(true);

      let query = supabase
        .from("releases")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

      if (profileParam?.role === "white_label_admin") {
        if (!profileParam.white_label_id) {
          setReleases([]);
          setLoading(false);
          setRefreshing(false);
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
        console.error(releaseError);
        alert(releaseError.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { data: profilesData } = await supabase
        .from("profiles")
        .select(
          "id,full_name,email,role,white_label_id"
        );

      const { data: whiteLabelsData } = await supabase
        .from("white_labels")
        .select(
          "id,name,brand_name,domain"
        );

      const merged = (releaseData || []).map(
        (release: any) => {
          const profile = profilesData?.find(
            (p) => p.id === release.user_id
          );

          const whiteLabel =
            whiteLabelsData?.find(
              (wl) =>
                wl.id === release.white_label_id
            );

          return {
            ...release,

            uploaded_by_name:
              profile?.full_name || "-",

            uploaded_by_email:
              profile?.email || "-",

            white_label_name:
              whiteLabel?.name ||
              whiteLabel?.brand_name ||
              "Nexorael Direct",
          };
        }
      );

      setReleases(merged);
    } catch (error) {
      console.error(error);
      alert("Failed to load releases.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filteredReleases = useMemo(() => {
    const q = search.trim().toLowerCase();

    return releases.filter((release) => {
      const matchesSearch =
        !q ||
        String(release.title || "")
          .toLowerCase()
          .includes(q) ||
        String(release.artist_name || "")
          .toLowerCase()
          .includes(q) ||
        String(release.label_name || "")
          .toLowerCase()
          .includes(q) ||
        String(release.upc || "")
          .toLowerCase()
          .includes(q) ||
        String(
          release.toolost_release_id || ""
        )
          .toLowerCase()
          .includes(q);

      const status =
        String(release.status || "")
          .toLowerCase();

      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [releases, search, statusFilter]);

  const stats = useMemo(() => {
    const count = (status: string) =>
      releases.filter(
        (r) =>
          String(r.status || "").toLowerCase() ===
          status
      ).length;

    return {
      total: releases.length,
      draft: count("draft"),
      pending:
        count("pending") +
        count("under_review"),
      approved: count("approved"),
      live: count("live"),
      rejected: count("rejected"),
      takedown: count("takedown"),
    };
  }, [releases]);

  function openAction(
    release: Release,
    selectedAction: Action
  ) {
    setSelectedRelease(release);
    setAction(selectedAction);
    setNote("");
  }

  function closeAction() {
    if (processing) return;

    setSelectedRelease(null);
    setAction(null);
    setNote("");
  }

  async function executeAction() {
    if (!selectedRelease || !action) {
      return;
    }

    if (
      (action === "reject" ||
        action === "takedown") &&
      !note.trim()
    ) {
      alert(
        action === "reject"
          ? "Please enter a rejection reason."
          : "Please enter a takedown reason."
      );
      return;
    }

    try {
      setProcessing(true);

      const response = await fetch(
        `/api/admin/releases/${selectedRelease.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action,
            note: note.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Release action failed."
        );
      }

      alert(
        result.message ||
          `Release ${action} completed successfully.`
      );

      closeAction();

      await loadReleases(adminProfile);
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setProcessing(false);
    }
  }

  async function submitRelease(release: Release) {
    openAction(release, "submit");
  }

  function getStatusClass(status?: string | null) {
    const value = String(status || "")
      .toLowerCase();

    if (value === "draft") {
      return "status draft";
    }

    if (
      value === "pending" ||
      value === "under_review"
    ) {
      return "status pending";
    }

    if (value === "approved") {
      return "status approved";
    }

    if (value === "live") {
      return "status live";
    }

    if (value === "rejected") {
      return "status rejected";
    }

    if (value === "takedown") {
      return "status takedown";
    }

    return "status";
  }

  function artwork(release: Release) {
    return (
      release.artwork_url ||
      release.cover_url ||
      ""
    );
  }

  return (
    <main className="page">
      <div className="top">
        <div>
          <div className="badge">
            ADMIN
          </div>

          <h1>Release Management</h1>

          <p>
            Manage your complete music catalog,
            submissions and release status.
          </p>
        </div>

        <button
          className="refresh"
          onClick={() =>
            loadReleases(adminProfile)
          }
          disabled={refreshing}
        >
          {refreshing
            ? "Refreshing..."
            : "↻ Refresh"}
        </button>
      </div>

      <div className="divider" />

      <section className="stats">
        <Stat
          title="Total"
          value={stats.total}
          icon="🎵"
        />

        <Stat
          title="Draft"
          value={stats.draft}
          icon="📄"
        />

        <Stat
          title="Pending"
          value={stats.pending}
          icon="⌛"
        />

        <Stat
          title="Approved"
          value={stats.approved}
          icon="✓"
        />

        <Stat
          title="Live"
          value={stats.live}
          icon="🌐"
        />

        <Stat
          title="Rejected"
          value={stats.rejected}
          icon="⚠"
        />

        <Stat
          title="Takedown"
          value={stats.takedown}
          icon="⛔"
        />
      </section>

      <section className="secondaryStats">
        <div className="secondaryCard">
          <span>Artists</span>
          <strong>
            {
              new Set(
                releases
                  .map((r) => r.artist_name)
                  .filter(Boolean)
              ).size
            }
          </strong>
          <small>Unique artists</small>
        </div>

        <div className="secondaryCard">
          <span>Labels</span>
          <strong>
            {
              new Set(
                releases
                  .map((r) => r.label_name)
                  .filter(Boolean)
              ).size
            }
          </strong>
          <small>Labels in catalog</small>
        </div>

        <div className="secondaryCard">
          <span>Catalog Health</span>
          <strong>
            {stats.total
              ? Math.round(
                  ((stats.approved +
                    stats.live) /
                    stats.total) *
                    100
                )
              : 0}
            %
          </strong>
          <small>
            Approved / Live releases
          </small>
        </div>

        <div className="secondaryCard">
          <span>Needs Attention</span>
          <strong>
            {stats.draft +
              stats.pending +
              stats.rejected}
          </strong>
          <small>
            Releases requiring action
          </small>
        </div>
      </section>

      <section className="catalog">
        <div className="catalogHeader">
          <div>
            <h2>All Releases</h2>
            <span>
              {filteredReleases.length} of{" "}
              {releases.length} releases
            </span>
          </div>

          <div className="filters">
            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search title, artist, UPC..."
            />

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value)
              }
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
              <option value="under_review">
                Under Review
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

        {loading ? (
          <div className="empty">
            Loading releases...
          </div>
        ) : filteredReleases.length === 0 ? (
          <div className="empty">
            <div className="emptyIcon">
              🎵
            </div>

            <h3>No releases found</h3>

            <p>
              Try changing your search or
              status filter.
            </p>
          </div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>RELEASE</th>
                  <th>ARTIST</th>
                  <th>TYPE</th>
                  <th>STATUS</th>
                  <th>TOO LOST ID</th>
                  <th>UPC</th>
                  <th>CREATED</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {filteredReleases.map(
                  (release) => (
                    <tr key={release.id}>
                      <td>
                        <div className="releaseCell">
                          {artwork(release) ? (
                            <img
                              src={artwork(
                                release
                              )}
                              alt=""
                            />
                          ) : (
                            <div className="coverPlaceholder">
                              🎵
                            </div>
                          )}

                          <div>
                            <strong>
                              {release.title ||
                                "Untitled"}
                            </strong>

                            <small>
                              ID: {release.id}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        {release.artist_name ||
                          "-"}
                      </td>

                      <td>
                        {release.type ||
                          release.release_type ||
                          "Single"}
                      </td>

                      <td>
                        <span
                          className={getStatusClass(
                            release.status
                          )}
                        >
                          {STATUS_LABELS[
                            String(
                              release.status ||
                                ""
                            ).toLowerCase()
                          ] ||
                            release.status ||
                            "Unknown"}
                        </span>
                      </td>

                      <td>
                        {release.toolost_release_id ||
                          "Not generated"}
                      </td>

                      <td>
                        {release.upc ||
                          "Not generated"}
                      </td>

                      <td>
                        {release.created_at
                          ? new Date(
                              release.created_at
                            ).toLocaleDateString(
                              "en-GB"
                            )
                          : "-"}
                      </td>

                      <td>
                        <div className="actions">
                          <button
                            className="viewBtn"
                            onClick={() =>
                              setSelectedRelease(
                                release
                              )
                            }
                          >
                            View
                          </button>

                          {String(
                            release.status || ""
                          ).toLowerCase() ===
                            "draft" && (
                            <button
                              className="submitBtn"
                              onClick={() =>
                                submitRelease(
                                  release
                                )
                              }
                            >
                              Submit
                            </button>
                          )}

                          {String(
                            release.status || ""
                          ).toLowerCase() !==
                            "approved" &&
                            String(
                              release.status || ""
                            ).toLowerCase() !==
                              "live" && (
                              <button
                                className="approveBtn"
                                onClick={() =>
                                  openAction(
                                    release,
                                    "approve"
                                  )
                                }
                              >
                                Approve
                              </button>
                            )}

                          {String(
                            release.status || ""
                          ).toLowerCase() !==
                            "rejected" && (
                            <button
                              className="rejectBtn"
                              onClick={() =>
                                openAction(
                                  release,
                                  "reject"
                                )
                              }
                            >
                              Reject
                            </button>
                          )}

                          {String(
                            release.status || ""
                          ).toLowerCase() !==
                            "draft" && (
                            <button
                              className="draftBtn"
                              onClick={() =>
                                openAction(
                                  release,
                                  "draft"
                                )
                              }
                            >
                              Draft
                            </button>
                          )}

                          {(String(
                            release.status || ""
                          ).toLowerCase() ===
                            "live" ||
                            String(
                              release.status || ""
                            ).toLowerCase() ===
                              "approved") && (
                            <button
                              className="takedownBtn"
                              onClick={() =>
                                openAction(
                                  release,
                                  "takedown"
                                )
                              }
                            >
                              Takedown
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* VIEW MODAL */}

      {selectedRelease &&
        !action && (
          <div
            className="overlay"
            onClick={() =>
              setSelectedRelease(null)
            }
          >
            <div
              className="modal"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div className="modalHeader">
                <div>
                  <span className="modalBadge">
                    RELEASE
                  </span>

                  <h2>
                    {selectedRelease.title ||
                      "Untitled"}
                  </h2>
                </div>

                <button
                  className="close"
                  onClick={() =>
                    setSelectedRelease(null)
                  }
                >
                  ×
                </button>
              </div>

              <div className="detailGrid">
                <Detail
                  label="Artist"
                  value={
                    selectedRelease.artist_name
                  }
                />

                <Detail
                  label="Label"
                  value={
                    selectedRelease.label_name
                  }
                />

                <Detail
                  label="Status"
                  value={
                    selectedRelease.status
                  }
                  badge
                />

                <Detail
                  label="Type"
                  value={
                    selectedRelease.type ||
                    selectedRelease.release_type ||
                    "Single"
                  }
                />

                <Detail
                  label="Too Lost Release ID"
                  value={
                    selectedRelease.toolost_release_id
                  }
                />

                <Detail
                  label="UPC"
                  value={
                    selectedRelease.upc
                  }
                />

                <Detail
                  label="Uploaded By"
                  value={
                    selectedRelease.uploaded_by_name
                  }
                />

                <Detail
                  label="Email"
                  value={
                    selectedRelease.uploaded_by_email
                  }
                />

                <Detail
                  label="White Label"
                  value={
                    selectedRelease.white_label_name
                  }
                />

                <Detail
                  label="Created"
                  value={
                    selectedRelease.created_at
                      ? new Date(
                          selectedRelease.created_at
                        ).toLocaleString()
                      : "-"
                  }
                />
              </div>

              {selectedRelease.admin_note && (
                <div className="noteBox">
                  <strong>
                    Admin Note
                  </strong>

                  <p>
                    {
                      selectedRelease.admin_note
                    }
                  </p>
                </div>
              )}

              <div className="modalActions">
                {String(
                  selectedRelease.status || ""
                ).toLowerCase() ===
                  "draft" && (
                  <button
                    className="submitBtn big"
                    onClick={() =>
                      submitRelease(
                        selectedRelease
                      )
                    }
                  >
                    Submit to Too Lost
                  </button>
                )}

                <button
                  className="approveBtn big"
                  onClick={() => {
                    openAction(
                      selectedRelease,
                      "approve"
                    );
                  }}
                >
                  Approve
                </button>

                <button
                  className="rejectBtn big"
                  onClick={() =>
                    openAction(
                      selectedRelease,
                      "reject"
                    )
                  }
                >
                  Reject
                </button>

                <button
                  className="draftBtn big"
                  onClick={() =>
                    openAction(
                      selectedRelease,
                      "draft"
                    )
                  }
                >
                  Move to Draft
                </button>

                <button
                  className="takedownBtn big"
                  onClick={() =>
                    openAction(
                      selectedRelease,
                      "takedown"
                    )
                  }
                >
                  Takedown
                </button>
              </div>
            </div>
          </div>
        )}

      {/* ACTION MODAL */}

      {selectedRelease &&
        action && (
          <div className="overlay">
            <div className="modal actionModal">
              <div className="modalHeader">
                <div>
                  <span className="modalBadge">
                    {action.toUpperCase()}
                  </span>

                  <h2>
                    {action === "submit"
                      ? "Submit Release"
                      : action ===
                        "approve"
                      ? "Approve Release"
                      : action ===
                        "reject"
                      ? "Reject Release"
                      : action ===
                        "takedown"
                      ? "Takedown Release"
                      : "Move Release to Draft"}
                  </h2>
                </div>

                <button
                  className="close"
                  onClick={closeAction}
                  disabled={processing}
                >
                  ×
                </button>
              </div>

              <div className="selectedRelease">
                <strong>
                  {selectedRelease.title ||
                    "Untitled"}
                </strong>

                <span>
                  {selectedRelease.artist_name ||
                    "-"}
                </span>
              </div>

              {action === "submit" && (
                <div className="warningBox">
                  <strong>
                    Submit to Too Lost
                  </strong>

                  <p>
                    This will submit the release
                    to Too Lost using its Too
                    Lost release ID.
                  </p>
                </div>
              )}

              {action === "approve" && (
                <div className="successBox">
                  This release will be marked
                  as approved.
                </div>
              )}

              {action === "reject" && (
                <div className="dangerBox">
                  This release will be marked
                  as rejected.
                </div>
              )}

              {action === "takedown" && (
                <div className="dangerBox">
                  Enter the reason for taking
                  down this release.
                </div>
              )}

              {action !== "submit" && (
                <label className="noteLabel">
                  {action === "reject"
                    ? "Rejection Reason *"
                    : action === "takedown"
                    ? "Takedown Reason *"
                    : "Admin Note"}

                  <textarea
                    value={note}
                    onChange={(e) =>
                      setNote(e.target.value)
                    }
                    placeholder={
                      action === "reject"
                        ? "Enter rejection reason..."
                        : action === "takedown"
                        ? "Enter takedown reason..."
                        : "Optional admin note..."
                    }
                    rows={5}
                    disabled={processing}
                  />
                </label>
              )}

              <div className="confirmActions">
                <button
                  className="cancelBtn"
                  onClick={closeAction}
                  disabled={processing}
                >
                  Cancel
                </button>

                <button
                  className={
                    action === "reject" ||
                    action === "takedown"
                      ? "confirmDanger"
                      : "confirmBtn"
                  }
                  onClick={executeAction}
                  disabled={processing}
                >
                  {processing
                    ? "Processing..."
                    : action === "submit"
                    ? "Submit to Too Lost"
                    : action ===
                      "approve"
                    ? "Approve Release"
                    : action ===
                      "reject"
                    ? "Reject Release"
                    : action ===
                      "takedown"
                    ? "Confirm Takedown"
                    : "Move to Draft"}
                </button>
              </div>
            </div>
          </div>
        )}
    </main>
  );
}

function Stat({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="stat">
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>

      <div className="statIcon">
        {icon}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  badge,
}: {
  label: string;
  value?: string | number | null;
  badge?: boolean;
}) {
  return (
    <div className="detail">
      <span>{label}</span>

      {badge ? (
        <span className="status pending">
          {value || "-"}
        </span>
      ) : (
        <strong>
          {value || "-"}
        </strong>
      )}
    </div>
  );
}
<style jsx global>{`
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: #05070b;
  }

  .page {
    min-height: 100vh;
    background: #05070b;
    color: #f8fafc;
    padding: 38px;
    font-family:
      Arial,
      Helvetica,
      sans-serif;
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
  }

  .badge,
  .modalBadge {
    display: inline-flex;
    padding: 5px 9px;
    border: 1px solid #1d4ed8;
    background: #071735;
    color: #60a5fa;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 800;
  }

  h1 {
    margin: 8px 0 8px;
    font-size: 30px;
    letter-spacing: -1px;
  }

  .top p {
    margin: 0;
    color: #64748b;
    font-size: 13px;
  }

  .divider {
    height: 1px;
    background: #1b1f27;
    margin: 24px 0;
  }

  .refresh,
  .viewBtn,
  .cancelBtn {
    border: 1px solid #292e38;
    background: #101318;
    color: white;
    border-radius: 10px;
    padding: 10px 16px;
    cursor: pointer;
    font-weight: 700;
  }

  .refresh:hover,
  .viewBtn:hover,
  .cancelBtn:hover {
    background: #181d25;
  }

  .refresh:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .stats {
    display: grid;
    grid-template-columns:
      repeat(7, minmax(0, 1fr));
    gap: 14px;
  }

  .stat {
    min-height: 105px;
    border: 1px solid #20242c;
    background: #080a0e;
    border-radius: 14px;
    padding: 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stat span,
  .secondaryCard span {
    display: block;
    color: #64748b;
    font-size: 12px;
    margin-bottom: 10px;
  }

  .stat strong {
    font-size: 24px;
  }

  .statIcon {
    width: 34px;
    height: 34px;
    border: 1px solid #2a2f38;
    border-radius: 9px;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #111318;
  }

  .secondaryStats {
    display: grid;
    grid-template-columns:
      repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-top: 14px;
  }

  .secondaryCard {
    border: 1px solid #20242c;
    background: #080a0e;
    border-radius: 14px;
    padding: 18px;
  }

  .secondaryCard strong {
    display: block;
    font-size: 22px;
    margin-bottom: 6px;
  }

  .secondaryCard small {
    color: #475569;
  }

  .catalog {
    margin-top: 26px;
    border: 1px solid #20242c;
    background: #080a0e;
    border-radius: 16px;
    overflow: hidden;
  }

  .catalogHeader {
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    border-bottom: 1px solid #20242c;
  }

  .catalogHeader h2 {
    margin: 0 0 7px;
    font-size: 17px;
  }

  .catalogHeader span {
    color: #64748b;
    font-size: 12px;
  }

  .filters {
    display: flex;
    gap: 10px;
  }

  .filters input,
  .filters select {
    height: 38px;
    background: #030507;
    border: 1px solid #252a33;
    color: white;
    border-radius: 8px;
    padding: 0 12px;
    outline: none;
  }

  .filters input {
    width: 260px;
  }

  .filters select {
    min-width: 120px;
  }

  .tableWrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    min-width: 1250px;
    border-collapse: collapse;
  }

  th {
    text-align: left;
    color: #64748b;
    font-size: 10px;
    font-weight: 700;
    padding: 14px 18px;
    border-bottom: 1px solid #20242c;
  }

  td {
    padding: 14px 18px;
    border-bottom: 1px solid #161a20;
    color: #cbd5e1;
    font-size: 12px;
    vertical-align: middle;
  }

  tbody tr:hover {
    background: #0b0e13;
  }

  .releaseCell {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 260px;
  }

  .releaseCell img,
  .coverPlaceholder {
    width: 42px;
    height: 42px;
    border-radius: 6px;
    object-fit: cover;
    background: #151922;
    border: 1px solid #252a33;
  }

  .coverPlaceholder {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .releaseCell strong {
    display: block;
    color: white;
    margin-bottom: 5px;
  }

  .releaseCell small {
    display: block;
    color: #475569;
    font-size: 9px;
    max-width: 210px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status {
    display: inline-flex;
    padding: 5px 9px;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    background: #20242b;
    color: #cbd5e1;
  }

  .status.draft {
    background: #332b00;
    color: #facc15;
  }

  .status.pending {
    background: #172554;
    color: #60a5fa;
  }

  .status.approved,
  .status.live {
    background: #052e1b;
    color: #34d399;
  }

  .status.rejected,
  .status.takedown {
    background: #3f0b12;
    color: #fb7185;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 250px;
  }

  .actions button,
  .modalActions button,
  .confirmActions button {
    border-radius: 8px;
    padding: 8px 11px;
    border: 1px solid transparent;
    color: white;
    cursor: pointer;
    font-size: 11px;
    font-weight: 700;
  }

  .viewBtn {
    background: #101318;
    border-color: #292e38 !important;
  }

  .submitBtn,
  .approveBtn,
  .confirmBtn {
    background: #2563eb;
  }

  .submitBtn:hover,
  .approveBtn:hover,
  .confirmBtn:hover {
    background: #1d4ed8;
  }

  .rejectBtn,
  .confirmDanger {
    background: #b91c1c;
  }

  .rejectBtn:hover,
  .confirmDanger:hover {
    background: #991b1b;
  }

  .draftBtn {
    background: #374151;
  }

  .takedownBtn {
    background: #7f1d1d;
  }

  .big {
    padding: 11px 15px !important;
  }

  .empty {
    min-height: 300px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #64748b;
  }

  .emptyIcon {
    font-size: 42px;
    margin-bottom: 12px;
  }

  .empty h3 {
    margin: 0 0 6px;
    color: white;
  }

  .empty p {
    margin: 0;
    font-size: 12px;
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(5px);
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
    z-index: 1000;
  }

  .modal {
    width: min(760px, 100%);
    max-height: 90vh;
    overflow-y: auto;
    background: #0b0e13;
    border: 1px solid #292e38;
    border-radius: 16px;
    padding: 24px;
    box-shadow:
      0 30px 100px
      rgba(0, 0, 0, 0.5);
  }

  .actionModal {
    width: min(600px, 100%);
  }

  .modalHeader {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;
    margin-bottom: 22px;
  }

  .modalHeader h2 {
    margin: 9px 0 0;
    font-size: 23px;
  }

  .close {
    width: 34px;
    height: 34px;
    border: 1px solid #292e38;
    background: #11151b;
    color: white;
    border-radius: 8px;
    cursor: pointer;
    font-size: 20px;
  }

  .detailGrid {
    display: grid;
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
    gap: 1px;
    background: #20242c;
    border: 1px solid #20242c;
    border-radius: 12px;
    overflow: hidden;
  }

  .detail {
    background: #0b0e13;
    padding: 14px;
  }

  .detail span:first-child {
    display: block;
    color: #64748b;
    font-size: 10px;
    margin-bottom: 7px;
    text-transform: uppercase;
  }

  .detail strong {
    color: white;
    font-size: 13px;
    word-break: break-word;
  }

  .noteBox {
    margin-top: 15px;
    padding: 15px;
    border: 1px solid #292e38;
    background: #0f1319;
    border-radius: 10px;
  }

  .noteBox strong {
    font-size: 12px;
  }

  .noteBox p {
    color: #94a3b8;
    font-size: 12px;
    margin-bottom: 0;
  }

  .modalActions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 20px;
  }

  .selectedRelease {
    padding: 14px;
    background: #11151b;
    border: 1px solid #252a33;
    border-radius: 10px;
    margin-bottom: 16px;
  }

  .selectedRelease strong {
    display: block;
    color: white;
    margin-bottom: 5px;
  }

  .selectedRelease span {
    color: #64748b;
    font-size: 12px;
  }

  .warningBox,
  .successBox,
  .dangerBox {
    padding: 14px;
    border-radius: 10px;
    margin-bottom: 18px;
    font-size: 12px;
  }

  .warningBox {
    background: #332b00;
    border: 1px solid #6b5a00;
    color: #fde68a;
  }

  .successBox {
    background: #052e1b;
    border: 1px solid #065f46;
    color: #6ee7b7;
  }

  .dangerBox {
    background: #3f0b12;
    border: 1px solid #7f1d1d;
    color: #fda4af;
  }

  .warningBox p {
    margin: 6px 0 0;
  }

  .noteLabel {
    display: block;
    color: #cbd5e1;
    font-size: 12px;
    font-weight: 700;
  }

  .noteLabel textarea {
    display: block;
    width: 100%;
    margin-top: 8px;
    resize: vertical;
    background: #05070b;
    color: white;
    border: 1px solid #292e38;
    border-radius: 10px;
    padding: 12px;
    outline: none;
    font-family: inherit;
  }

  .confirmActions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
  }

  .confirmActions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 1100px) {
    .stats {
      grid-template-columns:
        repeat(4, minmax(0, 1fr));
    }

    .secondaryStats {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 700px) {
    .page {
      padding: 20px;
    }

    .top {
      flex-direction: column;
    }

    .stats {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }

    .secondaryStats {
      grid-template-columns: 1fr;
    }

    .catalogHeader {
      flex-direction: column;
      align-items: stretch;
    }

    .filters {
      flex-direction: column;
    }

    .filters input {
      width: 100%;
    }

    .detailGrid {
      grid-template-columns: 1fr;
    }
  }
`}</style>