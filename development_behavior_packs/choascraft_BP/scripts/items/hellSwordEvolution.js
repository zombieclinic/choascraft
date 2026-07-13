import {
	EntityDamageCause,
	EquipmentSlot,
	GameMode,
	ItemComponentTypes,
	ItemStack,
	Player,
	system,
	world
} from "@minecraft/server";

const HELL_SWORD = "zombie:hell_sword";
const CHAOS_KNIFE = "zombie:chaos_sword";
const CHAOS_DEMON_SWORD = "zombie:chaos_demon_sword";
const CHAOS_GREATSWORD = "zombie:chaos_greatsword";

const KILL_LORE_PREFIX = "Chaos Kills:";
const FORM_LORE_PREFIX = "Form:";

const KILLS_FOR_KNIFE = 10;
const KILLS_FOR_DEMON_SWORD = 20;
const KILLS_FOR_GREATSWORD = 30;

const LAST_HIT_EXPIRE_TICKS = 80;

const FULL_HEALTH = 20;
const LOW_HEALTH_CAP = 2;

const SWEEP_RANGE = 3.25;
const SWEEP_ANGLE_DEGREES = 150;
const SWEEP_VERTICAL_RANGE = 2.5;

const HIT_PLAYERS = true;
const HIT_CREATIVE_PLAYERS = false;

const ATTACK_DAMAGE_CAUSE = EntityDamageCause.entityAttack ?? "entityAttack";
const ATTACK_SOUND = "random.attack";

const FORM_STATS = {
	[HELL_SWORD]: {
		hitMinBonus: 0,
		hitMaxBonus: 2,
		sweepMinDamage: 2,
		sweepMaxDamage: 5
	},
	[CHAOS_KNIFE]: {
		hitMinBonus: 1,
		hitMaxBonus: 5,
		sweepMinDamage: 3,
		sweepMaxDamage: 8
	},
	[CHAOS_DEMON_SWORD]: {
		hitMinBonus: 2,
		hitMaxBonus: 8,
		sweepMinDamage: 4,
		sweepMaxDamage: 12
	},
	[CHAOS_GREATSWORD]: {
		hitMinBonus: 3,
		hitMaxBonus: 12,
		sweepMinDamage: 6,
		sweepMaxDamage: 18
	}
};

const lastHits = new Map();
const countedDeaths = new Set();

export class HellSwordEvolutionComponent {
	onUse(event) {
		const player = event?.source;

		if (!(player instanceof Player)) return;

		const item = event?.itemStack ?? getHeldSword(player);
		if (!isEvolutionSword(item)) return;

		system.run(() => {
			if (!isValidEntity(player)) return;
			useSwordSweep(player, item.typeId);
		});
	}

	onHitEntity(event) {
		const player = event?.attackingEntity;
		const target = event?.hitEntity;
		const item = event?.itemStack;

		if (!(player instanceof Player)) return;
		if (!isEvolutionSword(item)) return;
		if (!target?.id) return;

		lastHits.set(target.id, {
			player,
			tick: system.currentTick
		});

		system.runTimeout(() => {
			if (!isValidEntity(target)) {
				countKillOnce(target.id, player);
			}
		}, 1);

		system.run(() => {
			if (!isValidEntity(player) || !isValidEntity(target)) return;
			if (!isValidTarget(player, target)) return;
			if (event?.hadEffect === false) return;

			const stats = getFormStats(item.typeId);
			const bonusDamage = getScaledDamage(
				getHealth(player),
				stats.hitMinBonus,
				stats.hitMaxBonus
			);

			if (bonusDamage > 0) {
				damageTarget(target, bonusDamage, player);
			}
		});
	}
}

