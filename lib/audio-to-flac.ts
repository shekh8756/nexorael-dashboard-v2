import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg() {
  if (ffmpegInstance) {
    return ffmpegInstance;
  }

  const ffmpeg = new FFmpeg();

  /*
   * FFmpeg WASM files CDN se load honge.
   * Actual audio file CDN/Supabase par upload nahi hoti.
   */
  await ffmpeg.load({
    coreURL:
      "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js",

    wasmURL:
      "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm",
  });

  ffmpegInstance = ffmpeg;

  return ffmpeg;
}

function cleanBaseName(
  fileName: string
) {
  const cleaned =
    String(fileName || "audio")
      .replace(/\.[^.]+$/, "")
      .normalize("NFKD")
      .replace(/[^\x00-\x7F]/g, "")
      .replace(
        /[^a-zA-Z0-9_-]/g,
        "_"
      )
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

  return cleaned || "audio";
}

export async function convertWavToFlac(
  wavFile: File
): Promise<File> {
  if (
    !/\.wav$/i.test(
      wavFile.name
    )
  ) {
    throw new Error(
      "Only WAV files can be converted to FLAC."
    );
  }

  const ffmpeg =
    await getFFmpeg();

  const uniqueId =
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

  const inputName =
    `input-${uniqueId}.wav`;

  const outputName =
    `output-${uniqueId}.flac`;

  try {
    await ffmpeg.writeFile(
      inputName,
      await fetchFile(
        wavFile
      )
    );

    const exitCode =
      await ffmpeg.exec([
        "-i",
        inputName,

        /*
         * FLAC lossless codec
         */
        "-c:a",
        "flac",

        /*
         * Good compression without
         * changing audio quality.
         */
        "-compression_level",
        "5",

        "-y",
        outputName,
      ]);

    if (exitCode !== 0) {
      throw new Error(
        `FFmpeg conversion failed with exit code ${exitCode}.`
      );
    }

    const output =
      await ffmpeg.readFile(
        outputName
      );

    if (
      typeof output ===
      "string"
    ) {
      throw new Error(
        "FFmpeg returned invalid FLAC output."
      );
    }

    const bytes =
      new Uint8Array(
        output
      );

    if (!bytes.length) {
      throw new Error(
        "Converted FLAC file is empty."
      );
    }

    const flacName =
      `${cleanBaseName(
        wavFile.name
      )}.flac`;

    const blob =
      new Blob(
        [bytes],
        {
          type:
            "audio/flac",
        }
      );

    return new File(
      [blob],
      flacName,
      {
        type:
          "audio/flac",

        lastModified:
          Date.now(),
      }
    );
  } finally {
    /*
     * Free WASM filesystem memory.
     */
    try {
      await ffmpeg.deleteFile(
        inputName
      );
    } catch {}

    try {
      await ffmpeg.deleteFile(
        outputName
      );
    } catch {}
  }
}