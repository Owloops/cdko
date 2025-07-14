import { logger } from "../utils/logger.mjs";
import { runCdkCommand } from "./executor.mjs";
import { StackManager } from "./stack-manager.mjs";
import { AccountManager } from "./account-manager.mjs";
import { CloudAssemblyManager } from "./cloud-assembly.mjs";

/**
 * Deploy a specific stack to a specific region
 * @param {Object} deployment - Deployment configuration
 * @param {string} deployment.region - AWS region to deploy to
 * @param {string} deployment.constructId - CDK construct ID
 * @param {string} deployment.stackName - Stack name for logging
 * @param {string} [deployment.profile] - AWS profile to use
 * @param {Object} args - CLI arguments
 * @param {string} args.mode - Deployment mode (diff/changeset/execute)
 * @param {boolean} [args.dryRun] - Whether this is a dry run
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @param {string} cloudAssemblyPath - Path to cloud assembly directory
 * @returns {Promise<Object>} Deployment result with success status
 */
export async function deployStack(
  deployment,
  args,
  signal,
  cloudAssemblyPath = null
) {
  const { region, constructId, stackName, profile } = deployment;
  const deployProfile = profile || args.profile;

  console.log();
  console.log(`${logger.region(region)} → ${logger.stack(stackName)}`);

  if (args.dryRun) {
    logger.info(`Would deploy: ${constructId} to ${region}`);
    return { success: true, region, stackName };
  }

  const startTime = Date.now();

  try {
    const executorOptions = {
      ...args,
      signal,
      cloudAssemblyPath,
    };

    switch (args.mode) {
      case "diff":
        await runCdkCommand(
          region,
          constructId,
          "diff",
          deployProfile,
          executorOptions
        );
        break;

      case "changeset":
        logger.info(`Creating changeset for ${stackName}`);
        await runCdkCommand(
          region,
          constructId,
          "deploy",
          deployProfile,
          executorOptions
        );
        logger.success("Changeset created");
        break;

      case "execute":
        logger.info(`Deploying ${stackName}`);
        const executeOptions = { ...executorOptions, executeChangeset: true };
        await runCdkCommand(
          region,
          constructId,
          "deploy",
          deployProfile,
          executeOptions
        );
        logger.success(`Deployed ${stackName}`);
        break;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Completed in ${duration}s`);
    return { success: true, region, stackName, duration };
  } catch (e) {
    logger.error(`Failed to deploy ${stackName}`);
    return { success: false, region, stackName, error: e };
  }
}

/**
 * Deploy to all regions based on stack configuration
 * @param {string[]} regions - List of AWS regions to deploy to
 * @param {Object} args - CLI arguments
 * @param {string} args.profile - AWS profile(s) to use (supports patterns)
 * @param {string} args.stackPattern - Stack pattern to match
 * @param {string} args.mode - Deployment mode (diff/changeset/execute)
 * @param {boolean} [args.sequential] - Deploy sequentially vs parallel
 * @param {boolean} [args.dryRun] - Whether this is a dry run
 * @param {AbortSignal} signal - Abort signal for cancellation
 * @returns {Promise<Object[]>} Array of deployment results
 */
export async function deployToAllRegions(regions, args, signal) {
  const stackManager = new StackManager();
  const stackConfig = await stackManager.loadConfig();

  let deployments = [];

  const isMultiAccount =
    args.profile.includes(",") ||
    args.profile.includes("*") ||
    args.profile.includes("{");

  if (isMultiAccount) {
    deployments = await resolveMultiAccountDeployments(
      args.profile,
      args.stackPattern,
      stackConfig,
      regions
    );
  } else {
    if (stackConfig) {
      deployments = stackManager.resolveDeployments(
        args.stackPattern,
        stackConfig,
        regions
      );

      if (deployments.length === 0) {
        logger.warn(
          "No matching stacks found in .cdko.json, falling back to traditional deployment"
        );
      }
    }

    if (deployments.length === 0) {
      logger.info("Using traditional pattern-based deployment");
      for (const region of regions) {
        const stackName = args.stackPattern;
        deployments.push({
          region,
          constructId: stackName,
          stackName,
          profile: args.profile,
        });
      }
    } else {
      deployments = deployments.map((deployment) => ({
        ...deployment,
        profile: args.profile,
      }));
    }
  }

  const profileAssemblies = new Map();

  if (isMultiAccount) {
    const uniqueProfiles = [...new Set(deployments.map((d) => d.profile))];

    logger.info(
      `Synthesizing cloud assemblies for ${uniqueProfiles.length} profile(s)...`
    );

    for (const profile of uniqueProfiles) {
      try {
        const cloudAssembly = new CloudAssemblyManager({});
        const assemblyPath = await cloudAssembly.synthesize({
          stacks: args.stackPattern,
          profile: profile,
          environment: args.environment,
          outputDir: `cdk.out-${profile}`,
        });
        profileAssemblies.set(profile, assemblyPath);
        logger.success(
          `Cloud assembly for profile ${profile} → ${assemblyPath}`
        );
      } catch (error) {
        logger.error(
          `Failed to synthesize for profile ${profile}: ${error.message}`
        );
        throw error;
      }
    }
  } else {
    try {
      const cloudAssembly = new CloudAssemblyManager({});
      const assemblyPath = await cloudAssembly.synthesize({
        stacks: args.stackPattern,
        profile: args.profile,
        environment: args.environment,
      });
      profileAssemblies.set(args.profile, assemblyPath);
    } catch (error) {
      logger.error("Failed to synthesize cloud assembly:", error.message);
      throw error;
    }
  }

  if (!isMultiAccount) {
    console.log();
    logger.info(`Planning to deploy ${deployments.length} stack(s):`);
    const stackGroups = {};
    deployments.forEach((d) => {
      if (!stackGroups[d.stackName]) {
        stackGroups[d.stackName] = [];
      }
      stackGroups[d.stackName].push(d.region);
    });

    Object.entries(stackGroups).forEach(([stack, regions]) => {
      logger.info(`${stack} → ${regions.join(", ")}`);
    });
  }

  const results = [];

  if (args.sequential) {
    for (const deployment of deployments) {
      const assemblyPath = profileAssemblies.get(deployment.profile);
      results.push(await deployStack(deployment, args, signal, assemblyPath));
    }
  } else {
    logger.info(
      `Processing ${deployments.length} deployment(s) in parallel...`
    );

    const deploymentPromises = deployments.map((deployment) => {
      const assemblyPath = profileAssemblies.get(deployment.profile);
      return deployStack(deployment, args, signal, assemblyPath).then(
        (result) => ({ ...result, status: "fulfilled" }),
        (error) => ({
          region: deployment.region,
          stackName: deployment.stackName,
          success: false,
          error,
          status: "rejected",
        })
      );
    });

    const parallelResults = await Promise.all(deploymentPromises);
    results.push(...parallelResults);

    console.log();
    results.forEach((result) => {
      if (result.success) {
        logger.success(
          `${result.region}: ${result.stackName} completed successfully`
        );
      } else {
        const errorMsg =
          result.error?.message ||
          result.error?.stderr ||
          result.error?.stdout ||
          "Unknown error";

        const lines = errorMsg.split("\n").filter((line) => line.trim());
        const meaningfulError =
          lines.find(
            (line) =>
              line.includes("No stacks match") ||
              line.includes("already exists") ||
              line.includes("AccessDenied") ||
              line.includes("is not authorized") ||
              line.includes("CloudFormation error") ||
              line.includes("Error:") ||
              line.includes("failed:")
          ) ||
          lines[0] ||
          "Check output above for details";

        logger.error(
          `${result.region}: ${result.stackName} - ${meaningfulError.trim()}`
        );
      }
    });
  }

  return results;
}

/**
 * Resolves multi-account deployments by combining profiles, accounts, and stacks
 * @param {string} profilePattern - Profile pattern(s) from CLI
 * @param {string} stackPattern - Stack pattern(s) from CLI
 * @param {Object} stackConfig - Stack configuration from .cdko.json
 * @param {Array} requestedRegions - Regions requested via CLI
 * @returns {Promise<Array>} All deployments to be executed with account info
 */
async function resolveMultiAccountDeployments(
  profilePattern,
  stackPattern,
  stackConfig,
  requestedRegions
) {
  const accountManager = new AccountManager();

  const profiles = await accountManager.matchProfiles(profilePattern);
  if (profiles.length === 0) {
    throw new Error(`No profiles found matching pattern: ${profilePattern}`);
  }

  const accountInfo = await accountManager.getMultiAccountInfo(profiles);
  if (accountInfo.length === 0) {
    throw new Error("Failed to authenticate any profiles");
  }

  const deploymentTargets = accountManager.createDeploymentTargets(
    accountInfo,
    requestedRegions
  );

  const stackManager = new StackManager();
  const matchedStacks = stackManager.matchStacks(stackPattern, stackConfig);

  const allDeployments = [];

  if (matchedStacks.length === 0) {
    logger.info("No stack configuration found, using pattern-based deployment");

    deploymentTargets.forEach(({ profile, accountId, region }) => {
      allDeployments.push({
        profile,
        accountId,
        region,
        constructId: stackPattern,
        stackName: stackPattern,
        source: "pattern",
      });
    });
  } else {
    logger.info(`Found ${matchedStacks.length} stack(s) matching pattern`);

    matchedStacks.forEach((stackGroup) => {
      deploymentTargets.forEach(({ profile, accountId, region, key }) => {
        if (stackGroup.deployments[key]) {
          const deployment = stackGroup.deployments[key];
          allDeployments.push({
            profile,
            accountId,
            region,
            constructId: deployment.constructId,
            stackName: stackGroup.name,
            source: "configured",
          });
        } else {
          const unknownRegionKey = `${accountId}/unknown-region`;
          if (stackGroup.deployments[unknownRegionKey]) {
            const deployment = stackGroup.deployments[unknownRegionKey];
            allDeployments.push({
              profile,
              accountId,
              region,
              constructId: deployment.constructId,
              stackName: stackGroup.name,
              source: "region-agnostic",
            });
          }
        }
      });
    });
  }

  if (allDeployments.length === 0) {
    logger.warn(
      "No deployments resolved - check stack configuration and account/region combinations"
    );
    return [];
  }

  logMultiAccountDeploymentSummary(allDeployments);

  return allDeployments;
}

/**
 * Log a summary of planned multi-account deployments
 * @param {Array} deployments - Array of deployment objects
 */
function logMultiAccountDeploymentSummary(deployments) {
  console.log();
  logger.info(`Planning ${deployments.length} deployment(s):`);

  const stackGroups = {};
  deployments.forEach((deployment) => {
    if (!stackGroups[deployment.stackName]) {
      stackGroups[deployment.stackName] = [];
    }
    stackGroups[deployment.stackName].push(deployment);
  });

  Object.entries(stackGroups).forEach(([stackName, stackDeployments]) => {
    const targets = stackDeployments
      .map((d) => `${d.accountId}/${d.region}`)
      .join(", ");
    logger.info(`${stackName} → ${targets}`);
  });

  const accounts = [...new Set(deployments.map((d) => d.accountId))];
  const profiles = [...new Set(deployments.map((d) => d.profile))];

  console.log();
  logger.info(`Using ${profiles.length} profile(s): ${profiles.join(", ")}`);
  logger.info(
    `Targeting ${accounts.length} account(s): ${accounts.join(", ")}`
  );
}
