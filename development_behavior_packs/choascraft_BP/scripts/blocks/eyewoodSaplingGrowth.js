import { BlockPermutation, EquipmentSlot, system } from "@minecraft/server";

const BONE_MEAL = "minecraft:bone_meal";
const AIR = "minecraft:air";
const DEFAULT_STAGE_STATE = "zombie:growth_stage";
const DEFAULT_MAX_STAGE = 4;
const DEFAULT_FEATURE = "zombie:eyewood_tree_feature";
const DEFAULT_GROWTH_CHANCE = 0.45;
const GROWTH_PARTICLE = "minecraft:crop_growth_emitter";
const BONE_MEAL_SOUND = "item.bone_meal.use";

export class EyewoodSaplingGrowthComponent {
	onTick(event, component) {
		const params = component?.params ?? {};
		if (Math.random() > (params.growth_chance ?? DEFAULT_GROWTH_CHANCE)) return;

		EyewoodSaplingGrowthComponent.tryGrowBlock(event.block, event.dimension, params);
	}

	onRandomTick(event, component) {
		const params = component?.params ?? {};
		if (Math.random() > (params.random_tick_growth_chance ?? DEFAULT_GROWTH_CHANCE)) return;

		EyewoodSaplingGrowthComponent.tryGrowBlock(event.block, event.dimension, params);
	}

	onPlayerInteract(event, component) {
		if (!event.player) return;

		EyewoodSaplingGrowthComponent.tryFertilize(
			event.block,
			event.player,
			event.dimension,
			component?.params ?? {}
		);
	}

	static tryGrowBlock(block, dimension = block?.dimension, params = {}) {
		if (!block || !dimension) return false;

		const stageState = params.stage_state ?? DEFAULT_STAGE_STATE;
		const maxStage = params.max_stage ?? DEFAULT_MAX_STAGE;
		const stage = getGrowthStage(block, stageState);

		if (stage === undefined) return false;
		if (!isOnValidBase(block, dimension, params.valid_base_blocks)) return false;

		if (stage >= maxStage) {
			return placeTreeFeature(block, dimension, params.feature ?? DEFAULT_FEATURE);
		}

		try {
			const nextStage = stage + 1;
			block.setPermutation(block.permutation.withState(stageState, nextStage));

			if (nextStage >= maxStage) {
				system.run(() => placeTreeFeature(block, dimension, params.feature ?? DEFAULT_FEATURE));
			}

			return true;
		} catch {
			return false;
		}
	}

	static tryFertilize(block, player, dimension = block?.dimension, params = {}) {
		const equipment = player.getComponent("minecraft:equippable");
		let item = equipment?.getEquipment(EquipmentSlot.Mainhand);

		if (!item || item.typeId !== BONE_MEAL) return false;
		if (getGrowthStage(block, params.stage_state ?? DEFAULT_STAGE_STATE) === undefined) return false;
		if (!isOnValidBase(block, dimension, params.valid_base_blocks)) return false;

		spawnGrowthEffects(block, dimension);

		if (!isCreative(player)) {
			item.amount <= 1 ? item = undefined : item.amount--;
			equipment.setEquipment(EquipmentSlot.Mainhand, item);
		}

		return EyewoodSaplingGrowthComponent.tryGrowBlock(block, dimension, params);
	}
}

function getGrowthStage(block, stageState) {
	try {
		const stage = block.permutation.getState(stageState);
		return typeof stage === "number" ? stage : undefined;
	} catch {
		return undefined;
	}
}

function placeTreeFeature(block, dimension, feature) {
	const location = block.location;
	const saplingPermutation = block.permutation;

	try {
		block.setPermutation(BlockPermutation.resolve(AIR));
		dimension.placeFeature(feature, location, true);
		return true;
	} catch {
		try {
			const currentBlock = dimension.getBlock(location);
			if (currentBlock?.typeId === AIR) {
				currentBlock.setPermutation(saplingPermutation);
			}
		} catch {
		}

		return false;
	}
}

function spawnGrowthEffects(block, dimension) {
	const location = block.center();

	try {
		dimension.spawnParticle(GROWTH_PARTICLE, location);
	} catch {
	}

	try {
		dimension.playSound(BONE_MEAL_SOUND, location);
	} catch {
	}
}

function isOnValidBase(block, dimension, validBaseBlocks) {
	if (!Array.isArray(validBaseBlocks) || validBaseBlocks.length === 0) return true;

	try {
		const { x, y, z } = block.location;
		const below = dimension.getBlock({ x, y: y - 1, z });

		return below ? validBaseBlocks.includes(below.typeId) : false;
	} catch {
		return false;
	}
}

function isCreative(player) {
	try {
		return player.getGameMode() === "Creative";
	} catch {
		return false;
	}
}
