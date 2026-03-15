import { useListJobs, useCreateJob, useListProfiles, useListCustomers, useListProperties } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { Briefcase, Calendar, MapPin, User, Plus, Filter, X } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

type JobFormData = {
  customer_id: string;
  property_id: string;
  job_type: string;
  priority: string;
  scheduled_date: string;
  scheduled_time?: string;
  description?: string;
  assigned_technician_id?: string;
};

export default function Jobs() {
  const [statusFilter, setStatusFilter] = useState("");
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: jobs, isLoading } = useListJobs({
    status: statusFilter || undefined,
    job_type: jobTypeFilter || undefined,
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'in_progress': return 'bg-amber-100 text-amber-700';
      case 'completed': return 'bg-emerald-100 text-emerald-700';
      case 'requires_follow_up': return 'bg-rose-100 text-rose-700';
      case 'cancelled': return 'bg-slate-200 text-slate-600';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const statuses = ['scheduled', 'in_progress', 'completed', 'cancelled', 'requires_follow_up'];
  const jobTypes = ['service', 'breakdown', 'installation', 'inspection', 'follow_up'];

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold">Jobs</h1>
          <p className="text-muted-foreground mt-1">Manage all service visits</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="w-4 h-4 mr-2" /> Cancel</> : <><Plus className="w-4 h-4 mr-2" /> New Job</>}
        </Button>
      </div>

      {showForm && <AddJobForm onClose={() => setShowForm(false)} />}

      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {statuses.map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background"
          value={jobTypeFilter}
          onChange={(e) => setJobTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          {jobTypes.map(t => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        {(statusFilter || jobTypeFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(""); setJobTypeFilter(""); }}>
            <X className="w-4 h-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !jobs?.length ? (
        <Card className="p-8 text-center border-dashed">
          <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-muted-foreground">No jobs found matching your filters.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <Link key={job.id} href={`/jobs/${job.id}`}>
              <Card className="p-4 sm:p-5 border border-border/50 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${getStatusColor(job.status)}`}>
                      {job.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-semibold capitalize text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md">
                      {job.job_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg mb-1">{job.customer_name}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {job.property_address}</span>
                  </div>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 sm:border-l border-border/50 sm:pl-5">
                  <div className="flex items-center gap-1.5 text-foreground font-medium bg-slate-50 px-3 py-1.5 rounded-lg w-full sm:w-auto justify-center">
                    <Calendar className="w-4 h-4 text-primary" />
                    {formatDateTime(job.scheduled_date + (job.scheduled_time ? `T${job.scheduled_time}` : 'T00:00:00'))}
                  </div>
                  {job.technician_name && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <User className="w-4 h-4" /> {job.technician_name}
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AddJobForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const createJob = useCreateJob();
  const { data: customers } = useListCustomers();
  const { data: properties } = useListProperties();
  const { data: technicians } = useListProfiles();
  const { register, handleSubmit, watch } = useForm<JobFormData>();
  const { toast } = useToast();
  const selectedCustomerId = watch("customer_id");

  const filteredProperties = properties?.filter(p => !selectedCustomerId || p.customer_id === selectedCustomerId);

  const onSubmit = async (data: JobFormData) => {
    try {
      await createJob.mutateAsync({
        data: {
          customer_id: data.customer_id,
          property_id: data.property_id,
          job_type: data.job_type as "service" | "breakdown" | "installation" | "inspection" | "follow_up",
          priority: data.priority as "low" | "medium" | "high" | "urgent",
          scheduled_date: data.scheduled_date,
          scheduled_time: data.scheduled_time || undefined,
          description: data.description || undefined,
          assigned_technician_id: data.assigned_technician_id || undefined,
        }
      });
      qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job created successfully" });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create job. Please try again.";
      toast({ title: "Failed to create job", description: message, variant: "destructive" });
    }
  };

  return (
    <Card className="p-6 border-primary/20 shadow-lg bg-primary/5">
      <h3 className="font-bold text-lg mb-4">Schedule New Job</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Customer *</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" required {...register("customer_id")}>
            <option value="">Select customer...</option>
            {customers?.map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Property *</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" required {...register("property_id")}>
            <option value="">Select property...</option>
            {filteredProperties?.map(p => (
              <option key={p.id} value={p.id}>{p.address_line1}, {p.postcode}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Job Type *</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" required {...register("job_type")}>
            <option value="service">Service</option>
            <option value="breakdown">Breakdown</option>
            <option value="installation">Installation</option>
            <option value="inspection">Inspection</option>
            <option value="follow_up">Follow Up</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Priority</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("priority")}>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Scheduled Date *</label>
          <Input type="date" required {...register("scheduled_date")} />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Scheduled Time</label>
          <Input type="time" {...register("scheduled_time")} />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Assign Technician</label>
          <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("assigned_technician_id")}>
            <option value="">Unassigned</option>
            {technicians?.filter(t => t.role === 'technician').map(t => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Description</label>
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]" {...register("description")} />
        </div>
        <div className="md:col-span-2 flex gap-3">
          <Button type="submit" disabled={createJob.isPending}>
            {createJob.isPending ? "Creating..." : "Create Job"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
