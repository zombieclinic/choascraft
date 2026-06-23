import { EntityDamageCause, EquipmentSlot, GameMode, ItemComponentTypes, ItemStack, Player, system } from "@minecraft/server";

const ROD_ITEM = "zombie:chaos_fishing_rod";
const CASTED_ROD_ITEM = "zombie:chaos_fishing_rod_casted";
const HOOK_ENTITY = "zombie:fishing_hook";

const CAST_SPEED = 1.15;
const CAST_UPWARD_SPEED = 0.22;
const GRAVITY = 0.045;
const MAX_DISTANCE = 32;
const MAX_HOOK_AGE_TICKS = 20 * 45;
const MIN_BITE_WAIT_TICKS = 20 * 3;
const MAX_BITE_WAIT_TICKS = 20 * 8;
const MIN_BITE_TICKS = 10;
const MAX_BITE_TICKS = 40;
const HOOK_WIGGLE_RADIUS = 0.16;
const CAST_MOVE_STEPS = 5;
const MOB_HOOK_DAMAGE = 1;
const MOB_HOOK_RADIUS = 0.7;
const HOOKED_MOB_Y_OFFSET = 0.9;
const HOOK_DAMAGE_CAUSE = EntityDamageCause.projectile ?? "projectile";

const FISHING_REWARDS = [
  ["minecraft:cod", 45],
  ["minecraft:salmon", 25],
  ["minecraft:pufferfish", 13],
  ["minecraft:tropical_fish", 12],
  ["minecraft:bone", 8],
  ["minecraft:bowl", 7],
  ["minecraft:leather", 7],
  ["minecraft:string", 7],
  ["minecraft:stick", 6],
  ["minecraft:tripwire_hook", 5],
  ["minecraft:nautilus_shell", 2],
  ["minecraft:name_tag", 2],
  ["minecraft:saddle", 1],
  ["minecraft:bow", 1],
  ["minecraft:enchanted_book", 1]
];

const activeHooks = new Map();

export class ChaosFishingRodComponent {
  onUse(event) {
    const player = event?.source;
    if (!(player instanceof Player)) return;

    const item = event.itemStack;
    if (item?.typeId === CASTED_ROD_ITEM || activeHooks.has(player.id)) {
      reelHook(player, true);
      return;
    }

    castHook(player);
  }
}

system.runInterval(tickHooks, 1);

function castHook(player) {
  removeHook(player, false);

  const direction = player.getViewDirection();
  const start = {
    x: player.location.x + direction.x * 1.2,
    y: player.location.y + 1.35 + direction.y * 0.5,
    z: player.location.z + direction.z * 1.2
  };

  let hook;
  try {
    hook = player.dimension.spawnEntity(HOOK_ENTITY, start);
  } catch {
    return;
  }

  activeHooks.set(player.id, {
    hook,
    player,
    rodSlot: player.selectedSlotIndex,
    velocity: {
      x: direction.x * CAST_SPEED,
      y: direction.y * CAST_SPEED + CAST_UPWARD_SPEED,
      z: direction.z * CAST_SPEED
    },
    landed: false,
    inWater: false,
    age: 0,
    biteWait: 0,
    biteTicks: 0,
    biteDuration: 0,
    biteAnchor: undefined,
    hookedEntity: undefined,
    rodBroken: false
  });

  setRodItem(player, CASTED_ROD_ITEM);
  playSound(player.dimension, "random.bow", start);
}

function tickHooks() {
  if (activeHooks.size === 0) return;

  for (const [playerId, state] of activeHooks) {
    const player = state.player;
    const hook = state.hook;

    if (!isValidEntity(player) || !isValidEntity(hook)) {
      cleanupHook(playerId, state, true);
      continue;
    }

    state.age++;
    if (state.age > MAX_HOOK_AGE_TICKS || distance(player.location, hook.location) > MAX_DISTANCE) {
      cleanupHook(playerId, state, true);
      continue;
    }

    if (!state.landed) {
      moveFlyingHook(state);
      continue;
    }

    if (state.hookedEntity) {
      tickHookedEntity(state);
      continue;
    }

    if (state.inWater) {
      tickWaterHook(state);
    }
  }
}

