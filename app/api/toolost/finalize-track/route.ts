import { NextRequest, NextResponse } from "next/server";
import { getTooLostMasterAccessToken } from "@/lib/toolost-master";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const accessToken =
  await getTooLostMasterAccessToken();

    const body = await request.json();

    const {
      releaseId,
      title,
      fileKey,
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

    if (!fileKey) {
      return NextResponse.json(
        {
          success: false,
          error: "fileKey is required",
        },
        { status: 400 }
      );
    }

    // Get current tracks
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
          error:
            "No track exists in this release.",
          data: tracksResult.data,
        },
        { status: 400 }
      );
    }

    const track = tracks[0];

    const trackId = track?.id;

    if (!trackId) {
      return NextResponse.json(
        {
          success: false,
          error: "Track ID was not returned.",
          data: track,
        },
        { status: 400 }
      );
    }

    // Attach uploaded audio file
    const updateResult = await tooLostApi(
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

    return NextResponse.json(
      {
        success: updateResult.response.ok,
        status: updateResult.response.status,
        data: updateResult.data,
        releaseId,
        trackId,
        title,
      },
      {
        status: updateResult.response.ok
          ? 200
          : updateResult.response.status,
      }
    );
  } catch (error) {
    console.error(
      "Too Lost finalize track error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to finalize track",
      },
      { status: 500 }
    );
  }
}