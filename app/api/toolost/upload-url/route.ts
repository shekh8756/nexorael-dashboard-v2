import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const body = await request.json();

    const {
      releaseId,
      fileName,
      contentType,
    } = body;

    if (!releaseId) {
      return NextResponse.json(
        {
          success: false,
          error: "releaseId is required",
        },
        { status: 400 }
      );
    }

    if (!fileName) {
      return NextResponse.json(
        {
          success: false,
          error: "fileName is required",
        },
        { status: 400 }
      );
    }

    const result = await tooLostApi(
      accessToken,
      `/releases/${releaseId}/tracks/upload-url`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "audio",
          fileName,
          contentType: contentType || "audio/wav",
        }),
      }
    );

    return NextResponse.json(
      {
        success: result.response.ok,
        status: result.response.status,
        data: result.data,
      },
      {
        status: result.response.ok
          ? 200
          : result.response.status,
      }
    );
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