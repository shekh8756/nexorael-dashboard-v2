import { NextRequest, NextResponse } from "next/server";
import { getTooLostMasterAccessToken } from "@/lib/toolost-master";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
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
    const accessToken =
  await getTooLostMasterAccessToken();

    const body =
      await request.json();

    const {
      releaseId,
      fileName,
      contentType,
    } = body;

    if (!releaseId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "releaseId is required",
        },
        { status: 400 }
      );
    }

    if (!fileName) {
      return NextResponse.json(
        {
          success: false,
          error:
            "fileName is required",
        },
        { status: 400 }
      );
    }

    const result =
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

    const upload =
      findUploadData(
        result.data
      );

    console.log(
      "Too Lost upload URL status:",
      result.response.status
    );

    console.log(
      "Too Lost upload URL raw response:",
      result.data
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
          step:
            "create_upload_url",

          status:
            result.response.status,

          error:
            "Too Lost did not return a usable upload URL/file key.",

          tooLostResponse:
            result.data,
        },
        {
          status: 502,
        }
      );
    }

    return NextResponse.json({
      success: true,

      releaseId,

      uploadUrl:
        upload.uploadUrl,

      fileKey:
        upload.fileKey,

      method:
        upload.method ||
        "PUT",

      headers:
        upload.headers || {},

      raw:
        result.data,
    });
  } catch (error) {
    console.error(
      "Too Lost upload URL error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create upload URL",
      },
      { status: 500 }
    );
  }
}