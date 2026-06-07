"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminBulkUploadPage() {
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [importing, setImporting] = useState(false);

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

    setAdminProfile(profile);
    loadUsers(profile);
  }

  async function loadUsers(profile: any) {
    let query = supabase
      .from("profiles")
      .select("id, full_name, email, white_label_id")
      .order("created_at", { ascending: false });

    if (profile.role === "white_label_admin") {
      query = query.eq("white_label_id", profile.white_label_id);
    }

    const { data } = await query;
    setUsers(data || []);
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

    if (!selectedUserId) {
      alert("Please select user first.");
      return;
    }

    setImporting(true);

    const selectedUser = users.find((u) => u.id === selectedUserId);

    if (!selectedUser) {
      alert("Selected user not found.");
      setImporting(false);
      return;
    }

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
      const generatedUpc =
        row.upc || `NX${Date.now().toString().slice(-10)}${successCount}`;

      const { error } = await supabase.from("releases").insert({
        user_id: selectedUserId,
        white_label_id: selectedUser.white_label_id || null,
        title: row.title || "",
        artist_name: row.artist || row.artist_name || "",
        label_name: row.label || row.label_name || "",
        genre: row.genre || "",
        language: row.language || "",
        release_date: row.release_date || "",
        upc: generatedUpc,
        auto_upc: generatedUpc,
        release_type: row.release_type || "single",
        artwork_url: row.artwork_url || "",
        status: row.status || "submitted",
      });

      if (error) {
        failedCount++;
      } else {
        successCount++;
      }
    }

    await supabase.from("notifications").insert({
      user_id: selectedUserId,
      title: "Bulk releases imported",
      message: `${successCount} releases were imported successfully. Failed: ${failedCount}.`,
      type: "bulk_upload",
      is_read: false,
    });

    setImporting(false);

    alert(`Bulk upload completed. Success: ${successCount}, Failed: ${failedCount}`);
  }

  return (
    <main style={pageStyle}>
      <button onClick={() => router.push("/dashboard")} style={backButton}>
        ← Back to Dashboard
      </button>

      <h1>Bulk Release Upload</h1>

      <p style={{ color: "#94A3B8" }}>
        Import multiple releases using CSV. Audio/tracks can be added later from
        each release detail page.
      </p>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>CSV Format</h2>

        <pre style={codeBox}>
{`title,artist,label,genre,language,release_date,release_type,upc,artwork_url
Song One,Artist A,RCJ FILMS,Pop,Hindi,2026-06-10,single,,https://example.com/art.jpg
Song Two,Artist B,RCJ FILMS,Folk,Bengali,2026-06-12,single,,`}
        </pre>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Import Releases</h2>

        <label>Select User / Label Account</label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          style={inputStyle}
        >
          <option value="">Select User</option>

          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name || user.email} — {user.email}
            </option>
          ))}
        </select>

        <label>Upload CSV</label>
        <input
          type="file"
          accept=".csv"
          onChange={importCSV}
          style={inputStyle}
        />

        {importing && <p>Importing releases...</p>}
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

const sectionStyle = {
  maxWidth: "900px",
  background: "#111827",
  padding: "22px",
  borderRadius: "18px",
  border: "1px solid #1F2937",
  marginTop: "24px",
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

const codeBox = {
  background: "#0B1020",
  padding: "16px",
  borderRadius: "12px",
  border: "1px solid #1F2937",
  color: "#CBD5E1",
  overflowX: "auto" as const,
};