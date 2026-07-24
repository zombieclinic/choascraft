import { system } from "@minecraft/server";
import { ChristmasGuideBook, ZombieSantaLoreBook } from "./guideBook.js";
import {
  CandyGrow, Openbox, Open2, ChristmasLights, ColorLights,
  SantaSword, Candycane, Christmas_Cookie, SantaSwordDamage
} from "./customComponents.js";

const BLOCK_COMPONENTS = [
  ["zombie:christmas_crops",            CandyGrow],
  ["zombie:open",                       Openbox],
  ["zombie:open2",                      Open2],
  ["zombie:christmas_light",            ChristmasLights],
  ["zombie:christmas_light_colors",     ColorLights]
  
];

const ITEM_COMPONENTS = [
["zombie:santasword",          SantaSword],
["zombie:cookie",              Christmas_Cookie],
["zombie:candycane",           Candycane],
["zombie:guide_book",          ChristmasGuideBook],
["zombie:zombie_santa_lore_book", ZombieSantaLoreBook],
["zombie:santasworddamage",    SantaSwordDamage]
];

system.beforeEvents.startup.subscribe(({ blockComponentRegistry, itemComponentRegistry }) => {
  BLOCK_COMPONENTS.forEach(([id, Comp]) =>
    blockComponentRegistry.registerCustomComponent(id, new Comp())
  );
  ITEM_COMPONENTS.forEach(([id, Comp]) =>
    itemComponentRegistry.registerCustomComponent(id, new Comp())
  );
});
