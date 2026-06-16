import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Briefcase, Package, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { InvoiceLineItem } from "@/hooks/use-invoices";

interface JobType {
  id: number;
  name: string;
  slug: string;
  category: string;
  color: string;
  is_active: boolean;
}

interface CreateJobFromQuoteFormData {
  property_id: string;
  scheduled_date: string;
  scheduled_time: string;
  job_type_id: string;
  assigned_technician_id: string;
  description: string;
}

interface CreateJobFromQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  customerNotes?: string | null;
  notes?: string | null;
  lineItems: InvoiceLineItem[];
  /** Pre-select a property if the quote was linked to a job */
  initialPropertyId?: string;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

export function CreateJobFromQuoteDialog({
  open,
  onOpenChange,
  quoteId,
  quoteNumber,
  customerId,
  customerName,
  customerNotes,
  notes,
  lineItems,
  initialPropertyId,
}: CreateJobFromQuoteDialogProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];

  const { register, handleSubmit, reset, setValue, watch } = useForm<CreateJobFromQuoteFormData>({
    defaultValues: {
      scheduled_date: todayStr,
      description: customerNotes?.trim() || notes?.trim() || "",
    },
  });

  // Fetch properties for this customer
  const { data: properties, isLoading: propsLoading } = useQuery<Array<{
    id: string;
    address_line1: string;
    city?: string | null;
    postcode: string;
  }>>({
    queryKey: ["/api/properties", { customer_id: customerId }],
    queryFn: () =>
      fetch(`${import.meta.env.BASE_URL}api/properties?customer_id=${customerId}`)
        .then(r => r.json())
        .then(d => d.properties || d || []),
    enabled: open && !!customerId,
  });

  // Fetch technicians
  const { data: technicians = [] } = useQuery<Array<{ id: string; full_name: string }>>({
    queryKey: ["/api/admin/assignable-users"],
    queryFn: () =>
      fetch(`${import.meta.env.BASE_URL}api/admin/assignable-users`).then(r => r.json()),
    enabled: open,
  });

  // Fetch job types
  const { data: jobTypes = [] } = useQuery<JobType[]>({
    queryKey: ["job-types"],
    queryFn: async () => {
      const r = await fetch(`${import.meta.env.BASE_URL}api/job-types`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: open,
  });

  // Pre-select property when dialog opens
  useEffect(() => {
    if (open) {
      reset({
        scheduled_date: todayStr,
        description: customerNotes?.trim() || notes?.trim() || "",
        property_id: initialPropertyId || (properties?.length === 1 ? properties[0].id : ""),
        job_type_id: "",
        assigned_technician_id: "",
        scheduled_time: "",
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select if only one property
  useEffect(() => {
    if (properties?.length === 1 && !initialPropertyId) {
      setValue("property_id", properties[0].id);
    }
    if (initialPropertyId) {
      setValue("property_id", initialPropertyId);
    }
  }, [properties, initialPropertyId, setValue]);

  const selectedPropertyId = watch("property_id");

  // Categorise line items for preview
  const products = lineItems.filter(l => l.item_type === "product");
  const services = lineItems.filter(l => l.item_type === "service");
  const labour = lineItems.filter(l => l.item_type === "labour" || l.item_type === "callout");
  const other = lineItems.filter(l => !["product", "service", "labour", "callout"].includes(l.item_type || ""));

  const onSubmit = async (data: CreateJobFromQuoteFormData) => {
    if (!data.property_id) {
      toast({ title: "Missing info", description: "Please select a property.", variant: "destructive" });
      return;
    }
    if (!data.scheduled_date) {
      toast({ title: "Missing info", description: "Please enter a scheduled date.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        property_id: data.property_id,
        scheduled_date: data.scheduled_date,
      };
      if (data.scheduled_time) body.scheduled_time = data.scheduled_time;
      if (data.job_type_id) body.job_type_id = parseInt(data.job_type_id, 10);
      if (data.assigned_technician_id) body.assigned_technician_id = data.assigned_technician_id;
      if (data.description?.trim()) body.description = data.description.trim();

      const res = await fetch(`${import.meta.env.BASE_URL}api/invoices/${quoteId}/create-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create job");
      }

      const result = await res.json() as { job_id: string; job_ref?: string };

      // Invalidate invoice + jobs queries so both lists refresh
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/invoices"] }),
        qc.invalidateQueries({ queryKey: ["/api/jobs"] }),
      ]);

      toast({ title: "Job created", description: `Job${result.job_ref ? ` ${result.job_ref}` : ""} created from ${quoteNumber}.` });
      onOpenChange(false);
      navigate(`/jobs/${result.job_id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create job";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Create Job from {quoteNumber}
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            For <strong>{customerName}</strong>. Quote line items will be pre-loaded onto the job.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">

          {/* Property */}
          <div className="space-y-1.5">
            <Label>Property <span className="text-destructive">*</span></Label>
            {propsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading properties…
              </div>
            ) : (properties || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No properties found for this customer.</p>
            ) : (
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                {...register("property_id")}
              >
                <option value="">— Select property —</option>
                {(properties || []).map(p => (
                  <option key={p.id} value={p.id}>
                    {[p.address_line1, p.city, p.postcode].filter(Boolean).join(", ")}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Scheduled Date <span className="text-destructive">*</span></Label>
              <Input type="date" {...register("scheduled_date")} />
            </div>
            <div className="space-y-1.5">
              <Label>Scheduled Time</Label>
              <Input type="time" {...register("scheduled_time")} />
            </div>
          </div>

          {/* Job Type */}
          {jobTypes.length > 0 && (
            <div className="space-y-1.5">
              <Label>Job Type</Label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                {...register("job_type_id")}
              >
                <option value="">— Default (Service) —</option>
                {jobTypes.filter(jt => jt.is_active).map(jt => (
                  <option key={jt.id} value={String(jt.id)}>{jt.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Technician */}
          {technicians.length > 0 && (
            <div className="space-y-1.5">
              <Label>Assign Technician</Label>
              <select
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                {...register("assigned_technician_id")}
              >
                <option value="">— Auto-assign —</option>
                {technicians.map(t => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={2}
              placeholder="Job description…"
              {...register("description")}
            />
          </div>

          {/* Line items preview */}
          {lineItems.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Items to import from quote
              </p>
              {products.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Package className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs font-medium text-blue-700">Parts / Products</span>
                  </div>
                  {products.map((l, i) => (
                    <div key={i} className="flex justify-between text-xs py-0.5 pl-5">
                      <span className="text-foreground">{l.description} × {l.quantity}</span>
                      <span className="text-muted-foreground">{formatCurrency(l.unit_price * l.quantity)}</span>
                    </div>
                  ))}
                </div>
              )}
              {[...services, ...labour, ...other].length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Wrench className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-medium text-amber-700">Services / Labour</span>
                  </div>
                  {[...services, ...labour, ...other].map((l, i) => (
                    <div key={i} className="flex justify-between text-xs py-0.5 pl-5">
                      <span className="text-foreground">{l.description} × {l.quantity}</span>
                      <span className="text-muted-foreground">{formatCurrency(l.unit_price * l.quantity)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !selectedPropertyId}>
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</>
              ) : (
                <><Briefcase className="w-4 h-4 mr-2" /> Create Job</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
