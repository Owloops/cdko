/**
 * CDK command executor
 * Builds and executes CDK commands with proper configuration
 */

import { $, quote } from "zx";

export async function runCdkCommand(
  region,
  stackName,
  command,
  profile,
  options = {}
) {
  const {
    verbose = false,
    parameters = [],
    includeDeps = false,
    context = [],
    executeChangeset = false,
    cdkOptions = "",
    signal,
    cloudAssemblyPath = null,
  } = options;

  const cdkArgs = [command, "--profile", quote(profile)];
  
  if (process.env.CDK_CLI_NOTICES !== "true") {
    cdkArgs.push("--no-notices");
  }

  if (verbose) {
    cdkArgs.push("-v");
  }

  if (!cloudAssemblyPath) {
    throw new Error("Cloud assembly path is required");
  }
  cdkArgs.push("--app", quote(cloudAssemblyPath));

  context.forEach((ctx) => {
    cdkArgs.push("--context", ctx);
  });

  if (command === "deploy") {
    if (!includeDeps) cdkArgs.push("--exclusively");
    if (!executeChangeset) cdkArgs.push("--no-execute");
    cdkArgs.push("--require-approval=never");
  }

  parameters.forEach((param) => {
    if (includeDeps && !param.includes(":")) {
      cdkArgs.push("--parameters", `${stackName}:${param}`);
    } else {
      cdkArgs.push("--parameters", param);
    }
  });

  if (cdkOptions) {
    const additionalArgs = cdkOptions.split(/\s+/).filter((arg) => arg);
    cdkArgs.push(...additionalArgs);
  }

  cdkArgs.push(quote(stackName));

  const timeout = process.env.CDK_TIMEOUT || "30m";

  return await $({
    env: {
      ...process.env,
      AWS_REGION: region,
    },
    signal,
    timeout,
    quiet: ["diff"].includes(command) ? false : !verbose,
  })`cdk ${cdkArgs}`;
}
