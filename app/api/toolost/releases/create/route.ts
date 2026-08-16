import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tooLostApi } from "@/lib/toolost";

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
      title,
      type,
      label,
      artistName,
      artistId,
      role,
    } = body;

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error: "Release title is required",
        },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        {
          success: false,
          error: "Release type is required",
        },
        { status: 400 }
      );
    }

    if (!artistName) {
      return NextResponse.json(
        {
          success: false,
          error: "Artist name is required",
        },
        { status: 400 }
      );
    }

    const participant: Record<string, unknown> = {
      name: artistName,
      role: [role || "primary"],
    };

    // Only send artistId when we actually have one.
    if (artistId) {
      participant.artistId = Number(artistId);
    }

    const releaseBody: Record<string, unknown> = {
      type,
      title,
      participants: [participant],
    };

    if (label) {
      releaseBody.label = label;
    }

    console.log(
      "Creating Too Lost release:",
      JSON.stringify(releaseBody, null, 2)
    );

    const { response, data } = await tooLostApi(
      accessToken,
      "/releases",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(releaseBody),
      }
    );

    console.log("Too Lost create release status:", response.status);
    console.log("Too Lost create release response:", data);

    return NextResponse.json(
      {
        success: response.ok,
        status: response.status,
        data,
      },
      {
        status: response.ok ? 200 : response.status,
      }
    );
  } catch (error) {
    console.error(
      "Too Lost create release error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Too Lost release",
      },
      { status: 500 }
    );
  }
}