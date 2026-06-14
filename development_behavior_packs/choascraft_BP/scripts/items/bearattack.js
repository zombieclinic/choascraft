import {EntityComponentTypes,ItemStack, EquipmentSlot, Player, GameMode, ItemComponentTypes, system, world, BlockPermutation} from "@minecraft/server";

export class bearArmorChanceEffect {
    constructor() { }

    async onHitEntity(arg) {
        const { attackingEntity } = arg;

        // Attempt to get the Equippable component
        const equippable = attackingEntity.getComponent(EntityComponentTypes.Equippable);
        let setcheckbear = 0;

        // Check if the Equippable component is available
        if (!equippable) return;

        // Helper function to check specific equipment slot for a specific item
        async function hasEquippedItem(itemName, slot) {
            const item = equippable.getEquipment(slot);
            return item && item.typeId === itemName;
        }

        // Check each armor slot using hasEquippedItem
        if (await hasEquippedItem("zombie:brown_netherite_bear_helmet", EquipmentSlot.Head)) setcheckbear++;
        if (await hasEquippedItem("zombie:brown_netherite_bear_chestplate", EquipmentSlot.Chest)) setcheckbear++;
        if (await hasEquippedItem("zombie:brown_netherite_bear_leggings", EquipmentSlot.Legs)) setcheckbear++;
        if (await hasEquippedItem("zombie:brown_netherite_bear_boots", EquipmentSlot.Feet)) setcheckbear++;
        if (await hasEquippedItem("zombie:brown_bear_helmet", EquipmentSlot.Head)) setcheckbear++;
        if (await hasEquippedItem("zombie:brown_bear_chestplate", EquipmentSlot.Chest)) setcheckbear++;
        if (await hasEquippedItem("zombie:brown_bear_leggings", EquipmentSlot.Legs)) setcheckbear++;
        if (await hasEquippedItem("zombie:brown_bear_boots", EquipmentSlot.Feet)) setcheckbear++;

        if (await hasEquippedItem("zombie:black_netherite_bear_helmet", EquipmentSlot.Head)) setcheckbear++;
        if (await hasEquippedItem("zombie:black_netherite_bear_chestplate", EquipmentSlot.Chest)) setcheckbear++;
        if (await hasEquippedItem("zombie:black_netherite_bear_leggings", EquipmentSlot.Legs)) setcheckbear++;
        if (await hasEquippedItem("zombie:black_netherite_bear_boots", EquipmentSlot.Feet)) setcheckbear++;
        if (await hasEquippedItem("zombie:black_bear_helmet", EquipmentSlot.Head)) setcheckbear++;
        if (await hasEquippedItem("zombie:black_bear_chestplate", EquipmentSlot.Chest)) setcheckbear++;
        if (await hasEquippedItem("zombie:black_bear_leggings", EquipmentSlot.Legs)) setcheckbear++;
        if (await hasEquippedItem("zombie:black_bear_boots", EquipmentSlot.Feet)) setcheckbear++;

        // Check the main hand slot for claws
        const inventory = attackingEntity.getComponent("minecraft:inventory");
        if (inventory) {
            const itemInHand = inventory.container.getItem(attackingEntity.selectedSlotIndex);
            if (itemInHand && itemInHand.typeId === "zombie:brown_bear_claws") {
                setcheckbear++;
            }
        }

        // Calculate the chance based on the number of items detected
        let chance = 0;
        switch (setcheckbear) {
            case 1:
                chance = 0.01;  // 5% chance
                break;
            case 2:
                chance = 0.3;   // 10% chance
                break;
            case 3:
                chance = 0.1;  // 15% chance
                break;
            case 4:
                chance = 0.12;   // 20% chance
                break;
            case 5:
                chance = 0.15;  // 25% chance
                break;
            default:
                chance = 0;
                break;
        }

        // Apply the effect based on the calculated chance
        if (Math.random() < chance) {
            attackingEntity.addEffect("minecraft:strength", 40, {
                amplifier: setcheckbear - 1,
                showParticles: false
            });
        }
    }
}