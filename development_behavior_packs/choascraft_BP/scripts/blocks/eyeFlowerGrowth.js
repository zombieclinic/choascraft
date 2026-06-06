import { BlockPermutation, EquipmentSlot, ItemStack, system } from "@minecraft/server";

const AIR = "minecraft:air";
const BONE_MEAL = "minecraft:bone_meal";
const EYE_FLOWER = "zombie:eye_flower";
const EYE_FLOWER_SEED = "zombie:eye_flower_seed";
const STAGE_STATE = "zombie:growth_stage";
const PART_STATE = "zombie:eye_flower_part";
const BOTTOM = "bottom";
const TOP = "top";
const MAX_STAGE = 3;
const GROWTH_PARTICLE = "minecraft:crop_growth_emitter";
const BONE_MEAL_SOUND = "item.bone_meal.use";
const activeCleanups = new Set();

export class EyeFlowerTickComponent {
  onTick(event) {
    if (syncFlowerTop(event.block)) return;
    growFlower(event.block);
  }
}

export class EyeFlowerGrowthComponent {
  beforeOnPlayerPlace(event) {
    const block = event.block;
    if (!block) return;

    const above = block.above();
    if (!canReplace(above)) {
      event.cancel = true;
    }
  }

  onPlace(event) {
    syncFlowerTop(event.block);
  }

  onPlayerInteract(event) {
    const player = event.player;
    if (!player) return;

    const equipment = player.getComponent("minecraft:equippable");
    let item = equipment?.getEquipment(EquipmentSlot.Mainhand);
    if (!item || item.typeId !== BONE_MEAL) return;
    if (!growFlower(event.block, true)) return;

    if (!isCreative(player)) {
      item.amount <= 1 ? item = undefined : item.amount--;
      equipment.setEquipment(EquipmentSlot.Mainhand, item);
    }
  }

  onPlayerBreak(event) {
    cleanupFlower(event.block, event.brokenBlockPermutation, event.player);
  }

  onBreak(event) {
    cleanupFlower(event.block, event.brokenBlockPermutation);
  }
}

function growFlower(block, playEffects = false) {
  if (!isFlowerPart(block, BOTTOM)) return false;
  if (!isValidBase(block.below())) return false;

  const stage = getStage(block);
  if (stage === undefined || stage >= MAX_STAGE) return false;
  if (stage === MAX_STAGE - 1 && !canReplace(block.above())) return false;

  const nextStage = stage + 1;

  try {
    block.setPermutation(block.permutation.withState(STAGE_STATE, nextStage));

    if (nextStage >= MAX_STAGE) {
      setFlowerTop(block.above());
    }

    if (playEffects) {
      const location = block.center();
      block.dimension.spawnParticle(GROWTH_PARTICLE, location);
      block.dimension.playSound(BONE_MEAL_SOUND, location);
    }

    return true;
  } catch {
    return false;
  }
}

function syncFlowerTop(block) {
  if (!isFlowerPart(block, BOTTOM)) return false;
  if (!isValidBase(block.below())) return false;

  const stage = getStage(block);
  if (stage === undefined || stage < MAX_STAGE) return false;

  return setFlowerTop(block.above());
}

function setFlowerTop(block) {
  if (!block) return false;
  if (isFlowerPart(block, TOP)) return false;
  if (!canReplace(block)) return false;

  try {
    block.setPermutation(BlockPermutation.resolve(EYE_FLOWER, {
      [STAGE_STATE]: MAX_STAGE,
      [PART_STATE]: TOP
    }));
    return true;
  } catch {
    return false;
  }
}

function cleanupFlower(block, brokenPermutation, player) {
  if (!block || !brokenPermutation) return;

  const brokenType = brokenPermutation.type?.id ?? brokenPermutation.typeId;
  const brokenPart = getPart(brokenPermutation);
  const lower = getBottomBlock(block, brokenType, brokenPart);
  if (!lower) return;

  const key = getBlockKey(lower);
  if (activeCleanups.has(key)) return;
  activeCleanups.add(key);

  system.run(() => {
    try {
      const topBreakDrops = brokenPart !== BOTTOM && !isCreative(player) ? 2 : 0;

      for (const part of [lower.above(), lower]) {
        if (part?.typeId === EYE_FLOWER) {
          part.setType(AIR);
        }
      }

      if (topBreakDrops > 0) {
        lower.dimension.spawnItem(new ItemStack(EYE_FLOWER_SEED, topBreakDrops), lower.center());
      }
    } catch {
    } finally {
      system.run(() => activeCleanups.delete(key));
    }
  });
}

function getBottomBlock(block, typeId, part) {
  if (typeId !== EYE_FLOWER) return;
  if (part === BOTTOM) return block;
  if (part === TOP) return block.below();
}

function getStage(block) {
  try {
    const stage = block.permutation.getState(STAGE_STATE);
    return typeof stage === "number" ? stage : undefined;
  } catch {
    return undefined;
  }
}

function getPart(permutation) {
  try {
    return permutation.getState(PART_STATE);
  } catch {
    return undefined;
  }
}

function isFlowerPart(block, part) {
  if (!block || block.typeId !== EYE_FLOWER) return false;

  try {
    return block.permutation.getState(PART_STATE) === part;
  } catch {
    return false;
  }
}

function canReplace(block) {
  return !!block && (block.isAir || block.isLiquid || block.hasTag("plant"));
}

function isValidBase(block) {
  return !!block && [
    "zombie:infected_grass_block",
    "zombie:infected_dirt",
    "zombie:infected_gravel",
    "zombie:infected_sand",
    "zombie:infected_sporestone",
    "zombie:infected_stone",
    "minecraft:dirt",
    "minecraft:grass_block",
    "minecraft:stone"
  ].includes(block.typeId);
}

function isCreative(player) {
  try {
    return player?.getGameMode() === "Creative";
  } catch {
    return false;
  }
}

function getBlockKey(block) {
  const { x, y, z } = block.location;

  return `${block.dimension.id}:${x}:${y}:${z}`;
}
