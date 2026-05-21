/**
 * Pump Head & Pipe Sizing Helper
 * Standards:
 *   - CIBSE Guide C:2007 Section 4 (pipe sizing / pressure drop tables)
 *   - BSRIA BG 2/2003 (commissioning of water systems)
 *   - BS EN 12828:2012 (heating systems — design)
 *
 * Approach:
 *   1. User enters total heat output (kW) and system ΔT → derives flow rate (l/s)
 *   2. User defines index circuit as segments (length, pipe bore, fitting allowance)
 *   3. Pressure drop per metre from CIBSE Guide C Table 4.9 (water at 70°C)
 *   4. Velocity check per segment (0.3–1.5 m/s)
 *   5. Total pump head = sum(ΔP per segment) + heat emitter head loss
 *
 * CIBSE Guide C Table 4.9 pressure drop data (Pa/m at 70°C) — embedded lookup
 * Pipe bores (nominal / actual internal diameter):
 *   15 mm copper = 13.6 mm ID   22 mm = 20.2 mm   28 mm = 26.2 mm
 *   35 mm = 32.6 mm   42 mm = 39.6 mm
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookmarkPlus, Plus, Trash2, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaveToJobDialog } from "@/components/save-to-job-dialog";

// Internal diameters for copper pipe (mm) — BS EN 1057
const PIPES: { label: string; nominalMm: number; idMm: number; areaMm2: number }[] = [
  { label: "15 mm",  nominalMm: 15, idMm: 13.6,  areaMm2: Math.PI * (13.6 / 2) ** 2 },
  { label: "22 mm",  nominalMm: 22, idMm: 20.2,  areaMm2: Math.PI * (20.2 / 2) ** 2 },
  { label: "28 mm",  nominalMm: 28, idMm: 26.2,  areaMm2: Math.PI * (26.2 / 2) ** 2 },
  { label: "35 mm",  nominalMm: 35, idMm: 32.6,  areaMm2: Math.PI * (32.6 / 2) ** 2 },
  { label: "42 mm",  nominalMm: 42, idMm: 39.6,  areaMm2: Math.PI * (39.6 / 2) ** 2 },
];

// CIBSE Guide C Table 4.9 — pressure drop (Pa/m) at 70°C for given flow rates (l/s)
// Interpolated for common design flow rates. Format: [flowLitreSec, Pa_per_m]
// For 15 mm (ID 13.6 mm):
const CIBSE_PD: Record<number, [number, number][]> = {
  15: [
    [0.02, 18], [0.03, 37], [0.05, 88], [0.07, 161], [0.10, 310], [0.15, 640], [0.20, 1080],
  ],
  22: [
    [0.05, 18], [0.08, 39], [0.10, 57], [0.15, 113], [0.20, 186], [0.30, 370], [0.40, 620], [0.50, 920],
  ],
  28: [
    [0.10, 18], [0.15, 35], [0.20, 57], [0.30, 113], [0.40, 183], [0.60, 370], [0.80, 610],
  ],
  35: [
    [0.20, 20], [0.30, 40], [0.40, 65], [0.60, 130], [0.80, 210], [1.00, 300], [1.50, 620],
  ],
  42: [
    [0.40, 28], [0.60, 55], [0.80, 89], [1.00, 130], [1.50, 265], [2.00, 440],
  ],
};

// Linear interpolation / extrapolation for pressure drop
function getPaPerMetre(nomMm: number, flowLs: number): number {
  const table = CIBSE_PD[nomMm];
  if (!table) return 0;
  if (flowLs <= table[0][0]) return table[0][1] * (flowLs / table[0][0]);
  if (flowLs >= table[table.length - 1][0]) {
    const last = table[table.length - 1];
    const prev = table[table.length - 2];
    const slope = (last[1] - prev[1]) / (last[0] - prev[0]);
    return last[1] + slope * (flowLs - last[0]);
  }
  for (let i = 1; i < table.length; i++) {
    if (flowLs <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      return y0 + ((flowLs - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 0;
}

function velocityMs(flowLs: number, idMm: number): number {
  // v = Q / A, Q in m³/s, A in m²
  const Qm3s = flowLs / 1000;
  const Am2 = Math.PI * ((idMm / 1000) / 2) ** 2;
  return Qm3s / Am2;
}

interface Segment {
  id: string;
  label: string;
  pipe: number;     // nominal mm
  length: string;   // metres
  fittingsAllowance: string; // % (e.g. "20" for 20% addition)
  heatLoad: string; // kW load on this segment (to derive flow)
}

const newSegment = (): Segment => ({
  id: Math.random().toString(36).slice(2),
  label: `Segment ${Date.now() % 1000}`,
  pipe: 22,
  length: "",
  fittingsAllowance: "20",
  heatLoad: "",
});

export default function PumpHead() {
  const [totalKw, setTotalKw] = useState("");
  const [systemDeltaT, setSystemDeltaT] = useState("20"); // °C
  const [emitterHead, setEmitterHead] = useState("2000"); // Pa — typical radiator/manifold loss
  const [segments, setSegments] = useState<Segment[]>([newSegment()]);
  const [saveOpen, setSaveOpen] = useState(false);

  function updateSeg(id: string, patch: Partial<Segment>) {
    setSegments(ss => ss.map(s => s.id === id ? { ...s, ...patch } : s));
  }
  function addSeg() { setSegments(ss => [...ss, newSegment()]); }
  function removeSeg(id: string) { setSegments(ss => ss.filter(s => s.id !== id)); }

  const dT = parseFloat(systemDeltaT) || 20;

  // System total flow
  const totalFlowLs = parseFloat(totalKw) > 0
    ? (parseFloat(totalKw) * 1000) / (4200 * dT) // Q = P / (ρCp ΔT), ρ≈1, Cp≈4200 J/kgK
    : 0;

  // Segment calculations
  const segResults = useMemo(() => segments.map(s => {
    const len = parseFloat(s.length) || 0;
    const fitting = parseFloat(s.fittingsAllowance) || 0;
    const segKw = parseFloat(s.heatLoad) || (parseFloat(totalKw) || 0);
    const segFlow = segKw > 0 ? (segKw * 1000) / (4200 * dT) : 0;
    const pipe = PIPES.find(p => p.nominalMm === s.pipe) ?? PIPES[1];
    const vel = velocityMs(segFlow, pipe.idMm);
    const pdPerM = getPaPerMetre(s.pipe, segFlow);
    const effectiveLen = len * (1 + fitting / 100);
    const totalPdPa = pdPerM * effectiveLen;
    return { segFlow, vel, pdPerM, effectiveLen, totalPdPa };
  }), [segments, totalKw, dT]);

  const totalPipePd = segResults.reduce((s, r) => s + r.totalPdPa, 0);
  const emitterPdPa = parseFloat(emitterHead) || 0;
  const totalHeadPa = totalPipePd + emitterPdPa;
  const totalHeadKpa = totalHeadPa / 1000;
  const totalHeadMbar = totalHeadPa / 100;

  function velStatus(vel: number): "ok" | "low" | "high" {
    if (vel < 0.3) return "low";
    if (vel > 1.5) return "high";
    return "ok";
  }

  function formatResult(): string {
    const lines = [
      "PUMP HEAD & PIPE SIZING",
      "Standard: CIBSE Guide C:2007 Table 4.9, BSRIA BG 2/2003, BS EN 12828",
      `Total system output: ${totalKw || "–"} kW at ΔT ${dT}°C`,
      `Total system flow rate: ${totalFlowLs.toFixed(3)} l/s (${(totalFlowLs * 60).toFixed(1)} l/min)`,
      "",
      "INDEX CIRCUIT SEGMENTS:",
    ];
    segments.forEach((s, i) => {
      const r = segResults[i];
      const velSt = velStatus(r.vel);
      lines.push(
        `  ${s.label}: ${s.pipe}mm × ${s.length || "–"}m + ${s.fittingsAllowance || 20}% fittings = ${r.effectiveLen.toFixed(1)}m equiv.` +
        ` | Flow ${r.segFlow.toFixed(3)} l/s | Vel ${r.vel.toFixed(2)} m/s ${velSt !== "ok" ? `⚠ (${velSt === "high" ? "too fast >1.5" : "too slow <0.3"})` : "✓"}` +
        ` | ${r.pdPerM.toFixed(0)} Pa/m × ${r.effectiveLen.toFixed(1)}m = ${r.totalPdPa.toFixed(0)} Pa`
      );
    });
    lines.push("");
    lines.push(`Pipe pressure drop total: ${totalPipePd.toFixed(0)} Pa`);
    lines.push(`Emitter / terminal unit head loss: ${emitterPdPa.toFixed(0)} Pa`);
    lines.push(`TOTAL PUMP HEAD REQUIRED: ${totalHeadPa.toFixed(0)} Pa = ${totalHeadKpa.toFixed(2)} kPa = ${totalHeadMbar.toFixed(0)} mbar`);
    return lines.join("\n");
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-20">
      <div>
        <Link href="/tools" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Tools
        </Link>
        <h1 className="text-2xl font-bold">Pump Head & Pipe Sizing</h1>
        <p className="text-muted-foreground text-sm mt-1">CIBSE Guide C · BSRIA BG 2/2003 · BS EN 12828</p>
      </div>

      {/* System summary */}
      <Card className="p-4 space-y-4">
        <h2 className="font-semibold text-sm">System Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs">Total Heat Output (kW)</Label>
            <Input value={totalKw} onChange={e => setTotalKw(e.target.value)} placeholder="e.g. 18" />
          </div>
          <div>
            <Label className="text-xs">System ΔT (°C)</Label>
            <Input value={systemDeltaT} onChange={e => setSystemDeltaT(e.target.value)} placeholder="20" />
            <p className="text-xs text-muted-foreground mt-0.5">Typical: 20°C HT, 10°C LTHW</p>
          </div>
          <div>
            <Label className="text-xs">Emitter / Manifold Head Loss (Pa)</Label>
            <Input value={emitterHead} onChange={e => setEmitterHead(e.target.value)} placeholder="2000" />
          </div>
          {totalFlowLs > 0 && (
            <div className="rounded-lg bg-indigo-50 p-2 text-center">
              <div className="text-xs text-muted-foreground">Total flow rate</div>
              <div className="font-bold text-indigo-700">{totalFlowLs.toFixed(3)} l/s</div>
              <div className="text-xs text-muted-foreground">{(totalFlowLs * 60).toFixed(1)} l/min</div>
            </div>
          )}
        </div>
      </Card>

      {/* Segments */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm">Index Circuit Segments</h2>
        <p className="text-xs text-muted-foreground">Add each pipe segment in the index (longest / most resistive) circuit. For each segment, enter the pipe size, run length, fittings allowance, and the heat load it serves.</p>
        {segments.map((seg, idx) => {
          const r = segResults[idx];
          const vs = velStatus(r.vel);
          return (
            <Card key={seg.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Input
                  value={seg.label}
                  onChange={e => updateSeg(seg.id, { label: e.target.value })}
                  className="font-semibold text-sm border-none p-0 h-auto focus:ring-0 focus-visible:ring-0 max-w-xs"
                  placeholder="e.g. Flow from boiler to upstairs"
                />
                {segments.length > 1 && (
                  <button onClick={() => removeSeg(seg.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Pipe Size</Label>
                  <Select value={seg.pipe.toString()} onValueChange={v => updateSeg(seg.id, { pipe: parseInt(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PIPES.map(p => <SelectItem key={p.nominalMm} value={p.nominalMm.toString()}>{p.label} copper</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Run Length (m)</Label>
                  <Input value={seg.length} onChange={e => updateSeg(seg.id, { length: e.target.value })} placeholder="e.g. 8" />
                </div>
                <div>
                  <Label className="text-xs">Fittings Allowance (%)</Label>
                  <Input value={seg.fittingsAllowance} onChange={e => updateSeg(seg.id, { fittingsAllowance: e.target.value })} placeholder="20" />
                  <p className="text-xs text-muted-foreground mt-0.5">CIBSE: 10–30% typical</p>
                </div>
                <div>
                  <Label className="text-xs">Heat Load (kW) on this segment</Label>
                  <Input value={seg.heatLoad} onChange={e => updateSeg(seg.id, { heatLoad: e.target.value })} placeholder={totalKw || "= total"} />
                </div>
              </div>

              {parseFloat(seg.length) > 0 && r.segFlow > 0 && (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded bg-slate-50 p-2">
                    <div className="text-xs text-muted-foreground">Flow rate</div>
                    <div className="font-medium">{r.segFlow.toFixed(3)} l/s</div>
                  </div>
                  <div className={`rounded p-2 ${vs === "ok" ? "bg-emerald-50" : "bg-amber-50"}`}>
                    <div className="text-xs text-muted-foreground">Velocity</div>
                    <div className={`font-medium flex items-center gap-1 ${vs === "ok" ? "text-emerald-700" : "text-amber-700"}`}>
                      {r.vel.toFixed(2)} m/s
                      {vs === "ok" && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {vs !== "ok" && <AlertTriangle className="w-3.5 h-3.5" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{vs === "high" ? "⚠ >1.5 m/s noise risk" : vs === "low" ? "⚠ <0.3 m/s air lock risk" : "0.3–1.5 m/s ✓"}</div>
                  </div>
                  <div className="rounded bg-slate-50 p-2">
                    <div className="text-xs text-muted-foreground">Pressure drop</div>
                    <div className="font-medium">{r.totalPdPa.toFixed(0)} Pa</div>
                    <div className="text-xs text-muted-foreground">{r.pdPerM.toFixed(0)} Pa/m × {r.effectiveLen.toFixed(1)} m</div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        <Button variant="outline" onClick={addSeg} className="gap-2"><Plus className="w-4 h-4" /> Add Segment</Button>
      </div>

      {/* Total head result */}
      {totalHeadPa > 0 && (
        <Card className="p-4 space-y-3 border-indigo-200 bg-indigo-50">
          <h2 className="font-semibold text-sm text-indigo-800">Pump Head Required</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Pipe losses</div>
              <div className="font-semibold">{totalPipePd.toFixed(0)} Pa</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Emitter losses</div>
              <div className="font-semibold">{emitterPdPa.toFixed(0)} Pa</div>
            </div>
            <div className="rounded-lg bg-indigo-100 p-2">
              <div className="text-xs text-muted-foreground">Total head</div>
              <div className="text-2xl font-bold text-indigo-800">{totalHeadMbar.toFixed(0)} mbar</div>
              <div className="text-xs text-muted-foreground">{totalHeadKpa.toFixed(2)} kPa</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Pump selection: look for a pump whose duty curve passes through {(totalFlowLs * 60).toFixed(0)} l/min at {totalHeadMbar.toFixed(0)} mbar. Add 10–15% margin for commissioning adjustment.
          </p>
        </Card>
      )}

      <Button onClick={() => setSaveOpen(true)} className="gap-2"><BookmarkPlus className="w-4 h-4" /> Save to Job</Button>
      <SaveToJobDialog open={saveOpen} onClose={() => setSaveOpen(false)} content={formatResult()} toolName="Pump Head Calculation" />
    </div>
  );
}