function moveFlyingHook(state) {
  const hook = state.hook;

  for (let step = 0; step < CAST_MOVE_STEPS; step++) {
    const next = {
      x: hook.location.x + state.velocity.x / CAST_MOVE_STEPS,
      y: hook.location.y + state.velocity.y / CAST_MOVE_STEPS,
      z: hook.location.z + state.velocity.z / CAST_MOVE_STEPS
    };

    const target = getHookableEntity(state, next);
    if (target) {
      landHookOnEntity(state, target);
      return;
    }

    const block = getBlockAt(hook.dimension, next);
    const below = getBlockAt(hook.dimension, { x: next.x, y: next.y - 0.18, z: next.z });

    if (isWater(block) || isWater(below)) {
      landHookInWater(state, next);
      return;
    }

    if (isSolidBlock(block)) {
      landHookOnBlock(state, next);
      return;
    }

    if (state.velocity.y <= 0 && isSolidBlock(below)) {
      landHookOnBlock(state, {
        x: next.x,
        y: Math.floor(next.y - 0.18) + 1.04,
        z: next.z
      });
      return;
    }

    if (next.y < -64 || next.y > 320) {
      state.landed = true;
      state.inWater = false;
      teleportEntity(hook, next);
      return;
    }

    teleportEntity(hook, next);
  }

  state.velocity.y -= GRAVITY;
}

function landHookInWater(state, location) {
  state.landed = true;
  state.inWater = true;
  state.biteWait = randomInt(MIN_BITE_WAIT_TICKS, MAX_BITE_WAIT_TICKS);
  state.biteDuration = randomInt(MIN_BITE_TICKS, MAX_BITE_TICKS);
  state.biteAnchor = {
    x: location.x,
    y: Math.floor(location.y) + 0.1,
    z: location.z
  };

  teleportEntity(state.hook, state.biteAnchor);
}

function landHookOnBlock(state, location) {
  state.landed = true;
  state.inWater = false;
  state.velocity = { x: 0, y: 0, z: 0 };
  teleportEntity(state.hook, {
    x: location.x,
    y: Math.floor(location.y) + 1.04,
    z: location.z
  });
}

function landHookOnEntity(state, target) {
  state.landed = true;
  state.inWater = false;
  state.hookedEntity = target;
  state.velocity = { x: 0, y: 0, z: 0 };

  damageHookedEntity(state.player, target);
  tickHookedEntity(state);
}

function tickHookedEntity(state) {
  if (!isValidEntity(state.hookedEntity)) {
    state.hookedEntity = undefined;
    return;
  }

  const target = state.hookedEntity;
  teleportEntity(state.hook, {
    x: target.location.x,
    y: target.location.y + HOOKED_MOB_Y_OFFSET,
    z: target.location.z
  });
}

function tickWaterHook(state) {
  if (state.biteWait > 0) {
    state.biteWait--;
    return;
  }

  if (state.biteTicks >= state.biteDuration) {
    state.biteWait = randomInt(MIN_BITE_WAIT_TICKS, MAX_BITE_WAIT_TICKS);
    state.biteDuration = randomInt(MIN_BITE_TICKS, MAX_BITE_TICKS);
    state.biteTicks = 0;
    teleportEntity(state.hook, state.biteAnchor ?? state.hook.location);
    return;
  }

  state.biteTicks++;
  animateBite(state);
}

function animateBite(state) {
  const anchor = state.biteAnchor ?? state.hook.location;
  const angle = state.biteTicks * 1.7;
  const tug = state.biteTicks % 6 < 3 ? -0.08 : 0.04;

  teleportEntity(state.hook, {
    x: anchor.x + Math.cos(angle) * HOOK_WIGGLE_RADIUS,
    y: anchor.y + tug,
    z: anchor.z + Math.sin(angle) * HOOK_WIGGLE_RADIUS
  });

  if (state.biteTicks === 1) {
    playSound(state.hook.dimension, "random.splash", state.hook.location);
  }
}

