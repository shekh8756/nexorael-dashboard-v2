"use client";

import {
  useMemo,
  useState,
} from "react";

import type {
  ChangeEvent,
  CSSProperties,
} from "react";

import {
  supabase,
} from "@/lib/supabase";

import {
  convertWavToFlac,
} from "@/lib/audio-to-flac";

/* ======================================================
   TYPES
====================================================== */

type RowStatus =
  | "ready"
  | "processing"
  | "success"
  | "failed";

type BulkRow = {
  id: string;

  title: string;
  artist_name: string;
  label_name: string;

  release_type: string;

  genre: string;
  subgenre: string;

  language: string;

  release_date: string;
  original_release_date: string;

  c_line: string;
  p_line: string;

  audio_file: string;
  artwork_file: string;

  composer: string;
  lyricist: string;

  isrc: string;
  upc: string;

  explicit: boolean;

  audioMatched: boolean;
  artworkMatched: boolean;

  errors: string[];

  status: RowStatus;

  message: string;

  toolostReleaseId?: string;
};

/* ======================================================
   HELPERS
====================================================== */

function clean(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function normalizeHeader(
  value: string
) {
  return clean(value)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function normalizeFileName(
  value: string
) {
  return clean(value)
    .toLowerCase()
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/\s+/g, "_") ?? "";
}

function parseBoolean(
  value: unknown
) {
  const text =
    clean(value)
      .toLowerCase();

  return [
    "true",
    "1",
    "yes",
    "y",
  ].includes(text);
}

/*
 * Basic CSV parser supporting quoted values.
 */

function parseCSVLine(
  line: string
) {
  const values: string[] =
    [];

  let current = "";
  let insideQuotes =
    false;

  for (
    let i = 0;
    i < line.length;
    i++
  ) {
    const char =
      line[i];

    if (char === '"') {
      if (
        insideQuotes &&
        line[i + 1] ===
          '"'
      ) {
        current += '"';
        i++;
      } else {
        insideQuotes =
          !insideQuotes;
      }

      continue;
    }

    if (
      char === "," &&
      !insideQuotes
    ) {
      values.push(
        current.trim()
      );

      current = "";

      continue;
    }

    current += char;
  }

  values.push(
    current.trim()
  );

  return values;
}

function getYearFromLine(
  value: string
) {
  const match =
    String(value).match(
      /\b(19|20)\d{2}\b/
    );

  if (match) {
    return Number(
      match[0]
    );
  }

  return new Date()
    .getFullYear();
}

function mapReleaseType(
  value: string
) {
  const normalized =
    clean(value)
      .toLowerCase();

  if (
    normalized === "album"
  ) {
    return "Album";
  }

  if (
    normalized === "ep"
  ) {
    return "EP";
  }

  return "Single";
}

function databaseReleaseType(
  value: string
) {
  const normalized =
    clean(value)
      .toLowerCase();

  if (
    normalized === "album"
  ) {
    return "album";
  }

  if (
    normalized === "ep"
  ) {
    return "ep";
  }

  return "single";
}

/* ======================================================
   PAGE
====================================================== */

export default function BulkUploadPage() {
  const [
    rows,
    setRows,
  ] =
    useState<BulkRow[]>(
      []
    );

  const [
    audioFiles,
    setAudioFiles,
  ] =
    useState<File[]>([]);

  const [
    artworkFiles,
    setArtworkFiles,
  ] =
    useState<File[]>([]);

  const [
    processing,
    setProcessing,
  ] =
    useState(false);

  const [
    progress,
    setProgress,
  ] =
    useState(0);

  const [
    currentMessage,
    setCurrentMessage,
  ] =
    useState("");

  /* ====================================================
     FILE MAPS
  ==================================================== */

  const audioMap =
    useMemo(() => {
      const map =
        new Map<
          string,
          File
        >();

      for (
        const file of audioFiles
      ) {
        map.set(
          normalizeFileName(
            file.name
          ),
          file
        );
      }

      return map;
    }, [audioFiles]);

  const artworkMap =
    useMemo(() => {
      const map =
        new Map<
          string,
          File
        >();

      for (
        const file of artworkFiles
      ) {
        map.set(
          normalizeFileName(
            file.name
          ),
          file
        );
      }

      return map;
    }, [artworkFiles]);

  /* ====================================================
     ROW VALIDATION
  ==================================================== */

  function validateRow(
    row: BulkRow,
    currentAudioMap =
      audioMap,
    currentArtworkMap =
      artworkMap
  ) {
    const errors: string[] =
      [];

    if (!row.title) {
      errors.push(
        "Title missing"
      );
    }

    if (
      !row.artist_name
    ) {
      errors.push(
        "Artist missing"
      );
    }

    if (
      !row.label_name
    ) {
      errors.push(
        "Label missing"
      );
    }

    if (!row.genre) {
      errors.push(
        "Genre missing"
      );
    }

    if (!row.language) {
      errors.push(
        "Language missing"
      );
    }

    if (
      !row.release_date
    ) {
      errors.push(
        "Release date missing"
      );
    }

    if (
      !row.original_release_date
    ) {
      errors.push(
        "Original release date missing"
      );
    }

    if (!row.c_line) {
      errors.push(
        "C-Line missing"
      );
    }

    if (!row.p_line) {
      errors.push(
        "P-Line missing"
      );
    }

    if (!row.composer) {
      errors.push(
        "Composer missing"
      );
    }

    if (
      !row.audio_file
    ) {
      errors.push(
        "Audio filename missing"
      );
    }

    if (
      !row.artwork_file
    ) {
      errors.push(
        "Artwork filename missing"
      );
    }

    const audioMatched =
      Boolean(
        currentAudioMap.get(
          normalizeFileName(
            row.audio_file
          )
        )
      );

    const artworkMatched =
      Boolean(
        currentArtworkMap.get(
          normalizeFileName(
            row.artwork_file
          )
        )
      );

    if (!audioMatched) {
      errors.push(
        "Audio not matched"
      );
    }

    if (!artworkMatched) {
      errors.push(
        "Artwork not matched"
      );
    }

    return {
      ...row,
      audioMatched,
      artworkMatched,
      errors,
    };
  }

  function revalidateRows(
    nextAudioFiles =
      audioFiles,
    nextArtworkFiles =
      artworkFiles
  ) {
    const nextAudioMap =
      new Map<
        string,
        File
      >();

    for (
      const file of nextAudioFiles
    ) {
      nextAudioMap.set(
        normalizeFileName(
          file.name
        ),
        file
      );
    }

    const nextArtworkMap =
      new Map<
        string,
        File
      >();

    for (
      const file of nextArtworkFiles
    ) {
      nextArtworkMap.set(
        normalizeFileName(
          file.name
        ),
        file
      );
    }

    setRows(
      (previous) =>
        previous.map(
          (row) =>
            validateRow(
              row,
              nextAudioMap,
              nextArtworkMap
            )
        )
    );
  }

  /* ====================================================
     CSV
  ==================================================== */

  async function handleCSV(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target
        .files?.[0];

    if (!file) {
      return;
    }

    const text =
      await file.text();

    const lines =
      text
        .replace(
          /^\uFEFF/,
          ""
        )
        .split(/\r?\n/)
        .filter(
          (line) =>
            line.trim()
              .length > 0
        );

    if (
      lines.length < 2
    ) {
      alert(
        "CSV me data rows nahi hain."
      );

      return;
    }

    const headers =
      parseCSVLine(
        lines[0]
      ).map(
        normalizeHeader
      );

    const required =
      [
        "title",
        "artist_name",
        "label_name",
        "release_type",
        "genre",
        "language",
        "release_date",
        "original_release_date",
        "c_line",
        "p_line",
        "audio_file",
        "artwork_file",
        "composer",
      ];

    const missing =
      required.filter(
        (header) =>
          !headers.includes(
            header
          )
      );

    if (
      missing.length
    ) {
      alert(
        `CSV me required columns missing hain:\n\n${missing.join(
          ", "
        )}`
      );

      return;
    }

    const parsedRows:
      BulkRow[] =
      lines
        .slice(1)
        .map(
          (
            line,
            index
          ) => {
            const values =
              parseCSVLine(
                line
              );

            const record:
              Record<
                string,
                string
              > = {};

            headers.forEach(
              (
                header,
                headerIndex
              ) => {
                record[
                  header
                ] =
                  values[
                    headerIndex
                  ] ?? "";
              }
            );

            const row:
              BulkRow = {
              id:
                `${Date.now()}-${index}`,

              title:
                clean(
                  record.title
                ),

              artist_name:
                clean(
                  record.artist_name
                ),

              label_name:
                clean(
                  record.label_name
                ),

              release_type:
                clean(
                  record.release_type ||
                    "Single"
                ),

              genre:
                clean(
                  record.genre
                ),

              subgenre:
                clean(
                  record.subgenre
                ),

              language:
                clean(
                  record.language
                ),

              release_date:
                clean(
                  record.release_date
                ),

              original_release_date:
                clean(
                  record.original_release_date
                ),

              c_line:
                clean(
                  record.c_line
                ),

              p_line:
                clean(
                  record.p_line
                ),

              audio_file:
                clean(
                  record.audio_file
                ),

              artwork_file:
                clean(
                  record.artwork_file
                ),

              composer:
                clean(
                  record.composer
                ),

              lyricist:
                clean(
                  record.lyricist
                ),

              isrc:
                clean(
                  record.isrc
                ),

              upc:
                clean(
                  record.upc
                ),

              explicit:
                parseBoolean(
                  record.explicit
                ),

              audioMatched:
                false,

              artworkMatched:
                false,

              errors: [],

              status:
                "ready",

              message:
                "",
            };

            return validateRow(
              row
            );
          }
        );

    setRows(
      parsedRows
    );

    setProgress(0);

    setCurrentMessage(
      `${parsedRows.length} CSV rows loaded.`
    );
  }

  /* ====================================================
     AUDIO FILES
  ==================================================== */

  function handleAudioFiles(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const files =
      Array.from(
        event.target
          .files ?? []
      );

    const invalid =
      files.filter(
        (file) =>
          !/\.wav$/i.test(
            file.name
          )
      );

    if (
      invalid.length
    ) {
      alert(
        `Sirf WAV allowed hai.\n\nInvalid:\n${invalid
          .map(
            (file) =>
              file.name
          )
          .join("\n")}`
      );

      return;
    }

    setAudioFiles(
      files
    );

    revalidateRows(
      files,
      artworkFiles
    );
  }

  /* ====================================================
     ARTWORK FILES
  ==================================================== */

  function handleArtworkFiles(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const files =
      Array.from(
        event.target
          .files ?? []
      );

    const invalid =
      files.filter(
        (file) =>
          !/\.(jpg|jpeg|png)$/i.test(
            file.name
          )
      );

    if (
      invalid.length
    ) {
      alert(
        `Sirf JPG/JPEG/PNG artwork allowed hai.\n\nInvalid:\n${invalid
          .map(
            (file) =>
              file.name
          )
          .join("\n")}`
      );

      return;
    }

    setArtworkFiles(
      files
    );

    revalidateRows(
      audioFiles,
      files
    );
  }

  /* ====================================================
     SUPABASE UPLOAD
  ==================================================== */

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
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(
          2,
          8
        )}-${cleanName}`;

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

    if (
      !data.publicUrl
    ) {
      throw new Error(
        `${bucket} public URL missing.`
      );
    }

    return data.publicUrl;
  }

  /* ====================================================
     ARTWORK DIMENSIONS
  ==================================================== */

  async function validateArtworkDimensions(
    file: File
  ) {
    return new Promise<void>(
      (
        resolve,
        reject
      ) => {
        const image =
          new Image();

        const url =
          URL.createObjectURL(
            file
          );

        image.onload =
          () => {
            URL.revokeObjectURL(
              url
            );

            if (
              image.width !==
                3000 ||
              image.height !==
                3000
            ) {
              reject(
                new Error(
                  `${file.name}: artwork 3000x3000 hona chahiye. Current ${image.width}x${image.height}.`
                )
              );

              return;
            }

            resolve();
          };

        image.onerror =
          () => {
            URL.revokeObjectURL(
              url
            );

            reject(
              new Error(
                `${file.name}: artwork read nahi ho saka.`
              )
            );
          };

        image.src =
          url;
      }
    );
  }

  /* ====================================================
     UPDATE ROW STATUS
  ==================================================== */

  function updateRow(
    id: string,
    patch:
      Partial<BulkRow>
  ) {
    setRows(
      (previous) =>
        previous.map(
          (row) =>
            row.id === id
              ? {
                  ...row,
                  ...patch,
                }
              : row
        )
    );
  }

  /* ====================================================
     PROCESS SINGLE RELEASE
  ==================================================== */

  async function processRow(
  row: BulkRow,
  userId: string,
  whiteLabelId: string | null,
  accessToken: string
) {
    const audioFile =
      audioMap.get(
        normalizeFileName(
          row.audio_file
        )
      );

    const artworkFile =
      artworkMap.get(
        normalizeFileName(
          row.artwork_file
        )
      );

    if (!audioFile) {
      throw new Error(
        `Audio file not found: ${row.audio_file}`
      );
    }

    if (!artworkFile) {
      throw new Error(
        `Artwork not found: ${row.artwork_file}`
      );
    }

    if (
      !/\.wav$/i.test(
        audioFile.name
      )
    ) {
      throw new Error(
        `${audioFile.name}: WAV required.`
      );
    }

    await validateArtworkDimensions(
      artworkFile
    );

    const releaseType =
      mapReleaseType(
        row.release_type
      );

    /*
     * =========================================
     * 1. CREATE TOO LOST RELEASE
     * =========================================
     */

    setCurrentMessage(
      `${row.title}: creating Too Lost draft...`
    );

    const createResponse =
      await fetch(
        "/api/admin/bulk-upload/create-release",
        {
          method:
            "POST",

          headers: {
  "Content-Type": "application/json",
  Authorization: `Bearer ${accessToken}`,
},

          body:
            JSON.stringify({
              title:
                row.title,

              artist_name:
                row.artist_name,

              label_name:
                row.label_name,

              release_type:
                releaseType,

              genre:
                row.genre,

              subgenre:
                row.subgenre ||
                undefined,

              language:
                row.language,

              release_date:
                row.release_date,

              original_release_date:
                row.original_release_date,

              upc:
                row.upc ||
                undefined,

              c_line:
                row.c_line,

              p_line:
                row.p_line,

              composer:
                row.composer,

              lyricist:
                row.lyricist,

              isrc:
                row.isrc ||
                undefined,

              explicit:
                row.explicit,
            }),
        }
      );

    const createData =
      await readJsonResponse(
        createResponse,
        "Bulk create release"
      );

    if (
      !createResponse.ok ||
      !createData.success
    ) {
      throw new Error(
        createData.error ||
          createData
            ?.tooLostResponse
            ?.message ||
          "Too Lost release creation failed."
      );
    }

    const tooLostReleaseId =
      String(
        createData.releaseId ||
          ""
      );

    if (
      !tooLostReleaseId
    ) {
      throw new Error(
        "Too Lost release ID missing."
      );
    }

    updateRow(
      row.id,
      {
        toolostReleaseId:
          tooLostReleaseId,
      }
    );

    const tooLostRelease =
      createData.data ||
      {};

    const authoritativeUpc =
      tooLostRelease?.upc ||
      tooLostRelease?.UPC ||
      tooLostRelease
        ?.upc_code ||
      row.upc ||
      null;

    const authoritativeCatalog =
      tooLostRelease
        ?.catalog_number ||
      tooLostRelease
        ?.catalogNumber ||
      null;

    /*
     * =========================================
     * 2. ARTWORK -> SUPABASE
     * =========================================
     */

    setCurrentMessage(
      `${row.title}: uploading artwork...`
    );

    const artworkUrl =
      await uploadFile(
        "release-artwork",
        artworkFile
      );

    /*
     * =========================================
     * 3. TOO LOST FULL METADATA
     * =========================================
     */

    setCurrentMessage(
      `${row.title}: updating Too Lost metadata...`
    );

    const cYear =
      getYearFromLine(
        row.c_line
      );

    const pYear =
      getYearFromLine(
        row.p_line
      );

    const metadataResponse =
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

              metadata: {
                title:
                  row.title,

                type:
                  releaseType,

                label:
                  row.label_name,

                primaryGenre:
                  row.genre,

                ...(row.subgenre
                  ? {
                      secondaryGenre:
                        row.subgenre,
                    }
                  : {}),

                language:
                  row.language,

                releaseDate:
                  row.release_date,

                originalReleaseDate:
                  row.original_release_date,

                coverUrl:
                  artworkUrl,

                cYear,

                cLine:
                  row.c_line,

                pYear,

                pLine:
                  row.p_line,

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
              },
            }),
        }
      );

    const metadataData =
      await readJsonResponse(
        metadataResponse,
        "Too Lost metadata"
      );

    if (
      !metadataResponse.ok ||
      !metadataData.success
    ) {
      throw new Error(
        metadataData.error ||
          "Too Lost metadata update failed."
      );
    }

    /*
     * =========================================
     * 4. SAVE RELEASE -> SUPABASE
     * =========================================
     */

    setCurrentMessage(
      `${row.title}: saving Nexorael release...`
    );

    const dbReleaseType =
      databaseReleaseType(
        row.release_type
      );

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
            userId,

          white_label_id:
            whiteLabelId,

          title:
            row.title,

          release_artists: [
            row.artist_name,
          ],

          artist_name:
            row.artist_name,

          label_name:
            row.label_name,

          label:
            row.label_name,

          genre:
            row.genre,

          subgenre:
            row.subgenre ||
            null,

          language:
            row.language,

          release_date:
            row.release_date,

          original_release_date:
            row.original_release_date,

          music_created_date:
            row.original_release_date,

          music_type:
            "original",

          previously_released:
            Boolean(
              row.upc
            ),

          previous_upc:
            row.upc ||
            null,

          content_id_required:
            false,

          /*
           * DSP selection happens later
           * from Admin Approve.
           */
          selected_dsps: [],

          selected_countries: [
            "Worldwide",
          ],

          upc:
            authoritativeUpc,

          auto_upc:
            !row.upc,

          catalog_number:
            authoritativeCatalog,

          release_type:
            dbReleaseType,

          type:
            releaseType,

          artwork_url:
            artworkUrl,

          cover_url:
            artworkUrl,

          toolost_release_id:
            tooLostReleaseId,

          status:
            "draft",
        })
        .select()
        .single();

    if (
      releaseError ||
      !releaseData
    ) {
      throw new Error(
        releaseError
          ?.message ||
          "Supabase release save failed."
      );
    }

    /*
     * =========================================
     * 5. WAV -> REAL FLAC
     * =========================================
     */

    setCurrentMessage(
      `${row.title}: converting WAV to FLAC...`
    );

    const flacFile =
      await convertWavToFlac(
        audioFile
      );

    if (
      !flacFile ||
      flacFile.size <= 0
    ) {
      throw new Error(
        `${row.title}: FLAC conversion failed.`
      );
    }

    /*
     * =========================================
     * 6. FLAC -> SUPABASE
     * =========================================
     */

    setCurrentMessage(
      `${row.title}: uploading FLAC to Supabase...`
    );

    const audioUrl =
      await uploadFile(
        "release-audio",
        flacFile
      );

    /*
     * =========================================
     * 7. SUPABASE -> TOO LOST
     * =========================================
     */

    setCurrentMessage(
      `${row.title}: transferring FLAC to Too Lost...`
    );

    const uploadResponse =
      await fetch(
        "/api/toolost/upload-from-url",
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

              sourceUrl:
                audioUrl,

              fileName:
                flacFile.name,
            }),
        }
      );

    const uploadData =
      await readJsonResponse(
        uploadResponse,
        "Too Lost audio upload"
      );

    if (
      !uploadResponse.ok ||
      !uploadData.success
    ) {
      throw new Error(
        uploadData.error ||
          uploadData
            ?.tooLostResponse
            ?.message ||
          "Audio transfer to Too Lost failed."
      );
    }

    const fileKey =
      uploadData.fileKey;

    if (!fileKey) {
      throw new Error(
        "Too Lost fileKey missing."
      );
    }

    /*
     * =========================================
     * 8. CREATE TRACK + ATTACH AUDIO
     * =========================================
     */

    setCurrentMessage(
      `${row.title}: creating Too Lost track...`
    );

    const finalizeResponse =
      await fetch(
        "/api/toolost/finalize-track",
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

              title:
                row.title,

              fileKey,

              trackNumber:
                1,

              artist:
                row.artist_name,

              composer:
                row.composer,

              lyricist:
                row.lyricist ||
                undefined,

              language:
                row.language,

              contentType:
                "original",

              explicit:
                row.explicit,

              isrc:
                row.isrc ||
                undefined,
            }),
        }
      );

    const finalizeData =
      await readJsonResponse(
        finalizeResponse,
        "Too Lost finalize track"
      );

    if (
      !finalizeResponse.ok ||
      !finalizeData.success
    ) {
      throw new Error(
        finalizeData.error ||
          finalizeData
            ?.tooLostResponse
            ?.message ||
          "Too Lost track creation failed."
      );
    }

    const actualIsrc =
      finalizeData
        ?.track?.isrc ||
      finalizeData
        ?.data?.isrc ||
      row.isrc ||
      null;

    /*
     * =========================================
     * 9. SAVE TRACK -> SUPABASE
     * =========================================
     */

    setCurrentMessage(
      `${row.title}: saving track...`
    );

    const {
      error:
        trackError,
    } =
      await supabase
        .from(
          "tracks"
        )
        .insert({
          release_id:
            releaseData.id,

          title:
            row.title,

          artist_name:
            row.artist_name,

          isrc:
            actualIsrc,

          auto_isrc:
            !row.isrc,

          auto_isrc_enabled:
            !row.isrc,

          previous_isrc:
            null,

          audio_url:
            audioUrl,

          track_number:
            1,

          explicit:
            row.explicit,

          composer:
            row.composer,

          lyricist:
            row.lyricist ||
            "",

          producer:
            "",

          publisher:
            "",

          version:
            "",

          language:
            row.language,

          content_type:
            "original",

          toolost_file_key:
            fileKey,
        });

    if (trackError) {
      throw new Error(
        trackError.message
      );
    }

    return {
      releaseData,
      tooLostReleaseId,
    };
  }

  /* ====================================================
     START BULK UPLOAD
  ==================================================== */

  async function startBulkUpload() {
    if (processing) {
      return;
    }

    if (!rows.length) {
      alert(
        "Pehle CSV upload karo."
      );

      return;
    }

    const validatedRows =
      rows.map(
        (row) =>
          validateRow(
            row
          )
      );

    setRows(
      validatedRows
    );

    const invalidRows =
      validatedRows.filter(
        (row) =>
          row.errors.length >
          0
      );

    if (
      invalidRows.length
    ) {
      alert(
        `${invalidRows.length} rows me validation error hai. Preview table check karo.`
      );

      return;
    }

    /*
     * LOGIN
     */

    const {
      data: userData,
      error:
        userError,
    } =
      await supabase.auth
        .getUser();

    if (
      userError ||
      !userData.user
    ) {
      alert(
        "Admin login required."
      );

      return;
    }

    /*
     * PROFILE
     */

    const {
      data: profile,
      error:
        profileError,
    } =
      await supabase
        .from(
          "profiles"
        )
        .select(
          "role, white_label_id"
        )
        .eq(
          "id",
          userData
            .user.id
        )
        .maybeSingle();

    if (profileError) {
      alert(
        profileError.message
      );

      return;
    }

    const allowedRoles =
      [
        "master_admin",
        "admin",
        "white_label_admin",
      ];

    if (
      !profile ||
      !allowedRoles.includes(
        String(
          profile.role ||
            ""
        )
      )
    ) {
      alert(
        "Admin permission required."
      );

      return;
    }
const {
  data: sessionData,
} = await supabase.auth.getSession();

const accessToken =
  sessionData.session?.access_token;

if (!accessToken) {
  alert(
    "Admin session token missing. Please login again."
  );

  return;
}
    setProcessing(
      true
    );

    setProgress(0);

    let completed =
      0;

    let failed =
      0;

    /*
     * IMPORTANT:
     *
     * Sequential processing is intentional.
     * WAV -> FLAC is CPU/memory heavy.
     *
     * Do NOT process 20 WAV conversions
     * simultaneously in browser.
     */

    for (
      let i = 0;
      i <
      validatedRows.length;
      i++
    ) {
      const row =
        validatedRows[i];

      updateRow(
        row.id,
        {
          status:
            "processing",

          message:
            "Starting...",
        }
      );

      try {
        setCurrentMessage(
          `Release ${i + 1}/${validatedRows.length}: ${row.title}`
        );

        const result =
  await processRow(
    row,
    userData.user.id,
    profile.white_label_id || null,
    accessToken
  );

        completed++;

        updateRow(
          row.id,
          {
            status:
              "success",

            message:
              "Draft created successfully",

            toolostReleaseId:
              result
                .tooLostReleaseId,
          }
        );
      } catch (
        error
      ) {
        failed++;

        console.error(
          `Bulk release failed: ${row.title}`,
          error
        );

        updateRow(
          row.id,
          {
            status:
              "failed",

            message:
              error instanceof
              Error
                ? error.message
                : "Unknown error",
          }
        );
      }

      setProgress(
        Math.round(
          ((i + 1) /
            validatedRows.length) *
            100
        )
      );
    }

    setProcessing(
      false
    );

    setCurrentMessage(
      `Finished. Success: ${completed}, Failed: ${failed}`
    );

    alert(
      `Bulk upload complete.\n\nSuccess: ${completed}\nFailed: ${failed}`
    );
  }

  /* ====================================================
     RETRY FAILED
  ==================================================== */

  async function retryFailed() {
    if (processing) {
      return;
    }

    const failedRows =
      rows.filter(
        (row) =>
          row.status ===
          "failed"
      );

    if (
      !failedRows.length
    ) {
      alert(
        "Koi failed release nahi hai."
      );

      return;
    }

    /*
     * Reset successful rows temporarily out
     * of processing selection.
     */

    const originalRows =
      rows;

    setRows(
      originalRows.map(
        (row) =>
          row.status ===
          "failed"
            ? {
                ...row,
                status:
                  "ready",
                message:
                  "",
              }
            : row
      )
    );

    alert(
      "Failed rows reset ho gaye. Ab Start Bulk Upload se retry kar sakte ho."
    );
  }

  /* ====================================================
     STATS
  ==================================================== */

  const validCount =
    rows.filter(
      (row) =>
        row.errors.length ===
        0
    ).length;

  const successCount =
    rows.filter(
      (row) =>
        row.status ===
        "success"
    ).length;

  const failedCount =
    rows.filter(
      (row) =>
        row.status ===
        "failed"
    ).length;

  /* ====================================================
     UI
  ==================================================== */

  return (
    <main
      style={
        pageStyle
      }
    >
      <div
        style={
          headerStyle
        }
      >
        <div>
          <h1
            style={{
              margin: 0,
            }}
          >
            Bulk Release Upload
          </h1>

          <p
            style={
              muted
            }
          >
            CSV + WAV + Artwork → Nexorael → Too Lost
          </p>
        </div>

        <div
          style={
            badge
          }
        >
          ADMIN
        </div>
      </div>

      <section
        style={
          card
        }
      >
        <h2>
          1. Upload CSV
        </h2>

        <input
          type="file"
          accept=".csv,text/csv"
          disabled={
            processing
          }
          onChange={
            handleCSV
          }
        />

        <div
          style={
            infoBox
          }
        >
          Required CSV columns:
          <br />
          <strong>
            title, artist_name, label_name, release_type,
            genre, language, release_date,
            original_release_date, c_line, p_line,
            audio_file, artwork_file, composer
          </strong>

          <br />
          <br />

          Optional:
          <strong>
            {" "}
            subgenre, lyricist, isrc, upc, explicit
          </strong>
        </div>
      </section>

      <section
        style={
          card
        }
      >
        <h2>
          2. Select WAV Files
        </h2>

        <input
          type="file"
          multiple
          accept=".wav,audio/wav"
          disabled={
            processing
          }
          onChange={
            handleAudioFiles
          }
        />

        <p
          style={
            muted
          }
        >
          Selected:{" "}
          {
            audioFiles.length
          }
        </p>
      </section>

      <section
        style={
          card
        }
      >
        <h2>
          3. Select Artwork
        </h2>

        <input
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          disabled={
            processing
          }
          onChange={
            handleArtworkFiles
          }
        />

        <p
          style={
            muted
          }
        >
          Selected:{" "}
          {
            artworkFiles.length
          }
        </p>

        <p
          style={
            muted
          }
        >
          Every artwork must be exactly 3000x3000.
        </p>
      </section>

      <section
        style={
          statsGrid
        }
      >
        <Stat
          label="CSV Rows"
          value={
            rows.length
          }
        />

        <Stat
          label="Ready"
          value={
            validCount
          }
        />

        <Stat
          label="Success"
          value={
            successCount
          }
        />

        <Stat
          label="Failed"
          value={
            failedCount
          }
        />
      </section>

      {rows.length >
        0 && (
        <section
          style={
            card
          }
        >
          <div
            style={
              actionHeader
            }
          >
            <div>
              <h2>
                Preview
              </h2>

              <p
                style={
                  muted
                }
              >
                Audio aur artwork filename CSV ke filename se exact match hona chahiye.
              </p>
            </div>

            <div
              style={{
                display:
                  "flex",
                gap:
                  "10px",
              }}
            >
              {failedCount >
                0 && (
                <button
                  type="button"
                  disabled={
                    processing
                  }
                  onClick={
                    retryFailed
                  }
                  style={
                    secondaryButton
                  }
                >
                  Reset Failed
                </button>
              )}

              <button
                type="button"
                disabled={
                  processing ||
                  validCount ===
                    0
                }
                onClick={
                  startBulkUpload
                }
                style={{
                  ...primaryButton,

                  opacity:
                    processing ||
                    validCount ===
                      0
                      ? 0.55
                      : 1,
                }}
              >
                {processing
                  ? "Processing..."
                  : `Start Bulk Upload (${validCount})`}
              </button>
            </div>
          </div>

          {(processing ||
            progress >
              0) && (
            <div
              style={{
                marginBottom:
                  "20px",
              }}
            >
              <div
                style={
                  progressHeader
                }
              >
                <span>
                  {
                    currentMessage
                  }
                </span>

                <strong>
                  {progress}%
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
                      `${progress}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div
            style={
              tableWrap
            }
          >
            <table
              style={
                table
              }
            >
              <thead>
                <tr>
                  <th
                    style={
                      th
                    }
                  >
                    #
                  </th>

                  <th
                    style={
                      th
                    }
                  >
                    Release
                  </th>

                  <th
                    style={
                      th
                    }
                  >
                    Artist
                  </th>

                  <th
                    style={
                      th
                    }
                  >
                    Audio
                  </th>

                  <th
                    style={
                      th
                    }
                  >
                    Artwork
                  </th>

                  <th
                    style={
                      th
                    }
                  >
                    Status
                  </th>

                  <th
                    style={
                      th
                    }
                  >
                    Too Lost ID
                  </th>

                  <th
                    style={
                      th
                    }
                  >
                    Message
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map(
                  (
                    row,
                    index
                  ) => (
                    <tr
                      key={
                        row.id
                      }
                    >
                      <td
                        style={
                          td
                        }
                      >
                        {index +
                          1}
                      </td>

                      <td
                        style={
                          td
                        }
                      >
                        <strong>
                          {
                            row.title
                          }
                        </strong>

                        <div
                          style={
                            smallMuted
                          }
                        >
                          {
                            row.label_name
                          }
                        </div>
                      </td>

                      <td
                        style={
                          td
                        }
                      >
                        {
                          row.artist_name
                        }
                      </td>

                      <td
                        style={
                          td
                        }
                      >
                        {row.audioMatched
                          ? "✓"
                          : "✕"}

                        {" "}

                        {
                          row.audio_file
                        }
                      </td>

                      <td
                        style={
                          td
                        }
                      >
                        {row.artworkMatched
                          ? "✓"
                          : "✕"}

                        {" "}

                        {
                          row.artwork_file
                        }
                      </td>

                      <td
                        style={
                          td
                        }
                      >
                        <StatusBadge
                          status={
                            row.status
                          }
                          hasErrors={
                            row.errors.length >
                            0
                          }
                        />
                      </td>

                      <td
                        style={
                          td
                        }
                      >
                        {row.toolostReleaseId ||
                          "—"}
                      </td>

                      <td
                        style={
                          td
                        }
                      >
                        {row.errors.length
                          ? row.errors.join(
                              ", "
                            )
                          : row.message ||
                            "Ready"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

/* ======================================================
   JSON HELPER
====================================================== */

async function readJsonResponse(
  response: Response,
  name: string
) {
  const text =
    await response.text();

  try {
    return JSON.parse(
      text
    );
  } catch {
    throw new Error(
      `${name} returned non-JSON (${response.status}).`
    );
  }
}

/* ======================================================
   COMPONENTS
====================================================== */

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={
        statCard
      }
    >
      <div
        style={
          muted
        }
      >
        {label}
      </div>

      <div
        style={
          statValue
        }
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  hasErrors,
}: {
  status: RowStatus;
  hasErrors: boolean;
}) {
  if (hasErrors) {
    return (
      <span
        style={{
          ...statusBadge,
          background:
            "#7F1D1D",
        }}
      >
        INVALID
      </span>
    );
  }

  const label =
    status ===
    "processing"
      ? "PROCESSING"
      : status ===
          "success"
        ? "SUCCESS"
        : status ===
            "failed"
          ? "FAILED"
          : "READY";

  const background =
    status ===
    "processing"
      ? "#1D4ED8"
      : status ===
          "success"
        ? "#166534"
        : status ===
            "failed"
          ? "#991B1B"
          : "#334155";

  return (
    <span
      style={{
        ...statusBadge,
        background,
      }}
    >
      {label}
    </span>
  );
}

/* ======================================================
   STYLES
====================================================== */

const pageStyle:
  CSSProperties = {
  minHeight:
    "100vh",

  padding:
    "28px",

  background:
    "#050816",

  color:
    "#F8FAFC",

  fontFamily:
    "Arial, sans-serif",
};

const headerStyle:
  CSSProperties = {
  display:
    "flex",

  alignItems:
    "center",

  justifyContent:
    "space-between",

  marginBottom:
    "22px",
};

const card:
  CSSProperties = {
  background:
    "#0F172A",

  border:
    "1px solid #1E293B",

  borderRadius:
    "14px",

  padding:
    "20px",

  marginBottom:
    "18px",
};

const infoBox:
  CSSProperties = {
  marginTop:
    "14px",

  padding:
    "14px",

  background:
    "#020617",

  border:
    "1px solid #1E293B",

  borderRadius:
    "10px",

  lineHeight:
    1.7,
};

const muted:
  CSSProperties = {
  color:
    "#94A3B8",
};

const smallMuted:
  CSSProperties = {
  color:
    "#64748B",

  fontSize:
    "12px",

  marginTop:
    "4px",
};

const badge:
  CSSProperties = {
  background:
    "#1D4ED8",

  padding:
    "7px 12px",

  borderRadius:
    "999px",

  fontSize:
    "12px",

  fontWeight:
    700,
};

const statsGrid:
  CSSProperties = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",

  gap:
    "14px",

  marginBottom:
    "18px",
};

const statCard:
  CSSProperties = {
  background:
    "#0F172A",

  border:
    "1px solid #1E293B",

  borderRadius:
    "12px",

  padding:
    "18px",
};

const statValue:
  CSSProperties = {
  fontSize:
    "28px",

  fontWeight:
    800,

  marginTop:
    "7px",
};

const actionHeader:
  CSSProperties = {
  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "16px",
};

const primaryButton:
  CSSProperties = {
  padding:
    "11px 18px",

  border:
    "none",

  borderRadius:
    "9px",

  background:
    "#2563EB",

  color:
    "white",

  fontWeight:
    700,

  cursor:
    "pointer",
};

const secondaryButton:
  CSSProperties = {
  padding:
    "11px 18px",

  border:
    "1px solid #334155",

  borderRadius:
    "9px",

  background:
    "#111827",

  color:
    "white",

  cursor:
    "pointer",
};

const progressHeader:
  CSSProperties = {
  display:
    "flex",

  justifyContent:
    "space-between",

  gap:
    "15px",

  marginBottom:
    "8px",

  color:
    "#CBD5E1",
};

const progressTrack:
  CSSProperties = {
  width:
    "100%",

  height:
    "9px",

  borderRadius:
    "999px",

  background:
    "#020617",

  overflow:
    "hidden",
};

const progressFill:
  CSSProperties = {
  height:
    "100%",

  borderRadius:
    "999px",

  background:
    "#2563EB",

  transition:
    "width .2s ease",
};

const tableWrap:
  CSSProperties = {
  overflowX:
    "auto",

  border:
    "1px solid #1E293B",

  borderRadius:
    "10px",
};

const table:
  CSSProperties = {
  width:
    "100%",

  borderCollapse:
    "collapse",

  minWidth:
    "1050px",
};

const th:
  CSSProperties = {
  textAlign:
    "left",

  padding:
    "12px",

  borderBottom:
    "1px solid #1E293B",

  background:
    "#020617",

  color:
    "#94A3B8",

  fontSize:
    "12px",
};

const td:
  CSSProperties = {
  padding:
    "12px",

  borderBottom:
    "1px solid #1E293B",

  verticalAlign:
    "top",

  fontSize:
    "13px",
};

const statusBadge:
  CSSProperties = {
  display:
    "inline-block",

  padding:
    "5px 8px",

  borderRadius:
    "999px",

  fontSize:
    "10px",

  fontWeight:
    800,

  color:
    "white",
};