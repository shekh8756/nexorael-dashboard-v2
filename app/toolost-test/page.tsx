"use client";

import { useState } from "react";

export default function TooLostTestPage() {
  const [audio, setAudio] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function uploadAudio() {
    if (!audio) {
      setResult({
        success: false,
        error: "Please select a WAV audio file first.",
      });
      return;
    }

    if (!audio.name.toLowerCase().endsWith(".wav")) {
      setResult({
        success: false,
        error: "Only WAV files are allowed.",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();

      formData.append("audio", audio);

      const response = await fetch(
        "/api/toolost/test-upload",
        {
          method: "POST",
          body: formData,
        }
      );

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
            : "Upload request failed",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-900 p-8">

        <h1 className="text-3xl font-bold">
          Too Lost Audio Upload Test
        </h1>

        <p className="mt-2 text-zinc-400">
          Create a draft release and upload a WAV track to Too Lost.
        </p>

        <div className="mt-8">
          <label className="mb-3 block text-sm font-medium text-zinc-300">
            Select WAV Audio
          </label>

          <input
            type="file"
            accept=".wav,audio/wav"
            onChange={(event) => {
              const file =
                event.target.files?.[0] || null;

              setAudio(file);
              setResult(null);
            }}
            className="block w-full rounded-xl border border-white/10 bg-black p-4 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:font-semibold file:text-black"
          />
        </div>

        {audio && (
          <div className="mt-4 rounded-xl border border-white/10 bg-black p-4">
            <p className="text-sm text-zinc-400">
              Selected file
            </p>

            <p className="mt-1 font-medium">
              {audio.name}
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              {(audio.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        )}

        <button
          onClick={uploadAudio}
          disabled={loading || !audio}
          className="mt-6 w-full rounded-xl bg-white px-6 py-4 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Uploading to Too Lost..."
            : "Upload WAV to Too Lost"}
        </button>

        {result && (
          <pre
            className={`mt-6 max-h-[600px] overflow-auto rounded-xl bg-black p-5 text-sm ${
              result.success
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        )}

      </div>
    </main>
  );
}