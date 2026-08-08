"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getAdminDashboard } from "@/lib/api/admin";
import {
  clearAdminSession,
  getAdminAccessToken,
} from "@/lib/auth/session";
import type { AdminDashboard } from "@/types/admin";

export function useAdminSession() {
  const router = useRouter();

  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = getAdminAccessToken();

    if (!token) {
      setDashboard(null);
      setLoading(false);
      router.replace("/login");
      return;
    }

    setLoading(true);

    try {
      const response = await getAdminDashboard();
      setDashboard(response.data);
    } catch {
      clearAdminSession();
      setDashboard(null);
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    dashboard,
    loading,
    refresh,
  };
}