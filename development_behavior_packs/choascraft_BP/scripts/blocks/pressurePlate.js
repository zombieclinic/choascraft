const DEFAULT_POWERED_STATE = "zombie:powered";

export class ZcPressurePlateComponent {
	beforeOnPlayerPlace(event) {
		if (event.face !== "Up") {
			event.cancel = true;
		}
	}

	onStepOn(event, component) {
		pressPlate(event, component);
	}

	onEntityFallOn(event, component) {
		pressPlate(event, component);
	}
}

export class ZcPressurePlateReleaseTickComponent {
	onTick(event, component) {
		const block = event.block;
		if (!block) return;

		const poweredState = component?.params?.block_state ?? DEFAULT_POWERED_STATE;

		setPowered(block, poweredState, hasEntityOnPlate(block));
	}
}

function hasEntityOnPlate(block) {
	const center = block.center();

	const entities = block.dimension.getEntities({
		location: center,
		maxDistance: 1.5
	});

	return entities.some(entity => isEntityOnPlate(entity, block.location));
}

function isEntityOnPlate(entity, blockLocation) {
	const { x, y, z } = entity.location;

	return x >= blockLocation.x
		&& x < blockLocation.x + 1
		&& z >= blockLocation.z
		&& z < blockLocation.z + 1
		&& y >= blockLocation.y - 0.25
		&& y < blockLocation.y + 1.5;
}

function pressPlate(event, component) {
	if (!event.entity) return;

	const block = event.block;
	if (!block) return;

	const poweredState = component?.params?.block_state ?? DEFAULT_POWERED_STATE;

	setPowered(block, poweredState, true);
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
