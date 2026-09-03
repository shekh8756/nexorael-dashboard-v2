"use client";

import {
  useMemo,
  useState,
} from "react";

import type {
  ChangeEvent,
  CSSProperties,
} from "react";

import SparkMD5 from "spark-md5";

import {
  supabase,
} from "@/lib/supabase";

/* ======================================================
   TYPES
====================================================== */

type VideoInfo = {
  duration: number;
  width: number;
  height: number;
};

type DeliveryState = {
  appleMusic: boolean;
  boomplay: boolean;
  spotify: boolean;
  tidal: boolean;
  vevo: boolean;
  youtubeVideo: boolean;
};

/* ======================================================
   HELPERS
====================================================== */

function clean(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

/*
 * Calculate real MD5 from selected video.
 */

async function calculateMD5(
  file: File
) {
  const buffer =
    await file.arrayBuffer();

  const binary =
    SparkMD5.ArrayBuffer.hash(
      buffer
    );

  return binary;
}

/*
 * Detect duration +
 * resolution from browser.
 */

async function getVideoInfo(
  file: File
): Promise<VideoInfo> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const video =
        document.createElement(
          "video"
        );

      const objectUrl =
        URL.createObjectURL(
          file
        );

      video.preload =
        "metadata";

      video.onloadedmetadata =
        () => {
          const duration =
            Number(
              video.duration ||
                0
            );

          const width =
            Number(
              video.videoWidth ||
                0
            );

          const height =
            Number(
              video.videoHeight ||
                0
            );

          URL.revokeObjectURL(
            objectUrl
          );

          if (
            !duration ||
            !width ||
            !height
          ) {
            reject(
              new Error(
                "Video metadata read nahi ho saka."
              )
            );

            return;
          }

          resolve({
            duration,
            width,
            height,
          });
        };

      video.onerror =
        () => {
          URL.revokeObjectURL(
            objectUrl
          );

          reject(
            new Error(
              "Video file read nahi ho saka."
            )
          );
        };

      video.src =
        objectUrl;
    }
  );
}

/* ======================================================
   PAGE
====================================================== */

