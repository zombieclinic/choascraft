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

const CHAOS_SPEAR = "zombie:chaos_spear";
const SPEAR_ENTITY = "zombie:chaos_spear_entity";
const DIMENSIONS = ["overworld", "nether", "the_end"];
const STORED_STACK_PROPERTY = "zc:chaos_spear_stack";
const SPEAR_MARKER_TAG = "zc:chaos_spear";
const DURABILITY_TAG_PREFIX = "zc:cs_dur_";
const ENCHANTMENT_TAG_PREFIX = "zc:cs_e_";

const THROW_SPEED = 1.75;
const THROW_UPWARD_SPEED = 0.08;
const GRAVITY = 0.055;
const MOVE_STEPS = 4;
const HIT_RADIUS = 0.85;
const PICKUP_RADIUS = 1.35;
const MAX_AGE_TICKS = 20 * 60;
const PICKUP_DELAY_TICKS = 8;
const THROW_DURABILITY_DAMAGE = 5;

const IMPACT_MIN_DAMAGE = 8;
const IMPACT_MAX_DAMAGE = 28;
const BLAST_MIN_DAMAGE = 5;
const BLAST_MAX_DAMAGE = 22;
const BLAST_RADIUS = 5.5;
const FULL_HEALTH = 20;
const LOW_HEALTH_CAP = 2;

const IMPACT_PARTICLE = "zombie:choas_particle22";
const IMPACT_SOUND = "choas_explosion";
const THROW_SOUND = "random.bow";
const PICKUP_SOUND = "random.pop";
const SPEAR_THROW_ANIMATION = "animation.demon_spear.tpp_throw";

const PROJECTILE_DAMAGE_CAUSE = EntityDamageCause.projectile ?? "projectile";
const EXPLOSION_DAMAGE_CAUSE = EntityDamageCause.entityExplosion ?? "entityExplosion";

const activeSpears = new Map();
const pendingThrows = new Set();
const chargingSpears = new Set();

export class ChaosSpearComponent {
	onUse(event, component) {
		const player = event?.source;
		if (!(player instanceof Player)) return;

		chargingSpears.add(player.id);
		playUseAnimation(player, component?.params ?? {});
	}

	onReleaseUse(event, component) {
		releaseSpear(event, component);
	}

	onStopUse(event, component) {
		releaseSpear(event, component);
	}

	onCompleteUse(event, component) {
		releaseSpear(event, component);
	}
}

system.runInterval(tickSpears, 1);
system.runInterval(adoptReloadedSpears, 20);

world.afterEvents.itemReleaseUse?.subscribe((event) => {
	if (event?.itemStack?.typeId !== CHAOS_SPEAR) return;
	releaseSpearForPlayer(event.source);
});

world.afterEvents.itemStopUse?.subscribe((event) => {
	if (event?.itemStack?.typeId !== CHAOS_SPEAR) return;
	releaseSpearForPlayer(event.source);
});

world.afterEvents.itemCompleteUse?.subscribe((event) => {
	if (event?.itemStack?.typeId !== CHAOS_SPEAR) return;
	releaseSpearForPlayer(event.source);
});

function releaseSpear(event, component) {
	const player = event?.source;
	if (!(player instanceof Player)) return;

	releaseSpearForPlayer(player, component?.params ?? {});
}

function releaseSpearForPlayer(player, params = {}) {
	if (!(player instanceof Player)) return;

	system.run(() => {
		if (!chargingSpears.has(player.id)) return;
		chargingSpears.delete(player.id);
		if (!isValidEntity(player)) return;
		throwSpear(player, params);
	});
}

function throwSpear(player, params = {}) {
	if (pendingThrows.has(player.id)) return;

	const slot = player.selectedSlotIndex;
	const spear = getSpearFromSlot(player, slot) ?? getHeldSpear(player);
	if (!spear) return;

	const direction = player.getViewDirection();
	const start = {
		x: player.location.x + direction.x * 1.25,
		y: player.location.y + 1.35 + direction.y * 0.4,
		z: player.location.z + direction.z * 1.25
	};

	const thrownStack = damageSpearForThrow(player, spear);
	pendingThrows.add(player.id);

	if (!clearSpearSlot(player, slot)) {
		pendingThrows.delete(player.id);
		return;
	}

	if (!thrownStack) {
		playSound(player.dimension, "random.break", player.location);
		pendingThrows.delete(player.id);
		return;
	}

	const savedStack = cloneSpearStack(thrownStack);
	spawnThrownSpear(player, savedStack, direction, start);
	pendingThrows.delete(player.id);
}

