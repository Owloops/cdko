import { argv } from "zx";
import { logger } from "../utils/logger.ts";

export interface ParsedArgs {
  _: string[];
  profile: string;
  stackPattern: string;
  regions: string;
  mode: string;
  sequential: boolean;
  dryRun: boolean;
  help: boolean;
  verbose: boolean;
  includeDeps: boolean;
  parameters: string[];
  context: string[];
  cdkOptions: string;
}

export function parseArgs(): ParsedArgs {
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

  args.parameters = Array.isArray(argv.parameters)
    ? argv.parameters
    : argv.parameters
      ? [argv.parameters]
      : [];
  args.context = Array.isArray(argv.context)
    ? argv.context
    : argv.context
      ? [argv.context]
      : [];

  const cdkOptsIndex = process.argv.findIndex((arg) => arg === "--cdk-opts");
  if (cdkOptsIndex !== -1 && cdkOptsIndex + 1 < process.argv.length) {
    args.cdkOptions = process.argv[cdkOptsIndex + 1];
  }

  return args;
}

export function validateArgs(args: ParsedArgs) {
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
      `Mode must be one of: ${validModes.join(", ")}. Provided: ${args.mode}`,
    );
    process.exit(1);
  }

  for (const param of args.parameters) {
    if (!param.includes("=")) {
      logger.error(
        `Invalid parameter format: ${param}. Use KEY=VALUE or STACK:KEY=VALUE`,
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
Multi-Account & Multi-Region CDK Orchestrator

Deploy CDK stacks across multiple AWS accounts and regions with enhanced control.

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
  ${scriptName} init                                        # Initialize configuration
  ${scriptName} -p "dev,prod" -s MyStack                   # Multi-account deployment  
  ${scriptName} -p MyProfile -s MyStack -r us-east-1,eu-west-1  # Multi-region
  ${scriptName} -p MyProfile -s "Production-*" -m diff     # Preview changes

Run '${scriptName} init' to auto-detect CDK stacks and create .cdko.json configuration.
`);
}
