/**
 * Deployment orchestrator v2
 * Manages deployment across regions using stack detection
 */

import { logger } from "../utils/logger.mjs";
import { runCdkCommand } from "./executor.mjs";
import { StackDetector } from "./stack-detector.mjs";
import { resolveDeployments } from "./stack-matcher.mjs";
import { CloudAssemblyManager } from "./cloud-assembly.mjs";

/**
 * Deploy a specific stack to a specific region
 */
export async function deployStack(
  deployment,
  args,
  signal,
  cloudAssemblyPath = null
) {
  const { region, constructId, stackName } = deployment;

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
          args.profile,
          executorOptions
        );
        break;

      case "changeset":
        logger.info(`Creating changeset for ${stackName}`);
        await runCdkCommand(
          region,
          constructId,
          "deploy",
          args.profile,
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
          args.profile,
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
 */
export async function deployToAllRegions(regions, args, signal) {
  const detector = new StackDetector();
  const stackConfig = await detector.loadConfig();

  let deployments = [];

  if (stackConfig) {
    deployments = resolveDeployments(args.stackPattern, stackConfig, regions);

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
      });
    }
  }

  const cloudAssembly = new CloudAssemblyManager({});
  let cloudAssemblyPath = null;

  try {
    cloudAssemblyPath = await cloudAssembly.synthesize({
      stacks: args.stackPattern,
      profile: args.profile,
      environment: args.environment,
    });
  } catch (error) {
    logger.error("Failed to synthesize cloud assembly:", error.message);
    throw error;
  }

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

  const results = [];

  if (args.sequential) {
    for (const deployment of deployments) {
      results.push(
        await deployStack(deployment, args, signal, cloudAssemblyPath)
      );
    }
  } else {
    logger.info(
      `Processing ${deployments.length} deployment(s) in parallel...`
    );

    const deploymentPromises = deployments.map((deployment) =>
      deployStack(deployment, args, signal, cloudAssemblyPath).then(
        (result) => ({ ...result, status: "fulfilled" }),
        (error) => ({
          region: deployment.region,
          stackName: deployment.stackName,
          success: false,
          error,
          status: "rejected",
        })
      )
    );

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
 * Legacy function for backward compatibility
 */
export async function deployToRegion(region, args, signal) {
  const stackName = args.stackPattern;
  const deployment = {
    region,
    constructId: stackName,
    stackName,
  };
  return deployStack(deployment, args, signal);
}
