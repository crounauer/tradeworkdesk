import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListCustomers, useListProperties } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import {
  ArrowLeft, Phone, Mail, MapPin, MessageSquare, Send,
  Briefcase, Clock, Edit, Check, X, Trash2,
  Camera, ImagePlus, Loader2, ChevronLeft, ChevronRight, Paperclip
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SOURCE_LABELS: Record<string, string> = {
  phone: "Phone", email: "Email", text: "Text/SMS", facebook: "Facebook",
  whatsapp: "WhatsApp", messenger: "Messenger", website: "Website",
  referral: "Referral", other: "Other",
};

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-blue-100 text-blue-700" },
  { value: "contacted", label: "Contacted", color: "bg-amber-100 text-amber-700" },
  { value: "quoted", label: "Quoted", color: "bg-purple-100 text-purple-700" },
  { value: "converted", label: "Converted", color: "bg-emerald-100 text-emerald-700" },
  { value: "lost", label: "Lost", color: "bg-slate-100 text-slate-500" },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

interface JobType {
  id: number;
  name: string;
  slug: string;
  category: string;
  is_active: boolean;
}

interface FileAttachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  signed_url: string | null;
  thumbnail_signed_url: string | null;
  uploaded_by: string;
  note_id: string | null;
  created_at: string;
}

