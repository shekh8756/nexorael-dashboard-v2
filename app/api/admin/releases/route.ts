import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

import {
  tooLostApi,
} from "@/lib/toolost";

import {
  getTooLostMasterAccessToken,
} from "@/lib/toolost-master";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * =========================================
 * STATUS NORMALIZER
 * =========================================
 */

function mapTooLostStatus(
  status?: string | null
) {
  const value =
    String(status || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

  switch (value) {
    case "draft":
      return "draft";

    case "in_review":
    case "pending_review":
    case "under_review":
    case "submitted":
    case "processing":
      return "pending";

    case "approved":
      return "approved";

    case "live":
    case "delivered":
      return "live";

    case "rejected":
    case "failed":
      return "rejected";

    case "takedown_pending":
    case "takedown_requested":
      return "takedown_pending";

    case "takedown_complete":
    case "taken_down":
    case "takedown":
      return "takedown";

    default:
      return value || "draft";
  }
}

/*
 * =========================================
 * GET ONE TOO LOST RELEASE
 * =========================================
 */

async function getTooLostRelease(
  accessToken: string,
  releaseId: string | number
) {
  try {
    const {
      response,
      data,
    } =
      await tooLostApi(
        accessToken,
        `/releases/${releaseId}`,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",
          },
        }
      );

    if (!response.ok) {
      console.warn(
        "Too Lost release fetch failed:",
        releaseId,
        response.status
      );

      return null;
    }

    return (
      (data as any)?.data ??
      data
    );
  } catch (error) {
    console.warn(
      "Too Lost release request error:",
      releaseId,
      error
    );

    return null;
  }
}

/*
 * =========================================
 * RUN PROMISES IN CONTROLLED BATCHES
 *
 * Prevents:
 * 100 releases =
 * 100 simultaneous Too Lost requests.
 * =========================================
 */

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  worker: (
    item: T,
    index: number
  ) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];

  for (
    let start = 0;
    start < items.length;
    start += batchSize
  ) {
    const batch =
      items.slice(
        start,
        start + batchSize
      );

    const batchResults =
      await Promise.all(
        batch.map(
          (
            item,
            index
          ) =>
            worker(
              item,
              start + index
            )
        )
      );

    results.push(
      ...batchResults
    );
  }

  return results;
}

/*
 * =========================================
 * OPTIONAL TOO LOST SYNC
 *
 * Runs ONLY when:
 *
 * /api/admin/releases?sync=1
 *
 * Normal dashboard load never waits for it.
 * =========================================
 */

async function syncTooLostStatuses(
  releases: any[]
) {
  if (!releases.length) {
    return releases;
  }

  let accessToken:
    string | null = null;

  try {
    accessToken =
      await getTooLostMasterAccessToken();
  } catch (error) {
    console.warn(
      "Too Lost master token unavailable:",
      error
    );

    return releases;
  }

  if (!accessToken) {
    return releases;
  }

  /*
   * 6 concurrent Too Lost calls at a time.
   * Fast, but not unnecessarily aggressive.
   */

  return await runInBatches(
    releases,
    6,

    async (
      release
    ) => {
      const toolostId =
        release?.toolost_release_id ??
        release?.toolostReleaseId ??
        release?.toolost_id;

      if (!toolostId) {
        return release;
      }

      const toolostRelease =
        await getTooLostRelease(
          accessToken as string,
          toolostId
        );

      if (!toolostRelease) {
        return release;
      }

      const rawToolostStatus =
        toolostRelease?.status ??
        null;

      const syncedStatus =
        mapTooLostStatus(
          rawToolostStatus
        );

      const reviewNote =
        toolostRelease?.review
          ?.note ??
        toolostRelease
          ?.reviewNote ??
        null;

      const currentStatus =
        String(
          release?.status ||
            ""
        );

      /*
       * Only write to Supabase when
       * status actually changed.
       */

      if (
        currentStatus !==
        syncedStatus
      ) {
        const {
          error,
        } =
          await supabaseAdmin
            .from("releases")
            .update({
              status:
                syncedStatus,

              /*
               * Enable these later only
               * if columns definitely exist.
               */

              // toolost_status:
              //   rawToolostStatus,

              // toolost_review_note:
              //   reviewNote,
            })
            .eq(
              "id",
              release.id
            );

        if (error) {
          console.warn(
            "Release status update failed:",
            release.id,
            error.message
          );
        }
      }

      return {
        ...release,

        status:
          syncedStatus,

        toolost_status:
          rawToolostStatus,

        toolost_review_note:
          reviewNote,
      };
    }
  );
}

