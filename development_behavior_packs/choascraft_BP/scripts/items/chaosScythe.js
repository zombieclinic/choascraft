import {
	EntityDamageCause,
	GameMode,
	Player,
	system
} from "@minecraft/server";

const GROUND_ATTACK_ANIMATION = "animation.scythe.tpp_groundattack2";
const ANIMATION_BLEND_OUT_TIME = 0.1;

const FULL_HEALTH = 20;
const LOW_HEALTH_CAP = 2;

const GROUND_MIN_DAMAGE = 1;
const GROUND_MAX_DAMAGE = 6;

const HIT_MIN_BONUS_DAMAGE = 1;
const HIT_MAX_BONUS_DAMAGE = 8;

const POISON_MIN_DURATION_TICKS = 40;
const POISON_MAX_DURATION_TICKS = 160;
const POISON_AMPLIFIER = 0;

const GROUND_ATTACK_RADIUS = 4;
const GROUND_ATTACK_VERTICAL_RANGE = 2.5;

const HIT_PLAYERS = true;
const HIT_CREATIVE_PLAYERS = false;

const PLAY_ATTACK_SOUND = true;
const ATTACK_SOUND = "random.attack";

const ATTACK_DAMAGE_CAUSE =
	EntityDamageCause.entityAttack ?? "entityAttack";

export class ChaosScytheComponent {
	onUse(event, component) {
		const player = event?.source;
		if (!(player instanceof Player)) return;

		const params = component?.params ?? {};

		system.run(() => {
			if (!player.isValid) return;

			useChaosScythe(player, params);
		});
	}

	onHitEntity(event, component) {
		const player = event?.attackingEntity;
		const target = event?.hitEntity;

		if (!(player instanceof Player)) return;
		if (!target?.isValid) return;
		if (target.id === player.id) return;
		if (event?.hadEffect === false) return;

		system.run(() => {
			if (!player.isValid || !target.isValid) return;
			if (!isValidTarget(player, target)) return;

			const bonusDamage = Math.round(
				getScaledValue(
					getHealth(player),
					HIT_MIN_BONUS_DAMAGE,
					HIT_MAX_BONUS_DAMAGE
				)
			);

			damageTarget(target, bonusDamage, player);
		});
	}
}

function useChaosScythe(player, params = {}) {
	const health = getHealth(player);
	const damage = getScaledValue(
		health,
		GROUND_MIN_DAMAGE,
		GROUND_MAX_DAMAGE
	);
	const poisonDuration = Math.round(
		getScaledValue(
			health,
			POISON_MIN_DURATION_TICKS,
			POISON_MAX_DURATION_TICKS
		)
	);

	const origin = {
		x: player.location.x,
		y: player.location.y,
		z: player.location.z
	};

	playGroundAttackAnimation(player, params);
	playAttackSound(player);

	system.runTimeout(() => {
		if (!player.isValid) return;

		groundAttack(
			player,
			origin,
			damage,
			poisonDuration
		);
	}, 1);
}

function groundAttack(player, origin, damage, poisonDuration) {
	let targets = [];

	try {
		targets = player.dimension.getEntities({
			location: origin,
			maxDistance: GROUND_ATTACK_RADIUS
		});
	} catch {
		return 0;
	}

	let hitCount = 0;

	for (const target of targets) {
		if (!isValidTarget(player, target)) continue;
		if (Math.abs(target.location.y - origin.y) > GROUND_ATTACK_VERTICAL_RANGE) {
			continue;
		}

		if (damageTarget(target, damage, player)) {
			applyPoison(target, poisonDuration);
			hitCount++;
		}
	}

	return hitCount;
}

function isValidTarget(player, target) {
	try {
		if (!target?.isValid) return false;
		if (target.id === player.id) return false;
		if (!target.hasComponent("minecraft:health")) return false;

		if (target instanceof Player) {
			if (!HIT_PLAYERS) return false;
			if (!HIT_CREATIVE_PLAYERS && !isSurvivalPlayer(target)) {
				return false;
			}
		}

		return true;
	} catch {
		return false;
	}
}

function damageTarget(target, damage, player) {
	try {
		return target.applyDamage(damage, {
			cause: ATTACK_DAMAGE_CAUSE,
			damagingEntity: player
		});
	} catch {
		try {
			return target.applyDamage(damage, {
				cause: ATTACK_DAMAGE_CAUSE
			});
		} catch {
			try {
				return target.applyDamage(damage);
			} catch {
				return false;
			}
		}
	}
}

function applyPoison(target, duration) {
	try {
		target.addEffect("poison", duration, {
			amplifier: POISON_AMPLIFIER,
			showParticles: false
		});
	} catch {}
}

function getScaledValue(health, min, max) {
	if (health <= LOW_HEALTH_CAP) {
		return max;
	}

	if (health >= FULL_HEALTH) {
		return min;
	}

	const missingHealthRatio =
		(FULL_HEALTH - health) /
		(FULL_HEALTH - LOW_HEALTH_CAP);

	return min + (max - min) * missingHealthRatio;
}

function getHealth(entity) {
	try {
		const healthComponent =
			entity.getComponent("minecraft:health");

		const currentHealth =
			healthComponent?.currentValue ??
			healthComponent?.value;

		return typeof currentHealth === "number"
			? currentHealth
			: FULL_HEALTH;
	} catch {
		return FULL_HEALTH;
	}
}

function isSurvivalPlayer(player) {
	try {
		return player.matches({
			gameMode: GameMode.survival
		});
	} catch {
		return false;
	}
}

function playGroundAttackAnimation(player, params = {}) {
	const animation =
		params.animation ??
		GROUND_ATTACK_ANIMATION;

	if (!animation) return;

	try {
		player.playAnimation(animation, {
			blendOutTime:
				params.blend_out_time ??
				ANIMATION_BLEND_OUT_TIME
		});
	} catch {}
}

function playAttackSound(player) {
	if (!PLAY_ATTACK_SOUND) return;

	try {
		player.playSound(ATTACK_SOUND, {
			volume: 1,
			pitch: 0.85
		});
	} catch {}
}
