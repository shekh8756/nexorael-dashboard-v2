import { NextRequest, NextResponse } from "next/server";
import { getTooLostMasterAccessToken } from "@/lib/toolost-master";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PERIODS = [
  "allTime",
  "lastSevenDays",
  "lastThirtyDays",
  "lastMonth",
  "lastThreeMonths",
  "lastSixMonths",
  "lastYear",
] as const;

type AnalyticsPeriod =
  (typeof ALLOWED_PERIODS)[number];

async function getAccessToken() {
  return await getTooLostMasterAccessToken();
}

function numberValue(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function getArray(data: any) {
  if (Array.isArray(data)) {
    return data;
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray(data.data)
  ) {
    return data.data;
  }

  return [];
}

async function fetchTooLost(
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

export async function GET(
  request: NextRequest
) {
  try {
    const accessToken =
  await getAccessToken();

    const searchParams =
      request.nextUrl.searchParams;

    const requestedPeriod =
      searchParams.get("period") ||
      "lastThirtyDays";

    const period =
      ALLOWED_PERIODS.includes(
        requestedPeriod as AnalyticsPeriod
      )
        ? (requestedPeriod as AnalyticsPeriod)
        : "lastThirtyDays";

    /*
     * =====================================================
     * TOO LOST API REQUESTS
     * =====================================================
     *
     * Confirmed from Too Lost docs:
     *
     * GET /sales/overview
     * GET /sales/channels
     * GET /analytics/tracks
     */

    const [
      salesOverviewResult,
      salesChannelsResult,
      analyticsTracksResult,
    ] = await Promise.all([
      fetchTooLost(
        accessToken,
        "sales/overview?page=1&per_page=100"
      ),

      fetchTooLost(
        accessToken,
        "sales/channels?page=1&per_page=100"
      ),

      fetchTooLost(
        accessToken,
        `analytics/tracks?period=${encodeURIComponent(
          period
        )}&page=1&perPage=100`
      ),
    ]);

    /*
     * =====================================================
     * SALES OVERVIEW
     * =====================================================
     */

    const monthlyRevenue =
      salesOverviewResult.ok
        ? getArray(
            salesOverviewResult.data
          )
        : [];

   const normalizedMonthlyRevenue: {
  date: string;
  total: number;
}[] =
  monthlyRevenue.map(
    (item: any) => ({
      date: item?.date || "",
      total: numberValue(
        item?.total
      ),
    })
  );

    const totalRevenue =
  normalizedMonthlyRevenue.reduce(
    (
      sum: number,
      item: {
        date: string;
        total: number;
      }
    ) => sum + item.total,
    0
  );

    /*
     * =====================================================
     * SALES CHANNELS
     * =====================================================
     */

    const channels =
      salesChannelsResult.ok
        ? getArray(
            salesChannelsResult.data
          )
        : [];

    type ChannelAnalytics = {
  name: string;
  total: number;
  logo: string | null;
  logoDark: string | null;
  logoDefault: string | null;
};

const normalizedChannels: ChannelAnalytics[] =
  channels
    .map(
      (item: any): ChannelAnalytics => ({
        name:
          item?.name ||
          "Unknown",

        total:
          numberValue(
            item?.total
          ),

        logo:
          item?.logo ||
          item?.logoDefault ||
          null,

        logoDark:
          item?.logoDark ||
          null,

        logoDefault:
          item?.logoDefault ||
          null,
      })
    )
    .sort(
      (
        a: ChannelAnalytics,
        b: ChannelAnalytics
      ) =>
        b.total - a.total
    );
    
    /*
     * =====================================================
     * ANALYTICS TRACKS
     * =====================================================
     */

    const tracks =
      analyticsTracksResult.ok
        ? getArray(
            analyticsTracksResult.data
          )
        : [];

    const normalizedTracks: {
  isrc: string;
  track: string;
  release: string;
  totalStreams: number;
  totalSaves: number;
  totalSkips: number;
  engagement: number;
}[] =
  tracks.map(
    (item: any) => ({
      isrc: item?.isrc || "",
      track: item?.track || "",
      release: item?.release || "",
      totalStreams: numberValue(
        item?.totalStreams
      ),
      totalSaves: numberValue(
        item?.totalSaves
      ),
      totalSkips: numberValue(
        item?.totalSkips
      ),
      engagement: numberValue(
        item?.engagement
      ),
    })
  );

    const totalStreams =
      normalizedTracks.reduce(
        (sum, item) =>
          sum +
          item.totalStreams,
        0
      );

    const totalSaves =
      normalizedTracks.reduce(
        (sum, item) =>
          sum +
          item.totalSaves,
        0
      );

    const totalSkips =
      normalizedTracks.reduce(
        (sum, item) =>
          sum +
          item.totalSkips,
        0
      );

    const averageEngagement =
      normalizedTracks.length > 0
        ? normalizedTracks.reduce(
            (sum, item) =>
              sum +
              item.engagement,
            0
          ) /
          normalizedTracks.length
        : 0;

    const topTracks =
      [...normalizedTracks]
        .sort(
          (a, b) =>
            b.totalStreams -
            a.totalStreams
        )
        .slice(0, 20);

    /*
     * =====================================================
     * LATEST REVENUE PERIOD
     * =====================================================
     */

    const latestRevenuePeriod =
      normalizedMonthlyRevenue.length > 0
        ? normalizedMonthlyRevenue[0]
        : null;

    /*
     * =====================================================
     * PARTIAL API ERRORS
     * =====================================================
     */

    const apiErrors: any[] = [];

    if (!salesOverviewResult.ok) {
      apiErrors.push({
        endpoint:
          "/sales/overview",

        status:
          salesOverviewResult.status,

        response:
          salesOverviewResult.data,
      });
    }

    if (!salesChannelsResult.ok) {
      apiErrors.push({
        endpoint:
          "/sales/channels",

        status:
          salesChannelsResult.status,

        response:
          salesChannelsResult.data,
      });
    }

    if (!analyticsTracksResult.ok) {
      apiErrors.push({
        endpoint:
          "/analytics/tracks",

        status:
          analyticsTracksResult.status,

        response:
          analyticsTracksResult.data,
      });
    }

    /*
     * =====================================================
     * FINAL RESPONSE
     * =====================================================
     */

    return NextResponse.json({
      success: true,

      period,

      generatedAt:
        new Date().toISOString(),

      summary: {
        totalRevenue,

        latestRevenue:
          latestRevenuePeriod?.total ||
          0,

        latestRevenueMonth:
          latestRevenuePeriod?.date ||
          null,

        totalStreams,

        totalSaves,

        totalSkips,

        averageEngagement,

        totalTracks:
          normalizedTracks.length,

        totalChannels:
          normalizedChannels.length,
      },

      monthlyRevenue:
        normalizedMonthlyRevenue,

      channels:
        normalizedChannels,

      tracks:
        normalizedTracks,

      topTracks,

      apiErrors,
    });
  } catch (error) {
    console.error(
      "Too Lost admin analytics error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to load Too Lost analytics.",
      },
      {
        status: 500,
      }
    );
  }
}