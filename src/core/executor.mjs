import { $, quote } from "zx";

/**
 * Execute a CDK command with proper configuration and error handling
 * @param {string} region - AWS region for deployment
 * @param {string} stackName - Name of the CDK stack/construct
 * @param {string} command - CDK command to run (deploy, diff, etc.)
 * @param {string} profile - AWS profile to use
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.verbose] - Enable verbose CDK output
 * @param {string[]} [options.parameters] - CDK parameters array
 * @param {boolean} [options.includeDeps] - Include dependency stacks
 * @param {string[]} [options.context] - CDK context values
 * @param {boolean} [options.executeChangeset] - Execute changesets immediately
 * @param {string} [options.cdkOptions] - Additional CDK CLI options
 * @param {AbortSignal} [options.signal] - Abort signal for cancellation
 * @param {string} options.cloudAssemblyPath - Path to cloud assembly (required)
 * @returns {Promise<void>} Resolves when command completes successfully
 * @throws {Error} When CDK command fails or is aborted
 */
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

    if (executeChangeset) {
      cdkArgs.push("--progress", "events");
    }
  }

  if (command === "diff") {
    if (!includeDeps) cdkArgs.push("--exclusively");
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
    quiet: ["diff", "deploy"].includes(command) ? false : !verbose,
  })`cdk ${cdkArgs}`;
}
