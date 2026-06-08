"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminWithdrawalsPage() {
  const router = useRouter();

  const [withdrawals, setWithdrawals] = useState<any[]>([]);
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
    await loadWithdrawals(profile);
  }

  async function loadWithdrawals(profileParam = adminProfile) {
let query = supabase
  .from("withdrawals")
  .select("*")
  .order("created_at", { ascending: false });

    const { data: withdrawalsData, error } = await query;

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, email, white_label_id");

    const { data: whiteLabelsData } = await supabase
      .from("white_labels")
      .select("id, name, brand_name");

    let merged = (withdrawalsData || []).map((item) => {
      const user = profilesData?.find((p) => p.id === item.user_id);
      const wl = whiteLabelsData?.find((w) => w.id === user?.white_label_id);

      return {
        ...item,
        user_name: user?.full_name || "-",
        user_email: user?.email || "-",
        white_label_id: user?.white_label_id || null,
        white_label_name: wl?.name || wl?.brand_name || "Nexorael Direct",
      };
    });

    if (profileParam?.role === "white_label_admin") {
      merged = merged.filter(
        (item) => item.white_label_id === profileParam.white_label_id
      );
    }

    setWithdrawals(merged);
    setLoading(false);
  }

  async function updateWithdrawalStatus(id: string, status: string) {
    const withdrawal = withdrawals.find((w) => w.id === id);

    const note = prompt("Admin note optional:") || "";

    const { error } = await supabase
      .from("withdrawals")
      .update({
        status,
        admin_note: note,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    if (withdrawal?.user_id) {
      await supabase.from("notifications").insert({
        user_id: withdrawal.user_id,
        title: "Withdrawal updated",
        message: `Your withdrawal request of $${withdrawal.amount} has been ${status}.`,
        type: "withdrawal",
        is_read: false,
      });
    }

    alert("Withdrawal updated.");
    loadWithdrawals();
  }

  return (
    <main style={pageStyle}>
      <button onClick={() => router.push("/dashboard")} style={backButton}>
        ← Back to Dashboard
      </button>

      <h1>Admin Withdrawals</h1>

      <p style={{ color: "#94A3B8" }}>
        Review, approve, reject and mark royalty withdrawal requests as paid.
      </p>

      <section style={sectionStyle}>
        {loading ? (
          <p>Loading withdrawals...</p>
        ) : withdrawals.length === 0 ? (
          <p>No withdrawal requests found.</p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "1100px",
            }}
          >
            <thead>
              <tr style={{ color: "#94A3B8" }}>
                <th align="left" style={thStyle}>User</th>
                <th align="left" style={thStyle}>Email</th>
                <th align="left" style={thStyle}>White Label</th>
                <th align="left" style={thStyle}>Amount</th>
                <th align="left" style={thStyle}>Method</th>
                <th align="left" style={thStyle}>Payment Details</th>
                <th align="left" style={thStyle}>Status</th>
                <th align="left" style={thStyle}>Date</th>
                <th align="left" style={thStyle}>Admin Note</th>
                <th align="left" style={thStyle}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {withdrawals.map((item) => (
                <tr key={item.id}>
                  <td style={tdStyle}>{item.user_name}</td>
                  <td style={tdStyle}>{item.user_email}</td>
                  <td style={tdStyle}>{item.white_label_name}</td>
                  <td style={tdStyle}>${Number(item.amount || 0).toFixed(2)}</td>
                  <td style={tdStyle}>{item.method || "-"}</td>
                  <td style={tdStyle}>
  {item.method === "paypal" ? (
    <>
      <div>Name: {item.paypal_name}</div>
      <div>Email: {item.paypal_email}</div>
    </>
  ) : (
    <>
      <div>Bank: {item.bank_name}</div>
      <div>IFSC: {item.bank_ifsc}</div>
      <div>SWIFT: {item.bank_swift}</div>
      <div>Acc No: {item.bank_account_number}</div>
      <div>Address: {item.bank_address}</div>
      <div>Name: {item.banking_name}</div>
    </>
  )}
</td>
                  <td style={tdStyle}>
                    <span style={statusStyle}>{item.status}</span>
                  </td>
                  <td style={tdStyle}>
                    {item.created_at
                      ? new Date(item.created_at).toLocaleDateString()
                      : "-"}
                  </td>
                  <td style={tdStyle}>{item.admin_note || "-"}</td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => updateWithdrawalStatus(item.id, "approved")}
                      style={smallButton}
                    >
                      Approve
                    </button>

                    <button
                      onClick={() => updateWithdrawalStatus(item.id, "rejected")}
                      style={dangerButton}
                    >
                      Reject
                    </button>

                    <button
                      onClick={() => updateWithdrawalStatus(item.id, "paid")}
                      style={smallButton}
                    >
                      Paid
                    </button>

                    <button
                      onClick={() => updateWithdrawalStatus(item.id, "pending")}
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

const sectionStyle = {
  marginTop: "25px",
  background: "#111827",
  padding: "22px",
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
  display: "inline-block",
  background: "#374151",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
};

const smallButton = {
  marginRight: "8px",
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