function reelHook(player, shouldDropLoot) {
  const state = activeHooks.get(player.id);
  if (!state) {
    setRodItem(player, ROD_ITEM);
    return;
  }

  const hook = state.hook;
  const fishIsHooked = state.inWater && state.biteWait <= 0 && state.biteTicks > 0 && state.biteTicks <= state.biteDuration;

  if (shouldDropLoot && isValidEntity(state.hookedEntity)) {
    playSound(player.dimension, "random.bow", state.hookedEntity.location);
  } else if (shouldDropLoot && fishIsHooked && isValidEntity(hook)) {
    spawnFishingLoot(player, hook.location);
    state.rodBroken = damageRodAfterCatch(player, state);
  } else if (shouldDropLoot && state.inWater && isValidEntity(hook)) {
    playSound(player.dimension, "random.splash", hook.location);
  }

  if (isValidEntity(hook)) {
    teleportEntity(hook, {
      x: player.location.x,
      y: player.location.y + 1,
      z: player.location.z
    });
  }

  cleanupHook(player.id, state, true);
}

function removeHook(player, restoreRod) {
  const state = activeHooks.get(player.id);
  if (!state) return;
  cleanupHook(player.id, state, restoreRod);
}

function cleanupHook(playerId, state, restoreRod) {
  activeHooks.delete(playerId);

  try {
    state.hook?.remove();
  } catch {
    try { state.hook?.kill(); } catch {}
  }

  if (restoreRod && !state.rodBroken) {
    setRodItem(state.player, ROD_ITEM, state.rodSlot);
  }
}

function spawnFishingLoot(player, location) {
  const itemId = pickFishingReward();

  try {
    player.dimension.spawnItem(new ItemStack(itemId, 1), {
      x: location.x,
      y: location.y + 0.35,
      z: location.z
    });
  } catch {}

  playSound(player.dimension, "random.splash", location);
}

function pickFishingReward() {
  const totalWeight = FISHING_REWARDS.reduce((total, [, weight]) => total + weight, 0);
  let roll = Math.random() * totalWeight;

  for (const [itemId, weight] of FISHING_REWARDS) {
    roll -= weight;
    if (roll <= 0) return itemId;
  }

  return "minecraft:cod";
}

function damageRodAfterCatch(player, state) {
  if (!player.matches({ gameMode: GameMode.survival })) return false;

  const rod = getRodFromSlot(player, state.rodSlot) ?? getHeldRod(player);
  if (!rod?.hasComponent("minecraft:durability")) return false;
  if (!shouldDamageItem(rod)) return false;

  const durability = rod.getComponent("minecraft:durability");
  if (!durability) return false;

  durability.damage = Math.min(durability.damage + 1, durability.maxDurability);

  if (durability.damage >= durability.maxDurability) {
    clearRodSlot(player, state.rodSlot);
    playSound(player.dimension, "random.break", player.location);
    return true;
  }

  setRodStack(player, rod, state.rodSlot);
  return false;
}

function shouldDamageItem(itemStack) {
  return Math.random() <= 1 / (getUnbreakingLevel(itemStack) + 1);
}

function getUnbreakingLevel(itemStack) {
  try {
    const enchantable = itemStack.getComponent(ItemComponentTypes.Enchantable);
    const unbreaking = enchantable
      ?.getEnchantments()
      .find(enchantment => enchantment.type.id === "unbreaking");

    return unbreaking?.level ?? 0;
  } catch {
    return 0;
  }
}

function setRodItem(player, itemId, slot = player.selectedSlotIndex) {
  const source = getRodFromSlot(player, slot) ?? getHeldRod(player);
  const next = createRodStack(itemId, source);

  if (setRodStack(player, next, slot)) return;

  try {
    const equippable = player.getComponent("minecraft:equippable");
    const held = equippable?.getEquipment(EquipmentSlot.Mainhand);
    if (!isRod(held)) return;

    equippable.setEquipment(EquipmentSlot.Mainhand, createRodStack(itemId, held));
  } catch {}
}

function createRodStack(itemId, source) {
  const next = new ItemStack(itemId, 1);
  if (!source) return next;

  try { next.nameTag = source.nameTag; } catch {}

  try {
    const sourceLore = source.getLore?.();
    if (sourceLore?.length) next.setLore(sourceLore);
  } catch {}

  try {
    const sourceDurability = source.getComponent("minecraft:durability");
    const nextDurability = next.getComponent("minecraft:durability");
    if (sourceDurability && nextDurability) {
      nextDurability.damage = sourceDurability.damage;
    }
  } catch {}

  try {
    const sourceEnchantable = source.getComponent(ItemComponentTypes.Enchantable);
    const nextEnchantable = next.getComponent(ItemComponentTypes.Enchantable);
    const enchantments = sourceEnchantable?.getEnchantments?.() ?? [];
    if (nextEnchantable && enchantments.length) {
      nextEnchantable.addEnchantments(enchantments);
    }
  } catch {}

  return next;
}

