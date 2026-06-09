import {system} from "@minecraft/server";
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
import {EyewoodDoorComponent, EyewoodFenceGateToggleComponent, EyewoodSlabPrePlaceComponent, EyewoodTrapdoorToggleComponent} from "./blocks/eyewoodWoodInteractions.js"
import { ZcButtonComponent, ZcButtonReleaseTickComponent } from "./blocks/buttonInteractions.js";
import { ZcPressurePlateComponent, ZcPressurePlateReleaseTickComponent } from "./blocks/pressurePlate.js";
import { ConnectedStairsComponent } from "./blocks/connectedStairs.js"
import {infectedAttack} from "./items/infected.js"



// ——— define your component‐lists ———
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
  ["arctic:connectedStairs", ConnectedStairsComponent]
];

const ITEM_COMPONENTS = [
 ["zombie:infected_attack", infectedAttack ],
 ["zombie:item_durability", DurabilityHandler],
 ["zombie:abyss_flower_seed_food", AbyssFlowerSeedFoodComponent],
 ["zombie:spore_food", SporeFoodComponent]
];

system.beforeEvents.startup.subscribe(({ blockComponentRegistry, itemComponentRegistry }) => {
  BLOCK_COMPONENTS.forEach(([id, Comp]) =>
    blockComponentRegistry.registerCustomComponent(id, new Comp())
  );
  ITEM_COMPONENTS.forEach(([id, Comp]) =>
    itemComponentRegistry.registerCustomComponent(id, new Comp())
  );
});
