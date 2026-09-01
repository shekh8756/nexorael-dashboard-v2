"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [whiteLabel, setWhiteLabel] = useState<any>(null);
  const [recentReleases, setRecentReleases] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [statsData, setStatsData] = useState({
    totalReleases: 0,
    pendingReleases: 0,
    approvedReleases: 0,
    liveReleases: 0,
    rejectedReleases: 0,
    totalUsers: 0,
    totalWhiteLabels: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    checkUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * =========================================================
   * AUTH LOGIC - SAME AS YOUR OLD WORKING VERSION
   * =========================================================
   */

  async function checkUser() {
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      router.push("/login");
      return;
    }

    const { data: userProfile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (error || !userProfile) {
      alert("Profile not found.");
      router.push("/login");
      return;
    }

    if (userProfile.status === "blocked") {
      alert("Your account is blocked.");
      await supabase.auth.signOut();
      router.push("/login");
      return;
    }

    setProfile(userProfile);

    if (userProfile.white_label_id) {
      const { data: wl } = await supabase
        .from("white_labels")
        .select("*")
        .eq("id", userProfile.white_label_id)
        .single();

      setWhiteLabel(wl || null);
    }

    await loadDashboardStats(data.user.id, userProfile);
    await loadNotificationCount(data.user.id);

    setLoading(false);
  }

  /*
   * =========================================================
   * DASHBOARD DATA - SAME OLD LOGIC
   * =========================================================
   */

  async function loadDashboardStats(userId: string, userProfile: any) {
    let releasesQuery = supabase
      .from("releases")
      .select("*")
      .order("created_at", { ascending: false });

    let royaltiesQuery = supabase.from("royalties").select("*");

    if (userProfile.role === "master_admin") {
      // Master admin sees all data
    } else if (userProfile.white_label_id) {
      releasesQuery = releasesQuery.eq(
        "white_label_id",
        userProfile.white_label_id
      );

      royaltiesQuery = royaltiesQuery.eq("user_id", userId);
    } else {
      releasesQuery = releasesQuery.eq("user_id", userId);
      royaltiesQuery = royaltiesQuery.eq("user_id", userId);
    }

    const { data: releases, error: releasesError } = await releasesQuery;
    const { data: royalties } = await royaltiesQuery;

    if (releasesError) {
      alert(releasesError.message);
      return;
    }

    const allReleases = releases || [];

    let totalUsers = 0;
    let totalWhiteLabels = 0;

    if (userProfile.role === "master_admin") {
      const { count: usersCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      const { count: whiteLabelsCount } = await supabase
        .from("white_labels")
        .select("*", { count: "exact", head: true });

      totalUsers = usersCount || 0;
      totalWhiteLabels = whiteLabelsCount || 0;
    } else if (userProfile.role === "white_label_admin") {
      const { count: usersCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("white_label_id", userProfile.white_label_id);

      totalUsers = usersCount || 0;
      totalWhiteLabels = 1;
    }

    const totalRevenue =
      royalties?.reduce(
        (sum, item) => sum + Number(item.revenue || 0),
        0
      ) || 0;

    setStatsData({
      totalReleases: allReleases.length,

      pendingReleases: allReleases.filter(
        (r) => r.status === "submitted"
      ).length,

      approvedReleases: allReleases.filter(
        (r) => r.status === "approved"
      ).length,

      liveReleases: allReleases.filter(
        (r) => r.status === "live"
      ).length,

      rejectedReleases: allReleases.filter(
        (r) => r.status === "rejected"
      ).length,

      totalUsers,
      totalWhiteLabels,
      totalRevenue,
    });

    setRecentReleases(allReleases.slice(0, 5));
  }

  async function loadNotificationCount(userId: string) {
    const { count } = await supabase
      .from("notifications")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("user_id", userId)
      .eq("is_read", false);

    setUnreadNotifications(count || 0);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function goTo(path: string) {
    router.push(path);
  }

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <main style={loadingStyle}>
        <div style={loadingLogo}>N</div>

        <div style={loader} />

        <h2 style={{ margin: "5px 0" }}>
          Loading Nexorael
        </h2>

        <p
          style={{
            color: "#64748B",
            margin: 0,
            fontSize: "13px",
          }}
        >
          Preparing your distribution dashboard...
        </p>
      </main>
    );
  }

  /*
   * =========================================================
   * DASHBOARD LABELS
   * =========================================================
   */

  const dashboardTitle =
    profile?.role === "master_admin"
      ? "Nexorael Master Dashboard"
      : profile?.role === "white_label_admin"
      ? `${
          whiteLabel?.name ||
          whiteLabel?.brand_name ||
          "White Label"
        } Dashboard`
      : "My Distribution Dashboard";

  const dashboardSubtitle =
    profile?.role === "master_admin"
      ? "Manage all users, releases, approvals, royalties and white-label operations."
      : profile?.role === "white_label_admin"
      ? "Manage your white-label users, releases and approval workflow."
      : "Manage releases, analytics, royalties and your music catalog.";

  const roleLabel =
    profile?.role === "master_admin"
      ? "Master Admin"
      : profile?.role === "white_label_admin"
      ? "White Label Admin"
      : "Label User";

  /*
   * =========================================================
   * STATS
   * =========================================================
   */

  const stats = [
    {
      title: "Total Releases",
      value: statsData.totalReleases,
      note: "Catalog releases",
      icon: "♫",
      accent: "#3B82F6",
      glow: "rgba(59,130,246,.18)",
    },

    {
      title: "Pending Review",
      value: statsData.pendingReleases,
      note: "Waiting for QC",
      icon: "◷",
      accent: "#F59E0B",
      glow: "rgba(245,158,11,.15)",
    },

    {
      title: "Approved",
      value: statsData.approvedReleases,
      note: "Ready for delivery",
      icon: "✓",
      accent: "#8B5CF6",
      glow: "rgba(139,92,246,.17)",
    },

    {
      title: "Live Releases",
      value: statsData.liveReleases,
      note: "Available on DSPs",
      icon: "◎",
      accent: "#10B981",
      glow: "rgba(16,185,129,.15)",
    },

    {
      title: "Rejected",
      value: statsData.rejectedReleases,
      note: "Needs attention",
      icon: "!",
      accent: "#F43F5E",
      glow: "rgba(244,63,94,.15)",
    },

    {
      title: "Total Revenue",
      value: `$${statsData.totalRevenue.toFixed(2)}`,
      note: "Estimated royalties",
      icon: "$",
      accent: "#06B6D4",
      glow: "rgba(6,182,212,.16)",
    },

    {
      title: "Users",
      value: statsData.totalUsers,
      note: "Managed users",
      icon: "♙",
      accent: "#A855F7",
      glow: "rgba(168,85,247,.16)",
    },

    {
      title: "White Labels",
      value: statsData.totalWhiteLabels,
      note: "Partner labels",
      icon: "◇",
      accent: "#22D3EE",
      glow: "rgba(34,211,238,.13)",
    },
  ];

  /*
   * =========================================================
   * NAVIGATION - SAME ROUTES
   * =========================================================
   */

  const navItems = [
    {
      icon: "⌂",
      label: "Dashboard",
      path: "/dashboard",
    },
    {
      icon: "♫",
      label: "Releases",
      path: "/releases",
    },
    {
      icon: "▥",
      label: "Analytics",
      path: "/analytics",
    },
    {
      icon: "$",
      label: "Royalties",
      path: "/royalties",
    },
    {
      icon: "↗",
      label: "Withdrawals",
      path: "/payments",
    },
    {
      icon: "✦",
      label: "Support",
      path: "/support",
    },
    {
      icon: "⚙",
      label: "Settings",
      path: "/settings",
    },
  ];

  const adminItems =
    profile?.role === "master_admin" ||
    profile?.role === "white_label_admin"
      ? [
          {
            icon: "♙",
            label: "Users",
            path: "/admin/users",
          },

          {
            icon: "✓",
            label: "Approvals",
            path: "/admin/releases",
          },

          {
            icon: "◉",
            label: "Support Tickets",
            path: "/admin/support",
          },

          {
            icon: "$",
            label: "Royalties",
            path: "/admin/royalties",
          },

          {
            icon: "↗",
            label: "Withdrawals",
            path: "/admin/withdrawals",
          },

          {
            icon: "▥",
            label: "Admin Analytics",
            path: "/admin/analytics",
          },

          {
            icon: "⇧",
            label: "Bulk Upload",
            path: "/admin/bulk-upload",
          },

          {
            icon: "◈",
            label: "DSP Delivery",
            path: "/admin/delivery",
          },

          {
            icon: "▤",
            label: "Contracts",
            path: "/admin/contracts",
          },

          ...(profile?.role === "master_admin"
            ? [
                {
                  icon: "◇",
                  label: "White Labels",
                  path: "/admin/white-labels",
                },
              ]
            : []),
        ]
      : [];

  /*
   * =========================================================
   * UI
   * =========================================================
   */

  return (
    <div style={pageWrapper}>
      {/* ===================================================
          SIDEBAR
      =================================================== */}

      <aside style={sidebarStyle}>
        <div>
          <div style={brandArea}>
            <div style={logoBox}>
              {whiteLabel?.name
                ? whiteLabel.name.charAt(0).toUpperCase()
                : "N"}
            </div>

            <div>
              <h2 style={brandName}>
                {whiteLabel?.name ||
                  whiteLabel?.brand_name ||
                  "NEXORAEL"}
              </h2>

              <p style={brandSubtitle}>
                Music Distribution
              </p>
            </div>
          </div>

          <div style={navList}>
            {navItems.map((item) => {
              const active =
                item.path === "/dashboard";

              return (
                <div
                  key={item.label}
                  onClick={() =>
                    goTo(item.path)
                  }
                  style={{
                    ...navItem,

                    ...(active
                      ? activeNavItem
                      : {}),
                  }}
                >
                  <span
                    style={{
                      ...navIcon,

                      color: active
                        ? "#60A5FA"
                        : "#64748B",
                    }}
                  >
                    {item.icon}
                  </span>

                  <span>
                    {item.label}
                  </span>

                  {active && (
                    <div
                      style={
                        activeIndicator
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>

          {adminItems.length > 0 && (
            <>
              <div style={divider} />

              <p style={sectionTitle}>
                ADMIN CONTROL
              </p>

              <div style={navList}>
                {adminItems.map(
                  (item) => (
                    <div
                      key={item.label}
                      onClick={() =>
                        goTo(
                          item.path
                        )
                      }
                      style={navItem}
                    >
                      <span
                        style={
                          navIcon
                        }
                      >
                        {
                          item.icon
                        }
                      </span>

                      <span>
                        {
                          item.label
                        }
                      </span>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>

        {/* SIDEBAR PROFILE */}

        <div>
          <div style={sidebarPromo}>
            <div style={promoGlow} />

            <span style={promoSmall}>
              NEXORAEL
            </span>

            <h4 style={promoTitle}>
              Your music.
              <br />
              Global stage.
            </h4>

            <p style={promoText}>
              We handle the distribution.
              You create the sound.
            </p>
          </div>

          <div style={profileBox}>
            <div style={profileAvatar}>
              {(
                profile?.full_name ||
                profile?.email ||
                "U"
              )
                .charAt(0)
                .toUpperCase()}
            </div>

            <div
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <p style={profileName}>
                {profile?.full_name ||
                  profile?.email ||
                  "User"}
              </p>

              <p style={profileRole}>
                {roleLabel}
              </p>
            </div>

            <button
              onClick={
                handleLogout
              }
              style={
                logoutIconButton
              }
              title="Logout"
            >
              ↪
            </button>
          </div>
        </div>
      </aside>

      {/* ===================================================
          MAIN
      =================================================== */}

      <main style={mainStyle}>
        {/* HEADER */}

        <div style={headerStyle}>
          <div>
            <div style={headerBadge}>
              MUSIC DISTRIBUTION
            </div>

            <h1 style={dashboardHeading}>
              {dashboardTitle}
            </h1>

            <p style={dashboardDescription}>
              {dashboardSubtitle}
            </p>
          </div>

          <div style={headerButtons}>
            <button
              onClick={() =>
                router.push(
                  "/notifications"
                )
              }
              style={
                notificationButton
              }
            >
              <span style={{ fontSize: 15 }}>
                ♢
              </span>

              Notifications

              {unreadNotifications >
                0 && (
                <span style={notificationBadge}>
                  {
                    unreadNotifications
                  }
                </span>
              )}
            </button>

            <button
              onClick={() =>
                router.push(
                  "/releases/new"
                )
              }
              style={newReleaseButton}
            >
              ＋ New Release
            </button>
          </div>
        </div>

        {/* ===================================================
            HERO
        =================================================== */}

        <section style={heroCard}>
          <div style={heroGlowBlue} />
          <div style={heroGlowPurple} />

          <div style={heroContent}>
            <span style={heroMiniBadge}>
              NEXORAEL MUSIC
            </span>

            <h2 style={heroTitle}>
              Your music.
              <br />

              <span style={heroGradientText}>
                Everywhere.
              </span>
            </h2>

            <p style={heroDescription}>
              Release, manage and monitor
              your entire music catalog
              from one powerful
              distribution workspace.
            </p>

            <div style={heroButtons}>
              <button
                onClick={() =>
                  router.push(
                    "/releases/new"
                  )
                }
                style={heroPrimaryButton}
              >
                Upload Release
                <span>
                  →
                </span>
              </button>

              <button
                onClick={() =>
                  router.push(
                    "/releases"
                  )
                }
                style={heroSecondaryButton}
              >
                View Catalog
              </button>
            </div>
          </div>

          <div style={heroVisual}>
            <div style={recordDisc}>
              <div style={recordInner}>
                <div style={recordCenter}>
                  N
                </div>
              </div>
            </div>

            <div style={floatingStatOne}>
              <span style={floatingLabel}>
                RELEASES
              </span>

              <strong style={floatingValue}>
                {
                  statsData.totalReleases
                }
              </strong>

              <span style={floatingText}>
                Total Catalog
              </span>
            </div>

            <div style={floatingStatTwo}>
              <span style={floatingLabel}>
                LIVE
              </span>

              <strong style={floatingValue}>
                {
                  statsData.liveReleases
                }
              </strong>

              <span style={floatingText}>
                On DSPs
              </span>
            </div>
          </div>
        </section>

        {/* ===================================================
            STATS
        =================================================== */}

        <div style={statsGrid}>
          {stats.map(
            (stat) => (
              <div
                key={
                  stat.title
                }
                style={{
                  ...statCard,

                  boxShadow: `0 15px 40px ${stat.glow}`,
                }}
              >
                <div style={statTop}>
                  <p style={statTitle}>
                    {stat.title}
                  </p>

                  <div
                    style={{
                      ...statIcon,

                      color:
                        stat.accent,

                      background:
                        `${stat.accent}18`,

                      border:
                        `1px solid ${stat.accent}25`,
                    }}
                  >
                    {stat.icon}
                  </div>
                </div>

                <h2 style={statValue}>
                  {stat.value}
                </h2>

                <p style={statNote}>
                  {stat.note}
                </p>

                <div
                  style={{
                    ...statAccent,

                    background:
                      stat.accent,
                  }}
                />
              </div>
            )
          )}
        </div>

        {/* ===================================================
            CONTENT
        =================================================== */}

        <div style={contentGrid}>
          {/* RECENT RELEASES */}

          <section style={panelStyle}>
            <div style={panelHeader}>
              <div>
                <p style={panelEyebrow}>
                  CATALOG
                </p>

                <h2 style={panelTitle}>
                  Recent Releases
                </h2>

                <p style={panelDescription}>
                  Your latest submitted
                  music catalog.
                </p>
              </div>

              <button
                onClick={() =>
                  router.push(
                    "/releases"
                  )
                }
                style={viewAllButton}
              >
                View all →
              </button>
            </div>

            <div style={tableWrapper}>
              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                }}
              >
                <thead>
                  <tr style={tableHeaderRow}>
                    <th style={thStyle}>
                      RELEASE
                    </th>

                    <th style={thStyle}>
                      ARTIST
                    </th>

                    <th style={thStyle}>
                      UPC
                    </th>

                    <th style={thStyle}>
                      STATUS
                    </th>

                    <th style={thStyle}>
                      ACTION
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {recentReleases.length ===
                  0 ? (
                    <tr>
                      <td
                        style={emptyTableCell}
                        colSpan={5}
                      >
                        <div style={emptyMusicIcon}>
                          ♫
                        </div>

                        <h3
                          style={{
                            margin:
                              "10px 0 4px",
                          }}
                        >
                          No releases yet
                        </h3>

                        <p
                          style={{
                            color:
                              "#64748B",
                            margin:
                              "0 0 14px",
                          }}
                        >
                          Upload your first
                          release to begin
                          distribution.
                        </p>

                        <button
                          onClick={() =>
                            router.push(
                              "/releases/new"
                            )
                          }
                          style={
                            newReleaseButton
                          }
                        >
                          ＋ New Release
                        </button>
                      </td>
                    </tr>
                  ) : (
                    recentReleases.map(
                      (release) => {
                        const artwork =
                          release.artwork_url ||
                          release.cover_url;

                        const releaseStatus =
                          String(
                            release.status ||
                              "draft"
                          ).toLowerCase();

                        return (
                          <tr
                            key={
                              release.id
                            }
                            style={
                              tableRow
                            }
                          >
                            <td style={tdStyle}>
                              <div style={releaseCell}>
                                {artwork ? (
                                  <img
                                    src={
                                      artwork
                                    }
                                    alt="Artwork"
                                    style={
                                      artworkThumb
                                    }
                                  />
                                ) : (
                                  <div style={emptyArtwork}>
                                    ♫
                                  </div>
                                )}

                                <div>
                                  <p style={releaseTitle}>
                                    {release.title ||
                                      "Untitled Release"}
                                  </p>

                                  <p style={releaseTypeText}>
                                    Digital Release
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td style={tdStyle}>
                              <span style={normalCellText}>
                                {release.artist_name ||
                                  "-"}
                              </span>
                            </td>

                            <td style={tdStyle}>
                              <span style={upcStyle}>
                                {release.upc ||
                                  "Auto"}
                              </span>
                            </td>

                            <td style={tdStyle}>
                              <span
                                style={{
                                  ...statusStyle,

                                  ...(releaseStatus ===
                                  "live"
                                    ? liveStatus
                                    : releaseStatus ===
                                      "approved"
                                    ? approvedStatus
                                    : releaseStatus ===
                                      "submitted"
                                    ? pendingStatus
                                    : releaseStatus ===
                                      "rejected"
                                    ? rejectedStatus
                                    : draftStatus),
                                }}
                              >
                                <span
                                  style={{
                                    ...statusDot,

                                    background:
                                      releaseStatus ===
                                      "live"
                                        ? "#10B981"
                                        : releaseStatus ===
                                          "approved"
                                        ? "#8B5CF6"
                                        : releaseStatus ===
                                          "submitted"
                                        ? "#F59E0B"
                                        : releaseStatus ===
                                          "rejected"
                                        ? "#F43F5E"
                                        : "#94A3B8",
                                  }}
                                />

                                {release.status ||
                                  "draft"}
                              </span>
                            </td>

                            <td style={tdStyle}>
                              <button
                                onClick={() =>
                                  router.push(
                                    `/releases/${release.id}`
                                  )
                                }
                                style={viewButton}
                              >
                                View
                                <span>
                                  →
                                </span>
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* RIGHT SIDE */}

          <div style={rightColumn}>
            {/* ANALYTICS */}

            <section style={smallPanel}>
              <div style={smallPanelHeader}>
                <div>
                  <p style={panelEyebrow}>
                    PERFORMANCE
                  </p>

                  <h3 style={smallPanelTitle}>
                    Catalog Overview
                  </h3>
                </div>

                <div style={analyticsIcon}>
                  ▥
                </div>
              </div>

              <div style={analyticsBigBox}>
                <p style={analyticsLabel}>
                  Total Revenue
                </p>

                <h2 style={analyticsRevenue}>
                  $
                  {statsData.totalRevenue.toFixed(
                    2
                  )}
                </h2>

                <div style={fakeChart}>
                  <div
                    style={{
                      ...fakeBar,
                      height: "22%",
                    }}
                  />

                  <div
                    style={{
                      ...fakeBar,
                      height: "42%",
                    }}
                  />

                  <div
                    style={{
                      ...fakeBar,
                      height: "34%",
                    }}
                  />

                  <div
                    style={{
                      ...fakeBar,
                      height: "58%",
                    }}
                  />

                  <div
                    style={{
                      ...fakeBar,
                      height: "45%",
                    }}
                  />

                  <div
                    style={{
                      ...fakeBar,
                      height: "68%",
                    }}
                  />

                  <div
                    style={{
                      ...fakeBar,
                      height: "84%",
                    }}
                  />
                </div>
              </div>

              <div style={overviewRows}>
                <OverviewRow
                  title="Total Releases"
                  value={
                    statsData.totalReleases
                  }
                  color="#3B82F6"
                />

                <OverviewRow
                  title="Pending Review"
                  value={
                    statsData.pendingReleases
                  }
                  color="#F59E0B"
                />

                <OverviewRow
                  title="Approved"
                  value={
                    statsData.approvedReleases
                  }
                  color="#8B5CF6"
                />

                <OverviewRow
                  title="Live Releases"
                  value={
                    statsData.liveReleases
                  }
                  color="#10B981"
                />
              </div>

              <button
                onClick={() =>
                  router.push(
                    "/analytics"
                  )
                }
                style={fullWidthButton}
              >
                View Analytics →
              </button>
            </section>

            {/* QUICK ACTION */}

            <section style={quickActionPanel}>
              <div style={quickActionGlow} />

              <p style={panelEyebrow}>
                QUICK ACTION
              </p>

              <h3 style={quickTitle}>
                Ready for your
                <br />
                next release?
              </h3>

              <p style={quickDescription}>
                Upload your master,
                artwork and metadata to
                start distribution.
              </p>

              <button
                onClick={() =>
                  router.push(
                    "/releases/new"
                  )
                }
                style={quickButton}
              >
                Upload Music →
              </button>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

/*
 * =========================================================
 * SMALL COMPONENT
 * =========================================================
 */

function OverviewRow({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <div style={overviewRow}>
      <div style={overviewTitle}>
        <span
          style={{
            ...overviewDot,
            background: color,
            boxShadow: `0 0 10px ${color}`,
          }}
        />

        {title}
      </div>

      <strong style={overviewValue}>
        {value}
      </strong>
    </div>
  );
}

/*
 * =========================================================
 * STYLES
 * =========================================================
 */

const loadingStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 50% 20%, rgba(37,99,235,.15), transparent 35%), #050816",

  color: "white",

  display: "flex",

  flexDirection:
    "column" as const,

  alignItems:
    "center",

  justifyContent:
    "center",

  fontFamily:
    "Inter, Arial, sans-serif",
};

const loadingLogo = {
  width: "58px",
  height: "58px",

  borderRadius: "18px",

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",

  background:
    "linear-gradient(135deg,#2563EB,#7C3AED)",

  fontWeight: 900,

  fontSize: "25px",

  boxShadow:
    "0 20px 60px rgba(37,99,235,.35)",

  marginBottom: "20px",
};

const loader = {
  width: "27px",
  height: "27px",

  borderRadius: "50%",

  border:
    "2px solid rgba(96,165,250,.18)",

  borderTopColor:
    "#60A5FA",

  marginBottom: "12px",
};

const pageWrapper = {
  display: "flex",

  minHeight: "100vh",

  background:
    "radial-gradient(circle at 80% 0%, rgba(37,99,235,.07), transparent 30%), radial-gradient(circle at 30% 100%, rgba(124,58,237,.06), transparent 30%), #050816",

  color: "white",

  fontFamily:
    "Inter, Arial, sans-serif",
};

const sidebarStyle = {
  width: "252px",

  minWidth: "252px",

  minHeight: "100vh",

  background:
    "linear-gradient(180deg,#0A1222 0%,#07101D 100%)",

  padding: "22px 16px",

  borderRight:
    "1px solid rgba(148,163,184,.10)",

  display: "flex",

  flexDirection:
    "column" as const,

  justifyContent:
    "space-between",

  position:
    "sticky" as const,

  top: 0,

  height: "100vh",

  overflowY:
    "auto" as const,
};

const brandArea = {
  display: "flex",

  alignItems: "center",

  gap: "12px",

  padding:
    "3px 5px 23px",
};

const logoBox = {
  width: "45px",

  height: "45px",

  borderRadius: "14px",

  background:
    "linear-gradient(135deg,#2563EB,#7C3AED)",

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",

  fontWeight: 900,

  fontSize: "21px",

  boxShadow:
    "0 12px 30px rgba(37,99,235,.32)",
};

const brandName = {
  fontSize: "19px",

  fontWeight: 900,

  margin: 0,

  letterSpacing:
    ".3px",
};

const brandSubtitle = {
  color: "#64748B",

  fontSize: "10px",

  margin: "3px 0 0",
};

const navList = {
  display: "flex",

  flexDirection:
    "column" as const,

  gap: "5px",
};

const navItem = {
  position:
    "relative" as const,

  minHeight: "44px",

  padding:
    "0 12px",

  borderRadius: "11px",

  color: "#94A3B8",

  cursor: "pointer",

  display: "flex",

  alignItems: "center",

  gap: "12px",

  fontWeight: 600,

  fontSize: "12px",

  border:
    "1px solid transparent",
};

const activeNavItem = {
  background:
    "linear-gradient(90deg,rgba(37,99,235,.24),rgba(79,70,229,.12))",

  border:
    "1px solid rgba(96,165,250,.20)",

  color: "#F8FAFC",

  boxShadow:
    "0 8px 30px rgba(37,99,235,.10)",
};

const navIcon = {
  width: "22px",

  textAlign:
    "center" as const,

  fontSize: "16px",

  color: "#64748B",
};

const activeIndicator = {
  position:
    "absolute" as const,

  left: "-17px",

  width: "3px",

  height: "24px",

  borderRadius:
    "0 4px 4px 0",

  background:
    "#3B82F6",

  boxShadow:
    "0 0 12px #3B82F6",
};

const divider = {
  height: "1px",

  background:
    "rgba(148,163,184,.09)",

  margin: "20px 4px",
};

const sectionTitle = {
  color: "#475569",

  fontSize: "9px",

  fontWeight: 800,

  letterSpacing:
    "1.3px",

  margin:
    "0 10px 10px",
};

const sidebarPromo = {
  position:
    "relative" as const,

  overflow:
    "hidden" as const,

  border:
    "1px solid rgba(96,165,250,.16)",

  borderRadius: "15px",

  padding: "16px",

  marginBottom: "15px",

  background:
    "linear-gradient(145deg,rgba(37,99,235,.12),rgba(124,58,237,.08))",
};

const promoGlow = {
  position:
    "absolute" as const,

  right: "-30px",

  bottom: "-30px",

  width: "90px",

  height: "90px",

  borderRadius:
    "50%",

  background:
    "rgba(124,58,237,.25)",

  filter: "blur(30px)",
};

const promoSmall = {
  color: "#60A5FA",

  fontSize: "9px",

  fontWeight: 800,

  letterSpacing:
    "1px",
};

const promoTitle = {
  position:
    "relative" as const,

  margin:
    "8px 0 6px",

  fontSize: "13px",

  lineHeight: 1.4,
};

const promoText = {
  position:
    "relative" as const,

  margin: 0,

  color: "#64748B",

  fontSize: "9px",

  lineHeight: 1.5,
};

const profileBox = {
  display: "flex",

  alignItems: "center",

  gap: "10px",

  padding:
    "14px 6px 0",

  borderTop:
    "1px solid rgba(148,163,184,.09)",
};

const profileAvatar = {
  width: "35px",

  height: "35px",

  borderRadius: "11px",

  background:
    "linear-gradient(135deg,#1D4ED8,#7C3AED)",

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",

  fontWeight: 900,

  fontSize: "13px",
};

const profileName = {
  margin: 0,

  fontWeight: 700,

  fontSize: "10px",

  whiteSpace:
    "nowrap" as const,

  overflow:
    "hidden" as const,

  textOverflow:
    "ellipsis",
};

const profileRole = {
  margin: "3px 0 0",

  color: "#64748B",

  fontSize: "9px",
};

const logoutIconButton = {
  width: "31px",

  height: "31px",

  borderRadius: "9px",

  border:
    "1px solid rgba(148,163,184,.10)",

  background:
    "#111827",

  color: "#94A3B8",

  cursor: "pointer",
};

const mainStyle = {
  flex: 1,

  minWidth: 0,

  padding:
    "26px 30px 55px",
};

const headerStyle = {
  display: "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap: "20px",

  marginBottom: "22px",
};

const headerBadge = {
  color: "#3B82F6",

  fontSize: "9px",

  fontWeight: 800,

  letterSpacing:
    "1.5px",

  marginBottom: "6px",
};

const dashboardHeading = {
  fontSize: "29px",

  lineHeight: 1.15,

  letterSpacing:
    "-.7px",

  fontWeight: 800,

  margin: 0,
};

const dashboardDescription = {
  color: "#64748B",

  margin: "7px 0 0",

  fontSize: "12px",
};

const headerButtons = {
  display: "flex",

  alignItems: "center",

  gap: "10px",
};

const notificationButton = {
  minHeight: "42px",

  padding: "0 14px",

  borderRadius: "11px",

  border:
    "1px solid rgba(148,163,184,.12)",

  background:
    "rgba(15,23,42,.75)",

  color: "#CBD5E1",

  cursor: "pointer",

  fontWeight: 700,

  display: "flex",

  alignItems: "center",

  gap: "8px",
};

const notificationBadge = {
  minWidth: "19px",

  height: "19px",

  padding: "0 5px",

  borderRadius:
    "999px",

  background:
    "#7C3AED",

  color: "white",

  display: "inline-flex",

  alignItems: "center",

  justifyContent:
    "center",

  fontSize: "9px",
};

const newReleaseButton = {
  minHeight: "42px",

  padding: "0 16px",

  borderRadius: "11px",

  border: "none",

  background:
    "linear-gradient(135deg,#2563EB,#4F46E5)",

  color: "white",

  cursor: "pointer",

  fontWeight: 800,

  boxShadow:
    "0 10px 28px rgba(37,99,235,.25)",
};

const heroCard = {
  minHeight: "280px",

  position:
    "relative" as const,

  overflow:
    "hidden" as const,

  borderRadius: "23px",

  padding: "36px 40px",

  display: "flex",

  alignItems: "center",

  border:
    "1px solid rgba(96,165,250,.15)",

  background:
    "linear-gradient(115deg,rgba(14,23,41,.98),rgba(11,21,47,.96) 55%,rgba(30,19,61,.94))",

  boxShadow:
    "0 25px 80px rgba(0,0,0,.20)",
};

const heroGlowBlue = {
  position:
    "absolute" as const,

  width: "260px",

  height: "260px",

  right: "130px",

  top: "-130px",

  borderRadius:
    "50%",

  background:
    "rgba(37,99,235,.30)",

  filter: "blur(70px)",
};

const heroGlowPurple = {
  position:
    "absolute" as const,

  width: "230px",

  height: "230px",

  right: "-80px",

  bottom: "-110px",

  borderRadius:
    "50%",

  background:
    "rgba(124,58,237,.30)",

  filter: "blur(65px)",
};

const heroContent = {
  width: "55%",

  position:
    "relative" as const,

  zIndex: 2,
};

const heroMiniBadge = {
  display:
    "inline-flex",

  color: "#60A5FA",

  border:
    "1px solid rgba(96,165,250,.20)",

  background:
    "rgba(37,99,235,.08)",

  padding: "6px 10px",

  borderRadius:
    "999px",

  fontSize: "9px",

  fontWeight: 800,

  letterSpacing:
    "1.2px",
};

const heroTitle = {
  margin:
    "14px 0 8px",

  fontSize: "46px",

  lineHeight: 1.04,

  letterSpacing:
    "-2px",

  fontWeight: 850,
};

const heroGradientText = {
  background:
    "linear-gradient(90deg,#60A5FA,#A78BFA)",

  WebkitBackgroundClip:
    "text",

  WebkitTextFillColor:
    "transparent",
};

const heroDescription = {
  maxWidth: "500px",

  color: "#8290A5",

  lineHeight: 1.65,

  fontSize: "12px",

  margin: 0,
};

const heroButtons = {
  display: "flex",

  gap: "10px",

  marginTop: "20px",
};

const heroPrimaryButton = {
  minHeight: "42px",

  padding: "0 16px",

  display: "flex",

  alignItems: "center",

  gap: "13px",

  border: "none",

  borderRadius: "10px",

  color: "white",

  fontWeight: 800,

  cursor: "pointer",

  background:
    "linear-gradient(135deg,#2563EB,#4F46E5)",
};

const heroSecondaryButton = {
  minHeight: "42px",

  padding: "0 16px",

  borderRadius: "10px",

  color: "#CBD5E1",

  fontWeight: 700,

  cursor: "pointer",

  background:
    "rgba(15,23,42,.60)",

  border:
    "1px solid rgba(148,163,184,.13)",
};

const heroVisual = {
  flex: 1,

  height: "210px",

  position:
    "relative" as const,
};

const recordDisc = {
  position:
    "absolute" as const,

  width: "190px",

  height: "190px",

  right: "80px",

  top: "5px",

  borderRadius:
    "50%",

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",

  background:
    "repeating-radial-gradient(circle,#111827 0px,#111827 5px,#172036 6px,#172036 7px)",

  boxShadow:
    "0 30px 70px rgba(0,0,0,.45)",
};

const recordInner = {
  width: "64px",

  height: "64px",

  borderRadius:
    "50%",

  background:
    "linear-gradient(135deg,#2563EB,#7C3AED)",

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",
};

const recordCenter = {
  width: "27px",

  height: "27px",

  borderRadius:
    "50%",

  background: "#080D19",

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",

  fontSize: "9px",

  fontWeight: 900,
};

const floatingBase = {
  position:
    "absolute" as const,

  minWidth: "115px",

  padding: "11px 13px",

  borderRadius: "13px",

  border:
    "1px solid rgba(255,255,255,.08)",

  background:
    "rgba(8,15,30,.78)",

  boxShadow:
    "0 15px 40px rgba(0,0,0,.25)",
};

const floatingStatOne = {
  ...floatingBase,

  right: "245px",

  bottom: "0",
};

const floatingStatTwo = {
  ...floatingBase,

  right: "0",

  top: "10px",
};

const floatingLabel = {
  display: "block",

  color: "#64748B",

  fontSize: "8px",

  fontWeight: 800,

  letterSpacing:
    "1px",
};

const floatingValue = {
  display: "block",

  fontSize: "22px",

  margin: "4px 0 1px",
};

const floatingText = {
  color: "#64748B",

  fontSize: "8px",
};

const statsGrid = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(160px,1fr))",

  gap: "13px",

  marginTop: "18px",
};

const statCard = {
  minHeight: "130px",

  position:
    "relative" as const,

  overflow:
    "hidden" as const,

  background:
    "linear-gradient(145deg,rgba(17,25,44,.95),rgba(10,16,30,.97))",

  padding: "16px",

  borderRadius: "16px",

  border:
    "1px solid rgba(148,163,184,.10)",
};

const statTop = {
  display: "flex",

  alignItems: "center",

  justifyContent:
    "space-between",

  gap: "10px",
};

const statTitle = {
  color: "#8896AA",

  margin: 0,

  fontSize: "10px",

  fontWeight: 650,
};

const statIcon = {
  width: "32px",

  height: "32px",

  borderRadius: "10px",

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",

  fontWeight: 800,
};

const statValue = {
  fontSize: "27px",

  margin: "10px 0 4px",

  fontWeight: 800,
};

const statNote = {
  color: "#526177",

  fontSize: "9px",

  margin: 0,
};

const statAccent = {
  position:
    "absolute" as const,

  top: 0,

  left: "16px",

  right: "16px",

  height: "1px",

  opacity: 0.7,
};

const contentGrid = {
  display: "grid",

  gridTemplateColumns:
    "minmax(0,2.2fr) minmax(280px,.8fr)",

  gap: "18px",

  marginTop: "18px",
};

const panelStyle = {
  background:
    "linear-gradient(145deg,rgba(17,25,44,.94),rgba(9,15,28,.97))",

  borderRadius: "18px",

  border:
    "1px solid rgba(148,163,184,.10)",

  overflow:
    "hidden" as const,

  minHeight: "440px",

  boxShadow:
    "0 18px 60px rgba(0,0,0,.13)",
};

const panelHeader = {
  padding: "21px 22px",

  display: "flex",

  justifyContent:
    "space-between",

  alignItems: "center",

  borderBottom:
    "1px solid rgba(148,163,184,.08)",
};

const panelEyebrow = {
  margin: 0,

  color: "#3B82F6",

  fontSize: "8px",

  fontWeight: 900,

  letterSpacing:
    "1.4px",
};

const panelTitle = {
  margin: "4px 0",

  fontSize: "17px",
};

const panelDescription = {
  color: "#64748B",

  fontSize: "9px",

  margin: 0,
};

const viewAllButton = {
  border: "none",

  background:
    "transparent",

  color: "#60A5FA",

  cursor: "pointer",

  fontWeight: 700,

  fontSize: "10px",
};

const tableWrapper = {
  padding:
    "0 18px 18px",

  overflowX:
    "auto" as const,
};

const tableHeaderRow = {
  color: "#64748B",

  fontSize: "9px",

  letterSpacing:
    ".7px",
};

const thStyle = {
  padding:
    "15px 9px",

  textAlign:
    "left" as const,

  borderBottom:
    "1px solid rgba(148,163,184,.08)",

  fontWeight: 700,
};

const tableRow = {
  borderBottom:
    "1px solid rgba(148,163,184,.065)",
};

const tdStyle = {
  padding:
    "13px 9px",
};

const releaseCell = {
  display: "flex",

  alignItems: "center",

  gap: "11px",
};

const artworkThumb = {
  width: "46px",

  height: "46px",

  borderRadius: "11px",

  objectFit:
    "cover" as const,

  boxShadow:
    "0 7px 20px rgba(0,0,0,.25)",
};

const emptyArtwork = {
  width: "46px",

  height: "46px",

  borderRadius: "11px",

  background:
    "linear-gradient(135deg,#1D4ED8,#7C3AED)",

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",
};

const releaseTitle = {
  margin: 0,

  fontSize: "11px",

  fontWeight: 700,

  color: "#F1F5F9",
};

const releaseTypeText = {
  color: "#526177",

  fontSize: "8px",

  margin: "4px 0 0",
};

const normalCellText = {
  color: "#CBD5E1",

  fontSize: "10px",
};

const upcStyle = {
  color: "#94A3B8",

  fontSize: "9px",

  fontFamily:
    "monospace",
};

const statusStyle = {
  display:
    "inline-flex",

  alignItems: "center",

  gap: "6px",

  padding: "5px 9px",

  borderRadius:
    "999px",

  fontSize: "8px",

  textTransform:
    "capitalize" as const,

  fontWeight: 750,
};

const statusDot = {
  width: "5px",

  height: "5px",

  borderRadius:
    "50%",
};

const liveStatus = {
  color: "#34D399",

  background:
    "rgba(16,185,129,.10)",

  border:
    "1px solid rgba(16,185,129,.15)",
};

const approvedStatus = {
  color: "#A78BFA",

  background:
    "rgba(139,92,246,.10)",

  border:
    "1px solid rgba(139,92,246,.15)",
};

const pendingStatus = {
  color: "#FBBF24",

  background:
    "rgba(245,158,11,.10)",

  border:
    "1px solid rgba(245,158,11,.15)",
};

const rejectedStatus = {
  color: "#FB7185",

  background:
    "rgba(244,63,94,.10)",

  border:
    "1px solid rgba(244,63,94,.15)",
};

const draftStatus = {
  color: "#94A3B8",

  background:
    "rgba(148,163,184,.08)",

  border:
    "1px solid rgba(148,163,184,.10)",
};

const viewButton = {
  minHeight: "31px",

  padding: "0 10px",

  borderRadius: "8px",

  border:
    "1px solid rgba(59,130,246,.22)",

  background:
    "rgba(37,99,235,.10)",

  color: "#60A5FA",

  cursor: "pointer",

  fontSize: "9px",

  fontWeight: 700,

  display:
    "inline-flex",

  alignItems: "center",

  gap: "7px",
};

const emptyTableCell = {
  height: "300px",

  textAlign:
    "center" as const,
};

const emptyMusicIcon = {
  width: "50px",

  height: "50px",

  borderRadius: "14px",

  margin: "0 auto",

  background:
    "rgba(37,99,235,.10)",

  color: "#60A5FA",

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",

  fontSize: "18px",
};

const rightColumn = {
  display: "flex",

  flexDirection:
    "column" as const,

  gap: "18px",
};

const smallPanel = {
  background:
    "linear-gradient(145deg,rgba(17,25,44,.94),rgba(9,15,28,.97))",

  border:
    "1px solid rgba(148,163,184,.10)",

  borderRadius: "18px",

  padding: "20px",

  boxShadow:
    "0 18px 60px rgba(0,0,0,.13)",
};

const smallPanelHeader = {
  display: "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",
};

const smallPanelTitle = {
  margin: "4px 0 0",

  fontSize: "15px",
};

const analyticsIcon = {
  width: "35px",

  height: "35px",

  borderRadius: "10px",

  background:
    "rgba(37,99,235,.10)",

  color: "#60A5FA",

  display: "flex",

  alignItems: "center",

  justifyContent:
    "center",
};

const analyticsBigBox = {
  marginTop: "17px",

  padding:
    "15px 15px 10px",

  borderRadius: "13px",

  background:
    "rgba(6,11,22,.55)",

  border:
    "1px solid rgba(148,163,184,.08)",
};

const analyticsLabel = {
  margin: 0,

  color: "#64748B",

  fontSize: "9px",
};

const analyticsRevenue = {
  margin: "5px 0 12px",

  fontSize: "24px",
};

const fakeChart = {
  height: "55px",

  display: "flex",

  alignItems: "flex-end",

  gap: "6px",
};

const fakeBar = {
  flex: 1,

  minHeight: "7px",

  borderRadius:
    "4px 4px 1px 1px",

  background:
    "linear-gradient(180deg,#3B82F6,#4F46E5)",

  opacity: 0.85,
};

const overviewRows = {
  marginTop: "12px",
};

const overviewRow = {
  display: "flex",

  alignItems: "center",

  justifyContent:
    "space-between",

  minHeight: "39px",

  borderBottom:
    "1px solid rgba(148,163,184,.065)",

  color: "#94A3B8",

  fontSize: "9px",
};

const overviewTitle = {
  display: "flex",

  alignItems: "center",

  gap: "8px",
};

const overviewDot = {
  width: "6px",

  height: "6px",

  borderRadius:
    "50%",
};

const overviewValue = {
  color: "#F8FAFC",

  fontSize: "11px",
};

const fullWidthButton = {
  width: "100%",

  minHeight: "38px",

  marginTop: "15px",

  borderRadius: "9px",

  border:
    "1px solid rgba(59,130,246,.18)",

  background:
    "rgba(37,99,235,.07)",

  color: "#60A5FA",

  fontWeight: 700,

  cursor: "pointer",

  fontSize: "9px",
};

const quickActionPanel = {
  position:
    "relative" as const,

  overflow:
    "hidden" as const,

  padding: "21px",

  borderRadius: "18px",

  border:
    "1px solid rgba(139,92,246,.18)",

  background:
    "linear-gradient(145deg,rgba(42,25,83,.38),rgba(13,19,36,.97))",
};

const quickActionGlow = {
  position:
    "absolute" as const,

  right: "-50px",

  bottom: "-70px",

  width: "150px",

  height: "150px",

  borderRadius:
    "50%",

  background:
    "rgba(124,58,237,.25)",

  filter: "blur(45px)",
};

const quickTitle = {
  position:
    "relative" as const,

  margin:
    "9px 0 8px",

  fontSize: "20px",

  lineHeight: 1.2,
};

const quickDescription = {
  position:
    "relative" as const,

  color: "#718096",

  fontSize: "9px",

  lineHeight: 1.6,

  maxWidth: "220px",
};

const quickButton = {
  position:
    "relative" as const,

  minHeight: "37px",

  marginTop: "10px",

  padding: "0 13px",

  borderRadius: "9px",

  border: "none",

  color: "white",

  background:
    "linear-gradient(135deg,#7C3AED,#4F46E5)",

  fontWeight: 700,

  cursor: "pointer",

  fontSize: "9px",
};