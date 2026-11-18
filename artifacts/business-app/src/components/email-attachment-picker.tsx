import { useId, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const extensions = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".jpg", ".jpeg", ".png", ".webp"];

export function EmailAttachmentPicker({ files, onChange, disabled }: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled: boolean;
}) {
  const id = useId();
  const [error, setError] = useState("");

  function addFiles(selected: File[]) {
    if (!selected.length) return;
    const next = [...files, ...selected];
    if (next.length > MAX_FILES) {
      setError("Choose up to 5 files to attach.");
    } else if (selected.some(file => !extensions.some(extension => file.name.trim().toLowerCase().endsWith(extension)))) {
      setError("Choose PDFs, Word or Excel files, CSVs, text files, or JPG, PNG or WebP images.");
    } else if (selected.some(file => file.size === 0)) {
      setError("Empty files cannot be attached.");
    } else if (next.reduce((total, file) => total + file.size, 0) > MAX_BYTES) {
      setError("Files must be 5 MB or less in total.");
    } else {
      setError("");
      onChange(next);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-2"><Paperclip className="h-4 w-4" /> Attach files (optional)</Label>
      <Input
        id={id}
        type="file"
        multiple
        accept={extensions.join(",")}
        aria-describedby={`${id}-help`}
        disabled={disabled}
        onChange={event => {
          addFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      <p id={`${id}-help`} className="text-xs text-muted-foreground">PDFs, common documents and images. Up to 5 files, 5 MB total.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error} No new files were added.</p>}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-md border px-2 text-sm">
              <span className="min-w-0 truncate" title={file.name}>{file.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={() => {
                  setError("");
                  onChange(files.filter((_, i) => i !== index));
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export async function encodeEmailAttachments(files: File[]) {
  if (!files.length) return undefined;
  return Promise.all(files.map(file => new Promise<{ filename: string; content: string }>((resolve, reject) => {
    const reader = new FileReader();
    const fail = () => reject(new Error(`Could not read "${file.name}". Select the file again before sending.`));
    reader.onerror = fail;
    reader.onabort = fail;
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result.split(",", 2)[1] : undefined;
      if (content) resolve({ filename: file.name, content });
      else fail();
    };
    reader.readAsDataURL(file);
  })));
}
