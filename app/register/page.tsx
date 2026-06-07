"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signUp({
  email: cleanEmail,
  password,
  options: {
    data: {
      full_name: fullName,
    },
  },
});

    const userId = data.user?.id;

    if (!userId) {
      alert("Account created, but user ID not found. Please check Supabase Authentication.");
      router.push("/login");
      return;
    }

    alert("Account created successfully.");
    router.push("/login");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050816",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <form
        onSubmit={handleRegister}
        style={{
          width: "420px",
          background: "#111827",
          padding: "28px",
          borderRadius: "18px",
        }}
      >
        <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>
          Create Account
        </h1>

        <p style={{ color: "#94A3B8", marginBottom: "22px" }}>
          Join Nexorael Music Distribution
        </p>

        <input
          placeholder="Full Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          style={inputStyle}
        />

        <input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />

        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />

        <button type="submit" style={buttonStyle}>
          Create Account
        </button>
      </form>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  padding: "13px",
  marginBottom: "14px",
  borderRadius: "10px",
  border: "1px solid #334155",
  background: "#0B1020",
  color: "white",
};

const buttonStyle = {
  width: "100%",
  padding: "13px",
  borderRadius: "10px",
  border: "none",
  background: "#2563EB",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};