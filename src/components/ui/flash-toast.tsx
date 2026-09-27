"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

/** Dismissible success/error banner driven by ?ok=&msg= or ?error= query params. */
export function FlashToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ok = searchParams.get("ok");
  const error = searchParams.get("error");
  const msg = searchParams.get("msg") || (ok ? "Saved" : error || "");
  const [visible, setVisible] = useState(Boolean(ok || error));

  useEffect(() => {
    setVisible(Boolean(ok || error));
    if (!ok && !error) return;
    const t = setTimeout(() => {
      setVisible(false);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("ok");
      next.delete("error");
      next.delete("msg");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 4500);
    return () => clearTimeout(t);
  }, [ok, error, msg, pathname, router, searchParams]);

  if (!visible || !msg) return null;

  const tone = error
    ? "border-red-800 bg-red-950/90 text-red-100"
    : "border-emerald-800 bg-emerald-950/90 text-emerald-100";

  return (
    <div
      role="status"
      className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${tone}`}
    >
      <div className="flex items-start gap-3">
        <p className="flex-1">{msg}</p>
        <button
          type="button"
          className="text-xs opacity-70 hover:opacity-100"
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
