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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAccessToken() {
  const cookieStore =
    await cookies();

  return cookieStore.get(
    "toolost_access_token"
  )?.value;
}

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

/* =========================================
   PLATFORM NORMALIZER
========================================= */

function normalizePlatforms(
  raw: any
) {
  const result: {
    id: string;
    value: string;
    name: string;
    logo?: string | null;
  }[] = [];

  const seen =
    new Set<string>();

  function addPlatform(
    value: any,
    name?: any,
    logo?: any
  ) {
    const platformValue =
      String(
        value ?? ""
      ).trim();

    if (
      !platformValue
    ) {
      return;
    }

    const key =
      platformValue.toLowerCase();

    if (
      seen.has(key)
    ) {
      return;
    }

    seen.add(key);

    result.push({
      id: platformValue,
      value: platformValue,
      name:
        String(
          name ??
            platformValue
        ).trim(),
      logo:
        logo
          ? String(logo)
          : null,
    });
  }

  function walk(
    value: any
  ) {
    if (
      value == null
    ) {
      return;
    }

    if (
      typeof value ===
      "string"
    ) {
      addPlatform(
        value,
        value
      );

      return;
    }

    if (
      Array.isArray(
        value
      )
    ) {
      value.forEach(
        walk
      );

      return;
    }

    if (
      typeof value !==
      "object"
    ) {
      return;
    }

    const possibleValue =
      value.slug ??
      value.value ??
      value.platform ??
      value.code ??
      value.key ??
      value.id;

    const possibleName =
      value.name ??
      value.label ??
      value.title ??
      value.displayName ??
      value.platform_name;

    if (
      possibleValue != null &&
      possibleName != null
    ) {
      addPlatform(
        possibleValue,
        possibleName,
        value.logo ??
          value.logoUrl ??
          value.logo_url
      );
    }

    /*
     * Common API wrappers.
     */
    const wrappers = [
      "data",
      "platforms",
      "items",
      "results",
      "channels",
      "stores",
    ];

    let wrapperFound =
      false;

    for (
      const key of wrappers
    ) {
      if (
        value[key] != null
      ) {
        wrapperFound =
          true;

        walk(
          value[key]
        );
      }
    }

    /*
     * Handle object maps:
     *
     * {
     *   tiktok: {...},
     *   meta: {...}
     * }
     */
    if (
      !wrapperFound &&
      possibleValue == null
    ) {
      for (
        const [
          key,
          child,
        ] of Object.entries(
          value
        )
      ) {
        if (
          child &&
          typeof child ===
            "object"
        ) {
          const childAny =
            child as any;

          const childName =
            childAny.name ??
            childAny.label ??
            childAny.title ??
            key;

          const childValue =
            childAny.slug ??
            childAny.value ??
            childAny.platform ??
            childAny.code ??
            key;

          addPlatform(
            childValue,
            childName,
            childAny.logo ??
              childAny.logoUrl ??
              childAny.logo_url
          );

          walk(
            child
          );
        }
      }
    }
  }

  walk(raw);

  return result.sort(
    (a, b) =>
      a.name.localeCompare(
        b.name
      )
  );
}

/* =========================================
   NORMALIZE COUNTRY DATA
========================================= */

function normalizeCountries(
  input: any
) {
  const possible =
    input?.data ??
    input?.countries ??
    input?.countryTotal ??
    input?.territories ??
    input?.items ??
    input ??
    [];

  if (
    !Array.isArray(
      possible
    )
  ) {
    return [];
  }

  return possible
    .map(
      (item: any) => ({
        country:
          String(
            item?.country ??
              item?.country_name ??
              item?.name ??
              item?.territory ??
              item?.territory_name ??
              item?.code ??
              "Unknown"
          ),

        streams:
          Number(
            item?.streams ??
              item?.events ??
              item?.usage ??
              item?.total ??
              item?.value ??
              0
          ),

        percentage:
          Number(
            item?.percentage ??
              item?.percent ??
              item?.share ??
              0
          ),
      })
    )
    .filter(
      (item: any) =>
        item.country !==
        "Unknown" ||
        item.streams > 0
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
      ) ||
      "analytics";

    const platform =
      searchParams.get(
        "platform"
      ) ||
      "tiktok";

    const period =
      searchParams.get(
        "period"
      ) ||
      "lastThirtyDays";

    const release =
      searchParams.get(
        "release"
      ) ||
      "";

    const accessToken =
      await getAccessToken();

    if (
      !accessToken
    ) {
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
       LOAD ANALYTICS PLATFORMS
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

      if (
        !result.ok
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Unable to load analytics platforms.",
            status:
              result.status,
            raw:
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

      console.log(
        "ANALYTICS PLATFORMS RAW:",
        JSON.stringify(
          result.data,
          null,
          2
        )
      );

      console.log(
        "ANALYTICS PLATFORMS NORMALIZED:",
        platforms
      );

      return NextResponse.json({
        success: true,
        platforms,
        raw:
          result.data,
        generatedAt:
          new Date().toISOString(),
      });
    }

    /* =====================================
       ANALYTICS QUERY
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

    if (
      release
    ) {
      baseParams.set(
        "release",
        release
      );
    }

    const [
      overview,
      totalStreams,
      additionalInfo,
    ] =
      await Promise.all([
        callTooLost(
          accessToken,
          `analytics/platforms/data?${baseParams.toString()}`
        ),

        callTooLost(
          accessToken,
          `analytics/platforms/total-streams?${baseParams.toString()}`
        ),

        callTooLost(
          accessToken,
          `analytics/platforms/additional/info?${baseParams.toString()}`
        ),
      ]);

    /*
     * Try multiple possible Too Lost
     * additional analytics types.
     */
    const additionalTypes =
      [
        "sources",

        "source",

        "countries",

        "country",

        "territories",

        "territory",

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
          const params =
            new URLSearchParams(
              baseParams
            );

          params.set(
            "type",
            type
          );

          try {
            const result =
              await callTooLost(
                accessToken,
                `analytics/platforms/additional?${params.toString()}`
              );

            if (
              result.ok &&
              result.data !=
                null
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

    /* =====================================
       FIND COUNTRY INFORMATION
    ===================================== */

    let countries:
      any[] =
      [];

    /*
     * First preference:
     * /platforms/data
     */
    countries =
      normalizeCountries(
        (overview.data as any)
          ?.data
          ?.countryTotal ??
          (overview.data as any)
            ?.countryTotal
      );

    /*
     * If overview doesn't provide it,
     * try additional endpoints.
     */
    if (
      countries.length ===
      0
    ) {
      const candidates = [
        additional.country,

        additional.countries,

        additional.territory,

        additional.territories,

        additionalInfo.data,
      ];

      for (
        const candidate of candidates
      ) {
        const normalized =
          normalizeCountries(
            candidate
          );

        if (
          normalized.length >
          0
        ) {
          countries =
            normalized;

          break;
        }
      }
    }

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

      countries,

      additional,

      additionalInfo:
        additionalInfo.ok
          ? additionalInfo.data
          : null,

      apiStatus: {
        overview:
          overview.status,

        totalStreams:
          totalStreams.status,

        additionalInfo:
          additionalInfo.status,
      },

      generatedAt:
        new Date().toISOString(),
    });
  } catch (
    error
  ) {
    console.error(
      "PLATFORM ANALYTICS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof
            Error
            ? error.message
            : "Unable to load platform analytics.",
      },
      {
        status: 500,
      }
    );
  }
}