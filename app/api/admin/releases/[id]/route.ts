import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action =
  | "approve"
  | "reject"
  | "draft"
  | "takedown";

type ReleaseRow = {
  id: string;
  title?: string | null;
  status?: string | null;
  toolost_release_id?: string | number | null;
  upc?: string | null;
  [key: string]: unknown;
};

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Release ID is required",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("releases")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Admin release GET error:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      release: data,
    });
  } catch (error) {
    console.error("Admin release GET exception:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load release",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Release ID is required",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const action = String(
      body?.action || ""
    ).toLowerCase() as Action;

    const allowedActions: Action[] = [
      "approve",
      "reject",
      "draft",
      "takedown",
    ];

    if (!allowedActions.includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid action. Allowed: approve, reject, draft, takedown",
        },
        { status: 400 }
      );
    }

    /*
     * First get the release from our database.
     */
    const { data: releaseData, error: releaseError } =
      await supabaseAdmin
        .from("releases")
        .select("*")
        .eq("id", id)
        .single();

    if (releaseError || !releaseData) {
      return NextResponse.json(
        {
          success: false,
          error:
            releaseError?.message ||
            "Release not found",
        },
        { status: 404 }
      );
    }

    const release =
      releaseData as ReleaseRow;

    /*
     * Map Admin action to local status.
     */
    let newStatus: string;

    switch (action) {
      case "approve":
        newStatus = "approved";
        break;

      case "reject":
        newStatus = "rejected";
        break;

      case "draft":
        newStatus = "draft";
        break;

      case "takedown":
        newStatus = "takedown";
        break;
    }

    /*
     * Keep a record of the previous status.
     */
    const previousStatus =
      release.status || "unknown";

    /*
     * If this release has a Too Lost release ID,
     * try to synchronize the action with Too Lost.
     *
     * IMPORTANT:
     * We only attempt the Too Lost call when the
     * required OAuth token is available.
     */
    let tooLostResult: unknown = null;
    let tooLostAttempted = false;
    let tooLostSuccess = false;

    const toolostReleaseId =
      release.toolost_release_id;

    const accessToken =
      request.cookies.get(
        "toolost_access_token"
      )?.value;

    if (
      toolostReleaseId &&
      accessToken &&
      (action === "approve" ||
        action === "takedown")
    ) {
      tooLostAttempted = true;

      try {
        /*
         * Too Lost release-level endpoint.
         *
         * We intentionally keep the local database
         * update separate so that a failed external
         * request does not silently destroy local data.
         */
        const result = await tooLostApi(
          accessToken,
          `/releases/${toolostReleaseId}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              Accept:
                "application/json",
            },
            body: JSON.stringify({
              status: newStatus,
            }),
          }
        );

        tooLostResult = result.data;
        tooLostSuccess =
          result.response.ok;

        console.log(
          "Too Lost release action:",
          {
            releaseId: toolostReleaseId,
            action,
            status:
              result.response.status,
            data: result.data,
          }
        );
      } catch (error) {
        console.error(
          "Too Lost release action failed:",
          error
        );

        tooLostResult = {
          error:
            error instanceof Error
              ? error.message
              : "Too Lost request failed",
        };
      }
    }

    /*
     * Update our local Supabase release status.
     */
    const updateData: Record<
      string,
      unknown
    > = {
      status: newStatus,
      updated_at:
        new Date().toISOString(),
    };

    /*
     * Save action information when the
     * corresponding columns exist.
     *
     * The first update only uses standard
     * columns so the API remains compatible
     * with the current releases table.
     */
    const { data: updatedRelease, error: updateError } =
      await supabaseAdmin
        .from("releases")
        .update(updateData)
        .eq("id", id)
        .select("*")
        .single();

    if (updateError) {
      console.error(
        "Admin release status update error:",
        updateError
      );

      return NextResponse.json(
        {
          success: false,
          error: updateError.message,
          previousStatus,
          newStatus,
          tooLostAttempted,
          tooLostSuccess,
          tooLostResult,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,

      message:
        `Release ${action} action completed.`,

      release: updatedRelease,

      previousStatus,

      newStatus,

      tooLost: {
        attempted: tooLostAttempted,
        success: tooLostSuccess,
        releaseId:
          toolostReleaseId || null,
        response: tooLostResult,
      },
    });
  } catch (error) {
    console.error(
      "Admin release PATCH exception:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update release",
      },
      { status: 500 }
    );
  }
}