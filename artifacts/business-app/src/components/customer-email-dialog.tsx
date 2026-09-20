import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2 } from "lucide-react";

interface CustomerEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerEmail: string;
  customerName: string;
  recipientEmail?: string;
  onSent?: () => void;
}

export function CustomerEmailDialog({ open, onOpenChange, customerId, customerEmail, customerName, recipientEmail, onSent }: CustomerEmailDialogProps) {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ccAdmin, setCcAdmin] = useState(false);
  const [sending, setSending] = useState(false);

  function handleOpenChange(v: boolean) {
    if (v) {
      setSubject("");
      setBody("");
      setCcAdmin(false);
    }
    onOpenChange(v);
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Missing info", description: "Please enter a subject and message.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/customers/${customerId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ subject: subject.trim(), body: body.trim(), cc_admin: ccAdmin, recipient_email: recipientEmail || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send email");
      }
      toast({ title: "Email sent", description: `Sent to ${customerEmail}` });
      onSent?.();
      handleOpenChange(false);
    } catch (e) {
      toast({ title: "Failed to send", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" /> Send Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input value={`${customerName} <${customerEmail}>`} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject…"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-body">Message</Label>
            <Textarea
              id="email-body"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your message here…"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="cc-admin" checked={ccAdmin} onCheckedChange={(v) => setCcAdmin(v === true)} />
            <Label htmlFor="cc-admin" className="text-sm font-normal cursor-pointer">Send a copy to me</Label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
