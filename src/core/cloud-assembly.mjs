import { $ } from "zx";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.mjs";

export class CloudAssemblyManager {
  constructor(config) {
    this.config = config;
    this.cloudAssemblyPath = null;
  }

  /**
   * Get the cloud assembly output path
   * @returns {string} The cloud assembly directory path
   */
  getCloudAssemblyPath() {
    return join(process.cwd(), "cdk.out");
  }

  /**
   * Synthesize the CDK app once and cache the cloud assembly
   * @param {Object} options - Synthesis options
   * @returns {Promise<string>} Path to cloud assembly
   */
  async synthesize(options = {}) {
    const { stacks = "*", profile, environment, outputDir } = options;
    const cloudAssemblyPath = outputDir ? join(process.cwd(), outputDir) : this.getCloudAssemblyPath();

    try {
      if (existsSync(cloudAssemblyPath)) {
        logger.info(`Cleaning existing cloud assembly at ${cloudAssemblyPath}`);
        rmSync(cloudAssemblyPath, { recursive: true, force: true });
      }

      mkdirSync(cloudAssemblyPath, { recursive: true });

      logger.info("Synthesizing cloud assembly...");

      const cdkArgs = ["synth"];

      if (process.env.CDK_CLI_NOTICES !== "true") {
        cdkArgs.push("--no-notices");
      }

      if (stacks !== "*") {
        cdkArgs.push(stacks);
      }

      cdkArgs.push("--output", cloudAssemblyPath);

      if (profile) {
        cdkArgs.push("--profile", profile);
      }

      if (environment) {
        cdkArgs.push("--context", `environment=${environment}`);
      }

      const result = await $({ quiet: true })`cdk ${cdkArgs}`;

      if (result.exitCode === 0) {
        logger.success(`Cloud assembly synthesized to ${cloudAssemblyPath}`);
        this.cloudAssemblyPath = cloudAssemblyPath;
        return cloudAssemblyPath;
      } else {
        throw new Error(`CDK synth failed with exit code ${result.exitCode}`);
      }
    } catch (error) {
      logger.error("Failed to synthesize cloud assembly");
      if (error.stderr) {
        console.error(error.stderr);
      }
      throw error;
    }
  }

  /**
   * Get CDK command arguments with cloud assembly
   * @param {Array} baseArgs - Base CDK arguments
   * @returns {Array} Modified arguments with cloud assembly path
   */
  getCdkArgs(baseArgs) {
    if (!this.cloudAssemblyPath || !existsSync(this.cloudAssemblyPath)) {
      throw new Error("Cloud assembly not available. Run synthesize() first.");
    }

    const args = [...baseArgs];
    const appIndex = args.indexOf("--app");

    if (appIndex !== -1) {
      args.splice(appIndex, 2);
    }

    args.push("--app", this.cloudAssemblyPath);

    return args;
  }

  /**
   * Check if cloud assembly is available and valid
   * @returns {boolean} True if cloud assembly is available
   */
  isAvailable() {
    return this.cloudAssemblyPath && existsSync(this.cloudAssemblyPath);
  }
}
