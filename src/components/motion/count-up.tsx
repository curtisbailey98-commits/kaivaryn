"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "./use-reduced-motion";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function CountUp({
  value,
  duration = 1200,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
  format,
}: {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  /** Optional custom formatter; receives the animated number. */
  format?: (n: number) => string;
}) {
  // Honest first paint: never flash $0 when the ledger value is non-zero.
  const [display, setDisplay] = useState(value);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    setDisplay(value);
  }, [value]);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      setStarted(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, value]);

  useEffect(() => {
    if (!started) return;
    if (reduced) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    // Subtle ease from ~92% → 100% so first paint stays truthful
    const from = value * 0.92;
    setDisplay(from);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(from + (value - from) * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, value, duration, reduced]);

  const text = format
    ? format(display)
    : `${prefix}${display.toFixed(decimals)}${suffix}`;

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {text}
    </span>
  );
}

/** Currency count-up using Intl (USD, 0 decimals by default). */
export function CountUpCurrency({
  value,
  className,
  currency = "USD",
}: {
  value: number;
  className?: string;
  currency?: string;
}) {
  return (
    <CountUp
      value={value}
      className={className}
      format={(n) =>
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(Math.round(n))
      }
    />
  );
}
