import {
  EntityComponentTypes,
  EnchantmentType,
  EquipmentSlot,
  ItemComponentTypes,
  ItemStack,
  Player,
  system
} from "@minecraft/server";

const SCRIPT_EVENT_ID = "zombie:coffin_backpack_pickup";
const ENTITY_ID = "zombie:coffin_backpack_entity";
const ITEM_ID = "zombie:coffin_backpack";
const LORE_HEADER = "CB1:";
const MAX_LORE_LINES = 20;
const MAX_LINE_LENGTH = 50;
const processing = new Set();

export class CoffinBackpackPlacementComponent {
  onUseOn(event) {
    const player = event.source;
    if (!(player instanceof Player) || !event.block) return;

    const location = placementLocation(event.block.location, event.blockFace);
    system.run(() => placeBackpack(player, location));
  }
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== SCRIPT_EVENT_ID) return;

  const entity = event.sourceEntity;
  if (entity?.typeId !== ENTITY_ID || processing.has(entity.id)) return;

  const entityId = entity.id;
  processing.add(entityId);

  system.run(() => {
    try {
      pickupBackpack(entity);
    } catch (error) {
      console.error(`[Coffin Backpack] Pickup failed: ${formatError(error)}`);
    } finally {
      processing.delete(entityId);
    }
  });
});

function pickupBackpack(entity) {
  if (!entity.isValid) return;

  const dimension = entity.dimension;
  const source = getEntityContainer(entity);
  const saved = [];
  const overflow = [];

  for (let slot = 0; slot < source.size; slot++) {
    const stack = source.getItem(slot);
    if (!stack) continue;

    const record = serializeStack(slot, stack);
    if (fitsInLore([...saved, record])) saved.push(record);
    else overflow.push(stack);
  }

  const backpack = new ItemStack(ITEM_ID, 1);
  backpack.setLore(encodeLore(saved));

  const dropLocation = {
    x: entity.location.x,
    y: entity.location.y + 0.25,
    z: entity.location.z
  };

  dimension.spawnItem(backpack, dropLocation);
  for (const stack of overflow) dimension.spawnItem(stack, dropLocation);

  source.clearAll();
  entity.remove();

  if (overflow.length) {
    const player = dimension.getPlayers({
      location: dropLocation,
      maxDistance: 8,
      closest: 1
    })[0];
    player?.sendMessage("\u00a7eBackpack storage full. Items that could not be saved were dropped.");
  }
}

function placeBackpack(player, location) {
  if (!player.isValid) return;

  const equippable = player.getComponent(EntityComponentTypes.Equippable);
  const held = equippable?.getEquipment(EquipmentSlot.Mainhand);
  if (held?.typeId !== ITEM_ID) return;

  let entity;
  try {
    const records = decodeLore(held.getLore());
    entity = player.dimension.spawnEntity(ENTITY_ID, location);
    const target = getEntityContainer(entity);

    for (const record of records) {
      if (record[0] < 0 || record[0] >= target.size) continue;
      target.setItem(record[0], deserializeStack(record));
    }

    equippable.setEquipment(EquipmentSlot.Mainhand, undefined);
  } catch (error) {
    try { entity?.remove(); } catch {}
    console.error(`[Coffin Backpack] Placement failed: ${formatError(error)}`);
    player.sendMessage("\u00a7cThe backpack could not be placed; the item was not consumed.");
  }
}

function serializeStack(slot, stack) {
  const record = [slot, compressId(stack.typeId), stack.amount];
  const extras = {};

  if (stack.nameTag) extras.n = stack.nameTag;

  const itemLore = stack.getLore();
  if (itemLore.length) extras.l = itemLore;

  const durability = stack.getComponent(ItemComponentTypes.Durability);
  if (durability?.damage) extras.d = durability.damage;

  const enchantable = stack.getComponent(ItemComponentTypes.Enchantable);
  const enchantments = enchantable?.getEnchantments() ?? [];
  if (enchantments.length) {
    extras.e = enchantments.map(({ type, level }) => [compressId(type.id), level]);
  }

  if (Object.keys(extras).length) record.push(extras);
  return record;
}

function deserializeStack(record) {
  const [, compactId, amount, extras = {}] = record;
  const stack = new ItemStack(expandId(compactId), amount);

  if (extras.n) stack.nameTag = extras.n;
  if (extras.l) stack.setLore(extras.l);

  const durability = stack.getComponent(ItemComponentTypes.Durability);
  if (durability && Number.isFinite(extras.d)) durability.damage = extras.d;

  const enchantable = stack.getComponent(ItemComponentTypes.Enchantable);
  if (enchantable && extras.e) {
    enchantable.addEnchantments(extras.e.map(([id, level]) => ({
      type: new EnchantmentType(expandId(id)),
      level
    })));
  }

  return stack;
}

function encodeLore(records) {
  if (!records.length) return [];
  const payload = LORE_HEADER + JSON.stringify(records);
  const lines = [];
  for (let index = 0; index < payload.length; index += MAX_LINE_LENGTH) {
    lines.push(payload.slice(index, index + MAX_LINE_LENGTH));
  }
  if (lines.length > MAX_LORE_LINES) throw new Error("Encoded backpack lore exceeded its limit.");
  return lines;
}

function decodeLore(lore) {
  if (!lore.length) return [];
  const payload = lore.join("");
  if (!payload.startsWith(LORE_HEADER)) return [];
  const records = JSON.parse(payload.slice(LORE_HEADER.length));
  if (!Array.isArray(records)) throw new Error("Backpack lore data is invalid.");
  return records;
}

function fitsInLore(records) {
  return (LORE_HEADER.length + JSON.stringify(records).length) <=
    MAX_LORE_LINES * MAX_LINE_LENGTH;
}

function compressId(id) {
  if (id.startsWith("minecraft:")) return `m:${id.slice(10)}`;
  if (id.startsWith("zombie:")) return `z:${id.slice(7)}`;
  return id;
}

function expandId(id) {
  if (id.startsWith("m:")) return `minecraft:${id.slice(2)}`;
  if (id.startsWith("z:")) return `zombie:${id.slice(2)}`;
  return id;
}

function getEntityContainer(entity) {
  const container = entity.getComponent(EntityComponentTypes.Inventory)?.container;
  if (!container?.isValid) throw new Error("The placed backpack has no inventory.");
  return container;
}

function placementLocation(block, face) {
  const offset = {
    Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1],
    South: [0, 0, 1], East: [1, 0, 0], West: [-1, 0, 0]
  }[String(face)] ?? [0, 1, 0];
  return {
    x: block.x + offset[0] + 0.5,
    y: block.y + offset[1],
    z: block.z + offset[2] + 0.5
  };
}

function formatError(error) {
  if (!(error instanceof Error)) return String(error);
  return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
}
