import { $ } from "zx";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger";

interface SynthesizeOptions {
  profile?: string;
  environment?: string;
  outputDir?: string;
  stacks?: string[];
  exclusively?: boolean;
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
    const {
      profile,
      environment,
      outputDir,
      stacks,
      exclusively = true,
    } = options;
    const cloudAssemblyPath = outputDir
      ? join(process.cwd(), outputDir)
      : this.getCloudAssemblyPath();

    try {
      if (existsSync(cloudAssemblyPath)) {
        rmSync(cloudAssemblyPath, { recursive: true, force: true });
      }

      mkdirSync(cloudAssemblyPath, { recursive: true });

      const cdkArgs = ["synth"];

      if (stacks && stacks.length > 0) {
        cdkArgs.push(...stacks);
      }

      if (exclusively && stacks && stacks.length > 0) {
        cdkArgs.push("--exclusively");
      }

      if (process.env.CDK_CLI_NOTICES !== "true") {
        cdkArgs.push("--no-notices");
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
