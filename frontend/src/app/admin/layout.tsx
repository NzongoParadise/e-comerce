"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getDashboardDestination } from "@/lib/auth";
import { fetchWithAuth } from "@/lib/api";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let active = true;
    fetchWithAuth("/api/auth/me")
      .then((response) => {
        if (!active) return;
        if (getDashboardDestination(response.data) === "/admin") {
          setAuthorized(true);
        } else {
          router.replace("/account");
        }
      })
      .catch(() => {
        if (active) router.replace("/login");
      });

    return () => { active = false; };
  }, [router]);

  if (!authorized) {
    return <main className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500">A validar permissões...</main>;
  }

  return children;
}