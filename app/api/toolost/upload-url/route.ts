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
    value.uploadURL ??
    value.upload_url ??
    value.url ??
    value.signedUrl ??
    value.signedURL ??
    value.signed_url ??
    value.presignedUrl ??
    value.presignedURL ??
    value.presigned_url ??
    value.putUrl ??
    value.putURL ??
    value.put_url;

  const fileKey =
    value.fileKey ??
    value.file_key ??
    value.key ??
    value.objectKey ??
    value.object_key ??
    value.filePath ??
    value.file_path ??
    value.path;

  if (uploadUrl || fileKey) {
    return {
      uploadUrl: uploadUrl
        ? String(uploadUrl)
        : undefined,

      fileKey: fileKey
        ? String(fileKey)
        : undefined,

      method:
        value.method ??
        value.httpMethod ??
        value.http_method ??
        "PUT",

      headers:
        value.headers ??
        value.uploadHeaders ??
        value.upload_headers ??
        {},
    };
  }

  for (const key of Object.keys(value)) {
    const child = value[key];

    if (
      child &&
      typeof child === "object"
    ) {
      const found =
        findUploadData(child);

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

    /*
     * =========================================
     * TOO LOST AUDIO FILE NAME
     * =========================================
     *
     * Too Lost upload-url expects FLAC format.
     */

    const baseName =
      String(fileName)
        .replace(/\.[^.]+$/, "")
        .normalize("NFKD")
        .replace(/[^\x00-\x7F]/g, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");

    const tooLostFileName =
      `${baseName || "audio"}.flac`;

    console.log(
      "Requesting Too Lost upload URL:",
      {
        releaseId,
        originalFileName:
          fileName,
        tooLostFileName,
        contentType:
          "audio/flac",
      }
    );

    /*
     * =========================================
     * REQUEST PRESIGNED URL FROM TOO LOST
     * =========================================
     */

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

            fileName:
              tooLostFileName,

            contentType:
              "audio/flac",
          }),
        }
      );

    console.log(
      "Too Lost upload-url HTTP status:",
      result.response.status
    );

    console.log(
      "Too Lost upload-url RAW response:",
      JSON.stringify(
        result.data,
        null,
        2
      )
    );

    /*
     * =========================================
     * TOO LOST ERROR
     * =========================================
     */

    if (!result.response.ok) {
      const tooLostData =
        result.data as any;

      return NextResponse.json(
        {
          success: false,

          step:
            "create_upload_url",

          status:
            result.response.status,

          error:
            tooLostData?.message ||
            tooLostData?.error ||
            tooLostData?.detail ||
            `Too Lost rejected upload-url request (${result.response.status}).`,

          tooLostResponse:
            result.data,
        },
        {
          status:
            result.response.status,
        }
      );
    }

    /*
     * =========================================
     * NORMALIZE PRESIGNED URL RESPONSE
     * =========================================
     */

    const upload =
      findUploadData(
        result.data
      );

    console.log(
      "Normalized Too Lost upload data:",
      upload
    );

    if (!upload.uploadUrl) {
      return NextResponse.json(
        {
          success: false,

          step:
            "create_upload_url",

          status:
            result.response.status,

          error:
            "Too Lost response did not contain an upload URL.",

          tooLostResponse:
            result.data,
        },
        { status: 502 }
      );
    }

    if (!upload.fileKey) {
      return NextResponse.json(
        {
          success: false,

          step:
            "create_upload_url",

          status:
            result.response.status,

          error:
            "Too Lost returned an upload URL but no fileKey.",

          tooLostResponse:
            result.data,
        },
        { status: 502 }
      );
    }

    /*
     * =========================================
     * SUCCESS
     * =========================================
     */

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

      fileName:
        tooLostFileName,

      contentType:
        "audio/flac",
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