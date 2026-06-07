"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminUsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<any[]>([]);
  const [whiteLabels, setWhiteLabels] = useState<any[]>([]);
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

    await loadUsers(profile);
    await loadWhiteLabels(profile);
  }

  async function loadUsers(profileParam = adminProfile) {
    let query = supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profileParam?.role === "white_label_admin") {
      if (!profileParam.white_label_id) {
        setUsers([]);
        setLoading(false);
        return;
      }

      query = query.eq("white_label_id", profileParam.white_label_id);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setUsers(data || []);
    setLoading(false);
  }

  async function loadWhiteLabels(profileParam = adminProfile) {
    let query = supabase
      .from("white_labels")
      .select("*")
      .order("name");

    if (profileParam?.role === "white_label_admin") {
      if (!profileParam.white_label_id) {
        setWhiteLabels([]);
        return;
      }

      query = query.eq("id", profileParam.white_label_id);
    }

    const { data, error } = await query;

    if (error) {
      alert(error.message);
      return;
    }

    setWhiteLabels(data || []);
  }

  async function updateUser(id: string, field: string, value: string) {
    const updateData: any = { [field]: value };

    if (adminProfile?.role === "white_label_admin") {
      const targetUser = users.find((u) => u.id === id);

      if (!targetUser || targetUser.white_label_id !== adminProfile.white_label_id) {
        alert("You can manage only your white-label users.");
        return;
      }

      if (field === "role" && value === "master_admin") {
        alert("White-label admin cannot create master admin.");
        return;
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    alert("User updated.");
    loadUsers();
  }

  async function assignWhiteLabel(userId: string, whiteLabelId: string) {
    if (adminProfile?.role === "white_label_admin") {
      if (whiteLabelId !== adminProfile.white_label_id) {
        alert("You can assign only your own white label.");
        return;
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        white_label_id: whiteLabelId || null,
      })
      .eq("id", userId);

    if (error) {
      alert(error.message);
      return;
    }

    alert("White Label Assigned");
    loadUsers();
  }

  return (
    <main style={pageStyle}>
      <h1>Admin Users</h1>

      <p style={{ color: "#94A3B8" }}>
        Manage Nexorael users, roles, account status and white-label assignment.
      </p>

      <section style={sectionStyle}>
        {loading ? (
          <p>Loading users...</p>
        ) : users.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "#94A3B8" }}>
                <th align="left" style={thStyle}>Name</th>
                <th align="left" style={thStyle}>Email</th>
                <th align="left" style={thStyle}>Role</th>
                <th align="left" style={thStyle}>Status</th>
                <th align="left" style={thStyle}>White Label</th>
                <th align="left" style={thStyle}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td style={tdStyle}>{user.full_name || "-"}</td>
                  <td style={tdStyle}>{user.email}</td>
                  <td style={tdStyle}>{user.role}</td>
                  <td style={tdStyle}>{user.status}</td>

                  <td style={tdStyle}>
                    <select
                      value={user.white_label_id || ""}
                      onChange={(e) =>
                        assignWhiteLabel(user.id, e.target.value)
                      }
                      style={selectStyle}
                      disabled={adminProfile?.role === "white_label_admin"}
                    >
                      <option value="">No Label</option>

                      {whiteLabels.map((label) => (
                        <option key={label.id} value={label.id}>
                          {label.name || label.brand_name || "Unnamed Label"}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={tdStyle}>
                    {adminProfile?.role === "master_admin" && (
                      <button
                        onClick={() =>
                          updateUser(user.id, "role", "master_admin")
                        }
                        style={smallButton}
                      >
                        Make Admin
                      </button>
                    )}

                    <button
                      onClick={() =>
                        updateUser(user.id, "role", "white_label_admin")
                      }
                      style={smallButton}
                    >
                      White Label Admin
                    </button>

                    <button
                      onClick={() =>
                        updateUser(user.id, "role", "label_user")
                      }
                      style={smallButton}
                    >
                      Make User
                    </button>

                    <button
                      onClick={() =>
                        updateUser(user.id, "status", "blocked")
                      }
                      style={dangerButton}
                    >
                      Block
                    </button>

                    <button
                      onClick={() =>
                        updateUser(user.id, "status", "active")
                      }
                      style={smallButton}
                    >
                      Activate
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
};

const selectStyle = {
  padding: "8px",
  borderRadius: "8px",
  background: "#0B1020",
  color: "white",
  border: "1px solid #334155",
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