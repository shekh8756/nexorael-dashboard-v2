"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

type Release = {
  id: string;
  title?: string | null;
  artist_name?: string | null;
  label_name?: string | null;
  status?: string | null;
  admin_note?: string | null;
  created_at?: string | null;
  user_id?: string | null;
  white_label_id?: string | null;
  toolost_release_id?: string | number | null;

  uploaded_by_name?: string;
  uploaded_by_email?: string;
  white_label_name?: string;

  [key: string]: any;
};

export default function AdminReleasesPage() {
  const router = useRouter();

  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [adminProfile, setAdminProfile] = useState<any>(null);

  useEffect(() => {
    checkAdmin();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * =========================================================
   * ADMIN AUTH
   * =========================================================
   */

  async function checkAdmin() {
    try {
      setLoading(true);

      const { data: userData } =
        await supabase.auth.getUser();

      if (!userData.user) {
        router.push("/login");
        return;
      }

      const { data: profile, error } =
        await supabase
          .from("profiles")
          .select(
            "role,status,white_label_id"
          )
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
      console.error(
        "Admin authentication error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Failed to authenticate admin."
      );

      setLoading(false);
    }
  }

  /*
   * =========================================================
   * LOAD RELEASES
   * =========================================================
   */

  async function loadReleases(
    profileParam = adminProfile
  ) {
    try {
      setLoading(true);

      let releaseQuery = supabase
        .from("releases")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

      /*
       * White label admin only sees
       * their own label releases.
       */

      if (
        profileParam?.role ===
        "white_label_admin"
      ) {
        if (!profileParam.white_label_id) {
          setReleases([]);
          setLoading(false);
          return;
        }

        releaseQuery = releaseQuery.eq(
          "white_label_id",
          profileParam.white_label_id
        );
      }

      const {
        data: releaseData,
        error: releaseError,
      } = await releaseQuery;

      if (releaseError) {
        throw new Error(
          releaseError.message
        );
      }

      /*
       * Load profiles
       */

      const { data: profilesData } =
        await supabase
          .from("profiles")
          .select(
            "id, full_name, email, role, white_label_id"
          );

      /*
       * Load white labels
       */

      const { data: whiteLabelsData } =
        await supabase
          .from("white_labels")
          .select(
            "id, name, brand_name, domain"
          );

      /*
       * Merge information
       */

      const merged: Release[] = (
        releaseData || []
      ).map((release) => {
        const profile =
          profilesData?.find(
            (p) =>
              p.id === release.user_id
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
            profile?.full_name || "-",

          uploaded_by_email:
            profile?.email || "-",

          white_label_name:
            whiteLabel?.name ||
            whiteLabel?.brand_name ||
            "Nexorael Direct",
        };
      });

      setReleases(merged);
    } catch (error) {
      console.error(
        "Load releases error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Failed to load releases."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * =========================================================
   * ADMIN ACTION API
   * =========================================================
   */

  async function performReleaseAction(
    release: Release,
    action:
      | "approve"
      | "reject"
      | "draft"
      | "takedown"
      | "submit"
  ) {
    if (actionLoading) return;

    /*
     * Confirmation
     */

    let note = "";

    if (
      action === "reject" ||
      action === "takedown"
    ) {
      note =
        window.prompt(
          action === "reject"
            ? "Enter rejection reason:"
            : "Enter takedown reason:"
        ) || "";

      note = note.trim();

      if (!note) {
        alert(
          action === "reject"
            ? "Rejection reason is required."
            : "Takedown reason is required."
        );

        return;
      }
    } else {
      const confirmed =
        window.confirm(
          action === "submit"
            ? `Submit "${release.title}" to Too Lost?`
            : `Are you sure you want to ${action} "${release.title}"?`
        );

      if (!confirmed) {
        return;
      }
    }

    /*
     * Submit button protection
     */

    if (
      action === "submit" &&
      String(release.status || "").toLowerCase() !==
        "draft"
    ) {
      alert(
        "Only draft releases can be submitted."
      );

      return;
    }

    if (
      action === "submit" &&
      !release.toolost_release_id
    ) {
      alert(
        "This release does not have a Too Lost release ID."
      );

      return;
    }

    try {
      setActionLoading(
        `${release.id}-${action}`
      );

      const response = await fetch(
        `/api/admin/releases/${release.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
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
            `Failed to ${action} release.`
        );
      }

      /*
       * Notify user
       */

      if (release.user_id) {
        const status =
          data.newStatus ||
          action;

        await supabase
          .from("notifications")
          .insert({
            user_id:
              release.user_id,

            title:
              action === "submit"
                ? "Release Submitted"
                : `Release ${status}`,

            message:
              action === "submit"
                ? `Your release "${release.title}" has been submitted to Too Lost for review.`
                : `Your release "${release.title}" status has been updated to ${status}.`,

            type: String(status),

            is_read: false,
          });
      }

      alert(
        data.message ||
          `Release ${action} completed successfully.`
      );

      await loadReleases(
        adminProfile
      );
    } catch (error) {
      console.error(
        `Release ${action} error:`,
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : `Failed to ${action} release.`
      );
    } finally {
      setActionLoading(null);
    }
  }

  /*
   * =========================================================
   * DIRECT STATUS UPDATE
   *
   * Used for internal workflow statuses
   * such as Review / Delivered / Live.
   * =========================================================
   */

  async function updateInternalStatus(
    release: Release,
    status: string
  ) {
    if (actionLoading) return;

    const confirmed =
      window.confirm(
        `Change "${release.title}" to ${status}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(
        `${release.id}-${status}`
      );

      const note =
        window.prompt(
          "Admin note optional:"
        ) || "";

      const { error } =
        await supabase
          .from("releases")
          .update({
            status,
            admin_note: note,
          })
          .eq("id", release.id);

      if (error) {
        throw new Error(
          error.message
        );
      }

      /*
       * Notification
       */

      if (release.user_id) {
        await supabase
          .from("notifications")
          .insert({
            user_id:
              release.user_id,

            title:
              `Release ${status}`,

            message:
              `Your release "${release.title}" status has been updated to ${status}.`,

            type: status,

            is_read: false,
          });
      }

      alert(
        "Status updated successfully."
      );

      await loadReleases(
        adminProfile
      );
    } catch (error) {
      console.error(
        "Status update error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Failed to update status."
      );
    } finally {
      setActionLoading(null);
    }
  }

  /*
   * =========================================================
   * DSP DELIVERY
   * =========================================================
   */

  async function addDspDelivery(
    releaseId: string
  ) {
    const dspName = window.prompt(
      "DSP name, example: Spotify, Apple Music, YouTube Music"
    );

    if (!dspName) return;

    const dspStatus =
      window.prompt(
        "Status: pending, delivered, processing, live",
        "delivered"
      ) || "delivered";

    const liveLink =
      window.prompt(
        "Live link optional, agar live nahi hai to blank chhod do"
      ) || "";

    try {
      setActionLoading(
        `${releaseId}-dsp`
      );

      const { error } =
        await supabase
          .from("dsp_deliveries")
          .insert({
            release_id:
              releaseId,

            dsp_name:
              dspName,

            status:
              dspStatus,

            live_link:
              liveLink,
          });

      if (error) {
        throw new Error(
          error.message
        );
      }

      alert(
        "DSP delivery added successfully."
      );
    } catch (error) {
      console.error(
        "DSP delivery error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Failed to add DSP delivery."
      );
    } finally {
      setActionLoading(null);
    }
  }

  /*
   * =========================================================
   * BUTTON HELPER
   * =========================================================
   */

  function isBusy(
    releaseId: string,
    action: string
  ) {
    return (
      actionLoading ===
      `${releaseId}-${action}`
    );
  }

  /*
   * =========================================================
   * UI
   * =========================================================
   */

  return (
    <main style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>
            Release Management
          </h1>

          <p style={subtitleStyle}>
            Manage your complete music
            catalog, submissions and
            release status.
          </p>
        </div>

        <button
          onClick={() =>
            loadReleases(
              adminProfile
            )
          }
          disabled={loading}
          style={refreshButton}
        >
          {loading
            ? "Refreshing..."
            : "↻ Refresh"}
        </button>
      </div>

      {/* STATS */}

      <section style={statsGrid}>
        <StatCard
          title="Total"
          value={releases.length}
        />

        <StatCard
          title="Draft"
          value={
            releases.filter(
              (r) =>
                String(
                  r.status || ""
                ).toLowerCase() ===
                "draft"
            ).length
          }
        />

        <StatCard
          title="Pending"
          value={
            releases.filter(
              (r) =>
                [
                  "pending",
                  "under_review",
                  "processing",
                ].includes(
                  String(
                    r.status || ""
                  ).toLowerCase()
                )
            ).length
          }
        />

        <StatCard
          title="Approved"
          value={
            releases.filter(
              (r) =>
                String(
                  r.status || ""
                ).toLowerCase() ===
                "approved"
            ).length
          }
        />

        <StatCard
          title="Live"
          value={
            releases.filter(
              (r) =>
                String(
                  r.status || ""
                ).toLowerCase() ===
                "live"
            ).length
          }
        />

        <StatCard
          title="Rejected"
          value={
            releases.filter(
              (r) =>
                String(
                  r.status || ""
                ).toLowerCase() ===
                "rejected"
            ).length
          }
        />

        <StatCard
          title="Takedown"
          value={
            releases.filter(
              (r) =>
                String(
                  r.status || ""
                ).toLowerCase() ===
                "takedown"
            ).length
          }
        />
      </section>

      {/* TABLE */}

      <section style={sectionStyle}>
        <div style={tableHeaderStyle}>
          <div>
            <h2 style={sectionTitleStyle}>
              All Releases
            </h2>

            <p style={smallTextStyle}>
              {releases.length} release
              {releases.length !== 1
                ? "s"
                : ""}{" "}
              in catalog
            </p>
          </div>
        </div>

        {loading ? (
          <div style={emptyStyle}>
            Loading releases...
          </div>
        ) : releases.length === 0 ? (
          <div style={emptyStyle}>
            No releases found.
          </div>
        ) : (
          <div
            style={{
              overflowX:
                "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse:
                  "collapse",
                minWidth:
                  "1700px",
              }}
            >
              <thead>
                <tr
                  style={{
                    color:
                      "#94A3B8",
                  }}
                >
                  <th
                    align="left"
                    style={
                      thStyle
                    }
                  >
                    Release
                  </th>

                  <th
                    align="left"
                    style={
                      thStyle
                    }
                  >
                    Artist
                  </th>

                  <th
                    align="left"
                    style={
                      thStyle
                    }
                  >
                    Label
                  </th>

                  <th
                    align="left"
                    style={
                      thStyle
                    }
                  >
                    Uploaded By
                  </th>

                  <th
                    align="left"
                    style={
                      thStyle
                    }
                  >
                    Email
                  </th>

                  <th
                    align="left"
                    style={
                      thStyle
                    }
                  >
                    White Label
                  </th>

                  <th
                    align="left"
                    style={
                      thStyle
                    }
                  >
                    Too Lost ID
                  </th>

                  <th
                    align="left"
                    style={
                      thStyle
                    }
                  >
                    Submitted
                  </th>

                  <th
                    align="left"
                    style={
                      thStyle
                    }
                  >
                    Status
                  </th>

                  <th
                    align="left"
                    style={
                      thStyle
                    }
                  >
                    Admin Note
                  </th>

                  <th
                    align="left"
                    style={
                      thStyle
                    }
                  >
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {releases.map(
                  (release) => {
                    const status =
                      String(
                        release.status ||
                          "unknown"
                      ).toLowerCase();

                    return (
                      <tr
                        key={
                          release.id
                        }
                        style={
                          rowStyle
                        }
                      >
                        {/* RELEASE */}

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <div
                            style={
                              releaseTitleStyle
                            }
                          >
                            {
                              release.title ||
                              "Untitled"
                            }
                          </div>

                          <div
                            style={
                              releaseIdStyle
                            }
                          >
                            ID:{" "}
                            {
                              release.id
                            }
                          </div>
                        </td>

                        {/* ARTIST */}

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            release.artist_name ||
                            "-"
                          }
                        </td>

                        {/* LABEL */}

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            release.label_name ||
                            "-"
                          }
                        </td>

                        {/* UPLOADED BY */}

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            release.uploaded_by_name
                          }
                        </td>

                        {/* EMAIL */}

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            release.uploaded_by_email
                          }
                        </td>

                        {/* WHITE LABEL */}

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {
                            release.white_label_name
                          }
                        </td>

                        {/* TOO LOST ID */}

                        <td
                          style={{
                            ...tdStyle,
                            fontFamily:
                              "monospace",
                          }}
                        >
                          {release.toolost_release_id ||
                            "-"}
                        </td>

                        {/* DATE */}

                        <td
                          style={
                            tdStyle
                          }
                        >
                          {release.created_at
                            ? new Date(
                                release.created_at
                              ).toLocaleDateString()
                            : "-"}
                        </td>

                        {/* STATUS */}

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <span
                            style={{
                              ...statusStyle,
                              ...getStatusStyle(
                                status
                              ),
                            }}
                          >
                            {status.toUpperCase()}
                          </span>
                        </td>

                        {/* NOTE */}

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <div
                            style={{
                              maxWidth:
                                "220px",
                              color:
                                "#CBD5E1",
                              fontSize:
                                "12px",
                            }}
                          >
                            {
                              release.admin_note ||
                              "-"
                            }
                          </div>
                        </td>

                        {/* ACTIONS */}

                        <td
                          style={
                            tdStyle
                          }
                        >
                          <div
                            style={
                              actionsContainer
                            }
                          >
                            {/* SUBMIT */}

                            {status ===
                              "draft" && (
                              <button
                                disabled={isBusy(
                                  release.id,
                                  "submit"
                                )}
                                onClick={() =>
                                  performReleaseAction(
                                    release,
                                    "submit"
                                  )
                                }
                                style={
                                  submitButton
                                }
                              >
                                {isBusy(
                                  release.id,
                                  "submit"
                                )
                                  ? "Submitting..."
                                  : "Submit to Too Lost"}
                              </button>
                            )}

                            {/* REVIEW */}

                            <button
                              disabled={
                                !!actionLoading
                              }
                              onClick={() =>
                                updateInternalStatus(
                                  release,
                                  "under_review"
                                )
                              }
                              style={
                                smallButton
                              }
                            >
                              Review
                            </button>

                            {/* APPROVE */}

                            <button
                              disabled={isBusy(
                                release.id,
                                "approve"
                              )}
                              onClick={() =>
                                performReleaseAction(
                                  release,
                                  "approve"
                                )
                              }
                              style={
                                successButton
                              }
                            >
                              {isBusy(
                                release.id,
                                "approve"
                              )
                                ? "..."
                                : "Approve"}
                            </button>

                            {/* REJECT */}

                            <button
                              disabled={isBusy(
                                release.id,
                                "reject"
                              )}
                              onClick={() =>
                                performReleaseAction(
                                  release,
                                  "reject"
                                )
                              }
                              style={
                                dangerButton
                              }
                            >
                              {isBusy(
                                release.id,
                                "reject"
                              )
                                ? "..."
                                : "Reject"}
                            </button>

                            {/* DRAFT */}

                            {status !==
                              "draft" && (
                              <button
                                disabled={isBusy(
                                  release.id,
                                  "draft"
                                )}
                                onClick={() =>
                                  performReleaseAction(
                                    release,
                                    "draft"
                                  )
                                }
                                style={
                                  warningButton
                                }
                              >
                                {isBusy(
                                  release.id,
                                  "draft"
                                )
                                  ? "..."
                                  : "Draft"}
                              </button>
                            )}

                            {/* TAKEDOWN */}

                            {status ===
                              "live" && (
                              <button
                                disabled={isBusy(
                                  release.id,
                                  "takedown"
                                )}
                                onClick={() =>
                                  performReleaseAction(
                                    release,
                                    "takedown"
                                  )
                                }
                                style={
                                  takedownButton
                                }
                              >
                                {isBusy(
                                  release.id,
                                  "takedown"
                                )
                                  ? "..."
                                  : "Takedown"}
                              </button>
                            )}

                            {/* DELIVERED */}

                            <button
                              disabled={
                                !!actionLoading
                              }
                              onClick={() =>
                                updateInternalStatus(
                                  release,
                                  "delivered"
                                )
                              }
                              style={
                                smallButton
                              }
                            >
                              Delivered
                            </button>

                            {/* LIVE */}

                            <button
                              disabled={
                                !!actionLoading
                              }
                              onClick={() =>
                                updateInternalStatus(
                                  release,
                                  "live"
                                )
                              }
                              style={
                                liveButton
                              }
                            >
                              Live
                            </button>

                            {/* DSP */}

                            <button
                              disabled={
                                !!actionLoading
                              }
                              onClick={() =>
                                addDspDelivery(
                                  release.id
                                )
                              }
                              style={
                                dspButton
                              }
                            >
                              Add DSP
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
      </section>
    </main>
  );
}

/*
 * =========================================================
 * STAT CARD
 * =========================================================
 */

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div style={statCardStyle}>
      <div
        style={{
          color: "#94A3B8",
          fontSize: "12px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "25px",
          fontWeight: 700,
          marginTop: "8px",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/*
 * =========================================================
 * STATUS COLORS
 * =========================================================
 */

function getStatusStyle(
  status: string
) {
  switch (status) {
    case "draft":
      return {
        background: "#422006",
        color: "#FBBF24",
      };

    case "pending":
    case "under_review":
    case "processing":
      return {
        background: "#172554",
        color: "#60A5FA",
      };

    case "approved":
      return {
        background: "#052E16",
        color: "#4ADE80",
      };

    case "live":
      return {
        background: "#022C22",
        color: "#34D399",
      };

    case "rejected":
      return {
        background: "#450A0A",
        color: "#F87171",
      };

    case "takedown":
      return {
        background: "#3F0D0D",
        color: "#FB7185",
      };

    case "delivered":
      return {
        background: "#1E1B4B",
        color: "#A78BFA",
      };

    default:
      return {
        background: "#374151",
        color: "#D1D5DB",
      };
  }
}

/*
 * =========================================================
 * STYLES
 * =========================================================
 */

const pageStyle = {
  minHeight: "100vh",
  background: "#050816",
  color: "white",
  padding: "35px",
  fontFamily:
    "Arial, sans-serif",
};

const headerStyle = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  marginBottom: "25px",
};

const titleStyle = {
  fontSize: "30px",
  fontWeight: 700,
  margin: 0,
};

const subtitleStyle = {
  color: "#94A3B8",
  marginTop: "8px",
  fontSize: "14px",
};

const refreshButton = {
  padding: "10px 18px",
  borderRadius: "10px",
  border:
    "1px solid #334155",
  background: "#111827",
  color: "white",
  cursor: "pointer",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(130px,1fr))",
  gap: "12px",
  marginBottom: "25px",
};

const statCardStyle = {
  background: "#0B1220",
  border:
    "1px solid #1F2937",
  borderRadius: "14px",
  padding: "18px",
};

const sectionStyle = {
  background: "#0B1220",
  padding: "20px",
  borderRadius: "16px",
  border:
    "1px solid #1F2937",
  overflowX: "auto" as const,
};

const tableHeaderStyle = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  marginBottom: "18px",
};

const sectionTitleStyle = {
  fontSize: "20px",
  fontWeight: 700,
  margin: 0,
};

const smallTextStyle = {
  color: "#64748B",
  fontSize: "12px",
  marginTop: "5px",
};

const emptyStyle = {
  padding: "50px",
  textAlign: "center" as const,
  color: "#64748B",
};

const thStyle = {
  padding:
    "13px 10px",
  borderBottom:
    "1px solid #334155",
  whiteSpace:
    "nowrap" as const,
  fontSize: "12px",
};

const tdStyle = {
  padding:
    "14px 10px",
  borderBottom:
    "1px solid #1F2937",
  verticalAlign:
    "top" as const,
  fontSize: "13px",
};

const rowStyle = {
  borderBottom:
    "1px solid #1F2937",
};

const releaseTitleStyle = {
  fontWeight: 700,
  color: "white",
};

const releaseIdStyle = {
  color: "#475569",
  fontSize: "10px",
  marginTop: "4px",
};

const statusStyle = {
  padding:
    "6px 10px",
  borderRadius:
    "999px",
  fontSize: "10px",
  fontWeight: 700,
  whiteSpace:
    "nowrap" as const,
};

const actionsContainer = {
  display: "flex",
  flexWrap:
    "wrap" as const,
  gap: "6px",
  minWidth: "300px",
};

const smallButton = {
  padding:
    "7px 9px",
  borderRadius:
    "7px",
  border:
    "1px solid #334155",
  background:
    "#1E293B",
  color: "white",
  cursor:
    "pointer",
  fontSize: "11px",
};

const successButton = {
  ...smallButton,
  background:
    "#15803D",
  border:
    "1px solid #16A34A",
};

const dangerButton = {
  ...smallButton,
  background:
    "#B91C1C",
  border:
    "1px solid #DC2626",
};

const warningButton = {
  ...smallButton,
  background:
    "#92400E",
  border:
    "1px solid #D97706",
};

const submitButton = {
  ...smallButton,
  background:
    "#2563EB",
  border:
    "1px solid #3B82F6",
  fontWeight: 700,
};

const takedownButton = {
  ...smallButton,
  background:
    "#7F1D1D",
  border:
    "1px solid #EF4444",
};

const liveButton = {
  ...smallButton,
  background:
    "#047857",
  border:
    "1px solid #10B981",
};

const dspButton = {
  ...smallButton,
  background:
    "#4338CA",
  border:
    "1px solid #6366F1",
};