interface viewport {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

export interface RuntimeObsidianCanvasNode extends ObsidianCanvasNode {
	inViewport?: boolean;
	mdContent?: string;
	mdFrontmatter?: Record<string, string>;
}

interface RuntimeObsidianCanvasEdge extends ObsidianCanvasEdge {
	controlPoints?: Array<number>;
}

interface RuntimeObsidianCanvas extends ObsidianCanvas {
	nodes: Array<RuntimeObsidianCanvasNode>;
	edges: Array<RuntimeObsidianCanvasEdge>;
}

export const unexpectedError = new Error('This error is unexpected, probably caused by file corruption. If you assure the error is not caused by accident, please contact the author and show how to reproduce.');
export const destroyError = new Error("Resource hasn't been set up or has been disposed.");

export class renderer {
	private _nodeMap: Record<string, ObsidianCanvasNode> | null = null;
	private _canvasData: RuntimeObsidianCanvas | null = null;
	private _canvas: HTMLCanvasElement | null;
	private _ctx: CanvasRenderingContext2D | null;
	private _container: HTMLElement | null;
	private ARROW_LENGTH: number = 12;
	private ARROW_WIDTH: number = 7;
	private FILE_NODE_RADIUS: number = 12;
	private FONT_COLOR: string = '#fff';
	private CSS_ZOOM_REDRAW_INTERVAL: number = 500;
	private zoomInOptimize: {
		lastDrawnScale: number;
		lastDrawnViewport: viewport;
		timeout: NodeJS.Timeout | null;
		lastCallTime: number;
	};

	private get nodeMap() {
		if (this._nodeMap === null) throw destroyError;
		return this._nodeMap;
	}
	private get canvasData() {
		if (this._canvasData === null) throw destroyError;
		return this._canvasData;
	}
	private get canvas() {
		if (this._canvas === null) throw destroyError;
		return this._canvas;
	}
	private get ctx() {
		if (this._ctx === null) throw destroyError;
		return this._ctx;
	}
	private get container() {
		if (this._container === null) throw destroyError;
		return this._container;
	}

	constructor(canvasContainer: HTMLElement) {
		this._canvas = document.createElement('canvas');
		this._canvas.className = 'main-canvas';
		this._container = canvasContainer;
		this._container.appendChild(this._canvas);
		this._ctx = this._canvas.getContext('2d');
		this.zoomInOptimize = {
			lastDrawnScale: 0,
			lastDrawnViewport: {
				left: 0,
				right: 0,
				top: 0,
				bottom: 0,
			},
			timeout: null,
			lastCallTime: 0,
		};
		resizeCanvasForDPR(this._canvas, canvasContainer.offsetWidth, canvasContainer.offsetHeight);
	}

	receiveData(nodeMap: Record<string, ObsidianCanvasNode>, canvasDava: ObsidianCanvas) {
		this._nodeMap = nodeMap;
		this._canvasData = canvasDava;
	}

	resizeCanvasForDPR() {
		resizeCanvasForDPR(this.canvas, this.container.offsetWidth, this.container.offsetHeight);
	}

	redraw(offsetX: number, offsetY: number, scale: number) {
		if (this.zoomInOptimize.timeout) {
			clearTimeout(this.zoomInOptimize.timeout);
			this.zoomInOptimize.timeout = null;
		}
		const now = Date.now();
		const currentViewport = this.getCurrentViewport(offsetX, offsetY, scale);
		if (this.isViewportInside(currentViewport, this.zoomInOptimize.lastDrawnViewport) && scale !== this.zoomInOptimize.lastDrawnScale) {
			const timeSinceLast: number = now - this.zoomInOptimize.lastCallTime;
			if (timeSinceLast < this.CSS_ZOOM_REDRAW_INTERVAL) {
				this.zoomInOptimize.timeout = setTimeout(() => {
					this.trueRedraw(offsetX, offsetY, scale, currentViewport);
					this.zoomInOptimize.lastCallTime = now;
					this.zoomInOptimize.timeout = null;
				}, 60);
				this.fakeRedraw(currentViewport, scale);
				return;
			}
		}
		this.zoomInOptimize.lastCallTime = now;
		this.trueRedraw(offsetX, offsetY, scale, currentViewport);
	}

