import { prisma } from "@/lib/prisma";
import { openSecret, sealSecret } from "@/lib/secret-box";

const PROVIDER = "GOOGLE_WORKSPACE";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

function oauthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, "");
  const redirectUri = process.env.GOOGLE_ACQUISITION_REDIRECT_URI || (base ? `${base}/api/integrations/google/acquisition/callback` : null);
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function googleOAuthConfigured() {
  return Boolean(oauthConfig());
}

export function buildGoogleWorkspaceAuthorizationUrl(state: string) {
  const cfg = oauthConfig();
  if (!cfg) throw new Error("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

async function tokenRequest(params: URLSearchParams): Promise<TokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Google token exchange failed (${response.status}): ${payload?.error_description || payload?.error || "unknown"}`);
  }
  return payload as TokenResponse;
}

export async function connectGoogleWorkspaceFromCode(code: string) {
  const cfg = oauthConfig();
  if (!cfg) throw new Error("Google OAuth is not configured.");
  const token = await tokenRequest(new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
  }));

  const userResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });
  const userInfo = await userResponse.json().catch(() => ({}));
  const email = typeof userInfo?.email === "string" ? userInfo.email.toLowerCase() : null;

  const existing = await prisma.acquisitionProviderConnection.findUnique({ where: { provider: PROVIDER } });
  const refresh = token.refresh_token
    ? sealSecret(token.refresh_token)
    : existing?.refreshTokenEncrypted || null;

  const row = await prisma.acquisitionProviderConnection.upsert({
    where: { provider: PROVIDER },
    update: {
      status: "CONNECTED",
      accountLabel: email,
      accessTokenEncrypted: sealSecret(token.access_token),
      refreshTokenEncrypted: refresh,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      scopes: token.scope || GOOGLE_SCOPES,
      lastError: null,
    },
    create: {
      provider: PROVIDER,
      status: "CONNECTED",
      accountLabel: email,
      accessTokenEncrypted: sealSecret(token.access_token),
      refreshTokenEncrypted: refresh,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      scopes: token.scope || GOOGLE_SCOPES,
    },
  });
  return row;
}

export async function disconnectGoogleWorkspace() {
  return prisma.acquisitionProviderConnection.upsert({
    where: { provider: PROVIDER },
    update: {
      status: "DISCONNECTED",
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      expiresAt: null,
      syncCursor: null,
      lastError: null,
    },
    create: { provider: PROVIDER, status: "DISCONNECTED" },
  });
}

export async function getGoogleWorkspaceConnection() {
  return prisma.acquisitionProviderConnection.findUnique({ where: { provider: PROVIDER } });
}

async function markGoogleError(message: string) {
  await prisma.acquisitionProviderConnection.upsert({
    where: { provider: PROVIDER },
    update: { lastError: message, status: "ERROR" },
    create: { provider: PROVIDER, status: "ERROR", lastError: message },
  }).catch(() => undefined);
}

export async function getGoogleAccessToken() {
  const row = await getGoogleWorkspaceConnection();
  if (!row || row.status === "DISCONNECTED" || !row.accessTokenEncrypted) throw new Error("Google Workspace is not connected.");
  const stillFresh = row.expiresAt && row.expiresAt.getTime() > Date.now() + 90_000;
  if (stillFresh) return openSecret(row.accessTokenEncrypted);
  if (!row.refreshTokenEncrypted) throw new Error("Google refresh token is unavailable. Reconnect Google Workspace.");

  const cfg = oauthConfig();
  if (!cfg) throw new Error("Google OAuth client is not configured.");
  try {
    const token = await tokenRequest(new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: openSecret(row.refreshTokenEncrypted),
      grant_type: "refresh_token",
    }));
    await prisma.acquisitionProviderConnection.update({
      where: { provider: PROVIDER },
      data: {
        status: "CONNECTED",
        accessTokenEncrypted: sealSecret(token.access_token),
        expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
        scopes: token.scope || row.scopes,
        lastError: null,
      },
    });
    return token.access_token;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google token refresh failed";
    await markGoogleError(message);
    throw error;
  }
}

async function googleFetch(url: string, init?: RequestInit) {
  const token = await getGoogleAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (response.status === 401) {
    await prisma.acquisitionProviderConnection.update({ where: { provider: PROVIDER }, data: { expiresAt: new Date(0) } }).catch(() => undefined);
  }
  return response;
}

function headerSafe(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export async function sendGoogleWorkspaceEmail(input: {
  to: string;
  subject: string;
  body: string;
  replyToMessageId?: string | null;
  threadId?: string | null;
}) {
  const connection = await getGoogleWorkspaceConnection();
  if (!connection?.accountLabel) throw new Error("Connected Google account email is unavailable.");
  const headers = [
    `From: ${headerSafe(connection.accountLabel)}`,
    `To: ${headerSafe(input.to)}`,
    `Subject: ${headerSafe(input.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ];
  if (input.replyToMessageId) {
    headers.push(`In-Reply-To: ${headerSafe(input.replyToMessageId)}`);
    headers.push(`References: ${headerSafe(input.replyToMessageId)}`);
  }
  const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${input.body}`, "utf8").toString("base64url");
  const response = await googleFetch(`${GMAIL_BASE}/messages/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ raw, ...(input.threadId ? { threadId: input.threadId } : {}) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id) throw new Error(`Gmail send failed (${response.status}): ${payload?.error?.message || "unknown"}`);
  return { id: String(payload.id), threadId: payload.threadId ? String(payload.threadId) : null };
}

type GmailHeader = { name?: string; value?: string };
type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

type GmailMessage = {
  id: string;
  threadId?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
};

function gmailHeader(message: GmailMessage, name: string) {
  return message.payload?.headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || null;
}

function decodeGmailData(data?: string) {
  if (!data) return "";
  try { return Buffer.from(data, "base64url").toString("utf8"); } catch { return ""; }
}

function plainBody(part?: GmailPart): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return decodeGmailData(part.body.data);
  for (const child of part.parts || []) {
    const value = plainBody(child);
    if (value) return value;
  }
  if (part.body?.data) return decodeGmailData(part.body.data);
  return "";
}

