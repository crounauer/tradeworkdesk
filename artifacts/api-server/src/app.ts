import express, { type Express, type Request, type Response, type NextFunction } from "express";
import compression from "compression";
import cors from "cors";
import rateLimit from "express-rate-limit";
import router from "./routes";

const app: Express = express();
app.set("trust proxy", 1);

app.use(compression());
app.use(cors({
  origin: [
    process.env.APP_URL || "http://localhost:3000",
    "http://localhost:3000",
    "http://localhost:5173",
  ],
  credentials: true,
}));

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts. Please try again in 15 minutes." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in 15 minutes." },
});

// Public warmup endpoint — no auth, used by frontend to wake Railway on load
app.get("/api/ping", (_req: Request, res: Response) => { res.json({ ok: true }); });

app.use("/api/auth/register", registrationLimiter);
app.use("/api/auth/validate-invite", authLimiter);
app.use("/api/auth/use-invite", authLimiter);

app.use(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  (req: Request & { rawBody?: Buffer }, _res: Response, next: NextFunction) => {
    req.rawBody = req.body as Buffer;
    next();
  }
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (duration > 500) {
      console.log(`[SLOW] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
}, router);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err.message);
  if (err.name === "ZodError") {
    res.status(422).json({ error: "Response validation failed", details: err.message });
    return;
  }
  res.status(500).json({ error: "Internal server error" });
});

export default app;
