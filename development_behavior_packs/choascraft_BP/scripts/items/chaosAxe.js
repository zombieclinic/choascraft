import {
	EntityDamageCause,
	GameMode,
	Player,
	system
} from "@minecraft/server";

/* =========================================================
   CHAOS AXE CONFIG
   ========================================================= */

/* Scripted third-person animation */
const CHAOS_AXE_ANIMATION = "animation.tpp_axe_swing";
const ANIMATION_BLEND_OUT_TIME = 0.1;

/* Health scaling */
const FULL_HEALTH = 20;
const LOW_HEALTH_CAP = 2;

/* Right-click sweep damage */
const SWEEP_MIN_DAMAGE = 1;
const SWEEP_MAX_DAMAGE = 10;

/* Normal left-click melee bonus damage */
const HIT_MIN_BONUS_DAMAGE = 1;
const HIT_MAX_BONUS_DAMAGE = 15;

/* Sweep size / shape */
const SWEEP_RANGE = 3.5;
const SWEEP_ANGLE_DEGREES = 140;
const SWEEP_VERTICAL_RANGE = 2.5;

/* Target rules */
const HIT_PLAYERS = true;
const HIT_CREATIVE_PLAYERS = false;

/* Effects */
const PLAY_ATTACK_SOUND = true;
const ATTACK_SOUND = "random.attack";

/* Damage causes */
const SWEEP_DAMAGE_CAUSE =
	EntityDamageCause.entityAttack ?? "entityAttack";

const HIT_DAMAGE_CAUSE =
	EntityDamageCause.entityAttack ?? "entityAttack";

/* ========================================================= */

export class ChaosAxeComponent {
	onUse(event, component) {
		const player = event?.source;
		if (!(player instanceof Player)) return;

		const params = component?.params ?? {};

		/*
		  Run next tick so it is outside the component callback.
		*/
		system.run(() => {
			if (!player.isValid) return;

			useChaosAxe(player, params);
		});
	}

	onHitEntity(event, component) {
		const player = event?.attackingEntity;
		const target = event?.hitEntity;

		if (!(player instanceof Player)) return;
		if (!target?.isValid) return;
		if (target.id === player.id) return;

		/*
		  Normal axe hit must have actually landed.
		*/
		if (event?.hadEffect === false) return;

		system.run(() => {
			if (!player.isValid || !target.isValid) return;
			if (!isValidMeleeTarget(player, target)) return;

			const bonusDamage = getScaledDamage(
				getHealth(player),
				HIT_MIN_BONUS_DAMAGE,
				HIT_MAX_BONUS_DAMAGE
			);

			damageTarget(
				target,
				bonusDamage,
				player,
				HIT_DAMAGE_CAUSE
			);
		});
	}
}

/* =========================================================
   RIGHT-CLICK SWEEP
   ========================================================= */

function useChaosAxe(player, params = {}) {
	/*
	  No health is sacrificed.

	  The lower the player's current health, the stronger
	  the sweep attack becomes.
	*/
	const currentHealth = getHealth(player);

	const sweepDamage = getScaledDamage(
		currentHealth,
		SWEEP_MIN_DAMAGE,
		SWEEP_MAX_DAMAGE
	);

	/*
	  Save position and facing at the exact attack moment.
	*/
	const attackOrigin = {
		x: player.location.x,
		y: player.location.y,
		z: player.location.z
	};

	const attackDirection = player.getViewDirection();

	playChaosAxeAnimation(player, params);
	playAttackSound(player);

	/*
	  Wait one tick after the use action before applying damage.
	*/
	system.runTimeout(() => {
		if (!player.isValid) return;

		const hitCount = performSweepAttack(
			player,
			sweepDamage,
			attackOrigin,
			attackDirection
		);

	}, 1);
}

