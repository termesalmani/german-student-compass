import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  SECTION_INTROS,
  SectionKey,
  markSectionVisited,
  getVisitedSections,
} from "@/lib/section-intros";

const DISMISS_PREFIX = "gsc:intro-dismissed:";

function dismissKey(userId: string | null | undefined, section: SectionKey) {
  return `${DISMISS_PREFIX}${userId ?? "anon"}:${section}`;
}

/**
 * Small warm introduction shown the first time a user opens a section.
 * Dismissible and never shown again once the user has acknowledged it.
 */
export function SectionIntro({ section }: { section: SectionKey }) {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const intro = SECTION_INTROS[section];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = window.localStorage.getItem(dismissKey(user?.id, section));
    const visited = getVisitedSections(user?.id);
    const alreadyVisited = visited.includes(section);
    // Always mark as visited so exploration progress updates.
    if (!alreadyVisited) markSectionVisited(user?.id, section);
    // Show intro if it hasn't been dismissed yet (even on subsequent visits
    // until the user closes it explicitly).
    if (!dismissed) setShow(true);
  }, [user?.id, section]);

  if (!show || !intro) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(dismissKey(user?.id, section), "1");
    } catch {
      // ignore
    }
    setShow(false);
  };

  return (
    <div className="relative flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/[0.04] p-4 text-sm">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <div className="flex-1 space-y-0.5 pr-6">
        <div className="font-medium">{intro.title}</div>
        <p className="text-muted-foreground">{intro.message}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-1.5 top-1.5 h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={dismiss}
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}