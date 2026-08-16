import { NextResponse } from "next/server";
import crypto from "crypto";
import { getTooLostConfig } from "@/lib/toolost";

function base64Url(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function GET() {
  try {
    const config = getTooLostConfig();

    // OAuth state
    const state = base64Url(
      crypto.randomBytes(32)
    );

    // PKCE verifier
    const codeVerifier = base64Url(
      crypto.randomBytes(32)
    );

    // PKCE challenge
    const codeChallenge = base64Url(
      crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest()
    );

    const authorizeUrl =
      process.env.TOOLOST_AUTHORIZE_URL;

    if (!authorizeUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "TOOLOST_AUTHORIZE_URL is missing",
        },
        { status: 500 }
      );
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",

      // Current Too Lost permission configured
      scope: "read:profile",

      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const response = NextResponse.redirect(
      `${authorizeUrl}?${params.toString()}`
    );

    response.cookies.set(
      "toolost_oauth_state",
      state,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60,
        path: "/",
      }
    );

    response.cookies.set(
      "toolost_code_verifier",
      codeVerifier,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60,
        path: "/",
      }
    );

    return response;
  } catch (error) {
    console.error(
      "Too Lost auth error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to start Too Lost OAuth",
      },
      { status: 500 }
    );
  }
}