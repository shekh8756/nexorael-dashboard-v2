const TOOLOST_API_URL =
  process.env.TOOLOST_API_URL ||
  "https://api-sandbox.toolost.com/v1";

const TOOLOST_TOKEN_URL =
  process.env.TOOLOST_TOKEN_URL ||
  "https://sandbox.toolost.com/oauth/token";

export function getTooLostConfig() {
  const clientId = process.env.TOOLOST_CLIENT_ID;
  const clientSecret = process.env.TOOLOST_CLIENT_SECRET;
  const redirectUri = process.env.TOOLOST_REDIRECT_URI;

  if (!clientId) {
    throw new Error("TOOLOST_CLIENT_ID is missing");
  }

  if (!clientSecret) {
    throw new Error("TOOLOST_CLIENT_SECRET is missing");
  }

  if (!redirectUri) {
    throw new Error("TOOLOST_REDIRECT_URI is missing");
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    tokenUrl: TOOLOST_TOKEN_URL,
    apiUrl: TOOLOST_API_URL,
  };
}

export async function exchangeTooLostCode(
  code: string,
  codeVerifier: string
) {
  const config = getTooLostConfig();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: codeVerifier,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const text = await response.text();

  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      raw: text,
    };
  }

  if (!response.ok) {
    console.error("Too Lost token exchange failed:", {
      status: response.status,
      response: data,
    });

    throw new Error(
      `Too Lost token exchange failed (${response.status})`
    );
  }

  if (
    !data ||
    typeof data !== "object" ||
    !("access_token" in data) ||
    typeof data.access_token !== "string"
  ) {
    throw new Error(
      "Too Lost token response did not contain an access token"
    );
  }

  return data as {
    access_token: string;
    token_type?: string;
    expires_in?: number;
    refresh_token?: string;
    scope?: string;
  };
}

export async function tooLostApi(
  accessToken: string,
  path: string,
  options: RequestInit = {}
) {
  const config = getTooLostConfig();

  const url = `${config.apiUrl.replace(/\/$/, "")}/${path.replace(
    /^\//,
    ""
  )}`;

  const headers = new Headers(options.headers);

  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");

  const response = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
  });

  const text = await response.text();

  let data: unknown;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = {
      raw: text,
    };
  }

  return {
    response,
    data,
  };
}