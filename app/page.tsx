"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState<
    "idle" | "connecting" | "success" | "error"
  >("idle");

  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const code = params.get("code");
    const state = params.get("state");
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

    if (!code || !state) {
      return;
    }

    setStatus("connecting");
    setMessage("Connecting to Too Lost...");

    // Send the OAuth callback to the server.
    // The callback route is GET because Too Lost redirects
    // the browser back to this page with ?code=...&state=...
    const callbackUrl = `/api/toolost/callback?code=${encodeURIComponent(
      code
    )}&state=${encodeURIComponent(state)}`;

    window.location.href = callbackUrl;
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