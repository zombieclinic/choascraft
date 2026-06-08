import { BlockPermutation, EquipmentSlot, ItemStack, system } from "@minecraft/server";

const BONE_MEAL = "minecraft:bone_meal";
const CORRUPTED_SPIRE = "zombie:corrupted_spire";
const INFECTED_CRYSTAL = "zombie:infected_crystal";
const STAGE_STATE = "zombie:growth_stage";
const COMPLETE_STATE = "zombie:spire_complete";
const GROWTH_PARTICLE = "minecraft:crop_growth_emitter";
const BONE_MEAL_SOUND = "item.bone_meal.use";
const AIR = "minecraft:air";
const activeCleanups = new Set();

export class CorruptedSpireGrowthComponent {
  beforeOnPlayerPlace(event) {
    if (!hasRoomForStage(event.block, 3)) {
      event.cancel = true;
    }
  }

  onTick(event) {
    growCorruptedSpire(event.block);
  }

  onPlayerInteract(event) {
    const player = event.player;
    if (!player) return;

    const equipment = player.getComponent("minecraft:equippable");
    let item = equipment?.getEquipment(EquipmentSlot.Mainhand);
    if (!item || item.typeId !== BONE_MEAL) return;
    if (!growCorruptedSpire(event.block, true)) return;

    if (!isCreative(player)) {
      item.amount <= 1 ? item = undefined : item.amount--;
      equipment.setEquipment(EquipmentSlot.Mainhand, item);
    }
  }
}

export class CorruptedSpireBreakComponent {
  onPlayerBreak(event) {
    cleanupCorruptedSpire(event.block, event.brokenBlockPermutation, event.player);
  }

  onBreak(event) {
    cleanupCorruptedSpire(event.block, event.brokenBlockPermutation);
  }
}

function growCorruptedSpire(block, playEffects = false) {
  if (!isSpireStage(block, 0)) return false;
  if (isComplete(block)) return false;
  if (!isValidBase(block.below())) return false;
  if (!hasRoomForStage(block, 3)) return false;

  try {
    let target = block;
    for (let stage = 1; stage <= 3; stage++) {
      target = target.above();
      target.setPermutation(BlockPermutation.resolve(CORRUPTED_SPIRE, {
        [STAGE_STATE]: stage,
        [COMPLETE_STATE]: true
      }));
    }

    block.setPermutation(block.permutation.withState(COMPLETE_STATE, true));

    if (playEffects) {
      const location = block.above().above().above().center();
      block.dimension.spawnParticle(GROWTH_PARTICLE, location);
      block.dimension.playSound(BONE_MEAL_SOUND, location);
    }

    return true;
  } catch {
    return false;
  }
}

function hasRoomForStage(block, stage) {
  if (!block) return false;

  let cursor = block;
  for (let i = 0; i < stage; i++) {
    cursor = cursor.above();
    if (!canReplace(cursor)) return false;
  }

  return true;
}

function getStage(block) {
  try {
    const stage = block.permutation.getState(STAGE_STATE);
    return typeof stage === "number" ? stage : undefined;
  } catch {
    return undefined;
  }
}

function canReplace(block) {
  return !!block && (block.isAir || block.isLiquid || block.hasTag("plant") || block.typeId === "minecraft:snow_layer");
}

function isValidBase(block) {
  return !!block && [
    "zombie:infected_grass_block",
    "zombie:infected_dirt",
    "zombie:infected_gravel",
    "zombie:infected_sand",
    "zombie:infected_sporestone",
    "zombie:infected_stone"
  ].includes(block.typeId);
}

function isSpireStage(block, stage) {
  if (!block || block.typeId !== CORRUPTED_SPIRE) return false;

  try {
    return block.permutation.getState(STAGE_STATE) === stage;
  } catch {
    return false;
  }
}

function isComplete(block) {
  try {
    return block.permutation.getState(COMPLETE_STATE) === true;
  } catch {
    return false;
  }
}

function isCreative(player) {
  try {
    return player?.getGameMode() === "Creative";
  } catch {
    return false;
  }
}

function cleanupCorruptedSpire(block, brokenPermutation, player) {
  if (!block || !brokenPermutation) return;

  const brokenType = brokenPermutation.type?.id ?? brokenPermutation.typeId;
  if (brokenType !== CORRUPTED_SPIRE) return;

  const stage = getStageFromPermutation(brokenPermutation);
  if (stage === undefined) return;

  const base = getBaseBlock(block, stage);
  if (!base) return;

  const key = getBlockKey(base);
  if (activeCleanups.has(key)) return;
  activeCleanups.add(key);

  system.run(() => {
    try {
      if (!isCreative(player) && Math.random() < getCrystalDropChance(player)) {
        block.dimension.spawnItem(new ItemStack(INFECTED_CRYSTAL, 1), block.center());
      }

      if (stage > 0 && base.typeId === CORRUPTED_SPIRE) {
        let part = base;
        for (let offset = 1; offset <= 3; offset++) {
          part = part?.above();
          if (part?.typeId === CORRUPTED_SPIRE) {
            part.setType(AIR);
          }
        }

        base.setPermutation(BlockPermutation.resolve(CORRUPTED_SPIRE, {
          [STAGE_STATE]: 0,
          [COMPLETE_STATE]: false
        }));
      }
    } catch {
    } finally {
      system.run(() => activeCleanups.delete(key));
    }
  });
}

function getStageFromPermutation(permutation) {
  try {
    const stage = permutation.getState(STAGE_STATE);
    return typeof stage === "number" ? stage : undefined;
  } catch {
    return undefined;
  }
}

function getCrystalDropChance(player) {
  const looting = getLootingLevel(player);

  if (looting >= 3) return 0.5;
  if (looting === 2) return 0.35;
  if (looting === 1) return 0.25;
  return 0.15;
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

function getBaseBlock(block, stage) {
  let cursor = block;

  for (let i = 0; i < stage; i++) {
    cursor = cursor?.below();
  }

  return cursor;
}

function getBlockKey(block) {
  const { x, y, z } = block.location;

  return `${block.dimension.id}:${x}:${y}:${z}`;
}
