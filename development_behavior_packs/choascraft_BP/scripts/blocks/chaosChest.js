import { EquipmentSlot, GameMode, system } from "@minecraft/server";

const OPEN_STATE = "zombie:open";
const CHAOS_CHEST = "zombie:chaos_chest";
const CHAOS_KEY = "zombie:chaos_key";
const CHAOS_LOOT_TABLE = "loot_tables/chaos_chest";
const MIMIC_OPEN_SOUND = "zombie.mimic.open";
const DESTROY_DELAY_TICKS = 4;

// Edit these chances and arrays to tune the chaos chest.
const NO_KEY_LOOT_CHANCE = 0.2;
const KEYED_LOOT_CHANCE = 0.95;
const KEYED_MONSTER_PICK_CHANCE = 0.35;

const MONSTER_MOBS = [
  { id: "zombie:hell_brute", weight: 10 },
  { id: "zombie:emberstalker", weight: 14 },
  { id: "zombie:infected_eye_abomination", weight: 8 },
  { id: "zombie:flesh_pod", weight: 12 },
  { id: "zombie:crusher", weight: 7 },
  { id: "zombie:impaler", weight: 8 },
  { id: "zombie:spitter", weight: 10 },
  { id: "zombie:runner", weight: 12 },
  { id: "zombie:walker", weight: 16 },
  { id: "zombie:orca_zombie", weight: 5 },
  { id: "zombie:zombie_greatwhite_shark", weight: 4 },
  { id: "zombie:zombie_hammerhead_shark", weight: 4 },
  { id: "minecraft:zombie", weight: 14 },
  { id: "minecraft:skeleton", weight: 10 },
  { id: "minecraft:spider", weight: 8 },
  { id: "minecraft:creeper", weight: 6 },
  { id: "minecraft:enderman", weight: 4 },
  { id: "minecraft:witch", weight: 3 }
];

const NICE_MOBS = [
  { id: "zombie:king_penguin", weight: 10 },
  { id: "zombie:crab", weight: 8 },
  { id: "zombie:peeper", weight: 8 },
  { id: "zombie:brown_bear", weight: 4 },
  { id: "zombie:black_bear", weight: 4 },
  { id: "minecraft:cow", weight: 12 },
  { id: "minecraft:pig", weight: 12 },
  { id: "minecraft:sheep", weight: 12 },
  { id: "minecraft:chicken", weight: 12 },
  { id: "minecraft:wolf", weight: 5 },
  { id: "minecraft:cat", weight: 4 },
  { id: "minecraft:allay", weight: 2 }
];

const openedChests = new Set();

export class ChaosChestComponent {
  onPlayerInteract(event) {
    const block = event.block;
    if (!block) return;

    const key = blockKey(block);
    if (openedChests.has(key)) return;
    openedChests.add(key);

    const player = event.player;
    const usedItem = getInteractionItem(event, player);
    const hasKey = isChaosKey(usedItem);

    block.setPermutation(block.permutation.withState(OPEN_STATE, 1));
    playMimicOpenSound(block);

    if (!hasKey && Math.random() >= NO_KEY_LOOT_CHANCE) {
      finishWithMob(block, chooseWeighted(MONSTER_MOBS));
      return;
    }

    if (hasKey) {
      consumeHeldKey(player, usedItem);

      if (Math.random() >= KEYED_LOOT_CHANCE) {
        const mobPool = Math.random() < KEYED_MONSTER_PICK_CHANCE ? MONSTER_MOBS : NICE_MOBS;
        finishWithMob(block, chooseWeighted(mobPool));
        return;
      }
    }

    destroyForLoot(block);
  }
}

function finishWithMob(block, mobId) {
  const dimension = block.dimension;
  const location = blockLocation(block);
  const { x, y, z } = location;
  const spawnLocation = { x: x + 0.5, y: y + 1, z: z + 0.5 };

system.runTimeout(() => {
  const chestKey = `${dimension.id}:${x},${y},${z}`;

  setBlockToAir(dimension, location);

  trySpawnEntity(dimension, mobId, spawnLocation);

  system.runTimeout(() => {
    const currentBlock = getBlock(dimension, location);

    if (currentBlock?.typeId === CHAOS_CHEST) {
      setBlockToAir(dimension, location);
    }

    openedChests.delete(chestKey);
  }, 2);
}, DESTROY_DELAY_TICKS);
}

function destroyForLoot(block) {
  const dimension = block.dimension;
  const { x, y, z } = block.location;
  const chestKey = `${dimension.id}:${x},${y},${z}`;

  system.runTimeout(() => {
    try {
      dimension.runCommand(`setblock ${x} ${y} ${z} air destroy`);
    } catch (error) {
      console.warn(`[Chaos Chest] Could not destroy chest: ${error}`);
    }

    openedChests.delete(chestKey);
  }, DESTROY_DELAY_TICKS);
}


function setBlockToAir(dimension, location) {
  const block = getBlock(dimension, location);

  if (block) {
    try {
      block.setType("minecraft:air");
      return;
    } catch {}
  }

  try {
    dimension.runCommandAsync(`setblock ${location.x} ${location.y} ${location.z} air`).catch(() => {});
  } catch {}
}

function getBlock(dimension, location) {
  try {
    return dimension.getBlock(location);
  } catch {
    return undefined;
  }
}

function trySpawnEntity(dimension, mobId, location) {
  if (!mobId || mobId === "minecraft:ender_dragon") return;

  try {
    dimension.spawnEntity(mobId, location);
    return;
  } catch {}

  try {
    dimension.runCommandAsync(`summon ${mobId} ${location.x} ${location.y} ${location.z}`).catch(() => {});
  } catch {}
}

function playMimicOpenSound(block) {
  try {
    block.dimension.playSound(MIMIC_OPEN_SOUND, block.center());
  } catch {}
}

function getInteractionItem(event, player) {
  if (event?.itemStack) return event.itemStack;

  try {
    return player
      ?.getComponent("minecraft:equippable")
      ?.getEquipment(EquipmentSlot.Mainhand);
  } catch {
    return undefined;
  }
}

function isChaosKey(itemStack) {
  return itemStack?.typeId === CHAOS_KEY;
}

function consumeHeldKey(player, itemStack) {
  if (!player || !isChaosKey(itemStack)) return;
  if (player.matches?.({ gameMode: GameMode.creative })) return;

  try {
    const equippable = player.getComponent("minecraft:equippable");
    if (!equippable) return;

    if (itemStack.amount > 1) {
      itemStack.amount -= 1;
      equippable.setEquipment(EquipmentSlot.Mainhand, itemStack);
    } else {
      equippable.setEquipment(EquipmentSlot.Mainhand, undefined);
    }
  } catch {}
}

function chooseWeighted(entries) {
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight ?? 1), 0);
  let roll = Math.random() * totalWeight;

  for (const entry of entries) {
    roll -= Math.max(0, entry.weight ?? 1);
    if (roll <= 0) return entry.id;
  }

  return entries[0]?.id;
}

function blockLocation(block) {
  return {
    x: block.location.x,
    y: block.location.y,
    z: block.location.z
  };
}

function blockKey(block) {
  return `${block.dimension.id}:${block.location.x},${block.location.y},${block.location.z}`;
}
