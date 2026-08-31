import { NextRequest, NextResponse } from "next/server";
import { getTooLostMasterAccessToken } from "@/lib/toolost-master";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const accessToken =
  await getTooLostMasterAccessToken();

    const formData = await request.formData();

    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "WAV audio file is required",
        },
        { status: 400 }
      );
    }

    // ------------------------------------------------
    // 1. CREATE DRAFT RELEASE
    // ------------------------------------------------

    const releaseBody = {
      type: "Single",
      title: "Nexorael Audio Upload Test",
      label: "Nexorael",
      participants: [
        {
          name: "MD SAHID MIYA",
          role: ["primary"],
        },
      ],
    };

    const createResult = await tooLostApi(
      accessToken,
      "/releases",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(releaseBody),
      }
    );

    if (!createResult.response.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "create_release",
          status: createResult.response.status,
          data: createResult.data,
        },
        {
          status: createResult.response.status,
        }
      );
    }

    const releaseResponse = createResult.data as any;

    const release =
      releaseResponse?.data?.data ??
      releaseResponse?.data ??
      releaseResponse;

    const releaseId = release?.id;

    if (!releaseId) {
      return NextResponse.json(
        {
          success: false,
          step: "create_release",
          error: "Release ID was not returned",
          data: createResult.data,
        },
        { status: 500 }
      );
    }

    // ------------------------------------------------
    // 2. CREATE TRACK UPLOAD URL
    // ------------------------------------------------

    const uploadUrlResult = await tooLostApi(
      accessToken,
      `/releases/${releaseId}/tracks/upload-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "audio",
          fileName: audio.name,
          contentType: "audio/flac",
        }),
      }
    );

    if (!uploadUrlResult.response.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "create_upload_url",
          releaseId,
          status: uploadUrlResult.response.status,
          data: uploadUrlResult.data,
        },
        {
          status: uploadUrlResult.response.status,
        }
      );
    }

    const uploadResponse =
      uploadUrlResult.data as any;

    const uploadData =
      uploadResponse?.data ??
      uploadResponse;

    const uploadUrl =
      uploadData?.uploadUrl;

    const fileKey =
      uploadData?.fileKey;

    if (!uploadUrl || !fileKey) {
      return NextResponse.json(
        {
          success: false,
          step: "create_upload_url",
          releaseId,
          error:
            "Too Lost did not return uploadUrl or fileKey",
          data: uploadUrlResult.data,
        },
        { status: 500 }
      );
    }

    // ------------------------------------------------
    // 3. UPLOAD AUDIO DIRECTLY TO S3
    // ------------------------------------------------

    const audioBuffer =
      Buffer.from(await audio.arrayBuffer());

    const s3Response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "audio/flac",
        "Content-Length":
          String(audioBuffer.length),
      },
      body: audioBuffer,
    });

    const s3Text =
      await s3Response.text();

    if (!s3Response.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "s3_upload",
          releaseId,
          status: s3Response.status,
          response: s3Text,
        },
        { status: 400 }
      );
    }

    // ------------------------------------------------
    // 4. GET TRACKS
    // ------------------------------------------------

    const tracksResult = await tooLostApi(
      accessToken,
      `/releases/${releaseId}/tracks`,
      {
        method: "GET",
      }
    );

    if (!tracksResult.response.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "get_tracks",
          releaseId,
          status: tracksResult.response.status,
          data: tracksResult.data,
        },
        {
          status: tracksResult.response.status,
        }
      );
    }

    const tracksResponse =
      tracksResult.data as any;

    const tracks =
      Array.isArray(tracksResponse?.data)
        ? tracksResponse.data
        : Array.isArray(tracksResponse)
        ? tracksResponse
        : [];

    if (tracks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          step: "get_tracks",
          releaseId,
          error:
            "No track was returned after upload URL/file upload",
          data: tracksResult.data,
        },
        { status: 500 }
      );
    }

    const track = tracks[0];

    const trackId = track?.id;

    if (!trackId) {
      return NextResponse.json(
        {
          success: false,
          step: "get_tracks",
          releaseId,
          error: "Track ID was not returned",
          data: tracksResult.data,
        },
        { status: 500 }
      );
    }

    // ------------------------------------------------
    // 5. ATTACH FILE TO TRACK
    // ------------------------------------------------

    const attachResult = await tooLostApi(
      accessToken,
      `/releases/${releaseId}/tracks/${trackId}/file`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "audio",
          fileKey,
        }),
      }
    );

    if (!attachResult.response.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "attach_file",
          releaseId,
          trackId,
          status: attachResult.response.status,
          data: attachResult.data,
        },
        {
          status: attachResult.response.status,
        }
      );
    }

    // ------------------------------------------------
    // SUCCESS
    // ------------------------------------------------

    return NextResponse.json({
      success: true,
      message:
        "WAV upload completed successfully",
      releaseId,
      trackId,
      fileKey,
      release,
      track,
    });
  } catch (error) {
    console.error(
      "Too Lost upload error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Too Lost upload failed",
      },
      { status: 500 }
    );
  }
}