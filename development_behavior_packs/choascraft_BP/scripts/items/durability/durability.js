import {
    GameMode,
    EquipmentSlot,
    ItemComponentTypes,
    Player,
    system
} from "@minecraft/server";

const HOE_TILLABLE_BLOCKS = new Set([
    "minecraft:grass_block",
    "minecraft:dirt",
    "minecraft:coarse_dirt",
    "minecraft:rooted_dirt",
    "minecraft:dirt_path",
    "minecraft:grass_path",
    "minecraft:podzol",
    "minecraft:mycelium"
]);

const HOE_TILLED_RESULTS = new Set([
    "minecraft:farmland",
    "minecraft:dirt"
]);

export class DurabilityHandler {
    onHitEntity(event) {
        const player = event?.attackingEntity;
        const itemStack = event?.itemStack ?? getMainhandItem(player);

        damageHeldItem(player, itemStack, randomDamageAmount());
    }

    onCompleteUse(event) {
        damageHeldItem(event?.source, event?.itemStack, randomDamageAmount());
    }

    onMineBlock(event) {
        if (!event?.block) return;

        damageHeldItem(event.source, event.itemStack, 1);
    }

    onUseOn(event) {
        const block = event?.block;
        const player = event?.source;
        const itemStack = event?.itemStack ?? getMainhandItem(player);

        if (!block || !isHoe(itemStack)) return;

        const beforeType = block.typeId;
        const itemTypeId = itemStack.typeId;
        if (!HOE_TILLABLE_BLOCKS.has(beforeType)) return;

        const dimension = block.dimension;
        const location = { ...block.location };

        system.runTimeout(() => {
            const changedBlock = getBlock(dimension, location);
            if (!changedBlock) return;
            if (changedBlock.typeId === beforeType) return;
            if (!HOE_TILLED_RESULTS.has(changedBlock.typeId)) return;

            const heldItem = getMainhandItem(player);
            if (heldItem?.typeId !== itemTypeId) return;

            damageHeldItem(player, heldItem, 1);
        }, 1);
    }
}

function damageItemWithUnbreaking(player, itemStack, damageAmount) {
    const unbreakingLevel = getUnbreakingLevel(itemStack);
    const damageChance = 1 / (unbreakingLevel + 1);

    if (Math.random() <= damageChance) {
        damageItem(player, itemStack, damageAmount);
    }
}

function damageHeldItem(player, itemStack, damageAmount) {
    if (!(player instanceof Player)) return;
    if (!player.matches({ gameMode: GameMode.survival })) return;
    if (!itemStack?.hasComponent("minecraft:durability")) return;

    damageItemWithUnbreaking(player, itemStack, damageAmount);
}

function damageItem(player, itemStack, damageAmount) {
    const durability = itemStack.getComponent("minecraft:durability");
    const equippable = player.getComponent("minecraft:equippable");

    if (!durability || !equippable) return;

    durability.damage = Math.min(
        durability.damage + damageAmount,
        durability.maxDurability
    );

    if (durability.damage >= durability.maxDurability) {
        equippable.setEquipment(EquipmentSlot.Mainhand, undefined);

        player.playSound("random.break", {
            pitch: 0.9,
            volume: 1.0
        });

        return;
    }

    equippable.setEquipment(EquipmentSlot.Mainhand, itemStack);
}

function getMainhandItem(player) {
    if (!(player instanceof Player)) return undefined;

    return player
        .getComponent("minecraft:equippable")
        ?.getEquipment(EquipmentSlot.Mainhand);
}

function getBlock(dimension, location) {
    try {
        return dimension.getBlock(location);
    } catch {
        return undefined;
    }
}

function isHoe(itemStack) {
    if (!itemStack) return false;

    try {
        if (itemStack.hasTag?.("minecraft:is_hoe")) return true;
    } catch {}

    return itemStack.typeId?.endsWith("_hoe") === true;
}

function randomDamageAmount() {
    return Math.floor(Math.random() * 5) + 1;
}

function getUnbreakingLevel(itemStack) {
    const enchantable = itemStack.getComponent(ItemComponentTypes.Enchantable);
    if (!enchantable) return 0;

    const unbreaking = enchantable
        .getEnchantments()
        .find(e => e.type.id === "unbreaking");

    return unbreaking?.level ?? 0;
}
