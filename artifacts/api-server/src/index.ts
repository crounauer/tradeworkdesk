import app from "./app";
import { submitIndexNowOnStartup } from "./lib/indexnow-startup";
import { startSocialScheduler } from "./lib/social-scheduler";
import { seedAllTenantsJobTypes } from "./lib/job-types-seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  submitIndexNowOnStartup();
  startSocialScheduler();
  seedAllTenantsJobTypes().catch((err) =>
    console.error("[job-types] Startup seeding failed:", err)
  );
});
