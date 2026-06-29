import {
  EquipmentSlot,
  EntityComponentTypes,
  system,
  world
} from "@minecraft/server";

const CHAOS_HELMET = "zombie:chaos_helmet";
const SCAN_INTERVAL_TICKS = 5;
const PLAYERS_PER_CYCLE = 20;
const ENTITY_DISTANCE = 20;
const BLOCK_DISTANCE = 12;

const TOOL_RULES = {
  "zombie:demon_steel_ore": "\u00a7bDiamond Pickaxe or better",
  "zombie:raw_demon_steel_block": "\u00a7bDiamond Pickaxe or better",
  "zombie:corrupted_xp_ore": "\u00a7fIron Pickaxe or better",
  "zombie:currupted_xp_block": "\u00a7fIron Pickaxe or better",
  "minecraft:diamond_ore": "\u00a7fIron Pickaxe or better",
  "minecraft:deepslate_diamond_ore": "\u00a7fIron Pickaxe or better",
  "minecraft:emerald_ore": "\u00a7fIron Pickaxe or better",
  "minecraft:deepslate_emerald_ore": "\u00a7fIron Pickaxe or better",
  "minecraft:gold_ore": "\u00a7fIron Pickaxe or better",
  "minecraft:deepslate_gold_ore": "\u00a7fIron Pickaxe or better",
  "minecraft:copper_ore": "\u00a78Any Pickaxe",
  "minecraft:deepslate_copper_ore": "\u00a78Any Pickaxe",
  "minecraft:iron_ore": "\u00a77Stone Pickaxe or better",
  "minecraft:deepslate_iron_ore": "\u00a77Stone Pickaxe or better",
  "minecraft:coal_ore": "\u00a78Any Pickaxe",
  "minecraft:deepslate_coal_ore": "\u00a78Any Pickaxe",
  "minecraft:lapis_ore": "\u00a77Stone Pickaxe or better",
  "minecraft:redstone_ore": "\u00a7fIron Pickaxe or better",
  "minecraft:deepslate_redstone_ore": "\u00a7fIron Pickaxe or better",
  "minecraft:obsidian": "\u00a7bDiamond Pickaxe or better",
  "minecraft:ancient_debris": "\u00a7bDiamond Pickaxe or better"
};

