import { ItemStack, system } from "@minecraft/server";

const ALTAR_BLOCK_IDS = new Set([
  "zombie:demon_alter",
  "zombie:demon_alter_level_2",
  "zombie:demon_alter_level_3",
  "zombie:demon_alter_level_4",
  "zombie:demon_alter_level_5"
]);
const CORRUPTED_XP_ORB = "zombie:currupted_xp_orb";
const VANILLA_XP_ORB = "minecraft:xp_orb";
const SEARCH_RADIUS = 2;
const SACRIFICE_HEIGHT = 3;
const XP_CONVERT_DELAY = 2;
const poweredAltars = new Set();

export class DemonAlterComponent {
  onRedstoneUpdate(event) {
    const block = event.block;
    if (!block || !ALTAR_BLOCK_IDS.has(block.typeId)) return;

    const key = blockKey(block);
    const power = event.powerLevel ?? event.power ?? 0;

    if (power <= 0) {
      poweredAltars.delete(key);
      return;
    }

    if (poweredAltars.has(key)) return;
    poweredAltars.add(key);
    sacrificeAtAltar(block);

    // Allows another button pulse even if a redstone update is missed.
    system.runTimeout(() => poweredAltars.delete(key), 30);
  }
}

function sacrificeAtAltar(block) {
  const sacrifice = findSacrificeEntity(block);
  if (!sacrifice) return false;

  const dimension = block.dimension;
  const location = {
    x: sacrifice.location.x,
    y: sacrifice.location.y + 0.25,
    z: sacrifice.location.z
  };

  if (!killEntity(sacrifice)) return false;

  system.runTimeout(() => {
    convertXp(dimension, location);
  }, XP_CONVERT_DELAY);

  return true;
}

function findSacrificeEntity(block) {
  try {
    const entities = block.dimension.getEntities({
      location: {
        x: block.location.x + 0.5,
        y: block.location.y + 1.5,
        z: block.location.z + 0.5
      },
      maxDistance: SEARCH_RADIUS
    });

    return entities.find((entity) =>
      isSacrificeEntity(entity) &&
      isInsideSacrificeColumn(entity.location, block)
    );
  } catch {
    return undefined;
  }
}

function isSacrificeEntity(entity) {
  if (!isValid(entity)) return false;
  return entity.typeId !== VANILLA_XP_ORB && entity.typeId !== "minecraft:item";
}

function isInsideSacrificeColumn(location, block) {
  return (
    location.x >= block.location.x &&
    location.x < block.location.x + 1 &&
    location.z >= block.location.z &&
    location.z < block.location.z + 1 &&
    location.y >= block.location.y &&
    location.y < block.location.y + SACRIFICE_HEIGHT
  );
}

function killEntity(entity) {
  try {
    entity.kill();
    return true;
  } catch {
    try {
      entity.remove();
      return true;
    } catch {
      return false;
    }
  }
}

function convertXp(dimension, location) {
  let converted = 0;

  try {
    const orbs = dimension.getEntities({
      type: VANILLA_XP_ORB,
      location,
      maxDistance: 4
    });

    for (const orb of orbs) {
      if (!isValid(orb)) continue;
      converted++;
      try {
        orb.remove();
      } catch {}
    }
  } catch {}

  // Every successful sacrifice produces at least one Corrupted XP Orb.
  if (converted === 0) converted = 1;

  try {
    dimension.spawnItem(
      new ItemStack(CORRUPTED_XP_ORB, Math.min(converted, 64)),
      location
    );
  } catch {}
}

function isValid(entity) {
  if (!entity) return false;
  if (typeof entity.isValid === "function") return entity.isValid();
  return entity.isValid !== false;
}

function blockKey(block) {
  return `${block.dimension.id}:${block.location.x},${block.location.y},${block.location.z}`;
}
