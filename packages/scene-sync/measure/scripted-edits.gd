# The MILESTONE-1 editing session, done through Godot's own API and saved with Godot's own scene writer.
# Not the editor UI: dragging in the 2D view can add layout/anchor properties this does not.
# Run from the game root:
#   godot --headless --path . -s <abs path to this file> -- res://<in.tscn> res://<out.tscn> [noop]
# "noop" loads and saves with no edits, to separate what saving alone changes.
extends SceneTree

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var src: String = args[0]
	var dst: String = args[1]
	var noop := args.size() > 2 and args[2] == "noop"

	var root: Node = (load(src) as PackedScene).instantiate(PackedScene.GEN_EDIT_STATE_MAIN)
	if not noop:
		var ball := root.get_node("Ball") as Control
		ball.offset_left = 500

		var timer := Timer.new()
		timer.name = "Timer"
		root.add_child(timer)
		timer.owner = root

		root.get_node("Enemy").add_to_group("enemies", true)

		root.get_node("ScoreLabel").name = "Score"

		var enemy := root.get_node("Enemy")
		root.move_child(enemy, root.get_node("Player").get_index())

		var level := (load("res://scenes/lightway/level.tscn") as PackedScene).instantiate(PackedScene.GEN_EDIT_STATE_INSTANCE)
		root.add_child(level)
		level.owner = root

		# Extra, not in the seven steps: a signal connection, the other thing the model cannot hold.
		timer.connect("timeout", Callable(root, "_on_timer_timeout"), CONNECT_PERSIST)

	var packed := PackedScene.new()
	var err := packed.pack(root)
	if err == OK:
		err = ResourceSaver.save(packed, dst)
	print("saved %s (%s): %s" % [dst, "noop" if noop else "edited", error_string(err)])
	root.free()
	quit(0 if err == OK else 1)
