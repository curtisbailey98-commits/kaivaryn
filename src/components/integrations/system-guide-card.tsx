import type { IntegrationGuide } from "@/lib/integrations/guides";
import type { SystemSetupEntry } from "@/lib/integrations/setup-store";
import { INTEGRATION_STATE_LABEL, type SystemState } from "@/lib/industry/states";
import { saveSystemSetupAction } from "@/app/app/integrations/actions";
import { NO_SECRETS_NOTE } from "@/lib/integrations/guides/shared";

const fieldClass = "mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600";

/** Plain-English guide + business intake + checklist for one selected system. Checklist never marks connected. */
export function SystemGuideCard({
  guide, setup, state, readOnly = false,
}: {
  guide: IntegrationGuide;
  setup: SystemSetupEntry | null;
  state: SystemState;
  readOnly?: boolean;
}) {
  const checked = new Set(setup?.checklist ?? []);
  const values = setup?.intake ?? {};
  return (
    <details id={`system-${guide.key}`} className="group rounded-xl border border-neutral-800 bg-neutral-950/60 open:border-amber-500/30" data-testid="system-guide" data-system={guide.key} data-state={state}>
      <summary className="cursor-pointer list-none p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-neutral-100">{guide.name}</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">{guide.methodLabel}{guide.vendorSpecific ? "" : " · general template"}</p>
          </div>
          <span className="rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] font-medium text-neutral-300">{INTEGRATION_STATE_LABEL[state]}</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-neutral-400">{guide.methodNote}</p>
        <p className="mt-2 text-[11px] text-amber-400/90 group-open:hidden">Open for setup steps, what to share, and business details →</p>
      </summary>

      <div className="space-y-5 border-t border-neutral-900 px-4 pb-4 pt-4">
        <Section title="Prerequisites">{guide.prerequisites.map((s) => <li key={s}>{s}</li>)}</Section>
        <Section title="Your steps" ordered>{guide.steps.map((s) => <li key={s}>{s}</li>)}</Section>
        <Section title="What to share">{guide.share.map((s) => <li key={s}>{s}</li>)}</Section>
        <Section title="If there's no direct connection yet">{guide.exportFallback.map((s) => <li key={s}>{s}</li>)}</Section>
        <Section title="What Kaivaryn does">{guide.kaivarynDoes.map((s) => <li key={s}>{s}</li>)}</Section>
        <Section title="How we verify">{guide.verification.map((s) => <li key={s}>{s}</li>)}</Section>

        <form action={saveSystemSetupAction} className="space-y-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-4">
          <input type="hidden" name="systemKey" value={guide.key} />
          <div>
            <p className="text-xs font-semibold text-neutral-200">Business details for {guide.name}</p>
            <p className="mt-1 text-[11px] leading-5 text-neutral-500">{NO_SECRETS_NOTE}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {guide.intakeFields.map((f) => (
              <label key={f.id} className={`block text-xs font-medium text-neutral-300 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
                {f.label}
                {f.type === "textarea" ? (
                  <textarea name={`intake.${f.id}`} defaultValue={values[f.id] || ""} placeholder={f.placeholder} rows={3} disabled={readOnly} className={fieldClass} />
                ) : f.type === "select" ? (
                  <select name={`intake.${f.id}`} defaultValue={values[f.id] || ""} disabled={readOnly} className={fieldClass}>
                    <option value="">Select…</option>
                    {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={f.type === "number" ? "text" : "text"} inputMode={f.type === "number" ? "numeric" : undefined} name={`intake.${f.id}`} defaultValue={values[f.id] || ""} placeholder={f.placeholder} disabled={readOnly} className={fieldClass} />
                )}
                {f.help ? <span className="mt-1 block text-[11px] font-normal text-neutral-500">{f.help}</span> : null}
              </label>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-200">Your checklist</p>
            <p className="mt-1 text-[11px] text-neutral-500">Ticking boxes helps you prepare. It never marks {guide.name} connected.</p>
            <ul className="mt-2 space-y-2">
              {guide.checklist.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-start gap-2 text-xs text-neutral-300">
                    <input type="checkbox" name="checklist[]" value={c.id} defaultChecked={checked.has(c.id)} disabled={readOnly} className="mt-0.5 accent-amber-500" />
                    <span>{c.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          {!readOnly ? (
            <button type="submit" className="inline-flex h-9 items-center rounded-md bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition hover:bg-amber-400">
              Save setup notes
            </button>
          ) : (
            <p className="text-[11px] text-neutral-500">View-only — ask a teammate with write access to save changes.</p>
          )}
          {setup?.updatedAt ? <p className="text-[10px] text-neutral-600">Last saved {new Date(setup.updatedAt).toLocaleString("en-US", { timeZone: "America/New_York" })} ET</p> : null}
        </form>
        <p className="text-[10px] text-neutral-600">Source: <a href={guide.sourceUrl} target="_blank" rel="noreferrer" className="text-neutral-400 underline-offset-2 hover:underline">{guide.sourceUrl.replace(/^https?:\/\//, "").slice(0, 60)}</a></p>
      </div>
    </details>
  );
}

function Section({ title, children, ordered }: { title: string; children: React.ReactNode; ordered?: boolean }) {
  const List = ordered ? "ol" : "ul";
  return (
    <div>
      <p className="text-xs font-semibold text-neutral-200">{title}</p>
      <List className={`mt-1.5 space-y-1 text-xs leading-5 text-neutral-400 ${ordered ? "list-decimal pl-4" : "list-disc pl-4"}`}>{children}</List>
    </div>
  );
}
