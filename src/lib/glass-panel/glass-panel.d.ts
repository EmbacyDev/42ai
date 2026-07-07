export interface GlassPanelRefreshOptions {
  skipStylesRefresh?: boolean;
  skipForceRefresh?: boolean;
}

export interface GlassPanelApi {
  init(root?: ParentNode): void;
  initPanel(panel: HTMLElement): void;
  refreshPanel(panel: HTMLElement, options?: GlassPanelRefreshOptions): void;
  refreshAll(root?: ParentNode): void;
  inspectPanelMap(panel: HTMLElement): string | null;
}

export declare const GlassPanel: GlassPanelApi;
export declare function initGlassPanels(root?: ParentNode): void;
export declare function refreshAllGlassPanels(root?: ParentNode): void;

declare global {
  interface Window {
    GlassPanel: GlassPanelApi;
    GlassCanvas?: {
      createRenderer: (canvas: HTMLCanvasElement, scene?: unknown) => unknown;
      roundedRect: (
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number
      ) => { type: "roundedRect"; x: number; y: number; width: number; height: number; radius: number };
      circle: (cx: number, cy: number, r: number) => { type: "circle"; cx: number; cy: number; r: number };
    };
  }
}

export {};
