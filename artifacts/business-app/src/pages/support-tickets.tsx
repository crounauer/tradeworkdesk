import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, ImagePlus, MessageSquare, PlusCircle, Send } from "lucide-react";

type TicketListRow = {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type TicketDetail = TicketListRow & {
  requester_name?: string | null;
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

export default function SupportTicketsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("support_issue");
  const [priority, setPriority] = useState("normal");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [replyImages, setReplyImages] = useState<File[]>([]);

  const { data: tickets = [], isLoading } = useQuery<TicketListRow[]>({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      const res = await fetch("/api/support/tickets");
      if (!res.ok) throw new Error("Failed to load tickets");
      return res.json();
    },
  });

  const effectiveTicketId = selectedTicketId || tickets[0]?.id || null;

  const { data: ticketDetail, isLoading: detailLoading } = useQuery<TicketDetail | null>({
    queryKey: ["support-ticket", effectiveTicketId],
    queryFn: async () => {
      if (!effectiveTicketId) return null;
      const res = await fetch(`/api/support/tickets/${effectiveTicketId}`);
      if (!res.ok) throw new Error("Failed to load ticket");
      return res.json();
    },
    enabled: !!effectiveTicketId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("subject", subject);
      formData.append("category", category);
      formData.append("priority", priority);
      formData.append("body", body);
      for (const image of images) formData.append("images", image);
      const res = await fetch("/api/support/tickets", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create ticket");
      return data as TicketDetail;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.setQueryData(["support-ticket", data.id], data);
      setSelectedTicketId(data.id);
      setSubject("");
      setCategory("support_issue");
      setPriority("normal");
      setBody("");
      setImages([]);
      toast({ title: "Ticket submitted", description: "Support has been notified." });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveTicketId) throw new Error("Select a ticket first");
      const formData = new FormData();
      formData.append("body", replyBody);
      for (const image of replyImages) formData.append("images", image);
      const res = await fetch(`/api/support/tickets/${effectiveTicketId}/messages`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reply");
      return data as TicketDetail;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.setQueryData(["support-ticket", data.id], data);
      setReplyBody("");
      setReplyImages([]);
      toast({ title: "Reply sent" });
    },
    onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
  });

  const ticketCountLabel = useMemo(() => `${tickets.length} ticket${tickets.length === 1 ? "" : "s"}`, [tickets.length]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Support Tickets</h1>
        <p className="text-muted-foreground">Raise support issues, feature requests, and attach screenshots.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><PlusCircle className="w-4 h-4" />New Ticket</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief summary of the issue" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="support_issue">Support Issue</option>
                    <option value="bug_report">Bug Report</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="billing">Billing</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Details</Label>
                <textarea className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe the issue, expected behaviour, and any steps to reproduce it." />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-2"><ImagePlus className="w-4 h-4" />Screenshots</Label>
                <Input type="file" accept="image/*" multiple onChange={(e) => setImages(Array.from(e.target.files || []))} />
                {images.length > 0 && <p className="text-xs text-muted-foreground">{images.length} image{images.length === 1 ? "" : "s"} selected</p>}
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !subject.trim() || !body.trim()}>
                {createMutation.isPending ? "Submitting..." : "Submit Ticket"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Tickets</CardTitle>
              <p className="text-sm text-muted-foreground">{ticketCountLabel}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && <p className="text-sm text-muted-foreground">Loading tickets...</p>}
              {!isLoading && tickets.length === 0 && <p className="text-sm text-muted-foreground">No tickets yet.</p>}
              {tickets.map((ticket) => (
                <button key={ticket.id} type="button" onClick={() => setSelectedTicketId(ticket.id)} className={`w-full rounded-xl border p-3 text-left transition ${effectiveTicketId === ticket.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground capitalize">{ticket.category.replace(/_/g, " ")} · {ticket.priority}</p>
                    </div>
                    <Badge className={statusClass(ticket.status)}>{ticket.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Updated {new Date(ticket.updated_at).toLocaleString()}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="w-4 h-4" />Conversation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!effectiveTicketId && <p className="text-sm text-muted-foreground">Create or select a ticket to view the conversation.</p>}
            {detailLoading && effectiveTicketId && <p className="text-sm text-muted-foreground">Loading conversation...</p>}
            {ticketDetail && (
              <>
                <div className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{ticketDetail.subject}</h2>
                    <Badge className={statusClass(ticketDetail.status)}>{ticketDetail.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 capitalize">{ticketDetail.category.replace(/_/g, " ")} · {ticketDetail.priority}</p>
                </div>

                <div className="space-y-3">
                  {ticketDetail.messages.map((message) => (
                    <div key={message.id} className="rounded-xl border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{message.author_name || message.author_email || "Support"}</p>
                          <p className="text-xs text-muted-foreground">{message.author_role === "super_admin" ? "Support Team" : "Your team"}</p>
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
                  <Label>Reply</Label>
                  <textarea className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Add more context or answer a support follow-up." />
                  <Input type="file" accept="image/*" multiple onChange={(e) => setReplyImages(Array.from(e.target.files || []))} />
                  {replyImages.length > 0 && <p className="text-xs text-muted-foreground">{replyImages.length} image{replyImages.length === 1 ? "" : "s"} selected</p>}
                  <div className="flex justify-end">
                    <Button onClick={() => replyMutation.mutate()} disabled={replyMutation.isPending || !replyBody.trim()}>
                      <Send className="w-4 h-4 mr-2" />{replyMutation.isPending ? "Sending..." : "Send Reply"}
                    </Button>
                  </div>
                </div>
              </>
            )}
            {!detailLoading && !ticketDetail && effectiveTicketId && (
              <div className="flex items-center gap-2 text-sm text-red-600"><AlertCircle className="w-4 h-4" />Unable to load ticket details.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}