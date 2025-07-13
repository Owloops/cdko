#!/usr/bin/env node
import { StackDetector } from "../../core/stack-detector.mjs";
import { logger } from "../../utils/logger.mjs";

/**
 * Initialize CDKO configuration by detecting CDK stacks
 */
export async function init() {
  try {
    const detector = new StackDetector();
    await detector.detect();
  } catch (error) {
    logger.error(error.message);
    process.exit(1);
  }
}

export default init;
