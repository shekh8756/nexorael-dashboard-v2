"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

export default function AnalyticsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [analytics, setAnalytics] = useState({
    totalReleases: 0,
    liveReleases: 0,
    totalStreams: 0,
    totalRevenue: 0,
    totalTracks: 0,
    totalDSPs: 0,
    availableBalance: 0,
    pendingWithdrawals: 0,
  });

  const [topDSPs, setTopDSPs] = useState<any[]>([]);
  const [topCountries, setTopCountries] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [monthlyStreams, setMonthlyStreams] = useState<any[]>([]);
  const [topTracks, setTopTracks] = useState<any[]>([]);

const [topRelease, setTopRelease] = useState<{
  name: string;
  revenue: number;
}>({
  name: "-",
  revenue: 0,
});

const [bestTrackStreams, setBestTrackStreams] =
  useState(0);

const [avgRevenuePerStream, setAvgRevenuePerStream] =
  useState(0);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const userId = userData.user.id;

    const { data: releases } = await supabase
      .from("releases")
      .select("*")
      .eq("user_id", userId);

    const { data: royalties } = await supabase
      .from("royalties")
      .select("*")
      .eq("user_id", userId);

    const { data: withdrawals } = await supabase
      .from("withdrawals")
      .select("amount,status")
      .eq("user_id", userId);

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

    const totalTracks =
      new Set(
        royalties?.map((r) => r.release_title)
      ).size || 0;

    const totalDSPs =
      new Set(
        royalties?.map((r) => r.dsp_name)
      ).size || 0;

    const pendingWithdrawals =
      withdrawals
        ?.filter((x) => x.status === "pending")
        .reduce(
          (sum, x) => sum + Number(x.amount || 0),
          0
        ) || 0;

const availableBalance = Math.max(
  0,
  totalRevenue - pendingWithdrawals
);

    const dspMap: any = {};
    const countryMap: any = {};
    const releaseMap: any = {};
    const releaseStreamMap: any = {};
    const revenueMonthMap: any = {};
    const streamMonthMap: any = {};
    const trackMap: any = {};

royalties?.forEach((item) => {
  const dsp = item.dsp_name || "Unknown";
  const country = item.country || "Unknown";
  const release = item.release_title || "Unknown";

  dspMap[dsp] =
    (dspMap[dsp] || 0) +
    Number(item.revenue || 0);

  countryMap[country] =
    (countryMap[country] || 0) +
    Number(item.revenue || 0);

  releaseMap[release] =
    (releaseMap[release] || 0) +
    Number(item.revenue || 0);
releaseStreamMap[release] =
trackMap[release] = {
  revenue:
    (trackMap[release]?.revenue || 0) +
    Number(item.revenue || 0),

  streams:
    (trackMap[release]?.streams || 0) +
    Number(item.streams || 0),
};
  (releaseStreamMap[release] || 0) +
  Number(item.streams || 0);

    const month = item.report_month || "Unknown";

revenueMonthMap[month] =
  (revenueMonthMap[month] || 0) +
  Number(item.revenue || 0);

streamMonthMap[month] =
  (streamMonthMap[month] || 0) +
  Number(item.streams || 0);
});

    setTopDSPs(
      Object.entries(dspMap)
        .map(([name, revenue]) => ({
          name,
          revenue,
        }))
        .sort(
          (a: any, b: any) =>
            b.revenue - a.revenue
        )
        .slice(0, 5)
    );

    setTopCountries(
      Object.entries(countryMap)
        .map(([name, revenue]) => ({
          name,
          revenue,
        }))
        .sort(
          (a: any, b: any) =>
            b.revenue - a.revenue
        )
        .slice(0, 5)
    );
const topReleaseData =
  Object.entries(releaseMap)
    .map(([name, revenue]) => ({
      name,
      revenue: Number(revenue),
    }))
    .sort(
      (a: any, b: any) =>
        b.revenue - a.revenue
    )[0];

if (topReleaseData) {
  setTopRelease(topReleaseData);

  setBestTrackStreams(
    Number(
      releaseStreamMap[topReleaseData.name] || 0
    )
  );
}
setAvgRevenuePerStream(
  totalStreams > 0
    ? totalRevenue / totalStreams
    : 0
);

setMonthlyRevenue(
  Object.entries(revenueMonthMap)
    .sort()
    .map(([month, revenue]) => ({
      month,
      revenue,
    }))
);

setMonthlyStreams(
  Object.entries(streamMonthMap)
    .sort()
    .map(([month, streams]) => ({
      month,
      streams,
    }))
);

