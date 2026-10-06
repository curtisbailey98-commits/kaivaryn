"use client";

import { useState } from "react";

/** Plain link to the connect route; shows "Connecting…" while the browser heads to Square. */
export function ConnectSquareButton({ label = "Connect Square" }: { label?: string }) {
  const [connecting, setConnecting] = useState(false);
  return (
    <a
      href="/api/integrations/square/connect"
      onClick={() => setConnecting(true)}
      aria-busy={connecting}
      data-testid="square-connect"
      className={`inline-flex h-9 items-center rounded-md px-3 text-xs font-semibold transition ${connecting ? "pointer-events-none bg-amber-500/60 text-neutral-900" : "bg-amber-500 text-neutral-950 hover:bg-amber-400"}`}
    >
      {connecting ? "Connecting… opening Square" : label}
    </a>
  );
}
