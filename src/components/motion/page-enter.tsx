"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Soft page-enter fade for route content. Respects reduced-motion via CSS. */
export function PageEnter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("page-enter", className)}>{children}</div>;
}
