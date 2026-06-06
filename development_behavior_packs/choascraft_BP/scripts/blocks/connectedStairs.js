import { Block } from "@minecraft/server";

// Shark's Staircase Script 1.1
// Connects custom stairs to custom stairs AND vanilla Minecraft stairs

const NAMESPACE = "custom";
const CONNECTED_STAIR_TAG = `${NAMESPACE}:connected_stairs`;

class DirectionHelper {
    static OPPOSITE_DIRECTIONS = {
        north: "south",
        east: "west",
        south: "north",
        west: "east",
    };

    static getOppositeDirection(direction) {
        return this.OPPOSITE_DIRECTIONS[direction];
    }
}

class CustomBlock {
    /**
     * @param {Block} block
     */
    constructor(block) {
        this.block = block;
    }

    getNearbyBlocks() {
        return {
            north: this.block.north(),
            east: this.block.east(),
            south: this.block.south(),
            west: this.block.west(),
        };
    }

    updateState(direction, stateValue) {
        try {
            const stateName = `${NAMESPACE}:${direction}`;

            if (this.block.permutation.getState(stateName) === stateValue) return;

            this.block.setPermutation(
                this.block.permutation.withState(stateName, stateValue)
            );
        } catch {}
    }
}

class ConnectedBlockManager {
    /**
     * @param {Block} block
     * @param {string} checkType
     */
    constructor(block, checkType = "break") {
        this.customBlock = new CustomBlock(block);
        this.stateValue = checkType === "placed";
    }

    updateBlock() {
        const nearbyBlocks = this.customBlock.getNearbyBlocks();

        for (const direction in nearbyBlocks) {
            const nearbyBlock = nearbyBlocks[direction];

            if (!isStairBlock(nearbyBlock)) continue;

            // Update the current custom stair
            if (this.stateValue) {
                this.customBlock.updateState(direction, true);
            }

            // Only update nearby block if it is one of YOUR custom stairs
            if (isCustomConnectedStair(nearbyBlock)) {
                const nearbyCustomBlock = new CustomBlock(nearbyBlock);

                nearbyCustomBlock.updateState(
                    DirectionHelper.getOppositeDirection(direction),
                    this.stateValue
                );
            }
        }
    }
}

export class ConnectedStairsComponent {
    onPlace({ block }) {
        try {
            block.setPermutation(
                block.permutation.withState(`${NAMESPACE}:placed`, true)
            );
        } catch {}

        const manager = new ConnectedBlockManager(block, "placed");
        manager.updateBlock();
    }

    onPlayerBreak({ block }) {
        const manager = new ConnectedBlockManager(block, "break");
        manager.updateBlock();
    }

    onBreak({ block }) {
        const manager = new ConnectedBlockManager(block, "break");
        manager.updateBlock();
    }
}

function isCustomConnectedStair(block) {
    try {
        return !!block?.hasTag(CONNECTED_STAIR_TAG);
    } catch {
        return false;
    }
}

function isVanillaStair(block) {
    try {
        return block?.typeId?.startsWith("minecraft:") &&
            block.typeId.endsWith("_stairs");
    } catch {
        return false;
    }
}

function isStairBlock(block) {
    return isCustomConnectedStair(block) || isVanillaStair(block);
}