import {
    GameMode,
    EquipmentSlot,
    ItemComponentTypes,
    Player
} from "@minecraft/server";

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

        damageHeldItem(event.source, event.itemStack, randomDamageAmount());
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
