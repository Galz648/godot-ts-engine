export class Coin extends Area2D {
  @exports value: int = 1;

  collected = gd.signal<[value: int]>();

  _ready(): void {
    this.body_entered.connect(this.on_body_entered);
  }

  on_body_entered(body: Node2D): void {
    this.collected.emit(this.value);
    this.position = Vector2(randf_range(40.0, 1112.0), randf_range(80.0, 560.0));
  }
}
