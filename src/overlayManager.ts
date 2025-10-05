import { marked } from 'marked';
import { RuntimeJSONCanvasNode, unexpectedError, destroyError, getColor } from './utilities';

export default class overlayManager {
	private _overlaysLayer: HTMLDivElement | null;
	private overlays: Record<string, HTMLDivElement> = {}; // { id: node } the overlays in viewport
	private selectedId: string | null = null;
	private eventListeners: Record<string, Array<EventListener | null>> = {};
	private data: runtimeData;
	private registry: registry;

	private get overlaysLayer() {
		if (!this._overlaysLayer) throw destroyError;
		return this._overlaysLayer;
	}

	constructor(data: runtimeData, registry: registry) {
		registry.register({
			hooks: {
				onLoad: [this.onLoad],
				onDispose: [this.dispose],
				onRender: [this.updateOverlays],
				onClick: [(id: string | null) => this.select(id)],
			},
		});
		this._overlaysLayer = document.createElement('div');
		this._overlaysLayer.className = 'overlays';
		data.container.appendChild(this.overlaysLayer);
		this.data = data;
		this.registry = registry;
	}

	private onLoad = () => {
		const overlayCreators = {
			text: (node: RuntimeJSONCanvasNode) => {
				if (!node.text) throw unexpectedError;
				this.updateOrCreateOverlay(node, node.text, 'text');
			},
			file: (node: RuntimeJSONCanvasNode) => {
				if (!node.file) throw unexpectedError;
				if (node.file.match(/\.md$/i)) this.loadMarkdownForNode(node);
				else if (node.file.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) this.updateOrCreateOverlay(node, this.data.canvasBaseDir + node.file, 'image');
				else if (node.file.match(/\.(mp3|wav)$/i)) this.updateOrCreateOverlay(node, this.data.canvasBaseDir + node.file, 'audio');
			},
			link: (node: RuntimeJSONCanvasNode) => {
				if (!node.url) throw unexpectedError;
				this.updateOrCreateOverlay(node, node.url, 'link');
			},
			group: () => {},
		};
		Object.values(this.data.nodeMap).forEach(node => overlayCreators[node.type](node));
	};

	private select = (id: string | null) => {
		const previous = !this.selectedId ? null : this.overlays[this.selectedId];
		const current = !id ? null : this.overlays[id];
		if (previous) previous.classList.remove('active');
		if (current) {
			current.classList.add('active');
			this.startInteract();
		} else this.endInteract();
		this.selectedId = id;
	};

	private loadMarkdownForNode = async (node: RuntimeJSONCanvasNode) => {
		if (!node.mdContent) {
			node.mdContent = 'Loading...';
			this.updateOrCreateOverlay(node, node.mdContent, 'markdown');
			try {
				if (!node.file) throw unexpectedError;
				const response = await fetch(this.data.canvasBaseDir + node.file);
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
				} else node.mdContent = await marked.parse(result);
			} catch (err) {
				console.error('Failed to load markdown:', err);
				node.mdContent = 'Failed to load content.';
			}
		}
		this.updateOrCreateOverlay(node, node.mdContent, 'markdown');
	};

	private updateOverlays = () => (this.overlaysLayer.style.transform = `translate(${this.data.offsetX}px, ${this.data.offsetY}px) scale(${this.data.scale})`);

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
		const color = getColor(node.color);
		const overlay = document.createElement('div');
		overlay.classList.add('overlay-container');
		overlay.id = node.id;
		overlay.style.backgroundColor = color.background;
		overlay.style.setProperty('--active-color', color.active);
		switch (type) {
			case 'text':
			case 'markdown': {
				overlay.classList.add('markdown-content');
				const parsedContentWrapper = document.createElement('div');
				parsedContentWrapper.innerHTML = await marked.parse(content || '');
				parsedContentWrapper.classList.add('parsed-content-wrapper');
				overlay.appendChild(parsedContentWrapper);
				break;
			}
			case 'link': {
				const iframe = document.createElement('iframe');
				iframe.src = content;
				iframe.sandbox = 'allow-scripts allow-same-origin';
				iframe.className = 'link-iframe';
				iframe.loading = 'lazy';
				overlay.appendChild(iframe);
				break;
			}
			case 'audio': {
				const audio = document.createElement('audio');
				audio.className = 'audio';
				audio.src = content;
				audio.controls = true;
				overlay.appendChild(audio);
				break;
			}
			case 'image': {
				const img = document.createElement('img');
				img.src = content;
				img.loading = 'lazy';
				overlay.appendChild(img);
			}
		}
		switch (type) {
			case 'link':
			case 'audio': {
				const clickLayer = document.createElement('div');
				clickLayer.className = 'click-layer';
				overlay.appendChild(clickLayer);
			}
		}
		const overlayBorder = document.createElement('div');
		overlayBorder.className = 'overlay-border';
		overlayBorder.style.borderColor = color.border;
		overlay.appendChild(overlayBorder);
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
		return overlay;
	}

	private startInteract = () => {
		for (const hook of this.registry.hooks.onInteractionStart) hook();
	};
	private endInteract = () => {
		for (const hook of this.registry.hooks.onInteractionEnd) hook();
	};

	private dispose = () => {
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
	};
}
