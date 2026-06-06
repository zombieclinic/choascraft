import { Player } from "@minecraft/server";

export class SporeFoodComponent {
	onConsume(event) {
		const player = event?.source;
		if (!(player instanceof Player)) return;

		try {
			for (const effect of player.getEffects()) {
				player.removeEffect(effect.typeId);
			}
		} catch {}
	}
}
