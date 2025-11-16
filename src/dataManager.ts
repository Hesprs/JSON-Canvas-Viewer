import { unexpectedError } from './shared';
import { hook, api } from 'omnikernel';

const GRID_CELL_SIZE = 800;
const INITIAL_VIEWPORT_PADDING = 100;

export default class DataManager {
	private Kernel;
	private spatialGrid: Record<string, Array<JSONCanvasNode>> | null = null;

	constructor(Kernel: Amoeba) {
		Kernel._register({
			main: {
				api: {
					pan: api(this.pan),
					zoom: api(this.zoom),
					zoomToScale: api(this.zoomToScale),
					panToCoords: api(this.panToCoords),
					shiftFullscreen: api(this.shiftFullscreen),
					resetView: api(this.resetView),
					loadCanvas: api(this.loadCanvas),
				},
				hooks: {
					onToggleFullscreen: hook(),
					onLoaded: hook(),
				}
			},
			utilities: {
				middleViewer: api(this.middleViewer),
				findNodeAt: api(this.findNodeAt),
			},
			data: {
				canvasData: null,
				nodeMap: null,
				canvasBaseDir: null,
				nodeBounds: null,
				offsetX: 0,
				offsetY: 0,
				scale: 1,
			},
			dispose: hook(),
			allModuleLoadedAsync: this.loadCanvas
		});
		this.Kernel = Kernel;
	}

