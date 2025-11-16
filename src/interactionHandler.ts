import interactor from './interactor';
import { hook, normalize, api } from 'omnikernel';

export default class InteractionHandler {
	private interactor: interactor;
	private Kernel;

	constructor(Kernel: Amoeba) {
		Kernel._register({
			main: {
				options: {
					preventDefault: true,
					proControlSchema: false,
					zoomFactor: 0.002,
					lockControlSchema: false,
				},
			},
		});
		this.interactor = new interactor(Kernel.data.container(), normalize(Kernel.main.options));
		Kernel._register({
			main: {
				hooks: {
					onInteractionStart: this.interactor.stop,
					onInteractionEnd: this.interactor.start,
					onLoaded: this.start,
					onClick: hook(),
				},
				api: {
					stopInteraction: api(this.interactor.stop),
					startInteraction: api(this.interactor.start),
				},
			},
			dispose: this.dispose,
		});
		this.Kernel = Kernel;
	}
	
	private start = () => {
		this.interactor.addEventListener('pan', this.onPan);
		this.interactor.addEventListener('zoom', this.onZoom);
		this.interactor.addEventListener('trueClick', this.onClick);
		this.interactor.start();
	};

	private onPan = (event: Event) => {
		if (event instanceof CustomEvent) this.Kernel.main.api.pan(event.detail);
	};
	private onZoom = (event: Event) => {
		if (event instanceof CustomEvent) this.Kernel.main.api.zoom(event.detail.factor, event.detail.origin);
	};

	private onClick = (e: Event) => {
		function isUIControl(target: HTMLElement) {
			return target.closest && (target.closest('.controls') || target.closest('button') || target.closest('input'));
		}
		if (e instanceof CustomEvent) {
			if (isUIControl(e.detail.target)) return;
			const node = this.Kernel.utilities.findNodeAt(e.detail.position);
			this.Kernel.main.hooks.onClick(node ? node.id : null);
		}
	};

	private dispose = () => {
		this.interactor.removeEventListener('pan', this.onPan);
		this.interactor.removeEventListener('zoom', this.onZoom);
		this.interactor.removeEventListener('trueClick', this.onClick);
		this.interactor.dispose();
	};
}
