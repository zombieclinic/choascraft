import {
	EntityDamageCause,
	EquipmentSlot,
	GameMode,
	ItemStack,
	Player,
	system
} from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

const CHAOS_STAFF = "zombie:chaos_staff";
const CHAOS_BOOK = "zombie:chaos_book";
const CHAOS_BOOK_OPEN = "zombie:chaos_book_open";

const SPELL_TAG_PREFIX = "zc:chaos_spell:";
const STRENGTH_TAG_PREFIX = "zc:chaos_strength:";
const OVERCAST_TAG = "zc:chaos_overcast";
const BOOK_MENU_OPEN_TAG = "zc:chaos_book_menu_open";
const SPELL_CHAOS_BLAST = "chaos_blast";
const SPELL_LIFE_STEAL = "life_steal";

const CHAOS_BALL_PARTICLE = "zombie:chaos_ball";
const LIFE_STEAL_PARTICLE = "zombie:chaos_life_steal_ball";
const CHAOS_BLAST_ENTITY = "zombie:chaos_blast_spell";
const LIFE_STEAL_ENTITY = "zombie:life_steal_spell";

const MIN_CAST_XP = 1;
const MAX_CAST_XP = 50;
const BACKLASH_EFFECTS = ["blindness", "darkness", "hunger", "mining_fatigue", "nausea", "poison", "slowness", "weakness"];

const PROJECTILE_SPEED = 1.05;
const PROJECTILE_STEPS = 4;
// Entity query distance is measured from an entity's feet, while the spell
// normally flies at chest height. This radius allows visible contacts to count.
const PROJECTILE_HIT_RADIUS = 1.75;
const AREA_DAMAGE_RADIUS = 1;
const PROJECTILE_MAX_TICKS = 28;
const STAFF_COOLDOWN_TICKS = 10;

const DAMAGE_CAUSE = EntityDamageCause.magic ?? "magic";

const SPELLS = [
	{
		id: SPELL_CHAOS_BLAST,
		name: "Chaos Blast",
		particle: CHAOS_BALL_PARTICLE,
		entityType: CHAOS_BLAST_ENTITY,
		baseDamage: 2,
		damagePerXp: 5,
		lifeSteal: false
	},
	{
		id: SPELL_LIFE_STEAL,
		name: "Life Steal",
		particle: LIFE_STEAL_PARTICLE,
		entityType: LIFE_STEAL_ENTITY,
		baseDamage: 1,
		damagePerXp: 5,
		lifeSteal: true
	}
];

const activeProjectiles = new Map();
let nextProjectileId = 0;

export class ChaosStaffComponent {
	onUse(event) {
		const player = event?.source;
		const item = event?.itemStack;

		if (!(player instanceof Player)) return;
		if (item?.typeId && item.typeId !== CHAOS_STAFF) return;

		system.run(() => {
			if (!isValidEntity(player)) return;
			castSelectedSpell(player);
		});
	}
}

export class ChaosBookComponent {
	onUse(event) {
		const player = event?.source;
		if (!(player instanceof Player)) return;

		system.run(() => {
			if (!isValidEntity(player)) return;
			showSpellBook(player);
		});
	}
}

system.runInterval(tickProjectiles, 1);

function castSelectedSpell(player) {
	const template = getSelectedSpell(player);
	const castXp = getCastStrength(player);
	if (!tryPaySpellCost(player, castXp, template)) return;
	const spell = createCastSpell(player, template, castXp);

	const direction = player.getViewDirection();
	const start = {
		x: player.location.x + direction.x * 1.2,
		y: player.location.y + 1.35 + direction.y * 0.25,
		z: player.location.z + direction.z * 1.2
	};

	let projectile;
	try {
		projectile = player.dimension.spawnEntity(spell.entityType, start);
	} catch {
		return;
	}

	activeProjectiles.set(++nextProjectileId, {
		projectile,
		owner: player,
		ownerId: player.id,
		spell,
		location: start,
		velocity: {
			x: direction.x * PROJECTILE_SPEED,
			y: direction.y * PROJECTILE_SPEED,
			z: direction.z * PROJECTILE_SPEED
		},
		age: 0
	});

	startCooldown(player);
	playCastFeedback(player, spell);
}

