"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent, CSSProperties, ReactNode } from "react";
import SparkMD5 from "spark-md5";

import { supabase } from "@/lib/supabase";

/* ======================================================
   TYPES
====================================================== */

type VideoInfo = {
  duration: number;
  width: number;
  height: number;
};

type DeliveryState = {
  appleMusic: boolean;
  boomplay: boolean;
  spotify: boolean;
  tidal: boolean;
  vevo: boolean;
  youtubeVideo: boolean;
};

/* ======================================================
   HELPERS
====================================================== */

function clean(value: unknown) {
  return String(value ?? "").trim();
}

async function calculateMD5(file: File) {
  const buffer = await file.arrayBuffer();

  return SparkMD5.ArrayBuffer.hash(buffer);
}

async function getVideoInfo(file: File): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    video.preload = "metadata";

    video.onloadedmetadata = () => {
      const duration = Number(video.duration || 0);
      const width = Number(video.videoWidth || 0);
      const height = Number(video.videoHeight || 0);

      URL.revokeObjectURL(objectUrl);

      if (!duration || !width || !height) {
        reject(new Error("Video metadata read nahi ho saka."));
        return;
      }

      resolve({
        duration,
        width,
        height,
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);

      reject(new Error("Video file read nahi ho saka."));
    };

    video.src = objectUrl;
  });
}

/* ======================================================
   PAGE
====================================================== */

