import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API_BASE = `${import.meta.env.BASE_URL}api`;

type TemplateConversion = {
  id: string;
  status: "pending" | "approved" | "rejected" | "processing" | "failed";
  figma_url: string;
  template_name: string;
  template_slug: string;
  template_description?: string;
  industries?: string[];
  block_mapping_report?: {
    pages: string[];
    blocksPerPage: Record<string, number>;
    blockTypes: string[];
  };
  design_tokens?: Record<string, any>;
  error_message?: string;
  created_at: string;
  approved_at?: string;
};

function statusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status?.toLowerCase()) {
    case "approved":
      return "default";
    case "pending":
      return "secondary";
    case "rejected":
    case "failed":
      return "destructive";
    case "processing":
      return "outline";
    default:
      return "outline";
  }
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-6 h-6 rounded border border-gray-300"
        style={{ backgroundColor: color }}
        title={color}
      />
      <code className="text-xs text-gray-600">{color}</code>
    </div>
  );
}

function DesignTokensPreview({ tokens }: { tokens?: Record<string, any> }) {
  if (!tokens) return null;

  const colors = tokens.colors || {};
  // Get all color entries, or show fallbacks if none found
  const colorEntries = Object.entries(colors).length > 0 
    ? Object.entries(colors)
    : Object.entries({
        primary: "#1e3a8a",
        accent: "#f97316",
        background: "#ffffff",
        text: "#111827",
      });

  return (
    <div className="space-y-3">
      <div>
        <h4 className="font-semibold text-sm mb-2">Colors</h4>
        <div className="grid gap-3">
          {colorEntries.map(([name, value]) => (
            <div key={name}>
              <div className="text-xs font-mono text-gray-500 mb-1">{name}</div>
              <ColorSwatch color={value as string} />
            </div>
          ))}
        </div>
      </div>
      {tokens.typography && (
        <div>
          <h4 className="font-semibold text-sm mb-2">Typography</h4>
          <div className="space-y-1 text-xs text-gray-600">
            {tokens.typography.bodyFamily && <div>Body: {tokens.typography.bodyFamily}</div>}
            {tokens.typography.headingFamily && <div>Heading: {tokens.typography.headingFamily}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function BlockMappingPreview({ report }: { report?: TemplateConversion["block_mapping_report"] }) {
  if (!report) return null;

  const totalBlocks = Object.values(report.blocksPerPage).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm text-gray-600 mb-2">
          <strong>{report.pages.length}</strong> pages, <strong>{totalBlocks}</strong> blocks,{" "}
          <strong>{report.blockTypes.length}</strong> block types
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-sm mb-2">Pages</h4>
        <div className="grid grid-cols-2 gap-2">
          {report.pages.map((page) => (
            <div
              key={page}
              className="text-xs bg-gray-50 p-2 rounded flex justify-between items-center"
            >
              <span>{page}</span>
              <Badge variant="secondary">{report.blocksPerPage[page] || 0}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-sm mb-2">Block Types</h4>
        <div className="flex flex-wrap gap-1">
          {report.blockTypes.map((type) => (
            <Badge key={type} variant="outline" className="text-xs">
              {type}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConversionCard({ conversion, onApprove, isApproving, onReject, isRejecting }: {
  conversion: TemplateConversion;
  onApprove: (id: string) => void;
  isApproving: boolean;
  onReject: (id: string) => void;
  isRejecting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={cn(
      "border-l-4",
      conversion.status === "approved" && "border-l-green-500",
      conversion.status === "pending" && "border-l-yellow-500",
      conversion.status === "rejected" && "border-l-red-500",
      conversion.status === "failed" && "border-l-red-600"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg">{conversion.template_name}</CardTitle>
              <Badge variant={statusBadgeVariant(conversion.status)}>
                {conversion.status}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {conversion.template_slug} • Created {formatDate(conversion.created_at)}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <>
          <Separator />
          <CardContent className="pt-4 space-y-4">
            {/* Description */}
            {conversion.template_description && (
              <div>
                <h4 className="font-semibold text-sm mb-1">Description</h4>
                <p className="text-sm text-gray-600">{conversion.template_description}</p>
              </div>
            )}

            {/* Industries */}
            {conversion.industries && conversion.industries.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Industries</h4>
                <div className="flex flex-wrap gap-1">
                  {conversion.industries.map((industry) => (
                    <Badge key={industry} variant="secondary">
                      {industry}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Block Mapping */}
            {conversion.block_mapping_report && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Block Mapping</h4>
                <BlockMappingPreview report={conversion.block_mapping_report} />
              </div>
            )}

            {/* Design Tokens */}
            {conversion.design_tokens && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Design Tokens</h4>
                <DesignTokensPreview tokens={conversion.design_tokens} />
              </div>
            )}

            {/* Error Message */}
            {conversion.error_message && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Conversion Error</AlertTitle>
                <AlertDescription>{conversion.error_message}</AlertDescription>
              </Alert>
            )}

            {/* Figma URL */}
            <div className="text-xs text-gray-500 flex items-center gap-1 pt-2">
              <span>Figma:</span>
              <a
                href={conversion.figma_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1"
              >
                View Design
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {conversion.status === "pending" && (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onApprove(conversion.id)}
                    disabled={isApproving}
                  >
                    {isApproving ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Approve
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onReject(conversion.id)}
                    disabled={isApproving || isRejecting}
                  >
                    {isRejecting ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Rejecting...
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Reject
                      </>
                    )}
                  </Button>
                </>
              )}
              {conversion.status === "approved" && (
                <div className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Approved {conversion.approved_at && `on ${formatDate(conversion.approved_at)}`}
                </div>
              )}
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}

export default function SuperadminTemplateConversionsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadForm, setUploadForm] = useState({
    figmaUrl: "",
    templateName: "",
    industries: [] as string[],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Fetch pending conversions
  const { data: conversions = [], isLoading: pendingLoading, refetch } = useQuery({
    queryKey: ["template-conversions-pending"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/superadmin/templates/pending`, {
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to fetch pending templates");
      return body.pending || [];
    },
  });

  // Convert Figma ZIP + URL
  const convertMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`${API_BASE}/superadmin/templates/convert`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Conversion failed");
      return body;
    },
    onSuccess: (data) => {
      toast({
        title: "Conversion successful",
        description: `${data.templateName} (${data.importedPages} pages, ${data.importedBlocks} blocks)`,
      });
      setUploadForm({ figmaUrl: "", templateName: "", industries: [] });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Conversion failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Approve conversion
  const approveMutation = useMutation({
    mutationFn: async (conversionId: string) => {
      const res = await fetch(`${API_BASE}/superadmin/templates/${conversionId}/approve`, {
        method: "PATCH",
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Approval failed");
      return body;
    },
    onSuccess: () => {
      toast({
        title: "Approved",
        description: "Template approved for Phase 2 generation",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Approval failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Reject conversion
  const rejectMutation = useMutation({
    mutationFn: async (conversionId: string) => {
      const res = await fetch(`${API_BASE}/superadmin/templates/${conversionId}/reject`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Rejected by superadmin" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Rejection failed");
      return body;
    },
    onSuccess: () => {
      toast({
        title: "Rejected",
        description: "Template has been rejected",
      });
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Rejection failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".zip")) {
      toast({
        title: "Invalid file",
        description: "Please upload a .zip file",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = () => {
    if (!selectedFile) {
      toast({ title: "No file selected", description: "Please select a Figma ZIP file", variant: "destructive" });
      return;
    }
    if (!uploadForm.figmaUrl || !uploadForm.templateName) {
      toast({ title: "Missing fields", description: "Please enter Figma URL and template name", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("figmaZip", selectedFile);
    formData.append("figmaUrl", uploadForm.figmaUrl);
    formData.append("templateName", uploadForm.templateName);
    uploadForm.industries.forEach((industry) => {
      formData.append("industries", industry);
    });

    convertMutation.mutate(formData);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Template Conversions</h1>
        <p className="text-gray-600 mt-1">
          Convert Figma templates to template packages with review workflow
        </p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Figma Template
          </CardTitle>
          <CardDescription>
            Upload a Figma export ZIP and provide the published Figma URL
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="figma-url">Figma Published URL</Label>
              <Input
                id="figma-url"
                placeholder="https://..."
                value={uploadForm.figmaUrl}
                onChange={(e) => setUploadForm({ ...uploadForm, figmaUrl: e.target.value })}
                disabled={convertMutation.isPending}
              />
              <p className="text-xs text-gray-500 mt-1">
                The published view URL of your Figma design
              </p>
            </div>

            <div>
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g., Local Plumbing Pro"
                value={uploadForm.templateName}
                onChange={(e) => setUploadForm({ ...uploadForm, templateName: e.target.value })}
                disabled={convertMutation.isPending}
              />
              <p className="text-xs text-gray-500 mt-1">Human-readable template name</p>
            </div>
          </div>

          <div>
            <Label htmlFor="industries">Industries (comma-separated)</Label>
            <Input
              id="industries"
              placeholder="e.g., Plumbing, Heating, Electrical"
              value={uploadForm.industries.join(", ")}
              onChange={(e) =>
                setUploadForm({
                  ...uploadForm,
                  industries: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
              disabled={convertMutation.isPending}
            />
          </div>

          <div>
            <Label htmlFor="zip-file">Figma Export ZIP</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="zip-file"
                type="file"
                accept=".zip"
                ref={fileInputRef}
                onChange={handleFileChange}
                disabled={convertMutation.isPending}
                className="flex-1"
              />
            </div>
            {selectedFile && (
              <p className="text-xs text-green-600 mt-1">✓ {selectedFile.name} selected</p>
            )}
            {!selectedFile && (
              <p className="text-xs text-gray-500 mt-1">
                React/Vite export from Figma with src/app/App.tsx and src/styles/theme.css
              </p>
            )}
          </div>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={convertMutation.isPending || !selectedFile || !uploadForm.figmaUrl || !uploadForm.templateName}
            className="w-full"
          >
            {convertMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Converting...</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" />Convert Template</>
            )}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Pending Conversions Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Pending Review</h2>
            <p className="text-sm text-gray-600">
              {conversions.length > 0
                ? `${conversions.filter((c: any) => c.status === "pending").length} awaiting approval`
                : "No pending conversions"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={pendingLoading}
          >
            <RefreshCw className={cn("w-4 h-4", pendingLoading && "animate-spin")} />
          </Button>
        </div>

        {conversions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="pt-6 text-center text-gray-500">
              <p>No template conversions yet</p>
              <p className="text-sm mt-1">Upload a Figma template above to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {conversions.map((conversion: TemplateConversion) => (
              <ConversionCard
                key={conversion.id}
                conversion={conversion}
                onApprove={() => approveMutation.mutate(conversion.id)}
                isApproving={approveMutation.isPending}
                onReject={() => rejectMutation.mutate(conversion.id)}
                isRejecting={rejectMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Help Section */}
      <Card className="bg-blue-50">
        <CardHeader>
          <CardTitle className="text-base">What happens next?</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-gray-700">
          <p>
            <strong>Phase 1 (Current):</strong> Upload Figma → Convert → Review → Approve
          </p>
          <p>
            <strong>Phase 2 (Coming):</strong> Generate template package → Publish → Available in tenant dashboard
          </p>
          <p>
            For now, approved templates are stored and ready for Phase 2 package generation. Check
            the database for conversion details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
