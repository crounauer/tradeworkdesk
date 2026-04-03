import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import {
  Plus, Search, Phone, Mail, MessageSquare, Globe, Users, Hash,
  Clock, Filter, ChevronRight, ChevronDown, ChevronUp, CheckCircle2, FileText, XCircle
} from "lucide-react";

const SOURCE_OPTIONS = [
  { value: "phone", label: "Phone", icon: Phone, color: "bg-blue-100 text-blue-700" },
  { value: "email", label: "Email", icon: Mail, color: "bg-emerald-100 text-emerald-700" },
  { value: "text", label: "Text/SMS", icon: MessageSquare, color: "bg-violet-100 text-violet-700" },
  { value: "facebook", label: "Facebook", icon: Globe, color: "bg-indigo-100 text-indigo-700" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare, color: "bg-green-100 text-green-700" },
  { value: "messenger", label: "Messenger", icon: MessageSquare, color: "bg-blue-100 text-blue-700" },
  { value: "website", label: "Website", icon: Globe, color: "bg-cyan-100 text-cyan-700" },
  { value: "referral", label: "Referral", icon: Users, color: "bg-amber-100 text-amber-700" },
  { value: "other", label: "Other", icon: Hash, color: "bg-slate-100 text-slate-700" },
];

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-blue-100 text-blue-700" },
  { value: "contacted", label: "Contacted", color: "bg-amber-100 text-amber-700" },
  { value: "quoted", label: "Quoted", color: "bg-purple-100 text-purple-700" },
  { value: "converted", label: "Converted", color: "bg-emerald-100 text-emerald-700" },
  { value: "lost", label: "Lost", color: "bg-slate-100 text-slate-500" },
];

function EnquiriesContent() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const queryParams = new URLSearchParams();
  if (statusFilter) queryParams.set("status", statusFilter);
  if (sourceFilter) queryParams.set("source", sourceFilter);
  if (searchTerm) queryParams.set("search", searchTerm);
  const qs = queryParams.toString();

  const { data: enquiries = [], isLoading } = useQuery({
    queryKey: ["enquiries", statusFilter, sourceFilter, searchTerm],
    queryFn: async () => {
      const res = await fetch(`/api/enquiries${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to load enquiries");
      return res.json();
    },
  });

  const getSourceBadge = (source: string) => {
    const opt = SOURCE_OPTIONS.find(s => s.value === source);
    if (!opt) return null;
    const Icon = opt.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${opt.color}`}>
        <Icon className="w-3 h-3" /> {opt.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const opt = STATUS_OPTIONS.find(s => s.value === status);
    if (!opt) return null;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${opt.color}`}>
        {opt.label}
      </span>
    );
  };

  const getAge = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Enquiries</h1>
          <p className="text-muted-foreground mt-1">Track incoming leads and convert them to jobs.</p>
        </div>
        <Button size="lg" className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="w-5 h-5" /> New Enquiry
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search enquiries..."
            className="pl-10"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <select
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
          >
            <option value="">All Sources</option>
            {SOURCE_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading enquiries...</div>
      ) : enquiries.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <MessageSquare className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold mb-1">No enquiries found</h3>
          <p className="text-muted-foreground mb-4">
            {statusFilter || sourceFilter || searchTerm
              ? "Try adjusting your filters."
              : "Record your first enquiry to start tracking leads."}
          </p>
          {!statusFilter && !sourceFilter && !searchTerm && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> New Enquiry
            </Button>
          )}
        </Card>
      ) : (
        <EnquirySections
          enquiries={enquiries}
          getSourceBadge={getSourceBadge}
          getStatusBadge={getStatusBadge}
          getAge={getAge}
          statusFilter={statusFilter}
        />
      )}

      {showCreate && (
        <CreateEnquiryDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["enquiries"] });
            toast({ title: "Enquiry created", description: "New enquiry has been recorded." });
          }}
        />
      )}
    </div>
  );
}

function EnquiryCard({
  enq,
  getSourceBadge,
  getStatusBadge,
  getAge,
}: {
  enq: Record<string, unknown>;
  getSourceBadge: (s: string) => React.ReactNode;
  getStatusBadge: (s: string) => React.ReactNode;
  getAge: (c: string) => string;
}) {
  const job = enq.job as { id: string; status: string; job_type: string } | null;
  return (
    <Link href={`/enquiries/${enq.id}`}>
      <Card className="p-5 hover:border-primary/50 hover:shadow-md cursor-pointer transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-bold text-foreground text-lg">{enq.contact_name as string}</span>
              {getSourceBadge(enq.source as string)}
              {getStatusBadge(enq.status as string)}
              {job && (enq.status === "converted") && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  job.status === "invoiced" ? "bg-emerald-100 text-emerald-700"
                    : job.status === "completed" ? "bg-teal-100 text-teal-700"
                    : "bg-blue-50 text-blue-600"
                }`}>
                  Job: {job.status.replace("_", " ")}
                </span>
              )}
            </div>
            {(enq.contact_phone || enq.contact_email) && (
              <p className="text-sm text-muted-foreground">
                {enq.contact_phone as string}{enq.contact_phone && enq.contact_email ? " · " : ""}{enq.contact_email as string}
              </p>
            )}
            {enq.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{enq.description as string}</p>
            )}
            {enq.address && (
              <p className="text-xs text-muted-foreground mt-0.5">{enq.address as string}</p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {getAge(enq.created_at as string)}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </Card>
    </Link>
  );
}

