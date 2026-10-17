export {};
const W = 1280,
  H = 720,
  CW = 100,
  CH = 140;
const X = [224, 346, 468, 590, 712, 834, 956],
  Y = 180;
type Suit = "spades" | "hearts" | "diamonds" | "clubs";
type Pile = "stock" | "waste" | "foundation" | "tableau";
type Card = { id: number; suit: Suit; rank: number; faceUp: boolean };
type Ref = { pile: Pile; index: number };
type Drag = {
  cards: Card[];
  fromPile: "waste" | "foundation" | "tableau";
  fromIndex: number;
  row: number;
  x: number;
  y: number;
  ox: number;
  oy: number;
};
type Flyer = Card & { x: number; y: number; vx: number; vy: number };
const suits: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const symbols: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};
const red = (s: Suit) => s === "hearts" || s === "diamonds";
const color = (s: Suit) => (red(s) ? "red" : "black");
const rank = (n: number) =>
  ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"][n];
const rects = {
  title: [
    { x: 500, y: 400, w: 280, h: 52 },
    { x: 500, y: 470, w: 280, h: 52 },
  ],
  howto: [{ x: 540, y: 600, w: 200, h: 48 }],
  hud: [
    { x: 18, y: 686, w: 150, h: 25 },
    { x: 178, y: 686, w: 110, h: 25 },
    { x: 298, y: 686, w: 120, h: 25 },
  ],
};
let id = 1,
  muted = false,
  auto = true,
  audio: AudioContext | undefined,
  debug = false;