const ARMOR_VALUES = {
  "minecraft:leather_helmet": 1,
  "minecraft:leather_chestplate": 3,
  "minecraft:leather_leggings": 2,
  "minecraft:leather_boots": 1,
  "minecraft:chainmail_helmet": 2,
  "minecraft:chainmail_chestplate": 5,
  "minecraft:chainmail_leggings": 4,
  "minecraft:chainmail_boots": 1,
  "minecraft:iron_helmet": 2,
  "minecraft:iron_chestplate": 6,
  "minecraft:iron_leggings": 5,
  "minecraft:iron_boots": 2,
  "minecraft:golden_helmet": 2,
  "minecraft:golden_chestplate": 5,
  "minecraft:golden_leggings": 3,
  "minecraft:golden_boots": 1,
  "minecraft:diamond_helmet": 3,
  "minecraft:diamond_chestplate": 8,
  "minecraft:diamond_leggings": 6,
  "minecraft:diamond_boots": 3,
  "minecraft:netherite_helmet": 3,
  "minecraft:netherite_chestplate": 8,
  "minecraft:netherite_leggings": 6,
  "minecraft:netherite_boots": 3,
  "minecraft:turtle_helmet": 2,
  "zombie:black_bear_boots": 2,
  "zombie:black_bear_chestplate": 4,
  "zombie:black_bear_helmet": 2,
  "zombie:black_bear_leggings": 3,
  "zombie:black_netherite_bear_boots": 3,
  "zombie:black_netherite_bear_chestplate": 8,
  "zombie:black_netherite_bear_helmet": 3,
  "zombie:black_netherite_bear_leggings": 6,
  "zombie:brown_bear_boots": 2,
  "zombie:brown_bear_chestplate": 4,
  "zombie:brown_bear_helmet": 15,
  "zombie:brown_bear_leggings": 3,
  "zombie:brown_netherite_bear_boots": 3,
  "zombie:brown_netherite_bear_chestplate": 8,
  "zombie:brown_netherite_bear_helmet": 3,
  "zombie:brown_netherite_bear_leggings": 6,
  "zombie:chaos_helmet": 4,
  "zombie:crab_boots": 2,
  "zombie:crab_chest": 6,
  "zombie:crab_helmet": 2,
  "zombie:crab_leggings": 5,
  "zombie:crab_netherite_boots": 3,
  "zombie:crab_netherite_chest": 8,
  "zombie:crab_netherite_helmet": 3,
  "zombie:crab_netherite_leggings": 6,
  "zombie:greatwhite_shark_boots": 2,
  "zombie:greatwhite_shark_chest": 6,
  "zombie:greatwhite_shark_helmet": 2,
  "zombie:greatwhite_shark_leggings": 5,
  "zombie:greatwhite_shark_netherite_boots": 3,
  "zombie:greatwhite_shark_netherite_chest": 8,
  "zombie:greatwhite_shark_netherite_helmet": 3,
  "zombie:greatwhite_shark_netherite_leggings": 6,
  "zombie:infected_boots": 3,
  "zombie:infected_chestplate": 8,
  "zombie:infected_helmet": 3,
  "zombie:infected_leggings": 6,
  "zombie:jellyfish_black_boots": 2,
  "zombie:jellyfish_black_chest": 6,
  "zombie:jellyfish_black_helmet": 2,
  "zombie:jellyfish_black_leggings": 5,
  "zombie:jellyfish_green_boots": 2,
  "zombie:jellyfish_green_chest": 6,
  "zombie:jellyfish_green_helmet": 2,
  "zombie:jellyfish_green_leggings": 5,
  "zombie:jellyfish_netherite_black_boots": 3,
  "zombie:jellyfish_netherite_black_chest": 8,
  "zombie:jellyfish_netherite_black_helmet": 3,
  "zombie:jellyfish_netherite_black_leggings": 6,
  "zombie:jellyfish_netherite_green_boots": 3,
  "zombie:jellyfish_netherite_green_chest": 8,
  "zombie:jellyfish_netherite_green_helmet": 3,
  "zombie:jellyfish_netherite_green_leggings": 6,
  "zombie:jellyfish_netherite_pink_boots": 3,
  "zombie:jellyfish_netherite_pink_chest": 8,
  "zombie:jellyfish_netherite_pink_helmet": 3,
  "zombie:jellyfish_netherite_pink_leggings": 6,
  "zombie:jellyfish_netherite_yellow_boots": 3,
  "zombie:jellyfish_netherite_yellow_chest": 8,
  "zombie:jellyfish_netherite_yellow_helmet": 3,
  "zombie:jellyfish_netherite_yellow_leggings": 6,
  "zombie:jellyfish_pink_boots": 2,
  "zombie:jellyfish_pink_chest": 6,
  "zombie:jellyfish_pink_helmet": 2,
  "zombie:jellyfish_pink_leggings": 5,
  "zombie:jellyfish_yellow_boots": 2,
  "zombie:jellyfish_yellow_chest": 6,
  "zombie:jellyfish_yellow_helmet": 2,
  "zombie:jellyfish_yellow_leggings": 5,
  "zombie:orca_boots": 2,
  "zombie:orca_chest": 6,
  "zombie:orca_helmet": 2,
  "zombie:orca_leggings": 5,
  "zombie:orca_netherite_boots": 3,
  "zombie:orca_netherite_chest": 8,
  "zombie:orca_netherite_helmet": 3,
  "zombie:orca_netherite_leggings": 6,
  "zombie:sunking_captain_boots": 5,
  "zombie:sunking_captain_chestplate": 10,
  "zombie:sunking_captain_helmet": 5,
  "zombie:sunking_captain_leggings": 8
};

const TAME_ITEMS = {
  "zombie:greatwhite_shark": ["Tropical Fish", "Cod", "Salmon"],
  "zombie:hammerhead_shark": ["Tropical Fish", "Cod", "Salmon"],
  "zombie:orca": ["Tropical Fish", "Cod", "Salmon"],
  "zombie:king_penguin": ["Cod", "Salmon", "Tropical Fish"],
  "minecraft:wolf": ["Bone"],
  "minecraft:cat": ["Raw Cod", "Raw Salmon"],
  "minecraft:ocelot": ["Raw Cod", "Raw Salmon"],
  "minecraft:parrot": ["Wheat Seeds", "Melon Seeds", "Pumpkin Seeds", "Beetroot Seeds"],
  "minecraft:horse": ["Mount until tamed", "Apple", "Golden Apple", "Golden Carrot"],
  "minecraft:donkey": ["Mount until tamed", "Apple", "Golden Apple", "Golden Carrot"],
  "minecraft:mule": ["Mount until tamed", "Apple", "Golden Apple", "Golden Carrot"],
  "minecraft:llama": ["Mount until tamed", "Wheat", "Hay Bale"],
  "minecraft:trader_llama": ["Mount until tamed", "Wheat", "Hay Bale"]
};

