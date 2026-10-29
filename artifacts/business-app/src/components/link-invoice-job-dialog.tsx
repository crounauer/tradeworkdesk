import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLinkableInvoiceJobs, useLinkInvoiceToJob } from "@/hooks/use-invoices";
import { useToast } from "@/hooks/use-toast";

export function LinkInvoiceJobDialog({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const jobs = useLinkableInvoiceJobs(invoiceId, search, page, true);
  const link = useLinkInvoiceToJob(invoiceId);
  const { toast } = useToast();

  async function handleLink() {
    try {
      await link.mutateAsync(selectedId);
      toast({ title: "Invoice linked to job", description: "Invoice amounts, payments and job status are unchanged." });
      onClose();
    } catch (error) {
      toast({ title: "Could not link invoice", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !link.isPending) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link invoice to an existing job</DialogTitle>
          <DialogDescription>
            Choose a job for the same customer and, if already selected, service address.
            Invoice amounts, payments and job status will not change.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor="invoice-job-search">Search jobs</Label>
          <Input
            id="invoice-job-search"
            placeholder="Job reference or description"
            value={search}
            disabled={link.isPending}
            onChange={(e) => { setSearch(e.target.value); setPage(1); setSelectedId(""); }}
          />
          {jobs.isPending ? (
            <p className="text-sm text-muted-foreground" role="status">Loading jobs...</p>
          ) : jobs.isError ? (
            <div role="alert" className="space-y-2 text-sm text-destructive">
              <p>{jobs.error.message}</p>
              <Button variant="outline" onClick={() => jobs.refetch()}>Retry</Button>
            </div>
          ) : jobs.data.jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching jobs found for this customer and service address.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2" role="radiogroup" aria-label="Existing jobs">
              {jobs.data.jobs.map(job => (
                <label key={job.id} className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer">
                  <input
                    type="radio"
                    name="invoice-existing-job"
                    value={job.id}
                    checked={selectedId === job.id}
                    disabled={link.isPending}
                    onChange={() => setSelectedId(job.id)}
                    className="mt-1"
                  />
                  <span className="text-sm min-w-0">
                    <span className="font-medium block">{job.job_ref || "Job"} — {job.description || "No description"}</span>
                    <span className="text-muted-foreground">
                      {job.scheduled_date ? new Date(`${job.scheduled_date}T00:00:00`).toLocaleDateString("en-GB") : "Not scheduled"}
                      {" · "}{job.status.replace(/_/g, " ")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {jobs.data && jobs.data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <Button variant="outline" size="sm" disabled={page === 1 || link.isPending}
                onClick={() => { setPage(page - 1); setSelectedId(""); }}>Previous</Button>
              <span>Page {page} of {jobs.data.pagination.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= jobs.data.pagination.totalPages || link.isPending}
                onClick={() => { setPage(page + 1); setSelectedId(""); }}>Next</Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={link.isPending} onClick={onClose}>Cancel</Button>
          <Button disabled={!selectedId || jobs.isFetching || jobs.isError || link.isPending} onClick={handleLink}>
            {link.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Link to job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
