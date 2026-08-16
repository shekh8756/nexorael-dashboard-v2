import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    const accessToken =
      cookieStore.get("toolost_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Too Lost is not connected",
        },
        { status: 401 }
      );
    }

    const formData = await request.formData();

    const audio = formData.get("audio");
    const cover = formData.get("cover");

    if (!(audio instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "Audio file is required",
        },
        { status: 400 }
      );
    }

    if (!(cover instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "Cover image is required",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 1. CREATE TOO LOST DRAFT RELEASE
    // --------------------------------------------------

    const releaseBody = {
      type: "Single",
      title: "Nexorael Test Release",
      label: "Nexorael",
      participants: [
        {
          name: "MD SAHID MIYA",
          role: ["primary"],
        },
      ],
    };

    console.log(
      "Creating Too Lost release:",
      JSON.stringify(releaseBody, null, 2)
    );

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

    console.log(
      "Too Lost create status:",
      createResult.response.status
    );

    console.log(
      "Too Lost create response:",
      createResult.data
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

    const releaseData = createResult.data as any;

    const release =
      releaseData?.data ?? releaseData;

    const releaseId = release?.id;

    if (!releaseId) {
      return NextResponse.json(
        {
          success: false,
          step: "create_release",
          error: "Too Lost did not return a release ID",
          data: releaseData,
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 2. REQUEST AUDIO UPLOAD URL
    // --------------------------------------------------

    const audioUploadResult = await tooLostApi(
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
          contentType:
            audio.type || "audio/wav",
        }),
      }
    );

    console.log(
      "Too Lost upload URL status:",
      audioUploadResult.response.status
    );

    console.log(
      "Too Lost upload URL response:",
      audioUploadResult.data
    );

    if (!audioUploadResult.response.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "audio_upload_url",
          releaseId,
          status: audioUploadResult.response.status,
          data: audioUploadResult.data,
        },
        {
          status: audioUploadResult.response.status,
        }
      );
    }

    const uploadData =
      audioUploadResult.data as any;

    const upload =
      uploadData?.data ?? uploadData;

    const uploadUrl = upload?.uploadUrl;
    const fileKey = upload?.fileKey;

    if (!uploadUrl || !fileKey) {
      return NextResponse.json(
        {
          success: false,
          step: "audio_upload_url",
          releaseId,
          error:
            "Too Lost did not return uploadUrl/fileKey",
          data: uploadData,
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 3. UPLOAD AUDIO BINARY
    // --------------------------------------------------

    const audioBuffer =
      Buffer.from(await audio.arrayBuffer());

    const binaryUpload = await fetch(
      uploadUrl,
      {
        method: "PUT",
        headers: {
          "Content-Type":
            audio.type || "audio/wav",
          "Content-Length":
            String(audioBuffer.length),
        },
        body: audioBuffer,
        cache: "no-store",
      }
    );

    const binaryText =
      await binaryUpload.text();

    console.log(
      "Audio binary upload status:",
      binaryUpload.status
    );

    console.log(
      "Audio binary upload response:",
      binaryText
    );

    if (!binaryUpload.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "audio_binary_upload",
          releaseId,
          status: binaryUpload.status,
          response: binaryText,
        },
        {
          status: 400,
        }
      );
    }

    // --------------------------------------------------
    // 4. GET TRACKS
    // --------------------------------------------------

    const tracksResult = await tooLostApi(
      accessToken,
      `/releases/${releaseId}/tracks`,
      {
        method: "GET",
      }
    );

    console.log(
      "Too Lost tracks status:",
      tracksResult.response.status
    );

    console.log(
      "Too Lost tracks response:",
      tracksResult.data
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

    const tracksData =
      tracksResult.data as any;

    const tracks =
      Array.isArray(tracksData?.data)
        ? tracksData.data
        : Array.isArray(tracksData)
        ? tracksData
        : [];

    if (tracks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          step: "get_tracks",
          releaseId,
          error:
            "No track was returned after audio upload",
          data: tracksData,
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
          data: tracksData,
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 5. ATTACH UPLOADED FILE TO TRACK
    // --------------------------------------------------

    const updateTrackResult = await tooLostApi(
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

    console.log(
      "Too Lost track update status:",
      updateTrackResult.response.status
    );

    console.log(
      "Too Lost track update response:",
      updateTrackResult.data
    );

    if (!updateTrackResult.response.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "attach_audio",
          releaseId,
          trackId,
          status:
            updateTrackResult.response.status,
          data: updateTrackResult.data,
        },
        {
          status:
            updateTrackResult.response.status,
        }
      );
    }

    // --------------------------------------------------
    // DONE
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      message:
        "Too Lost test release and audio upload completed",

      releaseId,

      release: release,

      trackId,

      track: track,

      audioFile: {
        name: audio.name,
        size: audio.size,
        type: audio.type,
      },

      coverFile: {
        name: cover.name,
        size: cover.size,
        type: cover.type,
      },

      note:
        "This test creates a draft. It does NOT submit or publish the release.",
    });
  } catch (error) {
    console.error(
      "Too Lost test upload error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Too Lost test upload failed",
      },
      { status: 500 }
    );
  }
}