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

/* ======================================================
   HELPERS
====================================================== */

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function buildWriters(
  composer?: string,
  lyricist?: string
) {
  const writerMap = new Map<
    string,
    {
      name: string;
      role: string[];
    }
  >();

  function addWriter(
    name: string,
    role: string
  ) {
    const cleanedName =
      clean(name);

    if (!cleanedName) {
      return;
    }

    const key =
      cleanedName.toLowerCase();

    const existing =
      writerMap.get(key);

    if (existing) {
      if (
        !existing.role.includes(
          role
        )
      ) {
        existing.role.push(
          role
        );
      }

      return;
    }

    writerMap.set(
      key,
      {
        name:
          cleanedName,

        role: [
          role,
        ],
      }
    );
  }

  /*
   * Too Lost official writer roles:
   *
   * Composer:
   * instrumentalist
   *
   * Lyricist:
   * lyricist
   */

  if (
    clean(composer)
  ) {
    addWriter(
      composer!,
      "instrumentalist"
    );
  }

  if (
    clean(lyricist)
  ) {
    addWriter(
      lyricist!,
      "lyricist"
    );
  }

  return Array.from(
    writerMap.values()
  );
}

/* ======================================================
   POST
====================================================== */

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

      /*
       * Music credits
       */
      artist,
      composer,
      lyricist,

      /*
       * Video
       */
      videoUrl,
      md5hash,

      videoType,
      ageRestriction,

      /*
       * Delivery
       */
      appleMusic,
      boomplay,
      spotify,
      tidal,
      vevo,
      youtubeVideo,

      /*
       * Technical metadata
       */
      audioChannels,
      audioCodec,
      audioSampleRate,

      videoCodec,
      videoDuration,
      videoHeight,
      videoWidth,

      /*
       * Cover/reference
       */
      isCoverVersion,
      referenceUpc,
      referenceIsrc,
    } = body;

    /* ==================================================
       REQUIRED FIELDS
    ================================================== */

    if (
      !clean(
        releaseId
      )
    ) {
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

    if (
      !clean(
        artist
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Artist is required for music videos.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !clean(
        videoUrl
      )
    ) {
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

    if (
      !clean(
        md5hash
      )
    ) {
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

    /* ==================================================
       VIDEO TYPE
    ================================================== */

    const allowedVideoTypes =
      [
        "official_music_video",
        "performance_video",
      ];

    const finalVideoType =
      clean(
        videoType
      ) ||
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

    /* ==================================================
       AGE RESTRICTION
    ================================================== */

    const allowedAgeRestrictions =
      [
        "all_ages",
        "18_plus",
      ];

    const finalAgeRestriction =
      clean(
        ageRestriction
      ) ||
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

    /* ==================================================
       PARTICIPANTS
    ================================================== */
const participants = [
  {
    connect: null,

    apple: {
      url: null,
    },

    spotify: {
      url: null,
    },

    vevo: {
      url: null,
    },

    default: true,

    name: clean(
      artist
    ),

    role: [
      "primary",
    ],
  },
];

    /* ==================================================
       WRITERS
    ================================================== */

    const writers =
      buildWriters(
        composer,
        lyricist
      );

    if (
      writers.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "At least one Composer or Lyricist is required.",
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       TECHNICAL VALIDATION
    ================================================== */

    const finalAudioChannels =
      Number(
        audioChannels
      );

    const finalAudioSampleRate =
      Number(
        audioSampleRate
      );

    const finalVideoDuration =
      Number(
        videoDuration
      );

    const finalVideoHeight =
      Number(
        videoHeight
      );

    const finalVideoWidth =
      Number(
        videoWidth
      );

    if (
      !Number.isFinite(
        finalAudioChannels
      ) ||
      finalAudioChannels <
        1
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid audioChannels.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        finalAudioSampleRate
      ) ||
      finalAudioSampleRate <
        1
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid audioSampleRate.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        finalVideoDuration
      ) ||
      finalVideoDuration <=
        0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid videoDuration.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        finalVideoWidth
      ) ||
      finalVideoWidth <
        1 ||
      !Number.isFinite(
        finalVideoHeight
      ) ||
      finalVideoHeight <
        1
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid video dimensions.",
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       VIDEO PAYLOAD
    ================================================== */

    const videoPayload = {
      videoUrl:
        clean(
          videoUrl
        ),

      md5hash:
        clean(
          md5hash
        ),

      videoType:
        finalVideoType,

      ageRestriction:
        finalAgeRestriction,

      isCoverVersion:
        Boolean(
          isCoverVersion
        ),

      referenceUpc:
        clean(
          referenceUpc
        ) ||
        null,

      referenceIsrc:
        clean(
          referenceIsrc
        ) ||
        null,

      /*
       * Required music credits
       */

      participants,

writers,

credits: writers,

      /*
       * Delivery targets
       */

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

      /*
       * Technical media metadata
       */

      metadata: {
        audio: {
          channels:
            finalAudioChannels,

          codec:
            clean(
              audioCodec
            ) ||
            "aac",

          sample_rate:
            finalAudioSampleRate,
        },

        video: {
          codec:
            clean(
              videoCodec
            ) ||
            "h264",

          duration:
            finalVideoDuration,

          height:
            finalVideoHeight,

          width:
            finalVideoWidth,
        },
      },
    };

    console.log(
      "Too Lost Music Video payload:",
      JSON.stringify(
        videoPayload,
        null,
        2
      )
    );

    /* ==================================================
       TOO LOST
    ================================================== */

    const result =
      await tooLostApi(
        accessToken,

        `/releases/${clean(
          releaseId
        )}/video`,

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
      "Too Lost Music Video status:",
      result.response.status
    );

    console.log(
      "Too Lost Music Video response:",
      JSON.stringify(
        result.data,
        null,
        2
      )
    );

    /* ==================================================
       ERROR RESPONSE
    ================================================== */

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
            "Too Lost rejected music video metadata.",

          tooLostResponse:
            result.data,

          sent: {
            participants,
            writers,
          },
        },

        {
          status:
            result.response.status,
        }
      );
    }

    /* ==================================================
       SUCCESS
    ================================================== */

    return NextResponse.json({
      success: true,

      releaseId:
        clean(
          releaseId
        ),

      participants,

      writers,

      video:
        videoPayload,

      data:
        result.data,
    });
  } catch (
    error
  ) {
    console.error(
      "Too Lost Music Video route error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to update Too Lost music video.",
      },

      {
        status: 500,
      }
    );
  }
}