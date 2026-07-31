/** Procedural audio.
 *
 *  Every sound in the game is synthesised on the fly with the Web Audio API —
 *  no sample files to download, so the whole soundtrack costs zero bytes and
 *  works offline the moment the page loads. SFX are one-shot node graphs;
 *  music is a lookahead step sequencer running off the audio clock.
 */

import { save } from './save';

export type SfxName =
  | 'click'
  | 'select'
  | 'deny'
  | 'deploy'
  | 'slash'
  | 'hit'
  | 'bow'
  | 'arrow'
  | 'bomb'
  | 'coin'
  | 'cannon'
  | 'baseHit'
  | 'die'
  | 'upgrade'
  | 'win'
  | 'lose';

export type Track = 'menu' | 'battle';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** Eight-bar chord loops, as MIDI root notes with a quality flag. */
const PROGRESSIONS: Record<Track, Array<[root: number, minor: boolean]>> = {
  //        Am        Am        F         G         C         C         F         E
  battle: [[45, true], [45, true], [41, false], [43, false], [48, false], [48, false], [41, false], [40, true]],
  //        Am        C         F         G
  menu: [[45, true], [48, false], [41, false], [43, false], [45, true], [48, false], [41, false], [43, false]],
};

const TEMPO: Record<Track, number> = { menu: 92, battle: 134 };

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;

  private timer: number | null = null;
  private track: Track | null = null;
  private step = 0;
  private nextNoteTime = 0;

  /** Web Audio can only start from a user gesture; call this from any input. */
  unlock() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private init() {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = save.data.settings.sfx ? 1 : 0;
    this.sfxBus.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = save.data.settings.music ? 0.34 : 0;
    this.musicBus.connect(this.master);

    // One second of white noise, reused by every percussive sound.
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const chan = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) chan[i] = Math.random() * 2 - 1;

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  setSfxEnabled(on: boolean) {
    save.data.settings.sfx = on;
    save.flush();
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
  }

  setMusicEnabled(on: boolean) {
    save.data.settings.music = on;
    save.flush();
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? 0.34 : 0, this.ctx.currentTime, 0.1);
  }

  /* ---------------------------------------------------------------- */
  /* Synthesis primitives                                              */
  /* ---------------------------------------------------------------- */

  private tone(opts: {
    type: OscillatorType;
    freq: number;
    to?: number;
    at: number;
    dur: number;
    peak: number;
    bus?: GainNode;
    attack?: number;
    detune?: number;
  }) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, opts.at);
    if (opts.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), opts.at + opts.dur);
    if (opts.detune) osc.detune.value = opts.detune;

    const attack = opts.attack ?? 0.006;
    gain.gain.setValueAtTime(0.0001, opts.at);
    gain.gain.exponentialRampToValueAtTime(opts.peak, opts.at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.dur);

    osc.connect(gain).connect(opts.bus ?? this.sfxBus);
    osc.start(opts.at);
    osc.stop(opts.at + opts.dur + 0.02);
  }

  private noise(opts: {
    at: number;
    dur: number;
    peak: number;
    type?: BiquadFilterType;
    freq: number;
    to?: number;
    q?: number;
    bus?: GainNode;
  }) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.type ?? 'bandpass';
    filter.Q.value = opts.q ?? 1;
    filter.frequency.setValueAtTime(opts.freq, opts.at);
    if (opts.to !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), opts.at + opts.dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, opts.at);
    gain.gain.exponentialRampToValueAtTime(opts.peak, opts.at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.dur);

    src.connect(filter).connect(gain).connect(opts.bus ?? this.sfxBus);
    src.start(opts.at, Math.random() * 0.5);
    src.stop(opts.at + opts.dur + 0.02);
  }

  /* ---------------------------------------------------------------- */
  /* One-shot effects                                                  */
  /* ---------------------------------------------------------------- */

  play(name: SfxName, pitch = 1) {
    if (!this.ctx) this.init();
    const ctx = this.ctx;
    if (!ctx || !save.data.settings.sfx) return;
    if (ctx.state === 'suspended') void ctx.resume();

    const t = ctx.currentTime + 0.001;
    const p = pitch;

    switch (name) {
      case 'click':
        this.tone({ type: 'square', freq: 520 * p, to: 380 * p, at: t, dur: 0.07, peak: 0.13 });
        break;

      case 'select':
        this.tone({ type: 'triangle', freq: 640 * p, to: 980 * p, at: t, dur: 0.11, peak: 0.16 });
        break;

      case 'deny':
        this.tone({ type: 'square', freq: 190, to: 120, at: t, dur: 0.13, peak: 0.13 });
        this.tone({ type: 'square', freq: 150, to: 96, at: t + 0.08, dur: 0.14, peak: 0.11 });
        break;

      case 'deploy':
        // Rising three-note fanfare — the "unit is out" confirmation.
        [0, 4, 7].forEach((semi, i) =>
          this.tone({
            type: 'triangle',
            freq: midi(69 + semi) * p,
            at: t + i * 0.045,
            dur: 0.16,
            peak: 0.15,
          }),
        );
        this.noise({ at: t, dur: 0.12, freq: 900, to: 2400, peak: 0.05 });
        break;

      case 'slash':
        this.noise({ at: t, dur: 0.16, freq: 700 * p, to: 3200 * p, peak: 0.11, q: 1.6 });
        this.tone({ type: 'sawtooth', freq: 300 * p, to: 110 * p, at: t, dur: 0.09, peak: 0.05 });
        break;

      case 'hit':
        this.noise({ at: t, dur: 0.1, freq: 1600 * p, to: 400 * p, peak: 0.12, q: 0.8 });
        this.tone({ type: 'square', freq: 180 * p, to: 70 * p, at: t, dur: 0.1, peak: 0.09 });
        break;

      case 'bow':
        this.noise({ at: t, dur: 0.09, freq: 2200, to: 900, peak: 0.07, q: 3 });
        break;

      case 'arrow':
        this.tone({ type: 'triangle', freq: 1500 * p, to: 620 * p, at: t, dur: 0.13, peak: 0.07 });
        this.noise({ at: t, dur: 0.12, freq: 3000, to: 1200, peak: 0.05, q: 2 });
        break;

      case 'bomb':
        this.noise({ at: t, dur: 0.55, type: 'lowpass', freq: 1800, to: 90, peak: 0.28, q: 0.7 });
        this.tone({ type: 'sine', freq: 130, to: 32, at: t, dur: 0.5, peak: 0.3 });
        this.tone({ type: 'sawtooth', freq: 220, to: 55, at: t, dur: 0.22, peak: 0.08 });
        break;

      case 'cannon':
        this.noise({ at: t, dur: 0.9, type: 'lowpass', freq: 2600, to: 70, peak: 0.34, q: 0.6 });
        this.tone({ type: 'sine', freq: 180, to: 26, at: t, dur: 0.85, peak: 0.34 });
        this.tone({ type: 'sawtooth', freq: 400, to: 60, at: t, dur: 0.35, peak: 0.1 });
        break;

      case 'coin':
        this.tone({ type: 'square', freq: 988, at: t, dur: 0.07, peak: 0.09 });
        this.tone({ type: 'square', freq: 1319, at: t + 0.055, dur: 0.11, peak: 0.09 });
        break;

      case 'baseHit':
        this.tone({ type: 'sine', freq: 110, to: 42, at: t, dur: 0.26, peak: 0.24 });
        this.noise({ at: t, dur: 0.2, type: 'lowpass', freq: 900, to: 160, peak: 0.14 });
        break;

      case 'die':
        this.noise({ at: t, dur: 0.22, freq: 1200 * p, to: 260 * p, peak: 0.08, q: 1.2 });
        this.tone({ type: 'triangle', freq: 420 * p, to: 130 * p, at: t, dur: 0.2, peak: 0.06 });
        break;

      case 'upgrade':
        [0, 4, 7, 12].forEach((semi, i) =>
          this.tone({ type: 'triangle', freq: midi(72 + semi), at: t + i * 0.06, dur: 0.24, peak: 0.14 }),
        );
        break;

      case 'win':
        [0, 4, 7, 12, 12].forEach((semi, i) =>
          this.tone({
            type: 'square',
            freq: midi(69 + semi),
            at: t + i * 0.11,
            dur: i === 4 ? 0.6 : 0.2,
            peak: 0.12,
          }),
        );
        break;

      case 'lose':
        [0, -2, -4, -7].forEach((semi, i) =>
          this.tone({
            type: 'sawtooth',
            freq: midi(64 + semi),
            at: t + i * 0.16,
            dur: i === 3 ? 0.8 : 0.24,
            peak: 0.1,
          }),
        );
        break;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Music sequencer                                                   */
  /* ---------------------------------------------------------------- */

  startMusic(track: Track) {
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    if (this.track === track && this.timer !== null) return;

    this.stopMusic();
    this.track = track;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.12;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.track = null;
  }

  /** Schedules any steps falling inside the next ~150 ms of audio time. */
  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.track) return;
    if (ctx.state === 'suspended') return;

    const secPerStep = 60 / TEMPO[this.track] / 4; // 16th notes
    while (this.nextNoteTime < ctx.currentTime + 0.15) {
      this.emitStep(this.step, this.nextNoteTime, this.track);
      this.nextNoteTime += secPerStep;
      this.step = (this.step + 1) % 128; // 8 bars of 16 steps
    }
  }

  private emitStep(step: number, at: number, track: Track) {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const [root, minor] = PROGRESSIONS[track][bar];
    const third = root + (minor ? 3 : 4);
    const fifth = root + 7;
    const bus = this.musicBus;
    const driving = track === 'battle';

    // Bass — root on the downbeats, fifth as a pickup.
    if (s === 0 || s === 6 || (driving && s === 10)) {
      this.tone({
        type: 'triangle',
        freq: midi(root - 12),
        at,
        dur: driving ? 0.26 : 0.5,
        peak: 0.3,
        bus,
        attack: 0.01,
      });
    }

    // Chord pad — soft, sits underneath everything.
    if (s === 0) {
      for (const n of [root, third, fifth]) {
        this.tone({
          type: 'sine',
          freq: midi(n),
          at,
          dur: driving ? 1.1 : 1.9,
          peak: 0.07,
          bus,
          attack: 0.12,
          detune: (Math.random() - 0.5) * 8,
        });
      }
    }

    // Arpeggio — the melodic surface. Sparser and lower in the menu.
    const arpSteps = driving ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 4, 8, 12];
    if (arpSteps.includes(s)) {
      const shape = [0, 7, 12, 7, 16, 12, 7, 12];
      const semi = shape[(s / 2) % shape.length] ?? 0;
      const note = root + 12 + (semi === 0 ? 0 : semi === 16 ? (minor ? 15 : 16) : semi);
      this.tone({
        type: driving ? 'square' : 'triangle',
        freq: midi(note),
        at,
        dur: driving ? 0.13 : 0.3,
        peak: driving ? 0.07 : 0.06,
        bus,
      });
    }

    if (!driving) return;

    // Kick / snare / hats.
    if (s === 0 || s === 8 || s === 11) {
      this.tone({ type: 'sine', freq: 150, to: 44, at, dur: 0.17, peak: 0.36, bus, attack: 0.004 });
    }
    if (s === 4 || s === 12) {
      this.noise({ at, dur: 0.12, freq: 1900, to: 900, peak: 0.13, q: 0.9, bus });
    }
    if (s % 2 === 0) {
      this.noise({ at, dur: 0.035, freq: 8200, peak: s % 4 === 0 ? 0.045 : 0.026, q: 1.2, bus });
    }
  }
}

export const audio = new AudioEngine();
