# CDKO - Multi-Region CDK Orchestrator

CDKO is a command-line tool that deploys AWS CDK stacks across multiple regions. It provides a simple interface for managing multi-region deployments while maintaining compatibility with standard CDK workflows.

## Features

- **Multi-region deployment**: Deploy to multiple AWS regions in parallel or sequentially
- **Stack targeting**: Deploy specific stacks using pattern matching
- **Multiple deployment modes**: Support for diff, changeset, and execute operations
- **Flexible configuration**: Configure via CLI arguments, environment variables, or JSON config files
- **Safe defaults**: Creates changesets for review before execution, requires explicit flags for destructive operations
- **Clean output**: Suppresses CDK notices and telemetry messages for focused deployment information
- **Minimal dependencies**: Built with zx for reliable shell scripting

## Installation

```bash
npm install -g cdko
```

### Prerequisites

- Node.js 18.0.0 or higher
- AWS CDK installed (`npm install -g aws-cdk`)
- AWS CLI configured with appropriate credentials

## Quick Start

```bash
# Initialize CDKO configuration
cdko init

# Deploy a stack to all configured regions
cdko -p MyProfile -e Production -s MyStack

# Deploy to specific regions
cdko -p MyProfile -e Production -s MyStack -r us-east-1,eu-west-1

# Preview changes without deploying
cdko -p MyProfile -e Production -s MyStack -m diff
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --profile` | AWS profile to use | *Required* |
| `-s, --stack` | Stack name pattern to deploy | *Required* |
| `-r, --regions` | Comma-separated regions or 'all' | from config |
| `-m, --mode` | Deployment mode: `diff`, `changeset`, `execute` | `changeset` |
| `-x, --sequential` | Deploy regions sequentially instead of parallel | `false` |
| `-d, --dry-run` | Show what would be deployed without executing | `false` |
| `-v, --verbose` | Enable verbose CDK output | `false` |
| `--include-deps` | Include dependency stacks (default: exclude dependencies) | `false` |
| `--parameters` | CDK parameters (KEY=VALUE or STACK:KEY=VALUE) | - |
| `--context` | CDK context values (KEY=VALUE) | - |
| `--cdk-opts` | Pass options directly to CDK commands | - |

## Examples

```bash
# Deploy with parameters
cdko -p MyProfile -s Production-MyApp --parameters KeyName=my-key --parameters InstanceType=t3.micro

# Deploy with stack-specific parameters
cdko -p MyProfile -s Production-MyApp --parameters Production-MyApp:KeyName=my-key

# Deploy with context values
cdko -p MyProfile -s Production-MyApp --context env=production --context feature-flag=enabled

# Sequential deployment with verbose output
cdko -p MyProfile -s Production-MyApp -x -v

# Use CDK options - force deployment and save outputs
cdko -p MyProfile -s Production-MyApp --cdk-opts "--force --outputs-file outputs.json"

# Use CDK options - quiet mode with progress events
cdko -p MyProfile -s Production-MyApp --cdk-opts "--quiet --progress events"

# Use CDK options - disable colors
cdko -p MyProfile -s Production-MyApp --cdk-opts "--no-color"

```

### Passing Options to CDK

Use `--cdk-opts` to pass CDK command flags directly. These are passed as-is to `cdk diff`, `cdk deploy`, etc:

```bash
# Common CDK deployment flags:
--cdk-opts "--force"                    # Force destructive operations
--cdk-opts "--quiet"                    # Suppress non-error output  
--cdk-opts "--no-color"                 # Disable colored output
--cdk-opts "--outputs-file out.json"    # Save outputs to file
--cdk-opts "--progress events"          # Show deployment events

# Global CDK flags:
--cdk-opts "--no-version-reporting"     # Disable version reporting
--cdk-opts "--no-asset-metadata"        # Disable asset metadata

# Multiple flags (space-separated, in quotes):
--cdk-opts "--force --quiet --outputs-file deployment.json"
```

**Note**: These are standard CDK flags. See `cdk deploy --help` and `cdk diff --help` for all available options.

### CDK Parameters and Context

