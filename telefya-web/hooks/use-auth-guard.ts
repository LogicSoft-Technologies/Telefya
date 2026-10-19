"use client";

import { useEffect, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import { getUserProfile } from "@/lib/api/users";
import {
  clearUser,
  getSavedUser,
  saveUser,
} from "@/lib/auth/session";
import {
  clearAccessToken,
  getAccessToken,
} from "@/lib/auth/tokens";
import type { AuthUser } from "@/lib/api/auth";

function isAuthError(error: unknown) {
  const message =
    error instanceof Error ? error.message.toLowerCase() : "";

  const status =
    typeof error === "object" &&
    error &&
    "status" in error
      ? Number((error as { status?: number }).status)
      : 0;

  return (
    status === 401 ||
    status === 403 ||
    message.includes("unauthorized") ||
    message.includes("expired") ||
    message.includes("invalid token") ||
    message.includes("access denied")
  );
}

export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const search = searchParams.toString();
  const requestedPath = search
    ? `${pathname}?${search}`
    : pathname;

  const loginPath = `/login?next=${encodeURIComponent(
    requestedPath,
  )}`;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const token = getAccessToken();

      if (!token) {
        clearUser();

        if (mounted) {
          setUser(null);
          setChecking(false);
        }

        router.replace(loginPath);
        return;
      }

      const savedUser = getSavedUser();

      if (mounted && savedUser) {
        setUser(savedUser);
      }

      try {
        const profile = await getUserProfile(token);

        if (!mounted) return;

        saveUser(profile);
        setUser(getSavedUser());
      } catch (error) {
        if (isAuthError(error)) {
          clearAccessToken();
          clearUser();

          if (mounted) {
            setUser(null);
            setChecking(false);
          }

          router.replace(loginPath);
          return;
        }

        if (!savedUser && mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setChecking(false);
        }
      }
    }

    void checkSession();

    function handleAuthChange() {
      if (mounted) {
        setUser(getSavedUser());
      }
    }

    window.addEventListener("telefya-auth-change", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);

    return () => {
      mounted = false;
      window.removeEventListener(
        "telefya-auth-change",
        handleAuthChange,
      );
      window.removeEventListener("storage", handleAuthChange);
    };
  }, [loginPath, router]);

  return { user, checking };
}