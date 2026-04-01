import { Router, type IRouter } from "express";
import multer from "multer";
import sharp from "sharp";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import {
  ListFilesQueryParams,
  ListFilesResponse,
  DeleteFileParams,
  GetFileUrlParams,
  GetFileUrlResponse,
} from "@workspace/api-zod";

interface FileRow {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  thumbnail_storage_path: string | null;
  entity_type: string;
  entity_id: string;
  note_id: string | null;
  uploaded_by: string;
  description: string | null;
  created_at: string;
}

async function verifyEntityAccess(req: AuthenticatedRequest, entityType: string, entityId: string): Promise<{ allowed: boolean; error?: string }> {
  if (req.userRole !== "technician") return { allowed: true };
  if (entityType === "job") {
    let q = supabaseAdmin.from("jobs").select("assigned_technician_id").eq("id", entityId);
    if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
    const { data: job } = await q.single();
    if (!job) return { allowed: false, error: "Job not found" };
    if (job.assigned_technician_id !== req.userId) return { allowed: false, error: "Not authorized" };
  }
  if (entityType === "enquiry") {
    let q = supabaseAdmin.from("enquiries").select("id").eq("id", entityId);
    if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
    const { data: enquiry } = await q.single();
    if (!enquiry) return { allowed: false, error: "Enquiry not found" };
  }
  return { allowed: true };
}

const MAX_DIMENSION = 1920;
const THUMB_DIMENSION = 300;
const JPEG_QUALITY = 80;
const THUMB_QUALITY = 70;

async function compressImage(buffer: Buffer, mimetype: string): Promise<{ buffer: Buffer; mimetype: string }> {
  try {
    const image = sharp(buffer).rotate();
    const metadata = await image.metadata();
    const w = metadata.width || 0;
    const h = metadata.height || 0;

    let pipeline = image;
    if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
      pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true });
    }

    const compressed = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
    return { buffer: compressed, mimetype: "image/jpeg" };
  } catch {
    return { buffer, mimetype };
  }
}

async function generateThumbnail(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buffer)
      .rotate()
      .resize(THUMB_DIMENSION, THUMB_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: THUMB_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router: IRouter = Router();

router.get("/files", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const query = ListFilesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const access = await verifyEntityAccess(req, query.data.entity_type, query.data.entity_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  let q = supabaseAdmin
    .from("file_attachments")
    .select("*")
    .eq("entity_type", query.data.entity_type)
    .eq("entity_id", query.data.entity_id)
    .order("created_at", { ascending: false });
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { data, error } = await q;

  if (error) { res.status(500).json({ error: error.message }); return; }

  const filesWithUrls = await Promise.all(
    (data as FileRow[] || []).map(async (f) => {
      const bucket = f.file_type?.startsWith("image/") ? "service-photos" : "service-documents";
      const { data: urlData } = await supabaseAdmin.storage.from(bucket).createSignedUrl(f.storage_path, 3600);

      let thumbnail_signed_url: string | null = null;
      if (f.thumbnail_storage_path) {
        const { data: thumbUrl } = await supabaseAdmin.storage.from(bucket).createSignedUrl(f.thumbnail_storage_path, 3600);
        thumbnail_signed_url = thumbUrl?.signedUrl || null;
      }

      return { ...f, signed_url: urlData?.signedUrl || null, thumbnail_signed_url };
    })
  );

  res.json(ListFilesResponse.parse(filesWithUrls));
});

const uploadMultiple = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).array("files", 10);