setTopTracks(
  Object.entries(trackMap)
    .map(([name, data]: any) => ({
      name,
      revenue: data.revenue,
      streams: data.streams,
    }))
    .sort(
      (a: any, b: any) =>
        b.revenue - a.revenue
    )
    .slice(0, 10)
);

    setAnalytics({
      totalReleases,
      liveReleases,
      totalStreams,
      totalRevenue,
      totalTracks,
      totalDSPs,
      availableBalance,
      pendingWithdrawals,
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
        Track your releases, streams,
        DSP performance and revenue.
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
          <h2>
            {analytics.totalStreams.toLocaleString()}
          </h2>
        </div>

        <div style={cardStyle}>
          <p>Total Revenue</p>
          <h2>
            ${analytics.totalRevenue.toFixed(2)}
          </h2>
        </div>

        <div style={cardStyle}>
          <p>Total Tracks</p>
          <h2>{analytics.totalTracks}</h2>
        </div>

        <div style={cardStyle}>
          <p>DSP Partners</p>
          <h2>{analytics.totalDSPs}</h2>
        </div>

        <div style={cardStyle}>
          <p>Available Balance</p>
          <h2>
            ${analytics.availableBalance.toFixed(2)}
          </h2>
        </div>

        <div style={cardStyle}>
          <p>Pending Withdrawals</p>
          <h2>
            ${analytics.pendingWithdrawals.toFixed(2)}
          </h2>
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
                <strong>
                  $
                  {Number(
                    dsp.revenue
                  ).toFixed(2)}
                </strong>
              </div>
            ))
          )}
        </section>

        <section style={sectionStyle}>
          <h2>Top Countries</h2>
          <h2>DSP Revenue Share</h2>

          {loading ? (
            <p>Loading...</p>
          ) : topCountries.length === 0 ? (
            <p>No country data available.</p>
          ) : (
            topCountries.map(
              (country, index) => (
                <div
                  key={index}
                  style={rowStyle}
                >
                  <span>{country.name}</span>
                  <strong>
                    $
                    {Number(
                      country.revenue
                    ).toFixed(2)}
                  </strong>
                </div>
              )
            )
          )}
        </section>
      </div>

      <section
        style={{
          ...sectionStyle,
          marginTop: "20px",
        }}
      >
        <h2>Platform Performance</h2>

{topDSPs.map((dsp, index) => (
  <div key={index}>
    <div style={rowStyle}>
      <span>{dsp.name}</span>

      <span>
        {analytics.totalRevenue > 0
          ? (
              (Number(dsp.revenue) /
                analytics.totalRevenue) *
              100
            ).toFixed(1)
          : "0"}
        %
      </span>
    </div>

    <div
      style={{
        width: "100%",
        height: "8px",
        background: "#1F2937",
        borderRadius: "999px",
        marginTop: "6px",
        marginBottom: "12px",
      }}
    >
      <div
        style={{
          width: `${
            analytics.totalRevenue > 0
              ? (
                  (Number(dsp.revenue) /
                    analytics.totalRevenue) *
                  100
                ).toFixed(1)
              : 0
          }%`,
          height: "100%",
          background: "#2563EB",
          borderRadius: "999px",
        }}
      />
    </div>
  </div>
))}


        
      </section>
<section
  style={{
    ...sectionStyle,
    marginTop: "20px",
  }}
>
<h2>Monthly Revenue</h2>

<div style={{ width: "100%", height: 300 }}>
  <ResponsiveContainer>
    <LineChart data={monthlyRevenue}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="month" />
      <YAxis />
      <Tooltip />
      <Line
        type="monotone"
        dataKey="revenue"
      />
    </LineChart>
  </ResponsiveContainer>
</div>

</section>
<section
  style={{
    ...sectionStyle,
    marginTop: "20px",
  }}
>
<h2>Monthly Streams</h2>

<div style={{ width: "100%", height: 300 }}>
  <ResponsiveContainer>
    <BarChart data={monthlyStreams}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="month" />
      <YAxis />
      <Tooltip />
      <Bar dataKey="streams" />
    </BarChart>
  </ResponsiveContainer>
</div>

</section>

      <div
  style={{
    ...gridStyle,
    marginTop: "20px",
  }}
>
  <section style={sectionStyle}>
    <h2>Top Release</h2>

    <div style={rowStyle}>
      <span>{topRelease.name}</span>

      <strong>
        ${Number(topRelease.revenue).toFixed(2)}
      </strong>
    </div>

<div style={{ marginTop: "10px" }}>
  Streams: {bestTrackStreams.toLocaleString()}
</div>

  </section>

  <section style={sectionStyle}>
    <h2>Revenue Per Stream</h2>

    <div style={rowStyle}>
      <span>Average</span>

      <strong>
        ${avgRevenuePerStream.toFixed(6)}
      </strong>
    </div>
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
  gridTemplateColumns:
    "repeat(4,minmax(0,1fr))",
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