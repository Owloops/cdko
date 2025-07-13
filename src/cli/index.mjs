/**
 * Main CLI entry point
 * Orchestrates the multi-region CDK deployment process
 */

import { $, fs, path, spinner } from "zx";
import { logger } from "../utils/logger.mjs";
import { checkPrerequisites } from "../utils/prerequisites.mjs";
import { loadConfig, getRegions, getBuildCommand } from "../core/config.mjs";
import { deployToAllRegions } from "../core/orchestrator.mjs";
import { parseArgs, validateArgs, printUsage } from "./args.mjs";
import { init } from "./commands/init.mjs";

const controller = new AbortController();

process.on("SIGINT", () => {
  console.log("\n\nCancelling deployments...");
  controller.abort();
  process.exit(130);
});

async function main() {
  const args = parseArgs();

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (args._.includes("init")) {
    await init();
    process.exit(0);
  }

  validateArgs(args);

  const config = await loadConfig();

  const cdkTimeout = config.cdkTimeout || "30m";
  process.env.CDK_TIMEOUT = cdkTimeout;

  const regions = getRegions(config, args.regions);

  displayHeader(args, regions);

  if (args.dryRun) {
    logger.warn("DRY RUN MODE - No actual deployments will occur");
  }

  console.log();
  await checkPrerequisites();

  const projectRoot = process.cwd();
  if (!(await fs.exists(path.join(projectRoot, "package.json")))) {
    logger.error("package.json not found. Are you in the correct directory?");
    process.exit(1);
  }

  console.log();
  const buildCommand = getBuildCommand(config);
  if (!args.dryRun) {
    await spinner("Building project...", async () => {
      const [cmd, ...cmdArgs] = buildCommand.split(" ");
      await $`${cmd} ${cmdArgs}`.quiet();
    });
  } else if (args.dryRun) {
    logger.info(`Would run: ${buildCommand}`);
  }

  console.log();
  const modeMessages = {
    diff: "Showing differences",
    changeset: "Creating changesets",
    execute: "Deploying stacks",
  };
  logger.info(modeMessages[args.mode] || "Processing stacks");

  const results = await deployToAllRegions(
    regions,
    args,
    controller.signal
  );

  displayResults(args, results);
}

function displayHeader(args, regions) {
  console.log(`
Multi-Region CDK Deployment
${Object.entries({
  Profile: args.profile,
  Stack: args.stackPattern,
  Regions: regions.join(" "),
  Mode: args.mode,
  Deployment: args.sequential ? "sequential" : "parallel",
  Dependencies: args.includeDeps ? "included" : "excluded",
})
  .map(([k, v]) => `${logger.dim(k + ":")} ${v}`)
  .join("\n")}`);
}

function displayResults(args, results) {
  const failedRegions = results.filter((r) => !r.success);

  if (failedRegions.length > 0) {
    console.log();
    logger.error(`${failedRegions.length} region(s) failed`);
    process.exit(1);
  }

  console.log();

  if (args.dryRun) {
    logger.success("Dry run completed - no actual changes made");
  } else if (args.mode === "changeset") {
    logger.success("Changesets created for review in CloudFormation console");
    logger.info("Execute changesets manually after review");
  } else if (args.mode === "execute") {
    const totalDuration = results
      .filter((r) => r.duration)
      .reduce((sum, r) => sum + parseFloat(r.duration), 0);
    logger.success(`All deployments completed in ${totalDuration.toFixed(1)}s`);
  } else {
    logger.success("Differences shown for all regions");
  }
}

main().catch((err) => {
  logger.error(`Unexpected error: ${err.message}`);
  if (process.env.DEBUG) {
    console.error(err);
  }
  process.exit(1);
});
