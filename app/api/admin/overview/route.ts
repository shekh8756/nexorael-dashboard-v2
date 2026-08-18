import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
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

    // ---------------------------------------------------------
    // RELEASES
    // ---------------------------------------------------------

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
        "Admin releases error:",
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

    // ---------------------------------------------------------
    // PROFILES / USERS
    // ---------------------------------------------------------

    const {
      data: profiles,
      error: profilesError,
    } = await supabase
      .from("profiles")
      .select("*");

    if (profilesError) {
      console.error(
        "Admin profiles error:",
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

    // ---------------------------------------------------------
    // WHITE LABELS
    // ---------------------------------------------------------

    const {
      data: whiteLabels,
      error: whiteLabelsError,
    } = await supabase
      .from("white_labels")
      .select("*");

    if (whiteLabelsError) {
      console.error(
        "Admin white labels error:",
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

    // ---------------------------------------------------------
    // NORMALIZE STATUS
    // ---------------------------------------------------------

    function normalizeStatus(
      value: unknown
    ): string {
      return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");
    }

    const releaseList = releases || [];
    const userList = profiles || [];
    const whiteLabelList = whiteLabels || [];

    // ---------------------------------------------------------
    // ARTISTS
    // ---------------------------------------------------------

    const artistNames =
      new Set<string>();

    for (const release of releaseList) {
      const artist =
        release?.artist_name ||
        release?.artistName ||
        release?.artist;

      if (artist) {
        const name =
          String(artist).trim();

        if (name) {
          artistNames.add(name);
        }
      }
    }

    // ---------------------------------------------------------
    // RELEASE STATISTICS
    // ---------------------------------------------------------

    const totalReleases =
      releaseList.length;

    const draftReleases =
      releaseList.filter((release) => {
        const status =
          normalizeStatus(
            release.status
          );

        return (
          status === "draft" ||
          status === "incomplete"
        );
      }).length;

    const pendingReview =
      releaseList.filter((release) => {
        const status =
          normalizeStatus(
            release.status
          );

        return (
          status === "pending" ||
          status === "pending_review" ||
          status === "under_review" ||
          status === "review" ||
          status === "processing"
        );
      }).length;

    const approvedReleases =
      releaseList.filter((release) => {
        return (
          normalizeStatus(
            release.status
          ) === "approved"
        );
      }).length;

    const liveReleases =
      releaseList.filter((release) => {
        const status =
          normalizeStatus(
            release.status
          );

        return (
          status === "live" ||
          status === "delivered"
        );
      }).length;

    const rejectedReleases =
      releaseList.filter((release) => {
        const status =
          normalizeStatus(
            release.status
          );

        return (
          status === "rejected" ||
          status === "reject"
        );
      }).length;

    const takedownReleases =
      releaseList.filter((release) => {
        const status =
          normalizeStatus(
            release.status
          );

        return (
          status === "takedown" ||
          status === "taken_down" ||
          status === "takedown_requested"
        );
      }).length;

    // ---------------------------------------------------------
    // USER STATISTICS
    // ---------------------------------------------------------

    const totalUsers =
      userList.length;

    const activeUsers =
      userList.filter(
        (user) =>
          String(
            user?.status || ""
          ).toLowerCase() ===
          "active"
      ).length;

    const suspendedUsers =
      userList.filter(
        (user) =>
          String(
            user?.status || ""
          ).toLowerCase() ===
          "suspended"
      ).length;

    // ---------------------------------------------------------
    // WHITE LABEL STATISTICS
    // ---------------------------------------------------------

    const totalWhiteLabels =
      whiteLabelList.length;

    const activeWhiteLabels =
      whiteLabelList.filter(
        (label) => {
          const status =
            String(
              label?.status ||
                "active"
            ).toLowerCase();

          return status ===
            "active";
        }
      ).length;

    // ---------------------------------------------------------
    // STATUS BREAKDOWN
    // ---------------------------------------------------------

    const statusMap =
      new Map<string, number>();

    for (const release of releaseList) {
      const status =
        normalizeStatus(
          release.status
        ) || "unknown";

      statusMap.set(
        status,
        (statusMap.get(status) ||
          0) + 1
      );
    }

    const releasesByStatus =
      Array.from(
        statusMap.entries()
      )
        .map(
          ([status, count]) => ({
            status,
            count,
          })
        )
        .sort(
          (a, b) =>
            b.count - a.count
        );

    // ---------------------------------------------------------
    // LABEL BREAKDOWN
    // ---------------------------------------------------------

    const labelMap =
      new Map<string, number>();

    for (const release of releaseList) {
      const label =
        release?.label_name ||
        release?.labelName ||
        release?.label ||
        "Unknown";

      const labelName =
        String(label).trim() ||
        "Unknown";

      labelMap.set(
        labelName,
        (labelMap.get(
          labelName
        ) || 0) + 1
      );
    }

    const releasesByLabel =
      Array.from(
        labelMap.entries()
      )
        .map(
          ([label, count]) => ({
            label,
            count,
          })
        )
        .sort(
          (a, b) =>
            b.count - a.count
        );

    // ---------------------------------------------------------
    // RECENT RELEASES
    // ---------------------------------------------------------

    const recentReleases =
      releaseList
        .slice(0, 20)
        .map((release) => {
          const profile =
            userList.find(
              (profile) =>
                profile.id ===
                release.user_id
            );

          const whiteLabel =
            whiteLabelList.find(
              (label) =>
                label.id ===
                release.white_label_id
            );

          return {
            ...release,

            uploaded_by:
              profile?.full_name ||
              profile?.name ||
              profile?.email ||
              "Unknown",

            uploaded_by_email:
              profile?.email ||
              null,

            white_label_name:
              whiteLabel?.name ||
              whiteLabel?.brand_name ||
              "Nexorael",
          };
        });

    // ---------------------------------------------------------
    // RESPONSE
    // ---------------------------------------------------------

    return NextResponse.json({
      success: true,

      generatedAt:
        new Date().toISOString(),

      stats: {
        totalReleases,

        draftReleases,

        pendingReview,

        approvedReleases,

        liveReleases,

        rejectedReleases,

        takedownReleases,

        totalUsers,

        activeUsers,

        suspendedUsers,

        totalWhiteLabels,

        activeWhiteLabels,

        totalArtists:
          artistNames.size,
      },

      releasesByStatus,

      releasesByLabel,

      recentReleases,

      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
      },

      whiteLabels: {
        total: totalWhiteLabels,
        active:
          activeWhiteLabels,
      },

      artists: {
        total:
          artistNames.size,

        names:
          Array.from(
            artistNames
          ).sort(),
      },
    });
  } catch (error) {
    console.error(
      "Admin overview error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load admin overview",
      },
      { status: 500 }
    );
  }
}