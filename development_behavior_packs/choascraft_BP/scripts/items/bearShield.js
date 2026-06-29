import {
	GameMode,
	EquipmentSlot,
	ItemComponentTypes,
	Player,
	system,
	world
} from "@minecraft/server";

const SHIELD_TAG = "zombie:is_shield";
const CHAOS_SHIELD_ID = "zombie:chaos_shield";
const HOTBAR_SIZE = 9;
const SHIELD_DAMAGE_PERCENT = 0.90;
const CHAOS_FULL_HEALTH_BLOCK_PERCENT = 0.50;
const CHAOS_LOW_HEALTH_BLOCK_PERCENT = 0.95;
const CHAOS_LOW_HEALTH_CAP = 4;

const reducedDamageBypass = new Set();

world.beforeEvents.entityHurt?.subscribe((event) => {
	const player = event.hurtEntity;
	if (!(player instanceof Player)) return;
	if (reducedDamageBypass.has(player.id)) return;
	if (!player.isSneaking) return;

	const shieldSlot = findBlockingShield(player);
	if (!shieldSlot) return;

	const damage = event.damage ?? event.damageAmount ?? 0;
	if (damage <= 0) return;

	event.cancel = true;

	const shieldDamagePercent = getShieldDamagePercent(player, shieldSlot.item);
	const playerDamagePercent = 1 - shieldDamagePercent;
	const blockedDamage = Math.max(1, Math.ceil(damage * shieldDamagePercent));
	system.run(() => damageShield(player, shieldSlot, blockedDamage));
	applyReducedDamage(player, damage * playerDamagePercent, event.damageSource);
});

function getShieldDamagePercent(player, shield) {
	if (shield?.typeId !== CHAOS_SHIELD_ID) return SHIELD_DAMAGE_PERCENT;

	const health = getHealth(player);
	if (!health) return SHIELD_DAMAGE_PERCENT;

	const lowHealth = Math.min(CHAOS_LOW_HEALTH_CAP, health.max);
	if (health.current <= lowHealth) return CHAOS_LOW_HEALTH_BLOCK_PERCENT;
	if (health.current >= health.max) return CHAOS_FULL_HEALTH_BLOCK_PERCENT;

	const missingHealthRatio = (health.max - health.current) / (health.max - lowHealth);
	return lerp(
		CHAOS_FULL_HEALTH_BLOCK_PERCENT,
		CHAOS_LOW_HEALTH_BLOCK_PERCENT,
		Math.max(0, Math.min(1, missingHealthRatio))
	);
}

function getHealth(entity) {
	const health = entity.getComponent("minecraft:health");
	const current = health?.currentValue ?? health?.value;
	const max = health?.defaultValue ?? health?.effectiveMax ?? current;

	if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) {
		return undefined;
	}

	return { current, max };
}

function lerp(min, max, ratio) {
	return min + (max - min) * ratio;
}

function applyReducedDamage(player, amount, damageSource) {
	if (amount <= 0) return;

	reducedDamageBypass.add(player.id);
	system.run(() => {
		try {
			if (damageSource?.cause) {
				player.applyDamage(amount, {
					cause: damageSource.cause,
					damagingEntity: damageSource.damagingEntity
				});
			} else {
				player.applyDamage(amount);
			}
		} catch {
			try { player.applyDamage(amount); } catch {}
		}

		system.runTimeout(() => reducedDamageBypass.delete(player.id), 1);
	});
}

function findBlockingShield(player) {
	const equippable = player.getComponent("minecraft:equippable");
	const offhand = equippable?.getEquipment(EquipmentSlot.Offhand);
	if (isShield(offhand)) {
		return { kind: "offhand", item: offhand };
	}

	const inventory = player.getComponent("minecraft:inventory");
	const container = inventory?.container;
	if (!container) return undefined;

	const selectedSlot = player.selectedSlotIndex;
	if (Number.isInteger(selectedSlot) && selectedSlot >= 0 && selectedSlot < HOTBAR_SIZE) {
		const selectedItem = container.getItem(selectedSlot);
		if (isShield(selectedItem)) {
			return { kind: "hotbar", slot: selectedSlot, item: selectedItem };
		}
	}

	for (let slot = 0; slot < Math.min(HOTBAR_SIZE, container.size); slot++) {
		if (slot === selectedSlot) continue;

		const item = container.getItem(slot);
		if (isShield(item)) {
			return { kind: "hotbar", slot, item };
		}
	}

	return undefined;
}

function isShield(itemStack) {
	return itemStack?.hasTag?.(SHIELD_TAG) === true;
}

function damageShield(player, shieldSlot, damageAmount) {
	if (!player.matches({ gameMode: GameMode.survival })) return;
	const shield = shieldSlot.item;
	if (!shield?.hasComponent("minecraft:durability")) return;
	if (!shouldDamageItem(shield)) return;

	const durability = shield.getComponent("minecraft:durability");
	if (!durability) return;

	durability.damage = Math.min(durability.damage + damageAmount, durability.maxDurability);

	if (durability.damage >= durability.maxDurability) {
		setShieldSlot(player, shieldSlot, undefined);
		player.playSound("random.break", { pitch: 0.9, volume: 1.0 });
		return;
	}

	setShieldSlot(player, shieldSlot, shield);
}

function setShieldSlot(player, shieldSlot, itemStack) {
	if (shieldSlot.kind === "offhand") {
		player
			.getComponent("minecraft:equippable")
			?.setEquipment(EquipmentSlot.Offhand, itemStack);
		return;
	}

	player
		.getComponent("minecraft:inventory")
		?.container
		?.setItem(shieldSlot.slot, itemStack);
}

function shouldDamageItem(itemStack) {
	const enchantable = itemStack.getComponent(ItemComponentTypes.Enchantable);
	const unbreaking = enchantable
		?.getEnchantments()
		.find(enchantment => enchantment.type.id === "unbreaking");

	const damageChance = 1 / ((unbreaking?.level ?? 0) + 1);
	return Math.random() <= damageChance;
}