function tickProjectiles() {
	if (activeProjectiles.size === 0) return;

	for (const [id, state] of activeProjectiles) {
		const owner = state.owner;
		if (!isValidEntity(owner)) {
			removeProjectile(state.projectile);
			activeProjectiles.delete(id);
			continue;
		}

		state.age++;
		if (state.age > PROJECTILE_MAX_TICKS) {
			removeProjectile(state.projectile);
			activeProjectiles.delete(id);
			continue;
		}

		if (moveProjectile(state)) {
			activeProjectiles.delete(id);
		}
	}
}

function moveProjectile(state) {
	for (let step = 0; step < PROJECTILE_STEPS; step++) {
		const next = {
			x: state.location.x + state.velocity.x / PROJECTILE_STEPS,
			y: state.location.y + state.velocity.y / PROJECTILE_STEPS,
			z: state.location.z + state.velocity.z / PROJECTILE_STEPS
		};

		moveEntity(state.projectile, next);

		const target = getHitTarget(state.owner, state.projectile, next);
		if (target) {
			hitTarget(state.owner, state.projectile, target, state.spell, next);
			removeProjectile(state.projectile);
			return true;
		}

		if (isBlockOrWater(state.owner.dimension, next)) {
			removeProjectile(state.projectile);
			return true;
		}

		state.location = next;
	}

	return false;
}

function hitTarget(owner, projectile, directTarget, spell, location) {
	let damagedMobCount = 0;
	let stolenHealth = 0;
	const impactCenter = directTarget.location ?? location;
	const targets = getAreaTargets(owner, projectile, impactCenter);

	// Always include the mob that caused the collision, even if a query edge
	// case omits it from the area result.
	if (!targets.some(target => target.id === directTarget.id)) targets.push(directTarget);

	for (const target of targets) {
		const healthBefore = getCurrentHealth(target);
		if (damageTarget(target, spell.damage, owner, projectile)) {
			damagedMobCount++;
			if (spell.lifeSteal) {
				const healthAfter = getCurrentHealth(target);
				stolenHealth += Math.max(0, Math.min(spell.damage, healthBefore - healthAfter));
			}
		}
	}

	if (damagedMobCount === 0) return;
	if (spell.lifeSteal && stolenHealth > 0) healEntity(owner, stolenHealth);

	spawnParticle(owner.dimension, spell.particle, location);
	playImpactFeedback(owner, location);
}

function getHitTarget(owner, projectile, location) {
	try {
		return owner.dimension.getEntities({
			location,
			maxDistance: PROJECTILE_HIT_RADIUS
		}).find(entity => isValidTarget(owner, projectile, entity));
	} catch {
		return undefined;
	}
}

function getAreaTargets(owner, projectile, location) {
	try {
		return owner.dimension.getEntities({ location, maxDistance: AREA_DAMAGE_RADIUS })
			.filter(entity => isValidTarget(owner, projectile, entity));
	} catch {
		return [];
	}
}

function isValidTarget(owner, projectile, entity) {
	try {
		if (!isValidEntity(entity)) return false;
		if (entity.id === owner.id) return false;
		if (entity.id === projectile?.id) return false;
		if (!entity.hasComponent("minecraft:health")) return false;
		if (entity.typeId === "minecraft:item" || entity.typeId === "minecraft:xp_orb") return false;
		if (entity instanceof Player && !entity.matches({ gameMode: GameMode.survival })) return false;
		return true;
	} catch {
		return false;
	}
}

function tryPaySpellCost(player, costXp, spell) {
	const availableXp = getXpLevels(player);
	const xpUsed = Math.min(availableXp, costXp);
	const missingXp = costXp - xpUsed;
	if (missingXp > 0 && !isOvercastEnabled(player)) {
		player.sendMessage(`§c${spell.name} needs ${costXp} levels, but you only have ${availableXp}. Enable Overcast in the book to use health for the shortage.`);
		return false;
	}
	const canSurviveOvercast = missingXp === 0 || getCurrentHealth(player) > 2;

	if (xpUsed > 0 && !removeXpLevels(player, xpUsed)) return false;
	if (missingXp > 0) {
		applySpellBacklash(player, spell, missingXp, canSurviveOvercast);
	} else {
		player.sendMessage(`§d${spell.name} consumed ${xpUsed} XP levels. §7Remaining levels: ${getXpLevels(player)}.`);
	}
	return canSurviveOvercast;
}

