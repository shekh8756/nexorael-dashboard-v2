"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function WhiteLabelsPage() {
  const router = useRouter();

  const [labels, setLabels] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [commission, setCommission] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    loadLabels();
  }, []);

  async function loadLabels() {
    const { data: labelsData, error: labelsError } = await supabase
      .from("white_labels")
      .select("*")
      .order("created_at", { ascending: false });

    if (labelsError) {
      alert(labelsError.message);
      setPageLoading(false);
      return;
    }

    const { data: usersData } = await supabase
      .from("profiles")
      .select("id, white_label_id");

    const { data: releasesData } = await supabase
      .from("releases")
      .select("id, white_label_id, status");

    const finalLabels = (labelsData || []).map((label) => {
      const labelUsers =
        usersData?.filter((user) => user.white_label_id === label.id) || [];

      const labelReleases =
        releasesData?.filter((release) => release.white_label_id === label.id) || [];

      return {
        ...label,
        total_users: labelUsers.length,
        total_releases: labelReleases.length,
        pending_releases: labelReleases.filter(
          (r) => r.status === "submitted"
        ).length,
        live_releases: labelReleases.filter((r) => r.status === "live").length,
      };
    });

    setLabels(finalLabels);
    setPageLoading(false);
  }

  async function createLabel(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      alert("Label name is required.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("white_labels").insert({
      name,
      domain,
      commission_percent: Number(commission || 0),
      status: "active",
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("White Label Created");

    setName("");
    setDomain("");
    setCommission("");

    loadLabels();
  }

  async function toggleStatus(id: string, status: string) {
    const newStatus = status === "active" ? "inactive" : "active";

    const { error } = await supabase
      .from("white_labels")
      .update({
        status: newStatus,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadLabels();
  }

  return (
    <main style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={{ fontSize: "32px", margin: 0 }}>
            White Label Management
          </h1>

          <p style={{ color: "#94A3B8" }}>
            Create and manage partner label dashboards under Nexorael.
          </p>
        </div>

        <button onClick={() => router.push("/dashboard")} style={secondaryButton}>
          Back to Dashboard
        </button>
      </div>

      <form onSubmit={createLabel} style={formStyle}>
        <h2 style={{ marginTop: 0 }}>Create White Label</h2>

        <input
          placeholder="Label Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />

        <input
          placeholder="Domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          style={inputStyle}
        />

        <input
          placeholder="Commission %"
          value={commission}
          onChange={(e) => setCommission(e.target.value)}
          style={inputStyle}
        />

        <button style={buttonStyle}>
          {loading ? "Creating..." : "Create White Label"}
        </button>
      </form>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>White Labels</h2>

        {pageLoading ? (
          <p>Loading white labels...</p>
        ) : labels.length === 0 ? (
          <p style={{ color: "#94A3B8" }}>No white labels created yet.</p>
        ) : (
          <div style={gridStyle}>
            {labels.map((label) => (
              <div key={label.id} style={cardStyle}>
                <div style={cardTop}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "22px" }}>
                      {label.name || label.brand_name || "Unnamed Label"}
                    </h3>

                    <p style={{ color: "#94A3B8", marginBottom: 0 }}>
                      {label.domain || "No domain added"}
                    </p>
                  </div>

                  <span
                    style={{
                      ...statusBadge,
                      background:
                        label.status === "active" ? "#065F46" : "#7F1D1D",
                    }}
                  >
                    {label.status || "active"}
                  </span>
                </div>

                <div style={miniGrid}>
                  <div style={miniBox}>
                    <p>Users</p>
                    <h3>{label.total_users}</h3>
                  </div>

                  <div style={miniBox}>
                    <p>Releases</p>
                    <h3>{label.total_releases}</h3>
                  </div>

                  <div style={miniBox}>
                    <p>Pending</p>
                    <h3>{label.pending_releases}</h3>
                  </div>

                  <div style={miniBox}>
                    <p>Live</p>
                    <h3>{label.live_releases}</h3>
                  </div>
                </div>

                <p style={{ color: "#CBD5E1" }}>
                  Commission: {label.commission_percent || 0}%
                </p>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    onClick={() =>
                      router.push(`/admin/white-labels/${label.id}`)
                    }
                    style={buttonStyle}
                  >
                    View Dashboard
                  </button>

                  <button
                    onClick={() => toggleStatus(label.id, label.status)}
                    style={secondaryButton}
                  >
                    Toggle Status
                  </button>
                </div>
              </div>
            ))}
          </div>
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

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "24px",
};

const formStyle = {
  background: "#111827",
  padding: "22px",
  borderRadius: "16px",
  maxWidth: "720px",
  border: "1px solid #1F2937",
};

const sectionStyle = {
  marginTop: "30px",
  background: "#111827",
  padding: "22px",
  borderRadius: "16px",
  border: "1px solid #1F2937",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))",
  gap: "18px",
};

const cardStyle = {
  background: "#0B1020",
  padding: "20px",
  borderRadius: "16px",
  border: "1px solid #1F2937",
};

const cardTop = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  alignItems: "flex-start",
};

const miniGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "10px",
  marginTop: "18px",
  marginBottom: "16px",
};

const miniBox = {
  background: "#111827",
  border: "1px solid #1F2937",
  borderRadius: "12px",
  padding: "12px",
};

const statusBadge = {
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  color: "white",
};

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginBottom: "12px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#0B1020",
  color: "white",
};

const buttonStyle = {
  padding: "12px 18px",
  borderRadius: "10px",
  border: "none",
  background: "#2563EB",
  color: "white",
  cursor: "pointer",
  fontWeight: "bold",
};

const secondaryButton = {
  padding: "12px 18px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#111827",
  color: "white",
  cursor: "pointer",
};