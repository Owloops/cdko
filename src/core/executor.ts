import { $ } from "zx";
import type { Duration } from "zx";

function filterOutput(output: string, command: string): string {
  const lines = output.split("\n");
  const filteredLines: string[] = [];
  let inStackSection = false;

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    if (line.startsWith("Stack ")) {
      inStackSection = true;
    }

    const shouldInclude =
      inStackSection ||
      line.includes("Resources") ||
      line.includes("[~]") ||
      line.includes("[-]") ||
      line.includes("[+]") ||
      lowerLine.includes("number of stacks") ||
      line.trim().startsWith("✨");

    if (command === "deploy") {
      const isProgress =
        (line.includes(" | ") &&
          (line.includes("CREATE_") ||
            line.includes("UPDATE_") ||
            line.includes("DELETE_") ||
            line.includes("ROLLBACK_") ||
            line.includes("REVIEW_IN_PROGRESS"))) ||
        line.includes(": deploying...") ||
        line.includes(": creating CloudFormation changeset...") ||
        line.includes("✅") ||
        lowerLine.includes("synthesis time") ||
        lowerLine.includes("deployment time") ||
        lowerLine.includes("total time");

      if (shouldInclude || isProgress) {
        filteredLines.push(line);
      }
    } else if (shouldInclude) {
      filteredLines.push(line);
    }
  }

  return filteredLines.join("\n").trim();
}

function extractStackArn(output: string): string | undefined {
  const cleanOutput = output.replace(
    new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"),
    "",
  );
  const stackArnMatch = cleanOutput.match(
    /Stack ARN:\s*\n?\s*(arn:aws:cloudformation:[^\s]*)/,
  );
  return stackArnMatch?.[1];
}

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

interface CdkCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  stackArn?: string;
}

function createRegionPrefix(
  deploymentProfile: string | undefined,
  region: string,
): string {
  return deploymentProfile ? `${deploymentProfile}/${region}` : region;
}

function prefixDiffLines(lines: string[], regionPrefix: string): string {
  return lines
    .map((line) => {
      if (line.startsWith("Stack ") || line.trim().startsWith("✨")) {
        return `[${regionPrefix}] ${line}`;
      }
      return line;
    })
    .join("\n");
}

function addRegionPrefixToOutput(data: Buffer, regionPrefix: string): void {
  const lines = data.toString().split("\n");
  lines.forEach((line: string) => {
    if (line.trim()) {
      const lowerLine = line.toLowerCase();

      if (
        line.includes(" | ") &&
        (line.includes("CREATE_") ||
          line.includes("UPDATE_") ||
          line.includes("DELETE_") ||
          line.includes("ROLLBACK_") ||
          line.includes("REVIEW_IN_PROGRESS"))
      ) {
        console.log(`[${regionPrefix}] ${line}`);
        return;
      }

      if (
        line.includes(": deploying...") ||
        line.includes(": creating CloudFormation changeset...") ||
        line.includes("✅")
      ) {
        console.log(`[${regionPrefix}] ${line}`);
        return;
      }

      if (
        lowerLine.includes("deployment time") ||
        lowerLine.includes("total time")
      ) {
        console.log(`[${regionPrefix}] ${line}`);
        return;
      }

      if (lowerLine.includes("synthesis time")) {
        return;
      }

      if (
        line.trim().startsWith("✨") &&
        !lowerLine.includes("synthesis time")
      ) {
        console.log(`[${regionPrefix}] ${line}`);
      }
    }
  });
}

export async function runCdkCommand(
  region: string,
  stackName: string,
  command: string,
  profile: string,
  options: CdkCommandOptions = {},
  accountId?: string,
  deploymentProfile?: string,
): Promise<CdkCommandResult> {
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

  if (command === "diff") {
    const regionPrefix = createRegionPrefix(deploymentProfile, region);

    try {
      const cdkProcess = $({ signal, quiet: true })`cdk ${cdkArgs}`;
      const result = process.env.CDK_TIMEOUT
        ? await cdkProcess.timeout(process.env.CDK_TIMEOUT as Duration)
        : await cdkProcess;

      const filteredOutput = filterOutput(
        result.stdout + "\n" + result.stderr,
        command,
      );
      if (filteredOutput.trim()) {
        console.log(prefixDiffLines(filteredOutput.split("\n"), regionPrefix));
      }

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    } catch (error) {
      if (error instanceof Error && "stdout" in error) {
        const filteredOutput = filterOutput((error as any).stdout, command);
        if (filteredOutput.trim()) {
          console.log(
            prefixDiffLines(filteredOutput.split("\n"), regionPrefix),
          );
        }
      }
      throw error;
    }
  }

  if (command === "deploy") {
    const regionPrefix = createRegionPrefix(deploymentProfile, region);
    const cdkProcess = $({ signal, quiet: true })`cdk ${cdkArgs}`;

    cdkProcess.stdout.on("data", (data) =>
      addRegionPrefixToOutput(data, regionPrefix),
    );
    cdkProcess.stderr.on("data", (data) =>
      addRegionPrefixToOutput(data, regionPrefix),
    );

    const result = process.env.CDK_TIMEOUT
      ? await cdkProcess.timeout(process.env.CDK_TIMEOUT as Duration)
      : await cdkProcess;

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      stackArn: extractStackArn(result.stdout + "\n" + result.stderr),
    };
  }

  const shouldQuiet = !verbose;

  const cdkProcess = $({
    signal,
    quiet: shouldQuiet,
  })`cdk ${cdkArgs}`;

  try {
    const result = process.env.CDK_TIMEOUT
      ? await cdkProcess.timeout(process.env.CDK_TIMEOUT as Duration)
      : await cdkProcess;

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  } catch (error) {
    if (shouldQuiet && error instanceof Error) {
      console.log(`\n--- CDK Error Details (${stackName}) ---`);
      try {
        const verboseProcess = $({
          signal,
          quiet: false,
        })`cdk ${cdkArgs}`;

        await (process.env.CDK_TIMEOUT
          ? verboseProcess.timeout(process.env.CDK_TIMEOUT as Duration)
          : verboseProcess);
      } catch {}
      console.log(`--- End CDK Error Details ---\n`);
    }
    throw error;
  }
}
