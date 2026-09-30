// STUB of the SceneNode type PoC 2 will provide. Replace with an import from PoC 2 when integrating.
// (Written without reading PoC 2's handover: this is the simplest shape that matches "name, type, props, children".)
export type SceneNode = {
  name: string;
  type: string;
  props?: Record<string, unknown>;
  script?: string;
  children?: SceneNode[];
};
