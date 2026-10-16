'use strict';
/* =========================================================
   CÓDIGO DE SUPERVIVENCIA: MISIÓN INFORMÁTICA — UMSS
   Juego arcade en HTML5 Canvas + JavaScript puro.
   Secciones:
     1. Configuración        6. Entidades y spawn
     2. Utilidades           7. Actualización (lógica)
     3. Almacenamiento       8. Dibujo
     4. Audio                9. HUD y pantallas
     5. Estado global       10. Entradas y arranque
   ========================================================= */
(() => {

  /* ---------- 1. CONFIGURACIÓN ---------- */
  const CFG = {
    BASE: 600,            // dimensión menor del lienzo lógico (se escala a cualquier pantalla)
    PLAYER_SPEED: 340,
    PLAYER_RADIUS: 12,    // hitbox (más pequeña que el dibujo, para ser justo)
    START_LIVES: 3,
    LEVEL_SECONDS: 120,
    MAX_PARTICLES: 420,
    MAX_ENEMIES: 40,
    MAX_TEXTS: 14,
    NAME_MAX: 12,
    SCORES_KEPT: 50
  };
  const LEVEL_NAMES = ['Aprendiz', 'Desarrollador', 'Arquitecto del Código', 'Leyenda Informática'];
  const LEVEL_SUBS = {
    1: 'Sobrevive al código corrupto',
    2: 'Aparecen los gusanos informáticos',
    3: '¡Alerta! Troyanos detectados',
    4: 'Nivel máximo de amenaza'
  };
  const levelLabel = (L) => L <= LEVEL_NAMES.length
    ? LEVEL_NAMES[L - 1]
    : LEVEL_NAMES[LEVEL_NAMES.length - 1] + ' +' + (L - LEVEL_NAMES.length);

  /* ---------- 1b. MUNDOS Y FINALES (valores configurables) ---------- */
  // Puntuación mínima para entrar a cada mundo (índice 0 = Mundo 1).
  // AJUSTE DE DURACIÓN: la escala original se multiplicó x1.5 para que cada mundo dure más.
  // Se ganan ≈ 60–100 puntos por segundo. Si todavía se siente corto, multiplica todos los
  // valores de WORLD_SCORES, BOSS.SCORES, REPEAT_GAP, MIN_GAP y ENDINGS por el mismo factor.
  const WORLD_SCORES = [0, 8000, 16000, 21000, 26000];

  // Umbrales de los finales (misma escala de puntos)
  const ENDINGS = {
    LOW_MAX: 3000,             // por debajo de esta puntuación (≈ 30 s) → Final 1 "La misión continúa"
    LEGEND_MIN_BEAT: 9000,     // superar el récord sólo da el Final 3 si además se llega a esta puntuación
    LEGEND_EXCEPTIONAL: 15000  // si todavía no existe ningún récord, esta puntuación da el Final 3
  };

  // Enlace oficial de la carrera. Déjalo vacío ('') hasta tener la dirección real:
  // mientras esté vacío, el botón "CONOCE INGENIERÍA INFORMÁTICA" abre la sección interna del juego.
  const CAREER_URL = '';

  // Atajos de prueba: abre index.html?debug (ver explicación al final de la sección 10)
  const DEBUG = /[?&]debug\b/.test(window.location.search);

  const WORLDS = [
    { name: 'Ciudad Digital',   sub: 'Las luces de la red nunca se apagan',          accent: '#22e6ff', rgb: '34,230,255',
      sky: ['#02040f', '#061a46', '#0a3a78'] },
    { name: 'Red Global',       sub: 'Miles de nodos, un solo objetivo: sobrevivir', accent: '#8f7bff', rgb: '143,123,255',
      sky: ['#03021a', '#140b45', '#2a1270'] },
    { name: 'Núcleo de Datos',  sub: 'Entras al corazón del sistema',                accent: '#39ff88', rgb: '57,255,136',
      sky: ['#010a0c', '#02202a', '#043a3a'] },
    { name: 'Ciberespacio',     sub: 'La realidad virtual no perdona',               accent: '#ff3df0', rgb: '255,61,240',
      sky: ['#09011c', '#1d0640', '#3a0a5e'] },
    { name: 'Núcleo del Virus', sub: 'La zona más peligrosa del sistema',            accent: '#ff3b2d', rgb: '255,59,45',
      sky: ['#050101', '#1d0406', '#3a0d05'] }
  ];

  const ENDING_INFO = {
    1: { cls: 'end-1', icon: '▶', name: 'LA MISIÓN CONTINÚA',
         title: 'Tu misión apenas comienza',
         msg: 'Todo gran desarrollador empezó aprendiendo. Sigue practicando, supera tus límites y vuelve a intentarlo.' },
    2: { cls: 'end-2', icon: '</>', name: 'POTENCIAL DE DESARROLLADOR',
         title: 'Ya tienes potencial de desarrollador',
         msg: 'Has demostrado que puedes resolver problemas, adaptarte y avanzar. Imagina todo lo que podrás crear aprendiendo Ingeniería Informática.' },
    3: { cls: 'end-3', icon: '★', name: 'LEYENDA DEL CÓDIGO',
         title: '¡LEYENDA DEL CÓDIGO!',
         msg: 'Has llevado tus habilidades al límite. El siguiente nivel es crear tus propias soluciones, desarrollar tecnología e innovar con Ingeniería Informática.' }
  };

  const ENEMY_DEF = {
    virus:   { r: 20, hp: 1, pts: 100, spd: [85, 140],  color: '#ff2d75' },
    bug:     { r: 16, hp: 1, pts: 100, spd: [150, 225], color: '#ffb000' },
    corrupt: { r: 20, hp: 1, pts: 50,  spd: [100, 165], color: '#ff5a3c' },
    worm:    { r: 16, hp: 2, pts: 200, spd: [110, 150], color: '#a855f7' },
    trojan:  { r: 26, hp: 5, pts: 400, spd: [60, 80],   color: '#ff7a1a' }
  };
  const GLITCH = ['0xFF', 'NULL', '404', 'ERR', '}{', '#@!', 'NaN', '1/0', '???'];
  const CODE_LABELS = ['{ }', '</>', '01', 'if', '++', '=>', 'fn()'];

  const BOSS = {
    // Puntos de progreso en los que aparece cada jefe (escala x1.5 respecto al original).
    // Mantén cada valor un poco por debajo de WORLD_SCORES[i+1].
    SCORES: [8500, 15500, 25000, 25500, 30000],
    REPEAT_GAP: 5250,
    MIN_GAP: 1800,
    BONUS: [500, 1000, 1500, 2000, 3000],
    REPEAT_BONUS: 6000,
    REPEAT_HP: 35,
    ALERT_TIME: 2.8,
    ENTER_AT: 0.9,
    ENTER_TIME: 1.7,
    DYING_TIME: 2.2,
    MSG_TIME: 3,
    CRIT_AT: 0.25,
    CRIT_SPEED: 1.25,
    CRIT_RATE: 1.3,
    CONTACT_DAMAGE: true,
    MAX_MINIONS: 3,
    MINION_DELAY: 2.6,
    MAX_BULLETS: 220
  };
  const BOSS_DEFS = [
    { name: 'VIRUS ALFA', style: 'virus', color: '#ff2d75', rgb: '255,45,117', hp: 35, r: 62, spd: 0.9, rate: 0.85, fan: 0, move: 0.6,
      weights: [['rain', 5], ['corrupt', 2], ['overload', 3]] },
    { name: 'GUSANO DE RED', style: 'worm', color: '#a855f7', rgb: '168,85,247', hp: 50, r: 60, spd: 1.0, rate: 0.95, fan: 0, move: 0.75,
      weights: [['rain', 4], ['corrupt', 3], ['overload', 3]] },
    { name: 'CORRUPCIÓN DE SERVIDORES', style: 'server', color: '#39ff88', rgb: '57,255,136', hp: 70, r: 66, spd: 1.05, rate: 1.0, fan: 1, move: 0.65,
      weights: [['rain', 4], ['corrupt', 4], ['overload', 3]] },
    { name: 'ENTIDAD DIGITAL', style: 'entity', color: '#ff3df0', rgb: '255,61,240', hp: 95, r: 64, spd: 1.1, rate: 1.1, fan: 1, move: 0.85,
      weights: [['rain', 4], ['corrupt', 4], ['overload', 4]] },
    { name: 'EL BUG DEFINITIVO', style: 'bug', color: '#ff3b2d', rgb: '255,59,45', hp: 130, r: 74, spd: 1.15, rate: 1.2, fan: 2, move: 0.9,
      weights: [['rain', 4], ['corrupt', 4], ['overload', 4]] }
  ];

  /* ---------- 2. UTILIDADES ---------- */
  const $ = (id) => document.getElementById(id);
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const TAU = Math.PI * 2;
  const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };
  const fmtTime = (s) => {
    s = Math.max(0, Math.floor(s));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };
  const pick = (list) => {
    let tot = 0;
    for (const it of list) tot += it[1];
    let r = Math.random() * tot;
    for (const it of list) { r -= it[1]; if (r <= 0) return it[0]; }
    return list[0][0];
  };
  const compact = (arr) => {
    let j = 0;
    for (let i = 0; i < arr.length; i++) if (!arr[i].dead) arr[j++] = arr[i];
    arr.length = j;
  };
  const cleanName = (s) => String(s || '')
    .replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, CFG.NAME_MAX);

  /* ---------- 3. ALMACENAMIENTO (localStorage con respaldo en memoria) ---------- */
  const Store = (() => {
    const K_SCORES = 'umss_csmi_scores_v1', K_MUTE = 'umss_csmi_mute_v1', K_NAME = 'umss_csmi_lastname_v1';
    let scores = [];
    const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento: se usa memoria */ } };
    const persist = () => set(K_SCORES, JSON.stringify(scores));
    function load() {
      try {
        const a = JSON.parse(get(K_SCORES) || '[]');
        scores = Array.isArray(a) ? a
          .filter((e) => e && typeof e.name === 'string' && Number.isFinite(e.score))
          .map((e) => ({
            name: cleanName(e.name) || 'PILOTO',
            score: Math.max(0, Math.floor(e.score)),
            time: Math.max(0, Math.floor(e.time) || 0),
            level: Math.max(1, Math.floor(e.level) || 1),
            world: Math.max(1, Math.floor(e.world) || 1)
          })) : [];
      } catch (e) { scores = []; }
      scores.sort((a, b) => b.score - a.score);
    }
    return {
      load,
      add(entry) {
        scores.push(entry);
        scores.sort((a, b) => b.score - a.score);
        const rank = scores.indexOf(entry) + 1;
        scores = scores.slice(0, CFG.SCORES_KEPT);
        persist();
        return rank;
      },
      top: (n) => scores.slice(0, n),
      best: () => scores[0] || null,
      personalBest(name) {
        const k = String(name || '').toLowerCase();
        let m = 0;
        for (const e of scores) if (e.name.toLowerCase() === k && e.score > m) m = e.score;
        return m;
      },
      clear() { scores = []; persist(); },
      getMute: () => get(K_MUTE) === '1',
      setMute: (m) => set(K_MUTE, m ? '1' : '0'),
      getName: () => cleanName(get(K_NAME)),
      setName: (n) => set(K_NAME, n)
    };
  })();

  /* ---------- 4. AUDIO (sintetizado con WebAudio, sin archivos) ---------- */
  const Sound = {
    ctx: null, muted: false, silent: false, musicWanted: false, step: 0,
    unlock() {
      if (!this.ctx) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (AC) this.ctx = new AC();
        } catch (e) { this.ctx = null; }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    },
    tone(freq, dur, type, vol, slide, music) {
      if (!this.ctx || this.muted || freq <= 0) return;
      if (this.silent && !music) return;
      if (this.ctx.state !== 'running') return;
      try {
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(freq, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
        g.gain.setValueAtTime(vol || 0.05, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(t); o.stop(t + dur + 0.03);
      } catch (e) { /* ignorar errores de audio */ }
    },
    seq(freqs, gap, type, vol) { freqs.forEach((f, i) => setTimeout(() => this.tone(f, 0.14, type, vol), i * gap)); },
    shoot()   { this.tone(920, 0.07, 'square', 0.014, -520); },
    hit()     { this.tone(240, 0.06, 'square', 0.03, -60); },
    explode() { this.tone(170, 0.28, 'sawtooth', 0.05, -120); },
    pickup()  { this.seq([660, 990], 60, 'sine', 0.05); },
    power()   { this.seq([440, 660, 880], 60, 'triangle', 0.06); },
    hurt()    { this.tone(140, 0.4, 'sawtooth', 0.08, -90); },
    shield()  { this.tone(500, 0.25, 'sine', 0.06, -300); },
    levelUp() { this.seq([523, 659, 784, 1046], 90, 'square', 0.04); },
    gameOver(){ this.seq([392, 330, 262, 196], 160, 'sawtooth', 0.05); },
    alarm()   { this.seq([440, 330, 440, 330, 440], 140, 'sawtooth', 0.045); },
    warn()    { this.tone(300, 0.35, 'sawtooth', 0.04, 260); },
    zap()     { this.tone(1100, 0.3, 'sawtooth', 0.045, -900); },
    bossShot(){ this.tone(330, 0.06, 'square', 0.012, -120); },
    boom()    { this.tone(80, 0.9, 'sawtooth', 0.09, -50); this.tone(200, 0.5, 'square', 0.05, -150); },
    victory() { this.seq([523, 659, 784, 1046, 1318], 100, 'square', 0.045); }
  };
  const LEAD = [440, 0, 523, 659, 440, 0, 392, 494, 440, 0, 523, 659, 587, 0, 494, 392];
  const BASS = [110, 110, 98, 87];
  setInterval(() => {
    if (!Sound.musicWanted) return;
    const s = Sound.step++ % 16;
    if (LEAD[s]) Sound.tone(LEAD[s], 0.2, 'triangle', 0.028, 0, true);
    if (s % 4 === 0) Sound.tone(BASS[s >> 2], 0.45, 'sawtooth', 0.02, 0, true);
  }, 230);

  /* ---------- 5. ESTADO GLOBAL ---------- */
  const el = {
    app: $('app'), canvas: $('game'),
    banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
    hudScore: $('hud-score'), hudTime: $('hud-time'), hudLevel: $('hud-level'), hudLives: $('hud-lives'),
    pwSpeed: $('pw-speed'), pwFire: $('pw-fire'),
    hudWorld: $('hud-world'), worldFill: $('world-fill'), hud: $('hud'), topbar: $('topbar'),
    btnMute: $('btn-mute'), btnPause: $('btn-pause'), touchFire: $('touch-fire')
  };
  const ctx = el.canvas.getContext('2d');
  const SCREENS = ['menu', 'name', 'howto', 'pause', 'over', 'discover', 'board', 'confirm'];

  let W = 900, H = 600, S = 1, dpr = 1;
  let state = 'menu';          // menu | playing | paused | dying | over
  let currentScreen = 'menu', returnTo = 'menu';
  let playerName = 'PILOTO';

  const player = { x: 450, y: 500, vx: 0, vy: 0, tilt: 0, alive: true, shield: false, inv: 0, cool: 0, speedT: 0, fireT: 0, lives: CFG.START_LIVES };
  const bullets = [], enemies = [], ebullets = [], pickups = [], particles = [], rings = [], texts = [], stars = [];

  let time = 0, score = 0, level = 1, kills = 0, items = 0;
  let spawnT = 1, pickT = 3, shake = 0, flashA = 0, flashRGB = '255,40,80';
  let gridOff = 0, demoT = 0, deathTimer = 0, anim = 0;
  const keys = { left: false, right: false, up: false, down: false, fire: false };
  let touchFire = false, dragId = null, drag = null, touchTarget = null;
  // Mundos y finales
  let world = 0, prevWorld = 0, worldBlend = 1;   // mundo actual (0-4), anterior y avance de la transición (0→1)
  let runRecord = 0, forcedEnding = 0;           // récord al empezar la partida / final forzado (sólo modo debug)
  let bannerLock = 0, pendingBanner = null;      // evita que el aviso de nivel pise al de mundo (comparten el mismo elemento)
  let bonusScore = 0;
  const progress = () => score - bonusScore;
  let boss = null, bossDefeated = 0, nextBossScore = BOSS.SCORES[0], bossMsg = null;
  const bossBar = { x: 12, y: 12, w: 300, bottom: 56 };

  /* ---------- 6. ENTIDADES Y SPAWN ---------- */
  // La dificultad sube con el tiempo. El divisor 150 (antes 110) hace que suba más despacio,
  // para compensar que ahora cada mundo dura más.
  const difficulty = () => 1 - Math.exp(-time / 150);      // 0 → 1 de forma suave
  const speedMul = () => 0.9 + 1.1 * difficulty();

  function initStars() {
    stars.length = 0;
    for (let i = 0; i < 110; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random(), ph: Math.random() * TAU });
  }

  function resetWorld() {
    bullets.length = ebullets.length = enemies.length = pickups.length = 0;
    particles.length = rings.length = texts.length = 0;
    Object.assign(player, { x: W / 2, y: H * 0.82, vx: 0, vy: 0, tilt: 0, alive: true, shield: false, inv: 0, cool: 0, speedT: 0, fireT: 0, lives: CFG.START_LIVES });
    time = 0; score = 0; level = 1; kills = 0; items = 0;
    world = 0; prevWorld = 0; worldBlend = 1;
    bannerLock = 0; pendingBanner = null;
    boss = null; bossDefeated = 0; nextBossScore = BOSS.SCORES[0]; bossMsg = null; bonusScore = 0;
    spawnT = 1; pickT = 3; shake = 0; flashA = 0; demoT = 0; deathTimer = 0;
    touchTarget = null; dragId = null; touchFire = false;
  }

  function createEnemy(type) {
    const d = ENEMY_DEF[type];
    const margin = type === 'worm' ? d.r + 70 : d.r + 34;
    const bx = rand(margin, Math.max(margin + 1, W - margin));
    const e = {
      type, x: bx, bx, y: -d.r - 10, r: d.r, hp: d.hp, maxHp: d.hp, pts: d.pts,
      vy: rand(d.spd[0], d.spd[1]) * speedMul(), t: 0, ph: Math.random() * TAU,
      rot: 0, spin: rand(-1.5, 1.5), flash: 0, dead: false,
      label: GLITCH[randInt(0, GLITCH.length - 1)]
    };
    if (type === 'trojan') { e.hoverY = rand(110, 170); e.dir = Math.random() < 0.5 ? -1 : 1; e.life = 9; e.shootT = 1.1; e.vy = 90; }
    return e;
  }

  function spawnEnemy(demo) {
    if (enemies.length >= CFG.MAX_ENEMIES) return;
    if (boss && enemies.length >= BOSS.MAX_MINIONS) return;
    const pool = [['virus', 5], ['bug', 3], ['corrupt', 3]];
    if (!demo && level >= 2) pool.push(['worm', 3]);
    if (!demo && level >= 3 && !boss) {
      const trojans = enemies.filter((e) => e.type === 'trojan' && !e.dead).length;
      if (trojans < 1 + Math.floor((level - 2) / 2)) pool.push(['trojan', 1.6]);
    }
    enemies.push(createEnemy(pick(pool)));
  }

  function spawnPickup(kind, x, y) {
    if (!kind) {
      const wData = player.lives < CFG.START_LIVES ? 20 : 9;
      kind = pick([['code', 62], ['data', wData], ['speed', 10], ['fire', 10]]);
    }
    pickups.push({
      kind, x: x === undefined ? rand(30, W - 30) : x, y: y === undefined ? -20 : y,
      vy: rand(70, 110), r: kind === 'code' ? 20 : 16, t: 0, dead: false,
      label: CODE_LABELS[randInt(0, CODE_LABELS.length - 1)]
    });
  }

  function burst(x, y, color, n, speed, life, size) {
    n = Math.min(n, CFG.MAX_PARTICLES - particles.length);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = rand(speed * 0.3, speed), l = rand(life * 0.5, life);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: l, max: l, size: rand(size * 0.6, size), color });
    }
  }
  const ring = (x, y, color, max) => { if (rings.length < 12) rings.push({ x, y, color, max, t: 0 }); };
  function addText(str, x, y, color) {
    if (texts.length >= CFG.MAX_TEXTS) texts.shift();
    texts.push({ str, x, y, color, t: 0 });
  }
  function gain(n, x, y, color) { score += n; addText('+' + n, x, y, color || '#ffe66b'); }

  function shoot() {
    const fast = player.fireT > 0;
    player.cool = fast ? 0.12 : 0.22;
    const angles = fast ? [-0.16, 0, 0.16] : [0];
    for (const a of angles) {
      bullets.push({ x: player.x + Math.sin(a) * 6, y: player.y - 20, vx: Math.sin(a) * 720, vy: -Math.cos(a) * 720, r: 4, dead: false });
    }
    Sound.shoot();
  }

  function killEnemy(e, byPlayer) {
    if (e.dead) return;
    e.dead = true;
    const c = ENEMY_DEF[e.type].color, big = e.type === 'trojan';
    burst(e.x, e.y, c, big ? 44 : 18, big ? 280 : 200, 0.7, 3.2);
    if (big) { ring(e.x, e.y, c, 70); shake = Math.max(shake, 5); }
    Sound.explode();
    if (byPlayer && state === 'playing') {
      kills++;
      gain(e.pts, e.x, e.y, '#ffe66b');
      if (Math.random() < (big ? 1 : 0.1)) spawnPickup(big ? 'data' : 'code', e.x, e.y);
    }
  }

  function hurt() {
    if (!player.alive || player.inv > 0) return;
    if (player.shield) {
      player.shield = false; player.inv = 1.0; shake = 6;
      ring(player.x, player.y, '#22e6ff', 60); burst(player.x, player.y, '#22e6ff', 22, 220, 0.6, 3);
      Sound.shield();
      return;
    }
    player.lives--; player.inv = 1.8; shake = 12;
    flashA = 0.35; flashRGB = '255,40,80';
    burst(player.x, player.y, '#ff3b6b', 24, 240, 0.7, 3.5);
    Sound.hurt();
    if (player.lives <= 0) die();
  }

  function die() {
    player.alive = false;
    setState('dying');
    deathTimer = 0.8;
    burst(player.x, player.y, '#22e6ff', 60, 330, 1.2, 4);
    burst(player.x, player.y, '#ff2d75', 40, 260, 1.0, 4);
    ring(player.x, player.y, '#ff3b6b', 120);
    shake = 20;
    Sound.gameOver();
  }

  function collect(p) {
    p.dead = true; items++;
    switch (p.kind) {
      case 'code':
        gain(50, p.x, p.y, '#39ff88'); Sound.pickup(); burst(p.x, p.y, '#39ff88', 10, 150, 0.5, 2.5); break;
      case 'data':
        if (player.lives < CFG.START_LIVES) { player.lives++; addText('+1 VIDA', p.x, p.y, '#ff6b9a'); }
        else if (!player.shield) { player.shield = true; addText('ESCUDO', p.x, p.y, '#22e6ff'); }
        else gain(100, p.x, p.y, '#22e6ff');
        Sound.power(); ring(p.x, p.y, '#22e6ff', 50); burst(p.x, p.y, '#22e6ff', 14, 170, 0.6, 3); break;
      case 'speed':
        player.speedT = 8; addText('VELOCIDAD', p.x, p.y, '#c27bff'); Sound.power(); burst(p.x, p.y, '#c27bff', 14, 170, 0.6, 3); break;
      case 'fire':
        player.fireT = 8; addText('DISPARO x3', p.x, p.y, '#4d8dff'); Sound.power(); burst(p.x, p.y, '#4d8dff', 14, 170, 0.6, 3); break;
    }
  }

  /* ---------- 6b. MUNDOS: efectos de fondo y cambio de escenario ---------- */
  const worldFx = { streaks: [], nodes: [], packets: [], rain: [], shapes: [], embers: [], portal: 0, alertT: 2, alert: null };
  const layers = {};      // capas estáticas pre-dibujadas (ciudad, servidores, circuitos); se crean sólo cuando hacen falta
  const skyGrads = [];    // degradado de cada mundo (se recalcula al cambiar el tamaño)
  const BITS = ['0', '1'];
  const LINK_DIST = 200;  // distancia máxima para unir dos nodos de la Red Global
  const ALERTS = ['ALERTA', 'ERROR 0xDEAD', 'ACCESO DENEGADO', 'VIRUS ACTIVO', 'FALLO CRÍTICO'];
  const rackW = () => clamp(W * 0.075, 48, 86);

  // Mundo que corresponde a una puntuación (siempre depende del progreso real, nunca del azar)
  function worldFromScore(sc) {
    let w = 0;
    for (let i = 0; i < WORLD_SCORES.length; i++) if (sc >= WORLD_SCORES[i]) w = i;
    return w;
  }

  function makeLayer(paint) {
    const c = document.createElement('canvas');
    c.width = el.canvas.width; c.height = el.canvas.height;
    const g = c.getContext('2d');
    g.setTransform(dpr * S, 0, 0, dpr * S, 0, 0);
    paint(g);
    return c;
  }
  const layer = (name) => layers[name] || (layers[name] = makeLayer(LAYER_PAINT[name]));

  // Mundo 1: rascacielos con ventanas luminosas y letreros de neón
  function paintCity(g) {
    const neon = ['#22e6ff', '#2f6bff', '#39ff88', '#ff3df0'];
    for (let near = 0; near < 2; near++) {
      let x = -10;
      while (x < W) {
        const bw = rand(34, 70) * (near ? 1.15 : 0.9);
        const bh = rand(H * 0.1, H * (near ? 0.32 : 0.25));
        const y = H - bh;
        g.globalAlpha = near ? 1 : 0.7;
        g.fillStyle = near ? '#071535' : '#050d26';
        g.fillRect(x, y, bw, bh);
        g.strokeStyle = near ? 'rgba(34,230,255,0.5)' : 'rgba(47,107,255,0.35)';
        g.lineWidth = 1.5; g.strokeRect(x + 0.5, y + 0.5, bw - 1, bh);
        for (let wy = y + 8; wy < H - 6; wy += 11) {
          for (let wx = x + 6; wx < x + bw - 6; wx += 9) {
            if (Math.random() < 0.38) {
              g.fillStyle = Math.random() < 0.8 ? 'rgba(120,220,255,' + rand(0.35, 0.8).toFixed(2) + ')' : 'rgba(255,225,120,0.7)';
              g.fillRect(wx, wy, 4, 6);
            }
          }
        }
        if (near && Math.random() < 0.35) {                // letrero de neón
          const c = neon[randInt(0, neon.length - 1)];
          g.shadowColor = c; g.shadowBlur = 12; g.fillStyle = c;
          g.fillRect(x + 6, y + 4, bw - 12, 3);
          g.shadowBlur = 0;
        }
        if (Math.random() < 0.3) {                          // antena
          g.strokeStyle = 'rgba(34,230,255,0.6)'; g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(x + bw / 2, y); g.lineTo(x + bw / 2, y - rand(10, 24)); g.stroke();
        }
        x += bw + rand(2, 10);
      }
    }
    g.globalAlpha = 1;
  }

  // Mundo 3: circuitos de fondo y torres de servidores con luces LED en los costados
  function paintCore(g) {
    g.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) {
      let x = rand(0, W), y = rand(0, H);
      g.strokeStyle = 'rgba(57,255,136,' + rand(0.07, 0.17).toFixed(2) + ')';
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        if (k % 2 === 0) x += rand(-130, 130); else y += rand(-130, 130);
        g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill();
    }
    const tw = rackW();
    for (let side = 0; side < 2; side++) {
      const bx = side ? W - tw : 0;
      g.fillStyle = '#021014'; g.fillRect(bx, 0, tw, H);
      g.strokeStyle = 'rgba(57,255,136,0.4)'; g.lineWidth = 2;
      const lx = side ? bx : bx + tw;
      g.beginPath(); g.moveTo(lx, 0); g.lineTo(lx, H); g.stroke();
      for (let y = 6; y < H - 6; y += 22) {
        g.fillStyle = '#04222a'; g.fillRect(bx + 6, y, tw - 12, 16);
        g.strokeStyle = 'rgba(34,230,255,0.25)'; g.lineWidth = 1; g.strokeRect(bx + 6.5, y + 0.5, tw - 13, 15);
        for (let k = 0; k < 4; k++) {
          const r = Math.random();
          g.fillStyle = r < 0.65 ? 'rgba(57,255,136,0.9)' : (r < 0.82 ? 'rgba(255,190,60,0.9)' : 'rgba(34,230,255,0.9)');
          g.fillRect(bx + 12 + k * 7, y + 6, 4, 4);
        }
      }
    }
  }

  // Mundo 5: circuitos corruptos y fisuras de energía roja
  function paintVirus(g) {
    for (let i = 0; i < 34; i++) {
      let x = rand(0, W), y = rand(0, H);
      const hot = Math.random() < 0.35;
      g.strokeStyle = hot ? 'rgba(255,122,26,0.3)' : 'rgba(255,45,45,0.22)';
      g.lineWidth = hot ? 2 : 1.4;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        if (k % 2 === 0) x += rand(-140, 140); else y += rand(-140, 140);
        g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = g.strokeStyle; g.fillRect(x - 3, y - 3, 6, 6);
    }
    g.shadowColor = '#ff2d2d'; g.shadowBlur = 12;
    g.strokeStyle = 'rgba(255,60,40,0.38)'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      let x = rand(0, W), y = -10;
      g.beginPath(); g.moveTo(x, y);
      while (y < H) { y += rand(30, 70); x += rand(-35, 35); g.lineTo(x, y); }
      g.stroke();
    }
    g.shadowBlur = 0;
  }
  const LAYER_PAINT = { city: paintCity, core: paintCore, virus: paintVirus };

  function newRain(anywhere) {
    const tw = rackW();
    return {
      x: rand(tw + 8, Math.max(tw + 9, W - tw - 8)), y: anywhere ? rand(-H, H) : rand(-220, -20),
      v: rand(90, 210), n: randInt(6, 12), tick: 0,
      ch: Array.from({ length: 12 }, () => BITS[randInt(0, 1)])
    };
  }

  function pickLink(a) {
    const n = worldFx.nodes, A = n[a], opts = [];
    for (let i = 0; i < n.length; i++) if (i !== a && dist2(A, n[i]) < LINK_DIST * LINK_DIST) opts.push(i);
    return opts.length ? opts[randInt(0, opts.length - 1)] : randInt(0, n.length - 1);
  }

  // Se llama al iniciar y cada vez que cambia el tamaño de la pantalla
  function initWorldFx() {
    const f = worldFx;
    f.streaks = Array.from({ length: 16 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: rand(120, 320), l: rand(14, 40), c: Math.random() < 0.5 ? '#22e6ff' : '#2f6bff' }));
    f.nodes = Array.from({ length: 22 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: rand(6, 18), r: rand(2, 4.2), ph: Math.random() * TAU }));
    f.packets = Array.from({ length: 9 }, () => ({ a: randInt(0, 21), b: randInt(0, 21), t: Math.random() }));
    f.rain = Array.from({ length: 18 }, () => newRain(true));
    f.shapes = Array.from({ length: 11 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: rand(14, 34), n: [3, 4, 6][randInt(0, 2)], rot: Math.random() * TAU, vr: rand(-1, 1), v: rand(14, 40), c: Math.random() < 0.5 ? '255,61,240' : '34,230,255' }));
    f.embers = Array.from({ length: 34 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: rand(25, 90), r: rand(1, 2.6), ph: Math.random() * TAU }));
    f.portal = 0; f.alertT = 2; f.alert = null;
    for (const k in layers) delete layers[k];
    skyGrads.length = 0;
  }

  // Corre dentro de updateBackground, que no se ejecuta en pausa: la transición se congela sola
  function updateWorldFx(dt) {
    const f = worldFx;
    if (worldBlend < 1) worldBlend = Math.min(1, worldBlend + dt / 1.6);
    for (const s of f.streaks) { s.y += s.v * dt; if (s.y - s.l > H) { s.y = -rand(0, 60); s.x = Math.random() * W; } }
    for (const n of f.nodes) { n.y += n.v * dt; n.ph += dt * 2; if (n.y > H + 10) { n.y = -10; n.x = Math.random() * W; } }
    for (const p of f.packets) {
      p.t += dt * 0.7;
      if (p.t >= 1 || dist2(f.nodes[p.a], f.nodes[p.b]) > (LINK_DIST + 40) * (LINK_DIST + 40)) { p.t = 0; p.a = p.b; p.b = pickLink(p.a); }
    }
    for (const c of f.rain) {
      c.y += c.v * dt; c.tick += dt;
      if (c.tick > 0.12) { c.tick = 0; c.ch[randInt(0, 11)] = BITS[randInt(0, 1)]; }
      if (c.y - c.n * 17 > H) Object.assign(c, newRain(false));
    }
    for (const s of f.shapes) { s.y += s.v * dt; s.rot += s.vr * dt; if (s.y - s.s > H) { s.y = -s.s; s.x = Math.random() * W; } }
    for (const e of f.embers) { e.y -= e.v * dt; e.x += Math.sin(anim * 2 + e.ph) * 12 * dt; if (e.y < -6) { e.y = H + 6; e.x = Math.random() * W; } }
    f.portal = (f.portal + dt * 0.28) % 1;
    f.alertT -= dt;
    if (f.alertT <= 0) { f.alert = { x: rand(90, Math.max(91, W - 90)), y: rand(110, H * 0.6), t: 0, label: ALERTS[randInt(0, ALERTS.length - 1)] }; f.alertT = rand(2.5, 4.5); }
    if (f.alert) { f.alert.t += dt; if (f.alert.t > 1.3) f.alert = null; }
  }

  // Cambia de mundo cuando la puntuación real alcanza el umbral. No toca vidas, puntos ni enemigos.
  function checkWorld() {
    const w = Math.min(worldFromScore(progress()), bossDefeated);
    if (w <= world) return;
    prevWorld = world; world = w; worldBlend = 0;
    const info = WORLDS[w];
    showBanner('MUNDO ' + (w + 1) + '/' + WORLDS.length + ' — ' + info.name.toUpperCase(), info.sub);
    Sound.levelUp();
    ring(player.x, player.y, info.accent, 170);
    burst(player.x, player.y, info.accent, 34, 280, 0.9, 3);
    flashA = 0.25; flashRGB = info.rgb;
  }

  const bossThreshold = (n) => n < BOSS.SCORES.length
    ? BOSS.SCORES[n]
    : BOSS.SCORES[BOSS.SCORES.length - 1] + BOSS.REPEAT_GAP * (n - BOSS.SCORES.length + 1);
  const bossAlertOn = () => !!boss && boss.alertT < BOSS.ALERT_TIME;
  const bossAlertK = (b) => clamp(Math.min(b.alertT / 0.3, (BOSS.ALERT_TIME - b.alertT) / 0.5), 0, 1);
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const bossRage = (b) => 1 - b.hp / b.maxHp;
  const bossFire = (b) => b.d.rate * b.mul * (1 + 0.6 * bossRage(b)) * (b.crit ? BOSS.CRIT_RATE : 1);
  const bossSpeed = (b) => Math.min(1.45, b.d.spd * b.mul * (1 + 0.35 * bossRage(b)) * (b.crit ? 1.12 : 1));
  const BUG_FRAGS = ['{ }', '01', '</>', 'ERR', '0xBUG', 'NULL'];

  function bossHover(r) {
    return clamp((bossBar.bottom + 12) / S + r * 0.8, r + 20, Math.max(r + 40, H * 0.36));
  }

  function layoutBossBar() {
    const cw = el.app.clientWidth || window.innerWidth;
    const hr = el.hud.getBoundingClientRect(), tr = el.topbar.getBoundingClientRect();
    const left = hr.width ? hr.right + 12 : 12;
    const right = tr.width ? tr.left - 12 : cw - 12;
    let w, x, y;
    if (right - left >= 280) {
      w = Math.min(520, right - left);
      x = clamp(cw / 2 - w / 2, left, right - w);
      y = 12;
    } else {
      w = Math.min(520, cw - 24);
      x = (cw - w) / 2;
      y = (hr.height ? hr.bottom : 56) + 36;
    }
    bossBar.x = x; bossBar.y = y; bossBar.w = w; bossBar.bottom = y + 44;
  }

  function startBoss() {
    const n = bossDefeated, last = BOSS_DEFS.length - 1, di = Math.min(last, n), extra = Math.max(0, n - last);
    const d = BOSS_DEFS[di];
    layoutBossBar();
    const hp = d.hp + extra * BOSS.REPEAT_HP;
    boss = {
      d, di, n, extra, x: W / 2, y: -d.r - 30, hover: bossHover(d.r), r: d.r,
      hp, maxHp: hp, shown: 1, state: 'enter', alertT: 0, t: 0, ph: 0, rot: 0,
      flash: 0, kick: 0, inv: 0, crit: false, cd: 1.2, atk: null, last: null,
      zones: [], arcs: [], arcT: 0, barShake: 0, barA: 0, dyT: 0, fx: 0,
      rewarded: false, bonus: 0, mul: 1 + Math.min(extra, 4) * 0.08
    };
    bossMsg = null;
    Sound.alarm();
    flashA = 0.2; flashRGB = '255,40,40';
  }

  function checkBoss() {
    if (boss || bossMsg || !player.alive || progress() < nextBossScore) return;
    startBoss();
  }

  function bossShot(b, x, y, ang, v, opt) {
    if (ebullets.length >= BOSS.MAX_BULLETS) return;
    ebullets.push({
      x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, r: (opt && opt.r) || 6, dead: false,
      boss: true, sq: !!(opt && opt.sq), c: b.crit ? '#ff3b2d' : b.d.color
    });
  }

  function makeZones(b) {
    const w = clamp(W * 0.15, 80, 110);
    const count = W >= 900 ? (b.crit ? 3 : 2) : (b.di >= 1 ? 2 : 1);
    const xs = [clamp(player.x + rand(-50, 50), w / 2 + 10, W - w / 2 - 10)];
    for (let k = 1; k < count; k++) {
      for (let tries = 0; tries < 24; tries++) {
        const x = rand(w / 2 + 10, W - w / 2 - 10);
        if (xs.every((o) => Math.abs(o - x) > w * 2.2)) { xs.push(x); break; }
      }
    }
    b.zones = xs.map((x) => ({ x, w }));
  }

  function startBossAttack(b) {
    const list = b.d.weights.filter((w) => w[0] !== b.last);
    const kind = pick(list.length ? list : b.d.weights);
    b.last = kind;
    const a = { kind, t: 0, n: 0, next: 0.25, on: false, end: 0 };
    if (kind === 'rain') {
      a.dur = 2.4 + rand(0, 0.6);
    } else if (kind === 'corrupt') {
      a.mode = Math.random() < 0.55 ? 'rows' : 'ring';
      a.total = a.mode === 'rows' ? 4 + (b.di >= 3 ? 1 : 0) : 3;
      a.gap = clamp(player.x + rand(-180, 180), 120, W - 120);
      a.next = 0.4;
    } else {
      a.warn = clamp(1.9 - b.di * 0.1 - bossRage(b) * 0.4, 1.2, 2);
      a.fire = 0.55;
      a.dur = a.warn + a.fire;
      makeZones(b);
      Sound.warn();
    }
    b.atk = a;
  }

  function endBossAttack(b) {
    b.atk = null;
    b.zones.length = 0;
    b.cd = clamp(rand(1.1, 1.7) / bossFire(b), 0.45, 1.8);
  }

  function runBossAttack(b, dt) {
    const a = b.atk, sp = bossSpeed(b), fire = bossFire(b);
    a.t += dt;
    if (a.kind === 'rain') {
      a.next -= dt;
      if (a.next <= 0 && a.t < a.dur) {
        a.next = clamp(0.55 / fire, 0.22, 0.7);
        a.n++;
        const ox = b.x, oy = b.y + b.r * 0.6, v = Math.min(330, 200 * sp);
        const aim = Math.atan2(player.y - oy, player.x - ox), m = a.n % 3;
        if (m === 0) {
          const c = 3 + b.d.fan + (b.crit ? 2 : 0);
          for (let i = 0; i < c; i++) bossShot(b, ox, oy, aim + (i - (c - 1) / 2) * 0.24, v);
        } else if (m === 1) {
          for (const dx of [-0.8, 0, 0.8]) bossShot(b, ox + dx * b.r, oy, Math.PI / 2, v * 1.05);
        } else {
          bossShot(b, ox, oy, aim, v * 1.15, { r: 7 });
          if (b.crit) { bossShot(b, ox, oy, aim - 0.2, v); bossShot(b, ox, oy, aim + 0.2, v); }
        }
        Sound.bossShot();
      }
      if (a.t >= a.dur + 0.4) endBossAttack(b);
    } else if (a.kind === 'corrupt') {
      a.next -= dt;
      if (a.next <= 0 && a.n < a.total) {
        const iv = clamp(0.95 / fire, 0.6, 1.1), v = 150 * sp, oy = b.y + b.r * 0.7;
        a.next = iv;
        if (a.mode === 'rows') {
          const st = clamp(W / 14, 40, 56), half = st * 1.6;
          if (a.n > 0) a.gap += rand(-1, 1) * Math.min(150, iv * 200);
          a.gap = clamp(a.gap, half + 26, W - half - 26);
          for (let x = 24; x <= W - 24; x += st) if (Math.abs(x - a.gap) > half) bossShot(b, x, oy, Math.PI / 2, v, { sq: true });
        } else {
          const c = 22, off = rand(0, TAU), half = TAU / c * 2.2;
          const aim = Math.atan2(player.y - b.y, player.x - b.x) + rand(-0.5, 0.5);
          for (let i = 0; i < c; i++) {
            const ang = off + i * TAU / c;
            const df = Math.abs((((ang - aim + Math.PI) % TAU) + TAU) % TAU - Math.PI);
            if (df > half) bossShot(b, b.x, b.y, ang, 130 * sp, { sq: true });
          }
        }
        Sound.bossShot();
        a.n++;
        if (a.n >= a.total) a.end = a.t + 0.7;
      }
      if (a.end && a.t >= a.end) endBossAttack(b);
    } else {
      const was = a.on;
      a.on = a.t >= a.warn && a.t < a.dur;
      if (a.on && !was) { Sound.zap(); shake = Math.max(shake, 6); }
      if (a.on && Math.random() < 0.6) {
        const z = b.zones[randInt(0, b.zones.length - 1)];
        burst(z.x + rand(-z.w / 2, z.w / 2), rand(0, H), '#ffb27a', 3, 160, 0.4, 2.5);
      }
      if (a.t >= a.dur) endBossAttack(b);
    }
  }

  function updateBossFx(b, dt) {
    b.arcT -= dt;
    if (b.arcT <= 0) {
      b.arcT = b.crit ? 0.05 : 0.09;
      b.arcs.length = 0;
      const n = b.crit ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const a0 = rand(0, TAU), len = b.r * rand(0.9, 1.4), pts = [];
        for (let k = 0; k <= 5; k++) {
          const d = b.r * 0.5 + len * k / 5 * 0.75;
          pts.push([Math.cos(a0) * d + (k ? rand(-9, 9) : 0), Math.sin(a0) * d + (k ? rand(-9, 9) : 0)]);
        }
        b.arcs.push(pts);
      }
    }
    if (b.state !== 'dying' && particles.length < CFG.MAX_PARTICLES - 30 && Math.random() < dt * (b.crit ? 40 : 18)) {
      const a = rand(0, TAU), d = b.r * rand(0.9, 1.3), c = b.crit ? '#ff3b2d' : b.d.color;
      particles.push({
        x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d,
        vx: -Math.sin(a) * 40 + rand(-15, 15), vy: Math.cos(a) * 40 + rand(-15, 15) - (b.crit ? 35 : 0),
        life: 0.6, max: 0.6, size: rand(2, 3.4), color: c
      });
    }
  }

  function updateBoss(dt) {
    const b = boss;
    b.t += dt; b.rot += dt;
    b.flash = Math.max(0, b.flash - dt);
    b.inv = Math.max(0, b.inv - dt);
    b.kick *= Math.max(0, 1 - dt * 9);
    b.barShake = Math.max(0, b.barShake - dt);
    b.shown += (b.hp / b.maxHp - b.shown) * Math.min(1, dt * 2.2);
    if (b.alertT < BOSS.ALERT_TIME) b.alertT += dt;
    updateBossFx(b, dt);

    if (b.state === 'enter') {
      const p = (b.alertT - BOSS.ENTER_AT) / BOSS.ENTER_TIME;
      b.y = -b.r - 30 + (b.hover + b.r + 30) * easeOut(p);
      b.barA = clamp(p, 0, 1);
      if (p >= 1) { b.state = 'fight'; b.y = b.hover; b.inv = 0.4; b.barA = 1; }
      return;
    }

    if (b.state === 'dying') {
      b.dyT += dt;
      b.barA = Math.max(0, b.barA - dt * 3);
      b.fx -= dt;
      if (b.fx <= 0) {
        b.fx = 0.1;
        const a = rand(0, TAU), d = rand(0, b.r * 0.9);
        burst(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, pick([[b.d.color, 3], ['#ffe66b', 2], ['#ffffff', 1]]), 14, 260, 0.7, 3.4);
        if (Math.random() < 0.5) ring(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, b.d.color, 60);
        Sound.explode();
        shake = Math.max(shake, 5 + b.dyT * 4);
      }
      if (b.dyT >= BOSS.DYING_TIME) finishBoss(b);
      return;
    }

    const charging = b.atk && b.atk.kind === 'overload';
    b.ph += dt * b.d.move * (b.crit ? BOSS.CRIT_SPEED : 1) * (charging ? 0.35 : 1);
    const amp = Math.max(0, Math.min(W * 0.3, W / 2 - b.r - 20));
    b.x += (W / 2 + Math.sin(b.ph) * amp - b.x) * Math.min(1, dt * 4);
    b.y = b.hover + Math.sin(b.t * 1.4) * 8;

    if (b.atk) runBossAttack(b, dt);
    else { b.cd -= dt; if (b.cd <= 0) startBossAttack(b); }
  }

  function enterCrit(b) {
    b.crit = true;
    b.inv = 1;
    b.cd = Math.min(b.cd, 0.8);
    flashA = 0.35; flashRGB = '255,40,40';
    shake = Math.max(shake, 10);
    ring(b.x, b.y, '#ff3b2d', 140); ring(b.x, b.y, '#ffb000', 90);
    burst(b.x, b.y, '#ff3b2d', 40, 300, 0.9, 3.5);
    bossMsg = { title: 'FASE CRÍTICA', sub: '', t: 0, dur: 1.6, color: '#ff3b2d' };
    Sound.alarm();
  }

  function hitBoss(b, bl) {
    bl.dead = true;
    if (b.inv > 0) {
      ring(bl.x, bl.y, '#22e6ff', 26);
      burst(bl.x, bl.y, '#22e6ff', 3, 120, 0.3, 2);
      return;
    }
    b.hp = Math.max(0, b.hp - 1);
    b.flash = 0.09;
    b.kick = Math.min(b.kick + 2.5, 7);
    b.barShake = 0.2;
    score += 5;
    burst(bl.x, bl.y, b.crit ? '#ff3b2d' : b.d.color, 4, 140, 0.3, 2.4);
    Sound.hit();
    if (b.hp <= 0) defeatBoss(b);
    else if (!b.crit && b.hp <= b.maxHp * BOSS.CRIT_AT) enterCrit(b);
  }

  function defeatBoss(b) {
    b.state = 'dying'; b.dyT = 0; b.fx = 0; b.atk = null; b.zones.length = 0;
    for (const e of ebullets) {
      if (!e.boss) continue;
      e.dead = true;
      burst(e.x, e.y, e.c, 2, 90, 0.4, 2);
    }
    compact(ebullets);
    if (!b.rewarded) {
      b.rewarded = true;
      b.bonus = b.extra > 0 ? BOSS.REPEAT_BONUS : BOSS.BONUS[b.di];
      kills++;
      score += b.bonus;
      bonusScore += b.bonus;
      addText('+' + b.bonus, b.x, b.y + b.r, '#ffe66b');
      bossDefeated++;
      nextBossScore = Math.max(bossThreshold(bossDefeated), Math.floor(progress()) + BOSS.MIN_GAP);
    }
    bossMsg = null;
    flashA = 0.3; flashRGB = '255,255,255';
    shake = Math.max(shake, 10);
    Sound.explode();
  }

  function finishBoss(b) {
    burst(b.x, b.y, b.d.color, 80, 380, 1.2, 4.5);
    burst(b.x, b.y, '#ffffff', 40, 300, 0.8, 3.5);
    burst(b.x, b.y, '#ffe66b', 40, 260, 1.0, 3);
    ring(b.x, b.y, '#ffffff', 220); ring(b.x, b.y, b.d.color, 160); ring(b.x, b.y, '#ffe66b', 110);
    shake = 22;
    flashA = 0.6; flashRGB = '255,255,255';
    Sound.boom();
    setTimeout(() => Sound.victory(), 450);
    for (const e of enemies) killEnemy(e, false);
    spawnPickup('data', b.x - 24, b.y);
    spawnPickup(pick([['fire', 1], ['speed', 1]]), b.x + 24, b.y);
    for (let i = 0; i < 3; i++) spawnPickup('code', b.x + rand(-70, 70), b.y + rand(-20, 20));
    bossMsg = { title: '¡BUG ELIMINADO!', sub: 'BONIFICACIÓN +' + b.bonus, t: 0, dur: BOSS.MSG_TIME, color: '#39ff88' };
    boss = null;
  }

  function bossCore(b, r, y, size) {
    const cr = r * size * (0.85 + 0.15 * Math.sin(b.t * 6));
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, y, 0, 0, y, cr * 2.6);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,50,50,0.95)'); g.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, y, cr * 2.6, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ff1a1a'; ctx.beginPath(); ctx.arc(0, y, cr, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(-cr * 0.3, y - cr * 0.3, cr * 0.28, 0, TAU); ctx.fill();
  }

  function bossEyes(b, r, ex, ey, size) {
    const er = r * size * (0.85 + 0.15 * Math.sin(b.t * 6));
    ctx.globalCompositeOperation = 'lighter';
    for (const s of [-1, 1]) {
      const x = s * r * ex, y = -r * ey;
      const g = ctx.createRadialGradient(x, y, 0, x, y, er * 2.4);
      g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.25, 'rgba(255,40,40,0.95)'); g.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, er * 2.4, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const s of [-1, 1]) {
      const x = s * r * ex, y = -r * ey;
      ctx.fillStyle = '#ff1a1a'; ctx.beginPath(); ctx.arc(x, y, er * 0.9, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - er * 0.25, y - er * 0.25, er * 0.25, 0, TAU); ctx.fill();
    }
  }

  function bossBodyVirus(b, r, col, rgb) {
    const n = 12;
    ctx.save(); ctx.rotate(b.rot * 0.5);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n, ca = Math.cos(a), sa = Math.sin(a), ext = 1.3 + 0.1 * Math.sin(b.t * 5 + i);
      ctx.moveTo(ca * r * 0.85, sa * r * 0.85); ctx.lineTo(ca * r * ext, sa * r * ext);
    }
    glowStroke(col, 3);
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) { const a = i * TAU / n; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.32, Math.sin(a) * r * 1.32, 4.5, 0, TAU); ctx.fill(); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.88, 0, TAU);
    ctx.fillStyle = 'rgba(' + rgb + ',0.2)'; ctx.fill(); glowStroke(col, 3);
    ctx.save(); ctx.rotate(-b.rot);
    ctx.beginPath(); polyPath(0, 0, r * 0.6, 6, 0); glowStroke(col, 1.5);
    ctx.restore();
    bossEyes(b, r, 0.3, 0.12, 0.2);
  }

  function bossBodyWorm(b, r, col, rgb) {
    const n = 9;
    for (let i = n - 1; i >= 1; i--) {
      const a = b.rot * 0.9 + i * TAU / n, rr = r * (0.78 + 0.1 * Math.sin(b.t * 3 + i)), sr = r * (0.27 - i * 0.012);
      ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, sr, 0, TAU);
      ctx.fillStyle = 'rgba(' + rgb + ',0.28)'; ctx.fill(); glowStroke(col, 2.5);
    }
    ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, TAU);
    ctx.fillStyle = 'rgba(' + rgb + ',0.16)'; ctx.fill(); glowStroke(col, 2);
    const ha = b.rot * 0.9, hx = Math.cos(ha) * r * 0.8, hy = Math.sin(ha) * r * 0.8;
    ctx.beginPath(); ctx.arc(hx, hy, r * 0.34, 0, TAU);
    ctx.fillStyle = 'rgba(' + rgb + ',0.45)'; ctx.fill(); glowStroke(col, 3);
    ctx.fillStyle = '#ff1a1a';
    ctx.beginPath();
    ctx.arc(hx + Math.cos(ha + 0.5) * r * 0.16, hy + Math.sin(ha + 0.5) * r * 0.16, 4, 0, TAU);
    ctx.arc(hx + Math.cos(ha - 0.5) * r * 0.16, hy + Math.sin(ha - 0.5) * r * 0.16, 4, 0, TAU);
    ctx.fill();
    bossCore(b, r, 0, 0.26);
  }

  function bossBodyServer(b, r, col, rgb) {
    const w = r * 0.85, h = r * 0.95, rows = 6, rh = h * 2 / rows;
    ctx.beginPath(); ctx.rect(-w, -h, w * 2, h * 2);
    ctx.fillStyle = 'rgba(2,20,18,0.9)'; ctx.fill(); glowStroke(col, 3);
    for (let i = 0; i < rows; i++) {
      const y = -h + i * rh, gl = Math.sin(b.t * 17 + i * 3.1) > 0.85 ? (i % 2 ? 7 : -7) : 0;
      ctx.beginPath(); ctx.rect(-w + 6 + gl, y + 4, w * 2 - 12, rh - 8);
      ctx.fillStyle = 'rgba(' + rgb + ',0.12)'; ctx.fill();
      ctx.strokeStyle = 'rgba(' + rgb + ',0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
      for (let k = 0; k < 5; k++) {
        const on = Math.sin(b.t * 5 + i * 1.7 + k * 2.3) > -0.2;
        ctx.fillStyle = on ? (k % 3 === 0 ? '#ffb000' : col) : 'rgba(255,255,255,0.12)';
        ctx.fillRect(-w + 12 + k * 9 + gl, y + rh / 2 - 2, 5, 5);
      }
    }
    if (Math.sin(b.t * 9) * Math.sin(b.t * 3.3) > 0.6) {
      ctx.fillStyle = 'rgba(255,60,60,0.35)';
      ctx.fillRect(-w - 8, -h + ((Math.floor(b.t * 20) * 37) % 100) / 100 * h * 2, w * 2 + 16, 5);
    }
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * w, -h * 0.3);
      ctx.quadraticCurveTo(s * (w + 24), -h * 0.1 + Math.sin(b.t * 3) * 10, s * (w + 10), h * 0.55);
      glowStroke(col, 2.5);
    }
    ctx.fillStyle = 'rgba(2,20,18,0.95)'; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, TAU); ctx.fill(); glowStroke(col, 2);
    bossCore(b, r, 0, 0.22);
  }

  function bossBodyEntity(b, r, col, rgb) {
    ctx.save(); ctx.rotate(b.rot * 0.7);
    ctx.beginPath(); polyPath(0, 0, r * 0.95, 6, 0);
    ctx.fillStyle = 'rgba(' + rgb + ',0.12)'; ctx.fill(); glowStroke(col, 3);
    ctx.restore();
    ctx.save(); ctx.rotate(-b.rot * 1.1);
    ctx.beginPath(); polyPath(0, 0, r * 0.72, 3, 0); glowStroke('#22e6ff', 2);
    ctx.beginPath(); polyPath(0, 0, r * 0.72, 3, Math.PI); glowStroke('#22e6ff', 2);
    ctx.restore();
    ctx.save(); ctx.rotate(b.rot * 1.6);
    ctx.beginPath(); polyPath(0, 0, r * 0.44, 4, 0);
    ctx.fillStyle = 'rgba(' + rgb + ',0.25)'; ctx.fill(); glowStroke(col, 2);
    ctx.restore();
    for (let i = 0; i < 6; i++) {
      const a = b.rot * 1.2 + i * TAU / 6, d = r * 1.12 + Math.sin(b.t * 3 + i) * 6;
      ctx.save(); ctx.translate(Math.cos(a) * d, Math.sin(a) * d); ctx.rotate(a * 2);
      ctx.beginPath(); polyPath(0, 0, 7, 3, 0);
      ctx.fillStyle = i % 2 ? '#22e6ff' : col; ctx.fill();
      ctx.restore();
    }
    bossCore(b, r, 0, 0.26);
  }

  function bossBodyBug(b, r, col, rgb) {
    const w = Math.sin(b.t * 6);
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const ph = Math.sin(b.t * 5 + k * 1.3 + (s > 0 ? 1.5 : 0));
        const y0 = (k - 1) * r * 0.42, jx = s * (r * 1.1 + ph * 5), jy = (k - 1) * r * 0.7 - r * 0.15;
        const fx = s * r * 1.38, fy = (k - 1) * r * 0.95 + r * 0.3 + ph * 7;
        ctx.beginPath(); ctx.moveTo(s * r * 0.6, y0); ctx.lineTo(jx, jy); ctx.lineTo(fx, fy);
        glowStroke(col, 3);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(jx, jy, 3.5, 0, TAU); ctx.fill();
      }
      ctx.beginPath(); ctx.moveTo(s * r * 0.2, -r * 0.8);
      ctx.quadraticCurveTo(s * r * 0.7, -r * 1.2 - w * 6, s * r * (0.6 + 0.1 * w), -r * 1.5);
      glowStroke(col, 2.5);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(s * r * (0.6 + 0.1 * w), -r * 1.5, 3, 0, TAU); ctx.fill();
    }
    ctx.lineCap = 'butt';
    ctx.beginPath(); polyPath(0, 0, r * 0.92, 6, Math.PI / 6);
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, 'rgba(' + rgb + ',0.38)'); g.addColorStop(1, 'rgba(20,0,5,0.92)');
    ctx.fillStyle = g; ctx.fill(); glowStroke(col, 3.5);
    ctx.setLineDash([8, 6]); ctx.lineDashOffset = -b.t * 40;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + Math.PI / 6, px = Math.cos(a) * r * 0.86, py = Math.sin(a) * r * 0.86, mx = px * 0.5, my = py * 0.5;
      ctx.moveTo(px, py); ctx.lineTo(px, my); ctx.lineTo(mx, my); ctx.lineTo(mx * 0.45, my * 0.45);
    }
    ctx.strokeStyle = 'rgba(255,170,120,0.8)'; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = col;
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 + Math.PI / 6;
      ctx.fillRect(Math.cos(a) * r * 0.86 - 3, Math.sin(a) * r * 0.86 - 3, 6, 6);
    }
    ctx.beginPath(); polyPath(0, 0, r * 0.5, 6, 0); ctx.strokeStyle = 'rgba(' + rgb + ',0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * r * 0.15, r * 0.7);
      ctx.quadraticCurveTo(s * r * 0.55, r * 1.05, s * r * 0.25, r * 1.2 + w * 3);
      glowStroke(col, 2.5);
    }
    ctx.lineCap = 'butt';
    bossEyes(b, r, 0.32, 0.3, 0.2);
    bossCore(b, r, r * 0.3, 0.16);
    ctx.font = 'bold 14px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 6; i++) {
      const a = -b.rot * 0.8 + i * TAU / 6, d = r * 1.22 + Math.sin(b.t * 2 + i) * 8;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = i % 3 === 0 ? '#22e6ff' : (i % 3 === 1 ? '#ffb000' : col);
      ctx.fillText(BUG_FRAGS[i], Math.cos(a) * d, Math.sin(a) * d);
    }
    ctx.globalAlpha = 1;
  }

  const BOSS_BODIES = { virus: bossBodyVirus, worm: bossBodyWorm, server: bossBodyServer, entity: bossBodyEntity, bug: bossBodyBug };

  function drawBoss(b) {
    const r = b.r, crit = b.crit, col = crit ? '#ff2a2a' : b.d.color, rgb = crit ? '255,42,42' : b.d.rgb;
    const dying = b.state === 'dying', amp = crit ? 2 : 0, ja = dying ? 2 + b.dyT * 3 : amp;
    const jx = ja ? rand(-ja, ja) : 0, jy = ja ? rand(-ja, ja) * 0.7 : 0;
    ctx.save();
    ctx.translate(b.x + jx, b.y - b.kick + jy);
    if (b.flash > 0) ctx.scale(1.04, 1.04);

    ctx.globalCompositeOperation = 'lighter';
    const ak = bossAlertOn() ? bossAlertK(b) : 0;
    const ag = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * (1.8 + ak * 0.9));
    ag.addColorStop(0, 'rgba(' + rgb + ',' + (0.26 + ak * 0.3 + (crit ? 0.1 * (0.5 + 0.5 * Math.sin(b.t * 12)) : 0)).toFixed(3) + ')');
    ag.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(0, 0, r * (1.8 + ak * 0.9), 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    BOSS_BODIES[b.d.style](b, r, col, rgb);

    if (crit) {
      ctx.fillStyle = 'rgba(255,0,0,' + (0.1 + 0.08 * Math.sin(b.t * 14)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,60,40,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = i * 1.26 + 0.5;
        ctx.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
        ctx.lineTo(Math.cos(a + 0.2) * r * 0.6, Math.sin(a + 0.2) * r * 0.6);
        ctx.lineTo(Math.cos(a - 0.1) * r * 0.95, Math.sin(a - 0.1) * r * 0.95);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = crit ? 'rgba(255,130,100,0.9)' : 'rgba(180,240,255,0.9)'; ctx.lineWidth = 2;
    for (const pts of b.arcs) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
    if (b.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.65 * b.flash / 0.09).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    if (b.state === 'fight' && b.inv > 0) {
      ctx.strokeStyle = 'rgba(34,230,255,0.85)'; ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -b.t * 60;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.1, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    const a = b.atk;
    if (a && a.kind === 'overload' && a.t < a.warn) {
      const p = a.t / a.warn;
      ctx.strokeStyle = 'rgba(255,60,40,' + (0.4 + 0.5 * p).toFixed(2) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r * (1.7 - 0.6 * p), 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBossZones() {
    const b = boss, a = b && b.atk;
    if (!a || a.kind !== 'overload') return;
    for (const z of b.zones) {
      const x0 = z.x - z.w / 2;
      if (a.t < a.warn) {
        const p = a.t / a.warn, blink = 0.5 + 0.5 * Math.sin(a.t * (10 + p * 22));
        ctx.fillStyle = 'rgba(255,50,40,' + (0.08 + 0.14 * p + 0.08 * blink).toFixed(3) + ')';
        ctx.fillRect(x0, 0, z.w, H);
        ctx.fillStyle = 'rgba(255,200,120,' + (0.25 * p).toFixed(3) + ')';
        ctx.fillRect(z.x - z.w * 0.18 * p, 0, z.w * 0.36 * p, H);
        ctx.strokeStyle = 'rgba(255,90,60,' + (0.5 + 0.4 * blink).toFixed(2) + ')'; ctx.lineWidth = 2;
        ctx.setLineDash([14, 10]); ctx.lineDashOffset = -anim * 60;
        ctx.strokeRect(x0, -4, z.w, H + 8);
        ctx.setLineDash([]);
        ctx.beginPath(); polyPath(z.x, H * 0.5, 22, 3, -Math.PI / 2);
        ctx.strokeStyle = 'rgba(255,200,80,' + (0.5 + 0.5 * blink).toFixed(2) + ')'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = 'rgba(255,200,80,' + (0.5 + 0.5 * blink).toFixed(2) + ')';
        ctx.font = 'bold 20px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('!', z.x, H * 0.5 + 4);
      } else {
        const k = 1 - (a.t - a.warn) / a.fire * 0.5;
        const g = ctx.createLinearGradient(x0, 0, x0 + z.w, 0);
        g.addColorStop(0, 'rgba(255,60,40,0)'); g.addColorStop(0.25, 'rgba(255,90,50,0.85)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.95)'); g.addColorStop(0.75, 'rgba(255,90,50,0.85)'); g.addColorStop(1, 'rgba(255,60,40,0)');
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = k;
        ctx.fillStyle = g; ctx.fillRect(x0, 0, z.w, H);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  function drawBossBar(b) {
    const { x, y, w } = bossBar, h = 14, frac = Math.max(0, b.hp / b.maxHp), col = b.crit ? '#ff3b2d' : b.d.color;
    const sh = b.barShake > 0 ? b.barShake / 0.2 : 0;
    ctx.save();
    ctx.globalAlpha = b.barA;
    ctx.translate(sh ? rand(-3, 3) * sh : 0, sh ? rand(-2, 2) * sh : 0);
    let fs = 13;
    ctx.font = 'bold ' + fs + 'px Consolas, monospace';
    while (ctx.measureText(b.d.name).width > w - 54 && fs > 9) { fs--; ctx.font = 'bold ' + fs + 'px Consolas, monospace'; }
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.shadowColor = col; ctx.shadowBlur = 8;
    ctx.fillStyle = col; ctx.fillText(b.d.name, x, y + 12);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff';
    ctx.fillText(Math.ceil(frac * 100) + '%', x + w, y + 12);
    const by = y + 18;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x, by, w, h);
    ctx.fillStyle = 'rgba(255,230,160,0.85)'; ctx.fillRect(x, by, w * Math.max(frac, b.shown), h);
    ctx.fillStyle = b.flash > 0 ? '#ffffff' : col; ctx.fillRect(x, by, w * frac, h);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    for (const p of [0.25, 0.5, 0.75]) ctx.fillRect(x + w * p - 1, by, 2, h);
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(x - 0.5, by - 0.5, w + 1, h + 1);
    ctx.restore();
  }

  function drawBossAlert(cw, ch, b) {
    const t = b.alertT, k = bossAlertK(b), on = Math.floor(t * 7) % 2 === 0;
    const bh = clamp(ch * 0.11, 54, 96) * easeOut(k * 1.4), cy = ch * 0.42, y0 = cy - bh / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(40,0,0,' + (0.62 * k).toFixed(3) + ')'; ctx.fillRect(0, y0, cw, bh);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y0 - 9, cw, bh + 18); ctx.clip();
    ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 5;
    const off = (t * 70) % 24;
    ctx.beginPath();
    for (let x = -30 + off; x < cw + 30; x += 24) {
      ctx.moveTo(x, y0); ctx.lineTo(x + 9, y0 - 9);
      ctx.moveTo(x, y0 + bh + 9); ctx.lineTo(x + 9, y0 + bh);
    }
    ctx.stroke();
    ctx.restore();
    if (k > 0.6) {
      const txt = '⚠ ALERTA: JEFE DETECTADO ⚠';
      let fs = clamp(cw * 0.05, 16, 38);
      ctx.font = 'bold ' + fs + 'px Consolas, monospace';
      const tw = ctx.measureText(txt).width;
      if (tw > cw * 0.92) { fs *= cw * 0.92 / tw; ctx.font = 'bold ' + fs + 'px Consolas, monospace'; }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ff2a2a'; ctx.shadowBlur = 18;
      ctx.fillStyle = on ? '#ff4d3d' : '#ffffff';
      ctx.fillText(txt, cw / 2, cy - fs * 0.35);
      ctx.shadowBlur = 0;
      ctx.font = 'bold ' + Math.max(11, fs * 0.5) + 'px Consolas, monospace';
      ctx.fillStyle = '#ffd0c8';
      ctx.fillText(b.d.name, cw / 2, cy + fs * 0.55);
    }
    ctx.restore();
  }

  function drawBossMsg(cw, ch) {
    const m = bossMsg, inT = clamp(m.t / 0.35, 0, 1);
    const al = clamp(Math.min(1, m.t / 0.12, (m.dur - m.t) / 0.6), 0, 1);
    const sc = 1 + (1 - easeOut(inT)) * 0.9 + 0.02 * Math.sin(m.t * 10);
    let fs = clamp(cw * 0.07, 22, 66);
    ctx.font = 'bold ' + fs + 'px Consolas, monospace';
    const tw = ctx.measureText(m.title).width * 1.1;
    if (tw > cw * 0.9) fs *= cw * 0.9 / tw;
    ctx.save();
    ctx.globalAlpha = al;
    ctx.translate(cw / 2, ch * 0.46); ctx.scale(sc, sc);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = 'bold ' + fs + 'px Consolas, monospace';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.strokeText(m.title, 0, 0);
    ctx.shadowColor = m.color; ctx.shadowBlur = 24;
    ctx.fillStyle = m.color; ctx.fillText(m.title, 0, 0);
    if (m.sub) {
      ctx.shadowBlur = 0;
      ctx.font = 'bold ' + Math.max(12, fs * 0.4) + 'px Consolas, monospace';
      ctx.lineWidth = 4; ctx.strokeText(m.sub, 0, fs * 0.9);
      ctx.fillStyle = '#ffe66b'; ctx.fillText(m.sub, 0, fs * 0.9);
    }
    ctx.restore();
  }

  function drawBossUI() {
    const cw = el.canvas.width / dpr, ch = el.canvas.height / dpr;
    if (boss && boss.barA > 0.01) drawBossBar(boss);
    if (boss && bossAlertOn()) drawBossAlert(cw, ch, boss);
    if (bossMsg) drawBossMsg(cw, ch);
  }

  /* ---------- 7. ACTUALIZACIÓN (lógica del juego) ---------- */
  function checkLevel() {
    const nl = 1 + Math.floor(time / CFG.LEVEL_SECONDS);
    if (nl > level) {
      level = nl;
      queueBanner('NIVEL ' + level + ' · ' + levelLabel(level).toUpperCase(), LEVEL_SUBS[Math.min(level, 4)]);
      Sound.levelUp();
      ring(player.x, player.y, '#22e6ff', 160); ring(player.x, player.y, '#a855f7', 110);
      burst(player.x, player.y, '#39ff88', 30, 260, 0.9, 3);
      flashA = 0.3; flashRGB = '34,230,255';
      gain(500, player.x, player.y - 30, '#39ff88');
    }
  }

  function updatePlayer(dt, demo) {
    const p = player, px = p.x;
    p.inv = Math.max(0, p.inv - dt);
    p.speedT = Math.max(0, p.speedT - dt);
    p.fireT = Math.max(0, p.fireT - dt);
    p.cool -= dt;
    let fire = false;
    if (demo) {
      demoT += dt;
      const tx = W * 0.5 + Math.sin(demoT * 0.8) * W * 0.3;
      p.x += (tx - p.x) * Math.min(1, dt * 2.5);
      p.y = H * 0.84 + Math.sin(demoT * 1.6) * 10;
      fire = true;
    } else {
      if (touchTarget) {
        const k = Math.min(1, dt * 22);
        p.x += (touchTarget.x - p.x) * k; p.y += (touchTarget.y - p.y) * k;
        p.vx = p.vy = 0;
      } else {
        let ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        let iy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
        if (ix && iy) { ix *= 0.7071; iy *= 0.7071; }
        const sp = CFG.PLAYER_SPEED * (p.speedT > 0 ? 1.5 : 1), k = Math.min(1, dt * 14);
        p.vx += (ix * sp - p.vx) * k; p.vy += (iy * sp - p.vy) * k;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      fire = keys.fire || touchFire || dragId !== null;
    }
    p.x = clamp(p.x, 22, W - 22);
    p.y = clamp(p.y, 80, H - 26);
    const vx = dt > 0 ? (p.x - px) / dt : 0;
    p.tilt += (clamp(vx / 300, -1, 1) - p.tilt) * Math.min(1, dt * 10);
    if (fire && p.cool <= 0) shoot();
    // Estela del propulsor
    if (Math.random() < 0.7 && particles.length < CFG.MAX_PARTICLES) {
      particles.push({ x: p.x + rand(-3, 3), y: p.y + 14, vx: rand(-20, 20), vy: rand(90, 170), life: 0.35, max: 0.35, size: rand(2, 3.5), color: p.speedT > 0 ? '#a855f7' : '#22e6ff' });
    }
  }

  function updateBullets(dt) {
    for (const b of bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -20 || b.x < -20 || b.x > W + 20) b.dead = true;
    }
    compact(bullets);
    for (const b of ebullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > H + 20 || b.y < -30 || b.x < -20 || b.x > W + 20) b.dead = true;
    }
    compact(ebullets);
  }

  function updateEnemies(dt) {
    for (const e of enemies) {
      e.t += dt; e.rot += e.spin * dt;
      if (e.flash > 0) e.flash -= dt;
      switch (e.type) {
        case 'virus': e.y += e.vy * dt; e.x = e.bx + Math.sin(e.t * 1.6 + e.ph) * 28; break;
        case 'worm':  e.y += e.vy * dt; e.x = e.bx + Math.sin(e.t * 3 + e.ph) * 60; break;
        case 'trojan':
          if (e.y < e.hoverY) e.y += e.vy * dt;
          else if (e.life > 0) {
            e.life -= dt;
            e.x += e.dir * 70 * dt;
            if (e.x < e.r + 20) e.dir = 1;
            if (e.x > W - e.r - 20) e.dir = -1;
            e.shootT -= dt;
            if (e.shootT <= 0) {
              e.shootT = Math.max(0.9, 1.7 - difficulty());
              if (player.alive && state === 'playing') {
                const a = Math.atan2(player.y - e.y, player.x - e.x), v = 220 * Math.min(1.4, speedMul());
                const spreads = level >= 4 ? [-0.25, 0, 0.25] : [0];
                for (const s of spreads) ebullets.push({ x: e.x, y: e.y + 10, vx: Math.cos(a + s) * v, vy: Math.sin(a + s) * v, r: 5, dead: false });
              }
            }
          } else e.y += 140 * dt;
          break;
        default: e.y += e.vy * dt;
      }
      if (e.y > H + 60 || e.x < -90 || e.x > W + 90) e.dead = true;
    }
    compact(enemies);
  }

  function updatePickups(dt) {
    for (const p of pickups) {
      p.t += dt; p.y += p.vy * dt;
      if (p.y > H + 30) p.dead = true;
    }
    compact(pickups);
  }

  function collisions(live) {
    // Disparos del jugador contra enemigos
    for (const b of bullets) {
      if (b.dead) continue;
      if (boss && live && boss.state === 'fight') {
        const bb = b.r + boss.r * 0.8;
        if (dist2(b, boss) < bb * bb) { hitBoss(boss, b); continue; }
      }
      for (const e of enemies) {
        if (e.dead) continue;
        const rr = b.r + e.r;
        if (dist2(b, e) < rr * rr) {
          b.dead = true; e.hp--; e.flash = 0.08;
          if (e.hp <= 0) killEnemy(e, true);
          else { Sound.hit(); burst(b.x, b.y, ENEMY_DEF[e.type].color, 4, 120, 0.3, 2); }
          break;
        }
      }
    }
    compact(bullets);
    if (!live || !player.alive) { compact(enemies); return; }
    // Enemigos contra jugador
    const pr = CFG.PLAYER_RADIUS;
    for (const e of enemies) {
      if (e.dead) continue;
      const rr = e.r * 0.85 + pr;
      if (dist2(e, player) < rr * rr) { killEnemy(e, false); hurt(); if (!player.alive) break; }
    }
    compact(enemies);
    if (boss && boss.state === 'fight' && player.alive) {
      const bc = boss.r * 0.7 + pr;
      if (BOSS.CONTACT_DAMAGE && dist2(boss, player) < bc * bc) hurt();
      const at = boss.atk;
      if (at && at.kind === 'overload' && at.on && player.alive) {
        for (const z of boss.zones) if (Math.abs(player.x - z.x) < z.w / 2 + pr * 0.5) { hurt(); break; }
      }
    }
    // Disparos enemigos contra jugador
    if (player.alive) {
      for (const b of ebullets) {
        const rr = b.r + pr;
        if (dist2(b, player) < rr * rr) { b.dead = true; burst(b.x, b.y, '#ff7a1a', 8, 160, 0.4, 2.5); hurt(); if (!player.alive) break; }
      }
      compact(ebullets);
    }
    // Objetos
    if (player.alive) {
      for (const p of pickups) {
        const rr = p.r + pr + 4;
        if (dist2(p, player) < rr * rr) collect(p);
      }
      compact(pickups);
    }
  }

  function updateParticles(dt) {
    let j = 0;
    const f = Math.max(0, 1 - 2 * dt);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= f; p.vy *= f;
      particles[j++] = p;
    }
    particles.length = j;
    j = 0;
    for (let i = 0; i < rings.length; i++) { rings[i].t += dt; if (rings[i].t < 0.55) rings[j++] = rings[i]; }
    rings.length = j;
    j = 0;
    for (let i = 0; i < texts.length; i++) { const t = texts[i]; t.t += dt; t.y -= 40 * dt; if (t.t < 0.9) texts[j++] = t; }
    texts.length = j;
  }

  function updateBackground(dt) {
    const sp = 1 + difficulty() * 0.6;
    for (const s of stars) {
      s.y += (18 + s.z * 130) * sp * dt;
      if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
    }
    gridOff = (gridOff + dt * 34 * sp) % 60;
    anim += dt;
    shake = Math.max(0, shake - dt * 30);
    flashA = Math.max(0, flashA - dt * 1.2);
    if (bannerLock > 0) {                  // (no corre en pausa, igual que la animación del aviso)
      bannerLock -= dt;
    }
    if (pendingBanner && bannerLock <= 0 && !bossAlertOn()) { const pb = pendingBanner; pendingBanner = null; showBanner(pb[0], pb[1]); }
    if (bossMsg) { bossMsg.t += dt; if (bossMsg.t >= bossMsg.dur) bossMsg = null; }
    updateWorldFx(dt);
  }

  function updateGame(dt) {
    const live = state === 'playing', demo = state === 'menu';
    if (live) { time += dt; score += dt * 10; checkLevel(); if (!boss && !bossMsg) checkWorld(); checkBoss(); }
    updateBackground(dt);
    if (live || demo) {
      updatePlayer(dt, demo);
      if (boss && live) updateBoss(dt);
      spawnT -= dt;
      if (spawnT <= 0) {
        if (!boss || boss.state === 'fight') spawnEnemy(demo);
        spawnT = (demo ? 1.0 : 1.15 - 0.85 * difficulty()) * rand(0.75, 1.25) * (boss ? BOSS.MINION_DELAY : 1);
      }
      if (live) { pickT -= dt; if (pickT <= 0) { spawnPickup(); pickT = rand(3, 5.5); } }
    }
    updateBullets(dt);
    updateEnemies(dt);
    if (live) updatePickups(dt);
    collisions(live);
    updateParticles(dt);
  }

  function step(dt) {
    switch (state) {
      case 'playing': updateGame(dt); break;
      case 'menu': updateGame(dt); break;
      case 'dying':
        updateGame(dt * 0.5);
        deathTimer -= dt * 0.5;
        if (deathTimer <= 0) endGame();
        break;
      case 'over': updateBackground(dt); updateParticles(dt); break;
      default: break; // paused: todo congelado
    }
  }

  /* ---------- 8. DIBUJO ---------- */
  function glowStroke(color, w) {
    ctx.strokeStyle = color; ctx.globalAlpha = 0.2; ctx.lineWidth = w + 5; ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = w; ctx.stroke();
  }

  /* --- Escenarios de los cinco mundos --- */
  function skyGrad(i) {
    if (!skyGrads[i]) {
      const s = WORLDS[i].sky, g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, s[0]); g.addColorStop(0.6, s[1]); g.addColorStop(1, s[2]);
      skyGrads[i] = g;
    }
    return skyGrads[i];
  }

  function drawStars(cols, mul) {
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      ctx.globalAlpha = (0.25 + 0.75 * s.z) * (0.7 + 0.3 * Math.sin(anim * 2 + s.ph)) * mul;
      ctx.fillStyle = s.z > 0.75 ? cols[0] : (s.z > 0.4 ? cols[1] : cols[2]);
      ctx.fillRect(s.x, s.y, 0.7 + s.z * 1.6, 1 + s.z * 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawGrid(color) {
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = gridOff - 60; y <= H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  }

  function polyPath(x, y, r, n, rot) {
    for (let i = 0; i < n; i++) {
      const a = rot + i * TAU / n;
      if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }

  function drawStreaks(color, alpha) {
    ctx.lineCap = 'round'; ctx.lineWidth = 2; ctx.globalAlpha = alpha;
    for (const s of worldFx.streaks) {
      ctx.strokeStyle = color || s.c;
      ctx.beginPath(); ctx.moveTo(s.x, s.y - s.l); ctx.lineTo(s.x, s.y); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
  }

  // Mundo 1 — Ciudad Digital (azul y cian)
  function sceneCity() {
    drawStars(['#aef6ff', '#7fc4ff', '#5f8ad6'], 0.8);
    drawGrid('rgba(34,230,255,0.07)');
    const gg = ctx.createLinearGradient(0, H * 0.68, 0, H);
    gg.addColorStop(0, 'rgba(34,230,255,0)'); gg.addColorStop(1, 'rgba(34,230,255,0.18)');
    ctx.fillStyle = gg; ctx.fillRect(0, H * 0.68, W, H * 0.32);
    ctx.drawImage(layer('city'), 0, 0, W, H);
    drawStreaks(null, 0.5);
  }

  // Mundo 2 — Red Global (azul eléctrico y violeta)
  function sceneNetwork() {
    drawStars(['#c9b8ff', '#8f7bff', '#5a4bd0'], 0.6);
    const gx = W / 2, gy = H * 0.46, gr = Math.min(W, H) * 0.36;      // globo en alambre
    ctx.strokeStyle = 'rgba(120,150,255,0.15)'; ctx.lineWidth = 1.2; ctx.beginPath();
    ctx.arc(gx, gy, gr, 0, TAU);
    for (let k = 0; k < 4; k++) {
      const rx = Math.max(1, Math.abs(Math.cos(anim * 0.25 + k * Math.PI / 4)) * gr);
      ctx.moveTo(gx + rx, gy); ctx.ellipse(gx, gy, rx, gr, 0, 0, TAU);
    }
    for (let k = -1; k <= 1; k++) {
      const yy = gy + k * gr * 0.5, rx = Math.sqrt(gr * gr - (k * gr * 0.5) * (k * gr * 0.5));
      ctx.moveTo(gx - rx, yy); ctx.lineTo(gx + rx, yy);
    }
    ctx.stroke();
    const n = worldFx.nodes;                                           // conexiones entre nodos
    ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < n.length; i++) {
      for (let j = i + 1; j < n.length; j++) {
        if (dist2(n[i], n[j]) < LINK_DIST * LINK_DIST) { ctx.moveTo(n[i].x, n[i].y); ctx.lineTo(n[j].x, n[j].y); }
      }
    }
    ctx.strokeStyle = 'rgba(100,130,255,0.34)'; ctx.stroke();
    for (const p of n) {
      const pulse = 0.6 + 0.4 * Math.sin(p.ph);
      ctx.fillStyle = 'rgba(143,123,255,' + (0.25 * pulse).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#9ec2ff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';                          // paquetes de datos viajando
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(34,230,255,0.75)'; ctx.fillStyle = '#e8ffff';
    for (const pk of worldFx.packets) {
      const A = n[pk.a], B = n[pk.b], t0 = Math.max(0, pk.t - 0.12);
      const x = A.x + (B.x - A.x) * pk.t, y = A.y + (B.y - A.y) * pk.t;
      ctx.beginPath(); ctx.moveTo(A.x + (B.x - A.x) * t0, A.y + (B.y - A.y) * t0); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // Mundo 3 — Núcleo de Datos (verde y azul oscuro)
  function sceneCore() {
    drawGrid('rgba(57,255,136,0.05)');
    ctx.drawImage(layer('core'), 0, 0, W, H);
    ctx.font = '14px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const c of worldFx.rain) {                                    // lluvia de código binario
      for (let k = 0; k < c.n; k++) {
        const y = c.y - k * 17;
        if (y < -10 || y > H + 10) continue;
        ctx.globalAlpha = k === 0 ? 0.95 : Math.max(0.05, 0.55 - k * 0.05);
        ctx.fillStyle = k === 0 ? '#d8ffe8' : '#39ff88';
        ctx.fillText(c.ch[k], c.x, y);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'lighter';
    drawStreaks('#39ff88', 0.35);                                      // columnas de datos
    const sy = (anim * 70) % (H + 80) - 40;                            // barrido de escaneo
    ctx.fillStyle = 'rgba(57,255,136,0.05)'; ctx.fillRect(0, sy - 20, W, 40);
    ctx.fillStyle = 'rgba(57,255,136,0.12)'; ctx.fillRect(0, sy - 1, W, 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Mundo 4 — Ciberespacio (violeta, magenta y cian)
  function sceneCyber() {
    drawStars(['#ffd0ff', '#ff7af0', '#9a6bff'], 0.7);
    const vx = W / 2, hy = H * 0.46;
    const hg = ctx.createLinearGradient(0, hy - 70, 0, hy + 70);
    hg.addColorStop(0, 'rgba(255,61,240,0)'); hg.addColorStop(0.5, 'rgba(255,61,240,0.3)'); hg.addColorStop(1, 'rgba(255,61,240,0)');
    ctx.fillStyle = hg; ctx.fillRect(0, hy - 70, W, 140);
    ctx.lineWidth = 1.2;
    for (let d = 0; d < 2; d++) {                                      // suelo (d=0) y techo (d=1) en perspectiva
      const dir = d ? -1 : 1, edge = d ? -20 : H + 20, span = Math.abs(edge - hy);
      ctx.beginPath();
      for (let k = -12; k <= 12; k++) { ctx.moveTo(vx, hy); ctx.lineTo(vx + k * W * 0.16, edge); }
      const f = (anim * 0.5) % 1;
      for (let k = 0; k < 11; k++) {
        const t = (k + f) / 11, y = hy + dir * t * t * span;
        ctx.moveTo(0, y); ctx.lineTo(W, y);
      }
      ctx.strokeStyle = d ? 'rgba(34,230,255,0.3)' : 'rgba(255,61,240,0.38)';
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {                                      // portales hexagonales que se expanden
      const t = (worldFx.portal + k / 4) % 1, r = 10 + t * t * Math.max(W, H) * 0.7;
      ctx.strokeStyle = (k % 2 ? 'rgba(34,230,255,' : 'rgba(255,61,240,') + (0.6 * (1 - t)).toFixed(2) + ')';
      ctx.lineWidth = 1 + t * 3;
      ctx.beginPath(); polyPath(vx, hy, r, 6, anim * 0.3 * (k % 2 ? 1 : -1)); ctx.stroke();
    }
    ctx.lineWidth = 1.6;
    for (const s of worldFx.shapes) {                                  // geometrías digitales flotantes
      ctx.strokeStyle = 'rgba(' + s.c + ',0.55)';
      ctx.beginPath(); polyPath(s.x, s.y, s.s, s.n, s.rot); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // Mundo 5 — Núcleo del Virus (rojo, negro y naranja)
  function sceneVirus() {
    ctx.drawImage(layer('virus'), 0, 0, W, H);
    const pulse = 0.5 + 0.5 * Math.sin(anim * 3);                      // latido de energía roja
    const rg = ctx.createRadialGradient(W / 2, H * 0.4, Math.min(W, H) * 0.15, W / 2, H * 0.4, Math.max(W, H) * 0.75);
    rg.addColorStop(0, 'rgba(255,40,20,' + (0.04 + 0.06 * pulse).toFixed(3) + ')');
    rg.addColorStop(1, 'rgba(120,0,0,' + (0.3 + 0.12 * pulse).toFixed(3) + ')');
    ctx.fillStyle = rg; ctx.fillRect(-30, -30, W + 60, H + 60);
    ctx.globalCompositeOperation = 'lighter';
    for (const e of worldFx.embers) {                                  // brasas que suben
      ctx.fillStyle = e.r > 1.8 ? 'rgba(255,140,30,0.75)' : 'rgba(255,60,40,0.75)';
      ctx.fillRect(e.x, e.y, e.r * 2, e.r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    const gl = Math.sin(anim * 5.1) * Math.sin(anim * 2.3);            // fallos de señal
    if (gl > 0.55) {
      const seed = Math.floor(anim * 14);
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = k % 2 ? 'rgba(255,50,40,0.14)' : 'rgba(255,160,40,0.12)';
        ctx.fillRect(0, ((seed * (37 + k * 53)) % 100) / 100 * H, W, 4 + k * 3);
      }
    }
    const a = worldFx.alert;                                           // alertas digitales
    if (a) {
      const al = (Math.floor(a.t * 10) % 2 ? 0.95 : 0.4) * (1 - a.t / 1.3);
      ctx.globalAlpha = al; ctx.strokeStyle = '#ff3b2d'; ctx.fillStyle = '#ff6a3d'; ctx.lineWidth = 2.5;
      ctx.beginPath(); polyPath(a.x, a.y, 16, 3, -Math.PI / 2); ctx.stroke();
      ctx.font = 'bold 16px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', a.x, a.y + 3);
      ctx.font = 'bold 12px Consolas, monospace'; ctx.fillText(a.label, a.x, a.y + 28);
      ctx.globalAlpha = 1;
    }
  }

  const SCENES = [sceneCity, sceneNetwork, sceneCore, sceneCyber, sceneVirus];

  function drawWorldScene(i) {
    ctx.fillStyle = skyGrad(i); ctx.fillRect(-30, -30, W + 60, H + 60);
    SCENES[i]();
  }

  // Dibuja el mundo actual; al cambiar de mundo, un barrido luminoso baja revelando el nuevo escenario
  function drawBackground() {
    if (worldBlend >= 1) { drawWorldScene(world); return; }
    drawWorldScene(prevWorld);
    const y = H * (1 - (1 - worldBlend) * (1 - worldBlend));
    ctx.save();
    ctx.beginPath(); ctx.rect(-30, -30, W + 60, y + 30); ctx.clip();
    drawWorldScene(world);
    ctx.restore();
    ctx.fillStyle = WORLDS[world].accent;
    ctx.globalAlpha = 0.9; ctx.fillRect(-30, y - 2, W + 60, 3);
    ctx.globalAlpha = 0.2; ctx.fillRect(-30, y - 28, W + 60, 28);
    ctx.globalAlpha = 1;
  }

  function drawShip(x, y, tilt, boost) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(tilt * 0.18); ctx.scale(1 - Math.abs(tilt) * 0.12, 1);
    const fl = 12 + Math.random() * 8 + (boost ? 10 : 0);
    const g = ctx.createLinearGradient(0, 12, 0, 12 + fl * 1.6);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.35, boost ? 'rgba(194,123,255,0.85)' : 'rgba(34,230,255,0.8)'); g.addColorStop(1, 'rgba(168,85,247,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-5, 12); ctx.lineTo(0, 12 + fl * 1.6); ctx.lineTo(5, 12); ctx.closePath(); ctx.fill();
    ctx.shadowColor = '#22e6ff'; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, -22); ctx.lineTo(7, -6); ctx.lineTo(17, 13); ctx.lineTo(7, 9); ctx.lineTo(0, 15);
    ctx.lineTo(-7, 9); ctx.lineTo(-17, 13); ctx.lineTo(-7, -6); ctx.closePath();
    const bg = ctx.createLinearGradient(0, -22, 0, 15);
    bg.addColorStop(0, '#2f6bff'); bg.addColorStop(1, '#1a1060');
    ctx.fillStyle = bg; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#22e6ff'; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#9ffcff'; ctx.beginPath(); ctx.ellipse(0, -5, 3.2, 6, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(-9, 6); ctx.lineTo(-15, 12); ctx.moveTo(9, 6); ctx.lineTo(15, 12); ctx.stroke();
    ctx.restore();
  }

  function drawEnemy(e) {
    const d = ENEMY_DEF[e.type], c = d.color, r = e.r;
    ctx.save();
    ctx.translate(e.x, e.y);
    const flash = e.flash > 0;
    switch (e.type) {
      case 'virus': {
        ctx.save(); ctx.rotate(e.rot);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = i * TAU / 8, ca = Math.cos(a), sa = Math.sin(a);
          ctx.moveTo(ca * r * 0.85, sa * r * 0.85); ctx.lineTo(ca * r * 1.28, sa * r * 1.28);
        }
        glowStroke(c, 2);
        ctx.fillStyle = c;
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3, 2.6, 0, TAU); ctx.fill(); }
        ctx.restore();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, TAU);
        ctx.fillStyle = flash ? '#fff' : 'rgba(255,45,117,0.22)'; ctx.fill(); glowStroke(c, 2);
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(-5, -3, 2.8, 0, TAU); ctx.arc(5, -3, 2.8, 0, TAU); ctx.fill();
        break;
      }
      case 'bug': {
        ctx.rotate(Math.sin(e.t * 8) * 0.12);
        ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.95, r * 0.8); ctx.lineTo(-r * 0.95, r * 0.8); ctx.closePath();
        ctx.fillStyle = flash ? '#fff' : 'rgba(255,176,0,0.2)'; ctx.fill(); glowStroke(c, 2);
        ctx.fillStyle = c; ctx.font = 'bold 17px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('!', 0, r * 0.2);
        break;
      }
      case 'corrupt': {
        ctx.beginPath(); ctx.rect(-22, -12, 44, 24);
        ctx.fillStyle = flash ? '#fff' : 'rgba(255,60,60,0.15)'; ctx.fill(); glowStroke(c, 2);
        ctx.font = 'bold 13px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (Math.sin(e.t * 40 + e.ph) > 0.7) {
          ctx.fillStyle = '#22e6ff'; ctx.fillText(e.label, 2, 0);
          ctx.fillStyle = '#ff2dd0'; ctx.fillText(e.label, -2, 1);
        }
        ctx.fillStyle = '#ff8a6b'; ctx.fillText(e.label, 0, 0);
        break;
      }
      case 'worm': {
        for (let i = 2; i >= 1; i--) {
          const sx = e.bx + Math.sin(e.t * 3 + e.ph - i * 0.55) * 60 - e.x, sy = -i * 13;
          ctx.beginPath(); ctx.arc(sx, sy, r * (1 - i * 0.2), 0, TAU);
          ctx.fillStyle = 'rgba(168,85,247,0.25)'; ctx.fill(); glowStroke(c, 2);
        }
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
        ctx.fillStyle = flash ? '#fff' : 'rgba(168,85,247,0.3)'; ctx.fill(); glowStroke(c, 2.5);
        ctx.fillStyle = '#e8d0ff';
        ctx.beginPath(); ctx.arc(-5, 3, 2.6, 0, TAU); ctx.arc(5, 3, 2.6, 0, TAU); ctx.fill();
        break;
      }
      case 'trojan': {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + Math.PI / 6; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        ctx.closePath();
        ctx.fillStyle = flash ? '#fff' : 'rgba(255,122,26,0.2)'; ctx.fill(); glowStroke(c, 3);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + Math.PI / 6; ctx.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); }
        ctx.closePath(); ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 6 + Math.sin(e.t * 6) * 1.5, 0, TAU); ctx.fillStyle = '#ff2d4d'; ctx.fill();
        // barra de vida
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-20, -r - 12, 40, 4);
        ctx.fillStyle = '#ff7a1a'; ctx.fillRect(-20, -r - 12, 40 * Math.max(0, e.hp / e.maxHp), 4);
        break;
      }
    }
    ctx.restore();
  }

  function drawPickup(p) {
    const pulse = 1 + 0.1 * Math.sin(p.t * 6);
    ctx.save();
    ctx.translate(p.x, p.y); ctx.scale(pulse, pulse);
    ctx.font = 'bold 13px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    switch (p.kind) {
      case 'code':
        ctx.shadowColor = '#39ff88'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.rect(-23, -12, 46, 24); ctx.fillStyle = 'rgba(57,255,136,0.14)'; ctx.fill();
        ctx.strokeStyle = '#39ff88'; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#39ff88'; ctx.fillText(p.label, 0, 1);
        break;
      case 'data':
        ctx.shadowColor = '#22e6ff'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.rect(-12, -12, 24, 24); ctx.fillStyle = 'rgba(34,230,255,0.18)'; ctx.fill();
        ctx.strokeStyle = '#22e6ff'; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.moveTo(0, -12); ctx.lineTo(0, 12); ctx.lineWidth = 1.2; ctx.stroke();
        ctx.setLineDash([4, 4]); ctx.lineDashOffset = -p.t * 20;
        ctx.beginPath(); ctx.arc(0, 0, 19, 0, TAU); ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
        break;
      case 'speed':
        ctx.shadowColor = '#c27bff'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.strokeStyle = '#c27bff'; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(2, -9); ctx.lineTo(-5, 2); ctx.lineTo(0, 2); ctx.lineTo(-2, 9); ctx.lineTo(5, -2); ctx.lineTo(0, -2); ctx.closePath();
        ctx.fillStyle = '#c27bff'; ctx.fill();
        break;
      case 'fire':
        ctx.shadowColor = '#4d8dff'; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.strokeStyle = '#4d8dff'; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(0, -8); ctx.moveTo(-4, 8); ctx.lineTo(-9, -6); ctx.moveTo(4, 8); ctx.lineTo(9, -6);
        ctx.lineWidth = 2.5; ctx.stroke();
        break;
    }
    ctx.restore();
  }

  function render() {
    ctx.setTransform(dpr * S, 0, 0, dpr * S, 0, 0);
    if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
    drawBackground();
    if (boss && bossAlertOn()) {
      ctx.fillStyle = 'rgba(0,0,0,' + (0.42 * bossAlertK(boss)).toFixed(3) + ')';
      ctx.fillRect(-30, -30, W + 60, H + 60);
    }
    if (boss) drawBossZones();

    for (const p of pickups) drawPickup(p);
    for (const e of enemies) drawEnemy(e);
    if (boss) drawBoss(boss);

    // Disparos enemigos
    for (const b of ebullets) {
      const c = b.c || '#ff7a1a';
      if (b.sq) {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(anim * 4 + b.x * 0.05);
        ctx.fillStyle = c; ctx.globalAlpha = 0.3; ctx.fillRect(-b.r - 3, -b.r - 3, b.r * 2 + 6, b.r * 2 + 6);
        ctx.globalAlpha = 1; ctx.fillRect(-b.r, -b.r, b.r * 2, b.r * 2);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-b.r * 0.35, -b.r * 0.35, b.r * 0.7, b.r * 0.7);
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU);
        ctx.fillStyle = c; ctx.fill();
        ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        if (b.boss) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.4, 0, TAU); ctx.fill(); }
      }
    }
    // Disparos del jugador
    ctx.lineCap = 'round';
    for (const b of bullets) {
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = 'rgba(34,230,255,0.3)'; ctx.lineWidth = 9; ctx.stroke();
      ctx.strokeStyle = '#bffcff'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.lineCap = 'butt';

    // Nave
    if ((state === 'playing' || state === 'paused' || state === 'menu') && player.alive) {
      const blink = player.inv > 0 && Math.floor(player.inv * 14) % 2 === 0;
      if (!blink) drawShip(player.x, player.y, player.tilt, player.speedT > 0);
      if (player.shield) {
        ctx.beginPath(); ctx.arc(player.x, player.y, 27 + Math.sin(anim * 8) * 1.5, 0, TAU);
        ctx.fillStyle = 'rgba(34,230,255,0.1)'; ctx.fill();
        ctx.strokeStyle = 'rgba(34,230,255,0.85)'; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // Partículas (mezcla aditiva)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const r of rings) {
      const pr = r.t / 0.55, e = 1 - (1 - pr) * (1 - pr);
      ctx.beginPath(); ctx.arc(r.x, r.y, 6 + (r.max - 6) * e, 0, TAU);
      ctx.strokeStyle = r.color; ctx.globalAlpha = 1 - pr; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Textos flotantes
    ctx.font = 'bold 14px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of texts) {
      ctx.globalAlpha = Math.max(0, 1 - t.t / 0.9);
      ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBossUI();

    // Destello de pantalla (daño / subida de nivel)
    if (flashA > 0.01) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(' + flashRGB + ',' + flashA.toFixed(3) + ')';
      ctx.fillRect(0, 0, el.canvas.width, el.canvas.height);
    }
  }

  /* ---------- 9. HUD Y PANTALLAS ---------- */
  const hud = { score: -1, time: '', level: '', lives: '', speed: -1, fire: -1, world: -1, pct: -1 };
  function updateHUD(force) {
    const s = Math.floor(score);
    if (force || s !== hud.score) { hud.score = s; el.hudScore.textContent = s; }
    const t = fmtTime(time);
    if (force || t !== hud.time) { hud.time = t; el.hudTime.textContent = t; }
    const lv = 'NIVEL ' + level + ' · ' + levelLabel(level).toUpperCase();
    if (force || lv !== hud.level) { hud.level = lv; el.hudLevel.textContent = lv; }
    if (force || world !== hud.world) {
      hud.world = world;
      el.hudWorld.textContent = 'MUNDO ' + (world + 1) + '/' + WORLDS.length + ' — ' + WORLDS[world].name.toUpperCase();
      el.hudWorld.style.color = WORLDS[world].accent;
    }
    const lo = WORLD_SCORES[world], hi = WORLD_SCORES[world + 1];
    const pct = hi === undefined ? 100 : Math.floor(clamp((progress() - lo) / (hi - lo) * 100, 0, 100));
    if (force || pct !== hud.pct) { hud.pct = pct; el.worldFill.style.width = pct + '%'; }
    const lk = player.lives + '|' + player.shield;
    if (force || lk !== hud.lives) {
      hud.lives = lk;
      let h = '';
      for (let i = 0; i < CFG.START_LIVES; i++) h += '<i class="heart' + (i < player.lives ? ' on' : '') + '">♥</i>';
      if (player.shield) h += '<i class="shield-chip">ESCUDO</i>';
      el.hudLives.innerHTML = h;
    }
    const sp = Math.ceil(player.speedT), fi = Math.ceil(player.fireT);
    if (force || sp !== hud.speed) { hud.speed = sp; el.pwSpeed.classList.toggle('hidden', sp <= 0); el.pwSpeed.textContent = 'VELOCIDAD ' + sp + 's'; }
    if (force || fi !== hud.fire) { hud.fire = fi; el.pwFire.classList.toggle('hidden', fi <= 0); el.pwFire.textContent = 'DISPARO x3 ' + fi + 's'; }
  }

  function showBanner(title, sub) {
    el.bannerTitle.textContent = title;
    el.bannerSub.textContent = sub || '';
    el.banner.classList.remove('show');
    void el.banner.offsetWidth;   // reinicia la animación CSS
    el.banner.classList.add('show');
    bannerLock = 2.4;                      // dura lo mismo que la animación CSS
  }
  // Si hay otro aviso en pantalla, espera a que termine (el aviso de mundo se muestra siempre al instante)
  function queueBanner(title, sub) {
    if (bannerLock > 0 || bossAlertOn()) pendingBanner = [title, sub]; else showBanner(title, sub);
  }

  function setState(s) {
    state = s;
    document.body.dataset.state = s;
    Sound.silent = (s === 'menu' || s === 'over');
    Sound.musicWanted = (s === 'menu' || s === 'playing');
  }

  function showScreen(name) {
    for (const id of SCREENS) $('screen-' + id).classList.toggle('hidden', id !== name);
    currentScreen = name;
  }
  function openScreen(name) {
    returnTo = currentScreen; showScreen(name);
    if (name === 'board') renderBoard();
    if (name === 'discover') showDiscoverList();
  }

  function refreshMenuStats() {
    const best = Store.best();
    $('menu-best').textContent = best ? best.score : 0;
    $('menu-best-name').textContent = best ? best.name : '—';
    const last = Store.getName();
    $('menu-personal').textContent = last ? Store.personalBest(last) : 0;
    $('menu-personal-name').textContent = last || '—';
  }

  function renderBoard() {
    const body = $('board-body');
    body.textContent = '';
    const top = Store.top(10);
    if (!top.length) {
      const p = document.createElement('p');
      p.className = 'empty'; p.textContent = 'Aún no hay puntuaciones. ¡Sé el primero en jugar!';
      body.appendChild(p);
      return;
    }
    top.forEach((e, i) => {
      const row = document.createElement('div');
      row.className = 'board-row' + (i < 3 ? ' top' + (i + 1) : '');
      [String(i + 1), e.name, String(e.score), fmtTime(e.time)].forEach((txt) => {
        const s = document.createElement('span'); s.textContent = txt; row.appendChild(s);
      });
      body.appendChild(row);
    });
  }

  function updateMuteButton() {
    el.btnMute.textContent = Sound.muted ? '♪ OFF' : '♪ ON';
    el.btnMute.classList.toggle('off', Sound.muted);
  }

  /* ---------- Descubre Informática (opciones + detalle con info de la UMSS) ---------- */
  // Editable: cambia aquí los textos para ajustarlos a lo que quiera mostrar la carrera.
  const UMSS_ABOUT = 'La Universidad Mayor de San Simón (UMSS) es una universidad pública de Cochabamba, Bolivia, fundada en 1832. Ingeniería Informática se cursa en la Facultad de Ciencias y Tecnología.';
  const DISCOVER = [
    { title: 'Videojuegos', short: 'Mundos, personajes y mecánicas como este minijuego.',
      intro: 'Un videojuego combina programación, matemáticas, diseño y creatividad. Este mismo juego está hecho solo con HTML, CSS y JavaScript.',
      projects: ['Un juego de naves o de plataformas como este', 'Un juego educativo para aprender matemáticas o historia de Bolivia', 'Un juego multijugador que funcione en red'],
      areas: 'programación, algoritmos y estructuras de datos, gráficos por computadora y matemáticas' },
    { title: 'Apps móviles y web', short: 'Aplicaciones para resolver problemas del día a día.',
      intro: 'Las apps y los sitios web están en todas partes: desde pedir un turno hasta comprar en línea. Alguien tiene que programarlos.',
      projects: ['Una app para organizar horarios y tareas de estudio', 'Una tienda en línea para emprendimientos de barrio', 'Una app para pedir turnos en un centro de salud'],
      areas: 'programación web y móvil, bases de datos, diseño de interfaces e ingeniería de software' },
    { title: 'Inteligencia artificial', short: 'Programas que reconocen, traducen y conversan.',
      intro: 'La inteligencia artificial enseña a las computadoras a aprender de los datos para reconocer imágenes, entender textos y ayudar a tomar decisiones.',
      projects: ['Un programa que reconoce plantas o frutas desde una foto', 'Un asistente virtual que responde preguntas frecuentes', 'Un traductor de texto castellano–quechua'],
      areas: 'matemáticas, estadística, algoritmos, programación y manejo de datos' },
    { title: 'Sistemas y bases de datos', short: 'Sistemas para organizar la información de una institución.',
      intro: 'Colegios, farmacias, clínicas y empresas necesitan sistemas confiables para guardar y consultar su información todos los días.',
      projects: ['Un sistema de inventario para una farmacia o tienda', 'Un sistema de matrícula y notas para un colegio', 'Un sistema de historiales para una clínica'],
      areas: 'bases de datos, análisis y diseño de sistemas, ingeniería de software y redes' },
    { title: 'Robótica e IoT', short: 'Sensores y microcontroladores que actúan en el mundo real.',
      intro: 'El Internet de las cosas conecta sensores y dispositivos a programas que miden, deciden y actúan: del software al mundo físico.',
      projects: ['Un riego automático para huertos y cultivos', 'Una estación que mide temperatura y humedad', 'Un robot que sigue una línea en el piso'],
      areas: 'programación, electrónica básica, arquitectura de computadoras, redes y sistemas embebidos' },
    { title: 'Ciberseguridad', short: 'Proteger cuentas, redes y datos de ataques.',
      intro: 'Igual que en este juego, hay virus y amenazas reales. La ciberseguridad se dedica a detectarlos y a proteger la información de las personas.',
      projects: ['Un gestor de contraseñas seguro', 'Una herramienta que detecta enlaces o correos sospechosos', 'Un sistema de copias de seguridad automáticas'],
      areas: 'redes, sistemas operativos, criptografía básica y programación' },
    { title: 'Análisis de datos', short: 'Entender fenómenos con datos y gráficos.',
      intro: 'Con datos bien analizados se pueden entender problemas reales y proponer mejores soluciones para la ciudad, la salud o el ambiente.',
      projects: ['Un panel con gráficos del clima de Cochabamba', 'Un análisis del tránsito para proponer mejores rutas', 'Un mapa con datos de salud pública'],
      areas: 'estadística, bases de datos, programación y visualización de datos' }
  ];

  function buildDiscover() {
    const box = $('discover-cards');
    box.textContent = '';
    DISCOVER.forEach((t, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'card';
      const h = document.createElement('h3'); h.textContent = t.title;
      const p = document.createElement('p'); p.textContent = t.short;
      const m = document.createElement('span'); m.className = 'card-more'; m.textContent = 'VER MÁS ▸';
      b.appendChild(h); b.appendChild(p); b.appendChild(m);
      b.addEventListener('click', () => showDiscoverDetail(i));
      box.appendChild(b);
    });
  }
  function showDiscoverList() {
    $('discover-detail').classList.add('hidden');
    $('discover-list').classList.remove('hidden');
    $('screen-discover').querySelector('.panel').scrollTop = 0;
  }
  function showDiscoverDetail(i) {
    const t = DISCOVER[i];
    $('dd-title').textContent = t.title.toUpperCase();
    $('dd-intro').textContent = t.intro;
    const ul = $('dd-projects');
    ul.textContent = '';
    t.projects.forEach((txt) => { const li = document.createElement('li'); li.textContent = txt; ul.appendChild(li); });
    $('dd-umss').textContent = UMSS_ABOUT;
    $('dd-areas').textContent = 'En Ingeniería Informática te formarías en áreas como: ' + t.areas + '.';
    $('discover-list').classList.add('hidden');
    $('discover-detail').classList.remove('hidden');
    $('screen-discover').querySelector('.panel').scrollTop = 0;
  }

  /* ---------- Flujo de la partida ---------- */
  function startGame() {
    Sound.unlock();
    resetWorld();
    const best = Store.best();
    runRecord = best ? best.score : 0;      // récord anterior, guardado antes de empezar
    forcedEnding = 0;
    setState('playing');
    showScreen(null);
    updateHUD(true);
    showBanner('¡MISIÓN INICIADA!', LEVEL_SUBS[1]);
  }

  function goMenu() {
    resetWorld();
    setState('menu');
    refreshMenuStats();
    showScreen('menu');
  }

  function pause() {
    if (state !== 'playing') return;
    setState('paused');
    dragId = null; touchTarget = null; touchFire = false;
    showScreen('pause');
  }
  function resume() {
    if (state !== 'paused') return;
    setState('playing');
    showScreen(null);
    lastTs = 0;   // evita un salto de tiempo al reanudar
  }

  // Decide el final. `record` es el récord que había ANTES de empezar esta partida (0 = no había).
  function classifyEnding(sc, record) {
    if (record > 0) {
      if (sc > record && sc >= ENDINGS.LEGEND_MIN_BEAT) return 3;   // superó el récord con una puntuación seria
    } else if (sc >= ENDINGS.LEGEND_EXCEPTIONAL) return 3;           // primera partida: puntuación excepcional
    return sc < ENDINGS.LOW_MAX ? 1 : 2;
  }

  function showEnding(n) {
    const info = ENDING_INFO[n], box = $('go-ending');
    box.className = 'ending ' + info.cls;
    $('end-icon').textContent = info.icon;
    $('end-name').textContent = 'FINAL ' + n + ' · ' + info.name;
    $('end-title').textContent = info.title;
    $('end-msg').textContent = info.msg;
    void box.offsetWidth;                  // reinicia la animación del final
  }

  function endGame() {
    setState('over');                      // a partir de aquí el final ya no puede dispararse otra vez
    boss = null; bossMsg = null;
    const sc = Math.floor(score);
    const prevPersonal = Store.personalBest(playerName);
    const isRecord = sc > 0 && sc > runRecord;
    const isPersonal = sc > 0 && !isRecord && sc > prevPersonal;
    const ending = forcedEnding || classifyEnding(sc, runRecord);
    const rank = forcedEnding ? 0 : Store.add({ name: playerName, score: sc, time: Math.floor(time), level, world: world + 1 });

    $('go-player').textContent = playerName;
    showEnding(ending);
    $('go-score').textContent = sc;
    $('go-best').textContent = Math.max(sc, runRecord);
    $('go-world').textContent = (world + 1) + '/' + WORLDS.length + ' — ' + WORLDS[world].name.toUpperCase();
    $('go-time').textContent = fmtTime(time);
    $('go-level').textContent = level + ' · ' + levelLabel(level);
    $('go-kills').textContent = kills;
    $('go-items').textContent = items;
    const badge = $('go-record');
    badge.classList.toggle('hidden', !((isRecord || isPersonal) && ending > 1));   // sin insignia de récord con una puntuación muy baja
    badge.textContent = isRecord ? '★ ¡NUEVO RÉCORD! ★' : '★ ¡NUEVO RÉCORD PERSONAL! ★';
    $('go-rank').textContent = forcedEnding ? 'Vista previa del final (modo prueba, no se guarda)'
      : (rank <= 10 ? 'Puesto #' + rank + ' en la clasificación' : 'Fuera del Top 10 — ¡inténtalo de nuevo!');
    forcedEnding = 0;
    refreshMenuStats();
    showScreen('over');
    el.app.focus && el.app.blur();
  }

  // Atajos de prueba (sólo con index.html?debug y partida en marcha):
  //   1-5 → saltar al mundo 1-5      6 → invocar un jefe      7 / 8 / 9 → ver el Final 1 / 2 / 3 (no se guarda en la clasificación)
  //   0   → perder de verdad (el final se calcula con la puntuación real y el récord guardado)
  function debugKey(e) {
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
    if (!m || state !== 'playing') return false;
    const n = +m[1];
    if (n >= 1 && n <= WORLDS.length) { score = Math.max(score, WORLD_SCORES[n - 1] + bonusScore); bossDefeated = Math.max(bossDefeated, n - 1); nextBossScore = Math.max(nextBossScore, bossThreshold(bossDefeated)); }
    else if (n === 6) { if (!boss) startBoss(); }
    else if (n >= 7 && n <= 9) { forcedEnding = n - 6; player.lives = 0; die(); }
    else if (n === 0) { forcedEnding = 0; player.lives = 0; die(); }
    else return false;
    return true;
  }

  /* ---------- 10. ENTRADAS Y ARRANQUE ---------- */
  const keyMap = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'fire' };
  const isInput = (t) => t && t.tagName === 'INPUT';

  window.addEventListener('keydown', (e) => {
    Sound.unlock();
    if (isInput(e.target)) {
      if (e.code === 'Escape') { showScreen('menu'); }
      return;
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state === 'playing') { pause(); e.preventDefault(); return; }
      if (state === 'paused') { resume(); e.preventDefault(); return; }
      if (e.code === 'Escape') {
        if (currentScreen === 'discover' && !$('discover-detail').classList.contains('hidden')) { showDiscoverList(); return; }
        if (['howto', 'board', 'discover'].includes(currentScreen)) { showScreen(returnTo); return; }
        if (currentScreen === 'name' || currentScreen === 'confirm') { showScreen(currentScreen === 'name' ? 'menu' : 'board'); return; }
      }
    }
    if (e.code === 'Enter' && state === 'over' && currentScreen === 'over') { startGame(); return; }
    if (DEBUG && debugKey(e)) return;
    const k = keyMap[e.code];
    if (k) {
      keys[k] = true;
      if (state === 'playing' || e.code === 'Space') e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (isInput(e.target)) return;
    const k = keyMap[e.code];
    if (k) { keys[k] = false; if (e.code === 'Space') e.preventDefault(); }
  });
  const releaseAll = () => { for (const k in keys) keys[k] = false; touchFire = false; dragId = null; touchTarget = null; };
  window.addEventListener('blur', () => { releaseAll(); pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseAll(); pause(); } });
  window.addEventListener('pointerdown', () => Sound.unlock(), { passive: true });

  // Evita que un botón con foco se active con la barra espaciadora durante la partida
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); });

  // Controles táctiles: arrastrar para mover (dispara automáticamente) + botón DISPARAR
  el.canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || state !== 'playing' || dragId !== null) return;
    dragId = e.pointerId;
    drag = { sx: e.clientX, sy: e.clientY, px: player.x, py: player.y };
    touchTarget = { x: player.x, y: player.y };
    try { el.canvas.setPointerCapture(e.pointerId); } catch (_) { /* no crítico */ }
    e.preventDefault();
  });
  el.canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId || !drag) return;
    touchTarget = { x: drag.px + (e.clientX - drag.sx) / S * 1.25, y: drag.py + (e.clientY - drag.sy) / S * 1.25 };
  });
  const endDrag = (e) => { if (e.pointerId === dragId) { dragId = null; touchTarget = null; player.vx = player.vy = 0; } };
  el.canvas.addEventListener('pointerup', endDrag);
  el.canvas.addEventListener('pointercancel', endDrag);

  el.touchFire.addEventListener('pointerdown', (e) => {
    touchFire = true; e.preventDefault();
    try { el.touchFire.setPointerCapture(e.pointerId); } catch (_) { /* no crítico */ }
  });
  const fireUp = () => { touchFire = false; };
  el.touchFire.addEventListener('pointerup', fireUp);
  el.touchFire.addEventListener('pointercancel', fireUp);
  el.touchFire.addEventListener('lostpointercapture', fireUp);

  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  window.addEventListener('touchstart', () => document.body.classList.add('touch'), { passive: true, once: true });

  // Botones de la interfaz
  el.btnPause.addEventListener('click', pause);
  el.btnMute.addEventListener('click', () => {
    Sound.unlock();
    Sound.muted = !Sound.muted;
    Store.setMute(Sound.muted);
    updateMuteButton();
  });
  $('btn-start').addEventListener('click', () => {
    Sound.unlock();
    $('name-input').value = '';
    showScreen('name');
    setTimeout(() => $('name-input').focus(), 50);
  });
  $('name-form').addEventListener('submit', (e) => {
    e.preventDefault();
    playerName = cleanName($('name-input').value) || 'ANÓNIMO';
    Store.setName(playerName);
    $('name-input').blur();
    startGame();
  });
  $('btn-name-back').addEventListener('click', () => showScreen('menu'));
  $('btn-howto').addEventListener('click', () => openScreen('howto'));
  $('btn-board').addEventListener('click', () => openScreen('board'));
  $('btn-discover').addEventListener('click', () => openScreen('discover'));
  $('btn-over-board').addEventListener('click', () => openScreen('board'));
  $('btn-career').addEventListener('click', () => {
    if (CAREER_URL) window.open(CAREER_URL, '_blank', 'noopener');   // enlace oficial (si se configuró)
    else openScreen('discover');                                      // si no, sección interna
  });
  $('btn-dd-back').addEventListener('click', showDiscoverList);
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => showScreen(returnTo)));
  $('btn-resume').addEventListener('click', resume);
  $('btn-pause-restart').addEventListener('click', startGame);
  $('btn-pause-menu').addEventListener('click', goMenu);
  $('btn-retry').addEventListener('click', startGame);
  $('btn-over-menu').addEventListener('click', goMenu);
  $('btn-clear').addEventListener('click', () => showScreen('confirm'));
  $('btn-confirm-no').addEventListener('click', () => showScreen('board'));
  $('btn-confirm-yes').addEventListener('click', () => {
    Store.clear(); renderBoard(); refreshMenuStats(); showScreen('board');
  });

  // Ajuste a cualquier tamaño de pantalla (la dimensión menor equivale a CFG.BASE unidades)
  function resize() {
    const cw = el.app.clientWidth || window.innerWidth, ch = el.app.clientHeight || window.innerHeight;
    const oldW = W, oldH = H;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    S = Math.min(cw, ch) / CFG.BASE;
    W = cw / S; H = ch / S;
    el.canvas.width = Math.round(cw * dpr);
    el.canvas.height = Math.round(ch * dpr);
    for (const s of stars) { s.x *= W / oldW; s.y *= H / oldH; }
    player.x = clamp(player.x, 22, W - 22);
    player.y = clamp(player.y, 80, H - 26);
    initWorldFx();
    if (boss) { layoutBossBar(); boss.hover = bossHover(boss.r); boss.x = clamp(boss.x, boss.r, Math.max(boss.r, W - boss.r)); }
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 150));

  // Bucle principal con requestAnimationFrame y paso de tiempo variable (dt en segundos)
  let lastTs = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
    lastTs = ts;
    step(dt);
    render();
    if (state === 'playing' || state === 'dying') updateHUD(false);
  }

  // Inicio
  buildDiscover();
  Store.load();
  Sound.muted = Store.getMute();
  updateMuteButton();
  resize();
  initStars();
  resetWorld();
  setState('menu');
  refreshMenuStats();
  showScreen('menu');
  requestAnimationFrame(frame);
})();
