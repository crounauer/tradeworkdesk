import { triggerMarketingIndexNowAutoSubmit } from "./indexnow-marketing";

export async function submitIndexNowOnStartup() {
  if (process.env.NODE_ENV !== "production") {
    console.log("IndexNow: skipping startup submission (not production)");
    return;
  }

  triggerMarketingIndexNowAutoSubmit("server_startup");
}