function performSweepAttack(player, damage, origin, viewDirection) {
	let targets = [];

	try {
		targets = player.dimension.getEntities({
			location: origin,
			maxDistance: SWEEP_RANGE
		});
	} catch (error) {
		return 0;
	}

	let hitCount = 0;

	for (const target of targets) {
		if (!isValidSweepTarget(player, target)) continue;

		if (!isInsideSweepCone(target, origin, viewDirection)) {
			continue;
		}

		if (
			damageTarget(
				target,
				damage,
				player,
				SWEEP_DAMAGE_CAUSE
			)
		) {
			hitCount++;
		}
	}

	return hitCount;
}

function isValidSweepTarget(player, target) {
	try {
		if (!target?.isValid) return false;
		if (target.id === player.id) return false;

		/*
		  Ignore dropped items, arrows, XP orbs, projectiles, etc.
		*/
		if (!target.hasComponent("minecraft:health")) {
			return false;
		}

		if (target instanceof Player) {
			if (!HIT_PLAYERS) return false;

			if (
				!HIT_CREATIVE_PLAYERS &&
				!isSurvivalPlayer(target)
			) {
				return false;
			}
		}

		return true;
	} catch {
		return false;
	}
}

function isValidMeleeTarget(player, target) {
	try {
		if (!target?.isValid) return false;
		if (target.id === player.id) return false;

		if (!target.hasComponent("minecraft:health")) {
			return false;
		}

		if (target instanceof Player) {
			if (!HIT_PLAYERS) return false;

			if (
				!HIT_CREATIVE_PLAYERS &&
				!isSurvivalPlayer(target)
			) {
				return false;
			}
		}

		return true;
	} catch {
		return false;
	}
}

function isInsideSweepCone(target, origin, viewDirection) {
	try {
		const targetLocation = target.location;

		const offsetX = targetLocation.x - origin.x;
		const offsetY = targetLocation.y - origin.y;
		const offsetZ = targetLocation.z - origin.z;

		/*
		  Prevents hitting mobs way above or under the player.
		*/
		if (Math.abs(offsetY) > SWEEP_VERTICAL_RANGE) {
			return false;
		}

		const horizontalDistance = Math.sqrt(
			offsetX * offsetX +
			offsetZ * offsetZ
		);

		if (
			horizontalDistance < 0.01 ||
			horizontalDistance > SWEEP_RANGE
		) {
			return false;
		}

		/*
		  Ignore vertical facing. The attack cone stays horizontal.
		*/
		const flatViewLength = Math.sqrt(
			viewDirection.x * viewDirection.x +
			viewDirection.z * viewDirection.z
		);

		if (flatViewLength < 0.01) {
			return false;
		}

		const forwardX = viewDirection.x / flatViewLength;
		const forwardZ = viewDirection.z / flatViewLength;

		const targetX = offsetX / horizontalDistance;
		const targetZ = offsetZ / horizontalDistance;

		const dotProduct =
			forwardX * targetX +
			forwardZ * targetZ;

		/*
		  140 total degrees means 70° left and 70° right.
		*/
		const halfAngleRadians =
			(SWEEP_ANGLE_DEGREES / 2) *
			(Math.PI / 180);

		const minimumDotProduct = Math.cos(halfAngleRadians);

		return dotProduct >= minimumDotProduct;
	} catch {
		return false;
	}
}

/* =========================================================
   DAMAGE / HEALTH
   ========================================================= */

function damageTarget(target, damage, player, cause) {
	try {
		return target.applyDamage(damage, {
			cause,
			damagingEntity: player
		});
	} catch {
		try {
			return target.applyDamage(damage, {
				cause
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

function getScaledDamage(health, minDamage, maxDamage) {
	if (health <= LOW_HEALTH_CAP) {
		return maxDamage;
	}

	if (health >= FULL_HEALTH) {
		return minDamage;
	}

	const missingHealthRatio =
		(FULL_HEALTH - health) /
		(FULL_HEALTH - LOW_HEALTH_CAP);

	return Math.round(
		minDamage +
		(maxDamage - minDamage) * missingHealthRatio
	);
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

/* =========================================================
   ANIMATION / SOUND
   ========================================================= */

function playChaosAxeAnimation(player, params = {}) {
	const animation =
		params.animation ??
		CHAOS_AXE_ANIMATION;

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
			pitch: 0.9
		});
	} catch {}
}
