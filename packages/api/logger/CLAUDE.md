# @oc/api-logger

Lightweight, namespaced structured logging utility.

## Source of truth

`onlinecompetitions-api/packages/logger/src` — synced to this repo.

## API

`createLogger(namespace: string)` — returns a `Logger` interface with `debug`, `info`, `warn`, `error` methods. Debug output gated via `DEBUG_ENABLED` env var.

## Design

Zero external runtime dependencies. Built on `console.*` methods with consistent formatting by namespace. Used across all `api-*` packages.
