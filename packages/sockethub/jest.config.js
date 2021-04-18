module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 90,
      statements: 90,
    },
  },
  coverageReporters: [
    'json',
    'lcov',
    'text',
    'clover',
  ]
};