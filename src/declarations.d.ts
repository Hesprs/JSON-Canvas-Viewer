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

	interface Coordinates {
		x: number;
		y: number;
	}

	interface Class<T> {
		new (...args: any[]): T;
	}
	interface Function {
		(...args: any[]): any;
	}

	interface nodeBounds {
		minX: number;
		minY: number;
		maxX: number;
		maxY: number;
		width: number;
		height: number;
		centerX: number;
		centerY: number;
	}

	interface runtimeData {
		offsetX: number;
		offsetY: number;
		scale: number;
		canvasData: JSONCanvas;
		nodeMap: Record<string, JSONCanvasNode>;
		canvasBaseDir: string;
		nodeBounds: nodeBounds;
		container: HTMLDivElement;
	}

	interface registry {
		options: Record<string, Record<string, any>>;
		extensions: Array<Class<runtimeData, registry>>;
		hooks: Record<string, Array<Function>>;
		api: Record<string, Record<string, Function>>;
		register: (userRegistry: userRegistry) => void;
	}

	interface userRegistry {
		options?: Record<string, Record<string, any>>;
		extensions?: Array<Class<runtimeData, registry>>;
		hooks?: Record<string, Array<Function>>;
		api?: Record<string, Record<string, Function>>;
	}

	module '*.scss?inline' {
		const content: string;
		export default content;
	}
}

export {};
