/** Cross-scene UI session flags (Title → Game). */
let newCharacter = false;

/** Title calls this when starting a brand-new character, so the HUD auto-shows the help once. */
export function markNewCharacter() { newCharacter = true; }

export function consumeNewCharacter(): boolean { const v = newCharacter; newCharacter = false; return v; }
