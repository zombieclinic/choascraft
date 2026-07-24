import { system } from "@minecraft/server";
import { DurabilityHandler } from "./items/durability/durability.js";
import { EggHatchTickingComponent } from "./blocks/eggs.js";
import { CustomLeafDecayComponent } from "./blocks/leavesDecay.js";
import { EyewoodLeavesRenderComponent } from "./blocks/eyewoodLeavesRender.js";
import { EyewoodSaplingGrowthComponent } from "./blocks/eyewoodSaplingGrowth.js";
import { AbyssFlowerCropComponent } from "./blocks/abyssFlowerCrop.js";
import { InfectedFlowerGrowthComponent, InfectedFlowerTickComponent } from "./blocks/infectedFlowerGrowth.js";
import { EyeFlowerGrowthComponent, EyeFlowerTickComponent } from "./blocks/eyeFlowerGrowth.js";
import { AbyssFlowerSeedFoodComponent } from "./items/abyssFlowerSeedFood.js";
import { SporepodGrowthComponent } from "./blocks/sporepodGrowth.js";
import { CorruptedSpireBreakComponent, CorruptedSpireGrowthComponent } from "./blocks/corruptedSpireGrowth.js";
import { SporeFoodComponent } from "./items/sporeFood.js";
import { EmberberryStewFoodComponent } from "./items/emberberryStewFood.js";
import { HemovialFoodComponent } from "./items/hemovialFood.js";
import { ChaosFishingRodComponent } from "./items/chaosFishingRod.js";
import { RawFoodSicknessComponent } from "./items/rawFoodSickness.js";
import {
  EyewoodDoorComponent,
  EyewoodFenceGateToggleComponent,
  EyewoodSlabPrePlaceComponent,
  EyewoodTrapdoorToggleComponent
} from "./blocks/eyewoodWoodInteractions.js";
import { ZcButtonComponent, ZcButtonReleaseTickComponent } from "./blocks/buttonInteractions.js";
import { ZcPressurePlateComponent, ZcPressurePlateReleaseTickComponent } from "./blocks/pressurePlate.js";
import { ConnectedStairsComponent } from "./blocks/connectedStairs.js";
import { HellfireTrapstoneComponent } from "./blocks/hellfireTrapstone.js";
import { DemonAlterComponent } from "./blocks/demonAlter.js";
import { DemonLordRitualComponent } from "./blocks/demonLordRitual.js";
import { CorruptedGrassDropComponent } from "./blocks/corruptedGrassDrops.js";
import { BloodVineGrowthComponent } from "./blocks/bloodVineGrowth.js";
import { BloodRootGrowthComponent, BloodRootTickComponent } from "./blocks/bloodRootGrowth.js";
import { MushroomSpreadComponent } from "./blocks/mushroomSpread.js";
import { ChaosChestComponent } from "./blocks/chaosChest.js";
import { infectedAttack } from "./items/infected.js";
import "./items/bearShield.js";
import { BfcBowHoldComponent } from "./items/chaosBow.js";
import { ChaosAxeComponent } from "./items/chaosAxe.js";
import { ChaosHammerComponent } from "./items/chaosHammer.js";
import { ChaosScytheComponent } from "./items/chaosScythe.js";
import { ChaosSpearComponent } from "./items/chaosSpear.js";
import { HellSwordEvolutionComponent } from "./items/hellSwordEvolution.js";
import { ChaosBookComponent, ChaosStaffComponent } from "./items/chaosStaff.js";
import { bearArmorChanceEffect } from "./items/bearattack.js";
import "./items/chaosHelmetSight.js";
import "./items/chaosArmor.js";
import "./items/echoheartTotem.js";
import "./christmas/index.js";
import { CoffinBackpackPlacementComponent } from "./items/coffinBackpackPickup.js";

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
  ["zombie:demon_alter", DemonAlterComponent],
  ["zombie:demon_lord_ritual", DemonLordRitualComponent],
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
  ["zombie:infected_attack", infectedAttack],
  ["zombie:item_durability", DurabilityHandler],
  ["zombie:abyss_flower_seed_food", AbyssFlowerSeedFoodComponent],
  ["zombie:spore_food", SporeFoodComponent],
  ["zombie:emberberry_stew_food", EmberberryStewFoodComponent],
  ["zombie:hemovial_food", HemovialFoodComponent],
  ["zombie:raw_food_sickness", RawFoodSicknessComponent],
  ["zombie:chaos_fishing_rod", ChaosFishingRodComponent],
  ["zombie:bfc_bow_hold", BfcBowHoldComponent],
  ["zombie:chaos_axe", ChaosAxeComponent],
  ["zombie:chaos_hammer", ChaosHammerComponent],
  ["zombie:chaos_scythe", ChaosScytheComponent],
  ["zombie:chaos_spear", ChaosSpearComponent],
  ["zombie:chaos_staff", ChaosStaffComponent],
  ["zombie:chaos_book", ChaosBookComponent],
  ["zombie:hell_sword_evolution", HellSwordEvolutionComponent],
  ["zombie:coffin_backpack", CoffinBackpackPlacementComponent]
];

system.beforeEvents.startup.subscribe(({ blockComponentRegistry, itemComponentRegistry }) => {
  for (const [id, Component] of BLOCK_COMPONENTS) {
    blockComponentRegistry.registerCustomComponent(id, new Component());
  }

  for (const [id, Component] of ITEM_COMPONENTS) {
    itemComponentRegistry.registerCustomComponent(id, new Component());
  }
});
