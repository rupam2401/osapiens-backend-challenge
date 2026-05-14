/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/__tests__/**/*.test.ts'],
    // Increase timeout for tests that spin up a real DataSource
    testTimeout: 30000,
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: {
                    // Allow decorators (TypeORM)
                    experimentalDecorators: true,
                    emitDecoratorMetadata: true,
                    // Make jest globals (describe, it, expect, …) available
                    types: ['jest', 'node'],
                    // Silence TS6 deprecation for node10 module resolution
                    moduleResolution: 'node10',
                    ignoreDeprecations: '6.0',
                },
            },
        ],
    },
};
