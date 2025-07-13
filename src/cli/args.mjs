/**
 * CLI argument parsing and validation
 * Maintains backward compatibility with original multi-region.mjs
 */

import { argv } from 'zx';
import { logger } from '../utils/logger.mjs';

export function parseArgs() {
  const args = {
    profile: argv.p || argv.profile || '',
    environment: argv.e || argv.environment || '',
    stackPattern: argv.s || argv.stack || '',
    regions: argv.r || argv.regions || 'all',
    mode: argv.m || argv.mode || 'changeset',
    sequential: argv.x || argv.sequential || false,
    dryRun: argv.d || argv['dry-run'] || false,
    list: argv.l || argv.list || false,
    help: argv.h || argv.help || false,
    verbose: argv.v || argv.verbose || false,
    includeDeps: argv.i || argv['include-deps'] || false,
    parameters: [],
    context: [],
    cdkOptions: argv['cdk-opts'] || '',
    force: argv.force || false,
    progress: argv.progress || 'events',
    noColor: argv['no-color'] || false,
    quiet: argv.quiet || false,
    outputsFile: argv['outputs-file'] || ''
  };

  const paramArray = argv.P || argv.parameters || argv.parameter || [];
  args.parameters = Array.isArray(paramArray) ? paramArray : [paramArray];
  args.parameters = args.parameters.filter(p => p);

  const contextArray = argv.c || argv.context || [];
  args.context = Array.isArray(contextArray) ? contextArray : [contextArray];
  args.context = args.context.filter(c => c);

  return args;
}

export function validateArgs(args) {
  if (!args.profile) {
    logger.error('AWS profile is required');
    printUsage();
    process.exit(1);
  }

  if (args.list) {
    return;
  }

  if (!args.environment) {
    logger.error('Environment is required');
    printUsage();
    process.exit(1);
  }

  if (!args.stackPattern) {
    logger.error('Stack pattern is required');
    printUsage();
    process.exit(1);
  }

  const validModes = ['diff', 'synth', 'changeset', 'execute', 'destroy'];
  if (!validModes.includes(args.mode)) {
    logger.error(`Mode must be one of: ${validModes.join(', ')}`);
    process.exit(1);
  }

  if (args.mode === 'destroy' && !args.dryRun && !args.force) {
    logger.warn('Destroy mode requires --force flag for safety');
    process.exit(1);
  }
}

export function printUsage() {
  const scriptName = 'cdko';
  console.log(`
Multi-Region CDK Deployment Tool

Deploy CDK stacks across multiple AWS regions with enhanced control.

Usage: ${scriptName} [OPTIONS]

Options:
  -p, --profile PROFILE      AWS profile to use (required)
  -e, --environment ENV      Environment name (required)
  -s, --stack PATTERN        Stack name pattern to deploy (required)
  -r, --regions REGIONS      Comma-separated regions or 'all' (default: from config)
  -m, --mode MODE           Deployment mode: diff, synth, changeset, execute, destroy
                            (default: changeset)
  -x, --sequential          Deploy regions sequentially (default: parallel)
  -d, --dry-run            Show what would be deployed without executing
  -l, --list               List all deployed stacks in specified regions
  -v, --verbose            Enable verbose CDK output
  -i, --include-deps        Include dependency stacks
  -P, --parameters KEY=VAL  CDK parameters (can be used multiple times)
                            Format: KEY=VALUE or STACK:KEY=VALUE
  -c, --context KEY=VAL     CDK context values (can be used multiple times)
  --force                   Force destructive operations
  --progress MODE           Progress display: events or bar (default: events)
  --no-color               Disable colored output
  --quiet                  Suppress non-error output
  --outputs-file FILE      Write stack outputs to file
  --cdk-opts "OPTIONS"      Additional CDK options (in quotes)
  -h, --help               Show this help message

Examples:
  ${scriptName} -p MyProfile -e Production -s MyStack
  ${scriptName} -p MyProfile -e Production -s MyStack -r us-east-1,eu-west-1
  ${scriptName} -p MyProfile -e Production -s MyStack -m execute
  ${scriptName} -p MyProfile -l
  ${scriptName} -p MyProfile -e Production -s MyStack -P MinSize=2 -P MaxSize=10
  ${scriptName} -p MyProfile -e Production -s MyStack -m destroy --force

Configuration:
  Create a .cdko.json file in your project root:
  {
    "regions": ["us-east-1", "eu-west-1"],
    "primaryRegion": "us-east-1",
    "regionSuffixes": {
      "us-east-1": "",
      "eu-west-1": "-EU"
    },
    "buildCommand": "npm run build",
    "deployTimeout": "30m",     // Timeout for deploy commands (default: 30m)
    "defaultTimeout": "10m"     // Timeout for other commands (default: 10m)
  }
`);
}