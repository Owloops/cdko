#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CdkoTestPatternsStack } from "../lib/cdko-test-patterns-stack";

const app = new cdk.App();

// Pattern 1: Environment-agnostic stacks (unknown-account/unknown-region)
new CdkoTestPatternsStack(app, "Production-API");
new CdkoTestPatternsStack(app, "Production-Database");
new CdkoTestPatternsStack(app, "Production-Frontend");

// Pattern 2: Region-specific stacks (unknown-account/specific-region)
new CdkoTestPatternsStack(app, "Production-Cache", {
  env: { region: "us-east-1" },
});

new CdkoTestPatternsStack(app, "Production-Cache-EU", {
  env: { region: "eu-west-1" },
  stackName: "Production-Cache", // Same CloudFormation name, different construct ID
});

// Pattern 3: Account-specific stacks (specific-account/unknown-region)
new CdkoTestPatternsStack(app, "Production-Audit", {
  env: { account: "123456789012" },
});

// Pattern 4: Fully specified stacks (specific-account/specific-region)
new CdkoTestPatternsStack(app, "Production-Compliance", {
  env: {
    account: "123456789012",
    region: "us-east-1",
  },
});

// Pattern 5: Multi-region with suffixes (like the old multi-region-suffixes pattern)
new CdkoTestPatternsStack(app, "Production-App", {
  env: { region: "us-east-1" },
});

new CdkoTestPatternsStack(app, "Production-App-Oregon", {
  env: { region: "us-west-2" },
});

new CdkoTestPatternsStack(app, "Production-App-Frankfurt", {
  env: { region: "eu-central-1" },
  stackName: "Production-App", // Frankfurt special case
});
