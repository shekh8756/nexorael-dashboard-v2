import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unwrap(value: any) {
  return value?.data?.data ?? value?.data ?? value;
}

function normalizeName(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/youtube\s*music/g, "youtube")
    .replace(/apple\s*music/g, "apple")
    .replace(/amazon\s*music/g, "amazon")
    .replace(/meta\s*\/\s*facebook/g, "meta")
    .replace(/facebook|instagram/g, "meta")
    .replace(/audio\s*mack/g, "audiomack")
    .replace(/[^a-z0-9]/g, "");
}

const DSP_ALIASES: Record<string, string[]> = {
  spotify: ["spotify"],
  apple: ["apple", "applemusic", "itunes"],
  youtube: ["youtube", "youtubemusic", "ytmusic"],
  amazon: ["amazon", "amazonmusic", "amazonmp3"],
  deezer: ["deezer"],
  tiktok: ["tiktok", "tiktokmusic"],
  meta: ["meta", "facebook", "instagram", "metamusic"],
  jiosaavn: ["jiosaavn", "saavn"],
  gaana: ["gaana"],
  wynk: ["wynk", "wynkmusic"],
  boomplay: ["boomplay"],
  audiomack: ["audiomack", "audiomackmusic"],
};

type PlatformCandidate = {
  id: string;
  names: string[];
  raw: unknown;
};

function firstId(value: any): string | null {
  const id =
    value?.id ??
    value?.platform_id ??
    value?.platformId ??
    value?.store_id ??
    value?.storeId ??
    value?.uuid ??
    value?.code ??
    null;

  return id === null || id === undefined || String(id).trim() === ""
    ? null
    : String(id);
}

function ownNames(value: any): string[] {
  const values = [
    value?.name,
    value?.title,
    value?.label,
    value?.display_name,
    value?.displayName,
    value?.platform_name,
    value?.platformName,
    value?.store_name,
    value?.storeName,
    value?.service_name,
    value?.serviceName,
    value?.slug,
    value?.code,
  ];

  return Array.from(
    new Set(
      values
        .filter((item): item is string =>
          typeof item === "string" && item.trim().length > 0
        )
        .map(normalizeName)
        .filter(Boolean)
    )
  );
}

function collectPlatforms(
  value: unknown,
  inheritedId: string | null = null,
  result: PlatformCandidate[] = [],
  seen = new Set<unknown>()
): PlatformCandidate[] {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return result;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPlatforms(item, inheritedId, result, seen);
    }
    return result;
  }

  const object = value as Record<string, unknown>;
  const currentId = firstId(object) || inheritedId;
  const names = ownNames(object);

  if (currentId && names.length) {
    result.push({ id: currentId, names, raw: object });
  }

  for (const child of Object.values(object)) {
    if (child && typeof child === "object") {
      collectPlatforms(child, currentId, result, seen);
    }
  }

  return result;
}

function resolvePlatformId(
  selectedName: string,
  platforms: PlatformCandidate[]
): string | null {
  const normalized = normalizeName(selectedName);
  const aliases = DSP_ALIASES[normalized] || [normalized];

  for (const platform of platforms) {
    const matches = platform.names.some((name) =>
      aliases.some(
        (alias) =>
          name === alias ||
          name.includes(alias) ||
          alias.includes(name)
      )
    );

    if (matches) return platform.id;
  }

  return null;
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
      dsps,
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

    const selectedDSPs = Array.isArray(dsps)
      ? dsps.filter(
          (item): item is string =>
            typeof item === "string" && item.trim().length > 0
        )
      : [];

    if (!selectedDSPs.length) {
      return NextResponse.json(
        { success: false, error: "Please select at least one DSP." },
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

    const platformResult = await tooLostApi(
      accessToken,
      "/lookup/platforms",
      { method: "GET" }
    );

    if (!platformResult.response.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "lookup_platforms",
          releaseId,
          error: "Unable to load Too Lost stores.",
          tooLostResponse: platformResult.data,
        },
        { status: platformResult.response.status }
      );
    }

    const candidates = collectPlatforms(platformResult.data);
    const resolved = selectedDSPs.map((name) => ({
      name,
      platformId: resolvePlatformId(name, candidates),
    }));
    const unmatchedDSPs = resolved
      .filter((item) => !item.platformId)
      .map((item) => item.name);

    if (unmatchedDSPs.length) {
      return NextResponse.json(
        {
          success: false,
          step: "match_platforms",
          releaseId,
          error: "Some selected DSPs were not returned by Too Lost.",
          unmatchedDSPs,
          availablePlatforms: candidates.map((item) => ({
            id: item.id,
            names: item.names,
          })),
        },
        { status: 422 }
      );
    }

    const storeIds = Array.from(
      new Set(
        resolved
          .map((item) => item.platformId)
          .filter((id): id is string => Boolean(id))
      )
    );

    const deliveryResult = await tooLostApi(
      accessToken,
      `/releases/${releaseId}/delivery`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stores: storeIds }),
      }
    );

    if (!deliveryResult.response.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "configure_delivery",
          releaseId,
          error: "Too Lost rejected the selected stores.",
          selectedStores: resolved,
          tooLostResponse: deliveryResult.data,
        },
        { status: deliveryResult.response.status }
      );
    }

    let authoritative = created;

    try {
      const refreshed = await tooLostApi(
        accessToken,
        `/releases/${releaseId}`,
        { method: "GET" }
      );

      if (refreshed.response.ok) authoritative = unwrap(refreshed.data);
    } catch (error) {
      console.warn("Too Lost release refresh failed:", error);
    }

    return NextResponse.json({
      success: true,
      data: authoritative,
      releaseId,
      stores: resolved,
      delivery: deliveryResult.data,
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