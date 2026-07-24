import {
  EntityDamageCause,
  EntityInventoryComponent,
  system,
  Player,
  GameMode,
  ItemComponentTypes,
  EquipmentSlot
} from "@minecraft/server";

export class Openbox {
  constructor() {
    this.onPlayerInteract = this.onPlayerInteract.bind(this);

    // Block to effect mappings
    this.blockEffects = {
      // New choas chest block
      "zombie:choas_chest": {
        particle: "zombie:choas_cross",
        sound: "zombie.walker.scream",
      },

      // Original present blocks with santa particle and present sound
      "zombie:lucky_present": {
        particle: "zombie:santa_particle",
        sound: "present",
      },
      "zombie:blue_present": {
        particle: "zombie:santa_particle",
        sound: "present",
      },
      "zombie:green_present": {
        particle: "zombie:santa_particle",
        sound: "present",
      },
      "zombie:pink_present": {
        particle: "zombie:santa_particle",
        sound: "present",
      },
      "zombie:purple_present": {
        particle: "zombie:santa_particle",
        sound: "present",
      },
      "zombie:red_present": {
        particle: "zombie:santa_particle",
        sound: "present",
      },
    };
  }

  async onPlayerInteract(event) {
    const player = event.player;
    const block = event.block;
    const dimension = event.dimension;

    if (!block || !dimension) return;

    const blockPos = block.location;
    const currentBlock = dimension.getBlock(blockPos);
    if (!currentBlock) return;

    const currentPermutation = currentBlock.permutation;
    if (!currentPermutation) return;

    const currentBlockState = currentPermutation.getState("zombie:open");
    const newBlockState = currentBlockState === 1 ? 0 : 1;

    const newPermutation = currentPermutation.withState("zombie:open", newBlockState);
    currentBlock.setPermutation(newPermutation);

    if (newBlockState === 1) {
      const blockId = currentBlock.typeId;
      const effects = this.blockEffects[blockId] || {};

      // Fire particle effect if available
      if (effects.particle) {
        this.fireParticleEffect(dimension, blockPos, effects.particle);
      }

      // Play sound if available
      if (effects.sound) {
        try {
          // Special case for present sound (named "present") to run the specific command string
          if (effects.sound === "present") {
            await player.runCommand(`playsound present @a[r=20]`);
          } else {
            await player.runCommand(`playsound ${effects.sound} @a[r=20]`);
          }
        } catch (error) {
          console.error(`Error playing sound: ${error}`);
        }
      }

      this.scheduleBlockReplacement(dimension, blockPos);
    }
  }

  fireParticleEffect(dimension, location, particleName) {
    dimension.runCommand(
      `particle ${particleName} ${location.x} ${location.y} ${location.z}`
    );
  }


    scheduleBlockReplacement(dimension, blockPos) {
        // Wait for 60 ticks (3 seconds)
        system.runTimeout(() => {
            try {
                // Replace the block with air
                dimension.runCommand(`setblock ${blockPos.x} ${blockPos.y} ${blockPos.z} air destroy`);
            } catch (error) {
                console.error(`Error during block replacement: ${error}`);
            }
        }, 60); // 60 ticks delay
    }
}





const REDSTONE_NEIGHBOR_OFFSETS = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 }
];

function blockRedstonePower(block) {
  try {
    return block.getRedstonePower() ?? 0;
  } catch {
    return 0;
  }
}

function receivedRedstonePower(block) {
  const directPower = blockRedstonePower(block);
  if (directPower > 0) return directPower;

  const { x, y, z } = block.location;
  for (const offset of REDSTONE_NEIGHBOR_OFFSETS) {
    try {
      const neighbor = block.dimension.getBlock({
        x: x + offset.x,
        y: y + offset.y,
        z: z + offset.z
      });
      const neighborPower = neighbor ? blockRedstonePower(neighbor) : 0;
      if (neighborPower > 0) return neighborPower;
    } catch {}
  }

  return 0;
}

function setLightState(block, state) {
  const permutation = block.permutation;
  const currentState = permutation.getState("zombie:light");
  if (currentState === undefined || currentState === state) return;

  try {
    block.setPermutation(permutation.withState("zombie:light", state));
  } catch {}
}

export class ChristmasLights {
  onTick({ block }) {
    if (!block || block.typeId === "minecraft:air") return;
    setLightState(block, receivedRedstonePower(block) > 0 ? 1 : 0);
  }
}

export class ColorLights {
  onTick({ block }) {
    if (!block || block.typeId === "minecraft:air") return;

    const currentState = block.permutation.getState("zombie:light");
    if (typeof currentState !== "number") return;

    if (receivedRedstonePower(block) <= 0) {
      setLightState(block, 0);
      return;
    }

    // State 0 is off. Powered lights cycle only through colors 1–8.
    setLightState(block, currentState >= 8 ? 1 : currentState + 1);
  }
}




