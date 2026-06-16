/**
 * Flue Siting Checklist for Gas-Fired Appliances
 * Standards:
 *   - BS 5440-1:2008 (installation & maintenance of flues for gas appliances)
 *   - Gas Safety (Installation and Use) Regulations 1998, Schedule 1
 *   - Building Regulations Part J (combustion appliances and fuel storage)
 *   - Manufacturer installation instructions (always take the more restrictive)
 *
 * Terminal types covered:
 *   rs_horizontal — Room-sealed balanced flue, horizontal terminal (most common: condensing combi/system)
 *   rs_vertical   — Room-sealed balanced flue, vertical terminal (flat roof / restricted position)
 *   open_natural  — Open flue, natural draught (Type B22 — older/conventional appliances)
 *   open_fan      — Open flue, fan-assisted (se-duct, u-duct)
 *
 * All distances in millimetres unless stated.
 */
import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookmarkPlus, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaveToJobDialog } from "@/components/save-to-job-dialog";
import { SEOHead } from "@/components/seo-head";

type TerminalType = "rs_horizontal" | "rs_vertical" | "open_natural" | "open_fan";

interface CheckDef {
  id: string;
  label: string;
  standard: string;
  note?: string;
  // null = N/A for this terminal type
  min: Record<TerminalType, number | null>;
}

// BS 5440-1:2008 Table 1 clearances (mm)
const CHECKS: CheckDef[] = [
  {
    id: "below_window",
    label: "Directly below an openable window, air brick or any other opening",
    standard: "BS 5440-1:2008 Table 1",
    min: { rs_horizontal: 300, rs_vertical: null, open_natural: 600, open_fan: 300 },
  },
  {
    id: "alongside_window",
    label: "Horizontally alongside a window, air brick or any other opening",
    standard: "BS 5440-1:2008 Table 1",
    min: { rs_horizontal: 300, rs_vertical: null, open_natural: 600, open_fan: 300 },
  },
  {
    id: "above_window",
    label: "Above a window, air brick or any other opening",
    standard: "BS 5440-1:2008 Table 1",
    min: { rs_horizontal: 300, rs_vertical: null, open_natural: null, open_fan: 300 },
  },
  {
    id: "below_eaves",
    label: "Below eaves or soffit of a building",
    standard: "BS 5440-1:2008 Table 1",
    min: { rs_horizontal: 200, rs_vertical: null, open_natural: null, open_fan: 200 },
  },
  {
    id: "below_balcony",
    label: "Below a balcony, car port roof or guttering",
    standard: "BS 5440-1:2008 Table 1",
    min: { rs_horizontal: 200, rs_vertical: null, open_natural: null, open_fan: 200 },
  },
  {
    id: "facing_surface",
    label: "From a surface facing the terminal (e.g. opposite wall or fence)",
    standard: "BS 5440-1:2008 Table 1",
    note: "600 mm minimum to prevent combustion products recirculating",
    min: { rs_horizontal: 600, rs_vertical: null, open_natural: null, open_fan: 600 },
  },
  {
    id: "from_corner",
    label: "From an internal or external corner of the building",
    standard: "BS 5440-1:2008 Table 1",
    min: { rs_horizontal: 200, rs_vertical: 200, open_natural: null, open_fan: 200 },
  },
  {
    id: "above_ground_open",
    label: "Above adjacent ground level (open / accessible location)",
    standard: "BS 5440-1:2008 Table 1",
    min: { rs_horizontal: 300, rs_vertical: null, open_natural: null, open_fan: 300 },
  },
  {
    id: "above_ground_protected",
    label: "Above ground (protected position — passageway / covered walkway ≤ 1m wide)",
    standard: "BS 5440-1:2008 Table 1",
    note: "Increased clearance required where public access is restricted",
    min: { rs_horizontal: 2300, rs_vertical: null, open_natural: null, open_fan: 2300 },
  },
  {
    id: "from_gas_meter",
    label: "From a gas meter or LPG regulator",
    standard: "BS 5440-1:2008 / Gas Safety Regs",
    min: { rs_horizontal: 300, rs_vertical: 300, open_natural: 300, open_fan: 300 },
  },
  {
    id: "from_electrical_h",
    label: "Horizontally from an electricity meter, switch or socket outlet",
    standard: "BS 5440-1:2008 Table 1",
    min: { rs_horizontal: 300, rs_vertical: 300, open_natural: 300, open_fan: 300 },
  },
  {
    id: "from_electrical_v",
    label: "Vertically below an electricity meter, switch or socket outlet",
    standard: "BS 5440-1:2008 Table 1",
    min: { rs_horizontal: 300, rs_vertical: null, open_natural: null, open_fan: 300 },
  },
  {
    id: "from_terminal_h",
    label: "Horizontally from another flue terminal",
    standard: "BS 5440-1:2008 Table 1",
    min: { rs_horizontal: 600, rs_vertical: 600, open_natural: 600, open_fan: 600 },
  },
  {
    id: "from_terminal_v",
    label: "Vertically above another flue terminal",
    standard: "BS 5440-1:2008 Table 1",
    min: { rs_horizontal: 1500, rs_vertical: 1500, open_natural: 1500, open_fan: 1500 },
  },
  {
    id: "above_flat_roof",
    label: "Above flat roof or adjacent roof surface",
    standard: "BS 5440-1:2008 Table 1",
    min: { rs_horizontal: null, rs_vertical: 500, open_natural: 1000, open_fan: null },
  },
  {
    id: "from_adjacent_wall",
    label: "From an adjacent wall, parapet or upstand (vertical terminal)",
    standard: "BS 5440-1:2008 Table 1",
    min: { rs_horizontal: null, rs_vertical: 500, open_natural: null, open_fan: null },
  },
  {
    id: "from_flammable",
    label: "From any flammable material or combustible surface",
    standard: "BS 5440-1:2008 / Part J",
    min: { rs_horizontal: 600, rs_vertical: 600, open_natural: 600, open_fan: 600 },
  },
];

