"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function AnalyticsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({
    totalReleases: 0,
    liveReleases: 0,
    totalStreams: 0,
    totalRevenue: 0,
  });

  const [topDSPs, setTopDSPs] = useState<any[]>([]);
  const [topCountries, setTopCountries] = useState<any[]>([]);

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAnalytics() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { data: releases } = await supabase
      .from("releases")
      .select("*")
      .eq("user_id", userData.user.id);

    const { data: royalties } = await supabase
      .from("royalties")
      .select("*")
      .eq("user_id", userData.user.id);

    const totalReleases = releases?.length || 0;

    const liveReleases =
      releases?.filter((r) => r.status === "live").length || 0;

    const totalStreams =
      royalties?.reduce(
        (sum, item) => sum + Number(item.streams || 0),
        0
      ) || 0;

    const totalRevenue =
      royalties?.reduce(
        (sum, item) => sum + Number(item.revenue || 0),
        0
      ) || 0;

    const dspMap: any = {};
    const countryMap: any = {};

    royalties?.forEach((item) => {
      const dsp = item.dsp_name || "Unknown";
      const country = item.country || "Unknown";

      dspMap[dsp] = (dspMap[dsp] || 0) + Number(item.revenue || 0);
      countryMap[country] =
        (countryMap[country] || 0) + Number(item.revenue || 0);
    });

    setTopDSPs(
      Object.entries(dspMap)
        .map(([name, revenue]) => ({
          name,
          revenue,
        }))
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 5)
    );

    setTopCountries(
      Object.entries(countryMap)
        .map(([name, revenue]) => ({
          name,
          revenue,
        }))
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 5)
    );

    setAnalytics({
      totalReleases,
      liveReleases,
      totalStreams,
      totalRevenue,
    });

    setLoading(false);
  }

  return (
    <main style={pageStyle}>
      <button
        onClick={() => router.push("/dashboard")}
        style={backButton}
      >
        ← Back to Dashboard
      </button>

      <h1>Analytics</h1>

      <p style={{ color: "#94A3B8" }}>
        Track your releases, streams, DSP performance and revenue.
      </p>

      <div style={statsGrid}>
        <div style={cardStyle}>
          <p>Total Releases</p>
          <h2>{analytics.totalReleases}</h2>
        </div>

        <div style={cardStyle}>
          <p>Live Releases</p>
          <h2>{analytics.liveReleases}</h2>
        </div>

        <div style={cardStyle}>
          <p>Total Streams</p>
          <h2>{analytics.totalStreams.toLocaleString()}</h2>
        </div>

        <div style={cardStyle}>
          <p>Total Revenue</p>
          <h2>${analytics.totalRevenue.toFixed(2)}</h2>
        </div>
      </div>

      <div style={gridStyle}>
        <section style={sectionStyle}>
          <h2>Top DSPs</h2>

          {loading ? (
            <p>Loading...</p>
          ) : topDSPs.length === 0 ? (
            <p>No DSP data available.</p>
          ) : (
            topDSPs.map((dsp, index) => (
              <div key={index} style={rowStyle}>
                <span>{dsp.name}</span>
                <strong>${Number(dsp.revenue).toFixed(2)}</strong>
              </div>
            ))
          )}
        </section>

        <section style={sectionStyle}>
          <h2>Top Countries</h2>

          {loading ? (
            <p>Loading...</p>
          ) : topCountries.length === 0 ? (
            <p>No country data available.</p>
          ) : (
            topCountries.map((country, index) => (
              <div key={index} style={rowStyle}>
                <span>{country.name}</span>
                <strong>${Number(country.revenue).toFixed(2)}</strong>
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
  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
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
  gridTemplateColumns: "1fr 1fr",
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