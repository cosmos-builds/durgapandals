"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminToken } from "./admin-api";

// Client-side gate only — a redirect here is UX, not the security boundary.
// Every admin API call still needs a valid session, enforced server-side by
// requireAdmin in the API (spec §20, §21).
export function useAdminGuard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAdminToken()) {
      router.push("/login");
      return;
    }
    setReady(true);
  }, [router]);

  return ready;
}
