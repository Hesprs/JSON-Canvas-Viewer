export const unexpectedError = new Error(
	'[JSONCanvasViewer] This error is unexpected, probably caused by canvas file corruption. If you assure the error is not by accident, please contact the developer and show how to reproduce.',
);
export const destroyError = new Error("[JSONCanvasViewer] Resource hasn't been set up or has been disposed.");

export interface RuntimeJSONCanvasNode extends JSONCanvasNode {
	mdContent?: string;
	mdFrontmatter?: Record<string, string>;
}
