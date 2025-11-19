import { logger } from "../utils/logger";
import { runCdkCommand } from "./executor";
import { StackManager } from "./stack-manager";
import type { CdkoConfig } from "./stack-manager";
import { AccountManager } from "./account-manager";
import { CloudAssemblyManager } from "./cloud-assembly";

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
  synthesisTime?: number;
  deploymentTime?: number;
}

async function executeCommand(
  deployment: Deployment,
  args: DeploymentArgs,
  command: string,
  options: any,
): Promise<void> {
  await runCdkCommand(
    deployment.region,
    deployment.constructId,
    command,
    deployment.profile || args.profile,
    options,
    deployment.profile || args.profile,
  );
}

export async function deployStack(
  deployment: Deployment,
  args: DeploymentArgs,
  signal: AbortSignal,
  cloudAssemblyPath: string | null = null,
): Promise<DeploymentResult> {
  const { region, constructId, stackName } = deployment;

  if (args.dryRun) {
    console.log(`  [${region}] Would deploy: ${constructId}`);
    return { success: true, region, stackName };
  }

  const startTime = Date.now();

  try {
    const executorOptions = { ...args, signal, cloudAssemblyPath };

    switch (args.mode) {
      case "diff":
        console.log(`  [${region}] Showing differences for ${stackName}`);
        await executeCommand(deployment, args, "diff", executorOptions);
        break;

      case "changeset":
        console.log(`  [${region}] Creating changeset for ${stackName}`);
        await executeCommand(deployment, args, "deploy", executorOptions);
        break;

      case "execute":
        console.log(`  [${region}] Deploying ${stackName}`);
        await executeCommand(deployment, args, "deploy", {
          ...executorOptions,
          executeChangeset: true,
        });
        break;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    let completionMessage;
    switch (args.mode) {
      case "diff":
        completionMessage = `Changes detected (${duration}s)`;
        break;
      case "changeset":
        completionMessage = `Changeset created (${duration}s)`;
        break;
      case "execute":
        completionMessage = `Deployment completed (${duration}s)`;
        break;
      default:
        completionMessage = `Completed (${duration}s)`;
    }

    console.log(`  [${region}] ${completionMessage}`);
    return { success: true, region, stackName, duration };
  } catch (e) {
    logger.error(`[${region}] Failed: ${stackName}`);
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
      const stackPatterns = args.stackPattern.split(",").map(s => s.trim());
      for (const region of regions) {
        for (const stackName of stackPatterns) {
          deployments.push({
            region,
            constructId: stackName,
            stackName,
            profile: args.profile,
          });
        }
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

    logger.phase("Synthesis", "");

    const synthesisPromises = uniqueProfiles.map(async (profile) => {
      try {
        console.log(`  [${profile}] Synthesizing cloud assembly...`);

        const profileDeployments = deployments.filter(d => d.profile === profile);
        const stacksForProfile = [...new Set(profileDeployments.map(d => d.constructId))];

        const cloudAssembly = new CloudAssemblyManager();
        const assemblyPath = await cloudAssembly.synthesize({
          profile: profile,
          environment: args.environment,
          outputDir: `cdk.out-${profile}`,
          stacks: stacksForProfile,
          exclusively: !args.includeDeps,
        });
        profileAssemblies.set(profile, assemblyPath);
        const shortPath = assemblyPath.split("/").pop() || assemblyPath;
        console.log(`  [${profile}] Cloud assembly synthesized (${shortPath})`);
        return { profile, assemblyPath, success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(`[${profile}] Failed to synthesize: ${errorMessage}`);
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
      console.log();
      logger.phase("Synthesis", "");
      console.log(`  [${args.profile}] Synthesizing cloud assembly...`);

      const stacksForProfile = [...new Set(deployments.map(d => d.constructId))];

      const cloudAssembly = new CloudAssemblyManager();
      const assemblyPath = await cloudAssembly.synthesize({
        profile: args.profile,
        environment: args.environment,
        stacks: stacksForProfile,
        exclusively: !args.includeDeps,
      });
      profileAssemblies.set(args.profile, assemblyPath);

      const shortPath = assemblyPath.split("/").pop() || assemblyPath;
      console.log(
        `  [${args.profile}] Cloud assembly synthesized (${shortPath})`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Failed to synthesize cloud assembly: ${errorMessage}`);
      throw error;
    }
  }

  const results: DeploymentResult[] = [];

  console.log();
  logger.info(`Planning to deploy ${deployments.length} stack(s):`);
  deployments.forEach((deployment) => {
    console.log(`• ${deployment.stackName} → ${deployment.region}`);
  });
  console.log(
    `• Processing ${deployments.length} deployment(s) in ${args.sequential ? "sequential" : "parallel"}...`,
  );

  console.log();
  logger.phase("Execution", "");

  if (args.sequential) {
    for (const deployment of deployments) {
      const prefix = deployment.profile
        ? `${deployment.profile}/${deployment.region}`
        : deployment.region;
      console.log(`  [${prefix}] Starting deployment...`);
      const assemblyPath = profileAssemblies.get(
        deployment.profile || args.profile,
      );
      results.push(await deployStack(deployment, args, signal, assemblyPath));
    }
  } else {
    deployments.forEach((deployment) => {
      const prefix = deployment.profile
        ? `${deployment.profile}/${deployment.region}`
        : deployment.region;
      console.log(`  [${prefix}] Starting deployment...`);
    });

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
              line.includes("no credentials have been configured") ||
              line.includes("credentials have expired") ||
              line.includes("Unable to locate credentials") ||
              line.includes("AccessDenied") ||
              line.includes("is not authorized") ||
              line.includes("No stacks match") ||
              line.includes("already exists") ||
              line.includes("CloudFormation error") ||
              line.includes("Error:") ||
              line.includes("failed:"),
          ) ||
          lines
            .reverse()
            .find(
              (line: string) =>
                line.includes("no credentials") ||
                line.includes("credentials") ||
                !line.startsWith("[Warning"),
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
  const accounts = [...new Set(deployments.map((d) => d.accountId))];

  logger.info(
    `${deployments.length} deployment(s) across ${accounts.length} account(s)`,
  );
}
