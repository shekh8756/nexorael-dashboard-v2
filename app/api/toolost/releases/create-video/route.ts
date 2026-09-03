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

function clean(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
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
      title,
      artist,
      label,
    } = body;

    /* ==================================================
       VALIDATION
    ================================================== */

    if (
      !clean(title)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Title is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !clean(artist)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Artist is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !clean(label)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Label is required.",
        },
        {
          status: 400,
        }
      );
    }

    /* ==================================================
       TOO LOST CREATE MUSIC VIDEO DRAFT
    ================================================== */

    const payload = {
      type:
        "MusicVideo",

      title:
        clean(
          title
        ),

      label:
        clean(
          label
        ),

      participants: [
        {
          name:
            clean(
              artist
            ),

          role: [
            "primary",
          ],
        },
      ],
    };

    console.log(
      "Too Lost create MusicVideo payload:",
      JSON.stringify(
        payload,
        null,
        2
      )
    );

    const result =
      await tooLostApi(
        accessToken,
        "/releases",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify(
              payload
            ),
        }
      );

    console.log(
      "Too Lost create MusicVideo status:",
      result.response.status
    );

    console.log(
      "Too Lost create MusicVideo response:",
      JSON.stringify(
        result.data,
        null,
        2
      )
    );

    /* ==================================================
       ERROR
    ================================================== */

    if (
      !result.response.ok
    ) {
      const data =
        result.data as any;

      return NextResponse.json(
        {
          success: false,

          status:
            result.response.status,

          error:
            data?.message ||
            data?.error ||
            "Too Lost MusicVideo draft creation failed.",

          tooLostResponse:
            result.data,
        },
        {
          status:
            result.response.status,
        }
      );
    }

    /* ==================================================
       FIND RELEASE ID
    ================================================== */

    const data =
      result.data as any;

    const releaseData =
      data?.data ||
      data;

    const releaseId =
      releaseData?.id ??
      releaseData?.releaseId ??
      releaseData?.release_id ??
      null;

    if (
      !releaseId
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Too Lost created the MusicVideo draft but release ID was not found in response.",

          tooLostResponse:
            result.data,
        },
        {
          status: 500,
        }
      );
    }

    /* ==================================================
       SUCCESS
    ================================================== */

    return NextResponse.json({
      success: true,

      releaseId:
        String(
          releaseId
        ),

      release:
        releaseData,

      data:
        result.data,
    });
  } catch (
    error
  ) {
    console.error(
      "Create MusicVideo route error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to create Too Lost MusicVideo draft.",
      },
      {
        status: 500,
      }
    );
  }
}