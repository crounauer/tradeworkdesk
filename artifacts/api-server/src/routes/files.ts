import { Router, type IRouter } from "express";
import multer from "multer";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import {
  ListFilesQueryParams,
  ListFilesResponse,
  DeleteFileParams,
  GetFileUrlParams,
  GetFileUrlResponse,
} from "@workspace/api-zod";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router: IRouter = Router();

router.get("/files", requireAuth, async (req, res): Promise<void> => {
  const query = ListFilesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const { data, error } = await supabaseAdmin
    .from("file_attachments")
    .select("*")
    .eq("entity_type", query.data.entity_type)
    .eq("entity_id", query.data.entity_id)
    .order("created_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }

  const filesWithUrls = await Promise.all(
    (data || []).map(async (f: any) => {
      const bucket = f.file_type?.startsWith("image/") ? "service-photos" : "service-documents";
      const { data: urlData } = await supabaseAdmin.storage.from(bucket).createSignedUrl(f.storage_path, 3600);
      return { ...f, signed_url: urlData?.signedUrl || null };
    })
  );

  res.json(ListFilesResponse.parse(filesWithUrls));
});

router.post("/files/upload", requireAuth, upload.single("file"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const file = req.file;
  if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const entityType = req.body.entity_type;
  const entityId = req.body.entity_id;
  const description = req.body.description || null;

  if (!entityType || !entityId) {
    res.status(400).json({ error: "entity_type and entity_id are required" });
    return;
  }

  const bucket = file.mimetype.startsWith("image/") ? "service-photos" : "service-documents";
  const storagePath = `${entityType}/${entityId}/${Date.now()}-${file.originalname}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storagePath, file.buffer, { contentType: file.mimetype });

  if (uploadError) { res.status(500).json({ error: uploadError.message }); return; }

  const { data, error } = await supabaseAdmin
    .from("file_attachments")
    .insert({
      file_name: file.originalname,
      file_type: file.mimetype,
      file_size: file.size,
      storage_path: storagePath,
      entity_type: entityType,
      entity_id: entityId,
      uploaded_by: req.userId,
      description,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }

  const { data: urlData } = await supabaseAdmin.storage.from(bucket).createSignedUrl(storagePath, 3600);
  res.status(201).json({ ...data, signed_url: urlData?.signedUrl || null });
});

router.delete("/files/:id", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteFileParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data: file } = await supabaseAdmin
    .from("file_attachments").select("*").eq("id", params.data.id).single();
  if (!file) { res.status(404).json({ error: "File not found" }); return; }

  if (file.uploaded_by !== req.userId && req.userRole !== "admin") {
    res.status(403).json({ error: "Not authorized to delete this file" });
    return;
  }

  const bucket = file.file_type?.startsWith("image/") ? "service-photos" : "service-documents";
  await supabaseAdmin.storage.from(bucket).remove([file.storage_path]);
  await supabaseAdmin.from("file_attachments").delete().eq("id", params.data.id);
  res.sendStatus(204);
});

router.get("/files/:id/url", requireAuth, async (req, res): Promise<void> => {
  const params = GetFileUrlParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const { data: file } = await supabaseAdmin
    .from("file_attachments").select("*").eq("id", params.data.id).single();
  if (!file) { res.status(404).json({ error: "File not found" }); return; }

  const bucket = file.file_type?.startsWith("image/") ? "service-photos" : "service-documents";
  const { data: urlData } = await supabaseAdmin.storage.from(bucket).createSignedUrl(file.storage_path, 3600);
  if (!urlData) { res.status(500).json({ error: "Failed to generate URL" }); return; }

  res.json(GetFileUrlResponse.parse({ url: urlData.signedUrl }));
});

export default router;
