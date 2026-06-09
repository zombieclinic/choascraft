const DRY_PLAYER_PLACED_STATE = "zombie:dry_player_placed";
const WATER_BLOCKS = new Set(["minecraft:water", "minecraft:flowing_water"]);

export class EyewoodLeavesRenderComponent {
	beforeOnPlayerPlace(event) {
		setPermutationState(event, !isWater(event.block));
	}
}

function setPermutationState(event, dryPlayerPlaced) {
	try {
		event.permutationToPlace = event.permutationToPlace.withState(DRY_PLAYER_PLACED_STATE, dryPlayerPlaced);
	} catch {}
}

function isWater(block) {
	return !!block && (
		WATER_BLOCKS.has(block.typeId) ||
		block.isLiquid === true ||
		block.isWaterlogged === true ||
		block.isWaterLogged === true
	);
}
