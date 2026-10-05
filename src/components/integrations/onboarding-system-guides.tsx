"use client";

import { useEffect, useState } from "react";
import { getGuide } from "@/lib/integrations/guides";
import type { SystemSetupMap } from "@/lib/integrations/setup-store";
import { SystemGuideCard } from "./system-guide-card";

/**
 * Watches integrations[] checkboxes in the onboarding form and shows a guide + intake
 * for each checked system. Guide cards use their own forms (form attribute-free siblings).
 */
export function OnboardingSystemGuides({
  initial, setup, readOnly = false,
}: {
  initial: string[];
  setup: SystemSetupMap;
  readOnly?: boolean;
}) {
  const [keys, setKeys] = useState<string[]>(initial);

  useEffect(() => {
    const sync = () => {
      const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="integrations[]"]'));
      setKeys(boxes.filter((b) => b.checked).map((b) => b.value));
    };
    sync();
    document.addEventListener("change", sync);
    return () => document.removeEventListener("change", sync);
  }, []);

  if (!keys.length) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-800 p-4 text-xs text-neutral-500" data-testid="onboarding-system-guides">
        Select a system above to see its setup guide and the business details Kaivaryn needs. Choosing a system plans the connection — it does not connect anything yet.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="onboarding-system-guides">
      <div>
        <p className="text-xs font-medium text-neutral-300">Setup guides for what you selected</p>
        <p className="mt-1 text-[11px] leading-5 text-neutral-500">Fill in business details and tick the checklist as you go. Saving notes here does not mark a system connected.</p>
      </div>
      {keys.map((k) => {
        const guide = getGuide(k);
        if (!guide) return null;
        return <SystemGuideCard key={k} guide={guide} setup={setup[k] ?? null} state="selected" readOnly={readOnly} />;
      })}
    </div>
  );
}
