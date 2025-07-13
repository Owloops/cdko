/**
 * CDK command executor
 * Builds and executes CDK commands with proper configuration
 */

import { $, quote } from 'zx';
import { getRegionSuffix } from './config.mjs';

export async function runCdkCommand(region, stackName, command, profile, options = {}) {
  const { 
    verbose = false, 
    parameters = [], 
    includeDeps = false, 
    context = [],
    progress = 'events',
    force = false,
    noColor = false,
    quiet = false,
    outputsFile = '',
    executeChangeset = false,
    cdkOptions = '',
    primaryRegion,
    signal
  } = options;
  
  const cdkArgs = [command, '--profile', quote(profile)];
  
  if (verbose) {
    cdkArgs.push('-v');
  }
  
  if (noColor) {
    cdkArgs.push('--no-color');
  }
  
  if (quiet && (command === 'synth' || command === 'diff')) {
    cdkArgs.push('--quiet');
  }

  const outputDir = `cdk.out.${region}`;
  cdkArgs.push('--output', quote(outputDir));
  
  context.forEach(ctx => {
    cdkArgs.push('--context', ctx);
  });

  if (command === 'deploy') {
    if (!includeDeps) cdkArgs.push('--exclusively');
    if (!executeChangeset) cdkArgs.push('--no-execute');
    cdkArgs.push('--require-approval=never');
    if (force) cdkArgs.push('--force');
    if (progress === 'bar') cdkArgs.push('--progress', 'bar');
    if (outputsFile) cdkArgs.push('--outputs-file', quote(`${outputsFile}.${region}.json`));
  } else if (command === 'destroy') {
    if (!includeDeps) cdkArgs.push('--exclusively');
    if (force) cdkArgs.push('--force');
  }
  
  parameters.forEach(param => {
    if (includeDeps && !param.includes(':')) {
      const regionSuffix = getRegionSuffix(region, options.regionSuffixes || {});
      const baseStackName = regionSuffix && stackName.endsWith(regionSuffix) 
        ? stackName.slice(0, -regionSuffix.length)
        : stackName;
      cdkArgs.push('--parameters', `${baseStackName}:${param}`);
    } else {
      cdkArgs.push('--parameters', param);
    }
  });
  
  if (cdkOptions) {
    const additionalArgs = cdkOptions.split(/\s+/).filter(arg => arg);
    cdkArgs.push(...additionalArgs);
  }
  
  cdkArgs.push(quote(stackName));

  const shouldBeQuiet = quiet && command !== 'diff' && command !== 'synth';
  
  const timeout = command === 'deploy' 
    ? (process.env.CDK_DEPLOY_TIMEOUT || '30m')
    : (process.env.CDK_DEFAULT_TIMEOUT || '10m');
  
  return await $({
    env: { ...process.env, ...(region === primaryRegion ? {} : { AWS_REGION: region }) },
    signal,
    timeout,
    quiet: ['diff', 'synth'].includes(command) ? false : shouldBeQuiet || !verbose,
  })`cdk ${cdkArgs}`;
}