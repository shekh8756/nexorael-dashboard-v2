import { NextResponse } from "next/server";
import { tooLostApi } from "@/lib/toolost";
import { getTooLostMasterAccessToken } from "@/lib/toolost-master";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Use Nexorael's central Too Lost connection.
    // Individual users do not need a Too Lost login/cookie.
    const accessToken =
      await getTooLostMasterAccessToken();

    const { response, data } = await tooLostApi(
      accessToken,
      "/releases",
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      console.error(
        "Too Lost releases API failed:",
        response.status,
        data
      );

      return NextResponse.json(
        {
          success: false,
          status: response.status,
          error:
            "Distribution service could not load releases.",
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      status: response.status,
      data,
    });
  } catch (error) {
    console.error(
      "Too Lost releases API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Distribution service is temporarily unavailable.",
      },
      { status: 503 }
    );
  }
}