function createCastSpell(player, template, castXp) {
	const health = getCurrentHealth(player);
	const maxHealth = getMaxHealth(player);
	const multiplier = getLowHealthMultiplier(health, maxHealth);
	const rawDamage = template.baseDamage + template.damagePerXp * castXp;

	return {
		...template,
		castXp,
		damage: Math.max(1, Math.round(rawDamage * multiplier)),
		multiplier
	};
}

function getXpLevels(player) {
	try { return Math.max(0, Math.floor(player.level ?? 0)); } catch { return 0; }
}

function removeXpLevels(player, amount) {
	const before = getXpLevels(player);
	const remaining = Math.max(0, before - amount);

	try {
		player.addLevels(-amount);
		if (getXpLevels(player) === remaining) return true;
	} catch {}

	try {
		player.resetLevel();
		if (remaining > 0) player.addLevels(remaining);
		return getXpLevels(player) === remaining;
	} catch {}

	player.sendMessage("§cThe spell could not consume your XP levels, so the cast was cancelled.");
	return false;
}

function applySpellBacklash(player, spell, missingXp, spellWillCast) {
	const effect = BACKLASH_EFFECTS[Math.floor(Math.random() * BACKLASH_EFFECTS.length)];
	const durationSeconds = Math.max(1, missingXp);
	const penaltyDamage = missingXp * 2;
	setHealthLeavingOneHeart(player, penaltyDamage);
	try { player.addEffect(effect, durationSeconds * 20, { amplifier: 0, showParticles: true }); } catch {}
	player.sendMessage(
		spellWillCast
			? `§4${spell.name} XP-level penalty! §c${missingXp} unpaid levels dealt ${penaltyDamage} penalty damage (capped at 1 heart). §7${effect.replace("_", " ")} level 0 for ${durationSeconds} seconds. The spell still casts at full power.`
			: `§4${spell.name} completely backfired! §cYou were already at one heart. No spell was launched and no mob was damaged. §7${effect.replace("_", " ")} level 0 for ${durationSeconds} seconds.`
	);
	try { player.playSound("mob.wither.hurt", { volume: 1, pitch: 0.65 }); } catch {}
}

function setHealthLeavingOneHeart(player, damage) {
	try {
		const health = getHealthComponent(player);
		if (!health) return;
		const before = getCurrentHealth(player);
		const next = Math.max(2, before - damage);
		if (typeof health.setCurrentValue === "function") {
			health.setCurrentValue(next);
		} else {
			try { player.applyDamage(Math.max(0, before - next)); } catch {}
		}

		// Damage resistance or armor must never bypass the essence penalty.
		const after = getCurrentHealth(player);
		if (after > next && typeof health.setCurrentValue === "function") health.setCurrentValue(next);
	} catch {}
}

function getLowHealthMultiplier(health, maxHealth) {
	if (maxHealth <= 0) return 1;
	return 1 + Math.max(0, Math.min(1, (maxHealth - health) / maxHealth));
}

function damageTarget(target, amount, owner, projectile) {
	try {
		return target.applyDamage(amount, {
			cause: DAMAGE_CAUSE,
			damagingEntity: owner,
			damagingProjectile: projectile
		});
	} catch {
		try {
			return target.applyDamage(amount, { cause: DAMAGE_CAUSE });
		} catch {
			try {
				return target.applyDamage(amount);
			} catch {
				return false;
			}
		}
	}
}

function healEntity(entity, amount) {
	try {
		const health = getHealthComponent(entity);
		if (!health) return;

		const current = health.currentValue ?? health.value;
		const max = health.effectiveMax ?? health.defaultValue ?? current;
		const next = Math.min(max, current + amount);

		if (typeof health.setCurrentValue === "function") {
			health.setCurrentValue(next);
		} else {
			health.currentValue = next;
		}
	} catch {}
}

