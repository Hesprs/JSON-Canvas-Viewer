import { marked } from 'marked';
import katex from 'marked-katex-extension';
import { JSONCanvasViewer, Controls, DebugPanel, Minimap, MistouchPreventer } from '@';

marked.use(katex());

new JSONCanvasViewer(
	{
		container: document.body,
		canvasPath: 'Example Canvas/introduction.canvas',
		markdownParser: marked,
		options: {
			noShadow: true,
		},
	},
	[DebugPanel, Controls, MistouchPreventer, Minimap],
);
