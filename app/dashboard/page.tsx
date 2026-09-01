"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  supabase,
} from "../../lib/supabase";

type Release = {
  id: string;
  title?: string | null;
  artist_name?: string | null;
  artwork_url?: string | null;
  cover_url?: string | null;
  upc?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export default function DashboardPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    releases,
    setReleases,
  ] =
    useState<Release[]>([]);

  const [
    userName,
    setUserName,
  ] =
    useState("Artist");

  const [
    sidebarOpen,
    setSidebarOpen,
  ] =
    useState(true);

  /*
   * =========================================
   * LOAD DASHBOARD
   * =========================================
   */

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);

      const {
        data: userData,
      } =
        await supabase.auth.getUser();

      const user =
        userData?.user;

      if (!user) {
        router.push(
          "/login"
        );

        return;
      }

      /*
       * PROFILE
       */

      const {
        data: profile,
      } =
        await supabase
          .from("profiles")
          .select(
            "full_name,email"
          )
          .eq(
            "id",
            user.id
          )
          .maybeSingle();

      setUserName(
        profile?.full_name ||
          profile?.email ||
          user.email ||
          "Artist"
      );

      /*
       * RELEASES
       */

      const {
        data,
        error,
      } =
        await supabase
          .from("releases")
          .select(
            "id,title,artist_name,artwork_url,cover_url,upc,status,created_at"
          )
          .eq(
            "user_id",
            user.id
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            }
          );

      if (error) {
        console.error(
          "Dashboard releases error:",
          error
        );
      }

      setReleases(
        data || []
      );
    } catch (error) {
      console.error(
        "Dashboard error:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * =========================================
   * STATISTICS
   * =========================================
   */

  const stats =
    useMemo(() => {
      function status(
        value:
          string | null |
          undefined
      ) {
        return String(
          value || ""
        )
          .toLowerCase()
          .replace(
            /[\s-]+/g,
            "_"
          );
      }

      const pending =
        releases.filter(
          (release) =>
            [
              "pending",
              "pending_review",
              "under_review",
              "submitted",
              "processing",
            ].includes(
              status(
                release.status
              )
            )
        ).length;

      const approved =
        releases.filter(
          (release) =>
            status(
              release.status
            ) ===
            "approved"
        ).length;

      const live =
        releases.filter(
          (release) =>
            [
              "live",
              "delivered",
            ].includes(
              status(
                release.status
              )
            )
        ).length;

      const rejected =
        releases.filter(
          (release) =>
            [
              "rejected",
              "failed",
            ].includes(
              status(
                release.status
              )
            )
        ).length;

      return {
        total:
          releases.length,

        pending,
        approved,
        live,
        rejected,
      };
    }, [
      releases,
    ]);

  /*
   * =========================================
   * STATUS
   * =========================================
   */

  function getStatusClass(
    value?: string | null
  ) {
    const status =
      String(
        value || "draft"
      )
        .toLowerCase();

    if (
      status.includes(
        "live"
      )
    ) {
      return "status live";
    }

    if (
      status.includes(
        "reject"
      ) ||
      status.includes(
        "failed"
      )
    ) {
      return "status rejected";
    }

    if (
      status.includes(
        "approve"
      )
    ) {
      return "status approved";
    }

    if (
      status.includes(
        "pending"
      ) ||
      status.includes(
        "review"
      ) ||
      status.includes(
        "submit"
      )
    ) {
      return "status pending";
    }

    return "status draft";
  }

  return (
    <div className="app">
      {/* ======================================
          SIDEBAR
      ====================================== */}

      <aside
        className={
          sidebarOpen
            ? "sidebar"
            : "sidebar collapsed"
        }
      >
        <div className="brand">
          <div className="brandIcon">
            N
          </div>

          {sidebarOpen && (
            <div>
              <div className="brandName">
                NEXORAEL
              </div>

              <div className="brandSub">
                Music Distribution
              </div>
            </div>
          )}
        </div>

        <nav className="nav">
          <NavItem
            icon="⌂"
            label="Dashboard"
            active
            collapsed={
              !sidebarOpen
            }
            onClick={() =>
              router.push(
                "/dashboard"
              )
            }
          />

          <NavItem
            icon="♫"
            label="Releases"
            collapsed={
              !sidebarOpen
            }
            onClick={() =>
              router.push(
                "/releases"
              )
            }
          />

          <NavItem
            icon="▥"
            label="Analytics"
            collapsed={
              !sidebarOpen
            }
            onClick={() =>
              router.push(
                "/analytics"
              )
            }
          />

          <NavItem
            icon="◉"
            label="Royalties"
            collapsed={
              !sidebarOpen
            }
            onClick={() =>
              router.push(
                "/royalties"
              )
            }
          />

          <NavItem
            icon="↗"
            label="Withdrawals"
            collapsed={
              !sidebarOpen
            }
            onClick={() =>
              router.push(
                "/withdrawals"
              )
            }
          />

          <NavItem
            icon="✦"
            label="Support"
            collapsed={
              !sidebarOpen
            }
            onClick={() =>
              router.push(
                "/support"
              )
            }
          />

          <div className="navDivider" />

          <NavItem
            icon="⚙"
            label="Settings"
            collapsed={
              !sidebarOpen
            }
            onClick={() =>
              router.push(
                "/settings"
              )
            }
          />
        </nav>

        {sidebarOpen && (
          <div className="sidebarCard">
            <div className="sidebarGlow" />

            <span>
              NEXORAEL
            </span>

            <strong>
              Music Distribution
            </strong>

            <small>
              Deliver your music
              worldwide.
            </small>
          </div>
        )}
      </aside>

      {/* ======================================
          CONTENT
      ====================================== */}

      <main className="main">
        {/* HEADER */}

        <header className="header">
          <div className="headerLeft">
            <button
              className="menuButton"
              onClick={() =>
                setSidebarOpen(
                  !sidebarOpen
                )
              }
            >
              ☰
            </button>

            <div>
              <div className="welcome">
                Welcome back
              </div>

              <h1>
                {userName}
              </h1>
            </div>
          </div>

          <div className="headerActions">
            <button
              className="notificationButton"
              onClick={() =>
                router.push(
                  "/notifications"
                )
              }
            >
              <span>
                🔔
              </span>

              <span className="desktopOnly">
                Notifications
              </span>
            </button>

            <button
              className="newReleaseButton"
              onClick={() =>
                router.push(
                  "/releases/new"
                )
              }
            >
              <span>
                ＋
              </span>

              New Release
            </button>
          </div>
        </header>

        {/* HERO */}

        <section className="hero">
          <div className="heroGlow glowOne" />
          <div className="heroGlow glowTwo" />

          <div className="heroContent">
            <span className="heroBadge">
              NEXORAEL MUSIC
            </span>

            <h2>
              Your music.
              <br />

              <span>
                Everywhere.
              </span>
            </h2>

            <p>
              Manage releases,
              distribution,
              royalties and
              performance from one
              powerful dashboard.
            </p>

            <div className="heroActions">
              <button
                onClick={() =>
                  router.push(
                    "/releases/new"
                  )
                }
              >
                Upload New Release
                <span>
                  →
                </span>
              </button>

              <button
                className="secondaryHero"
                onClick={() =>
                  router.push(
                    "/releases"
                  )
                }
              >
                View Catalog
              </button>
            </div>
          </div>

          <div className="heroVisual">
            <div className="musicDisc">
              <div className="discRing">
                <div className="discCenter">
                  N
                </div>
              </div>
            </div>

            <div className="floatingCard cardOne">
              <small>
                Catalog
              </small>

              <strong>
                {stats.total}
              </strong>

              <span>
                Total Releases
              </span>
            </div>

            <div className="floatingCard cardTwo">
              <small>
                Distribution
              </small>

              <strong>
                250+
              </strong>

              <span>
                Global Stores
              </span>
            </div>
          </div>
        </section>

        {/* STAT CARDS */}

        <section className="statsGrid">
          <MetricCard
            title="Total Releases"
            value={
              stats.total
            }
            subtitle="Your complete catalog"
            icon="♫"
            type="blue"
          />

          <MetricCard
            title="Pending Review"
            value={
              stats.pending
            }
            subtitle="Waiting for review"
            icon="◷"
            type="orange"
          />

          <MetricCard
            title="Approved"
            value={
              stats.approved
            }
            subtitle="Ready for delivery"
            icon="✓"
            type="purple"
          />

          <MetricCard
            title="Live Releases"
            value={
              stats.live
            }
            subtitle="Available worldwide"
            icon="◎"
            type="green"
          />

          <MetricCard
            title="Rejected"
            value={
              stats.rejected
            }
            subtitle="Needs your attention"
            icon="!"
            type="red"
          />

          <MetricCard
            title="Total Revenue"
            value="$0.00"
            subtitle="Estimated royalties"
            icon="$"
            type="cyan"
          />
        </section>

        {/* MAIN GRID */}

        <section className="dashboardGrid">
          {/* RELEASE TABLE */}

          <div className="panel releasesPanel">
            <div className="panelHeader">
              <div>
                <span className="eyebrow">
                  CATALOG
                </span>

                <h3>
                  Recent Releases
                </h3>

                <p>
                  Latest music
                  submitted through
                  Nexorael.
                </p>
              </div>

              <button
                className="textButton"
                onClick={() =>
                  router.push(
                    "/releases"
                  )
                }
              >
                View all →
              </button>
            </div>

            {loading ? (
              <div className="emptyState">
                <div className="loader" />

                <span>
                  Loading your catalog...
                </span>
              </div>
            ) : releases.length ===
              0 ? (
              <div className="emptyState">
                <div className="emptyIcon">
                  ♫
                </div>

                <h4>
                  No releases yet
                </h4>

                <p>
                  Upload your first
                  release to start your
                  catalog.
                </p>

                <button
                  onClick={() =>
                    router.push(
                      "/releases/new"
                    )
                  }
                >
                  Create Release
                </button>
              </div>
            ) : (
              <div className="tableWrapper">
                <table>
                  <thead>
                    <tr>
                      <th>
                        Release
                      </th>

                      <th>
                        Artist
                      </th>

                      <th>
                        UPC
                      </th>

                      <th>
                        Status
                      </th>

                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {releases
                      .slice(
                        0,
                        6
                      )
                      .map(
                        (
                          release
                        ) => {
                          const artwork =
                            release.artwork_url ||
                            release.cover_url;

                          return (
                            <tr
                              key={
                                release.id
                              }
                            >
                              <td>
                                <div className="releaseCell">
                                  {artwork ? (
                                    <img
                                      src={
                                        artwork
                                      }
                                      alt=""
                                    />
                                  ) : (
                                    <div className="artFallback">
                                      ♫
                                    </div>
                                  )}

                                  <div>
                                    <strong>
                                      {release.title ||
                                        "Untitled"}
                                    </strong>

                                    <span>
                                      Digital
                                      Release
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td>
                                {release.artist_name ||
                                  "-"}
                              </td>

                              <td className="mono">
                                {release.upc ||
                                  "Auto"}
                              </td>

                              <td>
                                <span
                                  className={getStatusClass(
                                    release.status
                                  )}
                                >
                                  <span className="statusDot" />

                                  {release.status ||
                                    "Draft"}
                                </span>
                              </td>

                              <td>
                                <button
                                  className="rowButton"
                                  onClick={() =>
                                    router.push(
                                      `/releases/${release.id}`
                                    )
                                  }
                                >
                                  →
                                </button>
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

          {/* RIGHT COLUMN */}

          <div className="rightColumn">
            <div className="panel analyticsPanel">
              <div className="panelHeader compact">
                <div>
                  <span className="eyebrow">
                    PERFORMANCE
                  </span>

                  <h3>
                    Catalog Health
                  </h3>
                </div>

                <span className="healthNumber">
                  {stats.total
                    ? "100%"
                    : "0%"}
                </span>
              </div>

              <div className="healthRing">
                <div
                  className="healthRingInner"
                  style={{
                    "--progress":
                      stats.total
                        ? "100%"
                        : "0%",
                  } as React.CSSProperties}
                >
                  <div className="healthCenter">
                    <strong>
                      {stats.total}
                    </strong>

                    <span>
                      Releases
                    </span>
                  </div>
                </div>
              </div>

              <div className="analyticsRows">
                <AnalyticsRow
                  label="Live"
                  value={
                    stats.live
                  }
                  dot="greenDot"
                />

                <AnalyticsRow
                  label="Pending"
                  value={
                    stats.pending
                  }
                  dot="orangeDot"
                />

                <AnalyticsRow
                  label="Rejected"
                  value={
                    stats.rejected
                  }
                  dot="redDot"
                />
              </div>
            </div>

            <div className="panel revenuePanel">
              <span className="eyebrow">
                ROYALTIES
              </span>

              <div className="revenueTop">
                <div>
                  <p>
                    Available Balance
                  </p>

                  <h3>
                    $0.00
                  </h3>
                </div>

                <div className="revenueIcon">
                  $
                </div>
              </div>

              <div className="revenueLine">
                <span>
                  Pending
                </span>

                <strong>
                  $0.00
                </strong>
              </div>

              <button
                className="revenueButton"
                onClick={() =>
                  router.push(
                    "/royalties"
                  )
                }
              >
                View Royalties
                <span>
                  →
                </span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .app {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 80% 0%,
              rgba(
                59,
                130,
                246,
                0.08
              ),
              transparent 30%
            ),
            radial-gradient(
              circle at 30% 100%,
              rgba(
                124,
                58,
                237,
                0.07
              ),
              transparent 35%
            ),
            #060914;

          color: #f8fafc;
          display: flex;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .sidebar {
          width: 255px;
          min-height: 100vh;
          position: fixed;
          inset: 0 auto 0 0;
          padding: 24px 16px;
          background:
            linear-gradient(
              180deg,
              rgba(
                12,
                20,
                37,
                0.98
              ),
              rgba(
                7,
                12,
                24,
                0.98
              )
            );
          border-right:
            1px solid
            rgba(
              148,
              163,
              184,
              0.1
            );
          z-index: 30;
          transition: width 0.25s ease;
        }

        .sidebar.collapsed {
          width: 86px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          height: 58px;
          padding: 0 4px 20px;
        }

        .brandIcon {
          width: 42px;
          height: 42px;
          flex-shrink: 0;
          border-radius: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 900;
          color: white;
          background:
            linear-gradient(
              135deg,
              #2563eb,
              #7c3aed
            );
          box-shadow:
            0 10px 30px
            rgba(
              37,
              99,
              235,
              0.3
            );
        }

        .brandName {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 0.5px;
        }

        .brandSub {
          color: #64748b;
          font-size: 10px;
          margin-top: 2px;
        }

        .nav {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 25px;
        }

        .navDivider {
          height: 1px;
          background:
            rgba(
              148,
              163,
              184,
              0.08
            );
          margin: 12px 5px;
        }

        .sidebarCard {
          position: absolute;
          overflow: hidden;
          left: 16px;
          right: 16px;
          bottom: 22px;
          padding: 16px;
          border-radius: 16px;
          border:
            1px solid
            rgba(
              96,
              165,
              250,
              0.16
            );
          background:
            linear-gradient(
              145deg,
              rgba(
                37,
                99,
                235,
                0.13
              ),
              rgba(
                124,
                58,
                237,
                0.08
              )
            );
        }

        .sidebarGlow {
          position: absolute;
          width: 100px;
          height: 100px;
          right: -40px;
          top: -40px;
          border-radius: 50%;
          background:
            rgba(
              59,
              130,
              246,
              0.25
            );
          filter: blur(25px);
        }

        .sidebarCard span {
          color: #60a5fa;
          font-size: 10px;
          font-weight: 800;
        }

        .sidebarCard strong,
        .sidebarCard small {
          display: block;
        }

        .sidebarCard strong {
          font-size: 13px;
          margin-top: 5px;
        }

        .sidebarCard small {
          color: #64748b;
          font-size: 10px;
          line-height: 1.5;
          margin-top: 7px;
        }

        .main {
          width: 100%;
          margin-left: 255px;
          padding: 25px 30px 60px;
          transition:
            margin-left 0.25s ease;
        }

        .sidebar.collapsed + .main {
          margin-left: 86px;
        }

        .header {
          min-height: 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .headerLeft {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .menuButton {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          cursor: pointer;
          border:
            1px solid
            rgba(
              148,
              163,
              184,
              0.12
            );
          background:
            rgba(
              15,
              23,
              42,
              0.75
            );
          color: #94a3b8;
          font-size: 18px;
        }

        .welcome {
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          font-weight: 700;
        }

        .header h1 {
          margin: 3px 0 0;
          font-size: 22px;
        }

        .headerActions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .notificationButton,
        .newReleaseButton {
          min-height: 42px;
          padding: 0 15px;
          border-radius: 11px;
          cursor: pointer;
          font-weight: 700;
          border:
            1px solid
            rgba(
              148,
              163,
              184,
              0.12
            );
        }

        .notificationButton {
          color: #cbd5e1;
          background:
            rgba(
              15,
              23,
              42,
              0.8
            );
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .newReleaseButton {
          color: white;
          background:
            linear-gradient(
              135deg,
              #2563eb,
              #4f46e5
            );
          box-shadow:
            0 8px 24px
            rgba(
              37,
              99,
              235,
              0.22
            );
        }

        .hero {
          min-height: 290px;
          overflow: hidden;
          position: relative;
          border-radius: 24px;
          padding: 38px 42px;
          display: flex;
          align-items: center;
          border:
            1px solid
            rgba(
              96,
              165,
              250,
              0.15
            );
          background:
            linear-gradient(
              115deg,
              rgba(
                15,
                23,
                42,
                0.98
              ),
              rgba(
                13,
                23,
                51,
                0.96
              ) 46%,
              rgba(
                30,
                20,
                63,
                0.95
              )
            );
          box-shadow:
            0 25px 80px
            rgba(
              0,
              0,
              0,
              0.22
            );
        }

        .heroGlow {
          position: absolute;
          border-radius: 999px;
          filter: blur(70px);
        }

        .glowOne {
          width: 260px;
          height: 260px;
          right: 120px;
          top: -100px;
          background:
            rgba(
              37,
              99,
              235,
              0.35
            );
        }

        .glowTwo {
          width: 200px;
          height: 200px;
          right: -40px;
          bottom: -100px;
          background:
            rgba(
              124,
              58,
              237,
              0.34
            );
        }

        .heroContent {
          width: 55%;
          position: relative;
          z-index: 5;
        }

        .heroBadge,
        .eyebrow {
          display: inline-flex;
          align-items: center;
          color: #60a5fa;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .heroBadge {
          padding: 6px 10px;
          border-radius: 999px;
          border:
            1px solid
            rgba(
              96,
              165,
              250,
              0.22
            );
          background:
            rgba(
              37,
              99,
              235,
              0.09
            );
        }

        .hero h2 {
          margin: 15px 0 10px;
          font-size: clamp(
            34px,
            4vw,
            52px
          );
          line-height: 1.05;
          letter-spacing: -2px;
        }

        .hero h2 span {
          background:
            linear-gradient(
              90deg,
              #60a5fa,
              #a78bfa
            );
          -webkit-background-clip:
            text;
          -webkit-text-fill-color:
            transparent;
        }

        .hero p {
          max-width: 530px;
          color: #94a3b8;
          line-height: 1.7;
          font-size: 14px;
        }

        .heroActions {
          display: flex;
          gap: 10px;
          margin-top: 22px;
        }

        .heroActions button {
          min-height: 44px;
          border: 0;
          border-radius: 11px;
          padding: 0 17px;
          cursor: pointer;
          color: white;
          font-weight: 800;
          background:
            linear-gradient(
              135deg,
              #2563eb,
              #4f46e5
            );
        }

        .heroActions button span {
          margin-left: 8px;
        }

        .heroActions .secondaryHero {
          background:
            rgba(
              15,
              23,
              42,
              0.55
            );
          border:
            1px solid
            rgba(
              148,
              163,
              184,
              0.14
            );
        }

        .heroVisual {
          width: 45%;
          align-self: stretch;
          position: relative;
          z-index: 3;
        }

        .musicDisc {
          position: absolute;
          width: 210px;
          height: 210px;
          right: 70px;
          top: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background:
            repeating-radial-gradient(
              circle,
              #111827 0px,
              #111827 5px,
              #172036 6px,
              #172036 7px
            );
          box-shadow:
            0 30px 70px
            rgba(
              0,
              0,
              0,
              0.5
            );
        }

        .discRing {
          width: 65px;
          height: 65px;
          border-radius: 50%;
          background:
            linear-gradient(
              135deg,
              #2563eb,
              #7c3aed
            );
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .discCenter {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #070b14;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 900;
        }

        .floatingCard {
          position: absolute;
          min-width: 125px;
          padding: 12px 14px;
          border-radius: 14px;
          backdrop-filter:
            blur(12px);
          border:
            1px solid
            rgba(
              255,
              255,
              255,
              0.09
            );
          background:
            rgba(
              8,
              15,
              30,
              0.75
            );
          box-shadow:
            0 15px 40px
            rgba(
              0,
              0,
              0,
              0.25
            );
        }

        .floatingCard small {
          display: block;
          color: #64748b;
          font-size: 9px;
        }

        .floatingCard strong {
          display: block;
          font-size: 23px;
          margin: 4px 0 1px;
        }

        .floatingCard span {
          color: #94a3b8;
          font-size: 9px;
        }

        .cardOne {
          right: 250px;
          bottom: 8px;
        }

        .cardTwo {
          right: 2px;
          top: 15px;
        }

        .statsGrid {
          display: grid;
          grid-template-columns:
            repeat(
              6,
              minmax(
                0,
                1fr
              )
            );
          gap: 13px;
          margin-top: 18px;
        }

        .dashboardGrid {
          display: grid;
          grid-template-columns:
            minmax(
              0,
              2fr
            )
            minmax(
              280px,
              0.75fr
            );
          gap: 18px;
          margin-top: 18px;
        }

        .panel {
          border-radius: 18px;
          border:
            1px solid
            rgba(
              148,
              163,
              184,
              0.1
            );
          background:
            linear-gradient(
              145deg,
              rgba(
                17,
                25,
                44,
                0.93
              ),
              rgba(
                10,
                16,
                30,
                0.95
              )
            );
          box-shadow:
            0 15px 55px
            rgba(
              0,
              0,
              0,
              0.14
            );
        }

        .releasesPanel {
          min-height: 420px;
          overflow: hidden;
        }

        .panelHeader {
          padding: 22px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom:
            1px solid
            rgba(
              148,
              163,
              184,
              0.08
            );
        }

        .panelHeader.compact {
          border: none;
          padding-bottom: 12px;
        }

        .panelHeader h3 {
          font-size: 18px;
          margin: 5px 0;
        }

        .panelHeader p {
          margin: 0;
          color: #64748b;
          font-size: 11px;
        }

        .textButton {
          background: none;
          border: none;
          color: #60a5fa;
          cursor: pointer;
          font-weight: 700;
        }

        .tableWrapper {
          overflow-x: auto;
          padding: 0 20px 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          padding: 15px 10px;
          color: #64748b;
          font-size: 10px;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.7px;
        }

        td {
          padding: 13px 10px;
          border-top:
            1px solid
            rgba(
              148,
              163,
              184,
              0.07
            );
          color: #cbd5e1;
          font-size: 12px;
        }

        tr {
          transition:
            background 0.2s ease;
        }

        tbody tr:hover {
          background:
            rgba(
              59,
              130,
              246,
              0.035
            );
        }

        .releaseCell {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .releaseCell img,
        .artFallback {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          object-fit: cover;
          flex-shrink: 0;
        }

        .artFallback {
          display: flex;
          justify-content: center;
          align-items: center;
          background:
            linear-gradient(
              135deg,
              #1d4ed8,
              #7c3aed
            );
        }

        .releaseCell strong,
        .releaseCell span {
          display: block;
        }

        .releaseCell strong {
          color: #f8fafc;
          font-size: 12px;
          margin-bottom: 4px;
        }

        .releaseCell span {
          color: #64748b;
          font-size: 9px;
        }

        .mono {
          font-family:
            ui-monospace,
            monospace;
          color: #94a3b8;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          text-transform: capitalize;
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 9px;
          font-weight: 800;
        }

        .statusDot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: currentColor;
        }

        .status.live {
          color: #34d399;
          background:
            rgba(
              16,
              185,
              129,
              0.1
            );
        }

        .status.pending {
          color: #fbbf24;
          background:
            rgba(
              245,
              158,
              11,
              0.1
            );
        }

        .status.approved {
          color: #a78bfa;
          background:
            rgba(
              139,
              92,
              246,
              0.1
            );
        }

        .status.rejected {
          color: #fb7185;
          background:
            rgba(
              244,
              63,
              94,
              0.1
            );
        }

        .status.draft {
          color: #94a3b8;
          background:
            rgba(
              148,
              163,
              184,
              0.09
            );
        }

        .rowButton {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          cursor: pointer;
          border:
            1px solid
            rgba(
              148,
              163,
              184,
              0.1
            );
          background:
            rgba(
              30,
              41,
              59,
              0.55
            );
          color: #60a5fa;
        }

        .rightColumn {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .analyticsPanel,
        .revenuePanel {
          padding-bottom: 20px;
        }

        .healthNumber {
          font-size: 20px;
          font-weight: 900;
          color: #60a5fa;
        }

        .healthRing {
          height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .healthRingInner {
          width: 135px;
          height: 135px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            conic-gradient(
              #3b82f6
              var(
                --progress
              ),
              rgba(
                  148,
                  163,
                  184,
                  0.08
                )
                0
            );
          position: relative;
        }

        .healthRingInner:after {
          content: "";
          position: absolute;
          width: 106px;
          height: 106px;
          border-radius: 50%;
          background: #0c1322;
        }

        .healthCenter {
          z-index: 2;
          text-align: center;
        }

        .healthCenter strong {
          display: block;
          font-size: 26px;
        }

        .healthCenter span {
          color: #64748b;
          font-size: 9px;
        }

        .analyticsRows {
          padding: 0 23px;
        }

        .revenuePanel {
          padding: 22px;
        }

        .revenueTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 15px;
        }

        .revenueTop p {
          margin: 0;
          color: #64748b;
          font-size: 10px;
        }

        .revenueTop h3 {
          font-size: 29px;
          margin: 6px 0;
        }

        .revenueIcon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 18px;
          font-weight: 900;
          background:
            linear-gradient(
              135deg,
              rgba(
                16,
                185,
                129,
                0.2
              ),
              rgba(
                6,
                182,
                212,
                0.12
              )
            );
          color: #34d399;
        }

        .revenueLine {
          margin-top: 15px;
          padding: 13px 0;
          display: flex;
          justify-content: space-between;
          color: #64748b;
          border-top:
            1px solid
            rgba(
              148,
              163,
              184,
              0.08
            );
          border-bottom:
            1px solid
            rgba(
              148,
              163,
              184,
              0.08
            );
          font-size: 10px;
        }

        .revenueLine strong {
          color: #cbd5e1;
        }

        .revenueButton {
          width: 100%;
          height: 39px;
          border-radius: 10px;
          margin-top: 15px;
          border:
            1px solid
            rgba(
              52,
              211,
              153,
              0.16
            );
          color: #34d399;
          background:
            rgba(
              16,
              185,
              129,
              0.06
            );
          cursor: pointer;
          font-weight: 800;
        }

        .revenueButton span {
          margin-left: 7px;
        }

        .emptyState {
          min-height: 300px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          color: #64748b;
          text-align: center;
        }

        .emptyIcon {
          width: 52px;
          height: 52px;
          border-radius: 15px;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 12px;
          color: #60a5fa;
          background:
            rgba(
              37,
              99,
              235,
              0.1
            );
        }

        .emptyState h4 {
          margin: 4px 0;
          color: #f8fafc;
        }

        .emptyState p {
          font-size: 11px;
        }

        .emptyState button {
          margin-top: 10px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 9px;
          padding: 10px 15px;
          cursor: pointer;
        }

        .loader {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border:
            2px solid
            rgba(
              96,
              165,
              250,
              0.15
            );
          border-top-color:
            #3b82f6;
          animation:
            spin 0.8s linear
            infinite;
          margin-bottom: 12px;
        }

        @keyframes spin {
          to {
            transform:
              rotate(
                360deg
              );
          }
        }

        @media (
          max-width: 1250px
        ) {
          .statsGrid {
            grid-template-columns:
              repeat(
                3,
                1fr
              );
          }

          .dashboardGrid {
            grid-template-columns:
              1fr;
          }

          .rightColumn {
            display: grid;
            grid-template-columns:
              1fr 1fr;
          }
        }

        @media (
          max-width: 900px
        ) {
          .sidebar {
            width: 86px;
          }

          .sidebar .brand > div:not(
              .brandIcon
            ),
          .sidebarCard {
            display: none;
          }

          .main,
          .sidebar.collapsed
            + .main {
            margin-left: 86px;
            padding:
              20px 16px
              50px;
          }

          .hero {
            padding: 30px 25px;
          }

          .heroContent {
            width: 100%;
          }

          .heroVisual {
            display: none;
          }

          .statsGrid {
            grid-template-columns:
              repeat(
                2,
                1fr
              );
          }
        }

        @media (
          max-width: 600px
        ) {
          .sidebar {
            display: none;
          }

          .main,
          .sidebar.collapsed
            + .main {
            margin-left: 0;
            padding:
              14px 12px
              40px;
          }

          .header h1 {
            font-size: 18px;
          }

          .desktopOnly {
            display: none;
          }

          .hero {
            min-height: auto;
            padding: 25px 20px;
          }

          .hero h2 {
            font-size: 34px;
          }

          .heroActions {
            flex-direction: column;
          }

          .statsGrid {
            grid-template-columns:
              1fr 1fr;
            gap: 10px;
          }

          .rightColumn {
            grid-template-columns:
              1fr;
          }
        }
      `}</style>
    </div>
  );
}

/*
 * =========================================
 * NAV ITEM
 * =========================================
 */

function NavItem({
  icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "navItem active"
          : "navItem"
      }
    >
      <span className="navIcon">
        {icon}
      </span>

      {!collapsed && (
        <span>
          {label}
        </span>
      )}

      <style jsx>{`
        .navItem {
          width: 100%;
          height: 44px;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 0;
          border-radius: 11px;
          cursor: pointer;
          padding: 0 13px;
          color: #8a99af;
          background: transparent;
          font-size: 12px;
          font-weight: 650;
          transition:
            all 0.2s ease;
          text-align: left;
        }

        .navItem:hover {
          color: #f8fafc;
          background:
            rgba(
              59,
              130,
              246,
              0.07
            );
        }

        .navItem.active {
          color: #eff6ff;
          background:
            linear-gradient(
              90deg,
              rgba(
                37,
                99,
                235,
                0.23
              ),
              rgba(
                79,
                70,
                229,
                0.12
              )
            );
          border:
            1px solid
            rgba(
              96,
              165,
              250,
              0.17
            );
          box-shadow:
            inset 3px 0
            #3b82f6;
        }

        .navIcon {
          width: 22px;
          text-align: center;
          font-size: 15px;
          color: #60a5fa;
        }
      `}</style>
    </button>
  );
}

/*
 * =========================================
 * METRIC CARD
 * =========================================
 */

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  type,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  type:
    | "blue"
    | "orange"
    | "purple"
    | "green"
    | "red"
    | "cyan";
}) {
  return (
    <div
      className={`metric ${type}`}
    >
      <div className="metricTop">
        <span>
          {title}
        </span>

        <div className="metricIcon">
          {icon}
        </div>
      </div>

      <strong>
        {value}
      </strong>

      <small>
        {subtitle}
      </small>

      <div className="metricGlow" />

      <style jsx>{`
        .metric {
          min-height: 135px;
          position: relative;
          overflow: hidden;
          padding: 17px;
          border-radius: 17px;
          border:
            1px solid
            rgba(
              148,
              163,
              184,
              0.1
            );
          background:
            linear-gradient(
              145deg,
              rgba(
                17,
                25,
                44,
                0.94
              ),
              rgba(
                11,
                17,
                30,
                0.95
              )
            );
          transition:
            transform 0.2s ease,
            border-color
              0.2s ease;
        }

        .metric:hover {
          transform:
            translateY(-3px);
          border-color:
            rgba(
              96,
              165,
              250,
              0.2
            );
        }

        .metricTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #8795aa;
          font-size: 10px;
        }

        .metricIcon {
          width: 33px;
          height: 33px;
          display: flex;
          justify-content: center;
          align-items: center;
          border-radius: 10px;
          font-size: 13px;
        }

        strong {
          display: block;
          font-size: 25px;
          margin: 11px 0 5px;
          position: relative;
          z-index: 2;
        }

        small {
          color: #526177;
          font-size: 9px;
          position: relative;
          z-index: 2;
        }

        .metricGlow {
          position: absolute;
          right: -35px;
          bottom: -45px;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          filter: blur(35px);
          opacity: 0.18;
        }

        .blue
          .metricIcon {
          color: #60a5fa;
          background:
            rgba(
              59,
              130,
              246,
              0.12
            );
        }

        .blue .metricGlow {
          background: #3b82f6;
        }

        .orange
          .metricIcon {
          color: #fbbf24;
          background:
            rgba(
              245,
              158,
              11,
              0.1
            );
        }

        .orange
          .metricGlow {
          background: #f59e0b;
        }

        .purple
          .metricIcon {
          color: #a78bfa;
          background:
            rgba(
              139,
              92,
              246,
              0.11
            );
        }

        .purple
          .metricGlow {
          background: #8b5cf6;
        }

        .green
          .metricIcon {
          color: #34d399;
          background:
            rgba(
              16,
              185,
              129,
              0.1
            );
        }

        .green .metricGlow {
          background: #10b981;
        }

        .red
          .metricIcon {
          color: #fb7185;
          background:
            rgba(
              244,
              63,
              94,
              0.1
            );
        }

        .red .metricGlow {
          background: #f43f5e;
        }

        .cyan
          .metricIcon {
          color: #22d3ee;
          background:
            rgba(
              6,
              182,
              212,
              0.1
            );
        }

        .cyan .metricGlow {
          background: #06b6d4;
        }
      `}</style>
    </div>
  );
}

function AnalyticsRow({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot: string;
}) {
  return (
    <div className="analyticsRow">
      <div>
        <span
          className={`dot ${dot}`}
        />

        {label}
      </div>

      <strong>
        {value}
      </strong>

      <style jsx>{`
        .analyticsRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 0;
          border-top:
            1px solid
            rgba(
              148,
              163,
              184,
              0.07
            );
          font-size: 10px;
          color: #94a3b8;
        }

        .analyticsRow div {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        strong {
          color: #f8fafc;
        }

        .dot {
          width: 6px;
          height: 6px;
          display: inline-block;
          border-radius: 50%;
        }

        .greenDot {
          background: #34d399;
          box-shadow:
            0 0 10px
            rgba(
              52,
              211,
              153,
              0.7
            );
        }

        .orangeDot {
          background: #fbbf24;
        }

        .redDot {
          background: #fb7185;
        }
      `}</style>
    </div>
  );
}