"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

type TrackInput = {
  title: string;
  isrc: string;
  auto_isrc: boolean;
  previous_isrc_enabled: boolean;
  previous_isrc: string;
  composer: string;
  lyricist: string;
  producer: string;
  publisher: string;
  version: string;
  language: string;
  content_type: string;
  explicit: boolean;
  audio: File | null;
};

const emptyTrack: TrackInput = {
  title: "",
  isrc: "",
  auto_isrc: true,
  previous_isrc_enabled: false,
  previous_isrc: "",
  composer: "",
  lyricist: "",
  producer: "",
  publisher: "",
  version: "",
  language: "",
  content_type: "original",
  explicit: false,
  audio: null,
};

const steps = ["Release", "Files", "Recordings", "Authors", "Lyrics", "Cover", "Distribution", "Confirm"];

const genreOptions = [
  "Pop","Hip Hop","Rap","Rock","Dance","Electronic","EDM","House","Techno","Trance",
  "R&B","Soul","Jazz","Blues","Classical","Folk","Traditional","Devotional","Bhajan",
  "Ghazal","Qawwali","Bhojpuri","Bollywood","Punjabi","Bengali","Tamil","Telugu",
  "Malayalam","Kannada","Marathi","Gujarati","Afrobeats","Amapiano","Reggae",
  "Dancehall","Latin","Country","Lofi","Instrumental","Soundtrack","World"
];

const languageOptions = [
  "Hindi","English","Bengali","Bhojpuri","Punjabi","Urdu","Tamil","Telugu","Malayalam",
  "Kannada","Marathi","Gujarati","Odia","Assamese","Nepali","Arabic","Spanish","French",
  "Portuguese","German","Italian","Russian","Chinese","Japanese","Korean","Yoruba",
  "Igbo","Hausa","Swahili","Zulu","Turkish","Persian","Other"
];

const dspOptions = [
  "Spotify","Apple Music","YouTube Music","Amazon Music","Deezer","TikTok","Meta / Facebook",
  "Instagram","JioSaavn","Gaana","Wynk","Boomplay","Audiomack"
];

const countryOptions = [
  "Worldwide","India","United States","United Kingdom","Nigeria","Bangladesh","Pakistan",
  "Nepal","UAE","Saudi Arabia","Canada","Australia"
];

