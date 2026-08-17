"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useParams, useRouter } from "next/navigation";

export default function ReleaseDetailPage() {
  const params = useParams();
  const router = useRouter();

  const releaseId = params.id as string;

  const [release, setRelease] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadRelease();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRelease() {
    setLoading(true);
    setError("");

    try {
      // Check login
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Load release
      const { data, error: releaseError } = await supabase
        .from("releases")
        .select(`
          *,
          tracks(*),
          dsp_deliveries(*)
        `)
        .eq("id", releaseId)
        .single();

      if (releaseError) {
        console.error("Release error:", releaseError);
        throw new Error(releaseError.message);
      }

      if (!data) {
        throw new Error("Release not found.");
      }

      // Optional uploader information
      let uploaderName = "-";
      let uploaderEmail = "-";

      if (data.user_id) {
        const { data: uploader } = await supabase
          .from("profiles")
          .select("full_name,email")
          .eq("id", data.user_id)
          .maybeSingle();

        if (uploader) {
          uploaderName = uploader.full_name || "-";
          uploaderEmail = uploader.email || "-";
        }
      }

      setRelease({
        ...data,
        uploader_name: uploaderName,
        uploader_email: uploaderEmail,
      });
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load release."
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(status: string) {
    if (!release) return;

    const note =
      window.prompt("Admin note optional:") || "";

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

    alert("Status updated successfully.");
    loadRelease();
  }

  async function addDspDelivery() {
    if (!release) return;

    const dspName = window.prompt(
      "DSP name, example: Spotify, Apple Music, YouTube Music"
    );

    if (!dspName) return;

    const dspStatus =
      window.prompt(
        "Status: pending, delivered, processing, live",
        "delivered"
      ) || "delivered";

    const liveLink =
      window.prompt(
        "Live link optional. Agar live nahi hai to blank chhod do."
      ) || "";

    const { error } = await supabase
      .from("dsp_deliveries")
      .insert({
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
        <div style={loadingBox}>
          <h1>Loading release...</h1>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={pageStyle}>
        <button
          onClick={() => router.back()}
          style={backButton}
        >
          ← Back
        </button>

        <div style={errorBox}>
          <h1>Unable to load release</h1>

          <p>{error}</p>

          <button
            onClick={loadRelease}
            style={adminBtn}
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  if (!release) {
    return (
      <main style={pageStyle}>
        <h1>Release not found.</h1>
      </main>
    );
  }

  const tracks = Array.isArray(release.tracks)
    ? [...release.tracks].sort(
        (a: any, b: any) =>
          (a.track_number || 0) -
          (b.track_number || 0)
      )
    : [];

  const dspDeliveries = Array.isArray(
    release.dsp_deliveries
  )
    ? release.dsp_deliveries
    : [];

  return (
    <main style={pageStyle}>
      <div style={topBar}>
        <button
          onClick={() => router.back()}
          style={backButton}
        >
          ← Back
        </button>

        <button
          onClick={loadRelease}
          style={refreshButton}
        >
          Refresh
        </button>
      </div>

      {/* RELEASE HEADER */}

      <section style={headerBox}>
        <div>
          <img
            src={
              release.artwork_url ||
              release.cover_url ||
              "https://placehold.co/600x600?text=Artwork"
            }
            alt="Release artwork"
            style={artworkStyle}
          />
        </div>

        <div>
          <span style={statusStyle}>
            {String(
              release.status || "draft"
            ).toUpperCase()}
          </span>

          <h1 style={titleStyle}>
            {release.title || "Untitled Release"}
          </h1>

          <p style={textStyle}>
            🎤 Artist:{" "}
            {release.artist_name || "-"}
          </p>

          <p style={textStyle}>
            🏷 Label:{" "}
            {release.label_name ||
              release.label ||
              "Nexorael"}
          </p>

          <p style={textStyle}>
            👤 Uploaded By:{" "}
            {release.uploader_name}
          </p>

          <p style={textStyle}>
            📧 User Email:{" "}
            {release.uploader_email}
          </p>

          <p style={textStyle}>
            🎼 Genre:{" "}
            {release.genre ||
              release.primary_genre ||
              "-"}
          </p>

          <p style={textStyle}>
            🌐 Language:{" "}
            {release.language || "-"}
          </p>

          <p style={textStyle}>
            💿 Type:{" "}
            {release.type || "Single"}
          </p>

          <p style={textStyle}>
            📅 Release Date:{" "}
            {release.release_date ||
              release.releaseDate ||
              "-"}
          </p>

          <p style={textStyle}>
            🔢 UPC:{" "}
            {release.upc ||
              release.auto_upc ||
              "Nexorael will assign"}
          </p>

          <p style={textStyle}>
            🆔 Database Release ID:{" "}
            {release.id}
          </p>

          {release.toolost_release_id && (
            <p style={textStyle}>
              🎵 Too Lost Release ID:{" "}
              {release.toolost_release_id}
            </p>
          )}

          {release.created_at && (
            <p style={textStyle}>
              🕒 Created:{" "}
              {new Date(
                release.created_at
              ).toLocaleString()}
            </p>
          )}

          {release.admin_note && (
            <div style={noteBox}>
              <strong>Admin Note</strong>
              <p>
                {release.admin_note}
              </p>
            </div>
          )}

          {/* ADMIN ACTIONS */}

          <div style={actionsBox}>
            <button
              onClick={() =>
                updateStatus("under_review")
              }
              style={adminBtn}
            >
              Review
            </button>

            <button
              onClick={() =>
                updateStatus("approved")
              }
              style={adminBtn}
            >
              Approve
            </button>

            <button
              onClick={() =>
                updateStatus("rejected")
              }
              style={dangerBtn}
            >
              Reject
            </button>

            <button
              onClick={() =>
                updateStatus("delivered")
              }
              style={adminBtn}
            >
              Delivered
            </button>

            <button
              onClick={() =>
                updateStatus("live")
              }
              style={adminBtn}
            >
              Live
            </button>

            <button
              onClick={addDspDelivery}
              style={adminBtn}
            >
              + Add DSP
            </button>
          </div>
        </div>
      </section>

      {/* RELEASE INFORMATION */}

      <section style={sectionBox}>
        <h2 style={sectionTitle}>
          Release Information
        </h2>

        <div style={infoGrid}>
          <Info
            label="Title"
            value={release.title}
          />

          <Info
            label="Artist"
            value={
              release.artist_name
            }
          />

          <Info
            label="Label"
            value={
              release.label_name ||
              release.label
            }
          />

          <Info
            label="Type"
            value={release.type}
          />

          <Info
            label="Genre"
            value={
              release.genre ||
              release.primary_genre
            }
          />

          <Info
            label="Language"
            value={release.language}
          />

          <Info
            label="UPC"
            value={
              release.upc ||
              release.auto_upc ||
              "-"
            }
          />

          <Info
            label="Status"
            value={release.status}
          />

          <Info
            label="Countries"
            value={
              release.countries ||
              "Worldwide"
            }
          />

          <Info
            label="Content ID"
            value={
              release.content_id
                ? "Yes"
                : "No"
            }
          />
        </div>
      </section>

      {/* TRACKS */}

      <section style={sectionBox}>
        <h2 style={sectionTitle}>
          Tracks ({tracks.length})
        </h2>

        {tracks.length === 0 ? (
          <p style={mutedText}>
            No tracks found.
          </p>
        ) : (
          tracks.map(
            (track: any, index: number) => (
              <div
                key={
                  track.id ||
                  index
                }
                style={trackBox}
              >
                <div style={trackHeader}>
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "20px",
                      }}
                    >
                      {track.track_number ||
                        index + 1}
                      .{" "}
                      {track.title ||
                        "Untitled Track"}
                    </h3>

                    <p
                      style={{
                        ...textStyle,
                        marginTop: "5px",
                      }}
                    >
                      🎤{" "}
                      {track.artist_name ||
                        release.artist_name ||
                        "-"}
                    </p>
                  </div>

                  <span
                    style={smallStatus}
                  >
                    {track.status ||
                      "uploaded"}
                  </span>
                </div>

                <div
                  style={trackInfoGrid}
                >
                  <Info
                    label="ISRC"
                    value={
                      track.isrc ||
                      track.auto_isrc ||
                      "Nexorael will assign"
                    }
                  />

                  <Info
                    label="Composer"
                    value={
                      track.composer
                    }
                  />

                  <Info
                    label="Lyricist"
                    value={
                      track.lyricist
                    }
                  />

                  <Info
                    label="Producer"
                    value={
                      track.producer
                    }
                  />

                  <Info
                    label="Publisher"
                    value={
                      track.publisher
                    }
                  />

                  <Info
                    label="Language"
                    value={
                      track.language
                    }
                  />

                  <Info
                    label="Explicit"
                    value={
                      track.explicit
                        ? "Yes"
                        : "No"
                    }
                  />
                </div>

                {track.audio_url && (
                  <div
                    style={{
                      marginTop: "18px",
                    }}
                  >
                    <p
                      style={
                        mutedText
                      }
                    >
                      Audio
                    </p>

                    <audio
                      controls
                      src={
                        track.audio_url
                      }
                      style={{
                        width: "100%",
                      }}
                    />
                  </div>
                )}
              </div>
            )
          )
        )}
      </section>

      {/* DSP */}

      <section style={sectionBox}>
        <div style={sectionHeader}>
          <h2 style={sectionTitle}>
            DSP Delivery
          </h2>

          <button
            onClick={addDspDelivery}
            style={adminBtn}
          >
            + Add DSP
          </button>
        </div>

        {dspDeliveries.length ===
        0 ? (
          <p style={mutedText}>
            DSP delivery has not
            started yet.
          </p>
        ) : (
          dspDeliveries.map(
            (dsp: any) => (
              <div
                key={dsp.id}
                style={dspBox}
              >
                <div>
                  <strong
                    style={{
                      fontSize: "17px",
                    }}
                  >
                    {dsp.dsp_name}
                  </strong>

                  <p
                    style={{
                      color:
                        "#94A3B8",
                      margin:
                        "6px 0 0",
                    }}
                  >
                    Status:{" "}
                    {dsp.status}
                  </p>
                </div>

                {dsp.live_link && (
                  <a
                    href={
                      dsp.live_link
                    }
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color:
                        "#60A5FA",
                    }}
                  >
                    Open Link →
                  </a>
                )}
              </div>
            )
          )
        )}
      </section>
    </main>
  );
}

/* ----------------------------- */
/* SMALL COMPONENT */
/* ----------------------------- */

function Info({
  label,
  value,
}: {
  label: string;
  value: any;
}) {
  return (
    <div style={infoBox}>
      <div style={infoLabel}>
        {label}
      </div>

      <div style={infoValue}>
        {value === null ||
        value === undefined ||
        value === ""
          ? "-"
          : String(value)}
      </div>
    </div>
  );
}

/* ----------------------------- */
/* STYLES */
/* ----------------------------- */

const pageStyle = {
  minHeight: "100vh",
  background: "#050816",
  color: "white",
  padding: "35px",
  fontFamily:
    "Arial, sans-serif",
};

const topBar = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  marginBottom: "20px",
};