function getHealthComponent(entity) {
	try {
		return entity.getComponent("minecraft:health");
	} catch {
		return undefined;
	}
}

function getSelectedSpell(player) {
	return SPELLS.find(spell => spell.id === getSelectedSpellId(player)) ?? SPELLS[0];
}

function getSelectedSpellId(player) {
	try {
		const tag = player.getTags().find(value => value.startsWith(SPELL_TAG_PREFIX));
		const id = tag?.substring(SPELL_TAG_PREFIX.length);
		return SPELLS.some(spell => spell.id === id) ? id : SPELL_CHAOS_BLAST;
	} catch {
		return SPELL_CHAOS_BLAST;
	}
}

function setSelectedSpell(player, spellId) {
	const spell = SPELLS.find(value => value.id === spellId) ?? SPELLS[0];

	try {
		for (const tag of player.getTags()) {
			if (tag.startsWith(SPELL_TAG_PREFIX)) player.removeTag(tag);
		}

		player.addTag(`${SPELL_TAG_PREFIX}${spell.id}`);
	} catch {}

	return spell;
}

async function showSpellBook(player) {
	setBookMenuOpen(player, true);
	const activeSpell = getSelectedSpell(player);
	const castXp = getCastStrength(player);
	const preview = getSpellPreview(player, activeSpell, castXp);
	const overcast = isOvercastEnabled(player);
	const form = new ActionFormData()
		.title("§5Liber Chaotica")
		.body([
			`§fActive: §b${activeSpell.name}`,
			`§fCost: §d${castXp} levels §7(available: ${getXpLevels(player)})`,
			`§fDamage: §6${preview.damage}`,
			activeSpell.lifeSteal ? `§fLife stolen per mob: §a${preview.healHearts} hearts` : "",
			`§fOvercast: ${overcast ? "§aON" : "§cOFF"}`
		].filter(Boolean).join("\n"));

	for (const spell of SPELLS) {
		const marker = spell.id === activeSpell.id ? "§aACTIVE§r\n" : "";
		form.button(`${marker}${spell.name}\n§8Configure XP levels`);
	}
	form.button("§eDirections\n§8Spell rules and numbers");
	form.button("§5Lore\n§8Origin of Liber Chaotica");
	form.button(`${overcast ? "§a" : "§c"}Overcast: ${overcast ? "ON" : "OFF"}\n§8Use hearts for missing levels`);
	form.button("§cExit\n§8Close Liber Chaotica");

	try {
		const result = await form.show(player);
		if (result.canceled || result.selection === undefined) return;
		if (result.selection < SPELLS.length) {
			const spell = SPELLS[result.selection];
			if (spell) {
				await showStrengthForm(player, spell);
				return await showSpellBook(player);
			}
			return;
		}
		if (result.selection === SPELLS.length) return await showDirections(player);
		if (result.selection === SPELLS.length + 1) return await showLore(player);
		if (result.selection === SPELLS.length + 2) {
			setOvercastEnabled(player, !overcast);
			return await showSpellBook(player);
		}
		if (result.selection === SPELLS.length + 3) return;
	} catch {} finally {
		setBookMenuOpen(player, false);
	}
}

async function showDirections(player) {
	const form = new ActionFormData()
		.title("§eLiber Chaotica: Directions")
		.body(getBookExplanation(player, getSelectedSpell(player), getCastStrength(player)))
		.button("Back");
	try {
		const result = await form.show(player);
		if (!result.canceled) await showSpellBook(player);
	} catch {}
}

async function showLore(player) {
	const form = new ActionFormData()
		.title("§5The Whim of Chaos")
		.body([
			"§7Liber Chaotica was not written to preserve wisdom. It was made because the Chaos God wondered what would happen if knowledge itself could hunger.",
			"",
			"§5The god has no grand design. It changes flesh, bends essence, and creates life simply to witness the result. Mortals call the failures monsters; Chaos calls them observations.",
			"",
			"§cBlood mobs were experiments in teaching spilled life to stand and hunt. Demons followed when Chaos asked whether rage could be given bone, claw, and memory. New creatures are still made whenever another impossible question amuses their creator.",
			"",
			"§dThis book is both record and instrument. Every spell cast through it becomes another experiment. Every success, failure, sacrifice, and overcast teaches the Chaos God something new—for no reason beyond the desire to know what happens next."
		].join("\n"))
		.button("Back");
	try {
		const result = await form.show(player);
		if (!result.canceled) await showSpellBook(player);
	} catch {}
}

