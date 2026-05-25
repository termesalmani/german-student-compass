import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Upload, Download, Eye, Pencil, Bell } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, differenceInDays } from "date-fns";
import { useReminderNotifier } from "@/lib/notifications";

export const Route = createFileRoute("/_app/bureaucracy")({ component: BureaucracyPage });

type Item = {
  id: string;
  category: string;
  title: string;
  status: string;
  notes: string | null;
  due_date: string | null;
  reminder_at: string | null;
  completed: boolean;
};

type FileRow = {
  id: string;
  item_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
};

const BUCKET = "bureaucracy-docs";
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

const REMINDER_OFFSETS: Record<string, number | "custom" | "none"> = {
  none: "none",
  same_day: 0,
  "1d": 1,
  "3d": 3,
  "1w": 7,
  custom: "custom",
};

const CATEGORIES = [
  { key: "visa", label: "Visa & Residence" },
  { key: "insurance", label: "Health Insurance" },
  { key: "blocked_account", label: "Blocked Account" },
  { key: "university", label: "University" },
  { key: "bank", label: "Bank Account" },
  { key: "housing", label: "Housing / Anmeldung" },
];

const STATUSES = ["todo", "in_progress", "done"];

function BureaucracyPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    category: "visa",
    title: "",
    notes: "",
    due_date: "",
    status: "todo",
    reminder_preset: "none",
    reminder_custom: "",
  });

  const load = async () => {
    const [{ data: its }, { data: fs }] = await Promise.all([
      supabase.from("bureaucracy_items").select("*").order("created_at", { ascending: false }),
      supabase.from("bureaucracy_files").select("*").order("created_at", { ascending: false }),
    ]);
    setItems((its as Item[]) ?? []);
    setFiles((fs as FileRow[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  // Build reminder list for browser notifications
  const reminderItems = items
    .filter((i) => i.reminder_at && !i.completed)
    .map((i) => ({ id: i.id, title: i.title, note: i.notes, reminder_at: i.reminder_at, completed: i.completed }));
  useReminderNotifier(reminderItems);

  const computeReminderAt = (preset: string, custom: string, dueDate: string): string | null => {
    if (preset === "none") return null;
    if (preset === "custom") return custom ? new Date(custom).toISOString() : null;
    if (!dueDate) return null;
    const offset = REMINDER_OFFSETS[preset];
    if (typeof offset !== "number") return null;
    const d = new Date(dueDate + "T09:00:00");
    d.setDate(d.getDate() - offset);
    return d.toISOString();
  };

  const save = async () => {
    if (!form.title.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const reminder_at = computeReminderAt(form.reminder_preset, form.reminder_custom, form.due_date);
    const { error } = await supabase.from("bureaucracy_items").insert({
      user_id: user.id,
      category: form.category,
      title: form.title,
      notes: form.notes || null,
      due_date: form.due_date || null,
      status: form.status,
      reminder_at,
    });
    if (error) return toast.error(error.message);
    toast.success("Item added");
    setForm({ category: "visa", title: "", notes: "", due_date: "", status: "todo", reminder_preset: "none", reminder_custom: "" });
    setOpen(false);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("bureaucracy_items").update({ status }).eq("id", id);
    load();
  };

  const toggleCompleted = async (it: Item) => {
    await supabase.from("bureaucracy_items").update({ completed: !it.completed }).eq("id", it.id);
    load();
  };

  const del = async (id: string) => {
    // Delete associated files from storage
    const itemFiles = files.filter((f) => f.item_id === id);
    if (itemFiles.length) {
      await supabase.storage.from(BUCKET).remove(itemFiles.map((f) => f.storage_path));
    }
    await supabase.from("bureaucracy_items").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bureaucracy tracker</h1>
          <p className="text-sm text-muted-foreground">Keep your important documents and deadlines together here.</p>
        </div>
        <div className="flex items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New item</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add bureaucracy item</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Submit visa extension" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Due date</Label>
                  <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Reminder</Label>
                  <Select value={form.reminder_preset} onValueChange={(v) => setForm({ ...form, reminder_preset: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No reminder</SelectItem>
                      <SelectItem value="same_day">Same day</SelectItem>
                      <SelectItem value="1d">1 day before</SelectItem>
                      <SelectItem value="3d">3 days before</SelectItem>
                      <SelectItem value="1w">1 week before</SelectItem>
                      <SelectItem value="custom">Custom date/time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.reminder_preset === "custom" && (
                  <div className="space-y-2">
                    <Label>Custom time</Label>
                    <Input type="datetime-local" value={form.reminder_custom} onChange={(e) => setForm({ ...form, reminder_custom: e.target.value })} />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
              </div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const catItems = items.filter((i) => i.category === cat.key);
          return (
            <Card key={cat.key}>
              <CardHeader>
                <CardTitle className="text-base">{cat.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {catItems.length === 0 && (
                  <p className="text-xs text-muted-foreground">Start with the thing that stresses you out the most.</p>
                )}
                {catItems.map((it) => (
                  <ItemCard
                    key={it.id}
                    item={it}
                    files={files.filter((f) => f.item_id === it.id)}
                    onStatus={(v) => updateStatus(it.id, v)}
                    onToggle={() => toggleCompleted(it)}
                    onDelete={() => del(it.id)}
                    onChanged={load}
                  />
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ItemCard({
  item, files, onStatus, onToggle, onDelete, onChanged,
}: {
  item: Item;
  files: FileRow[];
  onStatus: (v: string) => void;
  onToggle: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingReminder, setEditingReminder] = useState(false);
  const [reminderInput, setReminderInput] = useState(
    item.reminder_at ? new Date(item.reminder_at).toISOString().slice(0, 16) : "",
  );

  const daysLeft = item.due_date ? differenceInDays(parseISO(item.due_date), new Date()) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0 && !item.completed;
  const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 && !item.completed;

  const urgencyClass = item.completed
    ? "opacity-60"
    : isOverdue
      ? "border-destructive/60 bg-destructive/5"
      : isUrgent
        ? "border-amber-500/60 bg-amber-500/5"
        : "";

  const saveReminder = async () => {
    const iso = reminderInput ? new Date(reminderInput).toISOString() : null;
    const { error } = await supabase.from("bureaucracy_items").update({ reminder_at: iso }).eq("id", item.id);
    if (error) return toast.error(error.message);
    toast.success(iso ? "Reminder set" : "Reminder cleared");
    setEditingReminder(false);
    onChanged();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error("Only PDF, JPG, PNG allowed");
      return;
    }
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${user.id}/${item.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { error: dbErr } = await supabase.from("bureaucracy_files").insert({
      user_id: user.id,
      item_id: item.id,
      file_name: file.name,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
    });
    setUploading(false);
    if (dbErr) return toast.error(dbErr.message);
    toast.success("File uploaded");
    onChanged();
  };

  const preview = async (f: FileRow) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 60 * 5);
    if (error || !data) return toast.error(error?.message ?? "Failed");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const download = async (f: FileRow) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 60, { download: f.file_name });
    if (error || !data) return toast.error(error?.message ?? "Failed");
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = f.file_name;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const rename = async (f: FileRow) => {
    const next = window.prompt("New file name", f.file_name);
    if (!next || next === f.file_name) return;
    const { error } = await supabase.from("bureaucracy_files").update({ file_name: next }).eq("id", f.id);
    if (error) return toast.error(error.message);
    onChanged();
  };

  const removeFile = async (f: FileRow) => {
    if (!window.confirm(`Delete ${f.file_name}?`)) return;
    await supabase.storage.from(BUCKET).remove([f.storage_path]);
    await supabase.from("bureaucracy_files").delete().eq("id", f.id);
    onChanged();
  };

  return (
    <div className={`rounded-md border p-3 ${urgencyClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Checkbox checked={item.completed} onCheckedChange={onToggle} className="mt-0.5" />
          <div className="min-w-0">
            <div className={`truncate text-sm font-medium ${item.completed ? "line-through" : ""}`}>{item.title}</div>
            {item.due_date && (
              <div className="text-xs text-muted-foreground">
                Due {format(parseISO(item.due_date), "PP")}
                {daysLeft !== null && !item.completed && (
                  <span className={isOverdue ? " text-destructive font-medium" : isUrgent ? " text-amber-600 font-medium" : ""}>
                    {" "}· {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? "today" : `${daysLeft}d left`}
                  </span>
                )}
              </div>
            )}
            {item.reminder_at && (
              <div className="text-xs text-muted-foreground">Remind {format(parseISO(item.reminder_at), "PPp")}</div>
            )}
            {item.notes && <div className="mt-1 text-xs text-muted-foreground">{item.notes}</div>}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant={item.status === "done" ? "secondary" : item.status === "in_progress" ? "default" : "outline"}>
          {item.status.replace("_", " ")}
        </Badge>
        {isOverdue && <Badge variant="destructive">overdue</Badge>}
        {isUrgent && <Badge className="bg-amber-500 text-white hover:bg-amber-500/90">due soon</Badge>}
        <Select value={item.status} onValueChange={onStatus}>
          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditingReminder((s) => !s)}>
          <Bell className="mr-1 h-3 w-3" /> {item.reminder_at ? "Edit reminder" : "Add reminder"}
        </Button>
      </div>

      {editingReminder && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded border bg-muted/30 p-2">
          <Input
            type="datetime-local"
            value={reminderInput}
            onChange={(e) => setReminderInput(e.target.value)}
            className="h-8 max-w-[14rem] text-xs"
          />
          <Button size="sm" className="h-7" onClick={saveReminder}>Save</Button>
          {item.reminder_at && (
            <Button size="sm" variant="ghost" className="h-7" onClick={() => { setReminderInput(""); saveReminder(); }}>
              Clear
            </Button>
          )}
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        {files.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-2 rounded border bg-muted/30 px-2 py-1.5">
            <div className="min-w-0 truncate text-xs">{f.file_name}</div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => preview(f)} title="Preview"><Eye className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => download(f)} title="Download"><Download className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => rename(f)} title="Rename"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFile(f)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-full text-xs"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="mr-1 h-3 w-3" /> {uploading ? "Uploading..." : "Upload PDF / JPG / PNG"}
        </Button>
      </div>
    </div>
  );
}