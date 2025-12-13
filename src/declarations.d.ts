declare global {
	interface JSONCanvasNode {
		id: string;
		type: 'group' | 'file' | 'text' | 'link';
		x: number;
		y: number;
		width: number;
		height: number;
		label?: string;
		background?: string;
		backgroundStyle?: 'cover' | 'ratio' | 'repeat';
		styleAttributes?: Record<string, string>;
		color?: string;
		text?: string;
		file?: string;
		subpath?: string;
		url?: string;
	}

	interface JSONCanvasEdge {
		id: string;
		fromNode: string;
		toNode: string;
		fromSide: 'right' | 'left' | 'top' | 'bottom';
		toSide: 'right' | 'left' | 'top' | 'bottom';
		toEnd?: 'arrow' | 'none';
		label?: string;
		styleAttributes?: Record<string, string>;
		color?: string;
	}

	interface JSONCanvas {
		nodes: Array<JSONCanvasNode>;
		edges: Array<JSONCanvasEdge>;
		metadata: {
			version: string;
			frontmatter: Record<string, string>;
		};
	}

	module '*.scss?inline' {
		const content: string;
		export default content;
	}
}

export type Coordinates = {
	x: number;
	y: number;
};

export type RuntimeData = {
	offsetX: number;
	offsetY: number;
	scale: number;
	canvasData: JSONCanvas;
	nodeMap: Record<string, JSONCanvasNode>;
	canvasBaseDir: string;
	nodeBounds: nodeBounds;
	container: HTMLDivElement;
};

export type NodeBounds = {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
	width: number;
	height: number;
	centerX: number;
	centerY: number;
};
