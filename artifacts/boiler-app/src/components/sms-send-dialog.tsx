import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Loader2, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SmsSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-filled destination phone number */
  destination?: string;
  /** Optional: link the SMS to a job */
  jobId?: string;
  /** Optional: link the SMS to a customer */
  customerId?: string;
  /** Called after a message is sent successfully */
  onSent?: () => void;
}

interface SmsTemplate {
  id: string;
  name: string;
  content: string;
}

const MAX_CHARS = 160;

export function SmsSendDialog({ open, onOpenChange, destination = "", jobId, customerId, onSent }: SmsSendDialogProps) {
  const { toast } = useToast();
  const [to, setTo] = useState(destination);
  const [sender, setSender] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [defaultSender, setDefaultSender] = useState("TradeWork");

  // Fetch company settings once on mount
  useEffect(() => {
    (async () => {
      try {
        const cs = await fetch(`${import.meta.env.BASE_URL}api/admin/company-settings`, { credentials: "include" }).then(r => r.ok ? r.json() : null) as { company_name?: string; sms_sender_name?: string } | null;
        const resolved = cs?.sms_sender_name?.trim() || cs?.company_name?.slice(0, 11) || "TradeWork";
        setDefaultSender(resolved);
        setSender(prev => prev === "" || prev === "TradeWork" ? resolved : prev);
      } catch { /* ignore */ }
    })();
  }, []);

  // Fetch templates each time dialog opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const tmpl = await fetch(`${import.meta.env.BASE_URL}api/sms/templates`, { credentials: "include" }).then(r => r.ok ? r.json() : []) as SmsTemplate[];
        setTemplates(tmpl);
      } catch { /* ignore */ }
    })();
  }, [open]);

  // Reset fields when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setTo(destination);
      setSender(defaultSender);
      setContent("");
    }
    onOpenChange(v);
  };

  const handleSend = async () => {
    if (!to.trim()) {
      toast({ title: "Phone number required", variant: "destructive" });
      return;
    }
    if (!content.trim()) {
      toast({ title: "Message is empty", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/sms/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          destination: to.trim(),
          content: content.trim(),
          sender_id: sender.trim() || defaultSender,
          job_id: jobId || undefined,
          customer_id: customerId || undefined,
        }),
      });

      if (res.status === 402) {
        const { error } = await res.json() as { error: string };
        toast({ title: "Add-on required", description: error, variant: "destructive" });
        return;
      }

      if (!res.ok) {
        const { error } = await res.json() as { error?: string };
        throw new Error(error ?? "Failed to send SMS");
      }

      toast({ title: "SMS sent", description: `Message delivered to ${to.trim()}` });
      onSent?.();
      handleOpenChange(false);
    } catch (err) {
      toast({
        title: "Failed to send",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const remaining = MAX_CHARS - content.length;
  const overLimit = remaining < 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Send SMS
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="sms-to">To (phone number)</Label>
            <Input
              id="sms-to"
              type="tel"
              placeholder="07700 900000"
              value={to}
              onChange={e => setTo(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sms-sender">From (sender name, max 11 chars)</Label>
            <Input
              id="sms-sender"
              maxLength={11}
              placeholder="TradeWork"
              value={sender}
              onChange={e => setSender(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Shown as the sender on the recipient's phone.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Use a template</Label>
            {templates.length > 0 ? (
              <Select onValueChange={val => {
                const tmpl = templates.find(t => t.id === val);
                if (tmpl) setContent(tmpl.content);
              }}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Select a template…" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">No templates yet. Create them in <a href="/admin/sms-templates" className="underline">Admin → SMS</a>.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="sms-content">Message</Label>
              <span className={`text-xs ${overLimit ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                {remaining} chars remaining
              </span>
            </div>
            <Textarea
              id="sms-content"
              rows={4}
              placeholder="Type your message here…"
              value={content}
              onChange={e => setContent(e.target.value)}
              className={overLimit ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {content.length > MAX_CHARS && (
              <p className="text-xs text-destructive">Message exceeds 160 characters and will be split into multiple SMS messages.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSend} disabled={sending || !content.trim() || !to.trim()}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-2" />}
            Send SMS
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
