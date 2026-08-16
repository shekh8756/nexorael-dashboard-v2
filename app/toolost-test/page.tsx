"use client";

import { useState } from "react";

export default function TooLostTestPage() {
  const [audio, setAudio] =
    useState<File | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [status, setStatus] =
    useState("");

  const [result, setResult] =
    useState<any>(null);

  async function uploadAudio() {
    if (!audio) {
      setResult({
        success: false,
        error: "Please select a WAV file.",
      });
      return;
    }

    if (
      !audio.name
        .toLowerCase()
        .endsWith(".wav")
    ) {
      setResult({
        success: false,
        error:
          "Only WAV files are allowed.",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // ------------------------------------------
      // STEP 1
      // CREATE DRAFT RELEASE
      // ------------------------------------------

      setStatus(
        "1/4 Creating Too Lost draft release..."
      );

      const releaseResponse =
        await fetch(
          "/api/toolost/releases/create",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              title:
                "Nexorael Audio Test",
              type: "Single",
              label: "Nexorael",
              artistName:
                "MD SAHID MIYA",
              role: "primary",
            }),
          }
        );

      const releaseText =
  await releaseResponse.text();

let releaseData: any;

try {
  releaseData = JSON.parse(releaseText);
} catch {
  throw new Error(
    `Release API returned non-JSON (${releaseResponse.status}): ${releaseText.substring(
      0,
      1000
    )}`
  );
}

      const release =
        releaseData?.data?.data ??
        releaseData?.data ??
        releaseData;

      const releaseId =
        release?.id;

      if (!releaseId) {
        throw new Error(
          "Release ID was not returned."
        );
      }

      // ------------------------------------------
      // STEP 2
      // GET DIRECT UPLOAD URL
      // ------------------------------------------

      setStatus(
        "2/4 Getting Too Lost upload URL..."
      );

      const uploadUrlResponse =
        await fetch(
          "/api/toolost/upload-url",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              releaseId,
              fileName:
                audio.name,
              contentType:
                audio.type ||
                "audio/wav",
            }),
          }
        );

      const uploadUrlText =
  await uploadUrlResponse.text();

let uploadUrlData: any;

try {
  uploadUrlData =
    JSON.parse(uploadUrlText);
} catch {
  throw new Error(
    `Upload URL API returned non-JSON (${uploadUrlResponse.status}): ${uploadUrlText.substring(
      0,
      1000
    )}`
  );
}

      const upload =
        uploadUrlData?.data
          ?.data ??
        uploadUrlData?.data ??
        uploadUrlData;

      const uploadUrl =
        upload?.uploadUrl;

      const fileKey =
        upload?.fileKey;

      const uploadMethod =
        upload?.method ||
        "PUT";

      const uploadHeaders =
        upload?.headers || {};

      if (
        !uploadUrl ||
        !fileKey
      ) {
        throw new Error(
          "Too Lost did not return uploadUrl/fileKey."
        );
      }

      // ------------------------------------------
      // STEP 3
      // DIRECT WAV UPLOAD
      // ------------------------------------------

      setStatus(
        "3/4 Uploading WAV directly to Too Lost..."
      );

      const headers =
        new Headers(
          uploadHeaders
        );

      if (
        !headers.has(
          "Content-Type"
        )
      ) {
        headers.set(
          "Content-Type",
          audio.type ||
            "audio/wav"
        );
      }

      const directUpload =
        await fetch(
          uploadUrl,
          {
            method:
              uploadMethod,
            headers,
            body: audio,
          }
        );

      if (
        !directUpload.ok
      ) {
        const text =
          await directUpload.text();

        throw new Error(
          `Direct Too Lost upload failed (${directUpload.status}): ${text}`
        );
      }

      // ------------------------------------------
      // STEP 4
      // SAVE TRACK IN RELEASE
      // ------------------------------------------

      setStatus(
        "4/4 Saving track to Too Lost release..."
      );

      const finalizeResponse =
        await fetch(
          "/api/toolost/finalize-track",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              releaseId,
              title:
                "Nexorael Audio Test",
              fileKey,
            }),
          }
        );

      const finalizeText =
  await finalizeResponse.text();

let finalizeData: any;

try {
  finalizeData =
    JSON.parse(finalizeText);
} catch {
  throw new Error(
    `Finalize API returned non-JSON (${finalizeResponse.status}): ${finalizeText.substring(
      0,
      1000
    )}`
  );
}

      setStatus(
        "Completed successfully."
      );

      setResult({
        success: true,

        message:
          "WAV uploaded and track saved as draft.",

        releaseId,

        fileKey,

        audio: {
          name:
            audio.name,
          size:
            audio.size,
          sizeMB:
            (
              audio.size /
              1024 /
              1024
            ).toFixed(2),
          type:
            audio.type ||
            "audio/wav",
        },

        tooLostResponse:
          finalizeData.data,

        note:
          "The release is still a draft. It has NOT been submitted or published.",
      });
    } catch (error) {
      setStatus("Upload failed.");

      setResult({
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Upload failed",
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
          Direct WAV upload to Too Lost
        </p>

        <div className="mt-8">
          <label className="mb-3 block text-sm font-medium">
            Select WAV Audio
          </label>

          <input
            type="file"
            accept=".wav,audio/wav"
            disabled={loading}
            onChange={(event) => {
              setAudio(
                event.target.files?.[0] ||
                  null
              );

              setResult(null);
              setStatus("");
            }}
            className="block w-full rounded-xl border border-white/10 bg-black p-4 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:font-semibold file:text-black"
          />
        </div>

        {audio && (
          <div className="mt-4 rounded-xl bg-black p-4">
            <p className="text-sm text-zinc-400">
              Selected file
            </p>

            <p className="mt-1 font-medium">
              {audio.name}
            </p>

            <p className="mt-1 text-sm text-zinc-500">
              {(
                audio.size /
                1024 /
                1024
              ).toFixed(2)}{" "}
              MB
            </p>
          </div>
        )}

        {status && (
          <div className="mt-4 rounded-xl border border-white/10 bg-black p-4 text-sm text-zinc-300">
            {status}
          </div>
        )}

        <button
          onClick={uploadAudio}
          disabled={
            loading || !audio
          }
          className="mt-6 w-full rounded-xl bg-white px-6 py-4 font-semibold text-black disabled:opacity-50"
        >
          {loading
            ? "Processing..."
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
            {JSON.stringify(
              result,
              null,
              2
            )}
          </pre>
        )}

      </div>
    </main>
  );
}