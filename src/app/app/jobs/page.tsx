import { redirect } from "next/navigation";

/** Consolidated: engine runs, import jobs, and operating runs live in Automations. */
export default function JobsRedirect() {
  redirect("/app/automations#runs");
}