export default function VideoUploadPage() {
  const [
    releaseId,
    setReleaseId,
  ] =
    useState("");

  const [
    videoFile,
    setVideoFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    videoType,
    setVideoType,
  ] =
    useState(
      "official_music_video"
    );

  const [
    ageRestriction,
    setAgeRestriction,
  ] =
    useState(
      "all_ages"
    );

  const [
    isCoverVersion,
    setIsCoverVersion,
  ] =
    useState(false);

  const [
    referenceUpc,
    setReferenceUpc,
  ] =
    useState("");

  const [
    referenceIsrc,
    setReferenceIsrc,
  ] =
    useState("");

  /*
   * Media metadata defaults.
   *
   * Resolution + duration
   * automatically detected.
   */

  const [
    audioChannels,
    setAudioChannels,
  ] =
    useState("2");

  const [
    audioCodec,
    setAudioCodec,
  ] =
    useState("aac");

  const [
    audioSampleRate,
    setAudioSampleRate,
  ] =
    useState("48000");

  const [
    videoCodec,
    setVideoCodec,
  ] =
    useState("h264");

  const [
    videoInfo,
    setVideoInfo,
  ] =
    useState<VideoInfo | null>(
      null
    );

  const [
    md5hash,
    setMd5hash,
  ] =
    useState("");

  const [
    delivery,
    setDelivery,
  ] =
    useState<DeliveryState>({
      appleMusic: false,
      boomplay: false,
      spotify: false,
      tidal: false,

      /*
       * VEVO default ON.
       */
      vevo: true,

      youtubeVideo: false,
    });

  const [
    processing,
    setProcessing,
  ] =
    useState(false);

  const [
    progressMessage,
    setProgressMessage,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  /* ====================================================
     DELIVERY COUNT
  ==================================================== */

  const selectedDeliveryCount =
    useMemo(
      () =>
        Object.values(
          delivery
        ).filter(Boolean)
          .length,
      [delivery]
    );

  /* ====================================================
     VIDEO SELECT
  ==================================================== */

  async function handleVideoSelect(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target
        .files?.[0];

    if (!file) {
      return;
    }

    setSuccessMessage("");
    setErrorMessage("");

    /*
     * MP4 only for initial
     * production version.
     */

    if (
      !/\.mp4$/i.test(
        file.name
      )
    ) {
      alert(
        "Abhi sirf MP4 video allowed hai."
      );

      event.target.value =
        "";

      return;
    }

    setVideoFile(
      file
    );

    try {
      setProgressMessage(
        "Reading video information..."
      );

      const info =
        await getVideoInfo(
          file
        );

      setVideoInfo(
        info
      );

      setProgressMessage(
        "Calculating MD5..."
      );

      const hash =
        await calculateMD5(
          file
        );

      setMd5hash(
        hash
      );

      setProgressMessage(
        "Video ready."
      );
    } catch (
      error
    ) {
      console.error(
        error
      );

      setVideoFile(
        null
      );

      setVideoInfo(
        null
      );

      setMd5hash(
        ""
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Video processing failed."
      );
    }
  }

  /* ====================================================
     DELIVERY TOGGLE
  ==================================================== */

  function toggleDelivery(
    key:
      keyof DeliveryState
  ) {
    setDelivery(
      (previous) => ({
        ...previous,

        [key]:
          !previous[key],
      })
    );
  }

  /* ====================================================
     UPLOAD VIDEO -> SUPABASE
  ==================================================== */

  async function uploadVideo(
    file: File
  ) {
    const cleanName =
      file.name
        .replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        )
        .replace(
          /_+/g,
          "_"
        );

    const fileName =
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(
          2,
          8
        )}-${cleanName}`;

    const {
      error,
    } =
      await supabase.storage
        .from(
          "release-video"
        )
        .upload(
          fileName,
          file,
          {
            contentType:
              file.type ||
              "video/mp4",

            upsert: false,
          }
        );

    if (error) {
      throw new Error(
        error.message
      );
    }

    const {
      data,
    } =
      supabase.storage
        .from(
          "release-video"
        )
        .getPublicUrl(
          fileName
        );

    if (
      !data.publicUrl
    ) {
      throw new Error(
        "Video public URL missing."
      );
    }

    return data.publicUrl;
  }

  /* ====================================================
     SUBMIT
  ==================================================== */

  async function submitVideo() {
    if (processing) {
      return;
    }

    setSuccessMessage("");
    setErrorMessage("");

    /*
     * Validate admin session.
     */

    const {
      data: userData,
      error:
        userError,
    } =
      await supabase.auth
        .getUser();

    if (
      userError ||
      !userData.user
    ) {
      setErrorMessage(
        "Admin login required."
      );

      return;
    }

    const {
      data: profile,
      error:
        profileError,
    } =
      await supabase
        .from(
          "profiles"
        )
        .select(
          "role"
        )
        .eq(
          "id",
          userData
            .user.id
        )
        .maybeSingle();

    if (profileError) {
      setErrorMessage(
        profileError.message
      );

      return;
    }

    const allowedRoles =
      [
        "master_admin",
        "admin",
        "white_label_admin",
      ];

    if (
      !profile ||
      !allowedRoles.includes(
        String(
          profile.role ||
            ""
        )
      )
    ) {
      setErrorMessage(
        "Admin permission required."
      );

      return;
    }

    /*
     * Session access token.
     */

    const {
      data:
        sessionData,
    } =
      await supabase.auth
        .getSession();

    const accessToken =
      sessionData
        .session
        ?.access_token;

    if (!accessToken) {
      setErrorMessage(
        "Admin session token missing."
      );

      return;
    }

    if (
      !clean(
        releaseId
      )
    ) {
      setErrorMessage(
        "Too Lost Release ID required."
      );

      return;
    }

    if (!videoFile) {
      setErrorMessage(
        "Video file select karo."
      );

      return;
    }

    if (!md5hash) {
      setErrorMessage(
        "Video MD5 missing."
      );

      return;
    }

    if (!videoInfo) {
      setErrorMessage(
        "Video metadata missing."
      );

      return;
    }

    if (
      selectedDeliveryCount ===
      0
    ) {
      setErrorMessage(
        "Kam se kam ek video platform select karo."
      );

      return;
    }

    const channels =
      Number(
        audioChannels
      );

    const sampleRate =
      Number(
        audioSampleRate
      );

    if (
      !Number.isFinite(
        channels
      ) ||
      channels < 1
    ) {
      setErrorMessage(
        "Invalid audio channels."
      );

      return;
    }

    if (
      !Number.isFinite(
        sampleRate
      ) ||
      sampleRate < 1
    ) {
      setErrorMessage(
        "Invalid audio sample rate."
      );

      return;
    }

    setProcessing(
      true
    );

    try {
      /*
       * =====================================
       * STEP 1 - VIDEO -> SUPABASE
       * =====================================
       */

      setProgressMessage(
        "Uploading video to storage..."
      );

      const videoUrl =
        await uploadVideo(
          videoFile
        );

      /*
       * =====================================
       * STEP 2 - TOO LOST VIDEO METADATA
       * =====================================
       */

      setProgressMessage(
        "Sending Music Video metadata to Too Lost..."
      );

      const response =
        await fetch(
          "/api/toolost/releases/video",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${accessToken}`,
            },

            body:
              JSON.stringify({
                releaseId:
                  clean(
                    releaseId
                  ),

                videoUrl,

                md5hash,

                videoType,

                ageRestriction,

                isCoverVersion,

                referenceUpc:
                  clean(
                    referenceUpc
                  ) ||
                  undefined,

                referenceIsrc:
                  clean(
                    referenceIsrc
                  ) ||
                  undefined,

                /*
                 * Delivery
                 */

                appleMusic:
                  delivery.appleMusic,

                boomplay:
                  delivery.boomplay,

                spotify:
                  delivery.spotify,

                tidal:
                  delivery.tidal,

                vevo:
                  delivery.vevo,

                youtubeVideo:
                  delivery.youtubeVideo,

                /*
                 * Audio metadata
                 */

                audioChannels:
                  channels,

                audioCodec:
                  clean(
                    audioCodec
                  ),

                audioSampleRate:
                  sampleRate,

                /*
                 * Video metadata
                 */

                videoCodec:
                  clean(
                    videoCodec
                  ),

                videoDuration:
                  Math.round(
                    videoInfo.duration
                  ),

                videoHeight:
                  videoInfo.height,

                videoWidth:
                  videoInfo.width,
              }),
          }
        );

      const text =
        await response.text();

      let data: any =
        {};

      try {
        data =
          JSON.parse(
            text
          );
      } catch {
        throw new Error(
          `Too Lost video API returned non-JSON (${response.status}).`
        );
      }

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            data
              ?.tooLostResponse
              ?.message ||
            "Too Lost video update failed."
        );
      }

      setProgressMessage(
        "Music Video saved."
      );

      setSuccessMessage(
        `Success! Too Lost release ${releaseId} me video save ho gaya.`
      );
    } catch (
      error
    ) {
      console.error(
        "Video upload failed:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Video upload failed."
      );

      setProgressMessage(
        "Failed."
      );
    } finally {
      setProcessing(
        false
      );
    }
  }

  /* ====================================================
     UI
  ==================================================== */

  return (
    <main
      style={
        pageStyle
      }
    >
      <div
        style={
          headerStyle
        }
      >
        <div>
          <div
            style={
              labelBadge
            }
          >
            MUSIC VIDEO
          </div>

          <h1
            style={{
              margin:
                "10px 0 4px",
            }}
          >
            Music Video / VEVO
          </h1>

          <p
            style={
              muted
            }
          >
            Upload video and attach it to an existing Too Lost Music Video draft.
          </p>
        </div>

        <div
          style={
            adminBadge
          }
        >
          ADMIN
        </div>
      </div>

      {/* RELEASE */}

      <section
        style={
          card
        }
      >
        <h2>
          1. Too Lost Release
        </h2>

        <label
          style={
            labelStyle
          }
        >
          Too Lost Release ID
        </label>

        <input
          value={
            releaseId
          }
          disabled={
            processing
          }
          onChange={(
            event
          ) =>
            setReleaseId(
              event.target
                .value
            )
          }
          placeholder="Example: 1670153"
          style={
            inputStyle
          }
        />

        <p
          style={
            helper
          }
        >
          Existing draft Music Video release ka Too Lost ID enter karo.
        </p>
      </section>

      {/* VIDEO */}

      <section
        style={
          card
        }
      >
        <h2>
          2. Video File
        </h2>

        <input
          type="file"
          accept=".mp4,video/mp4"
          disabled={
            processing
          }
          onChange={
            handleVideoSelect
          }
        />

        {videoFile && (
          <div
            style={
              infoGrid
            }
          >
            <InfoBox
              label="File"
              value={
                videoFile.name
              }
            />

            <InfoBox
              label="Size"
              value={`${(
                videoFile.size /
                1024 /
                1024
              ).toFixed(
                2
              )} MB`}
            />

            <InfoBox
              label="MD5"
              value={
                md5hash ||
                "Calculating..."
              }
            />

            <InfoBox
              label="Resolution"
              value={
                videoInfo
                  ? `${videoInfo.width}x${videoInfo.height}`
                  : "Reading..."
              }
            />

            <InfoBox
              label="Duration"
              value={
                videoInfo
                  ? `${Math.round(
                      videoInfo.duration
                    )} sec`
                  : "Reading..."
              }
            />
          </div>
        )}
      </section>

      {/* TYPE */}

      <section
        style={
          card
        }
      >
        <h2>
          3. Video Settings
        </h2>

        <div
          style={
            twoColumn
          }
        >
          <Field>
            <label
              style={
                labelStyle
              }
            >
              Video Type
            </label>

            <select
              value={
                videoType
              }
              disabled={
                processing
              }
              onChange={(
                event
              ) =>
                setVideoType(
                  event.target
                    .value
                )
              }
              style={
                inputStyle
              }
            >
              <option
                value="official_music_video"
              >
                Official Music Video
              </option>

              <option
                value="performance_video"
              >
                Performance Video
              </option>
            </select>
          </Field>

          <Field>
            <label
              style={
                labelStyle
              }
            >
              Age Restriction
            </label>

            <select
              value={
                ageRestriction
              }
              disabled={
                processing
              }
              onChange={(
                event
              ) =>
                setAgeRestriction(
                  event.target
                    .value
                )
              }
              style={
                inputStyle
              }
            >
              <option
                value="all_ages"
              >
                All Ages
              </option>

              <option
                value="18_plus"
              >
                18 Plus
              </option>
            </select>
          </Field>
        </div>

        <label
          style={
            checkboxRow
          }
        >
          <input
            type="checkbox"
            checked={
              isCoverVersion
            }
            disabled={
              processing
            }
            onChange={(
              event
            ) =>
              setIsCoverVersion(
                event.target
                  .checked
              )
            }
          />

          This is a cover version
        </label>

        {isCoverVersion && (
          <div
            style={{
              ...twoColumn,
              marginTop:
                "16px",
            }}
          >
            <Field>
              <label
                style={
                  labelStyle
                }
              >
                Reference UPC
              </label>

              <input
                value={
                  referenceUpc
                }
                disabled={
                  processing
                }
                onChange={(
                  event
                ) =>
                  setReferenceUpc(
                    event.target
                      .value
                  )
                }
                style={
                  inputStyle
                }
              />
            </Field>

            <Field>
              <label
                style={
                  labelStyle
                }
              >
                Reference ISRC
              </label>

              <input
                value={
                  referenceIsrc
                }
                disabled={
                  processing
                }
                onChange={(
                  event
                ) =>
                  setReferenceIsrc(
                    event.target
                      .value
                  )
                }
                style={
                  inputStyle
                }
              />
            </Field>
          </div>
        )}
      </section>

      {/* DELIVERY */}

      <section
        style={
          card
        }
      >
        <h2>
          4. Video Distribution
        </h2>

        <p
          style={
            muted
          }
        >
          Too Lost Music Video delivery targets.
        </p>

        <div
          style={
            deliveryGrid
          }
        >
          <DeliveryBox
            label="VEVO"
            checked={
              delivery.vevo
            }
            disabled={
              processing
            }
            onClick={() =>
              toggleDelivery(
                "vevo"
              )
            }
          />

          <DeliveryBox
            label="Apple Music"
            checked={
              delivery.appleMusic
            }
            disabled={
              processing
            }
            onClick={() =>
              toggleDelivery(
                "appleMusic"
              )
            }
          />

          <DeliveryBox
            label="Spotify"
            checked={
              delivery.spotify
            }
            disabled={
              processing
            }
            onClick={() =>
              toggleDelivery(
                "spotify"
              )
            }
          />

          <DeliveryBox
            label="Tidal"
            checked={
              delivery.tidal
            }
            disabled={
              processing
            }
            onClick={() =>
              toggleDelivery(
                "tidal"
              )
            }
          />

          <DeliveryBox
            label="Boomplay"
            checked={
              delivery.boomplay
            }
            disabled={
              processing
            }
            onClick={() =>
              toggleDelivery(
                "boomplay"
              )
            }
          />

          <DeliveryBox
            label="YouTube Video"
            checked={
              delivery.youtubeVideo
            }
            disabled={
              processing
            }
            onClick={() =>
              toggleDelivery(
                "youtubeVideo"
              )
            }
          />
        </div>
      </section>

      {/* TECHNICAL */}

      <section
        style={
          card
        }
      >
        <h2>
          5. Technical Metadata
        </h2>

        <div
          style={
            technicalGrid
          }
        >
          <Field>
            <label
              style={
                labelStyle
              }
            >
              Audio Channels
            </label>

            <input
              type="number"
              value={
                audioChannels
              }
              onChange={(
                event
              ) =>
                setAudioChannels(
                  event.target
                    .value
                )
              }
              disabled={
                processing
              }
              style={
                inputStyle
              }
            />
          </Field>

          <Field>
            <label
              style={
                labelStyle
              }
            >
              Audio Codec
            </label>

            <input
              value={
                audioCodec
              }
              onChange={(
                event
              ) =>
                setAudioCodec(
                  event.target
                    .value
                )
              }
              disabled={
                processing
              }
              style={
                inputStyle
              }
            />
          </Field>

          <Field>
            <label
              style={
                labelStyle
              }
            >
              Sample Rate
            </label>

            <input
              type="number"
              value={
                audioSampleRate
              }
              onChange={(
                event
              ) =>
                setAudioSampleRate(
                  event.target
                    .value
                )
              }
              disabled={
                processing
              }
              style={
                inputStyle
              }
            />
          </Field>

          <Field>
            <label
              style={
                labelStyle
              }
            >
              Video Codec
            </label>

            <input
              value={
                videoCodec
              }
              onChange={(
                event
              ) =>
                setVideoCodec(
                  event.target
                    .value
                )
              }
              disabled={
                processing
              }
              style={
                inputStyle
              }
            />
          </Field>

          <Field>
            <label
              style={
                labelStyle
              }
            >
              Width
            </label>

            <input
              readOnly
              value={
                videoInfo
                  ?.width ||
                ""
              }
              style={
                inputStyle
              }
            />
          </Field>

          <Field>
            <label
              style={
                labelStyle
              }
            >
              Height
            </label>

            <input
              readOnly
              value={
                videoInfo
                  ?.height ||
                ""
              }
              style={
                inputStyle
              }
            />
          </Field>
        </div>
      </section>

      {/* SUBMIT */}

      <section
        style={
          submitCard
        }
      >
        <div>
          <strong>
            Selected Platforms:{" "}
            {
              selectedDeliveryCount
            }
          </strong>

          {progressMessage && (
            <div
              style={
                helper
              }
            >
              {
                progressMessage
              }
            </div>
          )}

          {successMessage && (
            <div
              style={
                successBox
              }
            >
              {
                successMessage
              }
            </div>
          )}

          {errorMessage && (
            <div
              style={
                errorBox
              }
            >
              {
                errorMessage
              }
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={
            processing
          }
          onClick={
            submitVideo
          }
          style={{
            ...primaryButton,

            opacity:
              processing
                ? 0.55
                : 1,
          }}
        >
          {processing
            ? "Processing..."
            : "Save Music Video"}
        </button>
      </section>
    </main>
  );
}

/* ======================================================
   SMALL COMPONENTS
====================================================== */

function Field({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div>
      {children}
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={
        infoBox
      }
    >
      <div
        style={
          helper
        }
      >
        {label}
      </div>

      <div
        style={{
          marginTop:
            "5px",
          fontWeight: 700,
          wordBreak:
            "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DeliveryBox({
  label,
  checked,
  disabled,
  onClick,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={
        disabled
      }
      onClick={
        onClick
      }
      style={{
        ...deliveryBox,

        borderColor:
          checked
            ? "#2563EB"
            : "#26364A",

        background:
          checked
            ? "rgba(37,99,235,0.18)"
            : "#0B1220",

        opacity:
          disabled
            ? 0.55
            : 1,
      }}
    >
      <span
        style={{
          ...deliveryCheck,

          background:
            checked
              ? "#2563EB"
              : "transparent",
        }}
      >
        {checked
          ? "✓"
          : ""}
      </span>

      {label}
    </button>
  );
}

/* ======================================================
   STYLES
====================================================== */

const pageStyle:
  CSSProperties = {
  minHeight:
    "100vh",

  padding:
    "28px",

  background:
    "#050816",

  color:
    "#F8FAFC",
};

const headerStyle:
  CSSProperties = {
  display:
    "flex",

  alignItems:
    "center",

  justifyContent:
    "space-between",

  marginBottom:
    "22px",
};

const card:
  CSSProperties = {
  background:
    "#0F172A",

  border:
    "1px solid #1E293B",

  borderRadius:
    "14px",

  padding:
    "20px",

  marginBottom:
    "18px",
};

const submitCard:
  CSSProperties = {
  ...card,

  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap:
    "20px",
};

const muted:
  CSSProperties = {
  color:
    "#94A3B8",
};

const helper:
  CSSProperties = {
  color:
    "#94A3B8",

  fontSize:
    "12px",

  marginTop:
    "7px",
};

const labelStyle:
  CSSProperties = {
  display:
    "block",

  color:
    "#CBD5E1",

  fontSize:
    "13px",

  marginBottom:
    "7px",
};

const inputStyle:
  CSSProperties = {
  width:
    "100%",

  minHeight:
    "43px",

  background:
    "#020617",

  border:
    "1px solid #334155",

  borderRadius:
    "9px",

  padding:
    "0 12px",

  color:
    "#F8FAFC",

  outline:
    "none",

  boxSizing:
    "border-box",
};

const twoColumn:
  CSSProperties = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(2,minmax(0,1fr))",

  gap:
    "16px",
};

const technicalGrid:
  CSSProperties = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(3,minmax(0,1fr))",

  gap:
    "16px",
};

const infoGrid:
  CSSProperties = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(5,minmax(0,1fr))",

  gap:
    "12px",

  marginTop:
    "18px",
};