function EnquiryPhotosCard({ enquiryId, canEdit, userId, isAdmin }: {
  enquiryId: string;
  canEdit: boolean;
  userId: string | undefined;
  isAdmin: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: photos = [], isLoading } = useQuery<FileAttachment[]>({
    queryKey: ["enquiry-photos", enquiryId],
    queryFn: async () => {
      const res = await fetch(`/api/files?entity_type=enquiry&entity_id=${enquiryId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const allImagePhotos = photos.filter(p => p.file_type?.startsWith("image/"));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("entity_type", "enquiry");
      formData.append("entity_id", enquiryId);

      if (files.length === 1) {
        formData.append("file", files[0]);
        const res = await fetch(`/api/files/upload`, { method: "POST", body: formData });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Upload failed"); }
      } else {
        for (let i = 0; i < files.length; i++) {
          formData.append("files", files[i]);
        }
        const res = await fetch(`/api/files/upload-multiple`, { method: "POST", body: formData });
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Upload failed"); }
        const result = await res.json();
        if (result.failed > 0) {
          toast({ title: "Partial upload", description: `${result.files.length} uploaded, ${result.failed} failed`, variant: "destructive" });
        }
      }

      qc.invalidateQueries({ queryKey: ["enquiry-photos", enquiryId] });
      toast({ title: "Photos uploaded", description: `${files.length} photo${files.length > 1 ? "s" : ""} added` });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm("Delete this photo?")) return;
    setDeletingId(fileId);
    try {
      const res = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      qc.invalidateQueries({ queryKey: ["enquiry-photos", enquiryId] });
      toast({ title: "Photo deleted" });
      if (lightboxIdx !== null) setLightboxIdx(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete photo", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const lightboxPhoto = lightboxIdx !== null ? allImagePhotos[lightboxIdx] : null;

  return (
    <>
      <Card className="p-6 border border-border/50 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-500" /> Photos
            {allImagePhotos.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">({allImagePhotos.length})</span>
            )}
          </h3>
          {canEdit && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Uploading...</>
                ) : (
                  <><ImagePlus className="w-4 h-4 mr-1" /> Add Photos</>
                )}
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading photos...</p>
        ) : allImagePhotos.length === 0 ? (
          <div className="text-center py-6">
            <Camera className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">No photos attached yet.</p>
            {canEdit && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="w-4 h-4 mr-1" /> Upload Photos
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {allImagePhotos.map((photo, idx) => (
              <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100 cursor-pointer">
                <img
                  src={photo.thumbnail_signed_url || photo.signed_url || ""}
                  alt={photo.file_name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  onClick={() => setLightboxIdx(idx)}
                  loading="lazy"
                />
                {(isAdmin || photo.uploaded_by === userId) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                    disabled={deletingId === photo.id}
                    className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {lightboxPhoto && (
        <Dialog open={lightboxIdx !== null} onOpenChange={() => setLightboxIdx(null)}>
          <DialogContent className="sm:max-w-[90vw] max-h-[90vh] p-2 bg-black/95 border-none">
            <div className="relative flex items-center justify-center min-h-[50vh]">
              <img
                src={lightboxPhoto.signed_url || ""}
                alt={lightboxPhoto.file_name}
                className="max-w-full max-h-[80vh] object-contain rounded"
              />
              {allImagePhotos.length > 1 && (
                <>
                  <button
                    onClick={() => setLightboxIdx((lightboxIdx! - 1 + allImagePhotos.length) % allImagePhotos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setLightboxIdx((lightboxIdx! + 1) % allImagePhotos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center justify-between px-2 py-1">
              <p className="text-white/70 text-xs truncate">{lightboxPhoto.file_name}</p>
              <p className="text-white/50 text-xs">{lightboxIdx! + 1} / {allImagePhotos.length}</p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function NotePhotos({ noteId, photos, enquiryId, userId, isAdmin }: {
  noteId: string;
  photos: FileAttachment[];
  enquiryId: string;
  userId: string | undefined;
  isAdmin: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const notePhotos = photos.filter(p => p.note_id === noteId && p.file_type?.startsWith("image/"));

  if (notePhotos.length === 0) return null;

  const handleDelete = async (fileId: string) => {
    if (!confirm("Delete this photo?")) return;
    setDeletingId(fileId);
    try {
      const res = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      qc.invalidateQueries({ queryKey: ["enquiry-photos", enquiryId] });
      toast({ title: "Photo deleted" });
      if (lightboxIdx !== null) setLightboxIdx(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete photo", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const lightboxPhoto = lightboxIdx !== null ? notePhotos[lightboxIdx] : null;

  return (
    <>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {notePhotos.map((photo, idx) => (
          <div
            key={photo.id}
            className="relative group w-16 h-16 rounded-md overflow-hidden bg-slate-100 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
            onClick={() => setLightboxIdx(idx)}
          >
            <img
              src={photo.thumbnail_signed_url || photo.signed_url || ""}
              alt={photo.file_name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {(isAdmin || photo.uploaded_by === userId) && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                disabled={deletingId === photo.id}
                className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {lightboxPhoto && (
        <Dialog open={lightboxIdx !== null} onOpenChange={() => setLightboxIdx(null)}>
          <DialogContent className="sm:max-w-[90vw] max-h-[90vh] p-2 bg-black/95 border-none">
            <div className="relative flex items-center justify-center min-h-[50vh]">
              <img
                src={lightboxPhoto.signed_url || ""}
                alt={lightboxPhoto.file_name}
                className="max-w-full max-h-[80vh] object-contain rounded"
              />
              {notePhotos.length > 1 && (
                <>
                  <button
                    onClick={() => setLightboxIdx((lightboxIdx! - 1 + notePhotos.length) % notePhotos.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setLightboxIdx((lightboxIdx! + 1) % notePhotos.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function EnquiryDetailContent() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [sendingNote, setSendingNote] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [noteFiles, setNoteFiles] = useState<File[]>([]);
  const noteFileInputRef = useRef<HTMLInputElement>(null);

  const { data: enquiry, isLoading } = useQuery({
    queryKey: ["enquiry", id],
    queryFn: async () => {
      const res = await fetch(`/api/enquiries/${id}`);
      if (!res.ok) throw new Error("Failed to load enquiry");
      return res.json();
    },
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ["enquiry-notes", id],
    queryFn: async () => {
      const res = await fetch(`/api/enquiries/${id}/notes`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: allPhotos = [] } = useQuery<FileAttachment[]>({
    queryKey: ["enquiry-photos", id],
    queryFn: async () => {
      const res = await fetch(`/api/files?entity_type=enquiry&entity_id=${id}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/enquiries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      qc.invalidateQueries({ queryKey: ["enquiry", id] });
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      toast({ title: "Status updated" });
    } catch {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() && noteFiles.length === 0) return;
    setSendingNote(true);
    try {
      let noteId: string | null = null;

      const noteContent = noteText.trim() || (noteFiles.length > 0 ? `Attached ${noteFiles.length} photo${noteFiles.length > 1 ? "s" : ""}` : "");
      if (noteContent) {
        const res = await fetch(`/api/enquiries/${id}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: noteContent }),
        });
        if (!res.ok) throw new Error("Failed to add note");
        const noteData = await res.json();
        noteId = noteData.id;
      }

      if (noteFiles.length > 0) {
        const formData = new FormData();
        formData.append("entity_type", "enquiry");
        formData.append("entity_id", id!);
        if (noteId) formData.append("note_id", noteId);

        if (noteFiles.length === 1) {
          formData.append("file", noteFiles[0]);
          const res = await fetch(`/api/files/upload`, { method: "POST", body: formData });
          if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Photo upload failed"); }
        } else {
          for (const f of noteFiles) formData.append("files", f);
          const res = await fetch(`/api/files/upload-multiple`, { method: "POST", body: formData });
          if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Photo upload failed"); }
          const result = await res.json();
          if (result.failed > 0) {
            toast({ title: "Partial upload", description: `${result.files?.length || 0} photo(s) uploaded, ${result.failed} failed` });
          }
        }
      }

      setNoteText("");
      setNoteFiles([]);
      qc.invalidateQueries({ queryKey: ["enquiry-notes", id] });
      qc.invalidateQueries({ queryKey: ["enquiry-photos", id] });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to add note", variant: "destructive" });
    } finally {
      setSendingNote(false);
    }
  };

  const previewUrls = useMemo(() => noteFiles.map(f => URL.createObjectURL(f)), [noteFiles]);

  useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const handleNoteFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setNoteFiles(prev => [...prev, ...Array.from(files)]);
    if (noteFileInputRef.current) noteFileInputRef.current.value = "";
  }, []);

  const removeNoteFile = useCallback((idx: number) => {
    const urlToRevoke = previewUrls[idx];
    if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    setNoteFiles(prev => prev.filter((_, i) => i !== idx));
  }, [previewUrls]);

  const handleDelete = async () => {
    if (!confirm("Delete this enquiry? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/enquiries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      qc.invalidateQueries({ queryKey: ["enquiries"] });
      navigate("/enquiries");
      toast({ title: "Enquiry deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="p-8">Loading enquiry...</div>;
  if (!enquiry) return <div className="p-8">Enquiry not found</div>;

  const statusOpt = STATUS_OPTIONS.find(s => s.value === enquiry.status);
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const canEdit = profile?.role === "admin" || profile?.role === "office_staff" || profile?.role === "super_admin";
  const canConvert = canEdit && enquiry.status !== "converted";

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
      <Link href="/enquiries" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Enquiries
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl font-display font-bold">{enquiry.contact_name}</h1>
            <span className={`px-3 py-1 rounded-md text-sm font-bold uppercase tracking-wider ${statusOpt?.color || "bg-slate-100"}`}>
              {statusOpt?.label || enquiry.status}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[enquiry.priority] || ""}`}>
              {enquiry.priority}
            </span>
          </div>
          <p className="text-muted-foreground">
            Via {SOURCE_LABELS[enquiry.source] || enquiry.source} · {new Date(enquiry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canConvert && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={() => setShowConvert(true)}>
              <Briefcase className="w-4 h-4" /> Convert to Job
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {editing ? (
            <EditEnquiryForm enquiry={enquiry} onClose={() => { setEditing(false); qc.invalidateQueries({ queryKey: ["enquiry", id] }); qc.invalidateQueries({ queryKey: ["enquiries"] }); }} />
          ) : (
            <Card className="p-6 border border-border/50 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Enquiry Details</h3>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    <Edit className="w-4 h-4 mr-1" /> Edit
                  </Button>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-y-4 gap-x-8">
                {enquiry.contact_phone && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><Phone className="w-4 h-4" /> Phone</p>
                    <a href={`tel:${enquiry.contact_phone}`} className="font-medium text-primary hover:underline">{enquiry.contact_phone}</a>
                  </div>
                )}
                {enquiry.contact_email && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><Mail className="w-4 h-4" /> Email</p>
                    <a href={`mailto:${enquiry.contact_email}`} className="font-medium text-primary hover:underline">{enquiry.contact_email}</a>
                  </div>
                )}
                {enquiry.address && (
                  <div className="sm:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="w-4 h-4" /> Address</p>
                    <p className="font-medium">{enquiry.address}</p>
                  </div>
                )}
                <div className="sm:col-span-2 pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-foreground whitespace-pre-wrap">{enquiry.description || "No description provided."}</p>
                </div>
                {enquiry.notes && (
                  <div className="sm:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                    <p className="text-foreground whitespace-pre-wrap">{enquiry.notes}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {enquiry.linked_job_id && (
            <Card className="p-4 border border-emerald-200 bg-emerald-50/50">
              <div className="flex items-center gap-3">
                <Briefcase className="w-5 h-5 text-emerald-600" />
                <div className="flex-1">
                  <p className="font-bold text-emerald-800">Converted to Job</p>
                  <p className="text-sm text-emerald-600">Job #{String(enquiry.linked_job_id).slice(0, 8)}</p>
                </div>
                <Link href={`/jobs/${enquiry.linked_job_id}`}>
                  <Button variant="outline" size="sm">View Job</Button>
                </Link>
              </div>
            </Card>
          )}

          <EnquiryPhotosCard
            enquiryId={id!}
            canEdit={canEdit}
            userId={profile?.id}
            isAdmin={isAdmin}
          />

          <Card className="p-6 border border-border/50 shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" /> Activity / Notes
            </h3>

            {notesLoading ? (
              <p className="text-muted-foreground text-sm">Loading notes...</p>
            ) : notes.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No notes yet. Add a follow-up note below.</p>
            ) : (
              <div className="space-y-3 mb-4">
                {notes.map((note: Record<string, unknown>) => (
                  <div key={note.id as string} className="border-l-2 border-primary/30 pl-4 py-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold">{(note.author as Record<string, string>)?.full_name || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.created_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.content as string}</p>
                    <NotePhotos noteId={note.id as string} photos={allPhotos} enquiryId={id!} userId={profile?.id} isAdmin={isAdmin} />
                  </div>
                ))}
              </div>
            )}

            {canEdit && (
              <div className="pt-2 border-t border-border/50 space-y-2">
                {noteFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {noteFiles.map((f, idx) => (
                      <div key={idx} className="relative group">
                        <div className="w-14 h-14 rounded-md overflow-hidden bg-slate-100">
                          <img
                            src={previewUrls[idx]}
                            alt={f.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          onClick={() => removeNoteFile(idx)}
                          className="absolute -top-1 -right-1 p-0.5 bg-red-500 hover:bg-red-600 rounded-full text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <div className="flex-1 flex gap-1">
                    <Input
                      placeholder="Add a note..."
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                    />
                    <input
                      ref={noteFileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleNoteFilesChange}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={() => noteFileInputRef.current?.click()}
                      title="Attach photos"
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button
                    size="icon"
                    onClick={handleAddNote}
                    disabled={sendingNote || (!noteText.trim() && noteFiles.length === 0)}
                  >
                    {sendingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 border border-border/50 shadow-sm bg-slate-50/50">
            <h3 className="font-bold mb-4">Update Status</h3>
            <div className="space-y-2">
              {STATUS_OPTIONS.filter(s => s.value !== "converted").map(s => (
                <button
                  key={s.value}
                  onClick={() => handleStatusChange(s.value)}
                  disabled={enquiry.status === s.value || enquiry.status === "converted"}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    enquiry.status === s.value
                      ? `${s.color} ring-2 ring-primary/30`
                      : "hover:bg-slate-100 text-muted-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Card>

          {enquiry.created_by_profile && (
            <Card className="p-6 border border-border/50 shadow-sm bg-slate-50/50">
              <h3 className="font-bold mb-2">Created By</h3>
              <p className="text-sm">{enquiry.created_by_profile.full_name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(enquiry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </Card>
          )}

          {enquiry.customer && (
            <Card className="p-6 border border-border/50 shadow-sm bg-slate-50/50">
              <h3 className="font-bold mb-2">Linked Customer</h3>
              <p className="font-medium">{enquiry.customer.first_name} {enquiry.customer.last_name}</p>
              <Link href={`/customers/${enquiry.customer.id}`} className="text-sm text-primary hover:underline mt-1 inline-block">View Customer</Link>
            </Card>
          )}
        </div>
      </div>

      {showConvert && (
        <ConvertToJobDialog
          open={showConvert}
          onOpenChange={setShowConvert}
          enquiry={enquiry}
          onConverted={(jobId: string) => {
            qc.invalidateQueries({ queryKey: ["enquiry", id] });
            qc.invalidateQueries({ queryKey: ["enquiries"] });
            navigate(`/jobs/${jobId}`);
          }}
        />
      )}
    </div>
  );
}

function EditEnquiryForm({ enquiry, onClose }: { enquiry: Record<string, unknown>; onClose: () => void }) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    contact_name: (enquiry.contact_name as string) || "",
    contact_phone: (enquiry.contact_phone as string) || "",
    contact_email: (enquiry.contact_email as string) || "",
    source: (enquiry.source as string) || "phone",
    description: (enquiry.description as string) || "",
    notes: (enquiry.notes as string) || "",
    address: (enquiry.address as string) || "",
    priority: (enquiry.priority as string) || "medium",
  });

  const SOURCE_OPTIONS = [
    { value: "phone", label: "Phone" }, { value: "email", label: "Email" },
    { value: "text", label: "Text/SMS" }, { value: "facebook", label: "Facebook" },
    { value: "whatsapp", label: "WhatsApp" }, { value: "messenger", label: "Messenger" },
    { value: "website", label: "Website" }, { value: "referral", label: "Referral" },
    { value: "other", label: "Other" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/enquiries/${enquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast({ title: "Enquiry updated" });
      onClose();
    } catch {
      toast({ title: "Error", description: "Failed to update enquiry", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Contact Name *</Label>
            <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
              {SOURCE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} type="email" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[80px]" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[60px]" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes..." />
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

function ConvertToJobDialog({ open, onOpenChange, enquiry, onConverted }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  enquiry: Record<string, unknown>;
  onConverted: (jobId: string) => void;
}) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [emailPrompt, setEmailPrompt] = useState<{ jobId: string; customerName: string; customerEmail: string } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("new");
  const [propertyMode, setPropertyMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [newFirstName, setNewFirstName] = useState(() => {
    const parts = ((enquiry.contact_name as string) || "").trim().split(" ");
    return parts[0] || "";
  });
  const [newLastName, setNewLastName] = useState(() => {
    const parts = ((enquiry.contact_name as string) || "").trim().split(" ");
    return parts.slice(1).join(" ") || "";
  });
  const [newPhone, setNewPhone] = useState((enquiry.contact_phone as string) || "");
  const [newEmail, setNewEmail] = useState((enquiry.contact_email as string) || "");
  const [newAddress, setNewAddress] = useState(() => {
    const addr = (enquiry.address as string) || "";
    const parts = addr.split(",");
    return parts[0]?.trim() || "";
  });
  const [newCity, setNewCity] = useState(() => {
    const addr = (enquiry.address as string) || "";
    const parts = addr.split(",");
    return parts[1]?.trim() || "";
  });
  const [newPostcode, setNewPostcode] = useState(() => {
    const addr = (enquiry.address as string) || "";
    const parts = addr.split(",");
    return parts[parts.length - 1]?.trim() || "";
  });
  const [jobTypeId, setJobTypeId] = useState("");
  const [priority, setPriority] = useState((enquiry.priority as string) || "medium");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split("T")[0]);
  const [scheduledTime, setScheduledTime] = useState("");
  const [description, setDescription] = useState((enquiry.description as string) || "");

  const { data: customers } = useListCustomers();
  const { data: properties } = useListProperties();
  const { data: jobTypes = [] } = useQuery<JobType[]>({
    queryKey: ["job-types"],
    queryFn: async () => {
      const res = await fetch("/api/job-types");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const filteredProperties = properties?.filter(p => !customerId || p.customer_id === customerId);

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        priority,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime || undefined,
        description: description || undefined,
      };

      const selectedType = jobTypes.find(t => t.id === parseInt(jobTypeId, 10));
      if (selectedType) {
        body.job_type = selectedType.category || "service";
        body.job_type_id = selectedType.id;
      } else {
        body.job_type = "service";
      }

      if (customerMode === "existing") {
        if (!customerId) {
          toast({ title: "Missing info", description: "Select a customer.", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        body.customer_id = customerId;
        if (propertyMode === "existing") {
          if (!propertyId) {
            toast({ title: "Missing info", description: "Select a property.", variant: "destructive" });
            setSubmitting(false);
            return;
          }
          body.property_id = propertyId;
        } else {
          if (!newAddress || !newPostcode) {
            toast({ title: "Missing info", description: "Enter at least address and postcode.", variant: "destructive" });
            setSubmitting(false);
            return;
          }
          body.new_property = { address_line1: newAddress, city: newCity || undefined, postcode: newPostcode };
        }
      } else {
        if (!newFirstName || !newLastName) {
          toast({ title: "Missing info", description: "Enter the customer's name.", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        body.new_customer = { first_name: newFirstName, last_name: newLastName, phone: newPhone || undefined, email: newEmail || undefined };
        if (newAddress && newPostcode) {
          body.new_property = { address_line1: newAddress, city: newCity || undefined, postcode: newPostcode };
        } else {
          toast({ title: "Missing info", description: "Enter at least address and postcode.", variant: "destructive" });
          setSubmitting(false);
          return;
        }
      }

      const res = await fetch(`/api/enquiries/${enquiry.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Conversion failed");
      }
      const result = await res.json();
      toast({ title: "Converted!", description: "Enquiry converted to a job." });

      let emailAddr: string | undefined;
      let custName = "";
      if (customerMode === "new") {
        emailAddr = newEmail || undefined;
        custName = `${newFirstName} ${newLastName}`;
      } else if (customerId) {
        const cust = customers?.find(c => c.id === customerId);
        emailAddr = cust?.email || undefined;
        custName = cust ? `${cust.first_name} ${cust.last_name}` : "";
      }

      if (emailAddr) {
        setEmailPrompt({ jobId: result.job_id, customerName: custName, customerEmail: emailAddr });
      } else {
        onConverted(result.job_id);
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendConfirmation = async () => {
    if (!emailPrompt) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`/api/jobs/${emailPrompt.jobId}/send-confirmation`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send email");
      }
      toast({ title: "Confirmation email sent", description: `Email sent to ${emailPrompt.customerEmail}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send email";
      toast({ title: "Email failed", description: message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
      const jobId = emailPrompt.jobId;
      setEmailPrompt(null);
      onConverted(jobId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && emailPrompt) {
        const jobId = emailPrompt.jobId;
        setEmailPrompt(null);
        onConverted(jobId);
        return;
      }
      onOpenChange(v);
    }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{emailPrompt ? "Send Confirmation Email?" : "Convert Enquiry to Job"}</DialogTitle>
        </DialogHeader>
        {emailPrompt ? (
          <div className="text-center space-y-4 py-4">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Send an appointment confirmation to <strong>{emailPrompt.customerName}</strong> at{" "}
                <span className="text-primary">{emailPrompt.customerEmail}</span>
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={handleSendConfirmation} disabled={sendingEmail}>
                {sendingEmail ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</> : <><Mail className="w-4 h-4 mr-2" /> Send Email</>}
              </Button>
              <Button variant="outline" onClick={() => { const jobId = emailPrompt.jobId; setEmailPrompt(null); onConverted(jobId); }} disabled={sendingEmail}>
                Skip
              </Button>
            </div>
          </div>
        ) : null}
        {!emailPrompt ? (
        <form onSubmit={handleConvert} className="space-y-5">
          <div className="flex gap-2 bg-muted rounded-lg p-1">
            <button type="button" className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${customerMode === "new" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setCustomerMode("new")}>
              New Customer
            </button>
            <button type="button" className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${customerMode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setCustomerMode("existing")}>
              Existing Customer
            </button>
          </div>

          {customerMode === "existing" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Customer *</Label>
                <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" required value={customerId} onChange={e => { setCustomerId(e.target.value); setPropertyId(""); }}>
                  <option value="">Select customer...</option>
                  {customers?.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
              <div className="flex gap-2 bg-muted/50 rounded-lg p-1">
                <button type="button" className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${propertyMode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground"}`} onClick={() => setPropertyMode("existing")}>
                  Existing Property
                </button>
                <button type="button" className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${propertyMode === "new" ? "bg-background shadow-sm" : "text-muted-foreground"}`} onClick={() => setPropertyMode("new")}>
                  New Property
                </button>
              </div>
              {propertyMode === "existing" ? (
                <div className="space-y-1.5">
                  <Label>Property *</Label>
                  <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" required value={propertyId} onChange={e => setPropertyId(e.target.value)}>
                    <option value="">Select property...</option>
                    {filteredProperties?.map(p => <option key={p.id} value={p.id}>{p.address_line1}, {p.postcode}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Address *</Label>
                    <Input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="123 High Street" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Town / City</Label>
                      <Input value={newCity} onChange={e => setNewCity(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Postcode *</Label>
                      <Input value={newPostcode} onChange={e => setNewPostcode(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>First Name *</Label>
                  <Input value={newFirstName} onChange={e => setNewFirstName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name *</Label>
                  <Input value={newLastName} onChange={e => setNewLastName(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" />
                </div>
              </div>
              <div className="border-t pt-4 space-y-4">
                <p className="text-sm font-medium text-muted-foreground">Property Address</p>
                <div className="space-y-1.5">
                  <Label>Address *</Label>
                  <Input value={newAddress} onChange={e => setNewAddress(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Town / City</Label>
                    <Input value={newCity} onChange={e => setNewCity(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Postcode *</Label>
                    <Input value={newPostcode} onChange={e => setNewPostcode(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Job Type *</Label>
                <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" required value={jobTypeId} onChange={e => setJobTypeId(e.target.value)}>
                  <option value="">Select type...</option>
                  {jobTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" required value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Time</Label>
                <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[60px]" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {submitting ? "Converting..." : "Convert to Job"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function EnquiryDetail() {
  const { hasFeature, loading } = usePlanFeatures();
  if (loading) return <div className="p-8">Loading...</div>;
  if (!hasFeature("job_management")) return <UpgradePrompt feature="Enquiry Tracking" />;
  return <EnquiryDetailContent />;
}
