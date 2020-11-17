module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 75,
      lines: 75,
      statements: 80
    }
  },
  coverageReporters: ['json', 'lcov', 'text', 'clover']
};