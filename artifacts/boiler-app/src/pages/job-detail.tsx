import { useGetJob } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, MapPin, User, FileText, Wrench, AlertTriangle, FileSignature } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: job, isLoading } = useGetJob(id);

  if (isLoading) return <div className="p-8">Loading job details...</div>;
  if (!job) return <div>Job not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
      <Link href="/jobs" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Jobs
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-display font-bold">Job #{job.id.slice(0, 8)}</h1>
            <span className="px-3 py-1 rounded-md text-sm font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
              {job.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-lg text-muted-foreground capitalize">{job.job_type.replace('_', ' ')}</p>
        </div>
      </div>

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
    </div>
  );
}