const infoBox:
  CSSProperties = {
  padding:
    "13px",

  background:
    "#020617",

  border:
    "1px solid #1E293B",

  borderRadius:
    "10px",
};

const checkboxRow:
  CSSProperties = {
  display:
    "flex",

  alignItems:
    "center",

  gap:
    "9px",

  marginTop:
    "18px",

  fontSize:
    "13px",
};

const deliveryGrid:
  CSSProperties = {
  display:
    "grid",

  gridTemplateColumns:
    "repeat(3,minmax(0,1fr))",

  gap:
    "12px",

  marginTop:
    "16px",
};

const deliveryBox:
  CSSProperties = {
  minHeight:
    "55px",

  display:
    "flex",

  alignItems:
    "center",

  gap:
    "11px",

  border:
    "1px solid #26364A",

  borderRadius:
    "10px",

  padding:
    "0 14px",

  color:
    "#FFFFFF",

  cursor:
    "pointer",

  fontWeight:
    700,

  textAlign:
    "left",
};

const deliveryCheck:
  CSSProperties = {
  width:
    "20px",

  height:
    "20px",

  border:
    "1px solid #64748B",

  borderRadius:
    "5px",

  display:
    "inline-flex",

  alignItems:
    "center",

  justifyContent:
    "center",

  color:
    "#FFFFFF",

  flexShrink: 0,
};

