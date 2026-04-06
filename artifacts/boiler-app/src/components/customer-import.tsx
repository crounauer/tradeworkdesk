import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";

const CUSTOMER_FIELDS = [
  { value: "title", label: "Title" },
  { value: "first_name", label: "First Name", required: true },
  { value: "last_name", label: "Last Name", required: true },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "mobile", label: "Mobile" },
  { value: "address_line1", label: "Address Line 1" },
  { value: "address_line2", label: "Address Line 2" },
  { value: "city", label: "City" },
  { value: "county", label: "County" },
  { value: "postcode", label: "Postcode" },
  { value: "notes", label: "Notes" },
] as const;

const SKIP_VALUE = "__skip__";

type Step = "upload" | "mapping" | "preview" | "importing" | "results";

const AUTO_MAP: Record<string, string> = {
  "first name": "first_name",
  "firstname": "first_name",
  "first_name": "first_name",
  "forename": "first_name",
  "last name": "last_name",
  "lastname": "last_name",
  "last_name": "last_name",
  "surname": "last_name",
  "family name": "last_name",
  "email": "email",
  "email address": "email",
  "e-mail": "email",
  "phone": "phone",
  "phone number": "phone",
  "telephone": "phone",
  "tel": "phone",
  "mobile": "mobile",
  "mobile phone": "mobile",
  "cell": "mobile",
  "cell phone": "mobile",
  "title": "title",
  "address": "address_line1",
  "address line 1": "address_line1",
  "address_line1": "address_line1",
  "address1": "address_line1",
  "street": "address_line1",
  "address line 2": "address_line2",
  "address_line2": "address_line2",
  "address2": "address_line2",
  "city": "city",
  "town": "city",
  "town/city": "city",
  "county": "county",
  "state": "county",
  "postcode": "postcode",
  "post code": "postcode",
  "zip": "postcode",
  "zip code": "postcode",
  "zipcode": "postcode",
  "notes": "notes",
  "note": "notes",
  "comments": "notes",
};

function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();

  for (const header of headers) {
    const normalised = header.toLowerCase().trim();
    const match = AUTO_MAP[normalised];
    if (match && !used.has(match)) {
      mapping[header] = match;
      used.add(match);
    }
  }

  return mapping;
}

