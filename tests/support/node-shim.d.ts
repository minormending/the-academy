// The project does not depend on @types/node (the game is browser code), so the few Node APIs the tests
// touch are declared here, just enough to typecheck `tsc -p tsconfig.test.json`.
declare module 'node:fs' {
  export interface Dirent { name: string; isDirectory(): boolean; isFile(): boolean }
  export function readdirSync(path: string, opts: { withFileTypes: true }): Dirent[];
  export function readFileSync(path: string, enc: 'utf8'): string;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
}
declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}
declare module 'node:events' {
  export class EventEmitter {
    on(ev: string, fn: (...a: unknown[]) => void): this;
    once(ev: string, fn: (...a: unknown[]) => void): this;
    off(ev: string, fn: (...a: unknown[]) => void): this;
    emit(ev: string, ...a: unknown[]): boolean;
    removeAllListeners(ev?: string): this;
  }
}
declare const process: { cwd(): string };
