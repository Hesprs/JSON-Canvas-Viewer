declare global {
    interface ObsidianCanvasNode {
        id: string;
        type: 'group' | 'file' | 'text' | 'link';
        x: number;
        y: number;
        width: number;
        height: number;
        label?: string;
        background?: string;
        backgroundStyle?: 'cover' | 'ratio' | 'repeat';
        styleAttributes?: string;
        color?: string;
        text?: string;
        file?: string;
        subpath?: string;
        url?: string;
    }

    interface ObsidianCanvasEdge {
        id: string;
        fromNode: string;
        toNode: string;
        fromSide: 'right' | 'left' | 'top' | 'bottom';
        toSide: 'right' | 'left' | 'top' | 'bottom';
        toEnd?: 'arrow' | 'none';
        label?: string;
        styleAttributes?: string;
        color?: string;
    }

    interface ObsidianCanvas {
        nodes: Array<ObsidianCanvasNode>;
        edges: Array<ObsidianCanvasEdge>;
        metadata: {
            version: string;
            frontmatter: Record<string, string>;
        };
    }

    interface Coordinates {
        x: number;
        y: number;
    }

    module '*.scss?inline' {
        const content: string;
        export default content;
    }
}

export {};