	dispose() {
		if (this.zoomInOptimize.timeout) clearTimeout(this.zoomInOptimize.timeout);
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.canvas.remove();
		this.zoomInOptimize.timeout = null;
		this._ctx = null;
		this._canvas = null;
		this._container = null;
		this._canvasData = null;
		this._nodeMap = null;
	}

	private trueRedraw(offsetX: number, offsetY: number, scale: number, currentViewport: viewport) {
		this.zoomInOptimize.lastDrawnViewport = currentViewport;
		this.zoomInOptimize.lastDrawnScale = scale;
		this.canvas.style.transform = '';
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.save();
		this.ctx.translate(offsetX, offsetY);
		this.ctx.scale(scale, scale);
		this.canvasData.nodes.forEach(node => (node.inViewport = this.isNodeInViewport(node, offsetX, offsetY, scale)));
		this.canvasData.nodes.forEach(node => {
			switch (node.type) {
				case 'group':
					this.drawGroup(node, scale);
					break;
				case 'file':
					this.drawFileNode(node);
					break;
			}
		});
		this.canvasData.edges.forEach(edge => this.drawEdge(edge));
		this.ctx.restore();
	}

	private fakeRedraw(currentViewport: viewport, scale: number) {
		const cssScale = scale / this.zoomInOptimize.lastDrawnScale;
		const currentOffsetX = (this.zoomInOptimize.lastDrawnViewport.left - currentViewport.left) * scale;
		const currentOffsetY = (this.zoomInOptimize.lastDrawnViewport.top - currentViewport.top) * scale;
		this.canvas.style.transform = `translate(${currentOffsetX}px, ${currentOffsetY}px) scale(${cssScale})`;
	}

	private isViewportInside(inner: viewport, outer: viewport) {
		return inner.left > outer.left && inner.top > outer.top && inner.right < outer.right && inner.bottom < outer.bottom;
	}

	private isNodeInViewport(node: ObsidianCanvasNode, offsetX: number, offsetY: number, scale: number, margin = 200) {
		const viewLeft = -offsetX / scale - margin;
		const viewTop = -offsetY / scale - margin;
		const viewRight = viewLeft + this.container.clientWidth / scale + 2 * margin;
		const viewBottom = viewTop + this.container.clientHeight / scale + 2 * margin;
		return node.x + node.width > viewLeft && node.x < viewRight && node.y + node.height > viewTop && node.y < viewBottom;
	}

	private getCurrentViewport(offsetX: number, offsetY: number, scale: number) {
		const left = -offsetX / scale;
		const top = -offsetY / scale;
		const right = left + this.container.clientWidth / scale;
		const bottom = top + this.container.clientHeight / scale;
		return { left, top, right, bottom };
	}

	private drawLabelBar(x: number, y: number, label: string, color: string, scale: number) {
		const barHeight = 30 * scale;
		const radius = 6 * scale;
		const yOffset = 8 * scale;
		const fontSize = 16 * scale;
		const xPadding = 6 * scale;
		this.ctx.save();
		this.ctx.translate(x, y);
		this.ctx.scale(1 / scale, 1 / scale);
		this.ctx.font = `${fontSize}px 'Inter', sans-serif`;
		const barWidth = this.ctx.measureText(label).width + 2 * xPadding;
		this.ctx.translate(0, -barHeight - yOffset);
		this.ctx.fillStyle = color;
		this.ctx.beginPath();
		this.ctx.moveTo(radius, 0);
		this.ctx.lineTo(barWidth - radius, 0);
		this.ctx.quadraticCurveTo(barWidth, 0, barWidth, radius);
		this.ctx.lineTo(barWidth, barHeight - radius);
		this.ctx.quadraticCurveTo(barWidth, barHeight, barWidth - radius, barHeight);
		this.ctx.lineTo(radius, barHeight);
		this.ctx.quadraticCurveTo(0, barHeight, 0, barHeight - radius);
		this.ctx.lineTo(0, radius);
		this.ctx.quadraticCurveTo(0, 0, radius, 0);
		this.ctx.closePath();
		this.ctx.fill();
		this.ctx.fillStyle = this.FONT_COLOR;
		this.ctx.fillText(label, xPadding, barHeight * 0.65);
		this.ctx.restore();
	}

