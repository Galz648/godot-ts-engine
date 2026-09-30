export class Player extends CharacterBody2D {
  @exports speed: float = 360.0;

  _physics_process(delta: float): void {
    let x: float = 0.0;
    let y: float = 0.0;
    if (Input.is_physical_key_pressed(Key.KEY_LEFT) || Input.is_physical_key_pressed(Key.KEY_A)) x -= 1.0;
    if (Input.is_physical_key_pressed(Key.KEY_RIGHT) || Input.is_physical_key_pressed(Key.KEY_D)) x += 1.0;
    if (Input.is_physical_key_pressed(Key.KEY_UP) || Input.is_physical_key_pressed(Key.KEY_W)) y -= 1.0;
    if (Input.is_physical_key_pressed(Key.KEY_DOWN) || Input.is_physical_key_pressed(Key.KEY_S)) y += 1.0;

    this.velocity = Vector2(x * this.speed, y * this.speed);
    this.move_and_slide();

    const size: Vector2 = this.get_viewport_rect().size;
    this.position.x = clampf(this.position.x, 20.0, size.x - 20.0);
    this.position.y = clampf(this.position.y, 20.0, size.y - 20.0);
  }
}
