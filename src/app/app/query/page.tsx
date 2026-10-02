import { redirect } from "next/navigation";

/** Consolidated: “Ask (NL)” now lives inside Command (ANSWER route). */
export default function QueryRedirect({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const q = (searchParams.q || "").trim();
  redirect(q ? `/app/command?q=${encodeURIComponent(q)}` : "/app/command");
}
