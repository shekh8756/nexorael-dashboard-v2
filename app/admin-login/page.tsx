"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    checkExistingSession();
  }, []);

  async function checkExistingSession() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setChecking(false);
        return;
      }

      const allowed = await verifyAdmin(user.id);

      if (allowed) {
        router.replace("/admin");
        return;
      }

      await supabase.auth.signOut();
    } catch (error) {
      console.error(error);
    } finally {
      setChecking(false);
    }
  }

  async function verifyAdmin(userId: string) {
    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role,status")
        .eq("id", userId)
        .maybeSingle();

    if (profileError || !profile) {
      return false;
    }

    const allowedRoles = [
      "master_admin",
      "white_label_admin",
    ];

    return (
      profile.status === "active" &&
      allowedRoles.includes(profile.role)
    );
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const {
        data,
        error: loginError,
      } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        throw new Error(loginError.message);
      }

      if (!data.user) {
        throw new Error("Unable to authenticate user.");
      }

      const allowed = await verifyAdmin(data.user.id);

      if (!allowed) {
        await supabase.auth.signOut();

        throw new Error(
          "This account does not have admin access."
        );
      }

      router.replace("/admin");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to sign in."
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06101d] text-white">
        <div className="text-sm text-slate-400">
          Checking admin session...
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#06101d] px-5 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.12),transparent_35%)]" />

      <div className="relative w-full max-w-md">
        <div className="mb-7 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-2xl text-sky-400">
            ♫
          </div>

          <h1 className="mt-5 text-3xl font-bold tracking-tight">
            Nexorael Admin
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Sign in to manage distribution, users, revenue and analytics.
          </p>
        </div>

        <section className="rounded-2xl border border-[#1b2c40] bg-[#091522]/95 p-7 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="mb-6">
            <span className="rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-1 text-[10px] font-bold text-sky-400">
              ADMIN ACCESS
            </span>

            <h2 className="mt-3 text-xl font-semibold">
              Welcome back
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Use your Supabase admin account credentials.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <label className="block">
              <div className="mb-2 text-xs font-medium text-slate-400">
                Email address
              </div>

              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full rounded-xl border border-[#203246] bg-[#06101b] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/10"
              />
            </label>

            <label className="mt-4 block">
              <div className="mb-2 text-xs font-medium text-slate-400">
                Password
              </div>

              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-[#203246] bg-[#06101b] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/10"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Signing in..."
                : "Sign In to Admin"}
            </button>
          </form>

          <div className="mt-6 border-t border-[#17283a] pt-5 text-center text-[11px] text-slate-600">
            Authorized Nexorael administrators only.
          </div>
        </section>
      </div>
    </main>
  );
}