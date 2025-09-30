// @ts-nocheck
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';

export default defineConfig([
	{
		files: ['src/*.ts', 'src/*.tsx'],
		extends: [prettier],
		languageOptions: {
			globals: globals.browser,
			parser: typescriptParser,
			parserOptions: {
				ecmaVersion: 2022,
				sourceType: 'module',
			},
		},
		rules: {
			'no-unused-vars': ['error'],
			'@typescript-eslint/no-unused-vars': 'warn',
			'no-undef': 'off',
			'no-unused-expressions': ['error'],
			'no-unused-labels': ['error'],
		},
		plugins: { '@typescript-eslint': typescriptEslint},
		ignores: ['**/dist/**', 'eslint.config.ts', 'tsconfig.json', '**/node_modules/**', '**/vite.config.ts', '**/.github/**', '**/example/**', '**/*.d.ts']
	},
]);