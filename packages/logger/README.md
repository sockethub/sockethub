# @sockethub/logger

Winston-based logging system for Sockethub with singleton configuration and namespace support.

## About

The logger package provides a centralized logging system that uses a singleton pattern for
global configuration. Initialize once with `initLogger()`, then create namespaced loggers
throughout your application with `createLogger()`.

## Usage

### Initialize Logger (Once)

Call `initLogger()` at application startup to set global configuration:

```typescript
import { initLogger } from '@sockethub/logger';

initLogger({
  level: 'info',        // Console log level
  fileLevel: 'debug',   // File log level (if file is specified)
  file: '/var/log/app.log'  // Optional log file path
});
```

### Create Namespaced Loggers

Create loggers throughout your codebase with namespace identifiers:

```typescript
import { createLogger } from '@sockethub/logger';

const log = createLogger('app:module:component');

log.info('Application started');
log.debug('Debug information');
log.warn('Warning message');
log.error('Error occurred', err);
```

## Configuration Priority

Logger configuration follows this priority chain (highest to lowest):

1. **Explicit options** - Passed directly to `createLogger(namespace, options)`
2. **Global config** - Set via `initLogger()` at startup
3. **Environment variables** - `LOG_LEVEL`, `LOG_FILE_LEVEL`, `LOG_FILE`
4. **Defaults** - `info` for console, `debug` for file

### Example: Override Global Config

```typescript
// Global config
initLogger({ level: 'info' });

// This logger uses global config
const log1 = createLogger('app:service');

// This logger overrides with explicit options
const log2 = createLogger('app:debug', { level: 'debug' });
```

## Singleton Pattern

The logger uses a singleton configuration pattern:

- `initLogger()` sets global configuration once
- `createLogger()` creates individual logger instances using the global config
- Explicit options in `createLogger()` override global settings for that instance

## Process Context

Set a process-wide context to automatically prefix all logger namespaces. This is useful for
identifying logs from different processes (e.g., main server vs platform child processes).

### Setting Context

```typescript
import { setLoggerContext, createLogger } from '@sockethub/logger';

// In main server process
setLoggerContext('sockethub');

const log1 = createLogger('server:listener');
// Output namespace: "sockethub:server:listener"

const log2 = createLogger('data-layer:queue:irc:abc123');
// Output namespace: "sockethub:data-layer:queue:irc:abc123"
```

### Platform Child Processes

Context is particularly useful for platform child processes where you want all logs
(including data-layer operations) to include the platform instance identifier:

```typescript
// In platform child process
setLoggerContext('sockethub:platform:irc:abc123');

const log = createLogger('main');
// Output namespace: "sockethub:platform:irc:abc123:main"

// Data-layer components also get the context automatically
const worker = new JobWorker(...);
// Worker logs: "sockethub:platform:irc:abc123:data-layer:worker"
```

### Checking Context

```typescript
import { getLoggerContext } from '@sockethub/logger';

const context = getLoggerContext();
if (context.includes(':platform:')) {
  // We're in a platform child process
  console.log('Running in platform process:', context);
}
```

### Context Benefits

- **Process identification** - Easily identify which process generated a log
- **Grouped logs** - Filter all logs from a specific process/platform instance
- **DRY** - Set common prefix once instead of repeating in every createLogger call
- **Automatic** - Data-layer and other shared components inherit the context

## Log Levels

Available log levels (highest to lowest priority):

- `error` - Error messages
- `warn` - Warning messages
- `info` - Informational messages
- `debug` - Debug messages

## Features

- **Console logging** with colored output and timestamps (disabled in production)
- **File logging** with separate log level control
- **Namespace support** for filtering and identifying log sources
- **No initialization required** - Falls back to environment variables or defaults
- **TypeScript support** with full type definitions

## Environment Variables

- `LOG_LEVEL` - Console log level (default: `info`)
- `LOG_FILE_LEVEL` - File log level (default: `debug`)
- `LOG_FILE` - Log file path (optional)
- `NODE_ENV=production` - Disables console timestamps for systemd
