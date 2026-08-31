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
      trackNumber,
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

    const tracksResult =
      await tooLostApi(
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
          status:
            tracksResult.response.status,
          data:
            tracksResult.data,
        },
        {
          status:
            tracksResult.response.status,
        }
      );
    }

    const tracksResponse =
      tracksResult.data as any;

    const tracks =
      Array.isArray(
        tracksResponse?.data
      )
        ? tracksResponse.data
        : Array.isArray(
            tracksResponse
          )
        ? tracksResponse
        : [];

    if (tracks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          step: "get_tracks",
          error:
            "No track exists in this release.",
          data:
            tracksResult.data,
        },
        { status: 400 }
      );
    }

    /*
     * Track selection priority:
     * 1. trackNumber from frontend
     * 2. matching title
     * 3. fallback first track
     */

    let track: any = null;

    if (
      Number.isInteger(
        Number(trackNumber)
      ) &&
      Number(trackNumber) > 0
    ) {
      track =
        tracks[
          Number(trackNumber) - 1
        ] || null;
    }

    if (
      !track &&
      title
    ) {
      track =
        tracks.find(
          (item: any) =>
            String(
              item?.title || ""
            )
              .trim()
              .toLowerCase() ===
            String(
              title
            )
              .trim()
              .toLowerCase()
        ) || null;
    }

    if (!track) {
      track = tracks[0];
    }

    const trackId =
      track?.id;

    if (!trackId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Track ID was not returned.",
          selectedTrack:
            track,
          tracks,
        },
        { status: 400 }
      );
    }

    const updateResult =
      await tooLostApi(
        accessToken,
        `/releases/${releaseId}/tracks/${trackId}/file`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify({
              kind: "audio",
              fileKey,
            }),
        }
      );

    return NextResponse.json(
      {
        success:
          updateResult.response.ok,

        status:
          updateResult.response.status,

        data:
          updateResult.data,

        releaseId,

        trackId,

        trackNumber:
          trackNumber || null,

        title:
          title || null,

        selectedTrack:
          track,
      },
      {
        status:
          updateResult.response.ok
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