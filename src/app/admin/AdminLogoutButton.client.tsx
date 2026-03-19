"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export default function AdminLogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    try {
      await fetch("/api/admin/session", { method: "DELETE" });
    } finally {
      window.location.href = "/admin/login";
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleLogout} disabled={loading}>
      {loading ? "Signing out..." : "Sign out"}
    </Button>
  );
}
