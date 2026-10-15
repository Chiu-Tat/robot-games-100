/* Angle 0 points up, 90 points forward (right), 180 points down.
   Positive knee bend folds the foot backward. Positive elbow bend
   brings the hand forward from a hanging arm. */

const TAU = Math.PI * 2;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function sn(phase) {
  return Math.sin((phase % 1) * TAU);
}

function cs(phase) {
  return Math.cos((phase % 1) * TAU);
}

function P(partial) {
  return Object.assign(
    {
      x: 0,
      y: 0,
      torso: 6,
      head: -6,
      armL: 168,
      elbowL: 16,
      armR: 192,
      elbowR: 16,
      legL: 174,
      kneeL: 8,
      legR: 186,
      kneeR: 8,
      scale: 1,
      propX: null,
      propY: null,
      propRot: 90,
      propA: 1,
      playX: null,
      playY: null,
      playRot: 0,
      playA: 1,
      medium: "ground",
      vehicle: null,
      stow: false,
      faceUp: false,
    },
    partial
  );
}

function tip(x, y, deg, len) {
  const r = (deg * Math.PI) / 180;
  return [x + Math.sin(r) * len, y - Math.cos(r) * len];
}

function run(phase, g) {
  const amp = (g && g.amp) || 1;
  const s = sn(phase);
  const c = cs(phase);
  return P({
    y: -Math.abs(s) * 5 * amp,
    torso: (g && g.lean) || 14,
    head: -8,
    armL: 175 + s * 56 * amp,
    elbowL: 26 + Math.max(0, s) * 22,
    armR: 175 - s * 56 * amp,
    elbowR: 26 + Math.max(0, -s) * 22,
    legL: 180 - s * 42 * amp,
    kneeL: 14 + Math.max(0, c) * 46,
    legR: 180 + s * 42 * amp,
    kneeR: 14 + Math.max(0, -c) * 46,
  });
}

function walk(phase, g) {
  const s = sn(phase);
  const c = cs(phase);
  return P({
    y: -Math.abs(s) * 1.5,
    torso: (g && g.lean) || 4,
    head: -2,
    armL: 180 + s * 28,
    elbowL: 10,
    armR: 180 - s * 28,
    elbowR: 10,
    legL: 180 - s * 24,
    kneeL: 8 + Math.max(0, c) * 18,
    legR: 180 + s * 24,
    kneeR: 8 + Math.max(0, -c) * 18,
  });
}

function hurdle(phase, g) {
  const pose = run(phase, g || { amp: 1, lean: 16 });
  const s = sn(phase);
  if (s > 0.15) {
    const k = (s - 0.15) / 0.85;
    pose.y = -k * 30;
    pose.torso = 20;
    pose.armL = 40;
    pose.elbowL = 12;
    pose.armR = 55;
    pose.elbowR = 14;
    pose.legL = 128;
    pose.kneeL = 72;
    pose.legR = 214;
    pose.kneeR = 36;
  }
  return pose;
}

function longjump(phase) {
  const p = phase % 1;
  if (p < 0.42) return run(p * 1.4, { amp: 1.05, lean: 16 });
  if (p < 0.72) {
    const u = (p - 0.42) / 0.3;
    return P({
      y: -Math.sin(u * Math.PI) * 34,
      torso: lerp(18, 8, u),
      head: -10,
      armL: lerp(150, 20, u),
      elbowL: 10,
      armR: lerp(210, 340, u),
      elbowR: 10,
      legL: lerp(150, 120, u),
      kneeL: lerp(20, 8, u),
      legR: lerp(210, 125, u),
      kneeR: 12,
    });
  }
  const u = (p - 0.72) / 0.28;
  return P({
    y: lerp(-8, 0, u),
    torso: lerp(10, 16, u),
    armL: 40,
    elbowL: 14,
    armR: 70,
    elbowR: 16,
    legL: lerp(120, 160, u),
    kneeL: lerp(8, 36, u),
    legR: lerp(128, 168, u),
    kneeR: lerp(10, 34, u),
  });
}

function highjump(phase) {
  const p = phase % 1;
  if (p < 0.4) {
    const pose = run(p * 1.2, { amp: 0.8, lean: 8 });
    pose.torso = -8;
    return pose;
  }
  const u = (p - 0.4) / 0.6;
  const air = Math.sin(Math.min(1, u * 1.15) * Math.PI);
  return P({
    y: -air * 38,
    torso: lerp(0, -70, Math.min(1, u * 1.3)),
    head: -10,
    faceUp: u > 0.25,
    armL: 250,
    elbowL: 12,
    armR: 300,
    elbowR: 12,
    legL: lerp(170, 250, u),
    kneeL: 16,
    legR: lerp(190, 280, u),
    kneeR: 18,
  });
}

function triple(phase) {
  const p = phase % 1;
  const hop = p < 0.33 ? p / 0.33 : p < 0.66 ? (p - 0.33) / 0.33 : (p - 0.66) / 0.34;
  const lift = p < 0.66 ? 18 : 32;
  const pose = run(hop, { amp: 0.85, lean: 12 });
  pose.y = -Math.sin(hop * Math.PI) * lift;
  if (p > 0.66) {
    pose.legL = 130;
    pose.kneeL = 16;
    pose.legR = 138;
    pose.kneeR = 14;
    pose.armL = 30;
    pose.armR = 330;
  }
  return pose;
}

function vault(phase) {
  const p = phase % 1;
  if (p < 0.4) {
    const pose = run(p * 1.3, { amp: 1, lean: 16 });
    pose.armR = 78;
    pose.elbowR = 8;
    pose.armL = 90;
    pose.elbowL = 10;
    return pose;
  }
  const u = (p - 0.4) / 0.6;
  return P({
    y: -Math.sin(u * Math.PI) * 46,
    torso: lerp(16, -50, u),
    head: -8,
    armL: lerp(80, 30, u),
    elbowL: 8,
    armR: lerp(70, 24, u),
    elbowR: 6,
    legL: lerp(170, 30, u),
    kneeL: 12,
    legR: lerp(190, 10, u),
    kneeR: 10,
  });
}

function tramp(phase) {
  const p = phase % 1;
  const bounce = Math.abs(sn(p));
  const tuck = bounce > 0.55;
  return P({
    y: -bounce * 42,
    torso: tuck ? 16 : 4,
    head: -6,
    armL: tuck ? 40 : 150,
    elbowL: tuck ? 16 : 10,
    armR: tuck ? 80 : 210,
    elbowR: tuck ? 18 : 10,
    legL: tuck ? 140 : 176,
    kneeL: tuck ? 70 : 8,
    legR: tuck ? 200 : 184,
    kneeR: tuck ? 60 : 8,
  });
}

function parkour(phase) {
  const p = phase % 1;
  if (p < 0.34) return run(p * 1.5, { amp: 1, lean: 18 });
  if (p < 0.68) {
    const u = (p - 0.34) / 0.34;
    return P({
      y: -Math.sin(u * Math.PI) * 32,
      torso: 24 + u * 16,
      head: -12,
      armL: 36,
      elbowL: 10,
      armR: 64,
      elbowR: 14,
      legL: 136,
      kneeL: 68,
      legR: 206,
      kneeR: 48,
    });
  }
  const u = (p - 0.68) / 0.32;
  return P({
    y: -(1 - u) * 6,
    torso: lerp(18, 8, u),
    armL: 160,
    elbowL: 18,
    armR: 200,
    elbowR: 18,
    legL: 168,
    kneeL: lerp(36, 10, u),
    legR: 196,
    kneeR: lerp(28, 10, u),
  });
}

function shot(phase) {
  const p = phase % 1;
  if (p < 0.55) {
    const u = p / 0.55;
    return P({
      y: lerp(0, 6, u),
      torso: lerp(6, -18, u),
      head: -4,
      armL: 150,
      elbowL: 20,
      armR: lerp(40, 20, u),
      elbowR: lerp(40, 70, u),
      legL: 160,
      kneeL: lerp(12, 36, u),
      legR: 200,
      kneeR: lerp(12, 30, u),
    });
  }
  const u = (p - 0.55) / 0.45;
  return P({
    y: lerp(6, -2, u),
    torso: lerp(-18, 22, u),
    armL: 190,
    elbowL: 16,
    armR: lerp(20, 70, u),
    elbowR: lerp(70, 8, u),
    legL: 168,
    kneeL: lerp(36, 10, u),
    legR: 188,
    kneeR: 12,
    propX: u > 0.35 ? lerp(18, 92, (u - 0.35) / 0.65) : null,
    propY: u > 0.35 ? lerp(-28, -10, (u - 0.35) / 0.65) : null,
    propA: u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2,
  });
}

function discus(phase) {
  const s = sn(phase);
  return P({
    y: -2,
    torso: s * 28,
    head: -6,
    armL: 210,
    elbowL: 18,
    armR: 108 + s * 36,
    elbowR: 8,
    legL: 158,
    kneeL: 26,
    legR: 208,
    kneeR: 18,
  });
}

function javelin(phase) {
  const p = phase % 1;
  if (p < 0.5) {
    const pose = run(p, { amp: 0.95, lean: 12 });
    pose.armR = 226;
    pose.elbowR = 8;
    return pose;
  }
  const u = (p - 0.5) / 0.5;
  return P({
    y: -Math.sin(u * Math.PI) * 6,
    torso: lerp(12, 20, u),
    armL: 150,
    elbowL: 14,
    armR: lerp(220, 55, u),
    elbowR: 8,
    legL: 166,
    kneeL: 14,
    legR: lerp(200, 150, u),
    kneeR: 12,
    propX: u > 0.4 ? lerp(30, 110, (u - 0.4) / 0.6) : null,
    propY: u > 0.4 ? lerp(-8, -36, (u - 0.4) / 0.6) : null,
    propRot: 70,
    propA: u < 0.82 ? 1 : 1 - (u - 0.82) / 0.18,
  });
}

function hammer(phase) {
  const arm = (phase % 1) * 360;
  const s = sn(phase);
  return P({
    y: -3,
    torso: s * 10,
    head: -4,
    armL: arm,
    elbowL: 12,
    armR: arm,
    elbowR: 10,
    legL: 162,
    kneeL: 22,
    legR: 202,
    kneeR: 20,
  });
}

function dribble(phase) {
  const bounce = Math.abs(sn(phase));
  const down = 1 - bounce;
  return P({
    y: -bounce * 3,
    torso: 8,
    head: -4,
    armL: 206,
    elbowL: 28,
    armR: 128 + down * 62,
    elbowR: 18 + bounce * 24,
    legL: 166,
    kneeL: 16,
    legR: 196,
    kneeR: 14,
    propX: 24,
    propY: 16 + down * 30,
    propRot: 0,
  });
}

