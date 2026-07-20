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
    const b1 = G.deck.pop(), b2 = G.deck.pop(), b3 = G.deck.pop();
    b1.color = b2.color = b3.color = "black";
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
    r1.color = r2.color = r3.color = "red";
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
    b1.color = b2.color = b3.color = "black";
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
    b1.color = b2.color = b3.color = "black";
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
    cs[0].color = "red"; cs[1].color = "blue"; cs[2].color = "red"; cs[3].color = "blue";
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
    cs[0].color = "red"; cs[1].color = "blue"; cs[2].color = "black";
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
    G.players.forEach(p => { p.human = false; p.hand = p.hand.filter(c => c.fn !== "jiehuo"); });
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
  if (done && !ce && censusErrs.length === 0) { console.log('✓ 30 局全 AI：全部完成，牌数守恒 81/81，无重复'); pass++; }
  else { console.log('✗ 守恒/完成异常: done=' + done, JSON.stringify(ce), censusErrs.slice(0, 3)); fail++; }
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
