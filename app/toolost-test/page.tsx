"use client";

import { useState } from "react";

export default function TooLostTestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function createTestRelease() {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/toolost/releases/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Nexorael API Test Release",
          type: "Single",
          label: "Nexorael",
          artistName: "MD SAHID MIYA",
          role: "primary",
        }),
      });

      const data = await response.json();

      setResult({
        httpStatus: response.status,
        ...data,
      });
    } catch (error) {
      setResult({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Request failed",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-900 p-8">
        <h1 className="text-3xl font-bold">
          Too Lost API Test
        </h1>

        <p className="mt-2 text-zinc-400">
          Create a draft release on Too Lost
        </p>

        <button
          onClick={createTestRelease}
          disabled={loading}
          className="mt-8 w-full rounded-xl bg-white px-6 py-4 font-semibold text-black disabled:opacity-50"
        >
          {loading
            ? "Creating Draft Release..."
            : "Create Test Draft Release"}
        </button>

        {result && (
          <pre className="mt-6 max-h-[500px] overflow-auto rounded-xl bg-black p-5 text-sm text-green-400">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </main>
  );
}