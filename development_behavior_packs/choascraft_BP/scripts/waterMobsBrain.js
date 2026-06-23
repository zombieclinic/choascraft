import {world, system, BlockPermutation } from "@minecraft/server";
import {DurabilityHandler} from "./items/durability/durability.js"
import {EggHatchTickingComponent} from "./blocks/eggs.js"
import {CustomLeafDecayComponent} from "./blocks/leavesDecay.js"
import {EyewoodLeavesRenderComponent} from "./blocks/eyewoodLeavesRender.js"
import {EyewoodSaplingGrowthComponent} from "./blocks/eyewoodSaplingGrowth.js"
import {AbyssFlowerCropComponent} from "./blocks/abyssFlowerCrop.js"
import {InfectedFlowerGrowthComponent, InfectedFlowerTickComponent} from "./blocks/infectedFlowerGrowth.js"
import {EyeFlowerGrowthComponent, EyeFlowerTickComponent} from "./blocks/eyeFlowerGrowth.js"
import {AbyssFlowerSeedFoodComponent} from "./items/abyssFlowerSeedFood.js"
import {SporepodGrowthComponent} from "./blocks/sporepodGrowth.js"
import {CorruptedSpireBreakComponent, CorruptedSpireGrowthComponent} from "./blocks/corruptedSpireGrowth.js"
import {SporeFoodComponent} from "./items/sporeFood.js"
import { EmberberryStewFoodComponent } from "./items/emberberryStewFood.js"
import { HemovialFoodComponent } from "./items/hemovialFood.js"
import { ChaosFishingRodComponent } from "./items/chaosFishingRod.js"
import {RawFoodSicknessComponent} from "./items/rawFoodSickness.js"
import {EyewoodDoorComponent, EyewoodFenceGateToggleComponent, EyewoodSlabPrePlaceComponent, EyewoodTrapdoorToggleComponent} from "./blocks/eyewoodWoodInteractions.js"
import { ZcButtonComponent, ZcButtonReleaseTickComponent } from "./blocks/buttonInteractions.js";
import { ZcPressurePlateComponent, ZcPressurePlateReleaseTickComponent } from "./blocks/pressurePlate.js";
import { ConnectedStairsComponent } from "./blocks/connectedStairs.js"
import { HellfireTrapstoneComponent } from "./blocks/hellfireTrapstone.js";
import { DemonSteelOreDropComponent } from "./blocks/demonSteelOreDrops.js";
import { DemonAlterComponent } from "./blocks/demonAlter.js";
import { CorruptedGrassDropComponent } from "./blocks/corruptedGrassDrops.js";
import { BloodVineGrowthComponent } from "./blocks/bloodVineGrowth.js";
import { BloodRootGrowthComponent, BloodRootTickComponent } from "./blocks/bloodRootGrowth.js";
import { MushroomSpreadComponent } from "./blocks/mushroomSpread.js";
import { ChaosChestComponent } from "./blocks/chaosChest.js";
import {infectedAttack} from "./items/infected.js"
import "./entities/omniusBrain.js"
import "./entities/zombieDeathAnimations.js"
import "./items/bearShield.js"
import { BfcBowHoldComponent } from "./items/chaosBow.js"
import {bearArmorChanceEffect} from "./items/bearattack.js"



