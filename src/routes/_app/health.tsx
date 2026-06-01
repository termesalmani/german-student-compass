import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, HeartPulse, Loader2, Plus, Sparkles, Trash2, ChefHat, Clock, Wallet } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/_app/health")({ component: HealthPage });

type Reminder = {
  id: string;
  title: string;
  category: string;
  due_date: string | null;
  frequency: string | null;
  notes: string | null;
  completed: boolean;
};

const SUGGESTED: { title: string; category: string; frequency: string }[] = [
  { title: "Yearly blood test", category: "checkup", frequency: "yearly" },
  { title: "Dental checkup", category: "dental", frequency: "every 6 months" },
  { title: "Gynecological checkup", category: "gynecology", frequency: "yearly" },
  { title: "Eye checkup", category: "vision", frequency: "every 2 years" },
  { title: "Vaccination record review", category: "vaccination", frequency: "yearly" },
];

function HealthPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "general",
    due_date: "",
    frequency: "",
    notes: "",
  });

  // meal helper state
  const [budget, setBudget] = useState(30);
  const [diet, setDiet] = useState("no preference");
  const [cookingTime, setCookingTime] = useState(20);
  const [dislikes, setDislikes] = useState("");
  const [energy, setEnergy] = useState<"exhausted" | "normal" | "can_cook">("normal");
  const [pantry, setPantry] = useState<string[]>(["rice", "pasta", "eggs"]);
  const [mealLoading, setMealLoading] = useState(false);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [microcopyIdx] = useState(() => Math.floor(Math.random() * MICROCOPY.length));

  const load = async () => {
    const { data } = await supabase
      .from("health_reminders")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false });
    setReminders((data as Reminder[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const addReminder = async (preset?: typeof SUGGESTED[number]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = preset
      ? { user_id: user.id, title: preset.title, category: preset.category, frequency: preset.frequency }
      : {
          user_id: user.id,
          title: form.title,
          category: form.category,
          due_date: form.due_date || null,
          frequency: form.frequency || null,
          notes: form.notes || null,
        };
    if (!preset && !form.title.trim()) return toast.error("Title is required");
    const { error } = await supabase.from("health_reminders").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success("Reminder added");
    if (!preset) {
      setForm({ title: "", category: "general", due_date: "", frequency: "", notes: "" });
      setOpen(false);
    }
    load();
  };

  const toggle = async (r: Reminder) => {
    await supabase.from("health_reminders").update({ completed: !r.completed }).eq("id", r.id);
    load();
  };

  const del = async (id: string) => {
    await supabase.from("health_reminders").delete().eq("id", id);
    load();
  };

  const generateMeals = async () => {
    setMealLoading(true);
    setMeals([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-meal-ideas", {
        body: { budget, diet, cookingTime, dislikes, energy, pantry },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMeals(Array.isArray(data?.meals) ? data.meals : []);
      if (!data?.meals?.length) toast.error("Couldn't generate meals. Try again.");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate meals");
    } finally {
      setMealLoading(false);
    }
  };

  const existingTitles = new Set(reminders.map((r) => r.title.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <HeartPulse className="h-6 w-6 text-primary" /> Student Health
          </h1>
          <p className="text-sm text-muted-foreground">
            General wellness organization for your time in Germany.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Custom reminder</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add health reminder</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Dermatologist checkup" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={form.frequency || "yearly"} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one-time">One-time</SelectItem>
                      <SelectItem value="monthly">Every month</SelectItem>
                      <SelectItem value="every 3 months">Every 3 months</SelectItem>
                      <SelectItem value="every 6 months">Every 6 months</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="every 2 years">Every 2 years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["general", "checkup", "dental", "vision", "gynecology", "vaccination", "mental"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter><Button onClick={() => addReminder()}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Not medical advice</AlertTitle>
        <AlertDescription>
          This app does not provide medical diagnosis or treatment advice. For medical concerns, consult a doctor.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Suggested checkups</CardTitle>
          <CardDescription>Common reminders for students. Add the ones you need.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SUGGESTED.map((s) => {
            const added = existingTitles.has(s.title.toLowerCase());
            return (
              <div key={s.title} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.frequency}</div>
                </div>
                <Button size="sm" variant={added ? "secondary" : "outline"} disabled={added} onClick={() => addReminder(s)}>
                  {added ? "Added" : "Add"}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your reminders</CardTitle>
          <CardDescription>Track upcoming and recurring checkups.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {reminders.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing scheduled. A small reminder now can save future stress.</p>
          )}
          {reminders.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div className="flex items-start gap-3">
                <Checkbox checked={r.completed} onCheckedChange={() => toggle(r)} className="mt-1" />
                <div>
                  <div className={`text-sm font-medium ${r.completed ? "line-through text-muted-foreground" : ""}`}>
                    {r.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{r.category}</Badge>
                    {r.frequency && <span>· {r.frequency}</span>}
                    {r.due_date && <span>· {format(parseISO(r.due_date), "PPP")}</span>}
                  </div>
                  {r.notes && <div className="mt-1 text-xs text-muted-foreground">{r.notes}</div>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => del(r.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ChefHat className="h-5 w-5 text-primary" /> Student kitchen helper</CardTitle>
          <CardDescription>{MICROCOPY[microcopyIdx]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Weekly food budget (€)</Label>
              <Input type="number" min={5} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Cooking time per meal (minutes)</Label>
              <Input type="number" min={5} value={cookingTime} onChange={(e) => setCookingTime(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Dietary preference</Label>
              <Select value={diet} onValueChange={setDiet}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["no preference", "vegetarian", "vegan", "pescatarian", "halal", "kosher", "gluten-free", "lactose-free"].map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Disliked ingredients</Label>
              <Input value={dislikes} onChange={(e) => setDislikes(e.target.value)} placeholder="e.g. mushrooms, olives" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>How's your energy today?</Label>
            <div className="flex flex-wrap gap-2">
              {ENERGY_OPTIONS.map((o) => (
                <Button
                  key={o.value}
                  type="button"
                  size="sm"
                  variant={energy === o.value ? "default" : "outline"}
                  onClick={() => setEnergy(o.value)}
                >
                  {o.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>What you probably already have</Label>
            <p className="text-xs text-muted-foreground">Tap what's in your kitchen — we'll lean on these.</p>
            <div className="flex flex-wrap gap-2">
              {PANTRY_STAPLES.map((item) => {
                const on = pantry.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      setPantry((p) => (on ? p.filter((x) => x !== item) : [...p, item]))
                    }
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      on ? "border-primary bg-primary/10 text-foreground" : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <Button onClick={generateMeals} disabled={mealLoading} className="w-full sm:w-auto">
            {mealLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Thinking up some ideas…</> : <><Sparkles className="mr-2 h-4 w-4" /> Suggest meals</>}
          </Button>

          {meals.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {meals.map((m, i) => (
                <div key={i} className="rounded-lg border bg-muted/20 p-4 space-y-2">
                  <div className="text-sm font-semibold">{m.title}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {typeof m.time_minutes === "number" && (
                      <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{m.time_minutes} min</Badge>
                    )}
                    {m.effort && <Badge variant="outline">{m.effort}</Badge>}
                    {m.budget_note && (
                      <Badge variant="outline" className="gap-1"><Wallet className="h-3 w-3" />{m.budget_note}</Badge>
                    )}
                  </div>
                  {m.blurb && <p className="text-xs text-muted-foreground leading-relaxed">{m.blurb}</p>}
                  {Array.isArray(m.ingredients) && m.ingredients.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                      {m.ingredients.map((ing, j) => <li key={j}>{ing}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {!mealLoading && meals.length === 0 && (
            <p className="text-xs text-muted-foreground italic">
              One less thing to mentally carry. Tap "Suggest meals" when you're ready.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type Meal = {
  title: string;
  time_minutes?: number;
  effort?: string;
  budget_note?: string;
  ingredients?: string[];
  blurb?: string;
};

const ENERGY_OPTIONS: { value: "exhausted" | "normal" | "can_cook"; label: string }[] = [
  { value: "exhausted", label: "I'm exhausted 😭" },
  { value: "normal", label: "Normal energy" },
  { value: "can_cook", label: "I can cook today" },
];

const PANTRY_STAPLES = [
  "rice", "pasta", "eggs", "onions", "canned tomatoes",
  "yogurt", "bread", "lentils", "potatoes", "oats", "tuna", "frozen veg",
];

const MICROCOPY = [
  "Simple food ideas for busy student life.",
  "Affordable meals when your brain is already overloaded.",
  "Low-effort food ideas for stressful days.",
  "You don't have to figure out every meal alone.",
  "Meals that are easy on your time and budget.",
];