function spike(phase) {
  const p = phase % 1;
  if (p < 0.45) {
    const u = p / 0.45;
    return P({
      y: lerp(0, -8, u),
      torso: 6,
      armL: 170,
      elbowL: 16,
      armR: lerp(200, 30, u),
      elbowR: lerp(16, 24, u),
      legL: 170,
      kneeL: 12,
      legR: 190,
      kneeR: 14,
      propX: 18,
      propY: lerp(0, -46, u),
    });
  }
  const u = (p - 0.45) / 0.55;
  return P({
    y: -Math.sin(Math.min(1, u * 1.2) * Math.PI) * 22,
    torso: lerp(4, 18, u),
    armL: 40,
    elbowL: 12,
    armR: lerp(30, 140, u),
    elbowR: 12,
    legL: 150,
    kneeL: 20,
    legR: 200,
    kneeR: 16,
    propX: lerp(22, 58, u),
    propY: lerp(-40, 10, u),
    propA: u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25,
  });
}

function throwBall(phase) {
  const p = phase % 1;
  if (p < 0.4) {
    const u = p / 0.4;
    return P({
      y: lerp(0, 4, u),
      torso: lerp(6, -14, u),
      armL: 160,
      elbowL: 20,
      armR: lerp(70, 250, u),
      elbowR: lerp(20, 40, u),
      legL: 168,
      kneeL: 14,
      legR: 196,
      kneeR: 16,
    });
  }
  const u = (p - 0.4) / 0.6;
  return P({
    y: -Math.sin(u * Math.PI) * 10,
    torso: lerp(-14, 16, u),
    armL: 180,
    elbowL: 16,
    armR: lerp(250, 60, u),
    elbowR: lerp(40, 10, u),
    legL: 160,
    kneeL: 12,
    legR: lerp(200, 155, u),
    kneeR: 14,
    propX: u > 0.25 ? lerp(16, 86, (u - 0.25) / 0.75) : null,
    propY: u > 0.25 ? lerp(-20, -4, (u - 0.25) / 0.75) : null,
    propA: u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2,
  });
}

function shoot(phase) {
  const p = phase % 1;
  const u = p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55;
  const e = smooth(u);
  return P({
    y: -e * 4,
    torso: 4,
    armL: lerp(150, 28, e),
    elbowL: lerp(16, 30, e),
    armR: lerp(170, 36, e),
    elbowR: lerp(16, 36, e),
    legL: 172,
    kneeL: lerp(8, 16, e),
    legR: 188,
    kneeR: lerp(8, 16, e),
    propX: e > 0.72 ? lerp(14, 36, (e - 0.72) / 0.28) : null,
    propY: e > 0.72 ? lerp(-36, -58, (e - 0.72) / 0.28) : null,
  });
}

function dodge(phase) {
  const p = phase % 1;
  const lean = p < 0.45 ? Math.sin((p / 0.45) * Math.PI) : 0;
  return P({
    x: -lean * 16,
    y: lean * 6,
    torso: lean * 28,
    head: -4,
    armL: 140,
    elbowL: 20,
    armR: p > 0.55 ? lerp(80, 20, (p - 0.55) / 0.45) : 170,
    elbowR: 16,
    legL: 160,
    kneeL: 20 + lean * 20,
    legR: 200,
    kneeR: 16,
    propX: p > 0.55 ? lerp(20, 78, (p - 0.55) / 0.45) : -36,
    propY: p > 0.55 ? lerp(-10, 8, (p - 0.55) / 0.45) : 6,
    propA: 1,
  });
}

function kick(phase) {
  const p = phase % 1;
  if (p < 0.42) {
    const u = p / 0.42;
    return P({
      torso: 8 + u * 4,
      armL: 150,
      elbowL: 18,
      armR: 214,
      elbowR: 16,
      legL: 172,
      kneeL: 10,
      legR: 196 + u * 24,
      kneeR: 16 + u * 46,
      propX: 28,
      propY: 44,
    });
  }
  const u = (p - 0.42) / 0.58;
  return P({
    y: -Math.sin(Math.min(1, u * 1.3) * Math.PI) * 6,
    torso: lerp(12, 6, u),
    armL: 140,
    elbowL: 14,
    armR: 200,
    elbowR: 14,
    legL: 176,
    kneeL: 10,
    legR: lerp(220, 128, u),
    kneeR: lerp(60, 8, u),
    propX: lerp(28, 100, u),
    propY: 44 - Math.sin(u * Math.PI) * 34,
    propA: u < 0.72 ? 1 : 1 - (u - 0.72) / 0.28,
  });
}

function carry(phase, g) {
  const pose = run(phase, { amp: 1, lean: 16 });
  pose.armR = 150;
  pose.elbowR = 55;
  return pose;
}

function swing(phase, g) {
  const amp = (g && g.amp) || 1;
  const p = phase % 1;
  const ballT = p < 0.62 ? 0 : (p - 0.62) / 0.38;
  let arm = 230;
  let torso = -8;
  if (p < 0.45) {
    const u = smooth(p / 0.45);
    arm = lerp(200, 248, u);
    torso = lerp(4, -16, u);
  } else {
    const u = smooth((p - 0.45) / 0.55);
    arm = lerp(248, 70, u) * (0.75 + amp * 0.25);
    torso = lerp(-16, 22, u);
  }
  return P({
    y: p > 0.45 ? -4 : 2,
    torso,
    head: -4,
    armL: 160,
    elbowL: 18,
    armR: arm,
    elbowR: 14,
    legL: 166,
    kneeL: 16,
    legR: 198,
    kneeR: 14,
    playX: ballT ? lerp(34, 92, ballT) : 36,
    playY: ballT ? lerp(8, -22, ballT) : 10,
    playA: ballT < 0.8 ? 1 : 1 - (ballT - 0.8) / 0.2,
  });
}

function cradle(phase) {
  const s = sn(phase);
  return P({
    x: s * 6,
    y: -Math.abs(s) * 3,
    torso: 10,
    head: -6,
    armL: 150 + s * 10,
    elbowL: 22,
    armR: 118 + s * 16,
    elbowR: 28,
    legL: 180 - s * 22,
    kneeL: 16,
    legR: 180 + s * 22,
    kneeR: 16,
    playX: 26 + s * 4,
    playY: -6,
  });
}

function stick(phase, g) {
  const s = sn(phase);
  const pose = run(phase, { amp: 0.55, lean: (g && g.lean) || 12 });
  pose.armR = 128 + s * 10;
  pose.elbowR = 18;
  pose.vehicle = (g && g.vehicle) || null;
  pose.playX = 30 + s * 8;
  pose.playY = 40;
  return pose;
}

function frisbee(phase) {
  const p = phase % 1;
  if (p < 0.4) {
    return P({
      torso: lerp(6, -12, p / 0.4),
      armL: 170,
      elbowL: 16,
      armR: lerp(80, 230, p / 0.4),
      elbowR: 16,
      legL: 170,
      kneeL: 12,
      legR: 194,
      kneeR: 12,
    });
  }
  const u = (p - 0.4) / 0.6;
  return P({
    torso: lerp(-12, 14, u),
    armL: 190,
    elbowL: 14,
    armR: lerp(230, 60, u),
    elbowR: 10,
    legL: 166,
    kneeL: 12,
    legR: 188,
    kneeR: 10,
    propX: u > 0.3 ? lerp(16, 96, (u - 0.3) / 0.7) : null,
    propY: u > 0.3 ? lerp(-6, -16, (u - 0.3) / 0.7) : null,
    propRot: 80 + u * 180,
    propA: u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2,
  });
}

function racket(phase) {
  const s = sn(phase);
  return P({
    y: -Math.max(0, s) * 3,
    torso: 8 + s * 6,
    head: -4,
    armL: 188,
    elbowL: 16,
    armR: 130 + s * 52,
    elbowR: 22,
    legL: 170,
    kneeL: 12,
    legR: 194,
    kneeR: 12,
    playX: 36 + s * 34,
    playY: 4 + Math.abs(s) * 8,
    playA: 1,
  });
}

function golf(phase) {
  const p = phase % 1;
  let torso = 6;
  let arm = 70;
  if (p < 0.4) {
    const u = smooth(p / 0.4);
    torso = lerp(6, -20, u);
    arm = lerp(80, 250, u);
  } else {
    const u = smooth((p - 0.4) / 0.45);
    torso = lerp(-20, 24, Math.min(1, u));
    arm = lerp(250, 40, Math.min(1, u));
  }
  const hit = p > 0.58;
  const u = hit ? (p - 0.58) / 0.42 : 0;
  return P({
    y: 2,
    torso,
    head: -8,
    armL: arm + 8,
    elbowL: 12,
    armR: arm,
    elbowR: 10,
    legL: 164,
    kneeL: 16,
    legR: 196,
    kneeR: 12,
    playX: hit ? lerp(30, 100, u) : 30,
    playY: hit ? 40 - Math.sin(u * Math.PI) * 28 : 42,
    playA: u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25,
  });
}

function bowl(phase) {
  const p = phase % 1;
  const u = p < 0.35 ? 0 : (p - 0.35) / 0.65;
  const s = sn(Math.min(p, 0.35) / 0.35);
  return P({
    x: lerp(0, 10, u),
    y: 2,
    torso: 16 + (p < 0.35 ? s * 8 : 8),
    armL: 150,
    elbowL: 14,
    armR: p < 0.35 ? lerp(170, 230, p / 0.35) : lerp(230, 70, u),
    elbowR: 10,
    legL: lerp(172, 150, u),
    kneeL: 12,
    legR: lerp(188, 200, u),
    kneeR: lerp(10, 8, u),
    propX: p < 0.4 ? null : lerp(10, 110, (p - 0.4) / 0.6),
    propY: p < 0.4 ? null : 44,
    propA: 1,
  });
}

function cue(phase) {
  const s = sn(phase * 0.5);
  const poke = Math.max(0, sn(phase));
  return P({
    y: 10,
    torso: 48,
    head: -20,
    armL: 120,
    elbowL: 16,
    armR: 100 + poke * 18,
    elbowR: 22,
    legL: 150,
    kneeL: 20,
    legR: 196,
    kneeR: 12,
    playX: 48 + poke * 26,
    playY: 46,
    playA: 1,
  });
}

function darts(phase) {
  const p = phase % 1;
  const aim = p < 0.55;
  const u = aim ? p / 0.55 : (p - 0.55) / 0.45;
  return P({
    torso: 4,
    head: -2,
    armL: 170,
    elbowL: 16,
    armR: aim ? lerp(80, 40, u) : lerp(40, 70, u),
    elbowR: aim ? lerp(30, 70, u) : lerp(70, 16, u),
    legL: 176,
    kneeL: 8,
    legR: 186,
    kneeR: 8,
    propX: aim ? null : lerp(22, 100, u),
    propY: aim ? null : lerp(-18, -22, u),
    propRot: 78,
    propA: !aim && u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1,
  });
}

