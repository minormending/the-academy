/** Cross-scene UI session flags (Title → Game). */
let newCharacter = false;

/** Title calls this when starting a brand-new character, so the HUD auto-shows the help once. */
export function markNewCharacter() { newCharacter = true; }

export function consumeNewCharacter(): boolean { const v = newCharacter; newCharacter = false; return v; }

/** Set when the title hands off to the game, so coming back (Quit to Title) opens Character Select. */
let returnToSelect = false;

export function markReturnToSelect() { returnToSelect = true; }

export function consumeReturnToSelect(): boolean { const v = returnToSelect; returnToSelect = false; return v; }
