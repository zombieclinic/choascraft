import { EquipmentSlot, ItemStack, system } from "@minecraft/server";

const HELL_GRASS_SEEDS = "zombie:hell_grass_seeds";

export class CorruptedGrassDropComponent {
  onPlayerBreak(event) {
    const player = event.player;
    if (!player || isCreative(player)) return;

    const tool = getMainhand(player);
    const fortune = Math.min(getFortuneLevel(tool), 3);
    const chance = 0.2 + fortune * 0.15;
    if (Math.random() >= chance) return;

    const amount = 1 + (fortune > 0 ? Math.floor(Math.random() * (fortune + 1)) : 0);
    const block = event.block;
    const dimension = block?.dimension;
    const location = block?.center();
    if (!dimension || !location) return;

    system.run(() => {
      try {
        dimension.spawnItem(new ItemStack(HELL_GRASS_SEEDS, amount), location);
      } catch {}
    });
  }
}

function getMainhand(player) {
  try {
    return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
  } catch {
    return undefined;
  }
}

function getFortuneLevel(tool) {
  try {
    return tool?.getComponent("minecraft:enchantable")?.getEnchantment("fortune")?.level ?? 0;
  } catch {
    return 0;
  }
}

function isCreative(player) {
  try {
    return player.getGameMode() === "Creative";
  } catch {
    return false;
  }
}
