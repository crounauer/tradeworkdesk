/**
 * Flue Siting Checklist for Oil-Fired Appliances
 * Standards:
 *   - BS 5410-1:2014 Table 8 (terminal positions for oil appliances)
 *   - OFTEC OFS T200 (Oil Firing Technical Association)
 *   - Building Regulations Part J Table 1
 *
 * All distances in millimetres unless stated
 */
import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookmarkPlus, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaveToJobDialog } from "@/components/save-to-job-dialog";

type TerminalType = "balanced_horizontal" | "balanced_vertical" | "open_flue_vertical" | "low_level_discharge";

// Minimum clearances per BS 5410-1:2014 Table 8 / OFTEC OFS T200
// Values in mm
interface CheckDef {
  id: string;
  label: string;
  standard: string;
  min: Record<TerminalType, number | null>; // null = not applicable
}

const CHECKS: CheckDef[] = [
  {
    id: "directly_below_window",
    label: "Directly below an openable window or air brick",
    standard: "BS 5410-1 Table 8 / Part J",
    min: { balanced_horizontal: 300, balanced_vertical: 600, open_flue_vertical: 600, low_level_discharge: 600 },
  },
  {
    id: "alongside_window",
    label: "Horizontally alongside a window or air brick",
    standard: "BS 5410-1 Table 8",
    min: { balanced_horizontal: 300, balanced_vertical: 300, open_flue_vertical: 300, low_level_discharge: 300 },
  },
  {
    id: "above_window",
    label: "Above a window, door or air brick",
    standard: "BS 5410-1 Table 8",
    min: { balanced_horizontal: 300, balanced_vertical: 300, open_flue_vertical: 300, low_level_discharge: 300 },
  },
  {
    id: "below_eaves",
    label: "Below eaves / soffit of a building",
    standard: "BS 5410-1 Table 8",
    min: { balanced_horizontal: 300, balanced_vertical: null, open_flue_vertical: null, low_level_discharge: 300 },
  },
  {
    id: "below_guttering",
    label: "Below a balcony or guttering",
    standard: "BS 5410-1 Table 8",
    min: { balanced_horizontal: 75, balanced_vertical: null, open_flue_vertical: null, low_level_discharge: 75 },
  },
  {
    id: "from_corner",
    label: "From an internal or external corner",
    standard: "BS 5410-1 Table 8",
    min: { balanced_horizontal: 300, balanced_vertical: 300, open_flue_vertical: 300, low_level_discharge: 300 },
  },
  {
    id: "from_boundary",
    label: "From a boundary / neighbouring property",
    standard: "BS 5410-1 Table 8 / Part J",
    min: { balanced_horizontal: 600, balanced_vertical: 600, open_flue_vertical: 600, low_level_discharge: 600 },
  },
  {
    id: "from_ground",
    label: "From ground level / soil / hard standing",
    standard: "BS 5410-1 Table 8",
    min: { balanced_horizontal: 300, balanced_vertical: null, open_flue_vertical: 300, low_level_discharge: 300 },
  },
  {
    id: "from_adjacent_terminal",
    label: "From another terminal (same or adjacent appliance)",
    standard: "BS 5410-1 Table 8",
    min: { balanced_horizontal: 300, balanced_vertical: 600, open_flue_vertical: 600, low_level_discharge: 300 },
  },
  {
    id: "reentrant_corner",
    label: "In a re-entrant corner (enclosed on two sides)",
    standard: "OFTEC OFS T200",
    min: { balanced_horizontal: 600, balanced_vertical: 600, open_flue_vertical: 600, low_level_discharge: 600 },
  },
  {
    id: "oil_tank",
    label: "From oil storage tank",
    standard: "OFTEC OFS T100",
    min: { balanced_horizontal: 600, balanced_vertical: 600, open_flue_vertical: 600, low_level_discharge: 600 },
  },
];

function passCheck(value: string, min: number | null): boolean | null {
  if (min === null) return null; // N/A for this terminal type
  const v = parseFloat(value);
  if (isNaN(v) || value === "") return null;
  return v >= min;
}

function ResultBadge({ pass, na }: { pass: boolean | null; na?: boolean }) {
  if (na) return <span className="text-xs text-slate-400 bg-slate-100 rounded px-2 py-0.5">N/A</span>;
  if (pass === null) return <span className="text-xs text-muted-foreground bg-slate-100 rounded px-2 py-0.5">Not entered</span>;
  if (pass) return <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-0.5"><CheckCircle2 className="w-3 h-3" /> PASS</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 rounded px-2 py-0.5"><XCircle className="w-3 h-3" /> FAIL</span>;
}

