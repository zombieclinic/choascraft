import {system} from "@minecraft/server";

const CUSTOM_LEAVES_TAG = "zombie:custom_leaves";
const CUSTOM_LOG_TAG = "zombie:custom_log";
const PLAYER_PLACED_STATE = "zombie:player_placed";
const AIR = "minecraft:air";
const MAX_RADIUS = 6;
const MAX_CACHE_SIZE = 2000;
const MAX_QUEUE_SIZE = 1200;
const PROCESS_BATCH_SIZE = 80;
const PROCESS_INTERVAL_TICKS = 5;
const CLEAR_INTERVAL_TICKS = 3600;

const decayQueue = [];
const queuedLeaves = new Set();
const decayCache = new Map();
const offsetsByRadius = new Map();

for (let radius = 1; radius <= MAX_RADIUS; radius++) {
	const offsets = [];

	for (let x = -radius; x <= radius; x++) {
		for (let y = -radius; y <= radius; y++) {
			for (let z = -radius; z <= radius; z++) {
				offsets.push({
					x,
					y,
					z,
					distance: Math.abs(x) + Math.abs(y) + Math.abs(z)
				});
			}
		}
	}

	offsets.sort((a, b) => a.distance - b.distance);
	offsetsByRadius.set(radius, offsets);
}

export class CustomLeafDecayComponent {
	beforeOnPlayerPlace(event) {
		try {
			event.permutationToPlace = event.permutationToPlace.withState(PLAYER_PLACED_STATE, true);
		} catch {
			// Leaves without this state can still decay, but player-placed protection needs the state.
		}
	}

	onRandomTick(event, component) {
		if (Math.random() < 0.7) return;

		const block = event.block;
		const key = getBlockKey(block);
		if (queuedLeaves.has(key)) return;
		queuedLeaves.add(key);

		decayQueue.push({
			key,
			block,
			radius: component?.params?.radius ?? 4,
			leafTag: component?.params?.leaf_tag ?? CUSTOM_LEAVES_TAG,
			logTag: component?.params?.log_tag ?? CUSTOM_LOG_TAG
		});
	}
}

system.runInterval(processDecayQueue, PROCESS_INTERVAL_TICKS);
system.runInterval(clearDecayState, CLEAR_INTERVAL_TICKS);

function processDecayQueue() {
	if (decayQueue.length > MAX_QUEUE_SIZE) {
		const targetSize = Math.floor(MAX_QUEUE_SIZE / 2);
		while (decayQueue.length > targetSize) {
			const entry = decayQueue.pop();
			if (entry?.key) queuedLeaves.delete(entry.key);
		}
	}

	const batchSize = Math.min(decayQueue.length, PROCESS_BATCH_SIZE);

	for (let i = 0; i < batchSize; i++) {
		const entry = decayQueue.shift();
		if (!entry) continue;

		try {
			if (entry.block) {
				tryDecayLeaf(entry.block, entry.radius, entry.leafTag, entry.logTag);
			}
		} finally {
			if (entry.key) queuedLeaves.delete(entry.key);
		}
	}
}

function tryDecayLeaf(block, radius, leafTag, logTag) {
	try {
		if (leafTag && !block.hasTag(leafTag)) return;
		if (isPlayerPlaced(block)) return;
		if (!isLoaded(block)) return;
		if (hasNearbyLog(block, clampRadius(radius), logTag)) return;

		block.setType(AIR);
	} catch {
		
	}
}

function hasNearbyLog(block, radius, logTag) {
	const { x, y, z } = block.location;
	const key = `${block.dimension.id}:${x}:${y}:${z}:${radius}:${logTag ?? ""}`;

	if (decayCache.has(key)) {
		const cached = decayCache.get(key);
		decayCache.delete(key);
		decayCache.set(key, cached);
		return cached;
	}

	let foundLog = false;
	const offsets = offsetsByRadius.get(radius) ?? [];

	for (const offset of offsets) {
		const location = {
			x: x + offset.x,
			y: y + offset.y,
			z: z + offset.z
		};

		if (!isLocationLoaded(block.dimension, location)) continue;

		const nearbyBlock = block.dimension.getBlock(location);
		if (!nearbyBlock) continue;

		if (nearbyBlock.hasTag("log") || (logTag && nearbyBlock.hasTag(logTag))) {
			foundLog = true;
			break;
		}
	}

	decayCache.set(key, foundLog);
	if (decayCache.size > MAX_CACHE_SIZE) {
		decayCache.delete(decayCache.keys().next().value);
	}

	return foundLog;
}

function isPlayerPlaced(block) {
	try {
		return block.permutation.getState(PLAYER_PLACED_STATE) === true;
	} catch {
		return false;
	}
}

function isLoaded(block) {
	return isLocationLoaded(block.dimension, block.location);
}

function isLocationLoaded(dimension, location) {
	return typeof dimension.isChunkLoaded !== "function" || dimension.isChunkLoaded(location);
}

function clampRadius(radius) {
	return Math.max(1, Math.min(MAX_RADIUS, Math.floor(radius || 4)));
}

function getBlockKey(block) {
	const { x, y, z } = block.location;
	return `${block.dimension.id}:${x}:${y}:${z}`;
}

function clearDecayState() {
	decayQueue.length = 0;
	queuedLeaves.clear();
	decayCache.clear();
}