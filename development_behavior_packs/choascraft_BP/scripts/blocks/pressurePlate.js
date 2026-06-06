const DEFAULT_POWERED_STATE = "zombie:powered";

export class ZcPressurePlateComponent {
	beforeOnPlayerPlace(event) {
		if (event.face !== "Up") {
			event.cancel = true;
		}
	}

	onTick(event, component) {
		const block = event.block;
		if (!block) return;

		const poweredState = component?.params?.block_state ?? DEFAULT_POWERED_STATE;
		const shouldBePowered = hasPlayerOnPlate(block);

		setPowered(block, poweredState, shouldBePowered);
	}
}

function hasPlayerOnPlate(block) {
	const center = block.center();

	const players = block.dimension.getEntities({
		type: "minecraft:player",
		location: center,
		maxDistance: 1.5
	});

	return players.some(player => isPlayerOnPlate(player, block.location));
}

function isPlayerOnPlate(player, blockLocation) {
	const { x, y, z } = player.location;

	return x >= blockLocation.x
		&& x < blockLocation.x + 1
		&& z >= blockLocation.z
		&& z < blockLocation.z + 1
		&& y >= blockLocation.y
		&& y < blockLocation.y + 1.2;
}

function setPowered(block, poweredState, powered) {
	try {
		if (block.permutation.getState(poweredState) === powered) return;

		block.setPermutation(
			block.permutation.withState(poweredState, powered)
		);
	} catch {
	}
}