import express, { type Express, type Request, type Response, type NextFunction } from "express";
import compression from "compression";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import router from "./routes";
import { startServiceReminderScheduler } from "./lib/service-reminders";
import { getSentry } from "./lib/sentry";

const app: Express = express();
app.set("trust proxy", 1);

app.use(helmet({
  // API is consumed by a SPA on a separate domain; relax CSP and frame options
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
// Broad CORS: allow the business app, all *.tradeworkdesk.co.uk subdomains,
// and any custom tenant domain (public endpoints are rate-limited separately).
const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (server-to-server, curl, mobile apps)
    if (!origin) return callback(null, true);
    const allowed =
      origin === (process.env.APP_URL || "http://localhost:3000") ||
      origin === "http://localhost:3000" ||
      origin === "http://localhost:5173" ||
      /^https?:\/\/([a-z0-9-]+\.)*tradeworkdesk\.co\.uk$/.test(origin) ||
      /^https?:\/\/([a-z0-9-]+\.)*vercel\.app$/.test(origin);
    // Custom tenant domains: allow all https origins (public routes are rate-limited)
    const isCustomDomain = origin.startsWith("https://");
    callback(null, allowed || isCustomDomain);
  },
  credentials: true,
};
app.use(cors(corsOptions));

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

const portalAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in 15 minutes." },
});

// Public warmup endpoint — no auth, used by frontend to wake Railway on load
app.get("/api/ping", (_req: Request, res: Response) => { res.json({ ok: true }); });

app.use("/api/auth/register", registrationLimiter);
app.use("/api/auth/validate-invite", authLimiter);
app.use("/api/auth/use-invite", authLimiter);
app.use("/api/portal/register", portalAuthLimiter);
app.use("/api/portal/login", portalAuthLimiter);

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
  res.json({ status: "ok", v: 2 });
});

// Monitoring helper endpoint: confirms if Sentry SDK is initialised.
app.get("/health/sentry", (_req: Request, res: Response) => {
  res.json({
    sentryEnabled: Boolean(process.env.SENTRY_DSN),
    sentryInitialized: Boolean(getSentry()),
    environment: process.env.SENTRY_ENV || "production",
  });
});

// Test endpoint for monitoring verification
app.get("/api/test-error", (_req: Request, _res: Response) => {
  throw new Error("This is a test error for Sentry verification");
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
  console.error("Unhandled error:", err.stack || err.message);
  // Report to Sentry if available (lazy import to avoid circular deps)
  import("./lib/sentry").then(({ captureException }) => captureException(err)).catch(() => {});
  if (err.name === "ZodError") {
    res.status(422).json({ error: "Response validation failed", details: err.message });
    return;
  }
  // Multer errors (file size, wrong type, etc.)
  if (err.name === "MulterError" || (err as { code?: string }).code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: err.message || "Internal server error" });
});

export default app;

startServiceReminderScheduler();
