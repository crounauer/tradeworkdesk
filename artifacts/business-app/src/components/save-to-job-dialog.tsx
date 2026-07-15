import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useCreateJobNote } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface Job {
  id: string;
  job_number: string;
  job_type?: string;
  status: string;
  customer?: { first_name: string; last_name: string };
  address?: string;
}

interface SaveToJobDialogProps {
  open: boolean;
  onClose: () => void;
  content: string;
  toolName: string;
}

export function SaveToJobDialog({ open, onClose, content, toolName }: SaveToJobDialogProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const createNote = useCreateJobNote();
  const [search, setSearch] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs", { limit: 50 }],
    queryFn: async () => {
      const res = await fetch("/api/jobs?limit=50&sort=created_at_desc");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.jobs ?? []);
    },
    enabled: open,
  });

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase();
    const name = j.customer ? `${j.customer.first_name} ${j.customer.last_name}`.toLowerCase() : "";
    return !q || j.job_number?.toLowerCase().includes(q) || name.includes(q) || j.address?.toLowerCase().includes(q);
  });

  async function handleSave() {
    if (!selectedJobId) return;
    setSaving(true);
    try {
      await createNote.mutateAsync({ jobId: selectedJobId, data: { content } });
      toast({ title: `${toolName} saved to job` });
      setSelectedJobId(null);
      setSearch("");
      onClose();
    } catch (e) {
      toast({ title: "Failed to save", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSelectedJobId(null); setSearch(""); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save to Job</DialogTitle>
        </DialogHeader>

        {/* Guest: prompt to sign up */}
        {!session ? (
          <div className="py-4 space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Create a free TradeWorkDesk account to save calculation results directly to your jobs, access your history, and manage your engineering business from one place.
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/register" onClick={onClose}>
                <Button className="w-full gap-2">
                  Start 30-Day Free Trial <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/login" onClick={onClose}>
                <Button variant="outline" className="w-full">Already have an account? Log in</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by job number, customer or address" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-border rounded-md border">
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No jobs found</p>
                )}
                {filtered.map(j => (
                  <button
                    key={j.id}
                    onClick={() => setSelectedJobId(j.id)}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors ${selectedJobId === j.id ? "bg-primary/10 font-medium" : ""}`}
                  >
                    <span className="font-mono text-xs text-muted-foreground mr-2">{j.job_number}</span>
                    {j.customer ? `${j.customer.first_name} ${j.customer.last_name}` : "Unknown"}
                    {j.address && <span className="ml-1 text-muted-foreground text-xs">· {j.address}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {session && (
        <DialogFooter>
          <Button variant="outline" onClick={() => { setSelectedJobId(null); setSearch(""); onClose(); }}>Cancel</Button>
          <Button onClick={handleSave} disabled={!selectedJobId || saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save to Job
          </Button>
        </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
