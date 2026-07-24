import { system } from "@minecraft/server";

const PENTAGRAM = "zombie:demon_pentagram";
const SKULL = "zombie:demon_skull";
const DEMON_LORD = "zombie:demon_lord";
const AIR = "minecraft:air";
const activeRituals = new Set();

const CENTER_OFFSETS = [
  { x: 0, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 }
];

const RITUAL_ORIENTATIONS = [
  [
    { x: 0, y: 0, z: 0, typeId: PENTAGRAM },
    { x: 0, y: -1, z: 0, typeId: PENTAGRAM },
    { x: 0, y: 1, z: 0, typeId: SKULL },
    { x: -1, y: 0, z: 0, typeId: SKULL },
    { x: 1, y: 0, z: 0, typeId: SKULL }
  ],
  [
    { x: 0, y: 0, z: 0, typeId: PENTAGRAM },
    { x: 0, y: -1, z: 0, typeId: PENTAGRAM },
    { x: 0, y: 1, z: 0, typeId: SKULL },
    { x: 0, y: 0, z: -1, typeId: SKULL },
    { x: 0, y: 0, z: 1, typeId: SKULL }
  ]
];

export class DemonLordRitualComponent {
  onPlace({ block }) {
    if (!block) return;

    // Wait until the placed block is fully committed before checking neighbors.
    system.run(() => checkForRitual(block.dimension, block.location));
  }
}

function checkForRitual(dimension, placedLocation) {
  for (const offset of CENTER_OFFSETS) {
    const center = addLocations(placedLocation, offset);

    for (const formation of RITUAL_ORIENTATIONS) {
      if (!matchesFormation(dimension, center, formation)) continue;
      completeRitual(dimension, center, formation);
      return;
    }
  }
}

function matchesFormation(dimension, center, formation) {
  for (const part of formation) {
    const block = getBlock(dimension, addLocations(center, part));
    if (block?.typeId !== part.typeId) return false;
  }
  return true;
}

function completeRitual(dimension, center, formation) {
  const key = `${dimension.id}:${center.x},${center.y},${center.z}`;
  if (activeRituals.has(key)) return;
  activeRituals.add(key);

  try {
    for (const part of formation) {
      getBlock(dimension, addLocations(center, part))?.setType(AIR);
    }

    const spawnLocation = {
      x: center.x + 0.5,
      y: center.y - 1,
      z: center.z + 0.5
    };
    dimension.spawnEntity(DEMON_LORD, spawnLocation);

    try {
      dimension.playSound("mob.wither.spawn", spawnLocation, {
        volume: 1,
        pitch: 0.65
      });
    } catch {}

    try {
      dimension.spawnParticle("minecraft:huge_explosion_emitter", {
        x: center.x + 0.5,
        y: center.y + 0.5,
        z: center.z + 0.5
      });
    } catch {}
  } finally {
    system.runTimeout(() => activeRituals.delete(key), 20);
  }
}

function getBlock(dimension, location) {
  try {
    return dimension.getBlock(location);
  } catch {
    return undefined;
  }
}

function addLocations(location, offset) {
  return {
    x: location.x + offset.x,
    y: location.y + offset.y,
    z: location.z + offset.z
  };
}
