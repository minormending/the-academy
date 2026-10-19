// OWNER: A10 (art-audio). Procedural music: song definitions + a lookahead step sequencer.
//
// Songs are written in a compact tracker notation. Every pattern string is a list of whitespace-separated
// tokens, one token per step (eighth notes: `res` steps per beat). `|` is a readability bar line (ignored).
//   melody:  note name ("C5", "F#4", "Bb3"), "-" = hold previous note, "." = rest
//   bass:    "R" root, "3" third, "5" fifth, "O" octave root, "-" hold, "."
//   arp:     chord-tone index 0..n (wraps into higher octaves), "-" hold, "."
//   pad:     "x" chord hit (held through "-"), "." rest   (default: one sustained chord per chord segment)
//   drums:   per bar strings for kick / snare / hat ("x" hit, "o" open hat / accent, ".")
// Chords: one string per bar; multiple space-separated chord names split the bar evenly.
import type { MusicKey } from '../../core/types';
import { bell, midiFreq, noise, noteMidi, tone, type SynthCtx } from './synth';

type LeadInst = 'flute' | 'pluck' | 'brass' | 'square' | 'bell' | 'musicbox' | 'saw' | 'marimba' | 'kalimba' | 'crystal' | 'harpsichord';
type BassInst = 'sine' | 'tri' | 'saw' | 'pluck';

interface SongDef {
  bpm: number;
  beats: 3 | 4;        // beats per bar
  res: number;         // steps per beat
  chords: string[];    // per bar
  melody: string;      // whole loop (bars × beats × res tokens)
  lead: LeadInst;
  leadVol?: number;
  leadOctaveUpOnRepeat?: boolean;
  counter?: { notes: string; inst: LeadInst; vol?: number; everyOther?: boolean };
  bass: { pattern: string[]; inst: BassInst; octave: number; vol?: number };   // pattern per bar (cycled)
  pad?: { octave: number; cutoff: number; vol?: number; pattern?: string[]; wave?: OscillatorType };
  arp?: { pattern: string[]; octave: number; inst: LeadInst; vol?: number; everyOther?: boolean };
  drums?: { kick?: string[]; snare?: string[]; hat?: string[]; tick?: string[]; vol?: number; crashOnLoop?: boolean };   // tick: clock click, "x" tick / "o" lower tock
  echo?: { time: number; feedback: number; mix: number };
}

// ───────────────────────────── songs ─────────────────────────────

