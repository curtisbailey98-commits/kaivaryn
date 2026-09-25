"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={className ?? "w-full rounded-md px-3 py-1.5 text-left text-xs text-neutral-500 hover:bg-neutral-900 hover:text-white"}
    >
      Sign out
    </button>
  );
}
