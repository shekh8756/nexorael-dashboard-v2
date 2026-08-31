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

function cleanFlacFileName(
  fileName: string
) {
  const baseName =
    String(fileName || "audio")
      .replace(/\.[^.]+$/, "")
      .normalize("NFKD")
      .replace(/[^\x00-\x7F]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

  return `${baseName || "audio"}.flac`;
}

export async function POST(
  request: NextRequest
) {
  try {
    const {
      releaseId,
      sourceUrl,
      fileName,
    } =
      await request.json();

    /*
     * =========================================
     * VALIDATION
     * =========================================
     */

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

    if (!sourceUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "sourceUrl is required",
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
     * Only allow our Supabase release-audio bucket.
     */

    const supabaseUrl =
      process.env
        .NEXT_PUBLIC_SUPABASE_URL;

    if (!supabaseUrl) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL is missing."
      );
    }

    const expectedPrefix =
      `${supabaseUrl.replace(
        /\/$/,
        ""
      )}/storage/v1/object/public/release-audio/`;

    if (
      !String(sourceUrl).startsWith(
        expectedPrefix
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid Supabase audio URL.",
        },
        { status: 400 }
      );
    }

    const tooLostFileName =
      cleanFlacFileName(
        fileName
      );

    /*
     * =========================================
     * MASTER TOO LOST TOKEN
     * =========================================
     */

    const accessToken =
      await getTooLostMasterAccessToken();

    /*
     * =========================================
     * 1. REQUEST TOO LOST PRESIGNED URL
     * =========================================
     */

    console.log(
      "Preparing server-side Too Lost upload:",
      {
        releaseId,
        sourceUrl,
        tooLostFileName,
      }
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

            fileName:
              tooLostFileName,

            contentType:
              "audio/flac",
          }),
        }
      );

    console.log(
      "Too Lost upload-url status:",
      uploadUrlResult
        .response.status
    );

    console.log(
      "Too Lost upload-url response:",
      JSON.stringify(
        uploadUrlResult.data
      )
    );

    if (
      !uploadUrlResult
        .response.ok
    ) {
      const errorData =
        uploadUrlResult.data as any;

      return NextResponse.json(
        {
          success: false,

          step:
            "create_upload_url",

          error:
            errorData?.message ||
            errorData?.error ||
            `Too Lost rejected upload URL request (${uploadUrlResult.response.status}).`,

          tooLostResponse:
            uploadUrlResult.data,
        },
        {
          status:
            uploadUrlResult
              .response.status,
        }
      );
    }

    const upload =
      findUploadData(
        uploadUrlResult.data
      );

    if (
      !upload.uploadUrl ||
      !upload.fileKey
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Too Lost did not return uploadUrl/fileKey.",

          tooLostResponse:
            uploadUrlResult.data,
        },
        { status: 502 }
      );
    }

    /*
     * =========================================
     * 2. FETCH FLAC FROM SUPABASE
     * =========================================
     */

    console.log(
      "Fetching FLAC from Supabase..."
    );

    const sourceResponse =
      await fetch(sourceUrl, {
        method: "GET",

        cache: "no-store",
      });

    if (
      !sourceResponse.ok ||
      !sourceResponse.body
    ) {
      return NextResponse.json(
        {
          success: false,

          step:
            "download_from_supabase",

          error:
            `Unable to read audio from Supabase (${sourceResponse.status}).`,
        },
        { status: 502 }
      );
    }

    /*
     * =========================================
     * 3. SERVER -> TOO LOST STORAGE
     *
     * No browser CORS here.
     * Stream file instead of loading whole
     * 100-300MB file into memory.
     * =========================================
     */

    const uploadHeaders:
      Record<string, string> =
      {};

    if (
      upload.headers &&
      typeof upload.headers ===
        "object"
    ) {
      for (
        const [
          key,
          value,
        ] of Object.entries(
          upload.headers
        )
      ) {
        if (
          typeof value ===
          "string"
        ) {
          uploadHeaders[key] =
            value;
        }
      }
    }

    const hasContentType =
      Object.keys(
        uploadHeaders
      ).some(
        (key) =>
          key.toLowerCase() ===
          "content-type"
      );

    if (!hasContentType) {
      uploadHeaders[
        "Content-Type"
      ] = "audio/flac";
    }

    /*
     * Preserve size if Supabase supplies it.
     */

    const contentLength =
      sourceResponse.headers.get(
        "content-length"
      );

    if (
      contentLength &&
      !Object.keys(
        uploadHeaders
      ).some(
        (key) =>
          key.toLowerCase() ===
          "content-length"
      )
    ) {
      uploadHeaders[
        "Content-Length"
      ] =
        contentLength;
    }

    console.log(
      "Uploading Supabase FLAC to Too Lost..."
    );

    const requestInit: any = {
      method:
        upload.method ||
        "PUT",

      headers:
        uploadHeaders,

      body:
        sourceResponse.body,

      /*
       * Required by Node fetch when
       * forwarding a ReadableStream.
       */
      duplex:
        "half",
    };

    const tooLostStorageResponse =
      await fetch(
        upload.uploadUrl,
        requestInit
      );

    if (
      !tooLostStorageResponse.ok
    ) {
      const errorText =
        await tooLostStorageResponse
          .text();

      console.error(
        "Too Lost storage upload failed:",
        tooLostStorageResponse
          .status,
        errorText
      );

      return NextResponse.json(
        {
          success: false,

          step:
            "upload_to_toolost",

          error:
            `Too Lost storage upload failed (${tooLostStorageResponse.status}).`,

          details:
            errorText,
        },
        {
          status:
            tooLostStorageResponse
              .status,
        }
      );
    }

    /*
     * =========================================
     * SUCCESS
     * =========================================
     */

    console.log(
      "Server-side Too Lost upload successful:",
      {
        releaseId,
        fileKey:
          upload.fileKey,
      }
    );

    return NextResponse.json({
      success: true,

      releaseId,

      fileKey:
        upload.fileKey,

      fileName:
        tooLostFileName,
    });
  } catch (error) {
    console.error(
      "Upload from Supabase to Too Lost error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Server-side audio upload failed.",
      },
      { status: 500 }
    );
  }
}