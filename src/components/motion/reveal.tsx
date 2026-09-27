"use client";

import {
  Children,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "./use-reduced-motion";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** fade | up | left | right | scale */
  variant?: "fade" | "up" | "left" | "right" | "scale";
  delay?: number;
  once?: boolean;
};

export function Reveal({
  children,
  className,
  variant = "up",
  delay = 0,
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) io.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, reduced]);

  const style = {
    transitionDelay: reduced ? "0ms" : `${delay}ms`,
  } as CSSProperties;

  return (
    <div
      ref={ref}
      style={style}
      className={cn(
        "reveal-base",
        `reveal-${variant}`,
        visible && "reveal-visible",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Stagger({
  children,
  className,
  stagger = 70,
  variant = "up",
  itemClassName,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  variant?: RevealProps["variant"];
  itemClassName?: string;
}) {
  return (
    <div className={className}>
      {Children.map(children, (child, i) => (
        <Reveal key={i} variant={variant} delay={i * stagger} className={itemClassName}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}
