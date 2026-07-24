import { EquipmentSlot, system, world } from "@minecraft/server";

const ECHOHEART_TOTEM = "zombie:echoheart_totem";
const RESTORE_DELAY_TICKS = 2;
const ECHO_SOUND = "mob.warden.sonic_boom";
const ECHO_PARTICLE = "minecraft:sonic_explosion";
const EQUIPMENT_SLOTS = [
	EquipmentSlot.Head,
	EquipmentSlot.Chest,
	EquipmentSlot.Legs,
	EquipmentSlot.Feet
];

const savedInventories = new Map();
const restoringPlayers = new Set();

// entityDie and entityHurt after-events are too late on some Bedrock builds.
// Cancel the fatal hit, save in read-only mode, then clear and kill next tick.
world.beforeEvents.entityHurt?.subscribe((event) => {
	const player = event.hurtEntity;
	if (!player || player.typeId !== "minecraft:player") return;
	if (event.cancel) return;
	if (savedInventories.has(player.id)) return;

	const health = player.getComponent("minecraft:health");
	const damage = event.damage ?? event.damageAmount ?? 0;
	const currentHealth = health?.currentValue ?? health?.value ?? 0;
	if (!health || damage < currentHealth) return;

	const equippable = player.getComponent("minecraft:equippable");
	const offhand = equippable?.getEquipment(EquipmentSlot.Offhand);
	if (offhand?.typeId !== ECHOHEART_TOTEM) return;

	const saved = capturePlayerItems(player, equippable);
	if (!saved) return;

	savedInventories.set(player.id, saved);
	event.cancel = true;

	system.run(() => {
		try {
			const currentEquippable = player.getComponent("minecraft:equippable");
			clearPlayerItems(player, currentEquippable);
			playEchoEffect(saved.dimension, saved.location);
			player.kill();
		} catch {
			savedInventories.delete(player.id);
		}
	});
});

world.afterEvents.playerSpawn.subscribe((event) => {
	if (event.initialSpawn) return;

	const player = event.player;
	const saved = savedInventories.get(player.id);
	if (!saved || restoringPlayers.has(player.id)) return;

	restoringPlayers.add(player.id);
	system.runTimeout(() => {
		restorePlayerItems(player, saved);
	}, RESTORE_DELAY_TICKS);
});

function capturePlayerItems(player, equippable) {
	try {
		const container = player.getComponent("minecraft:inventory")?.container;
		if (!container) return undefined;

		const inventory = [];
		for (let slot = 0; slot < container.size; slot++) {
			inventory.push(cloneItem(container.getItem(slot)));
		}

		const equipment = new Map();
		for (const slot of EQUIPMENT_SLOTS) {
			equipment.set(slot, cloneItem(equippable?.getEquipment(slot)));
		}

		return {
			dimension: player.dimension,
			location: { ...player.location },
			selectedSlotIndex: player.selectedSlotIndex,
			inventory,
			equipment
		};
	} catch {
		return undefined;
	}
}

function clearPlayerItems(player, equippable) {
	try {
		player.getComponent("minecraft:inventory")?.container?.clearAll();
	} catch {}

	for (const slot of [...EQUIPMENT_SLOTS, EquipmentSlot.Offhand]) {
		try {
			equippable?.setEquipment(slot, undefined);
		} catch {}
	}
}

function restorePlayerItems(player, saved, allowRetry = true) {
	try {
		const container = player.getComponent("minecraft:inventory")?.container;
		const equippable = player.getComponent("minecraft:equippable");
		if (!container || !equippable) throw new Error("Player inventory is unavailable.");

		container.clearAll();
		for (let slot = 0; slot < saved.inventory.length && slot < container.size; slot++) {
			const item = saved.inventory[slot];
			if (item) container.setItem(slot, item);
		}

		for (const [slot, item] of saved.equipment) {
			equippable.setEquipment(slot, item);
		}

		// The Echoheart Totem is deliberately not restored to the offhand.
		equippable.setEquipment(EquipmentSlot.Offhand, undefined);
		player.selectedSlotIndex = saved.selectedSlotIndex;
		savedInventories.delete(player.id);
		restoringPlayers.delete(player.id);
		playEchoEffect(player.dimension, player.location);
		player.sendMessage("§dThe Echoheart Totem restored your belongings.");
	} catch {
		// Keep the one pending record if the player was not fully loaded yet.
		restoringPlayers.delete(player.id);
		if (allowRetry) {
			system.runTimeout(
				() => restorePlayerItems(player, saved, false),
				RESTORE_DELAY_TICKS
			);
		}
	}
}

function playEchoEffect(dimension, location) {
	try {
		dimension.playSound(ECHO_SOUND, location, { volume: 0.8, pitch: 1.2 });
	} catch {}
	try {
		dimension.spawnParticle(ECHO_PARTICLE, {
			x: location.x,
			y: location.y + 1,
			z: location.z
		});
	} catch {}
}

function cloneItem(item) {
	if (!item) return undefined;
	try {
		return item.clone();
	} catch {
		return item;
	}
}
