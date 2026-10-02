import { withOpCtx } from "@/lib/operate/api";
import { getInbox } from "@/lib/operate";

export const dynamic = "force-dynamic";

export async function GET() {
  return withOpCtx((ctx) => getInbox(ctx));
}
