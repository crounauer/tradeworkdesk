import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import {
  CreateSignatureBody,
  GetJobSignaturesParams,
  GetJobSignaturesResponse,
} from "@workspace/api-zod";

interface SignatureRow {
  id: string;
  job_id: string;
  signer_type: string;
  signer_name: string;
  storage_path: string;
  created_at: string;
}

async function verifyJobAccess(req: AuthenticatedRequest, jobId: string): Promise<{ allowed: boolean; error?: string }> {
  let q = supabaseAdmin.from("jobs").select("assigned_technician_id").eq("id", jobId);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data: job } = await q.single();
  if (!job) return { allowed: false, error: "Job not found" };
  if (req.userRole === "technician" && job.assigned_technician_id !== req.userId) {
    return { allowed: false, error: "Not authorized to access signatures for this job" };
  }
  return { allowed: true };
}

const router: IRouter = Router();

router.post("/signatures", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const parsed = CreateSignatureBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const access = await verifyJobAccess(req, parsed.data.job_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const base64Data = parsed.data.image_data.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const storagePath = `${parsed.data.job_id}/${parsed.data.signer_type}-${Date.now()}.png`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("signatures")
    .upload(storagePath, buffer, { contentType: "image/png" });

  if (uploadError) { res.status(500).json({ error: uploadError.message }); return; }

  const { data, error } = await supabaseAdmin
    .from("signatures")
    .insert({
      job_id: parsed.data.job_id,
      signer_type: parsed.data.signer_type,
      signer_name: parsed.data.signer_name,
      storage_path: storagePath,
      tenant_id: req.tenantId,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  const { data: urlData } = await supabaseAdmin.storage.from("signatures").createSignedUrl(storagePath, 3600);
  res.status(201).json({ ...data, signed_url: urlData?.signedUrl || null });
});

router.get("/signatures/job/:jobId", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetJobSignaturesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const { data, error } = await supabaseAdmin
    .from("signatures")
    .select("*")
    .eq("job_id", params.data.jobId)
    .order("created_at");

  if (error) { res.status(500).json({ error: error.message }); return; }

  const withUrls = await Promise.all(
    (data as SignatureRow[] || []).map(async (s) => {
      const { data: urlData } = await supabaseAdmin.storage.from("signatures").createSignedUrl(s.storage_path, 3600);
      return { ...s, signed_url: urlData?.signedUrl || null };
    })
  );

  res.json(GetJobSignaturesResponse.parse(withUrls));
});

export default router;
