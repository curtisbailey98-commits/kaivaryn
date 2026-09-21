"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitDemoRequest, type DemoFormState } from "./actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Submitting…" : "Request demo"}
    </Button>
  );
}

export function DemoForm() {
  const [state, action] = useFormState<DemoFormState, FormData>(submitDemoRequest, null);

  return (
    <form action={action} className="mt-8 space-y-5">
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
      <SubmitButton />
    </form>
  );
}
