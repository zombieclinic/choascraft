import { world, system, EntityComponentTypes } from "@minecraft/server";

const DYING_TAG = "zc:death_animation";
const ZOMBIE_TYPES = new Set([
	"zombie:walker",
	"zombie:runner",
	"zombie:scavenger",
	"zombie:spitter",
	"zombie:impaler",
	"zombie:crusher"
]);

function isValid(entity) {
	if (!entity) return false;
	if (typeof entity.isValid === "function") return entity.isValid();
	return entity.isValid !== false;
}

function getHealthValue(entity) {
	const health =
		entity.getComponent(EntityComponentTypes.Health) ??
		entity.getComponent("minecraft:health");
	return health?.currentValue ?? health?.value ?? 0;
}

function startDeathAnimation(entity) {
	if (!isValid(entity) || entity.hasTag(DYING_TAG)) return;
	entity.addTag(DYING_TAG);
	try { entity.triggerEvent("death"); } catch {}
}

world.beforeEvents.entityHurt?.subscribe((event) => {
	const entity = event.hurtEntity;
	if (!entity || !ZOMBIE_TYPES.has(entity.typeId) || entity.hasTag(DYING_TAG)) return;

	const damage = event.damage ?? event.damageAmount ?? 0;
	if (damage < getHealthValue(entity)) return;

	event.cancel = true;
	system.run(() => startDeathAnimation(entity));
});
