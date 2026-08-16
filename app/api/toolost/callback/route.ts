import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: `Too Lost OAuth error: ${error}`,
        },
        { status: 400 }
      );
    }

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

    const savedState = cookieStore.get("toolost_oauth_state")?.value;
    const codeVerifier =
      cookieStore.get("toolost_code_verifier")?.value;

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

    if (!codeVerifier) {
      return NextResponse.json(
        {
          success: false,
          error: "PKCE code verifier is missing",
        },
        { status: 400 }
      );
    }

    const clientId = process.env.TOOLOST_CLIENT_ID;
    const clientSecret = process.env.TOOLOST_CLIENT_SECRET;
    const tokenUrl = process.env.TOOLOST_TOKEN_URL;
    const redirectUri = process.env.TOOLOST_REDIRECT_URI;

    if (
      !clientId ||
      !clientSecret ||
      !tokenUrl ||
      !redirectUri
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Too Lost OAuth environment variables are missing",
        },
        { status: 500 }
      );
    }

    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: codeVerifier,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: tokenBody.toString(),
      cache: "no-store",
    });

    const tokenText = await tokenResponse.text();

    console.log("TOOLOST TOKEN STATUS:", tokenResponse.status);
console.log("TOOLOST TOKEN RESPONSE:", tokenText);

    if (!tokenResponse.ok) {
      console.error("Too Lost token exchange failed:", tokenText);

      return NextResponse.json(
        {
          success: false,
          error: "Too Lost token exchange failed",
          details: tokenText,
        },
        { status: 400 }
      );
    }

    let tokenData: any;

    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid token response from Too Lost",
        },
        { status: 500 }
      );
    }

    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Too Lost did not return an access token",
        },
        { status: 400 }
      );
    }

    const response = NextResponse.redirect(
  new URL("/?toolost=connected", request.url)
);

    response.cookies.set(
      "toolost_access_token",
      accessToken,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      }
    );

    response.cookies.delete("toolost_oauth_state");
    response.cookies.delete("toolost_code_verifier");

    return response;
  } catch (error) {
    console.error("Too Lost OAuth callback error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal OAuth error",
      },
      { status: 500 }
    );
  }
}