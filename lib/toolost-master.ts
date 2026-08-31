import { supabaseAdmin } from "@/lib/supabase-admin";

import {
  refreshTooLostAccessToken,
  TooLostTokenData,
} from "@/lib/toolost";

const MASTER_ID = "nexorael_master";

/* =========================================
   SAVE MASTER TOKENS
========================================= */

export async function saveTooLostMasterTokens(
  tokenData: TooLostTokenData
) {
  const expiresIn = Number(
    tokenData.expires_in || 3600
  );

  // Token ko actual expiry se 60 sec pehle expired
  // consider karenge, taaki API request beech me fail na ho.
  const expiresAt = new Date(
    Date.now() +
      Math.max(60, expiresIn - 60) * 1000
  ).toISOString();

  /*
   * Refresh response har baar naya refresh_token
   * return kare ye guaranteed nahi hai.
   * Isliye existing refresh token preserve karte hain.
   */
  const { data: existing, error: existingError } =
    await supabaseAdmin
      .from("toolost_oauth_tokens")
      .select("refresh_token")
      .eq("id", MASTER_ID)
      .maybeSingle();

  if (existingError) {
    throw new Error(
      `Unable to read existing Too Lost refresh token: ${existingError.message}`
    );
  }

  const refreshToken =
    tokenData.refresh_token ||
    existing?.refresh_token ||
    null;

  const { error } = await supabaseAdmin
    .from("toolost_oauth_tokens")
    .upsert(
      {
        id: MASTER_ID,
        access_token: tokenData.access_token,
        refresh_token: refreshToken,
        token_type: tokenData.token_type || "Bearer",
        scope: tokenData.scope || null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "id",
      }
    );

  if (error) {
    throw new Error(
      `Unable to save Too Lost master token: ${error.message}`
    );
  }
}

/* =========================================
   GET MASTER ACCESS TOKEN
========================================= */

export async function getTooLostMasterAccessToken(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("toolost_oauth_tokens")
    .select(
      "access_token, refresh_token, expires_at"
    )
    .eq("id", MASTER_ID)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to read Too Lost master token: ${error.message}`
    );
  }

  if (!data?.access_token) {
    throw new Error(
      "Nexorael Too Lost master account is not connected."
    );
  }

  const expiresAt = data.expires_at
    ? new Date(data.expires_at).getTime()
    : 0;

  /*
   * Token abhi valid hai.
   */
  if (
    Number.isFinite(expiresAt) &&
    expiresAt > Date.now() + 60_000
  ) {
    return String(data.access_token);
  }

  /*
   * Token expire ho gaya.
   * Server khud refresh karega.
   */
  if (!data.refresh_token) {
    throw new Error(
      "Too Lost master access token expired and no refresh token is stored. Admin must reconnect Too Lost once."
    );
  }

  const refreshed =
    await refreshTooLostAccessToken(
      String(data.refresh_token)
    );

  await saveTooLostMasterTokens(refreshed);

  return refreshed.access_token;
}