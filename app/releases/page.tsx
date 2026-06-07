"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function ReleasesPage() {
  const router = useRouter();
  const [releases, setReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReleases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadReleases() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, white_label_id")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile) {
      alert("Profile not found.");
      router.push("/dashboard");
      return;
    }

    let query = supabase
      .from("releases")
      .select(`
        *,
        tracks(*)
      `)
      .order("created_at", { ascending: false });

    if (profile.role === "master_admin") {
      // Master admin sab releases dekhega
    } else if (profile.white_label_id) {
      // White-label user/admin sirf apne white label releases dekhega
      query = query.eq("white_label_id", profile.white_label_id);
    } else {
      // Normal user sirf apne releases dekhega
      query = query.eq("user_id", userData.user.id);
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

  return (
    <main style={pageStyle}>
      <div style={headerStyle}>
        <div>
  <button
    onClick={() => router.push("/dashboard")}
    style={{
      padding: "8px 14px",
      borderRadius: "10px",
      border: "1px solid #334155",
      background: "#0B1020",
      color: "white",
      cursor: "pointer",
      marginBottom: "12px",
    }}
  >
    ← Back
  </button>

  <h1 style={{ fontSize: "32px", margin: 0 }}>My Releases</h1>

  <p style={{ color: "#94A3B8" }}>
    View your submitted releases, artwork, tracks and review status.
  </p>
</div>

        <button onClick={() => router.push("/releases/new")} style={buttonStyle}>
          + New Release
        </button>
      </div>

      {loading ? (
        <p>Loading releases...</p>
      ) : releases.length === 0 ? (
        <section style={emptyBox}>
          <h2>No releases submitted yet.</h2>
          <p style={{ color: "#94A3B8" }}>
            Start by uploading your first release to Nexorael.
          </p>
          <button onClick={() => router.push("/releases/new")} style={buttonStyle}>
            Upload Release
          </button>
        </section>
      ) : (
        <div style={gridStyle}>
          {releases.map((release) => (
            <div key={release.id} style={cardStyle}>
              <img
                src={release.artwork_url || "https://placehold.co/600x600?text=Artwork"}
                alt="Release artwork"
                style={artworkStyle}
              />

              <div style={{ padding: "16px" }}>
                <h3 style={{ fontSize: "20px", margin: "0 0 10px" }}>
                  {release.title}
                </h3>

                <p style={textStyle}>🎤 Artist: {release.artist_name}</p>
                <p style={textStyle}>🏷 Label: {release.label_name}</p>
                <p style={textStyle}>🎼 Genre: {release.genre}</p>
                <p style={textStyle}>🌐 Language: {release.language}</p>
                <p style={textStyle}>📅 Release Date: {release.release_date}</p>
                <p style={textStyle}>🔢 UPC: {release.upc || "Nexorael will assign"}</p>
                <p style={textStyle}>🎵 Tracks: {release.tracks?.length || 0}</p>

                <span style={statusStyle}>{release.status}</span>

                {release.admin_note && (
                  <p style={noteStyle}>
                    Admin Note: {release.admin_note}
                  </p>
                )}

                <div style={{ marginTop: "14px" }}>
                  <button
                    onClick={() => router.push(`/releases/${release.id}`)}
                    style={buttonStyle}
                  >
                    View
                  </button>
                </div>

                {release.tracks?.length > 0 && (
                  <div style={{ marginTop: "14px" }}>
                    <p style={{ color: "#94A3B8", marginBottom: "8px" }}>
                      Track Preview
                    </p>

                    {release.tracks.map((track: any) => (
                      <div key={track.id} style={trackBox}>
                        <p style={{ margin: "0 0 8px" }}>
                          {track.track_number}. {track.title}
                        </p>

                        {track.audio_url && (
                          <audio
                            controls
                            src={track.audio_url}
                            style={{ width: "100%" }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "25px",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
  gap: "18px",
};

const cardStyle = {
  background: "#111827",
  borderRadius: "18px",
  overflow: "hidden",
  border: "1px solid #1F2937",
};

const artworkStyle = {
  width: "100%",
  height: "260px",
  objectFit: "cover" as const,
  background: "#1F2937",
};

const textStyle = {
  color: "#CBD5E1",
  margin: "7px 0",
};

const statusStyle = {
  display: "inline-block",
  marginTop: "12px",
  background: "#1D4ED8",
  padding: "7px 13px",
  borderRadius: "999px",
  fontSize: "13px",
  fontWeight: "bold",
};

const noteStyle = {
  marginTop: "12px",
  color: "#FBBF24",
  background: "#451A03",
  padding: "10px",
  borderRadius: "10px",
};

const trackBox = {
  background: "#0B1020",
  border: "1px solid #1F2937",
  padding: "12px",
  borderRadius: "12px",
  marginBottom: "10px",
};

const emptyBox = {
  background: "#111827",
  border: "1px solid #1F2937",
  padding: "30px",
  borderRadius: "18px",
};

const buttonStyle = {
  padding: "12px 16px",
  borderRadius: "12px",
  border: "none",
  background: "#2563EB",
  color: "white",
  cursor: "pointer",
  fontWeight: "bold",
};