function archery(phase) {
  const p = phase % 1;
  const draw = p < 0.62 ? smooth(p / 0.62) : 1;
  const loose = p > 0.62 ? (p - 0.62) / 0.38 : 0;
  return P({
    torso: -4,
    head: -2,
    armL: 86,
    elbowL: 8,
    armR: lerp(86, 130, draw),
    elbowR: lerp(10, 50, draw),
    legL: 172,
    kneeL: 8,
    legR: 190,
    kneeR: 8,
    playX: loose ? lerp(40, 112, loose) : null,
    playY: loose ? -8 : null,
    playRot: 80,
    playA: loose < 0.8 ? 1 : 1 - (loose - 0.8) / 0.2,
    playKind: "arrow",
  });
}

function bocce(phase) {
  const p = phase % 1;
  if (p < 0.5) {
    return P({
      y: lerp(0, 4, p / 0.5),
      torso: lerp(6, 16, p / 0.5),
      armR: lerp(40, 150, p / 0.5),
      elbowR: 16,
      armL: 170,
      elbowL: 14,
      legL: 168,
      kneeL: 14,
      legR: 194,
      kneeR: 12,
    });
  }
  const u = (p - 0.5) / 0.5;
  return P({
    torso: lerp(16, 8, u),
    armR: lerp(150, 50, u),
    elbowR: 12,
    armL: 180,
    elbowL: 12,
    legL: 170,
    kneeL: 10,
    legR: 188,
    kneeR: 10,
    propX: lerp(16, 78, u),
    propY: lerp(-4, 36, u),
    propA: u < 0.85 ? 1 : 1 - (u - 0.85) / 0.15,
  });
}

function croquet(phase) {
  const s = Math.max(0, sn(phase));
  return P({
    y: 4,
    torso: 22,
    head: -10,
    armL: 100,
    elbowL: 14,
    armR: 108 + s * 22,
    elbowR: 12,
    legL: 166,
    kneeL: 12,
    legR: 192,
    kneeR: 10,
    playX: 38 + s * 24,
    playY: 44,
  });
}

function cornhole(phase) {
  const p = phase % 1;
  const u = p < 0.4 ? 0 : (p - 0.4) / 0.6;
  return P({
    torso: 6,
    armL: 180,
    elbowL: 14,
    armR: p < 0.4 ? lerp(70, 250, p / 0.4) : lerp(250, 60, u),
    elbowR: 16,
    legL: 174,
    kneeL: 8,
    legR: 188,
    kneeR: 8,
    propX: u ? lerp(12, 86, u) : null,
    propY: u ? lerp(-6, 6, u) - Math.sin(u * Math.PI) * 28 : null,
    propA: u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2,
  });
}

function box(phase) {
  const p = phase % 1;
  const jab = p < 0.32 ? Math.sin((p / 0.32) * Math.PI) : 0;
  const cross = p > 0.4 && p < 0.72 ? Math.sin(((p - 0.4) / 0.32) * Math.PI) : 0;
  return P({
    y: -2,
    torso: 8 + cross * 8,
    head: -4,
    armL: lerp(130, 70, jab),
    elbowL: lerp(55, 12, jab),
    armR: lerp(128, 62, cross),
    elbowR: lerp(58, 10, cross),
    legL: 166,
    kneeL: 18,
    legR: 198,
    kneeR: 16,
  });
}

function kickbox(phase) {
  const p = phase % 1;
  if (p < 0.55) {
    return P({
      torso: 8,
      armL: 124,
      elbowL: 58,
      armR: 132,
      elbowR: 56,
      legL: 168,
      kneeL: 16,
      legR: lerp(190, 230, p / 0.55),
      kneeR: lerp(16, 70, p / 0.55),
    });
  }
  const u = (p - 0.55) / 0.45;
  return P({
    y: -Math.sin(u * Math.PI) * 6,
    torso: lerp(8, 14, u),
    armL: 110,
    elbowL: 40,
    armR: 150,
    elbowR: 36,
    legL: 172,
    kneeL: 12,
    legR: lerp(230, 120, u),
    kneeR: lerp(70, 16, u),
  });
}

function grapple(phase) {
  const s = sn(phase);
  return P({
    y: 8 + s * 2,
    torso: 22,
    head: -8,
    armL: 120 + s * 8,
    elbowL: 40,
    armR: 86 + s * 10,
    elbowR: 36,
    legL: 150,
    kneeL: 42,
    legR: 206,
    kneeR: 36,
  });
}

function judo(phase) {
  const p = phase % 1;
  const u = p < 0.45 ? smooth(p / 0.45) : smooth(1 - (p - 0.45) / 0.55);
  return P({
    y: lerp(0, 6, u),
    torso: lerp(8, 36, u),
    head: -10,
    armL: lerp(110, 70, u),
    elbowL: 30,
    armR: lerp(100, 60, u),
    elbowR: 28,
    legL: lerp(170, 140, u),
    kneeL: lerp(10, 24, u),
    legR: lerp(190, 210, u),
    kneeR: 16,
  });
}

function karate(phase) {
  const p = phase % 1;
  const u = p < 0.35 ? 0 : p < 0.6 ? smooth((p - 0.35) / 0.25) : Math.max(0, 1 - (p - 0.6) / 0.4);
  return P({
    torso: lerp(4, 14, u),
    head: -2,
    armL: 168,
    elbowL: 16,
    armR: lerp(150, 78, u),
    elbowR: lerp(40, 8, u),
    legL: 158,
    kneeL: 12,
    legR: 200,
    kneeR: 10,
  });
}

function tkd(phase) {
  const p = phase % 1;
  if (p < 0.4) {
    const u = p / 0.4;
    return P({
      torso: 4,
      armL: 130,
      elbowL: 40,
      armR: 150,
      elbowR: 36,
      legL: 174,
      kneeL: 8,
      legR: lerp(186, 150, u),
      kneeR: lerp(8, 80, u),
    });
  }
  const u = (p - 0.4) / 0.6;
  const snap = Math.sin(Math.min(1, u * 1.2) * Math.PI);
  return P({
    y: -snap * 8,
    torso: -6,
    armL: 40,
    elbowL: 16,
    armR: 70,
    elbowR: 18,
    legL: 176,
    kneeL: 8,
    legR: lerp(150, 80, snap),
    kneeR: lerp(80, 8, snap),
  });
}

function fence(phase) {
  const p = phase % 1;
  const lunge = p > 0.4 && p < 0.75 ? Math.sin(((p - 0.4) / 0.35) * Math.PI) : 0;
  return P({
    x: lunge * 16,
    y: lunge * 2,
    torso: 14,
    head: -8,
    armL: 150,
    elbowL: 30,
    armR: lerp(100, 72, lunge),
    elbowR: lerp(18, 6, lunge),
    legL: lerp(168, 140, lunge),
    kneeL: lerp(12, 8, lunge),
    legR: lerp(196, 214, lunge),
    kneeR: lerp(16, 42, lunge),
  });
}

function kendo(phase) {
  const p = phase % 1;
  const cut = p > 0.35 && p < 0.7 ? Math.sin(((p - 0.35) / 0.35) * Math.PI) : 0;
  return P({
    y: -cut * 4,
    torso: lerp(6, 20, cut),
    head: -4,
    armL: lerp(40, 110, cut),
    elbowL: lerp(16, 10, cut),
    armR: lerp(46, 120, cut),
    elbowR: lerp(14, 8, cut),
    legL: 166,
    kneeL: 18,
    legR: 198,
    kneeR: 16,
  });
}

function sumo(phase) {
  const p = phase % 1;
  const stomp = p < 0.5 ? Math.sin((p / 0.5) * Math.PI) : 0;
  const charge = p > 0.55 ? (p - 0.55) / 0.45 : 0;
  return P({
    x: charge * 20,
    y: 4 - stomp * 8,
    torso: lerp(8, 22, charge),
    head: -4,
    armL: lerp(140, 90, charge),
    elbowL: 20,
    armR: lerp(210, 80, charge),
    elbowR: 18,
    legL: 148,
    kneeL: 30 - stomp * 10,
    legR: 214,
    kneeR: 28,
    scale: 1.08,
  });
}

function capoeira(phase) {
  const s = sn(phase);
  const kick = Math.max(0, cs(phase));
  return P({
    x: s * 8,
    y: 4 - kick * 6,
    torso: s * 16,
    head: -4,
    armL: 150 + s * 20,
    elbowL: 18,
    armR: 40 - s * 16,
    elbowR: 14,
    legL: 168,
    kneeL: 16,
    legR: lerp(190, 110, kick),
    kneeR: lerp(16, 10, kick),
  });
}

function swim(phase) {
  const s = sn(phase);
  const arm = (phase % 1) * 360;
  const other = (arm + 180) % 360;
  return P({
    medium: "water",
    y: sn(phase * 2) * 2,
    torso: 74 + s * 5,
    head: -18,
    armR: arm,
    elbowR: arm < 180 ? 16 : 58,
    armL: other,
    elbowL: other < 180 ? 16 : 58,
    legL: 82 + s * 16,
    kneeL: 8,
    legR: 98 - s * 16,
    kneeR: 8,
  });
}

function backstroke(phase) {
  const s = sn(phase);
  const arm = (phase % 1) * 360;
  return P({
    medium: "water",
    faceUp: true,
    y: -2,
    torso: 78,
    head: 8,
    armR: arm,
    elbowR: 18,
    armL: (arm + 180) % 360,
    elbowL: 18,
    legL: 84 + s * 12,
    kneeL: 6,
    legR: 96 - s * 12,
    kneeR: 6,
  });
}

function breast(phase) {
  const p = phase % 1;
  const sweep = p < 0.45 ? smooth(p / 0.45) : smooth(1 - (p - 0.45) / 0.55);
  const kick = p > 0.4 && p < 0.75 ? Math.sin(((p - 0.4) / 0.35) * Math.PI) : 0;
  return P({
    medium: "water",
    y: -kick * 3,
    torso: 70,
    head: -16,
    armL: lerp(88, 170, sweep),
    elbowL: lerp(8, 30, sweep),
    armR: lerp(88, 170, sweep),
    elbowR: lerp(8, 30, sweep),
    legL: lerp(80, 130, kick),
    kneeL: lerp(6, 50, kick),
    legR: lerp(86, 140, kick),
    kneeR: lerp(6, 50, kick),
  });
}

