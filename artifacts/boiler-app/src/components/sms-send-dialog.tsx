import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Loader2 } from "lucide-react";

interface SmsSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-filled destination phone number */
  destination?: string;
  /** Optional: link the SMS to a job */
  jobId?: string;
  /** Optional: link the SMS to a customer */
  customerId?: string;
}

const MAX_CHARS = 160;
const DEFAULT_SENDER = "TradeWork";

export function SmsSendDialog({ open, onOpenChange, destination = "", jobId, customerId }: SmsSendDialogProps) {
  const { toast } = useToast();
  const [to, setTo] = useState(destination);
  const [sender, setSender] = useState(DEFAULT_SENDER);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  // Reset fields when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setTo(destination);
      setSender(DEFAULT_SENDER);
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
          sender_id: sender.trim() || DEFAULT_SENDER,
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
            <div className="flex justify-between items-center">
              <Label htmlFor="sms-content">Message</Label>
              <span className={`text-xs ${overLimit ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                {remaining} chars remaining
              </span>
            </div>
            <Textarea
              id="sms-content"
              rows={4}
              placeholder="Type your message here..."
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
