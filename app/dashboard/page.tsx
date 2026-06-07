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
      royalties?.reduce((sum, item) => sum + Number(item.revenue || 0), 0) ||
      0;

    setStatsData({
      totalReleases: allReleases.length,
      pendingReleases: allReleases.filter((r) => r.status === "submitted")
        .length,
      approvedReleases: allReleases.filter((r) => r.status === "approved")
        .length,
      liveReleases: allReleases.filter((r) => r.status === "live").length,
      rejectedReleases: allReleases.filter((r) => r.status === "rejected")
        .length,
      totalUsers,
      totalWhiteLabels,
      totalRevenue,
    });

    setRecentReleases(allReleases.slice(0, 5));
  }

  async function loadNotificationCount(userId: string) {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
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

  if (loading) {
    return (
      <main style={loadingStyle}>
        <h1>Loading Dashboard...</h1>
      </main>
    );
  }

  const dashboardTitle =
    profile?.role === "master_admin"
      ? "Nexorael Master Dashboard"
      : profile?.role === "white_label_admin"
      ? `${whiteLabel?.name || whiteLabel?.brand_name || "White Label"} Dashboard`
      : "My Distribution Dashboard";

  const dashboardSubtitle =
    profile?.role === "master_admin"
      ? "Manage all users, releases, approvals, royalties and white-label operations."
      : profile?.role === "white_label_admin"
      ? "Manage your white-label users, releases and approval workflow."
      : "Manage your releases, analytics, royalties and support tickets.";

  const roleLabel =
    profile?.role === "master_admin"
      ? "Master Admin"
      : profile?.role === "white_label_admin"
      ? "White Label Admin"
      : "Label User";

  const stats = [
    {
      title: "Total Releases",
      value: statsData.totalReleases,
      note: "Catalog releases",
    },
    {
      title: "Pending Review",
      value: statsData.pendingReleases,
      note: "Waiting for QC",
    },
    {
      title: "Approved",
      value: statsData.approvedReleases,
      note: "Ready for delivery",
    },
    {
      title: "Live Releases",
      value: statsData.liveReleases,
      note: "Available on DSPs",
    },
    {
      title: "Rejected",
      value: statsData.rejectedReleases,
      note: "Rejected releases",
    },
    {
      title: "Total Revenue",
      value: `$${statsData.totalRevenue.toFixed(2)}`,
      note: "Estimated royalties",
    },
    {
      title: "Users",
      value: statsData.totalUsers,
      note: "Managed users",
    },
    {
      title: "White Labels",
      value: statsData.totalWhiteLabels,
      note: "Partner labels",
    },
  ];

  const navItems = [
    { label: "🏠 Dashboard", path: "/dashboard" },
    { label: "🎵 Releases", path: "/releases" },
    { label: "📊 Analytics", path: "/analytics" },
    { label: "💰 Royalties", path: "/royalties" },
    { label: "💵 Withdrawals", path: "/payments" },
    { label: "🎫 Support", path: "/support" },
    { label: "⚙ Settings", path: "/settings" },
  ];

  const adminItems =
    profile?.role === "master_admin" || profile?.role === "white_label_admin"
      ? [
          { label: "👥 Users", path: "/admin/users" },
          { label: "✅ Approvals", path: "/admin/releases" },
          { label: "🎧 Support Tickets", path: "/admin/support" },
          { label: "💰 Royalties", path: "/admin/royalties" },
          { label: "💵 Withdrawals", path: "/admin/withdrawals" },
          { label: "📈 Admin Analytics", path: "/admin/analytics" },
          { label: "📦 Bulk Upload", path: "/admin/bulk-upload" },
          { label: "🚚 DSP Delivery", path: "/admin/delivery" },
          { label: "📄 Contracts", path: "/admin/contracts" },
          ...(profile?.role === "master_admin"
            ? [{ label: "🏢 White Labels", path: "/admin/white-labels" }]
            : []),
        ]
      : [];

  return (
    <div style={pageWrapper}>
      <aside style={sidebarStyle}>
        <div>
          <div style={{ marginBottom: "34px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={logoBox}>
                {whiteLabel?.name ? whiteLabel.name.charAt(0) : "N"}
              </div>

              <div>
                <h2 style={{ fontSize: "22px", fontWeight: "bold", margin: 0 }}>
                  {whiteLabel?.name || whiteLabel?.brand_name || "NEXORAEL"}
                </h2>
                <p style={{ color: "#94A3B8", fontSize: "12px", margin: 0 }}>
                  Music Distribution
                </p>
              </div>
            </div>
          </div>

          <div style={navList}>
            {navItems.map((item) => (
              <div
                key={item.label}
                onClick={() => goTo(item.path)}
                style={{
                  ...navItem,
                  background: item.label.includes("Dashboard")
                    ? "#1D4ED8"
                    : "transparent",
                  color: item.label.includes("Dashboard") ? "white" : "#CBD5E1",
                }}
              >
                {item.label}
              </div>
            ))}
          </div>

          {adminItems.length > 0 && (
            <>
              <div style={divider} />

              <p
                style={{
                  color: "#64748B",
                  fontSize: "12px",
                  marginBottom: "10px",
                }}
              >
                ADMIN CONTROL
              </p>

              <div style={navList}>
                {adminItems.map((item) => (
                  <div
                    key={item.label}
                    onClick={() => goTo(item.path)}
                    style={navItem}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={profileBox}>
          <p style={{ margin: 0, fontWeight: "bold" }}>
            👤 {profile?.full_name || profile?.email || "User"}
          </p>

          <p
            style={{
              margin: "5px 0 14px",
              color: "#94A3B8",
              fontSize: "13px",
            }}
          >
            {roleLabel}
            {whiteLabel?.name ? ` · ${whiteLabel.name}` : ""}
          </p>

          <button onClick={handleLogout} style={logoutButton}>
            Logout
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: "28px" }}>
        <div style={headerStyle}>
          <div>
            <h1 style={{ fontSize: "32px", fontWeight: "bold", margin: 0 }}>
              {dashboardTitle}
            </h1>

            <p style={{ color: "#94A3B8", marginTop: "8px" }}>
              {dashboardSubtitle}
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button
              onClick={() => router.push("/releases/new")}
              style={buttonStyle}
            >
              + New Release
            </button>

            <div
              onClick={() => router.push("/notifications")}
              style={{
                ...notificationBox,
                cursor: "pointer",
              }}
            >
              🔔 Notifications{" "}
              {unreadNotifications > 0 ? `(${unreadNotifications})` : ""}
            </div>
          </div>
        </div>

        <div style={statsGrid}>
          {stats.map((stat) => (
            <div key={stat.title} style={statCard}>
              <p style={{ color: "#CBD5E1", margin: 0 }}>{stat.title}</p>
              <h2 style={{ fontSize: "32px", margin: "10px 0" }}>
                {stat.value}
              </h2>
              <p style={{ color: "#64748B", fontSize: "13px", margin: 0 }}>
                {stat.note}
              </p>
            </div>
          ))}
        </div>

        <div style={contentGrid}>
          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Recent Releases</h2>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "#94A3B8", fontSize: "13px" }}>
                  <th align="left" style={thStyle}>
                    Artwork
                  </th>
                  <th align="left" style={thStyle}>
                    Release
                  </th>
                  <th align="left" style={thStyle}>
                    Artist
                  </th>
                  <th align="left" style={thStyle}>
                    UPC
                  </th>
                  <th align="left" style={thStyle}>
                    Status
                  </th>
                  <th align="left" style={thStyle}>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {recentReleases.length === 0 ? (
                  <tr>
                    <td style={tdStyle} colSpan={6}>
                      No release uploaded
                    </td>
                  </tr>
                ) : (
                  recentReleases.map((release) => (
                    <tr key={release.id}>
                      <td style={tdStyle}>
                        {release.artwork_url ? (
                          <img
                            src={release.artwork_url}
                            alt="Artwork"
                            style={artworkThumb}
                          />
                        ) : (
                          <div style={emptyArtwork} />
                        )}
                      </td>

                      <td style={tdStyle}>{release.title}</td>
                      <td style={tdStyle}>{release.artist_name}</td>
                      <td style={tdStyle}>{release.upc || "-"}</td>

                      <td style={tdStyle}>
                        <span style={statusStyle}>{release.status}</span>
                      </td>

                      <td style={tdStyle}>
                        <button
                          onClick={() => router.push(`/releases/${release.id}`)}
                          style={viewButton}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <section style={panelStyle}>
            <h2 style={{ marginTop: 0 }}>Analytics Preview</h2>

            <div style={miniBox}>
              <p>Revenue</p>
              <h3>${statsData.totalRevenue.toFixed(2)}</h3>
            </div>

            <div style={miniBox}>
              <p>Total Releases</p>
              <h3>{statsData.totalReleases}</h3>
            </div>

            <div style={miniBox}>
              <p>Pending Review</p>
              <h3>{statsData.pendingReleases}</h3>
            </div>

            <div style={miniBox}>
              <p>Live Releases</p>
              <h3>{statsData.liveReleases}</h3>
            </div>

            <div style={miniBox}>
              <p>Account Role</p>
              <h3>{roleLabel}</h3>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

const loadingStyle = {
  minHeight: "100vh",
  background: "#050816",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Arial, sans-serif",
};

const pageWrapper = {
  display: "flex",
  minHeight: "100vh",
  background: "#050816",
  color: "white",
  fontFamily: "Arial, sans-serif",
};

const sidebarStyle = {
  width: "280px",
  background: "#0B1020",
  padding: "22px",
  borderRight: "1px solid #1F2937",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between",
};

const logoBox = {
  width: "42px",
  height: "42px",
  borderRadius: "12px",
  background: "linear-gradient(135deg,#2563EB,#7C3AED)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold",
  fontSize: "20px",
};

const navList = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "10px",
};

const navItem = {
  padding: "11px 12px",
  borderRadius: "10px",
  color: "#CBD5E1",
  cursor: "pointer",
};

const divider = {
  height: "1px",
  background: "#334155",
  margin: "22px 0",
};

const profileBox = {
  borderTop: "1px solid #334155",
  paddingTop: "18px",
};

const logoutButton = {
  width: "100%",
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#111827",
  color: "white",
  cursor: "pointer",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "28px",
};

const buttonStyle = {
  padding: "11px 14px",
  borderRadius: "12px",
  border: "none",
  background: "#2563EB",
  color: "white",
  cursor: "pointer",
  fontWeight: "bold",
};

const notificationBox = {
  padding: "11px 14px",
  background: "#111827",
  borderRadius: "12px",
  border: "1px solid #1F2937",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "16px",
};

const statCard = {
  background: "#111827",
  padding: "20px",
  borderRadius: "16px",
  border: "1px solid #1F2937",
};

const contentGrid = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr",
  gap: "18px",
  marginTop: "22px",
};

const panelStyle = {
  background: "#111827",
  borderRadius: "16px",
  padding: "20px",
  border: "1px solid #1F2937",
};

const thStyle = {
  padding: "12px 8px",
  borderBottom: "1px solid #334155",
};

const tdStyle = {
  padding: "14px 8px",
  borderBottom: "1px solid #1F2937",
};

const statusStyle = {
  background: "#374151",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
};

const artworkThumb = {
  width: "42px",
  height: "42px",
  borderRadius: "10px",
  objectFit: "cover" as const,
};

const emptyArtwork = {
  width: "42px",
  height: "42px",
  borderRadius: "10px",
  background: "#1F2937",
};

const viewButton = {
  padding: "7px 10px",
  borderRadius: "8px",
  border: "none",
  background: "#2563EB",
  color: "white",
  cursor: "pointer",
};

const miniBox = {
  background: "#0B1020",
  padding: "16px",
  borderRadius: "14px",
  marginBottom: "12px",
  border: "1px solid #1F2937",
};