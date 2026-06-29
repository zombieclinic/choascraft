import {
	EntityDamageCause,
	EquipmentSlot,
	GameMode,
	ItemComponentTypes,
	Player,
	system,
	world
} from "@minecraft/server";

const CHAOS_BOW = "zombie:chaos_bow";
const CHAOS_ARROW_ENTITY = "zombie:chaos_arrow_entity";
const CHAOS_BFC_ARROW_ENTITY = "zombie:chaos_bfc_arrow_entity";
const MIN_DAMAGE = 4;
const MAX_DAMAGE = 20;
const FULL_HEALTH = 20;
const LOW_HEALTH_CAP = 2;
const BFC_MIN_DAMAGE = 3;
const BFC_MAX_DAMAGE = 15;
const BFC_MIN_EXPLOSION_RADIUS = 3;
const BFC_MAX_EXPLOSION_RADIUS = 10;
const BFC_SOUND_RADIUS = 54;
const BFC_EXPLOSION_SOUND = "choas_explosion";
const PROJECTILE_DAMAGE_CAUSE = EntityDamageCause.projectile ?? "projectile";
const BFC_EXPLOSION_DAMAGE_CAUSE = EntityDamageCause.entityExplosion ?? "entityExplosion";
const DEFAULT_HOLD_ANIMATION = "animation.bow.tpp_fire_start";
const DEFAULT_HOLD_STOP_EXPRESSION = "query.is_using_item == false";
const explodedBfcArrows = new Set();

export class BfcBowHoldComponent {
	onUse(event, component) {
		const player = event?.source;
		if (!(player instanceof Player)) return;

		const params = component?.params ?? {};
		const animation = params.animation ?? DEFAULT_HOLD_ANIMATION;
		const stopExpression = params.stop_expression ?? DEFAULT_HOLD_STOP_EXPRESSION;
		try {
			player.playAnimation(animation, {
				stopExpression,
				blendOutTime: 0.1
			});
		} catch {}
	}
}

world.afterEvents.entitySpawn.subscribe((event) => {
	const projectile = event.entity;
	if (projectile?.typeId !== CHAOS_ARROW_ENTITY) return;

	system.run(() => damageShooterBow(projectile));
});

world.afterEvents.projectileHitEntity?.subscribe((event) => {
	const projectile = event.projectile;
	if (projectile?.typeId === CHAOS_BFC_ARROW_ENTITY) {
		chaosCrossbowExplosion(projectile, getProjectileOwner(event, projectile));
		return;
	}

	if (projectile?.typeId !== CHAOS_ARROW_ENTITY) return;

	const target = getHitEntity(event);
	const shooter = getProjectileOwner(event, projectile);
	if (!target || !shooter) return;

	const damage = getChaosArrowDamage(shooter);
	try {
		target.applyDamage(damage, {
			cause: PROJECTILE_DAMAGE_CAUSE,
			damagingEntity: shooter,
			damagingProjectile: projectile
		});
	} catch {
		try {
			target.applyDamage(damage, { cause: PROJECTILE_DAMAGE_CAUSE, damagingEntity: shooter });
		} catch {
			try { target.applyDamage(damage); } catch {}
		}
	}
});

world.afterEvents.projectileHitBlock?.subscribe((event) => {
	const projectile = event.projectile;
	if (projectile?.typeId !== CHAOS_BFC_ARROW_ENTITY) return;

	chaosCrossbowExplosion(projectile, getProjectileOwner(event, projectile));
});

