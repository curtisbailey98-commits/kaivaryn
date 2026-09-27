import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-amber-500 text-neutral-950 hover:bg-amber-400 focus-visible:ring-amber-400 shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_8px_24px_rgba(245,158,11,0.16)] hover:shadow-[0_0_0_1px_rgba(251,191,36,0.5),0_12px_32px_rgba(245,158,11,0.26)]",
  secondary:
    "bg-neutral-800 text-neutral-100 hover:bg-neutral-700 focus-visible:ring-neutral-500",
  ghost: "bg-transparent text-neutral-300 hover:bg-neutral-900 hover:text-white",
  danger: "bg-red-700 text-white hover:bg-red-600",
  outline:
    "border border-neutral-700 bg-transparent text-neutral-100 hover:bg-neutral-900 hover:border-neutral-500",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition duration-200 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
