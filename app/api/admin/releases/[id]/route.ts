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
async function getTooLostPlatforms(accessToken: string) {
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

  const root =
    data &&
    typeof data === "object"
      ? data as any
      : {};

  let platforms: any[] = [];

if (Array.isArray(root)) {
  platforms = root;
} else if (Array.isArray(root.data)) {
  platforms = root.data;
} else if (
  root.data &&
  typeof root.data === "object" &&
  Array.isArray(root.data.platforms)
) {
  platforms = root.data.platforms;
} else if (Array.isArray(root.platforms)) {
  platforms = root.platforms;
} else if (
  root.result &&
  Array.isArray(root.result)
) {
  platforms = root.result;
} else if (
  root.results &&
  Array.isArray(root.results)
) {
  platforms = root.results;
}

console.log(
  "========== TOO LOST PLATFORMS =========="
);

console.log(
  "Total platforms:",
  platforms.length
);

console.log(
  "Platforms:",
  platforms.map((platform: any) => ({
    id: getPlatformId(platform),
    name: getPlatformName(platform),
    raw: platform,
  }))
);

console.log(
  "========================================"
);

  return platforms;
}
/**
 * =========================================================
 * TOO LOST PLATFORM HELPERS
 * =========================================================
 */

/**
 * Get actual Too Lost platform ID.
 * Supports different API response shapes.
 */
function getPlatformId(platform: any): string | null {
  const id =
    platform?.id ??
    platform?.platform_id ??
    platform?.platformId ??
    platform?.store_id ??
    platform?.storeId ??
    platform?.uuid ??
    platform?.value ??
    platform?.platform?.id ??
    platform?.store?.id ??
    platform?.data?.id ??
    null;

  if (
    id === null ||
    id === undefined ||
    String(id).trim() === ""
  ) {
    return null;
  }

  return String(id).trim();
}

/**
 * Get platform name from Too Lost response.
 *
 * Too Lost can return different structures,
 * so we check all common fields and nested objects.
 */
