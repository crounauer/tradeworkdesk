import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EmailConfirmationPanel } from "@/components/email-confirmation-panel";
import { SmsSendDialog } from "@/components/sms-send-dialog";
import { useToast } from "@/hooks/use-toast";

interface BookingJob {
  id: string;
  customer_id: string;
  scheduled_date: string | null;
  scheduled_end_date?: string | null;
  scheduled_time: string | null;
  all_day?: boolean | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    business_name?: string | null;
    email?: string | null;
    mobile?: string | null;
    phone?: string | null;
  } | null;
  property?: {
    tenant_name?: string | null;
    tenant_email?: string | null;
    tenant_contacts?: Array<{ name?: string; email?: string }> | null;
  } | null;
}

function appointmentMessage(job: BookingJob): string {
  const date = (value: string) => {
    const isoDate = value.slice(0, 10);
    const parsed = new Date(`${isoDate}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? isoDate : parsed.toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  };
  if (!job.scheduled_date) return "Your appointment has been booked. Please contact us for the date and time.";
  const start = date(job.scheduled_date);
  const end = job.scheduled_end_date && job.scheduled_end_date.slice(0, 10) !== job.scheduled_date.slice(0, 10)
    ? ` to ${date(job.scheduled_end_date)}` : "";
  const time = !job.all_day && job.scheduled_time ? ` at ${job.scheduled_time.slice(0, 5)}` : "";
  return `Your appointment is booked for ${start}${end}${time}. Please contact us if you need to change it.`;
}

export function BookingConfirmationPanel({ jobId, onDone, onSendingChange }: {
  jobId: string;
  onDone: () => void;
  onSendingChange?: (sending: boolean) => void;
}) {
  const [sending, setSending] = useState(false);
  const [ccAdmin, setCcAdmin] = useState(false);
  const [smsOpen, setSmsOpen] = useState(false);
  const { toast } = useToast();
  const jobQuery = useQuery<BookingJob>({
    queryKey: ["booking-confirmation-job", jobId],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}api/jobs/${encodeURIComponent(jobId)}`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load the customer and appointment details.");
      const job = await response.json() as BookingJob;
      if (!job.customer) throw new Error("Customer details are unavailable.");
      return job;
    },
    retry: false,
  });
  const job = jobQuery.data;
  const email = job?.customer?.email?.trim();
  const tenantContacts = (job?.property?.tenant_contacts || []).filter((contact) => contact.email?.trim());
  const tenantEmails = [
    job?.property?.tenant_email?.trim(),
    ...tenantContacts.map((contact) => contact.email!.trim()),
  ].filter((value, index, values): value is string => !!value && values.findIndex((item) => item?.toLowerCase() === value.toLowerCase()) === index);
  const tenantEmail = tenantEmails[0];
  const confirmationEmails = Array.from(new Set([email, ...tenantEmails].filter((value): value is string => !!value)));
  const smsQuery = useQuery<{ available: boolean }>({
    queryKey: ["booking-sms-availability", jobId],
    queryFn: async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}api/sms/availability`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to check SMS availability.");
      return response.json();
    },
    enabled: !!job && confirmationEmails.length === 0,
    retry: false,
  });

  const sendEmail = async () => {
    setSending(true);
    onSendingChange?.(true);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}api/jobs/${encodeURIComponent(jobId)}/send-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cc_admin: ccAdmin }),
      });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error || "Failed to send confirmation email.");
      }
      const body = await response.json() as { sent_to?: string; recipients?: string[] };
      const sentTo = body.recipients?.join(" and ") || body.sent_to || confirmationEmails.join(" and ");
      toast({ title: "Confirmation sent", description: `Appointment confirmation emailed to ${sentTo}.` });
      onDone();
    } catch (error) {
      toast({ title: "Email failed", description: error instanceof Error ? error.message : "Could not send confirmation email.", variant: "destructive" });
    } finally {
      setSending(false);
      onSendingChange?.(false);
    }
  };

  if (jobQuery.isPending || (job && confirmationEmails.length === 0 && smsQuery.isPending)) {
    return <p className="py-3 text-sm text-muted-foreground">Checking confirmation options...</p>;
  }
  if (jobQuery.isError || smsQuery.isError) {
    return <div className="space-y-4 py-2">
      <p className="text-sm text-destructive">The job was booked, but confirmation options could not be checked. No message was sent.</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => { void (jobQuery.isError ? jobQuery.refetch() : smsQuery.refetch()); }}>Retry</Button>
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>;
  }
  if (!job) return null;
  if (confirmationEmails.length > 0) {
    const customer = job.customer;
    const name = customer?.business_name || [customer?.first_name, customer?.last_name].filter(Boolean).join(" ");
    return <EmailConfirmationPanel
      customerName={name || job.property?.tenant_name || "Tenant"}
      customerEmail={email || tenantEmail || ""}
      sending={sending}
      ccAdmin={ccAdmin}
      onCcAdminChange={setCcAdmin}
      onSend={sendEmail}
      onSkip={onDone}
    >
      {tenantEmails.some((value) => value.toLowerCase() !== email?.toLowerCase()) && (
        <p className="text-sm text-muted-foreground">
          Separate tracked confirmations will also be sent to {tenantEmails.filter((value) => value.toLowerCase() !== email?.toLowerCase()).join(", ")}.
        </p>
      )}
    </EmailConfirmationPanel>;
  }
  return <div className="space-y-4 py-2">
    <p className="text-sm text-muted-foreground">
      No customer email address is available.
      {smsQuery.data?.available ? " Would you like to send the appointment details by SMS?" : " SMS is not available or has no credits; no confirmation was sent."}
    </p>
    {smsQuery.data?.available ? <>
      <p className="text-xs text-muted-foreground">SMS messages are outbound only; customers cannot confirm or reply by text.</p>
      <div className="flex gap-2">
        <Button onClick={() => setSmsOpen(true)}>Send confirmation by SMS</Button>
        <Button variant="outline" onClick={onDone}>Skip</Button>
      </div>
      {smsOpen && <SmsSendDialog open={smsOpen} onOpenChange={setSmsOpen}
        destination={job.customer?.mobile || job.customer?.phone || ""}
        initialContent={appointmentMessage(job)} jobId={job.id} customerId={job.customer_id}
        onSent={onDone} />}
    </> : <Button onClick={onDone}>Done</Button>}
  </div>;
}
