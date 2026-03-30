import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListCustomers, useListProperties } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import {
  ArrowLeft, Phone, Mail, MapPin, MessageSquare, Send,
  Briefcase, Clock, Edit, Check, X, Trash2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SOURCE_LABELS: Record<string, string> = {
  phone: "Phone", email: "Email", text: "Text/SMS", facebook: "Facebook",
  whatsapp: "WhatsApp", messenger: "Messenger", website: "Website",
  referral: "Referral", other: "Other",
};

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-blue-100 text-blue-700" },
  { value: "contacted", label: "Contacted", color: "bg-amber-100 text-amber-700" },
  { value: "quoted", label: "Quoted", color: "bg-purple-100 text-purple-700" },
  { value: "converted", label: "Converted", color: "bg-emerald-100 text-emerald-700" },
  { value: "lost", label: "Lost", color: "bg-slate-100 text-slate-500" },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

interface JobType {
  id: number;
  name: string;
  slug: string;
  category: string;
  is_active: boolean;
}

function EnquiryDetailContent() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [sendingNote, setSendingNote] = useState(false);
  const [showConvert, setShowConvert] = useState(false);

  const { data: enquiry, isLoading } = useQuery({
    queryKey: ["enquiry", id],
    queryFn: async () => {
      const res = await fetch(`/api/enquiries/${id}`);
      if (!res.ok) throw new Error("Failed to load enquiry");
      return res.json();
    },
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ["enquiry-notes", id],
    queryFn: async () => {
      const res = await fetch(`/api/enquiries/${id}/notes`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/enquiries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      qc.invalidateQueries({ queryKey: ["enquiry", id] });
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      toast({ title: "Status updated" });
    } catch {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSendingNote(true);
    try {
      const res = await fetch(`/api/enquiries/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteText.trim() }),
      });
      if (!res.ok) throw new Error("Failed to add note");
      setNoteText("");
      qc.invalidateQueries({ queryKey: ["enquiry-notes", id] });
    } catch {
      toast({ title: "Error", description: "Failed to add note", variant: "destructive" });
    } finally {
      setSendingNote(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this enquiry? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/enquiries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      navigate("/enquiries");
      toast({ title: "Enquiry deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="p-8">Loading enquiry...</div>;
  if (!enquiry) return <div className="p-8">Enquiry not found</div>;

  const statusOpt = STATUS_OPTIONS.find(s => s.value === enquiry.status);
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const canEdit = profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin";
  const canConvert = canEdit && enquiry.status !== "converted";

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
      <Link href="/enquiries" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Enquiries
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl font-display font-bold">{enquiry.contact_name}</h1>
            <span className={`px-3 py-1 rounded-md text-sm font-bold uppercase tracking-wider ${statusOpt?.color || "bg-slate-100"}`}>
              {statusOpt?.label || enquiry.status}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[enquiry.priority] || ""}`}>
              {enquiry.priority}
            </span>
          </div>
          <p className="text-muted-foreground">
            Via {SOURCE_LABELS[enquiry.source] || enquiry.source} · {new Date(enquiry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canConvert && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={() => setShowConvert(true)}>
              <Briefcase className="w-4 h-4" /> Convert to Job
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {editing ? (
            <EditEnquiryForm enquiry={enquiry} onClose={() => { setEditing(false); qc.invalidateQueries({ queryKey: ["enquiry", id] }); qc.invalidateQueries({ queryKey: ["enquiries"] }); }} />
          ) : (
            <Card className="p-6 border border-border/50 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Enquiry Details</h3>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Edit className="w-4 h-4 mr-1" /> Edit
                  </Button>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-y-4 gap-x-8">
                {enquiry.contact_phone && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><Phone className="w-4 h-4" /> Phone</p>
                    <a href={`tel:${enquiry.contact_phone}`} className="font-medium text-primary hover:underline">{enquiry.contact_phone}</a>
                  </div>
                )}
                {enquiry.contact_email && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><Mail className="w-4 h-4" /> Email</p>
                    <a href={`mailto:${enquiry.contact_email}`} className="font-medium text-primary hover:underline">{enquiry.contact_email}</a>
                  </div>
                )}
                {enquiry.address && (
                  <div className="sm:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="w-4 h-4" /> Address</p>
                    <p className="font-medium">{enquiry.address}</p>
                  </div>
                )}
                <div className="sm:col-span-2 pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-foreground whitespace-pre-wrap">{enquiry.description || "No description provided."}</p>
                </div>
                {enquiry.notes && (
                  <div className="sm:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                    <p className="text-foreground whitespace-pre-wrap">{enquiry.notes}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {enquiry.linked_job_id && (
            <Card className="p-4 border border-emerald-200 bg-emerald-50/50">
              <div className="flex items-center gap-3">
                <Briefcase className="w-5 h-5 text-emerald-600" />
                <div className="flex-1">
                  <p className="font-bold text-emerald-800">Converted to Job</p>
                  <p className="text-sm text-emerald-600">Job #{String(enquiry.linked_job_id).slice(0, 8)}</p>
                </div>
                <Link href={`/jobs/${enquiry.linked_job_id}`}>
                  <Button variant="outline" size="sm">View Job</Button>
                </Link>
              </div>
            </Card>
          )}

          <Card className="p-6 border border-border/50 shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" /> Activity / Notes
            </h3>

            {notesLoading ? (
              <p className="text-muted-foreground text-sm">Loading notes...</p>
            ) : notes.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No notes yet. Add a follow-up note below.</p>
            ) : (
              <div className="space-y-3 mb-4">
                {notes.map((note: Record<string, unknown>) => (
                  <div key={note.id as string} className="border-l-2 border-primary/30 pl-4 py-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold">{(note.author as Record<string, string>)?.full_name || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.created_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.content as string}</p>
                  </div>
                ))}
              </div>
            )}

            {canEdit && (
              <div className="flex gap-2 pt-2 border-t border-border/50">
                <Input
                  placeholder="Add a note..."
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                />
                <Button size="icon" onClick={handleAddNote} disabled={sendingNote || !noteText.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 border border-border/50 shadow-sm bg-slate-50/50">
            <h3 className="font-bold mb-4">Update Status</h3>
            <div className="space-y-2">
              {STATUS_OPTIONS.filter(s => s.value !== "converted").map(s => (
                <button
                  key={s.value}
                  onClick={() => handleStatusChange(s.value)}
                  disabled={enquiry.status === s.value || enquiry.status === "converted"}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    enquiry.status === s.value
                      ? `${s.color} ring-2 ring-primary/30`
                      : "hover:bg-slate-100 text-muted-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Card>

          {enquiry.created_by_profile && (
            <Card className="p-6 border border-border/50 shadow-sm bg-slate-50/50">
              <h3 className="font-bold mb-2">Created By</h3>
              <p className="text-sm">{enquiry.created_by_profile.full_name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(enquiry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </Card>
          )}

          {enquiry.customer && (
            <Card className="p-6 border border-border/50 shadow-sm bg-slate-50/50">
              <h3 className="font-bold mb-2">Linked Customer</h3>
              <p className="font-medium">{enquiry.customer.first_name} {enquiry.customer.last_name}</p>
              <Link href={`/customers/${enquiry.customer.id}`} className="text-sm text-primary hover:underline mt-1 inline-block">View Customer</Link>
            </Card>
          )}
        </div>
      </div>

      {showConvert && (
        <ConvertToJobDialog
          open={showConvert}
          onOpenChange={setShowConvert}
          enquiry={enquiry}
          onConverted={(jobId: string) => {
            qc.invalidateQueries({ queryKey: ["enquiry", id] });
            qc.invalidateQueries({ queryKey: ["enquiries"] });
            navigate(`/jobs/${jobId}`);
          }}
        />
      )}
    </div>
  );
}

function EditEnquiryForm({ enquiry, onClose }: { enquiry: Record<string, unknown>; onClose: () => void }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    contact_name: (enquiry.contact_name as string) || "",
    contact_phone: (enquiry.contact_phone as string) || "",
    contact_email: (enquiry.contact_email as string) || "",
    source: (enquiry.source as string) || "phone",
    description: (enquiry.description as string) || "",
    notes: (enquiry.notes as string) || "",
    address: (enquiry.address as string) || "",
    priority: (enquiry.priority as string) || "medium",
  });

  const SOURCE_OPTIONS = [
    { value: "phone", label: "Phone" }, { value: "email", label: "Email" },
    { value: "text", label: "Text/SMS" }, { value: "facebook", label: "Facebook" },
    { value: "whatsapp", label: "WhatsApp" }, { value: "messenger", label: "Messenger" },
    { value: "website", label: "Website" }, { value: "referral", label: "Referral" },
    { value: "other", label: "Other" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/enquiries/${enquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast({ title: "Enquiry updated" });
      onClose();
    } catch {
      toast({ title: "Error", description: "Failed to update enquiry", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Contact Name *</Label>
            <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
              {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} type="email" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
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
          <Label>Description</Label>
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[60px]" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes..." />
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

function ConvertToJobDialog({ open, onOpenChange, enquiry, onConverted }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  enquiry: Record<string, unknown>;
  onConverted: (jobId: string) => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("new");
  const [propertyMode, setPropertyMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [newFirstName, setNewFirstName] = useState(() => {
    const parts = ((enquiry.contact_name as string) || "").trim().split(" ");
    return parts[0] || "";
  });
  const [newLastName, setNewLastName] = useState(() => {
    const parts = ((enquiry.contact_name as string) || "").trim().split(" ");
    return parts.slice(1).join(" ") || "";
  });
  const [newPhone, setNewPhone] = useState((enquiry.contact_phone as string) || "");
  const [newEmail, setNewEmail] = useState((enquiry.contact_email as string) || "");
  const [newAddress, setNewAddress] = useState(() => {
    const addr = (enquiry.address as string) || "";
    const parts = addr.split(",");
    return parts[0]?.trim() || "";
  });
  const [newCity, setNewCity] = useState(() => {
    const addr = (enquiry.address as string) || "";
    const parts = addr.split(",");
    return parts[1]?.trim() || "";
  });
  const [newPostcode, setNewPostcode] = useState(() => {
    const addr = (enquiry.address as string) || "";
    const parts = addr.split(",");
    return parts[parts.length - 1]?.trim() || "";
  });
  const [jobTypeId, setJobTypeId] = useState("");
  const [priority, setPriority] = useState((enquiry.priority as string) || "medium");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split("T")[0]);
  const [scheduledTime, setScheduledTime] = useState("");
  const [description, setDescription] = useState((enquiry.description as string) || "");

  const { data: customers } = useListCustomers();
  const { data: properties } = useListProperties();
  const { data: jobTypes = [] } = useQuery<JobType[]>({
    queryKey: ["job-types"],
    queryFn: async () => {
      const res = await fetch("/api/job-types");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filteredProperties = properties?.filter(p => !customerId || p.customer_id === customerId);

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        priority,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime || undefined,
        description: description || undefined,
      };

      const selectedType = jobTypes.find(t => t.id === parseInt(jobTypeId, 10));
      if (selectedType) {
        body.job_type = selectedType.category || "service";
        body.job_type_id = selectedType.id;
      } else {
        body.job_type = "service";
      }

      if (customerMode === "existing") {
        if (!customerId) {
          toast({ title: "Missing info", description: "Select a customer.", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        body.customer_id = customerId;
        if (propertyMode === "existing") {
          if (!propertyId) {
            toast({ title: "Missing info", description: "Select a property.", variant: "destructive" });
            setSubmitting(false);
            return;
          }
          body.property_id = propertyId;
        } else {
          if (!newAddress || !newPostcode) {
            toast({ title: "Missing info", description: "Enter at least address and postcode.", variant: "destructive" });
            setSubmitting(false);
            return;
          }
          body.new_property = { address_line1: newAddress, city: newCity || undefined, postcode: newPostcode };
        }
      } else {
        if (!newFirstName || !newLastName) {
          toast({ title: "Missing info", description: "Enter the customer's name.", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        body.new_customer = { first_name: newFirstName, last_name: newLastName, phone: newPhone || undefined, email: newEmail || undefined };
        if (newAddress && newPostcode) {
          body.new_property = { address_line1: newAddress, city: newCity || undefined, postcode: newPostcode };
        } else {
          toast({ title: "Missing info", description: "Enter at least address and postcode.", variant: "destructive" });
          setSubmitting(false);
          return;
        }
      }

      const res = await fetch(`/api/enquiries/${enquiry.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Conversion failed");
      }
      const result = await res.json();
      toast({ title: "Converted!", description: "Enquiry converted to a job." });
      onConverted(result.job_id);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Convert Enquiry to Job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleConvert} className="space-y-5">
          <div className="flex gap-2 bg-muted rounded-lg p-1">
            <button type="button" className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${customerMode === "new" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setCustomerMode("new")}>
              New Customer
            </button>
            <button type="button" className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${customerMode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setCustomerMode("existing")}>
              Existing Customer
            </button>
          </div>

          {customerMode === "existing" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Customer *</Label>
                <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" required value={customerId} onChange={e => { setCustomerId(e.target.value); setPropertyId(""); }}>
                  <option value="">Select customer...</option>
                  {customers?.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 bg-muted/50 rounded-lg p-1">
                <button type="button" className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${propertyMode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground"}`} onClick={() => setPropertyMode("existing")}>
                  Existing Property
                </button>
                <button type="button" className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${propertyMode === "new" ? "bg-background shadow-sm" : "text-muted-foreground"}`} onClick={() => setPropertyMode("new")}>
                  New Property
                </button>
              </div>
              {propertyMode === "existing" ? (
                <div className="space-y-1.5">
                  <Label>Property *</Label>
                  <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" required value={propertyId} onChange={e => setPropertyId(e.target.value)}>
                    <option value="">Select property...</option>
                    {filteredProperties?.map(p => <option key={p.id} value={p.id}>{p.address_line1}, {p.postcode}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Address *</Label>
                    <Input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="123 High Street" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Town / City</Label>
                      <Input value={newCity} onChange={e => setNewCity(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Postcode *</Label>
                      <Input value={newPostcode} onChange={e => setNewPostcode(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>First Name *</Label>
                  <Input value={newFirstName} onChange={e => setNewFirstName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name *</Label>
                  <Input value={newLastName} onChange={e => setNewLastName(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" />
                </div>
              </div>
              <div className="border-t pt-4 space-y-4">
                <p className="text-sm font-medium text-muted-foreground">Property Address</p>
                <div className="space-y-1.5">
                  <Label>Address *</Label>
                  <Input value={newAddress} onChange={e => setNewAddress(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Town / City</Label>
                    <Input value={newCity} onChange={e => setNewCity(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Postcode *</Label>
                    <Input value={newPostcode} onChange={e => setNewPostcode(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Job Type *</Label>
                <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" required value={jobTypeId} onChange={e => setJobTypeId(e.target.value)}>
                  <option value="">Select type...</option>
                  {jobTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" required value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Time</Label>
                <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[60px]" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {submitting ? "Converting..." : "Convert to Job"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function EnquiryDetail() {
  const { hasFeature, loading } = usePlanFeatures();
  if (loading) return <div className="p-8">Loading...</div>;
  if (!hasFeature("job_management")) return <UpgradePrompt feature="Enquiry Tracking" />;
  return <EnquiryDetailContent />;
}
