import globals from 'globals';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/__tests__/**', 'src/.generated/**'],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  eslintConfigPrettier,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
      // Recommended Best Practices for Node.js
      'no-console': 'off', // Often useful in backend for logging
      eqeqeq: ['error', 'always'],
      curly: 'off',
      'no-var': ['error'],
      'prefer-const': ['error'],
      'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      'no-redeclare': ['error'],
      'consistent-return': ['warn'],
      'func-names': ['warn', 'as-needed'],
      'no-underscore-dangle': 'off',
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': 'error', // Use TypeScript's more specific shadow rule
      'no-return-await': 'error', // Avoid unnecessary await in return statements
      'no-unused-vars': 'off', // Disable base rule — use TypeScript-aware version below
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Optionally, a specific config for JavaScript files if you have any
    files: ['**/*.js'],
    extends: [eslint.configs.recommended, eslintPluginPrettierRecommended, eslintConfigPrettier],
    rules: {
      'no-console': 'off',
      'no-return-await': 'error',
      'no-shadow': ['error'],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
