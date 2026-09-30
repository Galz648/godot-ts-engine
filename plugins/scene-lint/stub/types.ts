// STUB of the PoC 3 scene types. PoC 3 was not read or used: this shape is guessed from the PoC 4 handover.
import type { TexturePath } from "./registry.stub";

export interface SceneNode {
  name: string;
  type: string;
  script?: string;
  texture?: TexturePath;
  children?: SceneNode[];
}