	private drawNodeBackground(node: ObsidianCanvasNode) {
		const colors = getColor(node.color);
		const radius = this.FILE_NODE_RADIUS;
		this.ctx.globalAlpha = 1.0;
		this.ctx.fillStyle = colors.background;
		drawRoundRect(this.ctx, node.x + 1, node.y + 1, node.width - 2, node.height - 2, radius);
		this.ctx.fill();
		this.ctx.strokeStyle = colors.border;
		this.ctx.lineWidth = 2;
		drawRoundRect(this.ctx, node.x, node.y, node.width, node.height, radius);
		this.ctx.stroke();
	}

	private drawGroup(node: ObsidianCanvasNode, scale: number) {
		this.drawNodeBackground(node);
		if (node.label) this.drawLabelBar(node.x, node.y, node.label, getColor(node.color).border, scale);
	}

	private drawFileNode(node: ObsidianCanvasNode) {
		if (!node.file) throw unexpectedError;
		if (!node.file.match(/\.md|png|jpg|jpeg|gif|svg$/i)) {
			this.drawNodeBackground(node);
			if (node.file.match(/\.mp3$/i)) {
				this.ctx.fillStyle = this.FONT_COLOR;
				this.ctx.textAlign = 'center';
				this.ctx.textBaseline = 'middle';
				this.ctx.fillText('🎵 Click to Preview 🎵', node.x + node.width / 2, node.y + node.height / 2);
				this.ctx.textAlign = 'left';
			}
		}
		this.ctx.fillStyle = this.FONT_COLOR;
		this.ctx.font = '16px sans-serif';
		this.ctx.fillText(node.file, node.x + 5, node.y - 10);
	}

	private drawEdge(edge: RuntimeObsidianCanvasEdge) {
		const { fromNode, toNode } = this.getEdgeNodes(edge);
		if (!fromNode || !toNode) throw unexpectedError;
		const [startX, startY] = getAnchorCoord(fromNode, edge.fromSide);
		const [endX, endY] = getAnchorCoord(toNode, edge.toSide);
		let [startControlX, startControlY, endControlX, endControlY] = [0, 0, 0, 0];
		if (!edge.controlPoints) {
			[startControlX, startControlY, endControlX, endControlY] = this.getControlPoints(startX, startY, endX, endY, edge.fromSide, edge.toSide);
			edge.controlPoints = [startControlX, startControlY, endControlX, endControlY];
		} else [startControlX, startControlY, endControlX, endControlY] = edge.controlPoints;
		this.drawCurvedPath(startX, startY, endX, endY, startControlX, startControlY, endControlX, endControlY);
		this.drawArrowhead(endX, endY, endControlX, endControlY);
		if (edge.label) {
			const t = 0.5;
			const x = Math.pow(1 - t, 3) * startX + 3 * Math.pow(1 - t, 2) * t * startControlX + 3 * (1 - t) * t * t * endControlX + Math.pow(t, 3) * endX;
			const y = Math.pow(1 - t, 3) * startY + 3 * Math.pow(1 - t, 2) * t * startControlY + 3 * (1 - t) * t * t * endControlY + Math.pow(t, 3) * endY;
			this.ctx.font = '18px sans-serif';
			const metrics = this.ctx.measureText(edge.label);
			const padding = 8;
			const labelWidth = metrics.width + padding * 2;
			const labelHeight = 20;
			this.ctx.fillStyle = '#222';
			this.ctx.beginPath();
			drawRoundRect(this.ctx, x - labelWidth / 2, y - labelHeight / 2 - 2, labelWidth, labelHeight, 4);
			this.ctx.fill();
			this.ctx.fillStyle = '#ccc';
			this.ctx.textAlign = 'center';
			this.ctx.textBaseline = 'middle';
			this.ctx.fillText(edge.label, x, y - 2);
			this.ctx.textAlign = 'left';
			this.ctx.textBaseline = 'alphabetic';
		}
	}

	private getEdgeNodes(edge: ObsidianCanvasEdge) {
		return {
			fromNode: this.nodeMap[edge.fromNode],
			toNode: this.nodeMap[edge.toNode],
		};
	}

