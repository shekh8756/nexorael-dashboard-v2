"use client";

import {
  useEffect,
  useState,
} from "react";

type SettingsState = {
  companyName: string;
  supportEmail: string;
  website: string;
  defaultLabel: string;
  defaultLanguage: string;
  defaultGenre: string;

  autoApprove: boolean;
  requireRightsConfirmation: boolean;
  enableContentId: boolean;

  emailNotifications: boolean;
  releaseNotifications: boolean;
  payoutNotifications: boolean;
};

const initialSettings: SettingsState = {
  companyName: "Nexorael Music",
  supportEmail: "",
  website: "",
  defaultLabel: "Nexorael Music",
  defaultLanguage: "Hindi",
  defaultGenre: "Pop",

  autoApprove: false,
  requireRightsConfirmation: true,
  enableContentId: false,

  emailNotifications: true,
  releaseNotifications: true,
  payoutNotifications: true,
};

export default function AdminSettingsPage() {
  const [settings, setSettings] =
    useState<SettingsState>(
      initialSettings
    );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [toolostConnected, setToolostConnected] =
    useState(false);

  useEffect(() => {
    loadSettings();
    checkTooLost();
  }, []);

  async function loadSettings() {
    try {
      const response = await fetch(
        "/api/admin/settings",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      if (
        data?.success &&
        data?.settings
      ) {
        setSettings((prev) => ({
          ...prev,
          ...data.settings,
        }));
      }
    } catch (error) {
      console.error(
        "Load settings error:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  async function checkTooLost() {
    try {
      const response = await fetch(
        "/api/toolost/me",
        {
          cache: "no-store",
        }
      );

      setToolostConnected(
        response.ok
      );
    } catch {
      setToolostConnected(false);
    }
  }

  function updateField<
    K extends keyof SettingsState
  >(
    key: K,
    value: SettingsState[K]
  ) {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function saveSettings() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/settings",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            settings,
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
            "Unable to save settings."
        );
      }

      setMessage(
        "Settings saved successfully."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save settings."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <h2>
          Loading settings...
        </h2>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      {/* HEADER */}

      <div style={headerStyle}>
        <div>
          <div style={badgeStyle}>
            ADMIN SETTINGS
          </div>

          <h1 style={titleStyle}>
            Settings
          </h1>

          <p style={subtitleStyle}>
            Manage Nexorael Music,
            integrations, release
            defaults and notifications.
          </p>
        </div>

        <button
          type="button"
          onClick={saveSettings}
          disabled={saving}
          style={saveButton}
        >
          {saving
            ? "Saving..."
            : "Save Changes"}
        </button>
      </div>

      {message && (
        <div style={messageBox}>
          {message}
        </div>
      )}

      {/* COMPANY */}

      <section style={panelStyle}>
        <SectionTitle
          title="Company Information"
          description="Default information used across the Nexorael admin dashboard."
        />

        <div style={formGrid}>
          <Field
            label="Company / Brand Name"
            value={settings.companyName}
            onChange={(value) =>
              updateField(
                "companyName",
                value
              )
            }
          />

          <Field
            label="Support Email"
            type="email"
            value={
              settings.supportEmail
            }
            onChange={(value) =>
              updateField(
                "supportEmail",
                value
              )
            }
          />

          <Field
            label="Website"
            value={settings.website}
            placeholder="https://nexorael.com"
            onChange={(value) =>
              updateField(
                "website",
                value
              )
            }
          />

          <Field
            label="Default Label"
            value={
              settings.defaultLabel
            }
            onChange={(value) =>
              updateField(
                "defaultLabel",
                value
              )
            }
          />
        </div>
      </section>

      {/* TOO LOST */}

      <section style={panelStyle}>
        <SectionTitle
          title="Too Lost Integration"
          description="Connection used for releases, analytics, sales and reporting."
        />

        <div style={integrationRow}>
          <div style={integrationInfo}>
            <div style={integrationIcon}>
              TL
            </div>

            <div>
              <div
                style={
                  integrationTitle
                }
              >
                Too Lost API
              </div>

              <div
                style={
                  integrationSub
                }
              >
                OAuth API integration
              </div>
            </div>
          </div>

          <div
            style={{
              ...statusBadge,
              ...(toolostConnected
                ? connectedBadge
                : disconnectedBadge),
            }}
          >
            {toolostConnected
              ? "● Connected"
              : "● Disconnected"}
          </div>
        </div>

        <div style={integrationActions}>
          <a
            href="/api/toolost/auth"
            style={primaryLink}
          >
            {toolostConnected
              ? "Reconnect Too Lost"
              : "Connect Too Lost"}
          </a>

          <button
            type="button"
            onClick={checkTooLost}
            style={secondaryButton}
          >
            Check Connection
          </button>
        </div>
      </section>

      {/* RELEASE DEFAULTS */}

      <section style={panelStyle}>
        <SectionTitle
          title="Release Defaults"
          description="Default values and release workflow rules."
        />

        <div style={formGrid}>
          <SelectField
            label="Default Language"
            value={
              settings.defaultLanguage
            }
            options={[
              "Hindi",
              "English",
              "Punjabi",
              "Bengali",
              "Tamil",
              "Telugu",
              "Urdu",
            ]}
            onChange={(value) =>
              updateField(
                "defaultLanguage",
                value
              )
            }
          />

          <SelectField
            label="Default Genre"
            value={
              settings.defaultGenre
            }
            options={[
              "Pop",
              "Hip Hop",
              "Rock",
              "Electronic",
              "Classical",
              "Folk",
              "World",
              "Soundtrack",
            ]}
            onChange={(value) =>
              updateField(
                "defaultGenre",
                value
              )
            }
          />
        </div>

        <div style={toggleList}>
          <Toggle
            title="Auto Approve Releases"
            description="Automatically approve releases without manual admin review."
            checked={
              settings.autoApprove
            }
            onChange={(value) =>
              updateField(
                "autoApprove",
                value
              )
            }
          />

          <Toggle
            title="Require Rights Confirmation"
            description="Require rights confirmation before sending a release to Too Lost."
            checked={
              settings.requireRightsConfirmation
            }
            onChange={(value) =>
              updateField(
                "requireRightsConfirmation",
                value
              )
            }
          />

          <Toggle
            title="Enable Content ID by Default"
            description="Enable Content ID as a default option for eligible releases."
            checked={
              settings.enableContentId
            }
            onChange={(value) =>
              updateField(
                "enableContentId",
                value
              )
            }
          />
        </div>
      </section>

      {/* NOTIFICATIONS */}

      <section style={panelStyle}>
        <SectionTitle
          title="Notifications"
          description="Choose which dashboard notifications should be enabled."
        />

        <div style={toggleList}>
          <Toggle
            title="Email Notifications"
            description="Send important admin notifications by email."
            checked={
              settings.emailNotifications
            }
            onChange={(value) =>
              updateField(
                "emailNotifications",
                value
              )
            }
          />

          <Toggle
            title="Release Notifications"
            description="Notify admins when release status changes."
            checked={
              settings.releaseNotifications
            }
            onChange={(value) =>
              updateField(
                "releaseNotifications",
                value
              )
            }
          />

          <Toggle
            title="Payout Notifications"
            description="Notify admins about payout and withdrawal activity."
            checked={
              settings.payoutNotifications
            }
            onChange={(value) =>
              updateField(
                "payoutNotifications",
                value
              )
            }
          />
        </div>
      </section>
    </main>
  );
}

/* =====================================
   COMPONENTS
===================================== */

function SectionTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div style={sectionHeader}>
      <h2 style={sectionTitle}>
        {title}
      </h2>

      <p style={sectionDescription}>
        {description}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label style={fieldWrap}>
      <span style={labelStyle}>
        {label}
      </span>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        style={inputStyle}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <label style={fieldWrap}>
      <span style={labelStyle}>
        {label}
      </span>

      <select
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        style={inputStyle}
      >
        {options.map(
          (option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          )
        )}
      </select>
    </label>
  );
}

function Toggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (
    value: boolean
  ) => void;
}) {
  return (
    <div style={toggleRow}>
      <div>
        <div style={toggleTitle}>
          {title}
        </div>

        <div
          style={
            toggleDescription
          }
        >
          {description}
        </div>
      </div>

      <button
        type="button"
        onClick={() =>
          onChange(!checked)
        }
        style={{
          ...switchStyle,
          background: checked
            ? "#0ea5e9"
            : "#253246",
        }}
      >
        <span
          style={{
            ...switchDot,
            transform: checked
              ? "translateX(22px)"
              : "translateX(0)",
          }}
        />
      </button>
    </div>
  );
}

/* =====================================
   STYLES
===================================== */

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "transparent",
  color: "#f8fafc",
  padding: "8px 4px 40px",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent:
    "space-between",
  gap: "20px",
  padding: "8px 4px 26px",
  borderBottom:
    "1px solid #172638",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  color: "#38bdf8",
  background:
    "rgba(14,165,233,0.08)",
  border:
    "1px solid rgba(56,189,248,0.25)",
  borderRadius: "6px",
  padding: "5px 8px",
  fontSize: "10px",
  fontWeight: 800,
};

const titleStyle: React.CSSProperties = {
  margin: "10px 0 5px",
  fontSize: "30px",
  letterSpacing: "-0.03em",
};

