import { BlockPermutation, EquipmentSlot, ItemStack, system, world } from "@minecraft/server";

const BLOCK_FACE_STATE = "minecraft:block_face";
const SLAB_TAG = "zombie:slab";
const DOOR_TAG = "zombie:door";
const DOUBLE_SLAB_STATE = "zombie:double";
const TRAPDOOR_OPEN_STATE = "zombie:open";
const DOOR_OPEN_STATE = "zombie:open";
const DOOR_UPPER_STATE = "zombie:upper";
const DOOR_HINGE_STATE = "zombie:hinge";
const EYEWOOD_DOOR_ID = "zombie:eyewood_door";
const WOOD_USE_SOUND = "use.wood";
const SLAB_ITEM_IDS = new Set([
	"zombie:eyewood_slab",
	"zombie:infected_slab"
]);

const STRIPPABLE_BLOCKS = {
	"zombie:eyewood_log": "zombie:stripped_eyewood_log",
	"zombie:infected_tree_log": "zombie:infected_tree_log_stripped"
};

const FACE_NEIGHBORS = {
	Up: block => block.above(),
	Down: block => block.below(),
	North: block => block.north(),
	South: block => block.south(),
	East: block => block.east(),
	West: block => block.west()
};

const STACKABLE_SLAB_FACE = {
	Up: verticalHalf => verticalHalf === "bottom",
	Down: verticalHalf => verticalHalf === "top"
};

const STACK_FACES = new Set(["Up", "Down"]);

export class EyewoodSlabPrePlaceComponent {
	beforeOnPlayerPlace(event) {
		const { block, face, permutationToPlace } = event;
		if (!block || !permutationToPlace) return;

		const typeId = permutationToPlace.type?.id ?? permutationToPlace.typeId;
		const targetBlock = face === "Up" ? block.below() : face === "Down" ? block.above() : undefined;

		if (!targetBlock?.hasTag(SLAB_TAG) || targetBlock.typeId !== typeId) return;

		const isDouble = targetBlock.permutation.getState(DOUBLE_SLAB_STATE);
		const verticalHalf = targetBlock.permutation.getState("minecraft:vertical_half");

		if (!isDouble && STACKABLE_SLAB_FACE[face]?.(verticalHalf)) {
			event.cancel = true;
		}
	}
}

export class EyewoodTrapdoorToggleComponent {
	onPlayerInteract(event, component) {
		const block = event.block;
		const dimension = event.dimension ?? block?.dimension;
		if (!block || !dimension) return;

		const params = component?.params ?? {};
		const openState = params.block_state ?? TRAPDOOR_OPEN_STATE;
		const toggledValue = !block.permutation.getState(openState);

		block.setPermutation(block.permutation.withState(openState, toggledValue));

		dimension.playSound(
			toggledValue ? params.enable_sound : params.disable_sound,
			block.center()
		);
	}

	onRedstoneUpdate(event, component) {
		const block = event.block;
		if (!block) return;
		const power = event.powerLevel ?? event.power ?? 0;
		const params = component?.params ?? {};
		const openState = params.block_state ?? TRAPDOOR_OPEN_STATE;
		const shouldBeOpen = power > 0;
		const current = !!block.permutation.getState(openState);
		if (current === shouldBeOpen) return;
		try {
			block.setPermutation(block.permutation.withState(openState, shouldBeOpen));
			const dimension = block.dimension;
			dimension.playSound(shouldBeOpen ? params.enable_sound : params.disable_sound, block.center());
		} catch {}
	}
}

export class EyewoodFenceGateToggleComponent {
	onPlayerInteract(event, component) {
		const block = event.block;
		const player = event.player;
		const dimension = event.dimension ?? block?.dimension;
		if (!block || !player || !dimension) return;

		const params = component?.params ?? {};
		const openState = params.block_state ?? TRAPDOOR_OPEN_STATE;
		const currentValue = block.permutation.getState(openState);
		const toggledValue = !currentValue;
		let newPermutation = block.permutation.withState(openState, toggledValue);

		if (toggledValue) {
			newPermutation = newPermutation.withState(
				"minecraft:cardinal_direction",
				getGatePivotDirection(block, player)
			);
		}

		block.setPermutation(newPermutation);

		dimension.playSound(
			toggledValue ? params.enable_sound : params.disable_sound,
			block.center()
		);
	}
}

