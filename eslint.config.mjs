import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import globals from 'globals';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';


import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig([
	{
		files: ['**/*.ts', '**/*.tsx'],
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
			...typescriptEslint.configs['recommended'].rules,
			'no-unused-vars': ['error'],
			'@typescript-eslint/no-unused-vars': 'warn',
			'no-undef': 'off',
			'no-unused-expressions': ['error'],
			'no-unused-labels': ['error'],
		},
		plugins: { '@typescript-eslint': typescriptEslint },
		ignores: ['**/dist/**', '**/node_modules/**', '**/vite.config.js', '**/.github/**', '**/.vscode/**', '**/.cursor/**'],
	},
]);
