/**
 * Library entry point for programmatic use
 * Exports core functionality for use as a module
 */

export {
  loadConfig,
  getRegions,
  getBuildCommand,
} from "./core/config.mjs";
export { runCdkCommand } from "./core/executor.mjs";
export { deployToRegion, deployToAllRegions } from "./core/orchestrator.mjs";
export { logger } from "./utils/logger.mjs";
export { checkPrerequisites } from "./utils/prerequisites.mjs";