/*
 * =========================================
 * GET ADMIN RELEASES
 * =========================================
 */

export async function GET(
  request: NextRequest
) {
  try {
    /*
     * =========================================
     * ENVIRONMENT
     * =========================================
     */

    if (
      !process.env
        .NEXT_PUBLIC_SUPABASE_URL
    ) {
      return NextResponse.json(
        {
          success: false,

          step:
            "environment",

          error:
            "NEXT_PUBLIC_SUPABASE_URL is missing",
        },

        {
          status: 500,
        }
      );
    }

    if (
      !process.env
        .SUPABASE_SERVICE_ROLE_KEY
    ) {
      return NextResponse.json(
        {
          success: false,

          step:
            "environment",

          error:
            "SUPABASE_SERVICE_ROLE_KEY is missing",
        },

        {
          status: 500,
        }
      );
    }

    const searchParams =
      request.nextUrl.searchParams;

    /*
     * =========================================
     * IMPORTANT
     *
     * Normal request:
     *
     * /api/admin/releases
     *
     * = FAST Supabase only.
     *
     *
     * Manual sync:
     *
     * /api/admin/releases?sync=1
     *
     * = Supabase + Too Lost sync.
     * =========================================
     */

    const shouldSync =
      searchParams.get(
        "sync"
      ) === "1";

    /*
     * =========================================
     * FETCH SUPABASE DATA IN PARALLEL
     *
     * Previously:
     * releases -> Too Lost -> profiles
     * -> white labels
     *
     * Now these database requests start
     * simultaneously.
     * =========================================
     */

    const [
      releasesResult,
      profilesResult,
      whiteLabelsResult,
    ] =
      await Promise.all([
        supabaseAdmin
          .from("releases")
          .select("*")
          .order(
            "created_at",
            {
              ascending:
                false,
            }
          ),

        supabaseAdmin
          .from("profiles")
          .select("*"),

        supabaseAdmin
          .from(
            "white_labels"
          )
          .select("*"),
      ]);

    /*
     * =========================================
     * RELEASE ERROR
     * =========================================
     */

    if (
      releasesResult.error
    ) {
      return NextResponse.json(
        {
          success: false,

          step:
            "releases_query",

          error:
            releasesResult
              .error.message,

          details:
            releasesResult
              .error,
        },

        {
          status: 500,
        }
      );
    }

    /*
     * =========================================
     * PROFILE ERROR
     * =========================================
     */

    if (
      profilesResult.error
    ) {
      return NextResponse.json(
        {
          success: false,

          step:
            "profiles_query",

          error:
            profilesResult
              .error.message,

          details:
            profilesResult
              .error,
        },

        {
          status: 500,
        }
      );
    }

    /*
     * =========================================
     * WHITE LABEL ERROR
     * =========================================
     */

    if (
      whiteLabelsResult.error
    ) {
      return NextResponse.json(
        {
          success: false,

          step:
            "white_labels_query",

          error:
            whiteLabelsResult
              .error.message,

          details:
            whiteLabelsResult
              .error,
        },

        {
          status: 500,
        }
      );
    }

    let releases =
      releasesResult.data ||
      [];

    const profiles =
      profilesResult.data ||
      [];

    const whiteLabels =
      whiteLabelsResult.data ||
      [];

    /*
     * =========================================
     * OPTIONAL TOO LOST SYNC
     * =========================================
     */

    if (shouldSync) {
      const syncStartedAt =
        Date.now();

      console.log(
        `Starting Too Lost sync for ${releases.length} releases`
      );

      releases =
        await syncTooLostStatuses(
          releases
        );

      console.log(
        "Too Lost sync finished in:",
        `${Date.now() -
          syncStartedAt}ms`
      );
    }

    /*
     * =========================================
     * MAP PROFILES
     * =========================================
     */

    const profileMap =
      new Map<
        string,
        any
      >();

    for (
      const profile
      of profiles
    ) {
      if (profile?.id) {
        profileMap.set(
          String(
            profile.id
          ),
          profile
        );
      }
    }

    /*
     * =========================================
     * MAP WHITE LABELS
     * =========================================
     */

    const whiteLabelMap =
      new Map<
        string,
        any
      >();

    for (
      const label
      of whiteLabels
    ) {
      if (label?.id) {
        whiteLabelMap.set(
          String(
            label.id
          ),
          label
        );
      }
    }

    /*
     * =========================================
     * NORMALIZE RELEASES
     * =========================================
     */

    const normalizedReleases =
      releases.map(
        (
          release: any
        ) => {
          const profile =
            release?.user_id
              ? profileMap.get(
                  String(
                    release
                      .user_id
                  )
                )
              : null;

          const whiteLabel =
            release
              ?.white_label_id
              ? whiteLabelMap.get(
                  String(
                    release
                      .white_label_id
                  )
                )
              : null;

          const artist =
            release
              ?.artist_name ??
            release
              ?.artistName ??
            release
              ?.artist ??
            "Unknown Artist";

          const artwork =
            release
              ?.artwork_url ??
            release
              ?.artworkUrl ??
            release
              ?.cover_url ??
            release
              ?.coverUrl ??
            release
              ?.cover ??
            "";

          const toolostReleaseId =
            release
              ?.toolost_release_id ??
            release
              ?.toolostReleaseId ??
            release
              ?.toolost_id ??
            null;

          return {
            ...release,

            artist_name:
              artist,

            artistName:
              artist,

            artwork_url:
              artwork ||
              null,

            artworkUrl:
              artwork ||
              null,

            cover_url:
              release
                ?.cover_url ??
              artwork ??
              null,

            toolost_release_id:
              toolostReleaseId,

            toolostReleaseId:
              toolostReleaseId,

            user:
              profile
                ? {
                    id:
                      profile.id,

                    name:
                      profile
                        .full_name ??
                      profile
                        .name ??
                      profile
                        .email ??
                      "Unknown User",

                    full_name:
                      profile
                        .full_name ??
                      profile
                        .name ??
                      null,

                    email:
                      profile
                        .email ??
                      null,

                    role:
                      profile
                        .role ??
                      "user",

                    status:
                      profile
                        .status ??
                      "active",
                  }
                : null,

            user_name:
              profile
                ?.full_name ??
              profile
                ?.name ??
              profile
                ?.email ??
              "Unknown User",

            user_email:
              profile
                ?.email ??
              null,

            white_label:
              whiteLabel
                ? {
                    id:
                      whiteLabel.id,

                    name:
                      whiteLabel
                        .name ??
                      whiteLabel
                        .brand_name ??
                      whiteLabel
                        .label_name ??
                      "Unknown Label",

                    brand_name:
                      whiteLabel
                        .brand_name ??
                      null,

                    status:
                      whiteLabel
                        .status ??
                      "active",
                  }
                : null,

            white_label_name:
              whiteLabel
                ?.name ??
              whiteLabel
                ?.brand_name ??
              whiteLabel
                ?.label_name ??
              "Nexorael",
          };
        }
      );

    /*
     * =========================================
     * FILTERS
     * =========================================
     */

    const search =
      searchParams
        .get("search")
        ?.trim() ||
      "";

    const status =
      searchParams
        .get("status")
        ?.trim() ||
      "all";

    const userId =
      searchParams
        .get("userId")
        ?.trim() ||
      "";

    const whiteLabelId =
      searchParams
        .get(
          "whiteLabelId"
        )
        ?.trim() ||
      "";

    let result =
      [
        ...normalizedReleases,
      ];

    if (userId) {
      result =
        result.filter(
          (
            release: any
          ) =>
            String(
              release
                ?.user_id ||
                ""
            ) ===
            userId
        );
    }

    if (whiteLabelId) {
      result =
        result.filter(
          (
            release: any
          ) =>
            String(
              release
                ?.white_label_id ||
                ""
            ) ===
            whiteLabelId
        );
    }

    if (
      status &&
      status !== "all"
    ) {
      const normalizedStatus =
        String(status)
          .toLowerCase()
          .replace(
            /[\s-]+/g,
            "_"
          );

      result =
        result.filter(
          (
            release: any
          ) =>
            String(
              release
                ?.status ||
                ""
            )
              .toLowerCase()
              .replace(
                /[\s-]+/g,
                "_"
              ) ===
            normalizedStatus
        );
    }

    if (search) {
      const query =
        search
          .toLowerCase();

      result =
        result.filter(
          (
            release: any
          ) => {
            const searchable =
              [
                release
                  ?.title,

                release
                  ?.artist_name,

                release
                  ?.artistName,

                release
                  ?.type,

                release
                  ?.upc,

                release
                  ?.isrc,

                release
                  ?.status,

                release
                  ?.label,

                release
                  ?.label_name,

                release
                  ?.toolost_release_id,

                release
                  ?.toolostReleaseId,

                release
                  ?.user_name,

                release
                  ?.user_email,

                release
                  ?.white_label_name,
              ]
                .filter(
                  Boolean
                )
                .join(" ")
                .toLowerCase();

            return (
              searchable.includes(
                query
              )
            );
          }
        );
    }

    /*
     * =========================================
     * STATISTICS
     * =========================================
     */

    const normalizeStatus =
      (
        value:
          unknown
      ) =>
        String(
          value || ""
        )
          .toLowerCase()
          .replace(
            /[\s-]+/g,
            "_"
          );

    const total =
      result.length;

    const draft =
      result.filter(
        (
          release: any
        ) =>
          normalizeStatus(
            release.status
          ) ===
          "draft"
      ).length;

    const pending =
      result.filter(
        (
          release: any
        ) =>
          [
            "pending",
            "pending_review",
            "under_review",
            "submitted",
            "processing",
          ].includes(
            normalizeStatus(
              release.status
            )
          )
      ).length;

    const approved =
      result.filter(
        (
          release: any
        ) =>
          normalizeStatus(
            release.status
          ) ===
          "approved"
      ).length;

    const live =
      result.filter(
        (
          release: any
        ) =>
          [
            "live",
            "delivered",
          ].includes(
            normalizeStatus(
              release.status
            )
          )
      ).length;

    const rejected =
      result.filter(
        (
          release: any
        ) =>
          [
            "rejected",
            "failed",
          ].includes(
            normalizeStatus(
              release.status
            )
          )
      ).length;

    const takedown =
      result.filter(
        (
          release: any
        ) =>
          [
            "takedown",
            "taken_down",
            "takedown_requested",
            "takedown_pending",
          ].includes(
            normalizeStatus(
              release.status
            )
          )
      ).length;

    /*
     * =========================================
     * RESPONSE
     * =========================================
     */

    return NextResponse.json({
      success: true,

      releases:
        result,

      total,

      statistics: {
        total,
        draft,
        pending,
        approved,
        live,
        rejected,
        takedown,
      },

      users:
        profiles,

      whiteLabels,

      /*
       * Lets frontend know whether
       * actual Too Lost sync occurred.
       */
      synced:
        shouldSync,

      generatedAt:
        new Date()
          .toISOString(),
    });
  } catch (error) {
    console.error(
      "ADMIN RELEASE API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        step:
          "admin_releases_api",

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },

      {
        status: 500,
      }
    );
  }
}