export function chaosCrossbowExplosion(arrow, shooter = getProjectileOwner(undefined, arrow)) {
	if (!arrow?.dimension || explodedBfcArrows.has(arrow.id)) return;
	explodedBfcArrows.add(arrow.id);

	const dim = arrow.dimension;
	const origin = arrow.location;
	const damage = getBfcExplosionDamage(shooter);
	const radius = getBfcExplosionRadius(shooter);

	runCommand(dim, `particle zombie:choas_particle22 ${origin.x} ${origin.y} ${origin.z}`);
	runCommand(
		dim,
		`execute positioned ${origin.x} ${origin.y} ${origin.z} run playsound ${BFC_EXPLOSION_SOUND} @a[r=${BFC_SOUND_RADIUS}] ~ ~ ~ 1 1`
	);

	try {
		const targets = dim
			.getEntities({ location: origin, maxDistance: radius })
			.filter(entity => entity.id !== arrow.id);

		for (const entity of targets) {
			try {
				entity.applyDamage(damage, {
					cause: BFC_EXPLOSION_DAMAGE_CAUSE,
					damagingEntity: shooter,
					damagingProjectile: arrow
				});
			} catch {
				try {
					entity.applyDamage(damage, {
						cause: BFC_EXPLOSION_DAMAGE_CAUSE,
						damagingProjectile: arrow
					});
				} catch {
					try { entity.applyDamage(damage); } catch {}
				}
			}
		}
	} catch {}

	try {
		arrow.remove();
	} catch {
		try { arrow.kill(); } catch {}
	}

	system.runTimeout(() => explodedBfcArrows.delete(arrow.id), 20);
}

function damageShooterBow(projectile) {
	const shooter = getProjectileOwner(undefined, projectile);
	if (!(shooter instanceof Player)) return;
	if (!shooter.matches({ gameMode: GameMode.survival })) return;

	const equippable = shooter.getComponent("minecraft:equippable");
	const bow = equippable?.getEquipment(EquipmentSlot.Mainhand);
	if (bow?.typeId !== CHAOS_BOW || !bow.hasComponent("minecraft:durability")) return;
	if (!shouldDamageItem(bow)) return;

	const durability = bow.getComponent("minecraft:durability");
	if (!durability) return;

	durability.damage = Math.min(durability.damage + 1, durability.maxDurability);

	if (durability.damage >= durability.maxDurability) {
		equippable.setEquipment(EquipmentSlot.Mainhand, undefined);
		try {
			shooter.playSound("random.break", { pitch: 0.9, volume: 1.0 });
		} catch {}
		return;
	}

	equippable.setEquipment(EquipmentSlot.Mainhand, bow);
}

function shouldDamageItem(itemStack) {
	const unbreakingLevel = getUnbreakingLevel(itemStack);
	return Math.random() <= 1 / (unbreakingLevel + 1);
}

function getUnbreakingLevel(itemStack) {
	try {
		const enchantable = itemStack.getComponent(ItemComponentTypes.Enchantable);
		if (!enchantable) return 0;

		const unbreaking = enchantable
			.getEnchantments()
			.find(e => e.type.id === "unbreaking");

		return unbreaking?.level ?? 0;
	} catch {
		return 0;
	}
}

function getHitEntity(event) {
	try {
		return event.getEntityHit()?.entity;
	} catch {
		return event.hitEntity ?? event.entityHit?.entity;
	}
}

function getProjectileOwner(event, projectile) {
	try {
		return event?.source ?? projectile.getComponent("minecraft:projectile")?.owner;
	} catch {
		return event?.source;
	}
}

function runCommand(dimension, command) {
	try {
		dimension.runCommandAsync(command).catch(() => {});
	} catch {
		try { dimension.runCommand(command); } catch {}
	}
}

function getChaosArrowDamage(shooter) {
	const health = getHealth(shooter);
	if (health <= LOW_HEALTH_CAP) return MAX_DAMAGE;
	if (health >= FULL_HEALTH) return MIN_DAMAGE;

	const missingHealthRatio = (FULL_HEALTH - health) / (FULL_HEALTH - LOW_HEALTH_CAP);
	return Math.round(MIN_DAMAGE + (MAX_DAMAGE - MIN_DAMAGE) * missingHealthRatio);
}

function getBfcExplosionDamage(shooter) {
	return Math.round(scaleByMissingHealth(shooter, BFC_MIN_DAMAGE, BFC_MAX_DAMAGE));
}

function getBfcExplosionRadius(shooter) {
	return scaleByMissingHealth(shooter, BFC_MIN_EXPLOSION_RADIUS, BFC_MAX_EXPLOSION_RADIUS);
}

function scaleByMissingHealth(entity, min, max) {
	const health = getHealth(entity);
	if (health <= LOW_HEALTH_CAP) return max;
	if (health >= FULL_HEALTH) return min;

	const missingHealthRatio = (FULL_HEALTH - health) / (FULL_HEALTH - LOW_HEALTH_CAP);
	return min + (max - min) * missingHealthRatio;
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