function useSwordSweep(player, itemId) {
	const stats = getFormStats(itemId);
	const damage = getScaledDamage(
		getHealth(player),
		stats.sweepMinDamage,
		stats.sweepMaxDamage
	);
	const origin = {
		x: player.location.x,
		y: player.location.y,
		z: player.location.z
	};
	const direction = player.getViewDirection();

	playAttackSound(player);

	system.runTimeout(() => {
		if (!isValidEntity(player)) return;
		performSweepAttack(player, damage, origin, direction);
	}, 1);
}

function performSweepAttack(player, damage, origin, viewDirection) {
	let targets = [];

	try {
		targets = player.dimension.getEntities({
			location: origin,
			maxDistance: SWEEP_RANGE
		});
	} catch {
		return 0;
	}

	let hitCount = 0;

	for (const target of targets) {
		if (!isValidTarget(player, target)) continue;
		if (!isInsideSweepCone(target, origin, viewDirection)) continue;

		if (damageTarget(target, damage, player)) {
			hitCount++;
		}
	}

	return hitCount;
}

world.afterEvents.entityDie.subscribe((event) => {
	const dead = event.deadEntity;
	if (!dead?.id || countedDeaths.has(dead.id)) return;

	const directPlayer = event.damageSource?.damagingEntity;
	if (directPlayer instanceof Player && tryCountKillForPlayer(dead.id, directPlayer)) {
		return;
	}

	const lastHit = lastHits.get(dead.id);
	if (!lastHit) return;
	if (system.currentTick - lastHit.tick > LAST_HIT_EXPIRE_TICKS) return;

	countKillOnce(dead.id, lastHit.player);
});

function tryCountKillForPlayer(deadEntityId, player) {
	const held = getHeldSword(player);
	if (!held) return false;

	countKillOnce(deadEntityId, player);
	return true;
}

function countKillOnce(deadEntityId, player) {
	if (countedDeaths.has(deadEntityId)) return;
	countedDeaths.add(deadEntityId);
	lastHits.delete(deadEntityId);

	system.runTimeout(() => countedDeaths.delete(deadEntityId), 40);

	if (!(player instanceof Player) || !isValidEntity(player)) return;

	const held = getHeldSword(player);
	if (!held) return;

	const kills = getKillCount(held) + 1;
	const nextItemId = getItemIdForKills(kills);
	const next = createEvolvedSwordStack(nextItemId, held, kills);

	setHeldSword(player, next);
}

function getItemIdForKills(kills) {
	if (kills >= KILLS_FOR_GREATSWORD) return CHAOS_GREATSWORD;
	if (kills >= KILLS_FOR_DEMON_SWORD) return CHAOS_DEMON_SWORD;
	if (kills >= KILLS_FOR_KNIFE) return CHAOS_KNIFE;
	return HELL_SWORD;
}

function createEvolvedSwordStack(itemId, source, kills) {
	const next = new ItemStack(itemId, 1);

	try {
		next.nameTag = source.nameTag;
	} catch {}

	copyDurability(source, next);
	copyEnchantments(source, next);

	const lore = getNonEvolutionLore(source);
	lore.push(`${KILL_LORE_PREFIX} ${kills}`);
	lore.push(`${FORM_LORE_PREFIX} ${getFormName(kills)}`);
	next.setLore(lore);

	return next;
}

function getFormName(kills) {
	if (kills >= KILLS_FOR_GREATSWORD) return "Greatsword";
	if (kills >= KILLS_FOR_DEMON_SWORD) return "Demon Sword";
	if (kills >= KILLS_FOR_KNIFE) return "Geo Knife";
	return "Hell Sword";
}

function getKillCount(itemStack) {
	try {
		for (const line of itemStack.getLore?.() ?? []) {
			const clean = stripFormatting(line);
			if (!clean.startsWith(KILL_LORE_PREFIX)) continue;

			const value = Number(clean.substring(KILL_LORE_PREFIX.length).trim());
			return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
		}
	} catch {}

	return 0;
}

