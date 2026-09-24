# Kaivaryn Acquisition Execution Layer

This layer turns Acquisition Intelligence V2 from a decision system into a controlled execution system.

The operating path is:

`intent → qualification → research → micro-audit → reverse-selling draft → Gmail send → Gmail reply sync → response intelligence → optional consented AI call → Google Calendar demo → completed demo → Stripe → onboarding`

## Google Workspace

Kaivaryn uses one connected Google Workspace account for acquisition email and calendar execution. The Gmail/Google Calendar connectors used inside ChatGPT are separate from Kaivaryn's deployed runtime authorization; after deployment, connect the same Google account once from `/admin/acquisition/execution` so Kaivaryn stores its own encrypted OAuth tokens.

Required Render secrets:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
ACQUISITION_TOKEN_ENCRYPTION_KEY
ACQUISITION_SYNC_TOKEN
ACQUISITION_AUTOMATION_TOKEN
```

The OAuth callback defaults to:

```text
https://kaivaryn.onrender.com/api/integrations/google/acquisition/callback
```

If the public app URL changes, set `NEXTAUTH_URL` correctly or override with `GOOGLE_ACQUISITION_REDIRECT_URI`.

OAuth scopes are intentionally limited to:

- Gmail send
- Gmail read-only
- Google Calendar events
- OpenID/email identity

Provider tokens are encrypted at rest before they are written to PostgreSQL. `ACQUISITION_TOKEN_ENCRYPTION_KEY` is preferred; `NEXTAUTH_SECRET` is the fallback encryption secret.

### Real email state

`SENT` is no longer intended to mean “someone changed a dropdown.” The provider-backed send action writes a Gmail message/thread reference and a real send timestamp.

Execution rules include:

- verified acquisition contact required;
- account score must be at least 55 and not `HOLD`;
- stopped/opted-out accounts cannot send;
- a 48-hour per-contact provider-send cooldown;
- a global provider-backed daily send ceiling (default 25, configurable with `ACQUISITION_DAILY_EMAIL_LIMIT`);
- a reply-stop opt-out line is added when the draft does not already contain one.

Queued messages can be executed by:

```http
POST /api/acquisition/automation/tick
Authorization: Bearer <ACQUISITION_AUTOMATION_TOKEN>
```

The execution tick also syncs Gmail replies before sending the next queued batch.

A GitHub Actions workflow in `.github/workflows/acquisition-execution.yml` calls the tick every 20 minutes. It requires one repository secret named `KAIVARYN_AUTOMATION_TOKEN` whose value matches Render's `ACQUISITION_AUTOMATION_TOKEN`. Only outreach records already placed in `QUEUED` state are eligible for scheduled sending. AI calls are intentionally not started by the scheduler.

### Reply intelligence

Gmail reply sync only accepts messages from known acquisition contacts and only records them when they match a Gmail thread created by a Kaivaryn provider-backed outbound message. This avoids classifying unrelated inbox traffic as sales replies.

Replies are deduplicated in `AcquisitionInboundEvent`, classified, and routed through the same V2 `stageForResponse` / `nextActionForResponse` logic already used by the command center.

## Google Calendar

From an acquisition account, the admin can create the real Google Calendar event and Google Meet link after the prospect agrees to meet.

The event updates the linked `DemoRequest`, moves the acquisition account to `DEMO_BOOKED`, and preserves the existing demo → Stripe → onboarding gate.

## AI call agent

Telephony is implemented against Twilio Programmable Voice using speech gather turns. It does not pretend to be a human and opens by disclosing that it is an automated Kaivaryn AI assistant.

Required Render secrets:

```text
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
```

Optional conversational-model secrets:

```text
OPENAI_API_KEY
OPENAI_CALL_MODEL=gpt-5.6-luna
```

Without `OPENAI_API_KEY`, the agent still works with deterministic response routing. When an OpenAI model is configured, it produces short context-aware conversational turns while keeping hard stop/opt-out/meeting dispositions deterministic.

### Call eligibility policy

An automated call is blocked unless all of the following are true:

- the contact has a phone number;
- contact data is verified;
- recorded automated-call consent exists with a consent source;
- the contact is not do-not-call;
- an IANA timezone is recorded;
- the account is `PRIORITY` and scores at least 75;
- the contact has authority score 6+;
- the call occurs Monday–Friday from 09:00–17:00 in the contact timezone;
- no call attempt has occurred for that contact within the prior 72 hours;
- the acquisition stage is still in the callable pre-demo sales motion;
- the phone number is valid E.164 format;
- the call agent hands back to a human after a configurable turn ceiling (default 6 prospect turns).

Every call is persisted in `AcquisitionCall`, including provider call id, status, turn transcript JSON, disposition, summary, and timestamps.

### Voice webhooks

Twilio calls back to:

```text
POST /api/acquisition/calls/twiml?callId=...
POST /api/acquisition/calls/turn?callId=...
POST /api/acquisition/calls/status?callId=...
```

All three validate the Twilio request signature before accepting call state or speech.

## Admin UI

Execution controls are under:

```text
/admin/acquisition/execution
```

Each acquisition account also exposes provider-backed Gmail sending, AI call eligibility/execution, and Google Calendar demo scheduling without replacing the existing V2 scoring/reverse-selling workflow.
