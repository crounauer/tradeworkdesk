import jsPDFModule from "jspdf";
const jsPDF = (jsPDFModule as any).default || jsPDFModule;

export interface PdfCompanySettings {
  name?: string | null;
  trading_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  gas_safe_number?: string | null;
  oftec_number?: string | null;
  vat_number?: string | null;
}

function renderPdfHeader(
  doc: jsPDF,
  company: PdfCompanySettings | undefined,
  title: string,
  subtitle?: string,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 14;

  const companyName = company?.name || company?.trading_name || "";

  if (companyName) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);

    const addrParts: string[] = [];
    if (company?.address_line1) addrParts.push(company.address_line1);
    if (company?.address_line2) addrParts.push(company.address_line2);
    if (company?.city) addrParts.push(company.city);
    if (company?.postcode) addrParts.push(company.postcode);
    const addrLine = addrParts.join(", ");

    const contactParts: string[] = [];
    if (company?.phone) contactParts.push(company.phone);
    if (company?.email) contactParts.push(company.email);
    if (company?.website) contactParts.push(company.website);
    const contactLine = contactParts.join("  |  ");

    const regParts: string[] = [];
    if (company?.gas_safe_number) regParts.push(`Gas Safe: ${company.gas_safe_number}`);
    if (company?.oftec_number) regParts.push(`OFTEC: ${company.oftec_number}`);
    if (company?.vat_number) regParts.push(`VAT: ${company.vat_number}`);
    const regLine = regParts.join("  |  ");

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(companyName, margin, y);
    y += 6;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    if (addrLine) { doc.text(addrLine, margin, y); y += 4.5; }
    if (contactLine) { doc.text(contactLine, margin, y); y += 4.5; }
    if (regLine) { doc.text(regLine, margin, y); y += 4.5; }

    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(title, pageWidth / 2, y, { align: "center" });
  y += 6;

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, pageWidth / 2, y, { align: "center" });
    y += 5;
  }

  doc.setTextColor(0, 0, 0);
  return y;
}

function pdfFooterText(company: PdfCompanySettings | undefined, docType: string): string {
  const name = company?.name || company?.trading_name;
  return name ? `${docType} - ${name}` : `${docType}`;
}

function createPdfHelpers(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const checkPageBreak = (currentY: number, needed: number): number => {
    if (currentY + needed > pageHeight - 20) {
      doc.addPage();
      return 20;
    }
    return currentY;
  };

  const addSection = (y: number, title: string, rows: [string, string][], titleColor: [number, number, number] = [59, 130, 246]) => {
    y = checkPageBreak(y, 10 + rows.length * 6);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...titleColor);
    doc.text(title, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 2;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    for (const [label, value] of rows) {
      y = checkPageBreak(y, 6);
      doc.setFont("helvetica", "bold");
      doc.text(`${label}:`, margin + 2, y);
      doc.setFont("helvetica", "normal");
      const text = value || "N/A";
      const maxWidth = pageWidth - 95;
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, 80, y);
      y += Math.max(lines.length, 1) * 5;
    }
    y += 4;
    return y;
  };

  const addCheckGrid = (y: number, title: string, checks: [string, string][], titleColor: [number, number, number] = [59, 130, 246]) => {
    y = checkPageBreak(y, 10 + Math.ceil(checks.length / 3) * 7);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...titleColor);
    doc.text(title, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 2;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFontSize(9);
    const colWidth = (pageWidth - 2 * margin) / 3;
    for (let i = 0; i < checks.length; i += 3) {
      y = checkPageBreak(y, 7);
      for (let j = 0; j < 3 && i + j < checks.length; j++) {
        const [label, value] = checks[i + j];
        const x = margin + j * colWidth;
        const isYes = value === "Yes";
        doc.setFont("helvetica", "normal");
        doc.setTextColor(isYes ? 22 : 150, isYes ? 163 : 150, isYes ? 74 : 150);
        doc.text(isYes ? "✓" : "✗", x + 2, y);
        doc.setTextColor(0, 0, 0);
        doc.text(label, x + 8, y);
      }
      y += 6;
    }
    y += 3;
    return y;
  };

  const bool = (v?: boolean | string | null) => {
    if (typeof v === "string") return v === "true" || v === "Yes" ? "Yes" : "No";
    return v ? "Yes" : "No";
  };

  return { pageWidth, pageHeight, margin, checkPageBreak, addSection, addCheckGrid, bool };
}

