'use strict';
/* BIORA — core: config, API, helpers, icons, request types */
const CFG = window.BIORA_CONFIG || {};
const LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const API_URL = (LOCAL ? '' : CFG.url) + '/rest/v1/rpc/api';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }
};
let token = store.get('biora_token');
let ST = null, U = {};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  file: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  calx: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM10 14l4 4M14 14l-4 4',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 7l-10 6L2 7',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  plus: 'M12 5v14M5 12h14', check: 'M20 6 9 17l-5-5', x: 'M18 6 6 18M6 6l12 12', chev: 'M15 18l-6-6 6-6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  printer: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  clip: 'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z', undo: 'M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  building: 'M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4',
  key: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zM15.5 7.5l3 3L22 7l-3-3',
  edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  trash: 'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  brief: 'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 13h20',
  swap: 'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  award: 'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.21 13.89 7 23l5-3 5 3-1.21-9.12',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  idcard: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 16a3 3 0 0 1 6 0M14 9h5M14 13h4',
  dots: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  share: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13',
  lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4',
  note: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n] || P.file}"/></svg>`;
const HELIX = cls => `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true"><path class="rung" d="M19 11h10M17.500 15h13M17.500 33h13M19 37h10M19 22h10M19 26h10"/><path d="M16 5c0 10 16 9 16 19S16 33 16 43"/><path d="M32 5c0 10-16 9-16 19s16 9 16 19"/></svg>`;
const HELIX_BG = `<svg class="helix-bg" viewBox="0 0 120 400" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M25 0c0 50 70 50 70 100s-70 50-70 100 70 50 70 100-70 50-70 100"/><path d="M95 0c0 50-70 50-70 100s70 50 70 100-70 50-70 100 70 50 70 100"/><path stroke-width="2" d="M36 22h48M30 40h60M30 60h60M36 78h48M36 122h48M30 140h60M30 160h60M36 178h48M36 222h48M30 240h60M30 260h60M36 278h48M36 322h48M30 340h60M30 360h60M36 378h48"/></svg>`;
const BRAND = `<div class="brand"><div class="brand-mark">${HELIX('')}</div><div><div class="brand-name">BIORA</div><div class="brand-sub">Biology Requests &amp; Administration</div></div></div>`;

/* ── dates ── */
const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const pad = n => String(n).padStart(2, '0');
const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoDay(new Date());
function fmtDate(v, withDay) {
  if (!v) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T00:00:00') : new Date(v);
  if (isNaN(d)) return h(v);
  return `${withDay ? DAYS[d.getDay()] + '، ' : ''}<span class="num">${d.getDate()}</span> ${MONTHS[d.getMonth()]} <span class="num">${d.getFullYear()}</span>`;
}
function fmtDT(v) {
  if (!v) return '—';
  const d = new Date(v); if (isNaN(d)) return h(v);
  let hr = d.getHours(); const ap = hr >= 12 ? 'م' : 'ص'; hr = hr % 12 || 12;
  return `${fmtDate(isoDay(d))}، <span class="num">${hr}:${pad(d.getMinutes())}</span> ${ap}`;
}
const plainDate = v => { const t = document.createElement('i'); t.innerHTML = fmtDate(v); return t.textContent; };
const plainDT = v => { const t = document.createElement('i'); t.innerHTML = fmtDT(v); return t.textContent; };
function ago(v) {
  const s = (Date.now() - new Date(v)) / 1000;
  if (s < 90) return 'الآن'; if (s < 3600) return `قبل ${Math.round(s / 60)} دقيقة`;
  if (s < 86400) return `قبل ${Math.round(s / 3600)} ساعة`; if (s < 172800) return 'أمس';
  return plainDate(isoDay(new Date(v)));
}
const dayCount = (a, b) => (a && b) ? Math.round((new Date(b) - new Date(a)) / 864e5) + 1 : 0;

/* ── API ── */
async function api(action, payload = {}) {
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(LOCAL ? {} : { apikey: CFG.key }) },
      body: JSON.stringify({ action, token, payload })
    });
  } catch { throw new Error('تعذّر الاتصال بالخادم. تحقق من اتصال الإنترنت ثم حاول مرة أخرى'); }
  let j = null; try { j = await res.json(); } catch {}
  if (!res.ok) {
    const m = (j && j.message) || 'حدث خطأ غير متوقع. حاول مرة أخرى';
    if (m === 'AUTH') { App.signOutLocal(); throw new Error('انتهت الجلسة. سجّل الدخول من جديد'); }
    throw new Error(/[؀-ۿ]/.test(m) ? m : 'حدث خطأ في الخادم. حاول مرة أخرى');
  }
  if (j && j.state) setState(j.state);
  return j || {};
}
function setState(s) { ST = s; U = {}; s.users.forEach(x => U[x.id] = x); }

