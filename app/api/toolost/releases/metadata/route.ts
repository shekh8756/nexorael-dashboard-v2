import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("toolost_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Too Lost is not connected" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { releaseId, artworkUrl, metadata } = body;

    if (!releaseId) {
      return NextResponse.json(
        { success: false, error: "releaseId is required" },
        { status: 400 }
      );
    }

    const patch = {
      ...(metadata || {}),
      ...(artworkUrl ? { artwork_url: artworkUrl } : {}),
    };

    const first = await tooLostApi(
      accessToken,
      `/releases/${releaseId}/metadata`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }
    );

    if (first.response.ok) {
      return NextResponse.json({
        success: true,
        data: first.data,
      });
    }

    // Some API versions use "artwork" rather than "artwork_url".
    // Retry only the artwork field if the combined metadata request failed.
    if (artworkUrl) {
      for (const artworkField of ["artwork", "cover_url"]) {
        const retry = await tooLostApi(
          accessToken,
          `/releases/${releaseId}/metadata`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(metadata || {}),
              [artworkField]: artworkUrl,
            }),
          }
        );

        if (retry.response.ok) {
          return NextResponse.json({
            success: true,
            data: retry.data,
            artworkField,
          });
        }
      }
    }

    return NextResponse.json(
      {
        success: false,
        status: first.response.status,
        error: "Too Lost rejected the release metadata/artwork update.",
        tooLostResponse: first.data,
      },
      { status: first.response.status }
    );
  } catch (error) {
    console.error("Too Lost metadata update error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update Too Lost release metadata",
      },
      { status: 500 }
    );
  }
}
