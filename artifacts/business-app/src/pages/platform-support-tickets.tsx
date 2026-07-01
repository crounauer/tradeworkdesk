import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, ImagePlus, LifeBuoy, Send } from "lucide-react";

type TicketRow = {
  id: string;
  tenant_id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  requester_name: string | null;
  requester_email: string | null;
  created_at: string;
  updated_at: string;
  tenants?: { company_name?: string | null } | null;
};

type TicketDetail = TicketRow & {
  requester_phone?: string | null;
  messages: Array<{
    id: string;
    author_name: string | null;
    author_email: string | null;
    author_role: string;
    body: string;
    status_after?: string | null;
    created_at: string;
    attachments: Array<{ id: string; file_name: string; file_url: string }>;
  }>;
};

function statusClass(status: string) {
  if (status === "resolved" || status === "closed") return "bg-green-100 text-green-700";
  if (status === "in_progress") return "bg-blue-100 text-blue-700";
  if (status === "waiting_on_customer") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

export default function PlatformSupportTicketsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const initialTicketId = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("ticketId");
  }, []);
  const [statusFilter, setStatusFilter] = useState("open");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(initialTicketId);
  const [replyBody, setReplyBody] = useState("");
  const [nextStatus, setNextStatus] = useState("in_progress");
  const [images, setImages] = useState<File[]>([]);

  const { data: tickets = [], isLoading } = useQuery<TicketRow[]>({
    queryKey: ["platform-support-tickets", statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/platform/support-tickets?status=${encodeURIComponent(statusFilter)}`);
      if (!res.ok) throw new Error("Failed to load tickets");
      return res.json();
    },
  });

  const effectiveTicketId = selectedTicketId || tickets[0]?.id || null;
  const { data: ticketDetail, isLoading: detailLoading } = useQuery<TicketDetail | null>({
    queryKey: ["platform-support-ticket", effectiveTicketId],
    queryFn: async () => {
      if (!effectiveTicketId) return null;
      const res = await fetch(`/api/platform/support-tickets/${effectiveTicketId}`);
      if (!res.ok) throw new Error("Failed to load ticket");
      return res.json();
    },
    enabled: !!effectiveTicketId,
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveTicketId) throw new Error("Select a ticket");
      const formData = new FormData();
      if (replyBody.trim()) formData.append("body", replyBody);
      formData.append("status", nextStatus);
      for (const image of images) formData.append("images", image);
      const res = await fetch(`/api/platform/support-tickets/${effectiveTicketId}/messages`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update ticket");
      return data as TicketDetail;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["platform-support-tickets"] });
      qc.setQueryData(["platform-support-ticket", data.id], data);
      setReplyBody("");
      setImages([]);
      toast({ title: "Ticket updated" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Support Tickets</h1>
        <p className="text-muted-foreground">Review tenant issues, feature requests, and reply in one place.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><LifeBuoy className="w-4 h-4" />Ticket Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Status Filter</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_on_customer">Waiting on Customer</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
                <option value="all">All</option>
              </select>
            </div>
            {isLoading && <p className="text-sm text-muted-foreground">Loading tickets...</p>}
            {!isLoading && tickets.length === 0 && <p className="text-sm text-muted-foreground">No tickets in this view.</p>}
            {tickets.map((ticket) => (
              <button key={ticket.id} type="button" onClick={() => { setSelectedTicketId(ticket.id); setNextStatus(ticket.status); }} className={`w-full rounded-xl border p-3 text-left transition ${effectiveTicketId === ticket.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">{ticket.tenants?.company_name || ticket.tenant_id}</p>
                    <p className="text-xs text-muted-foreground capitalize">{ticket.category.replace(/_/g, " ")} · {ticket.priority}</p>
                  </div>
                  <Badge className={statusClass(ticket.status)}>{ticket.status.replace(/_/g, " ")}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Updated {new Date(ticket.updated_at).toLocaleString()}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Eye className="w-4 h-4" />Ticket Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!effectiveTicketId && <p className="text-sm text-muted-foreground">Select a ticket to review.</p>}
            {detailLoading && effectiveTicketId && <p className="text-sm text-muted-foreground">Loading ticket...</p>}
            {ticketDetail && (
              <>
                <div className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{ticketDetail.subject}</h2>
                    <Badge className={statusClass(ticketDetail.status)}>{ticketDetail.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{ticketDetail.tenants?.company_name || ticketDetail.tenant_id} · {ticketDetail.requester_name || ticketDetail.requester_email || "Unknown requester"}</p>
                </div>

                <div className="space-y-3">
                  {ticketDetail.messages.map((message) => (
                    <div key={message.id} className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{message.author_name || message.author_email || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{message.author_role === "super_admin" ? "Support Team" : "Tenant"}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{new Date(message.created_at).toLocaleString()}</p>
                      </div>
                      <p className="whitespace-pre-wrap text-sm mt-3">{message.body}</p>
                      {message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {message.attachments.map((attachment) => (
                            <a key={attachment.id} href={attachment.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50">
                              {attachment.file_name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border p-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-end">
                    <div className="space-y-1.5">
                      <Label>Next Status</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="waiting_on_customer">Waiting on Customer</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-2"><ImagePlus className="w-4 h-4" />Attach Images</Label>
                      <Input type="file" accept="image/*" multiple onChange={(e) => setImages(Array.from(e.target.files || []))} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Reply</Label>
                    <textarea className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Write an update or action note for the tenant." />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => replyMutation.mutate()} disabled={replyMutation.isPending || (!replyBody.trim() && nextStatus === ticketDetail.status)}>
                      <Send className="w-4 h-4 mr-2" />{replyMutation.isPending ? "Sending..." : "Post Update"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}