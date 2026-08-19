import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
          error: "User ID is required.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("user_distribution_access")
      .select("*")
      .eq("user_id", id)
      .order("platform_name", {
        ascending: true,
      });

    if (error) {
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
      platforms: data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load platform access.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
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
          error: "User ID is required.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const platforms = Array.isArray(body?.platforms)
      ? body.platforms
      : [];

    /*
     * Remove old platform access.
     */
    const { error: deleteError } = await supabaseAdmin
      .from("user_distribution_access")
      .delete()
      .eq("user_id", id);

    if (deleteError) {
      return NextResponse.json(
        {
          success: false,
          error: deleteError.message,
        },
        { status: 500 }
      );
    }

    /*
     * If no platforms selected,
     * user simply has no DSP access.
     */
    if (platforms.length === 0) {
      return NextResponse.json({
        success: true,
        message: "All platform access removed.",
        platforms: [],
      });
    }

    const rows = platforms.map((platform: string) => ({
      user_id: id,
      platform_name: platform,
      enabled: true,
    }));

    const { data, error } = await supabaseAdmin
      .from("user_distribution_access")
      .insert(rows)
      .select("*");

    if (error) {
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
      message: "Platform access updated successfully.",
      platforms: data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update platform access.",
      },
      { status: 500 }
    );
  }
}