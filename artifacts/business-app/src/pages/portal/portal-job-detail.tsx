import { useQuery } from "@tanstack/react-query";
import { usePortalAuth } from "@/hooks/use-portal-auth";
import { PortalLayout } from "./portal-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";
import { ArrowLeft, Calendar, Clock, MapPin, Wrench, FileText, Download, CheckCircle, AlertTriangle } from "lucide-react";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-500",
  requires_follow_up: "bg-rose-100 text-rose-700",
};

const statusLabels: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  requires_follow_up: "Follow Up",
};

export default function PortalJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { session } = usePortalAuth();

  const { data: job, isLoading } = useQuery({
    queryKey: ["portal-job", id],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/jobs/${id}`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) throw new Error("Failed to load job");
      return res.json();
    },
    enabled: !!session && !!id,
    staleTime: 30_000,
  });

  const downloadCertificate = async (formType: string) => {
    if (!session) return;
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}api/portal/jobs/${id}/certificate?form=${formType}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Certificate not available");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate-${id?.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download certificate");
    }
  };

  if (isLoading) {
    return (
      <PortalLayout>
        <div className="space-y-4 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-32" />
          <div className="h-8 bg-slate-200 rounded w-64" />
          <div className="h-40 bg-slate-200 rounded" />
        </div>
      </PortalLayout>
    );
  }

  if (!job) {
    return (
      <PortalLayout>
        <div className="text-center py-12">
          <p className="text-slate-500">Job not found</p>
          <Link href="/portal/jobs">
            <Button variant="outline" className="mt-4">Back to Jobs</Button>
          </Link>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6 animate-in fade-in">
        <Link href="/portal/jobs" className="inline-flex items-center text-sm text-slate-500 hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Service History
        </Link>

        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {job.job_ref ? `Job #${job.job_ref}` : "Service Record"}
              </h1>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColors[job.status] || "bg-slate-100 text-slate-600"}`}>
                {statusLabels[job.status] || job.status}
              </span>
            </div>
            <p className="text-slate-500 capitalize">{job.job_type?.replace(/_/g, " ") || "Service"}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {job.scheduled_date && (
            <Card className="p-4 border border-slate-200">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <Calendar className="w-4 h-4" />
                <span>Date</span>
              </div>
              <p className="font-medium text-slate-900">
                {new Date(job.scheduled_date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </Card>
          )}
          {job.scheduled_time && (
            <Card className="p-4 border border-slate-200">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <Clock className="w-4 h-4" />
                <span>Time</span>
              </div>
              <p className="font-medium text-slate-900">{job.scheduled_time.slice(0, 5)}</p>
            </Card>
          )}
          {job.property_address && (
            <Card className="p-4 border border-slate-200">
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <MapPin className="w-4 h-4" />
                <span>Property</span>
              </div>
              <p className="font-medium text-slate-900">{job.property_address}</p>
            </Card>
          )}
        </div>

        {job.description && (
          <Card className="p-5 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Description</h3>
            <p className="text-slate-900">{job.description}</p>
          </Card>
        )}

        {job.service_records?.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">Service Records</h2>
            <div className="space-y-3">
              {job.service_records.map((sr: any) => (
                <Card key={sr.id} className="p-5 border border-slate-200">
                  <div className="space-y-3">
                    {sr.work_completed && (
                      <div>
                        <p className="text-sm font-medium text-slate-500">Work Completed</p>
                        <p className="text-slate-900 mt-0.5">{sr.work_completed}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm">
                      {sr.appliance_safe !== undefined && (
                        <div className="flex items-center gap-1.5">
                          {sr.appliance_safe ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          )}
                          <span className={sr.appliance_safe ? "text-emerald-700" : "text-red-700"}>
                            {sr.appliance_safe ? "Appliance Safe" : "Appliance Unsafe"}
                          </span>
                        </div>
                      )}
                      {sr.follow_up_required && (
                        <span className="text-amber-700 font-medium">Follow-up Required</span>
                      )}
                      {sr.next_service_due && (
                        <span className="text-slate-500">
                          Next service: {new Date(sr.next_service_due + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    {sr.additional_notes && (
                      <div>
                        <p className="text-sm font-medium text-slate-500">Notes</p>
                        <p className="text-slate-700 text-sm mt-0.5">{sr.additional_notes}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {job.completion_reports?.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">Completion Reports</h2>
            <div className="space-y-3">
              {job.completion_reports.map((cr: any) => (
                <Card key={cr.id} className="p-5 border border-slate-200">
                  <div className="space-y-3">
                    {cr.work_completed && (
                      <div>
                        <p className="text-sm font-medium text-slate-500">Work Completed</p>
                        <p className="text-slate-900 mt-0.5">{cr.work_completed}</p>
                      </div>
                    )}
                    {cr.next_service_date && (
                      <p className="text-sm text-slate-500">
                        Next service: {new Date(cr.next_service_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                    {cr.additional_notes && (
                      <div>
                        <p className="text-sm font-medium text-slate-500">Notes</p>
                        <p className="text-slate-700 text-sm mt-0.5">{cr.additional_notes}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {job.status === "completed" && (
          <Card className="p-5 border border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Download Certificates
            </h3>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" onClick={() => downloadCertificate("service_record")}>
                <Download className="w-4 h-4 mr-2" /> Service Record PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadCertificate("job_completion")}>
                <Download className="w-4 h-4 mr-2" /> Completion Report PDF
              </Button>
            </div>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
