import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { SectionIntro } from "@/components/section-intro";

export const Route = createFileRoute("/_app/jobs")({ component: JobsPage });

type Job = {
  id: string;
  company: string;
  job_title: string;
  application_date: string;
  status: string;
  notes: string | null;
  job_link: string | null;
  rejection_reason: string | null;
};

const STATUSES = ["applied", "interview", "offer", "rejected"];

function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [open, setOpen] = useState(false);
  const [reasonDrafts, setReasonDrafts] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    company: "",
    job_title: "",
    application_date: new Date().toISOString().slice(0, 10),
    status: "applied",
    notes: "",
    job_link: "",
  });

  const load = async () => {
    const { data } = await supabase
      .from("job_applications")
      .select("*")
      .order("application_date", { ascending: false });
    const list = (data as Job[]) ?? [];
    setJobs(list);
    setReasonDrafts(
      Object.fromEntries(list.map((j) => [j.id, j.rejection_reason ?? ""])),
    );
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.company.trim() || !form.job_title.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("job_applications").insert({
      user_id: user.id,
      company: form.company,
      job_title: form.job_title,
      application_date: form.application_date,
      status: form.status,
      notes: form.notes || null,
      job_link: form.job_link || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Application added");
    setForm({
      company: "",
      job_title: "",
      application_date: new Date().toISOString().slice(0, 10),
      status: "applied",
      notes: "",
      job_link: "",
    });
    setOpen(false);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("job_applications").update({ status }).eq("id", id);
    load();
  };

  const saveReason = async (id: string) => {
    const reason = reasonDrafts[id] ?? "";
    const { error } = await supabase
      .from("job_applications")
      .update({ rejection_reason: reason || null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Rejection note saved");
    load();
  };

  const del = async (id: string) => {
    await supabase.from("job_applications").delete().eq("id", id);
    load();
  };

  const statusColor = (s: string) =>
    s === "offer" ? "default" : s === "rejected" ? "destructive" : s === "interview" ? "secondary" : "outline";

  return (
    <div className="space-y-6">
      <SectionIntro section="jobs" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Job applications</h1>
          <p className="text-sm text-muted-foreground">Track every application you've sent.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New application</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add job application</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Job title</Label>
                  <Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Application date</Label>
                  <Input type="date" value={form.application_date} onChange={(e) => setForm({ ...form, application_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Job link</Label>
                <Input value={form.job_link} onChange={(e) => setForm({ ...form, job_link: e.target.value })} placeholder="https://..." />
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Link</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">Nothing here yet. Add the first application when you're ready.</TableCell></TableRow>
              )}
              {jobs.map((j) => (
                <Fragment key={j.id}>
                <TableRow>
                  <TableCell className="font-medium">{j.company}</TableCell>
                  <TableCell>
                    <div>{j.job_title}</div>
                    {j.notes && <div className="text-xs text-muted-foreground">{j.notes}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{format(parseISO(j.application_date), "PP")}</TableCell>
                  <TableCell>
                    <Select value={j.status} onValueChange={(v) => updateStatus(j.id, v)}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="mt-1">
                      <Badge variant={statusColor(j.status) as any}>{j.status}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {j.job_link ? (
                      <a href={j.job_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => del(j.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
                {j.status === "rejected" && (
                  <TableRow className="bg-destructive/5">
                    <TableCell colSpan={6}>
                      <div className="space-y-2 p-1">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                          Rejection reason / feedback
                        </Label>
                        <Textarea
                          rows={2}
                          placeholder="What feedback or reason did you receive? Anything to remember for next time?"
                          value={reasonDrafts[j.id] ?? ""}
                          onChange={(e) =>
                            setReasonDrafts({ ...reasonDrafts, [j.id]: e.target.value })
                          }
                        />
                        <div className="flex justify-end">
                          <Button size="sm" variant="outline" onClick={() => saveReason(j.id)}>
                            Save
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}