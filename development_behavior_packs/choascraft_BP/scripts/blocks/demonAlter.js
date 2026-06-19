import { BlockPermutation, ItemStack, system, world } from "@minecraft/server";

const ALTER_BLOCK_ID = "zombie:demon_alter";
const DEMON_SKULL = "zombie:demon_skull";
const DEMON_PENTAGRAM = "zombie:demon_pentagram";
const DEMON_BLOOD_BLOCK = "zombie:demon_blood_block";
const DEMON_FLESH_BLOCK = "zombie:demon_flesh_block";
const DEMON_BLOOD_FLESH_BLOCK = "zombie:demon_blood_flesh_block";
const CORRUPTED_XP = "zombie:currupted_xp_orb";
const XP_ORB = "minecraft:xp_orb";
const ACTIVE_TAG = "zc:demon_alter_active";
const VALID_HIT_TICKS = 100;
const VALID_ALTAR_MARK_TICKS = 160;
const XP_CONVERT_DELAY = 2;
const TRACK_RADIUS = 1.5;
const SPREAD_BLOCKS = [
	DEMON_BLOOD_BLOCK,
	DEMON_FLESH_BLOCK,
	DEMON_BLOOD_FLESH_BLOCK,
	DEMON_SKULL,
	DEMON_PENTAGRAM
];
const RITUAL_SOURCE_BLOCKS = [ALTER_BLOCK_ID, ...SPREAD_BLOCKS];
const BLOCKED_SPREAD_BLOCKS = new Set([
	"minecraft:air",
	"minecraft:bedrock",
	"minecraft:barrier",
	"minecraft:command_block",
	"minecraft:chain_command_block",
	"minecraft:repeating_command_block",
	"minecraft:structure_block",
	"minecraft:water",
	"minecraft:lava"
]);
const BLOCKED_SPREAD_KEYWORDS = [
	"redstone",
	"chest",
	"barrel",
	"shulker",
	"furnace",
	"smoker",
	"blast_furnace",
	"hopper",
	"dispenser",
	"dropper",
	"crafter",
	"lectern",
	"beacon",
	"anvil",
	"enchanting_table",
	"brewing_stand",
	"cauldron",
	"comparator",
	"repeater",
	"observer",
	"piston",
	"lever",
	"button",
	"pressure_plate",
	"door",
	"trapdoor",
	"fence",
	"gate",
	"rail",
	"sign",
	"banner",
	"torch",
	"lantern",
	"candle",
	"bed",
	"bell",
	"skull",
	"head",
	"pot",
	"frame",
	"stand",
	"wire",
	"tripwire",
	"sculk_sensor",
	"daylight_detector",
	"target"
];

const activeAltars = new Map();
const entityAltars = new Map();
const trackedEntities = new Map();
const lastPlayerHits = new Map();

export class DemonAlterComponent {
	onStepOn(event) {
		activateAlter(event.block, event.entity);
	}

	onEntityFallOn(event) {
		activateAlter(event.block, event.entity);
	}

	onStepOff(event) {
		queueRefresh(event.block);
	}

	onTick(event) {
		refreshAlter(event.block);
	}
}

world.afterEvents.entityHurt.subscribe((event) => {
	const entity = event.hurtEntity;
	if (!isValid(entity) || !isNearPoweredAltar(entity)) return;

	const player = event.damageSource?.damagingEntity;
	if (!player || player.typeId !== "minecraft:player") return;
	if (isProjectileDamage(event.damageSource)) return;

	trackNearPoweredAltar(entity);
	lastPlayerHits.set(entity.id, {
		tick: system.currentTick
	});
});

world.afterEvents.entityDie.subscribe((event) => {
	const entity = event.deadEntity;
	if (!entity) return;

	const altar = entityAltars.get(entity.id) ?? findNearbyPoweredAltar(entity);
	if (!altar || isExpiredAltarMark(altar)) {
		clearEntityTracking(entity.id);
		return;
	}

	if (!hadRecentPlayerHit(entity) && !isDirectPlayerKill(event.damageSource)) {
		clearEntityTracking(entity.id);
		return;
	}

	const location = {
		x: entity.location.x,
		y: entity.location.y + 0.25,
		z: entity.location.z
	};
	const dimension = entity.dimension;

	system.runTimeout(() => convertXp(dimension, location), XP_CONVERT_DELAY);
	spreadAlterBlocks(dimension, altar);
	clearEntityTracking(entity.id);
});

function activateAlter(block, entity) {
	if (!block || !isTrackableMob(entity) || !isPowered(block)) return;
	if (!isOnBlock(entity, block)) return;

	const key = blockKey(block);
	activeAltars.set(key, blockLocationData(block));
	trackEntityToAltar(entity, activeAltars.get(key));
	refreshAlter(block);
}

function queueRefresh(block) {
	if (!block) return;
	system.run(() => refreshAlter(block));
}

