import 'dotenv/config'
import { initSentry } from "./lib/sentry";
import { startReviewRequestScheduler } from "./lib/review-request-service";
import app from "./app";
import { submitIndexNowOnStartup } from "./lib/indexnow-startup";
import { startSocialScheduler } from "./lib/social-scheduler";
import { startDailySuggestionsCron } from "./lib/social-daily-cron";
import { seedAllTenantsJobTypes } from "./lib/job-types-seed";
import { runStartupMigrations } from "./lib/migrations";

const rawPort = process.env["PORT"] ?? "3001";

if (!process.env["PORT"]) {
  console.warn("PORT is not set; defaulting to 3001");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

(async () => {
  // Initialise Sentry before the server starts so all errors are captured
  await initSentry();

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    setTimeout(() => {
      submitIndexNowOnStartup().catch((err) =>
        console.error("[indexnow] Startup submission failed:", err)
      );
      startSocialScheduler();
      startDailySuggestionsCron();
      startReviewRequestScheduler();
      seedAllTenantsJobTypes().catch((err) =>
        console.error("[job-types] Startup seeding failed:", err)
      );
      runStartupMigrations().catch((err) =>
        console.error("[migrations] Startup check failed:", err)
      );
    }, 5000);
  });
})();
