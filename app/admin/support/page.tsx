"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function AdminSupportPage() {
  const router = useRouter();

  const [tickets, setTickets] = useState<any[]>([]);
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
    await loadTickets(profile);
  }

  async function loadTickets(profileParam = adminProfile) {
    let ticketQuery = supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (profileParam?.role === "white_label_admin") {
      if (!profileParam.white_label_id) {
        setTickets([]);
        setLoading(false);
        return;
      }

      ticketQuery = ticketQuery.eq("white_label_id", profileParam.white_label_id);
    }

    const { data: ticketsData, error: ticketsError } = await ticketQuery;

    if (ticketsError) {
      alert(ticketsError.message);
      setLoading(false);
      return;
    }

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, email, white_label_id");

    const { data: whiteLabelsData } = await supabase
      .from("white_labels")
      .select("id, name, brand_name");

    const merged = (ticketsData || []).map((ticket) => {
      const user = profilesData?.find((p) => p.id === ticket.user_id);
      const wl = whiteLabelsData?.find((w) => w.id === ticket.white_label_id);

      return {
        ...ticket,
        user_name: user?.full_name || "-",
        user_email: user?.email || "-",
        white_label_name: wl?.name || wl?.brand_name || "Nexorael Direct",
      };
    });

    setTickets(merged);
    setLoading(false);
  }

  async function updateTicketStatus(id: string, status: string) {
    const ticket = tickets.find((t) => t.id === id);

    const { error } = await supabase
      .from("support_tickets")
      .update({ status })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    if (ticket?.user_id) {
      await supabase.from("notifications").insert({
        user_id: ticket.user_id,
        title: "Support ticket updated",
        message: `Your ticket "${ticket.subject}" status is now ${status}.`,
        type: "support",
        is_read: false,
      });
    }

    alert("Ticket updated.");
    loadTickets();
  }

  return (
    <main style={pageStyle}>
      <button onClick={() => router.push("/dashboard")} style={backButton}>
        ← Back to Dashboard
      </button>

      <h1>Admin Support Tickets</h1>

      <p style={{ color: "#94A3B8" }}>
        View and manage support tickets from users and white-label partners.
      </p>

      <section style={sectionStyle}>
        {loading ? (
          <p>Loading tickets...</p>
        ) : tickets.length === 0 ? (
          <p>No tickets found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1100px" }}>
            <thead>
              <tr style={{ color: "#94A3B8" }}>
                <th align="left" style={thStyle}>Subject</th>
                <th align="left" style={thStyle}>User</th>
                <th align="left" style={thStyle}>Email</th>
                <th align="left" style={thStyle}>White Label</th>
                <th align="left" style={thStyle}>Category</th>
                <th align="left" style={thStyle}>Priority</th>
                <th align="left" style={thStyle}>Status</th>
                <th align="left" style={thStyle}>Created</th>
                <th align="left" style={thStyle}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td style={tdStyle}>{ticket.subject}</td>
                  <td style={tdStyle}>{ticket.user_name}</td>
                  <td style={tdStyle}>{ticket.user_email}</td>
                  <td style={tdStyle}>{ticket.white_label_name}</td>
                  <td style={tdStyle}>{ticket.category || "-"}</td>
                  <td style={tdStyle}>
                    <span style={priorityStyle}>{ticket.priority || "normal"}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={statusStyle}>{ticket.status}</span>
                  </td>
                  <td style={tdStyle}>
                    {ticket.created_at
                      ? new Date(ticket.created_at).toLocaleDateString()
                      : "-"}
                  </td>

                  <td style={tdStyle}>
                    <button
                      onClick={() => router.push(`/support/${ticket.id}`)}
                      style={smallButton}
                    >
                      View
                    </button>

                    <button
                      onClick={() => updateTicketStatus(ticket.id, "open")}
                      style={smallButton}
                    >
                      Open
                    </button>

                    <button
                      onClick={() => updateTicketStatus(ticket.id, "pending")}
                      style={smallButton}
                    >
                      Pending
                    </button>

                    <button
                      onClick={() => updateTicketStatus(ticket.id, "resolved")}
                      style={smallButton}
                    >
                      Resolved
                    </button>

                    <button
                      onClick={() => updateTicketStatus(ticket.id, "closed")}
                      style={dangerButton}
                    >
                      Close
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

const priorityStyle = {
  display: "inline-block",
  background: "#1D4ED8",
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