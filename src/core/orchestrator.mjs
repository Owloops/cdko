/**
 * Deployment orchestrator
 * Manages deployment across regions in parallel or sequential mode
 */

import { logger } from '../utils/logger.mjs';
import { runCdkCommand } from './executor.mjs';
import { buildStackName } from './config.mjs';

export async function deployToRegion(region, args, config, signal) {
  const stackName = buildStackName(region, args.environment, args.stackPattern, config);

  console.log();
  console.log(`${logger.region(region)} → ${logger.stack(stackName)}`);

  if (args.dryRun) {
    logger.info(`Would deploy: ${stackName} to ${region}`);
    return { success: true, region };
  }

  const startTime = Date.now();

  try {
    const executorOptions = {
      ...args,
      primaryRegion: config.primaryRegion || 'us-east-1',
      regionSuffixes: config.regionSuffixes || {},
      signal
    };

    switch (args.mode) {
      case 'diff':
        await runCdkCommand(region, stackName, 'diff', args.profile, executorOptions);
        break;

      case 'changeset':
        logger.info(`Creating changeset for ${stackName}`);
        await runCdkCommand(region, stackName, 'deploy', args.profile, executorOptions);
        logger.success('Changeset created');
        break;

      case 'synth':
        logger.info(`Synthesizing ${stackName}`);
        await runCdkCommand(region, stackName, 'synth', args.profile, executorOptions);
        logger.success('Synthesis complete');
        break;

      case 'execute':
        logger.info(`Deploying ${stackName}`);
        const executeOptions = { ...executorOptions, executeChangeset: true };
        await runCdkCommand(region, stackName, 'deploy', args.profile, executeOptions);
        logger.success(`Deployed ${stackName}`);
        break;
        
      case 'destroy':
        if (!args.force) {
          logger.warn(`Would destroy ${stackName} in ${region}`);
          logger.info('Use --force flag to actually destroy stacks');
        } else {
          logger.info(`Destroying ${stackName}`);
          await runCdkCommand(region, stackName, 'destroy', args.profile, executorOptions);
          logger.success(`Destroyed ${stackName}`);
        }
        break;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(`Completed in ${duration}s`);
    return { success: true, region, duration };
  } catch (e) {
    logger.error(`Failed to deploy ${stackName}`);
    return { success: false, region, error: e };
  }
}

export async function deployToAllRegions(regions, args, config, signal) {
  const results = [];
  
  if (args.sequential) {
    for (const region of regions) {
      results.push(await deployToRegion(region, args, config, signal));
    }
  } else {
    logger.info(`Processing ${regions.length} regions in parallel...`);

    const deploymentPromises = regions.map((region) =>
      deployToRegion(region, args, config, signal).then(
        (result) => ({ ...result, status: 'fulfilled' }),
        (error) => ({ region, success: false, error, status: 'rejected' })
      )
    );

    const parallelResults = await Promise.all(deploymentPromises);
    results.push(...parallelResults);

    console.log();
    results.forEach((result) => {
      if (result.success) {
        logger.success(`${result.region}: Completed successfully`);
      } else {
        const errorMsg = result.error?.message || result.error?.stderr || result.error?.stdout || 'Unknown error';
        
        const lines = errorMsg.split('\n').filter(line => line.trim());
        const meaningfulError = lines.find(line => 
          line.includes('No stacks match') ||
          line.includes('already exists') ||
          line.includes('AccessDenied') ||
          line.includes('is not authorized') ||
          line.includes('CloudFormation error') ||
          line.includes('Error:') ||
          line.includes('failed:')
        ) || lines[0] || 'Check output above for details';
        
        logger.error(`${result.region}: ${meaningfulError.trim()}`);
      }
    });
  }

  return results;
}