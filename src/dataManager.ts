import { Hook, manifest, OmniUnit, Runner, Store } from 'omnikernel';
import type { Coordinates, NodeBounds } from '@/declarations';
import { unexpectedError } from '@/shared';
import type { dataManagerArgs } from '../omniTypes';

const GRID_CELL_SIZE = 800;
const INITIAL_VIEWPORT_PADDING = 100;

@manifest({
	name: 'dataManager',
	dependsOn: ['options'],
})
export default class DataManager extends OmniUnit<dataManagerArgs> {
	private spatialGrid: Record<string, Array<JSONCanvasNode>> | null = null;

	constructor(...args: dataManagerArgs) {
		super(...args);
		this.Kernel.register(
			{
				api: {
					pan: this.pan,
					zoom: this.zoom,
					zoomToScale: this.zoomToScale,
					panToCoords: this.panToCoords,
					shiftFullscreen: this.shiftFullscreen,
					resetView: this.resetView,
					loadCanvas: this.loadCanvas,
				},
				hooks: {
					onToggleFullscreen: new Hook(),
					onCanvasFetched: new Hook(),
				},
				utilities: {
					middleViewer: this.middleViewer,
					findNodeAt: this.findNodeAt,
				},
				data: {
					canvasData: undefined as unknown as JSONCanvas,
					nodeMap: new Store({} as Record<string, JSONCanvasNode>),
					canvasBaseDir: undefined as unknown as string,
					nodeBounds: undefined as unknown as NodeBounds,
					offsetX: 0,
					offsetY: 0,
					scale: 1,
					container: document.createElement('div'),
				},
			},
			this.facade,
		);
		this.Kernel.register(
			{
				canvasPath: { dataManager: new Runner(this.loadCanvas, { immediate: true, async: true }) },
			},
			this.deps.options,
		);
	}

	private loadCanvas = async () => {
		if (!this.deps.options.canvasPath) throw new Error('[JSONCanvasViewer] Canvas path not provided.');
		const path = this.deps.options.canvasPath();
		try {
			this.resolvePath(path);
			this.facade.data.canvasData(await fetch(path).then(res => res.json()));
			this.facade.data.canvasData().nodes.forEach((node: JSONCanvasNode) => {
				if (node.type === 'file' && node.file && !node.file.includes('http')) {
					const file = node.file.split('/');
					node.file = file[file.length - 1];
				}
				this.facade.data.nodeMap()[node.id] = node;
			});
			this.facade.data.nodeBounds(this.calculateNodeBounds());
			this.buildSpatialGrid();
			this.facade.hooks.onCanvasFetched();
		} catch (err) {
			console.error('Failed to load canvas data:', err);
		}
	};

	private resolvePath = (path: string) => {
		if (/^https?:\/\//.test(path))
			this.facade.data.canvasBaseDir(path.substring(0, path.lastIndexOf('/') + 1));
		else {
			const lastSlash = path.lastIndexOf('/');
			this.facade.data.canvasBaseDir(lastSlash !== -1 ? path.substring(0, lastSlash + 1) : './');
		}
	};

	private findNodeAt = (screenCoords: Coordinates) => {
		const { x, y } = this.C2W(this.C2C({ x: screenCoords.x, y: screenCoords.y }));
		let candidates: Array<JSONCanvasNode> = [];
		if (!this.spatialGrid) candidates = this.facade.data.canvasData().nodes;
		else {
			const col = Math.floor(x / GRID_CELL_SIZE);
			const row = Math.floor(y / GRID_CELL_SIZE);
			const key = `${col},${row}`;
			candidates = this.spatialGrid[key] || [];
		}
		for (const node of candidates) {
			if (
				x < node.x ||
				x > node.x + node.width ||
				y < node.y ||
				y > node.y + node.height ||
				this.judgeInteract(node) === 'non-interactive'
			)
				continue;
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
		this.facade.data.canvasData().nodes.forEach(node => {
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
		const canvasData = this.facade.data.canvasData();
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
		const newScale = this.facade.data.scale() * factor;
		this.zoomToScale(newScale, origin);
	};
	private zoomToScale = (newScale: number, origin: Coordinates) => {
		const validNewScale = Math.max(Math.min(newScale, 20), 0.05);
		const scaleRunner = this.facade.data.scale;
		const scale = scaleRunner();
		if (validNewScale === scale) return;
		const canvasCoords = this.C2C(origin);
		this.facade.data.offsetX(origin.x - (canvasCoords.x * validNewScale) / scale);
		this.facade.data.offsetY(origin.y - (canvasCoords.y * validNewScale) / scale);
		scaleRunner(validNewScale);
	};
	private pan = ({ x, y }: Coordinates) => {
		this.facade.data.offsetX(this.facade.data.offsetX() + x);
		this.facade.data.offsetY(this.facade.data.offsetY() + y);
	};
	private panToCoords = ({ x, y }: Coordinates) => {
		this.facade.data.offsetX(x);
		this.facade.data.offsetY(y);
	};
	private shiftFullscreen = (option: string = 'toggle') => {
		if (!document.fullscreenElement && (option === 'toggle' || option === 'enter'))
			this.facade.data.container().requestFullscreen();
		else if (document.fullscreenElement && (option === 'toggle' || option === 'exit'))
			document.exitFullscreen();
		this.facade.hooks.onToggleFullscreen();
	};
	private resetView = () => {
		const bounds = this.facade.data.nodeBounds();
		const container = this.facade.data.container();
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
		this.facade.data.offsetX(initialView.offsetX);
		this.facade.data.offsetY(initialView.offsetY);
		this.facade.data.scale(initialView.scale);
	};

	// Container to Canvas
	private C2C = ({ x: containerX, y: containerY }: Coordinates) => ({
		x: containerX - this.facade.data.offsetX(),
		y: containerY - this.facade.data.offsetY(),
	});
	// Canvas to World
	private C2W = ({ x: canvasX, y: canvasY }: Coordinates) => ({
		x: canvasX / this.facade.data.scale(),
		y: canvasY / this.facade.data.scale(),
	});

	private middleViewer = () => {
		const container = this.facade.data.container();
		return {
			x: container.clientWidth / 2,
			y: container.clientHeight / 2,
			width: container.clientWidth,
			height: container.clientHeight,
		};
	};
}
