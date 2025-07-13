#!/usr/bin/env node
import { $ } from "zx";
import fs from "fs/promises";
import { logger } from "../utils/logger.mjs";

/**
 * Stack detection for CDKO
 */
export class StackDetector {
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
   * Load existing configuration
   */
  async loadConfig() {
    try {
      const data = await fs.readFile(this.configPath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      if (error.code !== "ENOENT") {
        logger.error("Failed to load configuration:", error.message);
      }
    }
    return null;
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
        buildCommand: process.env.CDK_BUILD_COMMAND || "npm run build",
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
}

export default StackDetector;
