export class AudioSystem {
  constructor() { this.context = null; this.master = null; }
  unlock() {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.context ??= new AudioContextClass();
    this.master ??= this.context.createGain();
    this.master.gain.value = 0.18;
    this.master.connect(this.context.destination);
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
  }
  playBasicAttack(classId = 'warrior') {
    this.unlock();
    if (!this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const isRanged = classId === 'mage' || classId === 'archer';
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = classId === 'mage' ? 'sine' : classId === 'archer' ? 'triangle' : 'sawtooth';
    oscillator.frequency.setValueAtTime(isRanged ? 680 : 310, now);
    oscillator.frequency.exponentialRampToValueAtTime(isRanged ? 280 : 105, now + 0.12);
    filter.type = 'highpass';
    filter.frequency.value = isRanged ? 420 : 180;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(classId === 'warrior' ? 0.48 : 0.24, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (classId === 'warrior' ? 0.16 : 0.105));
    oscillator.connect(filter).connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.17);
    if (classId === 'warrior') this.playMetalAccent(now);
  }
  playMetalAccent(now = this.context?.currentTime ?? 0) {
    if (!this.context || this.context.state !== 'running') return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(1450, now);
    oscillator.frequency.exponentialRampToValueAtTime(530, now + 0.075);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  }
  playSkill(skillId) {
    this.unlock();
    if (!this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const frequencies = { warriorWhirlwind: 430, warriorWarCry: 125, warriorIronWill: 220, warriorChains: 170 };
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = skillId === 'warriorWhirlwind' ? 'sawtooth' : 'triangle';
    oscillator.frequency.setValueAtTime(frequencies[skillId] ?? 260, now);
    oscillator.frequency.exponentialRampToValueAtTime((frequencies[skillId] ?? 260) * 1.7, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.35);
  }
  playUi(action = 'click') {
    this.unlock();
    if (!this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const frequency = action === 'upgrade' ? 740 : action === 'map' ? 520 : 390;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.35, now + 0.045);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(action === 'upgrade' ? 0.15 : 0.09, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  }
  playFootstep() {
    if (!this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const noiseBuffer = this.context.createBuffer(1, Math.floor(this.context.sampleRate * 0.055), this.context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = noiseBuffer;
    filter.type = 'lowpass'; filter.frequency.value = 420;
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.045, now + 0.008); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(now); source.stop(now + 0.06);
  }
  playGather(resource) {
    this.unlock();
    if (!this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const stone = resource === 'stone';
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = stone ? 'triangle' : 'sawtooth';
    oscillator.frequency.setValueAtTime(stone ? 1150 : 260, now);
    oscillator.frequency.exponentialRampToValueAtTime(stone ? 320 : 95, now + (stone ? 0.07 : 0.16));
    filter.type = stone ? 'highpass' : 'lowpass';
    filter.frequency.value = stone ? 700 : 480;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(stone ? 0.2 : 0.24, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (stone ? 0.11 : 0.19));
    oscillator.connect(filter).connect(gain).connect(this.master);
    oscillator.start(now); oscillator.stop(now + (stone ? 0.12 : 0.2));
  }
  playLevelUp() {
    this.unlock();
    if (!this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.085);
      gain.gain.exponentialRampToValueAtTime(0.12, now + index * 0.085 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.085 + 0.34);
      oscillator.connect(gain).connect(this.master);
      oscillator.start(now + index * 0.085);
      oscillator.stop(now + index * 0.085 + 0.36);
    });
  }
  startAmbient() {
    this.unlock();
    if (!this.context || this.ambientNodes) return;
    if (this.context.state !== 'running') {
      this.context.resume().then(() => this.startAmbient()).catch(() => {});
      return;
    }
    const nodes = [];
    [110, 164.81, 220].forEach((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.value = index === 0 ? 0.008 : 0.0035;
      oscillator.connect(gain).connect(this.master);
      oscillator.start(); nodes.push({ oscillator, gain });
    });
    this.ambientNodes = nodes;
  }
  stopAmbient() {
    for (const node of this.ambientNodes ?? []) { node.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.1); node.oscillator.stop(this.context.currentTime + 0.5); }
    this.ambientNodes = null;
  }
}