// â€”â€”â€” define your componentâ€lists â€”â€”â€”
const BLOCK_COMPONENTS = [
  ["zombie:pengiun_egg_hatch", EggHatchTickingComponent],
  ["zombie:decayable_leaves", CustomLeafDecayComponent],
  ["zombie:eyewood_leaves_render", EyewoodLeavesRenderComponent],
  ["zombie:eyewood_tree_sapling_growth", EyewoodSaplingGrowthComponent],
  ["zombie:abyss_flower_crop", AbyssFlowerCropComponent],
  ["zombie:infected_flower_growth", InfectedFlowerGrowthComponent],
  ["zombie:infected_flower_tick", InfectedFlowerTickComponent],
  ["zombie:eye_flower_growth", EyeFlowerGrowthComponent],
  ["zombie:eye_flower_tick", EyeFlowerTickComponent],
  ["zombie:sporepod_growth", SporepodGrowthComponent],
  ["zombie:corrupted_spire_growth", CorruptedSpireGrowthComponent],
  ["zombie:corrupted_spire_break", CorruptedSpireBreakComponent],
  ["zombie:slab_pre_place", EyewoodSlabPrePlaceComponent],
  ["zombie:door_toggle", EyewoodDoorComponent],
  ["zombie:trapdoor_toggle", EyewoodTrapdoorToggleComponent],
  ["zombie:fence_gate_toggle", EyewoodFenceGateToggleComponent],
  ["zombie:button_press", ZcButtonComponent],
  ["zombie:button_release_tick", ZcButtonReleaseTickComponent],
  ["zc:pressureplate", ZcPressurePlateComponent],
  ["zc:pressureplate_release_tick", ZcPressurePlateReleaseTickComponent],
  ["zombie:hellfire_trapstone", HellfireTrapstoneComponent],
  ["zombie:demon_steel_ore_drop", DemonSteelOreDropComponent],
  ["zombie:demon_alter", DemonAlterComponent],
  ["zombie:corrupted_grass_drop", CorruptedGrassDropComponent],
  ["zombie:blood_vine_growth", BloodVineGrowthComponent],
  ["zombie:blood_root_growth", BloodRootGrowthComponent],
  ["zombie:blood_root_tick", BloodRootTickComponent],
  ["zombie:mushroom_spread", MushroomSpreadComponent],
  ["zombie:chaos_chest", ChaosChestComponent],
  ["arctic:connectedStairs", ConnectedStairsComponent]
];

const ITEM_COMPONENTS = [
 ["zombie:bear_attack", bearArmorChanceEffect],
 ["zombie:infected_attack", infectedAttack ],
 ["zombie:item_durability", DurabilityHandler],
 ["zombie:abyss_flower_seed_food", AbyssFlowerSeedFoodComponent],
 ["zombie:spore_food", SporeFoodComponent],
 ["zombie:emberberry_stew_food", EmberberryStewFoodComponent],
 ["zombie:hemovial_food", HemovialFoodComponent],
 ["zombie:raw_food_sickness", RawFoodSicknessComponent],
 ["zombie:chaos_fishing_rod", ChaosFishingRodComponent],
 ["zombie:bfc_bow_hold", BfcBowHoldComponent]
];

system.beforeEvents.startup.subscribe(({ blockComponentRegistry, itemComponentRegistry }) => {
  BLOCK_COMPONENTS.forEach(([id, Comp]) =>
    blockComponentRegistry.registerCustomComponent(id, new Comp())
  );
  ITEM_COMPONENTS.forEach(([id, Comp]) =>
    itemComponentRegistry.registerCustomComponent(id, new Comp())
  );
});





const EVENT_ID = "zc:mega_hub_player";

const LOAD_DELAY_TICKS = 80;
const BLOCKS_PER_TICK = 1500;
const COMMANDS_PER_TICK = 2;

const FILL_CHUNK_X = 16;
const FILL_CHUNK_Y = 16;
const FILL_CHUNK_Z = 16;

let builder = null;

system.afterEvents.scriptEventReceive.subscribe((ev) => {
  if (ev.id !== EVENT_ID) return;

  const player = ev.sourceEntity;
  if (!player || player.typeId !== "minecraft:player") return;

  const msg = (ev.message ?? "").trim().toLowerCase();

  if (msg === "" || msg === "start") startBuild(player);
  else if (msg === "pause") pauseBuild(player, true);
  else if (msg === "resume") pauseBuild(player, false);
  else if (msg === "stop") stopBuild("Â§cZombiecraft mega hub builder stopped.");
  else if (msg === "status") status(player);
});

function startBuild(player) {
  if (builder) {
    player.sendMessage("Â§cBuilder already running.");
    return;
  }

  const o = {
    x: Math.floor(player.location.x),
    y: Math.floor(player.location.y),
    z: Math.floor(player.location.z)
  };

  builder = {
    player,
    dim: player.dimension,
    origin: o,
    sections: makeSections(o),
    sectionIndex: 0,
    commands: [],
    blocks: [],
    blockIndex: 0,
    state: "teleport",
    delay: 0,
    paused: false,
    queued: false,
    runId: undefined
  };

  player.sendMessage("Â§aZombiecraft MEGA Hub Player-Loader started.");
  player.sendMessage("Â§7You will be teleported to each section to load chunks.");
  builder.runId = system.runInterval(tick, 1);
}

function pauseBuild(player, paused) {
  if (!builder) return player.sendMessage("Â§7No build running.");
  builder.paused = paused;
  player.sendMessage(paused ? "Â§eBuilder paused." : "Â§aBuilder resumed.");
}

