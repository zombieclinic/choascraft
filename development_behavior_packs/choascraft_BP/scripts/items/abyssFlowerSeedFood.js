import { Player } from "@minecraft/server";

const NIGHT_VISION_DURATION = 1200;

export class AbyssFlowerSeedFoodComponent {
	onConsume(event) {
		const player = event?.source;
		if (!(player instanceof Player)) return;

		player.addEffect("night_vision", NIGHT_VISION_DURATION, {
			amplifier: 0,
			showParticles: false
		});
	}
}
