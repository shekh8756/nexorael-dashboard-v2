import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
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

    const action = String(body.action || "").toLowerCase() as Action;

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
     * Get current release
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

    /*
     * Optional admin note
     */
    const note =
      typeof body.note === "string"
        ? body.note.trim()
        : "";

    /*
     * Map admin actions to database status
     */
    let newStatus: string;

    switch (action) {
      case "draft":
        newStatus = "draft";
        break;

      case "submit":
        newStatus = "pending";
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
        newStatus = currentRelease.status || "draft";
    }

    /*
     * Build update object.
     *
     * We intentionally keep this compatible with
     * the existing releases table.
     */
    const updateData: Record<string, unknown> = {
      status: newStatus,
    };

    /*
     * Save admin note only if the column exists.
     *
     * If your releases table doesn't have admin_note,
     * this part is skipped below.
     */
    if (note) {
      updateData.admin_note = note;
    }

    /*
     * SUBMIT
     *
     * For now the database status becomes pending.
     *
     * The actual Too Lost submission will be connected
     * to your existing Too Lost submit API in the next step,
     * so we don't invent an unsupported Too Lost endpoint.
     */
    if (action === "submit") {
      updateData.status = "pending";
    }

    /*
     * Update release
     */
    let { data: updatedRelease, error: updateError } =
      await supabaseAdmin
        .from("releases")
        .update(updateData)
        .eq("id", id)
        .select("*")
        .single();

    /*
     * If admin_note column doesn't exist,
     * retry without it.
     */
    if (
      updateError &&
      note &&
      updateError.message
        .toLowerCase()
        .includes("admin_note")
    ) {
      delete updateData.admin_note;

      const retry = await supabaseAdmin
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

    /*
     * Return action result
     */
    return NextResponse.json({
      success: true,
      action,
      previousStatus:
        currentRelease.status || null,
      newStatus,
      release: updatedRelease,
      toolostReleaseId:
        currentRelease.toolost_release_id || null,
      message:
        action === "submit"
          ? "Release moved to pending review. Too Lost submission will be connected next."
          : `Release ${action} action completed successfully.`,
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