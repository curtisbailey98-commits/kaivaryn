import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4">
      <Link href="/" className="mb-8 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
        {APP_NAME}
      </Link>
      <div className="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-950 p-6 shadow-xl">
        {children}
      </div>
    </div>
  );
}
