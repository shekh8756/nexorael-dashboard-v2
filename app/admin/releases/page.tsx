"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminReleasesPage() {
  const router = useRouter();

  const [releases, setReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminProfile, setAdminProfile] = useState<any>(null);

  useEffect(() => {
    checkAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAdmin() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role,status,white_label_id")
      .eq("id", userData.user.id)
      .single();

    if (error || !profile) {
      router.push("/dashboard");
      return;
    }

    const allowedRoles = ["master_admin", "white_label_admin"];

    if (!allowedRoles.includes(profile.role) || profile.status !== "active") {
      alert("Admin access only.");
      router.push("/dashboard");
      return;
    }

    setAdminProfile(profile);
    await loadReleases(profile);
  }

  async function loadReleases(profileParam = adminProfile) {
  let releaseQuery = supabase
    .from("releases")
    .select("*")
    .order("created_at", { ascending: false });

  if (profileParam?.role === "white_label_admin") {
    if (!profileParam.white_label_id) {
      setReleases([]);
      setLoading(false);
      return;
    }

    releaseQuery = releaseQuery.eq("white_label_id", profileParam.white_label_id);
  }

  const { data: releaseData, error: releaseError } = await releaseQuery;

  if (releaseError) {
    alert(releaseError.message);
    setLoading(false);
    return;
  }

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, white_label_id");

  const { data: whiteLabelsData } = await supabase
    .from("white_labels")
    .select("id, name, brand_name, domain");

  const merged = (releaseData || []).map((release) => {
    const profile = profilesData?.find((p) => p.id === release.user_id);
    const whiteLabel = whiteLabelsData?.find(
      (wl) => wl.id === release.white_label_id
    );

    return {
      ...release,
      uploaded_by_name: profile?.full_name || "-",
      uploaded_by_email: profile?.email || "-",
      white_label_name:
        whiteLabel?.name || whiteLabel?.brand_name || "Nexorael Direct",
    };
  });

  setReleases(merged);
  setLoading(false);
}

  async function updateStatus(id: string, status: string) {
  const note = prompt("Admin note optional:") || "";

  const release = releases.find((r) => r.id === id);

  const { error } = await supabase
    .from("releases")
    .update({
      status,
      admin_note: note,
    })
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  if (release?.user_id) {
    await supabase.from("notifications").insert({
      user_id: release.user_id,
      title: `Release ${status}`,
      message: `Your release "${release.title}" status has been updated to ${status}.`,
      type: status,
      is_read: false,
    });
  }

  alert("Status updated successfully.");
  loadReleases();
}

  async function addDspDelivery(releaseId: string) {
    const dspName = prompt("DSP name, example: Spotify, Apple Music, YouTube Music");
    if (!dspName) return;

    const dspStatus =
      prompt("Status: pending, delivered, processing, live", "delivered") ||
      "delivered";

    const liveLink =
      prompt("Live link optional, agar live nahi hai to blank chhod do") || "";

    const { error } = await supabase.from("dsp_deliveries").insert({
      release_id: releaseId,
      dsp_name: dspName,
      status: dspStatus,
      live_link: liveLink,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("DSP delivery added.");
    loadReleases();
  }

  return (
    <main style={pageStyle}>
      <h1>Admin Release Approval</h1>

      <p style={{ color: "#94A3B8" }}>
        Master admin can view all releases. White-label admin can view only their label releases.
      </p>

      <section style={sectionStyle}>
        {loading ? (
          <p>Loading releases...</p>
        ) : releases.length === 0 ? (
          <p>No releases found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1300px" }}>
            <thead>
              <tr style={{ color: "#94A3B8" }}>
                <th align="left" style={thStyle}>Title</th>
                <th align="left" style={thStyle}>Artist</th>
                <th align="left" style={thStyle}>Label</th>
                <th align="left" style={thStyle}>Uploaded By</th>
                <th align="left" style={thStyle}>User Email</th>
                <th align="left" style={thStyle}>White Label</th>
                <th align="left" style={thStyle}>Submitted</th>
                <th align="left" style={thStyle}>Status</th>
                <th align="left" style={thStyle}>Admin Note</th>
                <th align="left" style={thStyle}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {releases.map((release) => (
                <tr key={release.id}>
                  <td style={tdStyle}>{release.title}</td>
                  <td style={tdStyle}>{release.artist_name}</td>
                  <td style={tdStyle}>{release.label_name}</td>

                  <td style={tdStyle}>
  {release.uploaded_by_name}
</td>

                  <td style={tdStyle}>
  {release.uploaded_by_email}
</td>

                  <td style={tdStyle}>
  {release.white_label_name}
</td>

                  <td style={tdStyle}>
                    {release.created_at
                      ? new Date(release.created_at).toLocaleDateString()
                      : "-"}
                  </td>

                  <td style={tdStyle}>
                    <span style={statusStyle}>{release.status}</span>
                  </td>

                  <td style={tdStyle}>{release.admin_note || "-"}</td>

                  <td style={tdStyle}>
                    <button onClick={() => updateStatus(release.id, "under_review")} style={smallButton}>
                      Review
                    </button>

                    <button onClick={() => updateStatus(release.id, "approved")} style={smallButton}>
                      Approve
                    </button>

                    <button onClick={() => updateStatus(release.id, "rejected")} style={dangerButton}>
                      Reject
                    </button>

                    <button onClick={() => updateStatus(release.id, "delivered")} style={smallButton}>
                      Delivered
                    </button>

                    <button onClick={() => updateStatus(release.id, "live")} style={smallButton}>
                      Live
                    </button>

                    <button onClick={() => addDspDelivery(release.id)} style={smallButton}>
                      Add DSP
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#050816",
  color: "white",
  padding: "35px",
  fontFamily: "Arial, sans-serif",
};

const sectionStyle = {
  marginTop: "25px",
  background: "#111827",
  padding: "20px",
  borderRadius: "16px",
  border: "1px solid #1F2937",
  overflowX: "auto" as const,
};

const thStyle = {
  padding: "12px 8px",
  borderBottom: "1px solid #334155",
};

const tdStyle = {
  padding: "14px 8px",
  borderBottom: "1px solid #1F2937",
  verticalAlign: "top" as const,
};

const statusStyle = {
  background: "#374151",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
};

const smallButton = {
  marginRight: "6px",
  marginBottom: "6px",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "none",
  background: "#2563EB",
  color: "white",
  cursor: "pointer",
};

const dangerButton = {
  ...smallButton,
  background: "#DC2626",
};