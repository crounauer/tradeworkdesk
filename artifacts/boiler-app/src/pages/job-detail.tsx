import { useGetJob, useUpdateJob } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Calendar, MapPin, User, FileText, Wrench, Flame, Edit, X, Check, ClipboardCheck, Droplets, ShieldAlert, Gauge, Settings, ShieldCheck, Pipette, ClipboardList } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type JobEditData = {
  status: string;
  priority: string;
  scheduled_date: string;
  scheduled_time?: string;
  estimated_duration?: string;
  description?: string;
};

type JobLike = {
  id: string;
  status: string;
  priority: string;
  scheduled_date: string;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  description?: string | null;
  [k: string]: unknown;
};

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: job, isLoading } = useGetJob(id);
  const [editing, setEditing] = useState(false);

  if (isLoading) return <div className="p-8">Loading job details...</div>;
  if (!job) return <div>Job not found</div>;

  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-700",
    in_progress: "bg-amber-100 text-amber-700",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-slate-100 text-slate-500",
    requires_follow_up: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
      <Link href="/jobs" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Jobs
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-display font-bold">Job #{job.id.slice(0, 8)}</h1>
            <span className={`px-3 py-1 rounded-md text-sm font-bold uppercase tracking-wider ${statusColors[job.status] || "bg-slate-100 text-slate-700"}`}>
              {job.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-lg text-muted-foreground capitalize">{job.job_type.replace('_', ' ')} - Priority: <span className="capitalize font-medium">{job.priority}</span></p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
          {editing ? <><X className="w-4 h-4 mr-2"/> Cancel</> : <><Edit className="w-4 h-4 mr-2"/> Edit</>}
        </Button>
      </div>

      {editing ? (
        <EditJobForm job={job as unknown as JobLike} onClose={() => setEditing(false)} />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 border border-border/50 shadow-sm">
              <h3 className="font-bold text-lg mb-4">Job Information</h3>
              <div className="grid sm:grid-cols-2 gap-y-4 gap-x-8">
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><Calendar className="w-4 h-4"/> Scheduled</p>
                  <p className="font-medium text-foreground">
                    {formatDateTime(job.scheduled_date + (job.scheduled_time ? `T${job.scheduled_time}` : 'T00:00:00'))}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><User className="w-4 h-4"/> Technician</p>
                  <p className="font-medium text-foreground">{job.technician?.full_name || 'Unassigned'}</p>
                </div>
                {job.estimated_duration && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Estimated Duration</p>
                    <p className="font-medium text-foreground">{job.estimated_duration}</p>
                  </div>
                )}
                <div className="sm:col-span-2 pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-foreground whitespace-pre-wrap">{job.description || 'No description provided.'}</p>
                </div>
              </div>
            </Card>

            <h3 className="font-display font-bold text-xl mt-8 mb-4">Actions & Forms</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <Link href={`/jobs/${job.id}/service-record`}>
                <Card className="p-5 flex items-center gap-4 hover:border-primary hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br from-blue-50/50 to-white">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><FileText className="w-6 h-6"/></div>
                  <div>
                    <h4 className="font-bold">Service Record</h4>
                    <p className="text-sm text-muted-foreground">Complete full inspection</p>
                  </div>
                </Card>
              </Link>
              
              <Link href={`/jobs/${job.id}/breakdown-report`}>
                <Card className="p-5 flex items-center gap-4 hover:border-rose-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br from-rose-50/50 to-white">
                  <div className="p-3 bg-rose-100 text-rose-600 rounded-xl"><Wrench className="w-6 h-6"/></div>
                  <div>
                    <h4 className="font-bold">Breakdown Report</h4>
                    <p className="text-sm text-muted-foreground">Record faults and fixes</p>
                  </div>
                </Card>
              </Link>

              {job.job_type === "installation" && (
                <Link href={`/jobs/${job.id}/commissioning`}>
                  <Card className="p-5 flex items-center gap-4 hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br from-emerald-50/50 to-white">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><ClipboardCheck className="w-6 h-6"/></div>
                    <div>
                      <h4 className="font-bold">Commissioning Record</h4>
                      <p className="text-sm text-muted-foreground">New installation commissioning</p>
                    </div>
                  </Card>
                </Link>
              )}

              <Link href={`/jobs/${job.id}/job-completion`}>
                <Card className="p-5 flex items-center gap-4 hover:border-emerald-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br from-emerald-50/50 to-white">
                  <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><ClipboardList className="w-6 h-6"/></div>
                  <div>
                    <h4 className="font-bold">Job Completion Report</h4>
                    <p className="text-sm text-muted-foreground">Summarise work & sign-off</p>
                  </div>
                </Card>
              </Link>
            </div>

            <h3 className="font-display font-bold text-xl mt-8 mb-4">Oil Service Records</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <Link href={`/jobs/${job.id}/oil-tank-inspection`}>
                <Card className="p-5 flex items-center gap-4 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br from-blue-50/50 to-white">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Droplets className="w-6 h-6"/></div>
                  <div>
                    <h4 className="font-bold">Oil Tank Inspection</h4>
                    <p className="text-sm text-muted-foreground">Tank details & condition</p>
                  </div>
                </Card>
              </Link>

              <Link href={`/jobs/${job.id}/oil-tank-risk-assessment`}>
                <Card className="p-5 flex items-center gap-4 hover:border-orange-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br from-orange-50/50 to-white">
                  <div className="p-3 bg-orange-100 text-orange-600 rounded-xl"><ShieldAlert className="w-6 h-6"/></div>
                  <div>
                    <h4 className="font-bold">Oil Tank Risk Assessment</h4>
                    <p className="text-sm text-muted-foreground">Hazards & risk ratings</p>
                  </div>
                </Card>
              </Link>

              <Link href={`/jobs/${job.id}/combustion-analysis`}>
                <Card className="p-5 flex items-center gap-4 hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br from-indigo-50/50 to-white">
                  <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><Gauge className="w-6 h-6"/></div>
                  <div>
                    <h4 className="font-bold">Combustion Analysis</h4>
                    <p className="text-sm text-muted-foreground">Flue gas readings & efficiency</p>
                  </div>
                </Card>
              </Link>

              <Link href={`/jobs/${job.id}/burner-setup`}>
                <Card className="p-5 flex items-center gap-4 hover:border-orange-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br from-amber-50/50 to-white">
                  <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><Settings className="w-6 h-6"/></div>
                  <div>
                    <h4 className="font-bold">Burner Setup Record</h4>
                    <p className="text-sm text-muted-foreground">Nozzle, pressure & electrodes</p>
                  </div>
                </Card>
              </Link>

              <Link href={`/jobs/${job.id}/fire-valve-test`}>
                <Card className="p-5 flex items-center gap-4 hover:border-red-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br from-red-50/50 to-white">
                  <div className="p-3 bg-red-100 text-red-600 rounded-xl"><ShieldCheck className="w-6 h-6"/></div>
                  <div>
                    <h4 className="font-bold">Fire Valve Test</h4>
                    <p className="text-sm text-muted-foreground">Test result & remedial action</p>
                  </div>
                </Card>
              </Link>

              <Link href={`/jobs/${job.id}/oil-line-vacuum-test`}>
                <Card className="p-5 flex items-center gap-4 hover:border-teal-500 hover:shadow-md cursor-pointer transition-all h-full bg-gradient-to-br from-teal-50/50 to-white">
                  <div className="p-3 bg-teal-100 text-teal-600 rounded-xl"><Pipette className="w-6 h-6"/></div>
                  <div>
                    <h4 className="font-bold">Oil Line Vacuum Test</h4>
                    <p className="text-sm text-muted-foreground">Pipework & vacuum readings</p>
                  </div>
                </Card>
              </Link>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="p-6 border border-border/50 shadow-sm bg-slate-50/50">
              <h3 className="font-bold mb-4 flex items-center gap-2"><User className="w-5 h-5"/> Customer</h3>
              <p className="font-bold text-lg">{job.customer?.first_name} {job.customer?.last_name}</p>
              <p className="text-sm text-muted-foreground mt-1">{job.customer?.phone}</p>
              <Link href={`/customers/${job.customer_id}`} className="text-sm text-primary hover:underline mt-2 inline-block">View Profile</Link>
            </Card>

            <Card className="p-6 border border-border/50 shadow-sm bg-slate-50/50">
              <h3 className="font-bold mb-4 flex items-center gap-2"><MapPin className="w-5 h-5"/> Location</h3>
              <p className="font-medium text-sm leading-relaxed">
                {job.property?.address_line1}<br/>
                {job.property?.postcode}
              </p>
              <Link href={`/properties/${job.property_id}`} className="text-sm text-primary hover:underline mt-2 inline-block">View Property</Link>
            </Card>
            
            {job.appliance && (
              <Card className="p-6 border border-border/50 shadow-sm bg-slate-50/50">
                <h3 className="font-bold mb-4 flex items-center gap-2"><Flame className="w-5 h-5"/> Appliance</h3>
                <p className="font-bold">{job.appliance.manufacturer} {job.appliance.model}</p>
                <p className="text-sm text-muted-foreground font-mono mt-1">SN: {job.appliance.serial_number}</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditJobForm({ job, onClose }: { job: JobLike; onClose: () => void }) {
  const qc = useQueryClient();
  const update = useUpdateJob();
  const { toast } = useToast();
  const { register, handleSubmit, reset } = useForm<JobEditData>();

  useEffect(() => {
    reset({
      status: job.status,
      priority: job.priority,
      scheduled_date: (job.scheduled_date as string)?.split('T')[0] || "",
      scheduled_time: (job.scheduled_time as string) || "",
      estimated_duration: job.estimated_duration != null ? String(job.estimated_duration) : "",
      description: (job.description as string) || "",
    });
  }, [job, reset]);

  const onSubmit = async (data: JobEditData) => {
    try {
      await update.mutateAsync({
        id: job.id,
        data: {
          status: data.status as "scheduled" | "in_progress" | "completed" | "cancelled" | "requires_follow_up",
          priority: data.priority as "low" | "medium" | "high" | "urgent",
          scheduled_date: data.scheduled_date,
          scheduled_time: data.scheduled_time || undefined,
          estimated_duration: data.estimated_duration ? Number(data.estimated_duration) : undefined,
          description: data.description || undefined,
        },
      });
      qc.invalidateQueries({ queryKey: [`/api/jobs/${job.id}`] });
      toast({ title: "Updated", description: "Job updated successfully" });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <Card className="p-6 border-primary/20 shadow-lg">
      <h3 className="font-bold text-lg mb-4">Edit Job</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("status")}>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="requires_follow_up">Requires Follow-up</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" {...register("priority")}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Scheduled Date</Label>
            <Input type="date" {...register("scheduled_date")} required />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Scheduled Time</Label>
            <Input type="time" {...register("scheduled_time")} />
          </div>
          <div className="space-y-2">
            <Label>Estimated Duration</Label>
            <Input {...register("estimated_duration")} placeholder="e.g. 1 hour" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]" {...register("description")} />
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={update.isPending}>
            <Check className="w-4 h-4 mr-2" /> {update.isPending ? "Saving..." : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
