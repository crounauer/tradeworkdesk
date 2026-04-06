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
      phone: "0161 234 5678",
      email: "office@abcheating.co.uk",
      gasRegistration: "123456",
      oftecRegistration: "C/12345",
      companyLogoUrl: undefined,
    }
  );

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;