function fly(phase) {
  const s = sn(phase);
  const arm = (phase % 1) * 360;
  return P({
    medium: "water",
    y: s * 7,
    torso: 68 + s * 12,
    head: -18,
    armL: arm,
    elbowL: 16,
    armR: arm,
    elbowR: 16,
    legL: 74 + s * 12,
    kneeL: 8,
    legR: 80 + s * 12,
    kneeR: 8,
  });
}

function dive(phase) {
  const p = phase % 1;
  if (p < 0.22) {
    const u = p / 0.22;
    return P({
      y: Math.sin(u * Math.PI) * 4,
      torso: lerp(4, 18, u),
      armL: lerp(170, 200, u),
      elbowL: 10,
      armR: lerp(190, 160, u),
      elbowR: 10,
      legL: 170,
      kneeL: lerp(8, 28, u),
      legR: 190,
      kneeR: lerp(8, 26, u),
    });
  }
  if (p < 0.48) {
    const u = (p - 0.22) / 0.26;
    return P({
      y: lerp(0, -40, u),
      torso: lerp(12, 78, u),
      head: -10,
      armL: lerp(160, 24, u),
      elbowL: 8,
      armR: lerp(150, 16, u),
      elbowR: 8,
      legL: 172,
      kneeL: 10,
      legR: 186,
      kneeR: 10,
    });
  }
  const u = (p - 0.48) / 0.52;
  return P({
    y: lerp(-28, 70, u),
    torso: lerp(84, 96, u),
    head: -8,
    armL: 18,
    elbowL: 6,
    armR: 12,
    elbowR: 6,
    legL: 150,
    kneeL: lerp(8, 20, u),
    legR: 164,
    kneeR: lerp(8, 16, u),
  });
}

function tread(phase) {
  const s = sn(phase);
  return P({
    medium: "water",
    y: -18 + s * 2,
    torso: 6,
    head: -4,
    armL: 150 + s * 16,
    elbowL: 18,
    armR: 28 + s * 8,
    elbowR: 22,
    legL: 140 + s * 14,
    kneeL: 22,
    legR: 210 - s * 14,
    kneeR: 20,
  });
}

function surf(phase) {
  const s = sn(phase);
  return P({
    y: 2 + s,
    torso: 14 + s * 6,
    head: -6,
    armL: 214,
    elbowL: 12,
    armR: 42,
    elbowR: 10,
    legL: 156,
    kneeL: 34,
    legR: 198,
    kneeR: 30,
    vehicle: "surf",
  });
}

function row(phase) {
  const s = sn(phase);
  const pull = (s + 1) / 2;
  return P({
    y: 22,
    torso: lerp(36, 14, pull),
    head: -12,
    armL: lerp(150, 80, pull),
    elbowL: lerp(10, 36, pull),
    armR: lerp(150, 80, pull),
    elbowR: lerp(10, 36, pull),
    legL: lerp(150, 168, pull),
    kneeL: lerp(56, 16, pull),
    legR: lerp(210, 192, pull),
    kneeR: lerp(50, 14, pull),
    vehicle: "rowboat",
  });
}

function kayak(phase) {
  const s = sn(phase);
  return P({
    y: 24,
    torso: 8 + s * 4,
    head: -6,
    armL: 78 + s * 48,
    elbowL: 14,
    armR: 104 - s * 48,
    elbowR: 14,
    legL: 148,
    kneeL: 58,
    legR: 204,
    kneeR: 42,
    vehicle: "kayak",
  });
}

function sail(phase) {
  const s = sn(phase);
  return P({
    y: 6,
    torso: s * 7,
    head: -4,
    armL: 156,
    elbowL: 18,
    armR: 36 + s * 8,
    elbowR: 12,
    legL: 166,
    kneeL: 14,
    legR: 196,
    kneeR: 12,
    vehicle: "sail",
  });
}

function ski(phase, g) {
  const s = sn(phase);
  return P({
    y: 10,
    torso: (g && g.lean) || 28,
    head: -14,
    armL: 148 + s * 14,
    elbowL: 18,
    armR: 48,
    elbowR: 12,
    legL: 164,
    kneeL: 38,
    legR: 190,
    kneeR: 36,
    vehicle: "ski",
  });
}

function xcski(phase) {
  const s = sn(phase);
  return P({
    y: 2,
    torso: 14,
    head: -8,
    armL: 128 + s * 42,
    elbowL: 14,
    armR: 128 - s * 42,
    elbowR: 14,
    legL: 172 - s * 26,
    kneeL: 14,
    legR: 184 + s * 26,
    kneeR: 14,
    vehicle: "ski",
  });
}

function snowboard(phase) {
  const s = sn(phase);
  return P({
    y: 8 + s * 2,
    torso: 18 + s * 6,
    head: -6,
    armL: 136,
    elbowL: 14,
    armR: 48,
    elbowR: 10,
    legL: 158,
    kneeL: 42,
    legR: 190,
    kneeR: 40,
    vehicle: "snowboard",
  });
}

function skijump(phase) {
  const p = phase % 1;
  if (p < 0.35) {
    return P({
      y: 12,
      torso: 36,
      head: -16,
      armL: 150,
      elbowL: 16,
      armR: 160,
      elbowR: 16,
      legL: 160,
      kneeL: 46,
      legR: 186,
      kneeR: 44,
      vehicle: "ski",
    });
  }
  const u = (p - 0.35) / 0.65;
  return P({
    y: lerp(8, -18, Math.sin(Math.min(1, u) * Math.PI)),
    torso: lerp(36, 18, u),
    head: -8,
    armL: lerp(150, 200, u),
    elbowL: 10,
    armR: lerp(160, 20, u),
    elbowR: 8,
    legL: lerp(160, 150, u),
    kneeL: lerp(46, 12, u),
    legR: lerp(186, 168, u),
    kneeR: lerp(44, 10, u),
    vehicle: "ski",
  });
}

function spin(phase) {
  const s = sn(phase);
  return P({
    y: -2,
    torso: s * 8,
    head: -4,
    armL: 36 + s * 16,
    elbowL: 10,
    armR: 78 - s * 14,
    elbowR: 12,
    legL: 176,
    kneeL: 6,
    legR: 248 + s * 8,
    kneeR: 8,
    vehicle: "skates",
  });
}

function skate(phase, g) {
  const s = sn(phase);
  return P({
    y: -1,
    torso: (g && g.lean) || 22,
    head: -10,
    armL: 156 + s * 18,
    elbowL: 16,
    armR: 196 - s * 14,
    elbowR: 14,
    legL: 174 - s * 30,
    kneeL: 18 + Math.max(0, s) * 16,
    legR: 186 + s * 30,
    kneeR: 16 + Math.max(0, -s) * 18,
    vehicle: (g && g.vehicle) || "skates",
  });
}

function curl(phase) {
  const p = phase % 1;
  const slide = p < 0.7 ? smooth(p / 0.7) : 1;
  return P({
    x: slide * 18,
    y: lerp(0, 8, slide),
    torso: lerp(8, 42, slide),
    head: -12,
    armL: lerp(150, 90, slide),
    elbowL: 16,
    armR: lerp(120, 70, slide),
    elbowR: 14,
    legL: lerp(172, 150, slide),
    kneeL: lerp(8, 20, slide),
    legR: lerp(190, 214, slide),
    kneeR: lerp(10, 48, slide),
    propX: lerp(16, 70, slide),
    propY: lerp(20, 42, slide),
    propA: 1,
  });
}

function bobsled(phase) {
  const p = phase % 1;
  if (p < 0.35) {
    const pose = run(p * 2, { amp: 1.1, lean: 20 });
    pose.vehicle = null;
    return pose;
  }
  return P({
    y: 16,
    torso: 52,
    head: -22,
    armL: 110,
    elbowL: 20,
    armR: 100,
    elbowR: 18,
    legL: 150,
    kneeL: 40,
    legR: 196,
    kneeR: 36,
    vehicle: "sled",
  });
}

function biathlon(phase) {
  if (phase % 1 < 0.58) {
    const pose = xcski(phase);
    pose.stow = true;
    return pose;
  }
  const u = ((phase % 1) - 0.58) / 0.42;
  return P({
    torso: 2,
    head: -2,
    armL: lerp(120, 92, u),
    elbowL: lerp(16, 36, u),
    armR: lerp(130, 96, u),
    elbowR: lerp(16, 42, u),
    legL: 172,
    kneeL: 10,
    legR: 188,
    kneeR: 8,
    vehicle: "ski",
    stow: false,
  });
}

function cycle(phase, g) {
  const s = sn(phase);
  return P({
    y: 14,
    torso: (g && g.lean) || 24,
    head: -16,
    armL: 112,
    elbowL: 26,
    armR: 104,
    elbowR: 28,
    legL: 158 + s * 22,
    kneeL: 34 + Math.max(0, s) * 28,
    legR: 158 - s * 22,
    kneeR: 34 + Math.max(0, -s) * 28,
    vehicle: (g && g.vehicle) || "bike",
  });
}

function skateboard(phase) {
  const p = phase % 1;
  const ollie = p > 0.62 ? Math.sin(((p - 0.62) / 0.38) * Math.PI) : 0;
  const s = sn(phase);
  return P({
    y: -ollie * 22 + 4,
    torso: 12 + ollie * 8,
    head: -6,
    armL: 150 + s * 10,
    elbowL: 16,
    armR: 40,
    elbowR: 12,
    legL: 162,
    kneeL: lerp(28, 50, ollie),
    legR: 196,
    kneeR: lerp(18, 36, ollie),
    vehicle: "skateboard",
  });
}

function floor(phase) {
  const p = phase % 1;
  if (p < 0.4) return run(p * 1.4, { amp: 0.9, lean: 12 });
  if (p < 0.7) {
    const u = (p - 0.4) / 0.3;
    return P({
      y: -Math.sin(u * Math.PI) * 28,
      torso: lerp(10, 200, u),
      armL: lerp(160, 20, u),
      elbowL: 8,
      armR: lerp(40, 340, u),
      elbowR: 8,
      legL: lerp(170, 40, u),
      kneeL: 12,
      legR: lerp(190, 20, u),
      kneeR: 10,
    });
  }
  const u = (p - 0.7) / 0.3;
  return P({
    y: lerp(-4, 0, u),
    torso: lerp(16, 4, u),
    armL: lerp(40, 150, u),
    elbowL: 10,
    armR: lerp(70, 200, u),
    elbowR: 10,
    legL: 170,
    kneeL: lerp(30, 8, u),
    legR: 190,
    kneeR: lerp(28, 8, u),
  });
}

function beam(phase) {
  const s = sn(phase * 0.5);
  return P({
    x: s * 4,
    y: -16,
    torso: s * 4,
    head: -4,
    armL: 110,
    elbowL: 10,
    armR: 70,
    elbowR: 10,
    legL: 176 + s * 6,
    kneeL: 6,
    legR: 184 - s * 6,
    kneeR: 6,
  });
}

