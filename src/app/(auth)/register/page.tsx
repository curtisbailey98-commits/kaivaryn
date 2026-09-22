"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { registerUser } from "./actions";

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/app";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await registerUser(fd);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.push(`/login?registered=1&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return (
    <>
      <h1 className="text-lg font-semibold text-white">Create account</h1>
      <p className="mt-1 text-xs text-neutral-500">
        Creates your user and organization. Product entitlements activate after engagement.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <label className="block text-xs text-neutral-400">
          Your name
          <Input name="name" required className="mt-1" />
        </label>
        <label className="block text-xs text-neutral-400">
          Work email
          <Input name="email" type="email" required className="mt-1" />
        </label>
        <label className="block text-xs text-neutral-400">
          Organization
          <Input name="organizationName" required className="mt-1" />
        </label>
        <label className="block text-xs text-neutral-400">
          Password (10+ characters)
          <Input name="password" type="password" required minLength={10} className="mt-1" />
        </label>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-neutral-500">
        Already have an account?{" "}
        <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="text-amber-400 hover:text-amber-300">Sign in</Link>
      </p>
    </>
  );
}

export default function RegisterPage() {
  return <Suspense fallback={<p className="text-sm text-neutral-400">Loading…</p>}><RegisterForm /></Suspense>;
}
