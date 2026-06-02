import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Eye, Download, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

const BUCKET = "bureaucracy-docs";

const CATEGORY_LABELS: Record<string, string> = {
  visa: "Visa & Residence",
  insurance: "Health Insurance",
  blocked_account: "Blocked Account",
  university: "University",
  bank: "Bank Account",
  housing: "Housing / Anmeldung",
};

type FileRow = {
  id: string;
  item_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

type ItemRow = { id: string; title: string; category: string };

function formatSize(bytes: number | null) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortType(mime: string | null) {
  if (!mime) return "file";
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return mime.replace("image/", "").toUpperCase();
  return mime.split("/").pop()?.toUpperCase() ?? "FILE";
}

export function FilesManager() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<
    | { kind: "single"; file: FileRow }
    | { kind: "bulk" }
    | { kind: "all" }
    | null
  >(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: fs }, { data: its }] = await Promise.all([
      supabase
        .from("bureaucracy_files")
        .select("id,item_id,file_name,storage_path,mime_type,size_bytes,created_at")
        .order("created_at", { ascending: false }),
      supabase.from("bureaucracy_items").select("id,title,category"),
    ]);
    setFiles((fs as FileRow[]) ?? []);
    setItems((its as ItemRow[]) ?? []);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const allChecked = files.length > 0 && selected.size === files.length;
  const someChecked = selected.size > 0 && selected.size < files.length;

  const toggleAll = (v: boolean) => {
    setSelected(v ? new Set(files.map((f) => f.id)) : new Set());
  };

  const toggleOne = (id: string, v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const preview = async (f: FileRow) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(f.storage_path, 60 * 5);
    if (error || !data) return toast.error(error?.message ?? "Couldn't open file");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const download = async (f: FileRow) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(f.storage_path, 60, { download: f.file_name });
    if (error || !data) return toast.error(error?.message ?? "Couldn't download");
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = f.file_name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const performDelete = async (rows: FileRow[]) => {
    if (rows.length === 0) return;
    setBusy(true);
    const paths = rows.map((r) => r.storage_path);
    const ids = rows.map((r) => r.id);
    const { error: stErr } = await supabase.storage.from(BUCKET).remove(paths);
    if (stErr) {
      // continue — DB row removal still useful
      console.warn(stErr.message);
    }
    const { error } = await supabase.from("bureaucracy_files").delete().in("id", ids);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(rows.length === 1 ? "File deleted" : `${rows.length} files deleted`);
    setConfirm(null);
    load();
  };

  const onConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "single") return performDelete([confirm.file]);
    if (confirm.kind === "bulk") return performDelete(files.filter((f) => selected.has(f.id)));
    if (confirm.kind === "all") return performDelete(files);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Your uploaded files are private to your account. You can delete them anytime.
      </p>

      {files.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={allChecked ? true : someChecked ? "indeterminate" : false}
              onCheckedChange={(v) => toggleAll(Boolean(v))}
            />
            <span className="text-muted-foreground">
              {selected.size > 0 ? `${selected.size} selected` : `Select all (${files.length})`}
            </span>
          </label>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={selected.size === 0}
              onClick={() => setConfirm({ kind: "bulk" })}
            >
              <Trash2 className="mr-1 h-3 w-3" /> Delete selected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => setConfirm({ kind: "all" })}
            >
              Delete all
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-md border p-6 text-center text-xs text-muted-foreground">
          Loading your files…
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
          No files yet. Uploading documents is optional — add them only if it helps you stay organized.
        </div>
      ) : (
        <div className="divide-y rounded-md border">
          {files.map((f) => {
            const item = itemMap.get(f.item_id);
            const checked = selected.has(f.id);
            return (
              <div
                key={f.id}
                className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/30"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => toggleOne(f.id, Boolean(v))}
                />
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{f.file_name}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    {item && (
                      <>
                        <Badge variant="outline" className="h-4 px-1.5 text-[10px] font-normal">
                          {CATEGORY_LABELS[item.category] ?? item.category}
                        </Badge>
                        <span className="truncate">{item.title}</span>
                        <span>·</span>
                      </>
                    )}
                    <span>{shortType(f.mime_type)}</span>
                    <span>·</span>
                    <span>{formatSize(f.size_bytes)}</span>
                    <span>·</span>
                    <span>{format(parseISO(f.created_at), "PP")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => preview(f)}
                    title="View"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => download(f)}
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:text-destructive"
                    onClick={() => setConfirm({ kind: "single", file: f })}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "single"
                ? "Delete this file?"
                : confirm?.kind === "all"
                  ? "Delete all uploaded files?"
                  : "Delete selected files?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "single"
                ? `Are you sure you want to delete "${confirm.file.file_name}"? This action can't be undone.`
                : confirm?.kind === "all"
                  ? `This will permanently remove all ${files.length} uploaded file${files.length === 1 ? "" : "s"}. This action can't be undone.`
                  : `Are you sure you want to delete these ${selected.size} file${selected.size === 1 ? "" : "s"}? This action can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}