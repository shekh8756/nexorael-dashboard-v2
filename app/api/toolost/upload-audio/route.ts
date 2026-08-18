import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

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

function unwrap(value: any) {
  return value?.data?.data ?? value?.data ?? value;
}

function normalizeAudioFileName(fileName: string): string {
  let name = String(fileName || "").trim();

  // Remove path information if any
  name = name.split(/[\\/]/).pop() || "audio";

  // Replace spaces and unsupported characters
  name = name.replace(/[^\w.-]+/g, "_");

  // Remove repeated dots
  name = name.replace(/\.{2,}/g, ".");

  // Remove leading/trailing dots
  name = name.replace(/^\.+/, "").replace(/\.+$/, "");

  // Make sure filename is not empty
  if (!name) {
    name = "audio";
  }

  // Too Lost upload is for WAV in our dashboard
  if (!/\.wav$/i.test(name)) {
    name = `${name}.wav`;
  }

  return name;
}

async function updateTrackMetadata(
  accessToken: string,
  releaseId: string,
  track: any,
  trackId?: string | number,
  audioFileKey?: string
) {
  const artists: any[] = [];

  const writers: any[] = [];

  /*
   * ARTIST
   */
  if (track?.artist) {
    artists.push({
      name: String(track.artist).trim(),
      role: ["primary"],
    });
  }

  /*
   * WRITERS
   */
  if (track?.lyricist) {
    writers.push({
      name: String(track.lyricist).trim(),
      role: ["lyricist"],
    });
  }

  if (track?.composer) {
    writers.push({
      name: String(track.composer).trim(),
      role: ["composer"],
    });
  }

  if (track?.writer) {
    writers.push({
      name: String(track.writer).trim(),
      role: ["writer"],
    });
  }

  /*
   * Too Lost requires at least one writer.
   *
   * If composer / lyricist / writer is missing,
   * use the primary artist as fallback.
   */
  if (writers.length === 0 && track?.artist) {
    writers.push({
      name: String(track.artist).trim(),
      role: ["writer"],
    });
  }

  /*
   * Too Lost requires these track fields:
   * - audioFileKey
   * - artists
   * - writers
   */
  const payload: Record<string, unknown> = {
    title: track?.title || "Untitled",
    language: track?.language || "Hindi",
    content_type: track?.contentType || "ai_music",
    explicit: Boolean(track?.explicit),

    audioFileKey: audioFileKey,
    artists,
    writers,
  };

  if (track?.isrc) {
    payload.isrc = track.isrc;
  }

  if (track?.version) {
    payload.version = track.version;
  }

  if (trackId) {
    payload.id = trackId;
  }

  return await tooLostApi(
    accessToken,
    `/releases/${releaseId}/tracks`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        tracks: [payload],
      }),
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. GET TOO LOST ACCESS TOKEN
     * ---------------------------------------------------------
     */

    const cookieStore = await cookies();

    const accessToken =
      cookieStore.get("toolost_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Too Lost is not connected",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. READ REQUEST BODY
     * ---------------------------------------------------------
     */

    const body = await request.json();

    const {
      releaseId,
      fileName,
      contentType,
      audioUrl,
      track,
    } = body;

    /*
     * ---------------------------------------------------------
     * 3. VALIDATE INPUT
     * ---------------------------------------------------------
     */

    if (!releaseId || !fileName || !audioUrl) {
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

    /*
     * ---------------------------------------------------------
     * 4. NORMALIZE FILE NAME
     * ---------------------------------------------------------
     */

    const safeFileName =
      normalizeAudioFileName(String(fileName));

    /*
     * We are uploading WAV files from the dashboard.
     *
     * Do not trust the browser's MIME type because the
     * browser may send an unsupported MIME value.
     */
    const normalizedContentType = "audio/wav";

    console.log("Too Lost upload request:", {
      releaseId,
      originalFileName: fileName,
      safeFileName,
      originalContentType: contentType,
      normalizedContentType,
    });

    /*
     * ---------------------------------------------------------
     * 5. ASK TOO LOST FOR SIGNED UPLOAD URL
     * ---------------------------------------------------------
     */

    const uploadUrlResult = await tooLostApi(
      accessToken,
      `/releases/${releaseId}/tracks/upload-url`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },

        body: JSON.stringify({
          kind: "audio",
          fileName: safeFileName,
          contentType: normalizedContentType,
        }),
      }
    );

    /*
     * ---------------------------------------------------------
     * 6. CHECK UPLOAD URL RESPONSE
     * ---------------------------------------------------------
     */

    if (!uploadUrlResult.response.ok) {
      console.error(
        "Too Lost upload-url error:",
        uploadUrlResult.data
      );

      return NextResponse.json(
        {
          success: false,
          step: "create_upload_url",
          status: uploadUrlResult.response.status,
          fileName: safeFileName,
          contentType: normalizedContentType,
          tooLostResponse: uploadUrlResult.data,
        },
        {
          status: uploadUrlResult.response.status,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 7. EXTRACT SIGNED UPLOAD DATA
     * ---------------------------------------------------------
     */

    const upload = findUploadData(
      uploadUrlResult.data
    );

    if (!upload.uploadUrl || !upload.fileKey) {
      console.error(
        "Too Lost returned invalid upload data:",
        uploadUrlResult.data
      );

      return NextResponse.json(
        {
          success: false,
          step: "create_upload_url",
          error:
            "Too Lost did not return a usable upload URL/file key.",
          tooLostResponse: uploadUrlResult.data,
        },
        {
          status: 502,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 8. DOWNLOAD AUDIO FROM SUPABASE
     * ---------------------------------------------------------
     */

    const sourceResponse = await fetch(
      audioUrl,
      {
        cache: "no-store",
      }
    );

    if (!sourceResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "download_audio",
          error:
            `Could not download audio from Supabase (${sourceResponse.status}).`,
        },
        {
          status: 502,
        }
      );
    }

    const audioBuffer =
      await sourceResponse.arrayBuffer();

    if (!audioBuffer.byteLength) {
      return NextResponse.json(
        {
          success: false,
          step: "download_audio",
          error: "Downloaded audio file is empty.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 9. UPLOAD BINARY AUDIO TO TOO LOST
     * ---------------------------------------------------------
     */

    const uploadHeaders =
      new Headers(upload.headers || {});

    if (!uploadHeaders.has("Content-Type")) {
      uploadHeaders.set(
        "Content-Type",
        normalizedContentType
      );
    }

    const binaryUpload = await fetch(
      upload.uploadUrl,
      {
        method: upload.method || "PUT",
        headers: uploadHeaders,
        body: audioBuffer,
      }
    );

    const uploadResponseText =
      await binaryUpload.text();

    if (!binaryUpload.ok) {
      console.error(
        "Too Lost binary upload failed:",
        {
          status: binaryUpload.status,
          response: uploadResponseText,
        }
      );

      return NextResponse.json(
        {
          success: false,
          step: "too_lost_binary_upload",
          error:
            `Too Lost audio upload failed (${binaryUpload.status}).`,
          details:
            uploadResponseText.slice(0, 2000),
          fileKey: upload.fileKey,
        },
        {
          status: 502,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 10. CHECK EXISTING TRACKS
     * ---------------------------------------------------------
     */

    const tracksResult = await tooLostApi(
      accessToken,
      `/releases/${releaseId}/tracks`,
      {
        method: "GET",
      }
    );

    let tracks = unwrap(
      tracksResult.data
    );

    if (!Array.isArray(tracks)) {
      tracks = [];
    }

    let currentTrack =
      tracks.length > 0
        ? tracks[tracks.length - 1]
        : undefined;

    let trackId =
      currentTrack?.id;

    /*
     * ---------------------------------------------------------
     * 11. CREATE / UPDATE TRACK METADATA
     * ---------------------------------------------------------
     */

    if (!trackId && track?.title) {
      const metadataResult =
        await updateTrackMetadata(
          accessToken,
          String(releaseId),
          track,
          undefined,
          upload.fileKey
        );

      if (!metadataResult.response.ok) {
        console.error(
          "Too Lost rejected track metadata:",
          metadataResult.data
        );

        return NextResponse.json(
          {
            success: false,
            step: "track_metadata",
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

      /*
       * Fetch tracks again so we can obtain the newly
       * created track ID.
       */

      const refreshed =
        await tooLostApi(
          accessToken,
          `/releases/${releaseId}/tracks`,
          {
            method: "GET",
          }
        );

      const refreshedTracks =
        unwrap(refreshed.data);

      if (
        Array.isArray(refreshedTracks) &&
        refreshedTracks.length
      ) {
        currentTrack =
          refreshedTracks[
            refreshedTracks.length - 1
          ];

        trackId =
          currentTrack?.id;
      }
    } else if (trackId && track?.title) {
      const metadataResult =
        await updateTrackMetadata(
          accessToken,
          String(releaseId),
          track,
          trackId,
          upload.fileKey
        );

      if (!metadataResult.response.ok) {
        console.error(
          "Too Lost rejected track metadata:",
          metadataResult.data
        );

        return NextResponse.json(
          {
            success: false,
            step: "track_metadata",
            status:
              metadataResult.response.status,
            error:
              "Too Lost rejected track metadata.",
            tooLostResponse:
              metadataResult.data,
            fileKey:
              upload.fileKey,
            trackId,
          },
          {
            status:
              metadataResult.response.status,
          }
        );
      }
    }

    /*
     * ---------------------------------------------------------
     * 12. MAKE SURE TRACK ID EXISTS
     * ---------------------------------------------------------
     */

    if (!trackId) {
      return NextResponse.json(
        {
          success: false,
          step: "track",
          error:
            "Too Lost did not expose a track ID after track creation.",
          fileKey:
            upload.fileKey,
        },
        {
          status: 502,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 13. ATTACH AUDIO FILE TO TRACK
     * ---------------------------------------------------------
     */

    const attachResult =
      await tooLostApi(
        accessToken,
        `/releases/${releaseId}/tracks/${trackId}/file`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
          },

          body: JSON.stringify({
            kind: "audio",
            fileKey: upload.fileKey,
          }),
        }
      );

    if (!attachResult.response.ok) {
      console.error(
        "Too Lost rejected audio attachment:",
        attachResult.data
      );

      return NextResponse.json(
        {
          success: false,
          step: "attach_file",
          status:
            attachResult.response.status,
          error:
            "Too Lost rejected the uploaded audio attachment.",
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

    /*
     * ---------------------------------------------------------
     * 14. SUCCESS
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      releaseId,

      trackId,

      fileKey:
        upload.fileKey,

      fileName:
        safeFileName,

      contentType:
        normalizedContentType,

      sizeBytes:
        audioBuffer.byteLength,

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
        success: false,
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