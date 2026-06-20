import { BlockPermutation, ItemStack, system } from "@minecraft/server";

const ALTER_BLOCK_ID = "zombie:demon_alter";
const DEMON_SKULL = "zombie:demon_skull";
const DEMON_PENTAGRAM = "zombie:demon_pentagram";
const DEMON_BLOOD_BLOCK = "zombie:demon_blood_block";
const DEMON_FLESH_BLOCK = "zombie:demon_flesh_block";
const DEMON_BLOOD_FLESH_BLOCK = "zombie:demon_blood_flesh_block";
const CORRUPTED_XP = "zombie:currupted_xp_orb";
const XP_ORB = "minecraft:xp_orb";

const SEARCH_RADIUS = 2;
const SACRIFICE_HEIGHT = 3;

const SPREAD_PER_SACRIFICE = 4;
const XP_CONVERT_DELAY = 2;

const ROOM_SIZE = 32;
const ROOM_MIN_OFFSET = -16;
const ROOM_MAX_OFFSET = 15;
const ROOM_FLOOR_DEPTH = 4;
const ROOM_HEIGHT = 8;
const ROOM_BUILD_MIN = 20;
const ROOM_BUILD_MAX = 20;
const SUPPORT_RADIUS = 1;

const SPREAD_RADIUS = 12;
const SOURCE_TRIES = 80;
const SPREAD_TRIES = 80;
const MAX_SOURCES = 20;

const poweredAltars = new Set();
const altarRooms = new Map();

const SPREAD_BLOCKS = [
	DEMON_BLOOD_BLOCK,
	DEMON_FLESH_BLOCK,
	DEMON_BLOOD_FLESH_BLOCK,
	DEMON_SKULL,
	DEMON_PENTAGRAM
];

const RITUAL_SOURCE_BLOCKS = new Set([ALTER_BLOCK_ID, ...SPREAD_BLOCKS]);

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

