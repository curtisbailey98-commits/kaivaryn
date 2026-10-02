import { redirect } from "next/navigation";

/** Consolidated: notifications are part of the unified Inbox. */
export default function NotificationsRedirect() {
  redirect("/app/inbox?filter=NOTIFICATION");
}
