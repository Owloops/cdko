import { $ } from "zx";
import { minimatch } from "minimatch";
import { logger } from "../utils/logger.mjs";

export class AccountManager {
  constructor(configPath = ".cdko.json") {
    this.configPath = configPath;
    this.accountCache = new Map();
  }

  /**
   * Get all available AWS profiles
   * @returns {Promise<string[]>} Array of available profile names
   */
  async getAvailableProfiles() {
    try {
      const result = await $`aws configure list-profiles`.quiet();
      return result.stdout
        .split("\n")
        .map((profile) => profile.trim())
        .filter((profile) => profile.length > 0);
    } catch {
      logger.warn("Could not list AWS profiles, using exact matching only");
      return [];
    }
  }

  /**
   * Match profile patterns against available profiles
   * @param {string} profilePattern - Profile pattern(s) from CLI (e.g., 'dev-*' or 'dev,prod')
   * @returns {Promise<string[]>} Array of matched profile names
   */
  async matchProfiles(profilePattern) {
    const patterns = profilePattern.split(",").map((p) => p.trim());
    const availableProfiles = await this.getAvailableProfiles();
    const matchedProfiles = [];

    for (const pattern of patterns) {
      if (availableProfiles.length > 0) {
        for (const profile of availableProfiles) {
          if (minimatch(profile, pattern)) {
            if (!matchedProfiles.includes(profile)) {
              matchedProfiles.push(profile);
            }
          }
        }
      } else {
        if (!matchedProfiles.includes(pattern)) {
          matchedProfiles.push(pattern);
        }
      }
    }

    if (matchedProfiles.length === 0) {
      logger.warn(`No profiles found matching pattern: ${profilePattern}`);
      return patterns;
    }

    logger.info(
      `Found ${
        matchedProfiles.length
      } profile(s) matching pattern: ${matchedProfiles.join(", ")}`
    );
    return matchedProfiles;
  }

  /**
   * Get account information for a single profile
   * @param {string} profile - AWS profile name
   * @returns {Promise<Object>} Account info with id, profile, userId, and arn
   */
  async getAccountInfo(profile) {
    if (this.accountCache.has(profile)) {
      return this.accountCache.get(profile);
    }

    try {
      logger.info(`Discovering account for profile: ${profile}`);

      const result =
        await $`aws sts get-caller-identity --profile ${profile} --output json`.quiet();
      const identity = JSON.parse(result.stdout);

      const accountInfo = {
        profile,
        accountId: identity.Account,
        userId: identity.UserId,
        arn: identity.Arn,
      };

      this.accountCache.set(profile, accountInfo);
      logger.info(`Profile ${profile} → Account ${identity.Account}`);

      return accountInfo;
    } catch (error) {
      const errorMsg = error.stderr || error.message;
      logger.error(
        `Failed to get account info for profile ${profile}: ${errorMsg}`
      );
      throw new Error(
        `Profile '${profile}' authentication failed: ${errorMsg}`
      );
    }
  }

  /**
   * Get account information for multiple profiles
   * @param {string[]} profiles - Array of AWS profile names
   * @returns {Promise<Object[]>} Array of account info objects
   */
  async getMultiAccountInfo(profiles) {
    logger.info(`Discovering accounts for ${profiles.length} profile(s)...`);

    const accountPromises = profiles.map((profile) =>
      this.getAccountInfo(profile).catch((error) => ({
        profile,
        error: error.message,
        failed: true,
      }))
    );

    const results = await Promise.all(accountPromises);

    const successful = results.filter((result) => !result.failed);
    const failed = results.filter((result) => result.failed);

    if (failed.length > 0) {
      logger.error(`Failed to authenticate ${failed.length} profile(s):`);
      failed.forEach(({ profile, error }) => {
        logger.error(`  ${profile}: ${error}`);
      });

      if (successful.length === 0) {
        throw new Error("All profiles failed authentication");
      }

      logger.warn(`Continuing with ${successful.length} successful profile(s)`);
    }

    return successful;
  }

  /**
   * Create deployment targets from account info and regions
   * @param {Object[]} accountInfo - Array of account info objects
   * @param {string[]} regions - Array of region names
   * @returns {Object[]} Array of deployment targets with profile, accountId, region, and key
   */
  createDeploymentTargets(accountInfo, regions) {
    const targets = [];

    accountInfo.forEach(({ profile, accountId }) => {
      regions.forEach((region) => {
        targets.push({
          profile,
          accountId,
          region,
          key: `${accountId}/${region}`,
        });
      });
    });

    return targets;
  }

  /**
   * Clear the account cache
   */
  clearCache() {
    this.accountCache.clear();
  }
}

export default AccountManager;
