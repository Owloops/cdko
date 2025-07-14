import { fs, path } from "zx";
import { logger } from "../utils/logger.mjs";
import { checkPrerequisites } from "../utils/prerequisites.mjs";
import { StackManager } from "../core/stack-manager.mjs";
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

  const stackManager = new StackManager();
  const config = await stackManager.loadConfig();

  const cdkTimeout = config.cdkTimeout || "30m";
  process.env.CDK_TIMEOUT = cdkTimeout;

  const regions = stackManager.getRegions(config, args.regions);

  displayHeader(args, regions);

  if (args.dryRun) {
    logger.warn("DRY RUN MODE - No actual deployments will occur");
  }

  console.log();
  await checkPrerequisites();

  const projectRoot = process.cwd();
  if (!(await fs.exists(path.join(projectRoot, "cdk.json")))) {
    logger.error("No cdk.json found in current directory:");
    logger.error(`  ${projectRoot}`);
    logger.info("Make sure you're in a CDK project directory");
    logger.info("If this is a new CDK project, run: cdk init");
    process.exit(1);
  }

  console.log();
  const modeMessages = {
    diff: "Showing differences",
    changeset: "Creating changesets",
    execute: "Deploying stacks",
  };
  logger.info(modeMessages[args.mode] || "Processing stacks");

  const results = await deployToAllRegions(regions, args, controller.signal);

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
  console.log();
  logger.error("CDKO encountered an unexpected error:");
  logger.error(`  ${err.message}`);

  if (process.env.DEBUG) {
    console.log("\nStack trace:");
    console.error(err);
  } else {
    logger.info("Run with DEBUG=1 for detailed error information");
  }

  logger.info("If this issue persists, please report it at:");
  logger.info("  https://github.com/owloops/cdko/issues");

  process.exit(1);
});
