import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAccessToken() {
  const cookieStore = await cookies();

  return cookieStore.get(
    "toolost_access_token"
  )?.value;
}

function mapTooLostStatus(
  status?: string | null
) {
  const value = String(
    status || ""
  ).toLowerCase();

  switch (value) {
    case "draft":
      return "draft";

    case "in_review":
      return "pending";

    case "live":
      return "live";

    case "takedown_pending":
      return "takedown_pending";

    case "takedown_complete":
      return "takedown";

    default:
      return value || "draft";
  }
}

async function getTooLostRelease(
  accessToken: string,
  releaseId: string | number
) {
  const {
    response,
    data,
  } = await tooLostApi(
    accessToken,
    `releases/${releaseId}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
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

  return (data as any)?.data || data;
}

export async function GET(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          step: "environment",
          error: "NEXT_PUBLIC_SUPABASE_URL is missing",
        },
        { status: 500 }
      );
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          success: false,
          step: "environment",
          error: "SUPABASE_SERVICE_ROLE_KEY is missing",
        },
        { status: 500 }
      );
    }

    console.log("=================================");
    console.log("ADMIN RELEASE API");
    console.log("Supabase URL:", url);
    console.log("Service key exists:", true);
    console.log("=================================");

    // ---------------------------------------------
    // STEP 1: TEST SUPABASE CONNECTION
    // ---------------------------------------------

    let releases;

    try {
      const result = await supabaseAdmin
        .from("releases")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

      console.log("RELEASE QUERY RESULT:", result);

      if (result.error) {
        return NextResponse.json(
          {
            success: false,
            step: "releases_query",
            error: result.error.message,
            details: result.error,
          },
          { status: 500 }
        );
      }

      releases = result.data || [];
// ---------------------------------------------
// STEP 1B: SYNC TOO LOST STATUS
// ---------------------------------------------

try {
  const accessToken =
    await getAccessToken();

  if (accessToken) {
    const syncedReleases = [];

    for (const release of releases) {
      const toolostId =
        release?.toolost_release_id ||
        release?.toolostReleaseId ||
        release?.toolost_id;

      if (!toolostId) {
        syncedReleases.push(
          release
        );

        continue;
      }

      try {
        const toolostRelease =
          await getTooLostRelease(
            accessToken,
            toolostId
          );

        if (!toolostRelease) {
          syncedReleases.push(
            release
          );

          continue;
        }

        const rawToolostStatus =
          toolostRelease?.status ||
          null;

        const syncedStatus =
          mapTooLostStatus(
            rawToolostStatus
          );

        const reviewNote =
          toolostRelease?.review
            ?.note ||
          null;

        const updatedRelease = {
          ...release,

          status:
            syncedStatus,

          toolost_status:
            rawToolostStatus,

          toolost_review_note:
            reviewNote,
        };

        /*
         * Persist latest Too Lost status
         * back to Supabase.
         */
        const updatePayload: any = {
          status:
            syncedStatus,
        };

        /*
         * Only include these columns if
         * they exist in your table.
         *
         * If they don't exist yet,
         * don't include them.
         */
        // updatePayload.toolost_status =
        //   rawToolostStatus;
        //
        // updatePayload.toolost_review_note =
        //   reviewNote;

        const {
          error: updateError,
        } = await supabaseAdmin
          .from("releases")
          .update(
            updatePayload
          )
          .eq(
            "id",
            release.id
          );

        if (updateError) {
          console.warn(
            "Too Lost status DB update failed:",
            release.id,
            updateError.message
          );
        }

        syncedReleases.push(
          updatedRelease
        );
      } catch (syncError) {
        console.warn(
          "Too Lost sync error:",
          toolostId,
          syncError
        );

        syncedReleases.push(
          release
        );
      }
    }

    releases = syncedReleases;
  } else {
    console.warn(
      "Too Lost access token unavailable. Using Supabase status."
    );
  }
} catch (syncError) {
  console.warn(
    "Too Lost status sync failed:",
    syncError
  );
}

    } catch (error) {
      console.error("RELEASE FETCH FAILED:", error);

      return NextResponse.json(
        {
          success: false,
          step: "releases_fetch",
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------
    // STEP 2: PROFILES
    // ---------------------------------------------

    let profiles: any[] = [];

    try {
      const result = await supabaseAdmin
        .from("profiles")
        .select("*");

      console.log("PROFILE QUERY RESULT:", result);

      if (result.error) {
        return NextResponse.json(
          {
            success: false,
            step: "profiles_query",
            error: result.error.message,
            details: result.error,
          },
          { status: 500 }
        );
      }

      profiles = result.data || [];
    } catch (error) {
      console.error("PROFILE FETCH FAILED:", error);

      return NextResponse.json(
        {
          success: false,
          step: "profiles_fetch",
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------
    // STEP 3: WHITE LABELS
    // ---------------------------------------------

    let whiteLabels: any[] = [];

    try {
      const result = await supabaseAdmin
        .from("white_labels")
        .select("*");

      console.log("WHITE LABEL QUERY RESULT:", result);

      if (result.error) {
        return NextResponse.json(
          {
            success: false,
            step: "white_labels_query",
            error: result.error.message,
            details: result.error,
          },
          { status: 500 }
        );
      }

      whiteLabels = result.data || [];
    } catch (error) {
      console.error("WHITE LABEL FETCH FAILED:", error);

      return NextResponse.json(
        {
          success: false,
          step: "white_labels_fetch",
          error:
            error instanceof Error
              ? error.message
              : String(error),
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------
    // NORMALIZE DATA
    // ---------------------------------------------

    const profileMap = new Map<string, any>();

    for (const profile of profiles) {
      if (profile?.id) {
        profileMap.set(
          String(profile.id),
          profile
        );
      }
    }

    const whiteLabelMap = new Map<string, any>();

    for (const label of whiteLabels) {
      if (label?.id) {
        whiteLabelMap.set(
          String(label.id),
          label
        );
      }
    }

    const normalizedReleases = releases.map(
      (release: any) => {
        const profile = release?.user_id
          ? profileMap.get(
              String(release.user_id)
            )
          : null;

        const whiteLabel =
          release?.white_label_id
            ? whiteLabelMap.get(
                String(release.white_label_id)
              )
            : null;

        const artist =
          release?.artist_name ||
          release?.artistName ||
          release?.artist ||
          "Unknown Artist";

        const artwork =
          release?.artwork_url ||
          release?.artworkUrl ||
          release?.cover_url ||
          release?.coverUrl ||
          release?.cover ||
          "";

        const toolostReleaseId =
          release?.toolost_release_id ||
          release?.toolostReleaseId ||
          release?.toolost_id ||
          null;

        return {
          ...release,

          artist_name: artist,
          artistName: artist,

          artwork_url:
            artwork || null,

          artworkUrl:
            artwork || null,

          cover_url:
            release?.cover_url ||
            artwork ||
            null,

          toolost_release_id:
            toolostReleaseId,

          toolostReleaseId:
            toolostReleaseId,

          user: profile
            ? {
                id: profile.id,

                name:
                  profile.full_name ||
                  profile.name ||
                  profile.email ||
                  "Unknown User",

                full_name:
                  profile.full_name ||
                  profile.name ||
                  null,

                email:
                  profile.email || null,

                role:
                  profile.role ||
                  "user",

                status:
                  profile.status ||
                  "active",
              }
            : null,

          user_name:
            profile?.full_name ||
            profile?.name ||
            profile?.email ||
            "Unknown User",

          user_email:
            profile?.email || null,

          white_label: whiteLabel
            ? {
                id: whiteLabel.id,

                name:
                  whiteLabel.name ||
                  whiteLabel.brand_name ||
                  whiteLabel.label_name ||
                  "Unknown Label",

                brand_name:
                  whiteLabel.brand_name ||
                  null,

                status:
                  whiteLabel.status ||
                  "active",
              }
            : null,

          white_label_name:
            whiteLabel?.name ||
            whiteLabel?.brand_name ||
            whiteLabel?.label_name ||
            "Nexorael",
        };
      }
    );

    // ---------------------------------------------
    // FILTERS
    // ---------------------------------------------

    const { searchParams } =
      new URL(request.url);

    const search =
      searchParams.get("search")?.trim() || "";

    const status =
      searchParams.get("status")?.trim() || "all";

    const userId =
      searchParams.get("userId")?.trim() || "";

    const whiteLabelId =
      searchParams.get("whiteLabelId")?.trim() || "";

    let result = [...normalizedReleases];

    if (userId) {
      result = result.filter(
        (release: any) =>
          String(
            release?.user_id || ""
          ) === userId
      );
    }

    if (whiteLabelId) {
      result = result.filter(
        (release: any) =>
          String(
            release?.white_label_id || ""
          ) === whiteLabelId
      );
    }

    if (
      status &&
      status !== "all"
    ) {
      const normalizedStatus =
        String(status)
          .toLowerCase()
          .replace(/[\s-]+/g, "_");

      result = result.filter(
        (release: any) =>
          String(
            release?.status || ""
          )
            .toLowerCase()
            .replace(/[\s-]+/g, "_") ===
          normalizedStatus
      );
    }

    if (search) {
      const query =
        search.toLowerCase();

      result = result.filter(
        (release: any) => {
          const searchable = [
            release?.title,
            release?.artist_name,
            release?.artistName,
            release?.type,
            release?.upc,
            release?.isrc,
            release?.status,
            release?.label,
            release?.label_name,
            release?.toolost_release_id,
            release?.toolostReleaseId,
            release?.user_name,
            release?.user_email,
            release?.white_label_name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchable.includes(query);
        }
      );
    }

    // ---------------------------------------------
    // STATISTICS
    // ---------------------------------------------

    const normalizeStatus = (
      value: unknown
    ) =>
      String(value || "")
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

    const total = result.length;

    const draft = result.filter(
      (release: any) =>
        normalizeStatus(
          release.status
        ) === "draft"
    ).length;

    const pending = result.filter(
      (release: any) =>
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

    const approved = result.filter(
      (release: any) =>
        normalizeStatus(
          release.status
        ) === "approved"
    ).length;

    const live = result.filter(
      (release: any) =>
        [
          "live",
          "delivered",
        ].includes(
          normalizeStatus(
            release.status
          )
        )
    ).length;

    const rejected = result.filter(
      (release: any) =>
        [
          "rejected",
          "failed",
        ].includes(
          normalizeStatus(
            release.status
          )
        )
    ).length;

    const takedown = result.filter(
      (release: any) =>
        [
          "takedown",
          "taken_down",
          "takedown_requested",
        ].includes(
          normalizeStatus(
            release.status
          )
        )
    ).length;

    // ---------------------------------------------
    // SUCCESS
    // ---------------------------------------------

    return NextResponse.json({
      success: true,

      releases: result,

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

      users: profiles,

      whiteLabels,

      generatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "ADMIN RELEASE API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        step: "admin_releases_api",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}