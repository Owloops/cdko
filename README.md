# CDKO - Multi-Account & Multi-Region CDK Orchestrator

CDKO is a lightweight orchestrator that eliminates the pain of deploying AWS CDK stacks across multiple accounts and regions. Deploy once, everywhere - with full CDK compatibility and intelligent stack mapping.

## The Problem

If you've ever tried deploying CDK stacks across multiple AWS accounts and regions, you know the pain - running `cdk deploy` over and over, changing profiles and regions manually. You end up writing fragile shell scripts that loop through environments, or worse, doing it all by hand.

CDKO solves this with a simple command:

```bash
# Deploy to 6 locations (2 accounts × 3 regions) in parallel
cdko -p "dev,prod" -s MyStack -r us-east-1,eu-west-1,ap-southeast-1
```

## Installation

```bash
npm install -g @owloops/cdko
```

**Prerequisites**: Node.js 18+, AWS CDK, AWS CLI configured with your profiles

## Quick Start

```bash
# Navigate to your CDK project
cd my-cdk-app

# Auto-detect your stacks and create configuration
cdko init

# Deploy a stack across multiple regions
cdko -p MyProfile -s MyStack -r us-east-1,eu-west-1

# Preview changes first
cdko -p MyProfile -s MyStack -m diff
```

## How CDKO Works

CDKO handles three common CDK deployment patterns:

### 1. Environment-Agnostic Stacks

Keep a single stack definition and deploy to any regions you specify:

```typescript
new MyStack(app, 'MyStack');
```

```bash
cdko -p MyProfile -s MyStack -r us-east-1,eu-west-1,ap-southeast-1
```

### 2. Environment-Specific Stacks

When you've already specified account and/or region in your stack:

```typescript
new MyStack(app, 'MyStack-Dev', { env: { account: '123456789012', region: 'us-east-1' }})
new MyStack(app, 'MyStack-Staging', { env: { region: 'us-west-2' }})
```

CDKO detects these automatically and deploys to the correct environments.

### 3. Different Construct IDs, Same Stack Name

Common for multi-region deployments where the stack name is consistent but construct IDs differ:

```typescript
new MyStack(app, 'MyStack-US', { stackName: 'MyStack', env: { region: 'us-east-1' }})
new MyStack(app, 'MyStack-EU', { stackName: 'MyStack', env: { region: 'eu-west-1' }})
new MyStack(app, 'MyStack-AP', { stackName: 'MyStack', env: { region: 'ap-southeast-1' }})
```

CDKO understands these are all the same logical stack.

## Pattern Matching

Pattern matching makes CDKO powerful for complex deployments:

```bash
# Deploy all stacks matching a pattern
cdko -p MyProfile -s "API*" -r us-east-1,us-west-2

# Deploy across multiple accounts using profile patterns
cdko -p "dev-*,prod-*" -s MyStack -r all

# Mix and match patterns
cdko -p "dev,staging,prod" -s "Frontend*,Backend*" -r us-east-1,eu-west-1
```

## CLI Reference

```bash
cdko [options]
```

### Required Options

| Option | Description |
|--------|-------------|
| `-p, --profile` | AWS profile(s) - supports patterns (`dev-*`), lists (`dev,prod`), and wildcards |
| `-s, --stack` | Stack name pattern to deploy - supports wildcards (`API*`) |

### Optional Flags

| Option | Description | Default |
|--------|-------------|---------|
| `-r, --region` | Comma-separated regions or 'all' | `us-east-1` |
| `-m, --mode` | Deployment mode: `diff`, `changeset`, `execute` | `changeset` |
| `-x, --sequential` | Deploy regions sequentially instead of parallel | `false` |
| `-d, --dry-run` | Show what would be deployed without executing | `false` |
| `-v, --verbose` | Enable verbose CDK output | `false` |
| `--include-deps` | Include dependency stacks (removes --exclusively flag) | `false` |
| `--parameters` | CDK parameters (KEY=VALUE or STACK:KEY=VALUE) | - |
| `--context` | CDK context values (KEY=VALUE) | - |
| `--cdk-opts` | Pass additional options directly to CDK | - |
| `-h, --help` | Show help message | - |
| `--version` | Show version with build info | - |

### Deployment Modes

- **diff**: Shows what changes would be made without executing
- **changeset**: Creates CloudFormation changesets for review (default)
- **execute**: Deploys immediately with automatic changeset execution

