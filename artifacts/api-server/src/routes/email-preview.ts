import { Router, type Request, type Response } from "express";
import { renderJobConfirmationHtml } from "../lib/email";

const router = Router();

router.get("/email-preview/job-confirmation", (_req: Request, res: Response) => {
  const html = renderJobConfirmationHtml(
    "John Smith",
    "ABC Heating & Plumbing Ltd",
    {
      jobRef: "JOB-2026-0042",
      jobType: "Boiler Service",
      scheduledDate: "2026-04-10T09:00:00Z",
      scheduledTime: "09:00",
      propertyAddress: "14 Oakwood Drive, Manchester, M20 4BH",
      technicianName: "Mike Johnson",
      description: "Annual boiler service and safety check",
    },
    {
      name: "ABC Heating & Plumbing Ltd",
      logo_url: "https://placehold.co/180x60/ffffff/1d4ed8?text=ABC+Heating",
      address_line1: "Unit 5, Riverside Industrial Estate",
      address_line2: "42 Thameside Road",
      city: "Manchester",
      county: "Greater Manchester",
      postcode: "M15 4QR",
      phone: "0161 234 5678",
      email: "office@abcheating.co.uk",
      website: "www.abcheating.co.uk",
      gas_safe_number: "123456",
      oftec_number: "C/12345",
      rates_url: "https://www.abcheating.co.uk/rates",
      trading_terms_url: "https://www.abcheating.co.uk/terms",
    }
  );

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;
