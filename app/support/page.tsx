"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function SupportPage() {
  const router = useRouter();

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("release_issue");
  const [priority, setPriority] = useState("normal");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTickets() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setTickets(data || []);
    setLoading(false);
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("white_label_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    const { error } = await supabase.from("support_tickets").insert({
      user_id: userData.user.id,
      white_label_id: profile?.white_label_id || null,
      subject,
      category,
      priority,
      message,
      status: "open",
    });

    setCreating(false);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: userData.user.id,
      title: "Support ticket created",
      message: `Your support ticket "${subject}" has been created.`,
      type: "support",
      is_read: false,
    });

    alert("Support ticket created.");

    setSubject("");
    setCategory("release_issue");
    setPriority("normal");
    setMessage("");

    loadTickets();
  }

  return (
    <main style={pageStyle}>
      <button onClick={() => router.push("/dashboard")} style={backButton}>
        ← Back to Dashboard
      </button>

      <h1>Support</h1>

      <p style={{ color: "#94A3B8" }}>
        Create tickets for release, DSP delivery, royalty, copyright or account
        issues.
      </p>

      <form onSubmit={createTicket} style={formStyle}>
        <h2 style={{ marginTop: 0 }}>Create Support Ticket</h2>

        <label>Subject</label>
        <input
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Example: My release is not live"
          style={inputStyle}
        />

        <label>Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={inputStyle}
        >
          <option value="release_issue">Release Issue</option>
          <option value="dsp_delivery">DSP Delivery</option>
          <option value="royalty">Royalty / Revenue</option>
          <option value="copyright">Copyright / Claim</option>
          <option value="account">Account</option>
          <option value="other">Other</option>
        </select>

        <label>Priority</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          style={inputStyle}
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        <label>Message</label>
        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Explain your issue clearly..."
          style={{ ...inputStyle, minHeight: "130px" }}
        />

        <button type="submit" disabled={creating} style={buttonStyle}>
          {creating ? "Creating..." : "Create Ticket"}
        </button>
      </form>

      <section style={sectionStyle}>
        <h2 style={{ marginTop: 0 }}>My Tickets</h2>

        {loading ? (
          <p>Loading tickets...</p>
        ) : tickets.length === 0 ? (
          <p style={{ color: "#94A3B8" }}>No tickets yet.</p>
        ) : (
          tickets.map((ticket) => (
            <div key={ticket.id} style={ticketBox}>
              <div>
                <h3 style={{ margin: "0 0 8px" }}>{ticket.subject}</h3>

                <p style={{ color: "#CBD5E1", margin: "5px 0" }}>
                  Category: {ticket.category}
                </p>

                <p style={{ color: "#CBD5E1", margin: "5px 0" }}>
                  Priority: {ticket.priority}
                </p>

                <p style={{ color: "#94A3B8", margin: "5px 0" }}>
                  Created:{" "}
                  {ticket.created_at
                    ? new Date(ticket.created_at).toLocaleString()
                    : "-"}
                </p>
              </div>

              <div style={{ textAlign: "right" }}>
                <span style={statusStyle}>{ticket.status}</span>

                <br />

                <button
                  onClick={() => router.push(`/support/${ticket.id}`)}
                  style={{ ...buttonStyle, marginTop: "12px" }}
                >
                  View Ticket
                </button>
              </div>
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
  maxWidth: "1000px",
  background: "#111827",
  padding: "22px",
  borderRadius: "18px",
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
  padding: "11px 15px",
  borderRadius: "10px",
  border: "none",
  background: "#2563EB",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const ticketBox = {
  background: "#0B1020",
  border: "1px solid #1F2937",
  padding: "16px",
  borderRadius: "14px",
  marginTop: "12px",
  display: "flex",
  justifyContent: "space-between",
  gap: "14px",
};

const statusStyle = {
  display: "inline-block",
  background: "#1D4ED8",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
};