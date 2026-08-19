"use client";

import {
  useState,
} from "react";

const DSP_LIST = [
  "Spotify",
  "Apple Music",
  "YouTube Music",
  "Amazon Music",
  "Deezer",
  "TikTok",
  "Instagram / Facebook",
  "Tidal",
  "Pandora",
  "SoundCloud",
  "Boomplay",
  "Audiomack",
];

export default function InvitationsPage() {
  const [form, setForm] =
    useState({
      email: "",
      legalName: "",
      accountType: "artist",
      phone: "",
      fullAddress: "",
      legalDocumentType: "",
      legalDocumentNumber: "",
      companyName: "",
    });

  const [platforms, setPlatforms] =
    useState<string[]>([]);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  function updateField(
    key: string,
    value: string
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function togglePlatform(
    platform: string
  ) {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter(
            (item) =>
              item !== platform
          )
        : [
            ...prev,
            platform,
          ]
    );
  }

  async function submitInvite() {
    try {
      setSaving(true);
      setMessage("");

      const response =
        await fetch(
          "/api/admin/invitations",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                ...form,
                platforms,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Unable to invite user."
        );
      }

      setMessage(
        "Invitation sent successfully."
      );

      setForm({
        email: "",
        legalName: "",
        accountType:
          "artist",
        phone: "",
        fullAddress: "",
        legalDocumentType:
          "",
        legalDocumentNumber:
          "",
        companyName: "",
      });

      setPlatforms([]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to invite user."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen text-white">
      <div className="mb-6 border-b border-[#172638] pb-6">
        <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] font-bold text-sky-400">
          USER ONBOARDING
        </span>

        <h1 className="mt-3 text-3xl font-bold">
          Invite User
        </h1>

        <p className="mt-1 text-sm text-slate-400">
          Add artists or labels and control which platforms they can distribute to.
        </p>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-[#203246] bg-[#091522] p-4 text-sm">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-[#17283a] bg-[#091522] p-6">
        <h2 className="mb-5 text-lg font-semibold">
          User Information
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Email"
            value={form.email}
            onChange={(v) =>
              updateField(
                "email",
                v
              )
            }
          />

          <Input
            label="Full Legal Name"
            value={
              form.legalName
            }
            onChange={(v) =>
              updateField(
                "legalName",
                v
              )
            }
          />

          <label>
            <div className="mb-2 text-xs text-slate-400">
              Account Type
            </div>

            <select
              value={
                form.accountType
              }
              onChange={(e) =>
                updateField(
                  "accountType",
                  e.target.value
                )
              }
              className="w-full rounded-lg border border-[#203246] bg-[#06101b] p-3"
            >
              <option value="artist">
                Artist
              </option>

              <option value="label">
                Label
              </option>
            </select>
          </label>

          <Input
            label="Phone Number"
            value={form.phone}
            onChange={(v) =>
              updateField(
                "phone",
                v
              )
            }
          />

          <Input
            label="Company / Label Name"
            value={
              form.companyName
            }
            onChange={(v) =>
              updateField(
                "companyName",
                v
              )
            }
          />

          <Input
            label="Legal Document Type"
            value={
              form.legalDocumentType
            }
            placeholder="PAN / Aadhaar / Passport / Company ID"
            onChange={(v) =>
              updateField(
                "legalDocumentType",
                v
              )
            }
          />

          <Input
            label="Legal Document Number"
            value={
              form.legalDocumentNumber
            }
            onChange={(v) =>
              updateField(
                "legalDocumentNumber",
                v
              )
            }
          />

          <label className="md:col-span-2">
            <div className="mb-2 text-xs text-slate-400">
              Full Address
            </div>

            <textarea
              value={
                form.fullAddress
              }
              onChange={(e) =>
                updateField(
                  "fullAddress",
                  e.target.value
                )
              }
              rows={4}
              className="w-full rounded-lg border border-[#203246] bg-[#06101b] p-3 outline-none"
            />
          </label>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[#17283a] bg-[#091522] p-6">
        <div>
          <h2 className="text-lg font-semibold">
            Platform Eligibility
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            User releases will only be eligible for selected platforms.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {DSP_LIST.map(
            (platform) => {
              const selected =
                platforms.includes(
                  platform
                );

              return (
                <button
                  key={
                    platform
                  }
                  type="button"
                  onClick={() =>
                    togglePlatform(
                      platform
                    )
                  }
                  className={`rounded-xl border p-4 text-left transition ${
                    selected
                      ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
                      : "border-[#203246] bg-[#07111d] text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {platform}
                    </span>

                    <span>
                      {selected
                        ? "✓"
                        : "○"}
                    </span>
                  </div>
                </button>
              );
            }
          )}
        </div>
      </section>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={
            submitInvite
          }
          className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 font-semibold text-white"
        >
          {saving
            ? "Sending Invitation..."
            : "Invite User"}
        </button>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <div className="mb-2 text-xs text-slate-400">
        {label}
      </div>

      <input
        value={value}
        placeholder={
          placeholder
        }
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        className="w-full rounded-lg border border-[#203246] bg-[#06101b] p-3 outline-none focus:border-sky-500/50"
      />
    </label>
  );
}