import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const maxDuration = 300;

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

      if (
        found.uploadUrl ||
        found.fileKey
      ) {
        return found;
      }
    }
  }

  return {};
}

export async function POST(
  request: NextRequest
) {
  try {
    // -----------------------------------------
    // 1. GET TOO LOST ACCESS TOKEN
    // -----------------------------------------

    const cookieStore = await cookies();

    const accessToken =
      cookieStore.get(
        "toolost_access_token"
      )?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Too Lost is not connected",
        },
        { status: 401 }
      );
    }

    // -----------------------------------------
    // 2. READ REQUEST
    // -----------------------------------------

    const body =
      await request.json();

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
          error:
            "releaseId is required.",
        },
        { status: 400 }
      );
    }

    if (!fileName) {
      return NextResponse.json(
        {
          success: false,
          error:
            "fileName is required.",
        },
        { status: 400 }
      );
    }

    if (!audioUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "audioUrl is required.",
        },
        { status: 400 }
      );
    }

    // -----------------------------------------
    // 3. GET TOO LOST PRESIGNED UPLOAD URL
    // -----------------------------------------

    console.log(
      "Requesting Too Lost upload URL for release:",
      releaseId
    );

    const uploadUrlResult =
      await tooLostApi(
        accessToken,
        `/releases/${releaseId}/tracks/upload-url`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
          },
          body: JSON.stringify({
            kind: "audio",
            fileName,
            contentType:
              contentType ||
              "audio/wav",
          }),
        }
      );

    console.log(
      "Too Lost upload URL status:",
      uploadUrlResult.response.status
    );

    console.log(
      "Too Lost upload URL response:",
      uploadUrlResult.data
    );

    if (!uploadUrlResult.response.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "create_upload_url",
          status:
            uploadUrlResult.response.status,
          error:
            "Too Lost rejected upload URL request.",
          tooLostResponse:
            uploadUrlResult.data,
        },
        {
          status:
            uploadUrlResult.response.status,
        }
      );
    }

    const upload =
      findUploadData(
        uploadUrlResult.data
      );

    console.log(
      "Too Lost normalized upload:",
      upload
    );

    if (
      !upload.uploadUrl ||
      !upload.fileKey
    ) {
      return NextResponse.json(
        {
          success: false,
          step: "create_upload_url",
          error:
            "Too Lost did not return a usable upload URL/file key.",
          tooLostResponse:
            uploadUrlResult.data,
        },
        { status: 502 }
      );
    }

    // -----------------------------------------
    // 4. DOWNLOAD AUDIO FROM SUPABASE
    // -----------------------------------------

    console.log(
      "Downloading audio from Supabase:",
      audioUrl
    );

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
          step: "download_audio",
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
          step: "download_audio",
          error:
            "The Supabase audio file is empty.",
        },
        { status: 400 }
      );
    }

    console.log(
      "Audio downloaded:",
      audioBuffer.byteLength,
      "bytes"
    );

    // -----------------------------------------
    // 5. UPLOAD AUDIO TO TOO LOST S3
    // -----------------------------------------

    const uploadHeaders =
      new Headers(
        upload.headers || {}
      );

    if (
      !uploadHeaders.has(
        "Content-Type"
      )
    ) {
      uploadHeaders.set(
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
        upload.uploadUrl,
        {
          method:
            upload.method ||
            "PUT",
          headers:
            uploadHeaders,
          body:
            audioBuffer,
        }
      );

    const uploadResponseText =
      await tooLostUpload.text();

    console.log(
      "Too Lost binary upload status:",
      tooLostUpload.status
    );

    console.log(
      "Too Lost binary upload response:",
      uploadResponseText
    );

    if (!tooLostUpload.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "too_lost_binary_upload",
          error:
            `Too Lost audio upload failed (${tooLostUpload.status}).`,
          details:
            uploadResponseText.slice(
              0,
              2000
            ),
          fileKey:
            upload.fileKey,
        },
        { status: 502 }
      );
    }

    // -----------------------------------------
    // 6. SUCCESS
    // -----------------------------------------

    console.log(
      "Too Lost audio upload successful:",
      upload.fileKey
    );

    return NextResponse.json({
      success: true,

      message:
        "Audio uploaded successfully to Too Lost.",

      releaseId,

      fileName,

      fileKey:
        upload.fileKey,

      method:
        upload.method ||
        "PUT",

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