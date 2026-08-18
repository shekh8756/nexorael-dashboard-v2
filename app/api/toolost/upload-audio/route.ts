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
  if (!value || typeof value !== "object") return {};

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
      method: value.method ?? value.httpMethod ?? value.http_method,
      headers:
        value.headers ??
        value.uploadHeaders ??
        value.upload_headers,
    };
  }

  for (const key of ["data", "result", "upload", "file", "payload"]) {
    if (value[key]) {
      const found = findUploadData(value[key]);
      if (found.uploadUrl || found.fileKey) return found;
    }
  }

  return {};
}

function unwrap(value: any) {
  return value?.data?.data ?? value?.data ?? value;
}

async function updateTrackMetadata(
  accessToken: string,
  releaseId: string,
  track: any,
  trackId?: string | number,
  audioFileKey?: string
) {
  const artists = track.artist
    ? [
        {
          name: track.artist,
          role: ["primary"],
        },
      ]
    : [];

  const writers = [];

  if (track.lyricist) {
    writers.push({
      name: track.lyricist,
      role: ["lyricist"],
    });
  }

  if (track.composer) {
    writers.push({
      name: track.composer,
      role: ["composer"],
    });
  }

  if (track.writer) {
    writers.push({
      name: track.writer,
      role: ["writer"],
    });
  }

  // Too Lost requires at least one writer.
  // If composer/lyricist/writer is not separately supplied,
  // use the artist as a fallback writer so the API request is valid.
  if (writers.length === 0 && track.artist) {
    writers.push({
      name: track.artist,
      role: ["writer"],
    });
  }

  const payload: Record<string, unknown> = {
    title: track.title,
    language: track.language || undefined,
    content_type: track.contentType || "ai_music",
    explicit: Boolean(track.explicit),

    // REQUIRED BY TOO LOST
    audioFileKey: audioFileKey || undefined,
    artists,
    writers,
  };

  if (track.isrc) {
    payload.isrc = track.isrc;
  }

  if (track.version) {
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
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("toolost_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Too Lost is not connected" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      releaseId,
      fileName,
      contentType,
      audioUrl,
      track,
    } = body;

    if (!releaseId || !fileName || !audioUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "releaseId, fileName and audioUrl are required.",
        },
        { status: 400 }
      );
    }

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
          fileName,
          contentType: contentType || "audio/wav",
        }),
      }
    );

    if (!uploadUrlResult.response.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "create_upload_url",
          status: uploadUrlResult.response.status,
          tooLostResponse: uploadUrlResult.data,
        },
        { status: uploadUrlResult.response.status }
      );
    }

    const upload = findUploadData(uploadUrlResult.data);

    if (!upload.uploadUrl || !upload.fileKey) {
      return NextResponse.json(
        {
          success: false,
          step: "create_upload_url",
          error: "Too Lost did not return a usable upload URL/file key.",
          tooLostResponse: uploadUrlResult.data,
        },
        { status: 502 }
      );
    }

    const sourceResponse = await fetch(audioUrl, { cache: "no-store" });

    if (!sourceResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "download_audio",
          error: `Could not download audio from Supabase (${sourceResponse.status}).`,
        },
        { status: 502 }
      );
    }

    const audioBuffer = await sourceResponse.arrayBuffer();

    const uploadHeaders = new Headers(upload.headers || {});
    if (!uploadHeaders.has("Content-Type")) {
      uploadHeaders.set(
        "Content-Type",
        contentType || "audio/wav"
      );
    }

    const binaryUpload = await fetch(upload.uploadUrl, {
      method: upload.method || "PUT",
      headers: uploadHeaders,
      body: audioBuffer,
    });

    const uploadResponseText = await binaryUpload.text();

    if (!binaryUpload.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "too_lost_binary_upload",
          error: `Too Lost audio upload failed (${binaryUpload.status}).`,
          details: uploadResponseText.slice(0, 2000),
          fileKey: upload.fileKey,
        },
        { status: 502 }
      );
    }

    // Uploading the file is not enough. Attach the returned fileKey to the
    // actual Too Lost track and then send the track metadata.
    const tracksResult = await tooLostApi(
      accessToken,
      `/releases/${releaseId}/tracks`,
      { method: "GET" }
    );

    let tracks = unwrap(tracksResult.data);
    if (!Array.isArray(tracks)) tracks = [];

    let currentTrack = tracks[tracks.length - 1];
    let trackId = currentTrack?.id;

    if (!trackId && track?.title) {
      const metadataResult = await updateTrackMetadata(
  accessToken,
  String(releaseId),
  track,
  undefined,
  upload.fileKey
);

      if (!metadataResult.response.ok) {
        return NextResponse.json(
          {
            success: false,
            step: "track_metadata",
            status: metadataResult.response.status,
            error: "Too Lost rejected track metadata.",
            tooLostResponse: metadataResult.data,
            fileKey: upload.fileKey,
          },
          { status: metadataResult.response.status }
        );
      }

      const refreshed = await tooLostApi(
        accessToken,
        `/releases/${releaseId}/tracks`,
        { method: "GET" }
      );

      const refreshedTracks = unwrap(refreshed.data);
      if (Array.isArray(refreshedTracks) && refreshedTracks.length) {
        currentTrack = refreshedTracks[refreshedTracks.length - 1];
        trackId = currentTrack?.id;
      }
    } else if (trackId && track?.title) {
      const metadataResult = await updateTrackMetadata(
  accessToken,
  String(releaseId),
  track,
  trackId,
  upload.fileKey
);

      if (!metadataResult.response.ok) {
        return NextResponse.json(
          {
            success: false,
            step: "track_metadata",
            status: metadataResult.response.status,
            error: "Too Lost rejected track metadata.",
            tooLostResponse: metadataResult.data,
            fileKey: upload.fileKey,
          },
          { status: metadataResult.response.status }
        );
      }
    }

    if (!trackId) {
      return NextResponse.json(
        {
          success: false,
          step: "track",
          error: "Too Lost did not expose a track ID after track creation.",
          fileKey: upload.fileKey,
        },
        { status: 502 }
      );
    }

    const attachResult = await tooLostApi(
      accessToken,
      `/releases/${releaseId}/tracks/${trackId}/file`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "audio",
          fileKey: upload.fileKey,
        }),
      }
    );

    if (!attachResult.response.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "attach_file",
          status: attachResult.response.status,
          error: "Too Lost rejected the uploaded audio attachment.",
          tooLostResponse: attachResult.data,
          fileKey: upload.fileKey,
          trackId,
        },
        { status: attachResult.response.status }
      );
    }

    return NextResponse.json({
      success: true,
      releaseId,
      trackId,
      fileKey: upload.fileKey,
      sizeBytes: audioBuffer.byteLength,
      data: attachResult.data,
    });
  } catch (error) {
    console.error("Too Lost server upload error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Server upload failed.",
      },
      { status: 500 }
    );
  }
}
