import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

const schema = read("prisma/schema.prisma");
const actions = read("src/app/admin/acquisition/actions.ts");
const execution = read("src/lib/acquisition-execution.ts");
const callAgent = read("src/lib/call-agent.ts");
const google = read("src/lib/providers/google-workspace.ts");
const twilio = read("src/lib/providers/twilio.ts");
const render = read("render.yaml");
const automationWorkflow = read(".github/workflows/acquisition-execution.yml");

assert.match(schema, /model AcquisitionProviderConnection/);
assert.match(schema, /model AcquisitionInboundEvent/);
assert.match(schema, /model AcquisitionCall/);
assert.match(schema, /phoneConsentAt\s+DateTime\?/);
assert.match(schema, /doNotCallAt\s+DateTime\?/);

assert.match(execution, /sendAcquisitionOutreachEmail/);
assert.match(execution, /syncGmailReplies/);
assert.match(execution, /48 \* 60 \* 60_000/);
assert.match(execution, /Daily Gmail execution ceiling reached/);
assert.match(actions, /Use Send through Gmail so SENT reflects a real provider delivery attempt/);

assert.match(google, /gmail\.send/);
assert.match(google, /gmail\.readonly/);
assert.match(google, /calendar\.events/);
assert.match(google, /createGoogleCalendarDemo/);

assert.match(callAgent, /Automated AI voice calls require recorded phone consent/);
assert.match(callAgent, /qualificationScore < 75/);
assert.match(callAgent, /72 \* 60 \* 60_000/);
assert.match(callAgent, /CALLABLE_STAGES/);
assert.match(callAgent, /MAX_TURNS_HANDOFF/);
assert.match(callAgent, /E\.164/);
assert.match(callAgent, /do-not-call/i);
assert.match(twilio, /validateTwilioWebhook/);
assert.match(twilio, /StatusCallback/);

for (const env of [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "ACQUISITION_TOKEN_ENCRYPTION_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "OPENAI_API_KEY",
]) assert.match(render, new RegExp(env));

assert.match(automationWorkflow, /\*\/20 \* \* \* \*/);
assert.match(automationWorkflow, /KAIVARYN_AUTOMATION_TOKEN/);
assert.match(automationWorkflow, /api\/acquisition\/automation\/tick/);

console.log("Acquisition execution validation passed.");
