import { EquipmentSlot, ItemStack, system } from "@minecraft/server";

const RAW_DEMON_STEEL = "zombie:raw_demon_steel";
const VALID_PICKAXES = new Set([
  "minecraft:diamond_pickaxe",
  "minecraft:netherite_pickaxe"
]);

export class DemonSteelOreDropComponent {
  onPlayerBreak(event) {
    const player = event.player;
    if (!player || isCreative(player)) return;

    const tool = getMainhand(player);
    if (!tool || !VALID_PICKAXES.has(tool.typeId)) return;

    const amount = getDropAmount(tool);
    const location = event.block?.center();
    const dimension = event.block?.dimension;
    if (!dimension || !location) return;

    system.run(() => {
      try {
        dimension.spawnItem(new ItemStack(RAW_DEMON_STEEL, amount), location);
      } catch {
      }
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

function getDropAmount(tool) {
  const fortune = Math.min(getFortuneLevel(tool), 3);
  if (fortune <= 0) return 1;

  return 1 + Math.floor(Math.random() * (fortune + 1));
}

function getFortuneLevel(tool) {
  try {
    return tool.getComponent("minecraft:enchantable")?.getEnchantment("fortune")?.level ?? 0;
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
