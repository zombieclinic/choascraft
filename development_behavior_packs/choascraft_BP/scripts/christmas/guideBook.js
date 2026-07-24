import { ActionFormData } from "@minecraft/server-ui";

const GUIDE_PAGES = [
  {
    title: "§bChristmas Land",
    icon: "textures/christmas/particles/christmas/snow",
    body:
      "§fChristmas Land is a rare frozen Overworld biome that replaces parts of Snowy Plains, Snowy Taiga, " +
      "Ice Spikes, and Groves.\n\n§bMagic Snow§f covers the surface. Christmas trees, presents, and fully-grown " +
      "red, blue, and purple Candy Canes generate naturally.\n\n§7Zombie Santa and Zombie Elves spawn only on " +
      "Magic Snow in this biome when block light is exactly 0."
  },
  {
    title: "§4Mobs & Loot",
    icon: "textures/christmas/particles/christmas/santa",
    body:
      "§4Zombie Santa — Level 3 Boss\n§fThe only Santa difficulty. He has 1,000 health, deals 15 damage, slows " +
      "targets, ignores fall damage, climbs, jumps, and carries the boss bar. He is extremely rare and only one " +
      "may naturally occupy the local surface population. He drops colored presents.\n\n" +
      "§2Zombie Elves\n§fHostile Christmas monsters that spawn in groups of 1–3. They drop Green Presents. " +
      "They no longer open a difficulty menu."
  },
  {
    title: "§cPresents",
    icon: "textures/christmas/particles/christmas/ribbion_cookie",
    body:
      "§fNormal presents: §9Blue, §2Green, §cRed, §5Purple, §dPink, and §6Lucky.\n\n" +
      "Open a present to release its loot; the opened present disappears after its effect. Green, blue, and red " +
      "pools contain Christmas crops, food, lights, building blocks, and decorations. Purple can also contain " +
      "Santa armor. Pink contains high-value Santa equipment and Santa's Revenge. Lucky Presents can contain " +
      "especially unpredictable rewards.\n\n§fDecorated versions exist for all six present colors as display blocks."
  },
  {
    title: "§dCandy Canes",
    icon: "textures/christmas/particles/christmas/gingerbread",
    body:
      "§fColors: §cRed, §9Blue, and §5Purple.\n\n§fNaturally generated crops are fully grown. Seeds can only be " +
      "planted on Magic Snow. Player crops grow through six stages by random ticks and can be advanced with Bone " +
      "Meal. Harvest mature crops for Candy Canes and seeds.\n\nEating a Candy Cane grants Speed for 15 seconds."
  },
  {
    title: "§eRecipes",
    icon: "textures/christmas/items/christmass/candycane_dust",
    body:
      "§6Candy Cane Dust — shapeless crafting table\n§f1 Red Candy Cane + 1 Blue Candy Cane + 1 Purple Candy Cane " +
      "= 3 Candy Cane Dust.\n\n§bMagic Snow — shapeless crafting table\n§f4 Snowballs + 1 Candy Cane Dust = " +
      "1 Magic Snow.\n\n§fCandy Cane Dust also repairs Santa armor and Santa's Revenge in an anvil."
  },
  {
    title: "§4Equipment",
    icon: "textures/christmas/items/christmass/armor_wepions/santa_sword_icon",
    body:
      "§cSanta's Revenge\n§f7 normal attack damage, 400 durability, sword enchantments, fast cutting of webs and " +
      "bamboo. Attacks create a 120-degree sweep up to 3.5 blocks ahead. Secondary targets take 5 damage and " +
      "Slowness. Unbreaking works on durability.\n\n§cSanta Suit\n§fSanta Helmet: 3 armor. Santa Coat: 8 armor. " +
      "Santa Leggings: 6 armor. Santa Boots: 3 armor. Every piece absorbs freezing, fire-tick, lightning, and " +
      "wall-impact damage. Helmet/boots have 600 durability; coat/leggings have 900.\n\n§4Zombie Santa Mask\n" +
      "§fWear it as a mask or place it as the Zombie Santa Head block."
  },
  {
    title: "§6Food & Decorations",
    icon: "textures/christmas/particles/christmas/tree",
    body:
      "§6Cookies\n§fGingerbread, Ortimate, Ribbon, Santa, Stocking, and Tree Cookies restore 6 hunger with high " +
      "saturation. Each grants one random beneficial effect when eaten.\n\n§2Decorations\n§fChristmas Tree, " +
      "Christmas Wreath, Santa Sign, Mistletoe Cheer Stocking, Zombie Santa Head, Santa Carpet, Snowflake Carpet, " +
      "ZombieCraft Carpet, and Zombie Santa Carpet.\n\n§6Gingerbread Blocks\n§fPlain Gingerbread, Icing, Dots, " +
      "Dots Icing, Tree, Tree Icing, Window, and Window Icing are themed building blocks."
  },
  {
    title: "§eChristmas Lights",
    icon: "textures/christmas/particles/christmas/ortimate",
    body:
      "§fLights come in Blue, Cyan, Green, Light Blue, Magenta, Pink, Purple, Red, Yellow, and Multicolor.\n\n" +
      "They can attach to floors, walls, or ceilings. Every light is off at state 0 and activates only while " +
      "receiving redstone power. Single-color lights remain steady. Multicolor lights cycle through eight powered " +
      "colors once per second and return to a true non-emitting state when power is removed."
  }
];

export class ChristmasGuideBook {
  onUse({ source }) {
    showGuideIndex(source);
  }
}

