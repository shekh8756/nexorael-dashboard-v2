"use client";

import { useEffect, useState } from "react";

type Status = "idle" | "connecting" | "success" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Successful OAuth callback
    const toolostStatus = params.get("toolost");

    if (toolostStatus === "connected") {
      setStatus("success");
      setMessage("Too Lost connected successfully!");

      // Clean URL
      window.history.replaceState({}, "", "/");
      return;
    }

    // OAuth error returned by Too Lost
    const oauthError = params.get("error");

    if (oauthError) {
      setStatus("error");
      setMessage(
        params.get("error_description") ||
          `Too Lost authorization failed: ${oauthError}`
      );

      window.history.replaceState({}, "", "/");
      return;
    }

    // OAuth authorization code
    const code = params.get("code");
    const state = params.get("state");

    if (!code || !state) {
      return;
    }

    async function finishOAuth(
      oauthCode: string,
      oauthState: string
    ) {
      try {
        setStatus("connecting");
        setMessage("Connecting to Too Lost...");

        const callbackUrl =
          `/api/toolost/callback?code=${encodeURIComponent(
            oauthCode
          )}` +
          `&state=${encodeURIComponent(oauthState)}`;

        const response = await fetch(callbackUrl, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          redirect: "manual",
        });

        /*
         * The callback route normally returns a redirect.
         * Because redirect is manual, we handle it ourselves.
         */
        if (
          response.status >= 300 &&
          response.status < 400
        ) {
          const location =
            response.headers.get("location");

          if (location) {
            const redirectUrl = new URL(
              location,
              window.location.origin
            );

            if (
              redirectUrl.searchParams.get("toolost") ===
              "connected"
            ) {
              setStatus("success");
              setMessage(
                "Too Lost connected successfully!"
              );

              window.history.replaceState({}, "", "/");
              return;
            }

            window.location.href =
              redirectUrl.toString();
            return;
          }
        }

        const contentType =
          response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(
              typeof data?.error === "string"
                ? data.error
                : "Too Lost connection failed"
            );
          }

          setStatus("success");
          setMessage(
            "Too Lost connected successfully!"
          );

          window.history.replaceState({}, "", "/");
          return;
        }

        const text = await response.text();

        if (!response.ok) {
          throw new Error(
            text || "Too Lost connection failed"
          );
        }

        setStatus("success");
        setMessage(
          "Too Lost connected successfully!"
        );

        window.history.replaceState({}, "", "/");
      } catch (error) {
        console.error(
          "Too Lost OAuth error:",
          error
        );

        setStatus("error");

        setMessage(
          error instanceof Error
            ? error.message
            : "Too Lost connection failed"
        );

        window.history.replaceState({}, "", "/");
      }
    }

    // At this point TypeScript knows both are strings
    finishOAuth(code, state);
  }, []);

  function connectTooLost() {
    setStatus("connecting");
    setMessage("Opening Too Lost...");

    window.location.href = "/api/toolost/auth";
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-8 text-center shadow-2xl">
        <h1 className="text-3xl font-bold mb-3">
          Nexorael Music
        </h1>

        <p className="text-zinc-400 mb-8">
          Music Distribution Dashboard
        </p>

        <button
          onClick={connectTooLost}
          disabled={status === "connecting"}
          className="w-full rounded-xl bg-white px-6 py-4 font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
        >
          {status === "connecting"
            ? "Connecting..."
            : "Connect Too Lost"}
        </button>

        {message && (
          <div
            className={`mt-6 rounded-xl p-4 text-sm ${
              status === "success"
                ? "bg-green-500/10 text-green-400"
                : status === "error"
                ? "bg-red-500/10 text-red-400"
                : "bg-blue-500/10 text-blue-400"
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </main>
  );
}