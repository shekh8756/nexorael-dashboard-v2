import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeTooLostCode } from "@/lib/toolost";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const oauthError = searchParams.get("error");

    // Too Lost returned an OAuth error
    if (oauthError) {
      return NextResponse.json(
        {
          success: false,
          error:
            searchParams.get("error_description") ||
            `Too Lost OAuth error: ${oauthError}`,
        },
        { status: 400 }
      );
    }

    // Authorization code/state required
    if (!code || !state) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing OAuth code or state",
        },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();

    const savedState =
      cookieStore.get("toolost_oauth_state")?.value;

    const codeVerifier =
      cookieStore.get("toolost_code_verifier")?.value;

    // Check OAuth state
    if (!savedState) {
      return NextResponse.json(
        {
          success: false,
          error: "OAuth state cookie is missing",
        },
        { status: 400 }
      );
    }

    if (savedState !== state) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid OAuth state",
        },
        { status: 400 }
      );
    }

    // Check PKCE verifier
    if (!codeVerifier) {
      return NextResponse.json(
        {
          success: false,
          error: "PKCE code verifier is missing",
        },
        { status: 400 }
      );
    }

    // Exchange authorization code for access token
    const tokenData = await exchangeTooLostCode(
      code,
      codeVerifier
    );

    console.log("=== TOOLOST TOKEN DEBUG ===");
console.log("Token type:", tokenData.token_type);
console.log("Token scope:", tokenData.scope);
console.log("Expires in:", tokenData.expires_in);
console.log("Has refresh token:", !!tokenData.refresh_token);
console.log("===========================");

    // Save access token securely in HTTP-only cookie
    const response = NextResponse.redirect(
      new URL(
        "/?toolost=connected",
        request.url
      )
    );

    response.cookies.set(
      "toolost_access_token",
      tokenData.access_token,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      }
    );

    // Remove temporary OAuth cookies
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
      { status: 500 }
    );
  }
}