function getNonEvolutionLore(itemStack) {
	try {
		return (itemStack.getLore?.() ?? []).filter(line => {
			const clean = stripFormatting(line);
			return !clean.startsWith(KILL_LORE_PREFIX) && !clean.startsWith(FORM_LORE_PREFIX);
		});
	} catch {
		return [];
	}
}

function stripFormatting(value) {
	return String(value ?? "").replace(/\u00a7./g, "");
}

function getFormStats(itemId) {
	return FORM_STATS[itemId] ?? FORM_STATS[HELL_SWORD];
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

function isInsideSweepCone(target, origin, viewDirection) {
	try {
		const targetLocation = target.location;
		const offsetX = targetLocation.x - origin.x;
		const offsetY = targetLocation.y - origin.y;
		const offsetZ = targetLocation.z - origin.z;

		if (Math.abs(offsetY) > SWEEP_VERTICAL_RANGE) return false;

		const horizontalDistance = Math.hypot(offsetX, offsetZ);
		if (horizontalDistance < 0.01 || horizontalDistance > SWEEP_RANGE) {
			return false;
		}

		const viewLength = Math.hypot(viewDirection.x, viewDirection.z);
		if (viewLength < 0.01) return false;

		const forwardX = viewDirection.x / viewLength;
		const forwardZ = viewDirection.z / viewLength;
		const targetX = offsetX / horizontalDistance;
		const targetZ = offsetZ / horizontalDistance;
		const dotProduct = forwardX * targetX + forwardZ * targetZ;
		const halfAngleRadians = (SWEEP_ANGLE_DEGREES / 2) * (Math.PI / 180);

		return dotProduct >= Math.cos(halfAngleRadians);
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

function getScaledDamage(health, minDamage, maxDamage) {
	if (health <= LOW_HEALTH_CAP) return maxDamage;
	if (health >= FULL_HEALTH) return minDamage;

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
		const health = entity.getComponent("minecraft:health");
		const current = health?.currentValue ?? health?.value;

		return typeof current === "number" ? current : FULL_HEALTH;
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

function playAttackSound(player) {
	try {
		player.playSound(ATTACK_SOUND, {
			volume: 1,
			pitch: 0.9
		});
	} catch {}
}

function copyDurability(source, target) {
	try {
		const sourceDurability = source.getComponent("minecraft:durability");
		const targetDurability = target.getComponent("minecraft:durability");

		if (sourceDurability && targetDurability) {
			targetDurability.damage = Math.min(sourceDurability.damage, targetDurability.maxDurability);
		}
	} catch {}
}

function copyEnchantments(source, target) {
	try {
		const sourceEnchantable = source.getComponent(ItemComponentTypes.Enchantable);
		const targetEnchantable = target.getComponent(ItemComponentTypes.Enchantable);
		const enchantments = sourceEnchantable?.getEnchantments?.() ?? [];

		if (targetEnchantable && enchantments.length > 0) {
			targetEnchantable.addEnchantments(enchantments);
		}
	} catch (error) {
		console.warn(`[Hell Sword] Failed to copy enchantments: ${error}`);
	}
}

function getHeldSword(player) {
	try {
		const held = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
		return isEvolutionSword(held) ? held : undefined;
	} catch {
		return undefined;
	}
}

function setHeldSword(player, itemStack) {
	try {
		player.getComponent("minecraft:equippable")?.setEquipment(EquipmentSlot.Mainhand, itemStack);
	} catch {}
}

function isEvolutionSword(itemStack) {
	return (
		itemStack?.typeId === HELL_SWORD ||
		itemStack?.typeId === CHAOS_KNIFE ||
		itemStack?.typeId === CHAOS_DEMON_SWORD ||
		itemStack?.typeId === CHAOS_GREATSWORD
	);
}

function isValidEntity(entity) {
	try {
		return !!entity && entity.isValid();
	} catch {
		try {
			return !!entity && entity.isValid;
		} catch {
			return false;
		}
	}
}
