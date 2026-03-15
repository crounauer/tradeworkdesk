import { useGetProperty } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Home, Flame, MapPin, Briefcase } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: property, isLoading, error } = useGetProperty(id);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (error || !property) return <div className="p-8 text-destructive">Property not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in">
      <Link href="/properties" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Properties
      </Link>

      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
          <Home className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">{property.address_line1}</h1>
          <p className="text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="w-4 h-4" /> {property.city}, {property.postcode}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-6 border border-border/50 shadow-sm">
          <h3 className="font-bold text-lg border-b border-border/50 pb-2 mb-4">Details</h3>
          <div className="space-y-3 text-sm">
            {property.address_line2 && (
              <div><span className="text-muted-foreground">Address Line 2:</span> <span className="font-medium">{property.address_line2}</span></div>
            )}
            {property.access_notes && (
              <div><span className="text-muted-foreground">Access:</span> <span className="font-medium">{property.access_notes}</span></div>
            )}
            {property.customer && (
              <div className="pt-3 border-t border-border/50">
                <span className="text-muted-foreground">Customer:</span>{" "}
                <Link href={`/customers/${property.customer_id}`} className="text-primary hover:underline font-medium">
                  {property.customer.first_name} {property.customer.last_name}
                </Link>
              </div>
            )}
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2"><Flame className="w-5 h-5 text-orange-500" /> Appliances</h2>
            {!property.appliances || property.appliances.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <Flame className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-muted-foreground">No appliances at this property.</p>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {property.appliances.map((app) => (
                  <Card key={app.id} className="p-5 border border-border/50 hover:border-orange-500/30 transition-colors">
                    <h4 className="font-bold">{app.manufacturer} {app.model}</h4>
                    <p className="text-sm text-muted-foreground font-mono mt-1">SN: {app.serial_number || "N/A"}</p>
                    {app.next_service_due && (
                      <p className="text-sm mt-2">
                        Next service: <span className={new Date(app.next_service_due) < new Date() ? "text-destructive font-bold" : "text-emerald-600 font-medium"}>
                          {formatDate(app.next_service_due)}
                        </span>
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>

          {property.recent_jobs && property.recent_jobs.length > 0 && (
            <div>
              <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5 text-purple-500" /> Recent Jobs</h2>
              <div className="space-y-3">
                {property.recent_jobs.map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`}>
                    <Card className="p-4 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold capitalize">{job.job_type?.replace("_", " ")}</p>
                          <p className="text-sm text-muted-foreground">{job.technician_name || "Unassigned"}</p>
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
