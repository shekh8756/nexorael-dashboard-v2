"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [whiteLabelName, setWhiteLabelName] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userData.user.id)
      .single();

    if (error || !profile) {
      alert("Profile not found.");
      router.push("/dashboard");
      return;
    }

    setFullName(profile.full_name || "");
    setEmail(profile.email || userData.user.email || "");
    setRole(profile.role || "label_user");
    setStatus(profile.status || "active");

    if (profile.white_label_id) {
      const { data: wl } = await supabase
        .from("white_labels")
        .select("name, brand_name")
        .eq("id", profile.white_label_id)
        .single();

      setWhiteLabelName(wl?.name || wl?.brand_name || "");
    }

    setLoading(false);
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
      })
      .eq("id", userData.user.id);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Settings saved.");
    loadProfile();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <h1>Loading settings...</h1>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <button onClick={() => router.push("/dashboard")} style={backButton}>
        ← Back to Dashboard
      </button>

      <h1>Settings</h1>
      <p style={{ color: "#94A3B8" }}>
        Manage your Nexorael account profile.
      </p>

      <form onSubmit={saveSettings} style={formStyle}>
        <label>Full Name</label>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={inputStyle}
        />

        <label>Email</label>
        <input value={email} disabled style={inputStyle} />

        <label>Role</label>
        <input value={role} disabled style={inputStyle} />

        <label>Status</label>
        <input value={status} disabled style={inputStyle} />

        <label>White Label</label>
        <input value={whiteLabelName || "Nexorael Direct"} disabled style={inputStyle} />

        <button type="submit" disabled={saving} style={buttonStyle}>
          {saving ? "Saving..." : "Save Settings"}
        </button>

        <button type="button" onClick={handleLogout} style={dangerButton}>
          Logout
        </button>
      </form>
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

const formStyle = {
  maxWidth: "650px",
  background: "#111827",
  padding: "24px",
  borderRadius: "18px",
  border: "1px solid #1F2937",
  marginTop: "22px",
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
  width: "100%",
  padding: "14px",
  borderRadius: "10px",
  border: "none",
  background: "#2563EB",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const dangerButton = {
  ...buttonStyle,
  marginTop: "12px",
  background: "#DC2626",
};