import { NextRequest, NextResponse } from "next/server";
import { getTooLostMasterAccessToken } from "@/lib/toolost-master";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { tooLostApi } from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action =
  | "approve"
  | "reject"
  | "draft"
  | "takedown"
  | "submit"
  | "get_dsps"
  | "save_dsps";

type ReleaseRow = {
  id: string;
  title?: string | null;
  artist_name?: string | null;
  status?: string | null;
  user_id?: string | null;
  white_label_id?: string | null;
  admin_note?: string | null;
  toolost_release_id?: string | number | null;
  selected_dsps?: string[] | null;
};

function getNewStatus(action: Action) {
  switch (action) {
    case "reject":
      return "rejected";

    case "draft":
      return "draft";

    case "takedown":
      return "takedown";

    case "submit":
      return "pending";

    default:
      return null;
  }
}

async function getAccessToken() {
  return await getTooLostMasterAccessToken();
}

/**
 * Get real Too Lost platforms.
 */
/**
 * Get real Too Lost platforms/stores.
 */
async function getTooLostPlatforms(
  accessToken: string
) {
  const {
    response,
    data,
  } = await tooLostApi(
    accessToken,
    "lookup/platforms",
    {
      method: "GET",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Unable to fetch Too Lost platforms (${response.status})`
    );
  }

  console.log(
    "========== TOO LOST PLATFORM RESPONSE =========="
  );

  console.log(
    JSON.stringify(data, null, 2)
  );

  console.log(
    "================================================="
  );

  /*
   * Too Lost may return platforms in different
   * response wrappers.
   */

  if (Array.isArray(data)) {
    return data;
  }

  if (
    data &&
    typeof data === "object"
  ) {
    const root = data as any;

    if (Array.isArray(root.data)) {
      return root.data;
    }

    if (Array.isArray(root.platforms)) {
      return root.platforms;
    }

    if (Array.isArray(root.stores)) {
      return root.stores;
    }

    if (
      root.data &&
      typeof root.data === "object"
    ) {
      if (
        Array.isArray(root.data.platforms)
      ) {
        return root.data.platforms;
      }

      if (
        Array.isArray(root.data.stores)
      ) {
        return root.data.stores;
      }
    }
  }

  return collectPlatformObjects(data);
}

function collectPlatformObjects(value: unknown): any[] {
  const result: any[] = [];
  const seen = new Set<unknown>();

  function visit(current: unknown) {
    if (!current || typeof current !== "object" || seen.has(current)) {
      return;
    }

    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) visit(item);
      return;
    }

    const object = current as Record<string, unknown>;

    if (getPlatformId(object) && getPlatformName(object)) {
      result.push(object);
    }

    for (const child of Object.values(object)) {
      visit(child);
    }
  }

  visit(value);
  return result;
}


/**
 * =========================================================
 * TOO LOST PLATFORM HELPERS
 * =========================================================
 */

/**
 * Normalize a DSP/platform name.
 *
 * Examples:
 * Spotify              -> spotify
 * Apple Music          -> apple
 * YouTube Music        -> youtube
 * Instagram / Facebook -> meta
 * AudioMack            -> audiomack
 */
function normalizePlatformName(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/facebook/g, "meta")
    .replace(/instagram/g, "meta")
    .replace(/youtube\s*music/g, "youtube")
    .replace(/youtube/g, "youtube")
    .replace(/apple\s*music/g, "apple")
    .replace(/amazon\s*music/g, "amazon")
    .replace(/sound\s*cloud/g, "soundcloud")
    .replace(/audio\s*mack/g, "audiomack")
    .replace(/meta\s*rights\s*manager/g, "meta")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Get ID from a Too Lost platform object.
 *
 * Supports both flat and nested API structures.
 */
function getPlatformId(platform: any): string | null {
  if (!platform || typeof platform !== "object") {
    return null;
  }

  const directId =
    platform?.id ??
    platform?.platform_id ??
    platform?.platformId ??
    platform?.store_id ??
    platform?.storeId ??
    platform?.storeId ??
    platform?.code ??
    platform?.key ??
    null;

  if (
    directId !== null &&
    directId !== undefined &&
    String(directId).trim() !== ""
  ) {
    return String(directId);
  }

  const nestedObjects = [
    platform?.platform,
    platform?.store,
    platform?.service,
    platform?.data,
  ];

  for (const nested of nestedObjects) {
    const nestedId = getPlatformId(nested);

    if (nestedId) {
      return nestedId;
    }
  }

  return null;
}

/**
 * Get display name from a Too Lost platform object.
 *
 * Supports flat and nested structures.
 */
function getPlatformName(platform: any): string {
  if (!platform || typeof platform !== "object") {
    return "";
  }

  const directName =
    platform?.name ??
    platform?.title ??
    platform?.label ??
    platform?.display_name ??
    platform?.displayName ??
    platform?.platform_name ??
    platform?.platformName ??
    platform?.store_name ??
    platform?.storeName ??
    platform?.service_name ??
    platform?.serviceName ??
    platform?.slug ??
    "";

  if (
    typeof directName === "string" &&
    directName.trim()
  ) {
    return directName.trim();
  }

  const nestedObjects = [
    platform?.platform,
    platform?.store,
    platform?.service,
    platform?.data,
  ];

  for (const nested of nestedObjects) {
    const nestedName = getPlatformName(nested);

    if (nestedName) {
      return nestedName;
    }
  }

  return "";
}

/**
 * Get every possible searchable name from a
 * Too Lost platform object.
 */
function getPlatformSearchNames(platform: any): string[] {
  if (!platform || typeof platform !== "object") {
    return [];
  }

  const values: unknown[] = [
    platform?.name,
    platform?.title,
    platform?.label,
    platform?.display_name,
    platform?.displayName,

    platform?.platform_name,
    platform?.platformName,

    platform?.store_name,
    platform?.storeName,

    platform?.service_name,
    platform?.serviceName,

    platform?.slug,
    platform?.code,
    platform?.key,

    platform?.platform?.name,
    platform?.platform?.title,
    platform?.platform?.label,
    platform?.platform?.display_name,
    platform?.platform?.displayName,
    platform?.platform?.platform_name,
    platform?.platform?.platformName,
    platform?.platform?.slug,
    platform?.platform?.code,

    platform?.store?.name,
    platform?.store?.title,
    platform?.store?.label,
    platform?.store?.display_name,
    platform?.store?.displayName,
    platform?.store?.store_name,
    platform?.store?.storeName,
    platform?.store?.slug,
    platform?.store?.code,

    platform?.service?.name,
    platform?.service?.title,
    platform?.service?.label,
    platform?.service?.slug,
    platform?.service?.code,

    platform?.data?.name,
    platform?.data?.title,
    platform?.data?.label,
    platform?.data?.display_name,
    platform?.data?.displayName,
    platform?.data?.slug,
    platform?.data?.code,
  ];

  return Array.from(
    new Set(
      values
        .filter(
          (value): value is string =>
            typeof value === "string" &&
            value.trim().length > 0
        )
        .map(normalizePlatformName)
        .filter(Boolean)
    )
  );
}

/**
 * Dashboard DSP aliases.
 *
 * Left side = our dashboard name.
 * Right side = possible names returned by Too Lost.
 */
const DSP_ALIASES: Record<string, string[]> = {
  spotify: [
    "spotify",
  ],

  apple: [
    "apple",
    "applemusic",
    "itunes",
    "itunesstore",
    "applemusicstore",
  ],

  youtube: [
    "youtube",
    "youtubemusic",
    "youtubeaudio",
    "ytmusic",
  ],

  amazon: [
    "amazon",
    "amazonmusic",
    "amazonmp3",
    "amazonmusicunlimited",
  ],

  deezer: [
    "deezer",
  ],

  tiktok: [
    "tiktok",
    "tiktokmusic",
    "tiktokforartists",
  ],

  meta: [
    "meta",
    "facebook",
    "instagram",
    "instagramfacebook",
    "facebookinstagram",
    "metamusic",
    "metarightsmanager",
  ],

  tidal: [
    "tidal",
  ],

  pandora: [
    "pandora",
  ],

  soundcloud: [
    "soundcloud",
  ],

  boomplay: [
    "boomplay",
  ],

  audiomack: [
    "audiomack",
    "audiomackmusic",
    "audiomackcom",
  ],
};

/**
 * Convert dashboard DSP name into aliases.
 */
function getDSPAliases(selectedName: string): string[] {
  const normalized =
    normalizePlatformName(selectedName);

  return (
    DSP_ALIASES[normalized] || [
      normalized,
    ]
  );
}

/**
 * Recursively search a Too Lost object.
 *
 * This handles structures such as:
 *
 * {
 *   id: "123",
 *   platform: {
 *     name: "Audiomack"
 *   }
 * }
 *
 * OR:
 *
 * {
 *   platform_id: "123",
 *   platform_name: "Audiomack"
 * }
 *
 * OR:
 *
 * {
 *   data: {
 *     store: {
 *       name: "Audiomack"
 *     }
 *   }
 * }
 */
function findPlatformMatchRecursive(
  value: any,
  aliases: string[],
  parentId: string | null = null
): {
  platform: any;
  id: string | null;
  name: string;
} | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const currentId =
    getPlatformId(value) || parentId;

  const names =
    getPlatformSearchNames(value);

  for (const alias of aliases) {
    for (const name of names) {
      if (
        name === alias ||
        name.includes(alias) ||
        alias.includes(name)
      ) {
        const displayName =
          getPlatformName(value);

        return {
          platform: value,
          id: currentId,
          name:
            displayName ||
            alias,
        };
      }
    }
  }

  /*
   * Search nested objects.
   */
  for (const key of Object.keys(value)) {
    const child = value[key];

    if (
      child &&
      typeof child === "object"
    ) {
      if (Array.isArray(child)) {
        for (const item of child) {
          const result =
            findPlatformMatchRecursive(
              item,
              aliases,
              currentId
            );

          if (result) {
            return result;
          }
        }
      } else {
        const result =
          findPlatformMatchRecursive(
            child,
            aliases,
            currentId
          );

        if (result) {
          return result;
        }
      }
    }
  }

  return null;
}

/**
 * Match dashboard DSP against real Too Lost platform.
 *
 * IMPORTANT:
 * This function NEVER creates a fake platform ID.
 */
function matchTooLostPlatform(
  selectedName: string,
  platforms: any[]
) {
  const aliases =
    getDSPAliases(selectedName);

  console.log(
    "========================================"
  );

  console.log(
    "DSP MATCH START"
  );

  console.log(
    "Dashboard DSP:",
    selectedName
  );

  console.log(
    "Normalized:",
    normalizePlatformName(
      selectedName
    )
  );

  console.log(
    "Aliases:",
    aliases
  );

  console.log(
    "Too Lost platform count:",
    platforms.length
  );

  /*
   * First pass:
   * Search every platform recursively.
   */
  for (const platform of platforms) {
    const result =
      findPlatformMatchRecursive(
        platform,
        aliases
      );

    if (result) {
      console.log(
        "MATCH FOUND:",
        {
          dashboardName:
            selectedName,
          tooLostName:
            result.name,
          tooLostPlatformId:
            result.id,
          rawPlatform:
            result.platform,
        }
      );

      if (!result.id) {
        console.warn(
          "MATCH FOUND BUT NO PLATFORM ID:",
          result
        );
      }

      console.log(
        "========================================"
      );

      /*
       * Return original platform object
       * plus resolved ID/name.
       */
      return {
        ...result.platform,

        __resolved_platform_id:
          result.id,

        __resolved_platform_name:
          result.name,
      };
    }
  }

  console.warn(
    "DSP NOT MATCHED:",
    selectedName
  );

  console.log(
    "Available Too Lost platforms:"
  );

  for (const platform of platforms) {
    console.log({
      id:
        getPlatformId(platform),
      name:
        getPlatformName(platform),
      searchableNames:
        getPlatformSearchNames(
          platform
        ),
      raw:
        platform,
    });
  }

  console.log(
    "========================================"
  );

  return null;
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Release ID is required.",
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    const action = body?.action as Action;

    const note =
      typeof body?.note === "string"
        ? body.note.trim()
        : "";

    /*
    =====================================================
    SAVE DSP SELECTION
    =====================================================
    */

    if (action === "save_dsps") {
      const selectedDSPs: string[] = Array.isArray(body?.dsps)
  ? Array.from(
      new Set<string>(
        body.dsps
          .map((value: unknown) =>
            String(value ?? "").trim()
          )
          .filter(
            (value: string) =>
              value.length > 0
          )
      )
    )
  : [];

      if (!selectedDSPs.length) {
        return NextResponse.json(
          {
            success: false,
            error: "Please select at least one DSP.",
          },
          { status: 400 }
        );
      }

      const accessToken = await getAccessToken();

      if (!accessToken) {
        return NextResponse.json(
          {
            success: false,
            error: "Too Lost is not connected. Please connect Too Lost again.",
          },
          { status: 401 }
        );
      }

      const {
        data: targetRelease,
        error: targetReleaseError,
      } = await supabaseAdmin
        .from("releases")
        .select("id,toolost_release_id,content_id_required")
        .eq("id", id)
        .maybeSingle();

      if (targetReleaseError) {
        return NextResponse.json(
          {
            success: false,
            error: targetReleaseError.message,
          },
          { status: 500 }
        );
      }

      if (!targetRelease?.toolost_release_id) {
        return NextResponse.json(
          {
            success: false,
            error: "Too Lost release ID is missing.",
          },
          { status: 400 }
        );
      }

      const platformAliases: Record<string, string> = {
        "Instagram / Facebook": "Facebook/Instagram",
        "Meta / Facebook": "Facebook/Instagram",
      };

      const additional: Record<string, boolean> = {};
      const deliveryPlatforms: string[] = [];

      for (const selectedDSP of selectedDSPs) {
        switch (selectedDSP) {
          case "SoundCloud":
            additional.soundCloud = true;
            break;

          case "YouTube Content ID":
            additional.youtube = true;
            break;

          case "Facebook Rights Manager":
            additional.facebook = true;
            break;

          case "SoundExchange":
            additional.soundExchange = true;
            break;

          case "Beatport":
            additional.beatPort = true;
            break;

          case "Tracklib":
            additional.trackLibs = true;
            break;

          case "LyricFind":
            additional.lyricfind = true;
            break;

          default:
            deliveryPlatforms.push(
              platformAliases[selectedDSP] || selectedDSP
            );
        }
      }

      // Use the release-upload Content ID choice.
      if (targetRelease.content_id_required) {
        additional.youtube = true;
      }

      // Facebook/Instagram delivery also enables Facebook Rights Manager.
      if (deliveryPlatforms.includes("Facebook/Instagram")) {
        additional.facebook = true;
      }

      const uniquePlatforms = Array.from(new Set(deliveryPlatforms));

      if (!uniquePlatforms.length && !Object.keys(additional).length) {
        return NextResponse.json(
          {
            success: false,
            error: "Select at least one platform or additional service.",
          },
          { status: 400 }
        );
      }

      /*
       * Too Lost Release delivery docs:
       * PATCH /releases/{releaseId}/delivery
       * {
       *   delivery: {
       *     platforms: string[],
       *     additional: { youtube?, facebook?, soundCloud?, ... }
       *   }
       * }
       */
      const {
        response: deliveryResponse,
        data: deliveryData,
      } = await tooLostApi(
        accessToken,
        `releases/${targetRelease.toolost_release_id}/delivery`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            delivery: {
              platforms: uniquePlatforms,
              ...(Object.keys(additional).length
                ? { additional }
                : {}),
            },
          }),
        }
      );

      if (!deliveryResponse.ok) {
        return NextResponse.json(
          {
            success: false,
            error:
              (deliveryData as any)?.message ||
              (deliveryData as any)?.error ||
              "Too Lost rejected the selected delivery platforms.",
            tooLostStatus: deliveryResponse.status,
            tooLostResponse: deliveryData,
          },
          { status: deliveryResponse.status }
        );
      }

      const { error: deleteError } = await supabaseAdmin
        .from("dsp_deliveries")
        .delete()
        .eq("release_id", id);

      if (deleteError) {
        return NextResponse.json(
          {
            success: false,
            error: deleteError.message,
          },
          { status: 500 }
        );
      }

      const selectedRows = selectedDSPs.map((dspName: string) => ({
        release_id: id,
        dsp_name: dspName,
        toolost_platform_id: null,
        status: "selected",
      }));

      const {
        data: savedDSPs,
        error: insertError,
      } = await supabaseAdmin
        .from("dsp_deliveries")
        .insert(selectedRows)
        .select("*");

      if (insertError) {
        return NextResponse.json(
          {
            success: false,
            error: insertError.message,
          },
          { status: 500 }
        );
      }

      await supabaseAdmin
        .from("releases")
        .update({
          selected_dsps: selectedDSPs,
        })
        .eq("id", id);

      return NextResponse.json({
        success: true,
        message: "Too Lost delivery platforms saved successfully.",
        deliveries: savedDSPs,
        tooLost: deliveryData,
      });
    }


    /*
    =====================================================
    GET DSP LIST
    =====================================================
    */

    if (action === "get_dsps") {
      const accessToken =
        await getAccessToken();

      if (!accessToken) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Too Lost is not connected.",
          },
          { status: 401 }
        );
      }

      const platforms =
        await getTooLostPlatforms(
          accessToken
        );

      const usablePlatforms = platforms;

      const formattedPlatforms =
        usablePlatforms
          .map((platform: any) => ({
            id: getPlatformId(platform),
            name: getPlatformName(
              platform
            ),
          }))
          .filter(
            (platform: any) =>
              platform.id &&
              platform.name
          );

      /*
      Get currently selected DSPs.
      */

      const {
        data: selected,
      } = await supabaseAdmin
        .from("dsp_deliveries")
        .select("*")
        .eq("release_id", id);

      return NextResponse.json({
        success: true,
        platforms:
          formattedPlatforms,
        selected:
          selected || [],
      });
    }

    /*
    =====================================================
    GET RELEASE
    =====================================================
    */

    const {
      data: release,
      error: releaseError,
    } = await supabaseAdmin
      .from("releases")
      .select(`
        id,
        title,
        artist_name,
        status,
        user_id,
        white_label_id,
        admin_note,
        toolost_release_id,
        selected_dsps
      `)
      .eq("id", id)
      .maybeSingle();

    if (releaseError) {
      return NextResponse.json(
        {
          success: false,
          error:
            releaseError.message,
        },
        { status: 500 }
      );
    }

    if (!release) {
      return NextResponse.json(
        {
          success: false,
          error: "Release not found.",
        },
        { status: 404 }
      );
    }

       const releaseRow =
      release as ReleaseRow;

    /*
    =====================================================
    APPROVE
    =====================================================
    */

    if (action === "approve") {
      if (!releaseRow.toolost_release_id) {
        return NextResponse.json(
          {
            success: false,
            error: "Too Lost release ID is missing.",
          },
          { status: 400 }
        );
      }

      const accessToken =
        await getAccessToken();

      if (!accessToken) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Too Lost is not connected. Please connect Too Lost again.",
          },
          { status: 401 }
        );
      }

      /*
       * Delivery platforms must already be selected.
       */
      if (
        !Array.isArray(releaseRow.selected_dsps) ||
        releaseRow.selected_dsps.length === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Please save delivery platforms before approving this release.",
          },
          { status: 400 }
        );
      }

      /*
      =====================================================
      LOAD SAVED REVIEW INFORMATION
      =====================================================
      */

      const {
        data: reviewInfo,
        error: reviewInfoError,
      } = await supabaseAdmin
        .from("release_review_info")
        .select(`
          release_id,
          review_note,
          file_name,
          file_type,
          file_url,
          storage_path
        `)
        .eq("release_id", id)
        .maybeSingle();

      if (reviewInfoError) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Unable to load saved review information.",
            details: reviewInfoError.message,
          },
          { status: 500 }
        );
      }

      const reviewNote =
        typeof reviewInfo?.review_note === "string"
          ? reviewInfo.review_note
              .trim()
              .slice(0, 4000)
          : "";

      const reviewFileName =
        typeof reviewInfo?.file_name === "string"
          ? reviewInfo.file_name
              .trim()
              .slice(0, 255)
          : "";

      const reviewFileType =
        typeof reviewInfo?.file_type === "string"
          ? reviewInfo.file_type
              .trim()
              .slice(0, 40)
          : "";

      const reviewFileUrl =
        typeof reviewInfo?.file_url === "string"
          ? reviewInfo.file_url
              .trim()
              .slice(0, 2048)
          : "";

      const hasReviewInformation =
        Boolean(
          reviewNote ||
          reviewFileUrl
        );

      /*
      =====================================================
      ATTACH REVIEW INFORMATION TO TOO LOST
      =====================================================

      Too Lost:
      PATCH /releases/{releaseId}/metadata

      review: {
        fileName,
        fileType,
        fileUrl,
        note
      }

      If this fails, submission stops.
      */

      let reviewMetadataResponse: any =
        null;

      if (hasReviewInformation) {
        /*
         * If a document exists, all document metadata
         * must exist before sending it to Too Lost.
         */
        if (
          reviewFileUrl &&
          (
            !reviewFileName ||
            !reviewFileType
          )
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "The saved review document is incomplete. File name or file type is missing. Please save Review Notes & PDF again.",
            },
            { status: 400 }
          );
        }

        const reviewPayload = {
          review: {
            fileName:
              reviewFileName || null,

            fileType:
              reviewFileType || null,

            fileUrl:
              reviewFileUrl || null,

            note:
              reviewNote || null,
          },
        };

        console.log(
          "Too Lost review metadata payload:",
          {
            releaseId:
              releaseRow.toolost_release_id,

            review: {
              fileName:
                reviewPayload.review.fileName,

              fileType:
                reviewPayload.review.fileType,

              fileUrl:
                reviewPayload.review.fileUrl
                  ? "[DOCUMENT URL PRESENT]"
                  : null,

              noteLength:
                reviewNote.length,
            },
          }
        );

        const {
          response: reviewResponse,
          data: reviewResponseData,
        } = await tooLostApi(
          accessToken,
          `releases/${releaseRow.toolost_release_id}/metadata`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(
              reviewPayload
            ),
          }
        );

        reviewMetadataResponse =
          reviewResponseData;

        console.log(
          "Too Lost review metadata status:",
          reviewResponse.status
        );

        console.log(
          "Too Lost review metadata response:",
          reviewResponseData
        );

        /*
         * Critical:
         * Do not submit if Too Lost did not accept
         * the saved review information.
         */
        if (!reviewResponse.ok) {
          return NextResponse.json(
            {
              success: false,

              error:
                (reviewResponseData as any)
                  ?.message ||
                (reviewResponseData as any)
                  ?.error ||
                "Too Lost rejected the Review Notes or supporting document.",

              stage:
                "review_metadata",

              tooLostStatus:
                reviewResponse.status,

              tooLostResponse:
                reviewResponseData,
            },
            {
              status:
                reviewResponse.status >= 400 &&
                reviewResponse.status < 600
                  ? reviewResponse.status
                  : 422,
            }
          );
        }
      }

      /*
      =====================================================
      SUBMIT EXISTING TOO LOST RELEASE
      =====================================================
      */

      const directSubmitPath =
        `releases/${releaseRow.toolost_release_id}/submit`;

      const {
        response: directSubmitResponse,
        data: directSubmitData,
      } = await tooLostApi(
        accessToken,
        directSubmitPath,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            acceptTerms: true,
            confirmRights: true,
            confirmYoutubeRights: true,
          }),
        }
      );

      console.log(
        "Too Lost direct submit status:",
        directSubmitResponse.status
      );

      console.log(
        "Too Lost direct submit response:",
        directSubmitData
      );

      if (!directSubmitResponse.ok) {
        return NextResponse.json(
          {
            success: false,

            error:
              (directSubmitData as any)
                ?.message ||
              (directSubmitData as any)
                ?.error ||
              "Too Lost submission failed.",

            stage: "submit",

            tooLostStatus:
              directSubmitResponse.status,

            tooLostResponse:
              directSubmitData,

            /*
             * The review information may have already
             * been successfully attached even if
             * submission itself failed.
             */
            reviewAttached:
              hasReviewInformation,
          },
          { status: 422 }
        );
      }

      /*
      =====================================================
      UPDATE LOCAL NEXORAEL STATUS
      =====================================================

      Too Lost submission does NOT mean the release is
      already approved/live.

      Therefore:
      approved -> NO
      pending  -> YES

      API Sync will later obtain the real Too Lost status.
      */

      const directAdminNote =
        hasReviewInformation
          ? "Submitted to Too Lost with review information."
          : note ||
            "Submitted to Too Lost for review.";

      const {
        data: directlyUpdatedRelease,
        error: directUpdateError,
      } = await supabaseAdmin
        .from("releases")
        .update({
          status: "pending",
          admin_note:
            directAdminNote,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (directUpdateError) {
        return NextResponse.json(
          {
            success: false,

            error:
              "Too Lost submission succeeded, but local status update failed.",

            details:
              directUpdateError.message,

            tooLostSubmitted: true,
          },
          { status: 500 }
        );
      }

      /*
      =====================================================
      USER NOTIFICATION
      =====================================================
      */

      if (releaseRow.user_id) {
        try {
          await supabaseAdmin
            .from("notifications")
            .insert({
              user_id:
                releaseRow.user_id,

              title:
                "Release Submitted",

              message:
                `Your release "${
                  releaseRow.title ||
                  "Untitled"
                }" has been submitted for distribution review.`,

              type:
                "pending",

              is_read:
                false,
            });
        } catch (
          notificationError
        ) {
          /*
           * Notification failure must never turn
           * a successful Too Lost submission into
           * a failed submission.
           */
          console.error(
            "Notification error:",
            notificationError
          );
        }
      }

      /*
      =====================================================
      APPROVE SUCCESS
      =====================================================
      */

      return NextResponse.json({
        success: true,

        message:
          hasReviewInformation
            ? "Review Notes/document attached and release submitted to Too Lost successfully."
            : "Release submitted to Too Lost successfully.",

        status:
          "pending",

        reviewAttached:
          hasReviewInformation,

        review:
          hasReviewInformation
            ? {
                note:
                  Boolean(
                    reviewNote
                  ),

                file:
                  Boolean(
                    reviewFileUrl
                  ),

                fileName:
                  reviewFileName ||
                  null,
              }
            : null,

        release:
          directlyUpdatedRelease,

        tooLost:
          directSubmitData,

        reviewTooLost:
          reviewMetadataResponse,
      });
    }

    /*
    =====================================================
    OTHER ACTIONS
    =====================================================
    */

    const allowedActions: Action[] = [
      "reject",
      "draft",
      "takedown",
      "submit",
    ];

    if (
      !allowedActions.includes(action)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid release action.",
        },
        { status: 400 }
      );
    }

    /*
    =====================================================
    REJECT / TAKEDOWN REASON
    =====================================================
    */

    if (
      (
        action === "reject" ||
        action === "takedown"
      ) &&
      !note
    ) {
      return NextResponse.json(
        {
          success: false,

          error:
            action === "reject"
              ? "Rejection reason is required."
              : "Takedown reason is required.",
        },
        { status: 400 }
      );
    }

    const newStatus =
      getNewStatus(action);

    if (!newStatus) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to determine release status.",
        },
        { status: 400 }
      );
    }

    const adminNote =
      note ||
      (
        action === "reject"
          ? "Release rejected by admin."
          : action === "takedown"
          ? "Release taken down by admin."
          : null
      );

    /*
    =====================================================
    UPDATE LOCAL RELEASE
    =====================================================
    */

    const {
      data: updatedRelease,
      error: updateError,
    } = await supabaseAdmin
      .from("releases")
      .update({
        status:
          newStatus,

        admin_note:
          adminNote,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          success: false,
          error:
            updateError.message,
        },
        { status: 500 }
      );
    }

    /*
    =====================================================
    NOTIFICATION
    =====================================================
    */

    if (releaseRow.user_id) {
      try {
        await supabaseAdmin
          .from("notifications")
          .insert({
            user_id:
              releaseRow.user_id,

            title:
              getNotificationTitle(
                action
              ),

            message:
              getNotificationMessage(
                releaseRow.title ||
                  "Untitled",
                newStatus,
                note
              ),

            type:
              newStatus,

            is_read:
              false,
          });
      } catch (error) {
        console.error(
          "Notification error:",
          error
        );
      }
    }

    let message =
      "Release updated successfully.";

    switch (action) {
      case "reject":
        message =
          "Release rejected successfully.";
        break;

      case "draft":
        message =
          "Release moved back to draft.";
        break;

      case "takedown":
        message =
          "Release marked for takedown.";
        break;

      case "submit":
        message =
          "Release moved to pending review.";
        break;
    }

    return NextResponse.json({
      success: true,

      message,

      release:
        updatedRelease,

      status:
        newStatus,
    });
  } catch (error) {
    console.error(
      "Admin release action error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Internal server error.",
      },
      { status: 500 }
    );
  }
}

/*
=========================================================
NOTIFICATION HELPERS
=========================================================
*/

function getNotificationTitle(
  action: Action
) {
  switch (action) {
    case "reject":
      return "Release Rejected";

    case "draft":
      return "Release Moved to Draft";

    case "takedown":
      return "Release Takedown";

    case "submit":
      return "Release Submitted";

    default:
      return "Release Updated";
  }
}

function getNotificationMessage(
  title: string,
  status: string,
  note: string
) {
  let message =
    `Your release "${title}" status has been updated to ${status}.`;

  if (note) {
    message +=
      ` Admin note: ${note}`;
  }

  return message;
}