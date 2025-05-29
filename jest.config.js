module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/setup.js'],
  // reporters: ['default', 'jest-html-reporters'], // Optional: for HTML reports
  coveragePathIgnorePatterns: [
    "/node_modules/"
  ],
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",
  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: "v8", // or 'babel'
  // A list of paths to modules that run some code to configure or set up the testing framework before each test file in the suite is executed
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'], // if you have a global setup file
  // The test environment that will be used for testing, 'node' for backend
  // testEnvironment: 'node',
  // Options that will be passed to the testEnvironment
  // testEnvironmentOptions: {},
  // The glob patterns Jest uses to detect test files
  testMatch: [
    "**/__tests__/**/*.[jt]s?(x)",
    "**/?(*.)+(spec|test).[tj]s?(x)"
  ],
  // An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
  testPathIgnorePatterns: [
    "/node_modules/"
  ],
  // The regexp pattern or array of patterns that Jest uses to detect test files
  // testRegex: [], // or use testMatch
  // This option allows the use of a custom results processor
  // testResultsProcessor: undefined,
  // This option allows use of a custom test runner
  // testRunner: "jest-runner",
  // A map from regular expressions to paths to transformers
  // transform: {},
  // An array of regexp pattern strings that are matched against all source file paths, matched files will skip transformation
  // transformIgnorePatterns: ['/node_modules/', '\\.pnp\\.[^\\/]+$'],
  // Indicates whether each individual test should be reported during the run
  verbose: true,
};
