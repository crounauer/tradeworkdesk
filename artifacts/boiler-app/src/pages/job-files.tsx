import { useState, useRef } from "react";
import { useListFiles, useDeleteFile } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Trash2, FileText, Image as ImageIcon, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export default function JobFiles() {
  const { jobId } = useParams<{ jobId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: files, isLoading } = useListFiles(
    { entity_type: "job", entity_id: jobId! }
  );

  const deleteMutation = useDeleteFile();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entity_type", "job");
      formData.append("entity_id", jobId!);

      await customFetch(`${import.meta.env.BASE_URL}api/files/upload`, {
        method: "POST",
        body: formData,
      });

      qc.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ title: "Uploaded", description: `${file.name} uploaded successfully` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Upload Error", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ title: "Deleted", description: "File removed" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Delete failed";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  if (isLoading) return <div className="p-8">Loading files...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in">
      <Link href={`/jobs/${jobId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Job
      </Link>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold">Documents & Photos</h1>
          <p className="text-muted-foreground mt-1">Manage files for this job</p>
        </div>
        <div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} accept="image/*,.pdf,.doc,.docx" />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="w-4 h-4 mr-2" /> {uploading ? "Uploading..." : "Upload File"}
          </Button>
        </div>
      </div>

      {!files || files.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-muted-foreground">No files attached to this job.</p>
          <Button variant="outline" className="mt-4" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" /> Upload First File
          </Button>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file) => (
            <Card key={file.id} className="p-4 border border-border/50 hover:shadow-md transition-all">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  {file.file_type?.startsWith("image/") ? (
                    <ImageIcon className="w-6 h-6 text-blue-500" />
                  ) : (
                    <FileText className="w-6 h-6 text-slate-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{file.file_name}</p>
                  <p className="text-xs text-muted-foreground">{((file.file_size || 0) / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {file.signed_url && (
                  <a href={file.signed_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" /> View</Button>
                  </a>
                )}
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(file.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
