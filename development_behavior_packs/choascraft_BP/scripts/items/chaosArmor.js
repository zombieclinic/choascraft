import {
	EquipmentSlot,
	GameMode,
	Player,
	system,
	world
} from "@minecraft/server";

const CHAOS_ARMOR = [
	[EquipmentSlot.Head, "zombie:chaos_helmet"],
	[EquipmentSlot.Chest, "zombie:chaos_chestplate"],
	[EquipmentSlot.Legs, "zombie:chaos_leggings"],
	[EquipmentSlot.Feet, "zombie:chaos_boots"]
];

const MAX_BLOCKED_DAMAGE = 20;
const DAMAGE_PER_DURABILITY = 4;
const damageBypass = new Set();

world.beforeEvents.entityHurt?.subscribe((event) => {
	const player = event.hurtEntity;
	if (!(player instanceof Player) || damageBypass.has(player.id)) return;
	if (!isEntityAttack(event.damageSource)) return;

	const damage = event.damage ?? event.damageAmount ?? 0;
	if (!Number.isFinite(damage) || damage <= 0) return;

	const equipped = getEquippedChaosArmor(player);
	if (equipped.length === 0) return;

	const health = getHealth(player);
	if (!health) return;

	const missingHealthRatio = 1 - health.current / health.max;
	const setRatio = equipped.length / CHAOS_ARMOR.length;
	const blockChance = clamp(missingHealthRatio * setRatio, 0, 1);

	// Failed rolls fall through to the armor's normal 1 protection per piece.
	if (Math.random() >= blockChance) return;

	const blockedDamage = Math.min(damage, MAX_BLOCKED_DAMAGE);
	const remainingDamage = Math.max(0, damage - blockedDamage);
	event.cancel = true;

	system.run(() => {
		damageRandomChaosPiece(player, equipped, blockedDamage);
		if (remainingDamage > 0) {
			applyRemainingDamage(player, remainingDamage, event.damageSource);
		}
	});
});

function isEntityAttack(damageSource) {
	return Boolean(damageSource?.damagingEntity || damageSource?.damagingProjectile);
}

function getEquippedChaosArmor(player) {
	const equippable = player.getComponent("minecraft:equippable");
	if (!equippable) return [];

	const equipped = [];
	for (const [slot, typeId] of CHAOS_ARMOR) {
		const item = equippable.getEquipment(slot);
		if (item?.typeId === typeId) equipped.push({ slot, item });
	}
	return equipped;
}

function getHealth(player) {
	const health = player.getComponent("minecraft:health");
	const current = health?.currentValue ?? health?.value;
	const max = health?.effectiveMax ?? health?.defaultValue ?? current;
	if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return undefined;
	return { current: clamp(current, 0, max), max };
}

function damageRandomChaosPiece(player, equipped, blockedDamage) {
	if (!player.matches({ gameMode: GameMode.survival })) return;
	if (equipped.length === 0) return;

	const selected = equipped[Math.floor(Math.random() * equipped.length)];
	const durability = selected.item.getComponent("minecraft:durability");
	if (!durability) return;

	const durabilityDamage = Math.max(1, Math.ceil(blockedDamage / DAMAGE_PER_DURABILITY));
	durability.damage = Math.min(
		durability.damage + durabilityDamage,
		durability.maxDurability
	);

	const equippable = player.getComponent("minecraft:equippable");
	if (durability.damage >= durability.maxDurability) {
		equippable?.setEquipment(selected.slot, undefined);
		player.playSound("random.break", { pitch: 0.9, volume: 1 });
		return;
	}

	equippable?.setEquipment(selected.slot, selected.item);
}

function applyRemainingDamage(player, amount, damageSource) {
	damageBypass.add(player.id);
	try {
		const options = { cause: damageSource?.cause };
		if (damageSource?.damagingEntity) {
			options.damagingEntity = damageSource.damagingEntity;
		}
		player.applyDamage(amount, options);
	} catch {
		try { player.applyDamage(amount); } catch {}
	}
	system.runTimeout(() => damageBypass.delete(player.id), 1);
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}
