# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StepKit is a framework for building durable, resumable workflow execution systems. It provides an abstraction layer that allows workflows to be executed on different backends (in-memory for testing, or distributed systems like Inngest) while maintaining the same workflow code.

## Monorepo Structure

This is a pnpm workspace monorepo with three packages:

- **@stepkit/core**: Core schemas and types for StepKit. It's the smallest amount of code for the "client" and "workflow" resources.
- **@stepkit/sdk-tools**: SDK tools for building a workflow SDK. Not necessary for building a StepKit-compatible SDK.
- **@stepkit/local**: In-memory and file-system backends.
- **@stepkit/inngest**: Inngest backend.

There are also examples in the `examples` directory.

## Development Commands

### Setup

```sh
pnpm install
```

### Testing

Test

```sh
# Run all tests across packages
pnpm test

# Run all tests in a specific package
pnpm -C packages/core test

# Run a specific test file
pnpm -C packages/core test -- src/executionDriver.test.ts

# Run a package's tests in watch mode
pnpm -C packages/core test:watch
```

Type check

```sh
# Type check all packages
pnpm type-check

# Type check a specific package
pnpm -C packages/core type-check
```

Run all static checks and tests

```sh
pnpm precommit
```

### Running Examples

```sh
# In-memory example (synchronous execution)
pnpm -C examples/in-memory dev

# Inngest example (requires Inngest Dev Server)
pnpm -C examples/inngest dev
```

### Running Individual Tests

```sh
# Run a specific test file
pnpm -C packages/core test -- src/executionDriver.test.ts

# Run tests in a specific package
pnpm -C packages/in-memory test
```

## Architecture Concepts

All StepKit-compatible SDKs depend on `@stepkit/core`. SDKs may depend on `@stepkit/sdk-tools` for utilities, which would result in `@stepkit/core` being a transitive dependency.
