import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Plus, X, Check, Pencil, Trash2 } from "lucide-react";
import { calcDuration, computeLabourBreakdown, toLocalDatetimeStr, type LabourBreakdown } from "@/lib/line-items";
import {
  defaultMoneyFormatter,
  formatTotalTime,
  type CalloutRateOption,
  type MoneyFormatter,
  type TimeLine,
} from "./types";

export interface TimeSectionProps {
  entries: TimeLine[];
  calloutRates?: CalloutRateOption[];
  defaultHourlyRate?: number;
  defaultCalloutFee?: number;
  onAdd: (entry: Omit<TimeLine, "key">) => void | Promise<void>;
  onUpdate: (key: string, patch: Partial<TimeLine>) => void | Promise<void>;
  onDelete: (key: string) => void | Promise<void>;
  /** Preselects the add-form rate dropdown. */
  defaultCalloutRateId?: string | null;
  /** Fired when the add-form rate changes, for callers that persist the choice. */
  onCalloutRateChange?: (rateId: string | null) => void;
  /** Enables the "Estimated" add mode used by quotes. */
  allowEstimate?: boolean;
  readOnly?: boolean;
  loading?: boolean;
  formatMoney?: MoneyFormatter;
  /** Extra content rendered below the totals (e.g. the job page's legacy entry). */
  footer?: React.ReactNode;
}

function breakdownFor(entry: TimeLine): LabourBreakdown {
  if (entry.estimatedHours != null) {
    const rate = Number(entry.hourlyRate) || 0;
    const callout = Number(entry.calloutFee) || 0;
    const billableCost = entry.estimatedHours * rate;
    return {
      totalHours: entry.estimatedHours,
      calloutHours: 0,
      calloutRate: callout,
      calloutCost: callout,
      billableHours: entry.estimatedHours,
      hourlyRate: rate,
      billableCost,
      entryCost: callout + billableCost,
    };
  }
  return computeLabourBreakdown({
    arrival: entry.arrival,
    departure: entry.departure,
    hourlyRate: entry.hourlyRate,
    calloutFee: entry.calloutFee,
  });
}

function formatEntryDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatEntryTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function TimeSection({
  entries,
  calloutRates = [],
  defaultHourlyRate = 0,
  defaultCalloutFee = 0,
  onAdd,
  onUpdate,
  onDelete,
  defaultCalloutRateId,
  onCalloutRateChange,
  allowEstimate = false,
  readOnly = false,
  loading = false,
  formatMoney = defaultMoneyFormatter,
  footer,
}: TimeSectionProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [mode, setMode] = useState<"actual" | "estimate">("actual");
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [notes, setNotes] = useState("");
  const [rateId, setRateId] = useState<string>(defaultCalloutRateId || "auto");
  const [recordTimeOnly, setRecordTimeOnly] = useState(false);
  const [waiveCallout, setWaiveCallout] = useState(false);
  const [estimateHours, setEstimateHours] = useState("");
  const [estimateRate, setEstimateRate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editArrival, setEditArrival] = useState("");
  const [editDeparture, setEditDeparture] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editRateId, setEditRateId] = useState<string>("auto");
  const [editWaiveCallout, setEditWaiveCallout] = useState(false);

  const selectedRate = rateId !== "auto" ? calloutRates.find(r => r.id === rateId) : undefined;
  const calloutFee = selectedRate ? Number(selectedRate.amount) : defaultCalloutFee;
  const effectiveHourlyRate = selectedRate?.hourly_rate != null ? Number(selectedRate.hourly_rate) : defaultHourlyRate;
  const addEntryFee = recordTimeOnly || waiveCallout ? 0 : calloutFee;

  const editSelectedRate = editRateId !== "auto" ? calloutRates.find(r => r.id === editRateId) : undefined;
  const editCalloutFee = editWaiveCallout ? 0 : (editSelectedRate ? Number(editSelectedRate.amount) : defaultCalloutFee);
  const editHourlyRate = editSelectedRate?.hourly_rate != null ? Number(editSelectedRate.hourly_rate) : defaultHourlyRate;

  const sortedEntries = [...entries].sort((a, b) => {
    if (!a.arrival) return 1;
    if (!b.arrival) return -1;
    return new Date(a.arrival).getTime() - new Date(b.arrival).getTime();
  });

  const totalMinutes = sortedEntries.reduce((sum, e) => sum + breakdownFor(e).totalHours * 60, 0);
  const totalLabourCost = sortedEntries.reduce((sum, e) => sum + breakdownFor(e).entryCost, 0);

  const resetAddForm = () => {
    setArrival("");
    setDeparture("");
    setNotes("");
    setRecordTimeOnly(false);
    setWaiveCallout(false);
    setEstimateHours("");
    setEstimateRate("");
  };

  const handleAdd = async () => {
    if (submitting) return;
    if (mode === "estimate") {
      const hours = Number(estimateHours);
      const rate = Number(estimateRate);
      if (!Number.isFinite(hours) || hours <= 0) return;
      setSubmitting(true);
      try {
        await onAdd({
          arrival: null,
          departure: null,
          notes: notes.trim() || null,
          hourlyRate: Number.isFinite(rate) ? rate : 0,
          calloutFee: 0,
          estimatedHours: hours,
        });
        resetAddForm();
        setShowAdd(false);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!arrival) return;
    const arrivalDate = new Date(arrival);
    let departureDate = departure ? new Date(departure) : null;
    // Departure earlier than arrival means the visit ran past midnight.
    if (departureDate && departureDate <= arrivalDate) {
      departureDate = new Date(departureDate.getTime() + 24 * 60 * 60 * 1000);
    }
    setSubmitting(true);
    try {
      await onAdd({
        arrival: arrivalDate.toISOString(),
        departure: departureDate ? departureDate.toISOString() : null,
        notes: notes.trim() || null,
        hourlyRate: recordTimeOnly ? 0 : (effectiveHourlyRate || null),
        calloutFee: addEntryFee > 0 ? addEntryFee : 0,
        calloutRateId: rateId !== "auto" ? rateId : null,
      });
      resetAddForm();
      setShowAdd(false);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (entry: TimeLine) => {
    setEditingKey(entry.key);
    setEditArrival(entry.arrival ? toLocalDatetimeStr(new Date(entry.arrival)) : "");
    setEditDeparture(entry.departure ? toLocalDatetimeStr(new Date(entry.departure)) : "");
    setEditNotes(entry.notes || "");
    setEditWaiveCallout(Number(entry.calloutFee) === 0);
    const matched = entry.calloutRateId
      ? calloutRates.find(r => r.id === entry.calloutRateId)
      : calloutRates.find(r => Number(r.amount) === Number(entry.calloutFee));
    setEditRateId(matched?.id || "auto");
  };

  const handleUpdate = async () => {
    if (!editingKey || !editArrival) return;
    const arrivalDate = new Date(editArrival);
    let departureDate = editDeparture ? new Date(editDeparture) : null;
    if (departureDate && departureDate <= arrivalDate) {
      departureDate = new Date(departureDate.getTime() + 24 * 60 * 60 * 1000);
    }
    await onUpdate(editingKey, {
      arrival: arrivalDate.toISOString(),
      departure: departureDate ? departureDate.toISOString() : null,
      notes: editNotes.trim() || null,
      hourlyRate: editHourlyRate || null,
      calloutFee: editCalloutFee,
      calloutRateId: editRateId !== "auto" ? editRateId : null,
    });
    setEditingKey(null);
  };

  return (
    <Card className="p-4 sm:p-6 border border-border/50 shadow-sm max-w-full min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg flex items-center gap-2 text-amber-600">
          <Clock className="w-5 h-5" /> Time Attended
        </h3>
        {!readOnly && (
          <Button size="sm" variant="outline" onClick={() => {
            if (!showAdd) {
              setEstimateRate(defaultHourlyRate > 0 ? String(defaultHourlyRate) : "");
              if (rateId === "auto") {
                const def = calloutRates.find(r => r.is_default);
                if (def) setRateId(def.id);
              }
            } else {
              resetAddForm();
            }
            setShowAdd(!showAdd);
          }}>
            {showAdd ? <><X className="w-4 h-4 mr-1" /> Cancel</> : <><Plus className="w-4 h-4 mr-1" /> Add Entry</>}
          </Button>
        )}
      </div>

      {showAdd && !readOnly && (
        <div className="border rounded-lg p-4 mb-4 bg-slate-50/50 space-y-3">
          {allowEstimate && (
            <div className="flex rounded-md overflow-hidden border border-border text-xs w-fit">
              <button
                type="button"
                className={`px-3 py-1.5 font-medium transition-colors ${mode === "actual" ? "bg-amber-500 text-white" : "bg-white text-muted-foreground hover:bg-slate-50"}`}
                onClick={() => setMode("actual")}
              >
                Actual Time
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 font-medium border-l border-border transition-colors ${mode === "estimate" ? "bg-amber-500 text-white" : "bg-white text-muted-foreground hover:bg-slate-50"}`}
                onClick={() => setMode("estimate")}
              >
                Estimated Time
              </button>
            </div>
          )}

          {mode === "estimate" ? (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Hours *</Label>
                  <Input type="text" inputMode="decimal" value={estimateHours} onChange={(e) => setEstimateHours(e.target.value)} placeholder="e.g. 3" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hourly Rate</Label>
                  <Input type="text" inputMode="decimal" value={estimateRate} onChange={(e) => setEstimateRate(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes (optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Two engineers, half day" />
              </div>
              {Number(estimateHours) > 0 && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Estimated: {formatTotalTime(Number(estimateHours) * 60)}</span>
                  <span className="font-medium text-emerald-600">
                    Cost: {formatMoney(Number(estimateHours) * (Number(estimateRate) || 0))}
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Arrival *</Label>
                  <div className="flex gap-1.5">
                    <Input type="datetime-local" value={arrival} onChange={(e) => setArrival(e.target.value)} className="flex-1" />
                    <Button type="button" size="sm" variant="outline" className="px-2.5 text-xs font-medium shrink-0" onClick={() => setArrival(toLocalDatetimeStr(new Date()))}>Now</Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Departure</Label>
                  <div className="flex gap-1.5">
                    <Input type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)} className="flex-1" />
                    <Button type="button" size="sm" variant="outline" className="px-2.5 text-xs font-medium shrink-0" onClick={() => setDeparture(toLocalDatetimeStr(new Date()))}>Now</Button>
                  </div>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Notes (optional)</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Replaced valve, awaiting part" />
                </div>
                {calloutRates.length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">Callout Rate</Label>
                    <select
                      className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
                      value={rateId}
                      onChange={(e) => {
                        setRateId(e.target.value);
                        onCalloutRateChange?.(e.target.value === "auto" ? null : e.target.value);
                      }}
                      disabled={recordTimeOnly}
                    >
                      <option value="auto">Auto (based on time of day)</option>
                      {calloutRates.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name} - {formatMoney(Number(r.amount))}{r.hourly_rate != null ? ` (${formatMoney(Number(r.hourly_rate))}/hr)` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="recordTimeOnly"
                  checked={recordTimeOnly}
                  onChange={(e) => setRecordTimeOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <label htmlFor="recordTimeOnly" className="text-sm select-none cursor-pointer">
                  Record time only - do not add labour or callout cost
                </label>
              </div>
              {calloutFee > 0 && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="waiveCallout"
                    checked={waiveCallout}
                    onChange={(e) => setWaiveCallout(e.target.checked)}
                    disabled={recordTimeOnly}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <label htmlFor="waiveCallout" className="text-sm select-none cursor-pointer">
                    Waive callout fee — charge hourly rate only
                  </label>
                </div>
              )}
              {arrival && departure && (() => {
                const rate = recordTimeOnly ? 0 : effectiveHourlyRate;
                const bd = computeLabourBreakdown({ arrival, departure, hourlyRate: rate, calloutFee: addEntryFee });
                return (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Duration: {calcDuration(arrival, departure)}</span>
                    {rate > 0 && <span>{formatMoney(rate)}/hr</span>}
                    {bd.entryCost > 0 && <span className="font-medium text-emerald-600">Cost: {formatMoney(bd.entryCost)}</span>}
                  </div>
                );
              })()}
            </>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={submitting || (mode === "actual" ? !arrival : !estimateHours)}>
              <Check className="w-4 h-4 mr-1" /> {submitting ? "Saving..." : "Save Entry"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { resetAddForm(); setShowAdd(false); }}>Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading time entries...</p>
      ) : sortedEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No time recorded yet.</p>
      ) : (
        <>
          <div className="space-y-2">
            {sortedEntries.map((entry) => (
              editingKey === entry.key ? (
                <div key={entry.key} className="border rounded-lg p-3 bg-blue-50/50 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Arrival *</Label>
                      <div className="flex gap-1.5">
                        <Input type="datetime-local" value={editArrival} onChange={(e) => setEditArrival(e.target.value)} className="flex-1" />
                        <Button type="button" size="sm" variant="outline" className="px-2.5 text-xs font-medium shrink-0" onClick={() => setEditArrival(toLocalDatetimeStr(new Date()))}>Now</Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Departure</Label>
                      <div className="flex gap-1.5">
                        <Input type="datetime-local" value={editDeparture} onChange={(e) => setEditDeparture(e.target.value)} className="flex-1" />
                        <Button type="button" size="sm" variant="outline" className="px-2.5 text-xs font-medium shrink-0" onClick={() => setEditDeparture(toLocalDatetimeStr(new Date()))}>Now</Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Notes</Label>
                      <Input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="e.g. Replaced valve, awaiting part" />
                    </div>
                    {calloutRates.length > 0 && (
                      <div className="space-y-1">
                        <Label className="text-xs">Callout Rate</Label>
                        <select
                          className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background"
                          value={editRateId}
                          onChange={(e) => setEditRateId(e.target.value)}
                          disabled={editWaiveCallout}
                        >
                          <option value="auto">Auto (based on time of day)</option>
                          {calloutRates.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.name} - {formatMoney(Number(r.amount))}{r.hourly_rate != null ? ` (${formatMoney(Number(r.hourly_rate))}/hr)` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`editWaiveCallout-${entry.key}`}
                      checked={editWaiveCallout}
                      onChange={(e) => setEditWaiveCallout(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <label htmlFor={`editWaiveCallout-${entry.key}`} className="text-sm select-none cursor-pointer">
                      Waive callout fee — charge hourly rate only
                    </label>
                  </div>
                  {editArrival && editDeparture && (() => {
                    const bd = computeLabourBreakdown({ arrival: editArrival, departure: editDeparture, hourlyRate: editHourlyRate, calloutFee: editCalloutFee });
                    return (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Duration: {calcDuration(editArrival, editDeparture)}</span>
                        {bd.entryCost > 0 && <span className="font-medium text-emerald-600">Cost: {formatMoney(bd.entryCost)}</span>}
                      </div>
                    );
                  })()}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleUpdate} disabled={!editArrival}>
                      <Check className="w-4 h-4 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingKey(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div key={entry.key} className="border rounded-lg bg-white overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {entry.arrival ? (
                          <>
                            <span className="font-medium text-sm">{formatEntryDate(entry.arrival)}</span>
                            <span className="text-sm text-muted-foreground">
                              {formatEntryTime(entry.arrival)}
                              {entry.departure ? ` - ${formatEntryTime(entry.departure)}` : " - ongoing"}
                            </span>
                            {entry.departure && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                                {calcDuration(entry.arrival, entry.departure)}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="font-medium text-sm">{entry.label || "Estimated labour"}</span>
                            <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                              {formatTotalTime((entry.estimatedHours || 0) * 60)}
                            </span>
                          </>
                        )}
                      </div>
                      {entry.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.notes}</p>}
                      {entry.createdByName && <p className="text-xs text-muted-foreground">{entry.createdByName}</p>}
                    </div>
                    {!readOnly && entry.canModify !== false && (
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        {entry.arrival && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => startEdit(entry)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => onDelete(entry.key)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {(() => {
                    const bd = breakdownFor(entry);
                    if (bd.hourlyRate <= 0 && bd.calloutCost <= 0) return null;
                    const rateName = entry.calloutRateId
                      ? calloutRates.find(r => r.id === entry.calloutRateId)?.name
                      : calloutRates.find(r => Number(r.amount) === Number(entry.calloutFee))?.name;
                    const calloutWaived = entry.calloutFee != null && Number(entry.calloutFee) === 0 && entry.arrival != null;
                    return (
                      <div className="border-t border-border/30 bg-slate-50/80 px-3 py-1.5 space-y-0.5">
                        {calloutWaived ? (
                          <div className="text-xs font-medium text-slate-400 italic">Callout fee waived</div>
                        ) : rateName ? (
                          <div className="text-xs font-medium text-slate-500">{rateName}</div>
                        ) : null}
                        {bd.calloutRate > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Call-out (min. 1hr)</span>
                            <span className="font-medium text-emerald-600">{formatMoney(bd.calloutCost)}</span>
                          </div>
                        )}
                        {bd.billableHours > 0 && bd.hourlyRate > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">{formatTotalTime(bd.billableHours * 60)} @ {formatMoney(bd.hourlyRate)}/hr</span>
                            <span className="font-medium text-emerald-600">{formatMoney(bd.billableCost)}</span>
                          </div>
                        )}
                        {bd.entryCost > 0 && (
                          <div className="flex justify-between items-center text-xs pt-0.5 border-t border-border/20">
                            <span className="text-muted-foreground font-medium">Entry total</span>
                            <span className="font-semibold text-emerald-700">{formatMoney(bd.entryCost)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )
            ))}
          </div>
          <div className="mt-3 pt-3 border-t space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Total Time</span>
              <span className="font-bold text-amber-600">{formatTotalTime(totalMinutes)}</span>
            </div>
            {totalLabourCost > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Labour Total</span>
                <span className="font-bold text-emerald-600">{formatMoney(totalLabourCost)}</span>
              </div>
            )}
          </div>
        </>
      )}

      {footer}
    </Card>
  );
}
