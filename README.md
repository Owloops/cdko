# CDKO - Multi-Region CDK Orchestrator

CDKO is a command-line tool that deploys AWS CDK stacks across multiple regions. It provides a simple interface for managing multi-region deployments while maintaining compatibility with standard CDK workflows.

## Features

- **Multi-region deployment**: Deploy to multiple AWS regions in parallel or sequentially
- **Stack targeting**: Deploy specific stacks using pattern matching
- **Multiple deployment modes**: Support for diff, synth, changeset, execute, and destroy operations
- **Flexible configuration**: Configure via CLI arguments, environment variables, or JSON config files
- **Safe defaults**: Creates changesets for review before execution, requires explicit flags for destructive operations
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
# Deploy a stack to all configured regions
cdko -p MyProfile -e Production -s MyStack

# Deploy to specific regions
cdko -p MyProfile -e Production -s MyStack -r us-east-1,eu-west-1

# Preview changes without deploying
cdko -p MyProfile -e Production -s MyStack -m diff

# List deployed stacks
cdko -p MyProfile -l
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --profile` | AWS profile to use | *Required* |
| `-e, --environment` | Environment (e.g., Production, Staging) | *Required* |
| `-s, --stack` | Stack name pattern to deploy | *Required* |
| `-r, --regions` | Comma-separated regions or 'all' | `all` |
| `-m, --mode` | Deployment mode: `diff`, `synth`, `changeset`, `execute`, `destroy` | `changeset` |
| `-x, --sequential` | Deploy regions sequentially instead of parallel | `false` |
| `-d, --dry-run` | Show what would be deployed without executing | `false` |
| `-l, --list` | List all deployed stacks | `false` |
| `-v, --verbose` | Enable verbose CDK output | `false` |
| `-i, --include-deps` | Include dependent stacks | `false` |
| `-P, --parameters` | CDK parameters (KEY=VALUE or STACK:KEY=VALUE) | - |
| `-c, --context` | CDK context values | - |
| `--force` | Force destructive operations | `false` |
| `--progress` | Progress display mode (`bar` or `events`) | `events` |
| `--no-color` | Disable colored output | `false` |
| `--quiet` | Suppress non-error output | `false` |
| `--outputs-file` | Write stack outputs to file (region-specific) | - |
| `--cdk-opts` | Additional CDK options to pass through | - |

## Examples

```bash
# Deploy with parameters
cdko -p MyProfile -e Production -s MyApp -P KeyName=my-key -P InstanceType=t3.micro

# Deploy with stack-specific parameters
cdko -p MyProfile -e Production -s MyApp -P MyApp:KeyName=my-key

# Sequential deployment with verbose output
cdko -p MyProfile -e Production -s MyApp -x -v

# Deploy with progress bar
cdko -p MyProfile -e Production -s MyApp --progress bar

# Save outputs to file (creates outputs.json.us-east-1.json, etc.)
cdko -p MyProfile -e Production -s MyApp --outputs-file outputs.json

# Destroy stacks with confirmation
cdko -p MyProfile -e Production -s MyApp -m destroy --force
```

## Configuration

Create a `.cdko.json` file in your project root:

```json
{
  "regions": ["us-east-1", "eu-central-1", "ap-southeast-1"],
  "primaryRegion": "us-east-1",
  "regionSuffixes": {
    "us-east-1": "",
    "eu-central-1": "-Frankfurt",
    "ap-southeast-1": "-Singapore"
  },
  "buildCommand": "npm run build",
  "deployTimeout": "30m",
  "defaultTimeout": "10m"
}
```

### Environment Variables

- `ALL_REGIONS` - Override default regions (comma-separated)
- `PRIMARY_REGION` - Set primary region
- `REGION_SUFFIXES` - JSON object of region suffixes
- `STACK_PREFIX` - Custom stack name prefix
- `STACK_SUFFIX` - Custom stack name suffix
- `BUILD_COMMAND` - Build command to run before deploy
- `VALID_ENVIRONMENTS` - Comma-separated valid environments

### Stack Naming Convention

CDKO constructs stack names using: `{Environment}-{StackPattern}{RegionSuffix}`

Example:

- Command: `cdko -p Profile -e Production -s WebApp`
- In us-east-1: `Production-WebApp`
- In eu-central-1: `Production-WebApp-Frankfurt`

## How It Works

1. **Authentication**: Validates AWS profile credentials
2. **Configuration**: Loads settings from `.cdko.json` and environment variables
3. **Build**: Runs the build command (unless in destroy mode)
4. **Deploy**: Executes CDK commands across all specified regions
   - Parallel execution by default (use `-x` for sequential)
   - Each region gets its own `cdk.out.{region}` directory
   - Region-specific stack naming with configurable suffixes

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