export default function VideoUploadPage() {
  /*
   * Too Lost MusicVideo draft ID.
   * User manually enter nahi karega.
   * Draft create hone ke baad yahan save hoga.
   */
  const [releaseId, setReleaseId] = useState("");

  /*
   * Release metadata.
   */
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [label, setLabel] = useState("");

  /*
   * Credits.
   */
  const [composer, setComposer] = useState("");
  const [lyricist, setLyricist] = useState("");

  /*
   * Video.
   */
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const [videoType, setVideoType] = useState(
    "official_music_video"
  );

  const [ageRestriction, setAgeRestriction] = useState(
    "all_ages"
  );

  const [isCoverVersion, setIsCoverVersion] = useState(false);

  const [referenceUpc, setReferenceUpc] = useState("");
  const [referenceIsrc, setReferenceIsrc] = useState("");

  /*
   * Technical metadata.
   */
  const [audioChannels, setAudioChannels] = useState("2");
  const [audioCodec, setAudioCodec] = useState("aac");
  const [audioSampleRate, setAudioSampleRate] = useState("48000");
  const [videoCodec, setVideoCodec] = useState("h264");

  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(
    null
  );

  const [md5hash, setMd5hash] = useState("");

  /*
   * Delivery.
   */
  const [delivery, setDelivery] = useState<DeliveryState>({
    appleMusic: false,
    boomplay: false,
    spotify: false,
    tidal: false,
    vevo: true,
    youtubeVideo: false,
  });

  /*
   * Status.
   */
  const [processing, setProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  /* ====================================================
     DELIVERY COUNT
  ==================================================== */

  const selectedDeliveryCount = useMemo(() => {
    return Object.values(delivery).filter(Boolean).length;
  }, [delivery]);

  /* ====================================================
     VIDEO SELECT
  ==================================================== */

  async function handleVideoSelect(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSuccessMessage("");
    setErrorMessage("");
    setProgressMessage("");

    if (!/\.mp4$/i.test(file.name)) {
      alert("Abhi sirf MP4 video allowed hai.");

      event.target.value = "";
      return;
    }

    setVideoFile(file);
    setVideoInfo(null);
    setMd5hash("");

    try {
      setProgressMessage("Reading video information...");

      const info = await getVideoInfo(file);

      setVideoInfo(info);

      setProgressMessage("Calculating MD5...");

      const hash = await calculateMD5(file);

      setMd5hash(hash);

      setProgressMessage("Video ready.");
    } catch (error) {
      console.error(error);

      setVideoFile(null);
      setVideoInfo(null);
      setMd5hash("");

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Video processing failed."
      );

      setProgressMessage("Failed.");
    }
  }

  /* ====================================================
     DELIVERY
  ==================================================== */

  function toggleDelivery(key: keyof DeliveryState) {
    setDelivery((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));
  }

  /* ====================================================
     VIDEO -> SUPABASE
  ==================================================== */

  async function uploadVideo(file: File) {
    const cleanName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_");

    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}-${cleanName}`;

    const { error } = await supabase.storage
      .from("release-video")
      .upload(fileName, file, {
        contentType: file.type || "video/mp4",
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = supabase.storage
      .from("release-video")
      .getPublicUrl(fileName);

    if (!data.publicUrl) {
      throw new Error("Video public URL missing.");
    }

    return data.publicUrl;
  }

  /* ====================================================
     CREATE MUSIC VIDEO DRAFT
  ==================================================== */

  async function createMusicVideoDraft(accessToken: string) {
    const response = await fetch(
      "/api/toolost/releases/create-video",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },

        body: JSON.stringify({
          title: clean(title),
          artist: clean(artist),
          label: clean(label),
        }),
      }
    );

    const text = await response.text();

    let data: any = {};

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `MusicVideo create API returned non-JSON (${response.status}).`
      );
    }

    if (!response.ok || !data.success) {
      throw new Error(
        data.error ||
          data?.tooLostResponse?.message ||
          "MusicVideo draft creation failed."
      );
    }

    if (!data.releaseId) {
      throw new Error(
        "MusicVideo draft create hua lekin Release ID missing hai."
      );
    }

    return String(data.releaseId);
  }

  /* ====================================================
     SUBMIT
  ==================================================== */

  async function submitVideo() {
    if (processing) {
      return;
    }

    setSuccessMessage("");
    setErrorMessage("");

    /*
     * -------------------------------------
     * AUTH
     * -------------------------------------
     */

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setErrorMessage("Admin login required.");
      return;
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      setErrorMessage(profileError.message);
      return;
    }

    const allowedRoles = [
      "master_admin",
      "admin",
      "white_label_admin",
    ];

    if (
      !profile ||
      !allowedRoles.includes(String(profile.role || ""))
    ) {
      setErrorMessage("Admin permission required.");
      return;
    }

    const { data: sessionData } =
      await supabase.auth.getSession();

    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setErrorMessage("Admin session token missing.");
      return;
    }

    /*
     * -------------------------------------
     * VALIDATION
     * -------------------------------------
     */

    if (!clean(title)) {
      setErrorMessage("Title required.");
      return;
    }

    if (!clean(artist)) {
      setErrorMessage("Artist Name required.");
      return;
    }

    if (!clean(label)) {
      setErrorMessage("Label required.");
      return;
    }

    if (!clean(composer)) {
      setErrorMessage("Composer required.");
      return;
    }

    if (!videoFile) {
      setErrorMessage("Video file select karo.");
      return;
    }

    if (!md5hash) {
      setErrorMessage(
        "Video MD5 abhi ready nahi hai. Thoda wait karo."
      );
      return;
    }

    if (!videoInfo) {
      setErrorMessage("Video metadata missing.");
      return;
    }

    if (selectedDeliveryCount === 0) {
      setErrorMessage(
        "Kam se kam ek video platform select karo."
      );
      return;
    }

    const channels = Number(audioChannels);
    const sampleRate = Number(audioSampleRate);

    if (!Number.isFinite(channels) || channels < 1) {
      setErrorMessage("Invalid audio channels.");
      return;
    }

    if (!Number.isFinite(sampleRate) || sampleRate < 1) {
      setErrorMessage("Invalid audio sample rate.");
      return;
    }

    /*
     * -------------------------------------
     * PROCESS
     * -------------------------------------
     */

    setProcessing(true);

    try {
      /*
       * STEP 1
       *
       * Create actual Too Lost MusicVideo draft.
       *
       * releaseId already available ho to
       * retry ke time duplicate draft create nahi hoga.
       */

      let finalReleaseId = releaseId;

      if (!finalReleaseId) {
        setProgressMessage(
          "Creating Too Lost MusicVideo draft..."
        );

        finalReleaseId = await createMusicVideoDraft(
          accessToken
        );

        setReleaseId(finalReleaseId);

        setProgressMessage(
          `MusicVideo draft created: ${finalReleaseId}`
        );
      } else {
        setProgressMessage(
          `Using existing MusicVideo draft: ${finalReleaseId}`
        );
      }

      /*
       * STEP 2
       *
       * Upload MP4 to Supabase.
       */

      setProgressMessage(
        "Uploading video to storage..."
      );

      const videoUrl = await uploadVideo(videoFile);

      /*
       * STEP 3
       *
       * PATCH actual MusicVideo draft.
       */

      setProgressMessage(
        "Sending Music Video metadata to Too Lost..."
      );

      const response = await fetch(
        "/api/toolost/releases/video",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },

          body: JSON.stringify({
            releaseId: finalReleaseId,

            artist: clean(artist),

            composer: clean(composer),

            lyricist:
              clean(lyricist) || undefined,

            videoUrl,

            md5hash,

            videoType,

            ageRestriction,

            isCoverVersion,

            referenceUpc:
              clean(referenceUpc) || undefined,

            referenceIsrc:
              clean(referenceIsrc) || undefined,

            /*
             * Delivery
             */

            appleMusic: delivery.appleMusic,
            boomplay: delivery.boomplay,
            spotify: delivery.spotify,
            tidal: delivery.tidal,
            vevo: delivery.vevo,
            youtubeVideo: delivery.youtubeVideo,

            /*
             * Audio metadata
             */

            audioChannels: channels,
            audioCodec: clean(audioCodec),
            audioSampleRate: sampleRate,

            /*
             * Video metadata
             */

            videoCodec: clean(videoCodec),

            videoDuration: videoInfo.duration,

            videoHeight: videoInfo.height,
            videoWidth: videoInfo.width,
          }),
        }
      );

      const text = await response.text();

      let data: any = {};

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Too Lost video API returned non-JSON (${response.status}).`
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            data?.tooLostResponse?.message ||
            "Too Lost video update failed."
        );
      }

      setProgressMessage("Music Video saved.");

      setSuccessMessage(
        `Success! Too Lost MusicVideo release ${finalReleaseId} me video save ho gaya.`
      );
    } catch (error) {
      console.error("Video upload failed:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Video upload failed."
      );

      setProgressMessage("Failed.");
    } finally {
      setProcessing(false);
    }
  }

  /* ====================================================
     RESET / NEW RELEASE
  ==================================================== */

  function startNewRelease() {
    if (processing) {
      return;
    }

    setReleaseId("");
    setTitle("");
    setArtist("");
    setLabel("");
    setComposer("");
    setLyricist("");

    setVideoFile(null);
    setVideoInfo(null);
    setMd5hash("");

    setReferenceUpc("");
    setReferenceIsrc("");
    setIsCoverVersion(false);

    setProgressMessage("");
    setSuccessMessage("");
    setErrorMessage("");
  }

  /* ====================================================
     UI
  ==================================================== */

  return (
    <main style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <div style={labelBadge}>
            MUSIC VIDEO
          </div>

          <h1
            style={{
              margin: "10px 0 4px",
            }}
          >
            Music Video / VEVO
          </h1>

          <p style={muted}>
            Create a Too Lost MusicVideo draft and attach the
            video automatically.
          </p>
        </div>

        <div style={adminBadge}>
          ADMIN
        </div>
      </div>

      {/* =================================================
          RELEASE
      ================================================= */}

      <section style={card}>
        <h2>
          1. Music Video Release
        </h2>

        <div style={technicalGrid}>
          <Field>
            <label style={labelStyle}>
              Title *
            </label>

            <input
              value={title}
              disabled={processing || !!releaseId}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="Example: Dil Ki Baat"
              style={inputStyle}
            />
          </Field>

          <Field>
            <label style={labelStyle}>
              Artist Name *
            </label>

            <input
              value={artist}
              disabled={processing || !!releaseId}
              onChange={(event) =>
                setArtist(event.target.value)
              }
              placeholder="Example: Seema Raj"
              style={inputStyle}
            />
          </Field>

          <Field>
            <label style={labelStyle}>
              Label *
            </label>

            <input
              value={label}
              disabled={processing || !!releaseId}
              onChange={(event) =>
                setLabel(event.target.value)
              }
              placeholder="Example: ZENKAI"
              style={inputStyle}
            />
          </Field>
        </div>

        {releaseId && (
          <div style={successBox}>
            MusicVideo Draft Created — Too Lost Release ID:{" "}
            <strong>{releaseId}</strong>
          </div>
        )}
      </section>

      {/* =================================================
          CREDITS
      ================================================= */}

      <section style={card}>
        <h2>
          2. Music Credits
        </h2>

        <div style={twoColumn}>
          <Field>
            <label style={labelStyle}>
              Composer *
            </label>

            <input
              value={composer}
              disabled={processing}
              onChange={(event) =>
                setComposer(event.target.value)
              }
              placeholder="Example: Sonu Kumar"
              style={inputStyle}
            />
          </Field>

          <Field>
            <label style={labelStyle}>
              Lyricist
            </label>

            <input
              value={lyricist}
              disabled={processing}
              onChange={(event) =>
                setLyricist(event.target.value)
              }
              placeholder="Example: Ankit Kumar"
              style={inputStyle}
            />
          </Field>
        </div>

        <p style={helper}>
          Composer aur Lyricist same person ho sakte hain.
          Backend duplicate writer ko combine karega.
        </p>
      </section>

      {/* =================================================
          VIDEO
      ================================================= */}

      <section style={card}>
        <h2>
          3. Video File
        </h2>

        <input
          type="file"
          accept=".mp4,video/mp4"
          disabled={processing}
          onChange={handleVideoSelect}
        />

        {videoFile && (
          <div style={infoGrid}>
            <InfoBox
              label="File"
              value={videoFile.name}
            />

            <InfoBox
              label="Size"
              value={`${(
                videoFile.size /
                1024 /
                1024
              ).toFixed(2)} MB`}
            />

            <InfoBox
              label="MD5"
              value={
                md5hash ||
                "Calculating..."
              }
            />

            <InfoBox
              label="Resolution"
              value={
                videoInfo
                  ? `${videoInfo.width}x${videoInfo.height}`
                  : "Reading..."
              }
            />

            <InfoBox
              label="Duration"
              value={
                videoInfo
                  ? `${videoInfo.duration.toFixed(2)} sec`
                  : "Reading..."
              }
            />
          </div>
        )}
      </section>

      {/* =================================================
          SETTINGS
      ================================================= */}

      <section style={card}>
        <h2>
          4. Video Settings
        </h2>

        <div style={twoColumn}>
          <Field>
            <label style={labelStyle}>
              Video Type
            </label>

            <select
              value={videoType}
              disabled={processing}
              onChange={(event) =>
                setVideoType(event.target.value)
              }
              style={inputStyle}
            >
              <option value="official_music_video">
                Official Music Video
              </option>

              <option value="performance_video">
                Performance Video
              </option>
            </select>
          </Field>

          <Field>
            <label style={labelStyle}>
              Age Restriction
            </label>

            <select
              value={ageRestriction}
              disabled={processing}
              onChange={(event) =>
                setAgeRestriction(event.target.value)
              }
              style={inputStyle}
            >
              <option value="all_ages">
                All Ages
              </option>

              <option value="18_plus">
                18 Plus
              </option>
            </select>
          </Field>
        </div>

        <label style={checkboxRow}>
          <input
            type="checkbox"
            checked={isCoverVersion}
            disabled={processing}
            onChange={(event) =>
              setIsCoverVersion(event.target.checked)
            }
          />

          This is a cover version
        </label>

        {isCoverVersion && (
          <div
            style={{
              ...twoColumn,
              marginTop: "16px",
            }}
          >
            <Field>
              <label style={labelStyle}>
                Reference UPC
              </label>

              <input
                value={referenceUpc}
                disabled={processing}
                onChange={(event) =>
                  setReferenceUpc(event.target.value)
                }
                style={inputStyle}
              />
            </Field>

            <Field>
              <label style={labelStyle}>
                Reference ISRC
              </label>

              <input
                value={referenceIsrc}
                disabled={processing}
                onChange={(event) =>
                  setReferenceIsrc(event.target.value)
                }
                style={inputStyle}
              />
            </Field>
          </div>
        )}
      </section>

      {/* =================================================
          DELIVERY
      ================================================= */}

      <section style={card}>
        <h2>
          5. Video Distribution
        </h2>

        <p style={muted}>
          Too Lost Music Video delivery targets.
        </p>

        <div style={deliveryGrid}>
          <DeliveryBox
            label="VEVO"
            checked={delivery.vevo}
            disabled={processing}
            onClick={() =>
              toggleDelivery("vevo")
            }
          />

          <DeliveryBox
            label="Apple Music"
            checked={delivery.appleMusic}
            disabled={processing}
            onClick={() =>
              toggleDelivery("appleMusic")
            }
          />

          <DeliveryBox
            label="Spotify"
            checked={delivery.spotify}
            disabled={processing}
            onClick={() =>
              toggleDelivery("spotify")
            }
          />

          <DeliveryBox
            label="Tidal"
            checked={delivery.tidal}
            disabled={processing}
            onClick={() =>
              toggleDelivery("tidal")
            }
          />

          <DeliveryBox
            label="Boomplay"
            checked={delivery.boomplay}
            disabled={processing}
            onClick={() =>
              toggleDelivery("boomplay")
            }
          />

          <DeliveryBox
            label="YouTube Video"
            checked={delivery.youtubeVideo}
            disabled={processing}
            onClick={() =>
              toggleDelivery("youtubeVideo")
            }
          />
        </div>
      </section>

      {/* =================================================
          TECHNICAL
      ================================================= */}

      <section style={card}>
        <h2>
          6. Technical Metadata
        </h2>

        <div style={technicalGrid}>
          <Field>
            <label style={labelStyle}>
              Audio Channels
            </label>

            <input
              type="number"
              value={audioChannels}
              onChange={(event) =>
                setAudioChannels(event.target.value)
              }
              disabled={processing}
              style={inputStyle}
            />
          </Field>

          <Field>
            <label style={labelStyle}>
              Audio Codec
            </label>

            <input
              value={audioCodec}
              onChange={(event) =>
                setAudioCodec(event.target.value)
              }
              disabled={processing}
              style={inputStyle}
            />
          </Field>

          <Field>
            <label style={labelStyle}>
              Sample Rate
            </label>

            <input
              type="number"
              value={audioSampleRate}
              onChange={(event) =>
                setAudioSampleRate(event.target.value)
              }
              disabled={processing}
              style={inputStyle}
            />
          </Field>

          <Field>
            <label style={labelStyle}>
              Video Codec
            </label>

            <input
              value={videoCodec}
              onChange={(event) =>
                setVideoCodec(event.target.value)
              }
              disabled={processing}
              style={inputStyle}
            />
          </Field>

          <Field>
            <label style={labelStyle}>
              Width
            </label>

            <input
              readOnly
              value={videoInfo?.width || ""}
              style={inputStyle}
            />
          </Field>

          <Field>
            <label style={labelStyle}>
              Height
            </label>

            <input
              readOnly
              value={videoInfo?.height || ""}
              style={inputStyle}
            />
          </Field>
        </div>
      </section>

      {/* =================================================
          SUBMIT
      ================================================= */}

      <section style={submitCard}>
        <div>
          <strong>
            Selected Platforms:{" "}
            {selectedDeliveryCount}
          </strong>

          {progressMessage && (
            <div style={helper}>
              {progressMessage}
            </div>
          )}

          {successMessage && (
            <div style={successBox}>
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div style={errorBox}>
              {errorMessage}
            </div>
          )}
        </div>

        <div style={buttonRow}>
          {releaseId && !processing && (
            <button
              type="button"
              onClick={startNewRelease}
              style={secondaryButton}
            >
              New Music Video
            </button>
          )}

          <button
            type="button"
            disabled={processing}
            onClick={submitVideo}
            style={{
              ...primaryButton,
              opacity: processing ? 0.55 : 1,
            }}
          >
            {processing
              ? "Processing..."
              : releaseId
              ? "Retry / Save Video"
              : "Create & Save Music Video"}
          </button>
        </div>
      </section>
    </main>
  );
}

