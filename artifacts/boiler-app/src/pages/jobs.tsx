import { useListJobs } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import { Briefcase, Calendar, MapPin, User, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function Jobs() {
  const { data: jobs, isLoading } = useListJobs();

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'in_progress': return 'bg-amber-100 text-amber-700';
      case 'completed': return 'bg-emerald-100 text-emerald-700';
      case 'requires_follow_up': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold">Jobs</h1>
          <p className="text-muted-foreground mt-1">Manage all service visits</p>
        </div>
        <Button>New Job</Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {jobs?.map(job => (
            <Link key={job.id} href={`/jobs/${job.id}`}>
              <Card className="p-4 sm:p-5 border border-border/50 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${getStatusColor(job.status)}`}>
                      {job.status.replace('_', ' ')}
                    </span>
                    <span className="text-sm font-semibold capitalize text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md">
                      {job.job_type.replace('_', ' ')}
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
