import { BlockPermutation, EquipmentSlot, GameMode } from "@minecraft/server";

const DYE_TO_COLOR = {
  "minecraft:black_dye": "black",
  "minecraft:blue_dye": "blue",
  "minecraft:brown_dye": "brown",
  "minecraft:cyan_dye": "cyan",
  "minecraft:gray_dye": "gray",
  "minecraft:green_dye": "green",
  "minecraft:light_blue_dye": "light_blue",
  "minecraft:light_gray_dye": "light_gray",
  "minecraft:lime_dye": "lime",
  "minecraft:magenta_dye": "magenta",
  "minecraft:orange_dye": "orange",
  "minecraft:pink_dye": "pink",
  "minecraft:purple_dye": "purple",
  "minecraft:red_dye": "red",
  "minecraft:white_dye": "white",
  "minecraft:yellow_dye": "yellow"
};

const FAMILY_PREFIXES = [
  "zombie:colored_amethyst_",
  "zombie:colored_crying_obsidian_",
  "zombie:colored_gilded_blackstone_",
  "zombie:colored_glowing_obsidian_",
  "zombie:colored_obsidian_",
  "zombie:colored_sea_lantern_",
  "zombie:colored_redstone_lamp_",
  "zombie:color_block_"
];

const COLOR_BLOCK_DYE_TARGET = {
  black: "true_black",
  blue: "blue",
  brown: "dark_red",
  cyan: "dark_aqua",
  gray: "dark_gray",
  green: "dark_green",
  light_blue: "aqua",
  light_gray: "gray",
  lime: "green",
  magenta: "light_purple",
  orange: "gold",
  pink: "light_purple",
  purple: "dark_purple",
  red: "red",
  white: "white",
  yellow: "yellow"
};

const REDSTONE_OFFSETS = [
  { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }
];

function heldItem(player) {
  return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
}

function consumeOneDye(player, item) {
  if (!player.matches({ gameMode: GameMode.survival })) return;
  const equipment = player.getComponent("minecraft:equippable");
  if (!equipment) return;
  if (item.amount > 1) {
    item.amount--;
    equipment.setEquipment(EquipmentSlot.Mainhand, item);
  } else {
    equipment.setEquipment(EquipmentSlot.Mainhand, undefined);
  }
}

export class DyeableColoredBlockComponent {
  onPlayerInteract({ block, player }) {
    if (!block || !player) return;
    const dye = heldItem(player);
    const color = dye ? DYE_TO_COLOR[dye.typeId] : undefined;
    if (!color) return;

    const family = FAMILY_PREFIXES.find(prefix => block.typeId.startsWith(prefix));
    if (!family) return;
    const targetColor = family === "zombie:color_block_"
      ? COLOR_BLOCK_DYE_TARGET[color]
      : color;
    const targetId = `${family}${targetColor}`;
    if (targetId === block.typeId) return;

    try {
      const currentLit = block.permutation.getState("zombie:lit");
      const states = typeof currentLit === "number" ? { "zombie:lit": currentLit } : undefined;
      block.setPermutation(BlockPermutation.resolve(targetId, states));
      consumeOneDye(player, dye);
      block.dimension.playSound("use.cloth", block.location);
    } catch {}
  }
}

function powerAt(block) {
  try {
    const direct = block.getRedstonePower() ?? 0;
    if (direct > 0) return direct;
  } catch {}
  const { x, y, z } = block.location;
  for (const offset of REDSTONE_OFFSETS) {
    try {
      const neighbor = block.dimension.getBlock({ x: x + offset.x, y: y + offset.y, z: z + offset.z });
      const power = neighbor?.getRedstonePower() ?? 0;
      if (power > 0) return power;
    } catch {}
  }
  return 0;
}

export class DyeableRedstoneLampComponent {
  onTick({ block }) {
    if (!block) return;
    const current = block.permutation.getState("zombie:lit");
    const desired = powerAt(block) > 0 ? 1 : 0;
    if (current === desired) return;
    try {
      block.setPermutation(block.permutation.withState("zombie:lit", desired));
    } catch {}
  }
}