/* ======================================================
   COMPONENTS
====================================================== */

function Field({
  children,
}: {
  children: ReactNode;
}) {
  return <div>{children}</div>;
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={infoBox}>
      <div style={helper}>
        {label}
      </div>

      <div
        style={{
          marginTop: "5px",
          fontWeight: 700,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DeliveryBox({
  label,
  checked,
  disabled,
  onClick,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...deliveryBox,

        borderColor: checked
          ? "#2563EB"
          : "#26364A",

        background: checked
          ? "rgba(37,99,235,0.18)"
          : "#0B1220",

        opacity: disabled
          ? 0.55
          : 1,
      }}
    >
      <span
        style={{
          ...deliveryCheck,

          background: checked
            ? "#2563EB"
            : "transparent",
        }}
      >
        {checked ? "✓" : ""}
      </span>

      {label}
    </button>
  );
}

/* ======================================================
   STYLES
====================================================== */

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "28px",
  background: "#050816",
  color: "#F8FAFC",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "22px",
};

const card: CSSProperties = {
  background: "#0F172A",
  border: "1px solid #1E293B",
  borderRadius: "14px",
  padding: "20px",
  marginBottom: "18px",
};

const submitCard: CSSProperties = {
  ...card,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
};

const muted: CSSProperties = {
  color: "#94A3B8",
};

