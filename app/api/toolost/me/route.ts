import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tooLostApi } from "@/lib/toolost";

export async function GET() {
  try {
    const cookieStore = await cookies();

    const accessToken =
      cookieStore.get("toolost_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          connected: false,
          error: "Too Lost is not connected",
        },
        { status: 401 }
      );
    }

    const { response, data } = await tooLostApi(
      accessToken,
      "/me"
    );

    if (!response.ok) {
      console.error(
        "Too Lost /me failed:",
        response.status,
        data
      );

      return NextResponse.json(
        {
          connected: false,
          error: "Too Lost API rejected the access token",
          status: response.status,
          details: data,
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
      "Too Lost /me error:",
      error
    );

    return NextResponse.json(
      {
        connected: false,
        error:
          error instanceof Error
            ? error.message
            : "Too Lost API request failed",
      },
      { status: 500 }
    );
  }
}