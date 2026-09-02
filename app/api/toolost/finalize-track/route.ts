import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getTooLostMasterAccessToken,
} from "@/lib/toolost-master";

import {
  tooLostApi,
} from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * =========================================
 * UNWRAP TOO LOST RESPONSE
 * =========================================
 */

function unwrap(value: any) {
  return (
    value?.data?.data ??
    value?.data ??
    value
  );
}

/*
 * =========================================
 * POST
 * =========================================
 */

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
      title,
      fileKey,
      trackNumber,

      artist,
      composer,
      lyricist,
      writer,

      language,
      contentType,
      explicit,
      isrc,
      version,
    } = body;

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
            "releaseId is required.",
        },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Track title is required.",
        },
        { status: 400 }
      );
    }

    if (!fileKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "fileKey is required.",
        },
        { status: 400 }
      );
    }

    if (!artist) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Track artist is required.",
        },
        { status: 400 }
      );
    }

    /*
     * =========================================
     * ARTISTS
     * =========================================
     */

    const artists = [
      {
        name:
          String(artist).trim(),

        role: [
          "primary",
        ],
      },
    ];

    /*
     * =========================================
     * WRITERS
     * =========================================
     */

    const writers: any[] =
      [];

    if (
  composer &&
  String(composer).trim()
) {
  writers.push({
    name: String(
      composer
    ).trim(),

    role: [
      "composer",
    ],
  });
}

    if (
      lyricist &&
      String(lyricist).trim()
    ) {
      writers.push({
        name:
          String(
            lyricist
          ).trim(),

        role: [
          "lyricist",
        ],
      });
    }

    if (
      writer &&
      String(writer).trim()
    ) {
      writers.push({
        name:
          String(
            writer
          ).trim(),

        role: [
          "writer",
        ],
      });
    }

    /*
     * Too Lost requires at least
     * one writer.
     *
     * Composer is required by our
     * dashboard anyway, but keep a
     * safe fallback.
     */

    if (
      writers.length === 0
    ) {
      writers.push({
        name:
          String(
            artist
          ).trim(),

        role: [
          "writer",
        ],
      });
    }

    /*
     * =========================================
     * GET EXISTING TRACKS
     * =========================================
     */

    const existingResult =
      await tooLostApi(
        accessToken,

        `/releases/${releaseId}/tracks`,

        {
          method:
            "GET",
        }
      );

    let existingTracks =
      unwrap(
        existingResult.data
      );

    if (
      !Array.isArray(
        existingTracks
      )
    ) {
      existingTracks =
        [];
    }

    const index =
      Math.max(
        Number(
          trackNumber || 1
        ) - 1,
        0
      );

    let existingTrack =
      existingTracks[
        index
      ];

    /*
     * Title fallback.
     */

    if (!existingTrack) {
      existingTrack =
        existingTracks.find(
          (item: any) =>
            String(
              item?.title ||
                ""
            )
              .trim()
              .toLowerCase() ===
            String(title)
              .trim()
              .toLowerCase()
        );
    }

    /*
     * =========================================
     * BUILD TRACK PAYLOAD
     * =========================================
     */

    const trackPayload:
      Record<
        string,
        unknown
      > = {
      title:
        String(
          title
        ).trim(),

      language:
        language ||
        "English",

      content_type:
        contentType ||
        "original",

      explicit:
        Boolean(
          explicit
        ),

      /*
       * Too Lost requires this
       * while creating track.
       */
      audioFileKey:
        fileKey,

      artists,

      writers,
    };

    if (
      existingTrack?.id
    ) {
      trackPayload.id =
        existingTrack.id;
    }

    if (
      isrc &&
      String(isrc).trim()
    ) {
      trackPayload.isrc =
        String(
          isrc
        ).trim();
    }

    if (
      version &&
      String(version).trim()
    ) {
      trackPayload.version =
        String(
          version
        ).trim();
    }

    console.log(
      "Creating/updating Too Lost track:",
      JSON.stringify(
        trackPayload,
        null,
        2
      )
    );

    /*
     * =========================================
     * CREATE / UPDATE TRACK
     * =========================================
     */

    const metadataResult =
      await tooLostApi(
        accessToken,

        `/releases/${releaseId}/tracks`,

        {
          method:
            "PUT",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify({
              tracks: [
                trackPayload,
              ],
            }),
        }
      );

    console.log(
      "Too Lost track metadata status:",
      metadataResult
        .response.status
    );

    console.log(
      "Too Lost track metadata response:",
      JSON.stringify(
        metadataResult.data
      )
    );

    if (
      !metadataResult
        .response.ok
    ) {
      const errorData =
        metadataResult.data as any;

      return NextResponse.json(
        {
          success: false,

          step:
            "track_metadata",

          status:
            metadataResult
              .response.status,

          error:
            errorData?.message ||
            errorData?.error ||
            "Too Lost rejected track metadata.",

          tooLostResponse:
            metadataResult.data,
        },

        {
          status:
            metadataResult
              .response.status,
        }
      );
    }

    /*
     * =========================================
     * FETCH TRACK AGAIN
     * =========================================
     */

    const refreshedResult =
      await tooLostApi(
        accessToken,

        `/releases/${releaseId}/tracks`,

        {
          method:
            "GET",
        }
      );

    let refreshedTracks =
      unwrap(
        refreshedResult.data
      );

    if (
      !Array.isArray(
        refreshedTracks
      )
    ) {
      refreshedTracks =
        [];
    }

    let track =
      refreshedTracks[
        index
      ];

    if (!track) {
      track =
        refreshedTracks.find(
          (item: any) =>
            String(
              item?.title ||
                ""
            )
              .trim()
              .toLowerCase() ===
            String(title)
              .trim()
              .toLowerCase()
        );
    }

    /*
     * Last fallback only for
     * single-track releases.
     */

    if (
      !track &&
      refreshedTracks.length ===
        1
    ) {
      track =
        refreshedTracks[0];
    }

    const trackId =
      track?.id;

    if (!trackId) {
      console.error(
        "Too Lost tracks after creation:",
        JSON.stringify(
          refreshedTracks
        )
      );

      return NextResponse.json(
        {
          success: false,

          step:
            "find_created_track",

          error:
            "Too Lost did not return a track ID after track creation.",

          tooLostResponse:
            refreshedResult.data,
        },

        { status: 502 }
      );
    }

    /*
     * =========================================
     * ATTACH AUDIO FILE
     * =========================================
     */

    const attachResult =
      await tooLostApi(
        accessToken,

        `/releases/${releaseId}/tracks/${trackId}/file`,

        {
          method:
            "PATCH",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify({
              kind:
                "audio",

              fileKey,
            }),
        }
      );

    console.log(
      "Too Lost attach audio status:",
      attachResult
        .response.status
    );

    console.log(
      "Too Lost attach response:",
      JSON.stringify(
        attachResult.data
      )
    );

    if (
      !attachResult.response.ok
    ) {
      const errorData =
        attachResult.data as any;

      return NextResponse.json(
        {
          success: false,

          step:
            "attach_file",

          status:
            attachResult
              .response.status,

          error:
            errorData?.message ||
            errorData?.error ||
            "Too Lost rejected audio attachment.",

          tooLostResponse:
            attachResult.data,

          trackId,

          fileKey,
        },

        {
          status:
            attachResult
              .response.status,
        }
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

      trackId,

      fileKey,

      track,

      data:
        attachResult.data,
    });
  } catch (error) {
    console.error(
      "Too Lost finalize-track error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to finalize Too Lost track.",
      },

      { status: 500 }
    );
  }
}