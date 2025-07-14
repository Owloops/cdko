import { logger } from "../utils/logger.ts";
import { runCdkCommand } from "./executor.ts";
import { StackManager } from "./stack-manager.ts";
import type { CdkoConfig } from "./stack-manager.ts";
import { AccountManager } from "./account-manager.ts";
import { CloudAssemblyManager } from "./cloud-assembly.ts";

interface Deployment {
  region: string;
  constructId: string;
  stackName: string;
  profile?: string;
  accountId?: string;
  source?: string;
}

interface DeploymentArgs {
  mode: string;
  dryRun?: boolean;
  profile: string;
  stackPattern: string;
  sequential?: boolean;
  environment?: string;
  verbose?: boolean;
  parameters?: string[];
  includeDeps?: boolean;
  context?: string[];
  executeChangeset?: boolean;
  cdkOptions?: string;
}

interface DeploymentResult {
  success: boolean;
  region: string;
  stackName: string;
  duration?: string;
  error?: unknown;
  status?: string;
}

export async function deployStack(
  deployment: Deployment,
  args: DeploymentArgs,
  signal: AbortSignal,
  cloudAssemblyPath: string | null = null,
): Promise<DeploymentResult> {
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
          executorOptions,
        );
        break;

      case "changeset":
        logger.info(`Creating changeset for ${stackName}`);
        await runCdkCommand(
          region,
          constructId,
          "deploy",
          deployProfile,
          executorOptions,
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
          executeOptions,
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

export async function deployToAllRegions(
  regions: string[],
  args: DeploymentArgs,
  signal: AbortSignal,
): Promise<DeploymentResult[]> {
  const stackManager = new StackManager();
  const stackConfig = await stackManager.loadConfig();

  let deployments: Deployment[] = [];

  const isMultiAccount =
    args.profile.includes(",") ||
    args.profile.includes("*") ||
    args.profile.includes("{");

  if (isMultiAccount) {
    deployments = await resolveMultiAccountDeployments(
      args.profile,
      args.stackPattern,
      stackConfig as CdkoConfig,
      regions,
    );
  } else {
    if (stackConfig) {
      deployments = stackManager.resolveDeployments(
        args.stackPattern,
        stackConfig as CdkoConfig,
        regions,
      );

      if (deployments.length === 0) {
        logger.warn(
          "No matching stacks found in .cdko.json, falling back to traditional deployment",
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

  const profileAssemblies = new Map<string, string>();

  if (isMultiAccount) {
    const uniqueProfiles = [
      ...new Set(deployments.map((d) => d.profile || args.profile)),
    ];

    logger.info(
      `Synthesizing cloud assemblies for ${uniqueProfiles.length} profile(s)...`,
    );

    const synthesisPromises = uniqueProfiles.map(async (profile) => {
      try {
        const cloudAssembly = new CloudAssemblyManager();
        const assemblyPath = await cloudAssembly.synthesize({
          stacks: args.stackPattern,
          profile: profile,
          environment: args.environment,
          outputDir: `cdk.out-${profile}`,
        });
        profileAssemblies.set(profile, assemblyPath);
        logger.success(
          `Cloud assembly for profile ${profile} → ${assemblyPath}`,
        );
        return { profile, assemblyPath, success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(
          `Failed to synthesize for profile ${profile}: ${errorMessage}`,
        );
        return { profile, error, success: false };
      }
    });

    const synthesisResults = await Promise.all(synthesisPromises);
    const failedSynthesis = synthesisResults.filter(
      (result) => !result.success,
    );

    if (failedSynthesis.length > 0) {
      throw new Error(
        `Failed to synthesize ${failedSynthesis.length} profile(s): ${failedSynthesis.map((f) => f.profile).join(", ")}`,
      );
    }
  } else {
    try {
      const cloudAssembly = new CloudAssemblyManager();
      const assemblyPath = await cloudAssembly.synthesize({
        stacks: args.stackPattern,
        profile: args.profile,
        environment: args.environment,
      });
      profileAssemblies.set(args.profile, assemblyPath);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Failed to synthesize cloud assembly: ${errorMessage}`);
      throw error;
    }
  }

  if (!isMultiAccount) {
    console.log();
    logger.info(`Planning to deploy ${deployments.length} stack(s):`);
    const stackGroups: { [key: string]: string[] } = {};
    deployments.forEach((d) => {
      if (!stackGroups[d.stackName]) {
        stackGroups[d.stackName] = [];
      }
      stackGroups[d.stackName]!.push(d.region);
    });

    Object.entries(stackGroups).forEach(([stack, regions]) => {
      logger.info(`${stack} → ${regions.join(", ")}`);
    });
  }

  const results: DeploymentResult[] = [];

  if (args.sequential) {
    for (const deployment of deployments) {
      const assemblyPath = profileAssemblies.get(
        deployment.profile || args.profile,
      );
      results.push(await deployStack(deployment, args, signal, assemblyPath));
    }
  } else {
    logger.info(
      `Processing ${deployments.length} deployment(s) in parallel...`,
    );

    const deploymentPromises = deployments.map((deployment) => {
      const assemblyPath = profileAssemblies.get(
        deployment.profile || args.profile,
      );
      return deployStack(deployment, args, signal, assemblyPath).then(
        (result) => ({ ...result, status: "fulfilled" }),
        (error) => ({
          region: deployment.region,
          stackName: deployment.stackName,
          success: false,
          error,
          status: "rejected",
        }),
      );
    });

    const parallelResults = await Promise.all(deploymentPromises);
    results.push(...parallelResults);

    console.log();
    results.forEach((result) => {
      if (result.success) {
        logger.success(
          `${result.region}: ${result.stackName} completed successfully`,
        );
      } else {
        const error = result.error;
        let errorMsg = "Unknown error";

        if (error instanceof Error) {
          errorMsg = error.message;
        } else if (error && typeof error === "object" && "stderr" in error) {
          errorMsg = (error as { stderr: string }).stderr;
        } else if (error && typeof error === "object" && "stdout" in error) {
          errorMsg = (error as { stdout: string }).stdout;
        } else if (typeof error === "string") {
          errorMsg = error;
        }

        const lines = errorMsg
          .split("\n")
          .filter((line: string) => line.trim());
        const meaningfulError =
          lines.find(
            (line: string) =>
              line.includes("No stacks match") ||
              line.includes("already exists") ||
              line.includes("AccessDenied") ||
              line.includes("is not authorized") ||
              line.includes("CloudFormation error") ||
              line.includes("Error:") ||
              line.includes("failed:"),
          ) ||
          lines[0] ||
          "Check output above for details";

        logger.error(
          `${result.region}: ${result.stackName} - ${meaningfulError.trim()}`,
        );
      }
    });
  }

  return results;
}

async function resolveMultiAccountDeployments(
  profilePattern: string,
  stackPattern: string,
  stackConfig: CdkoConfig,
  requestedRegions: string[],
): Promise<Deployment[]> {
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
    requestedRegions,
  );

  const stackManager = new StackManager();
  const matchedStacks = stackManager.matchStacks(stackPattern, stackConfig);

  const allDeployments: Deployment[] = [];

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
      "No deployments resolved - check stack configuration and account/region combinations",
    );
    return [];
  }

  logMultiAccountDeploymentSummary(allDeployments);

  return allDeployments;
}

function logMultiAccountDeploymentSummary(deployments: Deployment[]) {
  console.log();
  logger.info(`Planning ${deployments.length} deployment(s):`);

  const stackGroups: { [key: string]: Deployment[] } = {};
  deployments.forEach((deployment) => {
    if (!stackGroups[deployment.stackName]) {
      stackGroups[deployment.stackName] = [];
    }
    stackGroups[deployment.stackName]!.push(deployment);
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
    `Targeting ${accounts.length} account(s): ${accounts.join(", ")}`,
  );
}
