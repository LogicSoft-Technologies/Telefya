"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5000/api/v2";

type LoginResponse = {
  accessToken?: string;
  refreshToken?: string;
  data?: {
    accessToken?: string;
    refreshToken?: string;
  };
  message?: string;
};

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;

  const value = payload as {
    message?: string;
    error?: string | boolean;
  };

  if (typeof value.message === "string" && value.message.trim()) {
    return value.message;
  }

  if (typeof value.error === "string" && value.error.trim()) {
    return value.error;
  }

  return fallback;
}

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const loginResponse = await fetch(
        `${API_BASE_URL}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        },
      );

      const loginPayload = (await loginResponse
        .json()
        .catch(() => null)) as LoginResponse | null;

      if (!loginResponse.ok) {
        throw new Error(
          getErrorMessage(loginPayload, "Unable to sign in."),
        );
      }

      const accessToken =
        loginPayload?.accessToken ||
        loginPayload?.data?.accessToken;

      const refreshToken =
        loginPayload?.refreshToken ||
        loginPayload?.data?.refreshToken;

      if (!accessToken) {
        throw new Error(
          "Sign-in succeeded, but no access token was returned.",
        );
      }

      /*
       * Verify platform-admin access before saving the session.
       * A normal Telefya account is deliberately rejected here.
       */
      const adminResponse = await fetch(
        `${API_BASE_URL}/admin/dashboard`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const adminPayload = await adminResponse
        .json()
        .catch(() => null);

      if (!adminResponse.ok) {
        throw new Error(
          getErrorMessage(
            adminPayload,
            "This account does not have Admin access.",
          ),
        );
      }

      localStorage.setItem(
        "telefya_admin_access_token",
        accessToken,
      );

      if (refreshToken) {
        localStorage.setItem(
          "telefya_admin_refresh_token",
          refreshToken,
        );
      }

      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to sign in.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white lg:flex">
      <aside className="hidden shrink-0 flex-col justify-between overflow-hidden bg-navy-900 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[460px] xl:w-[520px]">
        <div className="h-1 bg-gradient-to-r from-telefya-blue via-telefya-violet to-telefya-green" />

        <div className="flex flex-1 flex-col justify-between px-8 py-10 xl:px-10">
          <Link
            href="/"
            className="inline-flex w-fit rounded-xl bg-white px-4 py-3 shadow-soft transition-all duration-200 hover:shadow-enterprise"
          >
            <Image
              src="/images/telefya-logo.png"
              alt="Telefya"
              width={152}
              height={46}
              priority
              className="h-9 w-auto"
            />
          </Link>

          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/70">
              <ShieldCheck
                size={15}
                className="text-telefya-green"
              />
              Admin access
            </span>

            <h1 className="mt-5 max-w-md text-4xl font-black leading-tight text-white">
              Telefya platform control.
            </h1>

            <p className="mt-4 max-w-md text-base leading-8 text-white/60">
              Sign in with an authorized platform administrator account.
            </p>
          </div>

          <p className="text-sm font-semibold leading-6 text-white/45">
            Access is logged and restricted by administrator role.
          </p>
        </div>
      </aside>

      <section className="flex min-h-screen flex-1 items-center justify-center bg-[radial-gradient(circle_at_85%_5%,rgba(100,38,255,0.12),transparent_30%),radial-gradient(circle_at_10%_90%,rgba(15,107,255,0.1),transparent_28%),#f7f9fe] px-6 py-12 sm:px-10">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white/95 p-6 shadow-enterprise backdrop-blur sm:p-8">
          <div className="flex items-center justify-between lg:hidden">
            <Link href="/">
              <Image
                src="/images/telefya-logo.png"
                alt="Telefya"
                width={146}
                height={44}
                priority
                className="h-9 w-auto"
              />
            </Link>

            <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-navy-400">
              Admin
            </span>
          </div>

          <Link
            href="/"
            className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-navy-400 transition-colors hover:text-telefya-blue lg:mt-0"
          >
            <ArrowLeft size={16} />
            Back
          </Link>

          <span className="mt-7 inline-flex rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-telefya-blue">
            Admin sign in
          </span>

          <h2 className="mt-5 text-3xl font-black text-navy-900">
            Welcome back
          </h2>

          <p className="mt-2 leading-7 text-navy-500">
            Use your authorized Telefya account.
          </p>

          {error ? (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
            >
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-black text-navy-900">
                Email
              </span>

              <span className="flex h-12 items-center gap-3 rounded-xl border border-border bg-white px-4 shadow-soft transition-all duration-200 focus-within:border-telefya-blue focus-within:ring-2 focus-within:ring-telefya-blue/15">
                <Mail
                  size={18}
                  className="shrink-0 text-navy-300"
                />

                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="admin@example.com"
                  className="w-full bg-transparent text-sm font-semibold text-navy-900 outline-none placeholder:text-navy-300"
                />
              </span>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black text-navy-900">
                Password
              </span>

              <span className="flex h-12 items-center gap-3 rounded-xl border border-border bg-white px-4 shadow-soft transition-all duration-200 focus-within:border-telefya-blue focus-within:ring-2 focus-within:ring-telefya-blue/15">
                <LockKeyhole
                  size={18}
                  className="shrink-0 text-navy-300"
                />

                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  className="w-full bg-transparent text-sm font-semibold text-navy-900 outline-none placeholder:text-navy-300"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  className="shrink-0 text-navy-400 transition-colors duration-200 hover:text-navy-900"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-telefya-blue px-5 font-black text-white shadow-soft transition-all duration-200 hover:bg-telefya-violet hover:shadow-enterprise disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ShieldCheck size={18} />
              )}

              {loading ? "Checking access..." : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs font-semibold leading-6 text-navy-400">
            Only accounts assigned to Telefya platform administration can
            continue.
          </p>
        </div>
      </section>
    </main>
  );
}