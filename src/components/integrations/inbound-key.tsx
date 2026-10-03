"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Copy, Check, KeyRound } from "lucide-react";
import { issueInboundKeyAction, type IssueKeyState } from "@/app/app/integrations/actions";

function IssueButton({ hasKey }: { hasKey: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-60">
      <KeyRound className="h-3.5 w-3.5" /> {pending ? "Generating…" : hasKey ? "Rotate key" : "Generate key"}
    </button>
  );
}

function CopyBox({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="relative">
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-neutral-800 bg-black/60 p-3 pr-10 font-mono text-[11px] leading-5 text-neutral-300">{text}</pre>
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          navigator.clipboard?.writeText(text).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          });
        }}
        className="absolute right-2 top-2 rounded-md border border-neutral-700 bg-neutral-900 p-1.5 text-neutral-400 hover:text-amber-300"
      >
        {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function InboundKey({ endpoint, hasKey, hint, canManage }: { endpoint: string; hasKey: boolean; hint: string | null; canManage: boolean }) {
  const [state, action] = useFormState<IssueKeyState, FormData>(issueInboundKeyAction, {});
  const key = state.token ?? "YOUR_INBOUND_KEY";
  const curl = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template": "billing_export",
    "records": [
      { "invoice_id": "INV-1042", "customer": "Northwind Clinic",
        "billed": 4200, "expected": 5100, "invoice_date": "2026-09-03" }
    ]
  }'`;
  return (
    <div className="space-y-3">
      {canManage ? (
        <form action={action} className="flex flex-wrap items-center gap-2">
          <IssueButton hasKey={hasKey || Boolean(state.token)} />
          <span className="text-[11px] text-neutral-500">{state.token ? "New key below — copy it now. It won't be shown again." : hasKey ? `Active key ends in …${hint}. Rotating stops the old key immediately.` : "No key yet."}</span>
        </form>
      ) : (
        <p className="text-[11px] text-neutral-500">{hasKey ? `Active key ends in …${hint}.` : "No key yet."} Generating keys needs Admin or Owner.</p>
      )}
      {state.error ? <p className="text-xs text-red-300">{state.error}</p> : null}
      {state.token ? <CopyBox text={state.token} label="Copy key" /> : null}
      <CopyBox text={curl} label="Copy example" />
    </div>
  );
}
