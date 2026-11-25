const meditationAudio = (() => {
  const sampleRate = 22050;
  const loopSeconds = 24;
  const buffers = new Map();
  const fadeSeconds = 0.18;
  let playing;

  function addRain(samples, level) {
    let low = 0;
    let drops = 0;
    for (let i = 0; i < samples.length; i++) {
      const noise = Math.random() * 2 - 1;
      low += (noise - low) * 0.065;
      drops += (noise - drops) * 0.38;
      const swell = 0.92 + 0.08 * Math.sin(2 * Math.PI * i / samples.length);
      samples[i] += (low * 0.62 + (drops - low) * 0.38) * swell * level;
    }
  }

  function addBirdCall(samples, start, length, low, high, volume) {
    const first = Math.round(start * sampleRate);
    const count = Math.round(length * sampleRate);
    let phase = 0;
    for (let i = 0; i < count && first + i < samples.length; i++) {
      const t = i / count;
      const pitch = low + (high - low) * Math.sin(Math.PI * t) + 90 * Math.sin(35 * t);
      phase += 2 * Math.PI * pitch / sampleRate;
      const envelope = Math.sin(Math.PI * t) ** 2;
      samples[first + i] += (Math.sin(phase) + 0.18 * Math.sin(2 * phase)) * envelope * volume;
    }
  }

  function addBirds(samples) {
    addRain(samples, 0.024);
    const phrases = [
      [0.45, 3, 1740, 2900], [2.6, 2, 2510, 1770], [4.05, 4, 1450, 2350],
      [7.6, 3, 1960, 3080], [9.75, 2, 2850, 1990], [11.2, 2, 1580, 2370],
      [14.1, 4, 2180, 3050], [17.6, 3, 2410, 1690], [21, 4, 1700, 2580],
    ];
    for (const [start, notes, low, high] of phrases) {
      for (let note = 0; note < notes; note++) {
        const frequencyOffset = note * 72;
        addBirdCall(samples, start + note * 0.16, 0.10 + (note % 2) * 0.025,
          low + frequencyOffset, high + frequencyOffset, 0.13 - note * 0.013);
      }
    }
  }

  function addBowls(samples) {
    const strikes = [[0.22, 176], [6.3, 229], [12, 154], [18, 199]];
    const modes = [[1, 0.23, 2.4], [2.71, 0.092, 1.4], [4.97, 0.042, 0.87], [7.16, 0.023, 0.48]];
    for (const [start, frequency] of strikes) {
      const first = Math.round(start * sampleRate);
      const count = Math.min(samples.length - first, Math.round(7.7 * sampleRate));
      for (let i = 0; i < count; i++) {
        const t = i / sampleRate;
        const attack = Math.min(1, t / 0.024);
        let tone = 0;
        for (const [ratio, volume, decay] of modes) {
          const phase = 2 * Math.PI * frequency * ratio * t;
          tone += (Math.sin(phase) + 0.24 * Math.sin(phase * 1.005)) * volume * Math.exp(-t / decay);
        }
        samples[first + i] += attack * tone;
      }
    }
  }

  function getBuffer(context, track) {
    if (buffers.has(track)) return buffers.get(track);
    const buffer = context.createBuffer(1, loopSeconds * sampleRate, sampleRate);
    const samples = buffer.getChannelData(0);
    if (track === 'birds') addBirds(samples);
    if (track === 'rain') addRain(samples, 0.46);
    if (track === 'bowls') addBowls(samples);

    const seam = Math.round(sampleRate * 0.035);
    for (let i = 0; i < seam; i++) {
      samples[i] *= i / seam;
      samples[samples.length - 1 - i] *= i / seam;
    }
    buffers.set(track, buffer);
    return buffer;
  }

  function stop() {
    if (!playing) return;
    const {context, source, gain} = playing;
    playing = undefined;
    const now = context.currentTime;
    if (typeof gain.gain.cancelAndHoldAtTime === 'function') {
      gain.gain.cancelAndHoldAtTime(now);
    } else {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
    }
    gain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
    source.stop(now + fadeSeconds);
  }

  function play(context, track) {
    stop();
    if (track === 'none' || !context) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const now = context.currentTime;
    source.buffer = getBuffer(context, track);
    source.loop = true;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.65, now + fadeSeconds);
    source.connect(gain);
    gain.connect(context.destination);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
    source.start();
    playing = {context, source, gain};
  }

  return {play, stop};
})();
