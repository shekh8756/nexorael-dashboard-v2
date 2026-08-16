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
          success: false,
          connected: false,
          error: "Too Lost is not connected",
        },
        { status: 401 }
      );
    }

    const { response, data } = await tooLostApi(
      accessToken,
      "/releases",
      {
        method: "GET",
      }
    );

    return NextResponse.json(
      {
        success: response.ok,
        status: response.status,
        data,
      },
      { status: response.ok ? 200 : response.status }
    );
  } catch (error) {
    console.error(
      "Too Lost releases API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Too Lost releases request failed",
      },
      { status: 500 }
    );
  }
}