function status(player) {
  if (!builder) return player.sendMessage("Â§7No build running.");
  player.sendMessage(`Â§eSection ${builder.sectionIndex + 1}/${builder.sections.length}`);
  player.sendMessage(`Â§7State: ${builder.state}`);
  player.sendMessage(`Â§7Commands: ${builder.commands.length} | Blocks left: ${Math.max(0, builder.blocks.length - builder.blockIndex)}`);
}

function stopBuild(message) {
  if (!builder) return;

  const b = builder;
  system.clearRun(b.runId);
  b.player?.sendMessage(message);
  builder = null;
}

function tick() {
  if (!builder || builder.paused) return;
  const b = builder;

  if (b.sectionIndex >= b.sections.length && b.commands.length === 0 && b.blockIndex >= b.blocks.length) {
    const p = b.player;
    const o = b.origin;
    try {
      p.teleport({ x: o.x, y: o.y + 8, z: o.z - 18 }, { dimension: b.dim });
    } catch {}
    stopBuild("Â§aZombiecraft MEGA hub complete.");
    return;
  }

  const section = b.sections[b.sectionIndex];

  if (b.state === "teleport") {
    b.player.sendMessage(`Â§eMoving to ${b.sectionIndex + 1}/${b.sections.length}: ${section.name}`);

    try {
      b.player.teleport(
        { x: section.cx + 0.5, y: section.cy + 4, z: section.cz + 0.5 },
        { dimension: b.dim }
      );
    } catch {}

    b.state = "loading";
    b.delay = LOAD_DELAY_TICKS;
    return;
  }

  if (b.state === "loading") {
    b.delay--;
    if (b.delay <= 0) {
      b.state = "build";
      b.queued = false;
      b.commands = [];
      b.blocks = [];
      b.blockIndex = 0;
    }
    return;
  }

  if (b.state === "build") {
    if (!b.queued) {
      b.player.sendMessage(`Â§bBuilding: ${section.name}`);
      section.build();
      b.queued = true;
    }

    let cmdCount = 0;
    while (b.commands.length > 0 && cmdCount < COMMANDS_PER_TICK) {
      const cmd = b.commands.shift();
      runCmd(b.dim, cmd);
      cmdCount++;
    }

    let blockCount = 0;
    while (b.commands.length === 0 && b.blockIndex < b.blocks.length && blockCount < BLOCKS_PER_TICK) {
      const p = b.blocks[b.blockIndex++];
      try {
        b.dim.getBlock({ x: p.x, y: p.y, z: p.z })?.setPermutation(BlockPermutation.resolve(p.id));
      } catch {}
      blockCount++;
    }

    if (b.commands.length === 0 && b.blockIndex >= b.blocks.length) {
      b.player.sendMessage(`Â§aFinished: ${section.name}`);
      b.sectionIndex++;
      b.state = "teleport";
      b.queued = false;
      b.blocks = [];
      b.blockIndex = 0;
    }
  }
}

function runCmd(dim, command) {
  try {
    dim.runCommandAsync(command).catch(() => {});
  } catch {
    try { dim.runCommand(command); } catch {}
  }
}

function qFillCmd(x1, y1, z1, x2, y2, z2, id) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);

  for (let x = minX; x <= maxX; x += FILL_CHUNK_X) {
    for (let y = minY; y <= maxY; y += FILL_CHUNK_Y) {
      for (let z = minZ; z <= maxZ; z += FILL_CHUNK_Z) {
        const ex = Math.min(x + FILL_CHUNK_X - 1, maxX);
        const ey = Math.min(y + FILL_CHUNK_Y - 1, maxY);
        const ez = Math.min(z + FILL_CHUNK_Z - 1, maxZ);
        builder.commands.push(`fill ${x} ${y} ${z} ${ex} ${ey} ${ez} ${id}`);
      }
    }
  }
}

function qSet(x, y, z, id) {
  builder.blocks.push({ x, y, z, id });
}

function qFill(x1, y1, z1, x2, y2, z2, id) {
  const count = (Math.abs(x2 - x1) + 1) * (Math.abs(y2 - y1) + 1) * (Math.abs(z2 - z1) + 1);
  if (count > 250) return qFillCmd(x1, y1, z1, x2, y2, z2, id);

  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);

  for (let x = minX; x <= maxX; x++)
    for (let y = minY; y <= maxY; y++)
      for (let z = minZ; z <= maxZ; z++)
        qSet(x, y, z, id);
}