function refreshAlter(block) {
	if (!block || block.typeId !== ALTER_BLOCK_ID) return;

	const key = blockKey(block);
	const entities = findMobsOnAlter(block);

	if (!isPowered(block)) {
		activeAltars.delete(key);
		pruneExpiredTracking();
		return;
	}

	activeAltars.set(key, blockLocationData(block));
	for (const entity of entities) trackEntityToAltar(entity, activeAltars.get(key));
	pruneExpiredTracking();
}

function findMobsOnAlter(block) {
	try {
		return block.dimension.getEntities({
			location: { x: block.location.x + 0.5, y: block.location.y + 1, z: block.location.z + 0.5 },
			maxDistance: TRACK_RADIUS
		}).filter(entity => isTrackableMob(entity) && isNearBlock(entity, block));
	} catch {
		return [];
	}
}

function trackEntityToAltar(entity, altar) {
	if (!altar) return;
	try { entity.addTag(ACTIVE_TAG); } catch {}
	trackedEntities.set(entity.id, entity);
	entityAltars.set(entity.id, {
		...altar,
		markTick: system.currentTick
	});
}

function clearEntityTracking(entityId) {
	const entity = trackedEntities.get(entityId);
	if (isValid(entity)) {
		try { entity.removeTag(ACTIVE_TAG); } catch {}
	}

	trackedEntities.delete(entityId);
	entityAltars.delete(entityId);
	lastPlayerHits.delete(entityId);
}

function pruneExpiredTracking() {
	for (const [entityId, altar] of entityAltars) {
		if (!isExpiredAltarMark(altar)) continue;
		clearEntityTracking(entityId);
	}
}

function isExpiredAltarMark(altar) {
	const markTick = altar?.markTick ?? system.currentTick;
	return system.currentTick - markTick > VALID_ALTAR_MARK_TICKS;
}

function convertXp(dimension, location) {
	let converted = 0;

	try {
		const orbs = dimension.getEntities({
			type: XP_ORB,
			location,
			maxDistance: 4
		});

		for (const orb of orbs) {
			if (!isValid(orb)) continue;
			converted++;
			try { orb.remove(); } catch { try { orb.kill(); } catch {} }
		}
	} catch {}

	if (converted <= 0) converted = 1;

	try {
		dimension.spawnItem(new ItemStack(CORRUPTED_XP, Math.min(converted, 64)), location);
	} catch {}
}

function spreadAlterBlocks(dimension, altar) {
	const candidates = findSpreadCandidates(dimension, altar);
	const amount = Math.min(candidates.length, 1 + Math.floor(Math.random() * 2));

	for (let i = 0; i < amount; i++) {
		const index = Math.floor(Math.random() * candidates.length);
		const target = candidates.splice(index, 1)[0];
		placeSpreadBlock(target, i);
	}
}

function findSpreadCandidates(dimension, altar) {
	const candidates = [];
	const seen = new Set();

	for (const source of getSpreadSources(dimension, altar)) {
		for (const offset of [
			{ x: 1, z: 0 },
			{ x: -1, z: 0 },
			{ x: 0, z: 1 },
			{ x: 0, z: -1 }
		]) {
			const location = {
				x: source.x + offset.x,
				y: source.y,
				z: source.z + offset.z
			};
			const key = `${location.x},${location.y},${location.z}`;
			if (seen.has(key)) continue;
			seen.add(key);

			const block = getBlock(dimension, location);
			if (canSpreadTo(block)) candidates.push(block);
		}
	}

	return candidates;
}

function getSpreadSources(dimension, altar) {
	const sources = [];
	const radius = 12;
	const floorY = altar.y - 1;

	for (let x = altar.x - radius; x <= altar.x + radius; x++) {
		for (let z = altar.z - radius; z <= altar.z + radius; z++) {
			for (const y of [floorY, altar.y]) {
				const block = getBlock(dimension, { x, y, z });
				if (!block || !RITUAL_SOURCE_BLOCKS.includes(block.typeId)) continue;

				sources.push({
					x,
					y: block.typeId === ALTER_BLOCK_ID ? floorY : y,
					z
				});
			}
		}
	}

	return sources.length > 0 ? sources : [{ x: altar.x, y: floorY, z: altar.z }];
}

function canSpreadTo(block) {
	if (!block || RITUAL_SOURCE_BLOCKS.includes(block.typeId)) return false;
	if (BLOCKED_SPREAD_BLOCKS.has(block.typeId)) return false;
	if (isProtectedSpreadBlock(block)) return false;
	try {
		if (block.isAir || block.isLiquid) return false;
	} catch {}
	return true;
}

function isProtectedSpreadBlock(block) {
	const id = block.typeId;
	if (BLOCKED_SPREAD_KEYWORDS.some(keyword => id.includes(keyword))) return true;

	try {
		if (block.getComponent("minecraft:inventory")) return true;
	} catch {}

	try {
		if (block.getComponent("inventory")) return true;
	} catch {}

	return false;
}

function placeSpreadBlock(block, index) {
	const id = chooseRitualBlock(index);
	try {
		block.setPermutation(BlockPermutation.resolve(id));
	} catch {
		try { block.setType(id); } catch {}
	}
}

