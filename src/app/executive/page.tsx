import { redirect } from "next/navigation";
import { requireExecutive } from "@/lib/executive/access";

export default async function ExecutiveIndex() {
  const exec = await requireExecutive();
  redirect(exec.activeDashboard === "CSEO" ? "/executive/cseo" : "/executive/ceo");
}
