/**
 * Google Sheets import via a published / link-shared CSV URL. No OAuth app, no Google account
 * linking: the sheet must be published to the web (File → Share → Publish to web → CSV) or
 * shared as "Anyone with the link". Only Google hosts are fetched (SSRF guard on every redirect).
 */

const ALLOWED_HOST = /^(docs\.google\.com|[a-z0-9-]+\.googleusercontent\.com)$/i;
export const MAX_SHEET_BYTES = 3 * 1024 * 1024;

export function normalizeSheetUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let u: URL;
  try {
    u = new URL(String(raw || "").trim());
  } catch {
    return { ok: false, error: "That isn't a valid link. Paste the Google Sheets link." };
  }
  if (u.protocol !== "https:" || u.hostname !== "docs.google.com" || !u.pathname.startsWith("/spreadsheets/")) {
    return { ok: false, error: "Only Google Sheets links (https://docs.google.com/spreadsheets/…) are supported." };
  }
  // Published to web: /spreadsheets/d/e/<pubId>/pub?output=csv (or pubhtml)
  const pub = u.pathname.match(/^\/spreadsheets\/d\/e\/([A-Za-z0-9_-]+)\/pub(html)?$/);
  if (pub) {
    const gid = u.searchParams.get("gid");
    return { ok: true, url: `https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub?output=csv${gid ? `&gid=${encodeURIComponent(gid)}` : ""}` };
  }
  // Regular sheet link: /spreadsheets/d/<id>/edit#gid=<gid> → export as CSV (needs "Anyone with the link")
  const doc = u.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})(\/.*)?$/);
  if (doc) {
    const gid = u.searchParams.get("gid") || (u.hash.match(/gid=(\d+)/)?.[1] ?? null);
    return { ok: true, url: `https://docs.google.com/spreadsheets/d/${doc[1]}/export?format=csv${gid ? `&gid=${encodeURIComponent(gid)}` : ""}` };
  }
  return { ok: false, error: "Couldn't read that Google Sheets link. Use the sheet's address or its “Publish to web” CSV link." };
}

/** Fetch CSV text from Google, following redirects only to Google hosts, with a timeout and size cap. */
export async function fetchSheetCsv(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  let current = url;
  for (let hop = 0; hop < 5; hop++) {
    const host = new URL(current).hostname;
    if (!ALLOWED_HOST.test(host)) throw new Error("The sheet redirected somewhere other than Google — not fetched.");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    let res: Response;
    try {
      res = await fetchImpl(current, { redirect: "manual", signal: ctrl.signal, headers: { Accept: "text/csv,text/plain;q=0.9,*/*;q=0.1" } });
    } catch (e) {
      throw new Error(e instanceof Error && e.name === "AbortError" ? "Google Sheets took too long to respond." : "Couldn't reach Google Sheets.");
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Google Sheets returned a redirect without a location.");
      const next = new URL(loc, current);
      if (/accounts\.google\.com|ServiceLogin/i.test(next.href)) throw new Error("This sheet isn't public. Publish it to the web as CSV, or share it as “Anyone with the link can view”.");
      current = next.href;
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) throw new Error("This sheet isn't public. Publish it to the web as CSV, or share it as “Anyone with the link can view”.");
    if (!res.ok) throw new Error(`Google Sheets returned HTTP ${res.status}.`);
    const type = res.headers.get("content-type") || "";
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_SHEET_BYTES) throw new Error("Sheet is larger than 3 MB — split it or use the file import.");
    const text = await res.text();
    if (text.length > MAX_SHEET_BYTES) throw new Error("Sheet is larger than 3 MB — split it or use the file import.");
    if (/text\/html/i.test(type) || /^\s*<!doctype html|^\s*<html/i.test(text)) throw new Error("This sheet isn't public. Publish it to the web as CSV, or share it as “Anyone with the link can view”.");
    return text;
  }
  throw new Error("Too many redirects from Google Sheets.");
}
