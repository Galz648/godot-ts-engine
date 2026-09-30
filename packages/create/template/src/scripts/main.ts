import { Coin } from './coin';

export class Main extends Node2D {
  @onready score_label: Label = this.get_node('Hud/Score');

  score: int = 0;

  _ready(): void {
    // Every Coin under Main counts, so a coin added to main.def.ts needs no code. Connected here, in code: a connection
    // made in the Godot editor would be lost the next time the build writes the scene, and tstogd deletes the handler stub
    // the editor adds to the .gd (see AGENTS.md).
    for (const child of this.get_children()) {
      const coin = gd.as(child, Coin);
      if (coin !== null) coin.collected.connect(this.on_coin_collected);
    }
  }

  on_coin_collected(value: int): void {
    this.score += value;
    this.score_label.text = `Score ${this.score}`;
  }
}
