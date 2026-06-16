/**
 * Oil Tank Location Helper
 * Standards: OFTEC OFS T100, Building Regulations Part J (England/Wales),
 * CIRIA C736 (secondary containment for oil storage)
 * Minimum distances per OFTEC Technical Book 3 / OFS T100 Table 2
 */
import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookmarkPlus, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaveToJobDialog } from "@/components/save-to-job-dialog";
import { SEOHead } from "@/components/seo-head";

interface CheckItem {
  id: string;
  label: string;
  standard: string;
  required: number; // mm (or litres for capacity checks)
  unit: string;
  value: string;
  setValue: (v: string) => void;
  pass: boolean | null;
  na?: boolean;
}

type BundType = "integral" | "external" | "none";
type TankType = "plastic_single" | "steel_single" | "bunded";

function passCheck(measured: string, required: number, mustBeAtLeast = true): boolean | null {
  const v = parseFloat(measured);
  if (isNaN(v) || measured === "") return null;
  return mustBeAtLeast ? v >= required : v < required;
}

function ResultBadge({ pass }: { pass: boolean | null }) {
  if (pass === null) return <span className="text-xs text-muted-foreground bg-slate-100 rounded px-2 py-0.5">Not entered</span>;
  if (pass) return <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-0.5"><CheckCircle2 className="w-3 h-3" /> PASS</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 rounded px-2 py-0.5"><XCircle className="w-3 h-3" /> FAIL</span>;
}

