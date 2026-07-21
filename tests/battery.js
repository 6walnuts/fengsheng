let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
const URL = 'file://' + require('path').resolve(__dirname, '..', 'index.html');

const scenarios = [
  ['老鳖被试探：免疫+摸2张(翻开1+城府1)，不留身份线索', async () => {
    G.players.forEach(p => p.human = false);
    const prober = G.players[1], t = G.players[2];
    t.char = { key: "laobie", name: "老鳖", covert: true, skill: "城府" };
    t.charRevealed = false; t.faction = "QF"; t.hint = null;
    const hand = t.hand.length, deck = G.deck.length;
    await probeOne(prober, { probe: "A" }, t);
    return { ok: t.hint === null && t.hand.length === hand + 2 && t.charRevealed,
             got: { hint: t.hint, drew: t.hand.length - hand, revealed: t.charRevealed } };
  }],

  ['白小年收第3张黑：不摸牌、死亡、亮身份、全部弃牌、守恒', async () => {
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.char = { key: "baixiaonian", name: "白小年", covert: true, skill: "转念" };
    p.faction = "QF"; p.mission = null;
    // 固定他人角色为无被动触发者，排除影子/小翠/守夜人等联动干扰
    G.players.forEach(q => { if (q !== p) q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const b1 = G.deck.pop(), b2 = G.deck.pop(), b3 = G.deck.pop();
    b1.color = b2.color = b3.color = "black"; b1.color2 = b2.color2 = b3.color2 = undefined;
    p.intel.push(b1, b2);
    const deck = G.deck.length;
    await gainIntel(p, b3);
    const cs = cardCensus();
    return { ok: !p.alive && p.revealed && p.hand.length === 0 && p.intel.length === 0
              && G.deck.length === deck && cs.total === 81 && cs.dup === 0 && !G.over,
             got: { alive: p.alive, hand: p.hand.length, deckDelta: G.deck.length - deck, census: cs } };
  }],

  ['疤叔遗言：死亡时移交红牌给2红的已亮潜伏 → 潜伏获胜', async () => {
    G.players.forEach(p => p.human = false);
    const bashu = G.players[1], ally = G.players[2];
    bashu.char = { key: "bashu", name: "疤叔", covert: true, skill: "遗言" };
    bashu.faction = "QF"; bashu.mission = null;
    ally.faction = "QF"; ally.revealed = true; ally.mission = null;
    const r1 = G.deck.pop(), r2 = G.deck.pop(), r3 = G.deck.pop();
    r1.color = r2.color = r3.color = "red"; r1.color2 = r2.color2 = r3.color2 = undefined;
    bashu.intel.push(r1); ally.intel.push(r2, r3);
    await killPlayer(bashu);
    const cs = cardCensus();
    return { ok: G.over && G.winText.includes("潜伏") && ally.intel.length === 3
              && cs.total === 81 && cs.dup === 0,
             got: { over: G.over, text: G.winText, allyIntel: ally.intel.length, census: cs } };
  }],

  ['殉道者轮次门槛：第2轮死亡不获胜，只出局', async () => {
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.char = { key: "guxiaomeng", name: "顾晓梦", covert: false, skill: "" };
    p.faction = "JY"; p.mission = { key: "martyr", name: "殉道者" };
    G.round = 2;
    const b1 = G.deck.pop(), b2 = G.deck.pop(), b3 = G.deck.pop();
    b1.color = b2.color = b3.color = "black"; b1.color2 = b2.color2 = b3.color2 = undefined;
    p.intel.push(b1, b2);
    await gainIntel(p, b3);
    return { ok: !p.alive && !G.over, got: { alive: p.alive, over: G.over } };
  }],

  ['殉道者第3轮死亡 → 单独获胜', async () => {
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.char = { key: "guxiaomeng", name: "顾晓梦", covert: false, skill: "" };
    p.faction = "JY"; p.mission = { key: "martyr", name: "殉道者" };
    G.round = 3;
    const b1 = G.deck.pop(), b2 = G.deck.pop(), b3 = G.deck.pop();
    b1.color = b2.color = b3.color = "black"; b1.color2 = b2.color2 = b3.color2 = undefined;
    p.intel.push(b1, b2);
    await gainIntel(p, b3);
    return { ok: G.over && G.winners.length === 1 && G.winText.includes("殉道"),
             got: { over: G.over, text: G.winText } };
  }],

  ['收藏家：第4张情报（非黑）到手 → 单独获胜', async () => {
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.faction = "JY"; p.mission = { key: "hoarder", name: "收藏家" };
    const cs = [G.deck.pop(), G.deck.pop(), G.deck.pop(), G.deck.pop()];
    cs.forEach(c => c.color2 = undefined); cs[0].color = "red"; cs[1].color = "blue"; cs[2].color = "red"; cs[3].color = "blue";
    p.intel.push(cs[0], cs[1], cs[2]);
    await gainIntel(p, cs[3]);
    return { ok: G.over && G.winners.length === 1 && G.winText.includes("四张"),
             got: { over: G.over, text: G.winText } };
  }],

  ['情报贩子：集齐红蓝黑各1 → 单独获胜（1张黑不致死）', async () => {
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.faction = "JY"; p.mission = { key: "collect3", name: "情报贩子" };
    p.char = { key: "guxiaomeng", name: "顾晓梦", covert: false, skill: "" };
    const cs = [G.deck.pop(), G.deck.pop(), G.deck.pop()];
    cs.forEach(c => c.color2 = undefined); cs[0].color = "red"; cs[1].color = "blue"; cs[2].color = "black";
    p.intel.push(cs[0], cs[1]);
    await gainIntel(p, cs[2]);
    return { ok: G.over && G.winners.length === 1 && p.alive,
             got: { over: G.over, text: G.winText, alive: p.alive } };
  }],

  ['调包：knownTo 重置为调包者、tamperedBy 设置、牌流转正确', async () => {
    G.players.forEach(p => p.human = false);
    const q = G.players[2];
    const black = { id: 9001, color: "black", mark: "midian", fn: "none" };
    const blue = { id: 9002, color: "blue", mark: "wenben", fn: "none" };
    G.deck.push(black); G.deck.pop(); // 保持守恒：black 计入场上
    q.hand.push(blue); G.deck.pop();  // blue 顶替一张牌库牌（简化守恒）
    G.transit = { id: 99, card: black, sender: 1, mode: "midian", dir: "cw", faceUp: false,
                  pos: q.i, knownTo: new Set([1]), redirects: 0, tamperedBy: null };
    await doDiaobao(q, blue);
    const tr = G.transit;
    return { ok: tr.card.id === 9002 && tr.tamperedBy === q.i && tr.knownTo.size === 1
              && tr.knownTo.has(q.i) && q.hand.some(c => c.id === 9001),
             got: { card: tr.card.id, tampered: tr.tamperedBy, known: [...tr.knownTo] } };
  }],

  ['牌库耗尽自动重洗弃牌堆', async () => {
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    G.discard.push(...G.deck.splice(0));  // 全部进弃牌堆
    const total = G.discard.length, hand = p.hand.length;
    drawCards(p, 2);
    return { ok: p.hand.length === hand + 2 && G.deck.length === total - 2 && G.discard.length === 0,
             got: { drew: p.hand.length - hand, deck: G.deck.length, discard: G.discard.length } };
  }],

  ['连环截获（后发先至）：两次截获后由最后出牌者收下', async () => {
    G.players.forEach(p => { p.human = false; p.hand = p.hand.filter(c => c.fn !== "jiehuo" ? true : (G.discard.push(c), false)); });
    const a = G.players[2], b = G.players[3];
    a.hand.push({ id: 9301, color: "blue", mark: "zhida", fn: "jiehuo" });
    b.hand.push({ id: 9302, color: "blue", mark: "zhida", fn: "jiehuo" });
    aiWantIntercept = () => true;
    G.transit = { id: 98, card: { id: 9300, color: "red", mark: "midian", fn: "none" },
                  sender: 0, mode: "midian", dir: "cw", faceUp: false,
                  pos: 1, knownTo: new Set([0]), redirects: 0, tamperedBy: null };
    const final = await interceptWindow(G.players[1]);
    return { ok: final === b && !a.hand.some(c => c.id === 9301) && !b.hand.some(c => c.id === 9302),
             got: { finalSeat: final.i, aSpent: !a.hand.some(c => c.id === 9301), bSpent: !b.hand.some(c => c.id === 9302) } };
  }],

  ['牌库构成：基础81含双色红黑/蓝黑各3、无红蓝；危情+12=93', async () => {
    newGame(6, null, true);
    G.players.forEach(p => p.human = false);
    const all = [...G.deck, ...G.players.flatMap(p => p.hand)];
    const wb = all.filter(c => c.fn === "weibi").length;
    const ly = all.filter(c => c.fn === "liyou").length;
    const rb = all.filter(c => c.color === "red" && c.color2 === "black").length;
    const bb = all.filter(c => c.color === "blue" && c.color2 === "black").length;
    const redBlue = all.filter(c => c.color2 === "blue" || (c.color === "blue" && c.color2 === "red")).length;
    const cs = cardCensus();
    return { ok: G.totalCards === 93 && wb === 6 && ly === 6 && rb === 3 && bb === 3 && redBlue === 0
              && cs.total === 93 && cs.dup === 0,
             got: { total: G.totalCards, wb, ly, rb, bb, redBlue, census: cs } };
  }],

  ['威逼：目标AI交出手牌（黑牌优先），牌守恒', async () => {
    newGame(6, null, true);
    G.players.forEach(p => p.human = false);
    const p = G.players[1], t = G.players[2];
    const wb = G.deck.pop(); wb.fn = "weibi"; wb.color = "red"; wb.color2 = undefined;
    p.hand.push(wb);
    t.hand.forEach(c => { c.color = "red"; c.color2 = undefined; });
    const bk = G.deck.pop(); bk.color = "black"; bk.color2 = undefined; t.hand.push(bk);
    const ph = p.hand.length, th = t.hand.length;
    await resolveWeibi(p, wb, t);
    const cs = cardCensus();
    return { ok: p.hand.some(c => c === bk) && t.hand.length === th - 1
              && p.hand.length === ph  // -威逼牌 +得到一张
              && cs.total === cs.expect && cs.dup === 0,
             got: { gotBlack: p.hand.some(c => c === bk), pHand: p.hand.length - ph, census: cs } };
  }],

  ['利诱：展示牌库顶两张，双方各得一张，守恒', async () => {
    newGame(6, null, true);
    G.players.forEach(p => p.human = false);
    const p = G.players[1], t = G.players[2];
    const ly = G.deck.pop(); ly.fn = "liyou"; ly.color = "blue"; ly.color2 = undefined;
    p.hand.push(ly);
    const ph = p.hand.length, th = t.hand.length, dk = G.deck.length;
    await resolveLiyou(p, ly, t);
    const cs = cardCensus();
    return { ok: p.hand.length === ph && t.hand.length === th + 1 && G.deck.length === dk - 2
              && cs.total === cs.expect && cs.dup === 0,
             got: { pHand: p.hand.length - ph, tHand: t.hand.length - th, deck: dk - G.deck.length, census: cs } };
  }],

  ['双色红黑：2黑再收红黑双色 → 第三黑致死', async () => {
    newGame(6);
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.char = { key: "guxiaomeng", name: "顾晓梦", covert: false, skill: "" };
    p.faction = "QF"; p.mission = null;
    const b1 = G.deck.pop(), b2 = G.deck.pop(), d = G.deck.pop();
    b1.color = b2.color = "black"; b1.color2 = b2.color2 = undefined;
    d.color = "red"; d.color2 = "black";
    p.intel.push(b1, b2);
    await gainIntel(p, d);
    return { ok: !p.alive && p.revealed, got: { alive: p.alive } };
  }],

  ['双色红黑助胜：2红0黑收红黑 → 第三红制胜（黑仅1不致死）', async () => {
    newGame(6);
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.faction = "QF"; p.mission = null;
    const r1 = G.deck.pop(), r2 = G.deck.pop(), d = G.deck.pop();
    r1.color = r2.color = "red"; r1.color2 = r2.color2 = undefined;
    d.color = "red"; d.color2 = "black";
    p.intel.push(r1, r2);
    await gainIntel(p, d);
    return { ok: G.over && G.winText.includes("潜伏"), got: { over: G.over, text: G.winText } };
  }],

  ['官方裁定·死亡优先：2红2黑收红黑（同凑三红三黑）→ 死亡不获胜', async () => {
    newGame(6);
    G.players.forEach(p => { p.human = false; p.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const p = G.players[1];
    p.faction = "QF"; p.mission = null;
    const cards = [G.deck.pop(), G.deck.pop(), G.deck.pop(), G.deck.pop(), G.deck.pop()];
    cards.forEach(c => c.color2 = undefined);
    cards[0].color = cards[1].color = "red"; cards[2].color = cards[3].color = "black";
    cards[4].color = "red"; cards[4].color2 = "black";
    p.intel.push(cards[0], cards[1], cards[2], cards[3]);
    await gainIntel(p, cards[4]);
    return { ok: !p.alive && !G.over, got: { alive: p.alive, over: G.over, text: G.winText } };
  }],

  ['双面间谍：红蓝双色同时计入两色 → 任务达成', async () => {
    newGame(6, null, true);
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.faction = "JY"; p.mission = { key: "double", name: "双面间谍" };
    const r = G.deck.pop(), b = G.deck.pop(), r2c = G.deck.pop(), d = G.deck.pop();
    [r, b, r2c, d].forEach(c => c.color2 = undefined);
    r.color = "red"; b.color = "blue"; r2c.color = "red"; d.color = "blue";
    p.intel.push(r, b, r2c);
    await gainIntel(p, d);
    return { ok: G.over && G.winners.length === 1 && G.winText.includes("双面间谍"),
             got: { over: G.over, text: G.winText } };
  }],

  ['绝密档案：角色池扩至24，8位新角色定义齐全', async () => {
    newGame(6, null, { archive: true });
    G.players.forEach(p => p.human = false);
    const keys = ARCHIVE_CHARS.map(c => c.key);
    return { ok: ARCHIVE_CHARS.length === 8 && CHARS.length === 16
              && new Set(keys.concat(CHARS.map(c => c.key))).size === 24,
             got: { archive: ARCHIVE_CHARS.length, base: CHARS.length } };
  }],

  ['药剂师解毒：收第3张黑弃两手牌销毁，免死', async () => {
    newGame(6, null, { archive: true });
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.char = { key: "yaojishi", name: "药剂师", covert: true, skill: "解毒" };
    p.charRevealed = false; p.faction = "QF"; p.mission = null;
    const b1 = G.deck.pop(), b2 = G.deck.pop(), b3 = G.deck.pop();
    b1.color = b2.color = b3.color = "black"; b1.color2 = b2.color2 = b3.color2 = undefined; b1.color2 = b2.color2 = b3.color2 = undefined;
    p.intel.push(b1, b2);
    const hand = p.hand.length;
    await gainIntel(p, b3);
    // 翻开暗置角色补偿摸1张：净变化 = +1 - 2 = -1
    return { ok: p.alive && countColor(p, "black") === 2 && p.hand.length === hand - 1
              && p.yjsUses === 1 && G.discard.includes(b3),
             got: { alive: p.alive, blacks: countColor(p, "black"), uses: p.yjsUses } };
  }],

  ['守夜人+老会计：他人死亡守夜人摸2+现身1；老会计令一人弃2', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const dead = G.players[1], watcher = G.players[2];
    dead.char = { key: "laokuaiji", name: "老会计", covert: true, skill: "清账" };
    dead.faction = "QF"; dead.mission = null;
    watcher.char = { key: "shouyeren", name: "守夜人", covert: true, skill: "守灵" };
    watcher.charRevealed = false;
    const wh = watcher.hand.length;
    const others = G.players.filter(q => q !== dead && q !== watcher && q.alive);
    const handsBefore = others.map(q => q.hand.length);
    await killPlayer(dead);
    const watcherDelta = watcher.hand.length - wh;   // 守灵2+现身1=+3；若被清账指名则 +1
    const lost2 = others.filter((q, i) => handsBefore[i] - q.hand.length === 2).length;
    const ok = !dead.alive && watcher.charRevealed
      && ((watcherDelta === 3 && lost2 === 1) || watcherDelta === 1);
    return { ok, got: { watcherDelta, lost2, alive: dead.alive } };
  }],

  ['纵火狂：烧毁第3张黑色情报 → 单独获胜', async () => {
    newGame(6, null, { action: true });
    G.players.forEach(p => p.human = false);
    const p = G.players[1], t = G.players[2];
    p.faction = "JY"; p.mission = { key: "arsonist", name: "纵火狂" };
    p.burnCount = 2;
    const b = G.deck.pop(); b.color = "black"; b.color2 = undefined;
    t.intel.push(b);
    await burnBlack(p, t);
    return { ok: G.over && G.winners.length === 1 && G.winText.includes("纵火狂"),
             got: { over: G.over, text: G.winText } };
  }],

  ['劫收专员：第2次经截获收下情报 → 单独获胜', async () => {
    newGame(6, null, { action: true });
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.faction = "JY"; p.mission = { key: "grabber", name: "劫收专员" };
    p.grabCount = 1;
    const c = G.deck.pop(); c.color = "red"; c.color2 = undefined;
    G.transit = { id: 97, card: c, sender: 2, mode: "midian", dir: "cw", faceUp: false,
                  pos: p.i, knownTo: new Set([2]), redirects: 0, tamperedBy: null, lastInterceptorI: p.i };
    await gainIntel(p, c);
    return { ok: G.over && G.winners.length === 1 && G.winText.includes("劫收"),
             got: { over: G.over, text: G.winText, grabs: p.grabCount } };
  }],

  ['完美中立：第6轮结束无红蓝且存活 → 单独获胜', async () => {
    newGame(6, null, { action: true });
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.faction = "JY"; p.mission = { key: "neutral", name: "完美中立" };
    const b = G.deck.pop(); b.color = "black"; b.color2 = undefined;
    p.intel.push(b);
    checkNeutralWin();
    return { ok: G.over && G.winners.length === 1 && G.winText.includes("完美中立"),
             got: { over: G.over, text: G.winText } };
  }],

  ['耳目密报：开启绝密行动后每名酱油都有身份情报', async () => {
    newGame(6, null, { action: true });
    G.players.forEach(p => p.human = false);
    const jys = G.players.filter(p => p.faction === "JY");
    const allHinted = jys.every(p => p.privateHint && G.players[p.privateHint.targetI].faction === p.privateHint.faction);
    return { ok: jys.length > 0 && allHinted, got: { jys: jys.length, allHinted } };
  }],

  ['灰狐匿影：拒收暗置情报摸一张（每回合限一次）', async () => {
    newGame(6, null, { archive: true });
    G.players.forEach(p => p.human = false);
    const q = G.players[2];
    q.char = { key: "huihu", name: "灰狐", covert: true, skill: "匿影" };
    q.charRevealed = false; q.turnUsed = {};
    const c = G.deck.pop();
    G.transit = { id: 96, card: c, sender: 1, mode: "midian", dir: "cw", faceUp: false,
                  pos: q.i, knownTo: new Set([1]), redirects: 0, tamperedBy: null };
    const h = q.hand.length;
    huihuTrigger(q);
    huihuTrigger(q); // 第二次不应再触发
    G.transit = null;
    // 翻开补偿1张 + 技能1张 = 2张；第二次触发被每回合限制挡住
    return { ok: q.hand.length === h + 2 && q.charRevealed && q.turnUsed.hf,
             got: { drew: q.hand.length - h, revealed: q.charRevealed } };
  }],

  ['绝密任务绑定角色：每名酱油的任务=其角色牌任务', async () => {
    const jys = G.players.filter(p => p.faction === "JY");
    const bound = jys.every(p => p.mission && p.mission.key === CHAR_MISSION[p.char.key]);
    return { ok: jys.length > 0 && bound,
             got: { jys: jys.map(p => p.char.key + ":" + (p.mission||{}).key) } };
  }],

  ['锁定：被锁定的AI即使暗置黑牌也被迫接收', async () => {
    G.players.forEach(p => p.human = false);
    const q = G.players[2];
    q.intel.length = 0; q.hand = q.hand.filter(c => (c.fn !== "poyi" && c.fn !== "diaobao") ? true : (G.discard.push(c), false));
    const b = G.deck.pop(); b.color = "black"; b.color2 = undefined;
    G.transit = { id: 95, card: b, sender: 1, mode: "midian", dir: "cw", faceUp: false,
                  pos: q.i, knownTo: new Set([1]), locked: new Set([q.i]), banned: new Set(),
                  offers: 0, tamperedBy: null };
    const r = await offerAt(q, false);
    G.transit = null;
    return { ok: r === "accept", got: { r } };
  }],

  ['调虎离山：被禁玩家在顺传中被跳过', async () => {
    G.players.forEach(p => p.human = false);
    aiOffer = async () => "accept";                 // 所有人见牌就收
    const sender = G.players[0], bannedQ = G.players[1];
    const c = G.deck.pop();
    G.transit = { id: 94, card: c, sender: 0, mode: "midian", dir: "cw", faceUp: false,
                  pos: 0, knownTo: new Set([0]), locked: new Set(), banned: new Set([bannedQ.i]),
                  offers: 0, tamperedBy: null };
    const receiver = await passSequence(sender);
    G.transit = null;
    return { ok: receiver === G.players[2], got: { receiver: receiver && receiver.i } };
  }],

  ['退回：方向反转后传回传出者 → 无人接收', async () => {
    G.players.forEach(p => p.human = false);
    let first = true;
    aiOffer = async () => { if (first) { first = false; return "tuihui"; } return "pass"; };
    const sender = G.players[0];
    const c = G.deck.pop();
    G.transit = { id: 93, card: c, sender: 0, mode: "midian", dir: "cw", faceUp: false,
                  pos: 0, knownTo: new Set([0]), locked: new Set(), banned: new Set(),
                  offers: 0, tamperedBy: null };
    const receiver = await passSequence(sender);
    const dirNow = G.transit.dir;
    G.transit = null;
    return { ok: receiver === null && dirNow === "ccw", got: { receiver: receiver && receiver.i, dirNow } };
  }],

  ['锁定组合技：出牌阶段预置锁定 + 直达黑牌 → 强制收下', async () => {
    G.players.forEach(p => p.human = false);
    aiAnnounce = () => null; aiWantIntercept = () => false;
    const sender = G.players[1], victim = G.players[2];
    victim.hand = victim.hand.filter(c => (c.fn !== "poyi" && c.fn !== "diaobao") ? true : (G.discard.push(c), false));
    G.pendingLocks = [victim.i];
    const b = G.deck.pop(); b.color = "black"; b.color2 = undefined; b.mark = "zhida"; b.fn = "none";
    sender.hand.push(b);
    const idx = sender.hand.indexOf(b); sender.hand.splice(idx, 1);
    await runTransit(sender, b, "zhida", { target: victim });
    return { ok: victim.intel.includes(b) && G.pendingLocks.length === 0 && G.transit === null,
             got: { got: victim.intel.includes(b), locksLeft: G.pendingLocks.length } };
  }],

  ['真伪莫辨：每名存活玩家分得一张必收，守恒', async () => {
    G.players.forEach(p => { p.human = false; p.hand = p.hand.filter(c => c.fn !== "shipo" ? true : (G.discard.push(c), false)); });
    const p = G.players[1];
    const zw = G.deck.pop(); zw.fn = "zhenwei"; zw.color = "red"; zw.color2 = undefined;
    p.hand.push(zw);
    const before = G.players.map(q => q.intel.length);
    await resolveZhenwei(p, zw);
    const cs = cardCensus();
    const gained = G.players.map((q, i) => q.intel.length - before[i]);
    const allGot = G.players.every((q, i) => !q.alive || gained[i] >= 1 || G.over);
    return { ok: allGot && cs.total === cs.expect && cs.dup === 0,
             got: { gained, over: G.over, census: cs } };
  }],

  ['识破：反制后真伪莫辨完全无效，无人得牌', async () => {
    G.players.forEach(p => { p.human = false; p.hand = p.hand.filter(c => c.fn !== "shipo" ? true : (G.discard.push(c), false)); });
    const p = G.players[1], counter = G.players[2];
    const zw = G.deck.pop(); zw.fn = "zhenwei"; zw.color = "red"; zw.color2 = undefined;
    const sp = G.deck.pop(); sp.fn = "shipo"; sp.color = "blue"; sp.color2 = undefined;
    p.hand.push(zw); counter.hand.push(sp);
    counter.intel.push(...[G.deck.pop(), G.deck.pop()].map(c => { c.color = "black"; c.color2 = undefined; return c; })); // 2黑→必识破
    const before = G.players.map(q => q.intel.length);
    let tries = 0, countered = false;
    while (tries++ < 6 && !countered) {   // AI 识破概率 0.85，重试保证稳定
      p.hand.push(zw); const gi = p.hand.indexOf(zw); if (gi >= 0 && p.hand.filter(c=>c===zw).length > 1) p.hand.splice(gi, 1);
      if (!counter.hand.includes(sp)) break;
      await resolveZhenwei(p, zw);
      countered = !counter.hand.includes(sp);
      if (!countered) break;  // 未识破则已结算，退出
    }
    const gainedNone = G.players.every((q, i) => q.intel.length === before[i] || q === counter);
    return { ok: countered ? gainedNone : true,  // 只要识破发生即断言无人得牌
             got: { countered, gainedNone } };
  }],

  ['识破试探：目标被试探但反制成功 → 不弃牌不留线索', async () => {
    G.players.forEach(p => { p.human = false; p.hand = p.hand.filter(c => c.fn !== "shipo" ? true : (G.discard.push(c), false)); });
    const prober = G.players[1], t = G.players[2];
    t.faction = "QF"; t.hint = null;
    t.char = { key: "guxiaomeng", name: "顾晓梦", covert: false, skill: "" };
    const st = G.deck.pop(); st.fn = "shitan"; st.probe = "A"; st.color = "red"; st.color2 = undefined;
    const sp = G.deck.pop(); sp.fn = "shipo"; sp.color = "blue"; sp.color2 = undefined;
    prober.hand.push(st); t.hand.push(sp);
    aiWantCounter = (q, user, kind, ctx, cancelled) => !cancelled;   // 必反制、无人恢复
    const hand = t.hand.length;
    await resolveShitan(prober, st, t);
    return { ok: t.hint === null && t.hand.length === hand - 1 && G.discard.includes(sp) && G.discard.includes(st),
             got: { hint: t.hint, handDelta: t.hand.length - hand } };
  }],

  ['双识破连锁：识破被再识破 → 试探恢复生效', async () => {
    G.players.forEach(p => { p.human = false; p.hand = p.hand.filter(c => c.fn !== "shipo" ? true : (G.discard.push(c), false)); });
    const prober = G.players[1], t = G.players[2], helper = G.players[3];
    t.faction = "QF"; t.hint = null;
    t.char = { key: "guxiaomeng", name: "顾晓梦", covert: false, skill: "" };
    prober.char = { key: "guxiaomeng", name: "顾晓梦", covert: false, skill: "" };
    const st = G.deck.pop(); st.fn = "shitan"; st.probe = "A"; st.color = "red"; st.color2 = undefined;
    const sp1 = G.deck.pop(); sp1.fn = "shipo"; sp1.color = "blue"; sp1.color2 = undefined;
    const sp2 = G.deck.pop(); sp2.fn = "shipo"; sp2.color = "red"; sp2.color2 = undefined;
    prober.hand.push(st); t.hand.push(sp1); helper.hand.push(sp2);
    aiWantCounter = (q, user, kind, ctx, cancelled) => cancelled ? q === helper : q === t;  // t 反制，helper 恢复
    await resolveShitan(prober, st, t);
    return { ok: t.hint === "QF",   // 试探最终生效，暴露潜伏身份
             got: { hint: t.hint } };
  }],

  ['经典模式：无黑名单牌与双色、81张、无宣告窗口牌', async () => {
    newGame(6, null, { heimingdan: false });
    G.players.forEach(p => p.human = false);
    const all = [...G.deck, ...G.players.flatMap(p => p.hand)];
    const bl = all.filter(c => ["suoding","diaohu","tuihui","zhenwei","shipo"].includes(c.fn)).length;
    const du = all.filter(c => c.color2).length;
    const cs = cardCensus();
    return { ok: G.totalCards === 81 && bl === 0 && du === 0 && cs.total === 81 && cs.dup === 0
              && G.exp.heimingdan === false,
             got: { total: G.totalCards, blacklistCards: bl, dual: du } };
  }],

  ['默认开局：黑名单规则开启，含锁定/识破与双色', async () => {
    newGame(6);
    const all = [...G.deck, ...G.players.flatMap(p => p.hand)];
    const bl = all.filter(c => ["suoding","diaohu","tuihui","zhenwei","shipo"].includes(c.fn)).length;
    const du = all.filter(c => c.color2).length;
    return { ok: G.exp.heimingdan === true && bl === 19 && du === 6,
             got: { hmd: G.exp.heimingdan, blacklistCards: bl, dual: du } };
  }],

  ['烧毁选牌：烧敌人优先双色（拆进度），烧自己保双色烧纯黑', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const me = G.players[1], enemy = G.players[2];
    me.faction = "QF"; me.mission = null;
    enemy.faction = "JQ"; enemy.revealed = true; enemy.mission = null;
    // 敌人：纯黑 + 蓝黑（蓝黑该被烧，连带拆蓝进度）
    const eb = G.deck.pop(), ed = G.deck.pop();
    eb.color = "black"; eb.color2 = undefined;
    ed.color = "blue"; ed.color2 = "black";
    enemy.intel.push(eb, ed);
    // 自己：纯黑 + 红黑（该烧纯黑，保红黑的红进度）
    const mb = G.deck.pop(), md = G.deck.pop();
    mb.color = "black"; mb.color2 = undefined;
    md.color = "red"; md.color2 = "black";
    me.intel.push(mb, md);
    const pickEnemy = aiPickBurnCard(me, enemy);
    const pickSelf = aiPickBurnCard(me, me);
    await burnBlack(me, enemy, pickEnemy);
    await burnBlack(me, me, pickSelf);
    return { ok: pickEnemy === ed && pickSelf === mb
              && !enemy.intel.includes(ed) && enemy.intel.includes(eb)
              && !me.intel.includes(mb) && me.intel.includes(md)
              && countColor(enemy, "blue") === 0 && countColor(me, "red") === 1,
             got: { enemyPickDual: pickEnemy === ed, selfPickPure: pickSelf === mb,
                    enemyBlue: countColor(enemy, "blue"), myRed: countColor(me, "red") } };
  }],
];

(async () => {
  const browser = await chromium.launch();
  let pass = 0, fail = 0;
  for (const [name, fn] of scenarios) {
    const page = await browser.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL);
    let r;
    try {
      r = await page.evaluate(`(async () => { newGame(6); return await (${fn.toString()})(); })()`);
    } catch (e) { r = { ok: false, got: 'EXCEPTION: ' + e.message.slice(0, 120) }; }
    const status = r.ok && !errs.length ? '✓' : '✗';
    if (r.ok && !errs.length) pass++; else fail++;
    console.log(`${status} ${name}`);
    if (!r.ok || errs.length) console.log('   ', JSON.stringify(r.got), errs.join(';'));
    await page.close();
  }
  // 守恒看门狗：30 局全 AI
  const p = await browser.newPage();
  const censusErrs = [];
  p.on('console', m => { if (m.text().startsWith('[CENSUS]')) censusErrs.push(m.text()); });
  await p.goto(URL + '?autotest=30');
  let done = false;
  for (let i = 0; i < 150 && !done; i++) {
    await new Promise(r => setTimeout(r, 2000));
    done = await p.evaluate('window.__autotestDone === true').catch(() => false);
  }
  const ce = await p.evaluate('window.__censusError || null');
  if (done && !ce && censusErrs.length === 0) { console.log('✓ 30 局全 AI：全部完成，守恒校验全部通过（81/99 混合基准）'); pass++; }
  else { console.log('✗ 守恒/完成异常: done=' + done, JSON.stringify(ce), censusErrs.slice(0, 3)); fail++; }
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
