import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./audit/specs",
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["list"], ["html", { outputFolder: `${process.env.AUDIT_ARTIFACT_DIR ?? "artifacts/browser-audit"}/report` }], ["json", { outputFile: `${process.env.AUDIT_ARTIFACT_DIR ?? "artifacts/browser-audit"}/results.json` }]],
  outputDir: `${process.env.AUDIT_ARTIFACT_DIR ?? "artifacts/browser-audit"}/test-results`,
  use: {
    baseURL: process.env.AUDIT_FRONTEND_URL ?? "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    acceptDownloads: true,
    headless: process.env.AUDIT_HEADED !== "1",
  },
});
