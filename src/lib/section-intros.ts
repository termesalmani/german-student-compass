import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

export type SectionKey =
  | "dashboard"
  | "bureaucracy"
  | "jobs"
  | "email-helper"
  | "assistant"
  | "health"
  | "settings";

export const SECTION_INTROS: Record<
  SectionKey,
  { title: string; message: string }
> = {
  dashboard: {
    title: "Your dashboard",
    message: "A calmer place to keep important things in sight.",
  },
  bureaucracy: {
    title: "Bureaucracy",
    message:
      "Keep deadlines, documents, and official tasks organized here — at your own pace.",
  },
  jobs: {
    title: "Job applications",
    message: "Track applications and follow-ups without losing track.",
  },
  "email-helper": {
    title: "German email helper",
    message: "Get help writing clear and natural German emails.",
  },
  assistant: {
    title: "AI assistant",
    message: "Ask anything about student life in Germany — no pressure.",
  },
  health: {
    title: "Student health",
    message: "Stay on top of checkups, reminders, and student wellbeing.",
  },
  settings: {
    title: "Settings",
    message: "Customize the app so it works the way you need.",
  },
};

export const EXPLORATION_KEYS: SectionKey[] = [
  "dashboard",
  "bureaucracy",
  "jobs",
  "email-helper",
  "health",
  "settings",
];

const STORAGE_PREFIX = "gsc:visited:";
const EVENT_NAME = "gsc:visited-updated";

function storageKey(userId: string | null | undefined) {
  return `${STORAGE_PREFIX}${userId ?? "anon"}`;
}

export function getVisitedSections(userId: string | null | undefined): SectionKey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as SectionKey[]) : [];
  } catch {
    return [];
  }
}

export function markSectionVisited(
  userId: string | null | undefined,
  section: SectionKey,
) {
  if (typeof window === "undefined") return;
  const visited = getVisitedSections(userId);
  if (visited.includes(section)) return;
  const next = [...visited, section];
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // ignore quota errors
  }
}

/** Mark the section as visited once on mount and return whether this is the first visit. */
export function useSectionVisit(section: SectionKey) {
  const { user } = useAuth();
  const [firstVisit, setFirstVisit] = useState(false);

  useEffect(() => {
    const visited = getVisitedSections(user?.id);
    const isFirst = !visited.includes(section);
    setFirstVisit(isFirst);
    if (isFirst) markSectionVisited(user?.id, section);
  }, [user?.id, section]);

  return firstVisit;
}

/** Subscribe to visited-sections changes (same-tab updates included). */
export function useVisitedSections(): SectionKey[] {
  const { user } = useAuth();
  const [visited, setVisited] = useState<SectionKey[]>(() => getVisitedSections(user?.id));

  useEffect(() => {
    const refresh = () => setVisited(getVisitedSections(user?.id));
    refresh();
    window.addEventListener(EVENT_NAME, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT_NAME, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [user?.id]);

  return visited;
}