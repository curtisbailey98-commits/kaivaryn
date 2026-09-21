import { cn } from "@/lib/utils";
import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full text-left text-sm", className)} {...props} />
    </div>
  );
}
export function THead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500" {...props} />;
}
export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className="divide-y divide-neutral-900" {...props} />;
}
export function TR(props: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className="hover:bg-neutral-900/50" {...props} />;
}
export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("px-3 py-2 font-medium", className)} {...props} />;
}
export function TD({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2.5 text-neutral-200", className)} {...props} />;
}
