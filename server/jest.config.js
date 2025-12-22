module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.test.ts'],
    collectCoverageFrom: [
        'rooms/**/*.ts',
        'schema/**/*.ts',
        '!**/*.d.ts'
    ]
};
