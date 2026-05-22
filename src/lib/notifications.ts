import { useEffect, useState } from "react";

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

export function getPermission(): NotifPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotifPermission;
}

export async function requestPermission(): Promise<NotifPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  const result = await Notification.requestPermission();
  return result as NotifPermission;
}

export function notify(title: string, body?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch {
    // ignore
  }
}

export function usePermission() {
  const [perm, setPerm] = useState<NotifPermission>("default");
  useEffect(() => {
    setPerm(getPermission());
  }, []);
  return { perm, setPerm };
}

/**
 * Polls a list of reminder items (with reminder_at ISO strings) and fires browser
 * notifications when their time arrives. Returns a cleanup function via effect.
 */
export function useReminderNotifier(
  reminders: Array<{ id: string; title: string; note?: string | null; reminder_at: string | null; completed?: boolean }>,
) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fired = new Set<string>();
    const tick = () => {
      const now = Date.now();
      for (const r of reminders) {
        if (!r.reminder_at || r.completed) continue;
        const t = new Date(r.reminder_at).getTime();
        if (Number.isNaN(t)) continue;
        // fire if due within the last 60s and not yet fired this session
        if (t <= now && now - t < 5 * 60 * 1000 && !fired.has(r.id)) {
          fired.add(r.id);
          notify(`Reminder: ${r.title}`, r.note ?? undefined);
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [reminders]);
}