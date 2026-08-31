import { NextResponse } from "next/server";
import { tooLostApi } from "@/lib/toolost";
import { getTooLostMasterAccessToken } from "@/lib/toolost-master";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Nexorael's central Too Lost connection.
    // No browser/user Too Lost cookie is required.
    const accessToken =
      await getTooLostMasterAccessToken();

    const { response, data } = await tooLostApi(
      accessToken,
      "/me"
    );

    if (!response.ok) {
      console.error(
        "Too Lost master /me failed:",
        response.status,
        data
      );

      return NextResponse.json(
        {
          connected: false,
          error:
            "Nexorael distribution service connection could not be verified.",
          status: response.status,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      connected: true,
      profile: data,
    });
  } catch (error) {
    console.error(
      "Too Lost master /me error:",
      error
    );

    return NextResponse.json(
      {
        connected: false,
        error:
          "Nexorael distribution service is temporarily unavailable.",
      },
      { status: 503 }
    );
  }
}