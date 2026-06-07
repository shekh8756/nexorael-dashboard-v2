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
      alert(error.message);
      setLoading(false);
      return;
    }
const { data: royalties } = await supabase
  .from("royalties")
  .select("revenue")
  .eq("user_id", userData.user.id);

const totalRevenue =
  royalties?.reduce(
    (sum, row) => sum + Number(row.revenue || 0),
    0
  ) || 0;

const pendingAmount =
  (data || [])
    .filter((x) => x.status === "pending")
    .reduce(
      (sum, row) => sum + Number(row.amount || 0),
      0
    );

setAvailableBalance(
  Number((totalRevenue - pendingAmount).toFixed(2))
);

setPendingBalance(
  Number(pendingAmount.toFixed(2))
);
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
const requestAmount = Number(amount);

if (requestAmount <= 0) {
  alert("Invalid amount");
  return;
}

if (requestAmount > availableBalance) {
  alert(
    `Maximum withdrawal allowed is $${availableBalance}`
  );
  return;
}
const { error } = await supabase
  .from("withdrawals")
  .insert({
    user_id: userData.user.id,

    amount: Number(amount),

    method,

    status: "pending",

    paypal_name:
      method === "paypal"
        ? paypalName
        : null,

    paypal_email:
      method === "paypal"
        ? paypalEmail
        : null,

    bank_name:
      method === "bank"
        ? bankName
        : null,

    bank_ifsc:
      method === "bank"
        ? bankIfsc
        : null,

    bank_swift:
      method === "bank"
        ? bankSwift
        : null,

    bank_account:
      method === "bank"
        ? bankAccount
        : null,

    bank_address:
      method === "bank"
        ? bankAddress
        : null,

    bank_holder:
      method === "bank"
        ? bankHolder
        : null,
  });

    if (error) {
  alert(error.message);
  return;
}

await supabase
  .from("notifications")
  .insert({
    user_id: userData.user.id,
    title: "Withdrawal Request",
    message: `Withdrawal request submitted for $${amount}`,
    type: "withdrawal",
    is_read: false,
  });

alert("Withdrawal request submitted.");

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
          required
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
  required
>
  <option value="">Select Method</option>
  <option value="paypal">PayPal</option>
  <option value="bank">Bank Transfer</option>
</select>

{method === "paypal" && (
  <>
    <label>PayPal Name</label>

    <input
      value={paypalName}
      onChange={(e) => setPaypalName(e.target.value)}
      style={inputStyle}
      required
    />

    <label>PayPal Email</label>

    <input
      type="email"
      value={paypalEmail}
      onChange={(e) => setPaypalEmail(e.target.value)}
      style={inputStyle}
      required
    />
  </>
)}

{method === "bank" && (
  <>
    <label>Bank Name</label>
    <input
      value={bankName}
      onChange={(e) => setBankName(e.target.value)}
      style={inputStyle}
      required
    />

    <label>Bank Account Number</label>
    <input
      value={bankAccount}
      onChange={(e) => setBankAccount(e.target.value)}
      style={inputStyle}
      required
    />

    <label>IFSC Code</label>
    <input
      value={bankIfsc}
      onChange={(e) => setBankIfsc(e.target.value)}
      style={inputStyle}
      required
    />

    <label>SWIFT Code</label>
    <input
      value={bankSwift}
      onChange={(e) => setBankSwift(e.target.value)}
      style={inputStyle}
      required
    />

    <label>Bank Address</label>
    <input
      value={bankAddress}
      onChange={(e) => setBankAddress(e.target.value)}
      style={inputStyle}
      required
    />

    <label>Account Holder Name</label>
    <input
      value={bankHolder}
      onChange={(e) => setBankHolder(e.target.value)}
      style={inputStyle}
      required
    />
  </>
)}

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