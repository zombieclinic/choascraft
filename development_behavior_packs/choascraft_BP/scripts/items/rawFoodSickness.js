import { Player } from "@minecraft/server";

const DEFAULT_NAUSEA_DURATION = 200;
const DEFAULT_HUNGER_DURATION = 600;
const DEFAULT_HUNGER_CHANCE = 0.8;

export class RawFoodSicknessComponent {
	onConsume(event, component) {
		const player = event?.source;
		if (!(player instanceof Player)) return;

		const params = component?.params ?? {};
		const nauseaDuration = params.nauseaDuration ?? DEFAULT_NAUSEA_DURATION;
		const hungerDuration = params.hungerDuration ?? DEFAULT_HUNGER_DURATION;
		const hungerChance = params.hungerChance ?? DEFAULT_HUNGER_CHANCE;

		player.addEffect("nausea", nauseaDuration, {
			amplifier: params.nauseaAmplifier ?? 0,
			showParticles: params.showParticles ?? true
		});

		if (Math.random() < hungerChance) {
			player.addEffect("hunger", hungerDuration, {
				amplifier: params.hungerAmplifier ?? 0,
				showParticles: params.showParticles ?? true
			});
		}
	}
}
