"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function NotificationsPage() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setNotifications(data || []);
    setLoading(false);
  }

  async function markAsRead(id: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    loadNotifications();
  }

  return (
    <main style={pageStyle}>
      <button onClick={() => router.push("/dashboard")} style={backButton}>
        ← Back to Dashboard
      </button>

      <h1>Notifications</h1>
      <p style={{ color: "#94A3B8" }}>
        Release updates, approval status, DSP delivery and account alerts.
      </p>

      <section style={sectionStyle}>
        {loading ? (
          <p>Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <p style={{ color: "#94A3B8" }}>No notifications yet.</p>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              style={{
                ...notificationBox,
                borderColor: item.is_read ? "#1F2937" : "#2563EB",
              }}
            >
              <h3 style={{ marginTop: 0 }}>{item.title}</h3>

              <p style={{ color: "#CBD5E1" }}>{item.message}</p>

              <p style={{ color: "#64748B", fontSize: "13px" }}>
                {item.created_at
                  ? new Date(item.created_at).toLocaleString()
                  : ""}
              </p>

              {!item.is_read && (
                <button onClick={() => markAsRead(item.id)} style={buttonStyle}>
                  Mark as Read
                </button>
              )}
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

const sectionStyle = {
  marginTop: "24px",
  maxWidth: "850px",
  background: "#111827",
  padding: "22px",
  borderRadius: "18px",
  border: "1px solid #1F2937",
};

const notificationBox = {
  background: "#0B1020",
  padding: "16px",
  borderRadius: "14px",
  border: "1px solid #1F2937",
  marginBottom: "14px",
};

const buttonStyle = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#2563EB",
  color: "white",
  cursor: "pointer",
};