function cleanReplyBody(value: string) {
  return value
    .split(/\nOn .+ wrote:\s*$/im)[0]
    .split(/\n-{2,}Original Message-{2,}/i)[0]
    .split(/\nFrom:\s.+\nSent:/i)[0]
    .replace(/^>.*$/gm, "")
    .trim();
}

export function extractEmailAddress(value?: string | null) {
  if (!value) return null;
  const match = value.match(/<([^>]+)>/) || value.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
  return (match?.[1] || match?.[0] || "").trim().toLowerCase() || null;
}

export async function listRecentGmailInboxMessages(maxResults = 50) {
  const params = new URLSearchParams({ q: "in:inbox newer_than:30d", maxResults: String(Math.min(100, Math.max(1, maxResults))) });
  const listResponse = await googleFetch(`${GMAIL_BASE}/messages?${params.toString()}`);
  const listPayload = await listResponse.json().catch(() => ({}));
  if (!listResponse.ok) throw new Error(`Gmail list failed (${listResponse.status}): ${listPayload?.error?.message || "unknown"}`);
  const ids = Array.isArray(listPayload?.messages) ? listPayload.messages.map((m: { id?: string }) => m.id).filter(Boolean) : [];
  const messages: Array<{
    id: string;
    threadId: string | null;
    messageIdHeader: string | null;
    inReplyTo: string | null;
    from: string | null;
    fromEmail: string | null;
    subject: string | null;
    body: string;
    receivedAt: Date;
  }> = [];
  for (const id of ids) {
    const response = await googleFetch(`${GMAIL_BASE}/messages/${encodeURIComponent(String(id))}?format=full`);
    if (!response.ok) continue;
    const message = await response.json() as GmailMessage;
    messages.push({
      id: message.id,
      threadId: message.threadId || null,
      messageIdHeader: gmailHeader(message, "Message-ID"),
      inReplyTo: gmailHeader(message, "In-Reply-To"),
      from: gmailHeader(message, "From"),
      fromEmail: extractEmailAddress(gmailHeader(message, "From")),
      subject: gmailHeader(message, "Subject"),
      body: cleanReplyBody(plainBody(message.payload)),
      receivedAt: message.internalDate ? new Date(Number(message.internalDate)) : new Date(),
    });
  }
  return messages;
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour") % 24, value("minute"), value("second"));
  return asUtc - date.getTime();
}

function zonedLocalToDate(localDateTime: string, timeZone: string) {
  const match = localDateTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error("Invalid local date/time.");
  // Validate the IANA timezone before using it in Google Calendar.
  new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  const [, year, month, day, hour, minute, second = "00"] = match;
  const wallUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  let candidate = new Date(wallUtc);
  const offset = timeZoneOffsetMs(candidate, timeZone);
  candidate = new Date(wallUtc - offset);
  const refined = timeZoneOffsetMs(candidate, timeZone);
  if (refined !== offset) candidate = new Date(wallUtc - refined);
  return candidate;
}

export async function createGoogleCalendarDemo(input: {
  summary: string;
  description: string;
  attendeeEmail: string;
  startsAtLocal: string;
  timeZone: string;
  durationMinutes: number;
}) {
  const start = zonedLocalToDate(input.startsAtLocal, input.timeZone);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  const requestId = `kaivaryn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = await googleFetch(`${CALENDAR_BASE}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      start: { dateTime: start.toISOString(), timeZone: input.timeZone },
      end: { dateTime: end.toISOString(), timeZone: input.timeZone },
      attendees: [{ email: input.attendeeEmail }],
      conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.id) throw new Error(`Google Calendar create failed (${response.status}): ${payload?.error?.message || "unknown"}`);
  const meetUrl = payload?.hangoutLink || payload?.conferenceData?.entryPoints?.find((p: { entryPointType?: string }) => p.entryPointType === "video")?.uri || null;
  return {
    id: String(payload.id),
    htmlLink: payload.htmlLink ? String(payload.htmlLink) : null,
    meetUrl: meetUrl ? String(meetUrl) : null,
  };
}

export async function noteGoogleSyncSuccess() {
  await prisma.acquisitionProviderConnection.update({
    where: { provider: PROVIDER },
    data: { status: "CONNECTED", lastSyncAt: new Date(), lastError: null },
  }).catch(() => undefined);
}
