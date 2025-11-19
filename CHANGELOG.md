## [1.0.11](https://github.com/Owloops/cdko/compare/v1.0.10...v1.0.11) (2025-11-19)


### Bug Fixes

* pass stack names to cdk synth for cross-account compatibility ([3c1f9c3](https://github.com/Owloops/cdko/commit/3c1f9c3f7d46ca83e0f367aaa8cda96804a22cbd))
* prettier formatting ([a1fff58](https://github.com/Owloops/cdko/commit/a1fff58e5629daaf305fce1446b96a2111111cb5))

## [1.0.10](https://github.com/Owloops/cdko/compare/v1.0.9...v1.0.10) (2025-09-05)


### Bug Fixes

* replace minimatch with native pattern matcher ([c7288b4](https://github.com/Owloops/cdko/commit/c7288b488e85a013dcba7d515ce351f144ab25c4))

## [1.0.9](https://github.com/Owloops/cdko/compare/v1.0.8...v1.0.9) (2025-09-05)


### Bug Fixes

* add consistent profile/region prefixes and improved output filtering for multi-account deployments ([b08571e](https://github.com/Owloops/cdko/commit/b08571e6f500a68e47466efec20286c091d6f265))

## [1.0.8](https://github.com/Owloops/cdko/compare/v1.0.7...v1.0.8) (2025-07-28)


### Bug Fixes

* synthesize all stacks instead of filtering by pattern ([7961951](https://github.com/Owloops/cdko/commit/79619512f222dfd8daeba9e4c222282f14f7ed6c))
* update test expectations for non-existent stack patterns ([1b1b7a9](https://github.com/Owloops/cdko/commit/1b1b7a9d6b28966c4235229cc40e38d3a48aa8e7))

## [1.0.7](https://github.com/Owloops/cdko/compare/v1.0.6...v1.0.7) (2025-07-24)


### Bug Fixes

* update readme with accurate features and clearer structure ([5ab4142](https://github.com/Owloops/cdko/commit/5ab41424d3307e1cd180fe9776efc825bd5fb975))

## [1.0.6](https://github.com/Owloops/cdko/compare/v1.0.5...v1.0.6) (2025-07-15)


### Bug Fixes

* default timeout not set ([21c8608](https://github.com/Owloops/cdko/commit/21c860802eeecfe2f7876b22fb56f73432351ccd))

## [1.0.5](https://github.com/Owloops/cdko/compare/v1.0.4...v1.0.5) (2025-07-15)


### Bug Fixes

* inject build environment variables via tsup config ([36ea08a](https://github.com/Owloops/cdko/commit/36ea08ae2fe526f0022a01a5023eb66cb0402817))

## [1.0.4](https://github.com/Owloops/cdko/compare/v1.0.3...v1.0.4) (2025-07-15)


### Bug Fixes

* add build environment variables to semantic-release step ([f8891b8](https://github.com/Owloops/cdko/commit/f8891b8c3f929c99f654663e3e9c7e36263005df))
* push latest package lock file ([aa6c625](https://github.com/Owloops/cdko/commit/aa6c62557b50fbe542da11533b520d52d7ab9a1b))

## [1.0.3](https://github.com/Owloops/cdko/compare/v1.0.2...v1.0.3) (2025-07-15)


### Bug Fixes

* update installation doc ([83af6dd](https://github.com/Owloops/cdko/commit/83af6dd313b4ef30cec126104b969cd79a3c227d))

## [1.0.2](https://github.com/Owloops/cdko/compare/v1.0.1...v1.0.2) (2025-07-15)


### Bug Fixes

* correct repository url case for provenance validation ([4286497](https://github.com/Owloops/cdko/commit/428649716d0d719b184178da0e108b84728aade9))
* github workflow permissions ([934ab28](https://github.com/Owloops/cdko/commit/934ab2840a14c23b0e89376a7ed951f6b7710918))

## [1.0.1](https://github.com/owloops/cdko/compare/v1.0.0...v1.0.1) (2025-07-15)


### Bug Fixes

* add required permissions for npm provenance generation ([fe1a24f](https://github.com/owloops/cdko/commit/fe1a24fcdd310dd39fb7f3c2b2a04fb99bbd2105))

# 1.0.0 (2025-07-15)


### Bug Fixes

* add coverage to test gitignore ([d89e849](https://github.com/owloops/cdko/commit/d89e849c290d3772b3f967fd46b7a84df075b96f))
* remove not required zx quotes ([0fafc31](https://github.com/owloops/cdko/commit/0fafc31895c2b2834bc0a687bcff20dcc21d626d))


### Features

* add color support ([3109b24](https://github.com/owloops/cdko/commit/3109b24bc23bebace2872b46056956c753cc9c78))
* add integration tests and version flag ([2c3fe71](https://github.com/owloops/cdko/commit/2c3fe71e928e2f8774586a7a67a3de26f4cfe0c0))
* add semantic release, fix default region, and improve documentation ([76ea48e](https://github.com/owloops/cdko/commit/76ea48e995b0a0ba282c7c8464d737dc0957e940))
* implement cloud assembly caching for faster multi-region deployments ([cdf9a5c](https://github.com/owloops/cdko/commit/cdf9a5c4e14b489f46c39e466076cbe09d63c72f))
* initial implementation of cdko multi-region deployment tool ([8b32b65](https://github.com/owloops/cdko/commit/8b32b65269567ea343abb00035b53cabe38ba7f5))
* migrate from javascript to typescript with bun runtime ([5760ad9](https://github.com/owloops/cdko/commit/5760ad98f81bac5a87ffee659ecd03bfe428b030))
* migrate runtime from bun to nodejs with tsup build ([832f8f8](https://github.com/owloops/cdko/commit/832f8f8d6c8ab986d8f73617e99daa20363b9345))
* parallel cloud assembly, improve outputs ([9b147df](https://github.com/owloops/cdko/commit/9b147df279b3ac4966154c113fc34fbbe7d6e4b6))
