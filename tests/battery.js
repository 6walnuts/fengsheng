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
    G.players.forEach(p => { p.human = false; p.hand = p.hand.filter(c => c.fn !== "shipo" ? true : (G.discard.push(c), false)); });
    G.players.forEach(p => { p.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; p.charRevealed = true; });
    const p = G.players[1], t = G.players[2];
    const wb = G.deck.pop(); wb.fn = "weibi"; wb.color = "red"; wb.color2 = undefined;
    p.hand.push(wb);
    t.hand.forEach(c => { c.color = "red"; c.color2 = undefined; });
    const bk = G.deck.pop(); bk.color = "black"; bk.color2 = undefined; bk.fn = "none"; t.hand.push(bk);
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
    G.players.forEach(p => { p.human = false; p.hand = p.hand.filter(c => c.fn !== "shipo" ? true : (G.discard.push(c), false)); });
    G.players.forEach(p => { p.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; p.charRevealed = true; });
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
    G.players.forEach(p => { p.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; p.charRevealed = true; });
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
    G.players.forEach(p => { p.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; p.charRevealed = true; });
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
    G.players.forEach(p => { p.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; p.charRevealed = true; });
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
    G.players.forEach(p => { p.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; p.charRevealed = true; });
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
    G.players.forEach(p => { p.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; p.charRevealed = true; });
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
    G.players.forEach(p => { p.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; p.charRevealed = true; });
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
    G.players.forEach(p => { p.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; p.charRevealed = true; });
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
    G.players.forEach(p => { p.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; p.charRevealed = true; });
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
    newGame(6);   // 默认黑名單 25 人，任务挂在角色 missionKey 上
    const jys = G.players.filter(p => p.faction === "JY");
    const bound = jys.every(p => {
      const want = p.char.missionKey || CHAR_MISSION[p.char.key];
      return p.mission && (p.mission.key === want || ["snake","firstwipe"].includes(want)); // 后两者被测试基座中和
    });
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
    aiWantCounter = (q, user, kind) => kind === "zhenwei" && q === counter;   // 强制 counter 必识破
    const before = G.players.map(q => q.intel.length);
    await resolveZhenwei(p, zw);
    const countered = !counter.hand.includes(sp);
    const gainedNone = G.players.every((q, i) => q.intel.length === before[i] || q === counter);
    return { ok: countered && gainedNone,
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
    const pv = viewOf(prober)[t.i];
    return { ok: pv.hint === "QF",   // 试探最终生效，试探者私有认知确认潜伏
             got: { hint: pv.hint } };
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

  ['默认开局：完整黑名單牌库（25人+博弈/权衡/增援/转移，无退回，双色6）', async () => {
    newGame(6);
    const all = [...G.deck, ...G.players.flatMap(p => p.hand)];
    const cnt = f => all.filter(f).length;
    const du = all.filter(c => c.color2).length;
    return { ok: G.exp.heimingdan === true && G.totalCards === 81 && du === 6
              && G.players.every(p => QIANZHI_CHARS.includes(p.char))
              && cnt(c => c.fn === "boyi") === 4 && cnt(c => c.fn === "quanheng") === 2
              && cnt(c => c.fn === "zengyuan") === 2 && cnt(c => c.fn === "zhuanyi") === 4
              && cnt(c => c.fn === "zhenwei") === 3 && cnt(c => c.fn === "suoding") === 5
              && cnt(c => c.fn === "tuihui") === 0 && cnt(c => c.fn === "lijian") === 0,
             got: { total: G.totalCards, dual: du,
                    boyi: cnt(c=>c.fn==="boyi"), quanheng: cnt(c=>c.fn==="quanheng"),
                    zengyuan: cnt(c=>c.fn==="zengyuan"), zhuanyi: cnt(c=>c.fn==="zhuanyi") } };
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

  ['吴志国硬汉：宣告窗口截获也触发（翻开+1、技能+1）', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const sender = G.players[1], grabber = G.players[3];
    sender.char = { key: "wuzhiguo", name: "吴志国", covert: true, skill: "硬汉" };
    sender.charRevealed = false;
    grabber.hand.push((() => { const c = G.deck.pop(); c.fn = "jiehuo"; c.color = "blue"; c.color2 = undefined; return c; })());
    aiAnnounce = q => q === grabber ? { type: "grab" } : null;
    const sh = sender.hand.length;
    G.transit = { id: 92, card: { id: 9400, color: "red", mark: "midian", fn: "none" }, sender: sender.i,
                  mode: "midian", dir: "cw", faceUp: false, pos: sender.i, knownTo: new Set([sender.i]),
                  locked: new Set(), banned: new Set(), offers: 0, tamperedBy: null };
    G.deck.pop(); // 抵销 9400 号临时牌保守恒（本测试不校验守恒，仅防干扰）
    const receiver = await announceWindow(sender);
    G.transit = null;
    return { ok: receiver === grabber && sender.hand.length === sh + 2 && sender.charRevealed,
             got: { receiver: receiver && receiver.i, senderDrew: sender.hand.length - sh, revealed: sender.charRevealed } };
  }],

  ['试探私密：结果只进试探者认知，旁观者与全局一无所知', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    ["QF","QF","JQ","JQ","JY","JY"].forEach((f,i)=>{ G.players[i].faction=f; G.players[i].mission = f==="JY"?MISSION_DEFS.collect3:null; });
    const prober = G.players[1], t = G.players[2], bystander = G.players[3];
    await probeOne(prober, { probe: "A" }, t);
    const pv = viewOf(prober)[t.i], bv = viewOf(bystander)[t.i];
    return { ok: t.hint == null && pv.excluded.includes("QF")
              && !bv.hint && bv.excluded.length === 0,
             got: { globalHint: t.hint, proberKnows: pv.excluded, bystander: bv } };
  }],

  ['真人试探排除 → 座位徽章显示"非潜伏"', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const prober = G.players[0], t = G.players[2];
    prober.human = true;
    t.faction = "JQ";
    await probeOne(prober, { probe: "A" }, t);
    const badge = factionBadge(t);
    prober.human = false;
    return { ok: badge.includes("非潜伏"), got: { badge } };
  }],

  ['两次排除推理闭环：试探者私有视角自动确认军情处', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const prober = G.players[1], t = G.players[2];
    t.faction = "JQ";
    await probeOne(prober, { probe: "A" }, t);   // 不是潜伏
    await probeOne(prober, { probe: "C" }, t);   // 不是酱油
    const pv = viewOf(prober)[t.i];
    return { ok: pv.hint === "JQ" && prober.know[t.i].excluded.length === 2,
             got: { hint: pv.hint, excluded: prober.know[t.i].excluded } };
  }],

  ['计数推理：其余人全排除酱油 → 剩下两人必为酱油', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const me = G.players[0];
    ["QF","JQ","JQ","QF","JY","JY"].forEach((f, i) => { G.players[i].faction = f; G.players[i].mission = f==="JY"? MISSION_DEFS.collect3 : null; });
    knowSlot(me, 1).excluded.push("JY");
    knowSlot(me, 2).excluded.push("JY");
    knowSlot(me, 3).excluded.push("JY");
    const v = viewOf(me);
    return { ok: v[4].hint === "JY" && v[5].hint === "JY" && !v[1].hint,
             got: { p4: v[4], p5: v[5], p1: v[1] } };
  }],

  ['老鬼城府：被试探免疫+摸3张(翻开1+城府2)，不留线索', async () => {
    G.players.forEach(p => p.human = false);
    const prober = G.players[1], t = G.players[2];
    t.char = OFFICIAL_CHARS.find(c => c.key === "o_laogui");
    t.charRevealed = false; t.faction = "QF"; t.hint = null;
    const hand = t.hand.length;
    await probeOne(prober, { probe: "A" }, t);
    return { ok: t.hint === null && t.hand.length === hand + 3 && t.charRevealed,
             got: { hint: t.hint, drew: t.hand.length - hand } };
  }],

  ['老枪沉着：被锁定时翻开+摸2（合计+3），锁定照常生效', async () => {
    G.players.forEach(p => { p.human = false; p.hand = p.hand.filter(c => c.fn !== "shipo" ? true : (G.discard.push(c), false)); });
    const p = G.players[1], t = G.players[2];
    t.char = OFFICIAL_CHARS.find(c => c.key === "o_laoqiang");
    t.charRevealed = false;
    const sd = G.deck.pop(); sd.fn = "suoding"; sd.color = "red"; sd.color2 = undefined;
    p.hand.push(sd);
    const hand = t.hand.length;
    await resolveSuoding(p, sd, t);
    return { ok: G.pendingLocks.includes(t.i) && t.hand.length === hand + 3 && t.charRevealed,
             got: { locked: G.pendingLocks, drew: t.hand.length - hand } };
  }],

  ['柒佰神算：使用锁定后摸2交1（净+1），受牌人+1', async () => {
    G.players.forEach(p => { p.human = false; p.hand = p.hand.filter(c => c.fn !== "shipo" ? true : (G.discard.push(c), false)); });
    const p = G.players[1], t = G.players[2];
    p.char = OFFICIAL_CHARS.find(c => c.key === "o_qibai");
    const sd = G.deck.pop(); sd.fn = "suoding"; sd.color = "red"; sd.color2 = undefined;
    p.hand.push(sd);
    const ph = p.hand.length, othersBefore = G.players.filter(q => q !== p).map(q => q.hand.length);
    await resolveSuoding(p, sd, t);
    const othersDelta = G.players.filter(q => q !== p).reduce((a, q, i) => a + q.hand.length - othersBefore[i], 0);
    // -锁定牌 +摸2 -交1 = 净0；老枪不在场无沉着 → 其他人合计 +1
    return { ok: p.hand.length === ph - 1 + 2 - 1 && othersDelta === 1 && G.pendingLocks.includes(t.i),
             got: { pDelta: p.hand.length - ph, othersDelta } };
  }],

  ['礼服绅士：获得黑色情报摸两张', async () => {
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.char = OFFICIAL_CHARS.find(c => c.key === "o_lifu");
    p.faction = "QF"; p.mission = null;
    const b = G.deck.pop(); b.color = "black"; b.color2 = undefined;
    const hand = p.hand.length;
    await gainIntel(p, b);
    return { ok: p.alive && p.hand.length === hand + 2 && countColor(p, "black") === 1,
             got: { drew: p.hand.length - hand } };
  }],

  ['礼服救美：女性角色濒死 → 亮身份烧2黑救活', async () => {
    G.players.forEach(p => p.human = false);
    const dying = G.players[1], hero = G.players[2];
    dying.char = OFFICIAL_CHARS.find(c => c.key === "o_dameinv");
    dying.faction = "QF"; dying.mission = null;
    hero.char = OFFICIAL_CHARS.find(c => c.key === "o_lifu");
    hero.faction = "JY"; hero.mission = MISSION_DEFS.femalewin; hero.revealed = false;
    const bs = [G.deck.pop(), G.deck.pop(), G.deck.pop()];
    bs.forEach(c => { c.color = "black"; c.color2 = undefined; });
    dying.intel.push(...bs);
    await killPlayer(dying);
    const cs = cardCensus();
    return { ok: dying.alive && countColor(dying, "black") === 1 && hero.revealed
              && cs.total === cs.expect && cs.dup === 0,
             got: { alive: dying.alive, blacks: countColor(dying, "black"), heroRevealed: hero.revealed, census: cs } };
  }],

  ['闪灵魅影：翻开烧掉他人至多三张黑情报', async () => {
    G.players.forEach(p => p.human = false);
    const p = G.players[1], t = G.players[2];
    p.char = OFFICIAL_CHARS.find(c => c.key === "o_shanling");
    p.charRevealed = false;
    const bs = [G.deck.pop(), G.deck.pop()];
    bs.forEach(c => { c.color = "black"; c.color2 = undefined; });
    t.intel.push(...bs);
    await skillShanling(p, t);
    const cs = cardCensus();
    return { ok: countColor(t, "black") === 0 && p.charRevealed && cs.total === cs.expect && cs.dup === 0,
             got: { blacks: countColor(t, "black"), revealed: p.charRevealed, census: cs } };
  }],

  ['血染玫瑰绽放：顶两张含黑 → 弃牌堆三张黑栽赃致死', async () => {
    G.players.forEach(p => p.human = false);
    const p = G.players[1], t = G.players[2];
    p.char = OFFICIAL_CHARS.find(c => c.key === "o_xueran");
    p.charRevealed = false;
    t.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" };
    t.faction = "JQ"; t.mission = null;
    const top = [G.deck[G.deck.length - 1], G.deck[G.deck.length - 2], G.deck[G.deck.length - 3]];
    top.forEach(c => { c.color = "black"; c.color2 = undefined; });  // 顶1张会被翻开补偿摸走
    const extra = G.deck.splice(0, 1)[0]; extra.color = "black"; extra.color2 = undefined;
    G.discard.push(extra);
    await skillXueran(p, t);
    const cs = cardCensus();
    return { ok: !t.alive && p.charRevealed && cs.total === cs.expect && cs.dup === 0,
             got: { tAlive: t.alive, census: cs } };
  }],

  ['老金藏锋：功能牌被识破 → 翻开摸5放回2（净+4）', async () => {
    G.players.forEach(p => { p.human = false; p.hand = p.hand.filter(c => c.fn !== "shipo" ? true : (G.discard.push(c), false)); });
    const p = G.players[1], counter = G.players[2];
    p.char = OFFICIAL_CHARS.find(c => c.key === "o_laojin");
    p.charRevealed = false;
    const zw = G.deck.pop(); zw.fn = "zhenwei"; zw.color = "red"; zw.color2 = undefined;
    const sp = G.deck.pop(); sp.fn = "shipo"; sp.color = "blue"; sp.color2 = undefined;
    p.hand.push(zw); counter.hand.push(sp);
    aiWantCounter = (q, user, kind, ctx, cancelled) => !cancelled;
    const h = p.hand.length, dtop = G.deck.length;
    await resolveZhenwei(p, zw);
    // -真伪牌 +翻开1 +藏锋5 -放回2 = 净+3；牌库 -1翻开 -5摸 +2放回
    return { ok: p.hand.length === h + 3 && p.charRevealed && G.deck.length === dtop - 4,
             got: { handDelta: p.hand.length - h, revealed: p.charRevealed, deckDelta: G.deck.length - dtop } };
  }],

  ['老金韬晦：获得黑色情报后重新盖伏角色牌', async () => {
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.char = OFFICIAL_CHARS.find(c => c.key === "o_laojin");
    p.charRevealed = true; p.faction = "QF"; p.mission = null;
    const b = G.deck.pop(); b.color = "black"; b.color2 = undefined;
    await gainIntel(p, b);
    return { ok: p.alive && p.charRevealed === false && countColor(p, "black") === 1,
             got: { covered: !p.charRevealed } };
  }],

  ['峨嵋峰金蝉：无截获牌也可翻开视为截获', async () => {
    G.players.forEach(p => { p.human = false; p.hand = p.hand.filter(c => c.fn !== "jiehuo" ? true : (G.discard.push(c), false)); });
    const receiver = G.players[1], q = G.players[3];
    q.char = OFFICIAL_CHARS.find(c => c.key === "o_emeifeng");
    q.charRevealed = false;
    aiWantIntercept = () => true;
    const c = G.deck.pop(); c.color = "red"; c.color2 = undefined;
    G.transit = { id: 91, card: c, sender: 0, mode: "midian", dir: "cw", faceUp: false,
                  pos: receiver.i, knownTo: new Set([0]), locked: new Set(), banned: new Set(),
                  offers: 0, tamperedBy: null };
    const final = await interceptWindow(receiver);
    G.discard.push(c); G.transit = null;
    return { ok: final === q && q.charRevealed,
             got: { finalSeat: final && final.i, revealed: q.charRevealed } };
  }],

  ['职业杀手补刀：黑直达收下后补置手牌黑情报 → 击杀', async () => {
    G.players.forEach(p => p.human = false);
    const sd = G.players[1], t = G.players[2];
    sd.char = OFFICIAL_CHARS.find(c => c.key === "o_shashou");
    t.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" };
    t.faction = "JQ"; t.mission = null; t.revealed = true;
    sd.faction = "QF"; sd.mission = null;
    sd.hand.forEach(c => { c.color = "red"; c.color2 = undefined; });  // 手里只留 hb 一张黑
    const hb = G.deck.pop(); hb.color = "black"; hb.color2 = undefined;
    sd.hand.push(hb);
    const b0 = G.deck.pop(); b0.color = "black"; b0.color2 = undefined;
    t.intel.push(b0);
    const c = G.deck.pop(); c.color = "black"; c.color2 = undefined;
    G.transit = { id: 90, card: c, sender: sd.i, mode: "zhida", dir: null, faceUp: false,
                  pos: t.i, knownTo: new Set([sd.i]), locked: new Set(), banned: new Set(),
                  offers: 0, tamperedBy: null };
    await gainIntel(t, c);
    G.transit = null;
    const cs = cardCensus();
    return { ok: !t.alive && !sd.hand.includes(hb) && cs.total === cs.expect && cs.dup === 0,
             got: { tAlive: t.alive, knifeUsed: !sd.hand.includes(hb), census: cs } };
  }],

  ['职业操守：黑情报致第二名玩家死亡 → 杀手单独获胜', async () => {
    G.players.forEach(p => p.human = false);
    const sd = G.players[1], t = G.players[2];
    sd.faction = "JY"; sd.mission = MISSION_DEFS.assassin;
    t.faction = "JQ"; t.mission = null;
    G.deathCount = 1;   // 已有一名玩家死亡
    const bs = [G.deck.pop(), G.deck.pop()];
    bs.forEach(c => { c.color = "black"; c.color2 = undefined; });
    t.intel.push(...bs);
    const c = G.deck.pop(); c.color = "black"; c.color2 = undefined;
    G.transit = { id: 89, card: c, sender: sd.i, mode: "zhida", dir: null, faceUp: false,
                  pos: t.i, knownTo: new Set([sd.i]), locked: new Set(), banned: new Set(),
                  offers: 0, tamperedBy: null };
    await gainIntel(t, c);
    G.transit = null;
    return { ok: G.over && G.winners.length === 1 && G.winners[0] === sd && G.winText.includes("职业操守"),
             got: { over: G.over, text: G.winText } };
  }],

  ['斩草除根：潜伏全灭 → 酱油任务达成获胜', async () => {
    G.players.forEach(p => { p.human = false; p.faction = "JQ"; p.mission = null; });
    const victim = G.players[1], j = G.players[3];
    victim.faction = "QF";
    j.faction = "JY"; j.mission = MISSION_DEFS.qfwipe;
    const bs = [G.deck.pop(), G.deck.pop(), G.deck.pop()];
    bs.forEach(c => { c.color = "black"; c.color2 = undefined; });
    victim.intel.push(...bs);
    await killPlayer(victim);
    return { ok: G.over && G.winners.includes(j) && G.winText.includes("军情处获胜"),
             got: { over: G.over, text: G.winText } };
  }],

  ['红色档案：酱油集齐三红 → 单独获胜', async () => {
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.faction = "JY"; p.mission = MISSION_DEFS.red3;
    const rs = [G.deck.pop(), G.deck.pop(), G.deck.pop()];
    rs.forEach(c => { c.color = "red"; c.color2 = undefined; });
    p.intel.push(rs[0], rs[1]);
    await gainIntel(p, rs[2]);
    return { ok: G.over && G.winners.length === 1 && G.winText.includes("红色档案"),
             got: { over: G.over, text: G.winText } };
  }],

  ['义气+红袖招连锁：柒佰获胜带女性共胜，红袖招酱油跟进', async () => {
    G.players.forEach(p => { p.human = false; p.faction = "JQ"; p.mission = null; });
    const w = G.players[1], fem = G.players[2], j = G.players[3];
    w.char = OFFICIAL_CHARS.find(c => c.key === "o_qibai");
    w.faction = "QF";
    fem.char = OFFICIAL_CHARS.find(c => c.key === "o_shanling");
    j.faction = "JY"; j.mission = MISSION_DEFS.femalewin;
    endGame([w], "测试胜利");
    return { ok: G.winners.includes(w) && G.winners.includes(fem) && G.winners.includes(j),
             got: { winners: G.winners.map(x => x.name) } };
  }],

  ['牌库合并：qzdeck 弃用，千智人物一律用完整黑名單牌库（双色+真伪莫辨+转移）', async () => {
    newGame(6, null, { qzdeck: true, roster: "qianzhi" });
    G.players.forEach(p => p.human = false);
    const all = [...G.deck, ...G.players.flatMap(p => p.hand)];
    const cnt = f => all.filter(f).length;
    const cs = cardCensus();
    return { ok: G.totalCards === 81 && G.exp.qzdeck === false
              && cnt(c => c.color2) === 6 && cnt(c => c.fn === "zhenwei") === 3
              && cnt(c => c.fn === "zhuanyi") === 4 && cnt(c => c.fn === "lijian") === 0
              && cs.total === 81 && cs.dup === 0,
             got: { qzdeck: G.exp.qzdeck, dual: cnt(c=>c.color2), zhenwei: cnt(c=>c.fn==="zhenwei") } };
  }],

  ['公开文本：酱油收下不摸牌并公开身份；非酱油摸一张并公开排除酱油', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    ["QF","QF","JQ","JQ","JY","JY"].forEach((f,i)=>{ G.players[i].faction=f; G.players[i].mission=f==="JY"?MISSION_DEFS.collect3:null; G.players[i].revealed=false; G.players[i].know={}; });
    const sender = G.players[0], obs = G.players[1], jy = G.players[4], qf = G.players[3];
    const g1 = G.deck.pop(); g1.fn = "gongkai"; g1.color = "red"; g1.color2 = undefined;
    const jh = jy.hand.length;
    G.transit = { id: 70, card: g1, sender: sender.i, mode: "zhida", dir: null, faceUp: false,
                  pos: jy.i, knownTo: new Set([sender.i]), locked: new Set(), banned: new Set(), offers: 0, tamperedBy: null };
    await gainIntel(jy, g1); G.transit = null;
    const g2 = G.deck.pop(); g2.fn = "gongkai"; g2.color = "blue"; g2.color2 = undefined;
    const qh = qf.hand.length;
    G.transit = { id: 71, card: g2, sender: sender.i, mode: "zhida", dir: null, faceUp: false,
                  pos: qf.i, knownTo: new Set([sender.i]), locked: new Set(), banned: new Set(), offers: 0, tamperedBy: null };
    await gainIntel(qf, g2); G.transit = null;
    const cs = cardCensus();
    return { ok: jy.hand.length === jh && viewOf(obs)[jy.i].hint === "JY"
              && qf.hand.length === qh + 1 && viewOf(obs)[qf.i].excluded.includes("JY")
              && cs.total === cs.expect && cs.dup === 0,
             got: { jyDrew: jy.hand.length - jh, jyPublic: viewOf(obs)[jy.i].hint,
                    qfDrew: qf.hand.length - qh, qfPublic: viewOf(obs)[qf.i].excluded } };
  }],

  ['博弈：牌库顶一张放到目标面前成情报，致死算亲手（职业操守达成）', async () => {
    newGame(6);
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const p = G.players[1], t = G.players[2];
    p.faction = "JY"; p.mission = MISSION_DEFS.assassin;
    t.faction = "JQ"; t.mission = null;
    G.deathCount = 1;
    const b2 = [G.deck.pop(), G.deck.pop()];
    b2.forEach(c => { c.color = "black"; c.color2 = undefined; });
    t.intel.push(...b2);
    const by = G.deck.pop(); by.fn = "boyi"; by.color = "red"; by.color2 = undefined; p.hand.push(by);
    const top = G.deck[G.deck.length - 1]; top.color = "black"; top.color2 = undefined;
    aiWantCounter = () => false;
    const _r = Math.random; Math.random = () => 0.3;
    await resolveBoyi(p, by, t);
    Math.random = _r;
    const cs = cardCensus();
    return { ok: !t.alive && G.over && G.winners.length === 1 && G.winners[0] === p
              && G.winText.includes("职业操守") && cs.total === cs.expect && cs.dup === 0,
             got: { tAlive: t.alive, text: G.winText, census: cs } };
  }],

  ['权衡：弃光手牌重抽等量，守恒', async () => {
    newGame(6);
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const p = G.players[1];
    const qh = G.deck.pop(); qh.fn = "quanheng"; qh.color = "red"; qh.color2 = undefined; p.hand.push(qh);
    aiWantCounter = () => false;
    const before = p.hand.length;   // 含 quanheng
    await resolveQuanheng(p, qh);
    const cs = cardCensus();
    // 打出 quanheng(-1) 后弃 before-1 张、重抽 before-1 张 → 手牌回到 before-1
    return { ok: p.hand.length === before - 1 && !p.hand.includes(qh)
              && cs.total === cs.expect && cs.dup === 0,
             got: { hand: p.hand.length, expect: before - 1, census: cs } };
  }],

  ['增援：有黑情报时抽"黑数+1"张，守恒', async () => {
    newGame(6);
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const p = G.players[1];
    p.faction = "QF"; p.mission = null;
    const bs = [G.deck.pop(), G.deck.pop()];
    bs.forEach(c => { c.color = "black"; c.color2 = undefined; });
    p.intel.push(...bs);   // 2 张黑
    const zy = G.deck.pop(); zy.fn = "zengyuan"; zy.color = "red"; zy.color2 = undefined; p.hand.push(zy);
    aiWantCounter = () => false;
    const before = p.hand.length;
    await resolveZengyuan(p, zy);
    const cs = cardCensus();
    // -增援牌 +3（黑2+1） = 净 +2
    return { ok: p.hand.length === before - 1 + 3 && cs.total === cs.expect && cs.dup === 0,
             got: { hand: p.hand.length, expect: before + 2, census: cs } };
  }],

  ['调包（卡面·替换）：调包牌面朝上换入，原情报收入调包者手牌', async () => {
    newGame(6);
    G.players.forEach(p => p.human = false);
    const q = G.players[2];
    const black = G.deck.pop(); black.color = "black"; black.color2 = undefined;
    const db = G.deck.pop(); db.fn = "diaobao"; db.color = "blue"; db.color2 = undefined;
    q.hand.push(db);
    const handBefore = q.hand.length;
    G.transit = { id: 99, card: black, sender: 1, mode: "midian", dir: "cw", faceUp: false,
                  pos: q.i, knownTo: new Set([1]), locked: new Set(), banned: new Set(),
                  offers: 0, tamperedBy: null };
    await doDiaobao(q, db);
    const tr = G.transit;
    // 调包牌换入传递并公开；原黑情报进调包者手牌（不进弃牌堆）；手牌数不变（-调包牌 +原情报）
    const ok = tr.card === db && tr.faceUp === true && tr.tamperedBy === q.i
      && q.hand.includes(black) && !q.hand.includes(db) && !G.discard.includes(black)
      && q.hand.length === handBefore;
    G.discard.push(tr.card); G.transit = null;
    return { ok, got: { faceUp: tr.faceUp, origInHand: q.hand.includes(black),
                        origInDiscard: G.discard.includes(black), handDelta: q.hand.length - handBefore } };
  }],

  ['千智人物池：维基表格25人（潜伏10+公开15），任务/明暗置对表', async () => {
    newGame(6, null, { roster: "qianzhi" });
    const cov = QIANZHI_CHARS.filter(c => c.covert), open = QIANZHI_CHARS.filter(c => !c.covert);
    const by = n => QIANZHI_CHARS.find(c => c.name === n);
    const ok = QIANZHI_CHARS.length === 25 && cov.length === 10 && open.length === 15
      && ["浮萍","六姐","小马哥","怪盗九九","贝雷帽"].every(n => by(n))
      && !QIANZHI_CHARS.some(c => c.name === "硬汉")
      && by("老鬼").missionKey === "redhand" && by("老鬼").covert
      && by("黄雀").covert && !by("刀锋").covert && !by("大美女").covert && !by("蝮蛇").covert
      && by("钢铁特工K").missionKey === "shipo4" && by("蝮蛇").missionKey === "snake"
      && by("小白").gender === "B"
      && G.players.every(p => QIANZHI_CHARS.includes(p.char))
      && G.players.filter(p => p.faction === "JY").every(p => { const w = p.char.missionKey || CHAR_MISSION[p.char.key]; return p.mission.key === w || ["snake","firstwipe"].includes(w); });
    return { ok, got: { n: QIANZHI_CHARS.length, cov: cov.length, open: open.length } };
  }],

  ['留有后手：老鬼死亡时手握三张红 → 反而单独获胜', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const p = G.players[1];
    p.faction = "JY"; p.mission = MISSION_DEFS.redhand;
    p.hand.forEach(c => { c.color = "red"; c.color2 = undefined; });
    while (p.hand.length < 3) { const c = G.deck.pop(); c.color = "red"; c.color2 = undefined; p.hand.push(c); }
    const bs = [G.deck.pop(), G.deck.pop(), G.deck.pop()];
    bs.forEach(c => { c.color = "black"; c.color2 = undefined; });
    p.intel.push(...bs);
    await killPlayer(p, null);
    return { ok: G.over && G.winners.length === 1 && G.winners[0] === p && G.winText.includes("留有后手"),
             got: { over: G.over, text: G.winText } };
  }],

  ['两败俱伤：潜伏与军情各死一人 → 酱油获胜', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    ["QF","QF","JQ","JQ","JY","JY"].forEach((f, i) => { G.players[i].faction = f; G.players[i].mission = null; });
    const j = G.players[4];
    j.faction = "JY"; j.mission = MISSION_DEFS.oneEach;
    G.players[5].mission = MISSION_DEFS.collect3;
    const kill = async v => {
      const bs = [G.deck.pop(), G.deck.pop(), G.deck.pop()];
      bs.forEach(c => { c.color = "black"; c.color2 = undefined; });
      v.intel.push(...bs);
      await killPlayer(v, null);
    };
    await kill(G.players[0]);   // 一名潜伏死亡
    const midOver = G.over;
    await kill(G.players[2]);   // 一名军情死亡 → 两败俱伤
    return { ok: !midOver && G.over && G.winners.includes(j) && G.winText.includes("两败俱伤"),
             got: { midOver, over: G.over, text: G.winText } };
  }],

  ['后发制人：无人死亡时的胜利宣告被蝮蛇截胡', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const w = G.players[1], snake = G.players[2];
    w.faction = "QF"; w.mission = null;
    snake.faction = "JY"; snake.mission = MISSION_DEFS.snake;
    const rs = [G.deck.pop(), G.deck.pop(), G.deck.pop()];
    rs.forEach(c => { c.color = "red"; c.color2 = undefined; });
    w.intel.push(rs[0], rs[1]);
    await gainIntel(w, rs[2]);   // 潜伏凑三红宣告胜利，但无人死亡
    return { ok: G.over && G.winners.length === 1 && G.winners[0] === snake && G.winText.includes("后发制人"),
             got: { over: G.over, text: G.winText, winners: G.winners.map(x => x.name) } };
  }],

  ['闪灵狙击：翻开烧毁他人至多三张任意情报（含真情报）', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const p = G.players[1], t = G.players[2];
    p.char = QIANZHI_CHARS.find(c => c.key === "qz_shanling");
    p.charRevealed = false;
    const cs3 = [G.deck.pop(), G.deck.pop(), G.deck.pop()];
    cs3[0].color = "red"; cs3[1].color = "blue"; cs3[2].color = "black";
    cs3.forEach(c => c.color2 = undefined);
    t.intel.push(...cs3);
    await skillJuji(p, t, cs3.slice());
    const cs = cardCensus();
    return { ok: t.intel.length === 0 && p.charRevealed && cs.total === cs.expect && cs.dup === 0,
             got: { left: t.intel.length, census: cs } };
  }],

  ['灭口：亲手致死无真情报的玩家 → 击杀者单独获胜', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const killer = G.players[1], t = G.players[2];
    killer.faction = "JY"; killer.mission = MISSION_DEFS.killclean;
    t.faction = "JQ"; t.mission = null;
    const b2 = [G.deck.pop(), G.deck.pop()];
    b2.forEach(c => { c.color = "black"; c.color2 = undefined; });
    t.intel.push(...b2);
    const b3 = G.deck.pop(); b3.color = "black"; b3.color2 = undefined;
    await forceIntel(t, b3, killer.i);
    return { ok: !t.alive && G.over && G.winners.length === 1 && G.winners[0] === killer && G.winText.includes("灭口"),
             got: { tAlive: t.alive, text: G.winText } };
  }],

  ['左右逢源：摸牌凑齐三红三蓝手牌 → 单独获胜', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const p = G.players[1];
    p.faction = "JY"; p.mission = MISSION_DEFS.handrb33;
    p.hand.length = 0;
    for (let i = 0; i < 3; i++) { const c = G.deck.pop(); c.color = "red"; c.color2 = undefined; p.hand.push(c); }
    for (let i = 0; i < 2; i++) { const c = G.deck.pop(); c.color = "blue"; c.color2 = undefined; p.hand.push(c); }
    const top = G.deck[G.deck.length - 1]; top.color = "blue"; top.color2 = undefined;
    drawCards(p, 1);
    return { ok: G.over && G.winners.length === 1 && G.winners[0] === p && G.winText.includes("左右逢源"),
             got: { over: G.over, text: G.winText } };
  }],

  ['包罗万象：第六张情报到手 → 单独获胜', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    G.deathCount = 1;   // 禁用蝮蛇·后发制人（无人死亡）的截胡
    const p = G.players[1];
    p.faction = "JY"; p.mission = MISSION_DEFS.six;
    for (let i = 0; i < 5; i++) { const c = G.deck.pop(); c.color = i % 2 ? "red" : "blue"; c.color2 = undefined; p.intel.push(c); }
    const six = G.deck.pop(); six.color = "red"; six.color2 = undefined;
    await gainIntel(p, six);
    return { ok: G.over && G.winners.length === 1 && G.winText.includes("包罗万象"),
             got: { over: G.over, text: G.winText } };
  }],

  ['转移：情报被转移到指定玩家面前，其接收', async () => {
    G.players.forEach(p => p.human = false);
    aiWantIntercept = () => false; aiWantCounter = () => false; aiAnnounce = () => null;
    const sender = G.players[0], mover = G.players[1], dest = G.players[3];
    const zy = G.deck.pop(); zy.fn = "zhuanyi"; zy.color = "red"; zy.color2 = undefined;
    mover.hand.push(zy);
    let calls = 0;
    aiOffer = async (q) => {
      calls++;
      if (q === mover) {
        discardFromHand(q, zy);   // 弃掉本测试注入的这张转移牌（牌库现含转移，不能按 fn 查找）
        return "transfer:" + dest.i;
      }
      return q === dest ? "accept" : "pass";
    };
    const c = G.deck.pop();
    G.transit = { id: 88, card: c, sender: 0, mode: "midian", dir: "cw", faceUp: false,
                  pos: 0, knownTo: new Set([0]), locked: new Set(), banned: new Set(),
                  offers: 0, tamperedBy: null };
    const receiver = await passSequence(sender);
    G.discard.push(c); G.transit = null;
    return { ok: receiver === dest && !mover.hand.includes(zy),
             got: { receiver: receiver && receiver.i, spent: !mover.hand.includes(zy) } };
  }],

  ['离间：AI 把指向自己的锁定改到已亮身份的敌人头上', async () => {
    G.players.forEach(p => { p.human = false; p.hand = p.hand.filter(c => c.fn !== "shipo" ? true : (G.discard.push(c), false)); });
    const user = G.players[1], t = G.players[2], enemy = G.players[3];
    t.faction = "QF";
    enemy.faction = "JQ"; enemy.revealed = true;
    const lj = G.deck.pop(); lj.fn = "lijian"; lj.color = "blue"; lj.color2 = undefined;
    t.hand.push(lj);
    const sd = G.deck.pop(); sd.fn = "suoding"; sd.color = "red"; sd.color2 = undefined;
    user.hand.push(sd);
    const _r = Math.random; Math.random = () => 0.5;
    await resolveSuoding(user, sd, t);
    Math.random = _r;
    return { ok: G.pendingLocks.includes(enemy.i) && !G.pendingLocks.includes(t.i) && !t.hand.includes(lj),
             got: { locks: G.pendingLocks } };
  }],

  ['小白败露：第六张情报到手 → 出局（非三黑死亡文案）', async () => {
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.char = QIANZHI_CHARS.find(c => c.key === "q_xiaobai");
    p.faction = "JQ"; p.mission = null;
    const cs5 = [];
    for (let i = 0; i < 5; i++) { const c = G.deck.pop(); c.color = i % 2 ? "red" : "blue"; c.color2 = undefined; cs5.push(c); }
    p.intel.push(...cs5);
    const six = G.deck.pop(); six.color = "red"; six.color2 = undefined;
    await gainIntel(p, six);
    const cs = cardCensus();
    return { ok: !p.alive && !G.over && p.intel.length === 0 && cs.total === cs.expect && cs.dup === 0,
             got: { alive: p.alive, over: G.over, census: cs } };
  }],

  ['钢铁特工K警觉：试探被无效（不可被识破），不留认知', async () => {
    G.players.forEach(p => { p.human = false; p.hand = p.hand.filter(c => c.fn !== "shipo" ? true : (G.discard.push(c), false)); });
    const prober = G.players[1], k = G.players[2];
    k.char = QIANZHI_CHARS.find(c => c.key === "q_gangtie");
    k.charRevealed = false; k.faction = "QF";
    const st = G.deck.pop(); st.fn = "shitan"; st.probe = "A"; st.color = "red"; st.color2 = undefined;
    prober.hand.push(st);
    const _r = Math.random; Math.random = () => 0.3;
    await resolveShitan(prober, st, k);
    Math.random = _r;
    const pv = viewOf(prober)[k.i];
    return { ok: k.charRevealed && !pv.hint && pv.excluded.length === 0,
             got: { revealed: k.charRevealed, proberKnows: pv } };
  }],

  ['戴笠布网：真情报送达后补塞黑牌 → 击杀', async () => {
    G.players.forEach(p => p.human = false);
    const sd = G.players[1], t = G.players[2];
    sd.char = QIANZHI_CHARS.find(c => c.key === "q_daili");
    sd.faction = "QF"; sd.mission = null;
    t.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" };
    t.faction = "JQ"; t.mission = null; t.revealed = true;
    sd.hand.forEach(c => { c.color = "red"; c.color2 = undefined; });
    const hb = G.deck.pop(); hb.color = "black"; hb.color2 = undefined; sd.hand.push(hb);
    const b2 = [G.deck.pop(), G.deck.pop()];
    b2.forEach(c => { c.color = "black"; c.color2 = undefined; });
    t.intel.push(...b2);
    const c = G.deck.pop(); c.color = "blue"; c.color2 = undefined;
    G.transit = { id: 87, card: c, sender: sd.i, mode: "zhida", dir: null, faceUp: false,
                  pos: t.i, knownTo: new Set([sd.i]), locked: new Set(), banned: new Set(),
                  offers: 0, tamperedBy: null };
    const _r = Math.random; Math.random = () => 0.3;
    await gainIntel(t, c);
    Math.random = _r;
    G.transit = null;
    const cs = cardCensus();
    return { ok: !t.alive && !sd.hand.includes(hb) && cs.total === cs.expect && cs.dup === 0,
             got: { tAlive: t.alive, netUsed: !sd.hand.includes(hb), census: cs } };
  }],

  ['福尔摩斯细节：获得黑情报时追加一张手牌情报', async () => {
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.char = QIANZHI_CHARS.find(c => c.key === "q_fuermosi");
    p.faction = "QF"; p.mission = null;
    p.hand.forEach(c => { c.color = "red"; c.color2 = undefined; });
    const r1 = G.deck.pop(); r1.color = "red"; r1.color2 = undefined;
    p.intel.push(r1);   // 已有红色进度 → AI 触发细节
    const b1 = G.deck.pop(); b1.color = "black"; b1.color2 = undefined;
    await gainIntel(p, b1);
    const cs = cardCensus();
    return { ok: p.alive && countColor(p, "black") === 1 && p.intel.length === 3
              && p.onceUsed.toutian === true && countColor(p, "red") === 2
              && cs.total === cs.expect && cs.dup === 0,
             got: { blacks: countColor(p, "black"), reds: countColor(p, "red"), intel: p.intel.length, census: cs } };
  }],

  ['钢铁特工掩护：公开状态下获得情报自动盖伏', async () => {
    G.players.forEach(p => p.human = false);
    const p = G.players[1];
    p.char = QIANZHI_CHARS.find(c => c.key === "q_gangtie");
    p.charRevealed = true; p.faction = "QF"; p.mission = null;
    const r = G.deck.pop(); r.color = "red"; r.color2 = undefined;
    await gainIntel(p, r);
    return { ok: p.charRevealed === false && countColor(p, "red") === 1,
             got: { covered: !p.charRevealed } };
  }],

  ['临危受命：香水接过死者身份，死者身份成谜不计入两败俱伤', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    ["QF","JY","QF","JY","JQ","JQ"].forEach((f, i) => { G.players[i].faction = f; G.players[i].mission = f==="JY"? MISSION_DEFS.collect3 : null; });
    const xs = G.players[1], victim = G.players[2], j = G.players[3];
    xs.char = QIANZHI_CHARS.find(c => c.key === "q_xiangshui");
    xs.mission = MISSION_DEFS.solealive;
    j.mission = MISSION_DEFS.oneEach;
    const bs = [G.deck.pop(), G.deck.pop(), G.deck.pop()];
    bs.forEach(c => { c.color = "black"; c.color2 = undefined; });
    victim.intel.push(...bs);
    const _r = Math.random; Math.random = () => 0.3;
    await killPlayer(victim, null);
    Math.random = _r;
    // 死一名军情：即便随后军情也死一人，QF 之死不计入两败俱伤
    const v2 = G.players[4];
    const bs2 = [G.deck.pop(), G.deck.pop(), G.deck.pop()];
    bs2.forEach(c => { c.color = "black"; c.color2 = undefined; });
    v2.intel.push(...bs2);
    await killPlayer(v2, null);
    return { ok: xs.faction === "QF" && victim.noIdentity === true && !victim.revealed && !G.over,
             got: { xsFaction: xs.faction, noId: victim.noIdentity, over: G.over, text: G.winText } };
  }],

  ['贝雷帽偷天：黑直达被收下后取走受牌者一张情报入手', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const bl = G.players[1], t = G.players[2];
    bl.char = QIANZHI_CHARS.find(c => c.key === "qz_beleimao");
    bl.faction = "QF"; bl.mission = null;
    t.faction = "JQ"; t.mission = null; t.revealed = true;
    const r = G.deck.pop(); r.color = "red"; r.color2 = undefined;
    t.intel.push(r);
    const c = G.deck.pop(); c.color = "black"; c.color2 = undefined;
    const bh = bl.hand.length;
    G.transit = { id: 86, card: c, sender: bl.i, mode: "zhida", dir: null, faceUp: false,
                  pos: t.i, knownTo: new Set([bl.i]), locked: new Set(), banned: new Set(),
                  offers: 0, tamperedBy: null };
    await gainIntel(t, c);
    G.transit = null;
    const cs = cardCensus();
    return { ok: bl.hand.includes(r) && !t.intel.includes(r) && cs.total === cs.expect && cs.dup === 0,
             got: { stole: bl.hand.includes(r), census: cs } };
  }],

  ['小白收买：四张手牌换走他人一张情报', async () => {
    G.players.forEach(p => p.human = false);
    const p = G.players[1], t = G.players[2];
    p.char = QIANZHI_CHARS.find(c => c.key === "q_xiaobai");
    p.faction = "QF"; p.mission = null;
    while (p.hand.length < 5) p.hand.push(G.deck.pop());
    const r = G.deck.pop(); r.color = "red"; r.color2 = undefined;
    t.intel.push(r);
    const ph = p.hand.length, th = t.hand.length;
    await skillShoumai(p, t, r);
    const cs = cardCensus();
    return { ok: p.intel.includes(r) && !t.intel.includes(r)
              && p.hand.length === ph - 4 && t.hand.length === th + 4
              && cs.total === cs.expect && cs.dup === 0,
             got: { got: p.intel.includes(r), pHand: p.hand.length - ph, tHand: t.hand.length - th, census: cs } };
  }],

  ['试探D命中：试探者私有排除酱油', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    const prober = G.players[1], t = G.players[2];
    t.faction = "QF";
    await probeOne(prober, { probe: "D" }, t);
    return { ok: prober.know[t.i].excluded.includes("JY") && t.hint == null,
             got: { excluded: prober.know[t.i].excluded } };
  }],

  ['真伪莫辨（官方）：洗匀后每名存活玩家随机抽一张，守恒', async () => {
    G.players.forEach(p => { p.human = false; p.hand = p.hand.filter(c => c.fn !== "shipo" ? true : (G.discard.push(c), false)); });
    const p = G.players[1];
    p.faction = "QF"; p.mission = null;
    const zw = G.deck.pop(); zw.fn = "zhenwei"; zw.color = "red"; zw.color2 = undefined;
    p.hand.push(zw);
    const n = alivePlayers().length;
    for (let i = 0; i < n; i++) {
      const c = G.deck[G.deck.length - 1 - i];
      c.color = i === 0 ? "red" : "blue"; c.color2 = undefined;
    }
    const before = G.players.map(q => q.intel.length);
    const deckBefore = G.deck.length;
    await resolveZhenwei(p, zw);
    const cs = cardCensus();
    const totalGained = G.players.reduce((a, q, i) => a + (q.intel.length - before[i]), 0);
    const allGot = G.players.every((q, i) => !q.alive || q.intel.length - before[i] >= 1 || G.over);
    // 每名存活玩家随机抽一张：共发出 n 张（守恒），非"使用者必得红"
    return { ok: allGot && totalGained === n && G.deck.length === deckBefore - n
              && cs.total === cs.expect && cs.dup === 0,
             got: { totalGained, alive: n, allGot, census: cs } };
  }],

  ['阵营全灭：唯一潜伏出局 → 军情处全体获胜', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    ["QF","JQ","JQ","JQ","JQ","JY"].forEach((f, i) => { G.players[i].faction = f; G.players[i].mission = f==="JY"? MISSION_DEFS.collect3 : null; });
    const victim = G.players[0]; victim.human = false;
    const bs = [G.deck.pop(), G.deck.pop(), G.deck.pop()];
    bs.forEach(c => { c.color = "black"; c.color2 = undefined; });
    victim.intel.push(...bs);
    await killPlayer(victim);
    const jqAllWin = G.players.filter(x => x.faction === "JQ").every(x => G.winners.includes(x));
    return { ok: G.over && jqAllWin && G.winText.includes("军情处获胜"),
             got: { over: G.over, text: G.winText } };
  }],

  ['独存酱油：只剩一名打酱油存活 → 单独获胜', async () => {
    G.players.forEach(q => { q.human = false; q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; });
    ["QF","JQ","QF","JQ","JY","JY"].forEach((f, i) => { G.players[i].faction = f; G.players[i].mission = f==="JY"? MISSION_DEFS.collect3 : null; });
    [1, 2, 3, 4].forEach(i => { const q = G.players[i]; q.alive = false; q.revealed = true; G.discard.push(...q.hand.splice(0), ...q.intel.splice(0)); });
    const victim = G.players[0], lone = G.players[5];
    const bs = [G.deck.pop(), G.deck.pop(), G.deck.pop()];
    bs.forEach(c => { c.color = "black"; c.color2 = undefined; });
    victim.intel.push(...bs);
    await killPlayer(victim);
    return { ok: G.over && G.winners.length === 1 && G.winners[0] === lone && G.winText.includes("幸存者"),
             got: { over: G.over, text: G.winText } };
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
      r = await page.evaluate(`(async () => {
        // 猴补丁：任何 newGame（含测试内部重开）后，中和会全局截胡的 snake/firstwipe 任务，
        // 避免隔离单测里蝮蛇·后发制人 / 小白·明哲保身抢走胜利（各测试自设所需任务不受影响）
        if(!window.__ngPatched){
          window.__ngPatched = true;
          const _ng = newGame;
          window.newGame = function(...a){
            _ng(...a);
            G.players.forEach(q => { if(q.mission && (q.mission.key==="snake"||q.mission.key==="firstwipe")) q.mission = MISSION_DEFS.collect3; });
          };
        }
        newGame(6);
        G.players.forEach(q => { q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; q.charRevealed = true; });
        // 钉一个确定的阵营布局，令 viewOf 计数推理与 AI 信念在各测试间可复现（测试可自行覆盖）
        ["QF","QF","JQ","JQ","JY","JY"].forEach((f,i)=>{ G.players[i].faction=f; G.players[i].mission = f==="JY"?MISSION_DEFS.collect3:null; });
        return await (${fn.toString()})();
      })()`);
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
