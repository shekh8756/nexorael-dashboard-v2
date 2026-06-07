"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminContractsPage() {
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [adminProfile, setAdminProfile] = useState<any>(null);

  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role,status,white_label_id")
      .eq("id", userData.user.id)
      .single();

    if (
      !profile ||
      profile.status !== "active" ||
      !["master_admin", "white_label_admin"].includes(profile.role)
    ) {
      alert("Admin access only.");
      router.push("/dashboard");
      return;
    }

    setAdminProfile(profile);
    await loadUsers(profile);
    await loadContracts(profile);
    setLoading(false);
  }

  async function loadUsers(profile = adminProfile) {
    let query = supabase
      .from("profiles")
      .select("id, full_name, email, white_label_id")
      .order("created_at", { ascending: false });

    if (profile?.role === "white_label_admin") {
      query = query.eq("white_label_id", profile.white_label_id);
    }

    const { data } = await query;
    setUsers(data || []);
  }

  async function loadContracts(profile = adminProfile) {
    let query = supabase
      .from("contracts")
      .select("*")
      .order("created_at", { ascending: false });

    if (profile?.role === "white_label_admin") {
      query = query.eq("white_label_id", profile.white_label_id);
    }

    const { data: contractData, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, email, white_label_id");

    const merged = (contractData || []).map((contract) => {
      const user = profilesData?.find((p) => p.id === contract.user_id);

      return {
        ...contract,
        user_name: user?.full_name || "-",
        user_email: user?.email || "-",
      };
    });

    setContracts(merged);
  }

  async function uploadContract(e: React.FormEvent) {
    e.preventDefault();

    if (!userId || !title || !file) {
      alert("Please select user, title and contract PDF.");
      return;
    }

    setUploading(true);

    const selectedUser = users.find((u) => u.id === userId);
    const cleanName = file.name.replace(/\s+/g, "-");
    const fileName = `contracts/${Date.now()}-${cleanName}`;

    const { error: uploadError } = await supabase.storage
      .from("contracts")
      .upload(fileName, file);

    if (uploadError) {
      alert(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicData } = supabase.storage
      .from("contracts")
      .getPublicUrl(fileName);

    const { error } = await supabase.from("contracts").insert({
      user_id: userId,
      white_label_id: selectedUser?.white_label_id || null,
      title,
      file_url: publicData.publicUrl,
      status: "pending",
    });

    setUploading(false);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: userId,
      title: "New contract assigned",
      message: `A new contract "${title}" has been assigned to your account.`,
      type: "contract",
      is_read: false,
    });

    alert("Contract uploaded.");
    setUserId("");
    setTitle("");
    setFile(null);
    loadContracts(adminProfile);
  }

  async function updateContractStatus(id: string, status: string) {
    const note = prompt("Admin note optional:") || "";
    const contract = contracts.find((c) => c.id === id);

    const { error } = await supabase
      .from("contracts")
      .update({ status, admin_note: note })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    if (contract?.user_id) {
      await supabase.from("notifications").insert({
        user_id: contract.user_id,
        title: "Contract updated",
        message: `Your contract "${contract.title}" status is now ${status}.`,
        type: "contract",
        is_read: false,
      });
    }

    loadContracts(adminProfile);
  }

  return (
    <main style={pageStyle}>
      <button onClick={() => router.push("/dashboard")} style={backButton}>
        ← Back to Dashboard
      </button>

      <h1>Contract Manager</h1>
      <p style={{ color: "#94A3B8" }}>
        Upload, assign and manage user / white-label contracts.
      </p>

      <form onSubmit={uploadContract} style={formStyle}>
        <h2 style={{ marginTop: 0 }}>Upload Contract</h2>

        <label>User</label>
        <select
          required
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          style={inputStyle}
        >
          <option value="">Select User</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name || user.email} — {user.email}
            </option>
          ))}
        </select>

        <label>Contract Title</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Distribution Agreement"
          style={inputStyle}
        />

        <label>Contract PDF</label>
        <input
          required
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          style={inputStyle}
        />

        <button disabled={uploading} style={buttonStyle}>
          {uploading ? "Uploading..." : "Upload Contract"}
        </button>
      </form>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>Contracts</h2>

        {loading ? (
          <p>Loading contracts...</p>
        ) : contracts.length === 0 ? (
          <p style={{ color: "#94A3B8" }}>No contracts found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
            <thead>
              <tr style={{ color: "#94A3B8" }}>
                <th align="left" style={thStyle}>Title</th>
                <th align="left" style={thStyle}>User</th>
                <th align="left" style={thStyle}>Email</th>
                <th align="left" style={thStyle}>Status</th>
                <th align="left" style={thStyle}>Date</th>
                <th align="left" style={thStyle}>Action</th>
              </tr>
            </thead>

            <tbody>
              {contracts.map((contract) => (
                <tr key={contract.id}>
                  <td style={tdStyle}>{contract.title}</td>
                  <td style={tdStyle}>{contract.user_name}</td>
                  <td style={tdStyle}>{contract.user_email}</td>
                  <td style={tdStyle}>
                    <span style={statusStyle}>{contract.status}</span>
                  </td>
                  <td style={tdStyle}>
                    {contract.created_at
                      ? new Date(contract.created_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td style={tdStyle}>
                    <a href={contract.file_url} target="_blank" style={linkStyle}>
                      View
                    </a>

                    <button
                      onClick={() => updateContractStatus(contract.id, "signed")}
                      style={smallButton}
                    >
                      Signed
                    </button>

                    <button
                      onClick={() => updateContractStatus(contract.id, "rejected")}
                      style={dangerButton}
                    >
                      Reject
                    </button>

                    <button
                      onClick={() => updateContractStatus(contract.id, "pending")}
                      style={smallButton}
                    >
                      Pending
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

const backButton = {
  marginBottom: "20px",
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#111827",
  color: "white",
  cursor: "pointer",
};

const formStyle = {
  maxWidth: "760px",
  background: "#111827",
  padding: "22px",
  borderRadius: "18px",
  border: "1px solid #1F2937",
  marginTop: "24px",
};

const sectionStyle = {
  marginTop: "26px",
  background: "#111827",
  padding: "22px",
  borderRadius: "18px",
  border: "1px solid #1F2937",
  overflowX: "auto" as const,
};

const inputStyle = {
  width: "100%",
  padding: "13px",
  marginTop: "7px",
  marginBottom: "16px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#0B1020",
  color: "white",
};

const buttonStyle = {
  padding: "11px 15px",
  borderRadius: "10px",
  border: "none",
  background: "#2563EB",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const thStyle = {
  padding: "12px 8px",
  borderBottom: "1px solid #334155",
};

const tdStyle = {
  padding: "14px 8px",
  borderBottom: "1px solid #1F2937",
};

const statusStyle = {
  display: "inline-block",
  background: "#374151",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
};

const smallButton = {
  marginLeft: "8px",
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

const linkStyle = {
  color: "#60A5FA",
  marginRight: "8px",
};