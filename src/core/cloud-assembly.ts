import { $ } from "zx";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger.ts";

interface SynthesizeOptions {
  stacks?: string;
  profile?: string;
  environment?: string;
  outputDir?: string;
}

export class CloudAssemblyManager {
  private cloudAssemblyPath: string | null;

  constructor() {
    this.cloudAssemblyPath = null;
  }

  getCloudAssemblyPath(): string {
    return join(process.cwd(), "cdk.out");
  }

  async synthesize(options: SynthesizeOptions = {}): Promise<string> {
    const { stacks = "*", profile, environment, outputDir } = options;
    const cloudAssemblyPath = outputDir
      ? join(process.cwd(), outputDir)
      : this.getCloudAssemblyPath();

    try {
      if (existsSync(cloudAssemblyPath)) {
        logger.info(`Cleaning existing cloud assembly at ${cloudAssemblyPath}`);
        rmSync(cloudAssemblyPath, { recursive: true, force: true });
      }

      mkdirSync(cloudAssemblyPath, { recursive: true });

      logger.info("Synthesizing cloud assembly...");

      const cdkArgs = ["synth"];

      if (process.env.CDK_CLI_NOTICES !== "true") {
        cdkArgs.push("--no-notices");
      }

      if (stacks !== "*") {
        cdkArgs.push(stacks);
      }

      cdkArgs.push("--output", cloudAssemblyPath);

      if (profile) {
        cdkArgs.push("--profile", profile);
      }

      if (environment) {
        cdkArgs.push("--context", `environment=${environment}`);
      }

      const result = await $({ quiet: true })`cdk ${cdkArgs}`;

      if (result.exitCode === 0) {
        logger.success(`Cloud assembly synthesized to ${cloudAssemblyPath}`);
        this.cloudAssemblyPath = cloudAssemblyPath;
        return cloudAssemblyPath;
      } else {
        throw new Error(`CDK synth failed with exit code ${result.exitCode}`);
      }
    } catch (error) {
      logger.error("Failed to synthesize cloud assembly");
      if (error instanceof Error && "stderr" in error) {
        console.error((error as Error & { stderr: string }).stderr);
      }
      throw error;
    }
  }

  getCdkArgs(baseArgs: string[]): string[] {
    if (!this.cloudAssemblyPath || !existsSync(this.cloudAssemblyPath)) {
      throw new Error("Cloud assembly not available. Run synthesize() first.");
    }

    const args = [...baseArgs];
    const appIndex = args.indexOf("--app");

    if (appIndex !== -1) {
      args.splice(appIndex, 2);
    }

    args.push("--app", this.cloudAssemblyPath);

    return args;
  }

  isAvailable(): boolean {
    return !!this.cloudAssemblyPath && existsSync(this.cloudAssemblyPath);
  }
}