function chooseRitualBlock(index = 0) {
	if (index === 0 && Math.random() < 0.7) return DEMON_BLOOD_BLOCK;

	const roll = Math.random();
	if (roll < 0.35) return DEMON_BLOOD_BLOCK;
	if (roll < 0.6) return DEMON_BLOOD_FLESH_BLOCK;
	if (roll < 0.8) return DEMON_FLESH_BLOCK;
	if (roll < 0.9) return DEMON_SKULL;
	return DEMON_PENTAGRAM;
}

function getBlock(dimension, location) {
	try {
		return dimension.getBlock(location);
	} catch {
		return undefined;
	}
}

function hadRecentPlayerHit(entity) {
	const hit = lastPlayerHits.get(entity.id);
	if (!hit) return false;
	return system.currentTick - hit.tick <= VALID_HIT_TICKS;
}

function isDirectPlayerKill(source) {
	const player = source?.damagingEntity;
	return player?.typeId === "minecraft:player" && !isProjectileDamage(source);
}

function isTrackableMob(entity) {
	if (!isValid(entity)) return false;
	if (entity.typeId === "minecraft:player") return false;
	if (entity.typeId === XP_ORB || entity.typeId === "minecraft:item") return false;
	return true;
}

function isValid(entity) {
	if (!entity) return false;
	if (typeof entity.isValid === "function") return entity.isValid();
	return entity.isValid !== false;
}

function hasTag(entity, tag) {
	try {
		return entity.hasTag(tag);
	} catch {
		return false;
	}
}

function isOnBlock(entity, block) {
	return isNearBlock(entity, block);
}

function isNearBlock(entity, block) {
	return isNearAltarLocation(entity.location, blockLocationData(block));
}

function isNearAltarLocation(location, altar) {
	const centerX = altar.x + 0.5;
	const centerZ = altar.z + 0.5;
	const dx = location.x - centerX;
	const dz = location.z - centerZ;

	return dx * dx + dz * dz <= TRACK_RADIUS * TRACK_RADIUS
		&& location.y >= altar.y - 0.5
		&& location.y < altar.y + 2.5;
}

function isNearPoweredAltar(entity) {
	return !!findNearbyPoweredAltar(entity);
}

function trackNearPoweredAltar(entity) {
	const altar = findNearbyPoweredAltar(entity);
	if (altar) trackEntityToAltar(entity, altar);
}

function findNearbyPoweredAltar(entity) {
	if (!isValid(entity)) return undefined;

	const base = {
		x: Math.floor(entity.location.x),
		y: Math.floor(entity.location.y),
		z: Math.floor(entity.location.z)
	};

	for (let y = base.y - 1; y <= base.y + 1; y++) {
		for (let x = base.x - 1; x <= base.x + 1; x++) {
			for (let z = base.z - 1; z <= base.z + 1; z++) {
				const block = getBlock(entity.dimension, { x, y, z });
				if (!block || block.typeId !== ALTER_BLOCK_ID || !isPowered(block)) continue;
				const altar = blockLocationData(block);
				if (isNearAltarLocation(entity.location, altar)) {
					activeAltars.set(altar.key, altar);
					return altar;
				}
			}
		}
	}

	return undefined;
}

function isPowered(block) {
	try {
		if (typeof block.getRedstonePower === "function") {
			return (block.getRedstonePower() ?? 0) > 0;
		}
	} catch {}

	for (const offset of [
		{ x: 0, y: 1, z: 0 },
		{ x: 0, y: -1, z: 0 },
		{ x: 1, y: 0, z: 0 },
		{ x: -1, y: 0, z: 0 },
		{ x: 0, y: 0, z: 1 },
		{ x: 0, y: 0, z: -1 }
	]) {
		const neighbor = getRelativeBlock(block, offset);
		if (isPowerSource(neighbor)) return true;
	}

	return false;
}

function getRelativeBlock(block, offset) {
	try {
		return block.dimension.getBlock({
			x: block.location.x + offset.x,
			y: block.location.y + offset.y,
			z: block.location.z + offset.z
		});
	} catch {
		return undefined;
	}
}

function isPowerSource(block) {
	if (!block) return false;
	if (block.typeId === "minecraft:redstone_block") return true;

	for (const state of ["powered_bit", "open_bit", "minecraft:powered_bit", "zombie:powered"]) {
		try {
			if (block.permutation.getState(state) === true) return true;
		} catch {}
	}

	try {
		const signal = block.permutation.getState("redstone_signal");
		if (typeof signal === "number" && signal > 0) return true;
	} catch {}

	return false;
}

function isProjectileDamage(source) {
	const cause = `${source?.cause ?? ""}`.toLowerCase();
	if (cause.includes("projectile") || cause.includes("thrown")) return true;

	const damagingEntity = source?.damagingEntity;
	return damagingEntity && damagingEntity.typeId !== "minecraft:player";
}

function blockLocationData(block) {
	const key = blockKey(block);
	return {
		key,
		dimensionId: block.dimension.id,
		x: block.location.x,
		y: block.location.y,
		z: block.location.z
	};
}

function blockKey(block) {
	return `${block.dimension.id}:${block.location.x},${block.location.y},${block.location.z}`;
}
