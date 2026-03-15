import jsPDF from "jspdf";

interface ServiceRecordPdfData {
  jobId: string;
  customerName: string;
  propertyAddress: string;
  applianceName: string;
  technicianName: string;
  scheduledDate: string;
  serviceRecord: {
    arrival_time?: string;
    departure_time?: string;
    visual_inspection?: string;
    appliance_condition?: string;
    flue_inspection?: string;
    combustion_co2?: string;
    combustion_co?: string;
    combustion_o2?: string;
    combustion_temp?: string;
    combustion_efficiency?: string;
    smoke_test?: string;
    smoke_number?: string;
    burner_cleaned?: boolean;
    heat_exchanger_cleaned?: boolean;
    nozzle_checked?: boolean;
    nozzle_replaced?: boolean;
    nozzle_size_fitted?: string;
    electrodes_checked?: boolean;
    electrodes_replaced?: boolean;
    filter_checked?: boolean;
    filter_cleaned?: boolean;
    filter_replaced?: boolean;
    oil_line_checked?: boolean;
    fire_valve_checked?: boolean;
    seals_gaskets_checked?: boolean;
    seals_gaskets_replaced?: boolean;
    controls_checked?: boolean;
    thermostat_checked?: boolean;
    safety_devices_checked?: boolean;
    safety_devices_notes?: string;
    leaks_found?: boolean;
    leaks_details?: string;
    defects_found?: boolean;
    defects_details?: string;
    advisories?: string;
    parts_required?: string;
    work_completed?: string;
    appliance_safe?: boolean;
    follow_up_required?: boolean;
    follow_up_notes?: string;
    next_service_due?: string;
    additional_notes?: string;
  };
}

export function generateServiceRecordPdf(data: ServiceRecordPdfData): void {
  const doc = new jsPDF();
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

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("BoilerTech Service Record", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Job Ref: ${data.jobId.slice(0, 8).toUpperCase()}`, margin, 30);
  doc.text(`Date: ${data.scheduledDate}`, pageWidth - margin, 30, { align: "right" });

  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(margin, 34, pageWidth - margin, 34);

  let y = 42;

  const addSection = (title: string, rows: [string, string][]) => {
    y = checkPageBreak(y, 10 + rows.length * 6);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(59, 130, 246);
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
  };

  const bool = (v?: boolean) => v ? "Yes" : "No";

  addSection("Job Details", [
    ["Customer", data.customerName],
    ["Property", data.propertyAddress],
    ["Appliance", data.applianceName],
    ["Technician", data.technicianName],
    ["Date", data.scheduledDate],
  ]);

  const sr = data.serviceRecord;

  addSection("Arrival & Departure", [
    ["Arrival Time", sr.arrival_time || ""],
    ["Departure Time", sr.departure_time || ""],
  ]);

  addSection("Visual Inspection", [
    ["Appliance Condition", sr.appliance_condition || ""],
    ["Flue Inspection", sr.flue_inspection || ""],
    ["General Inspection", sr.visual_inspection || ""],
  ]);

  addSection("Combustion Readings", [
    ["CO2 (%)", sr.combustion_co2 || ""],
    ["CO (ppm)", sr.combustion_co || ""],
    ["O2 (%)", sr.combustion_o2 || ""],
    ["Flue Temp", sr.combustion_temp || ""],
    ["Efficiency (%)", sr.combustion_efficiency || ""],
    ["Smoke Test", sr.smoke_test || ""],
    ["Smoke Number", sr.smoke_number || ""],
  ]);

  addSection("Checks & Cleaning", [
    ["Burner Cleaned", bool(sr.burner_cleaned)],
    ["Heat Exchanger Cleaned", bool(sr.heat_exchanger_cleaned)],
    ["Nozzle Checked", bool(sr.nozzle_checked)],
    ["Nozzle Replaced", bool(sr.nozzle_replaced)],
    ["Nozzle Size Fitted", sr.nozzle_size_fitted || ""],
    ["Electrodes Checked", bool(sr.electrodes_checked)],
    ["Electrodes Replaced", bool(sr.electrodes_replaced)],
    ["Filter Checked", bool(sr.filter_checked)],
    ["Filter Cleaned", bool(sr.filter_cleaned)],
    ["Filter Replaced", bool(sr.filter_replaced)],
    ["Oil Line Checked", bool(sr.oil_line_checked)],
    ["Fire Valve Checked", bool(sr.fire_valve_checked)],
    ["Seals/Gaskets Checked", bool(sr.seals_gaskets_checked)],
    ["Seals/Gaskets Replaced", bool(sr.seals_gaskets_replaced)],
    ["Controls Checked", bool(sr.controls_checked)],
    ["Thermostat Checked", bool(sr.thermostat_checked)],
    ["Safety Devices Checked", bool(sr.safety_devices_checked)],
    ["Safety Devices Notes", sr.safety_devices_notes || ""],
  ]);

  addSection("Safety & Defects", [
    ["Appliance Safe", bool(sr.appliance_safe)],
    ["Leaks Found", bool(sr.leaks_found)],
    ["Leak Details", sr.leaks_details || ""],
    ["Defects Found", bool(sr.defects_found)],
    ["Defect Details", sr.defects_details || ""],
    ["Advisories", sr.advisories || ""],
  ]);

  addSection("Work Summary", [
    ["Work Completed", sr.work_completed || ""],
    ["Parts Required", sr.parts_required || ""],
    ["Additional Notes", sr.additional_notes || ""],
    ["Follow-up Required", bool(sr.follow_up_required)],
    ["Follow-up Notes", sr.follow_up_notes || ""],
    ["Next Service Due", sr.next_service_due || ""],
  ]);

  y = checkPageBreak(y, 30);
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, 80, y);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Customer Signature", margin, y + 5);

  doc.line(pageWidth - 80, y, pageWidth - margin, y);
  doc.text("Technician Signature", pageWidth - 80, y + 5);

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Generated by BoilerTech", pageWidth / 2, pageHeight - 10, { align: "center" });

  doc.save(`service-record-${data.jobId.slice(0, 8)}.pdf`);
}
