import { useRef, useState } from "react";
import { useParams, Link } from "wouter";
import SignatureCanvas from "react-signature-canvas";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, FileSignature, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGetJobSignatures, useCreateSignature } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export default function JobSignatures() {
  const { jobId } = useParams<{ jobId: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const sigRef = useRef<SignatureCanvas>(null);
  const [signerName, setSignerName] = useState("");
  const [signerType, setSignerType] = useState<"customer" | "technician">("customer");
  const [saving, setSaving] = useState(false);

  const { data: signatures, isLoading } = useGetJobSignatures(jobId!);

  const createMutation = useCreateSignature();

  const handleSave = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast({ title: "Error", description: "Please provide a signature", variant: "destructive" });
      return;
    }
    if (!signerName.trim()) {
      toast({ title: "Error", description: "Please enter the signer's name", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const imageData = sigRef.current.toDataURL("image/png");
      await createMutation.mutateAsync({
        data: {
          job_id: jobId!,
          signer_type: signerType,
          signer_name: signerName,
          image_data: imageData,
        },
      });
      qc.invalidateQueries({ queryKey: ["/api/signatures"] });
      sigRef.current.clear();
      setSignerName("");
      toast({ title: "Saved", description: "Signature captured successfully" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save signature";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in">
      <Link href={`/jobs/${jobId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Job
      </Link>

      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <FileSignature className="w-8 h-8 text-primary" /> Signatures
        </h1>
        <p className="text-muted-foreground mt-1">Capture customer and technician signatures</p>
      </div>

      {signatures && signatures.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-bold text-lg">Existing Signatures</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {signatures.map((sig) => (
              <Card key={sig.id} className="p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="font-bold capitalize">{sig.signer_type}</span>
                  <span className="text-sm text-muted-foreground">- {sig.signer_name}</span>
                </div>
                {sig.signed_url && (
                  <img src={sig.signed_url} alt={`Signature by ${sig.signer_name}`} className="w-full h-24 object-contain border rounded bg-white" />
                )}
                <p className="text-xs text-muted-foreground mt-2">{new Date(sig.created_at).toLocaleString()}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="p-6 shadow-sm border-border/50">
        <h2 className="font-bold text-lg mb-4">Capture New Signature</h2>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <Label>Signer Name</Label>
            <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Full name..." />
          </div>
          <div className="space-y-2">
            <Label>Signer Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={signerType === "customer" ? "default" : "outline"}
                onClick={() => setSignerType("customer")}
                className="flex-1"
              >
                Customer
              </Button>
              <Button
                type="button"
                variant={signerType === "technician" ? "default" : "outline"}
                onClick={() => setSignerType("technician")}
                className="flex-1"
              >
                Technician
              </Button>
            </div>
          </div>
        </div>

        <div className="border-2 border-dashed border-border rounded-xl bg-white mb-4">
          <SignatureCanvas
            ref={sigRef}
            canvasProps={{
              className: "w-full h-48",
              style: { width: "100%", height: "192px" },
            }}
            penColor="black"
          />
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => sigRef.current?.clear()}>Clear</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Signature"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
