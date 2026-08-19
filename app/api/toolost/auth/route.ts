import { NextResponse } from "next/server";
import crypto from "crypto";

function base64UrlEncode(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function GET() {
  const clientId = process.env.TOOLOST_CLIENT_ID;
  const authorizeUrl = process.env.TOOLOST_AUTHORIZE_URL;
  const redirectUri = process.env.TOOLOST_REDIRECT_URI;

  if (!clientId || !authorizeUrl || !redirectUri) {
    return NextResponse.json(
      {
        success: false,
        error: "Too Lost OAuth environment variables are missing",
      },
      { status: 500 }
    );
  }

  // OAuth state
  const state = base64UrlEncode(crypto.randomBytes(32));

  // PKCE verifier
  const codeVerifier = base64UrlEncode(crypto.randomBytes(32));

  // PKCE challenge
  const codeChallenge = base64UrlEncode(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",

    // Too Lost permissions
    scope:
  "read:profile read:releases write:releases read:sales read:analytics",

    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const response = NextResponse.redirect(
    `${authorizeUrl}?${params.toString()}`
  );

  response.cookies.set("toolost_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });

  response.cookies.set("toolost_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });

  return response;
}