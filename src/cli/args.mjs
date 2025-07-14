import { argv } from "zx";
import { logger } from "../utils/logger.mjs";

export function parseArgs() {
  const args = {
    _: argv._ || [],
    profile: argv.p || argv.profile || "",
    stackPattern: argv.s || argv.stack || "",
    regions: argv.r || argv.region || "all",
    mode: argv.m || argv.mode || "changeset",
    sequential: argv.x || argv.sequential || false,
    dryRun: argv.d || argv["dry-run"] || false,
    help: argv.h || argv.help || false,
    verbose: argv.v || argv.verbose || false,
    includeDeps: argv["include-deps"] || false,
    parameters: argv.parameters || [],
    context: argv.context || [],
    cdkOptions: argv["cdk-opts"] || "",
  };

  const paramArray = argv.parameters || [];
  args.parameters = Array.isArray(paramArray) ? paramArray : [paramArray];
  args.parameters = args.parameters.filter((p) => p && typeof p === "string");

  const contextArray = argv.context || [];
  args.context = Array.isArray(contextArray) ? contextArray : [contextArray];
  args.context = args.context.filter((c) => c && typeof c === "string");

  const cdkOptsIndex = process.argv.findIndex((arg) => arg === "--cdk-opts");
  if (cdkOptsIndex !== -1 && cdkOptsIndex + 1 < process.argv.length) {
    args.cdkOptions = process.argv[cdkOptsIndex + 1];
  }

  return args;
}

export function validateArgs(args) {
  if (!args.profile || args.profile.trim() === "") {
    logger.error("AWS profile is required. Use -p or --profile to specify.");
    printUsage();
    process.exit(1);
  }

  if (!args.stackPattern || args.stackPattern.trim() === "") {
    logger.error("Stack pattern is required. Use -s or --stack to specify.");
    printUsage();
    process.exit(1);
  }

  const validModes = ["diff", "changeset", "execute"];
  if (!validModes.includes(args.mode)) {
    logger.error(
      `Mode must be one of: ${validModes.join(", ")}. Provided: ${args.mode}`
    );
    process.exit(1);
  }

  for (const param of args.parameters) {
    if (!param.includes("=")) {
      logger.error(
        `Invalid parameter format: ${param}. Use KEY=VALUE or STACK:KEY=VALUE`
      );
      process.exit(1);
    }
  }

  for (const ctx of args.context) {
    if (!ctx.includes("=")) {
      logger.error(`Invalid context format: ${ctx}. Use KEY=VALUE`);
      process.exit(1);
    }
  }
}

export function printUsage() {
  const scriptName = "cdko";
  console.log(`
Multi-Region CDK Deployment Tool

Deploy CDK stacks across multiple AWS regions with enhanced control.

Usage: 
  ${scriptName} init                   Initialize CDKO configuration
  ${scriptName} [OPTIONS]              Deploy stacks

Options:
  -p, --profile PROFILE      AWS profile to use (required)
                             Supports patterns: dev-*, or comma-separated: dev,prod,staging
  -s, --stack PATTERN        Stack name pattern to deploy (required)
  -r, --region REGION        Comma-separated regions or 'all' (default: from config)
  -m, --mode MODE           Deployment mode: diff, changeset, execute
                            (default: changeset)
  -x, --sequential          Deploy regions sequentially (default: parallel)
  -d, --dry-run            Show what would be deployed without executing
  -v, --verbose            Enable verbose CDK output
  --include-deps            Include dependency stacks (default: exclude dependencies)
  --parameters KEY=VAL      CDK parameters (can be used multiple times)
                            Format: KEY=VALUE or STACK:KEY=VALUE
  --context KEY=VAL         CDK context values (can be used multiple times)
  --cdk-opts "OPTIONS"      Pass CDK command flags directly (for diff/deploy/global flags)
                            Example: --cdk-opts "--force --quiet --outputs-file out.json"
  -h, --help               Show this help message

Examples:
  ${scriptName} init                                                     # Initialize CDKO configuration
  ${scriptName} -p MyProfile -s Production-MyStack                      # Deploy to all regions
  ${scriptName} -p MyProfile -s Production-MyStack -r us-east-1,eu-west-1
  ${scriptName} -p dev-profile,prod-profile -s MyStack                  # Multi-account deployment
  ${scriptName} -p "dev-*" -s MyStack                                   # Pattern matching profiles
  ${scriptName} -p MyProfile -s Production-MyStack -m execute
  ${scriptName} -p MyProfile -s Production-MyStack --parameters MinSize=2 --parameters MaxSize=10
  ${scriptName} -p MyProfile -s Production-MyStack --cdk-opts "--force --quiet"

Stack Pattern Matching:
  Use wildcards (*) to match multiple stacks:
  ${scriptName} -p MyProfile -s "Production-App*"        # Matches Production-App, Production-App-Web, etc.
  ${scriptName} -p MyProfile -s "Production-*"          # Matches all Production stacks
  ${scriptName} -p MyProfile -s "*"                     # Matches all stacks
  ${scriptName} -p MyProfile -s "Production-App,Staging-Cache"  # Multiple patterns

Configuration:
  Run '${scriptName} init' to auto-detect your CDK stacks and create/update .cdko.json
  
  CDKO uses stack detection to map your CDK construct IDs to deployments:
  - Automatically handles region-specific construct names
  - Supports environment-agnostic and region-specific stacks
  - Falls back to traditional naming if no configuration exists
`);
}
