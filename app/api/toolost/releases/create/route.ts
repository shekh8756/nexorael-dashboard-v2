import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unwrap(value: any) {
  return value?.data?.data ?? value?.data ?? value;
}

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

    const {
      title,
      type,
      label,
      artistName,
      artistId,
      role,
      genre,
      subgenre,
      language,
      releaseDate,
      originalReleaseDate,
      catalogNumber,
      upc,
    } = body;

    if (!title || !type || !artistName) {
      return NextResponse.json(
        {
          success: false,
          error: "Title, release type and artist are required.",
        },
        { status: 400 }
      );
    }

    const participant: Record<string, unknown> = {
      name: artistName,
      role: [role || "primary"],
    };

    if (artistId) participant.artistId = Number(artistId);

    const releaseBody: Record<string, unknown> = {
      type,
      title,
      participants: [participant],
    };

    if (label) releaseBody.label = label;

    const createdResult = await tooLostApi(accessToken, "/releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(releaseBody),
    });

    if (!createdResult.response.ok) {
      return NextResponse.json(
        {
          success: false,
          status: createdResult.response.status,
          step: "create_release",
          tooLostResponse: createdResult.data,
        },
        { status: createdResult.response.status }
      );
    }

    const created = unwrap(createdResult.data);
    const releaseId = created?.id;

    if (!releaseId) {
      return NextResponse.json(
        {
          success: false,
          error: "Too Lost did not return a release ID.",
          tooLostResponse: createdResult.data,
        },
        { status: 502 }
      );
    }

    const metadata: Record<string, unknown> = {};

    if (label) metadata.label = label;
    if (genre) metadata.genre = genre;
    if (subgenre) metadata.subgenre = subgenre;
    if (language) metadata.language = language;
    if (releaseDate) metadata.release_date = releaseDate;
    if (originalReleaseDate) {
      metadata.original_release_date = originalReleaseDate;
    }
    if (catalogNumber) metadata.catalog_number = catalogNumber;

    // IMPORTANT: when Auto UPC is enabled we do NOT invent an NX/random UPC.
    // If a user supplied a UPC, pass it to Too Lost for validation/use.
    if (upc) metadata.upc = upc;

    if (Object.keys(metadata).length) {
      const metadataResult = await tooLostApi(
        accessToken,
        `/releases/${releaseId}/metadata`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(metadata),
        }
      );

      if (!metadataResult.response.ok) {
        return NextResponse.json(
          {
            success: false,
            status: metadataResult.response.status,
            step: "metadata",
            releaseId,
            error: "Too Lost rejected release metadata.",
            tooLostResponse: metadataResult.data,
          },
          { status: metadataResult.response.status }
        );
      }
    }

    // Re-read the release so the dashboard stores Too Lost's authoritative
    // UPC/catalog number instead of inventing local identifiers.
    let authoritative = created;

    try {
      const refreshed = await tooLostApi(
        accessToken,
        `/releases/${releaseId}`,
        { method: "GET" }
      );

      if (refreshed.response.ok) {
        authoritative = unwrap(refreshed.data);
      }
    } catch (error) {
      console.warn("Too Lost release refresh failed:", error);
    }

    return NextResponse.json({
      success: true,
      data: authoritative,
      releaseId,
    });
  } catch (error) {
    console.error("Too Lost create release error:", error);

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