/* ── roles & labels ── */
const me = () => ST.me;
const isHead = () => me().role === 'head', isFac = () => me().role === 'faculty';
const isDean = () => ['dean', 'dean_asst'].includes(me().role), isUnit = () => me().role === 'unit';
const uname = id => U[id] ? U[id].name : '—';
const upos = id => U[id] ? (U[id].position || U[id].name) : '—';
const initials = n => { const w = String(n || '').replace(/^(ا\.م\.د\.|ا\.م\.|م\.م\.|ا\.د\.|د\.|م\.)\s*/, '').trim(); return w.slice(0, 1) || '؟'; };
const ROLE_LABEL = { head: 'رئاسة القسم', faculty: 'تدريسي', dean: 'عميد الكلية', dean_asst: 'معاون العميد', unit: 'شعبة في العمادة' };
const RANKS = ['استاذ', 'استاذ مساعد', 'مدرس', 'مدرس مساعد'];
const RANK_LABEL = { 'استاذ': 'أستاذ', 'استاذ مساعد': 'أستاذ مساعد', 'مدرس': 'مدرس', 'مدرس مساعد': 'مدرس مساعد' };

const STATUS = {
  submitted: ['بانتظار رئاسة القسم', 'amber'], returned: ['مُعاد للتعديل', 'red'], at_dean: ['لدى العمادة', 'blue'],
  at_unit: ['لدى الجهة المختصة', 'violet'], returned_dept: ['مُعاد من العمادة', 'red'], done: ['منجز', 'green'],
  rejected: ['مرفوض', 'red'], withdrawn: ['مسحوب', 'gray']
};
const statusChip = r => {
  const [l, t] = STATUS[r.status] || [r.status, 'gray'];
  const lbl = r.status === 'at_unit' && r.assigned_to && U[r.assigned_to] ? 'لدى ' + upos(r.assigned_to) : l;
  return `<span class="chip ${t}">${h(lbl)}</span>`;
};
const EVENT = {
  submit: ['تقديم الطلب', '--g500'], resubmit: ['إعادة التقديم بعد التعديل', '--g500'], withdraw: ['سحب الطلب', '--ink-3'],
  approve: ['موافقة وإنجاز', '--g600'], reject: ['رفض الطلب', '--red'], return: ['إرجاع الطلب', '--red'],
  forward: ['تحويل إلى العمادة', '--blue'], assign: ['تحويل إلى جهة مختصة', '--violet'], complete: ['إنجاز من الشعبة', '--g600'],
  back: ['إرجاع إلى العمادة', '--amber'], note: ['ملاحظة', '--gold']
};