	private getControlPoints(startX: number, startY: number, endX: number, endY: number, fromSide: string, toSide: string) {
		const distanceX = endX - startX;
		const distanceY = endY - startY;
		const realDistance = Math.min(Math.abs(distanceX), Math.abs(distanceY)) + 0.3 * Math.max(Math.abs(distanceX), Math.abs(distanceY));
		const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
		const PADDING = clamp(realDistance * 0.5, 60, 300);
		let startControlX = startX;
		let startControlY = startY;
		let endControlX = endX;
		let endControlY = endY;
		switch (fromSide) {
			case 'top':
				startControlY = startY - PADDING;
				break;
			case 'bottom':
				startControlY = startY + PADDING;
				break;
			case 'left':
				startControlX = startX - PADDING;
				break;
			case 'right':
				startControlX = startX + PADDING;
				break;
		}
		switch (toSide) {
			case 'top':
				endControlY = endY - PADDING;
				break;
			case 'bottom':
				endControlY = endY + PADDING;
				break;
			case 'left':
				endControlX = endX - PADDING;
				break;
			case 'right':
				endControlX = endX + PADDING;
				break;
		}
		return [startControlX, startControlY, endControlX, endControlY];
	}

	private drawCurvedPath(startX: number, startY: number, endX: number, endY: number, c1x: number, c1y: number, c2x: number, c2y: number) {
		this.ctx.beginPath();
		this.ctx.moveTo(startX, startY);
		this.ctx.bezierCurveTo(c1x, c1y, c2x, c2y, endX, endY);
		this.ctx.strokeStyle = '#ccc';
		this.ctx.lineWidth = 2;
		this.ctx.stroke();
	}

	private drawArrowhead(tipX: number, tipY: number, fromX: number, fromY: number) {
		const dx = tipX - fromX;
		const dy = tipY - fromY;
		const length = Math.sqrt(dx * dx + dy * dy);
		if (length === 0) return;
		const unitX = dx / length;
		const unitY = dy / length;
		const leftX = tipX - unitX * this.ARROW_LENGTH - unitY * this.ARROW_WIDTH;
		const leftY = tipY - unitY * this.ARROW_LENGTH + unitX * this.ARROW_WIDTH;
		const rightX = tipX - unitX * this.ARROW_LENGTH + unitY * this.ARROW_WIDTH;
		const rightY = tipY - unitY * this.ARROW_LENGTH - unitX * this.ARROW_WIDTH;
		this.ctx.beginPath();
		this.ctx.fillStyle = '#ccc';
		this.ctx.moveTo(tipX, tipY);
		this.ctx.lineTo(leftX, leftY);
		this.ctx.lineTo(rightX, rightY);
		this.ctx.closePath();
		this.ctx.fill();
	}
}

export function getAnchorCoord(node: ObsidianCanvasNode, side: 'top' | 'bottom' | 'left' | 'right') {
	const midX = node.x + node.width / 2;
	const midY = node.y + node.height / 2;
	switch (side) {
		case 'top':
			return [midX, node.y];
		case 'bottom':
			return [midX, node.y + node.height];
		case 'left':
			return [node.x, midY];
		case 'right':
			return [node.x + node.width, midY];
		default:
			return [midX, midY];
	}
}

export function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}

export function getColor(colorIndex?: string) {
	let themeColor = null;
	switch (colorIndex) {
		case '1':
			themeColor = 'rgba(255, 120, 129, ?)';
			break;
		case '2':
			themeColor = 'rgba(251, 187, 131, ?)';
			break;
		case '3':
			themeColor = 'rgba(255, 232, 139, ?)';
			break;
		case '4':
			themeColor = 'rgba(124, 211, 124, ?)';
			break;
		case '5':
			themeColor = 'rgba(134, 223, 226, ?)';
			break;
		case '6':
			themeColor = 'rgba(203, 158, 255, ?)';
			break;
		default:
			themeColor = 'rgba(140, 140, 140, ?)';
	}
	return {
		border: themeColor.replace('?', '0.75'),
		background: themeColor.replace('?', '0.1'),
		active: themeColor.replace('?', '1'),
	};
}

export function resizeCanvasForDPR(canvas: HTMLCanvasElement, width: number, height: number) {
	const dpr = window.devicePixelRatio || 1;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw unexpectedError;
	canvas.width = Math.round(width * dpr);
	canvas.height = Math.round(height * dpr);
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.scale(dpr, dpr);
}
