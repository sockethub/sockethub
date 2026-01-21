/**
 * Shared configuration for test-installed-version script
 */

export const CONFIG = {
  DEFAULT_INSTALL_DIR: `${process.env.TMPDIR || "/tmp"}/sockethub-test-install`,
  DEFAULT_OUTPUT_DIR: "./test-results",
  DEFAULT_SUITE: "all",
  DEFAULT_RUNTIME: "both",

  RUNTIMES: {
    BUN: "bun",
    NODE: "node",
    BOTH: "both",
  },

  SERVICES: {
    REDIS: { host: "localhost", port: 6379 },
    PROSODY: { host: "localhost", port: 5222 },
    SOCKETHUB: { host: "localhost", port: 10550 },
  },

  TIMEOUTS: {
    SERVICE_START: 30000, // 30s
    SOCKETHUB_START: 10000, // 10s
    TEST_SUITE: 300000, // 5min
  },

  SUITES: {
    REDIS: "redis",
    PROCESS: "process",
    BROWSER: "browser",
    ALL: "all",
  },
};