const state = {
  screen: "title" as "title" | "howto" | "playing" | "won",
  menuIndex: 0,
  titleIndex: 0,
  stock: [] as Card[],
  waste: [] as Card[],
  sets: [] as number[],
  foundations: [[], [], [], []] as Card[][],
  tableau: [[], [], [], [], [], [], []] as Card[][],
  drag: null as Drag | null,
  pointer: { x: 0, y: 0, down: false },
  last: null as { x: number; y: number; at: number } | null,
  autoFlip: true,
  winDetect: true,
  launching: true,
  trailPainting: true,
  launchClock: 0,
  launched: 0,
  flyers: [] as Flyer[],
  done: false,
  stamps: 0,
  sim: 0,
};
const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const g = canvas.getContext("2d")!;
const paint = document.createElement("canvas");
paint.width = W;
paint.height = H;
const pg = paint.getContext("2d")!;
function pile(p: Pile, i: number) {
  if (p === "stock") return state.stock;
  if (p === "waste") return state.waste;
  if (p === "foundation") return state.foundations[valid(i, 4)];
  return state.tableau[valid(i, 7)];
}
function valid(i: number, n: number) {
  if (!Number.isInteger(i) || i < 0 || i >= n)
    throw Error("invalid pile index");
  return i;
}
function card(s: string, r: number, up: boolean) {
  if (!suits.includes(s as Suit) || !Number.isInteger(r) || r < 1 || r > 13)
    throw Error("invalid card");
  return { id: id++, suit: s as Suit, rank: r, faceUp: up };
}
function cue(name: string) {
  if (muted) return;
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator(),
      v = audio.createGain();
    o.frequency.value = (
      {
        deal: 190,
        turn: 420,
        recycle: 240,
        lift: 330,
        drop: 520,
        reject: 110,
        flip: 600,
        home: 740,
        launch: 270,
        win: 880,
      } as Record<string, number>
    )[name];
    v.gain.value = 0.035;
    o.connect(v).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.07);
  } catch {
    // Audio is an enhancement; a browser without an available context still plays.
  }
}
function reset() {
  const m = muted;
  id = 1;
  Object.assign(state, {
    screen: "title",
    menuIndex: 0,
    titleIndex: 0,
    stock: [],
    waste: [],
    sets: [],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
    drag: null,
    pointer: { x: 0, y: 0, down: false },
    last: null,
    autoFlip: true,
    winDetect: true,
    launching: true,
    trailPainting: true,
    launchClock: 0,
    launched: 0,
    flyers: [],
    done: false,
    stamps: 0,
    sim: 0,
  });
  muted = m;
  pg.clearRect(0, 0, W, H);
}
function deal() {
  state.stock = [];
  state.waste = [];
  state.sets = [];
  state.foundations = [[], [], [], []];
  state.tableau = [[], [], [], [], [], [], []];
  state.drag = null;
  state.launched = 0;
  state.flyers = [];
  state.done = false;
  state.launchClock = 0;
  state.stamps = 0;
  pg.clearRect(0, 0, W, H);
  const d = suits.flatMap((s) =>
    Array.from({ length: 13 }, (_, i) => card(s, i + 1, false)),
  );
  for (let i = d.length - 1; i; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  let at = 0;
  for (let col = 0; col < 7; col++) {
    for (let j = 0; j <= col; j++) {
      const c = d[at++];
      c.faceUp = j === col;
      state.tableau[col].push(c);
    }
  }
  state.stock = d.slice(at);
  cue("deal");
}
function turn() {
  if (state.stock.length) {
    const c = state.stock.pop()!;
    c.faceUp = true;
    state.waste.push(c);
    state.sets.push(1);
    cue("turn");
  } else if (state.waste.length) {
    state.stock = state.waste.reverse().map((c) => ({ ...c, faceUp: false }));
    state.waste = [];
    state.sets = [];
    cue("recycle");
  }
}
function isRun(a: Card[]) {
  return (
    a.length > 0 &&
    a.every(
      (c, i) =>
        i === 0 ||
        (a[i - 1].rank === c.rank + 1 && red(a[i - 1].suit) !== red(c.suit)),
    )
  );
}
function accept(to: Ref, a: Card[]) {
  if (!isRun(a)) return false;
  const c = a[0],
    p = pile(to.pile, to.index);
  if (to.pile === "foundation") {
    if (a.length !== 1) return false;
    const top = p[p.length - 1];
    return top ? top.suit === c.suit && top.rank + 1 === c.rank : c.rank === 1;
  }
  if (to.pile === "tableau") {
    const top = p[p.length - 1];
    return top
      ? top.faceUp && top.rank - 1 === c.rank && red(top.suit) !== red(c.suit)
      : c.rank === 13;
  }
  return false;
}
function exposed(from: Ref, row: number) {
  const p = pile(from.pile, from.index);
  if (row < 0 || row >= p.length) return null;
  const a = p.slice(row);
  if (from.pile === "tableau") return a[0].faceUp && isRun(a) ? a : null;
  if (from.pile === "waste")
    return row === p.length - 1 && state.sets.length ? a : null;
  return from.pile === "foundation" && row === p.length - 1 ? a : null;
}
function afterMove(from: Ref) {
  if (from.pile === "tableau") {
    const p = pile(from.pile, from.index),
      c = p[p.length - 1];
    if (c && !c.faceUp && state.autoFlip) {
      c.faceUp = true;
      cue("flip");
    }
  }
  if (state.winDetect && [...state.foundations].every((x) => x.length === 13)) {
    state.screen = "won";
    state.launchClock = 0.18;
    state.done = false;
    cue("win");
  }
}
function move(fr: Ref, row: number, to: Ref) {
  const a = exposed(fr, row);
  if (!a || !accept(to, a)) return false;
  pile(fr.pile, fr.index).splice(row, a.length);
  if (fr.pile === "waste") {
    state.sets[state.sets.length - 1]--;
    if (state.sets[state.sets.length - 1] === 0) state.sets.pop();
  }
  pile(to.pile, to.index).push(...a);
  cue("drop");
  if (to.pile === "foundation") cue("home");
  afterMove(fr);
  return true;
}
function autoMove(p: Pile, i: number) {
  const from: Ref = { pile: p, index: i };
  const a = exposed(from, pile(p, i).length - 1);
  if (!a) return false;
  for (let j = 0; j < 4; j++)
    if (move(from, pile(p, i).length - 1, { pile: "foundation", index: j }))
      return true;
  return false;
}
function posFor(ref: Ref, row: number) {
  if (ref.pile === "tableau") {
    let y = Y;
    const p = pile(ref.pile, ref.index);
    const up = p.filter((c) => c.faceUp).length;
    const off = up
      ? Math.max(
          14,
          Math.min(
            34,
            (676 - Y - (p.length - up) * 24 - CH) / Math.max(1, up - 1),
          ),
        )
      : 34;
    for (let j = 0; j < row; j++) y += p[j].faceUp ? off : 24;
    return { x: X[ref.index], y };
  }
  if (ref.pile === "stock") return { x: 224, y: 24 };
  if (ref.pile === "waste") return { x: 346, y: 24 };
  return { x: X[ref.index + 3], y: 24 };
}
function dropAt(x: number, y: number): Ref | null {
  for (let i = 0; i < 4; i++)
    if (inside(x, y, { x: X[i + 3], y: 24, w: CW, h: CH }))
      return { pile: "foundation", index: i };
  for (let i = 0; i < 7; i++) {
    const p = state.tableau[i],
      bottom = p.length
        ? posFor({ pile: "tableau", index: i }, p.length - 1).y + CH
        : Y + CH;
    if (x >= X[i] && x < X[i] + CW && y >= Y && y < bottom)
      return { pile: "tableau", index: i };
  }
  if (inside(x, y, { x: 224, y: 24, w: CW, h: CH }))
    return { pile: "stock", index: 0 };
  if (inside(x, y, { x: 346, y: 24, w: CW, h: CH }))
    return { pile: "waste", index: 0 };
  return null;
}
function inside(
  x: number,
  y: number,
  r: { x: number; y: number; w: number; h: number },
) {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}
function hitCard(x: number, y: number): { ref: Ref; row: number } | null {
  const candidates: { ref: Ref; row: number; z: number }[] = [];
  for (let i = 0; i < 7; i++)
    state.tableau[i].forEach((_, j) => {
      const q = posFor({ pile: "tableau", index: i }, j);
      if (inside(x, y, { ...q, w: CW, h: CH }))
        candidates.push({ ref: { pile: "tableau", index: i }, row: j, z: q.y });
    });
  if (
    state.waste.length &&
    state.sets.length &&
    inside(x, y, { x: 346, y: 24, w: CW, h: CH })
  )
    candidates.push({
      ref: { pile: "waste", index: 0 },
      row: state.waste.length - 1,
      z: 200,
    });
  for (let i = 0; i < 4; i++)
    if (
      state.foundations[i].length &&
      inside(x, y, { x: X[i + 3], y: 24, w: CW, h: CH })
    )
      candidates.push({
        ref: { pile: "foundation", index: i },
        row: state.foundations[i].length - 1,
        z: 190,
      });
  return candidates.sort((a, b) => b.z - a.z)[0] ?? null;
}
function menu() {
  return state.screen === "title"
    ? rects.title
    : state.screen === "howto"
      ? rects.howto
      : state.screen === "playing"
        ? rects.hud
        : [];
}
function activate() {
  if (state.screen === "title") {
    state.titleIndex = state.menuIndex;
    if (state.menuIndex === 0) {
      deal();
      state.screen = "playing";
      state.menuIndex = 0;
    } else state.screen = "howto";
  } else if (state.screen === "howto") {
    state.screen = "title";
    state.menuIndex = state.titleIndex;
  } else if (state.screen === "playing") {
    if (state.menuIndex === 0) deal();
    else if (state.menuIndex === 1) {
      state.screen = "title";
      state.menuIndex = state.titleIndex;
    } else muted = !muted;
  }
}
function down(x: number, y: number) {
  state.pointer = { x, y, down: true };
  if (state.screen === "won") {
    deal();
    state.screen = "playing";
    return;
  }
  const mi = menu().findIndex((r) => inside(x, y, r));
  if (mi >= 0) state.menuIndex = mi;
  if (state.screen !== "playing") return;
  const h = hitCard(x, y),
    dbl = !!(
      h &&
      state.last &&
      state.sim - state.last.at <= 0.3 &&
      Math.hypot(x - state.last.x, y - state.last.y) <= 20 &&
      (h.ref.pile === "waste" ||
        (h.ref.pile === "tableau" &&
          h.row === pile(h.ref.pile, h.ref.index).length - 1))
    );
  state.last = { x, y, at: state.sim };
  if (dbl) {
    autoMove(h.ref.pile, h.ref.index);
    return;
  }
  if (h) {
    const a = exposed(h.ref, h.row);
    if (a) {
      pile(h.ref.pile, h.ref.index).splice(h.row, a.length);
      const q = posFor(h.ref, h.row);
      state.drag = {
        cards: a,
        fromPile: h.ref.pile as Drag["fromPile"],
        fromIndex: h.ref.index,
        row: h.row,
        x: q.x,
        y: q.y,
        ox: x - q.x,
        oy: y - q.y,
      };
      cue("lift");
    }
  }
}
function pointerMove(x: number, y: number) {
  state.pointer.x = x;
  state.pointer.y = y;
  if (state.drag) {
    state.drag.x = x - state.drag.ox;
    state.drag.y = y - state.drag.oy;
  }
  const mi = menu().findIndex((r) => inside(x, y, r));
  if (mi >= 0) state.menuIndex = mi;
}
function up(x: number, y: number) {
  const was = state.pointer;
  pointerMove(x, y);
  state.pointer.down = false;
  const mi = menu().findIndex((r) => inside(x, y, r));
  if (mi >= 0 && menu().some((r) => inside(was.x, was.y, r))) {
    state.menuIndex = mi;
    activate();
    return;
  }
  if (state.screen !== "playing") return;
  const d = state.drag;
  if (!d) {
    if (
      Math.hypot(x - was.x, y - was.y) <= 5 &&
      inside(was.x, was.y, { x: 224, y: 24, w: CW, h: CH })
    )
      turn();
    return;
  }
  state.drag = null;
  if (Math.hypot(x - was.x, y - was.y) <= 5) {
    pile(d.fromPile, d.fromIndex).splice(d.row, 0, ...d.cards);
    return;
  }
  const target = dropAt(d.x + CW / 2, d.y + CH / 2);
  if (target && accept(target, d.cards)) {
    pile(target.pile, target.index).push(...d.cards);
    if (d.fromPile === "waste") {
      state.sets[state.sets.length - 1]--;
      if (state.sets[state.sets.length - 1] === 0) state.sets.pop();
    }
    cue("drop");
    if (target.pile === "foundation") cue("home");
    afterMove({ pile: d.fromPile, index: d.fromIndex });
  } else {
    pile(d.fromPile, d.fromIndex).splice(d.row, 0, ...d.cards);
    cue("reject");
  }
}
function step(dt: number) {
  state.sim += dt;
  if (state.screen !== "won") return;
  for (const f of [...state.flyers]) {
    f.vy += 1800 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.y >= 580 && f.vy > 0) {
      f.y = 580;
      f.vy = -f.vy * 0.8;
    }
    if (state.trailPainting) {
      drawCard(pg, f.x, f.y, f, true);
      state.stamps++;
    }
    if (f.x + CW < 0 || f.x > W)
      state.flyers.splice(state.flyers.indexOf(f), 1);
  }
  if (state.launching) {
    state.launchClock += dt;
    while (state.launchClock >= 0.18 && state.launched < 52) {
      state.launchClock -= 0.18;
      launch();
    }
  }
  if (state.launched === 52 && !state.flyers.length) state.done = true;
}
function launch() {
  for (let tries = 0; tries < 4; tries++) {
    const j = state.launched % 4;
    const p = state.foundations[j];
    if (p.length) {
      const c = p.pop()!,
        vx = drawVx();
      state.flyers.push({ ...c, x: X[j + 3], y: 24, vx, vy: -120 });
      state.launched++;
      cue("launch");
      return;
    }
    state.launched++;
  }
}
function drawVx() {
  return (180 + Math.random() * 240) * (Math.random() < 0.5 ? -1 : 1);
}
function drawCard(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  a: Card,
  up = a.faceUp,
) {
  c.save();
  c.translate(x, y);
  c.shadowColor = "#001";
  c.shadowBlur = up ? 7 : 2;
  c.fillStyle = up ? "#fffdf4" : "#173c77";
  c.fillRect(0, 0, CW, CH);
  c.shadowBlur = 0;
  c.strokeStyle = up ? "#d6cdbb" : "#91c7e8";
  c.lineWidth = 2;
  c.strokeRect(1, 1, CW - 2, CH - 2);
  if (!up) {
    c.strokeStyle = "#75abd0";
    for (let i = -120; i < 100; i += 15) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i + 120, 140);
      c.stroke();
    }
    c.restore();
    return;
  }
  const col = red(a.suit) ? "#c2313d" : "#182330";
  c.fillStyle = col;
  c.font = "bold 24px Georgia";
  c.fillText(rank(a.rank), 9, 28);
  c.font = "24px Georgia";
  c.fillText(symbols[a.suit], 10, 54);
  c.font = "58px Georgia";
  c.textAlign = "center";
  c.fillText(symbols[a.suit], 50, 94);
  c.textAlign = "start";
  c.restore();
}
function slot(x: number, y: number, label: string, hi = false) {
  g.strokeStyle = hi ? "#f9d66b" : "#49776d";
  g.lineWidth = hi ? 4 : 2;
  g.strokeRect(x + 2, y + 2, CW - 4, CH - 4);
  g.fillStyle = "#78a69a";
  g.font = "16px sans-serif";
  g.textAlign = "center";
  g.fillText(label, x + 50, y + 75);
  g.textAlign = "start";
}
function render() {
  const dpr = devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  const scale = Math.min(innerWidth / W, innerHeight / H),
    ox = (innerWidth - W * scale) / 2,
    oy = (innerHeight - H * scale) / 2;
  g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  g.fillStyle = "#062d29";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#0a4038";
  g.fillRect(12, 12, W - 24, H - 24);
  if (state.screen === "title" || state.screen === "howto") {
    drawScreen();
    return;
  }
  g.drawImage(paint, 0, 0);
  drawTable();
  if (state.screen === "won") {
    for (const f of state.flyers) drawCard(g, f.x, f.y, f, true);
    if (state.done) {
      g.fillStyle = "rgba(3,18,19,.72)";
      g.fillRect(390, 295, 500, 110);
      g.fillStyle = "#f9df8a";
      g.font = "bold 58px Georgia";
      g.textAlign = "center";
      g.fillText("YOU WIN", 640, 370);
      g.textAlign = "start";
    }
  }
  if (debug) overlay();
}
function drawTable() {
  slot(224, 24, "STOCK");
  slot(346, 24, "WASTE");
  for (let i = 0; i < 4; i++)
    slot(
      X[i + 3],
      24,
      "ACE",
      state.drag
        ? accept({ pile: "foundation", index: i }, state.drag.cards)
        : false,
    );
  if (state.stock.length)
    drawCard(g, 224, 24, state.stock[state.stock.length - 1]!);
  if (state.waste.length && state.sets.length)
    drawCard(g, 346, 24, state.waste[state.waste.length - 1]!);
  state.foundations.forEach((p, i) => {
    if (p.length) drawCard(g, X[i + 3], 24, p[p.length - 1]!);
  });
  state.tableau.forEach((p, i) => {
    if (!p.length)
      slot(
        X[i],
        Y,
        "KING",
        state.drag
          ? accept({ pile: "tableau", index: i }, state.drag.cards)
          : false,
      );
    p.forEach((c, j) => {
      const q = posFor({ pile: "tableau", index: i }, j);
      drawCard(g, q.x, q.y, c);
    });
    if (
      p.length &&
      state.drag &&
      accept({ pile: "tableau", index: i }, state.drag.cards)
    ) {
      const q = posFor({ pile: "tableau", index: i }, p.length - 1);
      g.strokeStyle = "#f9d66b";
      g.lineWidth = 4;
      g.strokeRect(q.x - 2, q.y - 2, CW + 4, CH + 4);
    }
  });
  if (state.drag)
    state.drag.cards.forEach((c, i) =>
      drawCard(g, state.drag!.x, state.drag!.y + i * 34, c),
    );
  g.fillStyle = "#041f1c";
  g.fillRect(0, 680, W, 36);
  rects.hud.forEach((r, i) =>
    button(
      r,
      ["NEW GAME", "MENU", muted ? "SOUND: OFF" : "SOUND"][i],
      state.menuIndex === i,
    ),
  );
  g.fillStyle = "#a5d4c5";
  g.font = "14px sans-serif";
  g.fillText("DRAW ONE", 1110, 704);
}
function button(
  r: { x: number; y: number; w: number; h: number },
  text: string,
  sel: boolean,
) {
  g.fillStyle = sel ? "#d8ad55" : "#1b5950";
  g.fillRect(r.x, r.y, r.w, r.h);
  g.fillStyle = sel ? "#102522" : "#d7eee6";
  g.font = "bold 13px sans-serif";
  g.textAlign = "center";
  g.fillText(text, r.x + r.w / 2, r.y + 17);
  g.textAlign = "start";
}
function drawScreen() {
  g.fillStyle = "rgba(1,20,19,.72)";
  g.fillRect(0, 0, W, H);
  if (state.screen === "title") {
    g.fillStyle = "#f6d879";
    g.font = "bold 100px Georgia";
    g.textAlign = "center";
    g.fillText("CASCADE", 640, 235);
    g.fillStyle = "#b6ded0";
    g.font = "20px sans-serif";
    g.fillText("KLONDIKE SOLITAIRE", 640, 275);
    rects.title.forEach((r, i) =>
      button(r, ["NEW GAME", "HOW TO PLAY"][i], i === state.menuIndex),
    );
    g.fillText("DRAW ONE", 640, 570);
  } else {
    g.fillStyle = "#f4e6bd";
    g.font = "bold 52px Georgia";
    g.textAlign = "center";
    g.fillText("HOW TO PLAY", 640, 130);
    g.font = "22px sans-serif";
    const lines = [
      "Build each foundation from ACE to KING.",
      "Build tableau columns down in rank, alternating colors.",
      "Only a KING can fill an empty column.",
      "Turn the STOCK to reveal cards, then recycle it.",
      "Drag cards to move them, or DOUBLE-CLICK a card to send it home.",
    ];
    lines.forEach((t, i) => g.fillText(t, 640, 220 + i * 55));
    button(rects.howto[0], "BACK", true);
  }
  g.textAlign = "start";
}
function overlay() {
  const s = snapshot();
  g.fillStyle = "rgba(0,0,0,.75)";
  g.fillRect(12, 12, 300, 170);
  g.fillStyle = "#d5ffdf";
  g.font = "13px monospace";
  [
    "DEBUG " + s.screen + " · " + s.dealMode,
    `stock ${s.stock.length} waste ${s.waste.length}`,
    `foundations ${s.foundations.map((x: Card[]) => x.length).join(" ")}`,
    `tableau ${s.tableau.map((x: Card[]) => x.length).join(" ")}`,
    `hand ${s.drag ? s.drag.cards.length : 0}`,
    `launched ${s.launched} flyers ${s.flyers.length}`,
  ].forEach((t, i) => g.fillText(t, 22, 35 + i * 23));
}
function snapshot() {
  const read = (c: Card) => ({
    id: c.id,
    suit: c.suit,
    rank: c.rank,
    color: color(c.suit),
    faceUp: c.faceUp,
  });
  const d = state.drag;
  let target: null | Ref = null;
  if (d) {
    const q = dropAt(d.x + CW / 2, d.y + CH / 2);
    if (q && accept(q, d.cards) && ["foundation", "tableau"].includes(q.pile))
      target = q;
  }
  return {
    version: 1,
    screen: state.screen,
    menuIndex: state.menuIndex,
    titleIndex: state.titleIndex,
    dealMode: "draw-one",
    turnCount: 1,
    dealModeLabel: "DRAW ONE",
    muted,
    autoFlip: state.autoFlip,
    winDetect: state.winDetect,
    launching: state.launching,
    trailPainting: state.trailPainting,
    stock: state.stock.map(read),
    waste: state.waste.map(read),
    wasteSets: [...state.sets],
    wasteVisibleCount: state.sets[state.sets.length - 1] ?? 0,
    foundations: state.foundations.map((x) => x.map(read)),
    tableau: state.tableau.map((x) => x.map(read)),
    drag: d
      ? {
          cards: d.cards.map(read),
          fromPile: d.fromPile,
          fromIndex: d.fromIndex,
          x: d.x,
          y: d.y,
        }
      : null,
    dropTarget: target,
    pointer: { ...state.pointer },
    lastPress: state.last
      ? { x: state.last.x, y: state.last.y, at: state.last.at }
      : null,
    launchClock: state.launchClock,
    launched: state.launched,
    flyers: state.flyers.map((f) => ({
      ...read(f),
      x: f.x,
      y: f.y,
      vx: f.vx,
      vy: f.vy,
    })),
    cascadeDone: state.done,
    trailStamps: state.stamps,
    simTime: state.sim,
  };
}
const api = {
  version: 1,
  reset,
  snapshot,
  reconcile: () => {},
  menuItemRect: (i: number) => menu()[i] ?? null,
  setAutoStep: (x: boolean) => (auto = x),
  advance: (seconds: number, frames = 1) => {
    if (!Number.isFinite(seconds) || !Number.isInteger(frames) || frames <= 0)
      throw Error("invalid advance");
    for (let i = 0; i < frames; i++) step(seconds / frames);
    render();
  },
  setMuted: (x: boolean) => (muted = x),
  setScreen: (x: typeof state.screen) => (state.screen = x),
  setMenuIndex: (x: number) => (state.menuIndex = x),
  setTitleIndex: (x: number) => (state.titleIndex = x),
  addCard: (p: Pile, i: number, s: string, r: number, u: boolean) =>
    pile(p, i).push(card(s, r, u)),
  removeCard: (n: number) => remove(n),
  setCardFaceUp: (n: number, u: boolean) => (find(n).faceUp = u),
  clearPile: (p: Pile, i: number) => {
    pile(p, i).splice(0);
    if (p === "waste") state.sets = [];
  },
  clearTable: () => {
    state.stock = [];
    state.waste = [];
    state.sets = [];
    state.foundations = [[], [], [], []];
    state.tableau = [[], [], [], [], [], [], []];
    state.drag = null;
  },
  addWasteSet: (n: number) => {
    if (!Number.isInteger(n)) throw Error("invalid count");
    state.sets.push(n);
  },
  clearWasteSets: () => (state.sets = []),
  deal,
  turnStock: turn,
  move: (a: Pile, b: number, row: number, c: Pile, d: number) =>
    move({ pile: a, index: b }, row, { pile: c, index: d }),
  autoMove,
  pointerDown: down,
  pointerMove,
  pointerUp: up,
  setAutoFlip: (x: boolean) => (state.autoFlip = x),
  setWinDetect: (x: boolean) => (state.winDetect = x),
  setLaunching: (x: boolean) => (state.launching = x),
  setTrailPainting: (x: boolean) => (state.trailPainting = x),
  addFlyer: (
    s: string,
    r: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
  ) => state.flyers.push({ ...card(s, r, true), x, y, vx, vy }),
  setFlyerPosition: (n: number, x: number, y: number) => {
    const f = flyer(n);
    f.x = x;
    f.y = y;
  },
  setFlyerVelocity: (n: number, vx: number, vy: number) => {
    const f = flyer(n);
    f.vx = vx;
    f.vy = vy;
  },
  removeFlyer: (n: number) =>
    state.flyers.splice(state.flyers.indexOf(flyer(n)), 1),
  clearFlyers: () => (state.flyers = []),
  setLaunchClock: (x: number) => (state.launchClock = x),
  clearTrail: () => {
    pg.clearRect(0, 0, W, H);
    state.stamps = 0;
  },
  drawLaunchVx: drawVx,
};
function find(n: number) {
  for (const p of [
    state.stock,
    state.waste,
    ...state.foundations,
    ...state.tableau,
  ]) {
    const c = p.find((x) => x.id === n);
    if (c) return c;
  }
  throw Error("unknown card");
}
function remove(n: number) {
  for (const p of [
    state.stock,
    state.waste,
    ...state.foundations,
    ...state.tableau,
  ]) {
    const i = p.findIndex((x) => x.id === n);
    if (i >= 0) {
      p.splice(i, 1);
      return;
    }
  }
  throw Error("unknown card");
}
function flyer(n: number) {
  const f = state.flyers.find((x) => x.id === n);
  if (!f) throw Error("unknown flyer");
  return f;
}
declare global {
  interface Window {
    __cascade: typeof api;
  }
}
window.__cascade = api;
canvas.addEventListener("pointerdown", (e) => {
  audio?.resume();
  const p = logical(e);
  down(p.x, p.y);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  const p = logical(e);
  pointerMove(p.x, p.y);
});
canvas.addEventListener("pointerup", (e) => {
  const p = logical(e);
  up(p.x, p.y);
});
function logical(e: PointerEvent) {
  const s = Math.min(innerWidth / W, innerHeight / H);
  return {
    x: (e.clientX - (innerWidth - W * s) / 2) / s,
    y: (e.clientY - (innerHeight - H * s) / 2) / s,
  };
}
addEventListener("keydown", (e) => {
  if (e.code === "Backquote") {
    debug = !debug;
    return;
  }
  if (
    [
      "ArrowUp",
      "KeyW",
      "ArrowDown",
      "KeyS",
      "Enter",
      "Space",
      "Escape",
    ].includes(e.code)
  )
    e.preventDefault();
  if (e.code === "ArrowUp" || e.code === "KeyW")
    state.menuIndex = (state.menuIndex + menu().length - 1) % menu().length;
  else if (e.code === "ArrowDown" || e.code === "KeyS")
    state.menuIndex = (state.menuIndex + 1) % menu().length;
  else if (e.code === "Enter" || e.code === "Space") activate();
  else if (e.code === "Escape" && state.screen === "howto") activate();
});
let last = performance.now();
function frame(now: number) {
  if (auto) step(Math.min(0.1, (now - last) / 1000));
  last = now;
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