function rings(phase) {
  const p = phase % 1;
  const support = p > 0.35 && p < 0.8 ? smooth(Math.min(1, (p - 0.35) / 0.2)) * (p < 0.65 ? 1 : 1 - (p - 0.65) / 0.15) : 0;
  return P({
    y: lerp(18, -28, support),
    torso: lerp(4, 2, support),
    armL: lerp(168, 200, support),
    elbowL: lerp(8, 6, support),
    armR: lerp(192, 160, support),
    elbowR: 8,
    legL: lerp(176, 178, support),
    kneeL: 6,
    legR: lerp(184, 186, support),
    kneeR: 6,
  });
}

function pbars(phase) {
  const s = sn(phase);
  return P({
    y: -8 + s * 10,
    torso: 10 + s * 16,
    head: -8,
    armL: 196,
    elbowL: 8,
    armR: 164,
    elbowR: 8,
    legL: 170 + s * 16,
    kneeL: 10,
    legR: 190 + s * 10,
    kneeR: 10,
  });
}

function pommel(phase) {
  const s = sn(phase);
  const arm = (phase % 1) * 360;
  return P({
    y: -6,
    torso: 8 + s * 6,
    armL: 150 + s * 30,
    elbowL: 12,
    armR: 200 - s * 30,
    elbowR: 12,
    legL: 150 + s * 40,
    kneeL: 8,
    legR: 170 + s * 40,
    kneeR: 8,
    x: Math.cos(arm * Math.PI / 180) * 6,
  });
}

function lift(phase) {
  const p = phase % 1;
  const pull = p < 0.42 ? smooth(p / 0.42) : 1;
  const catchU = p > 0.42 ? Math.min(1, (p - 0.42) / 0.28) : 0;
  return P({
    y: lerp(10, -2, pull) + catchU * 4,
    torso: lerp(28, 4, pull),
    head: -8,
    armL: lerp(150, 18, Math.min(1, pull + catchU)),
    elbowL: lerp(14, 8, pull),
    armR: lerp(170, 24, Math.min(1, pull + catchU)),
    elbowR: lerp(12, 8, pull),
    legL: lerp(150, 172, pull),
    kneeL: lerp(48, 10, pull),
    legR: lerp(200, 188, pull),
    kneeR: lerp(40, 12, pull),
  });
}

function climb(phase) {
  const s = sn(phase);
  const reach = (s + 1) / 2;
  return P({
    x: 8,
    y: -reach * 10,
    torso: -8,
    head: -4,
    armL: lerp(200, 150, reach),
    elbowL: 16,
    armR: lerp(120, 40, reach),
    elbowR: 14,
    legL: lerp(170, 140, reach),
    kneeL: lerp(16, 40, reach),
    legR: lerp(200, 180, reach),
    kneeR: 20,
  });
}

function jumprope(phase) {
  const hop = Math.abs(sn(phase));
  return P({
    y: -Math.pow(hop, 0.7) * 12,
    torso: 4,
    armL: 150,
    elbowL: 14,
    armR: 208,
    elbowR: 14,
    legL: 176,
    kneeL: hop * 18,
    legR: 184,
    kneeR: hop * 16,
  });
}

function ribbon(phase) {
  const s = sn(phase);
  const c = cs(phase);
  return P({
    y: -Math.abs(s) * 4,
    torso: s * 8,
    head: -4,
    armL: 40 + c * 20,
    elbowL: 12,
    armR: 70 + s * 40,
    elbowR: 16,
    legL: 160,
    kneeL: 10,
    legR: 200 + s * 8,
    kneeR: 12,
  });
}

function cheer(phase) {
  const p = phase % 1;
  const hop = p > 0.45 ? Math.sin(((p - 0.45) / 0.55) * Math.PI) : 0;
  const clap = p < 0.3 ? Math.sin((p / 0.3) * Math.PI) : 0;
  return P({
    y: -hop * 20,
    torso: 2,
    armL: lerp(40, 150, clap) ,
    elbowL: lerp(8, 20, clap),
    armR: lerp(320, 210, clap),
    elbowR: lerp(8, 20, clap),
    legL: hop > 0.4 ? 150 : 174,
    kneeL: hop > 0.4 ? 40 : 8,
    legR: hop > 0.4 ? 210 : 186,
    kneeR: hop > 0.4 ? 36 : 8,
  });
}

function breaking(phase) {
  const p = phase % 1;
  if (p < 0.55) {
    const s = sn(p / 0.55);
    return P({
      x: s * 10,
      y: -Math.abs(s) * 6,
      torso: 8,
      armL: 150,
      elbowL: 18,
      armR: 40,
      elbowR: 12,
      legL: 168 + s * 10,
      kneeL: 16,
      legR: 196 - s * 8,
      kneeR: 14,
    });
  }
  return P({
    y: 8,
    torso: 70,
    head: -10,
    armL: 40,
    elbowL: 16,
    armR: 168,
    elbowR: 10,
    legL: 120,
    kneeL: 60,
    legR: 210,
    kneeR: 40,
  });
}

function yoga(phase) {
  const p = phase % 1;
  const toTree = p < 0.45 ? 0 : p < 0.7 ? smooth((p - 0.45) / 0.25) : p < 0.85 ? 1 : 1 - smooth((p - 0.85) / 0.15);
  return P({
    torso: lerp(2, 0, toTree),
    head: -2,
    armL: lerp(250, 340, toTree),
    elbowL: 8,
    armR: lerp(110, 20, toTree),
    elbowR: 8,
    legL: 168,
    kneeL: 8,
    legR: lerp(200, 146, toTree),
    kneeR: lerp(10, 78, toTree),
  });
}

function tug(phase) {
  const s = sn(phase);
  const haul = (s + 1) / 2;
  return P({
    x: -haul * 6,
    y: 4,
    torso: lerp(-18, -28, haul),
    head: 4,
    armL: lerp(120, 80, haul),
    elbowL: 20,
    armR: lerp(140, 60, haul),
    elbowR: 18,
    legL: 156,
    kneeL: 20,
    legR: 208,
    kneeR: 28,
  });
}

function handstand(phase) {
  const s = sn(phase * 0.5);
  return P({
    y: -26,
    torso: 180,
    head: 0,
    armL: 176,
    elbowL: 6,
    armR: 184,
    elbowR: 6,
    legL: -8 + s * 6,
    kneeL: 4,
    legR: 10 - s * 4,
    kneeR: 4,
  });
}

const MOTIONS = {
  run,
  walk,
  hurdle,
  longjump,
  highjump,
  triple,
  vault,
  tramp,
  parkour,
  shot,
  discus,
  javelin,
  hammer,
  dribble,
  spike,
  throw: throwBall,
  shoot,
  dodge,
  kick,
  carry,
  swing,
  cradle,
  stick,
  frisbee,
  racket,
  golf,
  bowl,
  cue,
  darts,
  archery,
  bocce,
  croquet,
  cornhole,
  box,
  kickbox,
  grapple,
  judo,
  karate,
  tkd,
  fence,
  kendo,
  sumo,
  capoeira,
  swim,
  backstroke,
  breast,
  fly,
  dive,
  tread,
  surf,
  row,
  kayak,
  sail,
  ski,
  xcski,
  snowboard,
  skijump,
  spin,
  skate,
  curl,
  bobsled,
  biathlon,
  cycle,
  skateboard,
  floor,
  beam,
  rings,
  pbars,
  pommel,
  lift,
  climb,
  jumprope,
  ribbon,
  cheer,
  breaking,
  yoga,
  tug,
  handstand,
};

const SCENE_LOOK = {
  track: ["#241628", "#4a2438", "#f0c2d0"],
  steeple: ["#241628", "#4a2438", "#9fd7ff"],
  trail: ["#1a2218", "#3d3424", "#8ea572"],
  runway: ["#1c1e28", "#3a3e4c", "#d5dbe8"],
  pit: ["#1c1e28", "#3a3e4c", "#e0b56a"],
  gym: ["#1a1c28", "#5a3a28", "#f0d2b0"],
  circle: ["#1a1c24", "#3c414e", "#ffb020"],
  wood: ["#22160f", "#6a4124", "#f2d2a4"],
  sand: ["#2a1c12", "#8a5a32", "#f0d2a2"],
  grass: ["#122018", "#1e5a38", "#d8ffcf"],
  hardcourt: ["#10202c", "#1a5678", "#d7f4ff"],
  ring: ["#240814", "#5a1c32", "#ffd0e0"],
  water: ["#0c2436", "#0e6e99", "#d4f4ff"],
  ice: ["#102838", "#1a4a62", "#e7fbff"],
  snow: ["#1a2836", "#31485c", "#ffffff"],
  road: ["#16181e", "#2a2e38", "#ffd35a"],
  alley: ["#24180f", "#6b3e24", "#ffe1b5"],
  green: ["#102216", "#1f6a40", "#f4fff0"],
  table: ["#14241c", "#1e6b45", "#f3fff6"],
  dartwall: ["#1a120f", "#3a241c", "#ff5d4a"],
  range: ["#142016", "#2d5a34", "#ffd35a"],
  wall: ["#161820", "#2a3142", "#ffb020"],
  city: ["#141822", "#2c3344", "#8aa4ff"],
  lawn: ["#122016", "#246b42", "#e7ffd8"],
  dirt: ["#221910", "#6a4a2c", "#e7c396"],
  park: ["#171a22", "#3a4154", "#c9a6ff"],
  rink: ["#241816", "#6a4030", "#ffd8bf"],
  lane: ["#161820", "#323846", "#f4f7ff"],
};

