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

const steps = [
  "Release",
  "Files",
  "Recordings",
  "Authors",
  "Lyrics",
  "Cover",
  "Distribution",
  "Confirm",
];

const genreOptions = [
  "Pop",
  "Hip Hop",
  "Rap",
  "Rock",
  "Dance",
  "Electronic",
  "EDM",
  "House",
  "Techno",
  "Trance",
  "R&B",
  "Soul",
  "Jazz",
  "Blues",
  "Classical",
  "Folk",
  "Traditional",
  "Devotional",
  "Bhajan",
  "Ghazal",
  "Qawwali",
  "Bhojpuri",
  "Bollywood",
  "Punjabi",
  "Bengali",
  "Tamil",
  "Telugu",
  "Malayalam",
  "Kannada",
  "Marathi",
  "Gujarati",
  "Afrobeats",
  "Amapiano",
  "Reggae",
  "Dancehall",
  "Latin",
  "Country",
  "Lofi",
  "Instrumental",
  "Soundtrack",
  "World",
];

const languageOptions = [
  "Hindi",
  "English",
  "Bengali",
  "Bhojpuri",
  "Punjabi",
  "Urdu",
  "Tamil",
  "Telugu",
  "Malayalam",
  "Kannada",
  "Marathi",
  "Gujarati",
  "Odia",
  "Assamese",
  "Nepali",
  "Arabic",
  "Spanish",
  "French",
  "Portuguese",
  "German",
  "Italian",
  "Russian",
  "Chinese",
  "Japanese",
  "Korean",
  "Yoruba",
  "Igbo",
  "Hausa",
  "Swahili",
  "Zulu",
  "Turkish",
  "Persian",
  "Other",
];

const dspOptions = [
  "Spotify",
  "Apple Music",
  "YouTube Music",
  "Amazon Music",
  "Deezer",
  "TikTok",
  "Meta / Facebook",
  "Instagram",
  "JioSaavn",
  "Gaana",
  "Wynk",
  "Boomplay",
  "Audiomack",
];

const countryOptions = [
  "Worldwide",
  "India",
  "United States",
  "United Kingdom",
  "Nigeria",
  "Bangladesh",
  "Pakistan",
  "Nepal",
  "UAE",
  "Saudi Arabia",
  "Canada",
  "Australia",
];

function unwrap(value: any) {
  return value?.data?.data ?? value?.data ?? value;
}

function getTooLostAudioFileName(file: File): string {
  const originalName = String(file.name || "audio.wav");

  if (!/\.wav$/i.test(originalName)) {
    throw new Error(
      `Only WAV audio files are supported. "${originalName}" is not a WAV file.`
    );
  }

  let safeName = originalName
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[-_.]+|[-_.]+$/g, "");

  if (!safeName) {
    safeName = "audio.wav";
  }

  if (!/\.wav$/i.test(safeName)) {
    safeName = `${safeName}.wav`;
  }

  return safeName;
}