async function showStrengthForm(player, spell) {
	const currentXp = getCastStrength(player);
	const form = new ModalFormData()
		.title(`§5${spell.name}`)
		.slider(getSpellExplanation(player, spell, currentXp), MIN_CAST_XP, MAX_CAST_XP, {
			valueStep: 1,
			defaultValue: currentXp
		})
		.submitButton("Bind Spell");

	try {
		const result = await form.show(player);
		if (result.canceled || !result.formValues) return;
		const castXp = clampCastXp(Number(result.formValues[0]));
		setSelectedSpell(player, spell.id);
		setCastStrength(player, castXp);
		const preview = getSpellPreview(player, spell, castXp);
		player.sendMessage(`§aBound ${spell.name}: §d${castXp} XP levels §7| §6${preview.damage} damage${preview.healHearts > 0 ? ` §7| §a${preview.healHearts} hearts healed on hit` : ""}`);
	} catch {}
}

function getBookExplanation(player, activeSpell, castXp) {
	const preview = getSpellPreview(player, activeSpell, castXp);
	return [
		"§7Choose a spell and how many whole XP levels each cast consumes.",
		"§dEvery selected XP level adds 5 spell damage.",
		"§aLife Steal is one-to-one: every heart removed from each damaged mob heals one heart to the caster.",
		"§cWith Overcast ON, each unpaid level deals 2 self-damage.",
		"§4Penalty damage can reduce you to 1 heart but never kills you. A random level-0 effect lasts 1 second per unpaid level.",
		"§4If you are already at 1 heart, Overcast completely backfires: the bad effect is applied, but no projectile launches and no mob is damaged.",
		"§cWith Overcast OFF, insufficient levels cancel without taking XP or health.",
		"§cAn enabled Overcast still casts at full power, and costs apply even on misses.",
		"§aLife Steal heals only when at least one mob is damaged.",
		"§6Damage rises from 1.00x at full health to almost 2.00x near death.",
		"",
		`§fActive: §b${activeSpell.name}`,
		`§fXP levels per cast: §d${castXp} §7(you have ${getXpLevels(player)})`,
		`§fDamage after cost: §6${preview.damage} §7(${preview.multiplier.toFixed(2)}x)`,
		preview.healHearts > 0 ? `§fHealing on hit: §d${preview.healHearts} hearts` : "§fHealing: §7none",
		"",
		"§bChaos Blast: §f2 base damage + 5 per XP level.",
		"§dLife Steal: §f1 base damage + 5 per XP level; heals exactly the damage successfully dealt."
	].join("\n");
}

function getSpellExplanation(player, spell, castXp) {
	const preview = getSpellPreview(player, spell, castXp);
	return [
		`XP levels per cast (currently ${castXp}; available ${getXpLevels(player)})`,
		`Preview: ${preview.damage} damage at ${preview.multiplier.toFixed(2)}x low-health power.`,
		preview.healHearts > 0 ? `Life stolen: ${preview.healHearts} hearts from each successfully damaged mob.` : "Chaos Blast does not heal.",
		`Overcast is ${isOvercastEnabled(player) ? "ON: shortages use health and cast unless you already have only 1 heart" : "OFF: shortages cancel the cast"}. Each unpaid level deals 2 self-damage and adds 1 second of a random level-0 effect. At 1 heart, it backfires without hitting mobs.`
	].join("\n");
}

