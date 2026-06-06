import { BlockPermutation, EquipmentSlot, ItemStack, system } from "@minecraft/server";

const AIR = "minecraft:air";
const BONE_MEAL = "minecraft:bone_meal";
const SPOREPOD = "zombie:sporepod";
const SPORE = "zombie:spore";
const STAGE_STATE = "zombie:growth_stage";
const PART_STATE = "zombie:sporepod_part";
const BOTTOM = "bottom";
const MIDDLE = "middle";
const TOP = "top";
const GROWTH_PARTICLE = "minecraft:crop_growth_emitter";
const BONE_MEAL_SOUND = "item.bone_meal.use";
const activeCleanups = new Set();

export class SporepodGrowthComponent {
	beforeOnPlayerPlace(event) {
		const block = event.block;
		if (!block) return;

		const above = block.above();
		const twoAbove = above?.above();

		if (!canReplace(above) || !canReplace(twoAbove)) {
			event.cancel = true;
		}
	}

	onTick(event) {
		if (syncSporepodStack(event.block)) return;
		growSporepod(event.block);
	}

	onPlace(event) {
		syncSporepodStack(event.block);
	}

	onPlayerInteract(event) {
		const player = event.player;
		if (!player) return;

		const equipment = player.getComponent("minecraft:equippable");
		let item = equipment?.getEquipment(EquipmentSlot.Mainhand);
		if (!item || item.typeId !== BONE_MEAL) return;
		if (!growSporepod(event.block, true)) return;

		if (!isCreative(player)) {
			item.amount <= 1 ? item = undefined : item.amount--;
			equipment.setEquipment(EquipmentSlot.Mainhand, item);
		}
	}

	onPlayerBreak(event) {
		cleanupSporepod(event.block, event.brokenBlockPermutation, event.player);
	}

	onBreak(event) {
		cleanupSporepod(event.block, event.brokenBlockPermutation);
	}
}

function growSporepod(block, playEffects = false) {
	if (!isSporepodPart(block, BOTTOM)) return false;
	if (!isValidBase(block.below())) return false;

	const stage = getStage(block);
	if (stage === undefined || stage >= 2) return false;

	const target = stage === 0 ? block.above() : block.above()?.above();
	const nextPart = stage === 0 ? MIDDLE : TOP;

	if (!canReplace(target)) return false;

	try {
		target.setPermutation(BlockPermutation.resolve(SPOREPOD, {
			[STAGE_STATE]: 0,
			[PART_STATE]: nextPart
		}));
		block.setPermutation(block.permutation.withState(STAGE_STATE, stage + 1));

		if (playEffects) {
			const location = target.center();
			target.dimension.spawnParticle(GROWTH_PARTICLE, location);
			target.dimension.playSound(BONE_MEAL_SOUND, location);
		}

		return true;
	} catch {
		return false;
	}
}

function syncSporepodStack(block) {
	if (!isSporepodPart(block, BOTTOM)) return false;
	if (!isValidBase(block.below())) return false;

	const stage = getStage(block);
	if (stage === undefined || stage <= 0) return false;

	let changed = false;
	if (stage >= 1) {
		changed = setSporepodPart(block.above(), MIDDLE) || changed;
	}

	if (stage >= 2) {
		changed = setSporepodPart(block.above()?.above(), TOP) || changed;
	}

	return changed;
}

function setSporepodPart(block, part) {
	if (!block) return false;
	if (isSporepodPart(block, part)) return false;
	if (!canReplace(block)) return false;

	try {
		block.setPermutation(BlockPermutation.resolve(SPOREPOD, {
			[STAGE_STATE]: 0,
			[PART_STATE]: part
		}));
		return true;
	} catch {
		return false;
	}
}

function cleanupSporepod(block, brokenPermutation, player) {
	if (!block || !brokenPermutation) return;

	const brokenType = brokenPermutation.type?.id ?? brokenPermutation.typeId;
	const brokenPart = getPart(brokenPermutation);
	const lower = getBottomBlock(block, brokenType, brokenPart);
	if (!lower) return;

	const key = getBlockKey(lower);
	if (activeCleanups.has(key)) return;
	activeCleanups.add(key);

	system.run(() => {
		try {
			const shouldDrop = brokenPart !== BOTTOM && !isCreative(player);

			for (const part of [lower.above()?.above(), lower.above(), lower]) {
				if (part?.typeId === SPOREPOD) {
					part.setType(AIR);
				}
			}

			if (shouldDrop) {
				lower.dimension.spawnItem(new ItemStack(SPORE, 1), lower.center());
			}
		} catch {
		} finally {
			system.run(() => activeCleanups.delete(key));
		}
	});
}

function getBottomBlock(block, typeId, part) {
	if (typeId !== SPOREPOD) return;
	if (part === BOTTOM) return block;
	if (part === MIDDLE) return block.below();
	if (part === TOP) return block.below()?.below();
}

function getStage(block) {
	try {
		const stage = block.permutation.getState(STAGE_STATE);
		return typeof stage === "number" ? stage : undefined;
	} catch {
		return undefined;
	}
}

function getPart(permutation) {
	try {
		return permutation.getState(PART_STATE);
	} catch {
		return undefined;
	}
}

function isSporepodPart(block, part) {
	if (!block || block.typeId !== SPOREPOD) return false;

	try {
		return block.permutation.getState(PART_STATE) === part;
	} catch {
		return false;
	}
}

function canReplace(block) {
	return !!block && (block.isAir || block.isLiquid || block.hasTag("plant"));
}

function isValidBase(block) {
	return !!block && [
		"zombie:infected_grass_block",
		"zombie:infected_dirt",
		"zombie:infected_gravel",
		"zombie:infected_sand",
		"zombie:infected_sporestone",
		"zombie:infected_stone"
	].includes(block.typeId);
}

function isCreative(player) {
	try {
		return player?.getGameMode() === "Creative";
	} catch {
		return false;
	}
}

function getBlockKey(block) {
	const { x, y, z } = block.location;

	return `${block.dimension.id}:${x}:${y}:${z}`;
}
