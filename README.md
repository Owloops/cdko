# CDKO - Multi-Account & Multi-Region CDK Orchestrator

CDKO eliminates the pain of deploying AWS CDK infrastructure across multiple accounts and regions. Deploy once, everywhere - with full CDK compatibility and intelligent stack mapping.

## Features

- **Multi-account & multi-region deployment** - Deploy across account-region matrices in parallel or sequentially
- **Smart stack detection** - Automatically discovers and maps CDK stack construct IDs to accounts/regions  
- **Profile pattern matching** - Support for wildcards (`dev-*`) and comma-separated lists (`dev,staging,prod`)
- **Cloud assembly caching** - Synthesizes once per profile, deploys many times for optimal performance
- **Flexible stack targeting** - Deploy specific stacks using pattern matching or wildcards
- **Multiple deployment modes** - Support for diff, changeset, and execute operations
- **Safe defaults** - Creates changesets for review before execution

## Installation

```bash
npm install -g @owloops/cdko
```

**Prerequisites**: Node.js 18+, AWS CDK, AWS CLI configured

## Quick Start

```bash
# Initialize configuration
cdko init

# Deploy stack across accounts and regions
cdko -p "dev,prod" -s MyStack -r us-east-1,eu-west-1

# Preview changes
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
| `-h, --help` | Show help message | - |
| `--version` | Show version number | - |

## Examples

```bash
# Multi-account + multi-region
cdko -p "dev,staging,prod" -s MyApp -r us-east-1,eu-west-1

# Pattern matching
cdko -p "dev-*" -s "Production-*"

# With parameters
cdko -p MyProfile -s MyApp --parameters KeyName=my-key

# Execute mode (skip changeset review)
cdko -p MyProfile -s MyApp -m execute
```

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

### Stack Mapping

CDK creates different **construct IDs** for the same logical stack across environments:

- Construct ID: `Development-MyApp` → Stack name: `MyApp` (dev account)
- Construct ID: `Production-MyApp` → Stack name: `MyApp` (prod account)  
- Construct ID: `MyApp-EU` → Stack name: `MyApp` (EU region)

CDKO's `.cdko.json` automatically maps your patterns (`*MyApp`) to the correct construct IDs per account/region.

## Environment Variables

- `CDK_TIMEOUT` - Timeout for CDK operations (default: "not set")
- `CDK_CLI_NOTICES` - Set to "true" to show CDK notices (default: hidden)
- `DEBUG` - Enable detailed error traces for troubleshooting

## Troubleshooting

- **AWS Authentication**: If credentials expire, run `aws sso login --profile <profile>`
- **Multi-Account Issues**: Ensure all profiles have valid credentials and required permissions
- **Profile Patterns**: Use quotes around patterns: `cdko -p "dev-*"` not `cdko -p dev-*`
- **Graceful Shutdown**: Ctrl+C cancels all pending operations cleanly
- **Clear Errors**: CDK errors are parsed and displayed with context

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

# Test in any CDK project
cdko --help
```

## Testing

CDKO includes comprehensive integration tests that verify core functionality against real CDK stacks.

### Test Structure

The `test/` directory contains a complete CDK project used as a test fixture:

```text
test/
├── test/                    # Jest tests
│   ├── cdko-integration.test.ts  # CDKO CLI integration tests
│   └── cdko-test-patterns.test.ts # CDK construct tests
├── cdk.out/                 # Pre-synthesized CDK stacks
├── package.json             # CDK project dependencies
└── jest.config.js           # Jest configuration
```

### Test Coverage

- **Pattern matching** - Wildcard stack selection (`Production-*`)
- **Multi-region deployment** - Cross-region deployment planning
- **Configuration generation** - `cdko init` command testing
- **Error handling** - Invalid patterns and missing parameters
- **CLI commands** - Help, version, and parameter validation

### Running Tests

```bash
# Run all tests
npm test

# Run only cdko integration tests
cd test && npm test -- --testNamePattern="CDKO"
```

All tests use the `--dry-run` flag to prevent actual AWS deployments, making them safe to run in any environment.

## Acknowledgments

- [zx](https://github.com/google/zx) - Shell scripting for Node.js
- [minimatch](https://github.com/isaacs/minimatch) - Glob pattern matching
- [aws-cdk](https://github.com/aws/aws-cdk) - AWS Cloud Development Kit

## License

This project is licensed under the [MIT License](LICENSE).
