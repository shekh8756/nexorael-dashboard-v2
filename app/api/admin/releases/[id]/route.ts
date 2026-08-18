import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
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
  const cookieStore = await cookies();

  return cookieStore.get("toolost_access_token")?.value;
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
  const { response, data } =
    await tooLostApi(
      accessToken,
      "lookup/platforms",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

  console.log(
    "========== TOO LOST PLATFORMS =========="
  );

  console.log(
    "Status:",
    response.status
  );

  console.log(
    "Raw response:",
    JSON.stringify(
      data,
      null,
      2
    )
  );

  console.log(
    "========================================"
  );

  if (!response.ok) {
    throw new Error(
      `Unable to fetch Too Lost platforms (${response.status})`
    );
  }

  /*
   * Too Lost may return the list at different
   * nesting levels depending on the API response.
   */

  function findPlatformArray(
    value: any
  ): any[] {
    if (Array.isArray(value)) {
      return value;
    }

    if (
      !value ||
      typeof value !== "object"
    ) {
      return [];
    }

    const possibleKeys = [
      "data",
      "platforms",
      "stores",
      "items",
      "results",
    ];

    for (const key of possibleKeys) {
      const result =
        findPlatformArray(
          value[key]
        );

      if (result.length > 0) {
        return result;
      }
    }

    return [];
  }

  const platforms =
    findPlatformArray(data);

  console.log(
    "Too Lost platform count:",
    platforms.length
  );

  console.log(
    "Too Lost platforms:",
    platforms.map(
      (platform: any) => ({
        id:
          platform?.id ??
          platform?.platform_id ??
          platform?.store_id ??
          platform?.storeId ??
          platform?.platformId ??
          platform?.code ??
          platform?.key ??
          null,

        name:
          platform?.name ??
          platform?.title ??
          platform?.label ??
          platform?.display_name ??
          platform?.displayName ??
          platform?.slug ??
          platform?.code ??
          platform?.key ??
          "",
      })
    )
  );

  return platforms;
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
      const selectedDSPs = Array.isArray(body?.dsps)
        ? body.dsps
        : [];

      const accessToken = await getAccessToken();

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

      if (selectedDSPs.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Please select at least one DSP.",
          },
          { status: 400 }
        );
      }

      /*
      Get REAL Too Lost platforms.
      */

      const platforms =
        await getTooLostPlatforms(
          accessToken
        );

      /*
      Convert selected DSP names into
      actual Too Lost IDs.
      */

      const selectedRows: {
        release_id: string;
        dsp_name: string;
        toolost_platform_id: string;
        status: string;
      }[] = [];

