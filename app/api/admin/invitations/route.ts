import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InviteBody = {
  email: string;
  legalName: string;
  accountType: "artist" | "label";
  phone?: string;
  fullAddress?: string;
  legalDocumentType?: string;
  legalDocumentNumber?: string;
  companyName?: string;
  platforms?: string[];
};

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as InviteBody;

    const email =
      String(body.email || "")
        .trim()
        .toLowerCase();

    const legalName =
      String(body.legalName || "")
        .trim();

    const accountType =
      body.accountType;

    const platforms =
      Array.isArray(body.platforms)
        ? body.platforms
        : [];

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: "Email is required.",
        },
        { status: 400 }
      );
    }

    if (!legalName) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Full legal name is required.",
        },
        { status: 400 }
      );
    }

    if (
      !["artist", "label"].includes(
        accountType
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Account type must be artist or label.",
        },
        { status: 400 }
      );
    }

    /*
     * Send Supabase Auth invitation.
     */
    const {
      data: inviteData,
      error: inviteError,
    } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            legal_name: legalName,
            account_type: accountType,
          },

          redirectTo:
  `${process.env.NEXT_PUBLIC_SITE_URL}/set-password`,
        }
      );

    if (inviteError) {
      return NextResponse.json(
        {
          success: false,
          error:
            inviteError.message,
        },
        { status: 422 }
      );
    }

    const invitedUser =
      inviteData.user;

    if (!invitedUser?.id) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Supabase did not return invited user ID.",
        },
        { status: 500 }
      );
    }

    const userId =
      invitedUser.id;

    /*
     * Create/update profile.
     */
    const {
      error: profileError,
    } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,

          email,

          legal_name:
            legalName,

          full_name:
            legalName,

          account_type:
            accountType,

          user_type:
            accountType,

          status:
            "active",

          phone:
            body.phone || null,

          full_address:
            body.fullAddress ||
            null,

          legal_document_type:
            body.legalDocumentType ||
            null,

          legal_document_number:
            body.legalDocumentNumber ||
            null,

          company_name:
            body.companyName ||
            null,

          invitation_status:
            "pending",
        },
        {
          onConflict: "id",
        }
      );

    if (profileError) {
      return NextResponse.json(
        {
          success: false,
          error:
            profileError.message,
        },
        { status: 500 }
      );
    }

    /*
     * Save platform eligibility.
     */
    if (platforms.length > 0) {
      const rows =
        platforms.map(
          (platform) => ({
            user_id:
              userId,

            platform_name:
              platform,

            enabled:
              true,
          })
        );

      const {
        error: platformError,
      } = await supabaseAdmin
        .from(
          "user_distribution_access"
        )
        .upsert(
          rows,
          {
            onConflict:
              "user_id,platform_name",
          }
        );

      if (platformError) {
        return NextResponse.json(
          {
            success: false,
            error:
              platformError.message,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,

      message:
        "User invited successfully.",

      userId,

      email,

      platforms,
    });
  } catch (error) {
    console.error(
      "Invitation error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to invite user.",
      },
      { status: 500 }
    );
  }
}