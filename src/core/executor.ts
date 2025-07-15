import { $ } from "zx";
import type { Duration } from "zx";

interface CdkCommandOptions {
  verbose?: boolean;
  parameters?: string[];
  includeDeps?: boolean;
  context?: string[];
  executeChangeset?: boolean;
  cdkOptions?: string;
  signal?: AbortSignal;
  cloudAssemblyPath?: string | null;
}

export async function runCdkCommand(
  region: string,
  stackName: string,
  command: string,
  profile: string,
  options: CdkCommandOptions = {},
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

  const cdkArgs = [command, "--profile", profile];

  if (process.env.CDK_CLI_NOTICES !== "true") {
    cdkArgs.push("--no-notices");
  }

  if (verbose) {
    cdkArgs.push("-v");
  }

  if (!cloudAssemblyPath) {
    throw new Error("Cloud assembly path is required");
  }
  cdkArgs.push("--app", cloudAssemblyPath);

  context.forEach((ctx: string) => {
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

  parameters.forEach((param: string) => {
    if (includeDeps && !param.includes(":")) {
      cdkArgs.push("--parameters", `${stackName}:${param}`);
    } else {
      cdkArgs.push("--parameters", param);
    }
  });

  if (cdkOptions) {
    const additionalArgs = cdkOptions.split(/\s+/).filter((arg: string) => arg);
    cdkArgs.push(...additionalArgs);
  }

  cdkArgs.push(stackName);

  process.env.AWS_REGION = region;
  process.env.FORCE_COLOR = "1";

  const cdkProcess = $({
    signal,
    quiet: ["diff", "deploy"].includes(command) ? false : !verbose,
  })`cdk ${cdkArgs}`;

  return process.env.CDK_TIMEOUT
    ? await cdkProcess.timeout(process.env.CDK_TIMEOUT as Duration)
    : await cdkProcess;
}
