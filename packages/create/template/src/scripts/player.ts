export class Player extends ColorRect {
  @exports speed: float = 360.0;

  _process(delta: float): void {
    let x: float = 0.0;
    let y: float = 0.0;
    if (Input.is_physical_key_pressed(Key.KEY_LEFT) || Input.is_physical_key_pressed(Key.KEY_A)) x -= 1.0;
    if (Input.is_physical_key_pressed(Key.KEY_RIGHT) || Input.is_physical_key_pressed(Key.KEY_D)) x += 1.0;
    if (Input.is_physical_key_pressed(Key.KEY_UP) || Input.is_physical_key_pressed(Key.KEY_W)) y -= 1.0;
    if (Input.is_physical_key_pressed(Key.KEY_DOWN) || Input.is_physical_key_pressed(Key.KEY_S)) y += 1.0;

    const max_x: float = this.get_viewport_rect().size.x - this.size.x;
    const max_y: float = this.get_viewport_rect().size.y - this.size.y;
    this.position.x = clampf(this.position.x + x * this.speed * delta, 0.0, max_x);
    this.position.y = clampf(this.position.y + y * this.speed * delta, 0.0, max_y);
  }
}
