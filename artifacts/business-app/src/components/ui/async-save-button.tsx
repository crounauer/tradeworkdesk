import { useState } from "react";
import { Check, Loader2, Save } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

type AsyncSaveButtonProps = Omit<ButtonProps, "onClick" | "children" | "disabled"> & {
  onSave: () => Promise<unknown>;
  label?: string;
  disabled?: boolean;
};

export function AsyncSaveButton({
  onSave,
  label = "Save Changes",
  disabled = false,
  ...props
}: AsyncSaveButtonProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (saving || disabled) return;
    setSaved(false);
    setSaving(true);
    try {
      await onSave();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch {
      // Save callers retain responsibility for their existing error feedback.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Button {...props} onClick={() => void handleSave()} disabled={disabled || saving}>
      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : saved ? <Check className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
      {saving ? "Saving..." : saved ? "Saved" : label}
    </Button>
  );
}