export default function NewReleasePage() {
  const router = useRouter();

  const [activeStep, setActiveStep] = useState("Release");
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [artists, setArtists] = useState<string[]>([""]);

  const [labelName, setLabelName] = useState("");
  const [genre, setGenre] = useState("");
  const [subgenre, setSubgenre] = useState("");
  const [language, setLanguage] = useState("");

  const [releaseDate, setReleaseDate] = useState("");
  const [originalReleaseDate, setOriginalReleaseDate] =
    useState("");

  const [catalogNumber, setCatalogNumber] = useState("");
  const [upc, setUpc] = useState("");
  const [autoUpc, setAutoUpc] = useState(true);

  const [previousUpc, setPreviousUpc] =
    useState("");

  const [releaseType, setReleaseType] =
    useState("single");

  const [musicType, setMusicType] =
    useState("original");

  const [previouslyReleased, setPreviouslyReleased] =
    useState(false);

  const [contentIdRequired, setContentIdRequired] =
    useState(false);

  const [lyricsText, setLyricsText] =
    useState("");

  /*
   * COPYRIGHT
   */
  const currentYear =
    new Date().getFullYear().toString();

  const [cYear, setCYear] =
    useState(currentYear);

  const [cLine, setCLine] =
    useState("");

  const [pYear, setPYear] =
    useState(currentYear);

  const [pLine, setPLine] =
    useState("");

  const [licenseInfo, setLicenseInfo] =
    useState("");

  const [licenseType, setLicenseType] =
    useState("");

  const [artwork, setArtwork] =
    useState<File | null>(null);

  const [licenseFile, setLicenseFile] =
    useState<File | null>(null);

  const [tracks, setTracks] =
    useState<TrackInput[]>([
      { ...emptyTrack },
    ]);

  const [selectedDSPs, setSelectedDSPs] =
    useState<string[]>([
      "Spotify",
      "Apple Music",
      "YouTube Music",
      "Amazon Music",
    ]);

  const [selectedCountries, setSelectedCountries] =
    useState<string[]>([
      "Worldwide",
    ]);

  const artworkPreview = useMemo(() => {
    if (!artwork) return "";

    return URL.createObjectURL(
      artwork
    );
  }, [artwork]);

  const mainArtist =
    artists
      .map((x) => x.trim())
      .filter(Boolean)
      .join(", ");

  const completion = useMemo(() => {
    let score = 0;

    if (title) score += 7;
    if (mainArtist) score += 7;
    if (labelName) score += 6;
    if (genre) score += 6;
    if (subgenre) score += 3;
    if (language) score += 7;
    if (releaseDate) score += 6;
    if (originalReleaseDate) score += 6;

    if (cYear && cLine) score += 4;
    if (pYear && pLine) score += 4;

    if (artwork) score += 10;

    if (
      tracks.every(
        (t) =>
          t.title &&
          t.audio &&
          t.composer &&
          (t.language || language)
      )
    ) {
      score += 20;
    }

    if (selectedDSPs.length) score += 5;
    if (selectedCountries.length) score += 5;

    return Math.min(score, 100);
  }, [
    title,
    mainArtist,
    labelName,
    genre,
    subgenre,
    language,
    releaseDate,
    originalReleaseDate,
    cYear,
    cLine,
    pYear,
    pLine,
    artwork,
    tracks,
    selectedDSPs,
    selectedCountries,
  ]);

  function getStepIndex() {
    return steps.indexOf(
      activeStep
    );
  }

  function goNext() {
    const index =
      getStepIndex();

    if (
      index <
      steps.length - 1
    ) {
      setActiveStep(
        steps[index + 1]
      );
    }
  }

  function goBackStep() {
    const index =
      getStepIndex();

    if (index > 0) {
      setActiveStep(
        steps[index - 1]
      );
    }
  }

  async function uploadFile(
    bucket: string,
    file: File
  ) {
    const cleanName =
      file.name
        .replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        )
        .replace(
          /_+/g,
          "_"
        );

    const fileName =
      `${Date.now()}-${cleanName}`;

    const {
      error,
    } =
      await supabase.storage
        .from(bucket)
        .upload(
          fileName,
          file
        );

    if (error) {
      throw error;
    }

    const {
      data,
    } =
      supabase.storage
        .from(bucket)
        .getPublicUrl(
          fileName
        );

    return data.publicUrl;
  }

  function toggleCountry(
    country: string
  ) {
    if (
      country ===
      "Worldwide"
    ) {
      setSelectedCountries([
        "Worldwide",
      ]);
      return;
    }

    let next =
      selectedCountries.filter(
        (c) =>
          c !==
          "Worldwide"
      );

    if (
      next.includes(
        country
      )
    ) {
      next =
        next.filter(
          (c) =>
            c !==
            country
        );
    } else {
      next.push(country);
    }

    setSelectedCountries(
      next.length
        ? next
        : ["Worldwide"]
    );
  }

  function toggleDsp(
    dsp: string
  ) {
    setSelectedDSPs(
      (prev) =>
        prev.includes(dsp)
          ? prev.filter(
              (item) =>
                item !== dsp
            )
          : [
              ...prev,
              dsp,
            ]
    );
  }

  function updateArtist(
    index: number,
    value: string
  ) {
    setArtists(
      (prev) =>
        prev.map(
          (
            item,
            i
          ) =>
            i === index
              ? value
              : item
        )
    );
  }

  function addArtist() {
    setArtists(
      (prev) => [
        ...prev,
        "",
      ]
    );
  }

  function removeArtist(
    index: number
  ) {
    if (
      artists.length ===
      1
    ) {
      return;
    }

    setArtists(
      (prev) =>
        prev.filter(
          (_, i) =>
            i !== index
        )
    );
  }

  function updateTrack(
    index: number,
    field: keyof TrackInput,
    value:
      | string
      | boolean
      | File
      | null
  ) {
    setTracks(
      (prev) =>
        prev.map(
          (
            track,
            i
          ) =>
            i === index
              ? {
                  ...track,
                  [field]:
                    value,
                }
              : track
        )
    );
  }

  function addTrack() {
    setTracks(
      (prev) => [
        ...prev,
        {
          ...emptyTrack,
        },
      ]
    );
  }

  function removeTrack(
    index: number
  ) {
    if (
      tracks.length ===
      1
    ) {
      alert(
        "At least one track is required."
      );
      return;
    }

    setTracks(
      (prev) =>
        prev.filter(
          (_, i) =>
            i !== index
        )
    );
  }

  function addPersonField(
    index: number,
    field: keyof TrackInput
  ) {
    const current =
      String(
        tracks[index][field] ||
          ""
      );

    updateTrack(
      index,
      field,
      current
        ? `${current}, `
        : ""
    );
  }

  function copyFirstTrackMetadata() {
    const first =
      tracks[0];

    setTracks(
      (prev) =>
        prev.map(
          (
            track,
            index
          ) =>
            index === 0
              ? track
              : {
                  ...track,

                  composer:
                    first.composer,

                  lyricist:
                    first.lyricist,

                  producer:
                    first.producer,

                  publisher:
                    first.publisher,

                  language:
                    first.language ||
                    language,

                  content_type:
                    first.content_type,

                  explicit:
                    first.explicit,
                }
        )
    );

    alert(
      "First track metadata copied to all tracks."
    );
  }

  function handlePreviouslyReleased(
    value: boolean
  ) {
    setPreviouslyReleased(
      value
    );

    if (value) {
      setAutoUpc(
        false
      );
      setUpc("");
    }
  }

  function validateArtwork(
    file: File
  ) {
    return new Promise<boolean>(
      (resolve) => {
        const img =
          new Image();

        img.onload = () => {
          const valid =
            img.width ===
              3000 &&
            img.height ===
              3000;

          if (!valid) {
            alert(
              "Cover image 3000x3000 hona chahiye. Pehle image ko 3000x3000 me convert karo."
            );

            setArtwork(
              null
            );
          }

          URL.revokeObjectURL(
            img.src
          );

          resolve(valid);
        };

        img.onerror = () => {
          alert(
            "Artwork image read nahi ho saki."
          );

          resolve(false);
        };

        img.src =
          URL.createObjectURL(
            file
          );
      }
    );
  }

  async function handleArtwork(
    file: File | null
  ) {
    if (!file) {
      setArtwork(null);
      return;
    }

    if (
      !/^image\/(jpeg|png)$/i.test(
        file.type
      )
    ) {
      alert(
        "Sirf JPG ya PNG artwork allowed hai."
      );
      return;
    }

    if (
      await validateArtwork(
        file
      )
    ) {
      setArtwork(file);
    }
  }

  function validateBeforeSubmit() {
    if (!title.trim()) {
      return "Title required hai.";
    }

    if (!mainArtist) {
      return "Kam se kam ek release artist add karo.";
    }

    if (!labelName.trim()) {
      return "Label name required hai.";
    }

    if (!genre) {
      return "Genre select karo.";
    }

    if (!language) {
      return "Release language select karo.";
    }

    if (!releaseDate) {
      return "Release date select karo.";
    }

    if (!originalReleaseDate) {
      return "Original release date select karo.";
    }

    if (
      previouslyReleased &&
      !previousUpc.trim()
    ) {
      return "Previously released music ke liye old UPC required hai.";
    }

    if (
      !autoUpc &&
      !upc.trim() &&
      !previouslyReleased
    ) {
      return "UPC daalo ya Auto UPC tick karo.";
    }

    if (!artwork) {
      return "3000x3000 cover artwork upload karo.";
    }

    if (!cYear.trim()) {
      return "C-Line year required hai.";
    }

    if (!cLine.trim()) {
      return "C-Line required hai.";
    }

    if (!pYear.trim()) {
      return "P-Line year required hai.";
    }

    if (!pLine.trim()) {
      return "P-Line required hai.";
    }

    if (!selectedDSPs.length) {
      return "Kam se kam ek DSP select karo.";
    }

    if (!selectedCountries.length) {
      return "Country select karo.";
    }

    for (
      let i = 0;
      i < tracks.length;
      i++
    ) {
      const t =
        tracks[i];

      if (
        !t.title.trim()
      ) {
        return `Track ${
          i + 1
        } title required hai.`;
      }

      if (!t.audio) {
        return `Track ${
          i + 1
        } audio upload karo.`;
      }

      if (
        !/\.wav$/i.test(
          t.audio.name
        )
      ) {
        return `Track ${
          i + 1
        }: sirf WAV audio file upload karo.`;
      }

      /*
       * COMPOSER IS REQUIRED BY TOO LOST
       */

      if (
        !t.composer.trim()
      ) {
        return `Track ${
          i + 1
        } me Composer required hai.`;
      }

      /*
       * TRACK LANGUAGE MUST MATCH RELEASE LANGUAGE
       */

      if (
        t.language &&
        t.language !==
          language
      ) {
        return `Track ${
          i + 1
        } language "${t.language}" hai. Release language "${language}" hai. Dono same hone chahiye.`;
      }

      if (
        !t.auto_isrc &&
        !t.isrc.trim()
      ) {
        return `Track ${
          i + 1
        } me ISRC daalo ya Auto ISRC tick karo.`;
      }

      if (
        t.previous_isrc_enabled &&
        !t.previous_isrc.trim()
      ) {
        return `Track ${
          i + 1
        } ka Previous ISRC daalo.`;
      }
    }

    return "";
  }

  async function submitRelease(
    e: FormEvent
  ) {
    e.preventDefault();

    const validationError =
      validateBeforeSubmit();

    if (validationError) {
      alert(
        validationError
      );
      return;
    }

    setLoading(true);

    try {
      /*
       * =========================================
       * LOGIN
       * =========================================
       */

      const {
        data: userData,
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !userData.user
      ) {
        alert(
          "Please login first."
        );

        router.push(
          "/login"
        );

        return;
      }

      /*
       * =========================================
       * PROFILE
       * =========================================
       */

      const {
        data: profile,
      } =
        await supabase
          .from(
            "profiles"
          )
          .select(
            "white_label_id"
          )
          .eq(
            "id",
            userData
              .user.id
          )
          .maybeSingle();

      /*
       * =========================================
       * NORMALIZE TRACK LANGUAGE
       *
       * Every track gets the same language
       * as release language.
       * =========================================
       */

      const normalizedTracks =
        tracks.map(
          (track) => ({
            ...track,

            language:
              language,

            composer:
              track.composer.trim(),

            lyricist:
              track.lyricist.trim(),

            producer:
              track.producer.trim(),

            publisher:
              track.publisher.trim(),
          })
        );

      /*
       * =========================================
       * AUTO UPC
       * =========================================
       */

      const requestedUpc =
        autoUpc ||
        previouslyReleased
          ? ""
          : upc.trim();

      alert(
        "Creating release on Too Lost..."
      );

      /*
       * =========================================
       * CREATE TOO LOST RELEASE
       * =========================================
       */

      const createResponse =
        await fetch(
          "/api/toolost/releases/create",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                title:
                  title.trim(),

                type:
                  releaseType ===
                  "album"
                    ? "Album"
                    : releaseType ===
                        "ep"
                      ? "EP"
                      : "Single",

                label:
                  labelName.trim(),

                artistName:
                  mainArtist,

                role:
                  "primary",

                genre,

                subgenre:
                  subgenre.trim() ||
                  undefined,

                language,

                releaseDate,

                originalReleaseDate,

                catalogNumber:
                  catalogNumber.trim() ||
                  undefined,

                upc:
                  requestedUpc ||
                  undefined,

                // Send the dashboard DSP selection to the server so it can
                // resolve real Too Lost platform IDs and configure delivery.
                dsps:
                  selectedDSPs,
              }),
          }
        );

      const createText =
        await createResponse.text();

      let createData: any;

      try {
        createData =
          JSON.parse(
            createText
          );
      } catch {
        throw new Error(
          `Too Lost release API returned non-JSON (${createResponse.status}).`
        );
      }

      if (
        !createResponse.ok ||
        !createData.success
      ) {
        throw new Error(
          createData.error ||
            createData
              .tooLostResponse
              ?.message ||
            JSON.stringify(
              createData
            )
        );
      }

      const tooLostRelease =
        unwrap(
          createData.data
        );

      const tooLostReleaseId =
        createData.releaseId ||
        tooLostRelease?.id;

      if (
        !tooLostReleaseId
      ) {
        throw new Error(
          "Too Lost did not return a release ID."
        );
      }

      /*
       * =========================================
       * AUTHORITATIVE UPC
       * =========================================
       */

      const authoritativeUpc =
        tooLostRelease?.upc ||
        tooLostRelease?.UPC ||
        tooLostRelease?.upc_code ||
        requestedUpc ||
        null;

      const authoritativeCatalog =
        tooLostRelease?.catalog_number ||
        tooLostRelease?.catalogNumber ||
        catalogNumber ||
        null;

      if (
        authoritativeUpc
      ) {
        setUpc(
          String(
            authoritativeUpc
          )
        );
      }

      if (
        authoritativeCatalog
      ) {
        setCatalogNumber(
          String(
            authoritativeCatalog
          )
        );
      }

      /*
       * =========================================
       * ARTWORK → SUPABASE
       * =========================================
       */

      alert(
        "Uploading artwork..."
      );

      const artworkUrl =
        await uploadFile(
          "release-artwork",
          artwork as File
        );

      /*
       * =========================================
       * LICENSE
       * =========================================
       */

      let licenseUrl =
        "";

      if (
        licenseFile
      ) {
        licenseUrl =
          await uploadFile(
            "release-artwork",
            licenseFile
          );
      }

      /*
       * =========================================
       * TOO LOST RELEASE METADATA
       * =========================================
       *
       * IMPORTANT:
       * Too Lost docs use coverUrl.
       * We send both the documented coverUrl
       * and the fields required for release info.
       * =========================================
       */

      const metadataPayload =
        {
          title:
            title.trim(),

          type:
            releaseType ===
            "album"
              ? "Album"
              : releaseType ===
                  "ep"
                ? "EP"
                : "Single",

          label:
            labelName.trim(),

          primaryGenre:
            genre,

          secondaryGenre:
            subgenre.trim() ||
            undefined,

          language,

          releaseDate,

          originalReleaseDate,

          coverUrl:
            artworkUrl,

          /*
           * Copyright
           */
          cYear:
            Number(
              cYear
            ),

          cLine:
            cLine.trim(),

          pYear:
            Number(
              pYear
            ),

          pLine:
            pLine.trim(),

          /*
           * License
           */
          ...(licenseType
            ? {
                licenseType:
                  licenseType,
              }
            : {}),

          ...(licenseInfo
            ? {
                licenseInfo:
                  licenseInfo.trim(),
              }
            : {}),

          ...(authoritativeUpc
            ? {
                upc:
                  authoritativeUpc,
              }
            : {}),

          ...(authoritativeCatalog
            ? {
                catalogNumber:
                  authoritativeCatalog,
              }
            : {}),
        };

      console.log(
        "Too Lost release metadata payload:",
        metadataPayload
      );

      const artworkResponse =
        await fetch(
          "/api/toolost/releases/metadata",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                releaseId:
                  tooLostReleaseId,

                artworkUrl,

                metadata:
                  metadataPayload,
              }),
          }
        );

      const artworkText =
        await artworkResponse.text();

      let artworkData: any;

      try {
        artworkData =
          JSON.parse(
            artworkText
          );
      } catch {
        throw new Error(
          `Too Lost artwork/metadata API returned non-JSON (${artworkResponse.status}).`
        );
      }

      if (
        !artworkResponse.ok ||
        !artworkData.success
      ) {
        throw new Error(
          artworkData.error ||
            artworkData
              .tooLostResponse
              ?.message ||
            JSON.stringify(
              artworkData
            )
        );
      }

      /*
       * =========================================
       * SAVE RELEASE TO SUPABASE
       * =========================================
       */

      const {
        data: releaseData,
        error:
          releaseError,
      } =
        await supabase
          .from(
            "releases"
          )
          .insert({
            user_id:
              userData
                .user.id,

            white_label_id:
              profile
                ?.white_label_id ||
              null,

            title:
              title.trim(),

            subtitle:
              version.trim(),

            version:
              version.trim(),

            release_artists:
              artists
                .map(
                  (x) =>
                    x.trim()
                )
                .filter(
                  Boolean
                ),

            artist_name:
              mainArtist,

            label_name:
              labelName.trim(),

            label:
              labelName.trim(),

            genre,

            subgenre:
              subgenre.trim() ||
              null,

            language,

            release_date:
              releaseDate,

            original_release_date:
              originalReleaseDate,

            music_created_date:
              originalReleaseDate,

            music_type:
              musicType,

            previously_released:
              previouslyReleased,

            previous_upc:
              previouslyReleased
                ? previousUpc.trim()
                : null,

            content_id_required:
              contentIdRequired,

            selected_dsps:
              selectedDSPs,

            selected_countries:
              selectedCountries,

            license_url:
              licenseUrl ||
              null,

            lyrics_text:
              lyricsText,

            upc:
              authoritativeUpc,

            auto_upc:
              autoUpc,

            catalog_number:
              authoritativeCatalog,

            release_type:
              releaseType,

            type:
              releaseType ===
              "album"
                ? "Album"
                : releaseType ===
                    "ep"
                  ? "EP"
                  : "Single",

            artwork_url:
              artworkUrl,

            cover_url:
              artworkUrl,

            toolost_release_id:
              String(
                tooLostReleaseId
              ),

            status:
              "draft",
          })
          .select()
          .single();

      if (
        releaseError
      ) {
        throw releaseError;
      }

      /*
       * =========================================
       * UPLOAD TRACKS DIRECTLY TO TOO LOST
       * =========================================
       */

      for (
        let i = 0;
        i < normalizedTracks.length;
        i++
      ) {
        const track =
          normalizedTracks[i];

        if (!track.audio) {
          throw new Error(
            `Track ${i + 1} audio missing.`
          );
        }

        if (!track.composer) {
          throw new Error(
            `Track ${i + 1} composer missing.`
          );
        }

        /*
         * =========================================
         * REQUESTED ISRC
         * =========================================
         */

        const requestedIsrc =
          track.auto_isrc
            ? ""
            : track.isrc.trim();

        alert(
          `Uploading track ${
            i + 1
          } of ${
            normalizedTracks.length
          } directly to Too Lost...`
        );

        /*
         * =========================================
         * 1. GET TOO LOST PRESIGNED UPLOAD URL
         * =========================================
         */

        const uploadUrlResponse =
          await fetch(
            "/api/toolost/upload-url",
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
                  getTooLostAudioFileName(
                    track.audio
                  ),

                contentType:
                  "audio/wav",
              }),
            }
          );

        const uploadUrlText =
          await uploadUrlResponse.text();

        let uploadUrlData: any;

        try {
          uploadUrlData =
            JSON.parse(
              uploadUrlText
            );
        } catch {
          throw new Error(
            `Too Lost upload-url returned non-JSON (${uploadUrlResponse.status}).`
          );
        }

        if (
          !uploadUrlResponse.ok ||
          !uploadUrlData?.success
        ) {
          throw new Error(
            uploadUrlData?.error ||
              `Unable to prepare track ${
                i + 1
              } upload.`
          );
        }

        if (
          !uploadUrlData.uploadUrl ||
          !uploadUrlData.fileKey
        ) {
          throw new Error(
            `Too Lost upload URL or fileKey missing for track ${
              i + 1
            }.`
          );
        }

        /*
         * =========================================
         * 2. DIRECT BROWSER -> TOO LOST STORAGE
         *
         * AUDIO DOES NOT GO TO SUPABASE.
         * =========================================
         */

        const directHeaders: Record<
          string,
          string
        > = {};

        if (
          uploadUrlData.headers &&
          typeof uploadUrlData.headers ===
            "object"
        ) {
          for (
            const [
              key,
              value,
            ] of Object.entries(
              uploadUrlData.headers
            )
          ) {
            if (
              typeof value ===
              "string"
            ) {
              directHeaders[key] =
                value;
            }
          }
        }

        const hasContentType =
          Object.keys(
            directHeaders
          ).some(
            (key) =>
              key.toLowerCase() ===
              "content-type"
          );

        if (!hasContentType) {
          directHeaders[
            "Content-Type"
          ] = "audio/wav";
        }

        const directUploadResponse =
          await fetch(
            uploadUrlData.uploadUrl,
            {
              method:
                uploadUrlData.method ||
                "PUT",

              headers:
                directHeaders,

              body:
                track.audio,
            }
          );

        if (
          !directUploadResponse.ok
        ) {
          const directUploadText =
            await directUploadResponse.text();

          console.error(
            "Too Lost direct audio upload failed:",
            directUploadResponse.status,
            directUploadText
          );

          throw new Error(
            `Track ${
              i + 1
            } direct audio upload failed (${directUploadResponse.status}).`
          );
        }

        /*
         * =========================================
         * 3. ATTACH FILE KEY TO TOO LOST TRACK
         * =========================================
         */

        const finalizeResponse =
          await fetch(
            "/api/toolost/finalize-track",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                releaseId:
                  tooLostReleaseId,

                title:
                  track.title.trim(),

                fileKey:
                  uploadUrlData.fileKey,

                trackNumber:
                  i + 1,
              }),
            }
          );

        const finalizeText =
          await finalizeResponse.text();

        let finalizeData: any;

        try {
          finalizeData =
            JSON.parse(
              finalizeText
            );
        } catch {
          throw new Error(
            `Too Lost finalize-track returned non-JSON (${finalizeResponse.status}).`
          );
        }

        if (
          !finalizeResponse.ok ||
          !finalizeData?.success
        ) {
          throw new Error(
            finalizeData?.error ||
              finalizeData?.data
                ?.message ||
              `Unable to attach audio for track ${
                i + 1
              }.`
          );
        }

        /*
         * =========================================
         * ISRC
         *
         * If Too Lost returns an ISRC use it.
         * Otherwise keep manually supplied ISRC.
         * =========================================
         */

        const actualIsrc =
          finalizeData?.data?.isrc ||
          finalizeData?.track?.isrc ||
          requestedIsrc ||
          null;

        /*
         * =========================================
         * SAVE TRACK METADATA TO SUPABASE
         *
         * Audio binary is NOT stored in Supabase.
         * =========================================
         */

        const {
          error: trackError,
        } =
          await supabase
            .from("tracks")
            .insert({
              release_id:
                releaseData.id,

              title:
                track.title.trim(),

              artist_name:
                mainArtist,

              isrc:
                actualIsrc,

              auto_isrc:
                track.auto_isrc,

              auto_isrc_enabled:
                track.auto_isrc,

              previous_isrc:
                track.previous_isrc_enabled
                  ? track.previous_isrc.trim()
                  : null,

              /*
               * No Supabase audio object.
               */
              audio_url:
                null,

              track_number:
                i + 1,

              explicit:
                track.explicit,

              composer:
                track.composer.trim(),

              lyricist:
                track.lyricist.trim(),

              producer:
                track.producer.trim(),

              publisher:
                track.publisher.trim(),

              version:
                track.version.trim(),

              language:
                language,

              content_type:
                track.content_type,

              toolost_file_key:
                uploadUrlData.fileKey,
            });

        if (trackError) {
          throw trackError;
        }
      }

      /*
       * =========================================
       * NOTIFICATION
       * =========================================
       */

      await supabase
        .from(
          "notifications"
        )
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

      /*
       * =========================================
       * SUCCESS
       * =========================================
       */

      alert(
        `Release draft created successfully on Too Lost!\n\nToo Lost Release ID: ${tooLostReleaseId}\n\nStatus: DRAFT`
      );

      router.push(
        `/releases/${releaseData.id}`
      );
    } catch (
      err: any
    ) {
      console.error(
        "Release submission error:",
        err
      );

      alert(
        err?.message ||
          "Something went wrong while creating the release."
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  return (
    <main style={pageStyle}>
      <div style={topSpacer} />

      <div style={topNav}>
        <button
          type="button"
          onClick={() =>
            router.push(
              "/releases"
            )
          }
          style={exitBtn}
        >
          ← Exit
        </button>

        <div style={stepsBar}>
          {steps.map(
            (step) => (
              <button
                type="button"
                key={step}
                onClick={() =>
                  setActiveStep(
                    step
                  )
                }
                style={{
                  ...stepBtn,

                  color:
                    activeStep ===
                    step
                      ? "#60A5FA"
                      : "#94A3B8",

                  borderBottom:
                    activeStep ===
                    step
                      ? "2px solid #2563EB"
                      : "2px solid transparent",
                }}
              >
                {step}
              </button>
            )
          )}
        </div>
      </div>

      <form
        onSubmit={
          submitRelease
        }
        style={layout}
      >
        <section
          style={mainPanel}
        >
          <div
            style={
              progressBox
            }
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
              }}
            >
              <strong>
                Release completion
              </strong>

              <strong>
                {completion}%
              </strong>
            </div>

            <div
              style={
                progressTrack
              }
            >
              <div
                style={{
                  ...progressFill,

                  width:
                    `${completion}%`,
                }}
              />
            </div>
          </div>

          {activeStep ===
            "Release" && (
            <>
              <h3>
                Basic information
              </h3>

              <div
                style={
                  twoCol
                }
              >
                <div>
                  <label>
                    Title *
                  </label>

                  <input
                    value={
                      title
                    }
                    onChange={(
                      e
                    ) =>
                      setTitle(
                        e.target
                          .value
                      )
                    }
                    placeholder="Title"
                    style={
                      inputStyle
                    }
                    required
                  />

                  <label>
                    Version
                  </label>

                  <input
                    value={
                      version
                    }
                    onChange={(
                      e
                    ) =>
                      setVersion(
                        e.target
                          .value
                      )
                    }
                    placeholder="Original, Remix, Lofi, DJ Mix"
                    style={
                      inputStyle
                    }
                  />

                  <label>
                    Release type *
                  </label>

                  <select
                    value={
                      releaseType
                    }
                    onChange={(
                      e
                    ) =>
                      setReleaseType(
                        e.target
                          .value
                      )
                    }
                    style={
                      inputStyle
                    }
                  >
                    <option value="single">
                      Single
                    </option>

                    <option value="ep">
                      EP
                    </option>

                    <option value="album">
                      Album
                    </option>
                  </select>

                  <label>
                    Genre *
                  </label>

                  <select
                    value={
                      genre
                    }
                    onChange={(
                      e
                    ) =>
                      setGenre(
                        e.target
                          .value
                      )
                    }
                    style={
                      inputStyle
                    }
                    required
                  >
                    <option value="">
                      Select Genre
                    </option>

                    {genreOptions.map(
                      (item) => (
                        <option
                          key={
                            item
                          }
                          value={
                            item
                          }
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>

                  <label>
                    Subgenre
                  </label>

                  <input
                    value={
                      subgenre
                    }
                    onChange={(
                      e
                    ) =>
                      setSubgenre(
                        e.target
                          .value
                      )
                    }
                    placeholder="e.g. Romantic, Ghazal, Acoustic"
                    style={
                      inputStyle
                    }
                  />
                </div>

                <div>
                  <label>
                    Release date *
                  </label>

                  <input
                    type="date"
                    value={
                      releaseDate
                    }
                    onChange={(
                      e
                    ) =>
                      setReleaseDate(
                        e.target
                          .value
                      )
                    }
                    style={
                      inputStyle
                    }
                    required
                  />

                  <label>
                    Original release date *
                  </label>

                  <input
                    type="date"
                    value={
                      originalReleaseDate
                    }
                    onChange={(
                      e
                    ) =>
                      setOriginalReleaseDate(
                        e.target
                          .value
                      )
                    }
                    style={
                      inputStyle
                    }
                    required
                  />

                  <label>
                    Language *
                  </label>

                  <select
                    value={
                      language
                    }
                    onChange={(
                      e
                    ) => {
                      const newLanguage =
                        e.target
                          .value;

                      setLanguage(
                        newLanguage
                      );

                      /*
                       * Keep every track language
                       * synchronized with release language.
                       */
                      if (
                        newLanguage
                      ) {
                        setTracks(
                          (
                            prev
                          ) =>
                            prev.map(
                              (
                                track
                              ) => ({
                                ...track,
                                language:
                                  newLanguage,
                              })
                            )
                        );
                      }
                    }}
                    style={
                      inputStyle
                    }
                    required
                  >
                    <option value="">
                      Select Language
                    </option>

                    {languageOptions.map(
                      (item) => (
                        <option
                          key={
                            item
                          }
                          value={
                            item
                          }
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>

                  <label>
                    Music type *
                  </label>

                  <select
                    value={
                      musicType
                    }
                    onChange={(
                      e
                    ) =>
                      setMusicType(
                        e.target
                          .value
                      )
                    }
                    style={
                      inputStyle
                    }
                  >
                    <option value="original">
                      Original
                    </option>

                    <option value="ai_music">
                      AI Music
                    </option>

                    <option value="dj_remix">
                      DJ Remix
                    </option>

                    <option value="lofi">
                      Lofi
                    </option>

                    <option value="cover">
                      Cover Version
                    </option>

                    <option value="remake">
                      Remake
                    </option>
                  </select>

                  <label>
                    Catalog Number
                  </label>

                  <input
                    value={
                      catalogNumber
                    }
                    onChange={(
                      e
                    ) =>
                      setCatalogNumber(
                        e.target
                          .value
                      )
                    }
                    placeholder="Leave blank for Too Lost auto assignment"
                    style={
                      inputStyle
                    }
                  />
                </div>
              </div>

              <div
                style={
                  infoBox
                }
              >
                Auto UPC/ISRC fake/random
                identifiers generate nahi
                karta. Too Lost se returned
                authoritative values use kiye
                jayenge.
              </div>

              <h3>
                Release performers
              </h3>

              {artists.map(
                (
                  artist,
                  index
                ) => (
                  <div
                    key={
                      index
                    }
                    style={
                      artistRow
                    }
                  >
                    <input
                      value={
                        artist
                      }
                      onChange={(
                        e
                      ) =>
                        updateArtist(
                          index,
                          e.target
                            .value
                        )
                      }
                      placeholder={`Release artist ${
                        index +
                        1
                      }`}
                      style={{
                        ...inputStyle,
                        marginBottom:
                          0,
                      }}
                      required={
                        index ===
                        0
                      }
                    />

                    <button
                      type="button"
                      onClick={
                        addArtist
                      }
                      style={
                        smallBtn
                      }
                    >
                      + Add Artist
                    </button>

                    {artists.length >
                      1 && (
                      <button
                        type="button"
                        onClick={() =>
                          removeArtist(
                            index
                          )
                        }
                        style={
                          dangerBtn
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )
              )}

              <label>
                Label name *
              </label>

              <input
                value={
                  labelName
                }
                onChange={(
                  e
                ) =>
                  setLabelName(
                    e.target
                      .value
                  )
                }
                placeholder="Label name"
                style={
                  inputStyle
                }
                required
              />

              <h3>
                Identifiers
              </h3>

              <label>
                UPC
              </label>

              <input
                value={
                  upc
                }
                onChange={(
                  e
                ) =>
                  setUpc(
                    e.target
                      .value
                  )
                }
                disabled={
                  autoUpc
                }
                placeholder="Leave blank for Too Lost auto assignment"
                style={
                  inputStyle
                }
              />

              <label
                style={
                  checkLabel
                }
              >
                <input
                  type="checkbox"
                  checked={
                    autoUpc
                  }
                  disabled={
                    previouslyReleased
                  }
                  onChange={(
                    e
                  ) =>
                    setAutoUpc(
                      e.target
                        .checked
                    )
                  }
                />

                Assign UPC automatically
              </label>

              <label
                style={
                  checkLabel
                }
              >
                <input
                  type="checkbox"
                  checked={
                    previouslyReleased
                  }
                  onChange={(
                    e
                  ) =>
                    handlePreviouslyReleased(
                      e.target
                        .checked
                    )
                  }
                />

                This music was previously released
              </label>

              {previouslyReleased && (
                <>
                  <label>
                    Previous UPC / EAN *
                  </label>

                  <input
                    value={
                      previousUpc
                    }
                    onChange={(
                      e
                    ) =>
                      setPreviousUpc(
                        e.target
                          .value
                      )
                    }
                    placeholder="Old UPC"
                    style={
                      inputStyle
                    }
                  />
                </>
              )}

              <label
                style={
                  checkLabel
                }
              >
                <input
                  type="checkbox"
                  checked={
                    contentIdRequired
                  }
                  onChange={(
                    e
                  ) =>
                    setContentIdRequired(
                      e.target
                        .checked
                    )
                  }
                />

                Enable Content ID / YouTube claiming
              </label>

              <StepButtons
                goBackStep={
                  goBackStep
                }
                goNext={
                  goNext
                }
                activeStep={
                  activeStep
                }
                loading={
                  loading
                }
              />
            </>
          )}

          {activeStep ===
            "Files" && (
            <>
              <h3>
                Files
              </h3>

              <label>
                Optional music license /
                permission PDF
              </label>

              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={(
                  e
                ) =>
                  setLicenseFile(
                    e.target
                      .files?.[0] ||
                      null
                  )
                }
                style={
                  inputStyle
                }
              />

              <p
                style={
                  mutedText
                }
              >
                Upload license only if this
                release is remix, cover, remake,
                sampled, leased beat, or
                third-party content.
              </p>

              <StepButtons
                goBackStep={
                  goBackStep
                }
                goNext={
                  goNext
                }
                activeStep={
                  activeStep
                }
                loading={
                  loading
                }
              />
            </>
          )}

          {activeStep ===
            "Recordings" && (
            <>
              <div
                style={
                  sectionHeader
                }
              >
                <h3>
                  Recordings / Tracks
                </h3>

                <div>
                  <button
                    type="button"
                    onClick={
                      copyFirstTrackMetadata
                    }
                    style={
                      smallBtn
                    }
                  >
                    Copy first track metadata
                  </button>

                  <button
                    type="button"
                    onClick={
                      addTrack
                    }
                    style={
                      smallBtn
                    }
                  >
                    + Add Track
                  </button>
                </div>
              </div>

              {tracks.map(
                (
                  track,
                  index
                ) => (
                  <div
                    key={
                      index
                    }
                    style={
                      trackCard
                    }
                  >
                    <div
                      style={
                        sectionHeader
                      }
                    >
                      <h3>
                        Track{" "}
                        {index +
                          1}
                      </h3>

                      <button
                        type="button"
                        onClick={() =>
                          removeTrack(
                            index
                          )
                        }
                        style={
                          dangerBtn
                        }
                      >
                        Remove
                      </button>
                    </div>

                    <div
                      style={
                        twoCol
                      }
                    >
                      <div>
                        <label>
                          Track title *
                        </label>

                        <input
                          value={
                            track.title
                          }
                          onChange={(
                            e
                          ) =>
                            updateTrack(
                              index,
                              "title",
                              e.target
                                .value
                            )
                          }
                          style={
                            inputStyle
                          }
                          required
                        />

                        <label>
                          Version
                        </label>

                        <input
                          value={
                            track.version
                          }
                          onChange={(
                            e
                          ) =>
                            updateTrack(
                              index,
                              "version",
                              e.target
                                .value
                            )
                          }
                          placeholder="Original, Remix, Lofi"
                          style={
                            inputStyle
                          }
                        />

                        <label>
                          ISRC
                        </label>

                        <input
                          value={
                            track.isrc
                          }
                          disabled={
                            track.auto_isrc
                          }
                          onChange={(
                            e
                          ) =>
                            updateTrack(
                              index,
                              "isrc",
                              e.target
                                .value
                            )
                          }
                          placeholder="Leave blank for Too Lost auto assignment"
                          style={
                            inputStyle
                          }
                        />

                        <label
                          style={
                            checkLabel
                          }
                        >
                          <input
                            type="checkbox"
                            checked={
                              track.auto_isrc
                            }
                            onChange={(
                              e
                            ) =>
                              updateTrack(
                                index,
                                "auto_isrc",
                                e.target
                                  .checked
                              )
                            }
                          />

                          Assign ISRC automatically
                        </label>

                        <label
                          style={
                            checkLabel
                          }
                        >
                          <input
                            type="checkbox"
                            checked={
                              track.previous_isrc_enabled
                            }
                            onChange={(
                              e
                            ) =>
                              updateTrack(
                                index,
                                "previous_isrc_enabled",
                                e.target
                                  .checked
                              )
                            }
                          />

                          Add Previous ISRC
                        </label>

                        {track.previous_isrc_enabled && (
                          <input
                            value={
                              track.previous_isrc
                            }
                            onChange={(
                              e
                            ) =>
                              updateTrack(
                                index,
                                "previous_isrc",
                                e.target
                                  .value
                              )
                            }
                            placeholder="Previous ISRC"
                            style={
                              inputStyle
                            }
                          />
                        )}
                      </div>

                      <div>
                        <label>
                          Content type
                        </label>

                        <select
                          value={
                            track.content_type
                          }
                          onChange={(
                            e
                          ) =>
                            updateTrack(
                              index,
                              "content_type",
                              e.target
                                .value
                            )
                          }
                          style={
                            inputStyle
                          }
                        >
                          <option value="original">
                            Original
                          </option>

                          <option value="ai_music">
                            AI Music
                          </option>

                          <option value="dj_remix">
                            DJ Remix
                          </option>

                          <option value="lofi">
                            Lofi
                          </option>

                          <option value="cover">
                            Cover
                          </option>
                        </select>

                        <label>
                          Track language
                        </label>

                        <select
                          value={
                            language
                          }
                          disabled
                          style={
                            inputStyle
                          }
                        >
                          <option
                            value={
                              language
                            }
                          >
                            {language ||
                              "Select release language first"}
                          </option>
                        </select>

                        <p
                          style={
                            mutedText
                          }
                        >
                          Track language automatically
                          release language ke same rahegi.
                        </p>

                        <label>
                          Audio file * (WAV only)
                        </label>

                        <input
                          type="file"
                          accept=".wav,audio/wav"
                          onChange={(
                            e
                          ) => {
                            const file =
                              e.target
                                .files?.[0] ||
                              null;

                            if (
                              !file
                            ) {
                              updateTrack(
                                index,
                                "audio",
                                null
                              );

                              return;
                            }

                            if (
                              !/\.wav$/i.test(
                                file.name
                              )
                            ) {
                              alert(
                                "Sirf WAV audio file upload karo. Example: song.wav"
                              );

                              e.currentTarget.value =
                                "";

                              updateTrack(
                                index,
                                "audio",
                                null
                              );

                              return;
                            }

                            updateTrack(
                              index,
                              "audio",
                              file
                            );
                          }}
                          style={
                            inputStyle
                          }
                          required
                        />

                        <label
                          style={
                            checkLabel
                          }
                        >
                          <input
                            type="checkbox"
                            checked={
                              track.explicit
                            }
                            onChange={(
                              e
                            ) =>
                              updateTrack(
                                index,
                                "explicit",
                                e.target
                                  .checked
                              )
                            }
                          />

                          Explicit content
                        </label>
                      </div>
                    </div>
                  </div>
                )
              )}

              <StepButtons
                goBackStep={
                  goBackStep
                }
                goNext={
                  goNext
                }
                activeStep={
                  activeStep
                }
                loading={
                  loading
                }
              />
            </>
          )}

          {activeStep ===
            "Authors" && (
            <>
              <h3>
                Authors & Contributors
              </h3>

              <div
                style={
                  infoBox
                }
              >
                <strong>
                  Composer is required
                </strong>

                <br />

                Too Lost requires at least one
                Composer credit for the track.
              </div>

              {tracks.map(
                (
                  track,
                  index
                ) => (
                  <div
                    key={
                      index
                    }
                    style={
                      trackCard
                    }
                  >
                    <h3>
                      {index +
                        1}
                      .{" "}
                      {track.title ||
                        "Untitled Track"}
                    </h3>

                    <div
                      style={
                        twoCol
                      }
                    >
                      <PersonInput
                        label="Composer *"
                        value={
                          track.composer
                        }
                        onChange={(
                          v: string
                        ) =>
                          updateTrack(
                            index,
                            "composer",
                            v
                          )
                        }
                        onAdd={() =>
                          addPersonField(
                            index,
                            "composer"
                          )
                        }
                      />

                      <PersonInput
                        label="Producer"
                        value={
                          track.producer
                        }
                        onChange={(
                          v: string
                        ) =>
                          updateTrack(
                            index,
                            "producer",
                            v
                          )
                        }
                        onAdd={() =>
                          addPersonField(
                            index,
                            "producer"
                          )
                        }
                      />

                      <PersonInput
                        label="Lyricist"
                        value={
                          track.lyricist
                        }
                        onChange={(
                          v: string
                        ) =>
                          updateTrack(
                            index,
                            "lyricist",
                            v
                          )
                        }
                        onAdd={() =>
                          addPersonField(
                            index,
                            "lyricist"
                          )
                        }
                      />

                      <PersonInput
                        label="Publisher"
                        value={
                          track.publisher
                        }
                        onChange={(
                          v: string
                        ) =>
                          updateTrack(
                            index,
                            "publisher",
                            v
                          )
                        }
                        onAdd={() =>
                          addPersonField(
                            index,
                            "publisher"
                          )
                        }
                      />
                    </div>
                  </div>
                )
              )}

              <StepButtons
                goBackStep={
                  goBackStep
                }
                goNext={
                  goNext
                }
                activeStep={
                  activeStep
                }
                loading={
                  loading
                }
              />
            </>
          )}

          {activeStep ===
            "Lyrics" && (
            <>
              <h3>
                Lyrics
              </h3>

              <textarea
                value={
                  lyricsText
                }
                onChange={(
                  e
                ) =>
                  setLyricsText(
                    e.target
                      .value
                  )
                }
                placeholder="Paste or write your song lyrics here..."
                style={
                  textareaStyle
                }
              />

              <StepButtons
                goBackStep={
                  goBackStep
                }
                goNext={
                  goNext
                }
                activeStep={
                  activeStep
                }
                loading={
                  loading
                }
              />
            </>
          )}

          {activeStep ===
            "Cover" && (
            <>
              <h3>
                Cover artwork
              </h3>

              <label>
                Artwork JPG/PNG 3000x3000 *
              </label>

              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(
                  e
                ) =>
                  handleArtwork(
                    e.target
                      .files?.[0] ||
                      null
                  )
                }
                style={
                  inputStyle
                }
                required
              />

              <p
                style={
                  mutedText
                }
              >
                3000x3000 JPG/PNG required.
                Artwork Supabase par upload hoga
                aur same Too Lost release ID par
                attach hoga.
              </p>

              <StepButtons
                goBackStep={
                  goBackStep
                }
                goNext={
                  goNext
                }
                activeStep={
                  activeStep
                }
                loading={
                  loading
                }
              />
            </>
          )}

          {activeStep ===
            "Distribution" && (
            <>
              <h3>
                Distribution
              </h3>

              <h4>
                DSP Selection
              </h4>

              <div
                style={
                  chipGrid
                }
              >
                {dspOptions.map(
                  (dsp) => (
                    <button
                      type="button"
                      key={
                        dsp
                      }
                      onClick={() =>
                        toggleDsp(
                          dsp
                        )
                      }
                      style={{
                        ...chip,

                        background:
                          selectedDSPs.includes(
                            dsp
                          )
                            ? "#2563EB"
                            : "#0B1020",
                      }}
                    >
                      {selectedDSPs.includes(
                        dsp
                      )
                        ? "✓ "
                        : ""}

                      {dsp}
                    </button>
                  )
                )}
              </div>

              <h4>
                Country Selection
              </h4>

              <div
                style={
                  chipGrid
                }
              >
                {countryOptions.map(
                  (
                    country
                  ) => (
                    <button
                      type="button"
                      key={
                        country
                      }
                      onClick={() =>
                        toggleCountry(
                          country
                        )
                      }
                      style={{
                        ...chip,

                        background:
                          selectedCountries.includes(
                            country
                          )
                            ? "#2563EB"
                            : "#0B1020",
                      }}
                    >
                      {selectedCountries.includes(
                        country
                      )
                        ? "✓ "
                        : ""}

                      {country}
                    </button>
                  )
                )}
              </div>

              <StepButtons
                goBackStep={
                  goBackStep
                }
                goNext={
                  goNext
                }
                activeStep={
                  activeStep
                }
                loading={
                  loading
                }
              />
            </>
          )}

          {activeStep ===
            "Confirm" && (
            <>
              <h3>
                Confirm submission
              </h3>

              <div
                style={
                  confirmGrid
                }
              >
                <div
                  style={
                    confirmCard
                  }
                >
                  Title:{" "}
                  {title ||
                    "-"}
                </div>

                <div
                  style={
                    confirmCard
                  }
                >
                  Artist:{" "}
                  {mainArtist ||
                    "-"}
                </div>

                <div
                  style={
                    confirmCard
                  }
                >
                  Type:{" "}
                  {releaseType}
                </div>

                <div
                  style={
                    confirmCard
                  }
                >
                  Label:{" "}
                  {labelName ||
                    "-"}
                </div>

                <div
                  style={
                    confirmCard
                  }
                >
                  Genre:{" "}
                  {genre ||
                    "-"}
                </div>

                <div
                  style={
                    confirmCard
                  }
                >
                  Subgenre:{" "}
                  {subgenre ||
                    "-"}
                </div>

                <div
                  style={
                    confirmCard
                  }
                >
                  Language:{" "}
                  {language ||
                    "-"}
                </div>

                <div
                  style={
                    confirmCard
                  }
                >
                  Tracks:{" "}
                  {
                    tracks.length
                  }
                </div>

                <div
                  style={
                    confirmCard
                  }
                >
                  Catalog:{" "}
                  {catalogNumber ||
                    "Too Lost auto"}
                </div>

                <div
                  style={
                    confirmCard
                  }
                >
                  UPC:{" "}
                  {autoUpc
                    ? "Too Lost auto"
                    : upc ||
                      "-"}
                </div>

                <div
                  style={
                    confirmCard
                  }
                >
                  C-Line:{" "}
                  {cYear}{" "}
                  {cLine ||
                    "-"}
                </div>

                <div
                  style={
                    confirmCard
                  }
                >
                  P-Line:{" "}
                  {pYear}{" "}
                  {pLine ||
                    "-"}
                </div>

                <div
                  style={
                    confirmCard
                  }
                >
                  DSPs:{" "}
                  {
                    selectedDSPs.length
                  }
                </div>

                <div
                  style={
                    confirmCard
                  }
                >
                  Countries:{" "}
                  {
                    selectedCountries.join(
                      ", "
                    )
                  }
                </div>

                <div
                  style={
                    confirmCard
                  }
                >
                  Content ID:{" "}
                  {contentIdRequired
                    ? "Yes"
                    : "No"}
                </div>
              </div>

              <h3
                style={{
                  marginTop:
                    "24px",
                }}
              >
                Copyright Information
              </h3>

              <div
                style={
                  twoCol
                }
              >
                <div>
                  <label>
                    C-Line Year *
                  </label>

                  <input
                    value={
                      cYear
                    }
                    onChange={(
                      e
                    ) =>
                      setCYear(
                        e.target
                          .value
                      )
                    }
                    placeholder="2026"
                    style={
                      inputStyle
                    }
                  />

                  <label>
                    C-Line *
                  </label>

                  <input
                    value={
                      cLine
                    }
                    onChange={(
                      e
                    ) =>
                      setCLine(
                        e.target
                          .value
                      )
                    }
                    placeholder="© 2026 Your Label"
                    style={
                      inputStyle
                    }
                  />
                </div>

                <div>
                  <label>
                    P-Line Year *
                  </label>

                  <input
                    value={
                      pYear
                    }
                    onChange={(
                      e
                    ) =>
                      setPYear(
                        e.target
                          .value
                      )
                    }
                    placeholder="2026"
                    style={
                      inputStyle
                    }
                  />

                  <label>
                    P-Line *
                  </label>

                  <input
                    value={
                      pLine
                    }
                    onChange={(
                      e
                    ) =>
                      setPLine(
                        e.target
                          .value
                      )
                    }
                    placeholder="℗ 2026 Your Label"
                    style={
                      inputStyle
                    }
                  />
                </div>
              </div>

              <div
                style={
                  twoCol
                }
              >
                <div>
                  <label>
                    License Type
                  </label>

                  <input
                    value={
                      licenseType
                    }
                    onChange={(
                      e
                    ) =>
                      setLicenseType(
                        e.target
                          .value
                      )
                    }
                    placeholder="Copyright / Licensed / Original"
                    style={
                      inputStyle
                    }
                  />
                </div>

                <div>
                  <label>
                    License Info
                  </label>

                  <input
                    value={
                      licenseInfo
                    }
                    onChange={(
                      e
                    ) =>
                      setLicenseInfo(
                        e.target
                          .value
                      )
                    }
                    placeholder="Optional license information"
                    style={
                      inputStyle
                    }
                  />
                </div>
              </div>

              <div
                style={
                  bottomButtons
                }
              >
                <button
                  type="button"
                  onClick={
                    goBackStep
                  }
                  style={
                    secondaryBtn
                  }
                >
                  Back
                </button>

                <button
                  type="submit"
                  disabled={
                    loading
                  }
                  style={
                    submitBtn
                  }
                >
                  {loading
                    ? "Uploading..."
                    : "Submit Release"}
                </button>
              </div>
            </>
          )}
        </section>

        <aside
          style={
            helpPanel
          }
        >
          <h3>
            Help
          </h3>

          {artworkPreview ? (
            <img
              src={
                artworkPreview
              }
              alt="Artwork preview"
              style={
                previewArt
              }
            />
          ) : (
            <div
              style={
                emptyPreview
              }
            >
              Cover Preview
            </div>
          )}

          <p>
            Auto UPC and Auto ISRC fake
            identifiers create nahi karte.
            Too Lost se returned authoritative
            values use hote hain.
          </p>

          <p>
            Release metadata, artwork and tracks
            same Too Lost release ID par upload
            hote hain.
          </p>

          <div
            style={
              qualityBox
            }
          >
            <strong>
              Metadata Quality
            </strong>

            <h2>
              {completion}%
            </h2>
          </div>
        </aside>
      </form>
    </main>
  );
}

function StepButtons({
  goBackStep,
  goNext,
  activeStep,
  loading,
}: any) {
  return (
    <div
      style={
        bottomButtons
      }
    >
      {activeStep !==
        "Release" && (
        <button
          type="button"
          onClick={
            goBackStep
          }
          style={
            secondaryBtn
          }
        >
          Back
        </button>
      )}

      {activeStep !==
        "Confirm" && (
        <button
          type="button"
          onClick={
            goNext
          }
          disabled={
            loading
          }
          style={
            submitBtn
          }
        >
          Next
        </button>
      )}
    </div>
  );
}

function PersonInput({
  label,
  value,
  onChange,
  onAdd,
}: any) {
  return (
    <div>
      <label>
        {label}
      </label>

      <div
        style={
          artistRow
        }
      >
        <input
          value={
            value
          }
          onChange={(
            e
          ) =>
            onChange(
              e.target
                .value
            )
          }
          placeholder={`${label} name`}
          style={{
            ...inputStyle,
            marginBottom:
              0,
          }}
        />

        <button
          type="button"
          onClick={
            onAdd
          }
          style={
            smallBtn
          }
        >
          + Add
        </button>
      </div>
    </div>
  );
}

const pageStyle: CSSProperties =
  {
    minHeight:
      "100vh",

    background:
      "#050816",

    color:
      "white",

    fontFamily:
      "Arial, sans-serif",
  };

const topSpacer: CSSProperties =
  {
    height:
      "10px",

    background:
      "#050816",
  };

const topNav: CSSProperties =
  {
    display:
      "flex",

    alignItems:
      "center",

    background:
      "#111827",

    borderBottom:
      "1px solid #1F2937",

    minHeight:
      "56px",
  };

const exitBtn: CSSProperties =
  {
    marginLeft:
      "12px",

    border:
      "1px solid #334155",

    background:
      "#0B1020",

    color:
      "white",

    borderRadius:
      "8px",

    padding:
      "8px 12px",

    cursor:
      "pointer",
  };

const stepsBar: CSSProperties =
  {
    flex: 1,

    display:
      "grid",

    gridTemplateColumns:
      "repeat(9, 1fr)",

    marginLeft:
      "12px",
  };

const stepBtn: CSSProperties =
  {
    height:
      "56px",

    border:
      "none",

    background:
      "#111827",

    color:
      "#94A3B8",

    cursor:
      "pointer",

    appearance:
      "none",

    outline:
      "none",
  };

const layout: CSSProperties =
  {
    display:
      "grid",

    gridTemplateColumns:
      "1fr 260px",

    gap:
      "0",
  };

const mainPanel: CSSProperties =
  {
    margin:
      "18px",

    background:
      "#111827",

    borderRadius:
      "16px",

    padding:
      "24px",

    border:
      "1px solid #1F2937",

    minHeight:
      "calc(100vh - 100px)",
  };

const helpPanel: CSSProperties =
  {
    background:
      "#0B1020",

    padding:
      "24px",

    minHeight:
      "calc(100vh - 66px)",

    borderLeft:
      "1px solid #1F2937",

    color:
      "white",
  };

const inputStyle: CSSProperties =
  {
    width:
      "100%",

    height:
      "42px",

    padding:
      "8px 12px",

    marginTop:
      "6px",

    marginBottom:
      "14px",

    borderRadius:
      "8px",

    border:
      "1px solid #334155",

    background:
      "#0B1020",

    color:
      "white",

    colorScheme:
      "dark",
  };

const textareaStyle: CSSProperties =
  {
    ...inputStyle,

    height:
      "260px",

    resize:
      "vertical",
  };

const twoCol: CSSProperties =
  {
    display:
      "grid",

    gridTemplateColumns:
      "1fr 1fr",

    gap:
      "22px",
  };

const infoBox: CSSProperties =
  {
    background:
      "#0B1020",

    border:
      "1px solid #1F2937",

    padding:
      "12px",

    borderRadius:
      "8px",

    margin:
      "14px 0",

    color:
      "#CBD5E1",
  };

const checkLabel: CSSProperties =
  {
    display:
      "flex",

    gap:
      "8px",

    alignItems:
      "center",

    marginBottom:
      "12px",
  };

const progressBox: CSSProperties =
  {
    marginBottom:
      "18px",
  };

const progressTrack: CSSProperties =
  {
    height:
      "8px",

    background:
      "#0B1020",

    borderRadius:
      "999px",

    marginTop:
      "8px",

    border:
      "1px solid #1F2937",
  };

const progressFill: CSSProperties =
  {
    height:
      "8px",

    background:
      "#2563EB",

    borderRadius:
      "999px",
  };

const trackCard: CSSProperties =
  {
    background:
      "#0B1020",

    border:
      "1px solid #1F2937",

    borderRadius:
      "12px",

    padding:
      "16px",

    marginBottom:
      "16px",
  };

const sectionHeader: CSSProperties =
  {
    display:
      "flex",

    justifyContent:
      "space-between",

    alignItems:
      "center",

    gap:
      "10px",
  };

const smallBtn: CSSProperties =
  {
    marginLeft:
      "8px",

    padding:
      "9px 12px",

    border:
      "none",

    borderRadius:
      "8px",

    background:
      "#2563EB",

    color:
      "white",

    cursor:
      "pointer",

    whiteSpace:
      "nowrap",
  };

const dangerBtn: CSSProperties =
  {
    ...smallBtn,

    background:
      "#DC2626",
  };

const secondaryBtn: CSSProperties =
  {
    padding:
      "12px 18px",

    borderRadius:
      "10px",

    border:
      "1px solid #334155",

    background:
      "#0B1020",

    color:
      "white",

    cursor:
      "pointer",
  };

const chipGrid: CSSProperties =
  {
    display:
      "flex",

    flexWrap:
      "wrap",

    gap:
      "10px",

    marginBottom:
      "20px",
  };

const chip: CSSProperties =
  {
    padding:
      "10px 14px",

    borderRadius:
      "999px",

    border:
      "1px solid #334155",

    color:
      "white",

    cursor:
      "pointer",
  };

const previewArt: CSSProperties =
  {
    width:
      "100%",

    aspectRatio:
      "1/1",

    objectFit:
      "cover",

    borderRadius:
      "10px",

    marginBottom:
      "18px",
  };

const emptyPreview: CSSProperties =
  {
    width:
      "100%",

    aspectRatio:
      "1/1",

    background:
      "#111827",

    border:
      "1px dashed #334155",

    borderRadius:
      "10px",

    display:
      "flex",

    alignItems:
      "center",

    justifyContent:
      "center",

    color:
      "#94A3B8",

    marginBottom:
      "18px",
  };

const qualityBox: CSSProperties =
  {
    marginTop:
      "20px",

    background:
      "#111827",

    border:
      "1px solid #1F2937",

    padding:
      "16px",

    borderRadius:
      "10px",
  };

const confirmGrid: CSSProperties =
  {
    display:
      "grid",

    gridTemplateColumns:
      "repeat(2, 1fr)",

    gap:
      "12px",
  };

const confirmCard: CSSProperties =
  {
    background:
      "#0B1020",

    border:
      "1px solid #1F2937",

    padding:
      "14px",

    borderRadius:
      "8px",
  };

const submitBtn: CSSProperties =
  {
    padding:
      "12px 18px",

    border:
      "none",

    borderRadius:
      "10px",

    background:
      "#2563EB",

    color:
      "white",

    fontWeight:
      "bold",

    cursor:
      "pointer",
  };

const bottomButtons: CSSProperties =
  {
    display:
      "flex",

    justifyContent:
      "flex-end",

    gap:
      "10px",

    marginTop:
      "24px",
  };

const artistRow: CSSProperties =
  {
    display:
      "flex",

    gap:
      "8px",

    alignItems:
      "center",

    marginBottom:
      "14px",
  };

const mutedText: CSSProperties =
  {
    color:
      "#94A3B8",
  };