function spawnThrownSpear(player, savedStack, direction, start) {
	let entity;
	try {
		entity = player.dimension.spawnEntity(SPEAR_ENTITY, start);
	} catch (error) {
		console.warn(`[Chaos Spear] Failed to spawn spear: ${error}`);
		giveSpearToPlayer(player, savedStack);
		return;
	}

	activeSpears.set(entity.id, {
		entity,
		owner: player,
		ownerId: player.id,
		stack: savedStack,
		velocity: {
			x: direction.x * THROW_SPEED,
			y: direction.y * THROW_SPEED + THROW_UPWARD_SPEED,
			z: direction.z * THROW_SPEED
		},
		age: 0,
		landed: false,
		impacted: false,
		pickupTick: system.currentTick + PICKUP_DELAY_TICKS
	});

	storeSpearStack(entity, savedStack);
	faceEntity(entity, direction);
	playSound(player.dimension, THROW_SOUND, start);
}

function tickSpears() {
	if (activeSpears.size === 0) return;

	for (const [id, state] of activeSpears) {
		const spear = state.entity;

		if (!isValidEntity(spear)) {
			activeSpears.delete(id);
			continue;
		}

		state.age++;
		if (state.age > MAX_AGE_TICKS) {
			dropStoredSpear(state);
			removeSpearEntity(state);
			activeSpears.delete(id);
			continue;
		}

		if (!state.landed) {
			moveFlyingSpear(state);
			continue;
		}

		tryPickupSpear(id, state);
	}
}

function moveFlyingSpear(state) {
	const spear = state.entity;

	for (let step = 0; step < MOVE_STEPS; step++) {
		const next = {
			x: spear.location.x + state.velocity.x / MOVE_STEPS,
			y: spear.location.y + state.velocity.y / MOVE_STEPS,
			z: spear.location.z + state.velocity.z / MOVE_STEPS
		};

		const target = getSpearHitEntity(state, next);
		if (target) {
			impactSpear(state, next, target);
			return;
		}

		const block = getBlockAt(spear.dimension, next);
		const below = getBlockAt(spear.dimension, {
			x: next.x,
			y: next.y - 0.18,
			z: next.z
		});

		if (isSolidBlock(block)) {
			impactSpear(state, next);
			return;
		}

		if (state.velocity.y <= 0 && isSolidBlock(below)) {
			impactSpear(state, {
				x: next.x,
				y: Math.floor(next.y - 0.18) + 1.05,
				z: next.z
			});
			return;
		}

		if (next.y < -64 || next.y > 320) {
			impactSpear(state, next);
			return;
		}

		teleportEntity(spear, next);
		faceEntity(spear, state.velocity);
	}

	state.velocity.y -= GRAVITY;
}

function impactSpear(state, location, directTarget) {
	state.landed = true;
	state.impacted = true;
	state.velocity = { x: 0, y: 0, z: 0 };
	state.pickupTick = system.currentTick + PICKUP_DELAY_TICKS;

	teleportEntity(state.entity, location);

	if (directTarget && isValidTarget(state.owner, directTarget)) {
		damageTarget(directTarget, getScaledDamage(state.owner, IMPACT_MIN_DAMAGE, IMPACT_MAX_DAMAGE), state.owner, state.entity, PROJECTILE_DAMAGE_CAUSE);
	}

	chaosBlast(state, location, directTarget);
}

function chaosBlast(state, origin, directTarget) {
	const dimension = state.entity.dimension;
	const damage = Math.round(getScaledDamage(state.owner, BLAST_MIN_DAMAGE, BLAST_MAX_DAMAGE));

	runCommand(dimension, `particle ${IMPACT_PARTICLE} ${origin.x} ${origin.y} ${origin.z}`);
	runCommand(dimension, `execute positioned ${origin.x} ${origin.y} ${origin.z} run playsound ${IMPACT_SOUND} @a[r=54] ~ ~ ~ 1 1`);

	let targets = [];
	try {
		targets = dimension.getEntities({
			location: origin,
			maxDistance: BLAST_RADIUS
		});
	} catch {}

	for (const entity of targets) {
		if (entity.id === state.entity.id) continue;
		if (directTarget && entity.id === directTarget.id) continue;
		if (!isValidTarget(state.owner, entity)) continue;

		damageTarget(entity, damage, state.owner, state.entity, EXPLOSION_DAMAGE_CAUSE);
	}
}

