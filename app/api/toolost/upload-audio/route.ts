import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();

    const {
      releaseId,
      fileName,
      contentType,
      audioUrl,
    } = body;

    if (!releaseId) {
      return NextResponse.json(
        {
          success: false,
          error: "releaseId is required.",
        },
        { status: 400 }
      );
    }

    if (!fileName) {
      return NextResponse.json(
        {
          success: false,
          error: "fileName is required.",
        },
        { status: 400 }
      );
    }

    if (!audioUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "audioUrl is required.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // GET TOO LOST PRESIGNED URL
    // -----------------------------------------

    const uploadUrlResponse =
      await fetch(
        `${request.nextUrl.origin}/api/toolost/upload-url`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            releaseId,
            fileName,
            contentType:
              contentType ||
              "audio/wav",
          }),

          cache: "no-store",
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
      return NextResponse.json(
        {
          success: false,
          error:
            `Too Lost upload URL returned non-JSON (${uploadUrlResponse.status}): ${uploadUrlText.slice(
              0,
              1000
            )}`,
        },
        { status: 502 }
      );
    }

    if (
      !uploadUrlResponse.ok ||
      !uploadUrlData.success
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            uploadUrlData.error ||
            JSON.stringify(
              uploadUrlData
            ),
        },
        {
          status:
            uploadUrlResponse.status,
        }
      );
    }

    // Your existing upload-url API returns
    // uploadUrl and fileKey directly.
    const uploadUrl =
      uploadUrlData.uploadUrl;

    const fileKey =
      uploadUrlData.fileKey;

    const method =
      uploadUrlData.method ||
      "PUT";

    const uploadHeaders =
      uploadUrlData.headers || {};

    if (
      !uploadUrl ||
      !fileKey
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Too Lost did not return uploadUrl/fileKey.",
          tooLostResponse:
            uploadUrlData,
        },
        { status: 502 }
      );
    }

    // -----------------------------------------
    // DOWNLOAD AUDIO FROM SUPABASE
    // -----------------------------------------

    const sourceResponse =
      await fetch(
        audioUrl,
        {
          cache: "no-store",
        }
      );

    if (!sourceResponse.ok) {
      const errorText =
        await sourceResponse.text();

      return NextResponse.json(
        {
          success: false,
          error:
            `Could not download audio from Supabase (${sourceResponse.status}).`,
          details:
            errorText.slice(
              0,
              1000
            ),
        },
        { status: 502 }
      );
    }

    const audioBuffer =
      await sourceResponse.arrayBuffer();

    if (
      audioBuffer.byteLength === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The Supabase audio file is empty.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // VERCEL SERVER → TOO LOST
    // -----------------------------------------

    const headers =
      new Headers(
        uploadHeaders
      );

    if (
      !headers.has(
        "Content-Type"
      )
    ) {
      headers.set(
        "Content-Type",
        contentType ||
          "audio/wav"
      );
    }

    console.log(
      "Uploading audio to Too Lost..."
    );

    const tooLostUpload =
      await fetch(
        uploadUrl,
        {
          method,
          headers,
          body: audioBuffer,
        }
      );

    if (
      !tooLostUpload.ok
    ) {
      const errorText =
        await tooLostUpload.text();

      return NextResponse.json(
        {
          success: false,
          error:
            `Too Lost audio upload failed (${tooLostUpload.status}).`,
          details:
            errorText.slice(
              0,
              2000
            ),
          fileKey,
        },
        { status: 502 }
      );
    }

    console.log(
      "Too Lost audio upload successful:",
      fileKey
    );

    return NextResponse.json({
      success: true,

      message:
        "Audio uploaded successfully to Too Lost.",

      releaseId,

      fileName,

      fileKey,

      method,

      sizeBytes:
        audioBuffer.byteLength,
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
      { status: 500 }
    );
  }
}