interface FormContext {
  jobRef: string;
  customerName: string;
  propertyAddress: string;
  technicianName: string;
  scheduledDate: string;
}

function str(v: unknown): string {
  if (v == null || v === "null" || v === "") return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (v instanceof Date) {
    return v.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T00:00:00");
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    }
  }
  return s;
}

function addPdfFooter(doc: jsPDF, company: PdfCompanySettings | undefined, docType: string): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.text(pdfFooterText(company, docType), pageWidth / 2, pageHeight - 10, { align: "center" });
  }
}

interface SectionDef {
  title: string;
  fields: string[];
  checkboxGrid?: boolean;
  color?: [number, number, number];
  fuel?: "gas" | "oil";
}

const SERVICE_RECORD_SECTIONS: SectionDef[] = [
  {
    title: "CP12 / Gas Safe Details",
    fields: ["gas_safe_engineer_id", "cp12_certificate_number", "landlord_certificate"],
    color: [37, 99, 235],
    fuel: "gas",
  },
  {
    title: "Arrival & Departure",
    fields: ["arrival_time", "departure_time"],
  },
  {
    title: "Visual Inspection",
    fields: ["appliance_condition", "flue_inspection", "visual_inspection"],
  },
  {
    title: "Gas Tightness Test",
    fields: ["gas_standing_pressure", "gas_working_pressure", "gas_meter_type", "gas_tightness_pass"],
    color: [37, 99, 235],
    fuel: "gas",
  },
  {
    title: "Gas Pressure Readings",
    fields: ["gas_operating_pressure", "gas_burner_pressure", "gas_heat_input"],
    color: [37, 99, 235],
    fuel: "gas",
  },
  {
    title: "Combustion Readings",
    fields: ["combustion_co2", "combustion_co", "combustion_o2", "combustion_temp", "combustion_efficiency",
             "co_co2_ratio", "flue_spillage_test", "ventilation_adequate",
             "smoke_test", "smoke_number"],
  },
  {
    title: "Checks & Cleaning",
    fields: ["burner_cleaned", "heat_exchanger_cleaned", "seals_gaskets_checked", "seals_gaskets_replaced",
             "controls_checked", "thermostat_checked", "safety_devices_checked"],
    checkboxGrid: true,
  },
  {
    title: "Oil Checks",
    fields: ["nozzle_checked", "nozzle_replaced", "electrodes_checked", "electrodes_replaced",
             "filter_checked", "filter_cleaned", "filter_replaced", "oil_line_checked", "fire_valve_checked"],
    checkboxGrid: true,
    fuel: "oil",
  },
  {
    title: "Gas Checks",
    fields: ["gas_valve_checked", "injectors_checked", "pilot_checked", "ignition_checked", "gas_pressure_checked"],
    checkboxGrid: true,
    fuel: "gas",
  },
  {
    title: "Checks & Cleaning (Details)",
    fields: ["nozzle_size_fitted", "safety_devices_notes"],
  },
  {
    title: "Appliance Classification",
    fields: ["appliance_classification", "warning_notice_issued", "warning_notice_type", "warning_notice_details", "customer_warned"],
    color: [234, 88, 12],
    fuel: "gas",
  },
  {
    title: "Safety & Defects",
    fields: ["appliance_safe", "leaks_found", "leaks_details", "defects_found", "defects_details", "advisories"],
  },
  {
    title: "Work Summary & Follow-up",
    fields: ["work_completed", "parts_required", "additional_notes",
             "follow_up_required", "follow_up_notes", "next_service_due"],
  },
];

function isCheckboxField(col: string): boolean {
  const boolFields = new Set([
    "burner_cleaned", "heat_exchanger_cleaned", "seals_gaskets_checked", "seals_gaskets_replaced",
    "controls_checked", "thermostat_checked", "safety_devices_checked",
    "nozzle_checked", "nozzle_replaced", "electrodes_checked", "electrodes_replaced",
    "filter_checked", "filter_cleaned", "filter_replaced", "oil_line_checked", "fire_valve_checked",
    "gas_valve_checked", "injectors_checked", "pilot_checked", "ignition_checked", "gas_pressure_checked",
    "gas_tightness_pass", "ventilation_adequate", "landlord_certificate",
    "appliance_safe", "leaks_found", "defects_found", "follow_up_required",
    "warning_notice_issued", "customer_warned",
    "ignition_tested", "controls_tested", "thermostats_tested", "pressure_relief_tested",
    "expansion_vessel_checked", "system_flushed", "inhibitor_added", "customer_instructions_given",
    "customer_advised", "customer_sign_off", "return_visit_required", "reset_successful",
    "temporary_fix", "permanent_fix",
  ]);
  return boolFields.has(col);
}