function qBox(x1, y1, z1, x2, y2, z2, wall, air = "minecraft:air") {
  qFill(x1, y1, z1, x2, y2, z2, wall);
  qFill(x1 + 1, y1 + 1, z1 + 1, x2 - 1, y2 - 1, z2 - 1, air);
}

function qZombieFace(x, y, z, size) {
  const h = Math.floor(size / 2);
  qFill(x - h, y, z, x + h, y + size, z, "minecraft:green_wool");
  qFill(x - h + 2, y + 2, z - 1, x + h - 2, y + size - 2, z - 1, "minecraft:lime_wool");

  const eyeY = y + Math.floor(size * 0.65);
  const noseY = y + Math.floor(size * 0.45);
  const mouthY = y + Math.floor(size * 0.25);
  const eyeH = Math.max(1, Math.floor(size / 8));

  qFill(x - Math.floor(size * 0.34), eyeY, z - 2, x - Math.floor(size * 0.18), eyeY + eyeH, z - 2, "minecraft:black_wool");
  qFill(x + Math.floor(size * 0.18), eyeY, z - 2, x + Math.floor(size * 0.34), eyeY + eyeH, z - 2, "minecraft:black_wool");
  qFill(x - 1, noseY, z - 2, x + 1, noseY + eyeH, z - 2, "minecraft:black_wool");
  qFill(x - Math.floor(size * 0.36), mouthY, z - 2, x - Math.floor(size * 0.22), mouthY + eyeH, z - 2, "minecraft:black_wool");
  qFill(x - Math.floor(size * 0.08), mouthY, z - 2, x + Math.floor(size * 0.08), mouthY + eyeH, z - 2, "minecraft:black_wool");
  qFill(x + Math.floor(size * 0.22), mouthY, z - 2, x + Math.floor(size * 0.36), mouthY + eyeH, z - 2, "minecraft:black_wool");

  qFill(x - h - 1, y - 1, z + 1, x + h + 1, y - 1, z + 1, "minecraft:deepslate_bricks");
  qFill(x - h - 1, y + size + 1, z + 1, x + h + 1, y + size + 1, z + 1, "minecraft:deepslate_bricks");
  qFill(x - h - 1, y - 1, z + 1, x - h - 1, y + size + 1, z + 1, "minecraft:deepslate_bricks");
  qFill(x + h + 1, y - 1, z + 1, x + h + 1, y + size + 1, z + 1, "minecraft:deepslate_bricks");
}

function section(name, o, dx, dy, dz, build) {
  return { name, cx: o.x + dx, cy: o.y + dy, cz: o.z + dz, build };
}