const helper: CSSProperties = {
  color: "#94A3B8",
  fontSize: "12px",
  marginTop: "7px",
};

const labelStyle: CSSProperties = {
  display: "block",
  color: "#CBD5E1",
  fontSize: "13px",
  marginBottom: "7px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: "43px",
  background: "#020617",
  border: "1px solid #334155",
  borderRadius: "9px",
  padding: "0 12px",
  color: "#F8FAFC",
  outline: "none",
  boxSizing: "border-box",
};

const twoColumn: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: "16px",
};

const technicalGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3,minmax(0,1fr))",
  gap: "16px",
};

const infoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5,minmax(0,1fr))",
  gap: "12px",
  marginTop: "18px",
};

const infoBox: CSSProperties = {
  padding: "13px",
  background: "#020617",
  border: "1px solid #1E293B",
  borderRadius: "10px",
};

const checkboxRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "9px",
  marginTop: "18px",
  fontSize: "13px",
};

const deliveryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3,minmax(0,1fr))",
  gap: "12px",
  marginTop: "16px",
};

const deliveryBox: CSSProperties = {
  minHeight: "55px",
  display: "flex",
  alignItems: "center",
  gap: "11px",
  border: "1px solid #26364A",
  borderRadius: "10px",
  padding: "0 14px",
  color: "#FFFFFF",
  cursor: "pointer",
  fontWeight: 700,
  textAlign: "left",
};

