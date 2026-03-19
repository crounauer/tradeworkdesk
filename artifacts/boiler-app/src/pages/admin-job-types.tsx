import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Pencil, ListTree, GripVertical } from "lucide-react";

const CATEGORY_OPTIONS = [
  { value: "service", label: "Service" },
  { value: "breakdown", label: "Breakdown" },
  { value: "installation", label: "Installation" },
  { value: "inspection", label: "Inspection" },
  { value: "follow_up", label: "Follow Up" },
];

const PRESET_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#8B5CF6",
  "#F59E0B", "#DC2626", "#6B7280", "#0EA5E9",
  "#14B8A6", "#F97316", "#EC4899", "#84CC16",
];

interface JobType {
  id: number;
  name: string;
  slug: string;
  category: string;
  color: string;
  default_duration_minutes: number | null;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${value === c ? "border-foreground scale-110" : "border-transparent"}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-8 p-0.5 cursor-pointer"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#3B82F6"
          className="flex-1 font-mono text-sm"
          maxLength={7}
        />
      </div>
    </div>
  );
}

function JobTypeFormDialog({
  existingType,
  onDone,
  trigger,
}: {
  existingType?: JobType;
  onDone: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(existingType?.name ?? "");
  const [category, setCategory] = useState(existingType?.category ?? "service");
  const [color, setColor] = useState(existingType?.color ?? "#3B82F6");
  const [duration, setDuration] = useState(existingType?.default_duration_minutes?.toString() ?? "");
  const { toast } = useToast();

  const isEdit = !!existingType;

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        category,
        color,
        default_duration_minutes: duration ? parseInt(duration, 10) : undefined,
      };
      if (isEdit) {
        return apiFetch(`/job-types/${existingType.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      }
      return apiFetch("/job-types", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Job type updated" : "Job type created" });
      setOpen(false);
      resetForm();
      onDone();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    if (!isEdit) {
      setName("");
      setCategory("service");
      setColor("#3B82F6");
      setDuration("");
    }
  };

  const handleOpen = (v: boolean) => {
    setOpen(v);
    if (v) {
      setName(existingType?.name ?? "");
      setCategory(existingType?.category ?? "service");
      setColor(existingType?.color ?? "#3B82F6");
      setDuration(existingType?.default_duration_minutes?.toString() ?? "");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Job Type" : "Create Job Type"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Annual Boiler Service"
            />
          </div>
          <div>
            <Label>Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Used to classify the job for reporting and scheduling.
            </p>
          </div>
          <div>
            <Label>Colour</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <div>
            <Label>Default Duration (minutes)</Label>
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 60"
              min={1}
              max={480}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !name.trim()}
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? "Save Changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JobTypeCard({ jobType, onUpdated }: { jobType: JobType; onUpdated: () => void }) {
  const { toast } = useToast();

  const toggleActive = useMutation({
    mutationFn: () =>
      apiFetch(`/job-types/${jobType.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !jobType.is_active }),
      }),
    onSuccess: () => {
      toast({ title: jobType.is_active ? "Job type deactivated" : "Job type activated" });
      onUpdated();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === jobType.category)?.label ?? jobType.category;

  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg border bg-card transition-opacity ${!jobType.is_active ? "opacity-60" : ""}`}>
      <div className="cursor-grab text-muted-foreground">
        <GripVertical className="w-4 h-4" />
      </div>
      <div
        className="w-4 h-8 rounded-full shrink-0"
        style={{ backgroundColor: jobType.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{jobType.name}</span>
          {jobType.is_default && (
            <Badge variant="outline" className="text-xs">Default</Badge>
          )}
          {!jobType.is_active && (
            <Badge variant="secondary" className="text-xs">Inactive</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          <span className="capitalize">{categoryLabel}</span>
          {jobType.default_duration_minutes && (
            <span>{jobType.default_duration_minutes} min</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <JobTypeFormDialog
          existingType={jobType}
          onDone={onUpdated}
          trigger={
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          }
        />
        <Switch
          checked={jobType.is_active}
          onCheckedChange={() => toggleActive.mutate()}
          disabled={toggleActive.isPending}
        />
      </div>
    </div>
  );
}

export default function AdminJobTypes() {
  const queryClient = useQueryClient();

  const { data: jobTypes = [], isLoading } = useQuery<JobType[]>({
    queryKey: ["job-types-admin"],
    queryFn: () => apiFetch("/job-types?includeInactive=true"),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["job-types-admin"] });
    queryClient.invalidateQueries({ queryKey: ["job-types"] });
  };

  const activeTypes = jobTypes.filter((t) => t.is_active);
  const inactiveTypes = jobTypes.filter((t) => !t.is_active);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <ListTree className="w-7 h-7 text-primary" />
            Job Types
          </h1>
          <p className="text-muted-foreground mt-1">
            Customise the job types available when scheduling work for your company.
          </p>
        </div>
        <JobTypeFormDialog
          onDone={refresh}
          trigger={
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Job Type
            </Button>
          }
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : jobTypes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ListTree className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No job types yet</p>
            <p className="text-sm mt-1">Create your first job type to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Active Job Types
                <span className="ml-2 text-sm font-normal text-muted-foreground">({activeTypes.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No active job types. Toggle some on below.</p>
              ) : (
                activeTypes.map((jt) => (
                  <JobTypeCard key={jt.id} jobType={jt} onUpdated={refresh} />
                ))
              )}
            </CardContent>
          </Card>

          {inactiveTypes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-muted-foreground">
                  Inactive Job Types
                  <span className="ml-2 text-sm font-normal">({inactiveTypes.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {inactiveTypes.map((jt) => (
                  <JobTypeCard key={jt.id} jobType={jt} onUpdated={refresh} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
