"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useParams, useRouter } from "next/navigation";

export default function WhiteLabelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const whiteLabelId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [whiteLabel, setWhiteLabel] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [releases, setReleases] = useState<any[]>([]);

  useEffect(() => {
    loadWhiteLabelDashboard();
  }, []);

  async function loadWhiteLabelDashboard() {
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

    if (!profile || profile.status !== "active") {
      router.push("/dashboard");
      return;
    }

    if (
      profile.role !== "master_admin" &&
      profile.white_label_id !== whiteLabelId
    ) {
      alert("Access denied.");
      router.push("/dashboard");
      return;
    }

    const { data: labelData } = await supabase
      .from("white_labels")
      .select("*")
      .eq("id", whiteLabelId)
      .single();

    const { data: usersData } = await supabase
      .from("profiles")
      .select("*")
      .eq("white_label_id", whiteLabelId)
      .order("created_at", { ascending: false });

    const { data: releasesData } = await supabase
      .from("releases")
      .select("*")
      .eq("white_label_id", whiteLabelId)
      .order("created_at", { ascending: false });

    setWhiteLabel(labelData);
    setUsers(usersData || []);
    setReleases(releasesData || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <h1>Loading White Label...</h1>
      </main>
    );
  }

  const totalUsers = users.length;
  const totalReleases = releases.length;
  const pending = releases.filter((r) => r.status === "submitted").length;
  const approved = releases.filter((r) => r.status === "approved").length;
  const live = releases.filter((r) => r.status === "live").length;

  return (
    <main style={pageStyle}>
      <button onClick={() => router.push("/admin/white-labels")} style={backButton}>
        ← Back to White Labels
      </button>

      <div style={headerBox}>
        <div>
          <h1 style={{ fontSize: "34px", margin: 0 }}>
            {whiteLabel?.name || whiteLabel?.brand_name || "White Label"}
          </h1>

          <p style={{ color: "#94A3B8" }}>
            Domain: {whiteLabel?.domain || "-"}
          </p>

          <p style={{ color: "#94A3B8" }}>
            Commission: {whiteLabel?.commission_percent || 0}%
          </p>

          <span style={statusStyle}>
            {whiteLabel?.status || "active"}
          </span>
        </div>
      </div>

      <div style={statsGrid}>
        <div style={cardStyle}>
          <p>Total Users</p>
          <h2>{totalUsers}</h2>
        </div>

        <div style={cardStyle}>
          <p>Total Releases</p>
          <h2>{totalReleases}</h2>
        </div>

        <div style={cardStyle}>
          <p>Pending Review</p>
          <h2>{pending}</h2>
        </div>

        <div style={cardStyle}>
          <p>Approved</p>
          <h2>{approved}</h2>
        </div>

        <div style={cardStyle}>
          <p>Live Releases</p>
          <h2>{live}</h2>
        </div>
      </div>

      <section style={sectionBox}>
        <h2>Recent Releases</h2>

        {releases.length === 0 ? (
          <p style={{ color: "#94A3B8" }}>No releases yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#94A3B8" }}>
                <th align="left" style={thStyle}>Title</th>
                <th align="left" style={thStyle}>Artist</th>
                <th align="left" style={thStyle}>Label</th>
                <th align="left" style={thStyle}>Status</th>
                <th align="left" style={thStyle}>Submitted</th>
              </tr>
            </thead>

            <tbody>
              {releases.slice(0, 10).map((release) => (
                <tr key={release.id}>
                  <td style={tdStyle}>{release.title}</td>
                  <td style={tdStyle}>{release.artist_name}</td>
                  <td style={tdStyle}>{release.label_name}</td>
                  <td style={tdStyle}>
                    <span style={statusStyle}>{release.status}</span>
                  </td>
                  <td style={tdStyle}>
                    {release.created_at
                      ? new Date(release.created_at).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={sectionBox}>
        <h2>Users</h2>

        {users.length === 0 ? (
          <p style={{ color: "#94A3B8" }}>No users assigned.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#94A3B8" }}>
                <th align="left" style={thStyle}>Name</th>
                <th align="left" style={thStyle}>Email</th>
                <th align="left" style={thStyle}>Role</th>
                <th align="left" style={thStyle}>Status</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td style={tdStyle}>{user.full_name || "-"}</td>
                  <td style={tdStyle}>{user.email}</td>
                  <td style={tdStyle}>{user.role}</td>
                  <td style={tdStyle}>{user.status}</td>
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

const headerBox = {
  background: "#111827",
  padding: "24px",
  borderRadius: "18px",
  border: "1px solid #1F2937",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: "16px",
  marginTop: "22px",
};

const cardStyle = {
  background: "#111827",
  padding: "20px",
  borderRadius: "16px",
  border: "1px solid #1F2937",
};

const sectionBox = {
  marginTop: "24px",
  background: "#111827",
  padding: "22px",
  borderRadius: "16px",
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
  display: "inline-block",
  background: "#1D4ED8",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
};