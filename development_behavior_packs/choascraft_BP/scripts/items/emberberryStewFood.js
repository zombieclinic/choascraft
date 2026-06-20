import { EntityDamageCause, Player } from "@minecraft/server";

const RESISTANCE_DURATION = 600;
const HEART_DAMAGE = 2;

export class EmberberryStewFoodComponent {
	onConsume(event) {
		const player = event?.source;
		if (!(player instanceof Player)) return;

		try {
			player.addEffect("resistance", RESISTANCE_DURATION, {
				amplifier: 0,
				showParticles: true
			});
		} catch {}

		try {
			player.applyDamage(HEART_DAMAGE, { cause: EntityDamageCause.magic });
		} catch {
			try { player.applyDamage(HEART_DAMAGE); } catch {}
		}
	}
}
