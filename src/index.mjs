/**
 * Library entry point for programmatic use
 * Exports core functionality for use as a module
 */

export { loadConfig, getRegions, getPrimaryRegion, buildStackName } from './core/config.mjs';
export { checkAwsProfile } from './core/auth.mjs';
export { runCdkCommand } from './core/executor.mjs';
export { deployToRegion, deployToAllRegions } from './core/orchestrator.mjs';
export { logger } from './utils/logger.mjs';
export { checkPrerequisites } from './utils/prerequisites.mjs';