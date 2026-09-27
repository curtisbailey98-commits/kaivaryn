import Link from "next/link";
import { requireExecutive } from "@/lib/executive/access";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CseoStubAccessPage() {
  await requireExecutive("cseo_console");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="CSEO stub" title="Access" description="Reserved Security Command module. Not built yet — see EXTENSIONS.md." />
      <Card>
        <CardContent className="py-4 text-sm text-neutral-400">
          Extension point for future CSEO security division. 
          <Link href="/executive/cseo" className="text-amber-400">← Security Command</Link>
        </CardContent>
      </Card>
    </div>
  );
}