function drawScene(ctx, w, h, scene, phase, moving) {
  const look = SCENE_LOOK[scene] || SCENE_LOOK.lane;
  const floorY = h * 0.74;
  const sky = ctx.createLinearGradient(0, 0, 0, floorY);
  sky.addColorStop(0, look[0]);
  sky.addColorStop(1, "#10141c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  if (scene === "city") {
    ctx.fillStyle = "#232a3a";
    for (let i = 0; i < 7; i += 1) {
      const bw = w * 0.1;
      const bh = h * (0.12 + (i % 3) * 0.06);
      ctx.fillRect(i * bw * 1.15 + 8, floorY - bh, bw, bh);
    }
  }
  if (scene === "trail") {
    ctx.fillStyle = "#243024";
    for (let i = 0; i < 5; i += 1) {
      const x = w * (0.08 + i * 0.18);
      ctx.beginPath();
      ctx.moveTo(x, floorY);
      ctx.lineTo(x + 10, floorY - 28);
      ctx.lineTo(x + 20, floorY);
      ctx.fill();
    }
  }

  const floor = ctx.createLinearGradient(0, floorY, 0, h);
  floor.addColorStop(0, look[1]);
  floor.addColorStop(1, "#0c0e12");
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY, w, h - floorY);

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, floorY + 0.5);
  ctx.lineTo(w, floorY + 0.5);
  ctx.stroke();

  if (scene === "water") {
    ctx.strokeStyle = "rgba(212,244,255,0.45)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      const y = floorY + 14 + i * (h - floorY) * 0.22;
      for (let x = 0; x <= w; x += 10) {
        const yy = y + Math.sin(x / 26 + phase * TAU + i) * 3;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }

  if (moving && (scene === "track" || scene === "road" || scene === "snow" || scene === "runway" || scene === "hardcourt" || scene === "ice")) {
    ctx.save();
    ctx.strokeStyle = look[2];
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = scene === "road" ? 3 : 2;
    ctx.setLineDash([18, 22]);
    ctx.lineDashOffset = phase * 140;
    ctx.beginPath();
    ctx.moveTo(0, floorY + (h - floorY) * 0.45);
    ctx.lineTo(w, floorY + (h - floorY) * 0.45);
    ctx.stroke();
    ctx.restore();
  } else if (scene === "wood" || scene === "gym" || scene === "alley" || scene === "rink") {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    const gap = 14;
    for (let x = 0; x < w; x += gap) {
      ctx.beginPath();
      ctx.moveTo(x, floorY);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  } else if (scene === "grass" || scene === "green" || scene === "lawn" || scene === "range") {
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    for (let i = 0; i < 6; i += 1) {
      if (i % 2 === 0) ctx.fillRect(0, floorY + i * ((h - floorY) / 6), w, (h - floorY) / 6);
    }
  } else if (scene === "track" || scene === "steeple") {
    ctx.strokeStyle = "rgba(240,194,208,0.35)";
    ctx.lineWidth = 2;
    for (let i = 1; i <= 3; i += 1) {
      const y = floorY + i * ((h - floorY) / 4);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    if (scene === "steeple") {
      ctx.fillStyle = "rgba(80,170,220,0.55)";
      ctx.fillRect(w * 0.62, floorY, w * 0.28, (h - floorY) * 0.55);
    }
  }

  return floorY;
}

function drawLandmark(ctx, w, h, floorY, game, tint) {
  const mark = game.landmark;
  if (!mark) return;
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const k = Math.min(w / 320, h / 180);

  if (mark === "blocks") {
    ctx.fillStyle = "#1a1e28";
    ctx.fillRect(w * 0.22, floorY - 10 * k, 28 * k, 10 * k);
  } else if (mark === "hurdle") {
    const x = w * 0.6;
    ctx.strokeStyle = "#f2f5fb";
    ctx.lineWidth = 3 * k;
    ctx.beginPath();
    ctx.moveTo(x, floorY);
    ctx.lineTo(x, floorY - 28 * k);
    ctx.moveTo(x + 34 * k, floorY);
    ctx.lineTo(x + 34 * k, floorY - 28 * k);
    ctx.moveTo(x - 2 * k, floorY - 26 * k);
    ctx.lineTo(x + 36 * k, floorY - 26 * k);
    ctx.stroke();
  } else if (mark === "pit") {
    ctx.fillStyle = "#c8923e";
    ctx.fillRect(w * 0.55, floorY - 4, w * 0.4, 18 * k);
  } else if (mark === "bar") {
    ctx.strokeStyle = tint;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.62, floorY);
    ctx.lineTo(w * 0.62, floorY - 78 * k);
    ctx.moveTo(w * 0.82, floorY);
    ctx.lineTo(w * 0.82, floorY - 78 * k);
    ctx.moveTo(w * 0.62, floorY - 70 * k);
    ctx.lineTo(w * 0.82, floorY - 70 * k);
    ctx.stroke();
  } else if (mark === "hoop") {
    ctx.strokeStyle = "#d7deea";
    ctx.beginPath();
    ctx.moveTo(w * 0.86, floorY);
    ctx.lineTo(w * 0.86, floorY - 96 * k);
    ctx.stroke();
    ctx.fillStyle = "#f4f7fb";
    ctx.fillRect(w * 0.78, floorY - 92 * k, 22 * k, 16 * k);
    ctx.strokeStyle = tint;
    ctx.beginPath();
    ctx.ellipse(w * 0.8, floorY - 78 * k, 12 * k, 5 * k, 0, 0, TAU);
    ctx.stroke();
  } else if (mark === "net" || mark === "tablenet") {
    const x = mark === "tablenet" ? w * 0.62 : w * 0.58;
    const top = floorY - (mark === "tablenet" ? 28 : 58) * k;
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, floorY);
    ctx.lineTo(x, top);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x - 8, top + i * 8 * k);
      ctx.lineTo(x + 8, top + i * 8 * k);
      ctx.stroke();
    }
  } else if (mark === "goal") {
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;
    ctx.strokeRect(w * 0.72, floorY - 58 * k, 52 * k, 58 * k);
  } else if (mark === "stumps") {
    ctx.fillStyle = "#f2efe4";
    for (let i = 0; i < 3; i += 1) ctx.fillRect(w * 0.72 + i * 6 * k, floorY - 36 * k, 3 * k, 36 * k);
  } else if (mark === "base") {
    ctx.fillStyle = "#f4f7fb";
    ctx.beginPath();
    ctx.moveTo(w * 0.72, floorY - 4);
    ctx.lineTo(w * 0.78, floorY - 16 * k);
    ctx.lineTo(w * 0.84, floorY - 4);
    ctx.fill();
  } else if (mark === "pins") {
    ctx.fillStyle = "#f7f4ee";
    const originX = w * 0.78;
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col <= row; col += 1) {
        ctx.beginPath();
        ctx.arc(originX + col * 8 * k - row * 4 * k, floorY - 16 * k - row * 12 * k, 4 * k, 0, TAU);
        ctx.fill();
      }
    }
  } else if (mark === "target" || mark === "dartboard") {
    const x = w * 0.8;
    const y = floorY - 48 * k;
    const rings = mark === "dartboard" ? ["#111", "#e8eef8", "#e23b3b", "#1d6b3a", "#e23b3b"] : ["#f4f7fb", "#e23b3b", "#f4f7fb", "#e23b3b", "#ffb020"];
    rings.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, (28 - i * 5) * k, 0, TAU);
      ctx.fill();
    });
  } else if (mark === "cup") {
    ctx.fillStyle = "#0e1612";
    ctx.beginPath();
    ctx.ellipse(w * 0.78, floorY + 8, 10 * k, 4 * k, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#f2f5fb";
    ctx.beginPath();
    ctx.moveTo(w * 0.78, floorY);
    ctx.lineTo(w * 0.78, floorY - 22 * k);
    ctx.stroke();
  } else if (mark === "wicket") {
    ctx.strokeStyle = "#f4f7fb";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w * 0.74, floorY - 8 * k, 16 * k, Math.PI, 0);
    ctx.stroke();
  } else if (mark === "board") {
    ctx.fillStyle = "#c9843a";
    ctx.translate(w * 0.74, floorY - 20 * k);
    ctx.rotate(-0.5);
    ctx.fillRect(0, 0, 42 * k, 24 * k);
    ctx.fillStyle = "#1a120c";
    ctx.beginPath();
    ctx.arc(30 * k, 12 * k, 4 * k, 0, TAU);
    ctx.fill();
  } else if (mark === "tramp") {
    ctx.strokeStyle = "#d7deea";
    ctx.lineWidth = 3;
    ctx.strokeRect(w * 0.28, floorY - 10 * k, w * 0.44, 10 * k);
    ctx.fillStyle = "#223";
    ctx.fillRect(w * 0.3, floorY - 16 * k, w * 0.4, 6 * k);
  } else if (mark === "rail") {
    ctx.strokeStyle = "#d7deea";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.66, floorY);
    ctx.lineTo(w * 0.66, floorY - 36 * k);
    ctx.lineTo(w * 0.88, floorY - 36 * k);
    ctx.stroke();
  } else if (mark === "beam") {
    ctx.fillStyle = "#d7b48a";
    ctx.fillRect(w * 0.22, floorY - 18 * k, w * 0.56, 7 * k);
  } else if (mark === "rings") {
    ctx.strokeStyle = "#e8eef8";
    ctx.lineWidth = 2;
    [w * 0.42, w * 0.54].forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, h * 0.12);
      ctx.lineTo(x, floorY - 78 * k);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, floorY - 70 * k, 8 * k, 12 * k, 0, 0, TAU);
      ctx.stroke();
    });
  } else if (mark === "bars") {
    ctx.strokeStyle = "#d5deea";
    ctx.lineWidth = 4;
    [floorY - 52 * k, floorY - 70 * k].forEach((y) => {
      ctx.beginPath();
      ctx.moveTo(w * 0.3, y);
      ctx.lineTo(w * 0.72, y);
      ctx.stroke();
    });
  } else if (mark === "pommel") {
    ctx.fillStyle = "#c9843a";
    ctx.beginPath();
    ctx.roundRect(w * 0.36, floorY - 28 * k, 90 * k, 16 * k, 8);
    ctx.fill();
    ctx.fillStyle = "#f2f5fb";
    ctx.fillRect(w * 0.42, floorY - 40 * k, 6 * k, 16 * k);
    ctx.fillRect(w * 0.52, floorY - 40 * k, 6 * k, 16 * k);
  } else if (mark === "holds") {
    ctx.fillStyle = "#2a3344";
    ctx.fillRect(w * 0.62, h * 0.12, w * 0.3, floorY - h * 0.12);
    ctx.fillStyle = tint;
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.arc(w * 0.7 + (i % 2) * 28 * k, floorY - 30 * k - i * 16 * k, 4 * k, 0, TAU);
      ctx.fill();
    }
  } else if (mark === "house") {
    ctx.strokeStyle = "rgba(198,244,255,0.8)";
    ctx.lineWidth = 2;
    const x = w * 0.78;
    const y = floorY + 24 * k;
    [22, 14, 7].forEach((r) => {
      ctx.beginPath();
      ctx.ellipse(x, y, r * k, r * 0.45 * k, 0, 0, TAU);
      ctx.stroke();
    });
  } else if (mark === "inrun") {
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, floorY - 10);
    ctx.lineTo(w * 0.7, floorY - 36 * k);
    ctx.stroke();
  } else if (mark === "board") {
    /* drawn above */
  } else if (mark === "roundnet") {
    ctx.strokeStyle = tint;
    ctx.beginPath();
    ctx.ellipse(w * 0.68, floorY - 16 * k, 18 * k, 7 * k, 0, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.68, floorY);
    ctx.lineTo(w * 0.68, floorY - 16 * k);
    ctx.stroke();
  } else if (mark === "board" && false) {
    /* keep switch exhaustive-looking */
  }
  if (mark === "divingboard" || game.id === "diving") {
    ctx.fillStyle = "#d7deea";
    ctx.fillRect(w * 0.18, floorY - 8 * k, 70 * k, 6 * k);
  }
  ctx.restore();
}

