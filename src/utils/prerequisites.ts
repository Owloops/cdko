import { $ } from "zx";
import { logger } from "./logger";

export async function checkPrerequisites() {
  const requiredTools = ["aws", "cdk"];
  const missing = [];

  for (const tool of requiredTools) {
    try {
      await $`which ${tool}`.quiet();
    } catch {
      missing.push(tool);
    }
  }

  if (missing.length > 0) {
    logger.error(`Missing required tools: ${missing.join(", ")}`);
    logger.info("Please install the missing tools to continue");
    process.exit(1);
  }

  try {
    const cdkVersion = await $`cdk --version`.quiet();
    logger.info(`Using CDK version: ${cdkVersion.toString().trim()}`);
  } catch {}
}
