import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, CalendarDays, ListTodo, Briefcase, FileText } from "lucide-react";
import { format, isPast, parseISO, differenceInDays } from "date-fns";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_app/")({ component: Dashboard });

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  completed: boolean;
  category: string;
};

function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bureaucracyCount, setBureaucracyCount] = useState(0);
  const [jobsByStatus, setJobsByStatus] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("general");

  const load = async () => {
    const [{ data: t }, { count: bCount }, { data: jobs }] = await Promise.all([
      supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("bureaucracy_items").select("*", { count: "exact", head: true }),
      supabase.from("job_applications").select("status"),
    ]);
    setTasks((t as Task[]) ?? []);
    setBureaucracyCount(bCount ?? 0);
    const counts: Record<string, number> = {};
    (jobs ?? []).forEach((j: any) => (counts[j.status] = (counts[j.status] ?? 0) + 1));
    setJobsByStatus(counts);
  };

  useEffect(() => {
    load();
  }, []);

  const addTask = async () => {
    if (!title.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      title,
      due_date: dueDate || null,
      priority,
      category,
    });
    if (error) return toast.error(error.message);
    toast.success("Task added");
    setTitle("");
    setDueDate("");
    setPriority("medium");
    setCategory("general");
    setOpen(false);
    load();
  };

  const toggleTask = async (task: Task) => {
    const { error } = await supabase.from("tasks").update({ completed: !task.completed }).eq("id", task.id);
    if (error) return toast.error(error.message);
    load();
  };

  const deleteTask = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    load();
  };

  const upcoming = useMemo(
    () => tasks.filter((t) => !t.completed).slice(0, 8),
    [tasks],
  );

  const chartData = useMemo(() => {
    const statuses = ["applied", "interview", "offer", "rejected"];
    return statuses.map((s) => ({ status: s, count: jobsByStatus[s] ?? 0 }));
  }, [jobsByStatus]);

  const openTasks = tasks.filter((t) => !t.completed).length;
  const overdue = tasks.filter(
    (t) => !t.completed && t.due_date && isPast(parseISO(t.due_date)),
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your German student life at a glance.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New task</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add a task</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Anmeldung appointment" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Due date</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="visa">Visa</SelectItem>
                    <SelectItem value="university">University</SelectItem>
                    <SelectItem value="housing">Housing</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="jobs">Jobs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={addTask}>Add task</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={<ListTodo className="h-4 w-4" />} label="Open tasks" value={openTasks} />
        <StatCard icon={<CalendarDays className="h-4 w-4" />} label="Overdue" value={overdue} accent="destructive" />
        <StatCard icon={<FileText className="h-4 w-4" />} label="Bureaucracy items" value={bureaucracyCount} />
        <StatCard icon={<Briefcase className="h-4 w-4" />} label="Job applications" value={Object.values(jobsByStatus).reduce((a, b) => a + b, 0)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming deadlines</CardTitle>
            <CardDescription>Stay ahead of important dates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing pending. Add a task to begin.</p>
            )}
            {upcoming.map((t) => {
              const daysLeft = t.due_date ? differenceInDays(parseISO(t.due_date), new Date()) : null;
              return (
                <div key={t.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-start gap-3">
                    <Checkbox checked={t.completed} onCheckedChange={() => toggleTask(t)} />
                    <div>
                      <div className="text-sm font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.due_date ? format(parseISO(t.due_date), "PPP") : "No due date"}
                        {daysLeft !== null && (
                          <span className={daysLeft < 0 ? " text-destructive" : ""}>
                            {" "}· {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={t.priority === "high" ? "destructive" : t.priority === "low" ? "secondary" : "default"}>
                      {t.priority}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => deleteTask(t.id)}>Remove</Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Job applications</CardTitle>
            <CardDescription>By current status.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="status" stroke="currentColor" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="currentColor" fontSize={12} />
                  <ReTooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: "destructive";
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`mt-1 text-2xl font-semibold ${accent === "destructive" ? "text-destructive" : ""}`}>
            {value}
          </div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}