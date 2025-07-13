/**
 * Configuration management module
 * Handles .cdko.json file loading
 */

import { fs, path } from 'zx';
import { logger } from '../utils/logger.mjs';

export async function loadConfig() {
  const configPath = path.join(process.cwd(), '.cdko.json');
  if (await fs.exists(configPath)) {
    try {
      const config = await fs.readJson(configPath);
      
      if (config.regions && !Array.isArray(config.regions)) {
        logger.warn('Config: regions must be an array, ignoring');
        config.regions = undefined;
      }
      
      if (config.regionSuffixes && typeof config.regionSuffixes !== 'object') {
        logger.warn('Config: regionSuffixes must be an object, ignoring');
        config.regionSuffixes = undefined;
      }
      
      return config;
    } catch (e) {
      logger.warn(`Failed to load .cdko.json: ${e.message}`);
    }
  }
  return {};
}

export function getRegions(config, cliRegions) {
  if (cliRegions && cliRegions !== 'all') {
    return cliRegions.split(',').map(r => r.trim());
  }
  
  if (config.regions && config.regions.length > 0) {
    return config.regions;
  }
  
  logger.error('No regions specified. Use -r flag or define regions in .cdko.json');
  process.exit(1);
}

export function getPrimaryRegion(config) {
  return config.primaryRegion || 'us-east-1';
}

export function getRegionSuffixes(config) {
  return config.regionSuffixes || {};
}

export function getRegionSuffix(region, regionSuffixes) {
  return regionSuffixes[region] || '';
}

export function getBuildCommand(config) {
  return config.buildCommand || 'npm run build';
}

export function buildStackName(region, environment, stackPattern, config) {
  const regionSuffixes = getRegionSuffixes(config);
  const suffix = getRegionSuffix(region, regionSuffixes);
  return `${environment}-${stackPattern}${suffix}`;
}