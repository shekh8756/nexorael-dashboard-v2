import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getTooLostMasterAccessToken,
} from "@/lib/toolost-master";

import {
  supabaseAdmin,
} from "@/lib/supabase-admin";

import {
  tooLostApi,
} from "@/lib/toolost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ADMIN_ROLES = [
  "master_admin",
  "admin",
  "white_label_admin",
];

/* ======================================================
   HELPERS
====================================================== */

function unwrap(value: any) {
  return (
    value?.data?.data ??
    value?.data ??
    value
  );
}

function clean(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function normalizeReleaseType(
  value: unknown
) {
  const type =
    clean(value)
      .toLowerCase();

  if (type === "album") {
    return "Album";
  }

  if (type === "ep") {
    return "EP";
  }

  return "Single";
}

/* ======================================================
   AUTHORIZATION
====================================================== */

async function authorizeAdmin(
  request: NextRequest
) {
  /*
   * Browser must send:
   *
   * Authorization: Bearer <Supabase access token>
   */

  const authorization =
    request.headers.get(
      "authorization"
    );

  if (
    !authorization ||
    !authorization
      .toLowerCase()
      .startsWith(
        "bearer "
      )
  ) {
    return {
      ok: false as const,

      response:
        NextResponse.json(
          {
            success: false,
            error:
              "Authentication required.",
          },
          {
            status: 401,
          }
        ),
    };
  }

  const accessToken =
    authorization
      .slice(7)
      .trim();

  if (!accessToken) {
    return {
      ok: false as const,

      response:
        NextResponse.json(
          {
            success: false,
            error:
              "Authentication token is missing.",
          },
          {
            status: 401,
          }
        ),
    };
  }

  /*
   * Verify the Supabase JWT.
   *
   * IMPORTANT:
   * We do not trust user_id sent by frontend.
   */

  const {
    data: userData,
    error: userError,
  } =
    await supabaseAdmin.auth
      .getUser(
        accessToken
      );

  if (
    userError ||
    !userData.user
  ) {
    console.error(
      "Bulk upload authentication failed:",
      userError
    );

    return {
      ok: false as const,

      response:
        NextResponse.json(
          {
            success: false,
            error:
              "Invalid or expired session.",
          },
          {
            status: 401,
          }
        ),
    };
  }

  const user =
    userData.user;

  /*
   * Get role from our own database.
   *
   * Never trust role from frontend.
   */

  const {
    data: profile,
    error: profileError,
  } =
    await supabaseAdmin
      .from(
        "profiles"
      )
      .select(
        "id, role, status, white_label_id"
      )
      .eq(
        "id",
        user.id
      )
      .maybeSingle();

  if (profileError) {
    console.error(
      "Bulk upload profile lookup failed:",
      profileError
    );

    return {
      ok: false as const,

      response:
        NextResponse.json(
          {
            success: false,
            error:
              "Unable to verify admin account.",
          },
          {
            status: 500,
          }
        ),
    };
  }

  if (!profile) {
    return {
      ok: false as const,

      response:
        NextResponse.json(
          {
            success: false,
            error:
              "Admin profile not found.",
          },
          {
            status: 403,
          }
        ),
    };
  }

  const role =
    clean(
      profile.role
    );

  if (
    !ALLOWED_ADMIN_ROLES.includes(
      role
    )
  ) {
    console.warn(
      "Bulk upload denied:",
      {
        userId:
          user.id,
        role,
      }
    );

    return {
      ok: false as const,

      response:
        NextResponse.json(
          {
            success: false,
            error:
              "Admin permission required.",
          },
          {
            status: 403,
          }
        ),
    };
  }

  /*
   * Optional account-status protection.
   *
   * Only reject when status explicitly
   * represents a blocked account.
   */

  const status =
    clean(
      profile.status
    ).toLowerCase();

  if (
    [
      "blocked",
      "disabled",
      "suspended",
      "inactive",
    ].includes(status)
  ) {
    return {
      ok: false as const,

      response:
        NextResponse.json(
          {
            success: false,
            error:
              "This admin account is not active.",
          },
          {
            status: 403,
          }
        ),
    };
  }

  return {
    ok: true as const,

    user,

    profile,
  };
}

/* ======================================================
   POST
====================================================== */

export async function POST(
  request: NextRequest
) {
  try {
    /*
     * =========================================
     * 1. VERIFY NEXORAEL ADMIN
     * =========================================
     */

    const authorization =
      await authorizeAdmin(
        request
      );

    if (
      !authorization.ok
    ) {
      return authorization.response;
    }

    const {
      user,
      profile,
    } =
      authorization;

    /*
     * =========================================
     * 2. READ BODY
     * =========================================
     */

    let body: any;

    try {
      body =
        await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid JSON request body.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Support both:
     *
     * camelCase
     * and
     * CSV snake_case
     */

    const title =
      clean(
        body?.title
      );

    const artistName =
      clean(
        body?.artistName ??
          body?.artist_name
      );

    const label =
      clean(
        body?.label ??
          body?.labelName ??
          body?.label_name
      );

    const type =
      normalizeReleaseType(
        body?.type ??
          body?.releaseType ??
          body?.release_type
      );

    const role =
      clean(
        body?.role ||
          "primary"
      );

    const artistId =
      body?.artistId ??
      body?.artist_id ??
      null;

    const genre =
      clean(
        body?.genre
      );

    const subgenre =
      clean(
        body?.subgenre
      );

    const language =
      clean(
        body?.language
      );

    const releaseDate =
      clean(
        body?.releaseDate ??
          body?.release_date
      );

    const originalReleaseDate =
      clean(
        body?.originalReleaseDate ??
          body?.original_release_date
      );

    const catalogNumber =
      clean(
        body?.catalogNumber ??
          body?.catalog_number
      );

    const upc =
      clean(
        body?.upc
      );

    const cLine =
      clean(
        body?.cLine ??
          body?.c_line
      );

    const pLine =
      clean(
        body?.pLine ??
          body?.p_line
      );

    const isrc =
      clean(
        body?.isrc
      );

    const composer =
      clean(
        body?.composer
      );

    const lyricist =
      clean(
        body?.lyricist
      );

    const explicit =
      Boolean(
        body?.explicit
      );

    /*
     * =========================================
     * 3. VALIDATION
     * =========================================
     */

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Release title is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!artistName) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Artist name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!label) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Label name is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * =========================================
     * 4. TOO LOST MASTER TOKEN
     * =========================================
     *
     * Supabase user token is ONLY for
     * Nexorael authentication.
     *
     * Too Lost still uses the private
     * central Nexorael master connection.
     * =========================================
     */

    const tooLostAccessToken =
      await getTooLostMasterAccessToken();

    if (
      !tooLostAccessToken
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Too Lost master connection is unavailable.",
        },
        {
          status: 503,
        }
      );
    }

    /*
     * =========================================
     * 5. PARTICIPANT
     * =========================================
     */

    const participant:
      Record<
        string,
        unknown
      > = {
      name:
        artistName,

      role: [
        role ||
          "primary",
      ],
    };

    if (
      artistId !==
        null &&
      artistId !==
        undefined &&
      String(
        artistId
      ).trim()
    ) {
      const numericArtistId =
        Number(
          artistId
        );

      if (
        Number.isFinite(
          numericArtistId
        )
      ) {
        participant.artistId =
          numericArtistId;
      }
    }

    /*
     * =========================================
     * 6. CREATE TOO LOST RELEASE
     * =========================================
     */

    const releaseBody:
      Record<
        string,
        unknown
      > = {
      type,

      title,

      participants: [
        participant,
      ],
    };

    if (label) {
      releaseBody.label =
        label;
    }

    console.log(
      "Bulk Too Lost release creation:",
      {
        adminUserId:
          user.id,

        adminRole:
          profile.role,

        title,

        artistName,

        type,
      }
    );

    const createdResult =
      await tooLostApi(
        tooLostAccessToken,

        "/releases",

        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body:
            JSON.stringify(
              releaseBody
            ),
        }
      );

    if (
      !createdResult
        .response.ok
    ) {
      const errorData =
        createdResult.data as any;

      return NextResponse.json(
        {
          success: false,

          status:
            createdResult
              .response.status,

          step:
            "create_release",

          error:
            errorData?.message ||
            errorData?.error ||
            "Too Lost rejected release creation.",

          tooLostResponse:
            createdResult.data,
        },

        {
          status:
            createdResult
              .response.status,
        }
      );
    }

    const created =
      unwrap(
        createdResult.data
      );

    const releaseId =
      created?.id;

    if (!releaseId) {
      return NextResponse.json(
        {
          success: false,

          error:
            "Too Lost did not return a release ID.",

          tooLostResponse:
            createdResult.data,
        },

        {
          status: 502,
        }
      );
    }

    /*
     * =========================================
     * 7. BASIC TOO LOST METADATA
     * =========================================
     *
     * Keep the same field names that your
     * existing working create route uses.
     *
     * Full camelCase metadata + artwork +
     * C/P line is sent afterwards through:
     *
     * /api/toolost/releases/metadata
     * =========================================
     */

    const metadata:
      Record<
        string,
        unknown
      > = {};

    if (label) {
      metadata.label =
        label;
    }

    if (genre) {
      metadata.genre =
        genre;
    }

    if (subgenre) {
      metadata.subgenre =
        subgenre;
    }

    if (language) {
      metadata.language =
        language;
    }

    if (releaseDate) {
      metadata.release_date =
        releaseDate;
    }

    if (
      originalReleaseDate
    ) {
      metadata.original_release_date =
        originalReleaseDate;
    }

    if (catalogNumber) {
      metadata.catalog_number =
        catalogNumber;
    }

    if (upc) {
      metadata.upc =
        upc;
    }

    if (
      Object.keys(
        metadata
      ).length >
      0
    ) {
      const metadataResult =
        await tooLostApi(
          tooLostAccessToken,

          `/releases/${encodeURIComponent(
            String(
              releaseId
            )
          )}/metadata`,

          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body:
              JSON.stringify(
                metadata
              ),
          }
        );

      if (
        !metadataResult
          .response.ok
      ) {
        const errorData =
          metadataResult.data as any;

        return NextResponse.json(
          {
            success: false,

            status:
              metadataResult
                .response.status,

            step:
              "metadata",

            releaseId:
              String(
                releaseId
              ),

            error:
              errorData?.message ||
              errorData?.error ||
              "Too Lost rejected release metadata.",

            tooLostResponse:
              metadataResult.data,
          },

          {
            status:
              metadataResult
                .response.status,
          }
        );
      }
    }

    /*
     * =========================================
     * 8. FETCH AUTHORITATIVE TOO LOST RELEASE
     * =========================================
     */

    let authoritative =
      created;

    try {
      const refreshed =
        await tooLostApi(
          tooLostAccessToken,

          `/releases/${encodeURIComponent(
            String(
              releaseId
            )
          )}`,

          {
            method:
              "GET",
          }
        );

      if (
        refreshed
          .response.ok
      ) {
        authoritative =
          unwrap(
            refreshed.data
          );
      }
    } catch (
      refreshError
    ) {
      console.warn(
        "Bulk Too Lost release refresh failed:",
        refreshError
      );
    }

    /*
     * =========================================
     * SUCCESS
     * =========================================
     */

    return NextResponse.json({
      success: true,

      releaseId:
        String(
          releaseId
        ),

      data:
        authoritative,

      /*
       * Nexorael identity is determined
       * server-side, not accepted from browser.
       */
      nexorael: {
        userId:
          user.id,

        whiteLabelId:
          profile
            .white_label_id ||
          null,

        role:
          profile.role,
      },

      /*
       * Keep metadata useful to bulk frontend.
       */
      bulkMetadata: {
        title,

        artistName,

        label,

        type,

        genre:
          genre ||
          null,

        subgenre:
          subgenre ||
          null,

        language:
          language ||
          null,

        releaseDate:
          releaseDate ||
          null,

        originalReleaseDate:
          originalReleaseDate ||
          null,

        catalogNumber:
          catalogNumber ||
          null,

        upc:
          upc ||
          null,

        cLine:
          cLine ||
          null,

        pLine:
          pLine ||
          null,

        isrc:
          isrc ||
          null,

        composer:
          composer ||
          null,

        lyricist:
          lyricist ||
          null,

        explicit,
      },
    });
  } catch (
    error
  ) {
    console.error(
      "Bulk Too Lost create release error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof
          Error
            ? error.message
            : "Failed to create Too Lost release.",
      },

      {
        status: 500,
      }
    );
  }
}