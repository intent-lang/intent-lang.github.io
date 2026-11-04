// Plays a recorded timeline (see src/recorder.ts): the keys pressed, the
// editor's prompts typed, the code changing, the intents recorded.
//
// Everything on screen is a function of the time t, so the player can be
// scrubbed and the video recorder can step it frame by frame:
//   index.html?timeline=../sessions/falling-body.timeline.json
//   index.html?record   (no controls; window.player.seek(ms) draws a moment)
//   index.html?voice=none   (without the narration; by default it is the
//                            timeline's .voice.json, from npm run narrate)

(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const timelineUrl = params.get('timeline') || '../sessions/falling-body.timeline.json';
  const voiceUrl = params.get('voice') || timelineUrl.replace(/(\.timeline)?\.json$/, '.voice.json');
  const recording = params.has('record');
  if (recording) document.body.classList.add('recording');

  // Timing, in ms (?speed=1.5 plays it faster; the session's pauses scale too)
  const speed = Number(params.get('speed')) || 1;
  const T = {
    intro: 900,        // the empty editor before the first key
    key: 150,          // between key presses
    keysAfter: 180,    // after the last key, before a prompt or the change
    promptOpen: 150,   // a prompt shown before typing in it
    char: 45,          // per typed character
    typedAfter: 220,   // after typing, before Enter
    enterAfter: 160,   // Enter pressed, before the prompt closes
    keyDown: 140,      // a key shown pressed down
    hold: 450,         // a change on screen before the next step
    navHold: 300,      // a cursor move on screen before the next step
    output: 1800,      // the build's output on screen
    newLine: 900,      // a new line's highlight fading out
    newIntent: 1400,   // a new intent's accent fading out
    caption: 260,      // a caption fading in
    voiceLead: 500,    // a say over started, before the first key
    voiceThen: 250,    // a say spoken, before its step's first key
    voiceAfter: 350,   // narration done, before the next narration
    outro: 1800,
  };
  const Timing = T;   // schedule() scales it per step (fast) as S
  for (const k of Object.keys(T)) if (!['newLine', 'newIntent', 'caption', 'keyDown', 'voiceAfter'].includes(k)) T[k] /= speed;
  const navigation = new Set(['h', 'j', 'k', 'l', 'G', 'gg']);
  const picker = /^(Select|Call it on|Uses module)/;

  const $ = id => document.getElementById(id);
  let timeline, steps = [], duration = 0;
  // The narration: a clip per section, each { url, start, ms, audio }
  let clips = [];
  // What the editor shows before the first step: the session's given work
  let opening = null;

  // --- Preparing the timeline ---

  function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // The code as lines of HTML: runs of one token kind in spans, and on each
  // line the cursor's node in one highlight from its first character, so a
  // node spanning lines reads as one block
  function codeLines(frame) {
    const code = frame.code;
    const kind = new Array(code.length).fill('');
    for (const [start, length, k] of frame.tokens || []) kind.fill(k, start, start + length);
    const tokens = (from, to) => {
      let html = '';
      for (let i = from; i < to; ) {
        let j = i + 1;
        while (j < to && kind[j] === kind[i]) j++;
        const piece = escapeHtml(code.slice(i, j));
        html += kind[i] ? '<span class="tok-' + kind[i] + '">' + piece + '</span>' : piece;
        i = j;
      }
      return html;
    };
    const lines = [];
    let start = 0;
    for (const text of code.split('\n')) {
      const end = start + text.length;
      let html;
      const c = frame.cursor;
      if (c && c.start < end && c.end > start && text.trim()) {
        const from = Math.max(c.start, start + text.length - text.trimStart().length);
        const to = Math.min(c.end, end);
        html = from < to
          ? tokens(start, from) + '<span class="cursor">' + tokens(from, to) + '</span>' + tokens(to, end)
          : tokens(start, end);
      } else {
        html = tokens(start, end);
      }
      lines.push({ text, html });
      start = end + 1;
    }
    if (lines.length && lines[lines.length - 1].text === '') lines.pop();
    return lines;
  }

  // Which of `after`'s lines are new since `before` (longest common subsequence)
  function newLines(before, after) {
    const n = before.length, m = after.length;
    const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    const added = new Set();
    let i = 0, j = 0;
    while (j < m) {
      if (i < n && before[i] === after[j]) { i++; j++; }
      else if (i < n && lcs[i + 1][j] >= lcs[i][j + 1]) i++;
      else { added.add(j); j++; }
    }
    return added;
  }

  // A say is spoken, then its step's keys play; a say over plays while the
  // steps after it do. The next narration waits for the one before: when
  // the keys are done first, the last step holds
  function schedule(voice) {
    let t = T.intro;
    opening = timeline.start
      ? { frame: { ...timeline.start, intents: [] }, lines: codeLines(timeline.start), added: new Set(), apply: -Infinity }
      : null;
    let previous = opening ? opening.lines.map(l => l.text) : [];
    let voiceEnd = 0;   // when the narration playing ends
    const holdFor = (stepsSoFar, until) => {
      if (t >= until) return;
      t = until;
      if (stepsSoFar.length) stepsSoFar[stepsSoFar.length - 1].end = t;
    };
    const byStep = new Map((voice ? voice.clips : []).map(c => [c.step, c]));
    clips = [];
    steps = [];
    timeline.frames.forEach(frame => {
      const clip = byStep.get(frame.step);
      if (clip && clip.text !== frame.say) console.warn('narration of step ' + frame.step + ' is out of date: npm run narrate');
      if (clip && clip.text === frame.say) {
        holdFor(steps, voiceEnd + T.voiceAfter);
        clips.push({ url: new URL(clip.file, new URL(voiceUrl, location.href)).href, start: t, ms: clip.ms, text: clip.text });
        voiceEnd = t + clip.ms;
        t = frame.sayOver ? t + T.voiceLead : voiceEnd + T.voiceThen;
      }
      // Every key pressed: the command's keys, then for each prompt the text
      // typed (in a picker, typed to filter) and Enter
      const step = { frame, start: t, presses: [], prompts: [] };
      // A fast-forwarded step: its keys, typing and holds take 1/fast of the time
      const f = frame.fast || 1;
      const S = Object.fromEntries(Object.entries(Timing).map(([k, v]) => [k, v / f]));
      const keys = frame.keys.join('');
      frame.keys.forEach((key, i) => step.presses.push({ t: t + i * S.key, key, command: true }));
      t += frame.keys.length * S.key + S.keysAfter;
      for (const input of frame.inputs) {
        const picked = picker.test(input.prompt);
        const prompt = { label: input.prompt, value: input.value, picked, open: t };
        t += S.promptOpen;
        prompt.typing = t;
        [...input.value].forEach((key, i) => step.presses.push({ t: t + i * S.char, key }));
        t += input.value.length * S.char + S.typedAfter;
        step.presses.push({ t, key: 'Enter' });
        t += S.enterAfter;
        prompt.close = t;
        step.prompts.push(prompt);
      }
      step.apply = t;
      step.char = S.char;
      step.lines = codeLines(frame);
      // Moving to another module shows its code, nothing new in it
      const moduleOf = texts => texts.find(l => l.startsWith('module ')) || '';
      const texts = step.lines.map(l => l.text);
      step.added = moduleOf(texts) === moduleOf(previous) ? newLines(previous, texts) : new Set();
      previous = step.lines.map(l => l.text);
      t += (navigation.has(keys) ? S.navHold : S.hold) + (frame.pauseMs || 0) / speed / f;
      if (frame.output !== undefined) t += S.output;
      step.end = t;
      steps.push(step);
    });
    holdFor(steps, voiceEnd + T.voiceAfter);
    duration = t + T.outro;
  }

  // --- Keys, as on a keyboard ---

  // A capital is Shift and its letter; letters show capitals, as keycaps do
  function keycap(key, down) {
    const cls = 'keycap' + (down ? ' down' : '');
    if (key === 'Enter') return '<span class="' + cls + ' wide">enter <span class="glyph">⏎</span></span>';
    if (key === ' ') return '<span class="' + cls + ' space">space</span>';
    if (/^[A-Z]$/.test(key))
      return '<span class="combo"><span class="' + cls + ' wide mod"><span class="glyph">⇧</span> shift</span>' +
             '<span class="' + cls + '">' + key + '</span></span>';
    return '<span class="' + cls + '">' + escapeHtml(key.toUpperCase()) + '</span>';
  }

  function keyWidth(key) {
    if (key === 'Enter') return 132;
    if (key === ' ') return 180;
    if (/^[A-Z]$/.test(key)) return 210;
    return 70;
  }

  // --- Drawing a moment ---

  let drawn = {};   // what is on screen, to skip redrawing what didn't change

  function set(id, key, value, apply) {
    if (drawn[id + key] === value) return;
    drawn[id + key] = value;
    apply(value);
  }

  function stepAt(t) {
    let s = -1;
    while (s + 1 < steps.length && steps[s + 1].start <= t) s++;
    return s;
  }

  function draw(t) {
    const s = stepAt(t);
    const step = steps[s];
    // The last step whose change has been made
    let a = s;
    if (step && step.apply > t) a = s - 1;
    const shown = steps[a] || opening;

    // Caption: the current step's, fading in when it changes
    const caption = step ? step.frame.caption || '' : '';
    set('caption', 'text', caption, v => { $('caption').textContent = v; });
    let since = 0;
    for (let k = s; k >= 0 && (steps[k].frame.caption || '') === caption; k--) since = t - steps[k].start;
    $('caption').style.opacity = String(Math.min(1, since / T.caption));

    // Code, with new lines highlighted while they fade
    set('code', 'frame', a, () => {
      $('code').innerHTML = shown
        ? shown.lines.map((l, i) => '<span class="line" data-i="' + i + '">' + l.html + '</span>').join('')
        : '';
    });
    if (shown) {
      const age = t - shown.apply;
      const strength = Math.max(0, 1 - age / T.newLine);
      for (const i of shown.added) {
        const line = $('code').querySelector('[data-i="' + i + '"]');
        if (line) line.style.background = strength > 0 ? 'rgba(61, 220, 151, ' + (0.16 * strength).toFixed(3) + ')' : '';
      }
    }
    set('title', 'text', timeline.title, v => { $('title').textContent = v; });

    set('fast', 'text', step && step.frame.fast ? '⏩ ' + step.frame.fast + '×' : '', v => { $('fast').textContent = v; });

    // The command's keys pressed so far, the one just pressed shown down, and
    // what the binding does. What is typed into a prompt shows in the prompt
    const pressed = step ? step.presses.filter(p => p.command && p.t <= t) : [];
    const keysDone = step && pressed.length >= step.frame.keys.length;
    const shownKeys = [];
    let width = 0;
    for (let i = pressed.length - 1; i >= 0; i--) {
      width += keyWidth(pressed[i].key);
      if (width > 860) break;   // two rows of the keys panel
      shownKeys.unshift(pressed[i]);
    }
    const down = pressed.length && t - pressed[pressed.length - 1].t < T.keyDown ? pressed.length - 1 : -1;
    set('keys', 'html', s + ':' + pressed.length + ':' + down, () => {
      const first = pressed.length - shownKeys.length;
      $('keycaps').innerHTML = (first > 0 ? '<span class="more">…</span>' : '') +
        shownKeys.map((p, i) => keycap(p.key, first + i === down)).join('');
    });
    set('keylabel', 'text', keysDone ? step.frame.label : '', v => { $('keylabel').textContent = v; });
    set('action', 'text', step && keysDone ? step.frame.keys.join('') + '  ' + step.frame.label : '', v => { $('action').textContent = v; });

    // The prompt being answered
    const prompt = step && step.prompts.find(p => p.open <= t && t < p.close);
    if (prompt) {
      const typed = t < prompt.typing ? ''
        : prompt.value.slice(0, Math.floor((t - prompt.typing) / step.char) + 1);
      set('prompt', 'state', prompt.label + '|' + typed, () => {
        $('prompt').hidden = false;
        $('prompt-label').textContent = prompt.picked ? prompt.label : prompt.label + ' (Enter to confirm)';
        // A picker filters as you type and shows the matching option selected
        $('prompt-text').textContent = typed;
        $('prompt-option').hidden = !prompt.picked || !typed;
        $('prompt-option').textContent = prompt.value;
      });
      $('caret').style.opacity = Math.floor(t / 500) % 2 ? '0' : '1';
    } else {
      set('prompt', 'state', '', () => { $('prompt').hidden = true; });
    }

    // The build's output, while its step is on screen
    const output = shown && shown.frame.output !== undefined && s === a ? shown.frame.output : null;
    set('terminal', 'text', output, v => {
      $('terminal').hidden = v === null;
      if (v !== null)
        $('terminal-text').innerHTML = '<span class="prompt">$</span> ./program\n' + escapeHtml(v.trimEnd());
    });

    // The intents recorded: committed transactions, then the pending ones
    set('intents', 'frame', a, () => {
      const items = [];
      if (shown) {
        const history = shown.frame.history;
        for (const tx of [...history.committed].reverse())
          items.push('<li class="commit">' + escapeHtml(tx.description) + '</li>');
        const fresh = new Set(shown.frame.intents);
        for (const summary of history.pending)
          items.push('<li class="pending" data-new="' + (fresh.has(summary) ? 1 : 0) + '">' + escapeHtml(summary) + '</li>');
      }
      $('intents').innerHTML = items.slice(-16).join('');
    });
    if (shown) {
      const fresh = t - shown.apply < T.newIntent;
      for (const li of $('intents').querySelectorAll('li[data-new="1"]')) li.classList.toggle('new', fresh);
    }

    drawn.t = t;
    $('scrub').value = String(Math.round((t / duration) * 1000));
    $('clock').textContent = (t / 1000).toFixed(1) + ' / ' + (duration / 1000).toFixed(1) + ' s';
  }

  // --- Playback ---

  let playing = !recording, origin = 0, position = 0, soundOn = true;

  function now() { return playing ? performance.now() - origin : position; }

  function seek(t) {
    position = Math.max(0, Math.min(duration, t));
    origin = performance.now() - position;
    draw(position);
    sound(position);
  }

  // The narration clip of the moment t playing at its place, the others
  // stopped; nothing while paused or recording (the video mixes the clips)
  function sound(t) {
    for (const clip of clips) {
      const at = (t - clip.start) / 1000;
      const now = playing && !recording && soundOn && at >= 0 && at < clip.ms / 1000;
      if (!now) { if (!clip.audio.paused) clip.audio.pause(); continue; }
      if (Math.abs(clip.audio.currentTime - at) > 0.25) clip.audio.currentTime = at;
      if (clip.audio.paused) clip.audio.play().catch(() => {});
    }
  }

  function loop() {
    if (playing) {
      const t = now();
      if (t >= duration) { playing = false; position = duration; $('play').textContent = 'Play'; }
      draw(Math.min(t, duration));
      sound(Math.min(t, duration));
    }
    requestAnimationFrame(loop);
  }

  // Scale the stage to the window, above the controls (none while recording)
  function fit() {
    const controls = recording ? 0 : 64;
    const height = innerHeight - controls;
    const scale = Math.min(innerWidth / 1920, height / 1080);
    $('stage').style.top = height / 2 + 'px';
    $('stage').style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
  }

  function wire() {
    $('play').addEventListener('click', () => {
      if (!playing && position >= duration) position = 0;
      playing = !playing;
      if (playing) origin = performance.now() - position; else position = now();
      $('play').textContent = playing ? 'Pause' : 'Play';
      sound(now());
    });
    $('sound').addEventListener('click', () => {
      soundOn = !soundOn;
      $('sound').textContent = soundOn ? 'Sound on' : 'Sound off';
      sound(now());
    });
    const jump = dir => {
      const t = now();
      playing = false; $('play').textContent = 'Play';
      sound(t);
      const s = stepAt(t);
      const target = dir < 0 ? steps[Math.max(0, s - (t - (steps[s] ? steps[s].start : 0) < 300 ? 1 : 0))] : steps[s + 1];
      seek(target ? (dir < 0 ? target.start : target.apply + 1) : (dir < 0 ? 0 : duration));
    };
    $('back').addEventListener('click', () => jump(-1));
    $('next').addEventListener('click', () => jump(1));
    $('scrub').addEventListener('input', e => {
      playing = false; $('play').textContent = 'Play';
      seek((Number(e.target.value) / 1000) * duration);
    });
    addEventListener('resize', fit);
  }

  // The narration is optional: without it the player plays silently
  const voiceFetch = params.get('voice') === 'none' ? Promise.resolve(null)
    : fetch(voiceUrl).then(r => (r.ok ? r.json() : null)).catch(() => null);

  fetch(timelineUrl)
    .then(r => { if (!r.ok) throw new Error(timelineUrl + ': ' + r.status); return r.json(); })
    .then(async data => {
      timeline = data;
      schedule(await voiceFetch);
      for (const clip of clips) { clip.audio = new Audio(clip.url); clip.audio.preload = 'auto'; }
      $('sound').hidden = clips.length === 0;
      // A browser plays sound only after a click: with narration, it waits for Play
      if (clips.length && !recording) { playing = false; $('play').textContent = 'Play'; }
      fit();
      wire();
      await document.fonts.ready;
      origin = performance.now();
      draw(0);
      requestAnimationFrame(loop);
      window.player = {
        duration, seek: t => { playing = false; seek(t); }, steps: steps.length, ready: true,
        // The narration: each clip's file and when it starts, for the video's sound track
        clips: clips.map(c => ({ url: c.url, start: c.start, ms: c.ms })),
        sounding: () => clips.findIndex(c => !c.audio.paused),   // the clip playing now, or -1
        // When each step starts, its prompts open and its change is made (for checks and editing the session)
        timings: steps.map(st => ({ line: st.frame.line, keys: st.frame.keys.join(''), start: st.start, apply: st.apply,
                                     prompts: st.prompts.map(p => ({ label: p.label, typing: p.typing, close: p.close })) })),
      };
    })
    .catch(e => {
      document.body.textContent = 'Could not load the timeline: ' + e.message;
      window.player = { error: e.message };
    });
})();
