import { redirect } from "next/navigation";
import { requireExecutive } from "@/lib/executive/access";

export default async function ExecutiveIndex() {
  const exec = await requireExecutive();
  if (exec.activeDashboard === "CHIEF") redirect("/executive/chief");
  if (exec.activeDashboard === "CSEO") redirect("/executive/cseo");
  redirect("/executive/ceo");
}
