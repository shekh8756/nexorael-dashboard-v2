import { NextResponse } from "next/server";
import crypto from "crypto";

function base64Url(buffer: Buffer) {
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
        error: "Too Lost environment variables are missing",
      },
      { status: 500 }
    );
  }

  const state = base64Url(crypto.randomBytes(32));
  const codeVerifier = base64Url(crypto.randomBytes(32));

  const codeChallenge = base64Url(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:profile",
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
    maxAge: 600,
    path: "/",
  });

  response.cookies.set("toolost_code_verifier", codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}