/**
 * Configuration management module
 * Handles .cdko.json file loading
 */

import { fs, path } from "zx";
import { logger } from "../utils/logger.mjs";

export async function loadConfig() {
  const configPath = path.join(process.cwd(), ".cdko.json");
  if (await fs.exists(configPath)) {
    try {
      const config = await fs.readJson(configPath);

      if (config.stackGroups && typeof config.stackGroups !== "object") {
        logger.warn("Config: stackGroups must be an object, ignoring");
        config.stackGroups = undefined;
      }

      return config;
    } catch (e) {
      logger.warn(`Failed to load .cdko.json: ${e.message}`);
    }
  }
  return {};
}

export function getRegions(config, cliRegions) {
  if (cliRegions && cliRegions !== "all") {
    return cliRegions.split(",").map((r) => r.trim());
  }
  return ["us-east-1"];
}

export function getBuildCommand(config) {
  return config.buildCommand || "npm run build";
}
