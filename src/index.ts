import { manifest, OmniKernel, OmniUnit, Reactive, type Store } from 'omnikernel';
import CanvasViewer from '@/canvasViewer';
import DataManager from '@/dataManager';
import InteractionHandler from '@/interactionHandler';
import OverlayManager from '@/overlayManager';
import Renderer from '@/renderer';
import Utilities from '@/utilities';
import type { optionsArgs } from '../omniTypes';

export { default as Controls } from '@/controls';
export { default as DebugPanel } from '@/debugPanel';
export { default as Minimap } from '@/minimap';
export { default as MistouchPreventer } from '@/mistouchPreventer';

export class JSONCanvasViewer {
	Kernel: OmniKernel;
	constructor(options: Record<string, unknown>, modules: Array<UnitConstructor> = []) {
		const Options = this.makeOptions(options);
		const allModules: Array<UnitConstructor> = [
			OverlayManager,
			DataManager,
			CanvasViewer,
			InteractionHandler,
			Renderer,
			Utilities,
			Options,
			...modules,
		];
		this.Kernel = new OmniKernel(allModules);
		this.Kernel.bringUp();
	}

	dispose = () => this.Kernel.shutDown();
	getUnits = () => this.Kernel.getRunningUnits();

	private makeOptions(options: Record<string, unknown>) {
		return @manifest({ name: 'options' })
		class Options extends OmniUnit<optionsArgs> {
			constructor(...args: optionsArgs) {
				super(...args);
				this.Kernel.register(
					{
						container: undefined as unknown as HTMLElement,
						canvasPath: new Reactive(undefined as unknown as string),
						markdownParser: undefined as unknown as Store<(input: string) => Promise<string>>,
					},
					this.facade,
				);
				this.Kernel.registerCall(options, this.facade);
			}
		};
	}
}

/* Modules
dataManager: {
	api: {
		pan,
		zoom,
		zoomToScale,
		panToCoords,
		shiftFullscreen,
		resetView,
		loadCanvas,
	},
	hooks: {
		onToggleFullscreen,
		onCanvasFetched,
	},
	utilities: {
		middleViewer,
		findNodeAt,
	},
	data: {
		canvasData,
		nodeMap,
		canvasBaseDir,
		nodeBounds,
		offsetX,
		offsetY,
		scale,
		container,
	},
},
canvasViewer: {
	noShadow,
	refresh,
	onRefresh,
	onResize,
},
overlayManager: {
	onInteractionStart,
	onInteractionEnd,
},
interactionHandler: {
	stopInteraction,
	startInteraction,
},
*/

/* userOptions: 
container,
canvasPath,
markdownParser,
options: {
	noShadow,
	interactions: {
		preventDefault: true,
		proControlSchema: false,
		zoomFactor: 0.002,
		lockControlSchema: false,
	}
}
*/
