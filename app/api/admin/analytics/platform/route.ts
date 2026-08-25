import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAccessToken() {
  const cookieStore = await cookies();

  return cookieStore.get(
    "toolost_access_token"
  )?.value;
}

async function callTooLost(
  accessToken: string,
  path: string
) {
  const { response, data } =
    await tooLostApi(
      accessToken,
      path,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const platform =
      searchParams.get("platform") ||
      "tiktok";

    const period =
      searchParams.get("period") ||
      "lastThirtyDays";

    const release =
      searchParams.get("release") ||
      "";

    const accessToken =
      await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Too Lost is not connected.",
        },
        { status: 401 }
      );
    }

    const baseParams =
      new URLSearchParams();

    baseParams.set(
      "period",
      period
    );

    baseParams.set(
      "platform",
      platform
    );

    if (release) {
      baseParams.set(
        "release",
        release
      );
    }

    const overviewPath =
      `analytics/platforms/data?${baseParams.toString()}`;

    const totalStreamsPath =
      `analytics/platforms/total-streams?${baseParams.toString()}`;

    const [
      overview,
      totalStreams,
    ] = await Promise.all([
      callTooLost(
        accessToken,
        overviewPath
      ),

      callTooLost(
        accessToken,
        totalStreamsPath
      ),
    ]);

    /*
     * Additional analytics types
     * can differ by platform.
     *
     * Try common types individually.
     */

    const additionalTypes = [
      "comments",
      "likes",
      "shares",
      "favorites",
      "sources",
      "countries",
      "tracks",
    ];

    const additional: Record<
      string,
      any
    > = {};

    await Promise.all(
      additionalTypes.map(
        async (type) => {
          const params =
            new URLSearchParams(
              baseParams
            );

          params.set(
            "type",
            type
          );

          const result =
            await callTooLost(
              accessToken,
              `analytics/platforms/additional?${params.toString()}`
            );

          if (result.ok) {
            additional[type] =
              result.data;
          }
        }
      )
    );

    return NextResponse.json({
      success: true,

      platform,
      period,
      release:
        release || null,

      overview:
        overview.ok
          ? overview.data
          : null,

      totalStreams:
        totalStreams.ok
          ? totalStreams.data
          : null,

      additional,

      apiStatus: {
        overview:
          overview.status,

        totalStreams:
          totalStreams.status,
      },

      generatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Platform analytics error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to load platform analytics.",
      },
      {
        status: 500,
      }
    );
  }
}