export class EyewoodDoorComponent {
	beforeOnPlayerPlace(event) {
		const { block, permutationToPlace } = event;
		if (!block || !permutationToPlace) return;

		const dimension = block.dimension;
		const heightMax = dimension.heightRange?.max ?? 320;

		if (block.location.y + 1 >= heightMax) {
			event.cancel = true;
			return;
		}

		const upperBlock = block.above();

		if (!upperBlock || (!upperBlock.isAir && !upperBlock.isLiquid)) {
			event.cancel = true;
			return;
		}

		const states = permutationToPlace.getAllStates();
		const direction = states["minecraft:cardinal_direction"] ?? "north";
		const hinge = shouldUseRightDoorHinge(block, direction);
		const typeId = permutationToPlace.type?.id ?? permutationToPlace.typeId ?? EYEWOOD_DOOR_ID;

		const baseStates = {
			...states,
			[DOOR_OPEN_STATE]: false,
			[DOOR_HINGE_STATE]: hinge,
			[DOOR_UPPER_STATE]: false
		};

		const upperStates = {
			...baseStates,
			[DOOR_UPPER_STATE]: true
		};

		event.permutationToPlace = BlockPermutation.resolve(typeId, baseStates);

		system.run(() => {
			try {
				upperBlock.setPermutation(BlockPermutation.resolve(typeId, upperStates));
			} catch {}
		});
	}

	onRedstoneUpdate(event, component) {
		const block = event.block;
		if (!block) return;
		const power = event.powerLevel ?? event.power ?? 0;
		const lowerBlock = getLowerDoorBlock(block);
		const upperBlock = lowerBlock?.above();
		if (!lowerBlock?.hasTag(DOOR_TAG) || upperBlock?.typeId !== lowerBlock.typeId) return;
		const params = component?.params ?? {};
		const openState = params.block_state ?? DOOR_OPEN_STATE;
		const shouldBeOpen = power > 0;
		const current = !!lowerBlock.permutation.getState(openState);
		if (current === shouldBeOpen) return;
		try {
			lowerBlock.setPermutation(lowerBlock.permutation.withState(openState, shouldBeOpen));
			upperBlock.setPermutation(upperBlock.permutation.withState(openState, shouldBeOpen));
			const dimension = lowerBlock.dimension;
			dimension.playSound(shouldBeOpen ? params.enable_sound : params.disable_sound, lowerBlock.center());
		} catch {}
	}

	onPlayerInteract(event, component) {
		const block = event.block;
		const dimension = event.dimension ?? block?.dimension;
		if (!block || !dimension) return;

		const lowerBlock = getLowerDoorBlock(block);
		const upperBlock = lowerBlock?.above();

		if (!lowerBlock?.hasTag(DOOR_TAG) || upperBlock?.typeId !== lowerBlock.typeId) return;

		const params = component?.params ?? {};
		const openState = params.block_state ?? DOOR_OPEN_STATE;
		const toggledValue = !lowerBlock.permutation.getState(openState);

		lowerBlock.setPermutation(lowerBlock.permutation.withState(openState, toggledValue));
		upperBlock.setPermutation(upperBlock.permutation.withState(openState, toggledValue));

		dimension.playSound(
			toggledValue ? params.enable_sound : params.disable_sound,
			lowerBlock.center()
		);
	}

	onPlayerBreak(event) {
		const block = event.block;
		const brokenPermutation = event.brokenBlockPermutation;
		if (!block || !brokenPermutation) return;

		const typeId = brokenPermutation.type?.id ?? brokenPermutation.typeId;
		const brokeUpper = brokenPermutation.getState(DOOR_UPPER_STATE);
		const partnerBlock = brokeUpper ? block.below() : block.above();

		if (partnerBlock?.typeId !== typeId) return;

		try {
			if (brokeUpper && !isCreative(event.player)) {
				partnerBlock.dimension.spawnItem(new ItemStack(typeId, 1), partnerBlock.center());
			}

			partnerBlock.setType("minecraft:air");
		} catch {}
	}
}

world.beforeEvents.playerInteractWithBlock.subscribe(event => {
	if (tryStripWood(event)) return;
	tryStackSlab(event);
});

