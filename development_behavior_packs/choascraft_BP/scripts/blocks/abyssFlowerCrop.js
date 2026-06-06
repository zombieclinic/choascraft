import { EquipmentSlot } from "@minecraft/server";

const BONE_MEAL = "minecraft:bone_meal";
const DEFAULT_STAGE_STATE = "zombie:growth_stage";
const DEFAULT_MAX_STAGE = 4;
const BONE_MEAL_SOUND = "item.bone_meal.use";
const GROWTH_PARTICLE = "minecraft:crop_growth_emitter";

export class AbyssFlowerCropComponent {
	onTick(event, component) {
		const params = component?.params ?? {};
		const block = event.block;
		const dimension = event.dimension ?? block?.dimension;
		if (!block || !dimension) return;
		if (!isOnValidBase(block, dimension, params.valid_base_blocks)) return;

		const stageState = params.stage_state ?? DEFAULT_STAGE_STATE;
		const maxStage = params.max_stage ?? DEFAULT_MAX_STAGE;
		const stage = getGrowthStage(block, stageState);
		if (stage === undefined || stage >= maxStage) return;

		setGrowthStage(block, stageState, stage + 1);
	}

	onPlayerInteract(event, component) {
		const player = event.player;
		const block = event.block;
		const dimension = event.dimension ?? block?.dimension;
		if (!player || !block || !dimension) return;

		const params = component?.params ?? {};
		const stageState = params.stage_state ?? DEFAULT_STAGE_STATE;
		const maxStage = params.max_stage ?? DEFAULT_MAX_STAGE;
		const stage = getGrowthStage(block, stageState);
		if (stage === undefined || stage >= maxStage) return;
		if (!isOnValidBase(block, dimension, params.valid_base_blocks)) return;

		const equipment = player.getComponent("minecraft:equippable");
		let item = equipment?.getEquipment(EquipmentSlot.Mainhand);
		if (!item || item.typeId !== BONE_MEAL) return;

		setGrowthStage(block, stageState, stage + 1);
		spawnGrowthEffects(block, dimension);

		if (isCreative(player)) return;

		item.amount <= 1 ? item = undefined : item.amount--;
		equipment.setEquipment(EquipmentSlot.Mainhand, item);
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

function setGrowthStage(block, stageState, stage) {
	try {
		block.setPermutation(block.permutation.withState(stageState, stage));
		return true;
	} catch {
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
