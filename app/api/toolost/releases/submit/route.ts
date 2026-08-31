import { NextRequest, NextResponse } from "next/server";
import { getTooLostMasterAccessToken } from "@/lib/toolost-master";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const accessToken =
  await getTooLostMasterAccessToken();

    const body = await request.json();

    const releaseId = body?.releaseId;

    if (!releaseId) {
      return NextResponse.json(
        {
          success: false,
          error: "Too Lost releaseId is required",
        },
        { status: 400 }
      );
    }

    console.log(
      "Submitting Too Lost release:",
      releaseId
    );

    const result = await tooLostApi(
      accessToken,
      `/releases/${releaseId}/submit`,
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

    return NextResponse.json(
      {
        success: result.response.ok,
        status: result.response.status,
        data: result.data,
      },
      {
        status: result.response.ok
          ? 200
          : result.response.status,
      }
    );
  } catch (error) {
    console.error(
      "Too Lost submit error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Too Lost submission failed",
      },
      { status: 500 }
    );
  }
}