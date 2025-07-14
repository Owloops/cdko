# CDKO - Multi-Region CDK Orchestrator

CDKO eliminates the pain of deploying AWS CDK infrastructure across multiple regions. Instead of running `cdk deploy` manually for each region, CDKO orchestrates deployments efficiently while maintaining full CDK compatibility.

## Why CDKO?

DevOps engineers often need to deploy the same infrastructure across multiple regions for redundancy, compliance, or performance. This typically means running multiple CDK commands manually:

```bash
# The old way - tedious and error-prone
AWS_REGION=us-east-1 cdk deploy Production-MyApp
AWS_REGION=eu-west-1 cdk deploy Production-MyApp-EU  
AWS_REGION=ap-southeast-1 cdk deploy Production-MyApp-APAC
```

CDKO simplifies this to a single command:

```bash
# The CDKO way - simple and reliable
cdko -p MyProfile -s Production-MyApp
```

**Built for local infrastructure deployments** where engineers need quick, reliable multi-region deployments during development and maintenance cycles.

## Features

- **Multi-region deployment**: Deploy to multiple AWS regions in parallel or sequentially
- **Multi-account support**: Deploy across multiple AWS accounts using profile patterns
- **Smart stack detection**: Automatically discovers and maps your CDK stacks
- **Cloud assembly caching**: Synthesizes once, deploys many times for optimal performance
- **Flexible targeting**: Deploy specific stacks using pattern matching or wildcards
- **Multiple deployment modes**: Support for diff, changeset, and execute operations
- **Safe defaults**: Creates changesets for review before execution

## Installation

```bash
npm install -g cdko
```

**Prerequisites**: Node.js 18+, AWS CDK, AWS CLI configured

## Quick Start

```bash
# Initialize CDKO configuration
cdko init

# Deploy a stack to all configured regions
cdko -p MyProfile -s MyStack

# Deploy to specific regions
cdko -p MyProfile -s MyStack -r us-east-1,eu-west-1

# Multi-account deployment
cdko -p "dev-*,prod" -s MyStack

# Preview changes without deploying
cdko -p MyProfile -s MyStack -m diff
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --profile` | AWS profile to use (supports patterns: `dev-*`, comma-separated: `dev,prod`) | *Required* |
| `-s, --stack` | Stack name pattern to deploy | *Required* |
| `-r, --region` | Comma-separated regions or 'all' | `us-east-1` |
| `-m, --mode` | Deployment mode: `diff`, `changeset`, `execute` | `changeset` |
| `-x, --sequential` | Deploy regions sequentially instead of parallel | `false` |
| `-d, --dry-run` | Show what would be deployed without executing | `false` |
| `-v, --verbose` | Enable verbose CDK output | `false` |
| `--include-deps` | Include dependency stacks when deploying | `false` |
| `--parameters` | CDK parameters (KEY=VALUE or STACK:KEY=VALUE) | - |
| `--context` | CDK context values (KEY=VALUE) | - |
| `--cdk-opts` | Pass options directly to CDK commands | - |

## Configuration

Run `cdko init` to auto-detect your CDK stacks and create a `.cdko.json` configuration:

```json
{
  "version": "0.1",
  "stackGroups": {
    "Production-MyApp": {
      "123456789012/us-east-1": {
        "constructId": "Production-MyApp",
        "account": "123456789012",
        "region": "us-east-1"
      },
      "123456789012/eu-west-1": {
        "constructId": "Production-MyApp-EU",
        "account": "123456789012",
        "region": "eu-west-1"
      }
    }
  },
  "cdkTimeout": "30m",
  "suppressNotices": true
}
```

### Environment Variables

- `CDK_TIMEOUT` - Timeout for CDK operations (default: "30m")
- `CDK_CLI_NOTICES` - Set to "true" to show CDK notices (default: hidden)
- `DEBUG` - Enable detailed error traces for troubleshooting

## Examples

```bash
# Deploy with parameters
cdko -p MyProfile -s MyApp --parameters KeyName=my-key InstanceType=t3.micro

# Deploy with stack-specific parameters
cdko -p MyProfile -s MyApp --parameters MyApp:KeyName=my-key

# Deploy with context values
cdko -p MyProfile -s MyApp --context env=production feature-flag=enabled

# Deploy all Production stacks
cdko -p MyProfile -s "Production-*"

# Multi-account deployments with pattern matching
cdko -p "dev-*" -s MyApp
cdko -p "dev-account,prod-account" -s MyApp

# Include dependency stacks
cdko -p MyProfile -s MyApp --include-deps

# Debug mode for troubleshooting
DEBUG=1 cdko -p MyProfile -s MyApp

# Sequential deployment with verbose output
cdko -p MyProfile -s MyApp -x -v

# Pass CDK options directly
cdko -p MyProfile -s MyApp --cdk-opts "--force --outputs-file outputs.json"
```

## How It Works

1. **Auto-detection**: Discovers CDK stacks using `cdko init`
2. **Authentication**: Validates AWS profile credentials with SSO support
3. **Cloud assembly**: Synthesizes once for optimal performance
4. **Deployment**: Executes across regions in parallel (or sequentially with `-x`)
5. **Smart mapping**: Uses region-specific construct IDs when configured

## Troubleshooting

- **AWS Authentication**: If credentials expire, run `aws sso login --profile <profile>`
- **Multi-Account Issues**: Ensure all profiles have valid credentials and required permissions
- **Profile Patterns**: Use quotes around patterns: `cdko -p "dev-*"` not `cdko -p dev-*`
- **Graceful Shutdown**: Ctrl+C cancels all pending operations cleanly
- **Clear Errors**: CDK errors are parsed and displayed with context

## Development

```bash
git clone https://github.com/yourusername/cdko.git
cd cdko
npm install
npm link

# Test in any CDK project
cdko --help
```

## License

MIT - Built with [zx](https://github.com/google/zx)
