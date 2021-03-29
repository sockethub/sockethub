module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 60,
      lines: 70,
      statements: 70
    }
  },
  coverageReporters: ['json', 'lcov', 'text', 'clover']
};