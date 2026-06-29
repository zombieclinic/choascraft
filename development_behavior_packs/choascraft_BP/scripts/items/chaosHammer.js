import {
	EntityDamageCause,
	GameMode,
	Player,
	system
} from "@minecraft/server";

/* =========================================================
   CHAOS HAMMER CONFIG
   ========================================================= */

/* Scripted third-person smash animation */
const TPP_SMASH_ANIMATION = "animation.swing_hammer.tpp_smash";
const ANIMATION_BLEND_OUT_TIME = 0.1;

/* Right-click smash cooldown */
const USE_COOLDOWN_TICKS = 1;

/*
  Stops held right-click from firing the smash repeatedly.
*/
const HELD_USE_RELEASE_DELAY_TICKS = 8;

/* Health scaling */
const FULL_HEALTH = 20;
const LOW_HEALTH_CAP = 2;

/* Right-click smash damage */
const SMASH_MIN_DAMAGE = 1;
const SMASH_MAX_DAMAGE = 4;

/* Right-click smash knockback */
const SMASH_MIN_KNOCKBACK = 1.3;
const SMASH_MAX_KNOCKBACK = 5;

const SMASH_MIN_LIFT = 0.25;
const SMASH_MAX_LIFT = 0.85;

/* Normal left-click hammer bonus damage */
const HIT_MIN_BONUS_DAMAGE = 1;
const HIT_MAX_BONUS_DAMAGE = 15;

/* Prevents duplicate bonus damage from one melee hit */
const HIT_COOLDOWN_TICKS = 2;

/* Smash area */
const SMASH_RADIUS = 4.5;

/* Target rules */
const HIT_PLAYERS = true;
const HIT_CREATIVE_PLAYERS = false;

/* Sounds */
const PLAY_SMASH_SOUND = true;
const SMASH_SOUND = "random.anvil_land";

/* Damage cause */
const ATTACK_DAMAGE_CAUSE =
	EntityDamageCause.entityAttack ?? "entityAttack";

/* ========================================================= */

const recentUses = new Map();
const heldUseTimers = new Map();
const recentHits = new Map();

export class ChaosHammerComponent {
	onUse(event, component) {
		const player = event?.source;
		if (!(player instanceof Player)) return;

		const params = component?.params ?? {};

		system.run(() => {
			if (!player.isValid) return;

			/*
			  Minecraft can call onUse repeatedly while use is held.
			  Refresh the held lock but do not smash again.
			*/
			if (heldUseTimers.has(player.id)) {
				refreshHeldUseLock(player);
				return;
			}

			if (isOnUseCooldown(player)) return;

			refreshHeldUseLock(player);
			useChaosHammer(player, params);
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
			if (isHitOnCooldown(player, target)) return;

			const bonusDamage = getScaledValue(
				getHealth(player),
				HIT_MIN_BONUS_DAMAGE,
				HIT_MAX_BONUS_DAMAGE
			);

			damageTarget(
				target,
				bonusDamage,
				player
			);

			
		});
	}
}

/* =========================================================
   RIGHT-CLICK SMASH ATTACK
   ========================================================= */

function useChaosHammer(player, params = {}) {
	/*
	  No health cost.

	  The player gets stronger as their health gets lower.
	*/
	const health = getHealth(player);

	const damage = Math.round(
		getScaledValue(
			health,
			SMASH_MIN_DAMAGE,
			SMASH_MAX_DAMAGE
		)
	);

	const knockback = getScaledValue(
		health,
		SMASH_MIN_KNOCKBACK,
		SMASH_MAX_KNOCKBACK
	);

	const lift = getScaledValue(
		health,
		SMASH_MIN_LIFT,
		SMASH_MAX_LIFT
	);

	const smashOrigin = {
		x: player.location.x,
		y: player.location.y,
		z: player.location.z
	};

	playHammerAnimation(player, params);
	playSmashSound(player);

	/*
	  Small delay keeps the damage outside the item callback
	  and lets the animation start first.
	*/
	system.runTimeout(() => {
		if (!player.isValid) return;

		const hitCount = smashAttack(
			player,
			smashOrigin,
			damage,
			knockback,
			lift
		);

	}, 1);
}

function smashAttack(player, origin, damage, knockback, lift) {
	let targets = [];

	try {
		targets = player.dimension.getEntities({
			location: origin,
			maxDistance: SMASH_RADIUS
		});
	} catch (error) {
		return 0;
	}

	let hitCount = 0;

	for (const entity of targets) {
		if (!isValidTarget(player, entity)) continue;

		const damaged = damageTarget(entity, damage, player);

		applySmashKnockback(
			entity,
			player,
			knockback,
			lift
		);

		if (damaged) {
			hitCount++;
		}
	}

	return hitCount;
}