function capsule(ctx, x1, y1, x2, y2, width, fill) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.max(width, Math.hypot(x2 - x1, y2 - y1));
  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(ang);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(0, -width / 2, len, width, width / 2);
  ctx.fill();
  ctx.restore();
}

function dot(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function limb(angle, bend, origin, len1, len2, bendSign) {
  const jointAt = tip(origin[0], origin[1], angle, len1);
  const end = tip(jointAt[0], jointAt[1], angle + bendSign * bend, len2);
  return { joint: jointAt, end, angle: angle + bendSign * bend };
}

function drawBoot(ctx, x, y, shinAngle, k, accent) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(((shinAngle - 180) * Math.PI) / 180);
  ctx.fillStyle = "#141a24";
  ctx.beginPath();
  ctx.roundRect(-4 * k, -4.2 * k, 16 * k, 7.4 * k, 3 * k);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.fillRect(8 * k, -4.2 * k, 3 * k, 7.4 * k);
  ctx.restore();
}

function drawHead(ctx, x, y, angle, k, accent, faceUp, glow) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.fillStyle = "#e7eef8";
  ctx.beginPath();
  ctx.roundRect(-10 * k, -11 * k, 20 * k, 18 * k, 5 * k);
  ctx.fill();
  ctx.fillStyle = "#141a24";
  ctx.fillRect(-10 * k, -4 * k, 20 * k, 3 * k);
  if (glow) {
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = accent;
  if (faceUp) {
    ctx.beginPath();
    ctx.roundRect(-6 * k, -10 * k, 12 * k, 5 * k, 2 * k);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.roundRect(2 * k, -5 * k, 7 * k, 6 * k, 2 * k);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#9aabc0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-2 * k, -11 * k);
  ctx.lineTo(-2 * k, -17 * k);
  ctx.stroke();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(-2 * k, -18 * k, 2.2 * k, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function orient(ctx, x, y, rot) {
  ctx.translate(x, y);
  ctx.rotate(((rot - 90) * Math.PI) / 180);
}

function drawProp(ctx, kind, x, y, rot, k, accent, alpha) {
  if (!kind || alpha <= 0.02) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  orient(ctx, x, y, rot);
  ctx.fillStyle = accent;
  ctx.strokeStyle = "#f4f7fb";
  ctx.lineWidth = 2 * k;
  ctx.lineCap = "round";

  if (kind === "ball" || kind === "shot") {
    ctx.fillStyle = kind === "shot" ? "#c5cedc" : accent;
    ctx.beginPath();
    ctx.arc(8 * k, 0, (kind === "shot" ? 7 : 8) * k, 0, TAU);
    ctx.fill();
  } else if (kind === "oval") {
    ctx.fillStyle = "#8a4b2f";
    ctx.beginPath();
    ctx.ellipse(10 * k, 0, 11 * k, 6 * k, 0.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#f2f5fb";
    ctx.beginPath();
    ctx.moveTo(4 * k, -2 * k);
    ctx.lineTo(16 * k, 2 * k);
    ctx.stroke();
  } else if (kind === "bat") {
    ctx.fillStyle = "#e6d2b0";
    ctx.beginPath();
    ctx.roundRect(0, -3 * k, 36 * k, 6 * k, 2 * k);
    ctx.fill();
    ctx.fillStyle = "#8a6232";
    ctx.fillRect(30 * k, -5 * k, 10 * k, 10 * k);
  } else if (kind === "racket") {
    ctx.strokeStyle = "#d7deea";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(16 * k, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(28 * k, 0, 12 * k, 9 * k, 0, 0, TAU);
    ctx.stroke();
  } else if (kind === "shuttle") {
    ctx.fillStyle = "#f4f7fb";
    ctx.beginPath();
    ctx.moveTo(4 * k, 0);
    ctx.lineTo(16 * k, -6 * k);
    ctx.lineTo(16 * k, 6 * k);
    ctx.fill();
  } else if (kind === "club") {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(40 * k, 0);
    ctx.stroke();
    ctx.fillStyle = "#d7deea";
    ctx.fillRect(36 * k, -2 * k, 10 * k, 5 * k);
  } else if (kind === "disc" || kind === "frisbee") {
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.ellipse(10 * k, 0, 12 * k, 4 * k, 0.2, 0, TAU);
    ctx.stroke();
  } else if (kind === "javelin" || kind === "pole" || kind === "arrow") {
    const len = kind === "pole" ? 78 : kind === "arrow" ? 36 : 58;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * k, 0);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(len * k, 0);
    ctx.lineTo((len - 8) * k, -3 * k);
    ctx.lineTo((len - 8) * k, 3 * k);
    ctx.fill();
  } else if (kind === "hammer") {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(48 * k, 0);
    ctx.stroke();
    ctx.fillStyle = "#d7deea";
    ctx.beginPath();
    ctx.arc(54 * k, 0, 7 * k, 0, TAU);
    ctx.fill();
  } else if (kind === "baton") {
    ctx.fillStyle = "#f4f7fb";
    ctx.fillRect(0, -2 * k, 22 * k, 4 * k);
  } else if (kind === "stick") {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(40 * k, 0);
    ctx.lineTo(48 * k, 6 * k);
    ctx.stroke();
  } else if (kind === "lacrosse") {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(34 * k, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(40 * k, 0, 8 * k, 5 * k, 0, 0, TAU);
    ctx.stroke();
  } else if (kind === "foil" || kind === "sword") {
    ctx.lineWidth = kind === "foil" ? 1.4 * k : 3 * k;
    ctx.beginPath();
    ctx.moveTo(6 * k, 0);
    ctx.lineTo((kind === "foil" ? 52 : 40) * k, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(6 * k, -5 * k);
    ctx.lineTo(6 * k, 5 * k);
    ctx.stroke();
  } else if (kind === "cue") {
    ctx.strokeStyle = "#e6d2b0";
    ctx.beginPath();
    ctx.moveTo(-6 * k, 0);
    ctx.lineTo(48 * k, 0);
    ctx.stroke();
  } else if (kind === "dart") {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(16 * k, 0);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(6 * k, -4 * k);
    ctx.lineTo(6 * k, 4 * k);
    ctx.fill();
  } else if (kind === "bow") {
    ctx.strokeStyle = "#e6d2b0";
    ctx.lineWidth = 2.4 * k;
    ctx.beginPath();
    ctx.arc(0, 0, 18 * k, -1.15, 1.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(Math.cos(-1.15) * 18 * k, Math.sin(-1.15) * 18 * k);
    ctx.lineTo(Math.cos(1.15) * 18 * k, Math.sin(1.15) * 18 * k);
    ctx.stroke();
  } else if (kind === "mallet") {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(28 * k, 0);
    ctx.stroke();
    ctx.fillStyle = "#e6d2b0";
    ctx.fillRect(24 * k, -4 * k, 12 * k, 8 * k);
  } else if (kind === "beanbag") {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(0, -6 * k, 14 * k, 12 * k, 3 * k);
    ctx.fill();
  } else if (kind === "oar" || kind === "paddle") {
    ctx.beginPath();
    ctx.moveTo(-20 * k, 0);
    ctx.lineTo(28 * k, 0);
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(32 * k, 0, 8 * k, 5 * k, 0, 0, TAU);
    ctx.fill();
    if (kind === "paddle") {
      ctx.beginPath();
      ctx.ellipse(-26 * k, 0, 8 * k, 5 * k, 0, 0, TAU);
      ctx.fill();
    }
  } else if (kind === "bar") {
    ctx.strokeStyle = "#d7deea";
    ctx.lineWidth = 4 * k;
    ctx.beginPath();
    ctx.moveTo(-28 * k, 0);
    ctx.lineTo(28 * k, 0);
    ctx.stroke();
    ctx.fillStyle = "#2a3142";
    ctx.fillRect(-34 * k, -5 * k, 8 * k, 10 * k);
    ctx.fillRect(26 * k, -5 * k, 8 * k, 10 * k);
  } else if (kind === "stone") {
    ctx.fillStyle = "#c23b3b";
    ctx.beginPath();
    ctx.ellipse(8 * k, 0, 10 * k, 6 * k, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#f2d2a4";
    ctx.beginPath();
    ctx.arc(8 * k, -1 * k, 3 * k, 0, TAU);
    ctx.fill();
  } else if (kind === "rifle") {
    ctx.strokeStyle = "#1a1e28";
    ctx.lineWidth = 3 * k;
    ctx.beginPath();
    ctx.moveTo(-8 * k, 2 * k);
    ctx.lineTo(26 * k, 0);
    ctx.stroke();
    ctx.fillStyle = "#2a3142";
    ctx.fillRect(-10 * k, -2 * k, 12 * k, 6 * k);
  } else if (kind === "puck") {
    ctx.fillStyle = "#1a1e28";
    ctx.beginPath();
    ctx.ellipse(6 * k, 0, 7 * k, 3 * k, 0, 0, TAU);
    ctx.fill();
  } else if (kind === "rope" || kind === "ribbon") {
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(18 * k, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function wheel(ctx, x, y, r, thick) {
  ctx.strokeStyle = "#f4f7fb";
  ctx.lineWidth = thick || 3.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.42, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "#ffb020";
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1.6, r * 0.14), 0, TAU);
  ctx.fill();
}

function drawVehicle(ctx, vehicle, hipX, hipY, floorY, k, phase, accent, lift) {
  if (!vehicle) return;
  const ground = floorY + Math.min(0, lift);
  ctx.save();
  ctx.strokeStyle = "#d7deea";
  ctx.fillStyle = accent;
  ctx.lineWidth = 2.5 * k;
  ctx.lineCap = "round";

  if (vehicle === "bike" || vehicle === "bmx" || vehicle === "mtb") {
    const r = (vehicle === "bmx" ? 16 : vehicle === "mtb" ? 24 : 21) * k;
    const y = ground - r;
    const x1 = hipX - 38 * k;
    const x2 = hipX + 42 * k;
    const seat = hipY + 6 * k;
    ctx.lineWidth = 3.2 * k;
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(hipX - 4 * k, seat);
    ctx.lineTo(x2, y);
    ctx.moveTo(hipX - 4 * k, seat);
    ctx.lineTo(hipX + 18 * k, hipY - 18 * k);
    ctx.lineTo(hipX + 28 * k, hipY - 16 * k);
    ctx.stroke();
    wheel(ctx, x1, y, r, vehicle === "mtb" ? 6 : 4);
    wheel(ctx, x2, y, r, vehicle === "mtb" ? 6 : 4);
    const spin = (phase % 1) * TAU;
    ctx.fillStyle = "#f4f7fb";
    ctx.beginPath();
    ctx.arc(hipX + Math.cos(spin) * 10 * k, y - 8 * k + Math.sin(spin) * 10 * k, 3 * k, 0, TAU);
    ctx.fill();
  } else if (vehicle === "skateboard") {
    const y = ground - 4 * k;
    ctx.fillStyle = "#d8c2a4";
    ctx.beginPath();
    ctx.roundRect(hipX - 28 * k, y - 4 * k, 56 * k, 6 * k, 3 * k);
    ctx.fill();
    wheel(ctx, hipX - 16 * k, y + 4 * k, 3.5 * k, 2);
    wheel(ctx, hipX + 16 * k, y + 4 * k, 3.5 * k, 2);
  } else if (vehicle === "rollers") {
    [ -8, 10 ].forEach((offset) => {
      wheel(ctx, hipX + offset * k, ground - 4 * k, 4 * k, 2);
    });
  } else if (vehicle === "skates") {
    ctx.strokeStyle = "#e7fbff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hipX - 12 * k, ground - 2);
    ctx.lineTo(hipX + 18 * k, ground - 2);
    ctx.stroke();
  } else if (vehicle === "ski") {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hipX - 34 * k, ground - 2);
    ctx.quadraticCurveTo(hipX + 20 * k, ground - 2, hipX + 48 * k, ground - 8);
    ctx.stroke();
  } else if (vehicle === "snowboard") {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6 * k;
    ctx.beginPath();
    ctx.moveTo(hipX - 26 * k, ground - 3);
    ctx.lineTo(hipX + 30 * k, ground - 3);
    ctx.stroke();
  } else if (vehicle === "surf") {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(hipX + 4 * k, ground - 4 * k, 34 * k, 5 * k, -0.15, 0, TAU);
    ctx.fill();
  } else if (vehicle === "rowboat" || vehicle === "kayak" || vehicle === "sail") {
    ctx.fillStyle = vehicle === "kayak" ? "#e07a3d" : "#d7deea";
    ctx.beginPath();
    ctx.ellipse(hipX, ground - 6 * k, (vehicle === "kayak" ? 42 : 48) * k, 8 * k, 0, 0, TAU);
    ctx.fill();
    if (vehicle === "sail") {
      ctx.strokeStyle = "#f4f7fb";
      ctx.beginPath();
      ctx.moveTo(hipX + 6 * k, ground - 10 * k);
      ctx.lineTo(hipX + 6 * k, ground - 70 * k);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.moveTo(hipX + 6 * k, ground - 66 * k);
      ctx.lineTo(hipX + 34 * k, ground - 30 * k);
      ctx.lineTo(hipX + 6 * k, ground - 24 * k);
      ctx.fill();
    }
  } else if (vehicle === "sled") {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(hipX - 30 * k, ground - 16 * k, 60 * k, 10 * k);
    ctx.beginPath();
    ctx.moveTo(hipX - 26 * k, ground - 6 * k);
    ctx.lineTo(hipX + 28 * k, ground - 6 * k);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRopeArc(ctx, hipX, hipY, k, phase, accent) {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  const spin = (phase % 1) * TAU;
  ctx.beginPath();
  ctx.arc(hipX, hipY + 4 * k, 40 * k, spin - 0.55, spin + 0.55);
  ctx.stroke();
  ctx.restore();
}

function drawRibbonTrail(ctx, x, y, k, phase, accent) {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3 * k;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 1; i <= 14; i += 1) {
    const t = i / 14;
    ctx.lineTo(x - t * 78 * k, y + Math.sin((phase % 1) * TAU * 2 + t * 7) * (8 + t * 18) * k);
  }
  ctx.stroke();
  ctx.restore();
}

function drawCrowd(ctx, w, h, tint) {
  if (h < 220) return;
  ctx.save();
  const band = h * 0.2;
  for (let i = 0; i < 26; i += 1) {
    const x = ((i + 0.5) * w) / 26;
    const y = band * 0.55 + (i % 3) * 7;
    ctx.fillStyle = i % 5 === 0 ? tint : "#1b2433";
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, TAU);
    ctx.fill();
    ctx.fillRect(x - 5, y + 4, 10, 8);
  }
  ctx.restore();
}

const LOCOMOTIVE = new Set([
  "run", "walk", "hurdle", "cycle", "skate", "skateboard", "ski", "xcski", "snowboard", "bobsled", "biathlon",
]);

function renderFrame(ctx, w, h, game, phase) {
  if (!game || w < 2 || h < 2) return;
  const category = categoryById(game.category);
  const scene = sceneOf(game);
  const accent = category.tint;
  const motion = MOTIONS[game.motion] || run;
  const pose = motion(phase, game);
  const moving = LOCOMOTIVE.has(game.motion);

  ctx.clearRect(0, 0, w, h);
  const floorY = drawScene(ctx, w, h, scene, phase, moving);
  drawCrowd(ctx, w, h, accent);
  drawLandmark(ctx, w, h, floorY, game, accent);

  const k = Math.min(w / 280, h / 160) * (pose.scale || 1);
  const hipX = w * (game.placeX ?? 0.46) + (pose.x || 0) * k;
  const hipY = (pose.medium === "water" ? floorY + 6 * k : floorY - 46 * k) + pose.y * k;

  const lift = (pose.medium === "water" ? 0 : pose.y) * k;
  drawVehicle(ctx, pose.vehicle || game.vehicle, hipX, hipY, floorY, k, phase, accent, lift);

  if (pose.medium !== "water") {
    const rise = Math.max(0, -pose.y);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.globalAlpha = Math.max(0.12, 0.38 - rise / 90);
    ctx.beginPath();
    ctx.ellipse(hipX, floorY - 2, Math.max(10, 28 - rise * 0.2) * k, 5 * k, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  const torsoLen = 34 * k;
  const thigh = 27 * k;
  const shin = 25 * k;
  const upper = 21 * k;
  const fore = 18 * k;
  const far = "#7f8da3";
  const near = "#e8eef8";
  const torsoColor = "#d5deec";
  const jointColor = "#141a24";

  const shoulder = tip(hipX, hipY, pose.torso, torsoLen);
  const headC = tip(shoulder[0], shoulder[1], pose.torso + pose.head, 12 * k);
  const farLeg = limb(pose.legL, pose.kneeL, [hipX, hipY], thigh, shin, 1);
  const nearLeg = limb(pose.legR, pose.kneeR, [hipX, hipY], thigh, shin, 1);
  const farArm = limb(pose.armL, pose.elbowL, shoulder, upper, fore, -1);
  const nearArm = limb(pose.armR, pose.elbowR, shoulder, upper, fore, -1);

  function drawLeg(part, color) {
    capsule(ctx, hipX, hipY, part.joint[0], part.joint[1], 8.2 * k, color);
    capsule(ctx, part.joint[0], part.joint[1], part.end[0], part.end[1], 6.6 * k, color);
    dot(ctx, part.joint[0], part.joint[1], 3.1 * k, jointColor);
    drawBoot(ctx, part.end[0], part.end[1], part.angle, k, accent);
  }
  function drawArm(part, color) {
    capsule(ctx, shoulder[0], shoulder[1], part.joint[0], part.joint[1], 6.4 * k, color);
    capsule(ctx, part.joint[0], part.joint[1], part.end[0], part.end[1], 5.2 * k, color);
    dot(ctx, part.joint[0], part.joint[1], 2.6 * k, jointColor);
    dot(ctx, part.end[0], part.end[1], 3.6 * k, jointColor);
  }

  drawLeg(farLeg, far);
  drawArm(farArm, far);
  capsule(ctx, hipX, hipY, shoulder[0], shoulder[1], 15 * k, torsoColor);
  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate((pose.torso * Math.PI) / 180);
  ctx.fillStyle = "#c5d0e2";
  ctx.beginPath();
  ctx.roundRect(-11 * k, -6 * k, 22 * k, 12 * k, 4 * k);
  ctx.fill();
  ctx.restore();
  const lamp = tip(hipX, hipY, pose.torso, torsoLen * 0.55);
  dot(ctx, lamp[0], lamp[1], 3 * k, accent);
  drawHead(ctx, headC[0], headC[1], pose.torso + pose.head, k, accent, pose.faceUp, h > 220);
  drawLeg(nearLeg, near);
  drawArm(nearArm, near);

  const propScale = k * (game.propScale || 1);
  const playScale = k * (game.playScale || 0.7);
  if (game.prop && pose.stow) {
    const back = tip(shoulder[0], shoulder[1], pose.torso + 20, 8 * k);
    drawProp(ctx, game.prop, back[0], back[1], pose.torso + 70, propScale, accent, 1);
  } else if (game.prop && pose.propX == null) {
    drawProp(ctx, game.prop, nearArm.end[0], nearArm.end[1], nearArm.angle, propScale, accent, pose.propA ?? 1);
  } else if (game.prop && pose.propX != null) {
    drawProp(
      ctx,
      game.prop,
      hipX + pose.propX * k,
      hipY + pose.propY * k,
      pose.propRot ?? 90,
      propScale,
      accent,
      pose.propA ?? 1
    );
  }

  const playKind = pose.playKind || game.play;
  if (playKind && pose.playX != null) {
    drawProp(
      ctx,
      playKind,
      hipX + pose.playX * k,
      hipY + pose.playY * k,
      pose.playRot || 90,
      playScale,
      accent,
      pose.playA ?? 1
    );
  }

  if (game.motion === "jumprope") drawRopeArc(ctx, hipX, hipY, k, phase, accent);
  if (game.prop === "ribbon") drawRibbonTrail(ctx, nearArm.end[0], nearArm.end[1], k, phase, accent);
  if (game.motion === "tug") {
    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, hipY - 8 * k);
    ctx.lineTo(nearArm.end[0], nearArm.end[1]);
    ctx.stroke();
    ctx.restore();
  }

  if (scene === "water") {
    const wash = ctx.createLinearGradient(0, floorY, 0, h);
    wash.addColorStop(0, "rgba(14, 90, 130, 0.18)");
    wash.addColorStop(0.4, "rgba(10, 60, 100, 0.45)");
    wash.addColorStop(1, "rgba(6, 30, 60, 0.72)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, floorY, w, h - floorY);
  }

  const vignette = ctx.createRadialGradient(w / 2, h * 0.45, w * 0.2, w / 2, h * 0.5, w * 0.72);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}
