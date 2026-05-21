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
import { AlertTriangle, HeartPulse, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
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

  // meal planner state
  const [budget, setBudget] = useState(30);
  const [diet, setDiet] = useState("no preference");
  const [cookingTime, setCookingTime] = useState(30);
  const [dislikes, setDislikes] = useState("");
  const [mealLoading, setMealLoading] = useState(false);
  const [mealIdeas, setMealIdeas] = useState("");

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
    setMealIdeas("");
    try {
      const { data, error } = await supabase.functions.invoke("generate-meal-ideas", {
        body: { budget, diet, cookingTime, dislikes },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMealIdeas(data?.ideas ?? "");
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
                  <Input value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="e.g. yearly" />
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
            <p className="text-sm text-muted-foreground">No reminders yet.</p>
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
          <CardTitle>Low-budget meal planner</CardTitle>
          <CardDescription>Simple, affordable meal ideas tailored to your week.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Weekly food budget (€)</Label>
              <Input type="number" min={5} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
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
              <Label>Cooking time (minutes per meal)</Label>
              <Input type="number" min={5} value={cookingTime} onChange={(e) => setCookingTime(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Disliked ingredients</Label>
              <Input value={dislikes} onChange={(e) => setDislikes(e.target.value)} placeholder="e.g. mushrooms, olives" />
            </div>
          </div>
          <Button onClick={generateMeals} disabled={mealLoading}>
            {mealLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate meal ideas</>}
          </Button>
          {mealIdeas && (
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 font-sans text-sm leading-relaxed">
              {mealIdeas}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}