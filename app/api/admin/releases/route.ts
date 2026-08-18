import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getArtist(release: any) {
  return (
    release?.artist_name ||
    release?.artistName ||
    release?.artist ||
    "Unknown Artist"
  );
}

function getArtwork(release: any) {
  return (
    release?.artwork_url ||
    release?.artworkUrl ||
    release?.cover_url ||
    release?.coverUrl ||
    release?.cover ||
    ""
  );
}

function getToolostId(release: any) {
  return (
    release?.toolost_release_id ||
    release?.toolostReleaseId ||
    release?.toolost_id ||
    null
  );
}

function normalizeStatus(status: unknown) {
  return String(status || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export async function GET(request: NextRequest) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. AUTHENTICATION
     * ---------------------------------------------------------
     */

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. QUERY PARAMETERS
     * ---------------------------------------------------------
     */

    const { searchParams } =
      new URL(request.url);

    const search =
      searchParams.get("search")?.trim() || "";

    const status =
      searchParams.get("status")?.trim() || "all";

    const userId =
      searchParams.get("userId")?.trim() || "";

    const whiteLabelId =
      searchParams
        .get("whiteLabelId")
        ?.trim() || "";

    /*
     * ---------------------------------------------------------
     * 3. GET RELEASES
     * ---------------------------------------------------------
     */

    const {
      data: releases,
      error: releasesError,
    } = await supabase
      .from("releases")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (releasesError) {
      console.error(
        "Admin releases database error:",
        releasesError
      );

      return NextResponse.json(
        {
          success: false,
          error: releasesError.message,
        },
        { status: 500 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. GET USERS / PROFILES
     * ---------------------------------------------------------
     */

    const {
      data: profiles,
      error: profilesError,
    } = await supabase
      .from("profiles")
      .select("*");

    if (profilesError) {
      console.error(
        "Admin profiles database error:",
        profilesError
      );

      return NextResponse.json(
        {
          success: false,
          error: profilesError.message,
        },
        { status: 500 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 5. GET WHITE LABELS
     * ---------------------------------------------------------
     */

    const {
      data: whiteLabels,
      error: whiteLabelsError,
    } = await supabase
      .from("white_labels")
      .select("*");

    if (whiteLabelsError) {
      console.error(
        "Admin white labels database error:",
        whiteLabelsError
      );

      return NextResponse.json(
        {
          success: false,
          error: whiteLabelsError.message,
        },
        { status: 500 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 6. CREATE LOOKUP MAPS
     * ---------------------------------------------------------
     */

    const profileMap =
      new Map<string, any>();

    for (const profile of profiles || []) {
      if (profile?.id) {
        profileMap.set(
          String(profile.id),
          profile
        );
      }
    }

    const whiteLabelMap =
      new Map<string, any>();

    for (const label of whiteLabels || []) {
      if (label?.id) {
        whiteLabelMap.set(
          String(label.id),
          label
        );
      }
    }

    /*
     * ---------------------------------------------------------
     * 7. NORMALIZE RELEASE DATA
     * ---------------------------------------------------------
     */

    let result = (releases || []).map(
      (release: any) => {
        const profile =
          release?.user_id
            ? profileMap.get(
                String(release.user_id)
              )
            : null;

        const whiteLabel =
          release?.white_label_id
            ? whiteLabelMap.get(
                String(
                  release.white_label_id
                )
              )
            : null;

        const artist =
          getArtist(release);

        const artwork =
          getArtwork(release);

        const toolostReleaseId =
          getToolostId(release);

        return {
          ...release,

          /*
           * Artist
           */
          artist_name:
            release?.artist_name ||
            release?.artistName ||
            artist,

          artistName:
            release?.artistName ||
            release?.artist_name ||
            artist,

          /*
           * Artwork
           */
          artwork_url:
            artwork || null,

          artworkUrl:
            artwork || null,

          cover_url:
            release?.cover_url ||
            artwork ||
            null,

          /*
           * Too Lost
           */
          toolost_release_id:
            toolostReleaseId,

          toolostReleaseId:
            toolostReleaseId,

          /*
           * User
           */
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
                  profile.email ||
                  null,

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
            profile?.email ||
            null,

          /*
           * White Label
           */
          white_label:
            whiteLabel
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

          /*
           * Normalized status
           */
          normalized_status:
            normalizeStatus(
              release?.status
            ),
        };
      }
    );

    /*
     * ---------------------------------------------------------
     * 8. FILTER BY USER
     * ---------------------------------------------------------
     */

    if (userId) {
      result = result.filter(
        (release: any) =>
          String(
            release?.user_id || ""
          ) === userId
      );
    }

    /*
     * ---------------------------------------------------------
     * 9. FILTER BY WHITE LABEL
     * ---------------------------------------------------------
     */

    if (whiteLabelId) {
      result = result.filter(
        (release: any) =>
          String(
            release?.white_label_id || ""
          ) === whiteLabelId
      );
    }

    /*
     * ---------------------------------------------------------
     * 10. FILTER BY STATUS
     * ---------------------------------------------------------
     */

    if (
      status &&
      status !== "all"
    ) {
      const normalizedFilter =
        normalizeStatus(status);

      result = result.filter(
        (release: any) =>
          normalizeStatus(
            release?.status
          ) === normalizedFilter
      );
    }

    /*
     * ---------------------------------------------------------
     * 11. SEARCH
     * ---------------------------------------------------------
     */

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

            release?.labelName,

            release?.toolost_release_id,

            release?.toolostReleaseId,

            release?.user_name,

            release?.user_email,

            release?.white_label_name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchable.includes(
            query
          );
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 12. RELEASE STATISTICS
     * ---------------------------------------------------------
     */

    const total =
      result.length;

    const draft =
      result.filter(
        (release: any) =>
          normalizeStatus(
            release.status
          ) === "draft"
      ).length;

    const pending =
      result.filter(
        (release: any) => {
          const current =
            normalizeStatus(
              release.status
            );

          return [
            "pending",
            "pending_review",
            "under_review",
            "submitted",
            "processing",
          ].includes(current);
        }
      ).length;

    const approved =
      result.filter(
        (release: any) =>
          normalizeStatus(
            release.status
          ) === "approved"
      ).length;

    const live =
      result.filter(
        (release: any) => {
          const current =
            normalizeStatus(
              release.status
            );

          return [
            "live",
            "delivered",
          ].includes(current);
        }
      ).length;

    const rejected =
      result.filter(
        (release: any) => {
          const current =
            normalizeStatus(
              release.status
            );

          return [
            "rejected",
            "failed",
          ].includes(current);
        }
      ).length;

    const takedown =
      result.filter(
        (release: any) => {
          const current =
            normalizeStatus(
              release.status
            );

          return [
            "takedown",
            "taken_down",
            "takedown_requested",
          ].includes(current);
        }
      ).length;

    /*
     * ---------------------------------------------------------
     * 13. RESPONSE
     * ---------------------------------------------------------
     */

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

      users: profiles || [],

      whiteLabels:
        whiteLabels || [],

      filters: {
        search,
        status,
        userId,
        whiteLabelId,
      },

      generatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Admin releases API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Failed to load admin releases",
      },
      { status: 500 }
    );
  }
}