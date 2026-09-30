import { Textures, type TexturePath } from "./registry.gen";

function sprite(texture: TexturePath) {}

sprite(Textures.ball);
sprite("res://art/ball.png");