/* ── request types ── */
const sel = (...o) => o;
const TYPES = [
  { k: 'leave', label: 'طلب إجازة', icon: 'sun', desc: 'اعتيادية، مرضية أو اضطرارية', f: [
    { k: 'kind', l: 'نوع الإجازة', t: 'select', o: sel('اعتيادية', 'مرضية', 'اضطرارية'), req: 1 },
    { k: 'from', l: 'من تاريخ', t: 'date', req: 1, half: 1 }, { k: 'to', l: 'إلى تاريخ', t: 'date', req: 1, half: 1 },
    { k: 'reason', l: 'سبب الإجازة', t: 'area', req: 1 },
    { k: 'substitute', l: 'التدريسي البديل للمحاضرات (إن وجد)', t: 'staff' },
    { k: 'address', l: 'العنوان أثناء الإجازة (اختياري)', t: 'text' }] },
  { k: 'continuity', label: 'استمرارية بالدوام', icon: 'clock', desc: 'تأييد استمرارية الدوام', f: [
    { k: 'to', l: 'الجهة المعنون إليها التأييد', t: 'text', req: 1 }, { k: 'purpose', l: 'الغرض من التأييد', t: 'area', req: 1 }] },
  { k: 'commence', label: 'تأييد مباشرة', icon: 'check', desc: 'بعد الإجازة أو الانفكاك', f: [
    { k: 'after', l: 'المباشرة بعد', t: 'select', o: sel('إجازة', 'انفكاك', 'إيفاد', 'مهمة رسمية'), req: 1, half: 1 },
    { k: 'date', l: 'تاريخ المباشرة', t: 'date', req: 1, half: 1 },
    { k: 'order', l: 'رقم وتاريخ الأمر الإداري (إن وجد)', t: 'text' }, { k: 'notes', l: 'ملاحظات', t: 'area' }] },
  { k: 'noobjection', label: 'تأييد عدم ممانعة', icon: 'shield', desc: 'للسفر، الدراسة، النشر وغيرها', f: [
    { k: 'purpose', l: 'الغرض', t: 'select', o: sel('السفر', 'إكمال الدراسة', 'النشر العلمي', 'العمل خارج أوقات الدوام', 'أخرى'), req: 1 },
    { k: 'to', l: 'الجهة المعنون إليها', t: 'text', req: 1 },
    { k: 'from', l: 'من تاريخ (إن وجد)', t: 'date', half: 1 }, { k: 'to_date', l: 'إلى تاريخ (إن وجد)', t: 'date', half: 1 },
    { k: 'details', l: 'التفاصيل', t: 'area', req: 1 }] },
  { k: 'jobcert', label: 'تأييد عنوان أو خدمة وظيفية', icon: 'idcard', desc: 'عنوان وظيفي أو خدمة وظيفية', f: [
    { k: 'kind', l: 'نوع التأييد', t: 'select', o: sel('تأييد عنوان وظيفي', 'تأييد خدمة وظيفية'), req: 1 },
    { k: 'to', l: 'الجهة المعنون إليها', t: 'text', req: 1 }, { k: 'purpose', l: 'الغرض (اختياري)', t: 'area' }] },
  { k: 'event', label: 'المشاركة في فعالية علمية', icon: 'award', desc: 'مؤتمر، ندوة، دورة أو ورشة', f: [
    { k: 'kind', l: 'نوع الفعالية', t: 'select', o: sel('مؤتمر', 'ندوة', 'دورة تدريبية', 'ورشة عمل'), req: 1, half: 1 },
    { k: 'part', l: 'نوع المشاركة', t: 'select', o: sel('باحث', 'محاضر', 'حضور', 'لجنة تنظيمية'), req: 1, half: 1 },
    { k: 'title', l: 'عنوان الفعالية', t: 'text', req: 1 }, { k: 'organizer', l: 'الجهة المنظمة', t: 'text', req: 1, half: 1 },
    { k: 'place', l: 'مكان الانعقاد', t: 'text', req: 1, half: 1 },
    { k: 'from', l: 'من تاريخ', t: 'date', req: 1, half: 1 }, { k: 'to', l: 'إلى تاريخ', t: 'date', req: 1, half: 1 },
    { k: 'paper', l: 'عنوان البحث أو المحاضرة (إن وجد)', t: 'text' }] },
  { k: 'mission', label: 'تكليف بمهمة رسمية أو إيفاد', icon: 'brief', desc: 'مهمة رسمية أو إيفاد', f: [
    { k: 'kind', l: 'النوع', t: 'select', o: sel('مهمة رسمية', 'إيفاد'), req: 1 }, { k: 'place', l: 'الجهة / المكان', t: 'text', req: 1 },
    { k: 'from', l: 'من تاريخ', t: 'date', req: 1, half: 1 }, { k: 'to', l: 'إلى تاريخ', t: 'date', req: 1, half: 1 },
    { k: 'purpose', l: 'الغرض من المهمة', t: 'area', req: 1 }] },
  { k: 'swap', label: 'تغيير أو تبديل محاضرة', icon: 'swap', desc: 'تغيير موعد أو تبديل مع تدريسي', f: [
    { k: 'course', l: 'المادة الدراسية', t: 'text', req: 1, half: 1 },
    { k: 'stage', l: 'المرحلة', t: 'select', o: sel('الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الدراسات العليا'), req: 1, half: 1 },
    { k: 'old', l: 'موعد المحاضرة الحالي', t: 'dt', req: 1, half: 1 }, { k: 'new', l: 'الموعد الجديد (إن وجد)', t: 'dt', half: 1 },
    { k: 'with', l: 'التبديل مع التدريسي (إن وجد)', t: 'staff' }, { k: 'reason', l: 'السبب', t: 'area', req: 1 }] },
  { k: 'nolectures', label: 'تأييد عدم وجود محاضرات', icon: 'calx', desc: 'خلال فترة معينة', f: [
    { k: 'from', l: 'من تاريخ', t: 'date', req: 1, half: 1 }, { k: 'to', l: 'إلى تاريخ', t: 'date', req: 1, half: 1 },
    { k: 'purpose', l: 'الغرض من التأييد', t: 'area', req: 1 }] },
  { k: 'other', label: 'طلب آخر', icon: 'dots', desc: 'شؤون إدارية ووظيفية أخرى', f: [
    { k: 'subject', l: 'موضوع الطلب', t: 'text', req: 1 }, { k: 'details', l: 'تفاصيل الطلب', t: 'area', req: 1 }] }
];
const TYPE = Object.fromEntries(TYPES.map(t => [t.k, t]));
const typeLabel = r => { const t = TYPE[r.type]; if (!t) return r.type; return r.type === 'leave' && r.data.kind ? `إجازة ${r.data.kind}` : (r.type === 'other' && r.data.subject) ? r.data.subject : t.label; };
function fieldText(f, v) {
  if (v == null || v === '') return '';
  if (f.t === 'date') return plainDate(v);
  if (f.t === 'dt') return plainDT(v);
  if (f.t === 'staff') return uname(v);
  return String(v);
}
function summary(r) {
  const d = r.data || {}, t = TYPE[r.type]; if (!t) return '';
  if (d.from && d.to && /^\d{4}/.test(d.from)) {
    const n = dayCount(d.from, d.to);
    const lead = d.title || d.place || '';
    return `${lead ? lead + ' — ' : ''}من ${plainDate(d.from)} إلى ${plainDate(d.to)} (${n} ${n > 10 ? 'يوماً' : n > 2 ? 'أيام' : n === 2 ? 'يومان' : 'يوم'})`;
  }
  const parts = t.f.filter(f => d[f.k] && f.t !== 'area').slice(0, 2).map(f => fieldText(f, d[f.k]));
  return parts.join(' — ') || (d.details || d.purpose || d.reason || '');
}
const needsMe = r => {
  const m = me();
  if (r.user_id === m.id) return r.status === 'returned';
  if (m.role === 'head') return ['submitted', 'returned_dept'].includes(r.status);
  if (isDean()) return r.status === 'at_dean';
  if (m.role === 'unit') return r.status === 'at_unit' && r.assigned_to === m.id;
  return false;
};
const isOpen = r => !['done', 'rejected', 'withdrawn'].includes(r.status);
const onLeave = (uid, day) => ST.requests.some(r => r.user_id === uid && r.type === 'leave' && r.status === 'done' && r.data.from <= day && r.data.to >= day);

