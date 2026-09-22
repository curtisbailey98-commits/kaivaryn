"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/app";
  const registerHref = `/register?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <>
      <h1 className="text-lg font-semibold text-white">Sign in</h1>
      <p className="mt-1 text-xs text-neutral-500">Client and operator access</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <label className="block text-xs text-neutral-400">
          Email
          <Input name="email" type="email" required className="mt-1" autoComplete="email" />
        </label>
        <label className="block text-xs text-neutral-400">
          Password
          <Input name="password" type="password" required className="mt-1" autoComplete="current-password" />
        </label>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-4 flex justify-between text-xs text-neutral-500">
        <Link href="/forgot-password" className="hover:text-neutral-300">Forgot password</Link>
        <Link href={registerHref} className="hover:text-neutral-300">Create account</Link>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-400">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