**Parameters** (`--parameters`) pass values to your CDK stack parameters:

```bash
# Basic parameters
cdko -p MyProfile -s MyStack --parameters KeyName=my-key --parameters InstanceType=t3.micro

# Stack-specific parameters (when deploying multiple stacks)
cdko -p MyProfile -s "Production-*" --parameters MyStack:KeyName=prod-key
```

**Context** (`--context`) sets CDK context values that influence synthesis:

```bash
# Set context for feature flags or environment-specific values
cdko -p MyProfile -s MyStack --context env=production --context enable-feature=true

# Context affects CDK synthesis behavior
cdko -p MyProfile -s MyStack --context "@aws-cdk/core:enableStackNameDuplicates=true"
```

**Key differences:**

- **Parameters**: Runtime values passed to your stack's constructor parameters
- **Context**: Build-time values that affect how CDK synthesizes your app

## Configuration

CDKO uses automatic stack detection to manage deployments across regions. Run `cdko init` to create or update your `.cdko.json` configuration file:

```bash
# Initialize CDKO configuration by auto-detecting your CDK stacks
cdko init
```

This creates a `.cdko.json` file with your detected stacks:

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
  "buildCommand": "npm run build",
  "cdkTimeout": "30m",
  "suppressNotices": true,
  "lastUpdated": "2024-01-15T10:30:00.000Z",
  "updatedBy": "cdko@1.0.0"
}
```

### Stack Detection Benefits

- **Automatic Discovery**: Finds all CDK stacks in your project
- **Smart Matching**: Maps construct IDs to deployment regions
- **Pattern Support**: Use wildcards (`*`) to deploy multiple stacks
- **Fallback Mode**: Works without configuration using traditional naming

### Configuration Options

CDKO automatically generates sensible defaults, but you can customize:

```json
{
  "buildCommand": "npm run build",     // Command to build your CDK app
  "cdkTimeout": "30m",               // Timeout for all CDK operations
  "suppressNotices": true            // Hide CDK notices (default: true)
}
```

### Environment Variables

- `CDK_BUILD_COMMAND` - Override build command (default: "npm run build")
- `CDK_TIMEOUT` - Timeout for CDK operations (default: "30m")
- `CDK_CLI_NOTICES` - Set to "true" to show CDK notices (default: hidden)

### Stack Pattern Matching

CDKO supports flexible stack pattern matching:

```bash
# Deploy specific stack
cdko -p MyProfile -s Production-MyApp

# Deploy all stacks starting with "Production-App"
cdko -p MyProfile -s "Production-App*"

# Deploy all Production stacks
cdko -p MyProfile -s "Production-*"

# Deploy all stacks
cdko -p MyProfile -s "*"

# Deploy multiple patterns
cdko -p MyProfile -s "Production-App,Staging-Cache,Production-Database"
```

## How It Works

1. **Stack Detection**: Automatically discovers CDK stacks using `cdko init`
2. **Authentication**: Validates AWS profile credentials with SSO support
3. **Configuration**: Loads settings from `.cdko.json`
4. **Build**: Runs the build command before deployment
5. **Deploy**: Executes CDK commands across all specified regions
   - Parallel execution by default (use `-x` for sequential)
   - Each region gets its own `cdk.out.{region}` directory
   - Smart construct ID mapping for region-specific deployments

## Error Handling

- **AWS Authentication**: If credentials expire, run `aws sso login --profile <profile>`
- **Graceful Shutdown**: Ctrl+C cancels all pending operations cleanly
- **Clear Error Messages**: CDK errors are parsed and displayed clearly

## Development

### Local Testing

```bash
git clone https://github.com/yourusername/cdko.git
cd cdko
npm install
npm link

# Test in any CDK project
cdko --help
```

### Architecture

```bash
src/
├── cli/          # CLI interface and commands
├── core/         # Core functionality (auth, config, orchestration)
└── utils/        # Utilities (logging, errors, prerequisites)
```

## License

MIT

## Acknowledgments

Built with [zx](https://github.com/google/zx) - Google's tool for writing better scripts.
