import { Hook, manifest, OmniUnit } from 'omnikernel';
import type { interactionHandlerArgs } from '../../omniTypes';
import interactor from './interactor';

@manifest({ name: 'interactionHandler', dependsOn: ['dataManager', 'overlayManager', 'options'] })
export default class InteractionHandler extends OmniUnit<interactionHandlerArgs> {
	private interactor: interactor;
	private dataManager: typeof this.deps.dataManager;

	constructor(...args: interactionHandlerArgs) {
		super(...args);
		this.Kernel.register({ onClick: new Hook() }, this.facade);
		const options = this.deps.options;
		this.Kernel.register(
			{
				options: {
					interactions: {
						preventDefault: true,
						proControlSchema: false,
						zoomFactor: 0.002,
						lockControlSchema: false,
					},
				},
			},
			options,
		);
		this.dataManager = this.deps.dataManager;
		this.interactor = new interactor(
			this.dataManager.data.container(),
			this.Kernel.normalize(options.options.interactions) as Record<string, unknown>,
		);
		this.Kernel.register(
			{
				stopInteraction: this.interactor.stop,
				startInteraction: this.interactor.start,
			},
			this.facade,
		);
		this.Kernel.register(
			{
				onInteractionStart: { interactionHandler: this.interactor.stop },
				onInteractionEnd: { interactionHandler: this.interactor.start },
			},
			this.deps.overlayManager,
		);
		this.Kernel.register(
			{
				hooks: {
					onCanvasFetched: { interactionHandler: this.onFetched },
				},
			},
			this.dataManager,
		);
	}

	private onFetched = () => {
		this.interactor.addEventListener('pan', this.onPan);
		this.interactor.addEventListener('zoom', this.onZoom);
		this.interactor.addEventListener('trueClick', this.onClick);
		this.interactor.start();
	};

	private onPan = (event: Event) => {
		if (event instanceof CustomEvent) this.dataManager.api.pan(event.detail);
	};
	private onZoom = (event: Event) => {
		if (event instanceof CustomEvent) this.dataManager.api.zoom(event.detail.factor, event.detail.origin);
	};

	private onClick = (e: Event) => {
		function isUIControl(target: HTMLElement) {
			return (
				target.closest &&
				(target.closest('.controls') || target.closest('button') || target.closest('input'))
			);
		}
		if (e instanceof CustomEvent) {
			if (isUIControl(e.detail.target)) return;
			const node = this.dataManager.utilities.findNodeAt(e.detail.position);
			this.facade.onClick(node ? node.id : null);
		}
	};

	dispose = () => {
		this.interactor.removeEventListener('pan', this.onPan);
		this.interactor.removeEventListener('zoom', this.onZoom);
		this.interactor.removeEventListener('trueClick', this.onClick);
		this.interactor.dispose();
	};
}