const primaryButton:
  CSSProperties = {
  minWidth:
    "190px",

  minHeight:
    "46px",

  padding:
    "0 18px",

  border:
    "none",

  borderRadius:
    "10px",

  background:
    "#2563EB",

  color:
    "#FFFFFF",

  fontWeight:
    800,

  cursor:
    "pointer",
};

const labelBadge:
  CSSProperties = {
  display:
    "inline-block",

  padding:
    "5px 9px",

  border:
    "1px solid rgba(59,130,246,.4)",

  borderRadius:
    "999px",

  color:
    "#60A5FA",

  fontSize:
    "10px",

  fontWeight:
    800,
};

const adminBadge:
  CSSProperties = {
  padding:
    "7px 12px",

  borderRadius:
    "999px",

  background:
    "#1D4ED8",

  fontSize:
    "11px",

  fontWeight:
    800,
};

const successBox:
  CSSProperties = {
  marginTop:
    "10px",

  padding:
    "10px 12px",

  borderRadius:
    "8px",

  background:
    "rgba(22,101,52,.22)",

  border:
    "1px solid #166534",

  color:
    "#86EFAC",

  fontSize:
    "13px",
};

const errorBox:
  CSSProperties = {
  marginTop:
    "10px",

  padding:
    "10px 12px",

  borderRadius:
    "8px",

  background:
    "rgba(153,27,27,.22)",

  border:
    "1px solid #991B1B",

  color:
    "#FCA5A5",

  fontSize:
    "13px",
};