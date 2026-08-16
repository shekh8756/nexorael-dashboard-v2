import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const code = body.code;
    const state = body.state;

    if (!code || !state) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing OAuth code or state",
        },
        { status: 400 }
      );
    }

    const savedState =
      request.cookies.get("toolost_oauth_state")?.value;

    const codeVerifier =
      request.cookies.get("toolost_code_verifier")?.value;

    if (!savedState || state !== savedState) {
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
          error: "PKCE code verifier missing",
        },
        { status: 400 }
      );
    }

    const clientId = process.env.TOOLOST_CLIENT_ID;
    const clientSecret = process.env.TOOLOST_CLIENT_SECRET;
    const tokenUrl = process.env.TOOLOST_TOKEN_URL;
    const redirectUri = process.env.TOOLOST_REDIRECT_URI;
    const apiUrl = process.env.TOOLOST_API_URL;

    if (
      !clientId ||
      !clientSecret ||
      !tokenUrl ||
      !redirectUri ||
      !apiUrl
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Too Lost environment variables are missing",
        },
        { status: 500 }
      );
    }

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
        code_verifier: codeVerifier,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "token_exchange",
          error: tokenData,
        },
        { status: tokenResponse.status }
      );
    }

    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Too Lost did not return an access token",
        },
        { status: 500 }
      );
    }

    // Test the authenticated Too Lost account
    const meResponse = await fetch(`${apiUrl}/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const meData = await meResponse.json();

    if (!meResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          step: "profile_test",
          error: meData,
        },
        { status: meResponse.status }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: "Too Lost connected successfully",
      user: meData,
    });

    // Temporary secure browser storage.
    // Later we will move this to Supabase.
    response.cookies.set("toolost_access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    response.cookies.delete("toolost_oauth_state");
    response.cookies.delete("toolost_code_verifier");

    return response;
  } catch (error) {
    console.error("Too Lost OAuth error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal OAuth error",
      },
      { status: 500 }
    );
  }
}