### Examples

```bash
# Preview changes across all regions
cdko -p prod -s MyStack -r all -m diff

# Deploy with parameters
cdko -p dev -s MyStack --parameters BucketName=my-bucket

# Stack-specific parameters
cdko -p dev -s MyStack --parameters MyStack:KeyName=my-key

# Deploy multiple stacks to multiple accounts
cdko -p "dev-*,staging-*" -s "API*,Frontend*" -r us-east-1,eu-west-1

# Execute immediately (skip changeset review)
cdko -p prod -s MyStack -m execute

# Dry run to see deployment plan
cdko -p "dev-*" -s "Production-*" -d

# Pass CDK options
cdko -p dev -s MyStack --cdk-opts "--require-approval never"

# Sequential deployment
cdko -p prod -s CriticalStack -r us-east-1,us-west-2 -x
```

## Configuration

CDKO uses a `.cdko.json` file to map your logical stacks to their CDK construct IDs. Run `cdko init` to auto-generate this from your existing CDK app:

```json
{
  "version": "0.1",
  "stackGroups": {
    "MyStack": {
      "123456789012/us-east-1": {
        "constructId": "MyStack",
        "account": "123456789012",
        "region": "us-east-1"
      },
      "123456789012/eu-west-1": {
        "constructId": "MyStack-EU",
        "account": "123456789012",
        "region": "eu-west-1"
      }
    }
  },
  "cdkTimeout": "30m",
  "suppressNotices": true
}
```

### Understanding Stack Mapping

CDK creates different construct IDs for the same logical stack across environments. For example:

- Construct ID: `Development-MyApp` → Stack name: `MyApp` (dev account)
- Construct ID: `Production-MyApp` → Stack name: `MyApp` (prod account)  
- Construct ID: `MyApp-EU` → Stack name: `MyApp` (EU region)

CDKO's configuration automatically maps your patterns (like `*MyApp`) to the correct construct IDs per account/region combination.

## Environment Variables

- `CDK_TIMEOUT` - Timeout for CDK operations (default: not set)
- `CDK_CLI_NOTICES` - Set to "true" to show CDK notices (default: hidden)
- `DEBUG` - Set to "1" for detailed error traces

## When to Use CDKO

CDKO is designed for deploying infrastructure and stateful resources from your local machine. It's particularly useful for:

- Initial infrastructure setup across multiple accounts
- Deploying foundational resources (VPCs, databases, etc.)
- Testing infrastructure changes across environments
- Managing resources that don't fit well in CI/CD pipelines

For application deployments and automated workflows, use your CI/CD pipeline. CDKO and CI/CD complement each other - you can even call CDKO from within your pipeline for infrastructure updates.

## Comparison to Similar Tools

If you're familiar with Terraform, CDKO is similar to Terragrunt - it's an orchestration layer that makes it practical to deploy infrastructure at scale across complex multi-account, multi-region environments. Just as Terragrunt wraps Terraform to solve the multi-environment deployment problem, CDKO wraps CDK to provide the same capability.

## Troubleshooting

### AWS Authentication

If credentials expire during deployment:

```bash
aws sso login --profile dev
aws sso login --profile prod
```

### Profile Patterns

Always quote patterns to prevent shell expansion:

```bash
cdko -p "dev-*"    # Correct
cdko -p dev-*      # Shell will expand this
```

### Debug Mode

See detailed execution information:

```bash
DEBUG=1 cdko -p dev -s MyStack -v
```

## Development

```bash
git clone https://github.com/Owloops/cdko.git
cd cdko
npm install
npm run build
npm link

# Run linting
npm run lint

# Run tests
npm test
```

## Testing

The test suite includes comprehensive integration tests against real CDK stacks:

```bash
# Run all tests
npm test

# Run only cdko integration tests
cd test && npm test -- --testNamePattern="CDKO"
```

All tests use the `--dry-run` flag to prevent actual AWS deployments.

## Acknowledgments

- [zx](https://github.com/google/zx) - Shell scripting for Node.js
- [minimatch](https://github.com/isaacs/minimatch) - Glob pattern matching
- [aws-cdk](https://github.com/aws/aws-cdk) - AWS Cloud Development Kit

## License

This project is licensed under the [MIT License](LICENSE).
