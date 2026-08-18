import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxies release metadata updates to Too Lost.
 *
 * Route location:
 * app/api/toolost/releases/metadata/route.ts
 *
 * Too Lost endpoint:
 * PATCH /releases/{releaseId}/metadata
 *
 * Important: Too Lost uses camelCase metadata keys and the artwork field
 * is `coverUrl`, not artwork_url / artwork / cover_url.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("toolost_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Too Lost is not connected. Please connect Too Lost first.",
        },
        { status: 401 }
      );
    }

    let body: any;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const releaseId = body?.releaseId;
    const artworkUrl = body?.artworkUrl;
    const incomingMetadata =
      body?.metadata && typeof body.metadata === "object"
        ? body.metadata
        : {};

    if (!releaseId) {
      return NextResponse.json(
        { success: false, error: "releaseId is required." },
        { status: 400 }
      );
    }

    if (!artworkUrl && !incomingMetadata.coverUrl) {
      return NextResponse.json(
        { success: false, error: "artworkUrl / coverUrl is required." },
        { status: 400 }
      );
    }

    // Build the exact Too Lost release metadata payload.
    // Do not send snake_case artwork fields.
    const metadata: Record<string, unknown> = {
      ...incomingMetadata,
      ...(artworkUrl ? { coverUrl: artworkUrl } : {}),
    };

    // Remove legacy/wrong field names if an older frontend sends them.
    delete metadata.genre;
    delete metadata.subgenre;
    delete metadata.release_date;
    delete metadata.original_release_date;
    delete metadata.catalog_number;
    delete metadata.artwork;
    delete metadata.artwork_url;
    delete metadata.cover_url;

    if (!metadata.primaryGenre && body?.metadata?.genre) {
      metadata.primaryGenre = body.metadata.genre;
    }

    if (!metadata.secondaryGenre && body?.metadata?.subgenre) {
      metadata.secondaryGenre = body.metadata.subgenre;
    }

    if (!metadata.releaseDate && body?.metadata?.release_date) {
      metadata.releaseDate = body.metadata.release_date;
    }

    if (
      !metadata.originalReleaseDate &&
      body?.metadata?.original_release_date
    ) {
      metadata.originalReleaseDate =
        body.metadata.original_release_date;
    }

    console.log(
      "Too Lost metadata update:",
      JSON.stringify(
        {
          releaseId: String(releaseId),
          metadata,
        },
        null,
        2
      )
    );

    const result = await tooLostApi(
      accessToken,
      `/releases/${encodeURIComponent(String(releaseId))}/metadata`,
      {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metadata),
      }
    );

    const status = result.response.status;

    console.log("Too Lost metadata status:", status);
    console.log(
      "Too Lost metadata response:",
      result.data
    );

    if (!result.response.ok) {
      return NextResponse.json(
        {
          success: false,
          status,
          step: "update_release_metadata",
          error:
  (result.data as { message?: string; error?: string })?.message ||
  (result.data as { message?: string; error?: string })?.error ||
  "Too Lost rejected the metadata update.",
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      releaseId: String(releaseId),
      artworkUrl: metadata.coverUrl || null,
      data: result.data,
    });
  } catch (error: any) {
    console.error(
      "Too Lost metadata route error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Failed to update Too Lost release metadata.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    route: "/api/toolost/releases/metadata",
    method: "POST",
    tooLostMethod: "PATCH",
    tooLostEndpoint: "/releases/{releaseId}/metadata",
  });
}