function getSpellPreview(player, spell, castXp) {
	const maxHealth = getMaxHealth(player);
	const missingXp = Math.max(0, castXp - getXpLevels(player));
	const healthAfterCost = isOvercastEnabled(player)
		? Math.max(2, getCurrentHealth(player) - missingXp * 2)
		: getCurrentHealth(player);
	const multiplier = getLowHealthMultiplier(healthAfterCost, maxHealth);
	return {
		damage: Math.max(1, Math.round((spell.baseDamage + spell.damagePerXp * castXp) * multiplier)),
		healHearts: spell.lifeSteal ? Math.round(Math.max(1, (spell.baseDamage + spell.damagePerXp * castXp) * multiplier) * 10) / 20 : 0,
		multiplier
	};
}

function getCastStrength(player) {
	try {
		const tag = player.getTags().find(value => value.startsWith(STRENGTH_TAG_PREFIX));
		return clampCastXp(Number(tag?.substring(STRENGTH_TAG_PREFIX.length)));
	} catch { return MIN_CAST_XP; }
}

function setCastStrength(player, castXp) {
	try {
		for (const tag of player.getTags()) if (tag.startsWith(STRENGTH_TAG_PREFIX)) player.removeTag(tag);
		player.addTag(`${STRENGTH_TAG_PREFIX}${clampCastXp(castXp)}`);
	} catch {}
}

function isOvercastEnabled(player) {
	try { return player.hasTag(OVERCAST_TAG); } catch { return false; }
}

function setOvercastEnabled(player, enabled) {
	try {
		if (enabled) player.addTag(OVERCAST_TAG);
		else player.removeTag(OVERCAST_TAG);
	} catch {}
}

function setBookMenuOpen(player, open) {
	try {
		const equippable = player.getComponent("minecraft:equippable");
		const held = equippable?.getEquipment(EquipmentSlot.Mainhand);
		if (open && held?.typeId === CHAOS_BOOK) {
			equippable.setEquipment(EquipmentSlot.Mainhand, new ItemStack(CHAOS_BOOK_OPEN, held.amount));
			player.addTag(BOOK_MENU_OPEN_TAG);
		} else if (!open) {
			if (held?.typeId === CHAOS_BOOK_OPEN) {
				equippable.setEquipment(EquipmentSlot.Mainhand, new ItemStack(CHAOS_BOOK, held.amount));
			}
			player.removeTag(BOOK_MENU_OPEN_TAG);
		}
	} catch {}
}

function clampCastXp(value) {
	if (!Number.isFinite(value)) return MIN_CAST_XP;
	return Math.max(MIN_CAST_XP, Math.min(MAX_CAST_XP, Math.round(value)));
}

function getCurrentHealth(entity) {
	const health = getHealthComponent(entity);
	const current = health?.currentValue ?? health?.value;
	return typeof current === "number" ? current : 20;
}

function getMaxHealth(entity) {
	const health = getHealthComponent(entity);
	const max = health?.effectiveMax ?? health?.defaultValue ?? health?.maxValue;
	return typeof max === "number" ? max : 20;
}

function spawnParticle(dimension, particle, location) {
	runCommand(dimension, `particle ${particle} ${location.x} ${location.y} ${location.z}`);
}

function isBlockOrWater(dimension, location) {
	try {
		const block = dimension.getBlock({
			x: Math.floor(location.x),
			y: Math.floor(location.y),
			z: Math.floor(location.z)
		});

		return !!block && block.typeId !== "minecraft:air";
	} catch {
		return false;
	}
}

function moveEntity(entity, location) {
	try { entity.teleport(location); } catch {}
}

function removeProjectile(entity) {
	try { entity.remove(); } catch {
		try { entity.kill(); } catch {}
	}
}

function startCooldown(player) {
	try {
		player.startItemCooldown("chaos_staff_spell", STAFF_COOLDOWN_TICKS);
	} catch {}
}

function playCastFeedback(player, spell) {
	try {
		player.playSound("random.bow", {
			volume: 0.8,
			pitch: spell.id === SPELL_LIFE_STEAL ? 1.25 : 0.8
		});
	} catch {}
}

function playImpactFeedback(owner, location) {
	try {
		owner.dimension.playSound("random.explode", location, {
			volume: 0.45,
			pitch: 1.25
		});
	} catch {}
}

function runCommand(dimension, command) {
	try {
		dimension.runCommandAsync(command).catch(() => {});
	} catch {
		try { dimension.runCommand(command); } catch {}
	}
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
