"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState<
    "idle" | "connecting" | "success" | "error"
  >("idle");

  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const toolostStatus = params.get("toolost");
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    // Successful OAuth callback
    if (toolostStatus === "connected") {
      setStatus("success");
      setMessage("Too Lost connected successfully!");

      // Remove query parameter from browser URL
      window.history.replaceState({}, "", "/");
      return;
    }

    // OAuth provider returned an error
    if (error) {
      setStatus("error");
      setMessage(
        errorDescription ||
          `Too Lost authorization failed: ${error}`
      );

      window.history.replaceState({}, "", "/");
      return;
    }
  }, []);

  function connectTooLost() {
    setStatus("connecting");
    setMessage("Opening Too Lost...");

    // Start OAuth
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