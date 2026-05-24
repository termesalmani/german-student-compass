import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTheme, ACCENTS, type AccentKey } from "@/lib/theme";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { getNotifPref, setNotifPref, getPermission, requestPermission, type NotifPermission } from "@/lib/notifications";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user } = useAuth();
  const { accent, setAccent } = useTheme();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState<boolean>(() => getNotifPref());
  const [perm, setPerm] = useState<NotifPermission>("default");

  useEffect(() => { setPerm(getPermission()); }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, notifications_enabled").eq("id", user.id).maybeSingle().then(({ data }) => {
      setName(data?.full_name ?? "");
      if (typeof data?.notifications_enabled === "boolean") {
        setNotifEnabled(data.notifications_enabled);
        setNotifPref(data.notifications_enabled);
      }
    });
  }, [user]);

  const saveName = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: name || null }).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Display name saved");
  };

  const toggleNotifications = async (next: boolean) => {
    if (next && perm !== "granted") {
      const p = await requestPermission();
      setPerm(p);
      if (p !== "granted") {
        toast.error(p === "denied" ? "Notifications are blocked in your browser settings." : "Permission not granted.");
        return;
      }
    }
    setNotifEnabled(next);
    setNotifPref(next);
    if (user) {
      const { error } = await supabase.from("profiles").update({ notifications_enabled: next }).eq("id", user.id);
      if (error) toast.error(error.message);
    }
    toast.success(next ? "Browser notifications enabled" : "Browser notifications disabled");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Personalize your German Student Compass.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>This name appears in your dashboard greeting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Terme" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <Button onClick={saveName} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</CardTitle>
          <CardDescription>Control browser notifications for upcoming reminders.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">
                {notifEnabled ? "Disable browser notifications" : "Enable browser notifications"}
              </div>
              <div className="text-xs text-muted-foreground">
                {perm === "unsupported"
                  ? "Your browser does not support notifications. In-app reminders are still active."
                  : notifEnabled && perm === "granted"
                    ? "Browser notifications are enabled."
                    : "Browser notifications are disabled. In-app reminders are still active."}
              </div>
            </div>
            <Switch
              checked={notifEnabled && perm === "granted"}
              disabled={perm === "unsupported" || perm === "denied"}
              onCheckedChange={toggleNotifications}
            />
          </div>
          {perm === "denied" && (
            <p className="text-xs text-destructive">
              Notifications are blocked at the browser level. Enable them in your browser site settings, then reload.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Choose the accent color used across buttons, highlights and active items.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(Object.keys(ACCENTS) as AccentKey[]).map((key) => {
              const a = ACCENTS[key];
              const active = key === accent;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAccent(key)}
                  className={`group flex flex-col items-center gap-2 rounded-lg border p-3 text-xs transition-colors hover:bg-muted/50 ${active ? "border-primary ring-2 ring-primary/40" : ""}`}
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: a.swatch }}
                  >
                    {active && <Check className="h-4 w-4 text-white" />}
                  </span>
                  <span className="font-medium">{a.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}