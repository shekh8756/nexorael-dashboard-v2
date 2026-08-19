import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TooLostSalesTrack = {
  isrc?: string | null;
  upc?: string | null;

  trackTitle?: string | null;
  track_title?: string | null;
  title?: string | null;

  releaseTitle?: string | null;
  release_title?: string | null;
  release?: string | null;

  artist?: string | null;
  trackArtist?: string | null;
  track_artist?: string | null;

  total?: number | string | null;
  revenue?: number | string | null;
  totalRevenue?: number | string | null;
  total_revenue?: number | string | null;

  units?: number | string | null;
  streams?: number | string | null;
  totalStreams?: number | string | null;
  total_streams?: number | string | null;

  channel?: string | null;
  dsp?: string | null;
  platform?: string | null;

  country?: string | null;
  territory?: string | null;

  share?: number | string | null;
  royaltyShare?: number | string | null;

  [key: string]: any;
};

function normalizeCode(value: unknown) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function toNumber(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

async function getAccessToken() {
  const cookieStore = await cookies();

  return cookieStore.get(
    "toolost_access_token"
  )?.value;
}

function extractArray(data: any): any[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  if (Array.isArray(data.data)) {
    return data.data;
  }

  if (Array.isArray(data.items)) {
    return data.items;
  }

  if (Array.isArray(data.tracks)) {
    return data.tracks;
  }

  if (
    data.data &&
    typeof data.data === "object"
  ) {
    if (Array.isArray(data.data.items)) {
      return data.data.items;
    }

    if (Array.isArray(data.data.tracks)) {
      return data.data.tracks;
    }
  }

  return [];
}

function getTotalPages(data: any) {
  return Number(
    data?.totalPages ??
      data?.total_pages ??
      data?.meta?.totalPages ??
      data?.meta?.total_pages ??
      1
  );
}

async function getTooLostSalesTracks(
  accessToken: string
) {
  /*
   * If Too Lost gives you a different exact Sales Tracks
   * path in your API docs, set:
   *
   * TOOLOST_SALES_TRACKS_PATH=sales/tracks
   *
   * in Vercel.
   */
  const basePath =
    process.env.TOOLOST_SALES_TRACKS_PATH ||
    "sales/tracks";

  const rows: TooLostSalesTrack[] = [];

  let page = 1;
  let totalPages = 1;

  do {
    const separator =
      basePath.includes("?")
        ? "&"
        : "?";

    const path =
      `${basePath}${separator}` +
      `page=${page}&per_page=100`;

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

    if (!response.ok) {
      return {
        success: false as const,
        status: response.status,
        data,
        rows: [],
      };
    }

    rows.push(
      ...extractArray(data)
    );

    totalPages =
      getTotalPages(data);

    page += 1;

    /*
     * Safety guard
     */
    if (page > 100) {
      break;
    }
  } while (
    page <= totalPages
  );

  return {
    success: true as const,
    rows,
  };
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id: userId } =
      await context.params;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "User ID is required.",
        },
        {
          status: 400,
        }
      );
    }

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

    /*
     * =========================================
     * USER PROFILE
     * =========================================
     */

    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        {
          success: false,
          error:
            profileError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error:
            "User not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * =========================================
     * USER RELEASES
     * =========================================
     */

    const {
      data: releases,
      error: releaseError,
    } = await supabaseAdmin
      .from("releases")
      .select("*")
      .eq("user_id", userId);

    if (releaseError) {
      return NextResponse.json(
        {
          success: false,
          error:
            releaseError.message,
        },
        {
          status: 500,
        }
      );
    }

    const userReleases =
      releases || [];

    /*
     * Build ownership map.
     */

    const isrcSet =
      new Set<string>();

    const upcSet =
      new Set<string>();

    for (
      const release
      of userReleases
    ) {
      const releaseISRCs = [
        release.isrc,
        release.track_isrc,
      ];

      for (
        const value
        of releaseISRCs
      ) {
        const code =
          normalizeCode(value);

        if (code) {
          isrcSet.add(code);
        }
      }

      const upc =
        normalizeCode(
          release.upc
        );

      if (upc) {
        upcSet.add(upc);
      }

      /*
       * Some dashboards store tracks
       * as JSON inside release.
       */
      if (
        Array.isArray(
          release.tracks
        )
      ) {
        for (
          const track
          of release.tracks
        ) {
          const isrc =
            normalizeCode(
              track?.isrc
            );

          if (isrc) {
            isrcSet.add(isrc);
          }
        }
      }
    }

    /*
     * =========================================
     * TOO LOST SALES TRACKS
     * =========================================
     */

    const tooLostResult =
      await getTooLostSalesTracks(
        accessToken
      );

    if (!tooLostResult.success) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Unable to load Too Lost track sales.",

          tooLostStatus:
            tooLostResult.status,

          tooLostResponse:
            tooLostResult.data,
        },
        {
          status: 422,
        }
      );
    }

    /*
     * =========================================
     * MATCH SALES TO THIS USER
     * =========================================
     */

    const matchedRows =
      tooLostResult.rows.filter(
        (row) => {
          const isrc =
            normalizeCode(
              row.isrc
            );

          const upc =
            normalizeCode(
              row.upc
            );

          /*
           * ISRC is preferred.
           */
          if (
            isrc &&
            isrcSet.has(isrc)
          ) {
            return true;
          }

          /*
           * UPC fallback.
           */
          if (
            upc &&
            upcSet.has(upc)
          ) {
            return true;
          }

          return false;
        }
      );

    /*
     * =========================================
     * NORMALIZE USER TRACK SALES
     * =========================================
     */

    const tracks =
      matchedRows.map(
        (row) => {
          const revenue =
            toNumber(
              row.total ??
                row.totalRevenue ??
                row.total_revenue ??
                row.revenue
            );

          const streams =
            toNumber(
              row.units ??
                row.streams ??
                row.totalStreams ??
                row.total_streams
            );

          return {
            isrc:
              row.isrc || null,

            upc:
              row.upc || null,

            trackTitle:
              row.trackTitle ??
              row.track_title ??
              row.title ??
              "Untitled",

            releaseTitle:
              row.releaseTitle ??
              row.release_title ??
              row.release ??
              "",

            artist:
              row.trackArtist ??
              row.track_artist ??
              row.artist ??
              "",

            dsp:
              row.channel ??
              row.dsp ??
              row.platform ??
              "Unknown",

            territory:
              row.country ??
              row.territory ??
              "Unknown",

            streams,

            revenue,

            share:
              toNumber(
                row.share ??
                  row.royaltyShare ??
                  100
              ),
          };
        }
      );

    /*
     * =========================================
     * TOTALS
     * =========================================
     */

    const totalRevenue =
      tracks.reduce(
        (
          sum: number,
          track
        ) =>
          sum +
          track.revenue,
        0
      );

    const totalStreams =
      tracks.reduce(
        (
          sum: number,
          track
        ) =>
          sum +
          track.streams,
        0
      );

    /*
     * DSP breakdown
     */

    const dspMap =
      new Map<
        string,
        {
          revenue: number;
          streams: number;
        }
      >();

    for (const track of tracks) {
      const existing =
        dspMap.get(
          track.dsp
        ) || {
          revenue: 0,
          streams: 0,
        };

      existing.revenue +=
        track.revenue;

      existing.streams +=
        track.streams;

      dspMap.set(
        track.dsp,
        existing
      );
    }

    const dsps =
      Array.from(
        dspMap.entries()
      )
        .map(
          ([
            name,
            value,
          ]) => ({
            name,
            revenue:
              value.revenue,
            streams:
              value.streams,
          })
        )
        .sort(
          (a, b) =>
            b.revenue -
            a.revenue
        );

    /*
     * =========================================
     * RESPONSE
     * =========================================
     */

    return NextResponse.json({
      success: true,

      generatedAt:
        new Date().toISOString(),

      user: {
        id:
          profile.id,

        email:
          profile.email,

        legalName:
          profile.legal_name ||
          profile.full_name ||
          null,
      },

      summary: {
        totalRevenue,

        availableBalance:
          totalRevenue,

        pendingBalance: 0,

        totalStreams,

        matchedSalesRows:
          tracks.length,

        releaseCount:
          userReleases.length,
      },

      dsps,

      tracks,
    });
  } catch (error) {
    console.error(
      "User Too Lost revenue error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to load user revenue.",
      },
      {
        status: 500,
      }
    );
  }
}