router.post("/files/upload-multiple", requireAuth, requireTenant, (req, res, next) => { uploadMultiple(req, res, next); }, async (req: AuthenticatedRequest, res): Promise<void> => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) { res.status(400).json({ error: "No files uploaded" }); return; }

  const entityType = req.body.entity_type;
  const entityId = req.body.entity_id;
  const noteId = req.body.note_id || null;

  if (!entityType || !entityId) {
    res.status(400).json({ error: "entity_type and entity_id are required" }); return;
  }

  const access = await verifyEntityAccess(req, entityType, entityId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  if (noteId) {
    let noteCheck = supabaseAdmin.from("enquiry_notes").select("id, enquiry_id").eq("id", noteId);
    if (req.tenantId) noteCheck = noteCheck.eq("tenant_id", req.tenantId);
    const { data: noteData } = await noteCheck.single();
    if (!noteData) {
      res.status(400).json({ error: "Note not found" }); return;
    }
    if (entityType === "enquiry" && noteData.enquiry_id !== entityId) {
      res.status(400).json({ error: "Note does not belong to this enquiry" }); return;
    }
  }

  const results = [];
  const errors: string[] = [];
  for (const file of files) {
    const isImage = file.mimetype.startsWith("image/");
    let uploadBuffer = file.buffer;
    let uploadMimetype = file.mimetype;
    let thumbnailStoragePath: string | null = null;

    if (isImage) {
      const compressed = await compressImage(file.buffer, file.mimetype);
      uploadBuffer = compressed.buffer;
      uploadMimetype = compressed.mimetype;

      const thumb = await generateThumbnail(uploadBuffer);
      if (thumb) {
        const thumbPath = `${entityType}/${entityId}/thumb_${Date.now()}-${file.originalname.replace(/\.[^.]+$/, ".jpg")}`;
        const { error: thumbErr } = await supabaseAdmin.storage
          .from("service-photos")
          .upload(thumbPath, thumb, { contentType: "image/jpeg" });
        if (!thumbErr) thumbnailStoragePath = thumbPath;
      }
    }

    const bucket = isImage ? "service-photos" : "service-documents";
    const ext = isImage ? ".jpg" : "";
    const originalName = isImage ? file.originalname.replace(/\.[^.]+$/, ext) : file.originalname;
    const storagePath = `${entityType}/${entityId}/${Date.now()}-${originalName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, uploadBuffer, { contentType: uploadMimetype });

    if (uploadError) { errors.push(`${file.originalname}: ${uploadError.message}`); continue; }

    const insertPayload: Record<string, unknown> = {
      file_name: file.originalname,
      file_type: uploadMimetype,
      file_size: uploadBuffer.length,
      storage_path: storagePath,
      entity_type: entityType,
      entity_id: entityId,
      uploaded_by: req.userId,
      tenant_id: req.tenantId,
    };
    if (noteId) insertPayload.note_id = noteId;
    if (thumbnailStoragePath) insertPayload.thumbnail_storage_path = thumbnailStoragePath;

    let { data, error } = await supabaseAdmin
      .from("file_attachments")
      .insert(insertPayload)
      .select()
      .single();

    if (error && noteId && error.message?.includes("note_id")) {
      delete insertPayload.note_id;
      const retry = await supabaseAdmin
        .from("file_attachments")
        .insert(insertPayload)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (!error && data) {
      const { data: urlData } = await supabaseAdmin.storage.from(bucket).createSignedUrl(storagePath, 3600);
      let thumbnail_signed_url: string | null = null;
      if (thumbnailStoragePath) {
        const { data: thumbUrl } = await supabaseAdmin.storage.from("service-photos").createSignedUrl(thumbnailStoragePath, 3600);
        thumbnail_signed_url = thumbUrl?.signedUrl || null;
      }
      results.push({ ...data, signed_url: urlData?.signedUrl || null, thumbnail_signed_url });
    }
  }

  if (results.length === 0 && errors.length > 0) {
    res.status(500).json({ error: `All uploads failed: ${errors.join("; ")}` }); return;
  }
  res.status(201).json({ files: results, failed: errors.length, errors: errors.length > 0 ? errors : undefined });
});

router.post("/files/upload", requireAuth, requireTenant, upload.single("file"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const file = req.file;
  if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const entityType = req.body.entity_type;
  const entityId = req.body.entity_id;
  const description = req.body.description || null;
  const noteId = req.body.note_id || null;

  if (!entityType || !entityId) {
    res.status(400).json({ error: "entity_type and entity_id are required" });
    return;
  }

  const access = await verifyEntityAccess(req, entityType, entityId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  if (noteId) {
    let noteCheck = supabaseAdmin.from("enquiry_notes").select("id, enquiry_id").eq("id", noteId);
    if (req.tenantId) noteCheck = noteCheck.eq("tenant_id", req.tenantId);
    const { data: noteData } = await noteCheck.single();
    if (!noteData) { res.status(400).json({ error: "Note not found" }); return; }
    if (entityType === "enquiry" && noteData.enquiry_id !== entityId) {
      res.status(400).json({ error: "Note does not belong to this enquiry" }); return;
    }
  }

  const isImage = file.mimetype.startsWith("image/");
  let uploadBuffer = file.buffer;
  let uploadMimetype = file.mimetype;
  let thumbnailStoragePath: string | null = null;

  if (isImage) {
    const compressed = await compressImage(file.buffer, file.mimetype);
    uploadBuffer = compressed.buffer;
    uploadMimetype = compressed.mimetype;

    const thumb = await generateThumbnail(uploadBuffer);
    if (thumb) {
      const thumbPath = `${entityType}/${entityId}/thumb_${Date.now()}-${file.originalname.replace(/\.[^.]+$/, ".jpg")}`;
      const { error: thumbErr } = await supabaseAdmin.storage
        .from("service-photos")
        .upload(thumbPath, thumb, { contentType: "image/jpeg" });
      if (!thumbErr) {
        thumbnailStoragePath = thumbPath;
      }
    }
  }

  const bucket = isImage ? "service-photos" : "service-documents";
  const ext = isImage ? ".jpg" : "";
  const originalName = isImage ? file.originalname.replace(/\.[^.]+$/, ext) : file.originalname;
  const storagePath = `${entityType}/${entityId}/${Date.now()}-${originalName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storagePath, uploadBuffer, { contentType: uploadMimetype });

  if (uploadError) { res.status(500).json({ error: uploadError.message }); return; }

  const insertPayload: Record<string, unknown> = {
    file_name: file.originalname,
    file_type: uploadMimetype,
    file_size: uploadBuffer.length,
    storage_path: storagePath,
    entity_type: entityType,
    entity_id: entityId,
    uploaded_by: req.userId,
    description,
    tenant_id: req.tenantId,
  };
  if (noteId) {
    insertPayload.note_id = noteId;
  }
  if (thumbnailStoragePath) {
    insertPayload.thumbnail_storage_path = thumbnailStoragePath;
  }

  let { data, error } = await supabaseAdmin
    .from("file_attachments")
    .insert(insertPayload)
    .select()
    .single();

  if (error && noteId && error.message?.includes("note_id")) {
    delete insertPayload.note_id;
    const retry = await supabaseAdmin
      .from("file_attachments")
      .insert(insertPayload)
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) { res.status(500).json({ error: error.message }); return; }

  const { data: urlData } = await supabaseAdmin.storage.from(bucket).createSignedUrl(storagePath, 3600);

  let thumbnail_signed_url: string | null = null;
  if (thumbnailStoragePath) {
    const { data: thumbUrl } = await supabaseAdmin.storage.from("service-photos").createSignedUrl(thumbnailStoragePath, 3600);
    thumbnail_signed_url = thumbUrl?.signedUrl || null;
  }

  res.status(201).json({ ...data, signed_url: urlData?.signedUrl || null, thumbnail_signed_url });
});

