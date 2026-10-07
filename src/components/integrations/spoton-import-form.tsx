"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Download, FileUp } from "lucide-react";
import { SPOTON_FIELDS, SPOTON_SAMPLE_CSV, mapSpotOnRows, parseSpotOnCsv } from "@/lib/integrations/spoton/export-format";
import { importSpotOnAction } from "@/app/app/integrations/spoton-actions";

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className="h-9 rounded-md bg-amber-500 px-4 text-xs font-semibold text-neutral-950 transition hover:bg-amber-400 disabled:opacity-50">
      {pending ? "Importing…" : "Import SpotOn sales"}
    </button>
  );
}

export function SpotOnImportForm({ canImport, returnTo = "/app/integrations" }: { canImport: boolean; returnTo?: string }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const preview = useMemo(() => {
    if (!text.trim()) return null;
    const { rows } = parseSpotOnCsv(text);
    const m = mapSpotOnRows(rows);
    const orders = m.rows.filter((r) => r.type === "ORDER");
    const net = orders.reduce((s, r) => s + r.amount, 0);
    const days = new Set(orders.map((r) => r.occurredAt.toISOString().slice(0, 10)));
    return { ...m, net, days: days.size };
  }, [text]);
  const sampleHref = `data:text/csv;charset=utf-8,${encodeURIComponent(SPOTON_SAMPLE_CSV)}`;

  async function onFile(f: File | undefined) {
    setNote(null);
    if (!f) return;
    if (/\.(xlsx|xls|numbers)$/i.test(f.name)) { setNote("Please choose the CSV download (SpotOn's Download CSV), not an Excel file."); return; }
    if (f.size > 3.5 * 1024 * 1024) { setNote("That file is larger than 3.5 MB. Export a shorter date range and import it in parts."); return; }
    setFileName(f.name);
    setText(await f.text());
  }

  if (!canImport) return <p className="text-xs text-neutral-500">Importing SpotOn sales needs Manager or above.</p>;

  return (
    <form action={importSpotOnAction} className="space-y-3">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="csv" value={text} />
      <input type="hidden" name="fileName" value={fileName} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-neutral-700 px-3 text-xs text-neutral-200 hover:border-amber-500/60">
          <FileUp className="h-3.5 w-3.5" /> {fileName ? "Choose a different file" : "Choose SpotOn CSV"}
          <input type="file" accept=".csv,text/csv,.txt" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="SpotOn CSV export" />
        </label>
        <a href={sampleHref} download="kaivaryn-spoton-sales-template.csv" className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-xs text-amber-400 hover:text-amber-300">
          <Download className="h-3.5 w-3.5" /> Sample file (column layout)
        </a>
        {fileName ? <span className="truncate text-[11px] text-neutral-500">{fileName}</span> : null}
      </div>
      {note ? <p className="text-xs text-amber-300">{note}</p> : null}
      {preview ? (
        <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 text-[11px] leading-5 text-neutral-400" data-testid="spoton-preview">
          {preview.missingRequired.length ? (
            <p className="text-red-300">Missing column(s): {preview.missingRequired.join(", ")}. Check that the header row is included.</p>
          ) : (
            <p className="text-neutral-200">
              {preview.granularity === "check" ? "One row per check" : "One row per day"} · {preview.days} {preview.days === 1 ? "day" : "days"} · net sales {money(preview.net)}
              {preview.skipped.length ? ` · ${preview.skipped.length} skipped` : ""}{preview.errors.length ? ` · ${preview.errors.length} rows with problems` : ""}
            </p>
          )}
          <ul className="flex flex-wrap gap-1.5">
            {SPOTON_FIELDS.filter((f) => preview.mapping[f.key]).map((f) => (
              <li key={f.key} className="rounded border border-neutral-800 px-1.5 py-0.5"><span className="text-neutral-500">{f.label} ←</span> <span className="text-neutral-200">{preview.mapping[f.key]}</span></li>
            ))}
          </ul>
          {preview.errors.slice(0, 3).map((e) => <p key={`${e.row}-${e.error}`} className="text-amber-300">Row {e.row}: {e.error}</p>)}
        </div>
      ) : null}
      <Submit disabled={!preview || preview.missingRequired.length > 0 || preview.rows.length === 0} />
    </form>
  );
}