function makeSections(o) {
  return [
    section("Clear front courtyard", o, 0, 70, -20, () => {
      qFillCmd(o.x - 82, o.y, o.z - 70, o.x + 82, o.y + 80, o.z + 20, "minecraft:air");
    }),

    section("Clear rear complex", o, 0, 80, 75, () => {
      qFillCmd(o.x - 82, o.y, o.z + 15, o.x + 82, o.y + 95, o.z + 135, "minecraft:air");
    }),

    section("Mega foundation and roads", o, 0, 18, 25, () => {
      qFill(o.x - 78, o.y - 2, o.z - 60, o.x + 78, o.y - 2, o.z + 125, "minecraft:stone");
      qFill(o.x - 76, o.y - 1, o.z - 58, o.x + 76, o.y - 1, o.z + 123, "minecraft:deepslate");
      qFill(o.x - 74, o.y, o.z - 56, o.x + 74, o.y, o.z + 121, "minecraft:stone_bricks");
      qFill(o.x - 60, o.y + 1, o.z - 45, o.x + 60, o.y + 1, o.z + 35, "minecraft:mossy_stone_bricks");
      qFill(o.x - 54, o.y + 2, o.z - 39, o.x + 54, o.y + 2, o.z + 29, "minecraft:stone_bricks");
      qFill(o.x - 5, o.y + 3, o.z - 62, o.x + 5, o.y + 3, o.z + 116, "minecraft:cobblestone");
      qFill(o.x - 2, o.y + 4, o.z - 62, o.x + 2, o.y + 4, o.z + 116, "minecraft:polished_andesite");
      qFill(o.x - 72, o.y + 3, o.z - 6, o.x + 72, o.y + 3, o.z + 6, "minecraft:cobblestone");
      qFill(o.x - 72, o.y + 4, o.z - 2, o.x + 72, o.y + 4, o.z + 2, "minecraft:polished_andesite");
    }),

    section("Outer walls and battlements", o, 0, 25, -48, () => {
      const y = o.y + 2;
      qBox(o.x - 72, y, o.z - 52, o.x + 72, y + 18, o.z - 46, "minecraft:stone_bricks");
      qBox(o.x - 78, y, o.z - 52, o.x - 72, y + 16, o.z + 112, "minecraft:stone_bricks");
      qBox(o.x + 72, y, o.z - 52, o.x + 78, y + 16, o.z + 112, "minecraft:stone_bricks");
      qBox(o.x - 72, y, o.z + 106, o.x + 72, y + 18, o.z + 112, "minecraft:stone_bricks");
      qFill(o.x - 7, y, o.z - 52, o.x + 7, y + 12, o.z - 46, "minecraft:air");

      for (let x = -72; x <= 72; x += 4) {
        qFill(o.x + x, y + 19, o.z - 52, o.x + x + 1, y + 22, o.z - 46, "minecraft:deepslate_bricks");
        qFill(o.x + x, y + 19, o.z + 106, o.x + x + 1, y + 22, o.z + 112, "minecraft:deepslate_bricks");
      }
    }),

    section("Front gatehouse", o, 0, 40, -50, () => {
      const x = o.x, y = o.y + 3, z = o.z - 50;
      qBox(x - 22, y, z - 6, x + 22, y + 28, z + 12, "minecraft:stone_bricks");
      qFill(x - 6, y, z - 6, x + 6, y + 16, z + 12, "minecraft:air");
      qFill(x - 9, y, z - 7, x - 7, y + 19, z - 7, "minecraft:deepslate_bricks");
      qFill(x + 7, y, z - 7, x + 9, y + 19, z - 7, "minecraft:deepslate_bricks");
      qFill(x - 9, y + 19, z - 7, x + 9, y + 22, z - 7, "minecraft:deepslate_bricks");
      for (let i = 0; i < 12; i++) qFill(x - 25 + i, y + 29 + i, z - 9 + i, x + 25 - i, y + 29 + i, z + 15 - i, "minecraft:deepslate_tiles");
      for (const dx of [-5, 0, 5]) {
        qFill(x + dx, y + 19, z + 2, x + dx, y + 15, z + 2, "minecraft:chain");
        qSet(x + dx, y + 14, z + 2, "minecraft:lantern");
      }
    }),

    section("Left front mega tower", o, -58, 60, -36, () => tower(o.x - 58, o.y + 2, o.z - 36, 48)),
    section("Right front mega tower", o, 58, 60, -36, () => tower(o.x + 58, o.y + 2, o.z - 36, 48)),
    section("Left rear mega tower", o, -58, 65, 90, () => tower(o.x - 58, o.y + 2, o.z + 90, 52)),
    section("Right rear mega tower", o, 58, 65, 90, () => tower(o.x + 58, o.y + 2, o.z + 90, 52)),

    section("Spawn plaza and fountain", o, 0, 20, 0, () => {
      const x = o.x, y = o.y + 4, z = o.z;
      qFill(x - 22, y, z - 22, x + 22, y, z + 22, "minecraft:smooth_stone");
      qFill(x - 16, y + 1, z - 16, x + 16, y + 1, z + 16, "minecraft:stone_bricks");
      qFill(x - 9, y + 2, z - 9, x + 9, y + 2, z + 9, "minecraft:mossy_stone_bricks");
      qFill(x - 6, y + 3, z - 6, x + 6, y + 3, z + 6, "minecraft:deepslate_bricks");
      qFill(x - 4, y + 4, z - 4, x + 4, y + 4, z + 4, "minecraft:water");
      qFill(x - 1, y + 5, z - 1, x + 1, y + 12, z + 1, "minecraft:mossy_stone_bricks");
      qSet(x, y + 13, z, "minecraft:sea_lantern");
      statue(x - 28, y, z - 17);
      statue(x + 28, y, z - 17);
      statue(x - 28, y, z + 17);
      statue(x + 28, y, z + 17);
    }),

    section("Main cathedral shell", o, 0, 50, 58, () => {
      const x = o.x, y = o.y + 5, z = o.z + 58;
      qBox(x - 34, y, z - 24, x + 34, y + 40, z + 30, "minecraft:stone_bricks");
      qFill(x - 9, y, z - 24, x + 9, y + 22, z - 24, "minecraft:air");
      qFill(x - 30, y, z - 20, x + 30, y, z + 26, "minecraft:dark_oak_planks");
      qFill(x - 4, y + 1, z - 20, x + 4, y + 1, z + 26, "minecraft:polished_andesite");
      qFill(x - 30, y + 1, z - 3, x + 30, y + 1, z + 3, "minecraft:polished_andesite");
      for (const side of [-24, 30]) for (const wx of [-24, -12, 12, 24]) qFill(x + wx - 2, y + 12, z + side, x + wx + 2, y + 27, z + side, "minecraft:green_stained_glass");
      for (const cx of [-26, -16, 16, 26]) for (const cz of [-16, 0, 16, 24]) qFill(x + cx, y + 1, z + cz, x + cx, y + 34, z + cz, "minecraft:mossy_stone_bricks");
    }),

    section("Main cathedral roof and spire", o, 0, 105, 58, () => {
      const x = o.x, y = o.y + 5, z = o.z + 58;
      for (let i = 0; i < 24; i++) qFill(x - 38 + i, y + 41 + i, z - 28 + i, x + 38 - i, y + 41 + i, z + 34 - i, "minecraft:deepslate_tiles");
      qFill(x - 5, y + 65, z - 2, x + 5, y + 80, z + 8, "minecraft:deepslate_bricks");
      for (let i = 0; i < 10; i++) qFill(x - 8 + i, y + 81 + i, z - 5 + i, x + 8 - i, y + 81 + i, z + 11 - i, "minecraft:deepslate_tiles");
      qFill(x - 1, y + 92, z + 3, x + 1, y + 102, z + 3, "minecraft:deepslate_bricks");
      qSet(x, y + 103, z + 3, "minecraft:lightning_rod");
    }),

    section("Giant zombie face", o, 0, 65, 34, () => qZombieFace(o.x, o.y + 36, o.z + 34, 27)),
    section("Left market hall", o, -52, 35, 48, () => marketHall(o.x - 52, o.y + 4, o.z + 48)),
    section("Right market hall", o, 52, 35, 48, () => marketHall(o.x + 52, o.y + 4, o.z + 48)),
    section("Quest hall", o, -50, 32, 88, () => sideHall(o.x - 50, o.y + 4, o.z + 88, "quest")),
    section("Leaderboard hall", o, 50, 32, 88, () => sideHall(o.x + 50, o.y + 4, o.z + 88, "leader")),

    section("Portal nexus", o, 0, 45, 118, () => {
      const x = o.x, y = o.y + 5, z = o.z + 118;
      qBox(x - 28, y, z - 20, x + 28, y + 28, z + 20, "minecraft:stone_bricks");
      qFill(x - 8, y, z - 20, x + 8, y + 13, z - 20, "minecraft:air");
      qFill(x - 8, y + 1, z + 14, x + 8, y + 22, z + 14, "minecraft:obsidian");
      qFill(x - 6, y + 3, z + 14, x + 6, y + 20, z + 14, "minecraft:nether_portal");
      for (const px of [-18, 18]) {
        qFill(x + px - 3, y + 1, z - 5, x + px + 3, y + 11, z - 5, "minecraft:obsidian");
        qFill(x + px - 2, y + 2, z - 5, x + px + 2, y + 10, z - 5, "minecraft:crying_obsidian");
      }
      for (let i = 0; i < 14; i++) qFill(x - 32 + i, y + 29 + i, z - 24 + i, x + 32 - i, y + 29 + i, z + 24 - i, "minecraft:deepslate_tiles");
    }),

    section("Enchanting wing", o, -28, 28, 103, () => utilityWing(o.x - 28, o.y + 4, o.z + 103, "enchant")),
    section("Storage wing", o, 28, 28, 103, () => utilityWing(o.x + 28, o.y + 4, o.z + 103, "storage")),

    section("Crypt entrance", o, 0, 15, 24, () => {
      const x = o.x, y = o.y + 3, z = o.z + 24;
      qFill(x - 9, y, z - 5, x + 9, y, z + 5, "minecraft:blackstone");
      qFill(x - 5, y - 1, z - 2, x + 5, y - 1, z + 2, "minecraft:deepslate_bricks");
      qFill(x - 3, y - 2, z - 1, x + 3, y - 8, z + 1, "minecraft:air");
      qSet(x - 7, y + 1, z, "minecraft:soul_lantern");
      qSet(x + 7, y + 1, z, "minecraft:soul_lantern");
    }),

    section("Lamps, trees, benches, vines", o, 0, 25, 25, () => details(o)),

    section("Final texture pass", o, 0, 20, 25, () => {
      const x = o.x, y = o.y + 2, z = o.z;
      for (let i = -70; i <= 70; i += 7) {
        qSet(x + i, y + 4, z - 47, "minecraft:cracked_stone_bricks");
        qSet(x + i, y + 9, z - 47, "minecraft:mossy_stone_bricks");
        qSet(x + i, y + 4, z + 107, "minecraft:cracked_stone_bricks");
        qSet(x + i, y + 9, z + 107, "minecraft:mossy_stone_bricks");
      }
      qFill(x - 2, y + 3, z - 42, x + 2, y + 3, z + 105, "minecraft:green_carpet");
      qFill(x - 54, y + 3, z - 2, x + 54, y + 3, z + 2, "minecraft:green_carpet");
    })
  ];
}

