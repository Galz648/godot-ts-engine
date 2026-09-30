# Loads res://main.tscn and saves it to res://_resaved.tscn with Godot's own serializer
# (what the editor does on Ctrl+S). Run: godot --headless --path sample -s ../experiments/resave.gd
extends SceneTree

func _init() -> void:
	var packed: PackedScene = load("res://main.tscn")
	print("RESAVE result=", ResourceSaver.save(packed, "res://_resaved.tscn"))
	quit()
