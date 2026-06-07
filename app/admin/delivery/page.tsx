"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

const dsps = [
  "Spotify",
  "Apple Music",
  "YouTube Music",
  "Amazon Music",
  "Deezer",
  "TikTok",
  "Meta",
];

export default function AdminDeliveryPage() {
  const router = useRouter();

  const [releases, setReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

    await loadReleases(profile);
  }

  async function loadReleases(profile: any) {
    let query = supabase
      .from("releases")
      .select("*, dsp_deliveries(*)")
      .order("created_at", { ascending: false });

    if (profile.role === "white_label_admin") {
      query = query.eq("white_label_id", profile.white_label_id);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setReleases(data || []);
    setLoading(false);
  }

  async function updateDsp(release: any, dspName: string, status: string) {
    const existing = release.dsp_deliveries?.find(
      (d: any) => d.dsp_name === dspName
    );

    if (existing) {
      const { error } = await supabase
        .from("dsp_deliveries")
        .update({ status })
        .eq("id", existing.id);

      if (error) {
        alert(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("dsp_deliveries").insert({
        release_id: release.id,
        dsp_name: dspName,
        status,
      });

      if (error) {
        alert(error.message);
        return;
      }
    }

    if (release.user_id) {
      await supabase.from("notifications").insert({
        user_id: release.user_id,
        title: "DSP delivery updated",
        message: `${dspName} status for "${release.title}" is now ${status}.`,
        type: "delivery",
        is_read: false,
      });
    }

    alert("DSP status updated.");
    checkAdmin();
  }

  function getDspStatus(release: any, dspName: string) {
    const item = release.dsp_deliveries?.find(
      (d: any) => d.dsp_name === dspName
    );

    return item?.status || "not_started";
  }

  return (
    <main style={pageStyle}>
      <button onClick={() => router.push("/dashboard")} style={backButton}>
        ← Back to Dashboard
      </button>

      <h1>DSP Delivery Manager</h1>
      <p style={{ color: "#94A3B8" }}>
        Manage delivery status for Spotify, Apple Music, YouTube Music and other DSPs.
      </p>

      <section style={sectionStyle}>
        {loading ? (
          <p>Loading releases...</p>
        ) : releases.length === 0 ? (
          <p>No releases found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1300px" }}>
            <thead>
              <tr style={{ color: "#94A3B8" }}>
                <th align="left" style={thStyle}>Release</th>
                <th align="left" style={thStyle}>Artist</th>
                <th align="left" style={thStyle}>Label</th>
                {dsps.map((dsp) => (
                  <th key={dsp} align="left" style={thStyle}>
                    {dsp}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {releases.map((release) => (
                <tr key={release.id}>
                  <td style={tdStyle}>{release.title}</td>
                  <td style={tdStyle}>{release.artist_name}</td>
                  <td style={tdStyle}>{release.label_name}</td>

                  {dsps.map((dsp) => (
                    <td key={dsp} style={tdStyle}>
                      <select
                        value={getDspStatus(release, dsp)}
                        onChange={(e) =>
                          updateDsp(release, dsp, e.target.value)
                        }
                        style={selectStyle}
                      >
                        <option value="not_started">Not Started</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="delivered">Delivered</option>
                        <option value="live">Live</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                  ))}
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

const selectStyle = {
  padding: "8px",
  borderRadius: "8px",
  background: "#0B1020",
  color: "white",
  border: "1px solid #334155",
};