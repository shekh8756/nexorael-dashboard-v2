import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  cookies,
} from "next/headers";

import {
  exchangeTooLostCode,
} from "@/lib/toolost";

import {
  saveTooLostMasterTokens,
} from "@/lib/toolost-master";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET(
  request: NextRequest
) {
  try {
    const {
      searchParams,
    } =
      new URL(
        request.url
      );

    const code =
      searchParams.get(
        "code"
      );

    const state =
      searchParams.get(
        "state"
      );

    const oauthError =
      searchParams.get(
        "error"
      );

    if (oauthError) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            searchParams.get(
              "error_description"
            ) ||
            `Too Lost OAuth error: ${oauthError}`,
        },
        {
          status: 400,
        }
      );
    }

    if (
      !code ||
      !state
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Missing OAuth code or state",
        },
        {
          status: 400,
        }
      );
    }

    const cookieStore =
      await cookies();

    const savedState =
      cookieStore.get(
        "toolost_oauth_state"
      )?.value;

    const codeVerifier =
      cookieStore.get(
        "toolost_code_verifier"
      )?.value;

    if (!savedState) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "OAuth state cookie is missing",
        },
        {
          status: 400,
        }
      );
    }

    if (
      savedState !==
      state
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "Invalid OAuth state",
        },
        {
          status: 400,
        }
      );
    }

    if (!codeVerifier) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "PKCE code verifier is missing",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Exchange admin/master OAuth code.
     */
    const tokenData =
      await exchangeTooLostCode(
        code,
        codeVerifier
      );

    console.log(
      "=== TOO LOST MASTER TOKEN ==="
    );

    console.log(
      "Scope:",
      tokenData.scope
    );

    console.log(
      "Expires in:",
      tokenData.expires_in
    );

    console.log(
      "Has refresh token:",
      Boolean(
        tokenData.refresh_token
      )
    );

    console.log(
      "============================="
    );

    /*
     * CRITICAL:
     * Save centrally in Supabase,
     * not in artist browser cookie.
     */
    await saveTooLostMasterTokens(
      tokenData
    );

    const response =
      NextResponse.redirect(
        new URL(
          "/admin?toolost=connected",
          request.url
        )
      );

    /*
     * Old browser access-token cookie
     * no longer required.
     */
    response.cookies.delete(
      "toolost_access_token"
    );

    response.cookies.delete(
      "toolost_oauth_state"
    );

    response.cookies.delete(
      "toolost_code_verifier"
    );

    return response;
  } catch (error) {
    console.error(
      "Too Lost OAuth callback error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Too Lost OAuth callback failed",
      },
      {
        status: 500,
      }
    );
  }
}