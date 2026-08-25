import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  cookies,
} from "next/headers";

import {
  tooLostApi,
} from "@/lib/toolost";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

/* =========================================
   ACCESS TOKEN
========================================= */

async function getAccessToken() {
  const cookieStore =
    await cookies();

  return cookieStore.get(
    "toolost_access_token"
  )?.value;
}

/* =========================================
   CALL TOO LOST
========================================= */

async function callTooLost(
  accessToken: string,
  path: string
) {
  const {
    response,
    data,
  } = await tooLostApi(
    accessToken,
    path,
    {
      method: "GET",

      headers: {
        Accept:
          "application/json",
      },
    }
  );

  return {
    ok: response.ok,
    status:
      response.status,
    data,
  };
}

/* =========================================
   NORMALIZE PLATFORM LIST
========================================= */

function normalizePlatforms(
  raw: any
) {
  const root =
    raw?.data ??
    raw?.platforms ??
    raw ??
    [];

  const list =
    Array.isArray(root)
      ? root
      : [];

  return list
    .map(
      (
        item: any,
        index: number
      ) => {
        if (
          typeof item ===
          "string"
        ) {
          return {
            id:
              item,
            value:
              item,
            name:
              item,
          };
        }

        const value =
          item?.slug ??
          item?.value ??
          item?.platform ??
          item?.code ??
          item?.id ??
          item?.name ??
          String(index);

        const name =
          item?.name ??
          item?.label ??
          item?.title ??
          item?.platform ??
          String(value);

        return {
          ...item,

          id:
            item?.id ??
            value,

          value:
            String(value),

          name:
            String(name),
        };
      }
    )
    .filter(
      (
        item: any
      ) =>
        Boolean(
          item.value
        )
    );
}

/* =========================================
   GET
========================================= */

export async function GET(
  request: NextRequest
) {
  try {
    const {
      searchParams,
    } = new URL(
      request.url
    );

    const action =
      searchParams.get(
        "action"
      ) || "analytics";

    const platform =
      searchParams.get(
        "platform"
      ) || "tiktok";

    const period =
      searchParams.get(
        "period"
      ) ||
      "lastThirtyDays";

    const release =
      searchParams.get(
        "release"
      ) || "";

    const accessToken =
      await getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Too Lost is not connected.",
        },
        {
          status: 401,
        }
      );
    }

    /* =====================================
       PLATFORM LIST
    ===================================== */

    if (
      action ===
      "platforms"
    ) {
      const result =
        await callTooLost(
          accessToken,
          "analytics/platforms"
        );

      if (!result.ok) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "Unable to load Too Lost analytics platforms.",

            status:
              result.status,

            response:
              result.data,
          },
          {
            status:
              result.status,
          }
        );
      }

      const platforms =
        normalizePlatforms(
          result.data
        );

      return NextResponse.json({
        success: true,

        platforms,

        generatedAt:
          new Date().toISOString(),
      });
    }

    /* =====================================
       BASE QUERY
    ===================================== */

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

    /* =====================================
       MAIN PLATFORM ENDPOINTS
    ===================================== */

    const [
      overview,
      totalStreams,
    ] = await Promise.all([
      callTooLost(
        accessToken,
        `analytics/platforms/data?${baseParams.toString()}`
      ),

      callTooLost(
        accessToken,
        `analytics/platforms/total-streams?${baseParams.toString()}`
      ),
    ]);

    /* =====================================
       ADDITIONAL ANALYTICS

       Too Lost supports different
       information depending on platform.
    ===================================== */

    const additionalTypes =
      [
        "sources",
        "countries",
        "comments",
        "likes",
        "shares",
        "favorites",
        "impressions",
        "usage",
        "production",
        "consumption",
      ];

    const additional:
      Record<
        string,
        any
      > = {};

    await Promise.all(
      additionalTypes.map(
        async (
          type
        ) => {
          try {
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

            if (
              result.ok &&
              result.data
            ) {
              additional[
                type
              ] =
                result.data;
            }
          } catch (
            error
          ) {
            console.warn(
              `Additional analytics failed: ${type}`,
              error
            );
          }
        }
      )
    );

    return NextResponse.json({
      success: true,

      platform,
      period,

      release:
        release ||
        null,

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
      "PLATFORM ANALYTICS ERROR:",
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