for (const selected of selectedDSPs) {
  const selectedName =
    typeof selected === "string"
      ? selected.trim()
      : selected?.name?.trim();

  if (!selectedName) {
    continue;
  }

  console.log(
    "========================================"
  );

  console.log(
    "Trying to match DSP:",
    selectedName
  );

  const matched =
    matchTooLostPlatform(
      selectedName,
      platforms
    );

  if (!matched) {
    console.warn(
      "DSP could not be matched:",
      selectedName
    );

    continue;
  }

  /*
   * IMPORTANT:
   * First use the ID resolved by the
   * recursive matcher.
   */
  const platformId =
    matched.__resolved_platform_id ||
    getPlatformId(matched);

  const platformName =
    matched.__resolved_platform_name ||
    getPlatformName(matched);

  if (!platformId) {
    console.error(
      "Matched platform has NO Too Lost ID:",
      {
        selectedName,
        matched,
      }
    );

    continue;
  }

  if (!platformName) {
    console.error(
      "Matched platform has NO name:",
      {
        selectedName,
        matched,
      }
    );

    continue;
  }

  selectedRows.push({
    release_id: id,

    dsp_name:
      platformName,

    toolost_platform_id:
      String(platformId),

    status:
      "selected",
  });

  console.log(
    "DSP SAVED:",
    {
      dashboardName:
        selectedName,

      toolostName:
        platformName,

      toolostPlatformId:
        String(platformId),
    }
  );
}

      if (selectedRows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "None of the selected DSPs could be matched with Too Lost platforms.",
            availablePlatforms:
              platforms.map((platform: any) => ({
                id: getPlatformId(platform),
                name: getPlatformName(platform),
              })),
          },
          { status: 422 }
        );
      }

      /*
      Remove previous DSP selections.
      */

      const {
        error: deleteError,
      } = await supabaseAdmin
        .from("dsp_deliveries")
        .delete()
        .eq("release_id", id);

      if (deleteError) {
        return NextResponse.json(
          {
            success: false,
            error:
              deleteError.message,
          },
          { status: 500 }
        );
      }

      /*
      Save new DSP selections.
      */

      const {
        data: savedDSPs,
        error: insertError,
      } = await supabaseAdmin
        .from("dsp_deliveries")
        .insert(selectedRows)
        .select("*");

      if (insertError) {
        console.error(
          "DSP save error:",
          insertError
        );

        return NextResponse.json(
          {
            success: false,
            error:
              insertError.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message:
          "DSP selection saved successfully.",
        deliveries: savedDSPs,
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

      const formattedPlatforms =
        platforms
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
        toolost_release_id
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
            error:
              "Too Lost release ID is missing.",
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
      Get DSP selections saved in Supabase.
      */

      const {
        data: deliveries,
        error: deliveryDbError,
      } = await supabaseAdmin
        .from("dsp_deliveries")
        .select(
          "id,dsp_name,toolost_platform_id,status"
        )
        .eq("release_id", id);

      if (deliveryDbError) {
        return NextResponse.json(
          {
            success: false,
            error:
              deliveryDbError.message,
          },
          { status: 500 }
        );
      }

      if (
        !deliveries ||
        deliveries.length === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "No DSPs selected for this release. Please select DSPs before approving.",
          },
          { status: 400 }
        );
      }

      /*
      Actual Too Lost IDs.
      */

      const selectedPlatformIds =
        deliveries
          .map(
            (delivery: any) =>
              delivery.toolost_platform_id
          )
          .filter(Boolean)
          .map(String);

      if (
        selectedPlatformIds.length === 0
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Selected DSPs do not have valid Too Lost platform IDs.",
          },
          { status: 400 }
        );
      }

      /*
      ===================================================
      TOO LOST DELIVERY
      ===================================================
      */

      const deliveryPath =
        `releases/${releaseRow.toolost_release_id}/delivery`;

      const {
        response:
          deliveryResponse,
        data:
          deliveryData,
      } = await tooLostApi(
        accessToken,
        deliveryPath,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            stores:
              selectedPlatformIds,
          }),
        }
      );

      console.log(
        "Too Lost delivery status:",
        deliveryResponse.status
      );

      console.log(
        "Too Lost delivery response:",
        deliveryData
      );

      if (!deliveryResponse.ok) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Too Lost delivery configuration failed.",
            tooLostStatus:
              deliveryResponse.status,
            tooLostResponse:
              deliveryData,
          },
          { status: 422 }
        );
      }

      /*
      ===================================================
      TOO LOST SUBMIT
      ===================================================
      */

      const submitPath =
        `releases/${releaseRow.toolost_release_id}/submit`;

      const {
        response:
          toolostResponse,
        data:
          toolostData,
      } = await tooLostApi(
        accessToken,
        submitPath,
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
        "Too Lost submit status:",
        toolostResponse.status
      );

      console.log(
        "Too Lost submit response:",
        toolostData
      );

      /*
      IMPORTANT:
      Do not approve locally if Too Lost rejected.
      */

      if (!toolostResponse.ok) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Too Lost submission failed.",
            tooLostStatus:
              toolostResponse.status,
            tooLostResponse:
              toolostData,
          },
          { status: 422 }
        );
      }

      /*
      ===================================================
      TOO LOST SUCCESS
      ===================================================
      */

      const adminNote =
        note ||
        "Approved and submitted to Too Lost.";

      const {
        data: updatedRelease,
        error: updateError,
      } = await supabaseAdmin
        .from("releases")
        .update({
          status: "approved",
          admin_note: adminNote,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (updateError) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Too Lost submission succeeded, but local status update failed.",
            details:
              updateError.message,
          },
          { status: 500 }
        );
      }

      /*
      Mark DSP records as submitted.
      */

      await supabaseAdmin
        .from("dsp_deliveries")
        .update({
          status: "submitted",
          updated_at:
            new Date().toISOString(),
        })
        .eq("release_id", id);

      /*
      Notification.
      */

      if (releaseRow.user_id) {
        try {
          await supabaseAdmin
            .from("notifications")
            .insert({
              user_id:
                releaseRow.user_id,

              title:
                "Release Approved",

              message:
                `Your release "${releaseRow.title || "Untitled"}" has been approved and submitted to Too Lost.`,

              type: "approved",

              is_read: false,
            });
        } catch (error) {
          console.error(
            "Notification error:",
            error
          );
        }
      }

      return NextResponse.json({
        success: true,
        message:
          "Release approved and submitted to Too Lost successfully.",
        status: "approved",
        release:
          updatedRelease,
        tooLost:
          toolostData,
        dsps:
          deliveries,
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
    Reject / takedown reason.
    */

    if (
      (action === "reject" ||
        action === "takedown") &&
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
      (action === "reject"
        ? "Release rejected by admin."
        : action === "takedown"
          ? "Release taken down by admin."
          : null);

    const {
      data: updatedRelease,
      error: updateError,
    } = await supabaseAdmin
      .from("releases")
      .update({
        status: newStatus,
        admin_note: adminNote,
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
    Notification.
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

            type: newStatus,

            is_read: false,
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