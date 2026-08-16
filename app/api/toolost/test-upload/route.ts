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

    if (!(audio instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "WAV audio file is required",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // STEP 1: CREATE DRAFT RELEASE
    // --------------------------------------------------

    const releaseBody = {
      type: "Single",
      title: "Nexorael Audio Test",
      label: "Nexorael",
      participants: [
        {
          name: "MD SAHID MIYA",
          role: ["primary"],
        },
      ],
    };

    console.log(
      "STEP 1 - Creating release:",
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
      "Create release status:",
      createResult.response.status
    );

    console.log(
      "Create release response:",
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

    // --------------------------------------------------
    // STEP 2: CREATE AUDIO UPLOAD URL
    // --------------------------------------------------

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
          contentType: audio.type || "audio/wav",
        }),
      }
    );

    console.log(
      "STEP 2 - Upload URL status:",
      uploadUrlResult.response.status
    );

    console.log(
      "Upload URL response:",
      uploadUrlResult.data
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

    const upload =
      uploadResponse?.data ??
      uploadResponse;

    const uploadUrl = upload?.uploadUrl;
    const fileKey = upload?.fileKey;

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

    // --------------------------------------------------
    // STEP 3: UPLOAD WAV TO S3
    // --------------------------------------------------

    const audioBuffer =
      Buffer.from(await audio.arrayBuffer());

    console.log(
      "STEP 3 - Uploading audio:",
      {
        name: audio.name,
        size: audioBuffer.length,
        type: audio.type,
      }
    );

    const s3Headers = new Headers();

    s3Headers.set(
      "Content-Type",
      audio.type || "audio/wav"
    );

    s3Headers.set(
      "Content-Length",
      String(audioBuffer.length)
    );

    // Too Lost may return additional required S3 headers.
    if (upload?.headers) {
      for (const [key, value] of Object.entries(
        upload.headers
      )) {
        if (typeof value === "string") {
          s3Headers.set(key, value);
        }
      }
    }

    const binaryUpload = await fetch(
      uploadUrl,
      {
        method:
          upload?.method || "PUT",
        headers: s3Headers,
        body: audioBuffer,
        cache: "no-store",
      }
    );

    const binaryText =
      await binaryUpload.text();

    console.log(
      "S3 upload status:",
      binaryUpload.status
    );

    console.log(
      "S3 upload response:",
      binaryText
    );

    if (!binaryUpload.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "audio_upload",
          releaseId,
          status: binaryUpload.status,
          response: binaryText,
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // STEP 4: ADD TRACK TO RELEASE
    // --------------------------------------------------

    const tracksBody = {
      tracks: [
        {
          title: "Nexorael Audio Test",
          language: "en",

          audioFileKey: fileKey,

          artists: [
            {
              name: "MD SAHID MIYA",
              role: ["primary"],
            },
          ],
        },
      ],
    };

    console.log(
      "STEP 4 - Updating release tracks:",
      JSON.stringify(tracksBody, null, 2)
    );

    const tracksResult = await tooLostApi(
      accessToken,
      `/releases/${releaseId}/tracks`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tracksBody),
      }
    );

    console.log(
      "Update tracks status:",
      tracksResult.response.status
    );

    console.log(
      "Update tracks response:",
      tracksResult.data
    );

    if (!tracksResult.response.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "save_track",
          releaseId,
          fileKey,
          status: tracksResult.response.status,
          data: tracksResult.data,
        },
        {
          status: tracksResult.response.status,
        }
      );
    }

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    return NextResponse.json({
      success: true,

      message:
        "Too Lost draft release and WAV track uploaded successfully",

      releaseId,

      release,

      fileKey,

      trackResponse:
        tracksResult.data,

      audio: {
        name: audio.name,
        size: audio.size,
        type: audio.type,
      },

      note:
        "The release remains a draft. It has NOT been submitted or published.",
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