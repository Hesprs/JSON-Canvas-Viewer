import { resolve } from 'node:path';
import decorators from '@open-xchange/vite-plugin-es-decorators';
import { defineConfig } from 'vite';

export default defineConfig({
	root: 'test',
	resolve: {
		alias: {
			'@': resolve(__dirname, 'src/'),
			$: resolve(__dirname, 'dist/'),
		},
	},
	plugins: [decorators()],
	build: {
		outDir: resolve(__dirname, 'dist'),
		emptyOutDir: true,
		minify: 'terser',
		sourcemap: true,
		rollupOptions: {
			external: ['dompurify'],
		},
		lib: {
			entry: {
				index: resolve(__dirname, 'src'),
			},
			name: 'JSONCanvasViewer',
			formats: ['es', 'cjs'],
			fileName: format => `index.${format === 'cjs' ? 'cjs' : 'js'}`,
		},
	},
});
