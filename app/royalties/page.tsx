"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function RoyaltiesPage() {
  const router = useRouter();

  const [royalties, setRoyalties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoyalties();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRoyalties() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("royalties")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setRoyalties(data || []);
    setLoading(false);
  }

  const totalStreams = royalties.reduce(
    (sum, item) => sum + Number(item.streams || 0),
    0
  );

  const totalRevenue = royalties.reduce(
    (sum, item) => sum + Number(item.revenue || 0),
    0
  );

  return (
    <main style={pageStyle}>
      <button onClick={() => router.push("/dashboard")} style={backButton}>
        ← Back to Dashboard
      </button>

      <h1>Royalty Statements</h1>

      <p style={{ color: "#94A3B8" }}>
        View your DSP streams, monthly revenue and royalty reports.
      </p>

      <div style={statsGrid}>
        <div style={cardStyle}>
          <p>Total Streams</p>
          <h2>{totalStreams.toLocaleString()}</h2>
        </div>

        <div style={cardStyle}>
          <p>Total Revenue</p>
          <h2>${totalRevenue.toFixed(2)}</h2>
        </div>

        <div style={cardStyle}>
          <p>Total Reports</p>
          <h2>{royalties.length}</h2>
        </div>
      </div>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Reports</h2>

        {loading ? (
          <p>Loading royalties...</p>
        ) : royalties.length === 0 ? (
          <p style={{ color: "#94A3B8" }}>No royalty reports yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#94A3B8" }}>
                <th align="left" style={thStyle}>Month</th>
                <th align="left" style={thStyle}>Release</th>
                <th align="left" style={thStyle}>DSP</th>
                <th align="left" style={thStyle}>Country</th>
                <th align="left" style={thStyle}>Streams</th>
                <th align="left" style={thStyle}>Revenue</th>
              </tr>
            </thead>

            <tbody>
              {royalties.map((item) => (
                <tr key={item.id}>
                  <td style={tdStyle}>{item.report_month || "-"}</td>
                  <td style={tdStyle}>{item.release_title || "-"}</td>
                  <td style={tdStyle}>{item.dsp_name || "-"}</td>
                  <td style={tdStyle}>{item.country || "-"}</td>
                  <td style={tdStyle}>
                    {Number(item.streams || 0).toLocaleString()}
                  </td>
                  <td style={tdStyle}>
                    ${Number(item.revenue || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
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
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "16px",
  marginTop: "24px",
};

const cardStyle = {
  background: "#111827",
  padding: "20px",
  borderRadius: "16px",
  border: "1px solid #1F2937",
};

const sectionStyle = {
  marginTop: "25px",
  background: "#111827",
  padding: "22px",
  borderRadius: "16px",
  border: "1px solid #1F2937",
  overflowX: "auto" as const,
};

const thStyle = {
  padding: "12px 8px",
  borderBottom: "1px solid #334155",
};

const tdStyle = {
  padding: "14px 8px",
  borderBottom: "1px solid #1F2937",
};