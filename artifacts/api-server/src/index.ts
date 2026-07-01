import 'dotenv/config'
import { initSentry } from "./lib/sentry";
import { startReviewRequestScheduler } from "./lib/review-request-service";
import app from "./app";
import { submitIndexNowOnStartup } from "./lib/indexnow-startup";
import { startSocialScheduler } from "./lib/social-scheduler";
import { startDailySuggestionsCron } from "./lib/social-daily-cron";
import { runStartupMigrations } from "./lib/migrations";
import { startPushEventScheduler } from "./lib/push-events";

const rawPort = process.env["PORT"] ?? "3001";

if (!process.env["PORT"]) {
  console.warn("PORT is not set; defaulting to 3001");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

(async () => {
  app.listen(port, "0.0.0.0", () => {
    console.log(`Server listening on port ${port}`);

    initSentry()
      .then(() => {
        // Sentry is optional at runtime; startup should not block on it.
      })
      .catch((err) => console.error("[sentry] Startup init failed:", err));

    setTimeout(() => {
      submitIndexNowOnStartup().catch((err) =>
        console.error("[indexnow] Startup submission failed:", err)
      );
      startSocialScheduler();
      startDailySuggestionsCron();
      startReviewRequestScheduler();
      startPushEventScheduler();
      runStartupMigrations().catch((err) =>
        console.error("[migrations] Startup check failed:", err)
      );
    }, 5000);
  });
})();
