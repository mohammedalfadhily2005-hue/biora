'use strict';
/* BIORA — views & actions */
const App = {
  route: 'home', lastRoute: null, dirty: false, installEvt: null,
  ui: { reqTab: null, q: '', ftype: '', fstatus: '', ffrom: '', fto: '', staffTab: 'faculty', staffQ: '', staffSort: 'official', absDay: null, absMonth: null, letTab: 'in' },

  /* ───── boot / auth ───── */
  async start() {
    window.addEventListener('hashchange', () => { App.route = (location.hash || '#home').slice(1) || 'home'; if (!ST) return; if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches && !Modal.any()) document.startViewTransition(() => App.render()); else App.render(); });
    document.addEventListener('pointerdown', e => { const b = e.target.closest('.btn'); if (!b) return; const r = b.getBoundingClientRect(); b.style.setProperty('--rx', (e.clientX - r.left) / r.width * 100 + '%'); b.style.setProperty('--ry', (e.clientY - r.top) / r.height * 100 + '%'); });
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); App.installEvt = e; if (ST && App.route === 'profile') App.render(); });
    window.addEventListener('scroll', () => { const t = $('.top'); if (t) t.classList.toggle('scrolled', scrollY > 4); }, { passive: true });
    document.addEventListener('click', App.onClick);
    document.addEventListener('submit', e => { e.preventDefault(); const a = e.target.dataset.submit; if (a && App[a]) App[a](e.target); });
    document.addEventListener('input', App.onInput);
    document.addEventListener('change', App.onInput);
    App.route = (location.hash || '#home').slice(1) || 'home';
    if (token) { try { await api('state'); } catch { token = null; store.set('biora_token', null); } }
    App.render();
    setInterval(App.poll, 25000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) App.poll(); });
  },
  async poll() {
    if (!token || !ST || document.hidden) return;
    const before = JSON.stringify(ST);
    try { await api('state'); } catch { return; }
    if (JSON.stringify(ST) === before) return;
    const a = document.activeElement;
    if (Modal.any() || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) { App.dirty = true; App.badges(); } else App.render();
  },
  signOutLocal() { token = null; ST = null; store.set('biora_token', null); Modal.closeAll(); App.render(); },
  async login(form) {
    const b = $('button[type=submit]', form), err = $('.err', form); err.hidden = true;
    await run(b, async () => {
      const ar = t => t.replace(/[\u0660-\u0669]/g, d => d.charCodeAt(0) - 0x660).replace(/[\u06F0-\u06F9]/g, d => d.charCodeAt(0) - 0x6F0);
      let un = ar(form.username.value).trim().toLowerCase().replace(/\s+/g, ''); if (/^t[o0-9]{1,3}$/.test(un)) un = un.replace(/o/g, '0');
      let pw = form.password.value; if (/^[\u0660-\u0669\u06F0-\u06F9\s]+$/.test(pw)) pw = ar(pw).replace(/\s/g, '');
      const j = await api('login', { username: un, password: pw });
      if (j.error) { err.textContent = j.error; err.hidden = false; form.password.value = ''; form.password.focus(); form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); return; }
      token = j.token; store.set('biora_token', token); location.hash = '#home'; App.route = 'home'; App.lastRoute = null; App.render();
    });
  },
  logout(btn) { run(btn, async () => { try { await api('logout'); } catch {} App.signOutLocal(); }); },

  /* ───── event delegation ───── */
  onClick(e) {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act;
    if (a === 'close') return Modal.close(el.closest('.overlay'));
    if (App[a]) { e.preventDefault(); App[a](el, e); }
  },
  onInput(e) {
    const el = e.target, b = el.dataset.bind;
    if (b) { App.ui[b] = el.value; clearTimeout(App._t); App._t = setTimeout(() => App.renderList(), el.tagName === 'INPUT' && el.type === 'search' ? 180 : 0); }
    if (el.dataset.days) App.updateDays(el.form);
  },
  renderList() { const box = $('#list-box'); if (box && App._list) box.innerHTML = App._list(); },
  go(el) { location.hash = '#' + el.dataset.to; },
  setTab(el) { App.ui[el.dataset.key] = el.dataset.val; App.render(true); },

  /* ───── shell ───── */
  nav() {
    const r = me().role, pend = ST.requests.filter(needsMe).length;
    const unread = ST.letters.filter(l => l.from_id !== me().id && l.rcpt.some(c => c.user_id === me().id && !c.read_at)).length;
    const items = [['home', r === 'head' ? 'لوحة التحكم' : 'الرئيسية', 'home', 0],
      ['requests', r === 'faculty' ? 'طلباتي' : r === 'head' ? 'الطلبات' : r === 'unit' ? 'المحوَّل إلينا' : 'الوارد من القسم', 'file', pend]];
    if (r === 'head') items.push(['staff', 'الكادر', 'users', 0], ['absences', 'الغيابات', 'calendar', 0]);
    items.push(['letters', r === 'faculty' ? 'الكتب والتعاميم' : 'المراسلات', 'mail', unread]);
    return items;
  },
  render(keepAnim) {
    App.dirty = false;
    const root = $('#app');
    if (!ST) { root.innerHTML = App.vLogin(); App.lastRoute = null; return; }
    const items = App.nav(), valid = [...items.map(i => i[0]), 'profile'];
    if (!valid.includes(App.route)) App.route = 'home';
    const titles = Object.fromEntries(items.map(i => [i[0], i[1]])); titles.profile = 'حسابي';
    const m = me(), nNew = ST.notifs.filter(n => !n.read).length;
    const link = (i, cls) => `<a href="#${i[0]}" class="${App.route === i[0] ? 'on' : ''}">${ic(i[2])}<span>${cls === 'tab' ? App.short(i[1]) : i[1]}</span>${i[3] ? `<b class="cnt">${i[3]}</b>` : ''}</a>`;
    const anim = App.lastRoute !== App.route && !keepAnim;
    const y = scrollY;
    root.innerHTML = `<div class="shell">
      <aside class="side">${HELIX_BG}${BRAND}<nav class="nav">${items.map(i => link(i)).join('')}</nav>
        <button class="side-user" data-act="go" data-to="profile"><span class="avatar">${h(initials(m.name))}</span><span><b>${h(m.name)}</b><span>${h(m.position || RANK_LABEL[m.rank] || ROLE_LABEL[m.role])}</span></span></button></aside>
      <header class="top">${BRAND}<h1>${titles[App.route]}</h1>
        <button class="icon-btn" data-act="openNotifs" aria-label="الإشعارات">${ic('bell')}${nNew ? `<b class="dot" id="ndot">${nNew}</b>` : ''}</button>
        <button class="icon-btn" data-act="go" data-to="profile" aria-label="حسابي"><span class="avatar" style="width:34px;height:34px;font-size:14px">${h(initials(m.name))}</span></button></header>
      <main class="main"><div class="${anim ? 'view' : ''}" id="view">${App['v_' + App.route]()}</div></main>
      <nav class="tabbar">${items.map(i => link(i, 'tab')).join('')}</nav></div>`;
    if (!anim) scrollTo(0, y); else scrollTo(0, 0);
    if (anim) { App.countUp(); clearTimeout(App._va); App._va = setTimeout(() => { const v = $('#view'); if (v) v.classList.remove('view'); }, 1100); }
    App.lastRoute = App.route;
    if (m.must_change && !Modal.any()) App.forcePassword();
  },
  countUp() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    $$('#view .stat .v').forEach(el => { const n = +el.textContent; if (!(n > 0)) return; const t0 = performance.now(), d = 650;
      const step = t => { const k = Math.min(1, (t - t0) / d); el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))); if (k < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = n; };
      el.textContent = 0; requestAnimationFrame(step); });
  },
  short: t => ({ 'لوحة التحكم': 'الرئيسية', 'الكتب والتعاميم': 'الكتب', 'الوارد من القسم': 'الوارد', 'المحوَّل إلينا': 'الطلبات' }[t] || t),
  badges() { /* light refresh while a modal is open */ },

  pwField: (id, name, label, auto, extra = '') => `<div class="field"><label for="${id}">${label}</label><div class="inp-wrap pw">${ic('lock')}<input class="input" id="${id}" name="${name}" type="password" autocomplete="${auto}" dir="ltr" required ${extra}><button type="button" class="eye" data-act="togglePw" aria-label="إظهار كلمة المرور">${ic('eye')}</button><i class="bar"></i></div></div>`,
  togglePw(el) { const i = el.parentElement.querySelector('input'), show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.innerHTML = ic(show ? 'eyeoff' : 'eye'); el.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'); el.classList.toggle('on', show); i.focus(); },
  vLogin() {
    return `<div class="login"><section class="login-brand">${HELIX_BG}<i class="cell c1"></i><i class="cell c2"></i><i class="cell c3"></i><i class="cell c4"></i><i class="cell c5"></i>${BRAND}
      <div><h1>معاملات قسم علوم الحياة،<br><em>من الورق إلى ضغطة واحدة.</em></h1>
      <p class="lead">قدّم طلبك، تابع مساره من رئاسة القسم إلى العمادة، واستلم النتيجة — كل ذلك من مكان واحد.</p></div>
      <div class="foot">جامعة ذي قار — كلية العلوم — قسم علوم الحياة · العام الدراسي <span class="num">2026-2027</span></div></section>
      <section class="login-form"><form class="login-card" data-submit="login" autocomplete="on">${BRAND}
        <h2>تسجيل الدخول</h2><p class="muted">أدخل اسم المستخدم وكلمة المرور المسلَّمة لك من رئاسة القسم.</p>
        <div class="err" hidden></div>
        <div class="field"><label for="lu">اسم المستخدم</label><div class="inp-wrap">${ic('user')}<input class="input" id="lu" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" dir="ltr" placeholder="t01" required autofocus><i class="bar"></i></div></div>
        ${App.pwField('lp', 'password', 'كلمة المرور', 'current-password')}
        <button class="btn block lg" type="submit">${ic('lock')}دخول</button>
        <p class="muted small" style="margin-top:16px;margin-bottom:0">نسيت كلمة المرور؟ راجع رئاسة القسم لإعادة تعيينها.</p></form></section></div>`;
  },

  /* ───── shared pieces ───── */
  reqRow(r, showOwner) {
    const t = TYPE[r.type] || {}, own = showOwner && r.user_id !== me().id;
    return `<button class="row" data-act="openReq" data-id="${r.id}"><span class="ti">${ic(t.icon)}</span>
      <span class="mid"><b>${h(typeLabel(r))}${own ? ` — ${h(uname(r.user_id))}` : ''}</b><span>${h(summary(r)) || '&nbsp;'}</span></span>
      <span class="end">${statusChip(r)}<span class="date"><span class="num">${h(r.ref)}</span> · ${fmtDate(isoDay(new Date(r.created_at)))}</span></span></button>`;
  },
  empty: (title, sub, icon = 'inbox') => `<div class="empty">${ic(icon)}<b>${title}</b>${sub ? `<div class="small">${sub}</div>` : ''}</div>`,
  stat: (k, v, tone, tab) => `<${tab ? 'button data-act="statGo" data-tab="' + tab + '"' : 'div'} class="card stat" style="--tone:var(${tone})"><span class="k"><i></i>${k}</span><span class="v num">${v}</span></${tab ? 'button' : 'div'}>`,
  statGo(el) { App.ui.reqTab = el.dataset.tab; App.ui.fstatus = ''; location.hash = '#requests'; if (App.route === 'requests') App.render(); },
  typeTiles: () => `<div class="types">${TYPES.map(t => `<button class="card type" data-act="newReq" data-type="${t.k}"><span class="ti">${ic(t.icon)}</span><span><b>${t.label}</b><span>${t.desc}</span></span></button>`).join('')}</div>`,

  /* ───── home ───── */
  v_home() {
    const m = me(), R = ST.requests, mine = R.filter(r => r.user_id === m.id), td = today();
    const hello = `<div class="hero">${HELIX_BG}<i class="cell c1"></i><i class="cell c2"></i><i class="cell c3"></i><div class="grow"><h2>أهلاً، ${h(m.name)}</h2><p>${fmtDate(td, true)} · ${h(ST.settings.department)}، ${h(ST.settings.college)}</p></div>${
      (isFac() || isHead()) ? `<button class="btn gold" data-act="pickType">${ic('plus')}طلب جديد</button>` : ''}</div>`;
    if (isFac()) {
      const open = mine.filter(isOpen);
      return hello + `<div class="stats">${App.stat('قيد الإجراء', open.length, '--amber', 'open')}${App.stat('بحاجة إلى تعديلك', mine.filter(needsMe).length, '--red', 'open')}${App.stat('منجزة', mine.filter(r => r.status === 'done').length, '--g500', 'all')}${App.stat('كل طلباتي', mine.length, '--ink-3', 'all')}</div>
        <div class="sec-head"><h2>تقديم طلب جديد</h2></div>${App.typeTiles()}
        <div class="sec-head"><h2>آخر طلباتي</h2>${mine.length ? `<button class="btn ghost sm" data-act="go" data-to="requests">عرض الكل</button>` : ''}</div>
        <div class="card list">${mine.slice(0, 5).map(r => App.reqRow(r)).join('') || App.empty('لا توجد طلبات بعد', 'اختر نوع الطلب من الأعلى لتقديم أول طلب.')}</div>`;
    }
    if (isHead()) {
      const pend = R.filter(needsMe), atDean = R.filter(r => ['at_dean', 'at_unit'].includes(r.status));
      const mon = td.slice(0, 7), doneM = R.filter(r => r.status === 'done' && (r.closed_at || '').slice(0, 7) === mon);
      const fac = ST.users.filter(x => ['faculty', 'head'].includes(x.role) && x.active);
      const leave = fac.filter(x => onLeave(x.id, td)), abs = ST.absences.filter(a => a.day === td);
      const byRank = RANKS.map(k => [RANK_LABEL[k], fac.filter(x => x.rank === k).length]), mx = Math.max(1, ...byRank.map(b => b[1]));
      const yr = td.slice(0, 4), byType = TYPES.map(t => [t.label, R.filter(r => r.type === t.k && r.created_at.slice(0, 4) === yr).length]).filter(b => b[1]).sort((a, b) => b[1] - a[1]).slice(0, 5), mt = Math.max(1, ...byType.map(b => b[1]));
      return hello + `<div class="stats">${App.stat('بانتظار قرارك', pend.length, '--amber', 'mine')}${App.stat('لدى العمادة', atDean.length, '--blue', 'dean')}${App.stat('منجزة هذا الشهر', doneM.length, '--g500', 'all')}${App.stat('مجازون اليوم', leave.length, '--violet')}</div>
        <div class="cols" style="margin-top:6px"><div>
          <div class="sec-head"><h2>بانتظار قرارك</h2>${pend.length > 6 ? `<button class="btn ghost sm" data-act="statGo" data-tab="mine">عرض الكل</button>` : ''}</div>
          <div class="card list">${pend.slice(0, 6).map(r => App.reqRow(r, 1)).join('') || App.empty('لا توجد طلبات بانتظارك', 'كل الطلبات الواردة تم البتّ بها.', 'check')}</div>
          <div class="sec-head"><h2>أحدث الحركة</h2></div>
          <div class="card list">${[...R].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5).map(r => App.reqRow(r, 1)).join('') || App.empty('لا توجد طلبات بعد')}</div>
        </div><div>
          <div class="sec-head"><h2>اليوم في القسم</h2></div>
          <div class="card list">${[...leave.map(x => [x, 'مجاز', 'violet']), ...abs.map(a => [U[a.user_id], { absent: 'غائب', late: 'متأخر', permit: 'إذن' }[a.kind], a.kind === 'absent' ? 'red' : 'amber'])].filter(x => x[0]).map(([x, l, c]) =>
            `<button class="row" data-act="openStaff" data-id="${x.id}"><span class="avatar">${h(initials(x.name))}</span><span class="mid"><b>${h(x.name)}</b></span><span class="chip ${c}">${l}</span></button>`).join('') || App.empty('الكادر كامل اليوم', 'لا إجازات ولا غيابات مسجّلة.', 'users')}</div>
          <div class="sec-head"><h2>الكادر حسب اللقب العلمي</h2></div>
          <div class="card pad bars">${byRank.map(([l, n]) => `<div class="bar"><span>${l}</span><span class="track"><span class="fill" style="width:${n / mx * 100}%;display:block"></span></span><b class="num">${n}</b></div>`).join('')}</div>
          ${byType.length ? `<div class="sec-head"><h2>أكثر الطلبات هذا العام</h2></div><div class="card pad bars">${byType.map(([l, n]) => `<div class="bar" style="grid-template-columns:1fr 90px 26px"><span>${l}</span><span class="track"><span class="fill" style="width:${n / mt * 100}%;display:block;background:var(--gold)"></span></span><b class="num">${n}</b></div>`).join('')}</div>` : ''}
        </div></div>`;
    }
    const pend = R.filter(needsMe);
    const stats = isDean()
      ? App.stat('بانتظار الإجراء', pend.length, '--amber', 'mine') + App.stat('لدى الشعب', R.filter(r => r.status === 'at_unit').length, '--violet', 'unit') + App.stat('منجزة', R.filter(r => r.status === 'done').length, '--g500', 'all') + App.stat('كل الوارد', R.length, '--ink-3', 'all')
      : App.stat('بانتظار الإجراء', pend.length, '--amber', 'mine') + App.stat('كل ما حُوِّل إلينا', R.length, '--ink-3', 'all');
    return hello + `<div class="stats">${stats}</div><div class="sec-head"><h2>بانتظار الإجراء</h2></div>
      <div class="card list">${pend.map(r => App.reqRow(r, 1)).join('') || App.empty('لا يوجد ما ينتظر الإجراء', 'ستظهر هنا الطلبات المحوَّلة من قسم علوم الحياة.', 'check')}</div>`;
  },

  /* ───── requests ───── */
  reqTabs() {
    const R = ST.requests, m = me();
    if (isFac()) return [['open', 'الجارية', R.filter(isOpen)], ['all', 'كل الطلبات', R]];
    if (isHead()) return [['mine', 'بانتظار قرارك', R.filter(needsMe)], ['dean', 'لدى العمادة', R.filter(r => ['at_dean', 'at_unit'].includes(r.status))], ['all', 'الأرشيف الكامل', R], ['own', 'طلباتي', R.filter(r => r.user_id === m.id)]];
    if (isDean()) return [['mine', 'بانتظار الإجراء', R.filter(needsMe)], ['unit', 'لدى الشعب', R.filter(r => r.status === 'at_unit')], ['all', 'كل الوارد', R]];
    return [['mine', 'بانتظار الإجراء', R.filter(needsMe)], ['all', 'الكل', R]];
  },
  filteredReqs() {
    const tabs = App.reqTabs(), u = App.ui; let L = (tabs.find(t => t[0] === u.reqTab) || tabs[0])[2];
    const q = u.q.trim();
    if (q) L = L.filter(r => (r.ref + ' ' + typeLabel(r) + ' ' + uname(r.user_id) + ' ' + summary(r) + ' ' + Object.values(r.data || {}).join(' ')).includes(q));
    if (u.ftype) L = L.filter(r => r.type === u.ftype);
    if (u.fstatus) L = L.filter(r => r.status === u.fstatus);
    if (u.ffrom) L = L.filter(r => isoDay(new Date(r.created_at)) >= u.ffrom);
    if (u.fto) L = L.filter(r => isoDay(new Date(r.created_at)) <= u.fto);
    return L;
  },
  v_requests() {
    const tabs = App.reqTabs(), u = App.ui; if (!tabs.some(t => t[0] === u.reqTab)) u.reqTab = tabs[0][0];
    App._list = () => { const L = App.filteredReqs(); return `<div class="small muted" style="margin:0 4px 8px">${L.length ? `عدد النتائج: <span class="num">${L.length}</span>` : ''}</div><div class="card list">${L.map(r => App.reqRow(r, !isFac())).join('') || App.empty('لا توجد طلبات مطابقة', (u.q || u.ftype || u.fstatus || u.ffrom || u.fto) ? 'جرّب تغيير البحث أو التصفية.' : '')}</div>`; };
    const opt = (v, l, c) => `<option value="${v}"${c === v ? ' selected' : ''}>${l}</option>`;
    return `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px"><div class="seg">${tabs.map(t => `<button class="${u.reqTab === t[0] ? 'on' : ''}" data-act="setTab" data-key="reqTab" data-val="${t[0]}">${t[1]}<span class="n num">${t[2].length}</span></button>`).join('')}</div>
      <span style="flex:1"></span>${(isFac() || isHead()) ? `<button class="btn" data-act="pickType">${ic('plus')}طلب جديد</button>` : ''}</div>
      <div class="filters"><div class="search">${ic('search')}<input class="input" type="search" placeholder="ابحث بالرقم، الاسم أو الموضوع" data-bind="q" value="${h(u.q)}" aria-label="بحث"></div>
        <select class="input" data-bind="ftype" aria-label="نوع الطلب">${opt('', 'كل الأنواع', u.ftype)}${TYPES.map(t => opt(t.k, t.label, u.ftype)).join('')}</select>
        <select class="input" data-bind="fstatus" aria-label="الحالة">${opt('', 'كل الحالات', u.fstatus)}${Object.entries(STATUS).map(([k, v]) => opt(k, v[0], u.fstatus)).join('')}</select>
        <input class="input" type="date" data-bind="ffrom" value="${u.ffrom}" aria-label="من تاريخ" title="من تاريخ">
        <input class="input" type="date" data-bind="fto" value="${u.fto}" aria-label="إلى تاريخ" title="إلى تاريخ">
        <button class="btn ghost" data-act="exportReqs" title="تصدير إلى Excel">${ic('download')}<span>تصدير</span></button></div>
      <div id="list-box">${App._list()}</div>`;
  },
  exportReqs() {
    const L = App.filteredReqs(); if (!L.length) return toast('لا توجد طلبات للتصدير', true);
    downloadCSV(`طلبات-BIORA-${today()}.csv`, [['رقم الطلب', 'النوع', 'مقدم الطلب', 'اللقب العلمي', 'التفاصيل', 'الحالة', 'تاريخ التقديم', 'آخر تحديث'],
      ...L.map(r => [r.ref, typeLabel(r), uname(r.user_id), (U[r.user_id] || {}).rank || '', summary(r), STATUS[r.status][0], plainDT(r.created_at), plainDT(r.updated_at)])]);
    toast('تم تنزيل الملف');
  },
  pickType() {
    Modal.open(Modal.head('طلب جديد', 'اختر نوع الطلب') + `<div class="modal-b">${App.typeTiles()}</div>`);
  },
  fieldHTML(f, v, id) {
    const req = f.req ? ' required' : '', lab = `<label for="${id}">${f.l}${f.req ? ' <span class="req">*</span>' : ''}</label>`;
    let inp;
    if (f.t === 'select') inp = `<select class="input" id="${id}" name="${f.k}"${req}><option value="">اختر…</option>${f.o.map(o => `<option${v === o ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
    else if (f.t === 'staff') inp = `<select class="input" id="${id}" name="${f.k}"><option value="">— لا يوجد —</option>${ST.users.filter(x => ['faculty', 'head'].includes(x.role) && x.active && x.id !== me().id).map(x => `<option value="${x.id}"${v === x.id ? ' selected' : ''}>${h(x.name)}</option>`).join('')}</select>`;
    else if (f.t === 'area') inp = `<textarea class="input" id="${id}" name="${f.k}"${req} maxlength="2000">${h(v || '')}</textarea>`;
    else inp = `<input class="input" id="${id}" name="${f.k}" type="${f.t === 'date' ? 'date' : f.t === 'dt' ? 'datetime-local' : 'text'}" value="${h(v || '')}"${req}${f.t === 'date' && (f.k === 'from' || f.k === 'to') ? ' data-days="1"' : ''} maxlength="300">`;
    return `<div class="field${f.half ? '' : ' full'}">${lab}${inp}</div>`;
  },
  newReq(el) { Modal.closeAll(); App.reqForm(el.dataset.type); },
  editReq(el) { const r = ST.requests.find(x => x.id === el.dataset.id); Modal.closeAll(); App.reqForm(r.type, r); },
  reqForm(type, r) {
    const t = TYPE[type], d = r ? r.data : {};
    const last = r && [...r.events].reverse().find(e => e.action === 'return');
    App._files = [];
    Modal.open(Modal.head(r ? 'تعديل الطلب وإعادة تقديمه' : t.label, r ? `<span class="num">${h(r.ref)}</span>` : (isHead() ? 'يُرسل مباشرة إلى العمادة' : 'يُرسل إلى رئاسة القسم')) +
      `<form data-submit="submitReq" data-type="${type}" data-id="${r ? r.id : ''}" style="display:contents" novalidate><div class="modal-b">
        ${last ? `<div class="err"><b>سبب الإرجاع:</b> ${h(last.note || '')}</div>` : ''}
        <div class="grid2">${t.f.map((f, i) => App.fieldHTML(f, d[f.k], 'f' + i)).join('')}
          <div class="full small muted" id="days-hint" style="margin:-6px 0 10px"></div>
          ${App.attachBar()}
        </div><div class="err" hidden id="form-err"></div></div>
        <div class="modal-f"><button class="btn" type="submit">${ic('send')}${r ? 'إعادة تقديم الطلب' : 'تقديم الطلب'}</button><button class="btn ghost" type="button" data-act="close">إلغاء</button></div></form>`);
    const o = $('#modals').lastElementChild; App.updateDays($('form', o));
  },
  attachBar: (label = 'المرفقات (اختياري — حتى 8 ملفات، 20 ميغابايت للملف)') => `<div class="field full"><label>${label}</label><div class="attach" id="drop">
      <div class="attach-btns">${[['image', 'صورة', 'image/*', ''], ['camera', 'كاميرا', 'image/*', 'environment'], ['file', 'ملف', '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv', ''], ['archive', 'مضغوط', '.zip,.rar,.7z', ''], ['mic', 'صوت', 'audio/*', ''], ['video', 'فيديو', 'video/*', '']]
        .map(([i, l, acc, cap]) => `<label class="att-btn" tabindex="0">${ic(i)}<span>${l}</span><input type="file" hidden ${cap ? `capture="${cap}"` : 'multiple'} accept="${acc}" data-attach></label>`).join('')}
        <button type="button" class="att-btn" data-act="addLink">${ic('link')}<span>رابط</span></button></div>
      <div class="att-list" id="file-list"></div><div class="att-hint small muted">أو اسحب الملفات وأفلتها هنا</div></div></div>`,
  addLink() {
    Modal.open(Modal.head('إضافة رابط', 'موقع، أو رابط ملف على Google Drive وغيره') + `<form data-submit="saveLink" style="display:contents"><div class="modal-b">
      <div class="field"><label for="lk">الرابط <span class="req">*</span></label><input class="input" id="lk" name="url" type="text" inputmode="url" autocapitalize="none" spellcheck="false" dir="ltr" placeholder="https://" required autofocus maxlength="1000"></div>
      <div class="field"><label for="lkt">عنوان الرابط (اختياري)</label><input class="input" id="lkt" name="title" maxlength="100"></div></div>
      <div class="modal-f"><button class="btn" type="submit">إضافة</button><button class="btn ghost" type="button" data-act="close">إلغاء</button></div></form>`, { narrow: 1 });
  },
  saveLink(form) {
    let u = form.url.value.trim(); if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    let host = ''; try { host = new URL(u).hostname; } catch { return toast('الرابط غير صحيح', true); }
    if (App._files.length >= MAX_FILES) return toast(`الحد الأقصى ${MAX_FILES} مرفقات`, true);
    App._files.push({ name: form.title.value.trim() || host, mime: 'text/uri-list', size: 0, link: u });
    Modal.close(form.closest('.overlay')); App.drawFiles();
  },
  drawFiles() {
    const b = $('#file-list'); if (!b) return;
    b.innerHTML = App._files.map((f, i) => `<div class="att-item">${f.url ? `<img src="${f.url}" alt="">` : `<span class="att-ic">${ic(KIND_ICON[fileKind(f.mime, f.name)])}</span>`}
      <span class="att-meta"><b>${h(f.name)}</b><span class="num">${f.link ? h(f.link.replace(/^https?:\/\//, '').slice(0, 40)) : fmtSize(f.size)}</span></span>
      <button type="button" class="rm" data-act="rmFile" data-i="${i}" aria-label="حذف المرفق">${ic('x')}</button></div>`).join('');
    const d = $('#drop'); if (d) d.classList.toggle('has', App._files.length > 0);
  },
  rmFile(el) { const f = App._files.splice(+el.dataset.i, 1)[0]; if (f && f.url) URL.revokeObjectURL(f.url); App.drawFiles(); },
  updateDays(form) {
    const hint = $('#days-hint', form); if (!hint || !form.from || !form.to || form.to.type !== 'date') return;
    const a = form.from.value, b = form.to.value;
    hint.innerHTML = a && b ? (b < a ? '<span style="color:var(--red)">تاريخ النهاية قبل تاريخ البداية</span>' : `المدة: <b class="num">${dayCount(a, b)}</b> يوم`) : '';
  },
  submitReq(form) {
    const t = TYPE[form.dataset.type], data = {}, err = $('#form-err', form); err.hidden = true;
    for (const f of t.f) {
      const v = (form[f.k].value || '').trim();
      if (f.req && !v) { err.textContent = `أكمل حقل «${f.l}»`; err.hidden = false; form[f.k].focus(); return; }
      if (v) data[f.k] = v;
    }
    if (data.from && data.to && /^\d{4}-\d\d-\d\d$/.test(data.to) && data.to < data.from) { err.textContent = 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية'; err.hidden = false; return; }
    const id = form.dataset.id;
    run($('button[type=submit]', form), async () => {
      await api(id ? 'resubmit' : 'submit_request', { id, type: t.k, data, files: await uploadFiles(App._files) });
      Modal.closeAll(); App.render(true);
      toast(id ? 'أُعيد تقديم الطلب' : (isHead() ? 'أُرسل الطلب إلى العمادة' : 'قُدِّم الطلب إلى رئاسة القسم'));
      const r = ST.requests[0]; if (!id && r) App.openReq({ dataset: { id: r.id } });
    });
  },
  openReq(el) {
    const r = ST.requests.find(x => x.id === el.dataset.id); if (!r) return toast('الطلب غير متاح', true);
    const t = TYPE[r.type] || { f: [] }, o = U[r.user_id] || {}, m = me(), d = r.data || {};
    const rows = t.f.filter(f => d[f.k]).map(f => `<div class="${f.t === 'area' || !f.half ? 'full' : ''}"><dt>${f.l.replace(/ \(.*\)$/, '')}</dt><dd>${h(fieldText(f, d[f.k]))}</dd></div>`).join('');
    const days = d.from && d.to && /^\d{4}/.test(d.to) ? `<div class="full"><dt>المدة</dt><dd><span class="num">${dayCount(d.from, d.to)}</span> يوم</dd></div>` : '';
    const evs = r.events.map(e => {
      let [l, tone] = EVENT[e.action] || [e.action, '--g500'];
      if (e.action === 'return') l = (U[e.actor_id] || {}).role === 'head' ? 'إرجاع إلى مقدم الطلب للتعديل' : 'إرجاع إلى القسم';
      if (e.action === 'approve' && (U[e.actor_id] || {}).role !== 'head') l = 'موافقة العمادة وإنجاز الطلب';
      return `<div class="ev" style="--tone:var(${tone})"><b>${l}</b><div class="meta">${h(e.actor_name)}${e.actor_label ? ' · ' + h(e.actor_label) : ''} · ${fmtDT(e.at)}</div>${e.note ? `<div class="note">${h(e.note)}</div>` : ''}</div>`;
    }).join('');
    const B = (act, label, cls, icon) => `<button class="btn ${cls}" data-act="reqAct" data-id="${r.id}" data-a="${act}">${ic(icon)}${label}</button>`;
    let acts = '';
    if (m.role === 'head' && r.user_id !== m.id && ['submitted', 'returned_dept'].includes(r.status))
      acts = B('approve', 'موافقة وإنجاز', '', 'check') + B('forward', 'تحويل إلى العمادة', 'soft', 'share') + B('return', 'إرجاع للتعديل', 'ghost', 'undo') + B('reject', 'رفض', 'danger', 'x');
    else if (isDean() && ['at_dean', 'at_unit'].includes(r.status))
      acts = B('approve', 'موافقة وإنجاز', '', 'check') + B('assign', 'تحويل إلى شعبة', 'soft', 'share') + B('return', 'إرجاع إلى القسم', 'ghost', 'undo') + B('reject', 'رفض', 'danger', 'x');
    else if (m.role === 'unit' && r.status === 'at_unit' && r.assigned_to === m.id)
      acts = B('complete', 'تم الإنجاز', '', 'check') + B('back', 'إرجاع إلى العمادة', 'ghost', 'undo');
    else if (r.user_id === m.id && r.status === 'returned')
      acts = `<button class="btn" data-act="editReq" data-id="${r.id}">${ic('edit')}تعديل وإعادة تقديم</button>` + B('withdraw', 'سحب الطلب', 'danger', 'x');
    else if (r.user_id === m.id && r.status === 'submitted') acts = B('withdraw', 'سحب الطلب', 'danger', 'x');
    Modal.open(Modal.head(h(typeLabel(r)), `رقم الطلب <span class="num">${h(r.ref)}</span> · ${fmtDT(r.created_at)}`) + `<div class="modal-b">
      <div class="who"><span class="avatar lg">${h(initials(o.name))}</span><div style="flex:1;min-width:0"><b>${h(o.name || '—')}</b><span>${h(o.position || RANK_LABEL[o.rank] || '')}</span></div>${statusChip(r)}</div>
      <dl class="dl">${rows}${days}</dl>
      ${r.files.length ? `<div class="sub-h">المرفقات</div><div class="files">${r.files.map(fileChip).join('')}</div>` : ''}
      <div class="sub-h">مسار الطلب</div><div class="strand">${evs}</div></div>
      <div class="modal-f">${acts}<span class="sp"></span>${B('note', 'ملاحظة', 'ghost', 'note')}<button class="btn ghost" data-act="printReq" data-id="${r.id}">${ic('printer')}طباعة</button></div>`);
  },
  getFile(el) { run(el, () => openFile(el.dataset.id)); },
  reqAct(el) {
    const id = el.dataset.id, a = el.dataset.a, r = ST.requests.find(x => x.id === id);
    const need = ['reject', 'return', 'back', 'note'].includes(a);
    const T = { approve: ['تأكيد الموافقة والإنجاز', 'سيُبلَّغ مقدم الطلب بإنجاز طلبه.', 'تأكيد الموافقة'], forward: ['تحويل الطلب إلى العمادة', 'سيظهر الطلب لدى عمادة الكلية للبتّ به.', 'تحويل إلى العمادة'],
      return: ['إرجاع الطلب', 'اكتب ما المطلوب تعديله أو استكماله.', 'إرجاع الطلب'], reject: ['رفض الطلب', 'اكتب سبب الرفض ليطّلع عليه مقدم الطلب.', 'تأكيد الرفض'],
      assign: ['تحويل إلى جهة مختصة', 'اختر الشعبة أو المعاون الذي سيتولى الطلب.', 'تحويل'], complete: ['تأكيد إنجاز الطلب', 'سيُبلَّغ مقدم الطلب والقسم بالإنجاز.', 'تم الإنجاز'],
      back: ['إرجاع إلى العمادة', 'اكتب سبب الإرجاع.', 'إرجاع'], withdraw: ['سحب الطلب', 'سيُلغى الطلب ولن يُنظر فيه.', 'سحب الطلب'], note: ['إضافة ملاحظة', 'تظهر الملاحظة في مسار الطلب لكل من يحق له رؤيته.', 'إضافة'] }[a];
    const targets = a === 'assign' ? ST.users.filter(x => ['unit', 'dean_asst'].includes(x.role) && x.active && x.id !== me().id) : [];
    Modal.open(Modal.head(T[0], `<span class="num">${h(r.ref)}</span>`) + `<form data-submit="doReqAct" data-id="${id}" data-a="${a}" style="display:contents"><div class="modal-b"><p class="muted" style="margin-bottom:14px">${T[1]}</p>
      ${a === 'assign' ? `<div class="field"><label for="ato">الجهة <span class="req">*</span></label><select class="input" id="ato" name="to" required><option value="">اختر…</option>${targets.map(x => `<option value="${x.id}">${h(x.position || x.name)}</option>`).join('')}</select></div>` : ''}
      ${a === 'withdraw' ? '' : `<div class="field"><label for="anote">${need ? (a === 'note' ? 'الملاحظة' : 'السبب') + ' <span class="req">*</span>' : 'ملاحظة (اختياري)'}</label><textarea class="input" id="anote" name="note" ${need ? 'required' : ''} autofocus maxlength="1000"></textarea></div>`}</div>
      <div class="modal-f"><button class="btn${['reject', 'withdraw'].includes(a) ? ' danger' : ''}" type="submit">${T[2]}</button><button class="btn ghost" type="button" data-act="close">تراجع</button></div></form>`, { narrow: 1 });
  },
  doReqAct(form) {
    const { id, a } = form.dataset, note = form.note ? form.note.value.trim() : '';
    run($('button[type=submit]', form), async () => {
      if (a === 'withdraw') await api('withdraw', { id });
      else if (a === 'note') await api('comment', { id, note });
      else await api('act', { id, action: a, note, to: form.to ? form.to.value : undefined });
      Modal.closeAll(); App.render(true);
      toast({ approve: 'تمت الموافقة وأُنجز الطلب', forward: 'حُوِّل الطلب إلى العمادة', return: 'أُرجع الطلب', reject: 'رُفض الطلب', assign: 'حُوِّل الطلب', complete: 'أُنجز الطلب', back: 'أُرجع إلى العمادة', withdraw: 'سُحب الطلب', note: 'أُضيفت الملاحظة' }[a]);
      if (a === 'note') App.openReq({ dataset: { id } });
    });
  },
  printReq(el) {
    const r = ST.requests.find(x => x.id === el.dataset.id), t = TYPE[r.type], o = U[r.user_id] || {}, s = ST.settings, d = r.data;
    const rows = [['مقدم الطلب', o.name], ['اللقب العلمي', RANK_LABEL[o.rank] || o.position || ''], ...t.f.filter(f => d[f.k]).map(f => [f.l.replace(/ \(.*\)$/, ''), fieldText(f, d[f.k])])];
    if (d.from && d.to && /^\d{4}/.test(d.to)) rows.push(['المدة', dayCount(d.from, d.to) + ' يوم']);
    rows.push(['حالة الطلب', STATUS[r.status][0]]);
    $('#print').innerHTML = `<div class="p-head"><div>${h(s.ministry)}<br>${h(s.university || 'جامعة ................')}<br>${h(s.college)}<br>${h(s.department)}</div>
      <div class="mid"><div class="mk">BIORA</div><div style="font-size:10pt;font-weight:400">نظام المعاملات الإلكتروني</div></div>
      <div style="text-align:left">العدد: <span class="num">${h(r.ref)}</span><br>التاريخ: ${plainDate(isoDay(new Date(r.created_at)))}</div></div>
      <div class="p-title">م / ${h(t.label)}</div>
      <table class="p-table">${rows.map(([k, v]) => `<tr><td>${h(k)}</td><td>${h(v)}</td></tr>`).join('')}</table>
      <div class="p-sub">مسار المعاملة</div>
      <table class="p-table">${r.events.map(e => `<tr><td>${h((EVENT[e.action] || [e.action])[0])}</td><td>${h(e.actor_name)}${e.actor_label ? ' — ' + h(e.actor_label) : ''} · ${plainDT(e.at)}${e.note ? '<br>' + h(e.note) : ''}</td></tr>`).join('')}</table>
      <div class="p-sign"><div>مقدم الطلب<br><br>${h(o.name)}</div><div>رئيس القسم<br><br>${h((ST.users.find(x => x.role === 'head') || {}).name || '')}</div></div>
      <div class="p-foot"><span>مستخرج من نظام BIORA</span><span>تاريخ الطباعة: ${plainDT(new Date())}</span></div>`;
    window.print();
  },

  /* ───── staff (head) ───── */
  staffList() {
    const u = App.ui, q = u.staffQ.trim(), td = today();
    let L = ST.users.filter(x => u.staffTab === 'faculty' ? ['faculty', 'head'].includes(x.role) : !['faculty', 'head'].includes(x.role));
    if (q) L = L.filter(x => (x.name + ' ' + (x.username || '') + ' ' + (x.position || '') + ' ' + (x.specialty || '')).includes(q));
    const row = (x, i) => `<button class="row" data-act="openStaff" data-id="${x.id}"><span class="seqn num">${i + 1}</span><span class="avatar">${h(initials(x.name))}</span>
      <span class="mid"><b>${h(x.name)}</b><span>${x.role === 'head' ? 'رئيسة القسم · ' : ''}${u.staffTab === 'faculty' ? (x.rank_date ? 'حصل على اللقب في ' + plainDate(x.rank_date) : 'تاريخ اللقب غير مُدخل') : h(ROLE_LABEL[x.role])} · <span class="num">${h(x.username)}</span></span></span>
      <span class="end">${!x.active ? '<span class="chip gray">معطَّل</span>' : onLeave(x.id, td) ? '<span class="chip violet">مجاز اليوم</span>' : ST.absences.some(a => a.user_id === x.id && a.day === td && a.kind === 'absent') ? '<span class="chip red">غائب اليوم</span>' : ''}</span></button>`;
    if (!L.length) return `<div class="card list">${App.empty('لا توجد نتائج', 'جرّب اسماً آخر.', 'users')}</div>`;
    if (u.staffTab !== 'faculty') return `<div class="card list">${L.map(row).join('')}</div>`;
    let n = 0;
    return `<div class="card list">${RANKS.map(k => {
      let g = L.filter(x => x.rank === k); if (!g.length) return '';
      if (u.staffSort === 'date') g = [...g].sort((a, b) => (a.rank_date || '9999').localeCompare(b.rank_date || '9999'));
      return `<div class="group-h">${RANK_LABEL[k]} <span>(<span class="num">${g.length}</span>)</span></div>` + g.map(x => row(x, n++)).join('');
    }).join('') + L.filter(x => !RANKS.includes(x.rank)).map(x => row(x, n++)).join('')}</div>`;
  },
  v_staff() {
    const u = App.ui; App._list = App.staffList;
    const fac = ST.users.filter(x => ['faculty', 'head'].includes(x.role)).length, dn = ST.users.length - fac;
    return `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px"><div class="seg"><button class="${u.staffTab === 'faculty' ? 'on' : ''}" data-act="setTab" data-key="staffTab" data-val="faculty">الكادر التدريسي<span class="n num">${fac}</span></button><button class="${u.staffTab === 'dean' ? 'on' : ''}" data-act="setTab" data-key="staffTab" data-val="dean">حسابات العمادة<span class="n num">${dn}</span></button></div>
      <span style="flex:1"></span><button class="btn" data-act="editStaff" data-id="">${ic('plus')}إضافة حساب</button></div>
      <div class="filters" style="grid-template-columns:1fr ${u.staffTab === 'faculty' ? '220px' : ''} auto"><div class="search">${ic('search')}<input class="input" type="search" placeholder="ابحث بالاسم أو اسم المستخدم" data-bind="staffQ" value="${h(u.staffQ)}" aria-label="بحث"></div>
      ${u.staffTab === 'faculty' ? `<select class="input" data-bind="staffSort" aria-label="الترتيب"><option value="official"${u.staffSort === 'official' ? ' selected' : ''}>الترتيب الرسمي للقسم</option><option value="date"${u.staffSort === 'date' ? ' selected' : ''}>الأقدمية في اللقب</option></select>` : ''}
      <button class="btn ghost" data-act="exportStaff">${ic('download')}<span>تصدير</span></button></div><div id="list-box">${App.staffList()}</div>`;
  },
  exportStaff() {
    const L = ST.users.filter(x => ['faculty', 'head'].includes(x.role));
    downloadCSV(`الكادر-التدريسي-${today()}.csv`, [['ت', 'الاسم', 'اللقب العلمي', 'تاريخ الحصول على اللقب', 'اسم المستخدم', 'الهاتف', 'البريد', 'الحالة'], ...L.map((x, i) => [i + 1, x.name, x.rank, x.rank_date || '', x.username, x.phone || '', x.email || '', x.active ? 'فعّال' : 'معطَّل'])]);
    toast('تم تنزيل الملف');
  },
  openStaff(el) {
    const x = U[el.dataset.id]; if (!x || !isHead()) return;
    const R = ST.requests.filter(r => r.user_id === x.id), leaves = R.filter(r => r.type === 'leave' && r.status === 'done');
    const A = ST.absences.filter(a => a.user_id === x.id), ld = leaves.reduce((s, r) => s + dayCount(r.data.from, r.data.to), 0);
    const KL = { absent: ['غياب', 'red'], late: ['تأخر', 'amber'], permit: ['إذن', 'blue'] };
    Modal.open(Modal.head('ملف التدريسي', h(ROLE_LABEL[x.role])) + `<div class="modal-b">
      <div class="who"><span class="avatar lg">${h(initials(x.name))}</span><div style="flex:1;min-width:0"><b style="font-size:17px">${h(x.name)}</b><span>${h(x.position || RANK_LABEL[x.rank] || '')}</span></div>${x.active ? '' : '<span class="chip gray">معطَّل</span>'}</div>
      <dl class="dl"><div><dt>اللقب العلمي</dt><dd>${h(RANK_LABEL[x.rank] || '—')}</dd></div><div><dt>تاريخ الحصول على اللقب</dt><dd>${fmtDate(x.rank_date)}</dd></div>
        <div><dt>اسم المستخدم</dt><dd><span class="num">${h(x.username)}</span></dd></div><div><dt>التخصص</dt><dd>${h(x.specialty || '—')}</dd></div>
        <div><dt>الهاتف</dt><dd><span class="num">${h(x.phone || '—')}</span></dd></div><div><dt>البريد الإلكتروني</dt><dd><span class="num">${h(x.email || '—')}</span></dd></div>
        ${x.notes ? `<div class="full"><dt>ملاحظات</dt><dd>${h(x.notes)}</dd></div>` : ''}</dl>
      <div class="stats" style="grid-template-columns:repeat(3,1fr)">${App.stat('الطلبات', R.length, '--g500')}${App.stat('أيام الإجازات', ld, '--violet')}${App.stat('الغيابات', A.filter(a => a.kind === 'absent').length, '--red')}</div>
      <div class="sub-h">سجل الإجازات المنجزة</div><div class="card list">${leaves.map(r => App.reqRow(r)).join('') || App.empty('لا توجد إجازات مسجّلة')}</div>
      <div class="sub-h">سجل الغياب والتأخر</div><div class="card list">${A.map(a => `<div class="row"><span class="mid"><b>${fmtDate(a.day, true)}</b><span>${h(a.note || '')}</span></span><span class="chip ${KL[a.kind][1]}">${KL[a.kind][0]}</span></div>`).join('') || App.empty('لا يوجد غياب مسجّل')}</div>
      <div class="sub-h">كل الطلبات</div><div class="card list">${R.map(r => App.reqRow(r)).join('') || App.empty('لم يقدّم طلبات بعد')}</div></div>
      <div class="modal-f"><button class="btn" data-act="editStaff" data-id="${x.id}">${ic('edit')}تعديل البيانات</button>${x.id !== me().id ? `<button class="btn ghost" data-act="resetPass" data-id="${x.id}">${ic('key')}كلمة مرور جديدة</button><button class="btn danger" data-act="delStaff" data-id="${x.id}">${ic('trash')}حذف</button>` : ''}</div>`);
  },
  editStaff(el) {
    const x = U[el.dataset.id] || null, isF = x ? ['faculty', 'head'].includes(x.role) : App.ui.staffTab === 'faculty';
    const v = k => h(x && x[k] || '');
    Modal.closeAll();
    Modal.open(Modal.head(x ? 'تعديل البيانات' : 'إضافة حساب جديد', x ? h(x.name) : '') + `<form data-submit="saveStaff" data-id="${x ? x.id : ''}" style="display:contents"><div class="modal-b"><div class="grid2">
      <div class="field full"><label for="sn">الاسم الرباعي مع اللقب <span class="req">*</span></label><input class="input" id="sn" name="name" value="${v('name')}" required maxlength="120"></div>
      ${x ? '' : `<div class="field"><label for="su">اسم المستخدم <span class="req">*</span></label><input class="input" id="su" name="username" dir="ltr" required pattern="[a-zA-Z0-9._\\-]{2,30}" title="أحرف إنجليزية وأرقام فقط" maxlength="30"></div>
        <div class="field"><label for="sr">نوع الحساب</label><select class="input" id="sr" name="role"><option value="faculty"${isF ? ' selected' : ''}>تدريسي</option><option value="dean">عميد الكلية</option><option value="dean_asst">معاون العميد</option><option value="unit"${isF ? '' : ' selected'}>شعبة في العمادة</option></select></div>`}
      <div class="field"><label for="sk">اللقب العلمي</label><select class="input" id="sk" name="rank"><option value="">— لا ينطبق —</option>${RANKS.map(k => `<option value="${k}"${x && x.rank === k ? ' selected' : ''}>${RANK_LABEL[k]}</option>`).join('')}</select></div>
      <div class="field"><label for="sd">تاريخ الحصول على اللقب</label><input class="input" id="sd" name="rank_date" type="date" value="${v('rank_date')}"></div>
      <div class="field"><label for="sp">المنصب أو اسم الشعبة</label><input class="input" id="sp" name="position" value="${v('position')}" maxlength="100"></div>
      <div class="field"><label for="ss">التخصص</label><input class="input" id="ss" name="specialty" value="${v('specialty')}" maxlength="100"></div>
      <div class="field"><label for="sph">الهاتف</label><input class="input" id="sph" name="phone" dir="ltr" inputmode="tel" value="${v('phone')}" maxlength="20"></div>
      <div class="field"><label for="se">البريد الإلكتروني</label><input class="input" id="se" name="email" type="email" dir="ltr" value="${v('email')}" maxlength="100"></div>
      <div class="field full"><label for="sno">ملاحظات</label><textarea class="input" id="sno" name="notes" maxlength="600">${v('notes')}</textarea></div>
      ${x && x.id !== me().id ? `<label class="check full"><input type="checkbox" name="active"${x.active ? ' checked' : ''}> الحساب فعّال (أزل العلامة لمنع الدخول)</label>` : ''}</div></div>
      <div class="modal-f"><button class="btn" type="submit">حفظ</button><button class="btn ghost" type="button" data-act="close">إلغاء</button></div></form>`);
  },
  saveStaff(form) {
    const p = { id: form.dataset.id || undefined };
    ['name', 'username', 'role', 'rank', 'rank_date', 'position', 'specialty', 'phone', 'email', 'notes'].forEach(k => { if (form[k]) p[k] = form[k].value; });
    if (form.active) p.active = form.active.checked;
    run($('button[type=submit]', form), async () => {
      const j = await api('save_user', p); Modal.closeAll(); App.render(true);
      if (j.temp_password) App.showPass(p.name, p.username, j.temp_password); else toast('حُفظت البيانات');
    });
  },
  showPass(name, username, pw) {
    Modal.open(Modal.head('بيانات الدخول', h(name)) + `<div class="modal-b"><p>سلّم هذه البيانات لصاحب الحساب. سيُطلب منه تغيير كلمة المرور عند أول دخول.</p>
      <div class="pass-box"><div class="small muted">اسم المستخدم</div><div class="num" style="font-size:20px;font-weight:700">${h(username)}</div><div class="small muted" style="margin-top:10px">كلمة المرور المؤقتة</div><div class="pw">${h(pw)}</div></div>
      <p class="small muted">لن تظهر كلمة المرور مرة أخرى بعد إغلاق هذه النافذة.</p></div><div class="modal-f"><button class="btn" data-act="copyPass" data-t="اسم المستخدم: ${h(username)} — كلمة المرور: ${h(pw)}">نسخ البيانات</button><button class="btn ghost" data-act="close">تم</button></div>`, { narrow: 1 });
  },
  async copyPass(el) { try { await navigator.clipboard.writeText(el.dataset.t); toast('نُسخت البيانات'); } catch { toast('تعذّر النسخ، انسخها يدوياً', true); } },
  resetPass(el) {
    const x = U[el.dataset.id];
    App.confirm('كلمة مرور جديدة', `ستُلغى كلمة المرور الحالية لـ«${h(x.name)}» ويُسجَّل خروجه من كل الأجهزة.`, 'إنشاء كلمة مرور', async () => {
      const j = await api('reset_password', { id: x.id }); Modal.closeAll(); App.showPass(x.name, x.username, j.temp_password);
    });
  },
  delStaff(el) {
    const x = U[el.dataset.id];
    App.confirm('حذف الحساب', `سيُحذف حساب «${h(x.name)}» نهائياً. إذا كانت له طلبات محفوظة فلن يُحذف ويمكنك تعطيله بدلاً من ذلك.`, 'حذف الحساب', async () => {
      await api('delete_user', { id: x.id }); Modal.closeAll(); App.render(true); toast('حُذف الحساب');
    }, true);
  },
  confirm(title, text, btn, fn, danger) {
    App._confirm = fn;
    Modal.open(Modal.head(title) + `<div class="modal-b"><p>${text}</p></div><div class="modal-f"><button class="btn${danger ? ' danger' : ''}" data-act="doConfirm">${btn}</button><button class="btn ghost" data-act="close">تراجع</button></div>`, { narrow: 1 });
  },
  doConfirm(el) { run(el, App._confirm); },

  /* ───── absences (head) ───── */
  v_absences() {
    const u = App.ui; u.absDay = u.absDay || today(); u.absMonth = u.absMonth || today().slice(0, 7);
    const fac = ST.users.filter(x => ['faculty', 'head'].includes(x.role) && x.active), day = u.absDay;
    const K = [['present', 'حاضر'], ['absent', 'غائب'], ['late', 'تأخر'], ['permit', 'إذن']];
    const KL = { absent: ['غياب', 'red'], late: ['تأخر', 'amber'], permit: ['إذن', 'blue'] };
    const rec = ST.absences.filter(a => a.day.slice(0, 7) === u.absMonth);
    const cnt = ST.absences.filter(a => a.day === day);
    return `<div class="cols" style="margin-top:8px"><div>
      <div class="sec-head" style="margin-top:6px"><h2>تسجيل الحضور ليوم</h2><input class="input" type="date" style="width:170px" value="${day}" max="${today()}" data-act-day aria-label="اليوم"></div>
      <p class="small muted" style="margin:-4px 2px 10px">${fmtDate(day, true)} — المسجَّل: <span class="num">${cnt.filter(a => a.kind === 'absent').length}</span> غياب، <span class="num">${cnt.filter(a => a.kind === 'late').length}</span> تأخر، <span class="num">${cnt.filter(a => a.kind === 'permit').length}</span> إذن. الكل حاضر ما لم تُسجّل غير ذلك.</p>
      <div class="card list">${fac.map(x => {
        const a = ST.absences.find(z => z.user_id === x.id && z.day === day), cur = a ? a.kind : 'present', lv = onLeave(x.id, day);
        return `<div class="att-row"><span class="avatar">${h(initials(x.name))}</span><span class="mid"><b>${h(x.name)}</b>${a && a.note ? `<span class="small muted">${h(a.note)}</span>` : ''}</span>
          ${lv ? '<span class="chip violet">مجاز</span>' : `<span class="att-opts">${K.map(([k, l]) => `<button class="${k}${cur === k ? ' on' : ''}" data-act="setAbs" data-u="${x.id}" data-k="${k}" data-a="${a ? a.id : ''}" aria-pressed="${cur === k}">${l}</button>`).join('')}${a ? `<button data-act="absNote" data-u="${x.id}" title="ملاحظة" aria-label="ملاحظة">${ic('note')}</button>` : ''}</span>`}</div>`;
      }).join('')}</div></div><div>
      <div class="sec-head" style="margin-top:6px"><h2>سجل الشهر</h2><input class="input" type="month" style="width:160px" value="${u.absMonth}" data-act-month aria-label="الشهر"></div>
      <div class="card list">${rec.map(a => `<button class="row" data-act="openStaff" data-id="${a.user_id}"><span class="mid"><b>${h(uname(a.user_id))}</b><span>${plainDate(a.day)}${a.note ? ' — ' + h(a.note) : ''}</span></span><span class="chip ${KL[a.kind][1]}">${KL[a.kind][0]}</span></button>`).join('') || App.empty('لا يوجد غياب مسجّل في هذا الشهر', '', 'check')}</div>
      ${rec.length ? `<button class="btn ghost block" style="margin-top:10px" data-act="exportAbs">${ic('download')}تصدير سجل الشهر</button>` : ''}</div></div>`;
  },
  setAbs(el) {
    const { u, k, a } = el.dataset;
    run(null, async () => {
      if (k === 'present') { if (a) await api('delete_absence', { id: a }); }
      else { const old = ST.absences.find(z => z.id === a); await api('set_absence', { user_id: u, day: App.ui.absDay, kind: k, note: old ? old.note : '' }); }
      App.render(true);
    });
  },
  absNote(el) {
    const a = ST.absences.find(z => z.user_id === el.dataset.u && z.day === App.ui.absDay);
    Modal.open(Modal.head('ملاحظة على السجل', h(uname(a.user_id))) + `<form data-submit="saveAbsNote" data-u="${a.user_id}" data-k="${a.kind}" style="display:contents"><div class="modal-b"><div class="field"><label for="an">الملاحظة</label><textarea class="input" id="an" name="note" autofocus maxlength="300">${h(a.note || '')}</textarea></div></div>
      <div class="modal-f"><button class="btn" type="submit">حفظ</button><button class="btn ghost" type="button" data-act="close">إلغاء</button></div></form>`, { narrow: 1 });
  },
  saveAbsNote(form) { run($('button[type=submit]', form), async () => { await api('set_absence', { user_id: form.dataset.u, day: App.ui.absDay, kind: form.dataset.k, note: form.note.value }); Modal.closeAll(); App.render(true); toast('حُفظت الملاحظة'); }); },
  exportAbs() {
    const KL = { absent: 'غياب', late: 'تأخر', permit: 'إذن' }, rec = ST.absences.filter(a => a.day.slice(0, 7) === App.ui.absMonth);
    downloadCSV(`الغيابات-${App.ui.absMonth}.csv`, [['التاريخ', 'الاسم', 'النوع', 'ملاحظة'], ...rec.map(a => [a.day, uname(a.user_id), KL[a.kind], a.note || ''])]); toast('تم تنزيل الملف');
  },

  /* ───── letters ───── */
  v_letters() {
    const m = me(), u = App.ui, inbox = ST.letters.filter(l => l.from_id !== m.id), out = ST.letters.filter(l => l.from_id === m.id);
    if (isFac()) u.letTab = 'in';
    const L = u.letTab === 'in' ? inbox : out, unread = inbox.filter(l => l.rcpt.some(c => c.user_id === m.id && !c.read_at)).length;
    const row = l => { const un = l.from_id !== m.id && l.rcpt.some(c => c.user_id === m.id && !c.read_at);
      return `<button class="row${un ? ' unread' : ''}" data-act="openLetter" data-id="${l.id}"><span class="ti">${ic(l.kind === 'circular' ? 'users' : 'mail')}</span><span class="mid"><b>${h(l.subject)}</b><span>${u.letTab === 'in' ? 'من: ' + h(upos(l.from_id)) : 'إلى: ' + h(l.to_label || '')}</span></span>
        <span class="end">${l.kind === 'circular' ? '<span class="chip green plain">تعميم</span>' : App.decChip(l)}<span class="date"><span class="num">${h(l.ref)}</span> · ${ago(l.created_at)}</span></span></button>`; };
    return `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0 14px">${isFac() ? '' : `<div class="seg"><button class="${u.letTab === 'in' ? 'on' : ''}" data-act="setTab" data-key="letTab" data-val="in">الوارد<span class="n num">${unread || inbox.length}</span></button><button class="${u.letTab === 'out' ? 'on' : ''}" data-act="setTab" data-key="letTab" data-val="out">الصادر<span class="n num">${out.length}</span></button></div>`}
      <span style="flex:1"></span>${isFac() ? '' : `<button class="btn ghost" data-act="compose" data-scan="1">${ic('camera')}رفع كتاب جاهز</button><button class="btn" data-act="compose">${ic('plus')}كتاب جديد</button>`}</div>
      <div class="card list">${L.map(row).join('') || App.empty(u.letTab === 'in' ? 'لا توجد كتب واردة' : 'لم ترسل كتباً بعد', isFac() ? 'ستظهر هنا تعاميم رئاسة القسم.' : '', 'mail')}</div>`;
  },
  DEC: { accept: ['موافقة', 'موافَق عليه', 'green'], reject: ['رفض', 'مرفوض', 'red'], return: ['إعادة', 'مُعاد إلى القسم', 'amber'] },
  isDecision: l => /^قرار العمادة: /.test(l.subject) && U[l.from_id] && ['dean', 'dean_asst'].includes(U[l.from_id].role),
  decision(l) {
    const r = ST.letters.filter(x => x.parent_id === l.id && App.isDecision(x)).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (!r) return null;
    const k = Object.keys(App.DEC).find(k => r.subject.startsWith('قرار العمادة: ' + App.DEC[k][0]));
    return k ? { k, letter: r } : null;
  },
  needsDecision: l => l.kind === 'letter' && !l.parent_id && U[l.from_id] && U[l.from_id].role === 'head' && (isDean() ? l.rcpt.some(c => c.user_id === me().id) : /عماد|عميد|معاون/.test(l.to_label || '')),
  decChip(l) {
    if (App.isDecision(l)) return '<span class="chip blue plain">قرار العمادة</span>';
    const d = App.decision(l);
    if (d) return `<span class="chip ${App.DEC[d.k][2]}">${App.DEC[d.k][1]}</span>`;
    return App.needsDecision(l) ? '<span class="chip amber">بانتظار قرار العمادة</span>' : '';
  },
  decide(el) {
    const l = ST.letters.find(x => x.id === el.dataset.id), k = el.dataset.d, need = k !== 'accept';
    const T = { accept: ['الموافقة على الكتاب', 'ستُبلَّغ رئاسة القسم بموافقة العمادة.', 'تأكيد الموافقة'], reject: ['رفض الكتاب', 'اكتب سبب الرفض ليصل إلى رئاسة القسم.', 'تأكيد الرفض'], return: ['إعادة الكتاب إلى القسم', 'اكتب المطلوب استكماله أو تعديله.', 'إعادة الكتاب'] }[k];
    Modal.open(Modal.head(T[0], h(l.subject)) + `<form data-submit="doDecide" data-id="${l.id}" data-d="${k}" style="display:contents"><div class="modal-b"><p class="muted" style="margin-bottom:14px">${T[1]}</p>
      <div class="field"><label for="dn">${need ? 'السبب <span class="req">*</span>' : 'ملاحظة (اختياري)'}</label><textarea class="input" id="dn" name="note" ${need ? 'required' : ''} autofocus maxlength="1500"></textarea></div></div>
      <div class="modal-f"><button class="btn${k === 'reject' ? ' danger' : ''}" type="submit">${T[2]}</button><button class="btn ghost" type="button" data-act="close">تراجع</button></div></form>`, { narrow: 1 });
  },
  doDecide(form) {
    const l = ST.letters.find(x => x.id === form.dataset.id), k = form.dataset.d, note = form.note.value.trim();
    const ids = [l.from_id, ...ST.users.filter(x => ['dean', 'dean_asst'].includes(x.role) && x.active && x.id !== me().id).map(x => x.id)];
    run($('button[type=submit]', form), async () => {
      await api('send_letter', { to: 'ids', ids, subject: `قرار العمادة: ${App.DEC[k][0]} — ${l.subject}`.slice(0, 200), body: note || { accept: 'تمت الموافقة على الكتاب.', reject: '', return: '' }[k], parent_id: l.id });
      Modal.closeAll(); App.render(true); toast({ accept: 'سُجّلت الموافقة وأُبلغ القسم', reject: 'سُجّل الرفض وأُبلغ القسم', return: 'أُعيد الكتاب إلى القسم' }[k]);
    });
  },
  openLetter(el) {
    const l = ST.letters.find(x => x.id === el.dataset.id), m = me(), mineL = l.from_id === m.id;
    const read = l.rcpt.filter(c => c.read_at).length, par = l.parent_id && ST.letters.find(x => x.id === l.parent_id);
    Modal.open(Modal.head(h(l.subject), `العدد <span class="num">${h(l.ref)}</span> · ${fmtDT(l.created_at)}`) + `<div class="modal-b">
      <dl class="dl"><div><dt>من</dt><dd>${h(upos(l.from_id))}${U[l.from_id] && U[l.from_id].position ? ' — ' + h(uname(l.from_id)) : ''}</dd></div><div><dt>إلى</dt><dd>${h(l.to_label || '')}</dd></div>
      <div class="full"><dt>نص الكتاب</dt><dd>${h(l.body) || '—'}</dd></div></dl>
      ${(() => { const d = App.decision(l); if (d) return `<div class="decision ${App.DEC[d.k][2]}"><b>قرار العمادة: ${App.DEC[d.k][1]}</b><span>${h(upos(d.letter.from_id))} · ${fmtDT(d.letter.created_at)}</span>${d.letter.body ? `<p>${h(d.letter.body)}</p>` : ''}</div>`; return App.needsDecision(l) ? '<div class="decision amber"><b>بانتظار قرار العمادة</b><span>لم يُبتّ بهذا الكتاب بعد.</span></div>' : ''; })()}
      ${par ? `<p class="small muted" style="margin-top:10px">رداً على / إحالةً لـ: ${h(par.subject)} (<span class="num">${h(par.ref)}</span>)</p>` : ''}
      ${l.files.length ? `<div class="sub-h">المرفقات</div><div class="files">${l.files.map(fileChip).join('')}</div>` : ''}
      ${mineL ? `<div class="sub-h">الاطلاع (<span class="num">${read}</span> من <span class="num">${l.rcpt.length}</span>)</div><div class="card list" style="max-height:220px;overflow:auto">${l.rcpt.map(c => `<div class="row" style="padding:9px 14px"><span class="mid"><b>${h(upos(c.user_id))}</b></span><span class="chip ${c.read_at ? 'green' : 'gray'}">${c.read_at ? 'اطّلع' : 'لم يطّلع'}</span></div>`).join('')}</div>` : ''}</div>
      <div class="modal-f">${isDean() && !mineL && App.needsDecision(l) && !App.decision(l) ? `<button class="btn" data-act="decide" data-d="accept" data-id="${l.id}">${ic('check')}موافقة</button><button class="btn ghost" data-act="decide" data-d="return" data-id="${l.id}">${ic('undo')}إعادة للقسم</button><button class="btn danger" data-act="decide" data-d="reject" data-id="${l.id}">${ic('x')}رفض</button>` : ''}
        ${!mineL && !isFac() ? `<button class="btn ${isDean() && App.needsDecision(l) && !App.decision(l) ? 'ghost' : ''}" data-act="compose" data-reply="${l.id}">${ic('undo')}رد</button>` : ''}
        ${isHead() && !mineL ? `<button class="btn soft" data-act="compose" data-fwd="${l.id}" data-to="staff">${ic('users')}تعميم على الكادر</button>` : ''}
        ${isDean() && !mineL ? `<button class="btn soft" data-act="compose" data-fwd="${l.id}" data-to="units">${ic('share')}إحالة إلى الشعب</button>` : ''}
        <span class="sp"></span><button class="btn ghost" data-act="close">إغلاق</button></div>`);
    if (!mineL && l.rcpt.some(c => c.user_id === m.id && !c.read_at)) api('read_letter', { id: l.id }).then(() => { App.dirty = true; }).catch(() => {});
  },
  compose(el) {
    const m = me(), rep = el.dataset.reply && ST.letters.find(x => x.id === el.dataset.reply), fwd = el.dataset.fwd && ST.letters.find(x => x.id === el.dataset.fwd), scan = !!el.dataset.scan;
    const opts = isHead() ? [['deanery', 'عمادة الكلية'], ['staff', 'تعميم على كل الكادر التدريسي'], ['ids', 'تدريسيون أو جهات محددة…']]
      : isDean() ? [['head', 'رئاسة قسم علوم الحياة'], ['units', 'كل شعب العمادة'], ['ids', 'جهات محددة…']] : [['deanery', 'عمادة الكلية']];
    const pre = fwd ? el.dataset.to : rep ? 'ids' : opts[0][0];
    const cand = ST.users.filter(x => x.active && x.id !== m.id && (isHead() || (isDean() && x.role !== 'faculty') || (isUnit() && ['dean', 'dean_asst'].includes(x.role))));
    App._files = []; Modal.closeAll();
    Modal.open(Modal.head(rep ? 'رد على كتاب' : fwd ? 'إحالة كتاب' : scan ? 'رفع كتاب جاهز' : 'كتاب جديد', (rep || fwd) ? h((rep || fwd).subject) : scan ? 'صوّر الكتاب الموقَّع أو ارفع ملفه، واكتب موضوعه فقط' : '') + `<form data-submit="sendLetter" data-parent="${(rep || fwd || {}).id || ''}" style="display:contents"><div class="modal-b">
      <div class="field"><label for="lt">إلى <span class="req">*</span></label><select class="input" id="lt" name="to" data-toggle-pick>${opts.map(([k, l]) => `<option value="${k}"${pre === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field" id="pick-box"${pre === 'ids' ? '' : ' hidden'}><label>اختر المستلمين</label><div class="pick">${cand.map(x => `<label class="check"><input type="checkbox" name="ids" value="${x.id}"${rep && rep.from_id === x.id ? ' checked' : ''}> ${h(x.position ? x.position + (x.role === 'faculty' || x.role === 'head' ? '' : '') : x.name)}${x.position && x.role !== 'unit' ? ' — ' + h(x.name) : ''}</label>`).join('')}</div></div>
      <div class="field"><label for="ls">الموضوع <span class="req">*</span></label><input class="input" id="ls" name="subject" required maxlength="200" value="${h(rep ? 'رد: ' + rep.subject : fwd ? fwd.subject : '')}"></div>
      ${scan ? App.attachBar('صورة الكتاب أو ملفه') : ''}
      <div class="field"><label for="lb">${scan ? 'ملاحظة (اختياري)' : 'نص الكتاب'}</label><textarea class="input" id="lb" name="body" style="min-height:${scan ? 80 : 150}px" maxlength="6000"${scan ? '' : ' autofocus'}>${h(fwd ? `\n\n— نص الكتاب المُحال (${fwd.ref}) —\n${fwd.body}` : '')}</textarea></div>
      ${scan ? '' : App.attachBar()}</div>
      <div class="modal-f"><button class="btn" type="submit">${ic('send')}إرسال</button><button class="btn ghost" type="button" data-act="close">إلغاء</button></div></form>`);
    const o = $('#modals').lastElementChild;
    $('[data-toggle-pick]', o).addEventListener('change', e => { $('#pick-box', o).hidden = e.target.value !== 'ids'; });
  },
  sendLetter(form) {
    const to = form.to.value, ids = $$('input[name=ids]:checked', form).map(i => i.value);
    if (to === 'ids' && !ids.length) return toast('اختر مستلماً واحداً على الأقل', true);
    if (form.closest('.modal').querySelector('h3').textContent.startsWith('رفع كتاب جاهز') && !App._files.length) return toast('أرفق صورة الكتاب أو ملفه أولاً', true);
    run($('button[type=submit]', form), async () => {
      await api('send_letter', { to, ids, subject: form.subject.value, body: form.body.value, parent_id: form.dataset.parent, files: await uploadFiles(App._files) });
      Modal.closeAll(); App.ui.letTab = 'out'; App.render(true); toast('أُرسل الكتاب');
    });
  },

  /* ───── notifications ───── */
  openNotifs() {
    const N = ST.notifs;
    Modal.open(Modal.head('الإشعارات') + `<div class="modal-b" style="padding:0"><div class="list">${N.map(n => `<button class="notif${n.read ? '' : ' new'}" data-act="goNotif" data-kind="${n.kind}" data-ref="${n.ref_id}"><span class="ti">${ic(n.kind === 'letter' ? 'mail' : 'file')}</span><span style="flex:1;min-width:0"><b style="font-weight:600;display:block">${h(n.body)}</b><span class="small muted">${ago(n.at)}</span></span></button>`).join('') || App.empty('لا توجد إشعارات', '', 'bell')}</div></div>`, { narrow: 1 });
    if (N.some(n => !n.read)) api('read_notifs').then(() => { const d = $('#ndot'); if (d) d.remove(); App.dirty = true; }).catch(() => {});
  },
  goNotif(el) {
    Modal.closeAll(); const { kind, ref } = el.dataset;
    if (kind === 'letter' && ST.letters.some(l => l.id === ref)) { location.hash = '#letters'; setTimeout(() => App.openLetter({ dataset: { id: ref } }), 60); }
    else if (ST.requests.some(r => r.id === ref)) App.openReq({ dataset: { id: ref } });
    else App.render(true);
  },

  /* ───── profile & settings ───── */
  v_profile() {
    const m = me(), s = ST.settings, standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return `<div class="cols" style="margin-top:8px"><div>
      <div class="card pad"><div class="who" style="margin-bottom:18px"><span class="avatar lg">${h(initials(m.name))}</span><div><b style="font-size:17px">${h(m.name)}</b><span>${h(m.position || RANK_LABEL[m.rank] || ROLE_LABEL[m.role])} · <span class="num">${h(m.username)}</span></span></div></div>
        <form data-submit="saveMe"><div class="grid2"><div class="field"><label for="mp">الهاتف</label><input class="input" id="mp" name="phone" dir="ltr" inputmode="tel" value="${h(m.phone || '')}" maxlength="20"></div>
        <div class="field"><label for="me">البريد الإلكتروني</label><input class="input" id="me" name="email" type="email" dir="ltr" value="${h(m.email || '')}" maxlength="100"></div></div>
        <button class="btn soft" type="submit">حفظ بيانات الاتصال</button></form></div>
      ${isHead() ? `<div class="sec-head"><h2>بيانات المؤسسة (تظهر في ترويسة الطباعة)</h2></div><div class="card pad"><form data-submit="saveOrg"><div class="grid2">
        <div class="field full"><label for="o1">الوزارة</label><input class="input" id="o1" name="ministry" value="${h(s.ministry)}" maxlength="120"></div>
        <div class="field"><label for="o2">الجامعة</label><input class="input" id="o2" name="university" value="${h(s.university)}" placeholder="مثال: جامعة ..." maxlength="120"></div>
        <div class="field"><label for="o3">الكلية</label><input class="input" id="o3" name="college" value="${h(s.college)}" maxlength="120"></div>
        <div class="field"><label for="o4">القسم</label><input class="input" id="o4" name="department" value="${h(s.department)}" maxlength="120"></div>
        <div class="field"><label for="o5">العام الدراسي</label><input class="input" id="o5" name="year" dir="ltr" value="${h(s.year)}" maxlength="20"></div></div>
        <button class="btn soft" type="submit">حفظ بيانات المؤسسة</button></form></div>` : ''}
    </div><div>
      <div class="card pad"><h3 style="font-size:16px;margin-bottom:12px">كلمة المرور</h3><form data-submit="changePass">
        ${App.pwField('p1', 'old', 'الحالية', 'current-password')}
        ${App.pwField('p2', 'nw', 'الجديدة (6 أحرف على الأقل)', 'new-password', 'minlength="6"')}
        <button class="btn soft block" type="submit">${ic('lock')}تغيير كلمة المرور</button></form></div>
      ${standalone ? '' : `<div class="card pad" style="margin-top:16px"><h3 style="font-size:16px;margin-bottom:6px">تنصيب التطبيق</h3><p class="small muted" style="margin-bottom:12px">${App.installEvt ? 'أضف BIORA كأيقونة على جهازك ليفتح مثل أي تطبيق.' : ios ? 'في Safari: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».' : 'من قائمة المتصفح (⋮) اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».'}</p>${App.installEvt ? `<button class="btn gold block" data-act="install">${ic('download')}تنصيب BIORA</button>` : ''}</div>`}
      <button class="btn ghost block" style="margin-top:16px" data-act="help">${ic('note')}دليل الاستخدام</button>
      <button class="btn danger block" style="margin-top:10px" data-act="logout">${ic('logout')}تسجيل الخروج</button>
      <p class="small muted" style="text-align:center;margin-top:14px">BIORA · ${h(s.department)} · <span class="num">${h(s.year)}</span></p></div></div>`;
  },
  help() {
    const r = me().role, S = (t, a) => `<div class="sub-h" style="margin-top:14px">${t}</div><ol style="margin:0;padding-inline-start:20px;line-height:2">${a.map(x => `<li>${x}</li>`).join('')}</ol>`;
    let b = '';
    if (r === 'faculty' || r === 'head') b += S('تقديم طلب', ['اضغط «طلب جديد» واختر نوع الطلب.', 'املأ الحقول (المعلَّمة بنجمة مطلوبة) وأرفق ملفاً إن احتجت.', 'اضغط «تقديم الطلب»، وسيصلك إشعار عند كل تغيّر في حالته.', 'إذا أُعيد الطلب إليك: افتحه، اقرأ السبب، ثم «تعديل وإعادة تقديم».']);
    if (r === 'head') b += S('البتّ بطلبات التدريسيين', ['الطلبات الواردة تظهر في «بانتظار قرارك».', 'افتح الطلب واختر: موافقة وإنجاز، تحويل إلى العمادة، إرجاع للتعديل، أو رفض.', 'كل طلب يُحفظ في «الأرشيف الكامل» ويمكن البحث عنه بالتاريخ أو الاسم.'])
      + S('الكادر والغيابات', ['من «الكادر» افتح ملف أي تدريسي لرؤية بياناته وإجازاته وغياباته.', 'من «الغيابات» اختر اليوم وحدّد الغائب أو المتأخر؛ الباقون حاضرون تلقائياً.', '«كلمة مرور جديدة» في ملف التدريسي تعطيه كلمة مؤقتة إن نسي كلمته.'])
      + S('المراسلات', ['«كتاب جديد» لإرسال كتاب إلى العمادة أو تعميم على الكادر.', 'كل كتاب ترسله إلى العمادة تظهر عليه حالته: بانتظار القرار، موافَق عليه، مُعاد، أو مرفوض مع السبب.', 'افتح أي كتاب وارد من العمادة واضغط «تعميم على الكادر» لإحالته.']);
    if (r === 'dean' || r === 'dean_asst') b += S('طلبات القسم', ['الطلبات المحوَّلة من رئاسة القسم تظهر في «بانتظار الإجراء».', 'افتح الطلب واختر: موافقة وإنجاز، تحويل إلى شعبة، إرجاع إلى القسم، أو رفض.']) + S('المراسلات', ['افتح كتاب القسم الوارد واختر: موافقة، إعادة للقسم، أو رفض مع السبب.', '«كتاب جديد» لمخاطبة رئاسة القسم أو الشعب.', 'افتح كتاباً وارداً واضغط «إحالة إلى الشعب» لتوجيهه.']);
    if (r === 'unit') b += S('الطلبات المحوَّلة', ['تظهر عندكم فقط الطلبات التي حوّلتها العمادة إلى شعبتكم.', 'افتح الطلب واضغط «تم الإنجاز»، أو «إرجاع إلى العمادة» مع السبب.']);
    b += S('عام', ['الجرس في الأعلى يعرض الإشعارات.', 'زر «طباعة» داخل أي طلب يخرجه بترويسة رسمية.', 'من «حسابي» يمكنك تغيير كلمة المرور وتنصيب التطبيق كأيقونة.']);
    Modal.open(Modal.head('دليل الاستخدام', h(ROLE_LABEL[r])) + `<div class="modal-b">${b}</div><div class="modal-f"><button class="btn" data-act="close">فهمت</button></div>`);
  },
  saveMe(form) { run($('button[type=submit]', form), async () => { await api('update_me', { phone: form.phone.value, email: form.email.value }); App.render(true); toast('حُفظت بيانات الاتصال'); }); },
  saveOrg(form) { run($('button[type=submit]', form), async () => { await api('save_settings', { ministry: form.ministry.value.trim(), university: form.university.value.trim(), college: form.college.value.trim(), department: form.department.value.trim(), year: form.year.value.trim() }); App.render(true); toast('حُفظت بيانات المؤسسة'); }); },
  changePass(form) { run($('button[type=submit]', form), async () => { await api('change_password', { old: form.old.value, new: form.nw.value }); Modal.closeAll(); App.render(true); toast('تم تغيير كلمة المرور'); }); },
  forcePassword() {
    Modal.open(Modal.head('اختر كلمة مرور خاصة بك', 'مطلوب عند أول دخول', true) + `<form data-submit="changePass" style="display:contents"><div class="modal-b"><p class="muted" style="margin-bottom:14px">لحماية حسابك، غيّر كلمة المرور المؤقتة إلى كلمة تعرفها أنت فقط.</p>
      ${App.pwField('fp1', 'old', 'كلمة المرور المؤقتة', 'current-password', 'autofocus')}
      ${App.pwField('fp2', 'nw', 'كلمة المرور الجديدة (6 أحرف على الأقل)', 'new-password', 'minlength="6"')}</div>
      <div class="modal-f"><button class="btn" type="submit">حفظ والمتابعة</button><button class="btn ghost" type="button" data-act="logout">خروج</button></div></form>`, { narrow: 1, locked: 1 });
  },
  async install() { if (!App.installEvt) return; App.installEvt.prompt(); try { await App.installEvt.userChoice; } catch {} App.installEvt = null; App.render(true); }
};

document.addEventListener('change', e => {
  if (e.target.matches('[data-attach]')) { addFiles(e.target.files).catch(er => toast(er.message, true)).finally(() => { e.target.value = ''; }); return; }
  if (e.target.matches('[data-act-day]')) { App.ui.absDay = e.target.value || today(); App.render(true); }
  if (e.target.matches('[data-act-month]')) { App.ui.absMonth = e.target.value || today().slice(0, 7); App.render(true); }
});
if ('serviceWorker' in navigator && !LOCAL) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
App.start();

['dragenter', 'dragover'].forEach(t => document.addEventListener(t, e => { const d = $('#drop'); if (!d || !e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return; e.preventDefault(); d.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => document.addEventListener(t, e => { const d = $('#drop'); if (!d) return; if (t === 'drop' && e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); addFiles(e.dataTransfer.files).catch(er => toast(er.message, true)); } if (t === 'drop' || !e.relatedTarget) d.classList.remove('over'); }));
document.addEventListener('pointermove', e => { const c = e.target.closest && e.target.closest('.stat,.type,.hero,.login-brand'); if (!c) return; const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); }, { passive: true });
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('label.att-btn')) { e.preventDefault(); e.target.querySelector('input').click(); } });
