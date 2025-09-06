import { marked } from 'marked';
import { RuntimeJSONCanvasNode, unexpectedError, destroyError, getColor } from './renderer';

export default class overlayManager extends EventTarget {
	private _overlaysLayer: HTMLDivElement | null;
	private _overlays: Record<string, HTMLDivElement> | null;
	private _canvasBaseDir: string | null = null;
	private selectedId: string | null = null;
	private eventListeners: Record<string, Array<EventListener | null>> = {};

	private get canvasBaseDir() {
		if (!this._canvasBaseDir) throw destroyError;
		return this._canvasBaseDir;
	}
	private get overlays() {
		if (!this._overlays) throw destroyError;
		return this._overlays;
	}
	private get overlaysLayer() {
		if (!this._overlaysLayer) throw destroyError;
		return this._overlaysLayer;
	}

	constructor(container: HTMLElement) {
		super();
		this._overlaysLayer = document.createElement('div');
		this._overlaysLayer.className = 'overlays';
		container.appendChild(this.overlaysLayer);
		this._overlays = {}; // { id: node } the overlays in viewport
	}

	receiveData(canvasBaseDir: string, nodeMap: Record<string, JSONCanvasNode>) {
		this._canvasBaseDir = canvasBaseDir;
		const overlayCreators = {
			text: (node: RuntimeJSONCanvasNode) => {
				if (!node.text) throw unexpectedError;
				this.updateOrCreateOverlay(node, node.text, 'text');
			},
			file: (node: RuntimeJSONCanvasNode) => {
				if (!node.file) throw unexpectedError;
				if (node.file.match(/\.md$/i)) this.loadMarkdownForNode(node);
				else if (node.file.match(/\.(png|jpg|jpeg|gif|svg)$/i)) this.updateOrCreateOverlay(node, this.canvasBaseDir + node.file, 'image');
			},
			link: (node: RuntimeJSONCanvasNode) => {
				if (!node.url) throw unexpectedError;
				this.updateOrCreateOverlay(node, node.url, 'link');
			},
			group: () => {},
		};
		Object.values(nodeMap).forEach(node => overlayCreators[node.type](node));
	}

	select(id: string | null) {
		const previous = !this.selectedId ? null : this.overlays[this.selectedId];
		const current = !id ? null : this.overlays[id];
		if (previous) previous.classList.remove('active');
		if (current) {
			current.classList.add('active');
			this.startInteract();
		} else this.endInteract();
		this.selectedId = id;
	}

	private async loadMarkdownForNode(node: RuntimeJSONCanvasNode) {
		if (!node.mdContent) {
			node.mdContent = 'Loading...';
			this.updateOrCreateOverlay(node, node.mdContent, 'markdown');
			try {
				if (!node.file) throw unexpectedError;
				const response = await fetch(this.canvasBaseDir + node.file);
				const result = await response.text();
				const frontmatterMatch = result.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
				if (frontmatterMatch) {
					const frontmatter = frontmatterMatch[1].split('\n').reduce((acc: Record<string, string>, line) => {
						const [key, value] = line.split(':').map(s => s.trim());
						acc[key] = value;
						return acc;
					}, {});
					node.mdContent = await marked.parse(frontmatterMatch[2].trim());
					node.mdFrontmatter = frontmatter;
				} else {
					node.mdContent = await marked.parse(result);
				}
			} catch (err) {
				console.error('Failed to load markdown:', err);
				node.mdContent = 'Failed to load content.';
			}
		}
		this.updateOrCreateOverlay(node, node.mdContent, 'markdown');
	}

	updateAllOverlays(offsetX: number, offsetY: number, scale: number) {
		this.overlaysLayer.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
	}

	private async updateOrCreateOverlay(node: RuntimeJSONCanvasNode, content: string, type: string) {
		let element = this.overlays[node.id];
		if (!element) {
			element = await this.constructOverlay(node, content, type);
			this.overlaysLayer.appendChild(element);
			this.overlays[node.id] = element;
			element.style.left = node.x + 'px';
			element.style.top = node.y + 'px';
			element.style.width = node.width + 'px';
			element.style.height = node.height + 'px';
		}
		if (element.style.display === 'none') element.style.display = 'flex';
		if (type === 'markdown') {
			const parsedContentContainer = element.getElementsByClassName('parsed-content-wrapper')[0];
			if (!node.mdContent) throw unexpectedError;
			if (parsedContentContainer.innerHTML !== node.mdContent) parsedContentContainer.innerHTML = node.mdContent;
			if (!element.classList.contains('rtl') && node.mdFrontmatter?.direction === 'rtl') element.classList.add('rtl');
		}
	}

	private async constructOverlay(node: RuntimeJSONCanvasNode, content: string, type: string) {
		const colorClass = node.color == undefined ? '0' : node.color;
		const color = getColor(colorClass);
		const overlay = document.createElement('div');
		overlay.classList.add('overlay-container');
		overlay.id = node.id;
		overlay.style.backgroundColor = color.background;
		overlay.style.setProperty('--active-color', color.active);
		const overlayBorder = document.createElement('div');
		overlayBorder.className = 'overlay-border';
		overlayBorder.style.borderColor = color.border;
		overlay.appendChild(overlayBorder);
		switch (type) {
			case 'text':
			case 'markdown':
				overlay.classList.add('markdown-content');
				const parsedContentWrapper = document.createElement('div');
				parsedContentWrapper.innerHTML = await marked.parse(content || '');
				parsedContentWrapper.classList.add('parsed-content-wrapper');
				overlay.appendChild(parsedContentWrapper);
				break;
			case 'link':
				const iframe = document.createElement('iframe');
				iframe.src = content;
				iframe.sandbox = 'allow-scripts allow-same-origin';
				iframe.className = 'link-iframe';
				iframe.loading = 'lazy';
				const clickLayer = document.createElement('div');
				clickLayer.className = 'link-click-layer';
				overlay.appendChild(iframe);
				overlay.appendChild(clickLayer);
				break;
			case 'image':
				const img = document.createElement('img');
				img.src = content;
				img.loading = 'lazy';
				overlay.appendChild(img);
				break;
		}
		if (type !== 'image') {
			if (this.selectedId === node.id) overlay.classList.add('active');
			const onStart = () => {
				if (node.id === this.selectedId) this.startInteract();
			};
			const onEnd = () => {
				if (node.id === this.selectedId) this.endInteract();
			};
			overlay.addEventListener('pointerenter', onStart);
			overlay.addEventListener('pointerleave', onEnd);
			overlay.addEventListener('touchstart', onStart);
			overlay.addEventListener('touchend', onEnd);
			this.eventListeners[node.id] = [onStart, onEnd];
		}
		return overlay;
	}

	private startInteract = () => this.dispatchEvent(new CustomEvent('interactionStart'));
	private endInteract = () => this.dispatchEvent(new CustomEvent('interactionEnd'));

	dispose() {
		this._overlays = null;
		while (this.overlaysLayer.firstElementChild) {
			const child = this.overlaysLayer.firstElementChild;
			if (this.eventListeners[child.id]) {
				const onStart = this.eventListeners[child.id][0];
				const onEnd = this.eventListeners[child.id][1];
				if (!onStart || !onEnd) throw destroyError;
				child.removeEventListener('pointerenter', onStart);
				child.removeEventListener('pointerleave', onEnd);
				child.removeEventListener('touchstart', onStart);
				child.removeEventListener('touchend', onEnd);
				this.eventListeners[child.id][0] = null;
				this.eventListeners[child.id][1] = null;
			}
			child.remove();
		}
		this.overlaysLayer.remove();
		this._overlaysLayer = null;
	}
}