	private loadCanvas = async () => {
		if (!this.Kernel.canvasPath) throw new Error('Canvas viewer failed: canvas path not provided.')
		const path = this.Kernel.canvasPath();
		try {
			if (/^https?:\/\//.test(path)) this.Kernel.data.canvasBaseDir(path.substring(0, path.lastIndexOf('/') + 1));
			else {
				const lastSlash = path.lastIndexOf('/');
				this.Kernel.data.canvasBaseDir(lastSlash !== -1 ? path.substring(0, lastSlash + 1) : './');
			}
			this.Kernel.data.canvasData(await fetch(path).then(res => res.json()));
			this.Kernel.data.nodeMap({});
			this.Kernel.data.canvasData().nodes.forEach((node: JSONCanvasNode) => {
				if (node.type === 'file' && node.file && !node.file.includes('http')) {
					const file = node.file.split('/');
					node.file = file[file.length - 1];
				}
				this.Kernel.data.nodeMap()[node.id] = node;
			});
			this.Kernel.data.nodeBounds(this.calculateNodeBounds());
			this.buildSpatialGrid();
			this.Kernel.main.hooks.onLoaded();
		} catch (err) {
			console.error('Failed to load canvas data:', err);
		}
	};

	private findNodeAt = ({ x: mouseX, y: mouseY }: Coordinates) => {
		const { x, y } = this.C2W(this.C2C({ x: mouseX, y: mouseY }));
		let candidates: Array<JSONCanvasNode> = [];
		if (!this.spatialGrid) candidates = this.Kernel.data.canvasData().nodes;
		else {
			const col = Math.floor(x / GRID_CELL_SIZE);
			const row = Math.floor(y / GRID_CELL_SIZE);
			const key = `${col},${row}`;
			candidates = this.spatialGrid[key] || [];
		}
		for (const node of candidates) {
			if (x < node.x || x > node.x + node.width || y < node.y || y > node.y + node.height || this.judgeInteract(node) === 'non-interactive') continue;
			return node;
		}
		return null;
	};

	// how should the app handle node interactions
	private judgeInteract = (node: JSONCanvasNode | null) => {
		const type = !node ? 'default' : node.type;
		switch (type) {
			case 'text':
			case 'link':
				return 'select';
			case 'file': {
				const file = node?.file;
				if (!file) throw unexpectedError;
				if (file.match(/\.(md|wav|mp3)$/i)) return 'select';
				else return 'non-interactive';
			}
			default:
				return 'non-interactive';
		}
	};

	private calculateNodeBounds() {
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;
		(this.Kernel.data.canvasData().nodes as Array<JSONCanvasNode>).forEach(node => {
			minX = Math.min(minX, node.x);
			minY = Math.min(minY, node.y);
			maxX = Math.max(maxX, node.x + node.width);
			maxY = Math.max(maxY, node.y + node.height);
		});
		const width = maxX - minX;
		const height = maxY - minY;
		const centerX = minX + width / 2;
		const centerY = minY + height / 2;
		return { minX, minY, maxX, maxY, width, height, centerX, centerY };
	}

	private buildSpatialGrid() {
		const canvasData = this.Kernel.data.canvasData();
		if (canvasData.nodes.length < 50) return;
		this.spatialGrid = {};
		for (const node of canvasData.nodes) {
			const minCol = Math.floor(node.x / GRID_CELL_SIZE);
			const maxCol = Math.floor((node.x + node.width) / GRID_CELL_SIZE);
			const minRow = Math.floor(node.y / GRID_CELL_SIZE);
			const maxRow = Math.floor((node.y + node.height) / GRID_CELL_SIZE);
			for (let col = minCol; col <= maxCol; col++) {
				for (let row = minRow; row <= maxRow; row++) {
					const key = `${col},${row}`;
					if (!this.spatialGrid[key]) this.spatialGrid[key] = [];
					this.spatialGrid[key].push(node);
				}
			}
		}
	}

	private zoom = (factor: number, origin: Coordinates) => {
		const newScale = this.Kernel.data.scale() * factor;
		this.zoomToScale(newScale, origin);
	};
	private zoomToScale = (newScale: number, origin: Coordinates) => {
		const validNewScale = Math.max(Math.min(newScale, 20), 0.05);
		const scaleRunner = this.Kernel.data.scale;
		const scale = scaleRunner();
		if (validNewScale === scale) return;
		const canvasCoords = this.C2C(origin);
		this.Kernel.data.offsetX(origin.x - (canvasCoords.x * validNewScale) / scale);
		this.Kernel.data.offsetY(origin.y - (canvasCoords.y * validNewScale) / scale);
		scaleRunner(validNewScale);
	};
	private pan = ({ x, y }: Coordinates) => {
		this.Kernel.data.offsetX(this.Kernel.data.offsetX() + x);
		this.Kernel.data.offsetY(this.Kernel.data.offsetY() + y);
	};
	private panToCoords = ({ x, y }: Coordinates) => {
		this.Kernel.data.offsetX(x);
		this.Kernel.data.offsetY(y);
	};
	private shiftFullscreen = (option: string = 'toggle') => {
		if (!document.fullscreenElement && (option === 'toggle' || option === 'enter')) this.Kernel.data.container().requestFullscreen();
		else if (document.fullscreenElement && (option === 'toggle' || option === 'exit')) document.exitFullscreen();
		this.Kernel.main.hooks.onToggleFullscreen();
	};
	private resetView = () => {
		const bounds = this.Kernel.data.nodeBounds();
		const container = this.Kernel.data.container();
		if (!bounds || !container) return;
		const contentWidth = bounds.width + INITIAL_VIEWPORT_PADDING * 2;
		const contentHeight = bounds.height + INITIAL_VIEWPORT_PADDING * 2;
		// Use logical dimensions for scaling calculations
		const viewWidth = container.clientWidth;
		const viewHeight = container.clientHeight;
		const scaleX = viewWidth / contentWidth;
		const scaleY = viewHeight / contentHeight;
		const newScale = Math.round(Math.min(scaleX, scaleY) * 1000) / 1000;
		const contentCenterX = bounds.centerX;
		const contentCenterY = bounds.centerY;
		const initialView = {
			scale: newScale,
			offsetX: viewWidth / 2 - contentCenterX * newScale,
			offsetY: viewHeight / 2 - contentCenterY * newScale,
		};
		this.Kernel.data.offsetX(initialView.offsetX);
		this.Kernel.data.offsetY(initialView.offsetY);
		this.Kernel.data.scale(initialView.scale);
	};

	// Container to Canvas
	private C2C = ({ x: containerX, y: containerY }: Coordinates) => ({
		x: containerX - this.Kernel.data.offsetX(),
		y: containerY - this.Kernel.data.offsetY(),
	});
	// Canvas to World
	private C2W = ({ x: canvasX, y: canvasY }: Coordinates) => ({
		x: canvasX / this.Kernel.data.scale(),
		y: canvasY / this.Kernel.data.scale(),
	});

	private middleViewer = () => {
		const container = this.Kernel.data.container();
		return {
			x: container.clientWidth / 2,
			y: container.clientHeight / 2,
			width: container.clientWidth,
			height: container.clientHeight,
		};
	};
}
