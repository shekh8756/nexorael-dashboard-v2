"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useParams, useRouter } from "next/navigation";

export default function ReleaseDetailPage() {
  const params = useParams();
  const router = useRouter();

  const releaseId = params.id as string;

  const [release, setRelease] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRelease();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRelease() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("role,status,white_label_id")
      .eq("id", userData.user.id)
      .single();

    if (!userProfile || userProfile.status !== "active") {
      alert("Profile not found or blocked.");
      router.push("/login");
      return;
    }

    setProfile(userProfile);

    const { data, error } = await supabase
      .from("releases")
      .select(`
        *,
        tracks(*),
        dsp_deliveries(*)
      `)
      .eq("id", releaseId)
      .single();

    if (error || !data) {
      alert(error?.message || "Release not found.");
      router.push("/releases");
      return;
    }

    if (
      userProfile.role !== "master_admin" &&
      data.user_id !== userData.user.id &&
      data.white_label_id !== userProfile.white_label_id
    ) {
      alert("You do not have access to this release.");
      router.push("/dashboard");
      return;
    }

    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: whiteLabels } = await supabase.from("white_labels").select("*");

    const uploader = profiles?.find((p) => p.id === data.user_id);
    const whiteLabel = whiteLabels?.find((w) => w.id === data.white_label_id);

    setRelease({
      ...data,
      uploader_name: uploader?.full_name || "-",
      uploader_email: uploader?.email || "-",
      white_label_name:
        whiteLabel?.name || whiteLabel?.brand_name || "Nexorael Direct",
    });

    setLoading(false);
  }

  async function updateStatus(status: string) {
    const note = prompt("Admin note optional:") || "";

    const { error } = await supabase
      .from("releases")
      .update({
        status,
        admin_note: note,
      })
      .eq("id", release.id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Status updated.");
    loadRelease();
  }

  async function addDspDelivery() {
    const dspName = prompt("DSP name, example: Spotify, Apple Music, YouTube Music");
    if (!dspName) return;

    const dspStatus =
      prompt("Status: pending, delivered, processing, live", "delivered") ||
      "delivered";

    const liveLink =
      prompt("Live link optional, agar live nahi hai to blank chhod do") || "";

    const { error } = await supabase.from("dsp_deliveries").insert({
      release_id: release.id,
      dsp_name: dspName,
      status: dspStatus,
      live_link: liveLink,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("DSP delivery added.");
    loadRelease();
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <h1>Loading release...</h1>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <button onClick={() => router.back()} style={backButton}>
        ← Back
      </button>

      <div style={headerBox}>
        <img
          src={release.artwork_url || "https://placehold.co/600x600?text=Artwork"}
          alt="Release artwork"
          style={artworkStyle}
        />

        <div>
          <span style={statusStyle}>{release.status}</span>

          <h1 style={{ fontSize: "34px", margin: "16px 0 8px" }}>
            {release.title}
          </h1>

          <p style={textStyle}>🎤 Artist: {release.artist_name}</p>
          <p style={textStyle}>🏷 Label: {release.label_name}</p>
          <p style={textStyle}>🏢 White Label: {release.white_label_name}</p>
          <p style={textStyle}>👤 Uploaded By: {release.uploader_name}</p>
          <p style={textStyle}>📧 User Email: {release.uploader_email}</p>
          <p style={textStyle}>🎼 Genre: {release.genre}</p>
          <p style={textStyle}>🌐 Language: {release.language}</p>
          <p style={textStyle}>📅 Release Date: {release.release_date}</p>
          <p style={textStyle}>🔢 UPC: {release.upc || release.auto_upc || "Nexorael will assign"}</p>
          <p style={textStyle}>🆔 Release ID: {release.id}</p>
          <p style={textStyle}>
            🕒 Submitted:{" "}
            {release.created_at
              ? new Date(release.created_at).toLocaleString()
              : "-"}
          </p>

          {release.admin_note && (
            <div style={noteBox}>
              <strong>Admin Note:</strong>
              <p>{release.admin_note}</p>
            </div>
          )}

          {(profile?.role === "master_admin" ||
            profile?.role === "white_label_admin") && (
            <div style={{ marginTop: "18px" }}>
              <button onClick={() => updateStatus("under_review")} style={adminBtn}>
                Review
              </button>

              <button onClick={() => updateStatus("approved")} style={adminBtn}>
                Approve
              </button>

              <button onClick={() => updateStatus("rejected")} style={dangerBtn}>
                Reject
              </button>

              <button onClick={() => updateStatus("delivered")} style={adminBtn}>
                Delivered
              </button>

              <button onClick={() => updateStatus("live")} style={adminBtn}>
                Live
              </button>

              <button onClick={addDspDelivery} style={adminBtn}>
                Add DSP
              </button>
            </div>
          )}
        </div>
      </div>

      <section style={sectionBox}>
        <h2>Tracks</h2>

        {!release.tracks || release.tracks.length === 0 ? (
          <p style={{ color: "#94A3B8" }}>No tracks found.</p>
        ) : (
          release.tracks
            .sort((a: any, b: any) => a.track_number - b.track_number)
            .map((track: any) => (
              <div key={track.id} style={trackBox}>
                <h3>
                  {track.track_number}. {track.title}
                </h3>

                <p style={textStyle}>🎤 Artist: {track.artist_name}</p>
                <p style={textStyle}>🔢 ISRC: {track.isrc || track.auto_isrc || "Nexorael will assign"}</p>
                <p style={textStyle}>📝 Composer: {track.composer || "-"}</p>
                <p style={textStyle}>✍ Lyricist: {track.lyricist || "-"}</p>
                <p style={textStyle}>🎛 Producer: {track.producer || "-"}</p>
                <p style={textStyle}>🏢 Publisher: {track.publisher || "-"}</p>
                <p style={textStyle}>🌐 Language: {track.language || "-"}</p>
                <p style={textStyle}>Explicit: {track.explicit ? "Yes" : "No"}</p>

                {track.audio_url && (
                  <audio controls src={track.audio_url} style={{ width: "100%" }} />
                )}
              </div>
            ))
        )}
      </section>

      <section style={sectionBox}>
        <h2>DSP Delivery Status</h2>

        {!release.dsp_deliveries || release.dsp_deliveries.length === 0 ? (
          <p style={{ color: "#94A3B8" }}>DSP delivery has not started yet.</p>
        ) : (
          release.dsp_deliveries.map((dsp: any) => (
            <div key={dsp.id} style={dspBox}>
              <div>
                <strong>{dsp.dsp_name}</strong>
                <p style={{ color: "#94A3B8", margin: "6px 0 0" }}>
                  Status: {dsp.status}
                </p>
              </div>

              {dsp.live_link && (
                <a href={dsp.live_link} target="_blank" style={{ color: "#60A5FA" }}>
                  Open Link
                </a>
              )}
            </div>
          ))
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
  display: "grid",
  gridTemplateColumns: "320px 1fr",
  gap: "28px",
  background: "#111827",
  border: "1px solid #1F2937",
  borderRadius: "18px",
  padding: "22px",
};

const artworkStyle = {
  width: "320px",
  height: "320px",
  borderRadius: "16px",
  objectFit: "cover" as const,
  background: "#1F2937",
};

const sectionBox = {
  marginTop: "22px",
  background: "#111827",
  border: "1px solid #1F2937",
  borderRadius: "18px",
  padding: "22px",
};

const trackBox = {
  background: "#0B1020",
  border: "1px solid #1F2937",
  borderRadius: "14px",
  padding: "16px",
  marginTop: "14px",
};

const dspBox = {
  background: "#0B1020",
  border: "1px solid #1F2937",
  borderRadius: "14px",
  padding: "14px",
  marginTop: "12px",
  display: "flex",
  justifyContent: "space-between",
};

const textStyle = {
  color: "#CBD5E1",
  margin: "8px 0",
};

const statusStyle = {
  display: "inline-block",
  background: "#1D4ED8",
  padding: "7px 13px",
  borderRadius: "999px",
  fontSize: "13px",
  fontWeight: "bold",
};

const noteBox = {
  marginTop: "16px",
  background: "#451A03",
  color: "#FBBF24",
  padding: "14px",
  borderRadius: "12px",
};

const adminBtn = {
  marginRight: "10px",
  marginTop: "10px",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#2563EB",
  color: "white",
  cursor: "pointer",
};

const dangerBtn = {
  ...adminBtn,
  background: "#DC2626",
};