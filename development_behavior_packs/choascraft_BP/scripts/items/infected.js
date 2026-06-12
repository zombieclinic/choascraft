import {
  world,
  system,
  EquipmentSlot,
  EntityComponentTypes,
  EntityDamageCause,
  Player,
} from "@minecraft/server";

function isValid(entity) {
  if (!entity) return false;
  if (typeof entity.isValid === "function") return entity.isValid();
  return entity.isValid !== false;
}

export class infectedAttack {
  constructor() {}

  onHitEntity(arg) {
    const attacker = arg.attackingEntity;
    const target   = arg.hitEntity;
    if (!attacker || !target) return;

    // --- count infected gear pieces (+claws in main hand) ---
    const equippable = attacker.getComponent(EntityComponentTypes.Equippable);
    if (!equippable) return;

    let setInfected = 0;

    const hasEquippedItem = (itemName, slot) => {
      const item = equippable.getEquipment(slot);
      return !!item && item.typeId === itemName;
    };

    if (hasEquippedItem("zombie:infected_helmet",     EquipmentSlot.Head))  setInfected++;
    if (hasEquippedItem("zombie:infected_chestplate", EquipmentSlot.Chest)) setInfected++;
    if (hasEquippedItem("zombie:infected_leggings",   EquipmentSlot.Legs))  setInfected++;
    if (hasEquippedItem("zombie:infected_boots",      EquipmentSlot.Feet))  setInfected++;

    // main hand claws (only reliable on players)
    if (attacker instanceof Player) {
      const inv = attacker.getComponent("minecraft:inventory");
      if (inv) {
        const it = inv.container.getItem(attacker.selectedSlotIndex);
        if (it && it.typeId === "zombie:brown_bear_claws") setInfected++;
      }
    }

    // --- chance table (5/10/15/20/25 %) ---
    let chance = 0;
    switch (setInfected) {
      case 1: chance = 0.05; break;
      case 2: chance = 0.10; break;
      case 3: chance = 0.15; break;
      case 4: chance = 0.20; break;
      case 5: chance = 0.25; break;
      default: chance = 0;   break;
    }
    if (chance <= 0 || Math.random() >= chance) return;

    // --- apply 1 dmg/sec for 5s (anti-stack with a tag) ---
    const TAG = "infected_bleed";
    if (target.hasTag(TAG)) return;           // don't stack
    target.addTag(TAG);

    const SECONDS = 5;
    const TPS = 20;

    for (let i = 0; i < SECONDS; i++) {
      system.runTimeout(() => {
        if (!isValid(target)) return;
        try {
          // New signature
          target.applyDamage(1, { cause: EntityDamageCause.magic, damagingEntity: attacker });
        } catch {
          // Old signature fallback (amount only)
          try { target.applyDamage(1); } catch {}
        }
      }, i * TPS);
    }

    // remove anti-stack tag after it finishes
    system.runTimeout(() => {
      if (isValid(target)) target.removeTag(TAG);
    }, SECONDS * TPS + 1);
  }
}
