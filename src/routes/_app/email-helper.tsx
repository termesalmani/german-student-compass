import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/email-helper")({ component: EmailHelper });

function EmailHelper() {
  const [situation, setSituation] = useState("");
  const [recipient, setRecipient] = useState("");
  const [tone, setTone] = useState("polite and formal");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  const generate = async () => {
    if (!situation.trim()) {
      toast.error("Please describe your situation first.");
      return;
    }
    setLoading(true);
    setOutput("");
    try {
      const { data, error } = await supabase.functions.invoke("generate-german-email", {
        body: { situation, recipient, tone },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setOutput(data?.email ?? "");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate email");
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(output);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">German email helper</h1>
        <p className="text-sm text-muted-foreground">
          Describe your situation in any language. We'll draft a polite formal German email for you.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your situation</CardTitle>
            <CardDescription>The more context, the better the email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Recipient (optional)</Label>
              <Input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="e.g. Ausländerbehörde, my landlord, university office"
              />
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="polite and formal">Polite & formal</SelectItem>
                  <SelectItem value="urgent but polite">Urgent but polite</SelectItem>
                  <SelectItem value="apologetic">Apologetic</SelectItem>
                  <SelectItem value="friendly and formal">Friendly but formal</SelectItem>
                  <SelectItem value="friendly and casual">Friendly & casual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>What would help you say this clearly?</Label>
              <Textarea
                rows={8}
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                placeholder="e.g. I need to reschedule my visa appointment because my flight was cancelled..."
              />
            </div>
            <Button onClick={generate} disabled={loading} className="w-full">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate German email</>}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your German email</CardTitle>
              <CardDescription>Review carefully before sending.</CardDescription>
            </div>
            {output && (
              <Button size="sm" variant="outline" onClick={copy}>
                <Copy className="mr-2 h-4 w-4" /> Copy
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {output ? (
              <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 font-sans text-sm leading-relaxed">{output}</pre>
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Your generated email will appear here.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}