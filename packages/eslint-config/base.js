// import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import turboPlugin from 'eslint-plugin-turbo';
import tseslint from 'typescript-eslint';

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  // js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
      'no-console': 'off',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-var': ['error'],
      'prefer-const': ['error'],
      'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      'no-redeclare': ['error'],
      'consistent-return': ['warn'],
      'no-underscore-dangle': 'off',
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error', // Use TypeScript's more specific shadow rule
      'no-return-await': 'error', // Avoid unnecessary await in return statements
      'no-unused-vars': 'off', // false positives on TS enums/types; @typescript-eslint/no-unused-vars covers it
      'next-line-curly': 'off',
    },
  },
  {
    ignores: ['dist/**'],
  },
];
