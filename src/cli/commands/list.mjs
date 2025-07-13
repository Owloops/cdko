/**
 * List stacks command
 * Shows deployed CloudFormation stacks across regions
 */

import { $, quote } from 'zx';
import { logger } from '../../utils/logger.mjs';

export async function listStacks(region, profile, primaryRegion) {
  try {
    const stacks = await $({
      env: { ...process.env, ...(region === primaryRegion ? {} : { AWS_REGION: region }) },
    })`aws cloudformation list-stacks --profile ${quote(
      profile
    )} --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query 'StackSummaries[*].StackName' --output text`
      .quiet()
      .lines();
    return { success: true, stacks: stacks.filter((s) => s.trim()) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function executeListCommand(args, regions, primaryRegion) {
  console.log();
  console.log('Listing CDK Stacks');
  console.log(`${logger.dim('Profile:')} ${args.profile}`);
  console.log(`${logger.dim('Regions:')} ${regions.join(' ')}`);
  console.log();

  const failedRegions = [];
  
  for (const region of regions) {
    console.log();
    console.log(`${logger.region(region)}:`);
    const result = await listStacks(region, args.profile, primaryRegion);
    
    if (!result.success) {
      logger.warn(`  Failed to list stacks: ${result.error}`);
      failedRegions.push(region);
      continue;
    }
    
    if (result.stacks.length === 0) {
      console.log('  No stacks found');
    } else {
      result.stacks.forEach((stack) => console.log(`  ${stack}`));
    }
  }
  
  if (failedRegions.length > 0) {
    console.log();
    logger.warn(`Failed to list stacks in ${failedRegions.length} region(s): ${failedRegions.join(', ')}`);
  }
}