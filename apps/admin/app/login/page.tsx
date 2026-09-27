"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@durgapandals/ui";
import { adminLogin, setAdminToken } from "@/lib/admin-api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const token = await adminLogin(email, password);
      setAdminToken(token);
      router.push("/");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-ground px-6">
      <Card padding="lg" className="w-full max-w-sm">
        <form onSubmit={handleSubmit}>
          <h1 className="mb-6 font-display text-2xl font-extrabold">Admin sign in</h1>
          <div className="flex flex-col gap-3">
            <Input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="font-body text-sm text-brand">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
