import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mail, Save, ExternalLink } from "lucide-react";
import { useCompanySettings, useUpdateCompanySettings, type CompanySettings } from "@/hooks/use-company-settings";
import { useToast } from "@/hooks/use-toast";

type EditableTemplateKey = "enquiry_acknowledgement" | "job_confirmation" | "portal_invite" | "booking_pending_approval";

interface EditableTemplateDef {
  key: EditableTemplateKey;
  label: string;
  description: string;
  defaultSubject: string;
  defaultBody: string;
  variables: string[];
}

const TEMPLATE_DEFS: EditableTemplateDef[] = [
  {
    key: "enquiry_acknowledgement",
    label: "Enquiry Acknowledgement",
    description: "Sent when a new enquiry is logged and acknowledgement is enabled.",
    defaultSubject: "We have logged your enquiry — {{company_name}}",
    defaultBody: "Dear {{customer_name}},\n\nThank you for getting in touch with {{company_name}}. We have logged your enquiry ({{enquiry_id}}) and a member of our team will review it as soon as possible.\n\nIf you need to add anything to your enquiry, please reply to this email.",
    variables: ["{{customer_name}}", "{{company_name}}", "{{enquiry_id}}", "{{source}}", "{{priority}}", "{{description}}"],
  },
  {
    key: "job_confirmation",
    label: "Job Confirmation",
    description: "Sent when an appointment confirmation email is sent to a customer.",
    defaultSubject: "Appointment Confirmation — {{job_ref}}",
    defaultBody: "Dear {{customer_name}},\n\nThis is to confirm your upcoming appointment with {{company_name}}.\n\nReference: {{job_ref}}\nWork Type: {{job_type}}\nDate: {{scheduled_date}}\nDuration: {{job_duration}}\nProperty: {{property_address}}\n\nIf you need to reschedule, please contact us.",
    variables: ["{{customer_name}}", "{{company_name}}", "{{job_ref}}", "{{job_type}}", "{{scheduled_date}}", "{{scheduled_time}}", "{{job_duration}}", "{{property_address}}", "{{description}}"],
  },
  {
    key: "booking_pending_approval",
    label: "Booking Pending Approval",
    description: "Sent after an online booking request is received but before approval.",
    defaultSubject: "Booking Request Received — Pending Approval ({{job_ref}})",
    defaultBody: "Dear {{customer_name}},\n\nThank you for your booking request with {{company_name}}. Your request is pending approval.\n\nReference: {{job_ref}}\nWork Type: {{job_type}}\nRequested Date: {{scheduled_date}}\nDuration: {{job_duration}}\nProperty: {{property_address}}\n\nWe will contact you soon to confirm.",
    variables: ["{{customer_name}}", "{{company_name}}", "{{job_ref}}", "{{job_type}}", "{{scheduled_date}}", "{{scheduled_time}}", "{{job_duration}}", "{{property_address}}", "{{description}}"],
  },
  {
    key: "portal_invite",
    label: "Customer Portal Invite",
    description: "Sent when inviting a customer to register for the customer portal.",
    defaultSubject: "{{company_name}} — You're invited to the Customer Portal",
    defaultBody: "Dear {{customer_name}},\n\n{{company_name}} has invited you to access your secure customer portal.\n\nCreate your account using this link:\n{{register_url}}\n\nThis invitation expires in 7 days.",
    variables: ["{{customer_name}}", "{{company_name}}", "{{register_url}}"],
  },
];

function parseTemplateMap(settings?: CompanySettings) {
  const raw = settings?.email_templates;
  if (!raw || typeof raw !== "object") return {} as Record<string, { subject?: string | null; body?: string | null }>;
  return raw as Record<string, { subject?: string | null; body?: string | null }>;
}

export default function AdminEmailTemplates() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useCompanySettings();
  const update = useUpdateCompanySettings();

  const templateMap = useMemo(() => parseTemplateMap(settings), [settings]);
  const [drafts, setDrafts] = useState<Record<string, { subject: string; body: string }>>({});

  const getDraft = (def: EditableTemplateDef) => {
    const fromState = drafts[def.key];
    if (fromState) return fromState;
    const existing = templateMap[def.key];
    return {
      subject: existing?.subject ?? def.defaultSubject,
      body: existing?.body ?? def.defaultBody,
    };
  };

  const setDraft = (key: EditableTemplateKey, patch: Partial<{ subject: string; body: string }>) => {
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        subject: patch.subject ?? (prev[key]?.subject ?? (templateMap[key]?.subject || "")),
        body: patch.body ?? (prev[key]?.body ?? (templateMap[key]?.body || "")),
      },
    }));
  };

  const handleSave = async () => {
    const payload: Record<string, { subject: string; body: string }> = {};
    for (const def of TEMPLATE_DEFS) {
      const merged = getDraft(def);
      payload[def.key] = {
        subject: merged.subject.trim() || def.defaultSubject,
        body: merged.body.trim() || def.defaultBody,
      };
    }

    try {
      await update.mutateAsync({ email_templates: payload });
      toast({ title: "Email templates saved", description: "Your wording changes will apply to new outgoing emails." });
      setDrafts({});
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "Could not save templates", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="p-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold flex items-center gap-2">
          <Mail className="w-6 h-6" /> Email Templates
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage wording for core customer emails in one place.</p>
      </div>

      {TEMPLATE_DEFS.map((def) => {
        const current = getDraft(def);
        return (
          <Card key={def.key} className="p-4 sm:p-5 space-y-3 border border-border/50 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold">{def.label}</h2>
              <p className="text-sm text-muted-foreground">{def.description}</p>
            </div>

            <div className="space-y-1">
              <Label>Subject</Label>
              <Input
                value={current.subject}
                onChange={(e) => setDraft(def.key, { subject: e.target.value })}
                placeholder={def.defaultSubject}
              />
            </div>

            <div className="space-y-1">
              <Label>Body</Label>
              <Textarea
                value={current.body}
                onChange={(e) => setDraft(def.key, { body: e.target.value })}
                rows={8}
                className="font-mono text-xs"
                placeholder={def.defaultBody}
              />
            </div>

            <p className="text-xs text-muted-foreground">Variables: {def.variables.join(", ")}</p>
          </Card>
        );
      })}

      <Card className="p-4 border border-border/50 bg-muted/30">
        <p className="text-sm font-medium mb-2">Other message editors</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/review-requests">
            <Button variant="outline" size="sm">Review Request Template <ExternalLink className="w-3.5 h-3.5 ml-1" /></Button>
          </Link>
          <Link href="/maintenance">
            <Button variant="outline" size="sm">Maintenance Reminder Template <ExternalLink className="w-3.5 h-3.5 ml-1" /></Button>
          </Link>
          <Link href="/admin/sms-templates">
            <Button variant="outline" size="sm">SMS Templates <ExternalLink className="w-3.5 h-3.5 ml-1" /></Button>
          </Link>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />} Save Email Templates
        </Button>
      </div>
    </div>
  );
}
