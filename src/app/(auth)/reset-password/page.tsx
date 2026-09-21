"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { resetPassword } from "./actions";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("token", token);
    const res = await resetPassword(fd);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.push("/login");
  }

  if (!token) {
    return <p className="text-sm text-red-300">Missing reset token.</p>;
  }

  return (
    <>
      <h1 className="text-lg font-semibold text-white">Choose a new password</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        <label className="block text-xs text-neutral-400">
          New password (10+)
          <Input name="password" type="password" required minLength={10} className="mt-1" />
        </label>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Saving…" : "Update password"}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs">
        <Link href="/login" className="text-amber-400">Sign in</Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