function tryPickupSpear(id, state) {
	if (system.currentTick < state.pickupTick) return;

	for (const player of state.entity.dimension.getPlayers()) {
		if (distance(player.location, state.entity.location) > PICKUP_RADIUS) continue;
		if (!giveSpearToPlayer(player, state.stack)) continue;

		playSound(player.dimension, PICKUP_SOUND, player.location);
		removeSpearEntity(state);
		activeSpears.delete(id);
		return;
	}
}

function adoptReloadedSpears() {
	for (const dimensionId of DIMENSIONS) {
		let dimension;
		try {
			dimension = world.getDimension(dimensionId);
		} catch {
			continue;
		}

		let spears = [];
		try {
			spears = dimension.getEntities({ type: SPEAR_ENTITY });
		} catch {
			continue;
		}

		for (const entity of spears) {
			if (!isValidEntity(entity) || activeSpears.has(entity.id)) continue;

			activeSpears.set(entity.id, {
				entity,
				owner: undefined,
				ownerId: undefined,
				stack: readStoredSpearStack(entity),
				velocity: { x: 0, y: 0, z: 0 },
				age: 0,
				landed: true,
				impacted: true,
				pickupTick: system.currentTick
			});
		}
	}
}

function giveSpearToPlayer(player, stack) {
	const item = cloneSpearStack(stack);

	try {
		const container = player.getComponent("minecraft:inventory")?.container;
		if (!container) return false;

		const leftover = container.addItem(item);
		if (!leftover) return true;

		player.dimension.spawnItem(leftover, player.location);
		return true;
	} catch {
		try {
			player.dimension.spawnItem(item, player.location);
			return true;
		} catch {
			return false;
		}
	}
}

function dropStoredSpear(state) {
	try {
		state.entity.dimension.spawnItem(cloneSpearStack(state.stack), state.entity.location);
	} catch {}
}

function getSpearHitEntity(state, location) {
	try {
		return state.entity.dimension.getEntities({
			location,
			maxDistance: HIT_RADIUS
		}).find(entity => isValidTarget(state.owner, entity) && entity.id !== state.entity.id);
	} catch {
		return undefined;
	}
}

function isValidTarget(owner, entity) {
	try {
		if (!isValidEntity(entity)) return false;
		if (owner && entity.id === owner.id) return false;
		if (entity.typeId === SPEAR_ENTITY || entity.typeId === "minecraft:item" || entity.typeId === "minecraft:xp_orb") return false;
		if (entity instanceof Player && !entity.matches({ gameMode: GameMode.survival })) return false;
		return !!entity.getComponent("minecraft:health");
	} catch {
		return false;
	}
}

function damageTarget(target, amount, owner, projectile, cause) {
	try {
		target.applyDamage(amount, {
			cause,
			damagingEntity: owner,
			damagingProjectile: projectile
		});
	} catch {
		try {
			target.applyDamage(amount, { cause, damagingEntity: owner });
		} catch {
			try { target.applyDamage(amount); } catch {}
		}
	}
}

function getScaledDamage(entity, min, max) {
	const health = getHealth(entity);
	if (health <= LOW_HEALTH_CAP) return max;
	if (health >= FULL_HEALTH) return min;

	const missingHealthRatio = (FULL_HEALTH - health) / (FULL_HEALTH - LOW_HEALTH_CAP);
	return min + (max - min) * missingHealthRatio;
}

function getHealth(entity) {
	try {
		const health = entity?.getComponent("minecraft:health");
		const current = health?.currentValue ?? health?.value;
		return typeof current === "number" ? current : FULL_HEALTH;
	} catch {
		return FULL_HEALTH;
	}
}

function cloneSpearStack(source) {
	const next = new ItemStack(CHAOS_SPEAR, 1);
	if (!source) return next;

	try {
		next.nameTag = source.nameTag;
	} catch {}

	try {
		const lore = source.getLore?.();
		if (lore?.length) next.setLore(lore);
	} catch {}

	try {
		const sourceDurability = source.getComponent("minecraft:durability");
		const nextDurability = next.getComponent("minecraft:durability");
		if (sourceDurability && nextDurability) {
			nextDurability.damage = sourceDurability.damage;
		}
	} catch {}

	try {
		const sourceEnchantable = source.getComponent(ItemComponentTypes.Enchantable);
		const nextEnchantable = next.getComponent(ItemComponentTypes.Enchantable);
		const enchantments = sourceEnchantable?.getEnchantments?.() ?? [];
		if (nextEnchantable && enchantments.length > 0) {
			nextEnchantable.addEnchantments(enchantments);
		}
	} catch (error) {
		console.warn(`[Chaos Spear] Failed to copy enchantments: ${error}`);
	}

	return next;
}

