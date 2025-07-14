#!/usr/bin/env node
import { StackManager } from "../../core/stack-manager.mjs";
import { logger } from "../../utils/logger.mjs";

export async function init() {
  try {
    const stackManager = new StackManager();
    await stackManager.detect();
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }
}

export default init;
