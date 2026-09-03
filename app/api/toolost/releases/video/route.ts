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

      videoUrl,
      md5hash,

      videoType,
      ageRestriction,

      appleMusic,
      boomplay,
      spotify,
      tidal,
      vevo,
      youtubeVideo,

      audioChannels,
      audioCodec,
      audioSampleRate,

      videoCodec,
      videoDuration,
      videoHeight,
      videoWidth,

      isCoverVersion,
      referenceUpc,
      referenceIsrc,
    } = body;

    if (!releaseId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "releaseId is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!videoUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "videoUrl is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!md5hash) {
      return NextResponse.json(
        {
          success: false,
          error:
            "md5hash is required.",
        },
        {
          status: 400,
        }
      );
    }

    const allowedVideoTypes =
      [
        "official_music_video",
        "performance_video",
      ];

    const finalVideoType =
      videoType ||
      "official_music_video";

    if (
      !allowedVideoTypes.includes(
        finalVideoType
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid videoType.",
        },
        {
          status: 400,
        }
      );
    }

    const allowedAgeRestrictions =
      [
        "all_ages",
        "18_plus",
      ];

    const finalAgeRestriction =
      ageRestriction ||
      "all_ages";

    if (
      !allowedAgeRestrictions.includes(
        finalAgeRestriction
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid ageRestriction.",
        },
        {
          status: 400,
        }
      );
    }

    const videoPayload = {
      videoUrl:
        String(
          videoUrl
        ).trim(),

      md5hash:
        String(
          md5hash
        ).trim(),

      videoType:
        finalVideoType,

      ageRestriction:
        finalAgeRestriction,

      isCoverVersion:
        Boolean(
          isCoverVersion
        ),

      referenceUpc:
        referenceUpc
          ? String(
              referenceUpc
            ).trim()
          : null,

      referenceIsrc:
        referenceIsrc
          ? String(
              referenceIsrc
            ).trim()
          : null,

      delivery: {
        appleMusic:
          Boolean(
            appleMusic
          ),

        boomplay:
          Boolean(
            boomplay
          ),

        spotify:
          Boolean(
            spotify
          ),

        tidal:
          Boolean(
            tidal
          ),

        vevo:
          Boolean(
            vevo
          ),

        youtubeVideo:
          Boolean(
            youtubeVideo
          ),
      },

      metadata: {
        audio: {
          channels:
            Number(
              audioChannels ||
                2
            ),

          codec:
            String(
              audioCodec ||
                "aac"
            ),

          sample_rate:
            Number(
              audioSampleRate ||
                48000
            ),
        },

        video: {
          codec:
            String(
              videoCodec ||
                "h264"
            ),

          duration:
            Number(
              videoDuration ||
                0
            ),

          height:
            Number(
              videoHeight ||
                1080
            ),

          width:
            Number(
              videoWidth ||
                1920
            ),
        },
      },
    };

    console.log(
      "Too Lost video payload:",
      JSON.stringify(
        videoPayload,
        null,
        2
      )
    );

    const result =
      await tooLostApi(
        accessToken,

        `/releases/${releaseId}/video`,

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
              video:
                videoPayload,
            }),
        }
      );

    console.log(
      "Too Lost video status:",
      result.response.status
    );

    console.log(
      "Too Lost video response:",
      JSON.stringify(
        result.data
      )
    );

    if (
      !result.response.ok
    ) {
      const errorData =
        result.data as any;

      return NextResponse.json(
        {
          success: false,

          status:
            result.response.status,

          error:
            errorData?.message ||
            errorData?.error ||
            "Too Lost rejected video metadata.",

          tooLostResponse:
            result.data,
        },

        {
          status:
            result.response.status,
        }
      );
    }

    return NextResponse.json({
      success: true,

      releaseId,

      video:
        videoPayload,

      data:
        result.data,
    });
  } catch (error) {
    console.error(
      "Too Lost video route error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to update Too Lost video.",
      },

      {
        status: 500,
      }
    );
  }
}