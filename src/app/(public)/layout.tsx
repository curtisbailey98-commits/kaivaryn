import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PageEnter } from "@/components/motion";
import { PublicViki } from "@/components/voice/public-viki";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-neutral-950">
      <a href="#main" className="skip-link">Skip to content</a>
      <SiteHeader />
      <div id="main" className="relative flex-1">
        <PageEnter>{children}</PageEnter>
      </div>
      <SiteFooter />
      <PublicViki />
    </div>
  );
}
