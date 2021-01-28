module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 28,
      lines: 30,
      statements: 30
    }
  },
  coverageReporters: ['json', 'lcov', 'text', 'clover']
};