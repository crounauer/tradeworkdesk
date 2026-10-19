import { useId, type ReactNode } from "react";
import { Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface EmailConfirmationPanelProps {
  customerName?: string;
  customerEmail?: string | null;
  message?: string;
  sending: boolean;
  sendDisabled?: boolean;
  ccAdmin: boolean;
  onCcAdminChange: (checked: boolean) => void;
  onSend: () => void;
  onSkip: () => void;
  skipLabel?: string;
  children?: ReactNode;
}

export function EmailConfirmationPanel({
  customerName,
  customerEmail,
  message = "Would you like to send a booking confirmation email to the customer?",
  sending,
  sendDisabled = false,
  ccAdmin,
  onCcAdminChange,
  onSend,
  onSkip,
  skipLabel = "Skip",
  children,
}: EmailConfirmationPanelProps) {
  const ccId = useId();

  return (
    <div className="min-w-0 space-y-4 py-2 [overflow-wrap:anywhere]">
      <div className="flex items-start gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Mail className="mt-0.5 h-8 w-8 shrink-0 text-blue-600" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{message}</p>
          {(customerName || customerEmail) && (
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {customerName && <p><strong>To:</strong> {customerName}</p>}
              {customerEmail && <p><strong>Email:</strong> {customerEmail}</p>}
            </div>
          )}
        </div>
      </div>
      {children}
      <div className="flex items-center gap-2">
        <Checkbox id={ccId} checked={ccAdmin} onCheckedChange={value => onCcAdminChange(value === true)} disabled={sending} />
        <Label htmlFor={ccId} className="cursor-pointer text-sm font-normal">Send a copy to me</Label>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={onSend} disabled={sending || sendDisabled} className="flex-1 gap-2" aria-busy={sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? "Sending..." : "Send Confirmation"}
        </Button>
        <Button type="button" variant="outline" onClick={onSkip} disabled={sending}>{skipLabel}</Button>
      </div>
    </div>
  );
}
