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
  artist_name?: string | null;
  status?: string | null;
  user_id?: string | null;
  white_label_id?: string | null;
  admin_note?: string | null;
  toolost_release_id?: string | number | null;
};

function getNewStatus(action: Action) {
  switch (action) {
    case "approve":
      return "approved";

    case "reject":
      return "rejected";

    case "draft":
      return "draft";

    case "takedown":
      return "takedown";

    case "submit":
      return "pending";

    default:
      return null;
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
          error: "Release ID is required.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const action = body?.action as Action;

    const note =
      typeof body?.note === "string"
        ? body.note.trim()
        : "";

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
          error: "Invalid release action.",
        },
        { status: 400 }
      );
    }

    /*
     * Reject and takedown require a reason.
     */

    if (
      (action === "reject" || action === "takedown") &&
      !note
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            action === "reject"
              ? "Rejection reason is required."
              : "Takedown reason is required.",
        },
        { status: 400 }
      );
    }

    /*
     * Get release from Supabase.
     */

    const {
      data: release,
      error: releaseError,
    } = await supabaseAdmin
      .from("releases")
      .select(
        `
        id,
        title,
        artist_name,
        status,
        user_id,
        white_label_id,
        admin_note,
        toolost_release_id
        `
      )
      .eq("id", id)
      .maybeSingle();

    if (releaseError) {
      console.error(
        "Release lookup error:",
        releaseError
      );

      return NextResponse.json(
        {
          success: false,
          error: releaseError.message,
        },
        { status: 500 }
      );
    }

    if (!release) {
      return NextResponse.json(
        {
          success: false,
          error: "Release not found.",
        },
        { status: 404 }
      );
    }

    const releaseRow = release as ReleaseRow;

    /*
     * ==========================================
     * APPROVE
     * ==========================================
     *
     * Approve now actually submits the release
     * to Too Lost first.
     */

    if (action === "approve") {
      /*
       * Too Lost release ID is required.
       */

      if (!releaseRow.toolost_release_id) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Too Lost release ID is missing. This release cannot be submitted to Too Lost.",
          },
          { status: 400 }
        );
      }

      /*
       * Read Too Lost OAuth token from HTTP-only cookie.
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
              "Too Lost is not connected. Please connect Too Lost again.",
          },
          { status: 401 }
        );
      }

      /*
       * Submit release to Too Lost.
       *
       * POST:
       * /releases/{releaseId}/submit
       */

      const toolostPath =
        `/releases/${encodeURIComponent(
          String(releaseRow.toolost_release_id)
        )}/submit`;

      console.log(
        "Submitting release to Too Lost:",
        toolostPath
      );

      const {
  response: toolostResponse,
  data: toolostData,
} = await tooLostApi(
  accessToken,
  toolostPath,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      acceptTerms: true,
      confirmRights: true,
      confirmYoutubeRights: true,
    }),
  }
);

console.log(
  "Too Lost submit status:",
  toolostResponse.status
);

console.log(
  "Too Lost submit response:",
  toolostData
);

/*
 * If Too Lost rejects the request,
 * DO NOT mark our release approved.
 */

if (!toolostResponse.ok) {
  console.error("========== TOO LOST SUBMIT ERROR ==========");
  console.error("Status:", toolostResponse.status);
  console.error(
    "Response:",
    JSON.stringify(toolostData, null, 2)
  );
  console.error("============================================");

  return NextResponse.json(
    {
      success: false,
      error: "Too Lost submission failed.",
      tooLostStatus: toolostResponse.status,
      tooLostResponse: toolostData,
      releaseId: releaseRow.toolost_release_id,
    },
    {
      status: 422,
    }
  );
}

      /*
       * Too Lost accepted the submission.
       *
       * Now update Nexorael status.
       */

      const adminNote =
        note ||
        "Approved and submitted to Too Lost.";

      const {
        data: updatedRelease,
        error: updateError,
      } = await supabaseAdmin
        .from("releases")
        .update({
          status: "approved",
          admin_note: adminNote,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (updateError) {
        console.error(
          "Release update error:",
          updateError
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "Too Lost submission succeeded, but local release status could not be updated.",
            details:
              updateError.message,
          },
          { status: 500 }
        );
      }

      /*
       * Notification
       */

      if (releaseRow.user_id) {
        try {
          await supabaseAdmin
            .from("notifications")
            .insert({
              user_id:
                releaseRow.user_id,

              title:
                "Release Approved",

              message:
                `Your release "${releaseRow.title || "Untitled"}" has been approved and submitted to Too Lost.`,

              type: "approved",

              is_read: false,
            });
        } catch (notificationError) {
          console.error(
            "Notification error:",
            notificationError
          );
        }
      }

      return NextResponse.json({
        success: true,

        message:
          "Release approved and submitted to Too Lost successfully.",

        status: "approved",

        release: updatedRelease,

        tooLost: toolostData,
      });
    }

    /*
     * ==========================================
     * OTHER ACTIONS
     * ==========================================
     */

    const newStatus =
      getNewStatus(action);

    if (!newStatus) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to determine release status.",
        },
        { status: 400 }
      );
    }

    let adminNote =
      note || null;

    if (
      action === "reject" &&
      !adminNote
    ) {
      adminNote =
        "Release rejected by admin.";
    }

    if (
      action === "takedown" &&
      !adminNote
    ) {
      adminNote =
        "Release taken down by admin.";
    }

    /*
     * Update local release.
     */

    const {
      data: updatedRelease,
      error: updateError,
    } = await supabaseAdmin
      .from("releases")
      .update({
        status: newStatus,
        admin_note: adminNote,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error(
        "Release update error:",
        updateError
      );

      return NextResponse.json(
        {
          success: false,
          error: updateError.message,
        },
        { status: 500 }
      );
    }

    /*
     * Notification
     */

    if (releaseRow.user_id) {
      try {
        await supabaseAdmin
          .from("notifications")
          .insert({
            user_id:
              releaseRow.user_id,

            title:
              getNotificationTitle(action),

            message:
              getNotificationMessage(
                releaseRow.title ||
                  "Untitled",
                newStatus,
                note
              ),

            type: newStatus,

            is_read: false,
          });
      } catch (notificationError) {
        console.error(
          "Notification error:",
          notificationError
        );
      }
    }

    let message = "";

    switch (action) {
      case "reject":
        message =
          "Release rejected successfully.";
        break;

      case "draft":
        message =
          "Release moved back to draft.";
        break;

      case "takedown":
        message =
          "Release marked for takedown.";
        break;

      case "submit":
        message =
          "Release moved to pending review.";
        break;

      default:
        message =
          "Release updated successfully.";
    }

    return NextResponse.json({
      success: true,
      message,
      release: updatedRelease,
      status: newStatus,
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
            : "Internal server error.",
      },
      { status: 500 }
    );
  }
}

function getNotificationTitle(
  action: Action
) {
  switch (action) {
    case "approve":
      return "Release Approved";

    case "reject":
      return "Release Rejected";

    case "draft":
      return "Release Moved to Draft";

    case "takedown":
      return "Release Takedown";

    case "submit":
      return "Release Submitted";

    default:
      return "Release Updated";
  }
}

function getNotificationMessage(
  title: string,
  status: string,
  note: string
) {
  let message =
    `Your release "${title}" status has been updated to ${status}.`;

  if (note) {
    message +=
      ` Admin note: ${note}`;
  }

  return message;
}