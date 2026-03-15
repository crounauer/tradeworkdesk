import { useGetAppliance } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Flame, Briefcase } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function ApplianceDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: appliance, isLoading, error } = useGetAppliance(id);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (error || !appliance) return <div className="p-8 text-destructive">Appliance not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <Link href="/appliances" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Appliances
      </Link>

      <div className="flex items-center gap-4">
        <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl">
          <Flame className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">{appliance.manufacturer} {appliance.model}</h1>
          <p className="text-muted-foreground font-mono mt-1">SN: {appliance.serial_number || "N/A"}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-6 border border-border/50 shadow-sm">
          <h3 className="font-bold text-lg border-b border-border/50 pb-2 mb-4">Specifications</h3>
          <div className="space-y-3 text-sm">
            <div><span className="text-muted-foreground">Type:</span> <span className="font-medium capitalize">{appliance.boiler_type || "N/A"}</span></div>
            <div><span className="text-muted-foreground">Fuel:</span> <span className="font-medium capitalize">{appliance.fuel_type || "N/A"}</span></div>
            {appliance.burner_make && <div><span className="text-muted-foreground">Burner:</span> <span className="font-medium">{appliance.burner_make} {appliance.burner_model}</span></div>}
            {appliance.installation_date && <div><span className="text-muted-foreground">Installed:</span> <span className="font-medium">{formatDate(appliance.installation_date)}</span></div>}
            <div className="pt-3 border-t border-border/50">
              <span className="text-muted-foreground">Last Service:</span> <span className="font-medium">{formatDate(appliance.last_service_date)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Next Service:</span>{" "}
              <span className={`font-bold ${appliance.next_service_due && new Date(appliance.next_service_due) < new Date() ? "text-destructive" : "text-emerald-600"}`}>
                {formatDate(appliance.next_service_due)}
              </span>
            </div>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {appliance.property && (
            <Card className="p-6 border border-border/50 shadow-sm bg-slate-50/50">
              <h3 className="font-bold mb-2">Installed At</h3>
              <Link href={`/properties/${appliance.property_id}`} className="text-primary hover:underline font-medium">
                {appliance.property.address_line1}, {appliance.property.postcode}
              </Link>
            </Card>
          )}

          {appliance.recent_jobs && appliance.recent_jobs.length > 0 && (
            <div>
              <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5 text-purple-500" /> Service History</h2>
              <div className="space-y-3">
                {appliance.recent_jobs.map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <Card className="p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold capitalize">{job.job_type?.replace("_", " ")}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(job.scheduled_date)} - {job.technician_name || "Unassigned"}</p>
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 capitalize">
                          {job.status?.replace("_", " ")}
                        </span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
