// Writes dist/academy.html: the built game as an Artifact page (the host adds the doctype/head/body skeleton).
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist/index.html', 'utf8');
const tags = [...html.matchAll(/<(script|link)[^>]*>(<\/script>)?/g)].map(m => m[0]).join('\n');
const page = `<title>The Academy</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
  /* Single dark look: the game is a night-sky pixel world on every host. */
  :root { --bg: #0b0d16; color-scheme: dark; }
  html, body { height: 100%; background: var(--bg); overflow: hidden; }
  #stage { position: relative; width: 100%; height: 100%; }
</style>
${tags}
<div id="stage">
  <div id="game"></div>
  <div id="ui-root"></div>
</div>
`;
writeFileSync('dist/academy.html', page);
console.log('wrote dist/academy.html');