/* =========================================================
   TARGET FILTERING
   ========================================================= */

function isValidTarget(player, entity) {
	try {
		if (!entity?.isValid) return false;
		if (entity.id === player.id) return false;

		/*
		  Ignores dropped items, arrows, XP orbs, projectiles,
		  armor stands without health, etc.
		*/
		if (!entity.hasComponent("minecraft:health")) {
			return false;
		}

		if (entity instanceof Player) {
			if (!HIT_PLAYERS) return false;

			if (
				!HIT_CREATIVE_PLAYERS &&
				!isSurvivalPlayer(entity)
			) {
				return false;
			}
		}

		return true;
	} catch {
		return false;
	}
}

/* =========================================================
   DAMAGE / KNOCKBACK
   ========================================================= */

function damageTarget(entity, amount, player) {
	try {
		return entity.applyDamage(amount, {
			cause: ATTACK_DAMAGE_CAUSE,
			damagingEntity: player
		});
	} catch {
		try {
			return entity.applyDamage(amount, {
				cause: ATTACK_DAMAGE_CAUSE
			});
		} catch {
			try {
				return entity.applyDamage(amount);
			} catch {
				return false;
			}
		}
	}
}

function applySmashKnockback(
	entity,
	player,
	horizontalStrength,
	verticalStrength
) {
	const direction = getKnockbackDirection(entity, player);

	try {
		entity.applyKnockback(
			direction.x,
			direction.z,
			horizontalStrength,
			verticalStrength
		);
		return;
	} catch {}

	try {
		entity.applyImpulse({
			x: direction.x * horizontalStrength,
			y: verticalStrength,
			z: direction.z * horizontalStrength
		});
	} catch {}
}

function getKnockbackDirection(entity, player) {
	const dx = entity.location.x - player.location.x;
	const dz = entity.location.z - player.location.z;

	const length = Math.hypot(dx, dz);

	if (length > 0.001) {
		return {
			x: dx / length,
			z: dz / length
		};
	}

	/*
	  If a mob is exactly inside the player,
	  push it in the direction the player is facing.
	*/
	try {
		const view = player.getViewDirection();
		const viewLength = Math.hypot(view.x, view.z);

		if (viewLength > 0.001) {
			return {
				x: view.x / viewLength,
				z: view.z / viewLength
			};
		}
	} catch {}

	return { x: 0, z: 1 };
}

/* =========================================================
   HEALTH SCALING
   ========================================================= */

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

/* =========================================================
   ANIMATION / SOUND
   ========================================================= */

function playHammerAnimation(player, params = {}) {
	const animation =
		params.animation ??
		TPP_SMASH_ANIMATION;

	try {
		player.playAnimation(animation, {
			blendOutTime:
				params.blend_out_time ??
				ANIMATION_BLEND_OUT_TIME
		});

		
	} catch{}
}

function playSmashSound(player) {
	if (!PLAY_SMASH_SOUND) return;

	try {
		player.playSound(SMASH_SOUND, {
			volume: 1,
			pitch: 0.85
		});
	} catch {}
}

/* =========================================================
   COOLDOWNS / HELD USE PROTECTION
   ========================================================= */

function isOnUseCooldown(player) {
	const currentTick = system.currentTick;
	const lastUseTick = recentUses.get(player.id) ?? -9999;

	if (currentTick - lastUseTick < USE_COOLDOWN_TICKS) {
		return true;
	}

	recentUses.set(player.id, currentTick);

	system.runTimeout(() => {
		recentUses.delete(player.id);
	}, USE_COOLDOWN_TICKS + 1);

	return false;
}

function refreshHeldUseLock(player) {
	const oldTimer = heldUseTimers.get(player.id);

	if (oldTimer !== undefined) {
		try {
			system.clearRun(oldTimer);
		} catch {}
	}

	const timer = system.runTimeout(() => {
		heldUseTimers.delete(player.id);
	}, HELD_USE_RELEASE_DELAY_TICKS);

	heldUseTimers.set(player.id, timer);
}

function isHitOnCooldown(player, target) {
	const key = `${player.id}:${target.id}`;
	const currentTick = system.currentTick;
	const lastHitTick = recentHits.get(key) ?? -9999;

	if (currentTick - lastHitTick < HIT_COOLDOWN_TICKS) {
		return true;
	}

	recentHits.set(key, currentTick);

	system.runTimeout(() => {
		recentHits.delete(key);
	}, HIT_COOLDOWN_TICKS + 1);

	return false;
}