export default function FlueSiting() {
  const [terminalType, setTerminalType] = useState<TerminalType>("balanced_horizontal");
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);

  function setValue(id: string, v: string) { setValues(prev => ({ ...prev, [id]: v })); }

  const applicableChecks = CHECKS.filter(c => c.min[terminalType] !== null);
  const results = applicableChecks.map(c => ({
    ...c,
    value: values[c.id] || "",
    pass: passCheck(values[c.id] || "", c.min[terminalType]),
  }));
  const allEntered = results.every(c => c.value !== "");
  const allPass = results.every(c => c.pass === true);
  const failCount = results.filter(c => c.pass === false).length;

  function formatResult(): string {
    const termLabel: Record<TerminalType, string> = {
      balanced_horizontal: "Balanced Flue — Horizontal Terminal",
      balanced_vertical: "Balanced Flue — Vertical Terminal",
      open_flue_vertical: "Open Flue — Vertical Terminal",
      low_level_discharge: "Low-Level Discharge Terminal",
    };
    const lines = [
      "FLUE SITING CHECKLIST — OIL-FIRED APPLIANCE",
      "Standard: BS 5410-1:2014 Table 8, OFTEC OFS T200, Building Regulations Part J",
      `Terminal type: ${termLabel[terminalType]}`,
      "",
    ];
    results.forEach(c => {
      const status = c.pass === null ? "not entered" : c.pass ? "PASS" : "FAIL";
      lines.push(`${c.label}: ${c.value || "–"} mm (min ${c.min[terminalType]} mm) — ${status}`);
    });
    lines.push("");
    if (notes) lines.push(`Notes: ${notes}`);
    lines.push(`OVERALL: ${allPass ? "ALL CHECKS PASSED" : `${failCount} FAILURE(S) — remedial action required`}`);
    return lines.join("\n");
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-20">
      <div>
        <Link href="/tools" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tools
        </Link>
        <h1 className="text-2xl font-bold">Flue Siting Checklist</h1>
        <p className="text-muted-foreground text-sm mt-1">BS 5410-1:2014 Table 8 · OFTEC OFS T200 · Building Regulations Part J</p>
      </div>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-sm">Terminal Type</h2>
        <Select value={terminalType} onValueChange={v => setTerminalType(v as TerminalType)}>
          <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="balanced_horizontal">Balanced Flue — Horizontal Terminal</SelectItem>
            <SelectItem value="balanced_vertical">Balanced Flue — Vertical Terminal</SelectItem>
            <SelectItem value="open_flue_vertical">Open Flue — Vertical Terminal</SelectItem>
            <SelectItem value="low_level_discharge">Low-Level Discharge Terminal</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-sm">Clearance Measurements (all in mm)</h2>
        <div className="space-y-3">
          {CHECKS.map(check => {
            const min = check.min[terminalType];
            if (min === null) return (
              <div key={check.id} className="flex items-center gap-3 opacity-40">
                <div className="flex-1">
                  <Label className="text-xs">{check.label}</Label>
                </div>
                <ResultBadge pass={null} na />
              </div>
            );
            const val = values[check.id] || "";
            const pass = passCheck(val, min);
            return (
              <div key={check.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <Label className="text-xs">{check.label} <span className="text-muted-foreground">(min {min} mm — {check.standard})</span></Label>
                  <Input value={val} onChange={e => setValue(check.id, e.target.value)} placeholder={`min ${min}`} className="mt-1" />
                </div>
                <div className="pt-5"><ResultBadge pass={pass} /></div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <Label className="text-xs">Notes / Remedial Actions</Label>
        <textarea
          className="w-full border rounded-md p-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Terminal repositioned 350mm higher to achieve 300mm clearance from window..."
        />
      </Card>

      {allEntered && (
        <Card className={`p-4 ${allPass ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex items-center gap-2">
            {allPass ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-red-600" />}
            <span className={`font-semibold ${allPass ? "text-emerald-700" : "text-red-700"}`}>
              {allPass ? "All siting checks passed" : `${failCount} check${failCount !== 1 ? "s" : ""} failed — remedial action required`}
            </span>
          </div>
        </Card>
      )}

      <Button onClick={() => setSaveOpen(true)} className="gap-2"><BookmarkPlus className="w-4 h-4" /> Save to Job</Button>
      <SaveToJobDialog open={saveOpen} onClose={() => setSaveOpen(false)} content={formatResult()} toolName="Flue Siting Checklist" />
    </div>
  );
}
