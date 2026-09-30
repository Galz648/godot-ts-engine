# Loads a scene and compares it, node by node and property by property, with the JSON exported from its TypeScript tree.
# Normally run by verify.ts. By hand, from the game root:
#   godot --headless --path . -s <abs path to this file> -- res://scenes/x.tscn /abs/path/expected.json
extends SceneTree

var checks := 0
var problems: Array[String] = []

func same(actual, expected_kind: String, expected, entry: Dictionary, where: String) -> void:
	checks += 1
	match expected_kind:
		"number":
			if not (typeof(actual) in [TYPE_INT, TYPE_FLOAT]) or not is_equal_approx(float(actual), float(expected)):
				problems.append("%s: expected number %s, got %s" % [where, expected, actual])
		"bool", "string":
			if actual != expected:
				problems.append("%s: expected %s, got %s" % [where, expected, actual])
		"raw":
			var want = str_to_var(expected)
			if typeof(actual) != typeof(want) or actual != want:
				problems.append("%s: expected %s (%s), got %s" % [where, want, expected, actual])
		"ext":
			if actual == null or not (actual is Resource) or actual.resource_path != expected:
				problems.append("%s: expected resource %s, got %s" % [where, expected, actual])
		"sub":
			if actual == null or not (actual is Resource) or actual.get_class() != entry["type"]:
				problems.append("%s: expected a %s resource, got %s" % [where, entry["type"], actual])
			else:
				for p in entry["props"]:
					same(actual.get(p["key"]), p["kind"], p.get("value"), p, where + "." + p["key"])

func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var expected: Array = JSON.parse_string(FileAccess.get_file_as_string(args[1]))
	var root: Node = load(args[0]).instantiate()
	var seen := {}
	for e in expected:
		var node: Node = root if e["path"] == "." else root.get_node_or_null(e["path"])
		if node == null:
			problems.append("%s: node missing" % e["path"])
			continue
		seen[node] = true
		checks += 1
		if node.get_class() != e["type"]:
			problems.append("%s: expected class %s, got %s" % [e["path"], e["type"], node.get_class()])
		checks += 1
		var script_path = node.get_script().resource_path if node.get_script() != null else null
		if script_path != e["script"]:
			problems.append("%s: expected script %s, got %s" % [e["path"], e["script"], script_path])
		for p in e["props"]:
			same(node.get(p["key"]), p["kind"], p.get("value"), p, "%s.%s" % [e["path"], p["key"]])
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		checks += 1
		if not seen.has(n):
			problems.append("%s: node present in Godot but not in the tree" % root.get_path_to(n))
		stack.append_array(n.get_children())
	print("VERIFY nodes_expected=", expected.size(), " checks=", checks, " problems=", problems.size())
	for p in problems.slice(0, 15):
		print("VERIFY PROBLEM ", p)
	root.free()
	quit()