const SANTA_SWEEP_RADIUS = 3.5;
const SANTA_SWEEP_DAMAGE = 5;
const SANTA_SWEEP_DOT_MINIMUM = 0.5; // 120-degree forward arc.
const SANTA_SWEEP_COOLDOWN_TICKS = 12;
const santaSweepCooldowns = new WeakMap();

function canSweepTarget(player, entity, primaryTarget) {
  if (!entity?.isValid || entity === player || entity === primaryTarget) return false;

  const health = entity.getComponent("minecraft:health");
  if (!health) return false;

  const dx = entity.location.x - player.location.x;
  const dz = entity.location.z - player.location.z;
  const horizontalDistance = Math.hypot(dx, dz);
  if (horizontalDistance < 0.001) return true;

  const view = player.getViewDirection();
  return ((dx / horizontalDistance) * view.x) + ((dz / horizontalDistance) * view.z)
    >= SANTA_SWEEP_DOT_MINIMUM;
}

function damageSweepTarget(player, target) {
  try {
    target.applyDamage(SANTA_SWEEP_DAMAGE, {
      cause: EntityDamageCause.entityAttack,
      damagingEntity: player
    });
    target.addEffect("minecraft:slowness", 40, {
      amplifier: 0,
      showParticles: true
    });
    return true;
  } catch {
    return false;
  }
}

function performSantaSweep(player, primaryTarget) {
  if (!(player instanceof Player)) return;

  const currentTick = system.currentTick;
  if ((santaSweepCooldowns.get(player) ?? -Infinity) > currentTick) return;
  santaSweepCooldowns.set(player, currentTick + SANTA_SWEEP_COOLDOWN_TICKS);

  let hitCount = 0;
  const targets = player.dimension.getEntities({
    location: player.location,
    maxDistance: SANTA_SWEEP_RADIUS
  });

  for (const target of targets) {
    if (!canSweepTarget(player, target, primaryTarget)) continue;
    if (damageSweepTarget(player, target)) hitCount++;
  }

  try {
    player.playAnimation("animation.santasword_swing_melee.tpp_swing_melee");
    player.playSound(hitCount > 0 ? "game.player.attack.strong" : "game.player.attack.nodamage");
  } catch {}
}

export class SantaSword {
  onUse({ source }) {
    performSantaSweep(source);
  }

  onHitEntity({ attackingEntity, hitEntity }) {
    // The primary target already receives the sword's normal seven damage.
    // The sweep damages the other targets in front of the player.
    performSantaSweep(attackingEntity, hitEntity);
  }
}



export class Open2 {
    constructor() {
        // Bind methods to ensure the correct `this` context
        this.onPlayerInteract = this.onPlayerInteract.bind(this);
    }

    onPlayerInteract(event) {
        const player = event.player;
        const block = event.block;
        const dimension = event.dimension;

        if (!block || !dimension) return; // Ensure block and dimension exist

        const blockPos = block.location; // Get block position
        const currentBlock = dimension.getBlock(blockPos);

        if (!currentBlock) return; // Ensure the block exists in the dimension

        // Get the current permutation of the block
        const currentPermutation = currentBlock.permutation;

        if (!currentPermutation) return; // Ensure the block has a permutation

        // Get the current state of the "zombie:open" property
        const currentBlockState = currentPermutation.getState("zombie:open");

        // Toggle the block state between 0 and 1
        const newBlockState = currentBlockState === 1 ? 0 : 1;

        // Create a new permutation with the updated state
        const newPermutation = currentPermutation.withState("zombie:open", newBlockState);

        // Apply the new permutation to the block
        currentBlock.setPermutation(newPermutation);



    }
}


export class Christmas_Cookie {
    onConsume(arg) {
        const player = arg.source;

        // List of possible effects
        const effects = [
            "minecraft:absorption",
            "minecraft:fire_resistance",
            "minecraft:haste",
            "minecraft:health_boost",
            "minecraft:invisibility",
            "minecraft:jump_boost",
            "minecraft:night_vision",
            "minecraft:regeneration",
            "minecraft:resistance",
            "minecraft:saturation",
            "minecraft:strength",
            "minecraft:water_breathing"
        ];

        // Randomly select an effect
        const randomEffect = effects[Math.floor(Math.random() * effects.length)];

        // Apply the randomly chosen effect
        player.addEffect(randomEffect, 500, {
            amplifier: 0,
            showParticles: true
        });
    }
}

export class Candycane {
    onConsume(arg) {
        const player = arg.source;

        player.addEffect("minecraft:speed", 300, {
            amplifier: 0,
            showParticles: true
        })

    }

}





