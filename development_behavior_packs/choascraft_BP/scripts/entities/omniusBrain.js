import { world, system, EntityDamageCause } from "@minecraft/server";

const OMNIUS = "zombie:omnius";
const PROJECTILE = "zombie:omnius_projectile";
const RASER = "zombie:omnius_raser";
const DIMENSIONS = ["overworld", "nether", "the_end"];
const TPS = 20;
const ATTACK_RANGE = 4;
const TARGET_RANGE = 32;
const RAY_RANGE = 24;
const RAY_RADIUS = 1.7;

const attacks = new Map();

function isValid(entity) {
	if (!entity) return false;
	if (typeof entity.isValid === "function") return entity.isValid();
	return entity.isValid !== false;
}

function distance(a, b) {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	const dz = a.z - b.z;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function distanceSquared(a, b) {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	const dz = a.z - b.z;
	return dx * dx + dy * dy + dz * dz;
}

function direction(from, to) {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const dz = to.z - from.z;
	const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
	return { x: dx / len, y: dy / len, z: dz / len };
}

function add(a, b, scale = 1) {
	return { x: a.x + b.x * scale, y: a.y + b.y * scale, z: a.z + b.z * scale };
}

function tryEffect(entity, effect, duration, amplifier, showParticles = false) {
	if (!isValid(entity)) return;
	try { entity.addEffect(effect, duration, { amplifier, showParticles }); } catch {}
}

function safeDamage(target, amount, source) {
	if (!isValid(target)) return;
	try {
		target.applyDamage(amount, { cause: EntityDamageCause.magic, damagingEntity: source });
	} catch {
		try { target.applyDamage(amount); } catch {}
	}
}

function trigger(entity, event) {
	if (!isValid(entity)) return;
	try { entity.triggerEvent(event); } catch {}
}

function nearestPlayer(entity, maxDistance) {
	let best;
	let bestDistance = maxDistance;
	for (const player of entity.dimension.getPlayers()) {
		const d = distance(entity.location, player.location);
		if (d <= bestDistance) {
			best = player;
			bestDistance = d;
		}
	}
	return best ? { player: best, distance: bestDistance } : undefined;
}

function faceTarget(entity, target) {
	if (!isValid(entity) || !isValid(target)) return;
	try {
		entity.teleport(entity.location, {
			dimension: entity.dimension,
			facingLocation: { x: target.location.x, y: target.location.y + 1, z: target.location.z }
		});
	} catch {}
}

function spawnRaser(entity) {
	if (!isValid(entity)) return;
	spawnRaserAt(entity.dimension, entity.location);
}

function spawnRaserAt(dimension, location) {
	try {
		dimension.spawnEntity(RASER, location);
	} catch {}
}

function resetWhenReady(entity, ticks) {
	system.runTimeout(() => trigger(entity, "zc:omnius_ready"), ticks);
}

function fireProjectile(entity, target) {
	if (!isValid(entity) || !isValid(target)) return;
	const origin = { x: entity.location.x, y: entity.location.y + 2.1, z: entity.location.z };
	const aim = { x: target.location.x, y: target.location.y + 1.1, z: target.location.z };
	const dir = direction(origin, aim);
	try {
		const projectile = entity.dimension.spawnEntity(PROJECTILE, add(origin, dir, 1.4));
		if (projectile?.applyImpulse) projectile.applyImpulse({ x: dir.x * 2.1, y: dir.y * 2.1, z: dir.z * 2.1 });
	} catch {}
}

function blockedByTerrain(dimension, origin, dir, distanceToPlayer) {
	try {
		const hit = dimension.getBlockFromRay(origin, dir, {
			maxDistance: Math.max(0, distanceToPlayer - 0.6),
			includeLiquidBlocks: false,
			includePassableBlocks: false
		});
		return !!hit;
	} catch {
		return false;
	}
}

function rayPulse(entity, origin, dir) {
	if (!isValid(entity)) return;
	for (const player of entity.dimension.getPlayers()) {
		if (distance(entity.location, player.location) > TARGET_RANGE) continue;
		const rel = {
			x: player.location.x - origin.x,
			y: player.location.y + 1 - origin.y,
			z: player.location.z - origin.z
		};
		const forward = rel.x * dir.x + rel.y * dir.y + rel.z * dir.z;
		if (forward < 0 || forward > RAY_RANGE) continue;
		const closest = add(origin, dir, forward);
		const playerPoint = { x: player.location.x, y: player.location.y + 1, z: player.location.z };
		if (distanceSquared(closest, playerPoint) > RAY_RADIUS * RAY_RADIUS) continue;
		if (blockedByTerrain(entity.dimension, origin, dir, forward)) continue;
		safeDamage(player, 5, entity);
	}
}

function startGrab(entity, target) {
	faceTarget(entity, target);
	trigger(entity, "zc:omnius_grab_try");
	tryEffect(entity, "slowness", 50, 255);
	system.runTimeout(() => {
		if (!isValid(entity) || !isValid(target)) return;
		faceTarget(entity, target);
		if (distance(entity.location, target.location) > ATTACK_RANGE + 0.65) return;
		trigger(entity, "zc:omnius_grab");
		tryEffect(entity, "slowness", 70, 255);
		const holdDir = direction(
			{ x: entity.location.x, y: target.location.y, z: entity.location.z },
			{ x: target.location.x, y: target.location.y, z: target.location.z }
		);
		const holdTicks = 48;
		const holdStart = system.currentTick;
		const hold = system.runInterval(() => {
			if (!isValid(entity) || !isValid(target) || system.currentTick - holdStart > holdTicks) {
				try { system.clearRun(hold); } catch {}
				return;
			}
			const holdPoint = add(entity.location, holdDir, 2.05);
			holdPoint.y = entity.location.y + 0.05;
			tryEffect(target, "slowness", 8, 255);
			tryEffect(target, "weakness", 8, 2);
			try {
				target.teleport(holdPoint, {
					dimension: entity.dimension,
					facingLocation: { x: entity.location.x, y: entity.location.y + 1.6, z: entity.location.z },
					checkForBlocks: false
				});
			} catch {}
		}, 1);
		for (const tick of [12, 28, 44]) system.runTimeout(() => {
			if (!isValid(entity) || !isValid(target)) return;
			if (distance(entity.location, target.location) <= ATTACK_RANGE + 1.5) safeDamage(target, 7, entity);
		}, tick);
	}, 22);
	resetWhenReady(entity, 88);
}

function startRay(entity, target) {
	faceTarget(entity, target);
	trigger(entity, "zc:omnius_ray");
	tryEffect(entity, "slowness", 90, 255);
	const origin = { x: entity.location.x, y: entity.location.y + 1.8, z: entity.location.z };
	const targetPoint = { x: target.location.x, y: target.location.y + 1, z: target.location.z };
	const dir = direction(origin, targetPoint);
	for (const tick of [42, 48, 54, 60, 66, 72, 78]) {
		system.runTimeout(() => rayPulse(entity, origin, dir), tick);
	}
	resetWhenReady(entity, 105);
}

function startProjectile(entity, target) {
	faceTarget(entity, target);
	trigger(entity, "zc:omnius_shoot");
	tryEffect(entity, "slowness", 75, 255);
	system.runTimeout(() => fireProjectile(entity, target), 72);
	resetWhenReady(entity, 110);
}

function startBookEat(entity, target) {
	faceTarget(entity, target);
	trigger(entity, "zc:omnius_book_eat");
	tryEffect(entity, "slowness", 70, 255);
	system.runTimeout(() => {
		if (!isValid(entity)) return;
		for (const player of entity.dimension.getPlayers()) {
			if (distance(entity.location, player.location) > 8) continue;
			safeDamage(player, 10, entity);
			tryEffect(player, "weakness", 5 * TPS, 1, true);
		}
	}, 50);
	resetWhenReady(entity, 95);
}

function chooseAttack(entity, target, dist) {
	const now = system.currentTick;
	const next = attacks.get(entity.id) ?? 0;
	if (now < next) return;

	if (dist <= ATTACK_RANGE) {
		attacks.set(entity.id, now + 90);
		startGrab(entity, target);
		return;
	}

	const roll = Math.random();
	if (dist <= RAY_RANGE && roll < 0.55) {
		attacks.set(entity.id, now + 115);
		startRay(entity, target);
	} else if (dist <= 12 && roll < 0.75) {
		attacks.set(entity.id, now + 100);
		startBookEat(entity, target);
	} else {
		attacks.set(entity.id, now + 115);
		startProjectile(entity, target);
	}
}

function tickOmnius(entity) {
	if (!isValid(entity)) return;
	if (!entity.hasTag("zc:omnius_spawned")) {
		entity.addTag("zc:omnius_spawned");
		spawnRaser(entity);
		attacks.set(entity.id, system.currentTick + 90);
	}

	const target = nearestPlayer(entity, TARGET_RANGE);
	if (!target) return;
	chooseAttack(entity, target.player, target.distance);
}

system.runInterval(() => {
	for (const id of DIMENSIONS) {
		let dimension;
		try { dimension = world.getDimension(id); } catch { continue; }
		for (const entity of dimension.getEntities({ type: OMNIUS })) tickOmnius(entity);
	}
}, 10);

world.afterEvents.entityDie.subscribe((event) => {
	const entity = event.deadEntity;
	if (entity?.typeId !== OMNIUS) return;
	trigger(entity, "zc:omnius_death");
	spawnRaserAt(entity.dimension, entity.location);
	attacks.delete(entity.id);
});