const lastActionBarText = new Map();
let playerCursor = 0;

system.runInterval(() => {
  const players = world.getAllPlayers();

  if (players.length === 0) return;

  let processed = 0;
  let attempts = 0;

  while (processed < PLAYERS_PER_CYCLE && attempts < players.length) {
    if (playerCursor >= players.length) playerCursor = 0;

    const player = players[playerCursor];
    playerCursor++;
    attempts++;

    if (!isWearingChaosHelmet(player)) {
      clearInspector(player);
      continue;
    }

    processed++;
    updateChaosInspector(player);
  }
}, SCAN_INTERVAL_TICKS);

function isWearingChaosHelmet(player) {
  try {
    const equippable = player.getComponent("minecraft:equippable");
    const headItem = equippable?.getEquipment(EquipmentSlot.Head);
    return headItem?.typeId === CHAOS_HELMET;
  } catch {
    return false;
  }
}

function updateChaosInspector(player) {
  try {
    const entityText = getViewedEntityText(player);
    if (entityText) return setInspectorText(player, entityText);

    const blockText = getViewedBlockText(player);
    if (blockText) return setInspectorText(player, blockText);

    clearInspector(player);
  } catch {
    clearInspector(player);
  }
}

function getViewedEntityText(player) {
  let hits;

  try {
    hits = player.getEntitiesFromViewDirection({ maxDistance: ENTITY_DISTANCE });
  } catch {
    return undefined;
  }

  for (const hit of hits ?? []) {
    const target = hit.entity;
    if (!target || target.id === player.id) continue;

    const distance = Math.max(0, Math.round(hit.distance ?? 0));

    if (target.typeId === "minecraft:player") {
      return getViewedPlayerText(target, distance);
    }

    const health = safeGetHealth(target);
    if (!health) continue;

    const currentHp = Math.ceil(health.currentValue);
    const maxHp = Math.ceil(health.defaultValue ?? currentHp);
    const prettyName = getPrettyName(target.typeId);
    const nameTag = safeNameTag(target);
    const tameText = getTameText(target.typeId);

    if (nameTag && !nameTag.startsWith("\u00a7")) {
      return `\u00a7d${nameTag}\n\u00a77${prettyName}\n\u00a7cHP: \u00a7f${currentHp}\u00a77/\u00a7f${maxHp} \u00a78(${distance}m)${tameText}`;
    }

    return `\u00a7d${prettyName}\n\u00a7cHP: \u00a7f${currentHp}\u00a77/\u00a7f${maxHp} \u00a78(${distance}m)${tameText}`;
  }

  return undefined;
}

function getTameText(typeId) {
  const tameItems = TAME_ITEMS[typeId];
  return tameItems ? `\n\u00a7aTame: \u00a7f${tameItems.join(", ")}` : "";
}

function getViewedBlockText(player) {
  let hit;

  try {
    hit = player.getBlockFromViewDirection({
      maxDistance: BLOCK_DISTANCE,
      includeLiquidBlocks: false,
      includePassableBlocks: true
    });
  } catch {
    return undefined;
  }

  const block = hit?.block;
  if (!block || block.typeId === "minecraft:air") return undefined;

  const rule = getToolRule(block);
  let text = `\u00a7e${getPrettyName(block.typeId)}`;
  if (rule) text += `\n\u00a76Tool: ${rule}`;

  const customInfo = getCustomBlockInfo(block);
  if (customInfo) text += `\n${customInfo}`;

  return text;
}

