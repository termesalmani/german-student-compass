import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useReminderNotifier } from "@/lib/notifications";
import { pickReminderMicrocopy } from "@/lib/reminder-microcopy";
import { useMemo } from "react";

export const Route = createFileRoute("/_app/reminders")({ component: RemindersPage });

type Reminder = {
  id: string;
  title: string;
  note: string | null;
  due_date: string | null;
  reminder_at: string | null;
  repeat_frequency: string;
  completed: boolean;
  source_type: string;
};

function RemindersPage() {
  const tagline = useMemo(() => pickReminderMicrocopy(), []);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reminders</h1>
        <p className="text-sm text-muted-foreground">{tagline}</p>
      </div>
      <RemindersManager />
    </div>
  );
}

export function RemindersManager() {
  const [items, setItems] = useState<Reminder[]>([]);
  const [open, setOpen] = useState(false);
  const emptyCopy = useMemo(() => pickReminderMicrocopy(), []);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [frequency, setFrequency] = useState("none");
  const [sourceType, setSourceType] = useState("custom");

  const load = async () => {
    const { data } = await supabase
      .from("reminders")
      .select("*")
      .order("reminder_at", { ascending: true, nullsFirst: false });
    setItems((data as Reminder[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  useReminderNotifier(items);

  const add = async () => {
    if (!title.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("reminders").insert({
      user_id: user.id,
      title,
      note: note || null,
      due_date: dueDate || null,
      reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
      repeat_frequency: frequency,
      source_type: sourceType,
    });
    if (error) return toast.error(error.message);
    toast.success("Reminder created");
    setTitle(""); setNote(""); setDueDate(""); setReminderAt(""); setFrequency("none"); setSourceType("custom");
    setOpen(false);
    load();
  };

  const toggle = async (r: Reminder) => {
    await supabase.from("reminders").update({ completed: !r.completed }).eq("id", r.id);
    load();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this reminder?")) return;
    await supabase.from("reminders").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New reminder</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New reminder</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Visa appointment at Ausländerbehörde" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Due date</Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Remind me at</Label>
                    <Input type="datetime-local" value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Repeat</Label>
                    <Select value={frequency} onValueChange={setFrequency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={sourceType} onValueChange={setSourceType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Custom</SelectItem>
                        <SelectItem value="task">Task / deadline</SelectItem>
                        <SelectItem value="visa">Visa appointment</SelectItem>
                        <SelectItem value="health">Health checkup</SelectItem>
                        <SelectItem value="job">Job application</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Note</Label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional details" />
                </div>
                {sourceType === "health" && (
                  <p className="text-xs text-muted-foreground">
                    Health reminders are organizational only — not medical advice. For medical concerns, consult a doctor.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button onClick={add}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All reminders</CardTitle>
          <CardDescription>In-app reminders work even when browser notifications are off.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">{emptyCopy} Add one when you're ready.</p>
          )}
          {items.map((r) => (
            <div key={r.id} className={`flex items-start justify-between gap-3 rounded-md border p-3 ${r.completed ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                <Checkbox checked={r.completed} onCheckedChange={() => toggle(r)} />
                <div>
                  <div className={`text-sm font-medium ${r.completed ? "line-through" : ""}`}>{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.reminder_at ? `Remind ${format(parseISO(r.reminder_at), "PPp")}` : "No reminder time"}
                    {r.due_date && ` · Due ${format(parseISO(r.due_date), "PPP")}`}
                    {r.repeat_frequency !== "none" && ` · Repeats ${r.repeat_frequency}`}
                  </div>
                  {r.note && <div className="mt-1 text-xs text-muted-foreground">{r.note}</div>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{r.source_type}</Badge>
                <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