export default function OilTankLocation() {
  const [capacity, setCapacity] = useState("");
  const [tankType, setTankType] = useState<TankType>("plastic_single");
  const [bundType, setBundType] = useState<BundType>("none");
  const [bundCapacity, setBundCapacity] = useState("");

  // Distance fields (all in mm unless stated)
  const [dNonFireRated, setDNonFireRated] = useState("");
  const [dEaves, setDEaves] = useState("");
  const [dBoundary, setDBoundary] = useState("");
  const [dOpenings, setDOpenings] = useState("");
  const [dFlueTerm, setDFlueTerm] = useState("");
  const [dOilAppliance, setDOilAppliance] = useState("");
  const [dWatercourse, setDWatercourse] = useState(""); // metres

  const [saveOpen, setSaveOpen] = useState(false);

  const cap = parseFloat(capacity) || 0;

  // OFTEC OFS T100 / Part J minimum distances
  const checks: { label: string; standard: string; required: number; unit: string; value: string; pass: boolean | null; note?: string }[] = [
    {
      label: "Distance from non-fire-rated building / structure",
      standard: "OFTEC OFS T100 Table 2 / Part J",
      required: 760,
      unit: "mm",
      value: dNonFireRated,
      pass: passCheck(dNonFireRated, 760),
    },
    {
      label: "Distance from eaves of non-fire-rated building",
      standard: "OFTEC OFS T100",
      required: 600,
      unit: "mm",
      value: dEaves,
      pass: passCheck(dEaves, 600),
    },
    {
      label: "Distance from boundary / fence / wall",
      standard: "OFTEC OFS T100 Table 2",
      required: 600,
      unit: "mm",
      value: dBoundary,
      pass: passCheck(dBoundary, 600),
    },
    {
      label: "Distance from openings (doors / windows / air bricks)",
      standard: "OFTEC OFS T100 Table 2",
      required: 760,
      unit: "mm",
      value: dOpenings,
      pass: passCheck(dOpenings, 760),
    },
    {
      label: "Distance from flue terminal of oil-fired appliance",
      standard: "OFTEC OFS T100",
      required: 600,
      unit: "mm",
      value: dFlueTerm,
      pass: passCheck(dFlueTerm, 600),
    },
    {
      label: "Distance from the oil-fired appliance itself",
      standard: "OFTEC OFS T100",
      required: 760,
      unit: "mm",
      value: dOilAppliance,
      pass: passCheck(dOilAppliance, 760),
    },
  ];

  // Bund requirement
  const bundRequired = cap > 2500 || (parseFloat(dWatercourse) < 10 && dWatercourse !== "");
  const bundCapacityRequired = Math.ceil(cap * 1.1); // 110% per CIRIA C736
  const bundCapOk = bundType !== "none" && parseFloat(bundCapacity) >= bundCapacityRequired;
  const allEntered = checks.every(c => c.value !== "");
  const allPass = checks.every(c => c.pass === true) && (!bundRequired || bundCapOk);

  function formatResult(): string {
    const lines = [
      "OIL TANK LOCATION CHECK",
      `Standard: OFTEC OFS T100, Building Regulations Part J, CIRIA C736`,
      `Tank capacity: ${capacity || "–"} L`,
      `Tank type: ${tankType.replace("_", " ")}`,
      `Bund: ${bundType}`,
      "",
      "DISTANCE CHECKS:",
    ];
    checks.forEach(c => {
      const status = c.pass === null ? "not entered" : c.pass ? "PASS" : "FAIL";
      lines.push(`${c.label}: ${c.value || "–"} ${c.unit} (min ${c.required} ${c.unit}) — ${status}`);
    });
    lines.push("");
    lines.push(`BUND REQUIRED: ${bundRequired ? "YES" : "No"}`);
    if (bundRequired) {
      lines.push(`Minimum bund capacity: ${bundCapacityRequired} L (110% of tank)`);
      lines.push(`Actual bund capacity entered: ${bundCapacity || "–"} L — ${bundCapOk ? "PASS" : "FAIL"}`);
    }
    lines.push("");
    lines.push(`OVERALL: ${allPass ? "ALL CHECKS PASSED" : "ACTION REQUIRED — see items above"}`);
    return lines.join("\n");
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-20">
      <SEOHead
        title="Oil Tank Siting Distance Calculator — OFTEC OFS T100"
        description="Check oil tank siting distances, bund requirements and secondary containment volumes. Free tool for OFTEC-registered engineers, compliant with OFS T100, Part J and CIRIA C736."
        canonical="https://www.tradeworkdesk.co.uk/tools/oil-tank-location"
      />
      <div>
        <Link href="/tools" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tools
        </Link>
        <h1 className="text-2xl font-bold">Oil Tank Location Helper</h1>
        <p className="text-muted-foreground text-sm mt-1">OFTEC OFS T100 · Building Regulations Part J · CIRIA C736</p>
      </div>

      {/* Tank details */}
      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-sm">Tank Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Tank Capacity (litres)</Label>
            <Input value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="1000" />
          </div>
          <div>
            <Label className="text-xs">Tank Type</Label>
            <Select value={tankType} onValueChange={v => setTankType(v as TankType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="plastic_single">Plastic single-skin</SelectItem>
                <SelectItem value="steel_single">Steel single-skin</SelectItem>
                <SelectItem value="bunded">Bunded (factory)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Bund Type</Label>
            <Select value={bundType} onValueChange={v => setBundType(v as BundType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="integral">Integral (factory bunded)</SelectItem>
                <SelectItem value="external">External (site-built)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {bundType !== "none" && (
            <div>
              <Label className="text-xs">Bund Capacity (litres)</Label>
              <Input value={bundCapacity} onChange={e => setBundCapacity(e.target.value)} placeholder={bundCapacityRequired.toString()} />
            </div>
          )}
          <div>
            <Label className="text-xs">Distance to Watercourse / Drain (metres)</Label>
            <Input value={dWatercourse} onChange={e => setDWatercourse(e.target.value)} placeholder="e.g. 15" />
          </div>
        </div>
        {bundRequired && (
          <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${bundCapOk ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              <strong>Bund required</strong> — tank &gt;2,500 L{parseFloat(dWatercourse) < 10 ? " or within 10 m of watercourse" : ""}.
              Minimum bund capacity: <strong>{bundCapacityRequired.toLocaleString()} L</strong> (110% of tank capacity per CIRIA C736).
            </span>
          </div>
        )}
      </Card>

      {/* Distance checks */}
      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-sm">Siting Distance Checks</h2>
        <p className="text-xs text-muted-foreground">Enter measured distances in millimetres. Minimum distances per OFTEC OFS T100 Table 2.</p>
        <div className="space-y-3">
          {[
            { label: "Non-fire-rated building / structure (mm)", min: 760, value: dNonFireRated, set: setDNonFireRated, standard: "OFS T100 Table 2" },
            { label: "Eaves of non-fire-rated building (mm)", min: 600, value: dEaves, set: setDEaves, standard: "OFS T100" },
            { label: "Site boundary / fence / wall (mm)", min: 600, value: dBoundary, set: setDBoundary, standard: "OFS T100 Table 2" },
            { label: "Door, window or air brick opening (mm)", min: 760, value: dOpenings, set: setDOpenings, standard: "OFS T100 Table 2" },
            { label: "Flue terminal of oil appliance (mm)", min: 600, value: dFlueTerm, set: setDFlueTerm, standard: "OFS T100" },
            { label: "Oil-fired appliance itself (mm)", min: 760, value: dOilAppliance, set: setDOilAppliance, standard: "OFS T100" },
          ].map(item => {
            const pass = passCheck(item.value, item.min);
            return (
              <div key={item.label} className="flex items-center gap-3">
                <div className="flex-1">
                  <Label className="text-xs">{item.label} <span className="text-muted-foreground">(min {item.min} mm — {item.standard})</span></Label>
                  <Input value={item.value} onChange={e => item.set(e.target.value)} placeholder={`min ${item.min}`} className="mt-1" />
                </div>
                <div className="pt-5">
                  <ResultBadge pass={pass} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Overall result */}
      {allEntered && (
        <Card className={`p-4 ${allPass ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex items-center gap-2">
            {allPass
              ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              : <XCircle className="w-5 h-5 text-red-600" />}
            <span className={`font-semibold ${allPass ? "text-emerald-700" : "text-red-700"}`}>
              {allPass ? "All checks passed — location is acceptable" : "One or more checks failed — review siting position"}
            </span>
          </div>
        </Card>
      )}

      <div className="flex gap-3">
        <Button onClick={() => setSaveOpen(true)} className="gap-2"><BookmarkPlus className="w-4 h-4" /> Save to Job</Button>
      </div>

      <SaveToJobDialog open={saveOpen} onClose={() => setSaveOpen(false)} content={formatResult()} toolName="Oil Tank Location Check" />
    </div>
  );
}
