import { BlockPermutation, EquipmentSlot, system } from "@minecraft/server";

const AIR = "minecraft:air";
const BONE_MEAL = "minecraft:bone_meal";
const BLOOD_ROOT = "zombie:blood_root";
const DEFAULT_STAGE_STATE = "zombie:growth_stage";
const DEFAULT_PART_STATE = "zombie:blood_root_part";
const DEFAULT_HAS_TOP_STATE = "zombie:blood_root_has_top";
const BOTTOM = "bottom";
const TOP = "top";
const FALSE = "false";
const TRUE = "true";
const DEFAULT_MAX_STAGE = 3;
const GROWTH_PARTICLE = "minecraft:crop_growth_emitter";
const BONE_MEAL_SOUND = "item.bone_meal.use";
const activeCleanups = new Set();

export class BloodRootGrowthComponent {
  beforeOnPlayerPlace(event) {
    const block = event.block;
    if (!block) return;

    const above = block.above();
    if (!canReplace(above)) {
      event.cancel = true;
    }
  }



  onPlayerInteract(event, component) {
    const player = event.player;
    const block = event.block;
    if (!player || !block) return;

    const equipment = player.getComponent("minecraft:equippable");
    let item = equipment?.getEquipment(EquipmentSlot.Mainhand);
    if (!item || item.typeId !== BONE_MEAL) return;
    if (!growBloodRoot(block, component?.params, true)) return;

    if (isCreative(player)) return;

    item.amount <= 1 ? item = undefined : item.amount--;
    equipment.setEquipment(EquipmentSlot.Mainhand, item);
  }

  onPlayerBreak(event) {
    cleanupBloodRoot(event.block, event.brokenBlockPermutation);
  }

  onBreak(event) {
    cleanupBloodRoot(event.block, event.brokenBlockPermutation);
  }
}


export class BloodRootTickComponent {
  onTick(event, component) {
    growBloodRoot(event.block, component?.params);
  }
}
function growBloodRoot(block, params = {}, playEffects = false) {
  if (!isBloodRootPart(block, BOTTOM, params)) return false;
  if (!isOnValidBase(block, params.valid_base_blocks)) return false;

  const stageState = params.stage_state ?? DEFAULT_STAGE_STATE;
  const hasTopState = params.has_top_state ?? DEFAULT_HAS_TOP_STATE;
  const maxStage = params.max_stage ?? DEFAULT_MAX_STAGE;
  const stage = getState(block, stageState);
  const hasTop = getState(block, hasTopState) === TRUE;

  if (typeof stage !== "number" || hasTop) return false;

  if (stage < maxStage) {
    return setGrowthStage(block, stageState, stage + 1, playEffects);
  }

  if (stage === maxStage) {
    return setBloodRootTop(block, params, playEffects);
  }

  return false;
}

function setGrowthStage(block, stageState, stage, playEffects) {
  try {
    block.setPermutation(block.permutation.withState(stageState, stage));
    if (playEffects) spawnGrowthEffects(block);
    return true;
  } catch {
    return false;
  }
}

function setBloodRootTop(block, params, playEffects) {
  const above = block.above();
  if (!canReplace(above)) return false;

  const stageState = params.stage_state ?? DEFAULT_STAGE_STATE;
  const partState = params.part_state ?? DEFAULT_PART_STATE;
  const hasTopState = params.has_top_state ?? DEFAULT_HAS_TOP_STATE;
  const maxStage = params.max_stage ?? DEFAULT_MAX_STAGE;

  try {
    above.setPermutation(BlockPermutation.resolve(BLOOD_ROOT, {
      [stageState]: maxStage,
      [partState]: TOP,
      [hasTopState]: TRUE
    }));

    block.setPermutation(block.permutation.withState(hasTopState, TRUE));
    if (playEffects) spawnGrowthEffects(block);
    return true;
  } catch {
    return false;
  }
}

function cleanupBloodRoot(block, brokenPermutation) {
  if (!block || !brokenPermutation) return;

  const brokenType = brokenPermutation.type?.id ?? brokenPermutation.typeId;
  if (brokenType !== BLOOD_ROOT) return;

  const part = getPart(brokenPermutation);
  const lower = part === TOP ? block.below() : block;
  if (!lower) return;

  const key = getBlockKey(lower);
  if (activeCleanups.has(key)) return;
  activeCleanups.add(key);

  system.run(() => {
    try {
      const top = lower.above();
      if (top?.typeId === BLOOD_ROOT && getPart(top.permutation) === TOP) {
        top.setType(AIR);
      }

      if (part === TOP && lower.typeId === BLOOD_ROOT) {
        lower.setType(AIR);
      }
    } catch {
    } finally {
      system.run(() => activeCleanups.delete(key));
    }
  });
}

function isBloodRootPart(block, part, params = {}) {
  if (!block || block.typeId !== BLOOD_ROOT) return false;

  const partState = params.part_state ?? DEFAULT_PART_STATE;
  return getState(block, partState) === part;
}

function getPart(permutation) {
  try {
    return permutation.getState(DEFAULT_PART_STATE);
  } catch {
    return undefined;
  }
}

function getState(blockOrPermutation, state) {
  try {
    const permutation = blockOrPermutation.permutation ?? blockOrPermutation;
    return permutation.getState(state);
  } catch {
    return undefined;
  }
}

function canReplace(block) {
  return !!block && (block.isAir || block.isLiquid || block.hasTag("plant"));
}

function isOnValidBase(block, validBaseBlocks) {
  if (!Array.isArray(validBaseBlocks) || validBaseBlocks.length === 0) return true;

  try {
    const below = block.below();
    return below ? validBaseBlocks.includes(below.typeId) : false;
  } catch {
    return false;
  }
}

function spawnGrowthEffects(block) {
  const location = block.center();

  try {
    block.dimension.spawnParticle(GROWTH_PARTICLE, location);
  } catch {
  }

  try {
    block.dimension.playSound(BONE_MEAL_SOUND, location);
  } catch {
  }
}

function isCreative(player) {
  try {
    return player.getGameMode() === "Creative";
  } catch {
    return false;
  }
}

function getBlockKey(block) {
  const { x, y, z } = block.location;
  return `${block.dimension.id}:${x}:${y}:${z}`;
}