function getPlatformName(platform: any): string {
  const possibleNames = [
    platform?.name,
    platform?.title,
    platform?.label,
    platform?.slug,
    platform?.platform_name,
    platform?.platformName,
    platform?.store_name,
    platform?.storeName,
    platform?.service_name,
    platform?.serviceName,
    platform?.display_name,
    platform?.displayName,
    platform?.code,
    platform?.platform_code,
    platform?.store_code,
    platform?.key,

    platform?.platform?.name,
    platform?.platform?.title,
    platform?.platform?.label,
    platform?.platform?.slug,
    platform?.platform?.platform_name,
    platform?.platform?.code,

    platform?.store?.name,
    platform?.store?.title,
    platform?.store?.label,
    platform?.store?.slug,
    platform?.store?.code,

    platform?.data?.name,
    platform?.data?.title,
    platform?.data?.label,
    platform?.data?.slug,
    platform?.data?.code,
  ];

  for (const value of possibleNames) {
    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return "";
}

/**
 * Normalize platform names.
 *
 * Example:
 * "Apple Music"       -> "applemusic"
 * "YouTube Music"     -> "youtubemusic"
 * "AudioMack"         -> "audiomack"
 * "Instagram / Facebook" -> "instagramfacebook"
 */
function normalizePlatformName(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Get ALL possible searchable names from a Too Lost platform.
 *
 * This is important because Too Lost may return:
 *
 * {
 *   id: "...",
 *   platform: {
 *     name: "Audiomack"
 *   }
 * }
 *
 * or:
 *
 * {
 *   id: "...",
 *   store_name: "Audiomack"
 * }
 *
 * or another supported structure.
 */
function getPlatformSearchNames(
  platform: any
): string[] {
  const values: unknown[] = [
    platform?.name,
    platform?.title,
    platform?.label,
    platform?.slug,

    platform?.platform_name,
    platform?.platformName,
    platform?.platform_code,

    platform?.store_name,
    platform?.storeName,
    platform?.store_code,

    platform?.service_name,
    platform?.serviceName,

    platform?.display_name,
    platform?.displayName,

    platform?.code,
    platform?.key,

    platform?.platform,
    platform?.store,
    platform?.service,

    platform?.platform?.name,
    platform?.platform?.title,
    platform?.platform?.label,
    platform?.platform?.slug,
    platform?.platform?.code,
    platform?.platform?.platform_name,
    platform?.platform?.platformName,

    platform?.store?.name,
    platform?.store?.title,
    platform?.store?.label,
    platform?.store?.slug,
    platform?.store?.code,

    platform?.data?.name,
    platform?.data?.title,
    platform?.data?.label,
    platform?.data?.slug,
    platform?.data?.code,
  ];

  return values
    .filter(
      (value): value is string =>
        typeof value === "string" &&
        value.trim().length > 0
    )
    .map(normalizePlatformName)
    .filter(Boolean);
}

/**
 * DSP aliases.
 *
 * Left side = our dashboard DSP name.
 * Right side = possible Too Lost names.
 */
const DSP_ALIASES: Record<string, string[]> = {
  spotify: [
    "spotify",
  ],

  applemusic: [
    "applemusic",
    "apple",
    "itunes",
    "itunesstore",
    "applemusicstore",
  ],

  youtubemusic: [
    "youtubemusic",
    "youtube",
    "ytmusic",
    "youtubeofficial",
  ],

  amazonmusic: [
    "amazonmusic",
    "amazon",
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

  instagramfacebook: [
    "instagram",
    "facebook",
    "instagramfacebook",
    "facebookinstagram",
    "meta",
    "metamusic",
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
 * Match our dashboard DSP with a real Too Lost platform.
 *
 * IMPORTANT:
 * We return the COMPLETE Too Lost platform object,
 * not a fake ID.
 */
function matchTooLostPlatform(
  selectedName: string,
  platforms: any[]
) {
  const selectedNormalized =
    normalizePlatformName(selectedName);

  if (!selectedNormalized) {
    return null;
  }

  const aliases =
    DSP_ALIASES[selectedNormalized] || [
      selectedNormalized,
    ];

  const normalizedAliases =
    aliases.map(normalizePlatformName);

  /*
   * =====================================================
   * PASS 1
   * Exact match
   * =====================================================
   */
  for (const platform of platforms) {
    const platformNames =
      getPlatformSearchNames(platform);

    const exactMatch =
      platformNames.some((platformName) =>
        normalizedAliases.includes(
          platformName
        )
      );

    if (exactMatch) {
      console.log(
        "Too Lost platform EXACT matched:",
        selectedName,
        "=>",
        getPlatformName(platform),
        "ID:",
        getPlatformId(platform)
      );

      return platform;
    }
  }

  /*
   * =====================================================
   * PASS 2
   * Partial match
   * =====================================================
   */
  for (const platform of platforms) {
    const platformNames =
      getPlatformSearchNames(platform);

    const partialMatch =
      platformNames.some((platformName) =>
        normalizedAliases.some(
          (alias) =>
            platformName.includes(alias) ||
            alias.includes(platformName)
        )
      );

    if (partialMatch) {
      console.log(
        "Too Lost platform PARTIAL matched:",
        selectedName,
        "=>",
        getPlatformName(platform),
        "ID:",
        getPlatformId(platform)
      );

      return platform;
    }
  }

  /*
   * =====================================================
   * PASS 3
   * Token-based fallback
   *
   * Example:
   * "audiomack music" -> audiomack
   * "apple music store" -> apple
   * =====================================================
   */
  const selectedTokens =
    selectedNormalized
      .split(/(?=[a-z])/)
      .filter(Boolean);

  for (const platform of platforms) {
    const platformNames =
      getPlatformSearchNames(platform);

    for (const platformName of platformNames) {
      if (
        selectedTokens.some(
          (token) =>
            token.length >= 4 &&
            platformName.includes(token)
        )
      ) {
        console.log(
          "Too Lost platform TOKEN matched:",
          selectedName,
          "=>",
          getPlatformName(platform),
          "ID:",
          getPlatformId(platform)
        );

        return platform;
      }
    }
  }

  console.warn(
    "Too Lost platform NOT matched:",
    selectedName
  );

  console.warn(
    "Available Too Lost platforms:",
    platforms.map((platform) => ({
      id: getPlatformId(platform),
      name: getPlatformName(platform),
      searchableNames:
        getPlatformSearchNames(platform),
    }))
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

  const platformId =
    getPlatformId(matched);

  const platformName =
    getPlatformName(matched);

  if (!platformId) {
    console.warn(
      "Matched Too Lost platform has no ID:",
      matched
    );

    continue;
  }

  if (!platformName) {
    console.warn(
      "Matched Too Lost platform has no name:",
      matched
    );

    continue;
  }

  selectedRows.push({
    release_id: id,
    dsp_name: platformName,
    toolost_platform_id: platformId,
    status: "selected",
  });

  console.log(
    "DSP SAVED:",
    {
      dashboardName: selectedName,
      toolostName: platformName,
      toolostPlatformId: platformId,
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