function tower(x, y, z, h) {
  qBox(x - 10, y, z - 10, x + 10, y + h, z + 10, "minecraft:stone_bricks");

  for (const [dx, dz] of [[-10,-10],[10,-10],[-10,10],[10,10]]) {
    qFill(x + dx, y, z + dz, x + dx, y + h + 6, z + dz, "minecraft:mossy_cobblestone");
    qFill(x + dx - 1, y, z + dz, x + dx + 1, y + h, z + dz, "minecraft:deepslate_bricks");
    qFill(x + dx, y, z + dz - 1, x + dx, y + h, z + dz + 1, "minecraft:deepslate_bricks");
  }

  for (let fy = y + 8; fy < y + h; fy += 10) qFill(x - 8, fy, z - 8, x + 8, fy, z + 8, "minecraft:dark_oak_planks");

  for (let wy = y + 8; wy <= y + h - 8; wy += 12) {
    qFill(x - 2, wy, z - 10, x + 2, wy + 4, z - 10, "minecraft:green_stained_glass");
    qFill(x - 2, wy, z + 10, x + 2, wy + 4, z + 10, "minecraft:green_stained_glass");
    qFill(x - 10, wy, z - 2, x - 10, wy + 4, z + 2, "minecraft:green_stained_glass");
    qFill(x + 10, wy, z - 2, x + 10, wy + 4, z + 2, "minecraft:green_stained_glass");
  }

  for (let i = 0; i < 11; i++) qFill(x - 14 + i, y + h + 1 + i, z - 14 + i, x + 14 - i, y + h + 1 + i, z + 14 - i, "minecraft:deepslate_tiles");

  qFill(x - 1, y + h + 13, z - 1, x + 1, y + h + 21, z + 1, "minecraft:deepslate_bricks");
  qSet(x, y + h + 22, z, "minecraft:lightning_rod");
  qZombieFace(x, y + 20, z - 11, 9);
}

