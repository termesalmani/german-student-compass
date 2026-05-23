import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type AccentKey = "blue" | "purple" | "green" | "rose" | "orange";

export const ACCENTS: Record<AccentKey, { label: string; primary: string; ring: string; sidebarPrimary: string; swatch: string }> = {
  blue:   { label: "Blue",   primary: "oklch(0.62 0.19 255)", ring: "oklch(0.62 0.19 255)", sidebarPrimary: "oklch(0.62 0.19 255)", swatch: "#3b82f6" },
  purple: { label: "Purple", primary: "oklch(0.60 0.22 295)", ring: "oklch(0.60 0.22 295)", sidebarPrimary: "oklch(0.60 0.22 295)", swatch: "#8b5cf6" },
  green:  { label: "Green",  primary: "oklch(0.66 0.17 155)", ring: "oklch(0.66 0.17 155)", sidebarPrimary: "oklch(0.66 0.17 155)", swatch: "#10b981" },
  rose:   { label: "Rose",   primary: "oklch(0.65 0.22 15)",  ring: "oklch(0.65 0.22 15)",  sidebarPrimary: "oklch(0.65 0.22 15)",  swatch: "#f43f5e" },
  orange: { label: "Orange", primary: "oklch(0.70 0.18 50)",  ring: "oklch(0.70 0.18 50)",  sidebarPrimary: "oklch(0.70 0.18 50)",  swatch: "#f97316" },
};

const STORAGE_KEY = "gsc.accent";

function applyAccent(key: AccentKey) {
  if (typeof document === "undefined") return;
  const a = ACCENTS[key];
  const root = document.documentElement;
  root.style.setProperty("--primary", a.primary);
  root.style.setProperty("--primary-foreground", "oklch(0.99 0 0)");
  root.style.setProperty("--ring", a.ring);
  root.style.setProperty("--sidebar-primary", a.sidebarPrimary);
  root.style.setProperty("--sidebar-ring", a.ring);
}

function readStored(): AccentKey {
  if (typeof window === "undefined") return "blue";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return (v && v in ACCENTS ? (v as AccentKey) : "blue");
}

type Ctx = { accent: AccentKey; setAccent: (a: AccentKey) => Promise<void> };
const ThemeContext = createContext<Ctx>({ accent: "blue", setAccent: async () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [accent, setAccentState] = useState<AccentKey>(() => readStored());

  // Apply on mount + whenever it changes
  useEffect(() => { applyAccent(accent); }, [accent]);

  // Load from profile when user signs in
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("profiles").select("accent_color").eq("id", user.id).maybeSingle();
      if (cancelled) return;
      const v = (data?.accent_color ?? "blue") as AccentKey;
      if (v in ACCENTS) {
        setAccentState(v);
        window.localStorage.setItem(STORAGE_KEY, v);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const setAccent = async (a: AccentKey) => {
    setAccentState(a);
    window.localStorage.setItem(STORAGE_KEY, a);
    if (user) {
      await supabase.from("profiles").update({ accent_color: a }).eq("id", user.id);
    }
  };

  return <ThemeContext.Provider value={{ accent, setAccent }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);