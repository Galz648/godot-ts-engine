extends SceneTree
# Plays the main scene headless: holds the right arrow and passes once the player has picked up the coin.
# Run: npm run smoke. Exits 1 on failure (Godot itself exits 0 even when a scene fails to load).

const MAX_FRAMES := 300

var main: Node
var value := 0
var frames := 0

func _initialize() -> void:
	var packed := load("res://scenes/main.tscn") as PackedScene
	if packed == null:
		fail("scenes/main.tscn did not load (run npm run build)")
		return
	# headless Godot shrinks the root window to 64x64; the game expects its real size
	var view := SubViewport.new()
	view.size = Vector2i(1152, 648)
	root.add_child(view)
	main = packed.instantiate()
	view.add_child(main)
	for path in ["Player/Sprite", "Coin/Sprite"]:
		if (main.get_node(path) as Sprite2D).texture == null:
			fail("%s has no texture" % path)
			return
	value = main.get_node("Coin").get("value")
	if value == 1:
		fail("Coin.value is 1, the script's default: the value set in scene-defs/main.def.ts did not reach the scene")
		return
	var key := InputEventKey.new()
	key.physical_keycode = KEY_RIGHT
	key.pressed = true
	Input.parse_input_event(key)

func _physics_process(_delta: float) -> bool:
	if main == null:
		return true
	frames += 1
	if main.get("score") > 0:
		var label: String = main.get_node("Hud/Score").text
		if main.get("score") != value or label != "Score %d" % value:
			fail("one coin worth %d gave score %d, label \"%s\"" % [value, main.get("score"), label])
			return true
		print("SMOKE PASS: coin worth %d collected after %d frames, label \"%s\"" % [value, frames, label])
		quit(0)
		return true
	if frames >= MAX_FRAMES:
		fail("no coin after %d frames; player at %s, coin at %s" % [frames, main.get_node("Player").position, main.get_node("Coin").position])
		return true
	return false

func fail(why: String) -> void:
	print("SMOKE FAIL: ", why)
	quit(1)
