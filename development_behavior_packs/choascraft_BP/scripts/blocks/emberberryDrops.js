import { EquipmentSlot, ItemStack, system, world } from "@minecraft/server";

const EMBERBERRY_BLOCK = "zombie:emberberry";
const EMBERBERRIES = "zombie:emberberrys";
const STAGE_STATE = "zombie:growth_stage";
const MAX_STAGE = 4;

world.afterEvents.playerBreakBlock.subscribe((event) => {
  const permutation = event.brokenBlockPermutation;
  const player = event.player;
  const block = event.block;
  if (!permutation || !block || permutation.type?.id !== EMBERBERRY_BLOCK) return;
  if (getStage(permutation) < MAX_STAGE || isCreative(player)) return;

  const count = getDropCount(player);
  if (count <= 0) return;

  system.run(() => {
    try {
      block.dimension.spawnItem(new ItemStack(EMBERBERRIES, count), block.center());
    } catch {
    }
  });
});

function getDropCount(player) {
  let count = Math.random() < 0.35 ? 1 : 0;
  const looting = getLootingLevel(player);

  if (looting >= 1 && Math.random() < 0.45) count++;
  if (looting >= 2 && Math.random() < 0.35) count++;
  if (looting >= 3 && Math.random() < 0.25) count++;

  return count;
}

function getLootingLevel(player) {
  try {
    const equipment = player?.getComponent("minecraft:equippable");
    const item = equipment?.getEquipment(EquipmentSlot.Mainhand);
    const enchantable = item?.getComponent("minecraft:enchantable");
    const looting = enchantable?.getEnchantment("looting");

    return looting?.level ?? 0;
  } catch {
    return 0;
  }
}

function getStage(permutation) {
  try {
    const stage = permutation.getState(STAGE_STATE);
    return typeof stage === "number" ? stage : 0;
  } catch {
    return 0;
  }
}

function isCreative(player) {
  try {
    return player?.getGameMode() === "Creative";
  } catch {
    return false;
  }
}