function getToolRule(block) {
  if (TOOL_RULES[block.typeId]) return TOOL_RULES[block.typeId];
  if (isLogBlock(block.typeId)) return "\u00a76Any Axe";

  try {
    if (block.permutation.hasTag("zombie:requires_netherite_pickaxe")) {
      return "\u00a78Netherite Pickaxe required";
    }
    if (block.permutation.hasTag("zombie:requires_diamond_pickaxe")) {
      return "\u00a7bDiamond Pickaxe or better";
    }
    if (block.permutation.hasTag("zombie:requires_iron_pickaxe")) {
      return "\u00a7fIron Pickaxe or better";
    }
    if (block.permutation.hasTag("zombie:requires_stone_pickaxe")) {
      return "\u00a77Stone Pickaxe or better";
    }
    if (block.permutation.hasTag("zombie:requires_axe")) {
      return "\u00a76Any Axe";
    }
    if (block.permutation.hasTag("zombie:requires_shovel")) {
      return "\u00a76Shovel recommended";
    }
  } catch {}

  return undefined;
}

function isLogBlock(typeId) {
  return /(:|_)(log|wood|stem|hyphae)$/.test(typeId);
}

function getCustomBlockInfo(block) {
  if (block.typeId === "zombie:chaos_chest") {
    try {
      return block.permutation.getState("zombie:open")
        ? "\u00a7aStatus: \u00a7fOpened"
        : "\u00a7dStatus: \u00a7fClosed";
    } catch {
      return "\u00a7dUse a Chaos Key";
    }
  }

  if (block.typeId === "zombie:demon_alter") {
    return "\u00a7cDemon Altar\n\u00a77Power it with Redstone";
  }

  if (!block.typeId.startsWith("zombie:")) return "";

  try {
    const states = Object.entries(block.permutation.getAllStates());
    return states
      .slice(0, 2)
      .map(([name, value]) => `\u00a78${name.replace("zombie:", "")}: \u00a77${value}`)
      .join("\n");
  } catch {
    return "";
  }
}

function getViewedPlayerText(player, distance) {
  const health = safeGetHealth(player);
  const currentHp = health ? Math.ceil(health.currentValue) : 0;
  const maxHp = health ? Math.ceil(health.defaultValue ?? currentHp) : 0;
  const armorValue = getArmorValue(player);
  const playerName = safePlayerName(player);

  return `\u00a7b${playerName}\n` +
    `\u00a7cHP: \u00a7f${currentHp}\u00a77/\u00a7f${maxHp} \u00a78(${distance}m)\n` +
    `\u00a79Armor: \u00a7f${armorValue}`;
}

function getArmorValue(entity) {
  const armorSlots = [
    EquipmentSlot.Head,
    EquipmentSlot.Chest,
    EquipmentSlot.Legs,
    EquipmentSlot.Feet
  ];

  return armorSlots.reduce((total, slot) => {
    const item = getEquippedItem(entity, slot);
    return total + (item ? ARMOR_VALUES[item.typeId] ?? 0 : 0);
  }, 0);
}

function getEquippedItem(entity, slot) {
  try {
    return getEquippable(entity)?.getEquipment(slot);
  } catch {
    return undefined;
  }
}

function getEquippable(entity) {
  try {
    const equippable = entity.getComponent(EntityComponentTypes.Equippable);
    if (equippable) return equippable;
  } catch {}

  try {
    return entity.getComponent("minecraft:equippable");
  } catch {
    return undefined;
  }
}

function safePlayerName(player) {
  try {
    return player.name || player.nameTag || "Player";
  } catch {
    return "Player";
  }
}

function safeGetHealth(entity) {
  try {
    return entity.getComponent(EntityComponentTypes.Health);
  } catch {
    return undefined;
  }
}

function safeNameTag(entity) {
  try {
    return entity.nameTag;
  } catch {
    return "";
  }
}

function setInspectorText(player, text) {
  if (lastActionBarText.get(player.id) === text) return;

  try {
    player.onScreenDisplay.setActionBar(text);
    lastActionBarText.set(player.id, text);
  } catch {}
}

function clearInspector(player) {
  if (!lastActionBarText.has(player.id)) return;

  try {
    player.onScreenDisplay.setActionBar("");
  } catch {}

  lastActionBarText.delete(player.id);
}

function getPrettyName(typeId) {
  const rawName = typeId.includes(":") ? typeId.split(":")[1] : typeId;

  return rawName
    .split("_")
    .map((word) => word ? word[0].toUpperCase() + word.slice(1) : "")
    .join(" ");
}