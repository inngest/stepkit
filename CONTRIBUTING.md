# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Open Workflow is a framework for building durable, resumable workflow execution systems. It provides an abstraction layer that allows workflows to be executed on different backends (in-memory for testing, or distributed systems like Inngest) while maintaining the same workflow code.

## Monorepo Structure

This is a pnpm workspace monorepo with three packages:

- **@open-workflow/core**: Core abstractions and execution logic. Other packages depend on this package.
- **@open-workflow/in-memory**: Simple in-memory driver.
- **@open-workflow/inngest**: Integration with Inngest.

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

New SDKs are implemented by building on top of `@open-workflow/core`. See that package for more details.
