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
    const accessToken =
      cookieStore.get("toolost_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Too Lost is not connected. Please connect Too Lost first.",
        },
        { status: 401 }
      );
    }

    let body: any;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON request body.",
        },
        { status: 400 }
      );
    }

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
          error:
            "Title, release type and artist are required.",
        },
        { status: 400 }
      );
    }

    /*
     * =========================================
     * CREATE TOO LOST DRAFT
     * =========================================
     */

    const participant: Record<string, unknown> = {
      name: String(artistName).trim(),
      role: [role || "primary"],
    };

    if (artistId) {
      participant.artistId = Number(artistId);
    }

    const releaseBody: Record<string, unknown> = {
      type,
      title: String(title).trim(),
      participants: [participant],
    };

    if (label) {
      releaseBody.label = String(label).trim();
    }

    const createdResult = await tooLostApi(
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

    if (!createdResult.response.ok) {
      return NextResponse.json(
        {
          success: false,
          status: createdResult.response.status,
          step: "create_release",
          error:
            (createdResult.data as any)?.message ||
            (createdResult.data as any)?.error ||
            "Too Lost rejected release creation.",
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
          error:
            "Too Lost did not return a release ID.",
          tooLostResponse: createdResult.data,
        },
        { status: 502 }
      );
    }

    /*
     * =========================================
     * UPDATE BASIC METADATA
     * =========================================
     */

    const metadata: Record<string, unknown> = {};

    if (label) {
      metadata.label = String(label).trim();
    }

    if (genre) {
      metadata.genre = genre;
    }

    if (subgenre) {
      metadata.subgenre = subgenre;
    }

    if (language) {
      metadata.language = language;
    }

    if (releaseDate) {
      metadata.release_date = releaseDate;
    }

    if (originalReleaseDate) {
      metadata.original_release_date =
        originalReleaseDate;
    }

    if (catalogNumber) {
      metadata.catalog_number = catalogNumber;
    }

    if (upc) {
      metadata.upc = upc;
    }

    if (Object.keys(metadata).length > 0) {
      const metadataResult = await tooLostApi(
        accessToken,
        `/releases/${encodeURIComponent(
          String(releaseId)
        )}/metadata`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
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
            error:
              (metadataResult.data as any)?.message ||
              (metadataResult.data as any)?.error ||
              "Too Lost rejected release metadata.",
            tooLostResponse: metadataResult.data,
          },
          { status: metadataResult.response.status }
        );
      }
    }

    /*
     * DSP/store selection intentionally नहीं होती।
     * Admin Approve modal से Too Lost stores चुने जाएँगे।
     */

    let authoritative = created;

    try {
      const refreshed = await tooLostApi(
        accessToken,
        `/releases/${encodeURIComponent(
          String(releaseId)
        )}`,
        {
          method: "GET",
        }
      );

      if (refreshed.response.ok) {
        authoritative = unwrap(refreshed.data);
      }
    } catch (refreshError) {
      console.warn(
        "Too Lost release refresh failed:",
        refreshError
      );
    }

    return NextResponse.json({
      success: true,
      data: authoritative,
      releaseId: String(releaseId),
    });
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
            : "Failed to create Too Lost release.",
      },
      { status: 500 }
    );
  }
}