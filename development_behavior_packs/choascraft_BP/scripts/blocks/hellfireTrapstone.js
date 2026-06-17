import { BlockPermutation, EntityDamageCause, system } from "@minecraft/server";

const SPIKE_BLOCK_ID = "zombie:hellfire_spike";
const DAMAGE_COOLDOWN_TICKS = 20;
const DEFAULT_DAMAGE = 4;
const lastDamageTick = new WeakMap();

export class HellfireTrapstoneComponent {
	onStepOn(event, component) {
		triggerTrapstone(event, component);
	}

	onStepOff(event) {
		queueSpikeRemoval(event.block);
	}

	onEntityFallOn(event, component) {
		triggerTrapstone(event, component);
	}
}

function triggerTrapstone(event, component) {
	const block = event.block;
	const entity = event.entity;
	if (!block || !entity || entity.typeId !== "minecraft:player") return;

	spawnSpike(block);
	damageEntity(entity, component?.params?.damage ?? DEFAULT_DAMAGE);
}

function spawnSpike(block) {
	system.run(() => {
		try {
			const target = block.above();
			if (!target || (!target.isAir && !target.isLiquid)) return;

			target.setPermutation(BlockPermutation.resolve(SPIKE_BLOCK_ID));
		} catch {}
	});
}

function queueSpikeRemoval(block) {
	if (!block) return;

	system.run(() => {
		try {
			if (hasPlayerOnTrapstone(block)) return;

			const target = block.above();
			if (target?.typeId === SPIKE_BLOCK_ID) {
				target.setType("minecraft:air");
			}
		} catch {}
	});
}

function hasPlayerOnTrapstone(block) {
	const entities = block.dimension.getEntities({
		location: block.center(),
		maxDistance: 2
	});

	return entities.some(entity => {
		if (entity.typeId !== "minecraft:player") return false;

		const { x, y, z } = entity.location;
		const { x: bx, y: by, z: bz } = block.location;

		return x >= bx
			&& x < bx + 1
			&& z >= bz
			&& z < bz + 1
			&& y >= by
			&& y < by + 2.5;
	});
}

function damageEntity(entity, amount) {
	const now = system.currentTick;
	const lastTick = lastDamageTick.get(entity) ?? -DAMAGE_COOLDOWN_TICKS;
	if (now - lastTick < DAMAGE_COOLDOWN_TICKS) return;

	lastDamageTick.set(entity, now);

	try {
		entity.applyDamage(amount, { cause: EntityDamageCause.magic });
	} catch {
		try { entity.applyDamage(amount); } catch {}
	}
}