const backButton = {
  padding: "10px 14px",
  borderRadius: "10px",
  border:
    "1px solid #334155",
  background: "#111827",
  color: "white",
  cursor: "pointer",
};

const refreshButton = {
  padding: "10px 16px",
  borderRadius: "10px",
  border: "none",
  background: "#2563EB",
  color: "white",
  cursor: "pointer",
};

const headerBox = {
  display: "grid",
  gridTemplateColumns:
    "320px 1fr",
  gap: "28px",
  background: "#111827",
  border:
    "1px solid #1F2937",
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

const titleStyle = {
  fontSize: "34px",
  margin: "16px 0 8px",
};

const sectionBox = {
  marginTop: "22px",
  background: "#111827",
  border:
    "1px solid #1F2937",
  borderRadius: "18px",
  padding: "22px",
};

const sectionTitle = {
  margin: 0,
  fontSize: "22px",
};

const sectionHeader = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
};

const textStyle = {
  color: "#CBD5E1",
  margin: "8px 0",
};

const mutedText = {
  color: "#94A3B8",
};

const statusStyle = {
  display: "inline-block",
  background: "#1D4ED8",
  padding: "7px 13px",
  borderRadius: "999px",
  fontSize: "13px",
  fontWeight: "bold",
};

const smallStatus = {
  background: "#1E293B",
  color: "#CBD5E1",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
};