function damageSpearForThrow(player, spear) {
	if (!(player instanceof Player)) return spear;

	try {
		if (!player.matches({ gameMode: GameMode.survival })) return spear;
	} catch {
		return spear;
	}

	try {
		const durability = spear.getComponent("minecraft:durability");
		if (!durability) return spear;

		let damage = durability.damage;
		for (let i = 0; i < THROW_DURABILITY_DAMAGE; i++) {
			if (shouldDamageItem(spear)) damage++;
		}

		if (damage >= durability.maxDurability) return undefined;

		durability.damage = damage;
		return spear;
	} catch {
		return spear;
	}
}

function shouldDamageItem(itemStack) {
	return Math.random() <= 1 / (getUnbreakingLevel(itemStack) + 1);
}

function getUnbreakingLevel(itemStack) {
	try {
		const enchantable = itemStack.getComponent(ItemComponentTypes.Enchantable);
		const enchantments = enchantable?.getEnchantments?.() ?? [];
		const unbreaking = enchantments.find(enchantment => {
			const id = String(enchantment?.type?.id ?? "").toLowerCase();
			return id === "unbreaking" || id === "minecraft:unbreaking" || id.endsWith(":unbreaking");
		});

		return unbreaking?.level ?? 0;
	} catch {
		return 0;
	}
}

function storeSpearStack(entity, stack) {
	try {
		entity.addTag(SPEAR_MARKER_TAG);
	} catch {}

	const data = serializeSpearStack(stack);

	try {
		entity.setDynamicProperty(STORED_STACK_PROPERTY, JSON.stringify(data));
	} catch {}

	try {
		const durability = data.durability;
		if (typeof durability === "number") {
			entity.addTag(`${DURABILITY_TAG_PREFIX}${durability}`);
		}

		for (const enchantment of data.enchantments) {
			const id = String(enchantment.id ?? "").replace(":", ".");
			const level = Math.max(1, Math.floor(enchantment.level ?? 1));
			if (id) entity.addTag(`${ENCHANTMENT_TAG_PREFIX}${id}_${level}`);
		}
	} catch {}
}

function readStoredSpearStack(entity) {
	const data = readStoredSpearData(entity);
	return createSpearStackFromData(data);
}

function readStoredSpearData(entity) {
	try {
		const stored = entity.getDynamicProperty(STORED_STACK_PROPERTY);
		if (typeof stored === "string" && stored.length > 0) {
			return JSON.parse(stored);
		}
	} catch {}

	const data = {
		nameTag: undefined,
		lore: [],
		durability: undefined,
		enchantments: []
	};

	try {
		for (const tag of entity.getTags()) {
			if (tag.startsWith(DURABILITY_TAG_PREFIX)) {
				const damage = Number(tag.substring(DURABILITY_TAG_PREFIX.length));
				if (Number.isFinite(damage)) data.durability = damage;
				continue;
			}

			if (tag.startsWith(ENCHANTMENT_TAG_PREFIX)) {
				const rest = tag.substring(ENCHANTMENT_TAG_PREFIX.length);
				const split = rest.lastIndexOf("_");
				if (split <= 0) continue;

				const id = rest.substring(0, split).replace(".", ":");
				const level = Number(rest.substring(split + 1));
				if (id && Number.isFinite(level)) {
					data.enchantments.push({ id, level });
				}
			}
		}
	} catch {}

	return data;
}

function serializeSpearStack(stack) {
	const data = {
		nameTag: undefined,
		lore: [],
		durability: undefined,
		enchantments: []
	};

	try {
		if (stack?.nameTag) data.nameTag = stack.nameTag;
	} catch {}

	try {
		data.lore = stack?.getLore?.() ?? [];
	} catch {}

	try {
		const durability = stack?.getComponent("minecraft:durability");
		if (durability) data.durability = durability.damage;
	} catch {}

	try {
		const enchantable = stack?.getComponent(ItemComponentTypes.Enchantable);
		data.enchantments = (enchantable?.getEnchantments?.() ?? []).map(enchantment => ({
			id: enchantment?.type?.id,
			level: enchantment?.level
		})).filter(enchantment => enchantment.id && enchantment.level);
	} catch {}

	return data;
}

