import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tooLostApi } from "@/lib/toolost";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/* =========================================================
   FIND UPLOAD DATA FROM TOO LOST
========================================================= */

function findUploadData(value: any): {
  uploadUrl?: string;
  fileKey?: string;
  method?: string;
  headers?: Record<string, string>;
} {
  if (!value || typeof value !== "object") {
    return {};
  }

  const uploadUrl =
    value.uploadUrl ??
    value.upload_url ??
    value.url ??
    value.signedUrl ??
    value.signed_url;

  const fileKey =
    value.fileKey ??
    value.file_key ??
    value.key;

  if (uploadUrl || fileKey) {
    return {
      uploadUrl,
      fileKey,
      method:
        value.method ??
        value.httpMethod ??
        value.http_method,
      headers:
        value.headers ??
        value.uploadHeaders ??
        value.upload_headers,
    };
  }

  for (const key of [
    "data",
    "result",
    "upload",
    "file",
    "payload",
  ]) {
    if (value[key]) {
      const found = findUploadData(value[key]);

      if (found.uploadUrl || found.fileKey) {
        return found;
      }
    }
  }

  return {};
}

/* =========================================================
   UNWRAP TOO LOST RESPONSE
========================================================= */

function unwrap(value: any) {
  return value?.data?.data ?? value?.data ?? value;
}

/* =========================================================
   SAFE FILE NAME
========================================================= */

function normalizeFileName(fileName: string): string {
  let name = String(fileName || "").trim();

  // Remove folder/path
  name = name.split(/[\\/]/).pop() || "audio";

  // Remove extension
  name = name.replace(/\.[^.]+$/, "");

  // Replace unsupported characters
  name = name.replace(/[^a-zA-Z0-9_-]+/g, "_");

  // Remove repeated underscores
  name = name.replace(/_+/g, "_");

  // Remove leading/trailing underscores
  name = name.replace(/^_+|_+$/g, "");

  if (!name) {
    name = "audio";
  }

  // Too Lost requires .flac
  return `${name}.flac`;
}

/* =========================================================
   CONVERT WAV BUFFER TO REAL FLAC
========================================================= */

async function convertWavToFlac(
  wavBuffer: Buffer
): Promise<Buffer> {
  if (!ffmpegPath) {
    throw new Error(
      "FFmpeg binary was not found. Please reinstall ffmpeg-static."
    );
  }

  const tempDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "toolost-")
  );

  const inputPath = path.join(
    tempDirectory,
    "input.wav"
  );

  const outputPath = path.join(
    tempDirectory,
    "output.flac"
  );

  try {
    await fs.writeFile(
      inputPath,
      wavBuffer
    );

    await new Promise<void>((resolve, reject) => {
      const args = [
        "-y",

        "-i",
        inputPath,

        // Audio only
        "-vn",

        // Real FLAC encoding
        "-c:a",
        "flac",

        // Good lossless compression
        "-compression_level",
        "5",

        outputPath,
      ];

      const process = spawn(
        ffmpegPath as string,
        args,
        {
          windowsHide: true,
        }
      );

      let stderr = "";

      process.stderr.on(
        "data",
        (data) => {
          stderr += data.toString();
        }
      );

      process.on(
        "error",
        (error) => {
          reject(error);
        }
      );

      process.on(
        "close",
        (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(
              new Error(
                `FFmpeg conversion failed with code ${code}: ${stderr.slice(
                  -3000
                )}`
              )
            );
          }
        }
      );
    });

    const flacBuffer =
      await fs.readFile(outputPath);

    if (!flacBuffer.length) {
      throw new Error(
        "FFmpeg created an empty FLAC file."
      );
    }

    return flacBuffer;
  } finally {
    await fs.rm(
      tempDirectory,
      {
        recursive: true,
        force: true,
      }
    );
  }
}

/* =========================================================
   UPDATE / CREATE TRACK METADATA
========================================================= */