const SONGS: Record<MusicKey, SongDef> = {
  // Grand, hopeful title anthem.
  title: {
    bpm: 92, beats: 4, res: 2,
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'],
    melody: `G4 - C5 - E5 - G5 - | F5 - E5 - D5 - - - | E5 - A5 - C6 - B5 A5 | A5 - - - G5 - F5 - |
             E5 - G5 - C6 - - - | B5 - A5 - G5 - D5 - | C5 - F5 - A5 - G5 F5 | D5 - - - G4 - B4 D5`,
    lead: 'brass', leadVol: 0.13,
    counter: { notes: `. . . . E4 - G4 - | . . . . B4 - - - | . . . . C5 - E5 - | . . . . C5 - - - |
                       . . . . G4 - E4 - | . . . . D5 - B4 - | . . . . F4 - A4 - | B4 - - - D5 - - -`, inst: 'flute', vol: 0.06, everyOther: true },
    bass: { pattern: ['R - - - - - 5 -', 'R - - - 5 - - -'], inst: 'tri', octave: 2, vol: 0.32 },
    pad: { octave: 4, cutoff: 1800, vol: 0.05 },
    arp: { pattern: ['0 1 2 3 2 1 2 3'], octave: 5, inst: 'pluck', vol: 0.04, everyOther: true },
    drums: { kick: ['x . . . x . . .'], snare: ['. . . . . . . .', '. . . . . . x x'], hat: ['. . x . . . x .'], vol: 0.8, crashOnLoop: true },
    echo: { time: 0.33, feedback: 0.25, mix: 0.18 },
  },
  // Warm, cozy town waltz.
  town: {
    bpm: 138, beats: 3, res: 2,
    chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C7', 'Bb C', 'F', 'Bb', 'F', 'Gm', 'C', 'Am', 'Dm', 'Gm C7', 'F'],
    melody: `A4 - C5 - F5 - | E5 - D5 - C5 - | D5 - F5 - A5 - | G5 - - - F5 - |
             F5 - A5 - C6 - | Bb5 - A5 - G5 - | F5 - D5 - E5 - | F5 - - - . . |
             D5 - F5 - Bb5 - | A5 - - - F5 - | G5 - Bb5 - D6 - | C6 - - - E5 - |
             E5 - A5 - C6 - | A5 - F5 - D5 - | Bb4 - D5 - E5 - | F5 - - - C5 -`,
    lead: 'flute', leadVol: 0.13,
    counter: { notes: `. . . . . . | G4 - - - E4 - | . . . . . . | D5 - - - C5 - |
                       . . . . . . | E5 - - - E5 - | D5 - - - C5 - | A4 - - - . . |
                       . . . . . . | C5 - - - A4 - | . . . . . . | G4 - - - Bb4 - |
                       . . . . . . | F4 - - - A4 - | G4 - - - Bb4 - | A4 - - - . .`, inst: 'musicbox', vol: 0.05, everyOther: true },
    bass: { pattern: ['R - - - - -', 'R - - - 5 -'], inst: 'tri', octave: 2, vol: 0.3 },
    pad: { octave: 4, cutoff: 1400, vol: 0.05, pattern: ['. . x - x -'], wave: 'triangle' },
    drums: { kick: ['x . . . . .'], hat: ['. . x . x .'], vol: 0.45 },
    echo: { time: 0.22, feedback: 0.2, mix: 0.12 },
  },
  // Bouncy, sunny forest.
  forest: {
    bpm: 128, beats: 4, res: 2,
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am D', 'G'],
    melody: `D5 . G5 . B5 A5 G5 . | E5 . G5 . B5 - A5 . | G5 . E5 . C5 D5 E5 . | F#5 - - . A5 - D5 . |
             B5 . A5 . G5 A5 B5 . | G5 . E5 . B4 - E5 . | C5 . E5 . D5 . F#5 . | G5 - - - . . D5 .`,
    lead: 'pluck', leadVol: 0.12, leadOctaveUpOnRepeat: false,
    counter: { notes: `B4 - - - D5 - - - | B4 - - - E5 - - - | E4 - - - G4 - - - | A4 - - - F#4 - - - |
                       D5 - - - B4 - - - | B4 - - - G4 - - - | A4 - C5 - A4 - - - | B4 - - - . . . .`, inst: 'flute', vol: 0.05, everyOther: true },
    bass: { pattern: ['R . 5 . R . 5 .', 'R . 5 . O . 5 .'], inst: 'pluck', octave: 2, vol: 0.3 },
    pad: { octave: 4, cutoff: 1200, vol: 0.035 },
    arp: { pattern: ['0 . 2 . 1 . 2 .'], octave: 5, inst: 'bell', vol: 0.035 },
    drums: { kick: ['x . . . x . . .'], snare: ['. . x . . . x .'], hat: ['x x x x x x x o'], vol: 0.55 },
  },
  // Mysterious, echoing caves.
  cave: {
    bpm: 84, beats: 4, res: 2,
    chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'F', 'Gm', 'A7'],
    melody: `D5 - - - F5 - E5 - | D5 - - - . . . . | Bb4 - D5 - G5 - F5 - | E5 - - - C#5 - - - |
             A4 - D5 - F5 - A5 - | G5 - F5 - C5 - - - | D5 - Bb4 - G4 - A4 - | A4 - - - . . . .`,
    lead: 'bell', leadVol: 0.09,
    bass: { pattern: ['R - - - - - - -', 'R - - - 5 - - -'], inst: 'sine', octave: 2, vol: 0.34 },
    pad: { octave: 3, cutoff: 700, vol: 0.06 },
    arp: { pattern: ['. . . . . . 4 .', '. . 3 . . . . .'], octave: 5, inst: 'musicbox', vol: 0.04 },
    drums: { kick: ['x . . . . . . .'], hat: ['. . . . . . x .', '. . . x . . . .'], vol: 0.35 },
    echo: { time: 0.535, feedback: 0.45, mix: 0.38 },
  },
  // Twinkly, wistful snowfields.
  snow: {
    bpm: 100, beats: 4, res: 2,
    chords: ['D', 'A', 'Bm', 'G', 'D', 'F#m', 'G', 'A'],
    melody: `A5 - F#5 - D5 - F#5 - | E5 - C#5 - A4 - C#5 - | D5 - F#5 - B5 - A5 - | G5 - - - D5 - - - |
             F#5 - A5 - D6 - - - | C#6 - A5 - F#5 - - - | B5 - G5 - D5 - E5 - | E5 - - - C#5 - - -`,
    lead: 'musicbox', leadVol: 0.12,
    bass: { pattern: ['R - - - 5 - - -'], inst: 'sine', octave: 2, vol: 0.28 },
    pad: { octave: 4, cutoff: 1500, vol: 0.04, wave: 'triangle' },
    arp: { pattern: ['0 1 2 3 2 1 2 3'], octave: 6, inst: 'bell', vol: 0.03 },
    drums: { hat: ['x . x . x . x o'], vol: 0.3 },
    echo: { time: 0.45, feedback: 0.35, mix: 0.28 },
  },
  // Driving, minor-key volcano.
  volcano: {
    bpm: 150, beats: 4, res: 2,
    chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B7'],
    melody: `E5 . E5 G5 . E5 B5 . | A5 . G5 . F#5 . E5 . | G5 . G5 E5 . G5 C6 . | B5 . A5 . F#5 . D5 . |
             E5 . E5 G5 . B5 E6 . | D6 . B5 . G5 . A5 . | G5 . E5 . C5 . E5 . | D#5 - - - B4 - - -`,
    lead: 'square', leadVol: 0.085, leadOctaveUpOnRepeat: true,
    bass: { pattern: ['R R R R R R R R', 'R R R R O R 5 R'], inst: 'saw', octave: 1, vol: 0.2 },
    pad: { octave: 3, cutoff: 900, vol: 0.045, pattern: ['x - . x - . x -'], wave: 'sawtooth' },
    drums: { kick: ['x . . x x . . .'], snare: ['. . x . . . x .'], hat: ['x x x x x x x x'], vol: 0.7, crashOnLoop: true },
  },
  // Tense, windswept peak.
  storm: {
    bpm: 138, beats: 4, res: 2,
    chords: ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm', 'G7'],
    melody: `C5 - Eb5 - G5 - F5 Eb5 | C5 - - - Ab4 - - . | Bb4 - D5 - F5 - Eb5 D5 | B4 - - - G4 - - . |
             C5 - G5 - C6 - Bb5 Ab5 | G5 - - - Eb5 - - . | F5 - Ab5 - C6 - Bb5 Ab5 | G5 - - - B4 - D5 -`,
    lead: 'saw', leadVol: 0.07,
    bass: { pattern: ['R R . R R R . R'], inst: 'saw', octave: 1, vol: 0.2 },
    pad: { octave: 4, cutoff: 1000, vol: 0.04 },
    arp: { pattern: ['0 2 0 2 1 2 1 2'], octave: 4, inst: 'pluck', vol: 0.04 },
    drums: { kick: ['x . . . x . . x'], snare: ['. . x . . . x .'], hat: ['. x . x . x . o'], vol: 0.65 },
    echo: { time: 0.217, feedback: 0.25, mix: 0.15 },
  },
  // Intense boss battle.
  boss: {
    bpm: 168, beats: 4, res: 2,
    chords: ['Am', 'F', 'Dm', 'E', 'Am', 'F', 'G', 'E7'],
    melody: `A5 . A5 . C6 . B5 A5 | F5 . A5 . C6 - - . | D6 . C6 . A5 . F5 . | E5 . G#5 . B5 - - . |
             A5 . C6 . E6 . D6 C6 | A5 . F5 . A5 . C6 . | B5 . D6 . G5 . B5 . | G#5 - - - E5 . G#5 B5`,
    lead: 'square', leadVol: 0.08, leadOctaveUpOnRepeat: false,
    counter: { notes: `A4 - - - E5 - - - | F4 - - - C5 - - - | D5 - - - A4 - - - | E4 - - - G#4 - - - |
                       A4 - - - E5 - - - | F4 - - - A4 - - - | G4 - - - D5 - - - | E5 - - - B4 - - -`, inst: 'brass', vol: 0.06 },
    bass: { pattern: ['R R O R R R O R'], inst: 'saw', octave: 1, vol: 0.22 },
    pad: { octave: 3, cutoff: 1300, vol: 0.04, wave: 'sawtooth' },
    arp: { pattern: ['0 1 2 1 0 1 2 3'], octave: 4, inst: 'pluck', vol: 0.03, everyOther: true },
    drums: { kick: ['x . x . x . x .'], snare: ['. . x . . . x x', '. . x . . x x x'], hat: ['x x x x x x x x'], vol: 0.75, crashOnLoop: true },
  },
  // Moonlit Marsh (Lv 12-18): night bog in G dorian, a gentle 12/8 swing (triplet grid), marimba lead,
  // kalimba droplets, hollow reed pad, cricket-ish hats. A (bars 1-4) / B (5-8, owl-like flute answers) / A'.
  marsh: {
    bpm: 100, beats: 4, res: 3,
    chords: ['Gm', 'C', 'Gm', 'Dm', 'Ebmaj7', 'Bb', 'Cm', 'D7', 'Gm', 'C', 'Eb D7', 'Gm'],
    melody: `D5 - - | . . Bb4 | D5 - - | G5 - F5 |
             E5 - - | . . D5 | C5 - - | . . G4 |
             Bb4 - D5 | G5 - - | F5 - D5 | Bb4 - - |
             A4 - - | . . D5 | F5 - E5 | D5 - - |
             G5 - - | - - - | F5 - Eb5 | D5 - - |
             D5 - - | - - - | C5 - Bb4 | D5 - F5 |
             Eb5 - - | G5 - Eb5 | D5 - C5 | Eb5 - - |
             F#5 - A5 | D6 - - | C6 - A5 | F#5 - - |
             D5 - - | . . Bb4 | D5 - - | G5 - F5 |
             E5 - - | . . D5 | C5 - E5 | G5 - - |
             G5 - - F5 - Eb5 D5 - - F#5 - A5 |
             G5 - - | - - - | D5 - - | . . .`,
    lead: 'marimba', leadVol: 0.12,
    counter: { notes: `. . . . . . . . . . . . | . . . . . . . . . . . . | . . . . . . . . . . . . | . . . . . . . . . . . . |
                       Bb4 - - - - - - - - - - - | F4 - - - - - - - - - - - | G4 - - - - - - - - - - - | A4 - - - - - - - - - - - |
                       D5 - - - - - - - - - - - | E5 - - - - - - - - - - - | Bb4 - - - - - A4 - - - - - | G4 - - - - - - - - - - -`,
               inst: 'flute', vol: 0.05, everyOther: true },
    bass: { pattern: ['R - - | . . . | 5 - - | . . .', 'R - - | . . . | 5 - - | 3 - 5'], inst: 'sine', octave: 2, vol: 0.32 },
    pad: { octave: 3, cutoff: 520, vol: 0.045, wave: 'square' },
    arp: { pattern: ['. . . | . . 2 | . . . | 4 . .', '. . . | . . . | . 3 . | . . 5'], octave: 5, inst: 'kalimba', vol: 0.045 },
    drums: { kick: ['x . . | . . . | x . .  | . . .'], hat: ['x x . | . . . | . . x | x . .', '. . x | x . . | x x . | . . .'], vol: 0.4 },
    echo: { time: 0.4, feedback: 0.3, mix: 0.2 },
  },
  // Glacier Grotto (Lv 22-30): deep ice cave in C# minor, slow and reverberant. Sparse crystal-bell melody,
  // continuous 16th minor arpeggio shimmer (res 4), sine-drone bass + sine pad, long dotted echo, glacial boom.
  grotto: {
    bpm: 66, beats: 4, res: 4,
    chords: ['C#m', 'Amaj7', 'E', 'B', 'C#m', 'F#m', 'Amaj7', 'Bsus4 G#7'],
    melody: `G#5 - - - - - - - | E5 - - - F#5 - G#5 - |
             A5 - - - - - - - | G#5 - - - E5 - - - |
             B5 - - - - - G#5 - | E5 - - - - - - - |
             F#5 - - - D#5 - - - | F#5 - G#5 - B5 - - - |
             C#6 - - - - - - - | B5 - G#5 - E5 - - - |
             A5 - - - - - C#6 - | B5 - - - A5 - - - |
             C#6 - - - - - - - | B5 - A5 - G#5 - - - |
             E5 - - - F#5 - - - | D#5 - - - C5 - . .`,
    lead: 'crystal', leadVol: 0.09,
    bass: { pattern: ['R - - - - - - - - - - - 5 - - -', 'R - - - - - - - - - - - - - - -'], inst: 'sine', octave: 2, vol: 0.34 },
    pad: { octave: 4, cutoff: 3000, vol: 0.04, wave: 'sine' },
    arp: { pattern: ['0 . 1 . 2 . 3 . 4 . 3 . 2 . 1 .', '0 . 1 2 . 3 . 4 . 5 . 4 3 . 2 .'], octave: 5, inst: 'crystal', vol: 0.032 },
    drums: { kick: ['x . . . . . . . . . . . . . . .', '. . . . . . . . . . . . . . . .'], hat: ['. . . . . . . . . . . x . . . .', '. . . . . . . . . . . . . . x .'], vol: 0.3 },
    echo: { time: 0.682, feedback: 0.5, mix: 0.42 },
  },
  // The Restricted Stacks (Lv 32-42): C minor, harpsichord lead, ticking clock. The title theme's opening
  // (G C E G / F E D) returns in minor at double speed (bars 1, 9). A (1-4) / B (5-8 rising sequence) / A' (9-12).
  library: {
    bpm: 112, beats: 4, res: 2,
    chords: ['Cm', 'Fm', 'G7', 'Cm', 'Ab', 'Fm', 'Ddim', 'G7', 'Cm', 'Fm', 'Ab Ddim', 'Fm G7'],
    melody: `G4 C5 Eb5 G5 F5 Eb5 D5 . |
             Ab4 C5 F5 Ab5 G5 F5 Eb5 . |
             B4 D5 F5 G5 F5 D5 B4 . |
             C5 - - - . . G4 C5 |
             Eb5 - C5 Eb5 Ab5 - G5 F5 |
             F5 - Ab5 - C6 - Bb5 Ab5 |
             Ab5 F5 D5 F5 Ab5 F5 D5 . |
             G5 - F5 - D5 - B4 - |
             G4 C5 Eb5 G5 C6 Bb5 Ab5 . |
             Ab4 C5 F5 Ab5 G5 - F5 - |
             C6 - Ab5 - F5 - D5 - |
             Ab5 - F5 - D5 B4 G4 .`,
    lead: 'harpsichord', leadVol: 0.1,
    counter: { notes: `Eb4 - - - - - - - | F4 - - - - - - - | D4 - - - - - - - | Eb4 - - - - - - - |
                       C4 - - - - - - - | Ab4 - - - - - - - | F4 - - - - - - - | D4 - - - B3 - - - |
                       G4 - - - - - - - | C5 - - - - - - - | Eb4 - - - Ab4 - - - | F4 - - - D4 - - -`, inst: 'flute', vol: 0.05, everyOther: true },
    bass: { pattern: ['R . 3 . 5 . 3 .', 'R . . R 5 . . 5'], inst: 'tri', octave: 2, vol: 0.3 },
    pad: { octave: 3, cutoff: 1100, vol: 0.06, wave: 'sawtooth' },
    arp: { pattern: ['2 . . . . . 4 .', '. . . . 3 . . .'], octave: 6, inst: 'musicbox', vol: 0.025, everyOther: true },
    drums: { kick: ['x . . . . . . .'], tick: ['x . o . x . o .'], vol: 0.5 },
    echo: { time: 0.268, feedback: 0.25, mix: 0.15 },
  },
  // Placeholder aliases for the Year 5 zones (replaced by bespoke tracks).
  get astral() { return SONGS.storm; },
  get rift() { return SONGS.boss; },
};

