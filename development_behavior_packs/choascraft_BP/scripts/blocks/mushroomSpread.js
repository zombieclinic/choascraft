import { BlockPermutation, EquipmentSlot } from "@minecraft/server";

const BONE_MEAL = "minecraft:bone_meal";
const DEFAULT_CHANCE = 0.2;
const DEFAULT_RADIUS = 1;
const GROWTH_PARTICLE = "minecraft:crop_growth_emitter";
const BONE_MEAL_SOUND = "item.bone_meal.use";

export class MushroomSpreadComponent {
  onPlayerInteract(event, component) {
    const player = event.player;
    const block = event.block;
    if (!player || !block) return;

    const equipment = player.getComponent("minecraft:equippable");
    let item = equipment?.getEquipment(EquipmentSlot.Mainhand);
    if (!item || item.typeId !== BONE_MEAL) return;

    const params = component?.params ?? {};
    const candidates = getSpreadCandidates(block, params);
    if (candidates.length === 0) return;

    const chance = params.chance ?? DEFAULT_CHANCE;
    const didSpread = Math.random() < chance && placeMushroom(block, candidates);
    spawnGrowthEffects(block);

    if (!isCreative(player)) {
      item.amount <= 1 ? item = undefined : item.amount--;
      equipment.setEquipment(EquipmentSlot.Mainhand, item);
    }
  }
}

function getSpreadCandidates(source, params) {
  const radius = params.spread_radius ?? DEFAULT_RADIUS;
  const candidates = [];

  for (let x = -radius; x <= radius; x++) {
    for (let z = -radius; z <= radius; z++) {
      if (x === 0 && z === 0) continue;

      const location = source.location;
      const target = source.dimension.getBlock({
        x: location.x + x,
        y: location.y,
        z: location.z + z
      });

      if (canPlaceMushroom(target, params.valid_base_blocks)) {
        candidates.push(target);
      }
    }
  }

  return candidates;
}

function placeMushroom(source, candidates) {
  const target = candidates[Math.floor(Math.random() * candidates.length)];

  try {
    target.setPermutation(BlockPermutation.resolve(source.typeId));
    return true;
  } catch {
    return false;
  }
}

function canPlaceMushroom(block, validBaseBlocks) {
  if (!block || !(block.isAir || block.isLiquid || block.hasTag("plant"))) return false;

  const below = block.below();
  if (!below) return false;
  if (!Array.isArray(validBaseBlocks) || validBaseBlocks.length === 0) return true;

  return validBaseBlocks.includes(below.typeId);
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