const deliveryCheck: CSSProperties = {
  width: "20px",
  height: "20px",
  border: "1px solid #64748B",
  borderRadius: "5px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#FFFFFF",
  flexShrink: 0,
};

const buttonRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const primaryButton: CSSProperties = {
  minWidth: "190px",
  minHeight: "46px",
  padding: "0 18px",
  border: "none",
  borderRadius: "10px",
  background: "#2563EB",
  color: "#FFFFFF",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButton: CSSProperties = {
  minHeight: "46px",
  padding: "0 16px",
  border: "1px solid #475569",
  borderRadius: "10px",
  background: "#0F172A",
  color: "#E2E8F0",
  fontWeight: 700,
  cursor: "pointer",
};

const labelBadge: CSSProperties = {
  display: "inline-block",
  padding: "5px 9px",
  border: "1px solid rgba(59,130,246,.4)",
  borderRadius: "999px",
  color: "#60A5FA",
  fontSize: "10px",
  fontWeight: 800,
};

const adminBadge: CSSProperties = {
  padding: "7px 12px",
  borderRadius: "999px",
  background: "#1D4ED8",
  fontSize: "11px",
  fontWeight: 800,
};

const successBox: CSSProperties = {
  marginTop: "10px",
  padding: "10px 12px",
  borderRadius: "8px",
  background: "rgba(22,101,52,.22)",
  border: "1px solid #166534",
  color: "#86EFAC",
  fontSize: "13px",
};

const errorBox: CSSProperties = {
  marginTop: "10px",
  padding: "10px 12px",
  borderRadius: "8px",
  background: "rgba(153,27,27,.22)",
  border: "1px solid #991B1B",
  color: "#FCA5A5",
  fontSize: "13px",
};