const SANTA_LORE_CHAPTERS = [
  {
    title: "§4The Red Wanderer",
    body:
      "Before Kael’Vorr discovered the Overworld, he explored a frozen dimension trapped in an endless winter.\n\n" +
      "At its center lived Saint Rotnick, an immortal gift-maker who traveled between isolated settlements during " +
      "the longest night. He once brought food, tools, and toys to those who survived the cold.\n\nThe winter never " +
      "ended. Settlements vanished, children grew old and died, and Rotnick continued making gifts for people who " +
      "no longer existed. Even decay could not release him."
  },
  {
    title: "§5Kael’Vorr’s Discovery",
    body:
      "Kael’Vorr found Rotnick dragging his sack through the snow, delivering presents to frozen ruins.\n\n" +
      "“A dead man who continues giving gifts. What happens when he has somewhere new to deliver them?”\n\n" +
      "Kael’Vorr brought him to the Overworld and rebuilt his ruined sleigh with infected flesh, demon metal, and " +
      "unstable chaos energy.\n\nZombie Santa was born."
  },
  {
    title: "§6Broken Generosity",
    body:
      "Zombie Santa still believes he must deliver gifts, but centuries of decay damaged his understanding of a " +
      "present. His sack may contain treasure, rotten food, dangerous weapons, infected creatures, explosives, rare " +
      "materials, or monsters that should never fit inside it.\n\nHe searches winter nights for “good children,” but " +
      "his definition changes constantly. Kindness may earn a gift. Sometimes causing the most chaos does."
  },
  {
    title: "§8The Rotten List",
    body:
      "Zombie Santa carries the Rotten List. It does not record only criminals—it records anyone who recently did " +
      "something unexpected.\n\nKael’Vorr values unpredictability. Santa may hunt someone not as punishment, but " +
      "because they became interesting.\n\nThose marked naughty may hear distant bells. The bells grow louder as " +
      "the Red Wanderer approaches."
  },
  {
    title: "§dThe Endless Sack",
    body:
      "The Sack of Endless Giving is larger inside than outside. Its unstable pocket dimension combines Ender-space, " +
      "echo energy, demon leather, infected tissue, and a fragment of Rotnick’s original bag.\n\nIt pulls lost objects " +
      "from other dimensions and constantly produces new gifts. This is why Santa carries things that should not " +
      "exist in the Overworld.\n\nOccasionally, something inside escapes."
  },
  {
    title: "§5The Chaos Inventor",
    body:
      "Kael’Vorr calls Zombie Santa one of his most entertaining experiments. He did not command Rotnick to become " +
      "evil or remove his remaining kindness. He combined generosity, undeath, dimensional magic, and confusion to " +
      "see which trait would become strongest.\n\nSanta sometimes hates Kael’Vorr. Other times he calls him his " +
      "greatest helper.\n\nKael’Vorr never corrects him."
  },
  {
    title: "§cBroken Traditions",
    body:
      "Records describe Explosive Presents, Coal of Corruption, summoned zombie helpers, stolen gifts, ghostly sleigh " +
      "charges, and a desperate Christmas Miracle drawn from the sack.\n\nNo encounter is perfectly predictable. " +
      "Kael’Vorr changes the experiment whenever he repairs it."
  },
  {
    title: "§2He Always Returns",
    body:
      "Zombie Santa cannot truly die. When defeated, his body collapses into snow, rotten cloth, and green magical " +
      "smoke. His sack disappears while distant bells fade into another dimension.\n\nBy the next winter, Kael’Vorr " +
      "repairs him and sends him out again—sometimes stronger, sometimes kinder, sometimes carrying something even " +
      "Kael’Vorr has never seen.\n\n“Very good or very bad... I can no longer remember which earns the bigger present.”"
  }
];

export class ZombieSantaLoreBook {
  onUse({ source }) {
    showSantaLoreIndex(source);
  }
}

function showSantaLoreIndex(player) {
  const form = new ActionFormData()
    .title("§4Zombie Santa")
    .body("§8The Red Wanderer\n§7A recovered account from the frozen dimension.");

  for (const chapter of SANTA_LORE_CHAPTERS) {
    form.button(chapter.title, "textures/christmas/items/christmass/christmas_book");
  }

  form.show(player).then(response => {
    if (response.canceled || response.selection === undefined) return;
    showSantaLoreChapter(player, response.selection);
  }).catch(() => {});
}

function showSantaLoreChapter(player, chapterIndex) {
  const chapter = SANTA_LORE_CHAPTERS[chapterIndex];
  if (!chapter) return;

  new ActionFormData()
    .title(chapter.title)
    .body(chapter.body)
    .button("§cBack")
    .show(player)
    .then(response => {
      if (!response.canceled) showSantaLoreIndex(player);
    })
    .catch(() => {});
}

function showGuideIndex(player) {
  const form = new ActionFormData()
    .title("§4§lChristmas Land Guide")
    .body("§fChoose a chapter. This book explains the Christmas biome, mobs, blocks, items, recipes, and abilities.");

  for (const page of GUIDE_PAGES) {
    form.button(page.title, page.icon);
  }

  form.show(player).then(response => {
    if (response.canceled || response.selection === undefined) return;
    showGuidePage(player, response.selection);
  }).catch(() => {});
}

function showGuidePage(player, pageIndex) {
  const page = GUIDE_PAGES[pageIndex];
  if (!page) return;

  new ActionFormData()
    .title(page.title)
    .body(page.body)
    .button("§cBack")
    .show(player)
    .then(response => {
      if (!response.canceled) showGuideIndex(player);
    })
    .catch(() => {});
}