const subtitleStyle: React.CSSProperties = {
  color: "#7f94aa",
  margin: 0,
  fontSize: "13px",
};

const saveButton: React.CSSProperties = {
  border: 0,
  borderRadius: "9px",
  background:
    "linear-gradient(135deg,#0ea5e9,#2563eb)",
  color: "#fff",
  fontWeight: 700,
  padding: "11px 18px",
  cursor: "pointer",
};

const messageBox: React.CSSProperties = {
  marginTop: "18px",
  border:
    "1px solid #155e75",
  color: "#7dd3fc",
  background:
    "rgba(8,47,73,0.5)",
  padding: "13px",
  borderRadius: "10px",
};

const panelStyle: React.CSSProperties = {
  marginTop: "20px",
  border:
    "1px solid #17283a",
  background:
    "linear-gradient(180deg,#0a1624,#09131f)",
  borderRadius: "14px",
  padding: "22px",
  boxShadow:
    "0 18px 40px rgba(0,0,0,0.12)",
};

const sectionHeader: React.CSSProperties = {
  paddingBottom: "18px",
  marginBottom: "18px",
  borderBottom:
    "1px solid #162638",
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "17px",
};

const sectionDescription: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#71869c",
  fontSize: "12px",
};

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(250px,1fr))",
  gap: "16px",
};

const fieldWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "7px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#a9b8c8",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#07111d",
  color: "#fff",
  border:
    "1px solid #203146",
  borderRadius: "9px",
  padding: "11px 12px",
  outline: "none",
};

const integrationRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent:
    "space-between",
  gap: "16px",
};

const integrationInfo: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "13px",
};

const integrationIcon: React.CSSProperties = {
  width: "46px",
  height: "46px",
  borderRadius: "12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#38bdf8",
  background:
    "rgba(14,165,233,.1)",
  border:
    "1px solid rgba(56,189,248,.2)",
  fontWeight: 800,
};

const integrationTitle: React.CSSProperties = {
  fontWeight: 700,
};

const integrationSub: React.CSSProperties = {
  color: "#6f8398",
  marginTop: "3px",
  fontSize: "11px",
};

const statusBadge: React.CSSProperties = {
  borderRadius: "20px",
  padding: "7px 11px",
  fontSize: "11px",
  fontWeight: 700,
};

const connectedBadge: React.CSSProperties = {
  color: "#34d399",
  background:
    "rgba(6,78,59,.35)",
  border:
    "1px solid rgba(16,185,129,.25)",
};

const disconnectedBadge: React.CSSProperties = {
  color: "#f87171",
  background:
    "rgba(127,29,29,.25)",
  border:
    "1px solid rgba(239,68,68,.25)",
};

const integrationActions: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  marginTop: "20px",
};

const primaryLink: React.CSSProperties = {
  textDecoration: "none",
  background:
    "linear-gradient(135deg,#0284c7,#2563eb)",
  color: "#fff",
  borderRadius: "8px",
  padding: "10px 14px",
  fontSize: "12px",
  fontWeight: 700,
};

const secondaryButton: React.CSSProperties = {
  background: "#0c1927",
  color: "#cbd5e1",
  border:
    "1px solid #203146",
  borderRadius: "8px",
  padding: "10px 14px",
  cursor: "pointer",
};

const toggleList: React.CSSProperties = {
  marginTop: "18px",
  display: "flex",
  flexDirection: "column",
};

const toggleRow: React.CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  gap: "20px",
  padding: "16px 0",
  borderBottom:
    "1px solid #132234",
};

const toggleTitle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
};

const toggleDescription: React.CSSProperties = {
  fontSize: "11px",
  color: "#6f8398",
  marginTop: "4px",
  maxWidth: "650px",
};

const switchStyle: React.CSSProperties = {
  width: "48px",
  height: "26px",
  padding: "3px",
  border: 0,
  borderRadius: "99px",
  cursor: "pointer",
  transition:
    "background .2s",
};

const switchDot: React.CSSProperties = {
  display: "block",
  width: "20px",
  height: "20px",
  borderRadius: "50%",
  background: "#fff",
  transition:
    "transform .2s",
};