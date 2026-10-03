"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { FileUp, ClipboardPaste, Download } from "lucide-react";
import { IMPORT_TEMPLATES, autoMap, parseDelimited, previewTemplate } from "@/lib/integrations/templates";
import { submitGuidedImport } from "@/app/app/imports/actions";

const box = "rounded-xl border border-neutral-800 bg-neutral-950/60 p-4";
const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className="inline-flex h-11 items-center justify-center rounded-md bg-amber-500 px-5 text-sm font-semibold text-neutral-950 transition hover:bg-amber-400 disabled:opacity-50">
      {pending ? "Importing…" : "Import"}
    </button>
  );
}

function StepLabel({ n, title, done }: { n: number; title: string; done?: boolean }) {
  return (
    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">
      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${done ? "bg-amber-500 text-neutral-950" : "border border-neutral-700 text-neutral-400"}`}>{n}</span>
      {title}
    </p>
  );
}

export function GuidedImport({ canImport, initialTemplate }: { canImport: boolean; initialTemplate?: string }) {
  const [slug, setSlug] = useState(initialTemplate && IMPORT_TEMPLATES.some((t) => t.slug === initialTemplate) ? initialTemplate : "billing_export");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const template = IMPORT_TEMPLATES.find((t) => t.slug === slug)!;
  const parsed = useMemo(() => (text.trim() ? parseDelimited(text) : { headers: [] as string[], rows: [] as Array<Record<string, string>>, delimiter: "," }), [text]);
  const mapping = useMemo(() => {
    const m = { ...autoMap(template, parsed.headers) };
    for (const [k, v] of Object.entries(overrides)) {
      if (v === "") delete m[k];
      else if (parsed.headers.includes(v)) m[k] = v;
    }
    return m;
  }, [template, parsed.headers, overrides]);
  const preview = useMemo(() => (parsed.rows.length ? previewTemplate(template, parsed.rows, mapping) : null), [template, parsed.rows, mapping]);
  const groups = Array.from(new Set(IMPORT_TEMPLATES.map((t) => t.group)));
  const sampleHref = `data:text/csv;charset=utf-8,${encodeURIComponent(template.sample)}`;

  async function onFile(f: File | undefined) {
    setNote(null);
    if (!f) return;
    if (/\.(xlsx|xls|numbers)$/i.test(f.name)) {
      setNote("Excel files: open the file, select the cells (including the header row), copy, and paste them below — or use File → Save As → CSV and upload that.");
      return;
    }
    if (f.size > 3.5 * 1024 * 1024) {
      setNote("File is larger than 3.5 MB — split it into smaller files.");
      return;
    }
    setFileName(f.name);
    setText(await f.text());
    setOverrides({});
  }

  return (
    <form action={submitGuidedImport} className="space-y-5">
      <input type="hidden" name="template" value={slug} />
      <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
      <input type="hidden" name="fileName" value={fileName} />
      <textarea name="csv" value={text} readOnly hidden />

      <div className={box}>
        <StepLabel n={1} title="What are you importing?" done />
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1.2fr]">
          <label className="block text-xs text-neutral-400">
            Template
            <select value={slug} onChange={(e) => { setSlug(e.target.value); setOverrides({}); }} className="mt-1 h-10 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100">
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {IMPORT_TEMPLATES.filter((t) => t.group === g).map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="text-xs leading-5 text-neutral-400">
            <p>{template.summary}</p>
            <p className="mt-1 text-neutral-500">{template.creates}</p>
            <a href={sampleHref} download={`kaivaryn-${template.slug}-sample.csv`} className="mt-1 inline-flex items-center gap-1 text-amber-400 hover:text-amber-300"><Download className="h-3 w-3" /> Sample file</a>
          </div>
        </div>
      </div>

      <div className={box}>
        <StepLabel n={2} title="Add your data" done={parsed.rows.length > 0} />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-700 px-4 py-6 text-center text-xs text-neutral-400 transition hover:border-amber-500/50">
            <FileUp className="h-5 w-5 text-amber-400" />
            <span><span className="text-neutral-200">Upload CSV</span> (or TSV) · up to 3.5 MB</span>
            <span className="text-[11px] text-neutral-500">{fileName ? `Loaded ${fileName}` : "Excel? Copy the cells and paste on the right."}</span>
            <input type="file" accept=".csv,.tsv,.txt,text/csv,.xlsx,.xls" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <label className="block text-xs text-neutral-400">
            <span className="flex items-center gap-1"><ClipboardPaste className="h-3.5 w-3.5" /> Or paste rows from Excel / Google Sheets (with the header row)</span>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setFileName(""); setOverrides({}); }}
              rows={5}
              placeholder={template.sample.split("\n").slice(0, 2).join("\n")}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-[11px] text-neutral-200 placeholder:text-neutral-700"
            />
          </label>
        </div>
        {note ? <p className="mt-2 text-xs text-amber-300">{note}</p> : null}
        {parsed.rows.length ? <p className="mt-2 text-xs text-neutral-500">{parsed.rows.length} rows · {parsed.headers.length} columns · {parsed.delimiter === "\t" ? "tab-separated" : parsed.delimiter === ";" ? "semicolon-separated" : "comma-separated"}</p> : null}
      </div>

      <div className={box}>
        <StepLabel n={3} title="Check the columns, then import" done={Boolean(preview && !preview.missingRequired.length)} />
        {parsed.headers.length ? (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {template.fields.map((f) => (
                <label key={f.key} className="block text-[11px] text-neutral-400">
                  {f.label}{f.required ? <span className="text-amber-400"> *</span> : null}
                  <select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) => setOverrides((o) => ({ ...o, [f.key]: e.target.value }))}
                    className={`mt-1 h-9 w-full rounded-md border bg-neutral-950 px-2 text-xs text-neutral-100 ${f.required && !mapping[f.key] ? "border-red-800" : "border-neutral-700"}`}
                  >
                    <option value="">— not in file —</option>
                    {parsed.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {preview ? (
              <div className="mt-4 rounded-lg border border-neutral-800 p-3 text-xs">
                {preview.missingRequired.length ? (
                  <p className="text-red-300">Map the required columns first: {preview.missingRequired.join(", ")}.</p>
                ) : (
                  <>
                    <p className="text-neutral-200">
                      Will create <span className="font-semibold text-white">{preview.willCreate}</span> {template.kind === "opportunities" ? "revenue items" : template.kind === "inefficiencies" ? "operations items" : template.kind}
                      {preview.estimate ? <> · estimated {fmt(preview.estimate)}{template.kind === "inefficiencies" ? "/yr projected" : " potential"}</> : null}
                      {" "}· {preview.skipped} skipped (no gap){preview.errors ? ` · ${preview.errors} with errors` : ""}
                    </p>
                    {preview.samples.length ? <ul className="mt-2 space-y-0.5 text-neutral-500">{preview.samples.map((s) => <li key={s.row}>Row {s.row}: {s.outcome}</li>)}</ul> : null}
                    <p className="mt-2 text-[11px] text-neutral-500">Estimates only — nothing is counted as recovered or realized until your team records it. Rows already imported are skipped.</p>
                  </>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-xs text-neutral-500">Columns are matched automatically once data is added. You can change any match.</p>
        )}
        <div className="mt-4">
          {canImport ? <Submit disabled={!preview || preview.missingRequired.length > 0 || preview.total === 0} /> : <p className="text-xs text-neutral-500">Importing needs Manager or above.</p>}
        </div>
      </div>
    </form>
  );
}