const NATURAL_ROOM_BLOCKS = new Set([
	"minecraft:air",
	"minecraft:cave_air",
	"minecraft:void_air",
	"minecraft:dirt",
	"minecraft:grass_block",
	"minecraft:stone",
	"minecraft:deepslate",
	"minecraft:granite",
	"minecraft:diorite",
	"minecraft:andesite",
	"minecraft:tuff",
	"minecraft:calcite",
	"minecraft:gravel",
	"minecraft:sand",
	"minecraft:red_sand",
	"minecraft:clay"
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

export class DemonAlterComponent {
	onRedstoneUpdate(event) {
		const block = event.block;
		if (!block || block.typeId !== ALTER_BLOCK_ID) return;

		const key = blockKey(block);
		const power = event.powerLevel ?? event.power ?? 0;

		if (power <= 0) {
			poweredAltars.delete(key);
			return;
		}

		if (poweredAltars.has(key)) return;

		poweredAltars.add(key);
		sacrificeAtAlter(block);

		// fallback reset so button can trigger again
		system.runTimeout(() => {
			poweredAltars.delete(key);
		}, 30);
	}
}

function sacrificeAtAlter(block) {
	if (!block || block.typeId !== ALTER_BLOCK_ID) return false;

	const sacrifice = findSacrificeEntity(block);
	if (!sacrifice) return false;

	const dimension = block.dimension;
	const altar = blockLocationData(block);

	const sacrificeLocation = {
		x: sacrifice.location.x,
		y: sacrifice.location.y + 0.25,
		z: sacrifice.location.z
	};

	if (!killEntity(sacrifice)) return false;

	system.runTimeout(() => {
		convertXp(dimension, sacrificeLocation);
	}, XP_CONVERT_DELAY);

	if (!advanceAlterRoom(dimension, altar)) {
		spreadAlterBlocks(dimension, altar);
	}
	return true;
}

function advanceAlterRoom(dimension, altar) {
	const key = altarKey(altar);
	let room = altarRooms.get(key);

	if (!room) {
		room = createAlterRoomPlan(dimension, altar);
		altarRooms.set(key, room);
	}

	if (room.done) return false;

	let placed = 0;
	const blocksThisSacrifice = randomInt(ROOM_BUILD_MIN, ROOM_BUILD_MAX);
	while (room.index < room.steps.length && placed < blocksThisSacrifice) {
		const step = room.steps[room.index++];
		if (applyRoomStep(dimension, step)) placed++;
	}

	if (room.index >= room.steps.length) room.done = true;
	return true;
}

function createAlterRoomPlan(dimension, altar) {
	const steps = [];
	const floorY = altar.y - ROOM_FLOOR_DEPTH;
	const ceilingY = floorY + ROOM_HEIGHT;
	const clearTopY = ceilingY - 1;

	queueAlterSupportTower(steps, dimension, altar, floorY);
	queueRoomFloor(steps, dimension, altar, floorY);
	queueRoomClear(steps, dimension, altar, floorY + 1, clearTopY);
	queueRoomWalls(steps, dimension, altar, floorY + 1, ceilingY - 1);
	queueRoomCeiling(steps, dimension, altar, ceilingY);

	return {
		index: 0,
		done: steps.length === 0,
		steps
	};
}

function queueAlterSupportTower(steps, dimension, altar, floorY) {
	for (let y = floorY; y < altar.y; y++) {
		for (let dx = -SUPPORT_RADIUS; dx <= SUPPORT_RADIUS; dx++) {
			for (let dz = -SUPPORT_RADIUS; dz <= SUPPORT_RADIUS; dz++) {
				const id = Math.abs(dx) === Math.abs(dz) ? DEMON_SKULL : DEMON_PENTAGRAM;
				queueRoomSet(steps, dimension, {
					x: altar.x + dx,
					y,
					z: altar.z + dz
				}, id);
			}
		}
	}
}

function queueRoomFloor(steps, dimension, altar, y) {
	forEachRoomXZ(altar, (x, z, dx, dz) => {
		if (isSupportColumn(dx, dz)) return;
		queueRoomSet(steps, dimension, { x, y, z }, DEMON_BLOOD_FLESH_BLOCK);
	});
}

function queueRoomClear(steps, dimension, altar, minY, maxY) {
	for (let y = minY; y <= maxY; y++) {
		forEachRoomXZ(altar, (x, z, dx, dz) => {
			if (x === altar.x && y === altar.y && z === altar.z) return;
			if (isRoomEdge(dx, dz)) return;
			if (y < altar.y && isSupportColumn(dx, dz)) return;
			queueRoomClearBlock(steps, dimension, { x, y, z });
		});
	}
}

function queueRoomWalls(steps, dimension, altar, minY, maxY) {
	for (let y = minY; y <= maxY; y++) {
		forEachRoomXZ(altar, (x, z, dx, dz) => {
			if (!isRoomEdge(dx, dz)) return;
			queueRoomSet(steps, dimension, { x, y, z }, DEMON_FLESH_BLOCK);
		});
	}
}

function queueRoomCeiling(steps, dimension, altar, y) {
	forEachRoomXZ(altar, (x, z) => {
		queueRoomSet(steps, dimension, { x, y, z }, DEMON_FLESH_BLOCK);
	});
}

function queueRoomSet(steps, dimension, location, targetId) {
	const block = getBlock(dimension, location);
	if (!canPlanRoomChange(block)) return;
	steps.push(roomStep(location, block.typeId, targetId));
}

function queueRoomClearBlock(steps, dimension, location) {
	const block = getBlock(dimension, location);
	if (!canPlanRoomClear(block)) return;
	steps.push(roomStep(location, block.typeId, "minecraft:air"));
}

function roomStep(location, originalId, targetId) {
	return {
		x: location.x,
		y: location.y,
		z: location.z,
		originalId,
		targetId
	};
}

function applyRoomStep(dimension, step) {
	const block = getBlock(dimension, step);
	if (!block) return false;
	if (block.typeId === step.targetId) return false;
	if (block.typeId !== step.originalId) return false;
	if (block.typeId === ALTER_BLOCK_ID) return false;
	if (step.targetId === "minecraft:air" && block.typeId.includes("air")) return false;

	try {
		block.setPermutation(BlockPermutation.resolve(step.targetId));
		return true;
	} catch {
		try {
			block.setType(step.targetId);
			return true;
		} catch {
			return false;
		}
	}
}

function canPlanRoomChange(block) {
	if (!block) return false;
	if (block.typeId === ALTER_BLOCK_ID) return false;
	if (RITUAL_SOURCE_BLOCKS.has(block.typeId)) return true;
	if (!NATURAL_ROOM_BLOCKS.has(block.typeId)) return false;
	return !isProtectedSpreadBlock(block);
}

function canPlanRoomClear(block) {
	if (!block || block.typeId === ALTER_BLOCK_ID) return false;
	if (!NATURAL_ROOM_BLOCKS.has(block.typeId)) return false;
	if (block.typeId.includes("air")) return false;
	return !isProtectedSpreadBlock(block);
}

function forEachRoomXZ(altar, callback) {
	for (let dx = ROOM_MIN_OFFSET; dx <= ROOM_MAX_OFFSET; dx++) {
		for (let dz = ROOM_MIN_OFFSET; dz <= ROOM_MAX_OFFSET; dz++) {
			callback(altar.x + dx, altar.z + dz, dx, dz);
		}
	}
}

function isSupportColumn(dx, dz) {
	return Math.abs(dx) <= SUPPORT_RADIUS && Math.abs(dz) <= SUPPORT_RADIUS;
}

function isRoomEdge(dx, dz) {
	return dx === ROOM_MIN_OFFSET || dx === ROOM_MAX_OFFSET ||
		dz === ROOM_MIN_OFFSET || dz === ROOM_MAX_OFFSET;
}

function altarKey(altar) {
	return `${altar.dimensionId}:${altar.x},${altar.y},${altar.z}`;
}
function findSacrificeEntity(block) {
	try {
		const entities = block.dimension.getEntities({
			location: {
				x: block.location.x + 0.5,
				y: block.location.y + 1.5,
				z: block.location.z + 0.5
			},
			maxDistance: SEARCH_RADIUS
		});

		return entities.find(entity =>
			isSacrificeEntity(entity) &&
			isInsideSacrificeColumn(entity.location, block)
		);
	} catch {
		return undefined;
	}
}

function isSacrificeEntity(entity) {
	if (!isValid(entity)) return false;
	if (entity.typeId === XP_ORB) return false;
	if (entity.typeId === "minecraft:item") return false;
	return true;
}

function isInsideSacrificeColumn(location, block) {
	return (
		location.x >= block.location.x &&
		location.x < block.location.x + 1 &&
		location.z >= block.location.z &&
		location.z < block.location.z + 1 &&
		location.y >= block.location.y &&
		location.y < block.location.y + SACRIFICE_HEIGHT
	);
}

function killEntity(entity) {
	try {
		entity.kill();
		return true;
	} catch {
		try {
			entity.remove();
			return true;
		} catch {
			return false;
		}
	}
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

			try {
				orb.remove();
			} catch {
				try {
					orb.kill();
				} catch {}
			}
		}
	} catch {}

	if (converted <= 0) converted = 1;

	try {
		dimension.spawnItem(
			new ItemStack(CORRUPTED_XP, Math.min(converted, 64)),
			location
		);
	} catch {}
}

