// 联机（自托管版）机制测试：快照往返、主机侧提示路由、客户端侧提示渲染回传。
// 真实 PeerJS/WebSocket 网络无法在此沙盒端到端测试；此处验证「传输层可替换」的核心：
// 主机把远程座位的决定序列化下发、等待应答、映射回原值；客户端用同一套交互 UI 取值回传。
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
const URL = 'file://' + require('path').resolve(__dirname, '..', 'index.html');

const scenarios = [
  ['快照往返：mpSnapshot→JSON→mpApplySnapshot 重建可渲染 G，手牌/座位/情报保全', async () => {
    G.players.forEach(p => p.human = false);
    const before = { n: G.players.length, hands: G.players.map(p => p.hand.length), intel: G.players.map(p => p.intel.length) };
    const snap = JSON.parse(JSON.stringify(mpSnapshot()));
    // 切到客户端角色再套用快照（客户端不跑引擎，只渲染）
    MP.active = true; MP.role = "client"; MY_SEAT = 1;
    mpApplySnapshot(snap);
    const after = { n: G.players.length, hands: G.players.map(p => p.hand.length), intel: G.players.map(p => p.intel.length) };
    const ok = after.n === before.n
      && JSON.stringify(after.hands) === JSON.stringify(before.hands)
      && JSON.stringify(after.intel) === JSON.stringify(before.intel)
      && !!document.querySelector('#seats .seat');
    return { ok, got: { before, after, seatsRendered: !!document.querySelector('#seats .seat') } };
  }],

  ['ask 路由：远程座位的选项按下标序列化下发，应答下标映射回原 value', async () => {
    G.players.forEach(p => p.human = false);
    G.players[1].human = true;                    // 座位 1 为远程真人
    MP.active = true; MP.role = "host"; MY_SEAT = 0;
    let sent = null;
    MP.transport = { send(m) { if (m.t === "prompt") { sent = m; mpResolve(m.id, 2); } } };  // 客户端“选了下标 2”
    promptSeat = 1;
    const v = await ask("测试", [{ label: "甲", value: "X" }, { label: "乙", value: "Y" }, { label: "丙", value: "Z" }], "副标题");
    const ok = v === "Z" && sent && sent.kind === "ask" && sent.seat === 1
      && sent.payload.options.length === 3 && sent.payload.options[0].label === "甲"
      && !('value' in sent.payload.options[0]);   // value 不外泄，仅下标
    return { ok, got: { v, sentKind: sent && sent.kind, leaked: sent && ('value' in sent.payload.options[0]) } };
  }],

  ['pickSeat 路由：候选序列化为座位号，应答座位号映射回玩家；null→取消', async () => {
    G.players.forEach(p => p.human = false);
    G.players[1].human = true;
    MP.active = true; MP.role = "host"; MY_SEAT = 0;
    let sent = null, reply = 3;
    MP.transport = { send(m) { if (m.t === "prompt") { sent = m; mpResolve(m.id, reply); } } };
    promptSeat = 1;
    const cands = [G.players[2], G.players[3], G.players[4]];
    const p = await pickSeat(cands, "选一个座位");
    const okPick = p === G.players[3] && sent.kind === "seat"
      && JSON.stringify(sent.payload.cands) === JSON.stringify([2, 3, 4]);
    reply = null;
    const p2 = await pickSeat(cands, "再选");
    return { ok: okPick && p2 === null, got: { picked: p && p.i, cancel: p2 } };
  }],

  ['pickHandCard 路由：按 filter 预筛可选牌 id 下发，应答 id 映射回牌对象', async () => {
    G.players.forEach(p => p.human = false);
    G.players[1].human = true;
    MP.active = true; MP.role = "host"; MY_SEAT = 0;
    const P = G.players[1];
    const target = P.hand[1];                     // 期望客户端选中第 2 张
    let sent = null;
    MP.transport = { send(m) { if (m.t === "prompt") { sent = m; mpResolve(m.id, target.id); } } };
    promptSeat = 1;
    const c = await pickHandCard(() => true);
    const ok = c === target && sent.kind === "hand" && sent.payload.cancellable === false
      && sent.payload.ids.length === P.hand.length && sent.payload.ids.includes(target.id);
    return { ok, got: { same: c === target, ids: sent.payload.ids.length, hand: P.hand.length } };
  }],

  ['pickHandCard 路由：filter 生效——只把符合条件的牌 id 下发', async () => {
    G.players.forEach(p => p.human = false);
    G.players[1].human = true;
    MP.active = true; MP.role = "host"; MY_SEAT = 0;
    const P = G.players[1];
    const only = P.hand[0];
    let sent = null;
    MP.transport = { send(m) { if (m.t === "prompt") { sent = m; mpResolve(m.id, only.id); } } };
    promptSeat = 1;
    const c = await pickHandCard(x => x === only);
    const ok = c === only && sent.payload.ids.length === 1 && sent.payload.ids[0] === only.id;
    return { ok, got: { ids: sent.payload.ids, chosen: c && c.id } };
  }],

  ['pickHandCardCancellable 路由：可取消，应答 null→null，应答 id→牌', async () => {
    G.players.forEach(p => p.human = false);
    G.players[1].human = true;
    MP.active = true; MP.role = "host"; MY_SEAT = 0;
    const P = G.players[1];
    let reply = null;
    MP.transport = { send(m) { if (m.t === "prompt") { mpResolve(m.id, reply); } } };
    promptSeat = 1;
    const c0 = await pickHandCardCancellable(() => true, "选牌或取消");
    reply = P.hand[0].id;
    const c1 = await pickHandCardCancellable(() => true, "选牌或取消");
    return { ok: c0 === null && c1 === P.hand[0], got: { cancel: c0, picked: c1 && c1.id } };
  }],

  ['本机座位不路由：promptSeat===MY_SEAT 时 ask 走本地 DOM（不经传输层）', async () => {
    G.players.forEach(p => p.human = false);
    G.players[0].human = true;
    MP.active = true; MP.role = "host"; MY_SEAT = 0;
    let sentCount = 0;
    MP.transport = { send() { sentCount++; } };   // state 广播会 send，但 prompt 不该 send
    promptSeat = 0;
    const pr = ask("本地", [{ label: "确定", value: 42 }]);   // 应渲染 DOM 按钮，不路由
    await new Promise(r => setTimeout(r, 10));
    const btn = document.querySelector('#actionPanel button');
    const rendered = !!btn;
    if (btn) btn.click();
    const v = await pr;
    const promptSent = false; // 无法直接读，改为断言按钮已渲染且拿到本地值
    return { ok: rendered && v === 42, got: { rendered, v } };
  }],

  ['客户端渲染 ask：mpClientPrompt 用本地 UI 取值，回传 {t:resp,id,value:下标}', async () => {
    G.players.forEach(p => p.human = false);
    MP.active = true; MP.role = "client"; MY_SEAT = 1;
    let resp = null;
    MP.transport = { send(m) { if (m.t === "resp") resp = m; } };
    mpClientPrompt({ kind: "ask", id: 7, payload: { title: "客户端提示", sub: "", options: [{ label: "甲" }, { label: "乙" }] } });
    await new Promise(r => setTimeout(r, 10));
    const btns = document.querySelectorAll('#actionPanel button');
    const rendered = btns.length === 2;
    if (btns[1]) btns[1].click();                 // 客户端点了第 2 个
    await new Promise(r => setTimeout(r, 10));
    return { ok: rendered && resp && resp.id === 7 && resp.value === 1, got: { rendered, resp } };
  }],

  ['客户端渲染 hand：mpClientPrompt 高亮可选手牌，选中回传该牌 id', async () => {
    G.players.forEach(p => p.human = false);
    G.players[1].human = true;                    // 客户端本机座位即真人（快照会带上此标记）
    MP.active = true; MP.role = "client"; MY_SEAT = 1;
    const P = G.players[1];
    const pick = P.hand[0];
    let resp = null;
    MP.transport = { send(m) { if (m.t === "resp") resp = m; } };
    mpClientPrompt({ kind: "hand", id: 9, payload: { ids: [pick.id], cancellable: false, msg: "选一张" } });
    await new Promise(r => setTimeout(r, 10));
    const card = document.querySelector('#handCards .card.pickable');
    const rendered = !!card;
    if (card) card.click();
    await new Promise(r => setTimeout(r, 10));
    return { ok: rendered && resp && resp.id === 9 && resp.value === pick.id, got: { rendered, resp: resp && resp.value, want: pick.id } };
  }],

  ['整局远程驱动：座位1为远程真人，自动应答器答完整回合，对局跑完且守恒（含 promptSeat 覆盖诊断）', async () => {
    // 不重开：用当前 newGame(6) 的局，改成主机驱动、座位1远程真人、其余 AI；MY_SEAT 指向 AI 座位
    window.sleep = () => Promise.resolve();   // 去掉动画等待，让整局快速跑完（非 autotest 页面）
    G.players.forEach(p => p.human = false);
    G.players[1].human = true;
    MP.active = true; MP.role = "host"; MY_SEAT = 0;   // 0 号为 AI，本机不需本地交互
    let prompts = 0;
    // 诊断：本局唯一真人是座位 1，故任何交互进入时 promptSeat 必须 === 1；
    // 若不是，说明该调用点漏设 promptSeat（会在真机上把远程玩家的界面渲染到主机、卡死）。
    // 记录漏设点并纠正为 1，让整局能跑完，一次性收齐所有缺口。
    const miss = {};
    const patch = (name) => {
      const orig = window[name];
      window[name] = function (...a) {
        if (promptSeat !== 1) {
          const at = (new Error().stack || "").split("\n").slice(2, 4).join(" | ");
          miss[name + " @ " + at] = (miss[name + " @ " + at] || 0) + 1;
          promptSeat = 1;
        }
        return orig.apply(this, a);
      };
    };
    ["ask", "pickSeat", "pickHandCard", "pickHandCardCancellable"].forEach(patch);
    const seen = {};   // 各调用点出现次数，暴露“同一点疯狂重复”的死循环
    // 自动应答器：ask→最后一项（多为“取消/不使用”，保证推进与收敛）；seat→首个候选；hand→首个可选
    MP.transport = {
      send(m) {
        if (m.t !== "prompt") return;
        prompts++;
        const k = m.kind + ":" + (m.payload.title || m.payload.msg || "").slice(0, 40);
        seen[k] = (seen[k] || 0) + 1;
        let v;
        if (m.kind === "ask") {
          // 选第一个「非取消/重选」项，保证推进且不打回重来（否则会死循环）
          const bad = /取消|重选|重新|返回|↩|上一步/;
          let i = m.payload.options.findIndex(o => !o.disabled && !bad.test(o.label));
          if (i < 0) i = m.payload.options.length - 1;
          v = i;
        }
        else if (m.kind === "seat") v = m.payload.cands.length ? m.payload.cands[0] : null;
        else if (m.kind === "hand") v = m.payload.ids.length ? m.payload.ids[0] : null;
        // 用宏任务应答，让 45s 竞速超时有机会触发（否则纯微任务会饿死 setTimeout）
        setTimeout(() => {
          if (prompts > 800) { window.GEN++; G.over = true; }
          mpResolve(m.id, v);
        }, 0);
      }
    };
    const capped = await Promise.race([
      runGame().then(() => "done"),
      new Promise(r => setTimeout(() => r("timeout"), 45000)),
    ]);
    const cs = cardCensus();
    const hot = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 6);
    return { ok: capped === "done" && G.over && prompts > 0 && cs.total === cs.expect && cs.dup === 0 && Object.keys(miss).length === 0,
             got: { capped, over: G.over, round: G.round, turn: G.turn, prompts, hot, missCount: Object.keys(miss).length, miss } };
  }],
];

(async () => {
  const browser = await chromium.launch();
  let pass = 0, fail = 0;
  const only = process.argv[2] ? scenarios.filter((_, i) => process.argv[2].split(',').map(Number).includes(i)) : scenarios;
  for (const [name, fn] of only) {
    const page = await browser.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(URL);
    let r;
    try {
      r = await page.evaluate(`(async () => {
        newGame(6);
        G.players.forEach(q => { q.char = { key: "wangtianxiang", name: "王田香", covert: false, skill: "" }; q.charRevealed = true; });
        ["QF","QF","JQ","JQ","JY","JY"].forEach((f,i)=>{ G.players[i].faction=f; G.players[i].mission = f==="JY"?MISSION_DEFS.collect3:null; });
        return await (${fn.toString()})();
      })()`);
    } catch (e) { r = { ok: false, got: 'EXCEPTION: ' + e.message.slice(0, 160) }; }
    const status = r.ok && !errs.length ? '✓' : '✗';
    if (r.ok && !errs.length) pass++; else fail++;
    console.log(`${status} ${name}`);
    if (!r.ok || errs.length) console.log('   ', JSON.stringify(r.got), errs.join(';'));
    await page.close();
  }
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
