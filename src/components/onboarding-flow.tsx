import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { pickReminderMicrocopy } from "@/lib/reminder-microcopy";

const OVERWHELM_OPTIONS: { key: string; label: string }[] = [
  { key: "visa", label: "Visa & bureaucracy" },
  { key: "jobs", label: "Finding a student job" },
  { key: "university", label: "Organizing university life" },
  { key: "health", label: "Health reminders" },
  { key: "emails", label: "German emails" },
  { key: "everything", label: "Everything 😭" },
];

const SUGGESTED_REMINDERS = [
  "Visa expiration",
  "Health insurance renewal",
  "Anmeldung",
  "University deadline",
  "FSP / exam deadline",
  "Job application follow-up",
];

type Step = "welcome" | "areas" | "reminder" | "done";

export function OnboardingFlow() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [areas, setAreas] = useState<string[]>([]);
  const [reminderTitle, setReminderTitle] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [saving, setSaving] = useState(false);
  const reminderTagline = useMemo(() => pickReminderMicrocopy(), []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data && data.onboarding_completed === false) {
          setOpen(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggleArea = (k: string) => {
    setAreas((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  const saveAreas = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ overwhelm_areas: areas })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setStep("reminder");
  };

  const finalTitle = (reminderTitle === "__custom__" ? customTitle : reminderTitle).trim();

  const saveReminderAndFinish = async (skip = false) => {
    if (!user) return;
    setSaving(true);
    if (!skip && finalTitle) {
      const { error } = await supabase.from("reminders").insert({
        user_id: user.id,
        title: finalTitle,
        due_date: reminderDate || null,
        reminder_at: reminderDate ? new Date(reminderDate + "T09:00:00").toISOString() : null,
        source_type: "custom",
      });
      if (error) {
        setSaving(false);
        return toast.error(error.message);
      }
    }
    const { error: pErr } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);
    setSaving(false);
    if (pErr) return toast.error(pErr.message);
    setStep("done");
  };

  const close = () => {
    setOpen(false);
    // soft reload data on parent dashboard
    window.dispatchEvent(new CustomEvent("onboarding:done"));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && step === "done") close(); }}>
      <DialogContent className="max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        {step === "welcome" && (
          <div className="space-y-5 py-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">Welcome to your Compass</h2>
              <p className="text-sm text-muted-foreground">
                A calmer way to organize student life in Germany. We'll set this up together in two small steps.
              </p>
            </div>
            <Button className="w-full" onClick={() => setStep("areas")}>Let's begin</Button>
          </div>
        )}

        {step === "areas" && (
          <div className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">What feels most overwhelming right now?</h2>
              <p className="text-sm text-muted-foreground">You don't have to organize everything at once.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {OVERWHELM_OPTIONS.map((o) => {
                const active = areas.includes(o.key);
                return (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => toggleArea(o.key)}
                    className={`flex items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/50 ${
                      active ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <span>{o.label}</span>
                    {active && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep("reminder")}>Skip</Button>
              <Button onClick={saveAreas} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
              </Button>
            </div>
          </div>
        )}

        {step === "reminder" && (
          <div className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">Add one important reminder</h2>
              <p className="text-sm text-muted-foreground">{reminderTagline}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTED_REMINDERS.map((s) => {
                const active = reminderTitle === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setReminderTitle(s)}
                    className={`rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/50 ${
                      active ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setReminderTitle("__custom__")}
                className={`rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/50 ${
                  reminderTitle === "__custom__" ? "border-primary bg-primary/5" : ""
                }`}
              >
                Something else…
              </button>
            </div>
            {reminderTitle === "__custom__" && (
              <div className="space-y-2">
                <Label>What would you like to remember?</Label>
                <Input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="e.g. Renew Deutschlandticket" />
              </div>
            )}
            {reminderTitle && (
              <div className="space-y-2">
                <Label>When? <span className="text-muted-foreground">(optional)</span></Label>
                <Input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} />
              </div>
            )}
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => saveReminderAndFinish(true)} disabled={saving}>
                Skip for now
              </Button>
              <Button onClick={() => saveReminderAndFinish(false)} disabled={saving || !finalTitle}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save reminder"}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-5 py-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">One step at a time.</h2>
              <p className="text-sm text-muted-foreground">You're already more organized than before.</p>
            </div>
            <Button className="w-full" onClick={close}>Go to dashboard</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}