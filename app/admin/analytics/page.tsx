"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminAnalyticsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalWhiteLabels: 0,
    totalReleases: 0,
    pendingReleases: 0,
    liveReleases: 0,
    totalStreams: 0,
    totalRevenue: 0,
    totalWithdrawals: 0,
    pendingWithdrawals: 0,
    supportTickets: 0,
  });

  const [topWhiteLabels, setTopWhiteLabels] = useState<any[]>([]);
  const [topDSPs, setTopDSPs] = useState<any[]>([]);
  const [topCountries, setTopCountries] = useState<any[]>([]);

  useEffect(() => {
    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAdmin() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role,status,white_label_id")
      .eq("id", userData.user.id)
      .single();

    if (
      !profile ||
      profile.status !== "active" ||
      !["master_admin", "white_label_admin"].includes(profile.role)
    ) {
      alert("Admin access only.");
      router.push("/dashboard");
      return;
    }

    await loadAnalytics(profile);
    setLoading(false);
  }

  async function loadAnalytics(profile: any) {
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: whiteLabels } = await supabase.from("white_labels").select("*");

    let releasesQuery = supabase.from("releases").select("*");
    let ticketsQuery = supabase.from("support_tickets").select("*");

    if (profile.role === "white_label_admin") {
      releasesQuery = releasesQuery.eq("white_label_id", profile.white_label_id);
      ticketsQuery = ticketsQuery.eq("white_label_id", profile.white_label_id);
    }

    const { data: releases } = await releasesQuery;
    const { data: royalties } = await supabase.from("royalties").select("*");
    const { data: withdrawals } = await supabase.from("withdrawals").select("*");
    const { data: tickets } = await ticketsQuery;

    let filteredProfiles = profiles || [];
    let filteredWhiteLabels = whiteLabels || [];
    let filteredRoyalties = royalties || [];
    let filteredWithdrawals = withdrawals || [];

    if (profile.role === "white_label_admin") {
      filteredProfiles = filteredProfiles.filter(
        (p) => p.white_label_id === profile.white_label_id
      );

      filteredWhiteLabels = filteredWhiteLabels.filter(
        (w) => w.id === profile.white_label_id
      );

      const whiteLabelUserIds = filteredProfiles.map((p) => p.id);

      filteredRoyalties = filteredRoyalties.filter((r) =>
        whiteLabelUserIds.includes(r.user_id)
      );

      filteredWithdrawals = filteredWithdrawals.filter((w) =>
        whiteLabelUserIds.includes(w.user_id)
      );
    }

    const totalStreams = filteredRoyalties.reduce(
      (sum, item) => sum + Number(item.streams || 0),
      0
    );

    const totalRevenue = filteredRoyalties.reduce(
      (sum, item) => sum + Number(item.revenue || 0),
      0
    );

    const totalWithdrawals = filteredWithdrawals.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    setStats({
      totalUsers: filteredProfiles.length,
      totalWhiteLabels: filteredWhiteLabels.length,
      totalReleases: releases?.length || 0,
      pendingReleases:
        releases?.filter((r) => r.status === "submitted").length || 0,
      liveReleases: releases?.filter((r) => r.status === "live").length || 0,
      totalStreams,
      totalRevenue,
      totalWithdrawals,
      pendingWithdrawals:
        filteredWithdrawals.filter((w) => w.status === "pending").length || 0,
      supportTickets: tickets?.length || 0,
    });

    const labelRevenueMap: any = {};
    const dspMap: any = {};
    const countryMap: any = {};

    filteredRoyalties.forEach((royalty) => {
      const royaltyUser = filteredProfiles.find((p) => p.id === royalty.user_id);
      const wl = filteredWhiteLabels.find(
        (label) => label.id === royaltyUser?.white_label_id
      );

      const labelName = wl?.name || wl?.brand_name || "Nexorael Direct";
      const dsp = royalty.dsp_name || "Unknown";
      const country = royalty.country || "Unknown";
      const revenue = Number(royalty.revenue || 0);

      labelRevenueMap[labelName] = (labelRevenueMap[labelName] || 0) + revenue;
      dspMap[dsp] = (dspMap[dsp] || 0) + revenue;
      countryMap[country] = (countryMap[country] || 0) + revenue;
    });

    setTopWhiteLabels(
      Object.entries(labelRevenueMap)
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 5)
    );

    setTopDSPs(
      Object.entries(dspMap)
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 5)
    );

    setTopCountries(
      Object.entries(countryMap)
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 5)
    );
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <h1>Loading admin analytics...</h1>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <button onClick={() => router.push("/dashboard")} style={backButton}>
        ← Back to Dashboard
      </button>

      <h1>Admin Analytics</h1>

      <p style={{ color: "#94A3B8" }}>
        Platform performance, releases, revenue, withdrawals and support overview.
      </p>

      <div style={statsGrid}>
        <div style={cardStyle}>
          <p>Total Users</p>
          <h2>{stats.totalUsers}</h2>
        </div>

        <div style={cardStyle}>
          <p>White Labels</p>
          <h2>{stats.totalWhiteLabels}</h2>
        </div>

        <div style={cardStyle}>
          <p>Total Releases</p>
          <h2>{stats.totalReleases}</h2>
        </div>

        <div style={cardStyle}>
          <p>Pending Releases</p>
          <h2>{stats.pendingReleases}</h2>
        </div>

        <div style={cardStyle}>
          <p>Live Releases</p>
          <h2>{stats.liveReleases}</h2>
        </div>

        <div style={cardStyle}>
          <p>Total Streams</p>
          <h2>{stats.totalStreams.toLocaleString()}</h2>
        </div>

        <div style={cardStyle}>
          <p>Total Revenue</p>
          <h2>${stats.totalRevenue.toFixed(2)}</h2>
        </div>

        <div style={cardStyle}>
          <p>Total Withdrawals</p>
          <h2>${stats.totalWithdrawals.toFixed(2)}</h2>
        </div>

        <div style={cardStyle}>
          <p>Pending Withdrawals</p>
          <h2>{stats.pendingWithdrawals}</h2>
        </div>

        <div style={cardStyle}>
          <p>Support Tickets</p>
          <h2>{stats.supportTickets}</h2>
        </div>
      </div>

      <div style={gridStyle}>
        <section style={sectionStyle}>
          <h2>Top White Labels</h2>
          {topWhiteLabels.length === 0 ? (
            <p style={{ color: "#94A3B8" }}>No data yet.</p>
          ) : (
            topWhiteLabels.map((item, index) => (
              <div key={index} style={rowStyle}>
                <span>{item.name}</span>
                <strong>${Number(item.revenue).toFixed(2)}</strong>
              </div>
            ))
          )}
        </section>

        <section style={sectionStyle}>
          <h2>Top DSPs</h2>
          {topDSPs.length === 0 ? (
            <p style={{ color: "#94A3B8" }}>No data yet.</p>
          ) : (
            topDSPs.map((item, index) => (
              <div key={index} style={rowStyle}>
                <span>{item.name}</span>
                <strong>${Number(item.revenue).toFixed(2)}</strong>
              </div>
            ))
          )}
        </section>

        <section style={sectionStyle}>
          <h2>Top Countries</h2>
          {topCountries.length === 0 ? (
            <p style={{ color: "#94A3B8" }}>No data yet.</p>
          ) : (
            topCountries.map((item, index) => (
              <div key={index} style={rowStyle}>
                <span>{item.name}</span>
                <strong>${Number(item.revenue).toFixed(2)}</strong>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#050816",
  color: "white",
  padding: "35px",
  fontFamily: "Arial, sans-serif",
};

const backButton = {
  marginBottom: "20px",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#111827",
  color: "white",
  cursor: "pointer",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: "16px",
  marginTop: "25px",
};

const cardStyle = {
  background: "#111827",
  padding: "20px",
  borderRadius: "16px",
  border: "1px solid #1F2937",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "20px",
  marginTop: "25px",
};

const sectionStyle = {
  background: "#111827",
  padding: "20px",
  borderRadius: "16px",
  border: "1px solid #1F2937",
};

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  padding: "12px 0",
  borderBottom: "1px solid #1F2937",
};