function EnquirySections({
  enquiries,
  getSourceBadge,
  getStatusBadge,
  getAge,
  statusFilter,
}: {
  enquiries: Record<string, unknown>[];
  getSourceBadge: (s: string) => React.ReactNode;
  getStatusBadge: (s: string) => React.ReactNode;
  getAge: (c: string) => string;
  statusFilter: string;
}) {
  const [showConverted, setShowConverted] = useState(statusFilter === "converted");
  const [showInvoiced, setShowInvoiced] = useState(false);
  const [showLost, setShowLost] = useState(statusFilter === "lost");

  const active = enquiries.filter((e) => {
    const s = e.status as string;
    return s !== "converted" && s !== "lost";
  });

  const converted = enquiries.filter((e) => e.status === "converted");
  const invoiced = converted.filter((e) => {
    const job = e.job as { status: string } | null;
    return job?.status === "invoiced";
  });
  const convertedNotInvoiced = converted.filter((e) => {
    const job = e.job as { status: string } | null;
    return job?.status !== "invoiced";
  });

  const lost = enquiries.filter((e) => e.status === "lost");

  const isFiltered = !!statusFilter;

  const renderCards = (items: Record<string, unknown>[]) => (
    <div className="space-y-3">
      {items.map((enq) => (
        <EnquiryCard
          key={enq.id as string}
          enq={enq}
          getSourceBadge={getSourceBadge}
          getStatusBadge={getStatusBadge}
          getAge={getAge}
        />
      ))}
    </div>
  );

  if (isFiltered) {
    return renderCards(enquiries);
  }

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-bold text-lg text-foreground">Active Enquiries</h2>
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{active.length}</span>
          </div>
          {renderCards(active)}
        </div>
      )}

      {convertedNotInvoiced.length > 0 && (
        <div>
          <button
            className="w-full flex items-center gap-2 mb-3 group"
            onClick={() => setShowConverted(!showConverted)}
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-lg text-emerald-700">Converted</h2>
            <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{convertedNotInvoiced.length}</span>
            <div className="flex-1 border-t border-border/50" />
            {showConverted ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showConverted && renderCards(convertedNotInvoiced)}
        </div>
      )}

      {invoiced.length > 0 && (
        <div>
          <button
            className="w-full flex items-center gap-2 mb-3 group"
            onClick={() => setShowInvoiced(!showInvoiced)}
          >
            <FileText className="w-5 h-5 text-teal-600" />
            <h2 className="font-bold text-lg text-teal-700">Invoiced</h2>
            <span className="text-xs font-medium bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">{invoiced.length}</span>
            <div className="flex-1 border-t border-border/50" />
            {showInvoiced ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showInvoiced && renderCards(invoiced)}
        </div>
      )}

      {lost.length > 0 && (
        <div>
          <button
            className="w-full flex items-center gap-2 mb-3 group"
            onClick={() => setShowLost(!showLost)}
          >
            <XCircle className="w-5 h-5 text-slate-400" />
            <h2 className="font-bold text-lg text-slate-500">Lost</h2>
            <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{lost.length}</span>
            <div className="flex-1 border-t border-border/50" />
            {showLost ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showLost && renderCards(lost)}
        </div>
      )}

      {active.length === 0 && converted.length === 0 && lost.length === 0 && (
        <Card className="p-12 text-center border-dashed border-2">
          <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-lg font-bold mb-1">No enquiries</h3>
        </Card>
      )}
    </div>
  );
}

function CreateEnquiryDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    source: "phone",
    description: "",
    notes: "",
    address: "",
    priority: "medium",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.contact_name.trim()) {
      toast({ title: "Missing info", description: "Please enter a contact name.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create enquiry");
      }
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Enquiry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Contact Name *</Label>
            <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="John Smith" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="07700 900000" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="john@example.com" type="email" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Source *</Label>
              <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                {SOURCE_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 High Street, Manchester, M1 1AA" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What does the customer need? E.g., 'Boiler not heating water, wants a quote for repair...'"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[60px]"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Internal notes about this enquiry..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? "Creating..." : "Create Enquiry"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Enquiries() {
  const { hasFeature, loading } = usePlanFeatures();
  if (loading) return <div className="p-8">Loading...</div>;
  if (!hasFeature("job_management")) return <UpgradePrompt feature="Enquiry Tracking" />;
  return <EnquiriesContent />;
}