function setRodStack(player, itemStack, slot = player.selectedSlotIndex) {
  if (!isRod(itemStack)) return false;
  if (setRodInSlot(player, itemStack, slot)) return true;

  try {
    const equippable = player.getComponent("minecraft:equippable");
    const held = equippable?.getEquipment(EquipmentSlot.Mainhand);
    if (!isRod(held)) return false;

    equippable.setEquipment(EquipmentSlot.Mainhand, itemStack);
    return true;
  } catch {
    return false;
  }
}

function setRodInSlot(player, itemStack, slot) {
  if (!Number.isInteger(slot)) return false;

  try {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container || slot < 0 || slot >= container.size) return false;

    const current = container.getItem(slot);
    if (!isRod(current)) return false;

    container.setItem(slot, itemStack);
    return true;
  } catch {
    return false;
  }
}

function getRodFromSlot(player, slot) {
  if (!Number.isInteger(slot)) return undefined;

  try {
    const container = player.getComponent("minecraft:inventory")?.container;
    if (!container || slot < 0 || slot >= container.size) return undefined;

    const item = container.getItem(slot);
    return isRod(item) ? item : undefined;
  } catch {
    return undefined;
  }
}

function getHeldRod(player) {
  try {
    const held = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
    return isRod(held) ? held : undefined;
  } catch {
    return undefined;
  }
}

function clearRodSlot(player, slot) {
  if (Number.isInteger(slot)) {
    try {
      const container = player.getComponent("minecraft:inventory")?.container;
      if (container && slot >= 0 && slot < container.size && isRod(container.getItem(slot))) {
        container.setItem(slot, undefined);
        return;
      }
    } catch {}
  }

  try {
    const equippable = player.getComponent("minecraft:equippable");
    if (isRod(equippable?.getEquipment(EquipmentSlot.Mainhand))) {
      equippable.setEquipment(EquipmentSlot.Mainhand, undefined);
    }
  } catch {}
}

function getHookableEntity(state, location) {
  try {
    const entities = state.hook.dimension.getEntities({
      location,
      maxDistance: MOB_HOOK_RADIUS
    });

    return entities.find(entity => {
      if (!isValidEntity(entity)) return false;
      if (entity.id === state.player.id || entity.id === state.hook.id) return false;
      if (entity.typeId === "minecraft:player" || entity.typeId === HOOK_ENTITY) return false;
      if (entity.typeId === "minecraft:item" || entity.typeId === "minecraft:xp_orb") return false;

      try {
        return !!entity.getComponent("minecraft:health");
      } catch {
        return false;
      }
    });
  } catch {
    return undefined;
  }
}

function damageHookedEntity(player, target) {
  try {
    target.applyDamage(MOB_HOOK_DAMAGE, {
      cause: HOOK_DAMAGE_CAUSE,
      damagingEntity: player
    });
  } catch {
    try { target.applyDamage(MOB_HOOK_DAMAGE); } catch {}
  }
}

function isRod(item) {
  return item?.typeId === ROD_ITEM || item?.typeId === CASTED_ROD_ITEM;
}

function getBlockAt(dimension, location) {
  try {
    return dimension.getBlock({
      x: Math.floor(location.x),
      y: Math.floor(location.y),
      z: Math.floor(location.z)
    });
  } catch {
    return undefined;
  }
}

function isWater(block) {
  return block?.typeId === "minecraft:water" || block?.typeId === "minecraft:flowing_water";
}

function isSolidBlock(block) {
  if (!block || block.typeId === "minecraft:air") return false;
  if (isWater(block)) return false;
  return true;
}

function isValidEntity(entity) {
  try {
    return !!entity && entity.isValid();
  } catch {
    try {
      return !!entity && entity.isValid;
    } catch {
      return false;
    }
  }
}

function teleportEntity(entity, location) {
  try {
    entity.teleport(location, { dimension: entity.dimension });
  } catch {}
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function playSound(dimension, sound, location) {
  try {
    dimension.playSound(sound, location);
  } catch {}
}