import { system } from "@minecraft/server";

const POWERED_STATE = "zombie:powered";
const PRESS_DURATION_TICKS = 30;
const activePresses = new Map();

export class ZcButtonComponent {
    onPlayerInteract(event) {
        const block = event.block;

        const powered = block.permutation.getState(POWERED_STATE);
        if (powered) return;

        block.setPermutation(
            block.permutation.withState(POWERED_STATE, true)
        );

        const { dimension, location } = block;
        const key = getBlockKey(block);
        const releaseTick = system.currentTick + PRESS_DURATION_TICKS;

        activePresses.set(key, releaseTick);

        system.runTimeout(() => {
            if (activePresses.get(key) !== releaseTick) return;

            activePresses.delete(key);

            let currentBlock;
            try {
                currentBlock = dimension.getBlock(location);
            } catch {
                return;
            }

            releaseButton(currentBlock);
        }, PRESS_DURATION_TICKS);
    }
}

export class ZcButtonReleaseTickComponent {
    onTick(event) {
        const block = event.block;
        if (!block) return;

        const key = getBlockKey(block);
        const releaseTick = activePresses.get(key);

        if (releaseTick !== undefined && system.currentTick < releaseTick) return;

        activePresses.delete(key);
        releaseButton(block);
    }
}

function getBlockKey(block) {
    const { x, y, z } = block.location;

    return `${block.dimension.id}:${x}:${y}:${z}`;
}

function releaseButton(block) {
    try {
        if (!block?.permutation.getState(POWERED_STATE)) return;

        block.setPermutation(
            block.permutation.withState(POWERED_STATE, false)
        );
    } catch {
    }
}
