import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/_app/bureaucracy")({ component: BureaucracyPage });

type Item = {
  id: string;
  category: string;
  title: string;
  status: string;
  notes: string | null;
  due_date: string | null;
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
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: "visa", title: "", notes: "", due_date: "", status: "todo" });

  const load = async () => {
    const { data } = await supabase
      .from("bureaucracy_items")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as Item[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("bureaucracy_items").insert({
      user_id: user.id,
      category: form.category,
      title: form.title,
      notes: form.notes || null,
      due_date: form.due_date || null,
      status: form.status,
    });
    if (error) return toast.error(error.message);
    toast.success("Item added");
    setForm({ category: "visa", title: "", notes: "", due_date: "", status: "todo" });
    setOpen(false);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("bureaucracy_items").update({ status }).eq("id", id);
    load();
  };

  const del = async (id: string) => {
    await supabase.from("bureaucracy_items").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bureaucracy tracker</h1>
          <p className="text-sm text-muted-foreground">Visa, insurance, blocked account, university, bank, housing.</p>
        </div>
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
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
              </div>
            </div>
            <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => {
          const catItems = items.filter((i) => i.category === cat.key);
          return (
            <Card key={cat.key}>
              <CardHeader>
                <CardTitle className="text-base">{cat.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {catItems.length === 0 && (
                  <p className="text-xs text-muted-foreground">No items yet.</p>
                )}
                {catItems.map((it) => (
                  <div key={it.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{it.title}</div>
                        {it.due_date && (
                          <div className="text-xs text-muted-foreground">Due {format(parseISO(it.due_date), "PP")}</div>
                        )}
                        {it.notes && <div className="mt-1 text-xs text-muted-foreground">{it.notes}</div>}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => del(it.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant={it.status === "done" ? "secondary" : it.status === "in_progress" ? "default" : "outline"}>
                        {it.status.replace("_", " ")}
                      </Badge>
                      <Select value={it.status} onValueChange={(v) => updateStatus(it.id, v)}>
                        <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}