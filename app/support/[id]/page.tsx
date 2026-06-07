"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useParams, useRouter } from "next/navigation";

export default function SupportTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [replyMessage, setReplyMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTicket() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role,status,white_label_id,full_name,email")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !userProfile || userProfile.status !== "active") {
      alert("Profile not found or blocked.");
      router.push("/login");
      return;
    }

    setProfile(userProfile);

    const { data: ticketData, error: ticketError } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticketData) {
      alert(ticketError?.message || "Ticket not found.");
      router.push("/support");
      return;
    }

    const isAdmin =
      userProfile.role === "master_admin" ||
      userProfile.role === "white_label_admin";

    const hasAccess =
      ticketData.user_id === userData.user.id ||
      userProfile.role === "master_admin" ||
      (userProfile.role === "white_label_admin" &&
        ticketData.white_label_id === userProfile.white_label_id);

    if (!hasAccess) {
      alert("You do not have access to this ticket.");
      router.push("/dashboard");
      return;
    }

    const { data: repliesData, error: repliesError } = await supabase
      .from("support_replies")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (repliesError) {
      alert(repliesError.message);
      return;
    }

    const { data: usersData } = await supabase
      .from("profiles")
      .select("id,full_name,email,role");

    const mergedReplies = (repliesData || []).map((reply) => {
      const author = usersData?.find((u) => u.id === reply.user_id);

      return {
        ...reply,
        author_name: author?.full_name || author?.email || "User",
        author_role: author?.role || "label_user",
      };
    });

    const ticketUser = usersData?.find((u) => u.id === ticketData.user_id);

    setTicket({
      ...ticketData,
      user_name: ticketUser?.full_name || ticketUser?.email || "-",
      user_email: ticketUser?.email || "-",
      is_admin_view: isAdmin,
    });

    setReplies(mergedReplies);
    setLoading(false);
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();

    if (!replyMessage.trim()) {
      alert("Please write a reply.");
      return;
    }

    setSending(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const isAdmin =
      profile?.role === "master_admin" || profile?.role === "white_label_admin";

    const { error } = await supabase.from("support_replies").insert({
      ticket_id: ticketId,
      user_id: userData.user.id,
      message: replyMessage,
      is_admin: isAdmin,
    });

    if (error) {
      setSending(false);
      alert(error.message);
      return;
    }

    await supabase
      .from("support_tickets")
      .update({
        status: isAdmin ? "answered" : "open",
      })
      .eq("id", ticketId);

    if (isAdmin && ticket?.user_id) {
      await supabase.from("notifications").insert({
        user_id: ticket.user_id,
        title: "Support ticket reply",
        message: `You received a reply on ticket "${ticket.subject}".`,
        type: "support",
        is_read: false,
      });
    }

    setReplyMessage("");
    setSending(false);
    loadTicket();
  }

  async function updateStatus(status: string) {
    const { error } = await supabase
      .from("support_tickets")
      .update({ status })
      .eq("id", ticketId);

    if (error) {
      alert(error.message);
      return;
    }

    if (ticket?.user_id) {
      await supabase.from("notifications").insert({
        user_id: ticket.user_id,
        title: "Support ticket status updated",
        message: `Your ticket "${ticket.subject}" status is now ${status}.`,
        type: "support",
        is_read: false,
      });
    }

    alert("Ticket status updated.");
    loadTicket();
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <h1>Loading ticket...</h1>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <button onClick={() => router.back()} style={backButton}>
        ← Back
      </button>

      <section style={ticketHeader}>
        <div>
          <span style={statusStyle}>{ticket.status}</span>

          <h1 style={{ fontSize: "32px", marginBottom: "8px" }}>
            {ticket.subject}
          </h1>

          <p style={textStyle}>Category: {ticket.category || "-"}</p>
          <p style={textStyle}>Priority: {ticket.priority || "normal"}</p>
          <p style={textStyle}>User: {ticket.user_name}</p>
          <p style={textStyle}>Email: {ticket.user_email}</p>
          <p style={textStyle}>
            Created:{" "}
            {ticket.created_at
              ? new Date(ticket.created_at).toLocaleString()
              : "-"}
          </p>
        </div>

        {ticket.is_admin_view && (
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={() => updateStatus("open")} style={smallButton}>
              Open
            </button>
            <button onClick={() => updateStatus("pending")} style={smallButton}>
              Pending
            </button>
            <button onClick={() => updateStatus("resolved")} style={smallButton}>
              Resolved
            </button>
            <button onClick={() => updateStatus("closed")} style={dangerButton}>
              Closed
            </button>
          </div>
        )}
      </section>

      <section style={sectionBox}>
        <h2>Original Message</h2>
        <div style={messageBox}>
          <p style={{ whiteSpace: "pre-wrap" }}>{ticket.message}</p>
        </div>
      </section>

      <section style={sectionBox}>
        <h2>Conversation</h2>

        {replies.length === 0 ? (
          <p style={{ color: "#94A3B8" }}>No replies yet.</p>
        ) : (
          replies.map((reply) => (
            <div
              key={reply.id}
              style={{
                ...replyBox,
                borderColor: reply.is_admin ? "#2563EB" : "#1F2937",
              }}
            >
              <div style={replyTop}>
                <strong>
                  {reply.is_admin ? "Admin" : reply.author_name}
                </strong>

                <span style={replyBadge}>
                  {reply.is_admin ? "Staff Reply" : "User Reply"}
                </span>
              </div>

              <p style={{ whiteSpace: "pre-wrap", color: "#CBD5E1" }}>
                {reply.message}
              </p>

              <p style={{ color: "#64748B", fontSize: "13px" }}>
                {reply.created_at
                  ? new Date(reply.created_at).toLocaleString()
                  : "-"}
              </p>
            </div>
          ))
        )}
      </section>

      {ticket.status !== "closed" && (
        <form onSubmit={sendReply} style={sectionBox}>
          <h2>Reply</h2>

          <textarea
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            placeholder="Write your reply..."
            style={textareaStyle}
          />

          <button type="submit" disabled={sending} style={buttonStyle}>
            {sending ? "Sending..." : "Send Reply"}
          </button>
        </form>
      )}
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

const ticketHeader = {
  background: "#111827",
  padding: "22px",
  borderRadius: "18px",
  border: "1px solid #1F2937",
  display: "flex",
  justifyContent: "space-between",
  gap: "18px",
};

const sectionBox = {
  marginTop: "22px",
  background: "#111827",
  padding: "22px",
  borderRadius: "18px",
  border: "1px solid #1F2937",
};

const messageBox = {
  background: "#0B1020",
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #1F2937",
};

const replyBox = {
  background: "#0B1020",
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #1F2937",
  marginTop: "12px",
};

const replyTop = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
};

const replyBadge = {
  background: "#1D4ED8",
  padding: "5px 9px",
  borderRadius: "999px",
  fontSize: "12px",
};

const textareaStyle = {
  width: "100%",
  minHeight: "130px",
  padding: "13px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#0B1020",
  color: "white",
  marginBottom: "14px",
};

const textStyle = {
  color: "#CBD5E1",
  margin: "7px 0",
};

const statusStyle = {
  display: "inline-block",
  background: "#1D4ED8",
  padding: "6px 10px",
  borderRadius: "999px",
  fontSize: "12px",
};

const buttonStyle = {
  padding: "11px 15px",
  borderRadius: "10px",
  border: "none",
  background: "#2563EB",
  color: "white",
  cursor: "pointer",
  fontWeight: "bold",
};

const smallButton = {
  padding: "9px 12px",
  borderRadius: "9px",
  border: "none",
  background: "#2563EB",
  color: "white",
  cursor: "pointer",
};

const dangerButton = {
  ...smallButton,
  background: "#DC2626",
};