async function updateTrackMetadata(
  accessToken: string,
  releaseId: string,
  track: any,
  trackId?: string | number,
  audioFileKey?: string
) {
  const artists: any[] = [];
  const writers: any[] = [];

  /* ---------------- ARTIST ---------------- */

  if (track?.artist) {
    artists.push({
      name: String(
        track.artist
      ).trim(),

      role: [
        "primary",
      ],
    });
  }

  /* ---------------- WRITERS ---------------- */

  if (track?.lyricist) {
    writers.push({
      name: String(
        track.lyricist
      ).trim(),

      role: [
        "lyricist",
      ],
    });
  }

  if (track?.composer) {
    writers.push({
      name: String(
        track.composer
      ).trim(),

      role: [
        "composer",
      ],
    });
  }

  if (track?.writer) {
    writers.push({
      name: String(
        track.writer
      ).trim(),

      role: [
        "writer",
      ],
    });
  }

  /*
   * Too Lost requires at least one writer.
   */
  if (
    writers.length === 0 &&
    track?.artist
  ) {
    writers.push({
      name: String(
        track.artist
      ).trim(),

      role: [
        "writer",
      ],
    });
  }

  if (!audioFileKey) {
    throw new Error(
      "audioFileKey is required before creating the Too Lost track."
    );
  }

  if (artists.length === 0) {
    throw new Error(
      "At least one artist is required."
    );
  }

  if (writers.length === 0) {
    throw new Error(
      "At least one writer is required."
    );
  }

  const payload: Record<
    string,
    unknown
  > = {
    title:
      track?.title ||
      "Untitled",

    language:
      track?.language ||
      "Hindi",

    content_type:
      track?.contentType ||
      "ai_music",

    explicit:
      Boolean(
        track?.explicit
      ),

    /*
     * REQUIRED BY TOO LOST
     */
    audioFileKey,

    artists,

    writers,
  };

  if (track?.isrc) {
    payload.isrc =
      track.isrc;
  }

  if (track?.version) {
    payload.version =
      track.version;
  }

  if (trackId) {
    payload.id =
      trackId;
  }

  console.log(
    "Sending Too Lost track metadata:",
    JSON.stringify(
      payload,
      null,
      2
    )
  );

  return await tooLostApi(
    accessToken,

    `/releases/${releaseId}/tracks`,

    {
      method: "PUT",

      headers: {
        "Content-Type":
          "application/json",

        Accept:
          "application/json",
      },

      body: JSON.stringify({
        tracks: [
          payload,
        ],
      }),
    }
  );
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    /* =====================================================
       1. GET ACCESS TOKEN
    ===================================================== */

    const cookieStore =
      await cookies();

    const accessToken =
      cookieStore.get(
        "toolost_access_token"
      )?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Too Lost is not connected.",
        },
        {
          status: 401,
        }
      );
    }

    /* =====================================================
       2. READ BODY
    ===================================================== */

    const body =
      await request.json();

    const {
      releaseId,
      fileName,
      audioUrl,
      track,
    } = body;

    /* =====================================================
       3. VALIDATE
    ===================================================== */

    if (
      !releaseId ||
      !fileName ||
      !audioUrl
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "releaseId, fileName and audioUrl are required.",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       4. DOWNLOAD ORIGINAL WAV
    ===================================================== */

    console.log(
      "Downloading WAV from Supabase..."
    );

    const sourceResponse =
      await fetch(
        audioUrl,
        {
          cache:
            "no-store",
        }
      );

    if (
      !sourceResponse.ok
    ) {
      return NextResponse.json(
        {
          success: false,

          step:
            "download_audio",

          error:
            `Could not download audio from Supabase (${sourceResponse.status}).`,
        },
        {
          status: 502,
        }
      );
    }

    const wavArrayBuffer =
      await sourceResponse.arrayBuffer();

    const wavBuffer =
      Buffer.from(
        wavArrayBuffer
      );

    if (
      !wavBuffer.length
    ) {
      return NextResponse.json(
        {
          success: false,

          step:
            "download_audio",

          error:
            "Downloaded WAV file is empty.",
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      `Downloaded WAV: ${wavBuffer.length} bytes`
    );

    /* =====================================================
       5. CONVERT WAV → REAL FLAC
    ===================================================== */

    console.log(
      "Converting WAV to FLAC..."
    );

    let flacBuffer: Buffer;

    try {
      flacBuffer =
        await convertWavToFlac(
          wavBuffer
        );
    } catch (conversionError) {
      console.error(
        "WAV → FLAC conversion failed:",
        conversionError
      );

      return NextResponse.json(
        {
          success: false,

          step:
            "wav_to_flac",

          error:
            conversionError instanceof Error
              ? conversionError.message
              : "WAV to FLAC conversion failed.",
        },
        {
          status: 500,
        }
      );
    }

    console.log(
      `FLAC created: ${flacBuffer.length} bytes`
    );

    /* =====================================================
       6. CREATE VALID FLAC FILE NAME
    ===================================================== */

    const flacFileName =
      normalizeFileName(
        String(fileName)
      );

    /*
     * Too Lost documentation requires:
     *
     * kind = audio
     * contentType = audio/flac
     * fileName = *.flac
     */

    const tooLostContentType =
      "audio/flac";

    console.log(
      "Too Lost upload request:",
      {
        releaseId,
        fileName:
          flacFileName,
        contentType:
          tooLostContentType,
        kind:
          "audio",
      }
    );

    /* =====================================================
       7. GET SIGNED UPLOAD URL
    ===================================================== */

    const uploadUrlResult =
      await tooLostApi(
        accessToken,

        `/releases/${releaseId}/tracks/upload-url`,

        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            kind:
              "audio",

            fileName:
              flacFileName,

            contentType:
              tooLostContentType,
          }),
        }
      );

    if (
      !uploadUrlResult.response.ok
    ) {
      console.error(
        "Too Lost upload-url rejected:",
        uploadUrlResult.data
      );

      return NextResponse.json(
        {
          success: false,

          step:
            "create_upload_url",

          status:
            uploadUrlResult.response.status,

          fileName:
            flacFileName,

          contentType:
            tooLostContentType,

          tooLostResponse:
            uploadUrlResult.data,
        },
        {
          status:
            uploadUrlResult.response.status,
        }
      );
    }

    /* =====================================================
       8. EXTRACT SIGNED URL
    ===================================================== */

    const upload =
      findUploadData(
        uploadUrlResult.data
      );

    if (
      !upload.uploadUrl ||
      !upload.fileKey
    ) {
      console.error(
        "Invalid Too Lost upload response:",
        uploadUrlResult.data
      );

      return NextResponse.json(
        {
          success: false,

          step:
            "create_upload_url",

          error:
            "Too Lost did not return a usable upload URL/file key.",

          tooLostResponse:
            uploadUrlResult.data,
        },
        {
          status: 502,
        }
      );
    }

    console.log(
      "Too Lost upload URL received."
    );

    console.log(
      "Too Lost fileKey:",
      upload.fileKey
    );

    /* =====================================================
       9. UPLOAD REAL FLAC TO SIGNED URL
    ===================================================== */

    const uploadHeaders =
      new Headers(
        upload.headers ||
          {}
      );

    /*
     * The signed URL requires FLAC.
     */
    uploadHeaders.set(
      "Content-Type",
      tooLostContentType
    );

    const binaryUpload = await fetch(
  upload.uploadUrl,
  {
    method:
      upload.method ||
      "PUT",

    headers:
      uploadHeaders,

    body:
      new Uint8Array(flacBuffer),
  }
);

    const uploadResponseText =
      await binaryUpload.text();

    if (
      !binaryUpload.ok
    ) {
      console.error(
        "Too Lost FLAC binary upload failed:",
        {
          status:
            binaryUpload.status,

          response:
            uploadResponseText,
        }
      );

      return NextResponse.json(
        {
          success: false,

          step:
            "too_lost_binary_upload",

          error:
            `Too Lost FLAC upload failed (${binaryUpload.status}).`,

          details:
            uploadResponseText.slice(
              0,
              3000
            ),

          fileKey:
            upload.fileKey,
        },
        {
          status: 502,
        }
      );
    }

    console.log(
      "FLAC uploaded successfully to Too Lost."
    );

    /* =====================================================
       10. GET EXISTING TRACKS
    ===================================================== */

    const tracksResult =
      await tooLostApi(
        accessToken,

        `/releases/${releaseId}/tracks`,

        {
          method:
            "GET",
        }
      );

    let tracks =
      unwrap(
        tracksResult.data
      );

    if (
      !Array.isArray(
        tracks
      )
    ) {
      tracks = [];
    }

    let currentTrack =
      tracks.length > 0
        ? tracks[
            tracks.length - 1
          ]
        : undefined;

    let trackId =
      currentTrack?.id;

    /* =====================================================
       11. CREATE / UPDATE TRACK
    ===================================================== */

    if (
      track?.title
    ) {
      const metadataResult =
        await updateTrackMetadata(
          accessToken,

          String(
            releaseId
          ),

          track,

          trackId,

          upload.fileKey
        );

      if (
        !metadataResult.response.ok
      ) {
        console.error(
          "Too Lost rejected track metadata:",
          metadataResult.data
        );

        return NextResponse.json(
          {
            success: false,

            step:
              "track_metadata",

            status:
              metadataResult.response.status,

            error:
              "Too Lost rejected track metadata.",

            tooLostResponse:
              metadataResult.data,

            fileKey:
              upload.fileKey,
          },
          {
            status:
              metadataResult.response.status,
          }
        );
      }

      /* =================================================
         GET TRACK ID AGAIN
      ================================================= */

      const refreshed =
        await tooLostApi(
          accessToken,

          `/releases/${releaseId}/tracks`,

          {
            method:
              "GET",
          }
        );

      const refreshedTracks =
        unwrap(
          refreshed.data
        );

      if (
        Array.isArray(
          refreshedTracks
        ) &&
        refreshedTracks.length
      ) {
        currentTrack =
          refreshedTracks[
            refreshedTracks.length - 1
          ];

        trackId =
          currentTrack?.id;
      }
    }

    /* =====================================================
       12. CHECK TRACK ID
    ===================================================== */

    if (!trackId) {
      return NextResponse.json(
        {
          success: false,

          step:
            "track",

          error:
            "Too Lost did not return a track ID after metadata creation.",

          fileKey:
            upload.fileKey,
        },
        {
          status: 502,
        }
      );
    }

    /* =====================================================
       13. ATTACH FLAC FILE
    ===================================================== */

    const attachResult =
      await tooLostApi(
        accessToken,

        `/releases/${releaseId}/tracks/${trackId}/file`,

        {
          method:
            "PATCH",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify({
              kind:
                "audio",

              fileKey:
                upload.fileKey,
            }),
        }
      );

    if (
      !attachResult.response.ok
    ) {
      console.error(
        "Too Lost rejected file attachment:",
        attachResult.data
      );

      return NextResponse.json(
        {
          success: false,

          step:
            "attach_file",

          status:
            attachResult.response.status,

          error:
            "Too Lost rejected the audio file attachment.",

          tooLostResponse:
            attachResult.data,

          fileKey:
            upload.fileKey,

          trackId,
        },
        {
          status:
            attachResult.response.status,
        }
      );
    }

    /* =====================================================
       14. SUCCESS
    ===================================================== */

    console.log(
      "Too Lost release track upload completed successfully."
    );

    return NextResponse.json({
      success:
        true,

      releaseId,

      trackId,

      fileKey:
        upload.fileKey,

      fileName:
        flacFileName,

      originalFormat:
        "wav",

      uploadedFormat:
        "flac",

      contentType:
        "audio/flac",

      sizeBytes:
        flacBuffer.length,

      data:
        attachResult.data,
    });
  } catch (error) {
    console.error(
      "Too Lost server upload error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Server upload failed.",
      },
      {
        status: 500,
      }
    );
  }
}