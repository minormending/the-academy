// Key hints in player-facing text follow the player's live bindings (core/bindings.ts), never hard-coded letters.
// Write `{key:action}` in any dialog / quest / log string (action = a bindings ActionId such as `skills`, `slot0`,
// `pickup`, `interact`, `hotbarPage`); UI choke points (dialog window, chat log, banners, quest log) call
// `keyText()` at display time, so module-load constants stay valid after a rebind.
import { ACTIONS, getBinding, keyLabel, type ActionId } from '../core/bindings';

const ACTION_IDS = new Set<string>(ACTIONS.map(a => a.id));

/** Current key name for an action ("K", "Space", "↑"); "(unbound)" when the player cleared it. */
export function keyName(action: ActionId): string {
  const code = getBinding(action);
  return code ? keyLabel(code) : '(unbound)';
}

/** Replace every `{key:action}` token with the action's current key name. Unknown actions are left as written. */
export function keyText(text: string): string {
  if (!text || !text.includes('{key:')) return text;
  return text.replace(/\{key:([A-Za-z0-9]+)\}/g, (m, id: string) => (ACTION_IDS.has(id) ? keyName(id as ActionId) : m));
}