function statue(x, y, z) {
  qFill(x - 3, y, z - 3, x + 3, y + 1, z + 3, "minecraft:deepslate_bricks");
  qFill(x - 1, y + 2, z - 1, x + 1, y + 8, z + 1, "minecraft:mossy_cobblestone");
  qZombieFace(x, y + 9, z - 2, 5);
}

function marketHall(x, y, z) {
  qBox(x - 18, y, z - 22, x + 18, y + 20, z + 22, "minecraft:stone_bricks");
  qFill(x - 16, y, z - 20, x + 16, y, z + 20, "minecraft:dark_oak_planks");

  for (let i = 0; i < 12; i++) qFill(x - 21 + i, y + 21 + i, z - 25 + i, x + 21 - i, y + 21 + i, z + 25 - i, "minecraft:deepslate_tiles");

  for (let sz = -16; sz <= 16; sz += 8) {
    qFill(x - 14, y + 1, z + sz - 2, x - 9, y + 3, z + sz + 2, "minecraft:barrel");
    qFill(x + 9, y + 1, z + sz - 2, x + 14, y + 3, z + sz + 2, "minecraft:barrel");
    qSet(x - 11, y + 4, z + sz, "minecraft:lantern");
    qSet(x + 11, y + 4, z + sz, "minecraft:lantern");
  }

  qZombieFace(x, y + 8, z - 23, 9);
}

