import { $ } from "zx";
import { minimatch } from "minimatch";
import { logger } from "../utils/logger";

interface AccountInfo {
  accountId: string;
  profile: string;
  userId: string;
  arn: string;
}

interface DeploymentTarget {
  profile: string;
  accountId: string;
  region: string;
  key: string;
}

interface FailedAccountInfo {
  profile: string;
  error: string;
  failed: true;
}

type AccountResult = AccountInfo | FailedAccountInfo;

export class AccountManager {
  private configPath: string;
  private accountCache: Map<string, AccountInfo>;

  constructor(configPath = ".cdko.json") {
    this.configPath = configPath;
    this.accountCache = new Map();
  }

  async getAvailableProfiles(): Promise<string[]> {
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

  async matchProfiles(profilePattern: string): Promise<string[]> {
    const patterns = profilePattern.split(",").map((p: string) => p.trim());
    const availableProfiles = await this.getAvailableProfiles();
    const matchedProfiles: string[] = [];

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
      } profile(s) matching pattern: ${matchedProfiles.join(", ")}`,
    );
    return matchedProfiles;
  }

  async getAccountInfo(profile: string): Promise<AccountInfo> {
    if (this.accountCache.has(profile)) {
      return this.accountCache.get(profile)!;
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
      const errorMsg =
        error instanceof Error && "stderr" in error
          ? (error as Error & { stderr: string }).stderr
          : error instanceof Error
            ? error.message
            : String(error);
      logger.error(
        `Failed to get account info for profile ${profile}: ${errorMsg}`,
      );
      throw new Error(
        `Profile '${profile}' authentication failed: ${errorMsg}`,
      );
    }
  }

  async getMultiAccountInfo(profiles: string[]): Promise<AccountInfo[]> {
    logger.info(`Discovering accounts for ${profiles.length} profile(s)...`);

    const accountPromises = profiles.map((profile: string) =>
      this.getAccountInfo(profile).catch(
        (error): FailedAccountInfo => ({
          profile,
          error: error instanceof Error ? error.message : String(error),
          failed: true,
        }),
      ),
    );

    const results: AccountResult[] = await Promise.all(accountPromises);

    const successful = results.filter(
      (result): result is AccountInfo => !("failed" in result),
    );
    const failed = results.filter(
      (result): result is FailedAccountInfo => "failed" in result,
    );

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

  createDeploymentTargets(
    accountInfo: AccountInfo[],
    regions: string[],
  ): DeploymentTarget[] {
    const targets: DeploymentTarget[] = [];

    accountInfo.forEach(({ profile, accountId }) => {
      regions.forEach((region: string) => {
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

  clearCache() {
    this.accountCache.clear();
  }
}

export default AccountManager;
