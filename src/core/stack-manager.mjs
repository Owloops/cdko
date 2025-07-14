import { $ } from "zx";
import fs from "fs/promises";
import { minimatch } from "minimatch";
import { logger } from "../utils/logger.mjs";

export class StackManager {
  constructor(configPath = ".cdko.json") {
    this.configPath = configPath;
  }

  /**
   * Detect CDK stacks and create/update configuration
   */
  async detect() {
    try {
      await fs.access("cdk.json");
    } catch {
      throw new Error(
        "No CDK project found. Run this command in a CDK project directory."
      );
    }

    const configExists = await fs
      .access(this.configPath)
      .then(() => true)
      .catch(() => false);

    if (configExists) {
      logger.info("Updating existing CDKO configuration...");
    } else {
      logger.info("Creating new CDKO configuration...");
    }

    const config = await this.detectStacks();
    await this.saveConfig(config);

    const action = configExists ? "updated" : "created";
    logger.success(`CDKO configuration ${action} successfully!`);
    logger.info(`Found ${Object.keys(config.stackGroups).length} stack groups`);

    return config;
  }

  /**
   * Load existing configuration from .cdko.json
   * @returns {Promise<Object>} Configuration object or empty object if not found
   */
  async loadConfig() {
    try {
      const data = await fs.readFile(this.configPath, "utf8");
      const config = JSON.parse(data);

      if (config.stackGroups && typeof config.stackGroups !== "object") {
        logger.warn("Config: stackGroups must be an object, ignoring");
        config.stackGroups = undefined;
      }

      return config;
    } catch (error) {
      if (error.code !== "ENOENT") {
        logger.warn(`Failed to load ${this.configPath}: ${error.message}`);
      }
    }
    return {};
  }

  /**
   * Auto-detect CDK stacks using cdk list
   */
  async detectStacks() {
    logger.info("Detecting CDK stacks...");

    try {
      const result = await $`cdk list --long --json`.quiet();
      const stacks = JSON.parse(result.stdout);

      if (!Array.isArray(stacks) || stacks.length === 0) {
        throw new Error(
          "No stacks found. Ensure your CDK app synthesizes correctly."
        );
      }

      const stackGroups = {};

      for (const stack of stacks) {
        const stackName = stack.name || stack.id;
        const account = stack.environment?.account;
        const region = stack.environment?.region;

        let constructId = stack.id;
        const parenIndex = constructId.indexOf(" (");
        if (parenIndex > -1) {
          constructId = constructId.substring(0, parenIndex);
        }

        if (!stackGroups[stackName]) {
          stackGroups[stackName] = {};
        }

        const deploymentKey = `${account}/${region}`;

        stackGroups[stackName][deploymentKey] = {
          constructId: constructId,
          account: account,
          region: region,
        };
      }

      return {
        version: "0.1",
        stackGroups,
        cdkTimeout: process.env.CDK_TIMEOUT || "30m",
        suppressNotices: process.env.CDK_CLI_NOTICES !== "true",
        lastUpdated: new Date().toISOString(),
        updatedBy: `cdko@${await this.getCdkoVersion()}`,
      };
    } catch (error) {
      if (error.message.includes("No stacks found")) {
        throw error;
      }
      logger.error("Stack detection failed:", error.message);
      throw new Error(
        "Failed to detect stacks. Ensure CDK app synthesizes correctly."
      );
    }
  }

  /**
   * Get CDKO version
   */
  async getCdkoVersion() {
    try {
      const packagePath = new URL("../../package.json", import.meta.url);
      const data = await fs.readFile(packagePath, "utf8");
      const packageJson = JSON.parse(data);
      return packageJson.version || "0.0.0";
    } catch {
      return "0.0.0";
    }
  }

  /**
   * Save configuration
   */
  async saveConfig(config) {
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2) + "\n");
    logger.info(`Configuration saved to ${this.configPath}`);
  }

  /**
   * Get regions from config and CLI arguments
   * @param {Object} config - Configuration object
   * @param {string} cliRegions - Regions from CLI (comma-separated or "all")
   * @returns {string[]} Array of region names
   */
  getRegions(config, cliRegions) {
    if (cliRegions && cliRegions !== "all") {
      return cliRegions.split(",").map((r) => r.trim());
    }
    return ["us-east-1"];
  }

  /**
   * Matches stack patterns against available stacks in configuration
   * @param {string} stackPattern - Stack pattern(s) from CLI (e.g., 'Production-App*' or 'App,Cache')
   * @param {Object} stackConfig - Stack configuration from .cdko.json
   * @returns {Array} Array of matched stack groups with their deployment info
   */
  matchStacks(stackPattern, stackConfig) {
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
  filterDeployments(stackGroup, requestedRegions) {
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
  resolveDeployments(stackPattern, stackConfig, requestedRegions) {
    const matchedGroups = this.matchStacks(stackPattern, stackConfig);

    if (matchedGroups.length === 0) {
      logger.warn(`No stacks found matching pattern: ${stackPattern}`);
      return [];
    }

    logger.info(`Found ${matchedGroups.length} stack(s) matching pattern`);

    const allDeployments = [];

    for (const stackGroup of matchedGroups) {
      const deployments = this.filterDeployments(stackGroup, requestedRegions);

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
}

export default StackManager;
