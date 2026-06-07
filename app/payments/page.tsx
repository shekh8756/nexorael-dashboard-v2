"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function PaymentsPage() {
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWithdrawals();
  }, []);

  async function loadWithdrawals() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setWithdrawals(data || []);
    setLoading(false);
  }

  async function submitWithdrawal(e: React.FormEvent) {
    e.preventDefault();

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("withdrawals").insert({
      user_id: userData.user.id,
      amount: Number(amount),
      method,
      status: "pending",
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Withdrawal request submitted.");
    setAmount("");
    setMethod("");
    loadWithdrawals();
  }

  return (
    <main style={pageStyle}>

  <button
    onClick={() => router.push("/dashboard")}
    style={{
      padding: "10px 16px",
      borderRadius: "10px",
      border: "1px solid #334155",
      background: "#0B1020",
      color: "white",
      cursor: "pointer",
      marginBottom: "16px",
    }}
  >
    ← Back
  </button>

  <h1>Payments & Withdrawals</h1>
      <p style={{ color: "#94A3B8" }}>
        Request royalty withdrawals and view payment status.
      </p>

      <section style={summaryBox}>
        <div>
          <p style={{ color: "#94A3B8" }}>Available Balance</p>
          <h2>$0.00</h2>
        </div>

        <div>
          <p style={{ color: "#94A3B8" }}>Pending Withdrawal</p>
          <h2>$0.00</h2>
        </div>
      </section>

      <form onSubmit={submitWithdrawal} style={formStyle}>
        <h2>Request Withdrawal</h2>

        <label>Amount</label>
        <input
          required
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={inputStyle}
        />

        <label>Payment Method</label>
        <input
          required
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          placeholder="Bank, PayPal, Wise, UPI"
          style={inputStyle}
        />

        <button style={buttonStyle}>Submit Request</button>
      </form>

      <section style={sectionStyle}>
        <h2>Withdrawal History</h2>

        {loading ? (
          <p>Loading...</p>
        ) : withdrawals.length === 0 ? (
          <p style={{ color: "#94A3B8" }}>No withdrawal requests yet.</p>
        ) : (
          withdrawals.map((item) => (
            <div key={item.id} style={itemBox}>
              <p>Amount: ${item.amount}</p>
              <p>Method: {item.method}</p>
              <span style={statusStyle}>{item.status}</span>
            </div>
          ))
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

const summaryBox = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "18px",
  maxWidth: "760px",
  marginTop: "24px",
};

const formStyle = {
  maxWidth: "760px",
  background: "#111827",
  padding: "22px",
  borderRadius: "16px",
  border: "1px solid #1F2937",
  marginTop: "22px",
};

const sectionStyle = {
  marginTop: "25px",
  maxWidth: "900px",
  background: "#111827",
  padding: "22px",
  borderRadius: "16px",
  border: "1px solid #1F2937",
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
  padding: "12px 16px",
  borderRadius: "10px",
  border: "none",
  background: "#2563EB",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const itemBox = {
  background: "#0B1020",
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #1F2937",
  marginTop: "12px",
};

const statusStyle = {
  display: "inline-block",
  background: "#374151",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
};