function sideHall(x, y, z, type) {
  qBox(x - 16, y, z - 14, x + 16, y + 18, z + 14, "minecraft:stone_bricks");
  qFill(x - 14, y, z - 12, x + 14, y, z + 12, "minecraft:smooth_stone");

  for (let i = 0; i < 9; i++) qFill(x - 18 + i, y + 19 + i, z - 16 + i, x + 18 - i, y + 19 + i, z + 16 - i, "minecraft:deepslate_tiles");

  if (type === "quest") {
    qFill(x - 11, y + 1, z - 12, x + 11, y + 7, z - 12, "minecraft:dark_oak_planks");
    for (let sx = -9; sx <= 9; sx += 3) qSet(x + sx, y + 4, z - 13, "minecraft:oak_sign");
    qSet(x, y + 1, z, "minecraft:lectern");
  } else {
    qFill(x - 11, y + 1, z - 12, x + 11, y + 9, z - 12, "minecraft:blackstone");
    for (let sx = -8; sx <= 8; sx += 4) qSet(x + sx, y + 5, z - 13, "minecraft:glowstone");
  }
}

function utilityWing(x, y, z, type) {
  qBox(x - 14, y, z - 12, x + 14, y + 16, z + 12, "minecraft:stone_bricks");
  qFill(x - 12, y, z - 10, x + 12, y, z + 10, "minecraft:dark_oak_planks");

  if (type === "enchant") {
    qSet(x, y + 1, z, "minecraft:enchanting_table");
    for (let s = -8; s <= 8; s += 2) {
      qSet(x + s, y + 1, z - 8, "minecraft:bookshelf");
      qSet(x + s, y + 1, z + 8, "minecraft:bookshelf");
      qSet(x - 8, y + 1, z + s, "minecraft:bookshelf");
      qSet(x + 8, y + 1, z + s, "minecraft:bookshelf");
    }
  } else {
    for (let sx = -10; sx <= 10; sx += 4)
      for (let sz = -8; sz <= 8; sz += 4) {
        qSet(x + sx, y + 1, z + sz, "minecraft:chest");
        qSet(x + sx, y + 2, z + sz, "minecraft:chest");
      }
  }
}

function details(o) {
  const x = o.x, y = o.y + 4, z = o.z;

  for (const [lx, lz] of [
    [-40,-38],[-20,-38],[20,-38],[40,-38],
    [-40,28],[-20,28],[20,28],[40,28],
    [-68,-10],[-68,20],[-68,58],[-68,94],
    [68,-10],[68,20],[68,58],[68,94],
    [-12,42],[12,42],[-12,90],[12,90]
  ]) {
    qFill(x + lx, y, z + lz, x + lx, y + 4, z + lz, "minecraft:dark_oak_fence");
    qSet(x + lx, y + 5, z + lz, "minecraft:lantern");
  }

  for (const [tx, tz] of [[-42,-22],[42,-22],[-42,18],[42,18],[-24,34],[24,34],[-66,42],[66,42]]) tree(x + tx, y, z + tz);

  for (const [bx, bz] of [[-24,-28],[24,-28],[-34,8],[34,8],[-14,32],[14,32]]) qFill(x + bx - 3, y, z + bz, x + bx + 3, y, z + bz, "minecraft:dark_oak_stairs");

  for (let vx = -70; vx <= 70; vx += 10) {
    qFill(x + vx, y + 2, z - 45, x + vx, y + 10, z - 45, "minecraft:vine");
    qFill(x + vx, y + 2, z + 105, x + vx, y + 10, z + 105, "minecraft:vine");
  }

  for (const [lx, lz] of [[0,56],[-16,56],[16,56],[0,74],[-16,74],[16,74]]) {
    qFill(x + lx, y + 35, z + lz, x + lx, y + 27, z + lz, "minecraft:chain");
    qSet(x + lx, y + 26, z + lz, "minecraft:lantern");
  }
}

function tree(x, y, z) {
  qFill(x, y, z, x, y + 8, z, "minecraft:dark_oak_log");
  qFill(x - 4, y + 5, z - 4, x + 4, y + 8, z + 4, "minecraft:oak_leaves");
  qFill(x - 3, y + 9, z - 3, x + 3, y + 11, z + 3, "minecraft:oak_leaves");
  qSet(x, y + 12, z, "minecraft:oak_leaves");
}










