import { useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Loader2,
  Upload,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Lock,
  LockOpen,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API_BASE = `${import.meta.env.BASE_URL}api`;

type TemplateListItem = {
  id: string;
  slug: string;
  name: string;
  status: string;
  category?: string;
  content_modes?: string[];
  version?: number;
  page_count: number;
  updated_at?: string;
};

type UploadResponse = {
  success: true;
  templateSlug: string;
  templateName: string;
  status: string;
  importedPages: number;
  importedBlocks: number;
  importedBlockTypes: number;
  importId: string;
} | {
  success: false;
  error: string;
  details?: Record<string, unknown>;
};

function formatDate(date?: string) {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleString();
  } catch {
    return date;
  }
}

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status?.toLowerCase()) {
    case "live":
    case "published":
      return "default";
    case "draft":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

export default function SuperadminTemplatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["superadmin-templates"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/superadmin/templates`, {
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to fetch templates");
      return body.data || [];
    },
  });

  // Upload template
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("templateZip", file);

      const xhr = new XMLHttpRequest();
      return new Promise<UploadResponse>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          setUploadProgress(0);
          try {
            const response = JSON.parse(xhr.responseText) as UploadResponse;
            if (xhr.status >= 400) {
              const errorMsg = !response.success && "error" in response ? response.error : "Upload failed";
              reject(new Error(errorMsg));
            } else {
              resolve(response);
            }
          } catch (error) {
            reject(error);
          }
        });

        xhr.addEventListener("error", () => {
          setUploadProgress(0);
          reject(new Error("Upload failed"));
        });

        xhr.open("POST", `${API_BASE}/superadmin/template-imports/import`);
        xhr.withCredentials = true;
        xhr.send(formData);
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Upload successful",
          description: `${data.templateName} imported as draft (${data.importedPages} pages, ${data.importedBlocks} blocks)`,
        });
        queryClient.invalidateQueries({ queryKey: ["superadmin-templates"] });
        setSelectedFile(null);
      }
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Publish template
  const publishMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(`${API_BASE}/superadmin/templates/${slug}/publish`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to publish");
      return body;
    },
    onSuccess: (_, slug) => {
      toast({
        title: "Published",
        description: `Template "${slug}" is now live`,
      });
      queryClient.invalidateQueries({ queryKey: ["superadmin-templates"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to publish",
        variant: "destructive",
      });
    },
  });

  // Unpublish template
  const unpublishMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(`${API_BASE}/superadmin/templates/${slug}/unpublish`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to unpublish");
      return body;
    },
    onSuccess: (_, slug) => {
      toast({
        title: "Unpublished",
        description: `Template "${slug}" is now draft`,
      });
      queryClient.invalidateQueries({ queryKey: ["superadmin-templates"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to unpublish",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".zip")) {
      toast({
        title: "Invalid file",
        description: "Please select a .zip file",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    uploadMutation.mutate(selectedFile);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Template Management</h1>
        <p className="text-muted-foreground mt-1">Import and manage TWD template packages</p>
      </div>

      <Separator />

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Template Package</CardTitle>
          <CardDescription>Import a new template from a .zip package</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {selectedFile ? selectedFile.name : "Click to select or drag a .zip file"}
                </p>
                <p className="text-sm text-muted-foreground">Maximum 25MB</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4"
            >
              Choose File
            </Button>
          </div>

          {selectedFile && (
            <div className="space-y-3">
              <div className="text-sm">
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} />
                  <p className="text-xs text-muted-foreground text-center">{uploadProgress}%</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending}
                  className="flex-1"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFile(null);
                    setUploadProgress(0);
                  }}
                  disabled={uploadMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Success Message */}
      {uploadMutation.isSuccess && uploadMutation.data?.success && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle>Template imported successfully</AlertTitle>
          <AlertDescription>
            <p className="font-medium">{uploadMutation.data.templateName}</p>
            <p className="text-sm">
              {uploadMutation.data.importedPages} pages, {uploadMutation.data.importedBlocks} blocks ({uploadMutation.data.importedBlockTypes} types)
            </p>
            <p className="text-xs text-muted-foreground mt-1">Import ID: {uploadMutation.data.importId}</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Templates List */}
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>
            {templates.length} template{templates.length !== 1 ? "s" : ""} available
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templatesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No templates imported yet</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Modes</TableHead>
                    <TableHead className="text-center">Pages</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template: TemplateListItem) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="font-mono text-sm">{template.slug}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(template.status)}>
                          {template.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {template.category || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {template.content_modes?.length ? template.content_modes.join(", ") : "demo"}
                      </TableCell>
                      <TableCell className="text-center text-sm">{template.page_count}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(template.updated_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/superadmin/templates/${template.slug}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>

                          {template.status?.toLowerCase() === "live" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => unpublishMutation.mutate(template.slug)}
                              disabled={unpublishMutation.isPending}
                              title="Unpublish template"
                            >
                              {unpublishMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Lock className="h-4 w-4" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => publishMutation.mutate(template.slug)}
                              disabled={publishMutation.isPending}
                              title="Publish template"
                            >
                              {publishMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <LockOpen className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