router.delete("/files/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = DeleteFileParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let q = supabaseAdmin.from("file_attachments").select("*").eq("id", params.data.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data: file } = await q.single();
  if (!file) { res.status(404).json({ error: "File not found" }); return; }

  const fileRow = file as FileRow;
  if (fileRow.uploaded_by !== req.userId && req.userRole !== "admin") {
    res.status(403).json({ error: "Not authorized to delete this file" });
    return;
  }

  const bucket = fileRow.file_type?.startsWith("image/") ? "service-photos" : "service-documents";
  const pathsToDelete = [fileRow.storage_path];
  if (fileRow.thumbnail_storage_path) {
    pathsToDelete.push(fileRow.thumbnail_storage_path);
  }
  await supabaseAdmin.storage.from(bucket).remove(pathsToDelete);
  await supabaseAdmin.from("file_attachments").delete().eq("id", params.data.id);
  res.sendStatus(204);
});

router.get("/files/:id/url", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = GetFileUrlParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let q = supabaseAdmin.from("file_attachments").select("*").eq("id", params.data.id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  const { data: file } = await q.single();
  if (!file) { res.status(404).json({ error: "File not found" }); return; }

  const fileRow = file as FileRow;

  const access = await verifyEntityAccess(req, fileRow.entity_type, fileRow.entity_id);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const bucket = fileRow.file_type?.startsWith("image/") ? "service-photos" : "service-documents";
  const { data: urlData } = await supabaseAdmin.storage.from(bucket).createSignedUrl(fileRow.storage_path, 3600);
  if (!urlData) { res.status(500).json({ error: "Failed to generate URL" }); return; }

  res.json(GetFileUrlResponse.parse({ url: urlData.signedUrl }));
});

export default router;
