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

interface Cp12PdfData {
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
    co_co2_ratio?: string;
    flue_spillage_test?: string;
    ventilation_adequate?: boolean;
    gas_tightness_pass?: boolean;
    gas_standing_pressure?: string;
    gas_working_pressure?: string;
    gas_operating_pressure?: string;
    gas_burner_pressure?: string;
    gas_heat_input?: string;
    gas_meter_type?: string;
    gas_safe_engineer_id?: string;
    cp12_certificate_number?: string;
    landlord_certificate?: boolean;
    appliance_classification?: string;
    warning_notice_issued?: boolean;
    warning_notice_type?: string;
    warning_notice_details?: string;
    customer_warned?: boolean;
    gas_valve_checked?: boolean;
    injectors_checked?: boolean;
    pilot_checked?: boolean;
    ignition_checked?: boolean;
    gas_pressure_checked?: boolean;
    burner_cleaned?: boolean;
    heat_exchanger_cleaned?: boolean;
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

  const bool = (v?: boolean) => v ? "Yes" : "No";

  return { pageWidth, pageHeight, margin, checkPageBreak, addSection, bool };
}

export function generateServiceRecordPdf(data: ServiceRecordPdfData): void {
  const doc = new jsPDF();
  const { pageWidth, pageHeight, margin, checkPageBreak, addSection, bool } = createPdfHelpers(doc);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("BoilerTech Oil Service Record", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Job Ref: ${data.jobId.slice(0, 8).toUpperCase()}`, margin, 30);
  doc.text(`Date: ${data.scheduledDate}`, pageWidth - margin, 30, { align: "right" });

  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(0.5);
  doc.line(margin, 34, pageWidth - margin, 34);

  let y = 42;
  const sr = data.serviceRecord;

  y = addSection(y, "Job Details", [
    ["Customer", data.customerName],
    ["Property", data.propertyAddress],
    ["Appliance", data.applianceName],
    ["Technician", data.technicianName],
    ["Date", data.scheduledDate],
  ]);

  y = addSection(y, "Arrival & Departure", [
    ["Arrival Time", sr.arrival_time || ""],
    ["Departure Time", sr.departure_time || ""],
  ]);

  y = addSection(y, "Visual Inspection", [
    ["Appliance Condition", sr.appliance_condition || ""],
    ["Flue Inspection", sr.flue_inspection || ""],
    ["General Inspection", sr.visual_inspection || ""],
  ]);

  y = addSection(y, "Combustion Readings", [
    ["CO2 (%)", sr.combustion_co2 || ""],
    ["CO (ppm)", sr.combustion_co || ""],
    ["O2 (%)", sr.combustion_o2 || ""],
    ["Flue Temp", sr.combustion_temp || ""],
    ["Efficiency (%)", sr.combustion_efficiency || ""],
    ["Smoke Test", sr.smoke_test || ""],
    ["Smoke Number", sr.smoke_number || ""],
  ]);

  y = addSection(y, "Checks & Cleaning", [
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

  y = addSection(y, "Safety & Defects", [
    ["Appliance Safe", bool(sr.appliance_safe)],
    ["Leaks Found", bool(sr.leaks_found)],
    ["Leak Details", sr.leaks_details || ""],
    ["Defects Found", bool(sr.defects_found)],
    ["Defect Details", sr.defects_details || ""],
    ["Advisories", sr.advisories || ""],
  ]);

  y = addSection(y, "Work Summary", [
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

  doc.save(`oil-service-record-${data.jobId.slice(0, 8)}.pdf`);
}

export function generateCp12Pdf(data: Cp12PdfData): void {
  const doc = new jsPDF();
  const { pageWidth, pageHeight, margin, checkPageBreak, addSection, bool } = createPdfHelpers(doc);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 82, 204);
  doc.text("Gas Safety Record (CP12)", pageWidth / 2, 18, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("BoilerTech - Gas Safe Registered", pageWidth / 2, 25, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(`Job Ref: ${data.jobId.slice(0, 8).toUpperCase()}`, margin, 33);
  doc.text(`Date: ${data.scheduledDate}`, pageWidth - margin, 33, { align: "right" });

  const sr = data.serviceRecord;

  if (sr.landlord_certificate) {
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(pageWidth - 80, 12, 66, 8, 2, 2, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("LANDLORD CERTIFICATE", pageWidth - 77, 17.5);
    doc.setTextColor(0, 0, 0);
  }

  doc.setDrawColor(0, 82, 204);
  doc.setLineWidth(0.8);
  doc.line(margin, 37, pageWidth - margin, 37);

  let y = 44;

  y = addSection(y, "Engineer & Certificate Details", [
    ["Gas Safe Engineer ID", sr.gas_safe_engineer_id || ""],
    ["CP12 Certificate No.", sr.cp12_certificate_number || ""],
    ["Landlord Certificate", bool(sr.landlord_certificate)],
    ["Engineer Name", data.technicianName],
    ["Date of Inspection", data.scheduledDate],
  ], [0, 82, 204]);

  y = addSection(y, "Job & Property Details", [
    ["Customer", data.customerName],
    ["Property", data.propertyAddress],
    ["Appliance", data.applianceName],
    ["Arrival", sr.arrival_time || ""],
    ["Departure", sr.departure_time || ""],
  ], [0, 82, 204]);

  y = addSection(y, "Visual Inspection", [
    ["Appliance Condition", sr.appliance_condition || ""],
    ["Flue Inspection", sr.flue_inspection || ""],
    ["Ventilation Adequate", bool(sr.ventilation_adequate)],
    ["General Inspection", sr.visual_inspection || ""],
  ], [0, 82, 204]);

  y = addSection(y, "Gas Tightness Test", [
    ["Standing Pressure (mbar)", sr.gas_standing_pressure || ""],
    ["Working Pressure (mbar)", sr.gas_working_pressure || ""],
    ["Gas Meter Type", sr.gas_meter_type || ""],
    ["Tightness Test Result", bool(sr.gas_tightness_pass)],
  ], [0, 82, 204]);

  y = addSection(y, "Gas Pressure Readings", [
    ["Operating Pressure (mbar)", sr.gas_operating_pressure || ""],
    ["Burner Pressure (mbar)", sr.gas_burner_pressure || ""],
    ["Heat Input (kW)", sr.gas_heat_input || ""],
  ], [0, 82, 204]);

  y = addSection(y, "Combustion Analysis", [
    ["CO2 (%)", sr.combustion_co2 || ""],
    ["CO (ppm)", sr.combustion_co || ""],
    ["O2 (%)", sr.combustion_o2 || ""],
    ["Flue Temp", sr.combustion_temp || ""],
    ["Efficiency (%)", sr.combustion_efficiency || ""],
    ["CO/CO2 Ratio", sr.co_co2_ratio || ""],
    ["Flue Spillage Test", sr.flue_spillage_test || ""],
  ], [0, 82, 204]);

  y = addSection(y, "Gas-Specific Checks", [
    ["Gas Valve Checked", bool(sr.gas_valve_checked)],
    ["Injectors Checked", bool(sr.injectors_checked)],
    ["Pilot Checked", bool(sr.pilot_checked)],
    ["Ignition Checked", bool(sr.ignition_checked)],
    ["Gas Pressure Checked", bool(sr.gas_pressure_checked)],
    ["Burner Cleaned", bool(sr.burner_cleaned)],
    ["Heat Exchanger Cleaned", bool(sr.heat_exchanger_cleaned)],
    ["Seals/Gaskets Checked", bool(sr.seals_gaskets_checked)],
    ["Seals/Gaskets Replaced", bool(sr.seals_gaskets_replaced)],
    ["Controls Checked", bool(sr.controls_checked)],
    ["Thermostat Checked", bool(sr.thermostat_checked)],
    ["Safety Devices Checked", bool(sr.safety_devices_checked)],
    ["Safety Devices Notes", sr.safety_devices_notes || ""],
  ], [0, 82, 204]);

  const classificationLabel = (c?: string) => {
    switch (c) {
      case "safe": return "SAFE";
      case "not_to_current_standard": return "NOT TO CURRENT STANDARD (NCS)";
      case "at_risk": return "AT RISK (AR)";
      case "immediately_dangerous": return "IMMEDIATELY DANGEROUS (ID)";
      default: return c || "N/A";
    }
  };

  const isUnsafe = sr.appliance_classification === "at_risk" || sr.appliance_classification === "immediately_dangerous";

  if (isUnsafe) {
    y = checkPageBreak(y, 40);
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 6, 1, 1, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(185, 28, 28);
    doc.text(`APPLIANCE CLASSIFICATION: ${classificationLabel(sr.appliance_classification)}`, margin + 4, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    y = addSection(y, "WARNING NOTICE", [
      ["Warning Notice Issued", bool(sr.warning_notice_issued)],
      ["Warning Type", sr.warning_notice_type === "immediately_dangerous" ? "Immediately Dangerous (ID)" : sr.warning_notice_type === "at_risk" ? "At Risk (AR)" : sr.warning_notice_type || ""],
      ["Details", sr.warning_notice_details || ""],
      ["Customer Warned", bool(sr.customer_warned)],
    ], [185, 28, 28]);
  } else {
    y = addSection(y, "Appliance Classification", [
      ["Classification", classificationLabel(sr.appliance_classification)],
    ], [0, 82, 204]);
  }

  y = addSection(y, "Safety & Defects", [
    ["Appliance Safe", bool(sr.appliance_safe)],
    ["Leaks Found", bool(sr.leaks_found)],
    ["Leak Details", sr.leaks_details || ""],
    ["Defects Found", bool(sr.defects_found)],
    ["Defect Details", sr.defects_details || ""],
    ["Advisories", sr.advisories || ""],
  ], [0, 82, 204]);

  y = addSection(y, "Work Summary", [
    ["Work Completed", sr.work_completed || ""],
    ["Parts Required", sr.parts_required || ""],
    ["Additional Notes", sr.additional_notes || ""],
    ["Follow-up Required", bool(sr.follow_up_required)],
    ["Follow-up Notes", sr.follow_up_notes || ""],
    ["Next Service Due", sr.next_service_due || ""],
  ], [0, 82, 204]);

  y = checkPageBreak(y, 40);
  y += 10;

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, 80, y);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Customer Signature", margin, y + 5);
  doc.text("Date:", margin, y + 10);

  doc.line(pageWidth - 80, y, pageWidth - margin, y);
  doc.text("Engineer Signature", pageWidth - 80, y + 5);
  doc.text("Gas Safe ID:", pageWidth - 80, y + 10);

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Gas Safety Record (CP12) - Generated by BoilerTech", pageWidth / 2, pageHeight - 10, { align: "center" });

  doc.save(`cp12-gas-safety-${data.jobId.slice(0, 8)}.pdf`);
}
