import { BlockPermutation, EquipmentSlot, system } from "@minecraft/server";

const BONE_MEAL = "minecraft:bone_meal";
const AIR = "minecraft:air";
const DRY_LEAF_STATE = "zombie:dry_player_placed";
const DRY_TREE_RENDER_BLOCKS = new Set([
	"zombie:eyewood_tree_leaves",
	"zombie:glow_flower"
]);
const WATER_BLOCKS = new Set(["minecraft:water", "minecraft:flowing_water"]);
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
			return placeTreeFeature(block, dimension, params.feature ?? DEFAULT_FEATURE, params);
		}

		try {
			const nextStage = stage + 1;
			block.setPermutation(block.permutation.withState(stageState, nextStage));

			if (nextStage >= maxStage) {
				system.run(() => placeTreeFeature(block, dimension, params.feature ?? DEFAULT_FEATURE, params));
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


		if (params.instant_feature_on_fertilize === true) {
			if (!isOnValidBase(block, dimension, params.valid_base_blocks)) return false;

			const offset = params.placement_offset ?? [0, 1, 0];
			const location = {
				x: block.location.x + (offset[0] ?? 0),
				y: block.location.y + (offset[1] ?? 0),
				z: block.location.z + (offset[2] ?? 0)
			};

			if (!placeTreeFeatureAtLocation(dimension, location, params.feature ?? DEFAULT_FEATURE, params)) {
				return false;
			}

			spawnGrowthEffects(block, dimension);

			if (!isCreative(player)) {
				item.amount <= 1 ? item = undefined : item.amount--;
				equipment.setEquipment(EquipmentSlot.Mainhand, item);
			}

			return true;
		}

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

function placeTreeFeature(block, dimension, feature, params = {}) {
	const location = { ...block.location };
	const saplingPermutation = block.permutation;
	const drySapling = !isWater(block);

	try {
		block.setPermutation(BlockPermutation.resolve(AIR));
		dimension.placeFeature(feature, location, true);
		decorateVines(dimension, location, params.vine_decoration);

		if (drySapling) {
			system.run(() => markDryTreeBlocks(dimension, location));
		}

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



function placeTreeFeatureAtLocation(dimension, location, feature, params = {}) {
	try {
		dimension.placeFeature(feature, location, true);
		decorateVines(dimension, location, params.vine_decoration);

		if (params.mark_dry_tree_blocks === true) {
			system.run(() => markDryTreeBlocks(dimension, location));
		}

		return true;
	} catch {
		return false;
	}
}

const SHUFFLED_VINE_FACES = [
	{ state: "north", target: block => block.north() },
	{ state: "south", target: block => block.south() },
	{ state: "east", target: block => block.east() },
	{ state: "west", target: block => block.west() }
];

function decorateVines(dimension, origin, decoration) {
	if (!decoration?.block || !Array.isArray(decoration.leaves)) return;

	const leafBlocks = new Set(decoration.leaves);
	const chance = decoration.chance ?? 0.16;
	const radius = decoration.radius ?? 8;
	const minY = Math.max(dimension.heightRange?.min ?? -64, origin.y + 2);
	const maxY = Math.min(dimension.heightRange?.max ?? 320, origin.y + (decoration.height ?? 18));

	for (let x = origin.x - radius; x <= origin.x + radius; x++) {
		for (let y = minY; y <= maxY; y++) {
			for (let z = origin.z - radius; z <= origin.z + radius; z++) {
				try {
					const leaf = dimension.getBlock({ x, y, z });
					if (!leafBlocks.has(leaf?.typeId) || Math.random() > chance) continue;

					for (const face of SHUFFLED_VINE_FACES) {
						const target = face.target(leaf);
						if (!target?.isAir) continue;

						target.setPermutation(BlockPermutation.resolve(decoration.block, {
							"minecraft:block_face": face.state
						}));
						break;
					}
				} catch {}
			}
		}
	}
}
function markDryTreeBlocks(dimension, origin) {
	const radius = 18;
	const minY = Math.max(dimension.heightRange?.min ?? -64, origin.y);
	const maxY = Math.min(dimension.heightRange?.max ?? 320, origin.y + 28);

	for (let x = origin.x - radius; x <= origin.x + radius; x++) {
		for (let y = minY; y <= maxY; y++) {
			for (let z = origin.z - radius; z <= origin.z + radius; z++) {
				try {
					const block = dimension.getBlock({ x, y, z });
					if (!DRY_TREE_RENDER_BLOCKS.has(block?.typeId)) continue;

					block.setPermutation(block.permutation.withState(DRY_LEAF_STATE, true));
				} catch {}
			}
		}
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

function isWater(block) {
	return !!block && (
		WATER_BLOCKS.has(block.typeId) ||
		block.isLiquid === true ||
		block.isWaterlogged === true ||
		block.isWaterLogged === true
	);
}

function isCreative(player) {
	try {
		return player.getGameMode() === "Creative";
	} catch {
		return false;
	}
}