export function generateFormPdf(
  formType: string,
  formLabel: string,
  record: Record<string, unknown>,
  fieldMap: Record<string, string>,
  ctx: FormContext,
  company?: PdfCompanySettings,
  fuelType?: string,
): Buffer {
  const doc = new jsPDF();
  const helpers = createPdfHelpers(doc);
  const { margin, addSection, addCheckGrid, bool } = helpers;
  const pageWidth = doc.internal.pageSize.getWidth();

  let y = renderPdfHeader(doc, company, formLabel);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(`Job Ref: ${ctx.jobRef}`, margin, y);
  doc.text(`Date: ${ctx.scheduledDate}`, pageWidth - margin, y, { align: "right" });
  y += 4;

  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  y = addSection(y, "Job Details", [
    ["Customer", ctx.customerName],
    ["Property", ctx.propertyAddress],
    ["Technician", ctx.technicianName],
    ["Date", ctx.scheduledDate],
  ]);

  const sections = formType === "service_record" ? SERVICE_RECORD_SECTIONS : null;
  const isGas = fuelType === "gas" || fuelType === "lpg";

  if (sections) {
    const usedCols = new Set<string>();
    for (const section of sections) {
      if (section.fuel === "gas" && !isGas) continue;
      if (section.fuel === "oil" && isGas) continue;
      const rows: [string, string][] = [];
      const checks: [string, string][] = [];

      for (const col of section.fields) {
        const label = fieldMap[col];
        if (!label) continue;
        const val = record[col];
        if (val == null && !isCheckboxField(col)) continue;

        usedCols.add(col);

        if (section.checkboxGrid && isCheckboxField(col)) {
          checks.push([label, bool(val as boolean)]);
        } else if (isCheckboxField(col)) {
          rows.push([label, bool(val as boolean)]);
        } else {
          const s = str(val);
          if (s) rows.push([label, s]);
        }
      }

      if (rows.length === 0 && checks.length === 0) continue;

      const color = section.color || [59, 130, 246] as [number, number, number];
      if (checks.length > 0) {
        y = addCheckGrid(y, section.title, checks, color);
      }
      if (rows.length > 0) {
        const title = checks.length > 0 ? "" : section.title;
        if (title) {
          y = addSection(y, title, rows, color);
        } else {
          for (const [label, value] of rows) {
            y = helpers.checkPageBreak(y, 6);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text(`${label}:`, margin + 2, y);
            doc.setFont("helvetica", "normal");
            const text = value || "N/A";
            const maxWidth = pageWidth - 95;
            const lines = doc.splitTextToSize(text, maxWidth);
            doc.text(lines, 80, y);
            y += Math.max(lines.length, 1) * 5;
          }
          y += 4;
        }
      }
    }

    const remainingRows: [string, string][] = [];
    for (const [col, label] of Object.entries(fieldMap)) {
      if (usedCols.has(col)) continue;
      const val = record[col];
      if (val == null && !isCheckboxField(col)) continue;
      if (isCheckboxField(col)) {
        remainingRows.push([label, bool(val as boolean)]);
      } else {
        const s = str(val);
        if (s) remainingRows.push([label, s]);
      }
    }
    if (remainingRows.length > 0) {
      y = addSection(y, "Other Details", remainingRows);
    }
  } else {
    const checkRows: [string, string][] = [];
    const textRows: [string, string][] = [];

    for (const [col, label] of Object.entries(fieldMap)) {
      const val = record[col];
      if (isCheckboxField(col)) {
        checkRows.push([label, bool(val as boolean)]);
      } else {
        if (val == null || val === "" || val === "null") continue;
        textRows.push([label, str(val)]);
      }
    }

    if (textRows.length > 0) {
      const chunkSize = 12;
      for (let i = 0; i < textRows.length; i += chunkSize) {
        const chunk = textRows.slice(i, i + chunkSize);
        const sectionTitle = i === 0 ? `${formLabel} Details` : `${formLabel} Details (cont.)`;
        y = addSection(y, sectionTitle, chunk);
      }
    }

    if (checkRows.length > 0) {
      y = addCheckGrid(y, "Checks", checkRows);
    }
  }

  addPdfFooter(doc, company, formLabel);

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
