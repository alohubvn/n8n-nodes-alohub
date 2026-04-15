import { config } from '@n8n/node-cli/eslint';

// Override to not report unused eslint-disable directives so that
// platform-specific disable comments (e.g. Windows-only false positives)
// don't break the build on other platforms.
const patched = Array.isArray(config) ? config : [config];

export default [
	...patched,
	{
		linterOptions: {
			reportUnusedDisableDirectives: 'off',
		},
	},
];