const TERMINAL_LABELS: Record<TerminalType, string> = {
  rs_horizontal: "Room-Sealed — Horizontal Terminal (balanced flue)",
  rs_vertical:   "Room-Sealed — Vertical Terminal (balanced flue)",
  open_natural:  "Open Flue — Natural Draught (Type B22)",
  open_fan:      "Open Flue — Fan-Assisted",
};

function passCheck(value: string, min: number | null): boolean | null {
  if (min === null) return null;
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

export default function GasFlueSiting() {
  const [terminalType, setTerminalType] = useState<TerminalType>("rs_horizontal");
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
    const lines = [
      "FLUE SITING CHECKLIST — GAS-FIRED APPLIANCE",
      "Standard: BS 5440-1:2008, Gas Safety (Installation and Use) Regulations 1998, Building Regulations Part J",
      `Terminal type: ${TERMINAL_LABELS[terminalType]}`,
      "",
    ];
    results.forEach(c => {
      const status = c.pass === null ? "not entered" : c.pass ? "PASS" : "FAIL";
      lines.push(`${c.label}: ${c.value || "–"} mm (min ${c.min[terminalType]} mm) — ${status}`);
    });
    lines.push("");
    if (notes) lines.push(`Notes: ${notes}`);
    lines.push(`OVERALL: ${allPass && allEntered ? "ALL CHECKS PASSED" : !allEntered ? "INCOMPLETE — not all measurements entered" : `${failCount} FAILURE(S) — remedial action required`}`);
    return lines.join("\n");
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-20">
      <SEOHead
        title="Gas Flue Terminal Siting Checklist — BS 5440-1"
        description="Check gas flue terminal clearances for balanced flue and open-flue appliances. Free checklist compliant with BS 5440-1:2008 and Gas Safety (Installation and Use) Regulations 1998."
        canonical="https://www.tradeworkdesk.co.uk/tools/gas-flue-siting"
      />
      <div>
        <Link href="/tools" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tools
        </Link>
        <h1 className="text-2xl font-bold">Gas Flue Siting Checklist</h1>
        <p className="text-muted-foreground text-sm mt-1">BS 5440-1:2008 · Gas Safety (Installation and Use) Regulations 1998 · Building Regulations Part J</p>
      </div>

      <Card className="p-4 space-y-3 border-amber-200 bg-amber-50">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            Always refer to the appliance manufacturer's installation instructions — these may specify more restrictive clearances than BS 5440-1. Take whichever distance is greater.
          </p>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-sm">Terminal Type</h2>
        <Select value={terminalType} onValueChange={v => { setTerminalType(v as TerminalType); setValues({}); }}>
          <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rs_horizontal">Room-Sealed — Horizontal Terminal (balanced flue)</SelectItem>
            <SelectItem value="rs_vertical">Room-Sealed — Vertical Terminal (balanced flue)</SelectItem>
            <SelectItem value="open_natural">Open Flue — Natural Draught (Type B22)</SelectItem>
            <SelectItem value="open_fan">Open Flue — Fan-Assisted</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-sm">Clearance Measurements (all in mm)</h2>
        <p className="text-xs text-muted-foreground">Enter the actual measured distance for each applicable check. Greyed-out rows are not applicable to the selected terminal type.</p>
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
                  <Label className="text-xs">
                    {check.label}{" "}
                    <span className="text-muted-foreground">(min {min} mm — {check.standard})</span>
                  </Label>
                  {check.note && <p className="text-xs text-muted-foreground italic mt-0.5">{check.note}</p>}
                  <Input
                    value={val}
                    onChange={e => setValue(check.id, e.target.value)}
                    placeholder={`min ${min}`}
                    className="mt-1"
                    type="number"
                    min="0"
                  />
                </div>
                <div className="pt-5"><ResultBadge pass={pass} /></div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Notes */}
      <Card className="p-4 space-y-2">
        <Label className="text-xs font-semibold">Site Notes / Observations</Label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Terminal relocated 150mm to the right to clear window opening"
          className="w-full border rounded-md p-2 text-sm resize-none h-20 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </Card>

      {/* Overall result */}
      {allEntered && (
        <Card className={`p-4 ${allPass ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
          <div className="flex items-center gap-3">
            {allPass
              ? <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              : <XCircle className="w-6 h-6 text-red-600 shrink-0" />}
            <div>
              <div className={`font-semibold ${allPass ? "text-emerald-800" : "text-red-800"}`}>
                {allPass ? "All checks passed" : `${failCount} check${failCount > 1 ? "s" : ""} failed`}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {allPass
                  ? "Terminal position complies with BS 5440-1:2008 for this terminal type."
                  : "Remedial action required before commissioning. Reposition terminal to achieve minimum clearances."}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Button onClick={() => setSaveOpen(true)} className="gap-2">
        <BookmarkPlus className="w-4 h-4" /> Save to Job
      </Button>
      <SaveToJobDialog open={saveOpen} onClose={() => setSaveOpen(false)} content={formatResult()} toolName="Gas Flue Siting Checklist" />
    </div>
  );
}
