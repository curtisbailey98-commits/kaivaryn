"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await requestPasswordReset(fd);
    setMessage(res.message);
    setLoading(false);
  }

  return (
    <>
      <h1 className="text-lg font-semibold text-white">Reset password</h1>
      <p className="mt-1 text-xs text-neutral-500">
        Email delivery is stubbed until SMTP credentials are configured — reset links are logged server-side.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-xs text-neutral-400">
          Email
          <Input name="email" type="email" required className="mt-1" />
        </label>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "…" : "Send reset link"}
        </Button>
      </form>
      {message ? <p className="mt-4 text-sm text-neutral-300">{message}</p> : null}
      <p className="mt-4 text-center text-xs">
        <Link href="/login" className="text-amber-400">Back to sign in</Link>
      </p>
    </>
  );
}