export class CandyGrow {
    static tryGrowBlock(block /** @type Block */) {
        const perm = block.permutation;
        const age = perm.getState("zombie:crop_age");
        if (age === undefined || typeof age !== "number") {
            return;
        }
        if (age === 5) {
            return; // already at max age
        }
        block.setPermutation(perm.withState("zombie:crop_age", age + 1));
    }

    static tryFertilize(block /** @type Block */, player /** @type Player */) {
        var _a, _b;
        const inventory = player.getComponent(EntityInventoryComponent.componentId);
        if (inventory === undefined) {
            return false;
        }
        const selectedItem = (_a = inventory.container) === null || _a === void 0 ? void 0 : _a.getItem(player.selectedSlotIndex);
        if (selectedItem && selectedItem.typeId === "minecraft:bone_meal") {
            CandyGrow.tryGrowBlock(block);

            // Trigger the particle effect
            const pos = block.location;
            player.runCommand(`particle minecraft:crop_growth_emitter ${pos.x} ${pos.y} ${pos.z}`);

            if (selectedItem.amount > 1) {
                selectedItem.amount--;
                (_b = inventory.container) === null || _b === void 0 ? void 0 : _b.setItem(player.selectedSlotIndex, selectedItem);
            } else {
                // Remove the item from the inventory if the amount is 1
                (_b = inventory.container) === null || _b === void 0 ? void 0 : _b.setItem(player.selectedSlotIndex, undefined);
            }

            return true;
        }
        return false;
    }

    onRandomTick(arg /** @type BlockComponentRandomTickEvent */) {
        CandyGrow.tryGrowBlock(arg.block);
    }

    onPlayerInteract(arg /** @type BlockComponentPlayerInteractEvent */) {
        if (arg.player === undefined) {
            return;
        }
        CandyGrow.tryFertilize(arg.block, arg.player);
    }
}




// Make sure these are imported somewhere in your file:
// import { Player, GameMode, ItemComponentTypes, EquipmentSlot } from "@minecraft/server";

export class SantaSwordDamage {
  onHitEntity(event) {
    const { attackingEntity } = event;
    if (!(attackingEntity instanceof Player)) return;
    if (!attackingEntity.matches({ gameMode: GameMode.survival })) return;

    const inv = attackingEntity.getComponent("minecraft:inventory");
    const itemInHand = inv?.container?.getItem(attackingEntity.selectedSlotIndex);
    if (!itemInHand) return;

    damageItemWithUnbreaking(attackingEntity, itemInHand, 1);
  }

  // ✅ NEW: also wear durability when player uses the item
  onUse(event) {
    const player    = event.source;
    const itemStack = event.itemStack;
    if (!(player instanceof Player)) return;
    if (!player.matches({ gameMode: GameMode.survival })) return;
    if (!itemStack?.hasComponent("minecraft:durability")) return;

    damageItemWithUnbreaking(player, itemStack, 1);
  }

  onMineBlock(event) {
    const { source: player, itemStack, block } = event;
    if (!(player instanceof Player) || !itemStack || !block) return;
    if (!itemStack.hasComponent("minecraft:durability")) return;

    damageItemWithUnbreaking(player, itemStack, 1);
  }
}

function getUnbreakingLevel(itemStack) {
  let lvl = 0;
  const enchComp = itemStack.getComponent(ItemComponentTypes.Enchantable);
  if (enchComp) {
    const ench = enchComp.getEnchantments().find(
      enchantment => enchantment.type.id === "minecraft:unbreaking"
        || enchantment.type.id === "unbreaking"
    );
    if (ench) lvl = ench.level;
  }
  return lvl;
}

function damageItemWithUnbreaking(player, itemStack, amount) {
  const damageChance = 1 / (getUnbreakingLevel(itemStack) + 1);
  if (Math.random() <= damageChance) {
    adjustItemDamage(player, itemStack, amount);
  }
}

function adjustItemDamage(player, itemStack, damageToAdd) {
  const durabilityComp = itemStack.getComponent("minecraft:durability");
  if (!durabilityComp) return;

  const equip = player.getComponent("minecraft:equippable");

  durabilityComp.damage = Math.min(
    durabilityComp.damage + damageToAdd,
    durabilityComp.maxDurability
  );

  if (durabilityComp.damage >= durabilityComp.maxDurability) {
    // break the item
    equip?.setEquipment(EquipmentSlot.Mainhand, undefined);
    player.playSound("random.break", { pitch: 0.9, volume: 1.0 });
  } else {
    // write back the updated stack
    equip?.setEquipment(EquipmentSlot.Mainhand, itemStack);
  }
}
