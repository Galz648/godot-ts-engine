# Loads res://main.tscn (or the scene named by the first user arg) and prints the tree: the headless
# stand-in for "open the scene in the editor". Run: godot --headless --path sample -s ../experiments/inspect.gd
extends SceneTree

func dump(n: Node, depth: int) -> void:
	var line := "  ".repeat(depth) + n.name + " : " + n.get_class()
	if n.get_script() != null:
		line += "  script=" + n.get_script().resource_path
	if n is Sprite2D and n.texture != null:
		line += "  texture=" + n.texture.resource_path
	if n is Node2D:
		line += "  position=" + str(n.position)
	print("TREE ", line)
	for c in n.get_children():
		dump(c, depth + 1)

func _init() -> void:
	var path := "res://main.tscn"
	for a in OS.get_cmdline_user_args():
		path = a
	var scene = load(path)
	if scene == null:
		print("TREE load failed: ", path)
	else:
		var root = scene.instantiate()
		dump(root, 0)
		root.free()
	quit()
