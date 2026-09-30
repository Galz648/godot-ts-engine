import { Coin } from './coin';

export class Main extends Node2D {
  @onready coin: Coin = this.get_node('Coin');
  @onready score_label: Label = this.get_node('Hud/Score');

  score: int = 0;

  _ready(): void {
    // Connected here, in code: a connection made in the Godot editor would be lost the next time the build writes the
    // scene, and tstogd deletes the handler stub the editor adds to the .gd (see AGENTS.md).
    this.coin.collected.connect(this.on_coin_collected);
  }

  on_coin_collected(value: int): void {
    this.score += value;
    this.score_label.text = `Score ${this.score}`;
  }
}
