'use strict';
/* =========================================================
   CÓDIGO DE SUPERVIVENCIA: MISIÓN INFORMÁTICA — UMSS
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
    BASE: 600,            
    PLAYER_SPEED: 340,
    PLAYER_RADIUS: 12,    
    START_LIVES: 3,
    LEVEL_SECONDS: 35,
    MAX_PARTICLES: 320,
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

  const ENEMY_DEF = {
    virus:   { r: 20, hp: 1, pts: 100, spd: [85, 140],  color: '#ff2d75' },
    bug:     { r: 16, hp: 1, pts: 120, spd: [150, 225], color: '#ffb000' },
    corrupt: { r: 20, hp: 1, pts: 80,  spd: [100, 165], color: '#ff5a3c' },
    worm:    { r: 16, hp: 2, pts: 200, spd: [110, 150], color: '#a855f7' },
    trojan:  { r: 26, hp: 5, pts: 500, spd: [60, 80],   color: '#ff7a1a' }
  };
  const GLITCH = ['0xFF', 'NULL', '404', 'ERR', '}{', '#@!', 'NaN', '1/0', '???'];
  const CODE_LABELS = ['{ }', '</>', '01', 'if', '++', '=>', 'fn()'];

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

  /* ---------- 3. ALMACENAMIENTO ---------- */
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
            level: Math.max(1, Math.floor(e.level) || 1)
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

  /* ---------- 4. AUDIO ---------- */
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
    gameOver(){ this.seq([392, 330, 262, 196], 160, 'sawtooth', 0.05); }
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
    btnMute: $('btn-mute'), btnPause: $('btn-pause'), touchFire: $('touch-fire')
  };
  const ctx = el.canvas.getContext('2d');
  const SCREENS = ['menu', 'name', 'howto', 'pause', 'over', 'discover', 'board', 'confirm'];

  let W = 900, H = 600, S = 1, dpr = 1, bgGrad = null;
  let state = 'menu';          
  let currentScreen = 'menu', returnTo = 'menu';
  let playerName = 'PILOTO';

  const player = { x: 450, y: 500, vx: 0, vy: 0, tilt: 0, alive: true, shield: false, inv: 0, cool: 0, speedT: 0, fireT: 0, lives: CFG.START_LIVES };
  const bullets = [], enemies = [], ebullets = [], pickups = [], particles = [], rings = [], texts = [], stars = [];

  let time = 0, score = 0, level = 1, kills = 0, items = 0;
  let spawnT = 1, pickT = 3, shake = 0, flashA = 0, flashRGB = '255,40,80';
  let gridOff = 0, demoT = 0, deathTimer = 0, anim = 0;
  const keys = { left: false, right: false, up: false, down: false, fire: false };
  let touchFire = false, dragId = null, drag = null, touchTarget = null;

  /* ---------- 6. ENTIDADES Y SPAWN ---------- */
  const difficulty = () => 1 - Math.exp(-time / 110);     
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
    const pool = [['virus', 5], ['bug', 3], ['corrupt', 3]];
    if (!demo && level >= 2) pool.push(['worm', 3]);
    if (!demo && level >= 3) {
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

  /* ---------- 7. ACTUALIZACIÓN  ---------- */
  function checkLevel() {
    const nl = 1 + Math.floor(time / CFG.LEVEL_SECONDS);
    if (nl > level) {
      level = nl;
      showBanner('NIVEL ' + level + ' · ' + levelLabel(level).toUpperCase(), LEVEL_SUBS[Math.min(level, 4)]);
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
    for (const b of bullets) {
      if (b.dead) continue;
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
    const pr = CFG.PLAYER_RADIUS;
    for (const e of enemies) {
      if (e.dead) continue;
      const rr = e.r * 0.85 + pr;
      if (dist2(e, player) < rr * rr) { killEnemy(e, false); hurt(); if (!player.alive) break; }
    }
    compact(enemies);
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
  }

  function updateGame(dt) {
    const live = state === 'playing', demo = state === 'menu';
    if (live) { time += dt; score += dt * 10; checkLevel(); }
    updateBackground(dt);
    if (live || demo) {
      updatePlayer(dt, demo);
      spawnT -= dt;
      if (spawnT <= 0) { spawnEnemy(demo); spawnT = (demo ? 1.0 : 1.15 - 0.85 * difficulty()) * rand(0.75, 1.25); }
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

  function drawBackground() {
    if (!bgGrad) {
      bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#02020c'); bgGrad.addColorStop(0.6, '#070725'); bgGrad.addColorStop(1, '#14063a');
    }
    ctx.fillStyle = bgGrad; ctx.fillRect(-30, -30, W + 60, H + 60);
    ctx.strokeStyle = 'rgba(120,90,255,0.08)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = gridOff - 60; y <= H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      ctx.globalAlpha = (0.25 + 0.75 * s.z) * (0.7 + 0.3 * Math.sin(anim * 2 + s.ph));
      ctx.fillStyle = s.z > 0.75 ? '#aef6ff' : (s.z > 0.4 ? '#b9a8ff' : '#7f8bd6');
      ctx.fillRect(s.x, s.y, 0.7 + s.z * 1.6, 1 + s.z * 3);
    }
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

    for (const p of pickups) drawPickup(p);
    for (const e of enemies) drawEnemy(e);

    // Disparos enemigos
    for (const b of ebullets) {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fillStyle = '#ff7a1a'; ctx.fill();
      ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
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

    // Partículas 
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

    // Destello de pantalla (daño / subida de nivel)
    if (flashA > 0.01) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(' + flashRGB + ',' + flashA.toFixed(3) + ')';
      ctx.fillRect(0, 0, el.canvas.width, el.canvas.height);
    }
  }

  /* ---------- 9. HUD Y PANTALLAS ---------- */
  const hud = { score: -1, time: '', level: '', lives: '', speed: -1, fire: -1 };
  function updateHUD(force) {
    const s = Math.floor(score);
    if (force || s !== hud.score) { hud.score = s; el.hudScore.textContent = s; }
    const t = fmtTime(time);
    if (force || t !== hud.time) { hud.time = t; el.hudTime.textContent = t; }
    const lv = 'NIVEL ' + level + ' · ' + levelLabel(level).toUpperCase();
    if (force || lv !== hud.level) { hud.level = lv; el.hudLevel.textContent = lv; }
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
    void el.banner.offsetWidth;   
    el.banner.classList.add('show');
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

  function endGame() {
    setState('over');
    const sc = Math.floor(score);
    const prevBest = Store.best();
    const prevPersonal = Store.personalBest(playerName);
    const isRecord = sc > 0 && (!prevBest || sc > prevBest.score);
    const isPersonal = sc > 0 && !isRecord && sc > prevPersonal;
    const rank = Store.add({ name: playerName, score: sc, time: Math.floor(time), level });

    $('go-player').textContent = playerName;
    $('go-score').textContent = sc;
    $('go-time').textContent = fmtTime(time);
    $('go-level').textContent = level + ' · ' + levelLabel(level);
    $('go-kills').textContent = kills;
    $('go-items').textContent = items;
    const badge = $('go-record');
    badge.classList.toggle('hidden', !(isRecord || isPersonal));
    badge.textContent = isRecord ? '★ ¡NUEVO RÉCORD! ★' : '★ ¡NUEVO RÉCORD PERSONAL! ★';
    $('go-rank').textContent = rank <= 10 ? 'Puesto #' + rank + ' en la clasificación' : 'Fuera del Top 10 — ¡inténtalo de nuevo!';
    refreshMenuStats();
    showScreen('over');
    el.app.focus && el.app.blur();
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
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); });
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
    bgGrad = null;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 150));

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