function createSpearStackFromData(data = {}) {
	const stack = new ItemStack(CHAOS_SPEAR, 1);

	try {
		if (data.nameTag) stack.nameTag = data.nameTag;
	} catch {}

	try {
		if (Array.isArray(data.lore) && data.lore.length > 0) {
			stack.setLore(data.lore);
		}
	} catch {}

	try {
		const durability = stack.getComponent("minecraft:durability");
		if (durability && typeof data.durability === "number") {
			durability.damage = Math.max(0, Math.min(data.durability, durability.maxDurability));
		}
	} catch {}

	try {
		const enchantable = stack.getComponent(ItemComponentTypes.Enchantable);
		if (enchantable && Array.isArray(data.enchantments)) {
			const enchantments = data.enchantments
				.filter(enchantment => enchantment?.id && enchantment?.level)
				.map(enchantment => ({
					type: enchantment.id,
					level: enchantment.level
				}));

			if (enchantments.length > 0) {
				enchantable.addEnchantments(enchantments);
			}
		}
	} catch (error) {
		console.warn(`[Chaos Spear] Failed to restore enchantments: ${error}`);
	}

	return stack;
}

function getSpearFromSlot(player, slot) {
	if (!Number.isInteger(slot)) return undefined;

	try {
		const container = player.getComponent("minecraft:inventory")?.container;
		if (!container || slot < 0 || slot >= container.size) return undefined;

		const item = container.getItem(slot);
		return item?.typeId === CHAOS_SPEAR ? item : undefined;
	} catch {
		return undefined;
	}
}

function getHeldSpear(player) {
	try {
		const held = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
		return held?.typeId === CHAOS_SPEAR ? held : undefined;
	} catch {
		return undefined;
	}
}

function clearSpearSlot(player, slot) {
	if (Number.isInteger(slot)) {
		try {
			const container = player.getComponent("minecraft:inventory")?.container;
			if (container && slot >= 0 && slot < container.size && container.getItem(slot)?.typeId === CHAOS_SPEAR) {
				container.setItem(slot, undefined);
				return true;
			}
		} catch {}
	}

	try {
		const equippable = player.getComponent("minecraft:equippable");
		if (equippable?.getEquipment(EquipmentSlot.Mainhand)?.typeId === CHAOS_SPEAR) {
			equippable.setEquipment(EquipmentSlot.Mainhand, undefined);
			return true;
		}
	} catch {}

	return false;
}

function getBlockAt(dimension, location) {
	try {
		return dimension.getBlock({
			x: Math.floor(location.x),
			y: Math.floor(location.y),
			z: Math.floor(location.z)
		});
	} catch {
		return undefined;
	}
}

function isSolidBlock(block) {
	if (!block || block.typeId === "minecraft:air") return false;
	if (block.typeId === "minecraft:water" || block.typeId === "minecraft:flowing_water") return false;
	return true;
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

function teleportEntity(entity, location) {
	try {
		entity.teleport(location, { dimension: entity.dimension });
	} catch {}
}

function faceEntity(entity, direction) {
	const length = Math.hypot(direction.x, direction.y, direction.z) || 1;
	const facingLocation = {
		x: entity.location.x + direction.x / length,
		y: entity.location.y + direction.y / length,
		z: entity.location.z + direction.z / length
	};

	try {
		entity.teleport(entity.location, {
			dimension: entity.dimension,
			facingLocation
		});
	} catch {}
}

function removeSpearEntity(state) {
	try {
		state.entity.remove();
	} catch {
		try { state.entity.kill(); } catch {}
	}
}

function distance(a, b) {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	const dz = a.z - b.z;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function playUseAnimation(player, params = {}) {
	try {
		player.playAnimation(params.animation ?? SPEAR_THROW_ANIMATION, {
			blendOutTime: params.blend_out_time ?? 0.1
		});
	} catch {}
}

function playSound(dimension, sound, location) {
	try {
		dimension.playSound(sound, location);
	} catch {}
}

function runCommand(dimension, command) {
	try {
		dimension.runCommandAsync(command).catch(() => {});
	} catch {
		try { dimension.runCommand(command); } catch {}
	}
}
