import { system } from "@minecraft/server";

const OPEN_STATE = "zombie:open";
const MIMIC_OPEN_SOUND = "zombie.mimic.open";
const DESTROY_DELAY_TICKS = 4;

export class ChaosChestComponent {
  onPlayerInteract(event) {
    const block = event.block;
    if (!block) return;

    block.setPermutation(block.permutation.withState(OPEN_STATE, 1));
    playMimicOpenSound(block);
    destroyForLoot(block);
  }
}

function playMimicOpenSound(block) {
  try {
    block.dimension.playSound(MIMIC_OPEN_SOUND, block.center());
  } catch {}
}

function destroyForLoot(block) {
  const dimension = block.dimension;
  const { x, y, z } = block.location;

  system.runTimeout(() => {
    try {
      dimension.runCommandAsync(`setblock ${x} ${y} ${z} air destroy`).catch(() => {});
    } catch {}
  }, DESTROY_DELAY_TICKS);
}