function tryStripWood(event) {
	const { block, itemStack } = event;
	if (!block || !itemStack?.hasTag("minecraft:is_axe")) return false;

	const strippedType = STRIPPABLE_BLOCKS[block.typeId];
	if (!strippedType) return false;

	system.run(() => {
		try {
			const blockFace = block.permutation.getState(BLOCK_FACE_STATE);

			block.setType(strippedType);
			block.setPermutation(block.permutation.withState(BLOCK_FACE_STATE, blockFace));
			block.dimension.playSound(WOOD_USE_SOUND, block.location);
		} catch {}
	});

	return true;
}

function tryStackSlab(event) {
	const { block, blockFace: face, player, itemStack } = event;
	if (!block || !player || !itemStack) return;

	if (!isSlabItem(itemStack)) return;

	if (block.typeId === itemStack.typeId && block.hasTag(SLAB_TAG) && STACK_FACES.has(face)) {
		const isDouble = block.permutation.getState(DOUBLE_SLAB_STATE);
		const verticalHalf = block.permutation.getState("minecraft:vertical_half");

		if (!isDouble && STACKABLE_SLAB_FACE[face]?.(verticalHalf)) {
			event.cancel = true;
			transformIntoDoubleSlab(block, player);
			return;
		}
	}

	const neighbor = FACE_NEIGHBORS[face]?.(block);
	if (!neighbor) return;
	if (neighbor.typeId !== itemStack.typeId || !neighbor.hasTag(SLAB_TAG)) return;
	if (neighbor.permutation.getState(DOUBLE_SLAB_STATE)) return;

	event.cancel = true;
	transformIntoDoubleSlab(neighbor, player);
}

function transformIntoDoubleSlab(block, player) {
	system.run(() => {
		try {
			block.setPermutation(block.permutation.withState(DOUBLE_SLAB_STATE, true));

			if (block.isWaterLogged) {
				block.setWaterLogged(false);
			}

			block.dimension.playSound(WOOD_USE_SOUND, block.location, {
				volume: 1.0,
				pitch: 0.8
			});

			consumeMainhandItem(player);
		} catch {}
	});
}

function isSlabItem(itemStack) {
	return itemStack.hasTag(SLAB_TAG) || SLAB_ITEM_IDS.has(itemStack.typeId);
}

function getGatePivotDirection(block, player) {
	const blockCenter = block.center();
	const dx = player.location.x - blockCenter.x;
	const dz = player.location.z - blockCenter.z;
	const currentDirection = block.permutation.getState("minecraft:cardinal_direction");

	const isNorthSouth = currentDirection === "north" || currentDirection === "south";
	const isEastWest = currentDirection === "east" || currentDirection === "west";

	if (isNorthSouth && Math.abs(dz) > 0.001) {
		return dz > 0 ? "north" : "south";
	}

	if (isEastWest && Math.abs(dx) > 0.001) {
		return dx > 0 ? "west" : "east";
	}

	return currentDirection;
}

function getLowerDoorBlock(block) {
	try {
		return block.permutation.getState(DOOR_UPPER_STATE) ? block.below() : block;
	} catch {
		return block;
	}
}

function shouldUseRightDoorHinge(block, direction) {
	const north = block.north();
	const south = block.south();
	const east = block.east();
	const west = block.west();

	switch (direction) {
		case "north":
			if (isLowerDoor(west) && !west.permutation.getState(DOOR_HINGE_STATE)) return true;
			return !!east && !east.isAir;

		case "south":
			if (isLowerDoor(east) && !east.permutation.getState(DOOR_HINGE_STATE)) return true;
			return !!west && !west.isAir;

		case "east":
			if (isLowerDoor(north) && !north.permutation.getState(DOOR_HINGE_STATE)) return true;
			return !!south && !south.isAir;

		case "west":
			if (isLowerDoor(south) && !south.permutation.getState(DOOR_HINGE_STATE)) return true;
			return !!north && !north.isAir;

		default:
			return false;
	}
}

function isLowerDoor(block) {
	try {
		return block?.hasTag(DOOR_TAG) && !block.permutation.getState(DOOR_UPPER_STATE);
	} catch {
		return false;
	}
}

function consumeMainhandItem(player) {
	if (isCreative(player)) return;

	const equipment = player.getComponent("minecraft:equippable");
	let item = equipment?.getEquipment(EquipmentSlot.Mainhand);
	if (!item) return;

	if (item.amount <= 1) {
		item = undefined;
	} else {
		item.amount--;
	}

	equipment.setEquipment(EquipmentSlot.Mainhand, item);
}

function isCreative(player) {
	try {
		return player.getGameMode() === "Creative";
	} catch {
		return false;
	}
}