export default function NewReleasePage() {
  const router = useRouter();

  const [activeStep, setActiveStep] = useState("Release");
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [artists, setArtists] = useState<string[]>([""]);
  const [labelName, setLabelName] = useState("");
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [musicCreatedDate, setMusicCreatedDate] = useState("");
  const [upc, setUpc] = useState("");
  const [autoUpc, setAutoUpc] = useState(true);
  const [previousUpc, setPreviousUpc] = useState("");
  const [releaseType, setReleaseType] = useState("single");
  const [musicType, setMusicType] = useState("original");
  const [previouslyReleased, setPreviouslyReleased] = useState(false);
  const [contentIdRequired, setContentIdRequired] = useState(false);
  const [lyricsText, setLyricsText] = useState("");

  const [artwork, setArtwork] = useState<File | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [tracks, setTracks] = useState<TrackInput[]>([{ ...emptyTrack }]);

  const [selectedDSPs, setSelectedDSPs] = useState<string[]>([
    "Spotify",
    "Apple Music",
    "YouTube Music",
    "Amazon Music",
  ]);

  const [selectedCountries, setSelectedCountries] = useState<string[]>(["Worldwide"]);

  const artworkPreview = useMemo(() => {
    if (!artwork) return "";
    return URL.createObjectURL(artwork);
  }, [artwork]);

  const mainArtist = artists.filter(Boolean).join(", ");

  const completion = useMemo(() => {
    let score = 0;
    if (title) score += 10;
    if (mainArtist) score += 10;
    if (labelName) score += 8;
    if (genre) score += 8;
    if (language) score += 8;
    if (releaseDate) score += 8;
    if (musicCreatedDate) score += 8;
    if (artwork) score += 12;
    if (tracks.every((t) => t.title && t.audio)) score += 18;
    if (selectedDSPs.length > 0) score += 5;
    if (selectedCountries.length > 0) score += 5;
    return Math.min(score, 100);
  }, [title, mainArtist, labelName, genre, language, releaseDate, musicCreatedDate, artwork, tracks, selectedDSPs, selectedCountries]);

  function getStepIndex() {
    return steps.indexOf(activeStep);
  }

  function goNext() {
    const index = getStepIndex();
    if (index < steps.length - 1) setActiveStep(steps[index + 1]);
  }

  function goBackStep() {
    const index = getStepIndex();
    if (index > 0) setActiveStep(steps[index - 1]);
  }

  async function uploadFile(bucket: string, file: File) {
    const cleanName = file.name.replace(/\s+/g, "-");
    const fileName = `${Date.now()}-${cleanName}`;
    const { error } = await supabase.storage.from(bucket).upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  }

  function toggleCountry(country: string) {
    if (country === "Worldwide") {
      setSelectedCountries(["Worldwide"]);
      return;
    }

    let next = selectedCountries.filter((c) => c !== "Worldwide");

    if (next.includes(country)) {
      next = next.filter((c) => c !== country);
    } else {
      next.push(country);
    }

    setSelectedCountries(next.length ? next : ["Worldwide"]);
  }

  function toggleDsp(dsp: string) {
    setSelectedDSPs((prev) =>
      prev.includes(dsp) ? prev.filter((item) => item !== dsp) : [...prev, dsp]
    );
  }

  function updateArtist(index: number, value: string) {
    setArtists((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  function addArtist() {
    setArtists((prev) => [...prev, ""]);
  }

  function removeArtist(index: number) {
    if (artists.length === 1) return;
    setArtists((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTrack(index: number, field: keyof TrackInput, value: string | boolean | File | null) {
    setTracks((prev) => prev.map((track, i) => (i === index ? { ...track, [field]: value } : track)));
  }

  function addTrack() {
    setTracks((prev) => [...prev, { ...emptyTrack }]);
  }

  function removeTrack(index: number) {
    if (tracks.length === 1) {
      alert("At least one track is required.");
      return;
    }
    setTracks((prev) => prev.filter((_, i) => i !== index));
  }

  function addPersonField(index: number, field: keyof TrackInput) {
    const current = String(tracks[index][field] || "");
    updateTrack(index, field, current ? `${current}, ` : "");
  }

  function copyFirstTrackMetadata() {
    const first = tracks[0];
    setTracks((prev) =>
      prev.map((track, index) =>
        index === 0
          ? track
          : {
              ...track,
              composer: first.composer,
              lyricist: first.lyricist,
              producer: first.producer,
              publisher: first.publisher,
              language: first.language,
              content_type: first.content_type,
              explicit: first.explicit,
            }
      )
    );
    alert("First track metadata copied to all tracks.");
  }

  function handlePreviouslyReleased(value: boolean) {
    setPreviouslyReleased(value);
    if (value) {
      setAutoUpc(false);
      setUpc("");
    }
  }

  function validateArtwork(file: File) {
    return new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (img.width !== 3000 || img.height !== 3000) {
          alert("Cover image 3000x3000 hona chahiye. Pehle image ko 3000x3000 me convert karo.");
          setArtwork(null);
          resolve(false);
        } else {
          resolve(true);
        }
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    });
  }

  async function handleArtwork(file: File | null) {
    if (!file) {
      setArtwork(null);
      return;
    }

    const valid = await validateArtwork(file);
    if (valid) setArtwork(file);
  }

  function validateBeforeSubmit() {
    if (!title) return "Title required hai.";
    if (!mainArtist) return "Kam se kam ek release artist add karo.";
    if (!labelName) return "Label name required hai.";
    if (!genre) return "Genre select karo.";
    if (!language) return "Language select karo.";
    if (!releaseDate) return "Release date select karo.";
    if (!musicCreatedDate) return "Music created date select karo.";
    if (previouslyReleased && !previousUpc) return "Previously released music ke liye old UPC required hai.";
    if (!autoUpc && !upc && !previouslyReleased) return "UPC daalo ya Auto UPC tick karo.";
    if (!artwork) return "3000x3000 cover artwork upload karo.";
    if (selectedDSPs.length === 0) return "Kam se kam ek DSP select karo.";
    if (selectedCountries.length === 0) return "Country select karo.";

    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (!t.title) return `Track ${i + 1} title required hai.`;
      if (!t.audio) return `Track ${i + 1} audio upload karo.`;
      if (!t.auto_isrc && !t.isrc) return `Track ${i + 1} me ISRC daalo ya Auto ISRC tick karo.`;
      if (t.previous_isrc_enabled && !t.previous_isrc) return `Track ${i + 1} ka Previous ISRC daalo.`;
    }

    return "";
  }

  async function submitRelease(e: FormEvent) {
  e.preventDefault();

  const validationError = validateBeforeSubmit();

  if (validationError) {
    alert(validationError);
    return;
  }

  setLoading(true);

  try {
    // -----------------------------------------
    // LOGIN CHECK
    // -----------------------------------------

    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      alert("Please login first.");
      router.push("/login");
      return;
    }

    // -----------------------------------------
    // PROFILE
    // -----------------------------------------

    const { data: profile } = await supabase
      .from("profiles")
      .select("white_label_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    // -----------------------------------------
    // UPC
    // -----------------------------------------

    const generatedUpc = autoUpc
      ? `NX${Date.now().toString().slice(-10)}`
      : upc;

    // -----------------------------------------
    // TOO LOST CONNECTION
    // -----------------------------------------

    alert("Creating release on Too Lost...");

    const meResponse = await fetch(
      "/api/toolost/me",
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const meText = await meResponse.text();

    let meData: any;

    try {
      meData = JSON.parse(meText);
    } catch {
      throw new Error(
        `Too Lost connection check failed: ${meText.slice(
          0,
          500
        )}`
      );
    }

    if (
      !meResponse.ok ||
      !meData.connected
    ) {
      throw new Error(
        "Too Lost is not connected. Please connect Too Lost first."
      );
    }

    // -----------------------------------------
    // CREATE TOO LOST RELEASE
    // -----------------------------------------

    const tooLostReleaseResponse =
      await fetch(
        "/api/toolost/releases/create",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            title,

            type:
              releaseType === "album"
                ? "Album"
                : releaseType === "ep"
                ? "EP"
                : "Single",

            label: labelName,

            artistName:
              artists
                .filter(Boolean)
                .join(", "),

            role: "primary",
          }),
        }
      );

    const tooLostReleaseText =
      await tooLostReleaseResponse.text();

    let tooLostReleaseData: any;

    try {
      tooLostReleaseData =
        JSON.parse(
          tooLostReleaseText
        );
    } catch {
      throw new Error(
        `Too Lost release API returned non-JSON (${tooLostReleaseResponse.status}): ${tooLostReleaseText.slice(
          0,
          1000
        )}`
      );
    }

    if (
      !tooLostReleaseResponse.ok ||
      !tooLostReleaseData.success
    ) {
      throw new Error(
        tooLostReleaseData.error ||
          JSON.stringify(
            tooLostReleaseData
          )
      );
    }

    const tooLostRelease =
      tooLostReleaseData?.data?.data ??
      tooLostReleaseData?.data ??
      tooLostReleaseData;

    const tooLostReleaseId =
      tooLostRelease?.id;

    if (!tooLostReleaseId) {
      throw new Error(
        "Too Lost did not return a release ID."
      );
    }

    console.log(
      "Too Lost release created:",
      tooLostReleaseId
    );

    // -----------------------------------------
    // ARTWORK → SUPABASE
    // -----------------------------------------

    const artworkUrl =
      await uploadFile(
        "release-artwork",
        artwork as File
      );

    let licenseUrl = "";

    if (licenseFile) {
      licenseUrl =
        await uploadFile(
          "release-artwork",
          licenseFile
        );
    }

    // -----------------------------------------
    // SAVE RELEASE TO SUPABASE
    // -----------------------------------------

    const {
      data: releaseData,
      error: releaseError,
    } = await supabase
      .from("releases")
      .insert({
        user_id:
          userData.user.id,

        white_label_id:
          profile?.white_label_id ||
          null,

        title,

        subtitle: version,

        version,

        release_artists:
          artists.filter(Boolean),

        artist_name:
          mainArtist,

        label_name:
          labelName,

        genre,

        language,

        release_date:
          releaseDate,

        music_created_date:
          musicCreatedDate || null,

        music_type:
          musicType,

        previously_released:
          previouslyReleased,

        previous_upc:
          previouslyReleased
            ? previousUpc
            : null,

        content_id_required:
          contentIdRequired,

        selected_dsps:
          selectedDSPs,

        selected_countries:
          selectedCountries,

        license_url:
          licenseUrl || null,

        lyrics_text:
          lyricsText,

        upc:
          generatedUpc,

        auto_upc:
          generatedUpc,

        release_type:
          releaseType,

        artwork_url:
          artworkUrl,

        toolost_release_id:
          String(
            tooLostReleaseId
          ),

        status: "draft",
      })
      .select()
      .single();

    if (releaseError) {
      throw releaseError;
    }

    // -----------------------------------------
    // TRACK UPLOADS
    // -----------------------------------------

    for (
      let i = 0;
      i < tracks.length;
      i++
    ) {
      const track =
        tracks[i];

      if (!track.audio) {
        throw new Error(
          `Track ${i + 1} audio is missing.`
        );
      }

      // -----------------------------------------
      // UPLOAD AUDIO TO SUPABASE
      // -----------------------------------------

      alert(
        `Uploading track ${i + 1} of ${tracks.length} to Supabase...`
      );

      const audioUrl =
        await uploadFile(
          "release-audio",
          track.audio
        );

      if (!audioUrl) {
        throw new Error(
          `Track ${i + 1}: Supabase audio upload failed.`
        );
      }

      console.log(
        "Supabase audio uploaded:",
        audioUrl
      );

      // -----------------------------------------
      // VERCEL SERVER → TOO LOST
      // -----------------------------------------

      alert(
        `Uploading track ${i + 1} of ${tracks.length} to Too Lost...`
      );

      const serverUploadResponse =
        await fetch(
          "/api/toolost/upload-audio",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              releaseId:
                tooLostReleaseId,

              fileName:
                track.audio.name,

              contentType:
                track.audio.type ||
                "audio/wav",

              audioUrl,
            }),
          }
        );

      const serverUploadText =
        await serverUploadResponse.text();

      let serverUploadData: any;

      try {
        serverUploadData =
          JSON.parse(
            serverUploadText
          );
      } catch {
        throw new Error(
          `Server upload returned non-JSON (${serverUploadResponse.status}): ${serverUploadText.slice(
            0,
            1000
          )}`
        );
      }

      if (
        !serverUploadResponse.ok ||
        !serverUploadData.success
      ) {
        throw new Error(
          serverUploadData.error ||
            JSON.stringify(
              serverUploadData
            )
        );
      }

      const fileKey =
        serverUploadData.fileKey;

      if (!fileKey) {
        throw new Error(
          "Too Lost fileKey was not returned."
        );
      }

      console.log(
        "Too Lost audio upload completed:",
        {
          releaseId:
            tooLostReleaseId,
          fileKey,
        }
      );

      // -----------------------------------------
      // GENERATE ISRC
      // -----------------------------------------

      const generatedIsrc =
        track.auto_isrc
          ? `NX${new Date()
              .getFullYear()}${String(
              i + 1
            ).padStart(
              5,
              "0"
            )}${Date.now()
              .toString()
              .slice(-3)}`
          : track.isrc;

      // -----------------------------------------
      // SAVE TRACK TO SUPABASE
      // -----------------------------------------

      const {
        error: trackError,
      } = await supabase
        .from("tracks")
        .insert({
          release_id:
            releaseData.id,

          title:
            track.title,

          artist_name:
            mainArtist,

          isrc:
            generatedIsrc,

          auto_isrc:
            generatedIsrc,

          auto_isrc_enabled:
            track.auto_isrc,

          previous_isrc:
            track.previous_isrc_enabled
              ? track.previous_isrc
              : null,

          audio_url:
            audioUrl,

          track_number:
            i + 1,

          explicit:
            track.explicit,

          composer:
            track.composer,

          lyricist:
            track.lyricist,

          producer:
            track.producer,

          publisher:
            track.publisher,

          version:
            track.version,

          language:
            track.language,

          content_type:
            track.content_type,

          toolost_file_key:
            fileKey,
        });

      if (trackError) {
        throw trackError;
      }
    }

    // -----------------------------------------
    // NOTIFICATION
    // -----------------------------------------

    await supabase
      .from("notifications")
      .insert({
        user_id:
          userData.user.id,

        title:
          "Too Lost draft created",

        message:
          `Release "${title}" was created as a draft on Too Lost. Release ID: ${tooLostReleaseId}`,

        type:
          "release",

        is_read:
          false,
      });

    // -----------------------------------------
    // SUCCESS
    // -----------------------------------------

    alert(
      `Release draft created successfully on Too Lost!\n\nToo Lost Release ID: ${tooLostReleaseId}\n\nStatus: DRAFT`
    );

    router.push(
      `/releases/${releaseData.id}`
    );

  } catch (err: any) {
    console.error(
      "Release submission error:",
      err
    );

    alert(
      err?.message ||
        "Something went wrong while creating the release."
    );
  } finally {
    setLoading(false);
  }
}

  return (
    <main style={pageStyle}>
      <div style={topSpacer} />

      <div style={topNav}>
        <button onClick={() => router.push("/releases")} style={exitBtn}>
          ← Exit
        </button>

        <button
  type="button"
  disabled={loading}
  onClick={async () => {
    try {
      setLoading(true);

      const connectionResponse =
        await fetch("/api/toolost/me", {
          cache: "no-store",
        });

      const connectionData =
        await connectionResponse.json();

      if (
        !connectionResponse.ok ||
        !connectionData.connected
      ) {
        alert(
          "Please connect Too Lost first."
        );
        return;
      }

      const tooLostReleaseId =
        prompt(
          "Enter the Too Lost Release ID:"
        );

      if (!tooLostReleaseId) {
        return;
      }

      const response =
        await fetch(
          "/api/toolost/releases/submit",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              releaseId:
                tooLostReleaseId,
            }),
          }
        );

      const text =
        await response.text();

      let data: any;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Too Lost returned non-JSON (${response.status}): ${text.slice(
            0,
            1000
          )}`
        );
      }

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            JSON.stringify(data)
        );
      }

      alert(
        "✓ Release submitted successfully to Too Lost!"
      );

      console.log(
        "Too Lost submit result:",
        data
      );
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Too Lost submission failed."
      );
    } finally {
      setLoading(false);
    }
  }}
  className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white disabled:opacity-50"
>
  {loading
    ? "Submitting..."
    : "Submit to Too Lost"}
</button>

      </div>

      <form onSubmit={submitRelease} style={layout}>
        <section style={mainPanel}>
          <div style={progressBox}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>Release completion</strong>
              <strong>{completion}%</strong>
            </div>
            <div style={progressTrack}>
              <div style={{ ...progressFill, width: `${completion}%` }} />
            </div>
          </div>

          {activeStep === "Release" && (
            <>
              <h3>Basic information</h3>

              <div style={twoCol}>
                <div>
                  <label>Title *</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={inputStyle} required />

                  <label>Version</label>
                  <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Original, Remix, Lofi, DJ Mix" style={inputStyle} />

                  <label>Release type *</label>
                  <select value={releaseType} onChange={(e) => setReleaseType(e.target.value)} style={inputStyle}>
                    <option value="single">Single</option>
                    <option value="ep">EP</option>
                    <option value="album">Album</option>
                  </select>

                  <label>Genre *</label>
                  <select value={genre} onChange={(e) => setGenre(e.target.value)} style={inputStyle} required>
                    <option value="">Select Genre</option>
                    {genreOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>

                <div>
                  <label>Release date *</label>
                  <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} style={inputStyle} required />

                  <label>Music created date *</label>
                  <input type="date" value={musicCreatedDate} onChange={(e) => setMusicCreatedDate(e.target.value)} style={inputStyle} required />

                  <label>Language *</label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} style={inputStyle} required>
                    <option value="">Select Language</option>
                    {languageOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>

                  <label>Music type *</label>
                  <select value={musicType} onChange={(e) => setMusicType(e.target.value)} style={inputStyle}>
                    <option value="original">Original</option>
                    <option value="ai_music">AI Music</option>
                    <option value="dj_remix">DJ Remix</option>
                    <option value="lofi">Lofi</option>
                    <option value="cover">Cover Version</option>
                    <option value="remake">Remake</option>
                  </select>
                </div>
              </div>

              <div style={infoBox}>Select Various Artists if your release is a collection of 5 or more different artists.</div>

              <h3>Release performers</h3>
              {artists.map((artist, index) => (
                <div key={index} style={artistRow}>
                  <input
                    value={artist}
                    onChange={(e) => updateArtist(index, e.target.value)}
                    placeholder={`Release artist ${index + 1}`}
                    style={{ ...inputStyle, marginBottom: 0 }}
                    required={index === 0}
                  />
                  <button type="button" onClick={addArtist} style={smallBtn}>+ Add Artist</button>
                  {artists.length > 1 && (
                    <button type="button" onClick={() => removeArtist(index)} style={dangerBtn}>Remove</button>
                  )}
                </div>
              ))}

              <label>Label name *</label>
              <input value={labelName} onChange={(e) => setLabelName(e.target.value)} placeholder="Label name" style={inputStyle} required />

              <h3>Identifiers</h3>
              <label>UPC</label>
              <input value={upc} onChange={(e) => setUpc(e.target.value)} disabled={autoUpc} placeholder="Leave blank for auto assign" style={inputStyle} />

              <label style={checkLabel}>
                <input type="checkbox" checked={autoUpc} disabled={previouslyReleased} onChange={(e) => setAutoUpc(e.target.checked)} />
                Assign UPC automatically
              </label>

              <label style={checkLabel}>
                <input type="checkbox" checked={previouslyReleased} onChange={(e) => handlePreviouslyReleased(e.target.checked)} />
                This music was previously released
              </label>

              {previouslyReleased && (
                <>
                  <label>Previous UPC / EAN *</label>
                  <input value={previousUpc} onChange={(e) => setPreviousUpc(e.target.value)} placeholder="Old UPC" style={inputStyle} />
                </>
              )}

              <label style={checkLabel}>
                <input type="checkbox" checked={contentIdRequired} onChange={(e) => setContentIdRequired(e.target.checked)} />
                Enable Content ID / YouTube claiming
              </label>

              <StepButtons goBackStep={goBackStep} goNext={goNext} activeStep={activeStep} loading={loading} />
            </>
          )}

          {activeStep === "Files" && (
            <>
              <h3>Files</h3>
              <label>Optional music license / permission PDF</label>
              <input type="file" accept="application/pdf,image/*" onChange={(e) => setLicenseFile(e.target.files?.[0] || null)} style={inputStyle} />
              <p style={mutedText}>Upload license only if this release is remix, cover, remake, sampled, leased beat, or third-party content.</p>
              <StepButtons goBackStep={goBackStep} goNext={goNext} activeStep={activeStep} loading={loading} />
            </>
          )}

          {activeStep === "Recordings" && (
            <>
              <div style={sectionHeader}>
                <h3>Recordings / Tracks</h3>
                <div>
                  <button type="button" onClick={copyFirstTrackMetadata} style={smallBtn}>Copy first track metadata to all</button>
                  <button type="button" onClick={addTrack} style={smallBtn}>+ Add Track</button>
                </div>
              </div>

              {tracks.map((track, index) => (
                <div key={index} style={trackCard}>
                  <div style={sectionHeader}>
                    <h3>Track {index + 1}</h3>
                    <button type="button" onClick={() => removeTrack(index)} style={dangerBtn}>Remove</button>
                  </div>

                  <div style={twoCol}>
                    <div>
                      <label>Track title *</label>
                      <input value={track.title} onChange={(e) => updateTrack(index, "title", e.target.value)} style={inputStyle} required />

                      <label>Version</label>
                      <input value={track.version} onChange={(e) => updateTrack(index, "version", e.target.value)} placeholder="Original, Remix, Lofi" style={inputStyle} />

                      <label>ISRC</label>
                      <input value={track.isrc} disabled={track.auto_isrc} onChange={(e) => updateTrack(index, "isrc", e.target.value)} placeholder="Leave blank for auto assign" style={inputStyle} />

                      <label style={checkLabel}>
                        <input type="checkbox" checked={track.auto_isrc} onChange={(e) => updateTrack(index, "auto_isrc", e.target.checked)} />
                        Assign ISRC automatically
                      </label>

                      <label style={checkLabel}>
                        <input type="checkbox" checked={track.previous_isrc_enabled} onChange={(e) => updateTrack(index, "previous_isrc_enabled", e.target.checked)} />
                        Add Previous ISRC
                      </label>

                      {track.previous_isrc_enabled && (
                        <input value={track.previous_isrc} onChange={(e) => updateTrack(index, "previous_isrc", e.target.value)} placeholder="Previous ISRC" style={inputStyle} />
                      )}
                    </div>

                    <div>
                      <label>Content type</label>
                      <select value={track.content_type} onChange={(e) => updateTrack(index, "content_type", e.target.value)} style={inputStyle}>
                        <option value="original">Original</option>
                        <option value="ai_music">AI Music</option>
                        <option value="dj_remix">DJ Remix</option>
                        <option value="lofi">Lofi</option>
                        <option value="cover">Cover</option>
                      </select>

                      <label>Track language</label>
                      <select value={track.language} onChange={(e) => updateTrack(index, "language", e.target.value)} style={inputStyle}>
                        <option value="">Select Language</option>
                        {languageOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>

                      <label>Audio file *</label>
                      <input type="file" accept="audio/*" onChange={(e) => updateTrack(index, "audio", e.target.files?.[0] || null)} style={inputStyle} required />

                      <label style={checkLabel}>
                        <input type="checkbox" checked={track.explicit} onChange={(e) => updateTrack(index, "explicit", e.target.checked)} />
                        Explicit content
                      </label>
                    </div>
                  </div>
                </div>
              ))}

              <StepButtons goBackStep={goBackStep} goNext={goNext} activeStep={activeStep} loading={loading} />
            </>
          )}

          {activeStep === "Authors" && (
            <>
              <h3>Authors & Contributors</h3>
              {tracks.map((track, index) => (
                <div key={index} style={trackCard}>
                  <h3>{index + 1}. {track.title || "Untitled Track"}</h3>
                  <div style={twoCol}>
                    <PersonInput label="Composer" value={track.composer} onChange={(v: string) => updateTrack(index, "composer", v)} onAdd={() => addPersonField(index, "composer")} />
                    <PersonInput label="Producer" value={track.producer} onChange={(v: string) => updateTrack(index, "producer", v)} onAdd={() => addPersonField(index, "producer")} />
                    <PersonInput label="Lyricist" value={track.lyricist} onChange={(v: string) => updateTrack(index, "lyricist", v)} onAdd={() => addPersonField(index, "lyricist")} />
                    <PersonInput label="Publisher" value={track.publisher} onChange={(v: string) => updateTrack(index, "publisher", v)} onAdd={() => addPersonField(index, "publisher")} />
                  </div>
                </div>
              ))}
              <StepButtons goBackStep={goBackStep} goNext={goNext} activeStep={activeStep} loading={loading} />
            </>
          )}

          {activeStep === "Lyrics" && (
            <>
              <h3>Lyrics</h3>
              <textarea value={lyricsText} onChange={(e) => setLyricsText(e.target.value)} placeholder="Paste or write your song lyrics here..." style={textareaStyle} />
              <StepButtons goBackStep={goBackStep} goNext={goNext} activeStep={activeStep} loading={loading} />
            </>
          )}

          {activeStep === "Cover" && (
            <>
              <h3>Cover artwork</h3>
              <label>Artwork JPG/PNG 3000x3000 *</label>
              <input type="file" accept="image/png,image/jpeg" onChange={(e) => handleArtwork(e.target.files?.[0] || null)} style={inputStyle} required />
              <p style={mutedText}>Recommended: 3000x3000 JPG/PNG. Agar image 3000x3000 nahi hoga to upload accept nahi hoga.</p>
              <StepButtons goBackStep={goBackStep} goNext={goNext} activeStep={activeStep} loading={loading} />
            </>
          )}

          {activeStep === "Distribution" && (
            <>
              <h3>Distribution</h3>
              <h4>DSP Selection</h4>
              <div style={chipGrid}>
                {dspOptions.map((dsp) => (
                  <button type="button" key={dsp} onClick={() => toggleDsp(dsp)} style={{ ...chip, background: selectedDSPs.includes(dsp) ? "#2563EB" : "#0B1020" }}>
                    {selectedDSPs.includes(dsp) ? "✓ " : ""}{dsp}
                  </button>
                ))}
              </div>

              <h4>Country Selection</h4>
              <div style={chipGrid}>
                {countryOptions.map((country) => (
                  <button type="button" key={country} onClick={() => toggleCountry(country)} style={{ ...chip, background: selectedCountries.includes(country) ? "#2563EB" : "#0B1020" }}>
                    {selectedCountries.includes(country) ? "✓ " : ""}{country}
                  </button>
                ))}
              </div>
              <StepButtons goBackStep={goBackStep} goNext={goNext} activeStep={activeStep} loading={loading} />
            </>
          )}

          {activeStep === "Confirm" && (
            <>
              <h3>Confirm submission</h3>
              <div style={confirmGrid}>
                <div style={confirmCard}>Title: {title || "-"}</div>
                <div style={confirmCard}>Artist: {mainArtist || "-"}</div>
                <div style={confirmCard}>Type: {releaseType}</div>
                <div style={confirmCard}>Music: {musicType}</div>
                <div style={confirmCard}>Tracks: {tracks.length}</div>
                <div style={confirmCard}>DSPs: {selectedDSPs.length}</div>
                <div style={confirmCard}>Countries: {selectedCountries.join(", ")}</div>
                <div style={confirmCard}>Content ID: {contentIdRequired ? "Yes" : "No"}</div>
              </div>

              <div style={bottomButtons}>
                <button type="button" onClick={goBackStep} style={secondaryBtn}>Back</button>
                <button type="submit" disabled={loading} style={submitBtn}>{loading ? "Uploading..." : "Submit Release"}</button>
              </div>
            </>
          )}
        </section>

        <aside style={helpPanel}>
          <h3>Help</h3>
          {artworkPreview ? <img src={artworkPreview} alt="Artwork preview" style={previewArt} /> : <div style={emptyPreview}>Cover Preview</div>}
          <p>We do not recommend using emoji or special characters in release title.</p>
          <p>If release was previously distributed, please enter old UPC and ISRC.</p>
          <p>For remix, cover, AI, sampled, or leased beat, upload license if available.</p>
          <div style={qualityBox}><strong>Metadata Quality</strong><h2>{completion}%</h2></div>
        </aside>
      </form>
    </main>
  );
}

function StepButtons({ goBackStep, goNext, activeStep, loading }: any) {
  return (
    <div style={bottomButtons}>
      {activeStep !== "Release" && <button type="button" onClick={goBackStep} style={secondaryBtn}>Back</button>}
      {activeStep !== "Confirm" && <button type="button" onClick={goNext} disabled={loading} style={submitBtn}>Next</button>}
    </div>
  );
}

function PersonInput({ label, value, onChange, onAdd }: any) {
  return (
    <div>
      <label>{label}</label>
      <div style={artistRow}>
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={`${label} name`} style={{ ...inputStyle, marginBottom: 0 }} />
        <button type="button" onClick={onAdd} style={smallBtn}>+ Add</button>
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = { minHeight: "100vh", background: "#050816", color: "white", fontFamily: "Arial, sans-serif" };
const topSpacer: CSSProperties = { height: "10px", background: "#050816" };
const topNav: CSSProperties = { display: "flex", alignItems: "center", background: "#111827", borderBottom: "1px solid #1F2937", height: "56px" };
const exitBtn: CSSProperties = { marginLeft: "12px", border: "1px solid #334155", background: "#0B1020", color: "white", borderRadius: "8px", padding: "8px 12px", cursor: "pointer" };
const stepsBar: CSSProperties = { flex: 1, display: "grid", gridTemplateColumns: "repeat(8, 1fr)", marginLeft: "12px" };
const stepBtn: CSSProperties = { height: "56px", border: "none", background: "#111827", color: "#94A3B8", cursor: "pointer", appearance: "none", outline: "none" };
const layout: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 260px", gap: "0" };
const mainPanel: CSSProperties = { margin: "18px", background: "#111827", borderRadius: "16px", padding: "24px", border: "1px solid #1F2937", minHeight: "calc(100vh - 100px)" };
const helpPanel: CSSProperties = { background: "#0B1020", padding: "24px", minHeight: "calc(100vh - 66px)", borderLeft: "1px solid #1F2937", color: "white" };
const inputStyle: CSSProperties = { width: "100%", height: "42px", padding: "8px 12px", marginTop: "6px", marginBottom: "14px", borderRadius: "8px", border: "1px solid #334155", background: "#0B1020", color: "white", colorScheme: "dark" };
const textareaStyle: CSSProperties = { ...inputStyle, height: "260px", resize: "vertical" };
const twoCol: CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px" };
const infoBox: CSSProperties = { background: "#0B1020", border: "1px solid #1F2937", padding: "12px", borderRadius: "8px", margin: "14px 0", color: "#CBD5E1" };
const checkLabel: CSSProperties = { display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px" };
const progressBox: CSSProperties = { marginBottom: "18px" };
const progressTrack: CSSProperties = { height: "8px", background: "#0B1020", borderRadius: "999px", marginTop: "8px", border: "1px solid #1F2937" };
const progressFill: CSSProperties = { height: "8px", background: "#2563EB", borderRadius: "999px" };
const trackCard: CSSProperties = { background: "#0B1020", border: "1px solid #1F2937", borderRadius: "12px", padding: "16px", marginBottom: "16px" };
const sectionHeader: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" };
const smallBtn: CSSProperties = { marginLeft: "8px", padding: "9px 12px", border: "none", borderRadius: "8px", background: "#2563EB", color: "white", cursor: "pointer", whiteSpace: "nowrap" };
const dangerBtn: CSSProperties = { ...smallBtn, background: "#DC2626" };
const secondaryBtn: CSSProperties = { padding: "12px 18px", borderRadius: "10px", border: "1px solid #334155", background: "#0B1020", color: "white", cursor: "pointer" };
const chipGrid: CSSProperties = { display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px" };
const chip: CSSProperties = { padding: "10px 14px", borderRadius: "999px", border: "1px solid #334155", color: "white", cursor: "pointer" };
const previewArt: CSSProperties = { width: "100%", aspectRatio: "1/1", objectFit: "cover", borderRadius: "10px", marginBottom: "18px" };
const emptyPreview: CSSProperties = { width: "100%", aspectRatio: "1/1", background: "#111827", border: "1px dashed #334155", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", marginBottom: "18px" };
const qualityBox: CSSProperties = { marginTop: "20px", background: "#111827", border: "1px solid #1F2937", padding: "16px", borderRadius: "10px" };
const confirmGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" };
const confirmCard: CSSProperties = { background: "#0B1020", border: "1px solid #1F2937", padding: "14px", borderRadius: "8px" };
const submitBtn: CSSProperties = { padding: "12px 18px", border: "none", borderRadius: "10px", background: "#2563EB", color: "white", fontWeight: "bold", cursor: "pointer" };
const bottomButtons: CSSProperties = { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" };
const artistRow: CSSProperties = { display: "flex", gap: "8px", alignItems: "center", marginBottom: "14px" };
const mutedText: CSSProperties = { color: "#94A3B8" };