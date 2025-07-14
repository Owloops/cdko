import { StackManager } from "../../core/stack-manager";
import { logger } from "../../utils/logger";

export async function init() {
  try {
    const stackManager = new StackManager();
    await stackManager.detect();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(errorMessage);
    process.exit(1);
  }
}

export default init;
