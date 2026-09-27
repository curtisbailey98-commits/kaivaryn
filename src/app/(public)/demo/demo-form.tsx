"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitDemoRequest, type DemoFormState } from "./actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ZOOM_SCHEDULER_URL } from "@/lib/constants";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Submitting…" : "Request follow-up"}
    </Button>
  );
}

export function DemoForm({ zoomUrl = ZOOM_SCHEDULER_URL }: { zoomUrl?: string }) {
  const [state, action] = useFormState<DemoFormState, FormData>(submitDemoRequest, null);

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-500">
          Fastest path
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">Schedule executive demo on Zoom</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Book directly on Kaivaryn&apos;s calendar. No prospect Zoom link required — we host.
        </p>
        <a
          href={zoomUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-amber-500 px-4 text-sm font-semibold text-neutral-950 hover:bg-amber-400 sm:w-auto"
        >
          Schedule executive demo on Zoom
        </a>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-neutral-800" />
        </div>
        <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
          <span className="bg-neutral-950 px-3 text-neutral-500">or request a callback</span>
        </div>
      </div>

      <form action={action} className="space-y-5">
        {state?.error ? (
          <p className="rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {state.error}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs text-neutral-400">
            Name *
            <Input name="name" required className="mt-1" />
          </label>
          <label className="block text-xs text-neutral-400">
            Work email *
            <Input name="email" type="email" required className="mt-1" />
          </label>
          <label className="block text-xs text-neutral-400">
            Company *
            <Input name="company" required className="mt-1" />
          </label>
          <label className="block text-xs text-neutral-400">
            Title
            <Input name="title" className="mt-1" />
          </label>
          <label className="block text-xs text-neutral-400">
            Phone
            <Input name="phone" className="mt-1" />
          </label>
          <label className="block text-xs text-neutral-400">
            Company size
            <select
              name="companySize"
              className="mt-1 flex h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100"
            >
              <option value="">Select…</option>
              <option>1–50</option>
              <option>51–200</option>
              <option>201–1000</option>
              <option>1000+</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend className="text-xs text-neutral-400">Products of interest *</legend>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-neutral-200">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="products" value="REVENUE_RECOVERY" defaultChecked />
              Revenue Recovery
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="products" value="OPERATIONS_EFFICIENCY" />
              Operations Efficiency
            </label>
          </div>
        </fieldset>
        <label className="block text-xs text-neutral-400">
          Message
          <Textarea name="message" className="mt-1" placeholder="Context for the conversation…" />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SubmitButton />
          <a
            href={zoomUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-md border border-amber-500/50 px-4 text-sm font-medium text-amber-400 hover:bg-amber-500/10"
          >
            Schedule on Zoom instead
          </a>
        </div>
      </form>
    </div>
  );
}
