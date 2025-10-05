import interactor from './interactor';

export default class interactionHandler {
	private interactor: interactor;
	private registry: registry;

	constructor(data: runtimeData, registry: registry) {
		registry.register({
			hooks: {
				onLoad: [this.onLoad],
				onDispose: [this.dispose],
				onInteractionStart: [this.stop],
				onInteractionEnd: [this.start],
			},
			options: {
				interactor: {
					preventDefault: true,
					proControlSchema: false,
					zoomFactor: 0.002,
					lockControlSchema: false,
				},
			},
			api: {
				interactionHandler: {
					stop: this.stop,
					start: this.start,
				},
			},
		});
		this.interactor = new interactor(data.container, registry.options.interactor);
		this.registry = registry;
	}

	private stop = () => this.interactor.stop();
	private start = () => this.interactor.start();

	private onLoad = () => {
		this.interactor.addEventListener('pan', this.onPan);
		this.interactor.addEventListener('zoom', this.onZoom);
		this.interactor.addEventListener('trueClick', this.onClick);
		this.start();
	};

	private onPan = (event: Event) => {
		if (event instanceof CustomEvent) this.registry.api.main.pan(event.detail);
	};
	private onZoom = (event: Event) => {
		if (event instanceof CustomEvent) this.registry.api.main.zoom(event.detail.factor, event.detail.origin);
	};

	private onClick = (e: Event) => {
		function isUIControl(target: HTMLElement) {
			return target.closest && (target.closest('.controls') || target.closest('button') || target.closest('input'));
		}
		if (e instanceof CustomEvent) {
			if (isUIControl(e.detail.target)) return;
			const node = this.registry.api.dataManager.findNodeAtMousePosition(e.detail.position);
			for (const hook of this.registry.hooks.onClick) hook(node?.id || null);
		}
	};

	private dispose = () => {
		this.interactor.removeEventListener('pan', this.onPan);
		this.interactor.removeEventListener('zoom', this.onZoom);
		this.interactor.removeEventListener('trueClick', this.onClick);
		this.interactor.dispose();
	};
}