/* ── toasts ── */
function toast(msg, bad) {
  const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : '');
  t.innerHTML = ic(bad ? 'x' : 'check') + `<span>${h(msg)}</span>`;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, bad ? 4600 : 2600);
}

/* ── modals ── */
const Modal = {
  open(html, { narrow, locked } = {}) {
    const o = document.createElement('div'); o.className = 'overlay';
    o.innerHTML = `<div class="modal${narrow ? ' narrow' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    if (!locked) o.addEventListener('mousedown', e => { if (e.target === o) Modal.close(o); });
    o.dataset.locked = locked ? '1' : '';
    $('#modals').appendChild(o);
    const f = $('[autofocus]', o); if (f) setTimeout(() => f.focus(), 60);
    return o;
  },
  close(o) { o = o || $('#modals').lastElementChild; if (!o) return; o.remove(); if (!$('#modals').children.length && App.dirty) App.render(); },
  closeAll() { $('#modals').innerHTML = ''; },
  any: () => $('#modals').children.length > 0,
  head: (title, sub, locked) => `<div class="modal-h"><h3>${title}${sub ? `<span class="sub">${sub}</span>` : ''}</h3>${locked ? '' : `<button class="icon-btn" data-act="close" aria-label="إغلاق">${ic('x')}</button>`}</div>`
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && Modal.any()) { const o = $('#modals').lastElementChild; if (!o.dataset.locked) Modal.close(o); } });

/* run an async action from a button with loading state + error toast */
async function run(btn, fn) {
  if (btn && btn.disabled) return;
  let old; if (btn) { btn.disabled = true; old = btn.innerHTML; btn.innerHTML = '<span class="spin"></span>'; if (!btn.classList.contains('btn') || btn.classList.contains('ghost') || btn.classList.contains('soft') || btn.classList.contains('danger')) btn.innerHTML = old; }
  try { return await fn(); }
  catch (e) { toast(e.message || 'حدث خطأ', true); }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = old; } }
}

/* files */
function readFiles(input) {
  return Promise.all([...input.files].map(f => new Promise((ok, no) => {
    if (f.size > 2 * 1024 * 1024) return no(new Error(`الملف «${f.name}» أكبر من 2 ميغابايت`));
    const fr = new FileReader();
    fr.onload = () => ok({ name: f.name, mime: f.type || 'application/octet-stream', data: String(fr.result).split(',')[1] });
    fr.onerror = () => no(new Error('تعذّرت قراءة الملف')); fr.readAsDataURL(f);
  })));
}
async function openFile(id) {
  const f = await api('get_file', { id });
  const bin = atob(f.data), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([a], { type: f.mime || 'application/octet-stream' }));
  const l = document.createElement('a'); l.href = url;
  if (/^(image|application\/pdf)/.test(f.mime || '')) { l.target = '_blank'; l.rel = 'noopener'; } else l.download = f.name;
  document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function downloadCSV(name, rows) {
  const csv = '﻿' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const l = document.createElement('a'); l.href = url; l.download = name; document.body.appendChild(l); l.click(); l.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
