// Soft, rotating microcopy for reminder-related UI.
// Keep tone calm, supportive, low-pressure — never guilt-based.
export const REMINDER_MICROCOPY = [
  "One less thing to mentally carry.",
  "For the things worth remembering.",
  "So everything doesn't stay in your head.",
  "A quiet nudge from your future self.",
  "Let your mind put this one down.",
  "Small notes, calmer days.",
] as const;

/** Pick a random soft reminder line. Memoize at module/component scope to avoid re-rolling on every render. */
export function pickReminderMicrocopy(): string {
  return REMINDER_MICROCOPY[Math.floor(Math.random() * REMINDER_MICROCOPY.length)];
}

/** Stable pick based on a seed (e.g., a day key or user id) so the line stays put across renders. */
export function pickReminderMicrocopyBy(seed: string | number): string {
  const s = typeof seed === "number" ? seed : Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
  return REMINDER_MICROCOPY[s % REMINDER_MICROCOPY.length];
}