// ───────────────────────────── parsing ─────────────────────────────

const tokens = (s: string) => s.split(/\s+/).filter(t => t && t !== '|');

const CHORD_IV: Record<string, number[]> = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  dim: [0, 3, 6], sus4: [0, 5, 7], sus2: [0, 2, 7], add9: [0, 4, 7, 14], aug: [0, 4, 8],
};
const ROOT: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

interface Chord { root: number; iv: number[] }   // root pitch class
function parseChord(name: string): Chord {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name.trim());
  if (!m) return { root: 0, iv: CHORD_IV[''] };
  const root = (ROOT[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  return { root, iv: CHORD_IV[m[3]] ?? CHORD_IV[''] };
}

interface Note { step: number; midi: number; len: number }
function parseLine(s: string): { notes: Note[]; length: number } {
  const tk = tokens(s);
  const notes: Note[] = [];
  let cur: Note | null = null;
  tk.forEach((t, i) => {
    if (t === '-') { if (cur) cur.len++; return; }
    cur = null;
    if (t === '.') return;
    const m = noteMidi(t);
    if (m >= 0) { cur = { step: i, midi: m, len: 1 }; notes.push(cur); }
  });
  return { notes, length: tk.length };
}

interface Compiled {
  def: SongDef;
  stepsPerBar: number;
  totalSteps: number;
  chordAt: Chord[];          // per step
  chordStart: boolean[];     // per step: a new chord segment begins
  chordLen: number[];        // per step (only meaningful at starts): segment length in steps
  melody: Note[][];          // per step
  counter: Note[][] | null;
}

function compile(def: SongDef): Compiled {
  const spb = def.beats * def.res;
  const bars = def.chords.length;
  const total = spb * bars;
  const chordAt: Chord[] = new Array(total);
  const chordStart: boolean[] = new Array(total).fill(false);
  const chordLen: number[] = new Array(total).fill(0);
  def.chords.forEach((bar, b) => {
    const names = bar.split(/\s+/).filter(Boolean);
    const seg = spb / names.length;
    names.forEach((n, k) => {
      const c = parseChord(n);
      const s0 = b * spb + Math.round(k * seg), s1 = b * spb + Math.round((k + 1) * seg);
      chordStart[s0] = true; chordLen[s0] = s1 - s0;
      for (let s = s0; s < s1; s++) chordAt[s] = c;
    });
  });
  const bucket = (line: string | undefined): Note[][] | null => {
    if (!line) return null;
    const out: Note[][] = Array.from({ length: total }, () => []);
    for (const n of parseLine(line).notes) if (n.step < total) out[n.step].push(n);
    return out;
  };
  return { def, stepsPerBar: spb, totalSteps: total, chordAt, chordStart, chordLen, melody: bucket(def.melody)!, counter: bucket(def.counter?.notes) };
}

const compiled = new Map<MusicKey, Compiled>();
function getSong(key: MusicKey): Compiled | null {
  let c = compiled.get(key);
  if (!c) {
    const def = SONGS[key];
    if (!def) return null;
    c = compile(def);
    compiled.set(key, c);
  }
  return c;
}

// ───────────────────────────── instruments ─────────────────────────────

function playLead(s: SynthCtx, inst: LeadInst, f: number, dur: number, v: number, dest?: AudioNode) {
  switch (inst) {
    case 'flute':
      tone(s, { type: 'sine', f, dur: dur + 0.12, v, a: 0.03, hold: Math.max(0, dur - 0.05), vib: { rate: 5.2, depth: 9, delay: 0.12 }, dest });
      tone(s, { type: 'triangle', f: f * 2, dur: dur * 0.6 + 0.05, v: v * 0.12, a: 0.02, dest });
      break;
    case 'pluck':
      tone(s, { type: 'square', f, dur: Math.min(0.5, dur + 0.15), v: v * 0.6, filter: { type: 'lowpass', f: 3200, f2: 500, q: 2 }, dest });
      tone(s, { type: 'triangle', f, dur: dur + 0.1, v: v * 0.5, dest });
      break;
    case 'brass':
      tone(s, { type: 'sawtooth', f, dur: dur + 0.15, v: v * 0.7, a: 0.05, hold: Math.max(0, dur - 0.08), vib: { rate: 5, depth: 8, delay: 0.2 }, filter: { type: 'lowpass', f: 900, f2: 2600, at: 0.08, q: 1 }, dest });
      tone(s, { type: 'sawtooth', f, detune: 9, dur: dur + 0.15, v: v * 0.4, a: 0.06, hold: Math.max(0, dur - 0.08), filter: { type: 'lowpass', f: 1800 }, dest });
      break;
    case 'square':
      tone(s, { type: 'square', f, dur: dur + 0.06, v: v * 0.8, a: 0.008, hold: Math.max(0, dur - 0.06), vib: { rate: 6, depth: 10, delay: 0.15 }, filter: { type: 'lowpass', f: 3800 }, dest });
      tone(s, { type: 'square', f: f * 1.003, dur: dur + 0.06, v: v * 0.35, a: 0.008, hold: Math.max(0, dur - 0.06), filter: { type: 'lowpass', f: 2500 }, dest });
      break;
    case 'saw':
      tone(s, { type: 'sawtooth', f, dur: dur + 0.08, v: v * 0.8, a: 0.01, hold: Math.max(0, dur - 0.06), vib: { rate: 5.5, depth: 12, delay: 0.15 }, filter: { type: 'lowpass', f: 2600, q: 3 }, dest });
      tone(s, { type: 'sawtooth', f, detune: -12, dur: dur + 0.08, v: v * 0.5, a: 0.01, hold: Math.max(0, dur - 0.06), filter: { type: 'lowpass', f: 2000 }, dest });
      break;
    case 'bell':
      bell(s, f, 0, Math.max(0.6, dur * 1.6), v * 0.9, 3.5, 1.6, dest);
      tone(s, { type: 'sine', f, dur: Math.max(0.6, dur * 1.6), v: v * 0.5, dest });
      break;
    case 'musicbox':
      tone(s, { type: 'sine', f, dur: Math.max(0.5, dur * 1.3), v, dest });
      tone(s, { type: 'triangle', f: f * 2, dur: 0.25, v: v * 0.25, dest });
      bell(s, f * 2, 0, 0.35, v * 0.2, 4, 0.8, dest);
      break;
    case 'marimba':
      tone(s, { type: 'sine', f, dur: Math.min(0.6, dur + 0.15), v, a: 0.004, dest });
      tone(s, { type: 'sine', f: f * 4, dur: 0.1, v: v * 0.3, a: 0.003, dest });
      tone(s, { type: 'triangle', f: f * 0.5, dur: 0.18, v: v * 0.25, a: 0.004, dest });
      break;
    case 'kalimba':
      tone(s, { type: 'sine', f, dur: Math.max(0.5, Math.min(1.0, dur * 1.2)), v, a: 0.003, dest });
      tone(s, { type: 'sine', f: f * 5.4, dur: 0.07, v: v * 0.3, a: 0.002, dest });
      break;
    case 'crystal':
      bell(s, f, 0, Math.max(1.4, dur * 1.3), v * 0.7, 4.2, 1.1, dest);
      tone(s, { type: 'sine', f, dur: Math.max(1.4, dur * 1.3), v: v * 0.45, a: 0.004, dest });
      tone(s, { type: 'sine', f: f * 2, detune: 7, dur: 0.7, v: v * 0.15, a: 0.004, dest });
      break;
    case 'harpsichord':
      tone(s, { type: 'sawtooth', f, dur: Math.min(0.45, dur + 0.1), v: v * 0.55, a: 0.002, filter: { type: 'lowpass', f: 5000, f2: 900, at: 0.25, q: 1.5 }, dest });
      tone(s, { type: 'square', f: f * 2, dur: 0.16, v: v * 0.2, a: 0.002, filter: { type: 'lowpass', f: 4000 }, dest });
      tone(s, { type: 'triangle', f, dur: Math.min(0.4, dur + 0.08), v: v * 0.35, a: 0.002, dest });
      noise(s, { dur: 0.012, v: v * 0.5, filter: { type: 'bandpass', f: 3500, q: 1 }, dest });
      break;
  }
}

function playBass(s: SynthCtx, inst: BassInst, f: number, dur: number, v: number) {
  switch (inst) {
    case 'sine': tone(s, { type: 'sine', f, dur: dur + 0.1, v, a: 0.02, hold: Math.max(0, dur - 0.05) }); break;
    case 'tri': tone(s, { type: 'triangle', f, dur: dur + 0.08, v, a: 0.01, hold: Math.max(0, dur - 0.08) }); break;
    case 'saw':
      tone(s, { type: 'sawtooth', f, dur: dur + 0.05, v, a: 0.005, hold: Math.max(0, dur - 0.08), filter: { type: 'lowpass', f: 700, f2: 300, at: dur, q: 3 } });
      tone(s, { type: 'sine', f, dur: dur + 0.05, v: v * 0.8, a: 0.005, hold: Math.max(0, dur - 0.08) });
      break;
    case 'pluck':
      tone(s, { type: 'triangle', f, dur: Math.min(dur + 0.1, 0.4), v });
      tone(s, { type: 'square', f, dur: 0.12, v: v * 0.25, filter: { type: 'lowpass', f: 900, f2: 200 } });
      break;
  }
}

function playPad(s: SynthCtx, freqs: number[], dur: number, v: number, cutoff: number, wave: OscillatorType = 'sawtooth') {
  for (const f of freqs) {
    for (const d of [-6, 6]) {
      tone(s, { type: wave, f, detune: d, dur: dur + 0.35, v, a: Math.min(0.3, dur * 0.3), hold: Math.max(0, dur - 0.3), release: 'lin', filter: { type: 'lowpass', f: cutoff, q: 0.7 } });
    }
  }
}

function kick(s: SynthCtx, v: number) {
  tone(s, { f: 150, f2: 42, glide: 0.12, dur: 0.28, v: 0.7 * v });
  noise(s, { dur: 0.02, v: 0.15 * v, filter: { type: 'lowpass', f: 2000 } });
}
function snare(s: SynthCtx, v: number) {
  noise(s, { dur: 0.16, v: 0.3 * v, filter: { type: 'bandpass', f: 1900, q: 0.8 }, filter2: { type: 'highpass', f: 600 } });
  tone(s, { type: 'triangle', f: 200, f2: 150, dur: 0.09, v: 0.25 * v });
}
function hat(s: SynthCtx, v: number, open: boolean) {
  noise(s, { dur: open ? 0.16 : 0.04, v: (open ? 0.12 : 0.1) * v, filter: { type: 'highpass', f: 7500 } });
}
/** Clock click: short bandpassed noise + pitched blip; `tock` is the lower, softer beat. */
function clockTick(s: SynthCtx, v: number, tock: boolean) {
  const f = tock ? 1700 : 2700;
  noise(s, { dur: 0.03, v: 0.18 * v, filter: { type: 'bandpass', f, q: 3 } });
  tone(s, { type: 'sine', f, f2: f * 0.6, glide: 0.02, dur: 0.035, v: 0.12 * v });
}
function crash(s: SynthCtx, v: number) {
  noise(s, { dur: 1.4, v: 0.14 * v, filter: { type: 'highpass', f: 4500 }, filter2: { type: 'bandpass', f: 8000, q: 0.5 } });
}

/** Chord tones (midi) starting at octave, ascending; index can exceed (wraps up octaves). */
function chordTone(c: Chord, octave: number, idx: number): number {
  const n = c.iv.length;
  const o = Math.floor(idx / n), k = ((idx % n) + n) % n;
  return (octave + 1) * 12 + c.root + c.iv[k] + o * 12;
}

function bassNote(c: Chord, octave: number, sym: string): number {
  const base = (octave + 1) * 12 + c.root;
  switch (sym) {
    case 'R': return base;
    case '3': return base + (c.iv[1] ?? 4);
    case '5': return base + 7;
    case 'O': return base + 12;
    default: return -1;
  }
}

// ───────────────────────────── sequencer ─────────────────────────────

/** Plays one song on its own bus; supports fade in/out. */
export class SongPlayer {
  readonly bus: GainNode;
  private leadBus: GainNode;
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private pass = 0;
  private nextTime = 0;
  private song: Compiled;
  private stopped = false;
  private extraNodes: AudioNode[] = [];

  constructor(private ctx: AudioContext, out: AudioNode, readonly key: MusicKey) {
    this.song = getSong(key) ?? getSong('town')!;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.0001;
    this.bus.connect(out);
    this.leadBus = ctx.createGain();
    this.leadBus.connect(this.bus);
    const echo = this.song.def.echo;
    if (echo) {
      const delay = ctx.createDelay(1.5), fb = ctx.createGain(), wet = ctx.createGain(), lp = ctx.createBiquadFilter();
      delay.delayTime.value = echo.time; fb.gain.value = echo.feedback; wet.gain.value = echo.mix;
      lp.type = 'lowpass'; lp.frequency.value = 2800;
      this.leadBus.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(this.bus);
      this.extraNodes.push(delay, fb, wet, lp);
    }
  }

  start(fadeIn: number) {
    const now = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setValueAtTime(0.0001, now);
    this.bus.gain.exponentialRampToValueAtTime(1, now + Math.max(0.05, fadeIn));
    this.nextTime = now + 0.08;
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }

  stop(fadeOut: number) {
    if (this.stopped) return;
    this.stopped = true;
    const now = this.ctx.currentTime;
    const g = this.bus.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    g.exponentialRampToValueAtTime(0.0001, now + Math.max(0.05, fadeOut));
    setTimeout(() => {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      try { this.bus.disconnect(); this.leadBus.disconnect(); this.extraNodes.forEach(n => n.disconnect()); } catch { /* ignore */ }
    }, fadeOut * 1000 + 600);
  }

  private tick() {
    if (this.stopped && !this.timer) return;
    const ctx = this.ctx;
    if (ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // After a stall (background tab), skip ahead instead of bursting.
    if (this.nextTime < now - 0.25) this.nextTime = now + 0.05;
    const stepDur = 60 / this.song.def.bpm / this.song.def.res;
    let guard = 0;
    while (this.nextTime < now + 0.14 && guard++ < 32) {
      if (!this.stopped) {
        try { this.playStep(this.step, this.nextTime, stepDur); } catch (e) { console.warn('[music] step failed', e); }
      }
      this.nextTime += stepDur;
      this.step++;
      if (this.step >= this.song.totalSteps) { this.step = 0; this.pass++; }
    }
  }

  private playStep(step: number, t: number, sd: number) {
    const { def, stepsPerBar, chordAt, chordStart, chordLen } = this.song;
    const s: SynthCtx = { ctx: this.ctx, out: this.bus, t0: t };
    const sl: SynthCtx = { ctx: this.ctx, out: this.leadBus, t0: t };
    const bar = Math.floor(step / stepsPerBar), inBar = step % stepsPerBar;
    const chord = chordAt[step];
    const odd = this.pass % 2 === 1;
    // swing-free humanize
    const hz = () => (Math.random() - 0.5) * 0.006;

    // melody
    const octUp = def.leadOctaveUpOnRepeat && odd ? 2 : 1;
    for (const n of this.song.melody[step]) playLead({ ...sl, t0: t + hz() }, def.lead, midiFreq(n.midi) * octUp, n.len * sd * 0.92, def.leadVol ?? 0.1);
    // counter-melody
    if (this.song.counter && def.counter && (!def.counter.everyOther || odd)) {
      for (const n of this.song.counter[step]) playLead({ ...sl, t0: t + hz() }, def.counter.inst, midiFreq(n.midi), n.len * sd * 0.92, def.counter.vol ?? 0.05);
    }
    if (!chord) return;
    // bass
    const bp = tokens(def.bass.pattern[bar % def.bass.pattern.length]);
    const bsym = bp[inBar];
    if (bsym && bsym !== '.' && bsym !== '-') {
      let len = 1;
      while (bp[inBar + len] === '-') len++;
      const m = bassNote(chord, def.bass.octave, bsym);
      if (m >= 0) playBass(s, def.bass.inst, midiFreq(m), len * sd * 0.95, def.bass.vol ?? 0.25);
    }
    // pad
    if (def.pad) {
      const freqs = [0, 1, 2].map(i => midiFreq(chordTone(chord, def.pad!.octave, i)));
      if (def.pad.pattern) {
        const pp = tokens(def.pad.pattern[bar % def.pad.pattern.length]);
        if (pp[inBar] === 'x') {
          let len = 1;
          while (pp[inBar + len] === '-') len++;
          playPad(s, freqs, len * sd * 0.9, def.pad.vol ?? 0.04, def.pad.cutoff, def.pad.wave);
        }
      } else if (chordStart[step]) {
        playPad(s, freqs, chordLen[step] * sd, def.pad.vol ?? 0.04, def.pad.cutoff, def.pad.wave);
      }
    }
    // arp
    if (def.arp && (!def.arp.everyOther || odd)) {
      const ap = tokens(def.arp.pattern[bar % def.arp.pattern.length]);
      const a = ap[inBar];
      if (a && a !== '.' && a !== '-') {
        const idx = parseInt(a, 10);
        if (!Number.isNaN(idx)) {
          let len = 1;
          while (ap[inBar + len] === '-') len++;
          playLead(sl, def.arp.inst, midiFreq(chordTone(chord, def.arp.octave, idx)), len * sd * 0.8, def.arp.vol ?? 0.03);
        }
      }
    }
    // drums
    const d = def.drums;
    if (d) {
      const dv = d.vol ?? 0.6;
      const at = (arr: string[] | undefined) => (arr ? tokens(arr[bar % arr.length])[inBar] : undefined);
      const k = at(d.kick), sn = at(d.snare), h = at(d.hat);
      if (k === 'x' || k === 'o') kick(s, dv * (k === 'o' ? 1.2 : 1));
      if (sn === 'x' || sn === 'o') snare(s, dv * (sn === 'o' ? 1.2 : 1));
      if (h === 'x' || h === 'o') hat({ ...s, t0: t + hz() }, dv * (inBar % 2 ? 0.7 : 1), h === 'o');
      const tk = at(d.tick);
      if (tk === 'x' || tk === 'o') clockTick(s, dv * (tk === 'o' ? 0.8 : 1), tk === 'o');
      if (d.crashOnLoop && step === 0 && this.pass > 0) crash(s, dv);
    }
  }
}

export const MUSIC_KEYS = Object.keys(SONGS) as MusicKey[];