const actionsBox = {
  marginTop: "18px",
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

const trackBox = {
  background: "#0B1020",
  border:
    "1px solid #1F2937",
  borderRadius: "14px",
  padding: "18px",
  marginTop: "14px",
};

const trackHeader = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "flex-start",
};

const infoGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: "12px",
  marginTop: "18px",
};

const trackInfoGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: "10px",
  marginTop: "18px",
};

const infoBox = {
  background: "#0B1020",
  border:
    "1px solid #1F2937",
  borderRadius: "10px",
  padding: "12px",
};

const infoLabel = {
  color: "#64748B",
  fontSize: "12px",
  marginBottom: "5px",
};

const infoValue = {
  color: "#E2E8F0",
  fontSize: "14px",
  wordBreak:
    "break-word" as const,
};

const dspBox = {
  background: "#0B1020",
  border:
    "1px solid #1F2937",
  borderRadius: "14px",
  padding: "14px",
  marginTop: "12px",
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
};

const noteBox = {
  marginTop: "16px",
  background: "#451A03",
  color: "#FBBF24",
  padding: "14px",
  borderRadius: "12px",
};

const loadingBox = {
  padding: "40px",
};

const errorBox = {
  background: "#450A0A",
  border:
    "1px solid #7F1D1D",
  padding: "25px",
  borderRadius: "15px",
};