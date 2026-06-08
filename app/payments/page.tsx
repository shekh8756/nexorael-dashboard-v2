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

  const [availableBalance, setAvailableBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);

  const [error, setError] = useState("");

  const [paypalEmail, setPaypalEmail] = useState("");
  const [paypalName, setPaypalName] = useState("");

  const [bankName, setBankName] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankSwift, setBankSwift] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAddress, setBankAddress] = useState("");
  const [bankHolder, setBankHolder] = useState("");

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
      setError(error.message);
      setLoading(false);
      return;
    }

    const { data: royalties } = await supabase
      .from("royalties")
      .select("revenue")
      .eq("user_id", userData.user.id);

    const totalRevenue =
      royalties?.reduce((sum, row) => sum + Number(row.revenue || 0), 0) || 0;

    const pendingAmount =
      (data || [])
        .filter((x) => x.status === "pending")
        .reduce((sum, row) => sum + Number(row.amount || 0), 0) || 0;

    setAvailableBalance(Number((totalRevenue - pendingAmount).toFixed(2)));
    setPendingBalance(Number(pendingAmount.toFixed(2)));

    setWithdrawals(data || []);
    setLoading(false);
  }

  async function submitWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const requestAmount = Number(amount);

    // ❌ Amount validation
    if (!requestAmount || requestAmount <= 0) {
      setError("Enter valid amount");
      return;
    }

    if (requestAmount > availableBalance) {
      setError(`Maximum withdrawal allowed is $${availableBalance}`);
      return;
    }

    // ❌ Method validation
    if (!method) {
      setError("Select payment method");
      return;
    }

    // ❌ PayPal validation
    if (method === "paypal") {
      if (!paypalName || !paypalEmail) {
        setError("Fill PayPal details");
        return;
      }
    }

    // ❌ Bank validation
    if (method === "bank") {
      if (
        !bankName ||
        !bankAccount ||
        !bankIfsc ||
        !bankSwift ||
        !bankAddress ||
        !bankHolder
      ) {
        setError("Fill all bank details");
        return;
      }
    }

    const { error } = await supabase.from("withdrawals").insert({
      user_id: userData.user.id,
      amount: requestAmount,
      method,
      status: "pending",

      paypal_name: method === "paypal" ? paypalName : null,
      paypal_email: method === "paypal" ? paypalEmail : null,

      bank_name: method === "bank" ? bankName : null,
      bank_ifsc: method === "bank" ? bankIfsc : null,
      bank_swift: method === "bank" ? bankSwift : null,
      bank_account: method === "bank" ? bankAccount : null,
      bank_address: method === "bank" ? bankAddress : null,
      bank_holder: method === "bank" ? bankHolder : null,
    });

    if (error) {
      setError(error.message);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: userData.user.id,
      title: "Withdrawal Request",
      message: `Withdrawal request submitted for $${requestAmount}`,
      type: "withdrawal",
      is_read: false,
    });

    setAmount("");
    setMethod("");

    setPaypalName("");
    setPaypalEmail("");

    setBankName("");
    setBankIfsc("");
    setBankSwift("");
    setBankAccount("");
    setBankAddress("");
    setBankHolder("");

    loadWithdrawals();
  }

  return (
    <main style={pageStyle}>
      <button onClick={() => router.push("/dashboard")} style={backBtn}>
        ← Back
      </button>

      <h1>Payments & Withdrawals</h1>
      <p style={{ color: "#94A3B8" }}>
        Request royalty withdrawals and view payment status.
      </p>

      <section style={summaryBox}>
        <div>
          <p style={{ color: "#94A3B8" }}>Available Balance</p>
          <h2>${availableBalance.toFixed(2)}</h2>
        </div>

        <div>
          <p style={{ color: "#94A3B8" }}>Pending Withdrawal</p>
          <h2>${pendingBalance.toFixed(2)}</h2>
        </div>
      </section>

      <form onSubmit={submitWithdrawal} style={formStyle}>
        <h2>Request Withdrawal</h2>

        <label>Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={inputStyle}
        />

        <label>Payment Method</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          style={inputStyle}
        >
          <option value="">Select Method</option>
          <option value="paypal">PayPal</option>
          <option value="bank">Bank Transfer</option>
        </select>

        {/* PayPal */}
        {method === "paypal" && (
          <>
            <input
              placeholder="PayPal Name"
              value={paypalName}
              onChange={(e) => setPaypalName(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="PayPal Email"
              value={paypalEmail}
              onChange={(e) => setPaypalEmail(e.target.value)}
              style={inputStyle}
            />
          </>
        )}

        {/* Bank */}
        {method === "bank" && (
          <>
            <input
              placeholder="Bank Name"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="Account Number"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="IFSC Code"
              value={bankIfsc}
              onChange={(e) => setBankIfsc(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="SWIFT Code"
              value={bankSwift}
              onChange={(e) => setBankSwift(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="Bank Address"
              value={bankAddress}
              onChange={(e) => setBankAddress(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="Account Holder Name"
              value={bankHolder}
              onChange={(e) => setBankHolder(e.target.value)}
              style={inputStyle}
            />
          </>
        )}

        {error && <p style={{ color: "red" }}>{error}</p>}

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

              {item.method === "paypal" && (
                <>
                  <p>Name: {item.paypal_name}</p>
                  <p>Email: {item.paypal_email}</p>
                </>
              )}

              {item.method === "bank" && (
                <>
                  <p>Bank: {item.bank_name}</p>
                  <p>Account: {item.bank_account}</p>
                  <p>IFSC: {item.bank_ifsc}</p>
                  <p>SWIFT: {item.bank_swift}</p>
                </>
              )}

              <span style={statusStyle}>{item.status}</span>
            </div>
          ))
        )}
      </section>
    </main>
  );
}

/* styles same as yours (unchanged) */
const pageStyle = {
  minHeight: "100vh",
  background: "#050816",
  color: "white",
  padding: "35px",
  fontFamily: "Arial",
};

const backBtn = {
  padding: "10px 16px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#0B1020",
  color: "white",
  marginBottom: "16px",
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
  background: "#2563EB",
  color: "white",
  border: "none",
};

const itemBox = {
  background: "#0B1020",
  padding: "16px",
  borderRadius: "14px",
  marginTop: "12px",
};

const statusStyle = {
  background: "#374151",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
};