import { BlockPermutation, system } from "@minecraft/server";

const PENGIUN_EGG_BLOCK = "zombie:pengiun_egg_block";
const PENGIUN_ENTITY = "zombie:king_penguin";
const BABY_SPAWN_EVENT = "minecraft:entity_born";
const AIR_BLOCK = "minecraft:air";
const TICKS_PER_SECOND = 20;
const MIN_HATCH_TICKS = 0.5 * 60 * TICKS_PER_SECOND;
const MAX_HATCH_TICKS = 1 * 60 * TICKS_PER_SECOND;

const eggHatchTicks = new Map();

export class EggHatchTickingComponent {
    onTick(event) {
        const { block } = event;


        const key = getBlockKey(block);
        let hatchTick = eggHatchTicks.get(key);

        if (hatchTick === undefined) {
            hatchTick = system.currentTick + randomInt(MIN_HATCH_TICKS, MAX_HATCH_TICKS);
            eggHatchTicks.set(key, hatchTick);
            return;
        }

        if (system.currentTick < hatchTick) return;

        hatchEgg(block, key);
    }

    onBreak(event) {
        forgetEgg(event.block);
    }

    onPlayerBreak(event) {
        forgetEgg(event.block);
    }
}

function hatchEgg(block, key) {
    const hatchLocation = {
        x: block.location.x + 0.5,
        y: block.location.y,
        z: block.location.z + 0.5
    };

    eggHatchTicks.delete(key);
    const pengiun = block.dimension.spawnEntity(PENGIUN_ENTITY, hatchLocation);

    pengiun.triggerEvent(BABY_SPAWN_EVENT);
    block.setPermutation(BlockPermutation.resolve(AIR_BLOCK));
}

function forgetEgg(block) {
    if (!block) return;

    eggHatchTicks.delete(getBlockKey(block));
}

function getBlockKey(block) {
    const { x, y, z } = block.location;

    return `${block.dimension.id}:${x}:${y}:${z}`;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
