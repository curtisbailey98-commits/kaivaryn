import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-950">
      <a href="#main" className="skip-link">Skip to content</a>
      <SiteHeader />
      <div id="main" className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
