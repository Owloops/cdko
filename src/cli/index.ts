import { fs, path } from "zx";
import { logger } from "../utils/logger";
import { checkPrerequisites } from "../utils/prerequisites";
import { StackManager } from "../core/stack-manager";
import { deployToAllRegions } from "../core/orchestrator";
import { parseArgs, validateArgs, printUsage } from "./args";
import type { ParsedArgs } from "./args";
import { init } from "./commands/init";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

interface DeploymentResult {
  success: boolean;
  region: string;
  stackName: string;
  duration?: string;
  error?: any;
}

const controller = new AbortController();

process.on("SIGINT", () => {
  console.log("\n\nCancelling deployments...");
  controller.abort();
  process.exit(130);
});

async function getVersion(): Promise<string> {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packagePath = join(__dirname, "..", "..", "package.json");
    const packageJson = JSON.parse(await fs.readFile(packagePath, "utf-8"));

    const version = packageJson.version || "unknown";
    const buildInfo = [];

    if (process.env.GITHUB_SHA) {
      buildInfo.push(`commit: ${process.env.GITHUB_SHA.substring(0, 7)}`);
    }

    if (process.env.BUILD_DATE) {
      buildInfo.push(`built: ${process.env.BUILD_DATE}`);
    }

    const buildString =
      buildInfo.length > 0 ? ` (${buildInfo.join(", ")})` : "";
    return `cdko version ${version}${buildString}`;
  } catch {
    return "cdko version unknown";
  }
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (args.version) {
    const version = await getVersion();
    console.log(version);
    process.exit(0);
  }

  if (args._.includes("init")) {
    await init();
    process.exit(0);
  }

  validateArgs(args);

  const stackManager = new StackManager();
  const config = await stackManager.loadConfig();

  if (config.cdkTimeout) {
    process.env.CDK_TIMEOUT = config.cdkTimeout;
  }

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
  logger.info(
    modeMessages[args.mode as keyof typeof modeMessages] || "Processing stacks",
  );

  const results = await deployToAllRegions(regions, args, controller.signal);

  displayResults(args, results);
}

function displayHeader(args: ParsedArgs, regions: string[]) {
  console.log(`
Multi-Region CDK Deployment
${Object.entries({
  Profile: args.profile,
  Stack: args.stackPattern,
  Regions: regions.join(" "),
  Mode: args.mode,
  Deployment: args.sequential ? "sequential" : "parallel",
  Dependencies: args.includeDeps ? "included" : "excluded",
  Timeout: process.env.CDK_TIMEOUT || "not set",
})
  .map(([k, v]) => `${logger.dim(k + ":")} ${v}`)
  .join("\n")}`);
}

function displayResults(args: ParsedArgs, results: DeploymentResult[]) {
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
      .reduce((sum, r) => sum + parseFloat(r.duration!), 0);
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
