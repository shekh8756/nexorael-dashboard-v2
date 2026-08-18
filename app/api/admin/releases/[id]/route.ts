import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action =
  | "approve"
  | "reject"
  | "draft"
  | "takedown"
  | "submit";

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

    if (error || !data) {
      return NextResponse.json(
        {
          success: false,
          error: error?.message || "Release not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      release: data,
    });
  } catch (error) {
    console.error("Admin release GET error:", error);

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
      "submit",
    ];

    if (!allowedActions.includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid action. Allowed: approve, reject, draft, takedown, submit",
        },
        { status: 400 }
      );
    }

    /*
     * Get release
     */

    const { data: release, error: releaseError } =
      await supabaseAdmin
        .from("releases")
        .select("*")
        .eq("id", id)
        .single();

    if (releaseError || !release) {
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

    const currentRelease =
      release as ReleaseRow;

    const currentStatus = String(
      currentRelease.status || ""
    ).toLowerCase();

    /*
     * Admin note
     */

    const note =
      typeof body?.note === "string"
        ? body.note.trim()
        : "";

    /*
     * =====================================================
     * SUBMIT TO TOO LOST
     * =====================================================
     */

    if (action === "submit") {
      /*
       * Only draft releases can be submitted
       */

      if (currentStatus !== "draft") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Only draft releases can be submitted.",
            currentStatus,
          },
          { status: 400 }
        );
      }

      /*
       * Too Lost release ID is required
       */

      const toolostReleaseId =
        currentRelease.toolost_release_id;

      if (!toolostReleaseId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This release does not have a Too Lost release ID.",
            releaseId: id,
          },
          { status: 400 }
        );
      }

      /*
       * Get Too Lost OAuth token
       */

      const cookieStore = await cookies();

      const accessToken =
        cookieStore.get(
          "toolost_access_token"
        )?.value;

      if (!accessToken) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Too Lost is not connected. Please connect Too Lost first.",
          },
          { status: 401 }
        );
      }

      console.log(
        "Admin submitting release to Too Lost:",
        {
          localReleaseId: id,
          toolostReleaseId,
        }
      );

      /*
       * Call Too Lost
       */

      const result = await tooLostApi(
        String(accessToken),
        `/releases/${toolostReleaseId}/submit`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      console.log(
        "Too Lost submit status:",
        result.response.status
      );

      console.log(
        "Too Lost submit response:",
        result.data
      );

      /*
       * Do NOT change our database if Too Lost rejected it.
       */

      if (!result.response.ok) {
        return NextResponse.json(
          {
            success: false,
            action: "submit",
            status: result.response.status,
            error:
              typeof result.data === "object" &&
              result.data !== null &&
              "message" in result.data
                ? String(
                    (
                      result.data as {
                        message?: unknown;
                      }
                    ).message || "Too Lost rejected submission."
                  )
                : "Too Lost rejected submission.",
            tooLostResponse:
              result.data,
          },
          {
            status:
              result.response.status >= 400
                ? result.response.status
                : 502,
          }
        );
      }

      /*
       * Too Lost accepted the submission.
       *
       * Now update our database.
       */

      const updateData: Record<
        string,
        unknown
      > = {
        status: "pending",
      };

      if (note) {
        updateData.admin_note = note;
      }

      let {
        data: updatedRelease,
        error: updateError,
      } = await supabaseAdmin
        .from("releases")
        .update(updateData)
        .eq("id", id)
        .select("*")
        .single();

      /*
       * Retry if admin_note column doesn't exist
       */

      if (
        updateError &&
        note &&
        updateError.message
          .toLowerCase()
          .includes("admin_note")
      ) {
        delete updateData.admin_note;

        const retry =
          await supabaseAdmin
            .from("releases")
            .update(updateData)
            .eq("id", id)
            .select("*")
            .single();

        updatedRelease = retry.data;
        updateError = retry.error;
      }

      if (updateError) {
        console.error(
          "Database update after Too Lost submission failed:",
          updateError
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "Too Lost accepted the release, but our database status could not be updated.",
            databaseError:
              updateError.message,
            tooLostResponse:
              result.data,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        action: "submit",
        previousStatus: currentStatus,
        newStatus: "pending",
        release: updatedRelease,
        toolostReleaseId,
        tooLostResponse:
          result.data,
        message:
          "Release successfully submitted to Too Lost and moved to Pending Review.",
      });
    }

    /*
     * =====================================================
     * OTHER ADMIN ACTIONS
     * =====================================================
     */

    let newStatus: string;

    switch (action) {
      case "draft":
        newStatus = "draft";
        break;

      case "approve":
        newStatus = "approved";
        break;

      case "reject":
        newStatus = "rejected";
        break;

      case "takedown":
        newStatus = "takedown";
        break;

      default:
        newStatus =
          currentRelease.status || "draft";
    }

    /*
     * Require reason for rejection
     */

    if (action === "reject" && !note) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please provide a rejection reason.",
        },
        { status: 400 }
      );
    }

    /*
     * Require reason for takedown
     */

    if (action === "takedown" && !note) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please provide a takedown reason.",
        },
        { status: 400 }
      );
    }

    const updateData: Record<
      string,
      unknown
    > = {
      status: newStatus,
    };

    if (note) {
      updateData.admin_note = note;
    }

    let {
      data: updatedRelease,
      error: updateError,
    } = await supabaseAdmin
      .from("releases")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    /*
     * Retry without admin_note if column doesn't exist
     */

    if (
      updateError &&
      note &&
      updateError.message
        .toLowerCase()
        .includes("admin_note")
    ) {
      delete updateData.admin_note;

      const retry =
        await supabaseAdmin
          .from("releases")
          .update(updateData)
          .eq("id", id)
          .select("*")
          .single();

      updatedRelease = retry.data;
      updateError = retry.error;
    }

    if (updateError) {
      console.error(
        "Release update error:",
        updateError
      );

      return NextResponse.json(
        {
          success: false,
          error: updateError.message,
          action,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      action,
      previousStatus: currentStatus,
      newStatus,
      release: updatedRelease,
      toolostReleaseId:
        currentRelease.toolost_release_id ||
        null,
      message:
        `Release ${action} action completed successfully.`,
    });
  } catch (error) {
    console.error(
      "Admin release action error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process release action",
      },
      { status: 500 }
    );
  }
}