export default function CustomerImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [duplicateIndices, setDuplicateIndices] = useState<Set<number>>(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; failed: { row: number; reason: string }[]; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const reset = useCallback(() => {
    setStep("upload");
    setCsvData([]);
    setHeaders([]);
    setMapping({});
    setDuplicateIndices(new Set());
    setSkipDuplicates(true);
    setImportResult(null);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          toast({ title: "Empty file", description: "The CSV file has no data rows.", variant: "destructive" });
          return;
        }

        const data = results.data as Record<string, string>[];
        const cols = results.meta.fields || [];

        setCsvData(data);
        setHeaders(cols);
        setMapping(autoDetectMapping(cols));
        setStep("mapping");
      },
      error: () => {
        toast({ title: "Parse error", description: "Could not parse the CSV file. Please check the format.", variant: "destructive" });
      },
    });

    e.target.value = "";
  };

  const mappedRows = useCallback(() => {
    return csvData.map((row) => {
      const mapped: Record<string, string | undefined> = {};
      for (const [csvCol, field] of Object.entries(mapping)) {
        if (field && field !== SKIP_VALUE) {
          mapped[field] = row[csvCol]?.trim() || undefined;
        }
      }
      return mapped;
    });
  }, [csvData, mapping]);

  const hasMapped = (field: string) => Object.values(mapping).includes(field);
  const requiredMapped = hasMapped("first_name") && hasMapped("last_name");

  const handleCheckDuplicates = async () => {
    setCheckingDuplicates(true);
    try {
      const rows = mappedRows();
      const resp = await fetch(`${import.meta.env.BASE_URL}api/customers/check-duplicates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customers: rows }),
      });
      const data = await resp.json();
      setDuplicateIndices(new Set(data.duplicates || []));
      setStep("preview");
    } catch {
      toast({ title: "Error", description: "Failed to check duplicates", variant: "destructive" });
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const handleImport = async () => {
    setStep("importing");
    try {
      const rows = mappedRows();
      const resp = await fetch(`${import.meta.env.BASE_URL}api/customers/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customers: rows, skipDuplicates }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast({ title: "Import failed", description: data.error || "Unknown error", variant: "destructive" });
        setStep("preview");
        return;
      }
      setImportResult(data);
      setStep("results");
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
    } catch {
      toast({ title: "Import failed", description: "Network error", variant: "destructive" });
      setStep("preview");
    }
  };

  const previewRows = mappedRows().slice(0, 5);
  const mappedFields = CUSTOMER_FIELDS.filter(f => hasMapped(f.value));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Import Customers
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
          {(["upload", "mapping", "preview", "results"] as const).map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              {i > 0 && <ArrowRight className="w-3 h-3" />}
              <span className={step === s || (step === "importing" && s === "preview") ? "text-primary font-semibold" : ""}>
                {s === "upload" ? "Upload" : s === "mapping" ? "Map Fields" : s === "preview" ? "Preview" : "Done"}
              </span>
            </span>
          ))}
        </div>

        {step === "upload" && (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-xl gap-4">
            <Upload className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground text-center">
              Upload a CSV file with customer details.<br />
              <span className="text-sm">The first row should contain column headers.</span>
            </p>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" /> Choose CSV File
            </Button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map your CSV columns to customer fields. We've auto-detected what we can.
              <span className="text-xs ml-1">({csvData.length} rows found)</span>
            </p>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {headers.map((header) => (
                <div key={header} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <div className="flex-1 font-mono text-sm truncate" title={header}>{header}</div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Select
                    value={mapping[header] || SKIP_VALUE}
                    onValueChange={(val) => setMapping((prev) => ({ ...prev, [header]: val }))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SKIP_VALUE}>
                        <span className="text-muted-foreground">— Skip —</span>
                      </SelectItem>
                      {CUSTOMER_FIELDS.map((f) => {
                        const usedBy = Object.entries(mapping).find(([, v]) => v === f.value)?.[0];
                        const disabled = !!usedBy && usedBy !== header;
                        return (
                          <SelectItem key={f.value} value={f.value} disabled={disabled}>
                            {f.label} {f.required && <span className="text-red-500">*</span>}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {!requiredMapped && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                First Name and Last Name must be mapped.
              </p>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => { reset(); }}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button disabled={!requiredMapped || checkingDuplicates} onClick={handleCheckDuplicates}>
                {checkingDuplicates ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Preview & Check Duplicates <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {(step === "preview" || step === "importing") && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Preview of first {Math.min(5, csvData.length)} of {csvData.length} rows
              </p>
              {duplicateIndices.size > 0 && (
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {duplicateIndices.size} duplicate{duplicateIndices.size !== 1 ? "s" : ""} found
                </Badge>
              )}
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="p-2 text-left font-medium w-8">#</th>
                    {mappedFields.map(f => (
                      <th key={f.value} className="p-2 text-left font-medium whitespace-nowrap">{f.label}</th>
                    ))}
                    <th className="p-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => {
                    const isDup = duplicateIndices.has(i);
                    const missingRequired = !row.first_name || !row.last_name;
                    return (
                      <tr key={i} className={`border-b ${isDup ? "bg-amber-50" : missingRequired ? "bg-red-50" : ""}`}>
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        {mappedFields.map(f => (
                          <td key={f.value} className="p-2 max-w-[150px] truncate">{row[f.value] || "—"}</td>
                        ))}
                        <td className="p-2">
                          {isDup ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">Duplicate</Badge>
                          ) : missingRequired ? (
                            <Badge variant="outline" className="text-red-600 border-red-300 text-xs">Invalid</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-300 text-xs">Ready</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {csvData.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                ...and {csvData.length - 5} more rows
              </p>
            )}

            {duplicateIndices.size > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-amber-800">{duplicateIndices.size} duplicate{duplicateIndices.size !== 1 ? "s" : ""} detected</p>
                  <p className="text-amber-700 text-xs mt-0.5">Matched by email or phone + last name against existing customers.</p>
                </div>
                <Button
                  size="sm"
                  variant={skipDuplicates ? "default" : "outline"}
                  onClick={() => setSkipDuplicates(!skipDuplicates)}
                >
                  {skipDuplicates ? "Skipping duplicates" : "Including duplicates"}
                </Button>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep("mapping")} disabled={step === "importing"}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={handleImport} disabled={step === "importing"}>
                {step === "importing" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {step === "importing" ? "Importing..." : `Import ${csvData.length} Customers`}
              </Button>
            </div>
          </div>
        )}

        {step === "results" && importResult && (
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <h3 className="text-xl font-bold">Import Complete</h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
                <div className="text-2xl font-bold text-green-700">{importResult.created}</div>
                <div className="text-sm text-green-600">Created</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-amber-50 border border-amber-200">
                <div className="text-2xl font-bold text-amber-700">{importResult.skipped}</div>
                <div className="text-sm text-amber-600">Skipped (duplicates)</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="text-2xl font-bold text-red-700">{importResult.failed.length}</div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
            </div>

            {importResult.failed.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1 text-red-600">
                  <XCircle className="w-4 h-4" /> Failed rows:
                </p>
                <div className="max-h-32 overflow-y-auto text-sm space-y-1">
                  {importResult.failed.slice(0, 20).map((f, i) => (
                    <div key={i} className="text-muted-foreground">
                      Row {f.row}: {f.reason}
                    </div>
                  ))}
                  {importResult.failed.length > 20 && (
                    <div className="text-muted-foreground">...and {importResult.failed.length - 20} more</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <Button onClick={() => { reset(); onOpenChange(false); }}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
