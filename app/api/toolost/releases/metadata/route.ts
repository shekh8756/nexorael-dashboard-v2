import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
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
      artworkUrl,
      metadata,
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

    /*
     * Too Lost API documentation:
     *
     * coverUrl = release artwork URL
     *
     * DO NOT use:
     * artwork_url
     * artwork
     * cover_url
     */

    const patch: Record<string, unknown> = {
      ...(metadata || {}),
    };

    if (artworkUrl) {
      patch.coverUrl = String(artworkUrl).trim();
    }

    console.log("Too Lost metadata PATCH:", {
      releaseId,
      coverUrl: patch.coverUrl,
      metadata,
    });

    const result = await tooLostApi(
      accessToken,
      `/releases/${releaseId}/metadata`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(patch),
      }
    );

    console.log(
      "Too Lost metadata response:",
      result.response.status,
      result.data
    );

    if (!result.response.ok) {
      return NextResponse.json(
        {
          success: false,
          status: result.response.status,
          error:
            "Too Lost rejected the release metadata update.",
          tooLostResponse: result.data,
          sentPayload: patch,
        },
        {
          status: result.response.status,
        }
      );
    }

    return NextResponse.json({
      success: true,
      releaseId,
      coverUrl: patch.coverUrl || null,
      data: result.data,
    });
  } catch (error) {
    console.error(
      "Too Lost metadata update error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update Too Lost release metadata",
      },
      { status: 500 }
    );
  }
}