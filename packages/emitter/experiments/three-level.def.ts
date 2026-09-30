import type { SceneNode } from "../tools/emit-tscn.ts";

// Main > A > B > C > E, plus D as a second child of B: parent paths at every depth.
const scene: SceneNode = {
  name: "Main",
  type: "Node2D",
  children: [
    {
      name: "A",
      type: "Node2D",
      children: [
        {
          name: "B",
          type: "Node2D",
          children: [
            { name: "C", type: "Node2D", children: [{ name: "E", type: "Node2D" }] },
            { name: "D", type: "Node2D" },
          ],
        },
      ],
    },
  ],
};

export default scene;
