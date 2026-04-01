-- Patch 019: Add note_id column to file_attachments for linking photos to enquiry notes

ALTER TABLE file_attachments ADD COLUMN IF NOT EXISTS note_id UUID REFERENCES enquiry_notes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_file_attachments_note_id ON file_attachments(note_id) WHERE note_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_attachments_entity_enquiry ON file_attachments(entity_type, entity_id) WHERE entity_type = 'enquiry';
