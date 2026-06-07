"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminRoyaltiesPage() {
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [royalties, setRoyalties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [adminProfile, setAdminProfile] = useState<any>(null);

  const [userId, setUserId] = useState("");
  const [releaseTitle, setReleaseTitle] = useState("");
  const [dspName, setDspName] = useState("");
  const [country, setCountry] = useState("");
  const [streams, setStreams] = useState("");
  const [revenue, setRevenue] = useState("");
  const [reportMonth, setReportMonth] = useState("");

  useEffect(() => {
    checkAdmin();
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

    setAdminProfile(profile);
    await loadUsers(profile);
    await loadRoyalties(profile);
    setLoading(false);
  }

  async function loadUsers(profileParam = adminProfile) {
    let query = supabase
      .from("profiles")
      .select("id, full_name, email, white_label_id")
      .order("created_at", { ascending: false });

    if (profileParam?.role === "white_label_admin") {
      query = query.eq("white_label_id", profileParam.white_label_id);
    }

    const { data } = await query;
    setUsers(data || []);
  }

  async function loadRoyalties(profileParam = adminProfile) {
    const { data: royaltiesData } = await supabase
      .from("royalties")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, email, white_label_id");

    const { data: whiteLabelsData } = await supabase
      .from("white_labels")
      .select("id, name, brand_name");

    let merged = (royaltiesData || []).map((item) => {
      const user = profilesData?.find((p) => p.id === item.user_id);
      const wl = whiteLabelsData?.find((w) => w.id === user?.white_label_id);

      return {
        ...item,
        user_name: user?.full_name || "-",
        user_email: user?.email || "-",
        white_label_id: user?.white_label_id || null,
        white_label_name: wl?.name || wl?.brand_name || "Nexorael Direct",
      };
    });

    if (profileParam?.role === "white_label_admin") {
      merged = merged.filter(
        (item) => item.white_label_id === profileParam.white_label_id
      );
    }

    setRoyalties(merged);
  }

  async function addRoyalty(e: React.FormEvent) {
    e.preventDefault();

    if (!userId) {
      alert("Please select a user.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("royalties").insert({
      user_id: userId,
      release_title: releaseTitle,
      dsp_name: dspName,
      country,
      streams: Number(streams || 0),
      revenue: Number(revenue || 0),
      report_month: reportMonth,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: userId,
      title: "Royalty report added",
      message: `A new royalty report for "${releaseTitle}" has been added.`,
      type: "royalty",
      is_read: false,
    });

    alert("Royalty report added.");

    setUserId("");
    setReleaseTitle("");
    setDspName("");
    setCountry("");
    setStreams("");
    setRevenue("");
    setReportMonth("");

    await loadRoyalties(adminProfile);
  }

  function parseCSV(text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim());

    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const row: any = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });

      return row;
    });
  }

  async function importCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      alert("CSV is empty or invalid.");
      setImporting(false);
      return;
    }

    let successCount = 0;
    let failedCount = 0;

    for (const row of rows) {
      const email = String(row.email || "").toLowerCase();

      const user = users.find(
        (u) => String(u.email || "").toLowerCase() === email
      );

      if (!user) {
        failedCount++;
        continue;
      }

      if (
        adminProfile?.role === "white_label_admin" &&
        user.white_label_id !== adminProfile.white_label_id
      ) {
        failedCount++;
        continue;
      }

      const { error } = await supabase.from("royalties").insert({
        user_id: user.id,
        release_title: row.release_title || "",
        dsp_name: row.dsp_name || "",
        country: row.country || "",
        streams: Number(row.streams || 0),
        revenue: Number(row.revenue || 0),
        report_month: row.report_month || "",
      });

      if (error) {
        failedCount++;
      } else {
        successCount++;

        await supabase.from("notifications").insert({
          user_id: user.id,
          title: "Royalty report imported",
          message: `A royalty report for "${row.release_title}" has been added.`,
          type: "royalty",
          is_read: false,
        });
      }
    }

    setImporting(false);
    await loadRoyalties(adminProfile);

    alert(`CSV import completed. Success: ${successCount}, Failed: ${failedCount}`);
  }

  return (
    <main style={pageStyle}>
      <button onClick={() => router.push("/dashboard")} style={backButton}>
        ← Back to Dashboard
      </button>

      <h1>Admin Royalties</h1>

      <p style={{ color: "#94A3B8" }}>
        Add royalty reports manually or import CSV royalty data in bulk.
      </p>

      <section style={importBox}>
        <h2 style={{ marginTop: 0 }}>CSV Royalty Import</h2>

        <p style={{ color: "#94A3B8" }}>
          CSV format: email, release_title, dsp_name, country, streams, revenue,
          report_month
        </p>

        <input
          type="file"
          accept=".csv"
          onChange={importCSV}
          style={inputStyle}
        />

        {importing && <p>Importing CSV...</p>}
      </section>

      <form onSubmit={addRoyalty} style={formStyle}>
        <h2 style={{ marginTop: 0 }}>Add Royalty Report</h2>

        <label>User</label>
        <select
          required
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          style={inputStyle}
        >
          <option value="">Select User</option>

          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name || user.email} — {user.email}
            </option>
          ))}
        </select>

        <label>Release Title</label>
        <input
          required
          value={releaseTitle}
          onChange={(e) => setReleaseTitle(e.target.value)}
          style={inputStyle}
        />

        <label>DSP Name</label>
        <input
          required
          value={dspName}
          onChange={(e) => setDspName(e.target.value)}
          placeholder="Spotify, Apple Music, YouTube Music"
          style={inputStyle}
        />

        <label>Country</label>
        <input
          required
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="India, United States, Global"
          style={inputStyle}
        />

        <label>Streams</label>
        <input
          required
          type="number"
          value={streams}
          onChange={(e) => setStreams(e.target.value)}
          style={inputStyle}
        />

        <label>Revenue</label>
        <input
          required
          type="number"
          value={revenue}
          onChange={(e) => setRevenue(e.target.value)}
          style={inputStyle}
        />

        <label>Report Month</label>
        <input
          required
          value={reportMonth}
          onChange={(e) => setReportMonth(e.target.value)}
          placeholder="2026-06"
          style={inputStyle}
        />

        <button disabled={saving} style={buttonStyle}>
          {saving ? "Saving..." : "Add Royalty"}
        </button>
      </form>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Royalty Reports</h2>

        {loading ? (
          <p>Loading...</p>
        ) : royalties.length === 0 ? (
          <p style={{ color: "#94A3B8" }}>No royalty reports found.</p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "1100px",
            }}
          >
            <thead>
              <tr style={{ color: "#94A3B8" }}>
                <th align="left" style={thStyle}>User</th>
                <th align="left" style={thStyle}>Email</th>
                <th align="left" style={thStyle}>White Label</th>
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
                  <td style={tdStyle}>{item.user_name}</td>
                  <td style={tdStyle}>{item.user_email}</td>
                  <td style={tdStyle}>{item.white_label_name}</td>
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

const importBox = {
  maxWidth: "760px",
  background: "#111827",
  padding: "22px",
  borderRadius: "18px",
  border: "1px solid #1F2937",
  marginTop: "24px",
};

const formStyle = {
  maxWidth: "760px",
  background: "#111827",
  padding: "22px",
  borderRadius: "18px",
  border: "1px solid #1F2937",
  marginTop: "24px",
};

const sectionStyle = {
  marginTop: "26px",
  background: "#111827",
  padding: "22px",
  borderRadius: "18px",
  border: "1px solid #1F2937",
  overflowX: "auto" as const,
};

const inputStyle = {
  width: "100%",
  padding: "13px",
  marginTop: "7px",
  marginBottom: "16px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#0B1020",
  color: "white",
};

const buttonStyle = {
  padding: "11px 15px",
  borderRadius: "10px",
  border: "none",
  background: "#2563EB",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const thStyle = {
  padding: "12px 8px",
  borderBottom: "1px solid #334155",
};

const tdStyle = {
  padding: "14px 8px",
  borderBottom: "1px solid #1F2937",
};