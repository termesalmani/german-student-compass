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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, CalendarDays, ListTodo, Briefcase, FileText, Trash2, GripVertical } from "lucide-react";
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
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useReminderNotifier } from "@/lib/notifications";
import { pickReminderMicrocopy } from "@/lib/reminder-microcopy";
import { useAuth } from "@/lib/auth";
import { RemindersManager } from "./reminders";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { Link } from "@tanstack/react-router";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, LayoutDashboard, FileText as FileTextIcon, Briefcase as BriefcaseIcon, Mail, HeartPulse, Settings as SettingsIcon, Check } from "lucide-react";
import { SectionIntro } from "@/components/section-intro";
import { EXPLORATION_KEYS, SECTION_INTROS, useVisitedSections, type SectionKey } from "@/lib/section-intros";

export const Route = createFileRoute("/_app/")({ component: Dashboard });

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  completed: boolean;
  category: string;
  sort_order: number;
};

type Reminder = {
  id: string;
  title: string;
  note: string | null;
  reminder_at: string | null;
  due_date: string | null;
  completed: boolean;
  source_type: string;
};

function Dashboard() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bureaucracyCount, setBureaucracyCount] = useState(0);
  const [jobsByStatus, setJobsByStatus] = useState<Record<string, number>>({});
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const reminderEmptyCopy = useMemo(() => pickReminderMicrocopy(), []);
  const visitedSections = useVisitedSections();

  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("general");

  const load = async () => {
    const [{ data: t }, { count: bCount }, { data: jobs }, { data: rem }, { data: bureauRem }, { data: healthRem }] = await Promise.all([
      supabase.from("tasks").select("*").order("sort_order", { ascending: true }).order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("bureaucracy_items").select("*", { count: "exact", head: true }),
      supabase.from("job_applications").select("status"),
      supabase.from("reminders").select("*").eq("completed", false).order("reminder_at", { ascending: true, nullsFirst: false }),
      supabase.from("bureaucracy_items").select("id,title,reminder_at,due_date,completed,category").eq("completed", false).not("reminder_at", "is", null).order("reminder_at", { ascending: true }),
      supabase.from("health_reminders").select("id,title,due_date,category,completed").eq("completed", false).not("due_date", "is", null).order("due_date", { ascending: true }),
    ]);
    setTasks((t as Task[]) ?? []);
    setBureaucracyCount(bCount ?? 0);
    const counts: Record<string, number> = {};
    (jobs ?? []).forEach((j: any) => (counts[j.status] = (counts[j.status] ?? 0) + 1));
    setJobsByStatus(counts);
    const merged: Reminder[] = [
      ...((rem as Reminder[]) ?? []),
      ...((bureauRem ?? []) as any[]).map((b) => ({
        id: `b_${b.id}`,
        title: b.title,
        note: null,
        reminder_at: b.reminder_at,
        due_date: b.due_date,
        completed: b.completed,
        source_type: `bureaucracy: ${b.category}`,
      })),
      ...((healthRem ?? []) as any[]).map((h) => ({
        id: `h_${h.id}`,
        title: h.title,
        note: null,
        reminder_at: null,
        due_date: h.due_date,
        completed: h.completed,
        source_type: `health: ${h.category}`,
      })),
    ].sort((a, b) => {
      const ta = a.reminder_at ? new Date(a.reminder_at).getTime() : a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const tb = b.reminder_at ? new Date(b.reminder_at).getTime() : b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return ta - tb;
    });
    setReminders(merged);
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("onboarding:done", handler);
    return () => window.removeEventListener("onboarding:done", handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle().then(({ data }) => {
      const n = (data?.full_name ?? "").trim();
      // Don't show email as a name — handle_new_user falls back to email
      setDisplayName(n && !n.includes("@") ? n : null);
    });
  }, [user]);

  useReminderNotifier(reminders);

  const SECTION_META: Record<SectionKey, { to: string; icon: React.ReactNode }> = {
    dashboard: { to: "/", icon: <LayoutDashboard className="h-4 w-4" /> },
    bureaucracy: { to: "/bureaucracy", icon: <FileTextIcon className="h-4 w-4" /> },
    jobs: { to: "/jobs", icon: <BriefcaseIcon className="h-4 w-4" /> },
    "email-helper": { to: "/email-helper", icon: <Mail className="h-4 w-4" /> },
    assistant: { to: "/assistant", icon: <LayoutDashboard className="h-4 w-4" /> },
    health: { to: "/health", icon: <HeartPulse className="h-4 w-4" /> },
    settings: { to: "/settings", icon: <SettingsIcon className="h-4 w-4" /> },
  };

  const exploreSteps = EXPLORATION_KEYS.map((key) => ({
    key,
    done: visitedSections.includes(key),
    label: `Explore ${SECTION_INTROS[key].title}`,
    to: SECTION_META[key].to,
    icon: SECTION_META[key].icon,
  }));
  const completedSetup = exploreSteps.filter((s) => s.done).length;
  const totalSetup = exploreSteps.length;
  const setupPct = Math.round((completedSetup / totalSetup) * 100);
  const remainingSteps = exploreSteps.filter((s) => !s.done);

  const addTask = async () => {
    if (!title.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const nextOrder = (tasks[tasks.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      title,
      due_date: dueDate || null,
      priority,
      category,
      sort_order: nextOrder,
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
    toast.success("Task deleted");
    load();
  };

  const openTasksList = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const completedTasksList = useMemo(() => tasks.filter((t) => t.completed), [tasks]);

  const chartData = useMemo(() => {
    const statuses = ["applied", "interview", "offer", "rejected"];
    return statuses.map((s) => ({ status: s, count: jobsByStatus[s] ?? 0 }));
  }, [jobsByStatus]);

  const openTasks = openTasksList.length;
  const overdue = tasks.filter(
    (t) => !t.completed && t.due_date && isPast(parseISO(t.due_date)),
  ).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = openTasksList.findIndex((t) => t.id === active.id);
    const newIndex = openTasksList.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(openTasksList, oldIndex, newIndex);
    // Optimistic update
    const newTasksAll = [...reordered, ...completedTasksList].map((t, i) => ({ ...t, sort_order: i }));
    setTasks(newTasksAll);
    // Persist
    await Promise.all(
      reordered.map((t, i) =>
        supabase.from("tasks").update({ sort_order: i }).eq("id", t.id),
      ),
    );
  };

  return (
    <div className="space-y-8">
      <SectionIntro section="dashboard" />
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-background to-background p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-primary">Dashboard</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Welcome back{displayName ? `, ${displayName}` : ""} <span aria-hidden>👋</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">A calmer view of your German student life.</p>
          </div>
        <div className="flex items-center gap-2">
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
      </div>
      </div>

      {remainingSteps.length > 0 && (
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Let me show you around</CardTitle>
                <CardDescription>
                  Take a look at each section whenever you're curious — no pressure to fill anything in.
                </CardDescription>
              </div>
              <div className="min-w-[180px]">
                <div className="text-xs text-muted-foreground">Explored {completedSetup} of {totalSetup} sections</div>
                <Progress value={setupPct} className="mt-1 h-1.5" />
                <div className="mt-1 text-xs text-muted-foreground/80">Exploring counts. Filling things in is optional.</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {remainingSteps.slice(0, 4).map((s) => {
              const inner = (
                <div className="flex w-full items-center justify-between rounded-md border bg-card p-3 text-sm transition-colors hover:border-primary/60 hover:bg-primary/5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      {s.icon}
                    </span>
                    <span className="font-medium">{s.label}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              );
              return (
                <Link key={s.key} to={s.to}>{inner}</Link>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={<ListTodo className="h-4 w-4" />} label="Open tasks" value={openTasks} />
        <StatCard icon={<CalendarDays className="h-4 w-4" />} label="Overdue" value={overdue} accent="destructive" />
        <StatCard icon={<FileText className="h-4 w-4" />} label="Bureaucracy items" value={bureaucracyCount} />
        <StatCard icon={<Briefcase className="h-4 w-4" />} label="Job applications" value={Object.values(jobsByStatus).reduce((a, b) => a + b, 0)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Tasks & deadlines</CardTitle>
                <CardDescription>One step at a time. Drag to reorder.</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowCompleted((s) => !s)}>
                {showCompleted ? "Hide" : "Show"} completed ({completedTasksList.length})
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {openTasksList.length === 0 && (
              <p className="text-sm text-muted-foreground">One step at a time. Add what matters first.</p>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={openTasksList.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {openTasksList.map((t) => (
                  <SortableTaskRow key={t.id} task={t} onToggle={toggleTask} onDelete={deleteTask} />
                ))}
              </SortableContext>
            </DndContext>

            {showCompleted && completedTasksList.length > 0 && (
              <div className="pt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Completed</div>
                {completedTasksList.map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={toggleTask} onDelete={deleteTask} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Things worth keeping in sight</CardTitle>
                  <CardDescription>Visa, health, jobs, and anything you'd rather not forget.</CardDescription>
                </div>
                <Dialog open={manageOpen} onOpenChange={setManageOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">Manage reminders</Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
                    <DialogHeader><DialogTitle>Manage reminders</DialogTitle></DialogHeader>
                    <RemindersManager />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {reminders.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing on the horizon. {reminderEmptyCopy}</p>
              )}
              {reminders.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-start justify-between rounded-md border p-3">
                  <div>
                    <div className="text-sm font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.reminder_at ? format(parseISO(r.reminder_at), "PPp") : r.due_date ? `Due ${format(parseISO(r.due_date), "PPP")}` : "No time set"}
                    </div>
                  </div>
                  <Badge variant="secondary">{r.source_type}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Job applications</CardTitle>
              <CardDescription>By current status.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-48">
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
      <footer className="mt-10 pb-4 text-center text-xs tracking-wide text-muted-foreground/60">
        Designed with care ♡
      </footer>
      <OnboardingFlow />
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
  dragHandle,
}: {
  task: Task;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
  dragHandle?: React.ReactNode;
}) {
  const daysLeft = task.due_date ? differenceInDays(parseISO(task.due_date), new Date()) : null;
  return (
    <div className={`flex items-center justify-between rounded-md border p-3 ${task.completed ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        {dragHandle}
        <Checkbox checked={task.completed} onCheckedChange={() => onToggle(task)} />
        <div>
          <div className={`text-sm font-medium ${task.completed ? "line-through" : ""}`}>{task.title}</div>
          <div className="text-xs text-muted-foreground">
            {task.due_date ? format(parseISO(task.due_date), "PPP") : "No due date"}
            {daysLeft !== null && !task.completed && (
              <span className={daysLeft < 0 ? " text-destructive" : ""}>
                {" "}· {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={task.priority === "high" ? "destructive" : task.priority === "low" ? "secondary" : "default"}>
          {task.priority}
        </Badge>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Delete task">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this task?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(task.id)}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function SortableTaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <TaskRow
        task={task}
        onToggle={onToggle}
        onDelete={onDelete}
        dragHandle={
          <button
            type="button"
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        }
      />
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
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className={`mt-2 text-3xl font-semibold tracking-tight ${accent === "destructive" ? "text-destructive" : ""}`}>
            {value}
          </div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accent === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}