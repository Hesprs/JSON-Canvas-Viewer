import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig } from 'eslint/config';

export default defineConfig([
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/ban-ts-comment': 'off',
		},
		ignores: ['**/dist/**', '**/node_modules/**', '**/example/**'],
	},
	prettier,
]);