function spreadAlterBlocks(dimension, altar) {
	const candidates = findSpreadCandidates(dimension, altar);
	const amount = Math.min(candidates.length, SPREAD_PER_SACRIFICE);

	for (let i = 0; i < amount; i++) {
		const index = Math.floor(Math.random() * candidates.length);
		const target = candidates.splice(index, 1)[0];
		placeSpreadBlock(target, i);
	}
}

function findSpreadCandidates(dimension, altar) {
	const candidates = [];
	const seen = new Set();
	const sources = getSpreadSourcesFast(dimension, altar);

	for (
		let i = 0;
		i < SPREAD_TRIES && candidates.length < SPREAD_PER_SACRIFICE;
		i++
	) {
		const source = sources[Math.floor(Math.random() * sources.length)];
		const offset = randomSideOffset();

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

	return candidates;
}

function getSpreadSourcesFast(dimension, altar) {
	const sources = [];
	const seen = new Set();
	const floorY = altar.y - 1;

	addSource(sources, seen, {
		x: altar.x,
		y: floorY,
		z: altar.z
	});

	for (
		let i = 0;
		i < SOURCE_TRIES && sources.length < MAX_SOURCES;
		i++
	) {
		const x = altar.x + randomInt(-SPREAD_RADIUS, SPREAD_RADIUS);
		const z = altar.z + randomInt(-SPREAD_RADIUS, SPREAD_RADIUS);

		for (const y of [floorY, altar.y]) {
			const block = getBlock(dimension, { x, y, z });
			if (!block || !RITUAL_SOURCE_BLOCKS.has(block.typeId)) continue;

			addSource(sources, seen, {
				x,
				y: block.typeId === ALTER_BLOCK_ID ? floorY : y,
				z
			});
		}
	}

	return sources;
}

function addSource(sources, seen, source) {
	const key = `${source.x},${source.y},${source.z}`;
	if (seen.has(key)) return;

	seen.add(key);
	sources.push(source);
}

function randomSideOffset() {
	const offsets = [
		{ x: 1, z: 0 },
		{ x: -1, z: 0 },
		{ x: 0, z: 1 },
		{ x: 0, z: -1 }
	];

	return offsets[Math.floor(Math.random() * offsets.length)];
}

function canSpreadTo(block) {
	if (!block || RITUAL_SOURCE_BLOCKS.has(block.typeId)) return false;
	if (!block.typeId.startsWith("minecraft:")) return false;
	if (BLOCKED_SPREAD_BLOCKS.has(block.typeId)) return false;
	if (isProtectedSpreadBlock(block)) return false;

	try {
		if (block.isAir || block.isLiquid) return false;
	} catch {}

	return true;
}

function isProtectedSpreadBlock(block) {
	const id = block.typeId;

	if (BLOCKED_SPREAD_KEYWORDS.some(keyword => id.includes(keyword))) {
		return true;
	}

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
		try {
			block.setType(id);
		} catch {}
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

function isValid(entity) {
	if (!entity) return false;

	if (typeof entity.isValid === "function") {
		return entity.isValid();
	}

	return entity.isValid !== false;
}

function blockLocationData(block) {
	return {
		dimensionId: block.dimension.id,
		x: block.location.x,
		y: block.location.y,
		z: block.location.z
	};
}

function blockKey(block) {
	return `${block.dimension.id}:${block.location.x},${block.location.y},${block.location.z}`;
}

function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}