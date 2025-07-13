/**
 * Main CLI entry point
 * Orchestrates the multi-region CDK deployment process
 */

import { $, fs, path, spinner } from 'zx';
import { logger } from '../utils/logger.mjs';
import { checkPrerequisites } from '../utils/prerequisites.mjs';
import { loadConfig, getRegions, getPrimaryRegion, getBuildCommand } from '../core/config.mjs';
import { checkAwsProfile } from '../core/auth.mjs';
import { deployToAllRegions } from '../core/orchestrator.mjs';
import { parseArgs, validateArgs, printUsage } from './args.mjs';
import { executeListCommand } from './commands/list.mjs';

const controller = new AbortController();

process.on('SIGINT', () => {
  console.log('\n\nCancelling deployments...');
  controller.abort();
  process.exit(130);
});

async function main() {
  const args = parseArgs();
  
  if (args.help) {
    printUsage();
    process.exit(0);
  }

  validateArgs(args);
  
  const config = await loadConfig();
  const primaryRegion = getPrimaryRegion(config);
  
  const deployTimeout = config.deployTimeout || '30m';
  const defaultTimeout = config.defaultTimeout || '10m';
  
  process.env.CDK_DEPLOY_TIMEOUT = deployTimeout;
  process.env.CDK_DEFAULT_TIMEOUT = defaultTimeout;
  
  if (args.environment === 'Production') {
    process.env.CDK_DISABLE_VERSION_CHECK = 'true';
  }
  
  try {
    await checkAwsProfile(args.profile);
  } catch (error) {
    if (error.code === 'AUTH_ERROR') {
      logger.error(error.message);
      process.exit(1);
    }
    throw error;
  }
  
  if (args.list) {
    const regions = args.regions === 'all' 
      ? (config.regions || ['us-east-1']) 
      : args.regions.split(',').map(r => r.trim());
    await executeListCommand(args, regions, primaryRegion);
    return;
  }
  
  const regions = getRegions(config, args.regions);
  
  displayHeader(args, regions);
  
  if (args.dryRun) {
    logger.warn('DRY RUN MODE - No actual deployments will occur');
  }

  console.log();
  await checkPrerequisites();

  const projectRoot = process.cwd();
  if (!(await fs.exists(path.join(projectRoot, 'package.json')))) {
    logger.error('package.json not found. Are you in the correct directory?');
    process.exit(1);
  }

  console.log();
  const buildCommand = getBuildCommand(config);
  if (!args.dryRun && args.mode !== 'destroy') {
    await spinner('Building project...', async () => {
      const [cmd, ...cmdArgs] = buildCommand.split(' ');
      await $`${cmd} ${cmdArgs}`.quiet();
    });
  } else if (args.dryRun) {
    logger.info(`Would run: ${buildCommand}`);
  }

  console.log();
  const modeMessages = {
    diff: 'Showing differences',
    synth: 'Synthesizing templates',
    changeset: 'Creating changesets',
    execute: 'Deploying stacks',
    destroy: 'Destroying stacks'
  };
  logger.info(modeMessages[args.mode] || 'Processing stacks');

  const results = await deployToAllRegions(regions, args, config, controller.signal);
  
  displayResults(args, results);
}

function displayHeader(args, regions) {
  console.log(`
Multi-Region CDK Deployment
${Object.entries({
  Profile: args.profile,
  Environment: args.environment,
  Stack: args.stackPattern,
  Regions: regions.join(' '),
  Mode: args.mode,
  Deployment: args.sequential ? 'sequential' : 'parallel',
  Dependencies: args.includeDeps ? 'included' : 'excluded',
})
  .map(([k, v]) => `${logger.dim(k + ':')} ${v}`)
  .join('\n')}`);
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
    logger.success('Dry run completed - no actual changes made');
  } else if (args.mode === 'changeset') {
    logger.success('Changesets created for review in CloudFormation console');
    logger.info('Execute changesets manually after review');
  } else if (args.mode === 'execute') {
    const totalDuration = results
      .filter((r) => r.duration)
      .reduce((sum, r) => sum + parseFloat(r.duration), 0);
    logger.success(`All deployments completed in ${totalDuration.toFixed(1)}s`);
  } else if (args.mode === 'synth') {
    logger.success('Synthesis completed for all regions');
  } else if (args.mode === 'destroy') {
    if (args.force) {
      logger.success('All stacks destroyed successfully');
    } else {
      logger.success('Destroy preview completed - use --force to actually destroy');
    }
  } else {
    logger.success('Differences shown for all regions');
  }
}

main().catch((err) => {
  logger.error(`Unexpected error: ${err.message}`);
  if (process.env.DEBUG) {
    console.error(err);
  }
  process.exit(1);
});