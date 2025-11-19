import { $ } from "zx";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";

describe("CDKO CLI Integration Tests", () => {
  const cdkoPath = join(__dirname, "../../bin/cdko");

  beforeEach(() => {
    process.env.AWS_PROFILE = "test-profile";
    $.verbose = false;
  });

  afterEach(() => {
    if (existsSync(".cdko.json")) {
      unlinkSync(".cdko.json");
    }
  });

  test("Pattern matching finds Production stacks", async () => {
    const result =
      await $`${cdkoPath} -p test-profile -s "Production-*" --dry-run`;
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Production-*");
    expect(result.stdout).toContain(
      "DRY RUN MODE - No actual deployments will occur",
    );
  });

  test("Multi-region deployment planning", async () => {
    const result =
      await $`${cdkoPath} -p test-profile -s Production-App -r us-east-1,eu-west-1 --dry-run`;
    expect(result.stdout).toContain("us-east-1");
    expect(result.stdout).toContain("eu-west-1");
  });

  test("Config generation creates valid .cdko.json", async () => {
    const result = await $`${cdkoPath} init`;
    expect(result.exitCode).toBe(0);
    expect(existsSync(".cdko.json")).toBe(true);

    const config = JSON.parse(readFileSync(".cdko.json", "utf8"));
    expect(config.version).toBe("0.1");
    expect(config.stackGroups).toBeDefined();
    expect(typeof config.stackGroups).toBe("object");
  });

  test("Dry-run fails with non-existent stack patterns", async () => {
    try {
      await $`${cdkoPath} -p test-profile -s "NonExistent-*" --dry-run`;
      fail("Expected command to fail");
    } catch (error: unknown) {
      const processError = error as { exitCode: number; stderr: string };
      expect(processError.exitCode).not.toBe(0);
      expect(processError.stderr).toContain("No stacks match");
    }
  });

  test("Help command displays usage information", async () => {
    const result = await $`${cdkoPath} --help`;
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("Options:");
  });

  test("Version command displays version number", async () => {
    const result = await $`${cdkoPath} --version`;
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  test("Multiple region-specific stack variants", async () => {
    await $`${cdkoPath} init`;

    const result =
      await $`${cdkoPath} -p test-profile -s "Production-App*" --dry-run`;
    expect(result.stdout).toContain("Production-App");
    expect(result.exitCode).toBe(0);
  });

  test("Required parameters validation", async () => {
    await expect($`${cdkoPath} -s Production-App --dry-run`).rejects.toThrow();
    await expect($`${cdkoPath} -p test-profile --dry-run`).rejects.toThrow();
  });
});
