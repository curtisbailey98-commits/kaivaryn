import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-amber-500 text-neutral-950 hover:bg-amber-400 focus-visible:ring-amber-400",
  secondary:
    "bg-neutral-800 text-neutral-100 hover:bg-neutral-700 focus-visible:ring-neutral-500",
  ghost: "bg-transparent text-neutral-300 hover:bg-neutral-900 hover:text-white",
  danger: "bg-red-700 text-white hover:bg-red-600",
  outline:
    "border border-neutral-700 bg-transparent text-neutral-100 hover:bg-neutral-900",
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
        "inline-flex items-center justify-center rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
