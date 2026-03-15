import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err.message);
  if (err.name === "ZodError") {
    res.status(422).json({ error: "Response validation failed", details: err.message });
    return;
  }
  res.status(500).json({ error: "Internal server error" });
});

export default app;
