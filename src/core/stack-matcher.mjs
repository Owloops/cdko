/**
 * Stack pattern matching and filtering logic
 */

import { minimatch } from "minimatch";
import { logger } from "../utils/logger.mjs";

/**
 * Matches stack patterns against available stacks in configuration
 * @param {string} stackPattern - Stack pattern(s) from CLI (e.g., 'Production-App*' or 'App,Cache')
 * @param {Object} stackConfig - Stack configuration from .cdko.json
 * @returns {Array} Array of matched stack groups with their deployment info
 */
export function matchStacks(stackPattern, stackConfig) {
  if (!stackConfig?.stackGroups) {
    return [];
  }

  const patterns = stackPattern.split(",").map((p) => p.trim());
  const matchedGroups = [];

  for (const pattern of patterns) {
    for (const [stackGroupName, deployments] of Object.entries(
      stackConfig.stackGroups
    )) {
      if (minimatch(stackGroupName, pattern)) {
        matchedGroups.push({
          name: stackGroupName,
          pattern: pattern,
          deployments: deployments,
        });
      }
    }
  }

  return matchedGroups;
}

/**
 * Filters deployments based on region constraints
 * @param {Object} stackGroup - Stack group with deployments
 * @param {Array} requestedRegions - Regions requested via CLI
 * @returns {Array} Filtered deployments that can be executed
 */
export function filterDeployments(stackGroup, requestedRegions) {
  const filteredDeployments = [];

  for (const [, deployment] of Object.entries(stackGroup.deployments)) {
    const { region, constructId } = deployment;

    if (region === "unknown-region") {
      for (const requestedRegion of requestedRegions) {
        filteredDeployments.push({
          region: requestedRegion,
          constructId,
          stackName: stackGroup.name,
        });
      }
    } else {
      if (requestedRegions.includes(region)) {
        filteredDeployments.push({
          region,
          constructId,
          stackName: stackGroup.name,
        });
      }
    }
  }

  return filteredDeployments;
}

/**
 * Resolves all deployments for given stack patterns
 * @param {string} stackPattern - Stack pattern(s) from CLI
 * @param {Object} stackConfig - Stack configuration from .cdko.json
 * @param {Array} requestedRegions - Regions requested via CLI
 * @returns {Array} All deployments to be executed
 */
export function resolveDeployments(
  stackPattern,
  stackConfig,
  requestedRegions
) {
  const matchedGroups = matchStacks(stackPattern, stackConfig);

  if (matchedGroups.length === 0) {
    logger.warn(`No stacks found matching pattern: ${stackPattern}`);
    return [];
  }

  logger.info(`Found ${matchedGroups.length} stack(s) matching pattern`);

  const allDeployments = [];

  for (const stackGroup of matchedGroups) {
    const deployments = filterDeployments(stackGroup, requestedRegions);

    if (deployments.length === 0) {
      logger.warn(
        `No valid deployments for ${stackGroup.name} in requested regions`
      );
    } else {
      logger.info(
        `${stackGroup.name}: ${deployments.length} deployment(s) planned`
      );
      allDeployments.push(...deployments);
    }
  }

  return allDeployments;
}
