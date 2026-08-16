import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    const accessToken =
      cookieStore.get("toolost_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Too Lost is not connected",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      releaseId,
      title,
      fileKey,
    } = body;

    if (!releaseId) {
      return NextResponse.json(
        {
          success: false,
          error: "releaseId is required",
        },
        { status: 400 }
      );
    }

    if (!fileKey) {
      return NextResponse.json(
        {
          success: false,
          error: "fileKey is required",
        },
        { status: 400 }
      );
    }

    const tracksBody = {
      tracks: [
        {
          title:
            title || "Nexorael Audio Test",

          language: "en",

          audioFileKey: fileKey,

          artists: [
            {
              name: "MD SAHID MIYA",
              role: ["primary"],
            },
          ],
        },
      ],
    };

    console.log(
      "Too Lost tracks request:",
      JSON.stringify(
        tracksBody,
        null,
        2
      )
    );

    const result = await tooLostApi(
      accessToken,
      `/releases/${releaseId}/tracks`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          tracksBody
        ),
      }
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
      "Too Lost finalize track error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to save track",
      },
      { status: 500 }
    );
  }
}