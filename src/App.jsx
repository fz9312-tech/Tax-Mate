import { useState } from "react";
import React from "react";

// ════════════════════════════════════════════════════════════
//  THEME
// ════════════════════════════════════════════════════════════
const C = {
  bg:         "#0D1117",
  surface:    "#161B22",
  surfaceAlt: "#1C2333",
  border:     "#30363D",
  text:       "#E6EDF3",
  muted:      "#8B949E",
  dim:        "#484F58",
  green:      "#3FB950",
  yellow:     "#E3B341",
  red:        "#F85149",
  blue:       "#388BFD",
  accent:     "#F78166",
  teal:       "#39D3BB",
  purple:     "#A371F7",
};

// ════════════════════════════════════════════════════════════
//  CONSTANTS
// ════════════════════════════════════════════════════════════
const SUPER_RATE      = 0.115;
const PAYG_RATE       = 0.19;
const CASUAL_LOADING  = 0.25;
const OT_RATE         = 1.5;
const WKND_RATE       = 1.75;
const GST_THRESHOLD   = 82.50;

const ENTERTAINMENT_KW = [
  "lunch","dinner","drinks","meal","cafe","café","restaurant",
  "bar","party","event","celebration","function","coffee","breakfast",
];
const DEDUCTION_MAP = {
  packaging:   { kw: ["packaging","box","bag","container","wrap"],                              label: "Packaging" },
  cleaning:    { kw: ["clean","sanitise","sanitize","mop","detergent","hygiene"],               label: "Cleaning & Hygiene" },
  software:    { kw: ["xero","myob","software","app","subscription","saas"],                    label: "Software & Subscriptions" },
  advertising: { kw: ["ads","advertising","marketing","facebook","google","instagram","flyer"], label: "Advertising" },
  accounting:  { kw: ["accountant","bookkeeper","tax agent","bas agent"],                       label: "Accounting & Professional Fees" },
};

const EXP_CATEGORIES = [
  "ingredients","rent","utilities","equipment",
  "packaging","cleaning","software","advertising","accounting","other",
];
const INS_TYPES = [
  "Workers Compensation","Public Liability","Equipment & Property",
  "Business Interruption","Product Liability","Cyber Insurance","Other",
];

// ── Document Hub constants ────────────────────────────────
const DOC_CATEGORIES = [
  "Invoice","Receipt","Insurance Document","Payroll Report",
  "Bank Statement","POS Export","BAS Notice","Accountant Note","Contract","Other",
];
const BAS_QUARTERS = ["Q1 FY2026","Q2 FY2026","Q3 FY2026","Q4 FY2026","Q1 FY2025","Q2 FY2025","Q3 FY2025","Q4 FY2025"];
const FIN_YEARS    = ["FY2026","FY2025","FY2024"];
const DOC_ICONS    = {
  "application/pdf":"📄","image/jpeg":"🖼️","image/png":"🖼️",
  "application/vnd.ms-excel":"📊",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"📊",
  "text/csv":"📊","application/msword":"📝",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":"📝",
  default:"📎",
};
const docIcon = type => DOC_ICONS[type] || DOC_ICONS.default;
const fmtSize = b => b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(1)}KB` : `${(b/1048576).toFixed(1)}MB`;
const DOC_STATUS = { verified:"Verified", pending:"Pending Review", missing:"Missing" };

// ════════════════════════════════════════════════════════════
//  SEED DATA
// ════════════════════════════════════════════════════════════
const SEED_REVENUE = [
  { id:1, date:"2025-07-01", amount:2670 },
  { id:2, date:"2025-07-02", amount:2510 },
  { id:3, date:"2025-07-03", amount:2720 },
  { id:4, date:"2025-07-04", amount:3720 },
  { id:5, date:"2025-07-05", amount:3290 },
];

const SEED_EXPENSES = [
  { id:1,  date:"2025-07-01", cat:"ingredients", amount:3200, gst:true,  invoice:true,  desc:"Weekly produce & meat" },
  { id:2,  date:"2025-07-01", cat:"rent",        amount:4800, gst:true,  invoice:true,  desc:"Monthly rent" },
  { id:3,  date:"2025-07-02", cat:"utilities",   amount:620,  gst:true,  invoice:false, desc:"Gas & electricity" },
  { id:4,  date:"2025-07-03", cat:"equipment",   amount:1100, gst:true,  invoice:true,  desc:"Commercial blender" },
  { id:5,  date:"2025-07-04", cat:"other",       amount:340,  gst:false, invoice:false, desc:"Team lunch at Café Central" },
  { id:6,  date:"2025-07-05", cat:"other",       amount:95,   gst:false, invoice:false, desc:"Staff drinks end of month" },
  { id:7,  date:"2025-07-06", cat:"other",       amount:210,  gst:false, invoice:false, desc:"Packaging materials" },
  { id:8,  date:"2025-07-07", cat:"other",       amount:88,   gst:false, invoice:false, desc:"Xero subscription" },
  { id:9,  date:"2025-07-08", cat:"other",       amount:450,  gst:false, invoice:false, desc:"Facebook ads campaign" },
  { id:10, date:"2025-07-09", cat:"ingredients", amount:2900, gst:true,  invoice:false, desc:"Weekly produce" },
];

// Employee profile: personal + employment + standard hours
const SEED_EMPLOYEES = [
  { id:1, name:"Mei Lin",      email:"mei.lin@email.com",    phone:"0412 345 678",
    dob:"1990-03-14", nok_name:"David Lin",    nok_phone:"0412 000 001",
    role:"Head Chef",    type:"full-time", rate:32.00, std_hrs:38,
    start:"2022-01-10", tfn:true,  superfund:"AustralianSuper" },
  { id:2, name:"James Tran",   email:"james.tran@email.com", phone:"0421 987 654",
    dob:"1995-07-22", nok_name:"Susan Tran",   nok_phone:"0421 000 002",
    role:"Floor Staff",  type:"part-time",hourly_rate:24.50, rate:24.50, std_hrs:20,
    start:"2023-03-01", tfn:true,  superfund:"REST Super" },
  { id:3, name:"Anika Sharma", email:"anika.s@email.com",    phone:"0435 111 222",
    dob:"1998-11-05", nok_name:"Raj Sharma",   nok_phone:"0435 000 003",
    role:"Cashier",      type:"casual",    rate:22.00, std_hrs:15,
    start:"2023-09-15", tfn:true,  superfund:"Hostplus" },
  { id:4, name:"Tom Nguyen",   email:"tom.nguyen@email.com", phone:"0400 333 444",
    dob:"1988-02-28", nok_name:"Linda Nguyen", nok_phone:"0400 000 004",
    role:"Sous Chef",    type:"full-time", rate:29.00, std_hrs:38,
    start:"2024-01-08", tfn:false, superfund:"AustralianSuper" },
];

// Timesheet: one row = one employee × one week
// std_hrs = standard hours worked, ot_hrs = overtime, wknd_hrs = weekend/PH
const SEED_TIMESHEETS = [
  { id:1,  eid:1, week:"2025-W26", std_hrs:38, ot_hrs:0,  wknd_hrs:0, super_paid:true  },
  { id:2,  eid:2, week:"2025-W26", std_hrs:20, ot_hrs:0,  wknd_hrs:0, super_paid:true  },
  { id:3,  eid:3, week:"2025-W26", std_hrs:15, ot_hrs:0,  wknd_hrs:2, super_paid:true  },
  { id:4,  eid:4, week:"2025-W26", std_hrs:38, ot_hrs:2,  wknd_hrs:0, super_paid:true  },
  { id:5,  eid:1, week:"2025-W27", std_hrs:38, ot_hrs:4,  wknd_hrs:0, super_paid:false },
  { id:6,  eid:2, week:"2025-W27", std_hrs:22, ot_hrs:0,  wknd_hrs:4, super_paid:false },
  { id:7,  eid:3, week:"2025-W27", std_hrs:15, ot_hrs:0,  wknd_hrs:4, super_paid:false },
  { id:8,  eid:4, week:"2025-W27", std_hrs:38, ot_hrs:0,  wknd_hrs:0, super_paid:false },
  { id:9,  eid:1, week:"2025-W28", std_hrs:38, ot_hrs:2,  wknd_hrs:8, super_paid:false },
  { id:10, eid:2, week:"2025-W28", std_hrs:20, ot_hrs:0,  wknd_hrs:4, super_paid:false },
  { id:11, eid:3, week:"2025-W28", std_hrs:15, ot_hrs:0,  wknd_hrs:6, super_paid:false },
  { id:12, eid:4, week:"2025-W28", std_hrs:38, ot_hrs:3,  wknd_hrs:0, super_paid:false },
];

const SEED_INSURANCE = [
  { id:1, type:"Workers Compensation", annual:3400, notes:"Renewal due Oct 2025" },
  { id:2, type:"Public Liability",     annual:1200, notes:"$10M cover" },
  { id:3, type:"Equipment & Property", annual:2100, notes:"Fitout & kitchen equipment" },
];

// Leave taken records  { eid, type: "annual"|"personal"|"lieu", date, hours, notes }
// Leave accruals are computed from timesheets — only stored data is leave *taken*
const SEED_LEAVE = [
  { id:1, eid:1, type:"annual",   date:"2025-06-15", hours:38, notes:"Annual leave — family holiday" },
  { id:2, eid:2, type:"personal", date:"2025-06-20", hours:8,  notes:"Sick day" },
  { id:3, eid:1, type:"lieu",     date:"2025-07-01", hours:7.6,notes:"Lieu for Australia Day shift" },
  { id:4, eid:4, type:"annual",   date:"2025-07-05", hours:19, notes:"2.5 days leave" },
];

const SEED_DOCUMENTS = [
  { id:1,  name:"July_Produce_Invoice.pdf",    size:184320, type:"application/pdf",   cat:"Invoice",           supplier:"Fresh Fields Markets",  emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:true,  status:"verified", date:"2025-07-01", notes:"Weekly produce delivery" },
  { id:2,  name:"Monthly_Rent_Invoice.pdf",    size:98304,  type:"application/pdf",   cat:"Invoice",           supplier:"Harbour Property Mgmt", emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:true,  status:"verified", date:"2025-07-01", notes:"Monthly premises rent" },
  { id:3,  name:"Gas_Electricity_Jul.pdf",     size:72192,  type:"application/pdf",   cat:"Receipt",           supplier:"AGL Energy",            emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:true,  status:"pending",  date:"2025-07-02", notes:"Utilities bill — invoice missing" },
  { id:4,  name:"Blender_Equipment.pdf",       size:156672, type:"application/pdf",   cat:"Invoice",           supplier:"Kitchen Pro Supplies",   emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:true,  status:"verified", date:"2025-07-03", notes:"Commercial blender purchase" },
  { id:5,  name:"Workers_Comp_Policy.pdf",     size:512000, type:"application/pdf",   cat:"Insurance Document",supplier:"Allianz Australia",      emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:false, status:"verified", date:"2025-07-01", notes:"Annual Workers Comp renewal" },
  { id:6,  name:"Jul_POS_Export.csv",          size:24576,  type:"text/csv",          cat:"POS Export",        supplier:"Square POS",            emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:false, status:"verified", date:"2025-07-05", notes:"July daily sales export" },
  { id:7,  name:"BAS_Q4FY25_Notice.pdf",       size:203776, type:"application/pdf",   cat:"BAS Notice",        supplier:"ATO",                   emp_id:null, quarter:"Q4 FY2025", fy:"FY2025", gst:false, status:"verified", date:"2025-07-28", notes:"Q4 FY2025 BAS lodgment confirmation" },
  { id:8,  name:"Payroll_Mei_Jun.xlsx",        size:40960,  type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", cat:"Payroll Report", supplier:null, emp_id:1, quarter:"Q4 FY2025", fy:"FY2025", gst:false, status:"verified", date:"2025-06-28", notes:"Mei Lin June payroll" },
  { id:9,  name:"Accountant_FY25_Notes.pdf",   size:311296, type:"application/pdf",   cat:"Accountant Note",   supplier:"Smith & Co Accountants",emp_id:null, quarter:"Q4 FY2025", fy:"FY2025", gst:false, status:"verified", date:"2025-07-15", notes:"Year-end review notes" },
  { id:10, name:"Facebook_Ads_Receipt.pdf",    size:61440,  type:"application/pdf",   cat:"Receipt",           supplier:"Meta Platforms",        emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:true,  status:"missing",  date:"2025-07-08", notes:"Facebook ads — invoice not yet received" },
  { id:11, name:"Jul_Bank_Statement.pdf",      size:425984, type:"application/pdf",   cat:"Bank Statement",    supplier:"Commonwealth Bank",     emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:false, status:"verified", date:"2025-07-31", notes:"July business account statement" },
  { id:12, name:"Xero_Subscription.pdf",       size:32768,  type:"application/pdf",   cat:"Invoice",           supplier:"Xero",                  emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:true,  status:"verified", date:"2025-07-07", notes:"Monthly subscription" },
];

// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════
const today    = new Date();
const todayStr = today.toISOString().split("T")[0];
const quarter  = `Q${Math.ceil((today.getMonth()+1)/3)} ${today.getFullYear()}`;

const money = n =>
  "$" + Math.abs(n).toLocaleString("en-AU",{ minimumFractionDigits:2, maximumFractionDigits:2 });

const calcAge = dob => {
  if (!dob) return null;
  const b = new Date(dob), now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) a--;
  return a;
};

// Effective hourly rate (casual gets +25% loading)
const effRate = emp =>
  emp.type === "casual" ? emp.rate * (1 + CASUAL_LOADING) : emp.rate;

// Gross wages for a single timesheet row
const calcGross = (emp, ts) =>
  effRate(emp) * ts.std_hrs
  + effRate(emp) * OT_RATE  * ts.ot_hrs
  + effRate(emp) * WKND_RATE * ts.wknd_hrs;

// Annotate timesheets with computed wages
const annotateTimesheets = (employees, timesheets) =>
  timesheets.map(ts => {
    const emp = employees.find(e => e.id === ts.eid);
    if (!emp) return null;
    const gross  = calcGross(emp, ts);
    const super_ = gross * SUPER_RATE;
    const payg   = gross * PAYG_RATE;
    return { ...ts, emp, gross, super: super_, payg, labour: gross + super_ + payg,
             total_hrs: ts.std_hrs + ts.ot_hrs + ts.wknd_hrs };
  }).filter(Boolean);

// ── Leave accrual ──────────────────────────────────────────
// Annual leave:   FT/PT only — 4 weeks (152 hrs) per year = 152/52 hrs per week of std_hrs
// Personal leave: FT/PT only — 10 days (76 hrs) per year  = 76/52  hrs per week of std_hrs
// Day in Lieu:    All types  — accrues hour-for-hour from OT + weekend/PH hours worked
const ANNUAL_ACCRUAL_PER_WEEK  = 152 / 52;   // ~2.923 hrs per week
const PERSONAL_ACCRUAL_PER_WEEK = 76 / 52;   // ~1.462 hrs per week

// hrs per working day for an employee (std_hrs / 5 days)
const hrsPerDay = emp => emp.std_hrs / 5;

function calcLeaveAccruals(emp, timesheets) {
  const empTs = timesheets.filter(t => t.eid === emp.id);
  const isCasual = emp.type === "casual";
  // Each timesheet row = 1 week worked
  const weeksWorked = empTs.length;
  const annual   = isCasual ? 0 : weeksWorked * ANNUAL_ACCRUAL_PER_WEEK;
  const personal = isCasual ? 0 : weeksWorked * PERSONAL_ACCRUAL_PER_WEEK;
  const lieu     = empTs.reduce((s,t) => s + t.ot_hrs + t.wknd_hrs, 0); // hour for hour
  return { annual, personal, lieu };
}

function calcLeaveTaken(emp, leaveRecords) {
  const el = leaveRecords.filter(l => l.eid === emp.id);
  return {
    annual:   el.filter(l => l.type==="annual").reduce((s,l) => s+l.hours, 0),
    personal: el.filter(l => l.type==="personal").reduce((s,l) => s+l.hours, 0),
    lieu:     el.filter(l => l.type==="lieu").reduce((s,l) => s+l.hours, 0),
  };
}

// Analyse expenses for Tax Saver
const analyseExpenses = expenses =>
  expenses.map(e => {
    const d   = e.desc.toLowerCase();
    const ent = ENTERTAINMENT_KW.some(k => d.includes(k));
    let suggestion = null;
    if (e.cat === "other") {
      for (const [cat, { kw, label }] of Object.entries(DEDUCTION_MAP))
        if (kw.some(k => d.includes(k))) { suggestion = { cat, label }; break; }
    }
    let gstStatus = "not-claimable";
    if      (e.gst && e.invoice)                              gstStatus = "claimable";
    else if (e.gst && !e.invoice && e.amount > GST_THRESHOLD) gstStatus = "missing-invoice";
    else if (e.gst && !e.invoice)                             gstStatus = "claimable";
    else if (!e.gst && !ent && e.amount > GST_THRESHOLD)      gstStatus = "review";
    const entFlag = ent
      ? (e.amount >= 300
          ? { level:"red",    msg:"High-value entertainment — FBT may apply. Review with your accountant." }
          : { level:"yellow", msg:"Entertainment expenses have limited GST and income tax deductibility." })
      : null;
    return { ...e, gstStatus, suggestion, ent, entFlag };
  });

// Avatar
const AVATAR_COLORS = ["#E05D44","#F0A500","#3B82F6","#10B981","#8B5CF6","#EC4899","#F97316","#06B6D4"];
const avatarBg  = id  => AVATAR_COLORS[(id - 1) % AVATAR_COLORS.length];
const initials  = name => name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

// ── Report data builders ──────────────────────────────────
function buildBASData(revenue, expenses, timesheets, employees, insurance, docs, quarter) {
  const ts   = annotateTimesheets(employees, timesheets);
  const totalRev  = revenue.reduce((s,r) => s + r.amount, 0);
  const gstColl   = totalRev / 11;
  const gstCreds  = expenses.filter(e => e.gst).reduce((s,e) => s + e.amount/11, 0);
  const netGST    = gstColl - gstCreds;
  const totalWages= ts.reduce((s,t) => s + t.gross,  0);
  const totalPayg = ts.reduce((s,t) => s + t.payg,   0);
  const totalSuper= ts.reduce((s,t) => s + t.super,  0);
  const totalIns  = insurance.reduce((s,i) => s + i.annual/4, 0); // quarterly
  const totalExp  = expenses.reduce((s,e) => s + e.amount, 0);
  const missingInv= expenses.filter(e => e.gst && !e.invoice && e.amount > GST_THRESHOLD).length;
  const missingDocs= docs.filter(d => d.status === "missing" && d.quarter === quarter).length;
  const pendingDocs= docs.filter(d => d.status === "pending" && d.quarter === quarter).length;
  const verifiedDocs=docs.filter(d => d.status === "verified" && d.quarter === quarter).length;
  const estBAS    = netGST + totalPayg;
  // Warnings
  const warnings = [];
  if (missingInv > 0)  warnings.push(`${missingInv} expense${missingInv>1?"s":""} missing a tax invoice — GST credits may be reduced.`);
  if (missingDocs > 0) warnings.push(`${missingDocs} document${missingDocs>1?"s":""} marked as missing for this quarter.`);
  if (pendingDocs > 0) warnings.push(`${pendingDocs} document${pendingDocs>1?"s":""} awaiting review.`);
  if (timesheets.filter(t=>!t.super_paid).length > 0) warnings.push("Some super contributions have not been marked as paid.");
  if (totalRev === 0) warnings.push("No revenue has been entered for this period.");
  return { totalRev, gstColl, gstCreds, netGST, totalWages, totalPayg, totalSuper,
           totalIns, totalExp, missingInv, missingDocs, pendingDocs, verifiedDocs,
           estBAS, warnings, docCount: verifiedDocs };
}

function buildAnnualData(revenue, expenses, timesheets, employees, insurance, docs) {
  const ts       = annotateTimesheets(employees, timesheets);
  const totalRev = revenue.reduce((s,r) => s + r.amount, 0);
  const totalExp = expenses.reduce((s,e) => s + e.amount, 0);
  const bycat    = EXP_CATEGORIES.reduce((acc,c) => {
    acc[c] = expenses.filter(e=>e.cat===c).reduce((s,e)=>s+e.amount,0); return acc;
  }, {});
  const totalWages= ts.reduce((s,t) => s + t.gross,  0);
  const totalPayg = ts.reduce((s,t) => s + t.payg,   0);
  const totalSuper= ts.reduce((s,t) => s + t.super,  0);
  const totalIns  = insurance.reduce((s,i) => s + i.annual, 0);
  const assetPurch= expenses.filter(e => e.cat==="equipment");
  const missingInv= expenses.filter(e => e.gst && !e.invoice && e.amount > GST_THRESHOLD);
  // Quarter snapshots — fake 4 quarters from available data (demo)
  const qSnaps = BAS_QUARTERS.slice(0,4).map(q => {
    const d = buildBASData(revenue, expenses, timesheets, employees, insurance, docs, q);
    return { q, ...d };
  });
  const totalDocs = docs.length;
  const verifiedDocs = docs.filter(d => d.status==="verified").length;
  const warnings = [];
  if (missingInv.length > 0) warnings.push(`${missingInv.length} expense${missingInv.length>1?"s":""} missing a tax invoice across the financial year.`);
  if (assetPurch.length > 0) warnings.push(`${assetPurch.length} equipment purchase${assetPurch.length>1?"s":""} recorded — confirm if instant asset write-off applies.`);
  if (totalDocs < 5) warnings.push("Document count is low — ensure all supporting records are uploaded.");
  return { totalRev, totalExp, bycat, totalWages, totalPayg, totalSuper, totalIns,
           assetPurch, missingInv, qSnaps, totalDocs, verifiedDocs, warnings };
}

// ════════════════════════════════════════════════════════════
//  CSS
// ════════════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Sora:wght@400;500;600;700&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: ${C.bg}; color: ${C.text}; font-family: 'Sora', sans-serif; min-height: 100vh; }
::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: ${C.bg}; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }

/* ── Layout ── */
.layout   { display: flex; min-height: 100vh; }
.sidebar  { width: 220px; background: ${C.surface}; border-right: 1px solid ${C.border}; display: flex; flex-direction: column; padding: 20px 12px; position: fixed; inset: 0 auto 0 0; overflow-y: auto; z-index: 50; }
.main     { margin-left: 220px; flex: 1; padding: 28px 32px; }

/* ── Sidebar ── */
.logo     { display: flex; align-items: center; gap: 9px; margin-bottom: 26px; padding: 0 6px; }
.logo-box { width: 32px; height: 32px; background: linear-gradient(135deg, ${C.accent}, #FF6B35); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; color: #fff; flex-shrink: 0; }
.logo-name { font-size: 14px; font-weight: 700; }
.logo-sub  { font-size: 9.5px; color: ${C.muted}; }
.nav-sec  { font-size: 9.5px; font-weight: 700; color: ${C.dim}; text-transform: uppercase; letter-spacing: 1.2px; padding: 0 8px; margin: 12px 0 4px; }
.nav-item { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 7px; cursor: pointer; font-size: 12.5px; font-weight: 500; color: ${C.muted}; margin-bottom: 1px; transition: all .15s; border: 1px solid transparent; }
.nav-item:hover { background: ${C.surfaceAlt}; color: ${C.text}; }
.nav-item.on-a  { background: rgba(247,129,102,.12); color: ${C.accent}; border-color: rgba(247,129,102,.2); }
.nav-item.on-t  { background: rgba(57,211,187,.10); color: ${C.teal};   border-color: rgba(57,211,187,.2); }
.nav-ico  { font-size: 14px; width: 17px; text-align: center; flex-shrink: 0; }
.nav-badge { margin-left: auto; background: rgba(57,211,187,.15); color: ${C.teal}; border-radius: 20px; padding: 1px 6px; font-size: 9px; font-weight: 700; }
.sidebar-footer { margin-top: auto; padding-top: 12px; }
.plan-box   { background: ${C.surfaceAlt}; border: 1px solid ${C.border}; border-radius: 10px; padding: 11px; }
.plan-tier  { font-size: 11px; font-weight: 700; color: ${C.accent}; margin-bottom: 3px; }
.plan-desc  { font-size: 10.5px; color: ${C.muted}; line-height: 1.5; }
.plan-btn   { display: block; width: 100%; margin-top: 9px; padding: 6px; background: linear-gradient(135deg, ${C.accent}, #FF6B35); color: #fff; border: none; border-radius: 6px; font-size: 10.5px; font-weight: 700; cursor: pointer; font-family: 'Sora', sans-serif; text-align: center; }

/* ── Header ── */
.hdr      { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; }
.hdr-left .ptitle { font-size: 21px; font-weight: 700; letter-spacing: -.5px; }
.hdr-left .psub   { font-size: 12.5px; color: ${C.muted}; margin-top: 2px; }
.hdr-right { display: flex; align-items: center; gap: 9px; }
.chip  { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 20px; padding: 5px 13px; font-size: 11.5px; color: ${C.muted}; }
.av    { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, ${C.accent}, #FF6B35); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #fff; flex-shrink: 0; }

/* ── Banners ── */
.banner { padding: 11px 16px; border-radius: 11px; display: flex; align-items: center; gap: 11px; margin-bottom: 18px; border: 1px solid transparent; font-size: 13px; font-weight: 500; }
.banner.g { background: rgba(63,185,80,.09);  border-color: rgba(63,185,80,.25);  color: ${C.green};  }
.banner.y { background: rgba(227,179,65,.09);  border-color: rgba(227,179,65,.25);  color: ${C.yellow}; }
.banner.r { background: rgba(248,81,73,.09);   border-color: rgba(248,81,73,.25);   color: ${C.red};    }
.bdot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.bdot.g { background: ${C.green};  box-shadow: 0 0 6px ${C.green}; }
.bdot.y { background: ${C.yellow}; box-shadow: 0 0 6px ${C.yellow}; }
.bdot.r { background: ${C.red};    box-shadow: 0 0 6px ${C.red}; }

/* ── Grid ── */
.g2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 16px; }
.g3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 16px; }
.g4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }

/* ── Stat cards ── */
.card  { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 13px; padding: 17px; }
.clbl  { font-size: 10px; font-weight: 700; color: ${C.muted}; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 8px; }
.cval  { font-size: 21px; font-weight: 700; letter-spacing: -.5px; font-family: 'DM Mono', monospace; }
.csub  { font-size: 11px; color: ${C.muted}; margin-top: 4px; }
.cval.g { color: ${C.green}; } .cval.y { color: ${C.yellow}; } .cval.r { color: ${C.red}; }
.cval.b { color: ${C.blue}; } .cval.t { color: ${C.teal}; } .cval.p { color: ${C.purple}; }

/* ── Big card (section container) ── */
.bc    { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 13px; padding: 20px; margin-bottom: 16px; }
.bctit { font-size: 14px; font-weight: 600; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between; }

/* ── Table ── */
.tbl   { width: 100%; border-collapse: collapse; }
.tbl th { font-size: 10px; font-weight: 700; color: ${C.muted}; text-transform: uppercase; letter-spacing: .7px; padding: 8px 11px; text-align: left; border-bottom: 1px solid ${C.border}; }
.tbl td { padding: 9px 11px; font-size: 12.5px; border-bottom: 1px solid rgba(48,54,61,.4); vertical-align: middle; }
.tbl tr:last-child td { border-bottom: none; }
.tbl tr:hover td { background: ${C.surfaceAlt}; }
.tbl tfoot td { padding-top: 10px; border-top: 2px solid ${C.border}; border-bottom: none; font-weight: 700; }

/* ── Form ── */
.fsec  { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 13px; padding: 20px; margin-bottom: 16px; }
.ftit  { font-size: 14px; font-weight: 600; margin-bottom: 14px; }
.frow2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 11px; }
.frow3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 11px; }
.frow4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 11px; }
.fg    { display: flex; flex-direction: column; gap: 5px; }
.flbl  { font-size: 11px; font-weight: 600; color: ${C.muted}; }
.fhint { font-size: 10.5px; color: ${C.dim}; }
.fhint.y { color: ${C.yellow}; } .fhint.r { color: ${C.red}; }
.inp   { background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 7px; padding: 8px 11px; color: ${C.text}; font-size: 13px; font-family: 'Sora', sans-serif; outline: none; width: 100%; transition: border-color .15s; }
.inp:focus { border-color: ${C.accent}; }
.inp::placeholder { color: ${C.dim}; }
.sel   { background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 7px; padding: 8px 11px; color: ${C.text}; font-size: 13px; font-family: 'Sora', sans-serif; outline: none; width: 100%; cursor: pointer; }
.fbtns { display: flex; gap: 9px; margin-top: 14px; align-items: center; }

/* ── Buttons ── */
.btn    { background: linear-gradient(135deg, ${C.accent}, #FF6B35); color: #fff; border: none; border-radius: 8px; padding: 8px 17px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: 'Sora', sans-serif; transition: opacity .15s; white-space: nowrap; }
.btn:hover { opacity: .87; }
.btn-g  { background: transparent; border: 1px solid ${C.border}; border-radius: 8px; padding: 8px 17px; color: ${C.muted}; font-size: 12.5px; font-weight: 500; cursor: pointer; font-family: 'Sora', sans-serif; }
.btn-g:hover { border-color: ${C.muted}; color: ${C.text}; }
.btn-t  { background: rgba(57,211,187,.1); border: 1px solid rgba(57,211,187,.25); color: ${C.teal}; border-radius: 7px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'Sora', sans-serif; }
.btn-b  { background: rgba(56,139,253,.12); border: 1px solid rgba(56,139,253,.25); color: ${C.blue}; border-radius: 7px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'Sora', sans-serif; }
.btn-r  { background: rgba(248,81,73,.12); color: ${C.red}; border: none; border-radius: 7px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'Sora', sans-serif; }
.btn-ic { background: none; border: none; cursor: pointer; color: ${C.muted}; padding: 2px; font-size: 13px; }
.btn-ic:hover { color: ${C.text}; }

/* ── Pills ── */
.pill  { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 20px; font-size: 10.5px; font-weight: 600; white-space: nowrap; }
.pl-g  { background: rgba(63,185,80,.15);   color: ${C.green};  }
.pl-y  { background: rgba(227,179,65,.15);  color: ${C.yellow}; }
.pl-r  { background: rgba(248,81,73,.15);   color: ${C.red};    }
.pl-b  { background: rgba(56,139,253,.15);  color: ${C.blue};   }
.pl-t  { background: rgba(57,211,187,.12);  color: ${C.teal};   }
.pl-gr { background: rgba(139,148,158,.15); color: ${C.muted};  }
.pl-p  { background: rgba(163,113,247,.15); color: ${C.purple}; }

/* ── Alerts ── */
.alert { padding: 11px 14px; border-radius: 10px; border: 1px solid transparent; display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; font-size: 12.5px; }
.al-r  { background: rgba(248,81,73,.08);  border-color: rgba(248,81,73,.25);  color: ${C.red};    }
.al-y  { background: rgba(227,179,65,.08); border-color: rgba(227,179,65,.25); color: ${C.yellow}; }
.al-g  { background: rgba(63,185,80,.08);  border-color: rgba(63,185,80,.25);  color: ${C.green};  }
.al-t  { background: rgba(57,211,187,.08); border-color: rgba(57,211,187,.25); color: ${C.teal};   }
.al-ico { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
.al-ttl { font-weight: 700; margin-bottom: 2px; }
.al-msg { font-size: 11.5px; opacity: .9; line-height: 1.5; }

/* ── Expense expand row ── */
.exp-detail { padding: 11px 13px; background: ${C.surfaceAlt}; }

/* ── Tabs ── */
.tabs  { display: flex; gap: 3px; background: ${C.surfaceAlt}; border: 1px solid ${C.border}; border-radius: 10px; padding: 3px; margin-bottom: 16px; flex-wrap: wrap; }
.tab   { padding: 6px 13px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 500; color: ${C.muted}; transition: all .15s; white-space: nowrap; }
.tab.on-a { background: ${C.surface}; color: ${C.accent}; font-weight: 600; }
.tab.on-t { background: ${C.surface}; color: ${C.teal};   font-weight: 600; }

/* ── Reserve widget ── */
.reserve { background: linear-gradient(135deg, rgba(247,129,102,.08), rgba(255,107,53,.03)); border: 1px solid rgba(247,129,102,.25); border-radius: 13px; padding: 20px; margin-bottom: 16px; }
.r-lbl   { font-size: 10px; font-weight: 700; color: ${C.muted}; text-transform: uppercase; letter-spacing: .8px; }
.r-big   { font-size: 36px; font-weight: 700; font-family: 'DM Mono', monospace; color: ${C.accent}; line-height: 1; margin: 8px 0 5px; }
.r-sub   { font-size: 12.5px; color: ${C.muted}; }

/* ── Disclaimer ── */
.disc  { background: ${C.surfaceAlt}; border: 1px solid ${C.border}; border-left: 3px solid ${C.yellow}; border-radius: 11px; padding: 13px 16px; margin-top: 16px; }
.d-ttl { font-size: 11.5px; font-weight: 700; color: ${C.yellow}; margin-bottom: 5px; }
.d-txt { font-size: 11px; color: ${C.muted}; line-height: 1.7; }

/* ── Employee card ── */
.emp-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 13px; margin-bottom: 16px; }
.emp-card { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 13px; padding: 17px; transition: border-color .15s; }
.emp-card:hover { border-color: ${C.dim}; }

/* ── Modal ── */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.7); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal   { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 17px; padding: 26px; width: 100%; max-width: 640px; max-height: 92vh; overflow-y: auto; }
.m-ttl   { font-size: 16px; font-weight: 700; letter-spacing: -.3px; margin-bottom: 3px; display: flex; align-items: center; justify-content: space-between; }
.m-sub   { font-size: 11.5px; color: ${C.muted}; margin-bottom: 18px; }
.m-sec   { font-size: 10px; font-weight: 700; color: ${C.muted}; text-transform: uppercase; letter-spacing: 1px; margin: 16px 0 9px; padding-bottom: 5px; border-bottom: 1px solid ${C.border}; }

/* ── Insurance card ── */
.ins-card { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 13px; padding: 18px; }
.ins-bar  { height: 6px; background: ${C.border}; border-radius: 3px; margin: 9px 0 3px; overflow: hidden; }
.ins-fill { height: 100%; border-radius: 3px; }

/* ── Charts ── */
.donut-wrap { display: flex; align-items: center; gap: 18px; }
.leg-row    { display: flex; align-items: center; gap: 7px; font-size: 11.5px; }
.leg-dot    { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.bar-wrap   { display: flex; align-items: flex-end; gap: 6px; height: 74px; }
.bar-col    { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
.bar-fill   { width: 100%; border-radius: 3px 3px 0 0; }
.bar-lbl    { font-size: 9px; color: ${C.dim}; }

/* ── BAS rows ── */
.bas-row { display: flex; align-items: center; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid ${C.border}; }
.bas-row:last-child { border-bottom: none; }
.bas-lbl { font-size: 12.5px; color: ${C.muted}; }
.bas-val { font-size: 13.5px; font-weight: 600; font-family: 'DM Mono', monospace; }
.bas-tot { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; }
.bas-tot-lbl { font-size: 13px; font-weight: 700; }
.bas-tot-val { font-size: 21px; font-weight: 700; font-family: 'DM Mono', monospace; color: ${C.accent}; }

/* ── Health score ring ── */
.score-wrap { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.score-lbl  { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; }

/* ── Tax saver summary panel ── */
.ts-panel { background: linear-gradient(135deg, rgba(57,211,187,.06), rgba(247,129,102,.03)); border: 1px solid rgba(57,211,187,.2); border-radius: 13px; padding: 20px; margin-bottom: 16px; }
.ts-sgrid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-top: 13px; }
.ts-sval  { font-size: 20px; font-weight: 700; font-family: 'DM Mono', monospace; }
.ts-slbl  { font-size: 10px; color: ${C.muted}; margin-top: 3px; }

/* ── Toast ── */
.toast { position: fixed; bottom: 18px; right: 18px; background: ${C.surfaceAlt}; border: 1px solid ${C.border}; border-radius: 11px; padding: 11px 16px; font-size: 12.5px; font-weight: 500; box-shadow: 0 8px 28px rgba(0,0,0,.4); z-index: 999; display: flex; align-items: center; gap: 8px; animation: up .25s ease; }
@keyframes up { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

/* ── Landing ── */
.land    { min-height: 100vh; background: ${C.bg}; }
.lnav    { display: flex; align-items: center; justify-content: space-between; padding: 17px 40px; border-bottom: 1px solid ${C.border}; }
.hero    { text-align: center; padding: 76px 40px 44px; max-width: 720px; margin: 0 auto; }
.h-badge { display: inline-block; background: rgba(247,129,102,.12); border: 1px solid rgba(247,129,102,.3); border-radius: 20px; padding: 5px 13px; font-size: 11.5px; font-weight: 600; color: ${C.accent}; margin-bottom: 18px; }
.h-ttl   { font-size: 44px; font-weight: 700; letter-spacing: -2px; line-height: 1.1; margin-bottom: 15px; }
.h-ttl span { background: linear-gradient(135deg, ${C.accent}, #FF6B35); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.h-sub   { font-size: 15.5px; color: ${C.muted}; line-height: 1.65; margin-bottom: 26px; }
.h-btns  { display: flex; align-items: center; justify-content: center; gap: 10px; }
.h-btn   { background: linear-gradient(135deg, ${C.accent}, #FF6B35); color: #fff; border: none; border-radius: 11px; padding: 12px 26px; font-size: 14.5px; font-weight: 700; cursor: pointer; font-family: 'Sora', sans-serif; }
.h-btn-g { background: transparent; color: ${C.text}; border: 1px solid ${C.border}; border-radius: 11px; padding: 12px 22px; font-size: 14.5px; font-weight: 500; cursor: pointer; font-family: 'Sora', sans-serif; }
.feat-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; padding: 28px 40px; max-width: 1020px; margin: 0 auto; }
.feat-card { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 14px; padding: 18px; }
.feat-ico  { font-size: 22px; margin-bottom: 10px; }
.feat-ttl  { font-size: 13.5px; font-weight: 600; margin-bottom: 5px; }
.feat-dsc  { font-size: 12px; color: ${C.muted}; line-height: 1.6; }
.price-sec { padding: 48px 40px; text-align: center; max-width: 820px; margin: 0 auto; }
.price-lbl { font-size: 10.5px; font-weight: 700; color: ${C.accent}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
.price-ttl { font-size: 28px; font-weight: 700; letter-spacing: -1px; margin-bottom: 28px; }
.price-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
.price-card { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 14px; padding: 22px; text-align: left; }
.price-card.hi { border-color: ${C.accent}; background: rgba(247,129,102,.04); }
.p-tier { font-size: 10px; font-weight: 700; color: ${C.muted}; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 7px; }
.p-amt  { font-size: 28px; font-weight: 700; font-family: 'DM Mono', monospace; }
.p-per  { font-size: 11.5px; color: ${C.muted}; }
.p-list { list-style: none; margin-top: 14px; display: flex; flex-direction: column; gap: 6px; }
.p-list li { font-size: 11.5px; color: ${C.muted}; display: flex; gap: 6px; }
.p-list li::before { content: '✓'; color: ${C.green}; font-weight: 700; }

/* ── Auth ── */
.auth-pg  { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: ${C.bg}; }
.auth-box { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 16px; padding: 32px; width: 100%; max-width: 390px; }
.a-ttl    { font-size: 20px; font-weight: 700; letter-spacing: -.4px; margin-bottom: 3px; }
.a-sub    { font-size: 12px; color: ${C.muted}; margin-bottom: 20px; }
.a-form   { display: flex; flex-direction: column; gap: 11px; }
.a-sw     { text-align: center; font-size: 12px; color: ${C.muted}; margin-top: 14px; }
.a-sw a   { color: ${C.accent}; cursor: pointer; font-weight: 500; text-decoration: none; }

/* ── mono util ── */
.mono { font-family: 'DM Mono', monospace; }
.empty-state { text-align: center; padding: 36px 20px; color: ${C.muted}; }
.empty-icon  { font-size: 28px; margin-bottom: 8px; }
.empty-txt   { font-size: 13px; }

/* ── Document Hub ── */
.doc-grid  { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; margin-bottom: 16px; }
.doc-card  { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 12px; padding: 14px; transition: border-color .15s; }
.doc-card:hover { border-color: ${C.dim}; }
.doc-ico   { font-size: 22px; margin-bottom: 8px; }
.doc-name  { font-size: 12.5px; font-weight: 600; margin-bottom: 4px; word-break: break-all; line-height: 1.4; }
.doc-meta  { font-size: 10.5px; color: ${C.muted}; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-bottom: 8px; }
.doc-tags  { display: flex; gap: 5px; flex-wrap: wrap; }
.search-bar { display: flex; gap: 8px; margin-bottom: 14px; }
.filter-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.drop-zone  { border: 2px dashed ${C.border}; border-radius: 13px; padding: 32px 20px; text-align: center; background: ${C.surfaceAlt}; cursor: pointer; transition: all .2s; }
.drop-zone:hover, .drop-zone.drag { border-color: ${C.accent}; background: rgba(247,129,102,.04); }
.dz-ico    { font-size: 32px; margin-bottom: 10px; }
.dz-ttl    { font-size: 14px; font-weight: 600; margin-bottom: 5px; }
.dz-sub    { font-size: 12px; color: ${C.muted}; }

/* ── Reports / Print trigger ── */
.rep-grid  { display: grid; grid-template-columns: repeat(2,1fr); gap: 14px; margin-bottom: 16px; }
.rep-card  { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 13px; padding: 20px; display: flex; flex-direction: column; gap: 10px; }
.rep-ico   { font-size: 28px; }
.rep-ttl   { font-size: 14px; font-weight: 700; }
.rep-dsc   { font-size: 12px; color: ${C.muted}; line-height: 1.6; flex: 1; }
.rep-btns  { display: flex; gap: 8px; }

/* ── Print layout (screen only used for preview) ── */
.print-preview { background: #fff; color: #111; font-family: 'Sora',sans-serif; padding: 0; }
.pp-page   { width: 100%; max-width: 780px; margin: 0 auto; padding: 32px 36px; }
.pp-hdr    { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 26px; padding-bottom: 16px; border-bottom: 2px solid #E5E7EB; }
.pp-logo   { display: flex; align-items: center; gap: 10px; }
.pp-logo-box { width: 36px; height: 36px; background: #F78166; border-radius: 8px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:16px; }
.pp-title  { font-size: 11px; color: #6B7280; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; }
.pp-name   { font-size: 18px; font-weight: 700; letter-spacing: -.3px; margin-top: 3px; }
.pp-meta   { text-align: right; font-size: 11px; color: #6B7280; line-height: 1.8; }
.pp-sec    { margin-bottom: 22px; }
.pp-sec-ttl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #E5E7EB; }
.pp-row    { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #F3F4F6; font-size: 13px; }
.pp-row:last-child { border-bottom: none; }
.pp-lbl    { color: #374151; }
.pp-val    { font-family: 'DM Mono',monospace; font-weight: 600; color: #111; }
.pp-tot    { display: flex; justify-content: space-between; padding: 11px 13px; background: #F9FAFB; border-radius: 8px; margin-top: 8px; font-weight: 700; }
.pp-tot-v  { font-family: 'DM Mono',monospace; font-size: 17px; color: #F78166; }
.pp-warn   { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 10px 13px; font-size: 12px; color: #92400E; margin-bottom: 8px; }
.pp-tbl    { width: 100%; border-collapse: collapse; font-size: 12px; }
.pp-tbl th { background: #F3F4F6; padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #6B7280; }
.pp-tbl td { padding: 8px 10px; border-bottom: 1px solid #F3F4F6; }
.pp-tbl tr:last-child td { border-bottom: none; }
.pp-tbl tfoot td { font-weight: 700; border-top: 2px solid #E5E7EB; border-bottom: none; }
.pp-disc   { background: #F9FAFB; border: 1px solid #E5E7EB; border-left: 3px solid #F78166; border-radius: 8px; padding: 12px 14px; margin-top: 22px; font-size: 11px; color: #6B7280; line-height: 1.7; }
.pp-quarter-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; }
.pp-q-card { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 13px; }
.pp-q-lbl  { font-size: 10px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; margin-bottom: 6px; }
.pp-q-val  { font-family: 'DM Mono',monospace; font-size: 16px; font-weight: 700; }
.pp-badge  { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 20px; font-size: 10.5px; font-weight: 600; }
.pp-b-g  { background: #D1FAE5; color: #065F46; }
.pp-b-y  { background: #FEF3C7; color: #92400E; }
.pp-b-r  { background: #FEE2E2; color: #991B1B; }
.pp-modal { position: fixed; inset: 0; background: rgba(0,0,0,.75); z-index: 300; overflow-y: auto; }
.pp-close  { position: fixed; top: 16px; right: 16px; background: #fff; border: 1px solid #E5E7EB; border-radius: 8px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Sora',sans-serif; z-index: 301; display: flex; gap: 6px; align-items: center; }
.pp-print  { position: fixed; top: 16px; right: 120px; background: #F78166; color: #fff; border: none; border-radius: 8px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Sora',sans-serif; z-index: 301; }

/* ── Print media query ── */
@media print {
  .layout, .pp-close, .pp-print, .pp-modal { display: none !important; }
  .print-only { display: block !important; }
  body { background: #fff !important; }
  .pp-page { padding: 20mm 18mm; }
}
.print-only { display: none; }
`;

// ════════════════════════════════════════════════════════════
//  MICRO COMPONENTS
// ════════════════════════════════════════════════════════════
function Toast({ msg, onDone }) {
  useState(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); });
  return <div className="toast">✅ {msg}</div>;
}

function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + d.v, 0);
  if (!total) return null;
  const r = 44, cx = 52, cy = 52, circ = 2 * Math.PI * r;
  let off = 0;
  const slices = data.map(d => {
    const dash = (d.v / total) * circ;
    const s = { ...d, dash, off };
    off += dash;
    return s;
  });
  return (
    <div className="donut-wrap">
      <svg width="104" height="104" style={{ transform:"rotate(-90deg)", flexShrink:0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth="11"/>
        {slices.map((s,i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.c}
            strokeWidth="11"
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-s.off}/>
        ))}
      </svg>
      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
        {data.map((d,i) => (
          <div key={i} className="leg-row">
            <div className="leg-dot" style={{ background:d.c }}/>
            <span style={{ color:C.muted }}>{d.label}</span>
            <span className="mono" style={{ fontWeight:600, marginLeft:5 }}>{money(d.v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data }) {
  const maxV = Math.max(...data.map(d => d.v), 1);
  const colors = [C.blue, C.accent, C.green, C.yellow, C.red];
  return (
    <div className="bar-wrap">
      {data.map((d,i) => (
        <div key={i} className="bar-col">
          <div className="bar-fill" style={{ height:`${(d.v/maxV)*68}px`, background:colors[i%5] }}/>
          <span className="bar-lbl">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreRing({ score }) {
  const r = 34, cx = 42, cy = 42, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const col = score >= 70 ? C.green : score >= 40 ? C.yellow : C.red;
  const lbl = score >= 70 ? "Healthy" : score >= 40 ? "Watch" : "At Risk";
  return (
    <div className="score-wrap">
      <svg width="84" height="84">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth="9"/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth="9"
          strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={circ*0.25}/>
        <text x={cx} y={cy-1} textAnchor="middle" fill={col}
          style={{ fontFamily:"DM Mono", fontWeight:700, fontSize:16 }}>{score}</text>
        <text x={cx} y={cy+12} textAnchor="middle" fill={C.muted}
          style={{ fontSize:8 }}>/100</text>
      </svg>
      <div className="score-lbl" style={{ color:col }}>{lbl}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  LANDING
// ════════════════════════════════════════════════════════════
function LandingPage({ onGo }) {
  return (
    <div className="land">
      <nav className="lnav">
        <div className="logo" style={{ margin:0 }}>
          <div className="logo-box">T</div>
          <div><div className="logo-name">TaxMate</div><div className="logo-sub">FOR RESTAURANTS</div></div>
        </div>
        <div style={{ display:"flex", gap:9 }}>
          <button className="btn-g" onClick={onGo}>Log In</button>
          <button className="btn"   onClick={onGo}>Get Started Free</button>
        </div>
      </nav>

      <div className="hero">
        <div className="h-badge">🇦🇺 Built for Australian Restaurant Owners</div>
        <h1 className="h-ttl">Know exactly what tax<br/><span>you owe. Every quarter.</span></h1>
        <p className="h-sub">TaxMate tracks GST, manages staff records, calculates labour costs, and tells you what to set aside — so your BAS never surprises you.</p>
        <div className="h-btns">
          <button className="h-btn"   onClick={onGo}>Start for Free →</button>
          <button className="h-btn-g" onClick={onGo}>See a Demo</button>
        </div>
      </div>

      <div className="feat-grid">
        {[
          { ico:"💵", ttl:"Revenue Tracking",   dsc:"Log your daily income in one simple entry. GST collected calculated automatically." },
          { ico:"🧾", ttl:"Expense Tracking",   dsc:"Categorise expenses, flag missing invoices, and maximise GST credits." },
          { ico:"👤", ttl:"Staff Profiles",     dsc:"Full employee records — personal info, next of kin, hours, TFN, super." },
          { ico:"🕐", ttl:"Timesheet & Wages",  dsc:"Log std/OT/weekend hours. Auto-calculate gross wages, PAYG and super." },
          { ico:"🛡️", ttl:"Insurance Dashboard",dsc:"Track Workers Comp, Public Liability and Equipment as % of payroll." },
          { ico:"📊", ttl:"BAS Estimator",      dsc:"Estimated quarterly BAS with GST and PAYG breakdown. Weekly reserve advice." },
        ].map((f,i) => (
          <div key={i} className="feat-card">
            <div className="feat-ico">{f.ico}</div>
            <div className="feat-ttl">{f.ttl}</div>
            <div className="feat-dsc">{f.dsc}</div>
          </div>
        ))}
      </div>

      <div className="price-sec">
        <div className="price-lbl">Pricing</div>
        <div className="price-ttl">Simple, honest pricing</div>
        <div className="price-grid">
          {[
            { tier:"Free",    price:"$0",  per:"/month", hi:false,
              feats:["Revenue & expense tracking","3 employee profiles","Basic BAS estimate","Monthly summaries"] },
            { tier:"Pro",     price:"$29", per:"/month", hi:true,
              feats:["Everything in Free","Unlimited staff profiles","Full timesheet & labour costs","Insurance dashboard","Tax Saver"] },
            { tier:"Premium", price:"$79", per:"/month", hi:false,
              feats:["Everything in Pro","Cash flow forecasting","Tax reserve planning","Priority support","Accountant export"] },
          ].map((p,i) => (
            <div key={i} className={`price-card${p.hi?" hi":""}`}>
              <div className="p-tier">{p.tier}</div>
              <div><span className="p-amt">{p.price}</span><span className="p-per">{p.per}</span></div>
              <ul className="p-list">{p.feats.map((f,j) => <li key={j}>{f}</li>)}</ul>
              <button className="btn" style={{ marginTop:14, width:"100%" }} onClick={onGo}>
                {p.tier === "Free" ? "Get Started" : `Choose ${p.tier}`}
              </button>
            </div>
          ))}
        </div>
        <p style={{ fontSize:10.5, color:C.dim, marginTop:16 }}>
          ⚠️ Estimates only. Not a substitute for a registered tax agent or accountant.
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════════
function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  return (
    <div className="auth-pg">
      <div className="auth-box">
        <div className="logo" style={{ marginBottom:20 }}>
          <div className="logo-box">T</div>
          <div><div className="logo-name">TaxMate</div><div className="logo-sub">FOR RESTAURANTS</div></div>
        </div>
        <div className="a-ttl">{mode === "login" ? "Welcome back" : "Create account"}</div>
        <div className="a-sub">{mode === "login" ? "Log in to your dashboard" : "Start tracking today"}</div>
        <div className="a-form">
          {mode === "signup" && (
            <div className="fg">
              <label className="flbl">Restaurant Name</label>
              <input className="inp" placeholder="Golden Dragon Restaurant"/>
            </div>
          )}
          <div className="fg"><label className="flbl">Email</label><input className="inp" type="email" defaultValue="demo@taxmate.com.au"/></div>
          <div className="fg"><label className="flbl">Password</label><input className="inp" type="password" defaultValue="demo1234"/></div>
          <button className="btn" style={{ width:"100%", padding:11 }} onClick={onLogin}>
            {mode === "login" ? "Log In →" : "Create Account →"}
          </button>
        </div>
        <div className="a-sw">
          {mode === "login"
            ? <><span>No account? </span><a onClick={() => setMode("signup")}>Sign up</a></>
            : <><span>Have account? </span><a onClick={() => setMode("login")}>Log in</a></>}
        </div>
        <p style={{ fontSize:10, color:C.dim, textAlign:"center", marginTop:10 }}>
          Click Log In to enter the demo
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  SIDEBAR
// ════════════════════════════════════════════════════════════
function Sidebar({ page, setPage, onLogout, flagCount }) {
  const nav = [
    { sec:"Overview" },
    { id:"dashboard", ico:"📊", lbl:"Dashboard" },
    { sec:"Tracking" },
    { id:"revenue",   ico:"💵", lbl:"Revenue" },
    { id:"expenses",  ico:"🧾", lbl:"Expenses" },
    { sec:"People" },
    { id:"wages",     ico:"👤", lbl:"Staff & Wages" },
    { id:"insurance", ico:"🛡️", lbl:"Insurance" },
    { sec:"Tax" },
    { id:"tax",       ico:"📋", lbl:"Tax Summary" },
    { id:"taxsaver",  ico:"🔍", lbl:"Tax Saver", badge: flagCount > 0 ? `${flagCount} flags` : "PRO" },
    { sec:"Documents & Reports" },
    { id:"documents",     ico:"📁", lbl:"Document Hub" },
    { id:"bassummary",    ico:"📋", lbl:"BAS Summary" },
    { id:"accountantpack",ico:"📦", lbl:"Accountant Pack" },
    { id:"reports",       ico:"🖨️", lbl:"Reports & Exports" },
    { sec:"Account" },
    { id:"settings",  ico:"⚙️", lbl:"Settings" },
  ];
  return (
    <div className="sidebar">
      <div className="logo">
        <div className="logo-box">T</div>
        <div><div className="logo-name">TaxMate</div><div className="logo-sub">FOR RESTAURANTS</div></div>
      </div>
      {nav.map((n,i) => n.sec
        ? <div key={i} className="nav-sec">{n.sec}</div>
        : (
          <div key={n.id}
            className={`nav-item${page===n.id?(n.id==="taxsaver"?" on-t":" on-a"):""}`}
            onClick={() => setPage(n.id)}>
            <span className="nav-ico">{n.ico}</span>
            {n.lbl}
            {n.badge && <span className="nav-badge">{n.badge}</span>}
          </div>
        )
      )}
      <div className="sidebar-footer">
        <div className="plan-box">
          <div className="plan-tier">Free Plan</div>
          <div className="plan-desc">Upgrade for unlimited staff, insurance & Tax Saver</div>
          <button className="plan-btn">Upgrade to Pro — $29/mo</button>
        </div>
        <div className="nav-item" style={{ marginTop:8 }} onClick={onLogout}>
          <span className="nav-ico">🚪</span>Log Out
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════════════════
function DashboardPage({ revenue, expenses, employees, timesheets, insurance, setPage }) {
  const rows      = annotateTimesheets(employees, timesheets);
  const totalRev  = revenue.reduce((s,r) => s + r.amount, 0);
  const gstColl   = totalRev / 11;
  const gstCreds  = expenses.filter(e => e.gst).reduce((s,e) => s + e.amount / 11, 0);
  const gstPay    = gstColl - gstCreds;
  const totalWages= rows.reduce((s,t) => s + t.gross, 0);
  const totalPayg = rows.reduce((s,t) => s + t.payg, 0);
  const estBAS    = gstPay + totalPayg;
  const wklyRes   = estBAS / 13;
  const totalIns  = insurance.reduce((s,i) => s + i.annual, 0);
  const todayR    = revenue[revenue.length - 1];
  const todayTot  = todayR ? todayR.amount : 0;
  const status    = gstPay < gstColl * 0.5 ? "g" : gstPay < gstColl * 0.8 ? "y" : "r";
  const statusMsg = { g:"Tracking well — tax reserves look healthy.", y:"Watch expenses — GST payable is growing.", r:"Tax shortfall risk — increase your weekly reserve." };
  const analysed  = analyseExpenses(expenses);
  const flags     = analysed.filter(e => e.gstStatus === "missing-invoice").length + timesheets.filter(t => !t.super_paid).length;

  return (
    <>
      <div className="hdr">
        <div className="hdr-left">
          <div className="ptitle">Dashboard</div>
          <div className="psub">Golden Dragon Restaurant · {today.toLocaleString("default",{month:"long"})} {today.getFullYear()}</div>
        </div>
        <div className="hdr-right">
          <div className="chip">📅 {quarter}</div>
          <div className="av">GD</div>
        </div>
      </div>

      <div className={`banner ${status}`}>
        <div className={`bdot ${status}`}/>
        {statusMsg[status]}
      </div>

      <div className="g4">
        {[
          { lbl:"Today's Revenue",  val:money(todayTot),  cls:"",  sub:"Dine-in + Takeaway + Delivery" },
          { lbl:"Monthly Revenue",  val:money(totalRev),  cls:"b", sub:`${revenue.length} days tracked` },
          { lbl:"Est. GST Payable", val:money(gstPay),    cls:gstPay > 2000 ? "r":"y", sub:"Collected minus credits" },
          { lbl:"Estimated BAS",    val:money(estBAS),    cls:"r", sub:`${quarter} estimate` },
        ].map((c,i) => (
          <div key={i} className="card">
            <div className="clbl">{c.lbl}</div>
            <div className={`cval ${c.cls}`}>{c.val}</div>
            <div className="csub">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="g4">
        {[
          { lbl:"Active Staff",       val:employees.filter(e=>e.id).length, cls:"t", sub:`${employees.length} total employees` },
          { lbl:"Total Gross Wages",  val:money(totalWages),                cls:"",  sub:"All logged timesheets" },
          { lbl:"Est. Super Owed",    val:money(rows.reduce((s,t)=>s+t.super,0)), cls:"b", sub:"11.5% of gross wages" },
          { lbl:"Annual Insurance",   val:money(totalIns),                  cls:"p", sub:`${insurance.length} policies` },
        ].map((c,i) => (
          <div key={i} className="card">
            <div className="clbl">{c.lbl}</div>
            <div className={`cval ${c.cls}`}>{c.val}</div>
            <div className="csub">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="g2">
        <div className="bc">
          <div className="bctit">Revenue Breakdown</div>
          <DonutChart data={[
            { label:"Total Revenue", v:revenue.reduce((s,r)=>s+r.amount,0), c:C.blue },
          ]}/>
        </div>
        <div className="bc">
          <div className="bctit">Daily Revenue (Last 5 Days)</div>
          <BarChart data={revenue.slice(-5).map((r,i) => ({
            label:`Jul ${i+1}`, v:r.amount
          }))}/>
        </div>
      </div>

      <div className="reserve">
        <div className="r-lbl">🏦 Weekly Tax Reserve Recommendation</div>
        <div className="r-big">{money(wklyRes)}</div>
        <div className="r-sub">Set aside <strong>{money(wklyRes)}</strong>/week → <strong>{money(wklyRes*13)}</strong> ready by BAS due date.</div>
      </div>

      {flags > 0 && (
        <div className="alert al-y" style={{ cursor:"pointer" }} onClick={() => setPage("taxsaver")}>
          <span className="al-ico">🔍</span>
          <div>
            <div className="al-ttl">Tax Saver found {flags} issue{flags>1?"s":""} to review</div>
            <div className="al-msg">Missing invoices or unpaid super detected. Click to review →</div>
          </div>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  REVENUE PAGE
// ════════════════════════════════════════════════════════════
function RevenuePage({ revenue, setRevenue, showToast }) {
  const [f, setF] = useState({ date:todayStr, amount:"" });
  const total = parseFloat(f.amount) || 0;

  const add = () => {
    if (!total) return;
    setRevenue(p => [...p, { id:Date.now(), date:f.date, amount:total }]);
    setF({ date:todayStr, amount:"" });
    showToast("Revenue entry added!");
  };

  const totalAll = revenue.reduce((s,r) => s + r.amount, 0);

  return (
    <>
      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">Revenue Tracking</div><div className="psub">Log your daily sales</div></div>
      </div>

      <div className="g3">
        {[
          { lbl:"Total Revenue",  val:money(totalAll),        cls:"b" },
          { lbl:"GST Collected",  val:money(totalAll/11),     cls:"y" },
          { lbl:"Days Tracked",   val:revenue.length,         cls:"t" },
        ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
      </div>

      <div className="fsec">
        <div className="ftit">Add Daily Revenue</div>
        <div className="frow2">
          <div className="fg"><label className="flbl">Date</label><input className="inp" type="date" value={f.date} onChange={e => setF({...f,date:e.target.value})}/></div>
          <div className="fg">
            <label className="flbl">Total Daily Income ($)</label>
            <input className="inp" type="number" placeholder="0.00" value={f.amount} onChange={e => setF({...f,amount:e.target.value})}/>
            {total > 0 && <span className="fhint">GST collected: {money(total/11)}</span>}
          </div>
        </div>
        <div className="fbtns">
          <button className="btn" onClick={add}>Add Entry</button>
          <button className="btn-g" onClick={() => setF({date:todayStr, amount:""})}>Clear</button>
          <div style={{ marginLeft:"auto" }}>
            <div className="clbl">Total</div>
            <div className="mono" style={{ fontSize:20, fontWeight:700, color:C.green }}>{money(total)}</div>
          </div>
        </div>
      </div>

      <div className="bc">
        <div className="bctit">Revenue History</div>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Total Income</th><th>GST Collected</th><th></th></tr></thead>
          <tbody>
            {revenue.length === 0
              ? <tr><td colSpan={4}><div className="empty-state"><div className="empty-icon">📭</div><div className="empty-txt">No entries yet.</div></div></td></tr>
              : revenue.slice().reverse().map(r => (
                  <tr key={r.id}>
                    <td className="mono">{r.date}</td>
                    <td style={{ fontWeight:700 }}>{money(r.amount)}</td>
                    <td style={{ color:C.yellow }}>{money(r.amount/11)}</td>
                    <td><button className="btn-ic" onClick={() => setRevenue(p => p.filter(x => x.id !== r.id))}>🗑️</button></td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  EXPENSES PAGE
// ════════════════════════════════════════════════════════════
function ExpensesPage({ expenses, setExpenses, showToast }) {
  const [f, setF] = useState({ date:todayStr, cat:"ingredients", amount:"", desc:"", gst:"yes", invoice:"yes" });

  const add = () => {
    if (!f.amount || !f.desc) return;
    setExpenses(p => [...p, {
      id:Date.now(), date:f.date, cat:f.cat,
      amount:parseFloat(f.amount)||0, desc:f.desc,
      gst:f.gst==="yes", invoice:f.invoice==="yes"
    }]);
    setF({ date:todayStr, cat:"ingredients", amount:"", desc:"", gst:"yes", invoice:"yes" });
    showToast("Expense added!");
  };

  const totalExp  = expenses.reduce((s,e) => s + e.amount, 0);
  const gstCreds  = expenses.filter(e => e.gst).reduce((s,e) => s + e.amount/11, 0);

  return (
    <>
      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">Expense Tracking</div><div className="psub">Track business expenses and GST credits</div></div>
      </div>

      <div className="g3">
        {[
          { lbl:"Total Expenses", val:money(totalExp),   cls:"r" },
          { lbl:"GST Credits",    val:money(gstCreds),   cls:"g" },
          { lbl:"Entries",        val:expenses.length,   cls:"b" },
        ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
      </div>

      <div className="fsec">
        <div className="ftit">Add Expense</div>
        <div className="frow2">
          <div className="fg"><label className="flbl">Date</label><input className="inp" type="date" value={f.date} onChange={e => setF({...f,date:e.target.value})}/></div>
          <div className="fg"><label className="flbl">Category</label>
            <select className="sel" value={f.cat} onChange={e => setF({...f,cat:e.target.value})}>
              {EXP_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
            </select>
          </div>
          <div className="fg"><label className="flbl">Amount ($)</label><input className="inp" type="number" placeholder="0.00" value={f.amount} onChange={e => setF({...f,amount:e.target.value})}/></div>
          <div className="fg"><label className="flbl">Description</label><input className="inp" placeholder="Brief description..." value={f.desc} onChange={e => setF({...f,desc:e.target.value})}/></div>
          <div className="fg"><label className="flbl">GST Applicable?</label>
            <select className="sel" value={f.gst} onChange={e => setF({...f,gst:e.target.value})}>
              <option value="yes">Yes — includes GST</option>
              <option value="no">No — GST-free</option>
            </select>
          </div>
          <div className="fg"><label className="flbl">Tax Invoice on File?</label>
            <select className="sel" value={f.invoice} onChange={e => setF({...f,invoice:e.target.value})}>
              <option value="yes">Yes — received</option>
              <option value="no">No — not yet</option>
            </select>
            {f.gst==="yes" && f.amount && <span className="fhint">GST credit: {money((parseFloat(f.amount)||0)/11)}</span>}
          </div>
        </div>
        <div className="fbtns">
          <button className="btn" onClick={add}>Add Expense</button>
          <button className="btn-g" onClick={() => setF({date:todayStr,cat:"ingredients",amount:"",desc:"",gst:"yes",invoice:"yes"})}>Clear</button>
        </div>
      </div>

      <div className="bc">
        <div className="bctit">Expense History</div>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>GST Credit</th><th>Invoice</th><th></th></tr></thead>
          <tbody>
            {expenses.length === 0
              ? <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">🧾</div><div className="empty-txt">No expenses yet.</div></div></td></tr>
              : expenses.slice().reverse().map(e => (
                  <tr key={e.id}>
                    <td className="mono">{e.date}</td>
                    <td><span className="pill pl-p">{e.cat}</span></td>
                    <td style={{ color:C.muted }}>{e.desc}</td>
                    <td style={{ fontWeight:700 }}>{money(e.amount)}</td>
                    <td style={{ color:C.green }}>{e.gst ? money(e.amount/11) : "—"}</td>
                    <td>{e.invoice ? <span className="pill pl-g">✅ Yes</span> : <span className="pill pl-r">❌ No</span>}</td>
                    <td><button className="btn-ic" onClick={() => setExpenses(p => p.filter(x => x.id !== e.id))}>🗑️</button></td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  EMPLOYEE MODAL
// ════════════════════════════════════════════════════════════
const BLANK_EMP = {
  name:"", email:"", phone:"", dob:"", nok_name:"", nok_phone:"",
  role:"", type:"full-time", rate:"", std_hrs:"38",
  start:todayStr, tfn:"yes", superfund:"",
};

function EmployeeModal({ emp, onSave, onClose }) {
  const isEdit = !!emp;
  const [f, setF] = useState(
    emp ? { ...emp, rate:String(emp.rate), std_hrs:String(emp.std_hrs), tfn:emp.tfn?"yes":"no" }
        : BLANK_EMP
  );
  const rate    = parseFloat(f.rate) || 0;
  const stdHrs  = parseFloat(f.std_hrs) || 0;
  const effR    = f.type === "casual" ? rate * (1 + CASUAL_LOADING) : rate;
  const wkGross = effR * stdHrs;

  const save = () => {
    if (!f.name.trim()) return;
    onSave({ ...f, id:emp?.id || Date.now(), rate, std_hrs:stdHrs, tfn:f.tfn==="yes" });
  };

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="m-ttl">
          {isEdit ? `Edit: ${emp.name}` : "Add New Employee"}
          <button className="btn-ic" style={{ fontSize:17 }} onClick={onClose}>✕</button>
        </div>
        <div className="m-sub">{isEdit ? "Update employee profile." : "Fill in what you know — you can update later."}</div>

        <div className="m-sec">Personal Details</div>
        <div className="frow2">
          <div className="fg"><label className="flbl">Full Name *</label><input className="inp" placeholder="e.g. Mei Lin" value={f.name} onChange={e => setF({...f,name:e.target.value})}/></div>
          <div className="fg"><label className="flbl">Email Address</label><input className="inp" type="email" placeholder="name@email.com" value={f.email} onChange={e => setF({...f,email:e.target.value})}/></div>
          <div className="fg"><label className="flbl">Phone Number</label><input className="inp" placeholder="04xx xxx xxx" value={f.phone} onChange={e => setF({...f,phone:e.target.value})}/></div>
          <div className="fg"><label className="flbl">Date of Birth</label><input className="inp" type="date" value={f.dob} onChange={e => setF({...f,dob:e.target.value})}/>{f.dob && <span className="fhint">Age: {calcAge(f.dob)}</span>}</div>
        </div>

        <div className="m-sec">Next of Kin</div>
        <div className="frow2">
          <div className="fg"><label className="flbl">Next of Kin Name</label><input className="inp" placeholder="e.g. David Lin" value={f.nok_name} onChange={e => setF({...f,nok_name:e.target.value})}/></div>
          <div className="fg"><label className="flbl">Next of Kin Phone</label><input className="inp" placeholder="04xx xxx xxx" value={f.nok_phone} onChange={e => setF({...f,nok_phone:e.target.value})}/></div>
        </div>

        <div className="m-sec">Employment Details</div>
        <div className="frow2">
          <div className="fg"><label className="flbl">Job Title / Role</label><input className="inp" placeholder="e.g. Head Chef" value={f.role} onChange={e => setF({...f,role:e.target.value})}/></div>
          <div className="fg"><label className="flbl">Employment Type</label>
            <select className="sel" value={f.type} onChange={e => setF({...f,type:e.target.value})}>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="casual">Casual (+25% loading)</option>
            </select>
          </div>
          <div className="fg">
            <label className="flbl">Base Hourly Rate ($)</label>
            <input className="inp" type="number" placeholder="0.00" value={f.rate} onChange={e => setF({...f,rate:e.target.value})}/>
            {rate > 0 && <span className="fhint">Effective rate: {money(effR)}/hr{f.type==="casual" ? " (incl. 25% loading)" : ""}</span>}
          </div>
          <div className="fg">
            <label className="flbl">Standard Weekly Hours</label>
            <input className="inp" type="number" placeholder="e.g. 38" value={f.std_hrs} onChange={e => setF({...f,std_hrs:e.target.value})}/>
            {wkGross > 0 && <span className="fhint">Est. weekly gross: {money(wkGross)}</span>}
          </div>
          <div className="fg"><label className="flbl">Start Date</label><input className="inp" type="date" value={f.start} onChange={e => setF({...f,start:e.target.value})}/></div>
        </div>

        <div className="m-sec">Tax & Super</div>
        <div className="frow2">
          <div className="fg">
            <label className="flbl">TFN Provided?</label>
            <select className="sel" value={f.tfn} onChange={e => setF({...f,tfn:e.target.value})}>
              <option value="yes">Yes — TFN on file</option>
              <option value="no">No — withhold at 47%</option>
            </select>
            {f.tfn === "no" && <span className="fhint r">⚠️ Must withhold tax at 47% until TFN provided</span>}
          </div>
          <div className="fg"><label className="flbl">Super Fund (optional)</label><input className="inp" placeholder="e.g. AustralianSuper" value={f.superfund} onChange={e => setF({...f,superfund:e.target.value})}/></div>
        </div>

        {wkGross > 0 && (
          <div style={{ background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:10, padding:"13px 15px", marginTop:14 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", marginBottom:10 }}>Estimated Weekly Costs</div>
            <div className="frow4">
              {[
                { lbl:"Gross Wages",   val:money(wkGross),                            col:C.text   },
                { lbl:"PAYG (~19%)",   val:money(wkGross * PAYG_RATE),                col:C.yellow },
                { lbl:"Super (11.5%)", val:money(wkGross * SUPER_RATE),               col:C.blue   },
                { lbl:"Total Labour",  val:money(wkGross * (1+PAYG_RATE+SUPER_RATE)), col:C.accent },
              ].map((s,i) => (
                <div key={i}>
                  <div className="mono" style={{ fontSize:15, fontWeight:700, color:s.col }}>{s.val}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="fbtns" style={{ marginTop:18 }}>
          <button className="btn" onClick={save}>{isEdit ? "Save Changes" : "Add Employee"}</button>
          <button className="btn-g" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  TIMESHEET MODAL
// ════════════════════════════════════════════════════════════
function TimesheetModal({ employees, onSave, onClose }) {
  const [f, setF] = useState({ eid:"", week:"2025-W29", std_hrs:"", ot_hrs:"0", wknd_hrs:"0", super_paid:"no" });
  const emp   = employees.find(e => e.id === parseInt(f.eid));
  const std   = parseFloat(f.std_hrs)  || 0;
  const ot    = parseFloat(f.ot_hrs)   || 0;
  const wknd  = parseFloat(f.wknd_hrs) || 0;
  const gross = emp ? calcGross(emp, { std_hrs:std, ot_hrs:ot, wknd_hrs:wknd }) : 0;

  const save = () => {
    if (!f.eid || !std) return;
    onSave({ id:Date.now(), eid:parseInt(f.eid), week:f.week,
             std_hrs:std, ot_hrs:ot, wknd_hrs:wknd, super_paid:f.super_paid==="yes" });
  };

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth:520 }}>
        <div className="m-ttl">Log Weekly Hours<button className="btn-ic" style={{ fontSize:17 }} onClick={onClose}>✕</button></div>
        <div className="m-sub">Record hours for one employee for the selected week.</div>

        <div className="frow2" style={{ marginBottom:11 }}>
          <div className="fg">
            <label className="flbl">Employee *</label>
            <select className="sel" value={f.eid} onChange={e => setF({...f,eid:e.target.value})}>
              <option value="">— Select employee —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
            </select>
            {emp && <span className="fhint">{emp.type} · {money(effRate(emp))}/hr{emp.type==="casual"?" (incl. loading)":""}</span>}
          </div>
          <div className="fg">
            <label className="flbl">Week *</label>
            <input className="inp" type="week" value={f.week} onChange={e => setF({...f,week:e.target.value})}/>
            {emp && <span className="fhint">Standard: {emp.std_hrs}h/week</span>}
          </div>
        </div>

        <div className="m-sec">Hours Breakdown</div>
        <div className="frow3">
          <div className="fg">
            <label className="flbl">Standard Hours</label>
            <input className="inp" type="number" placeholder="e.g. 38" value={f.std_hrs} onChange={e => setF({...f,std_hrs:e.target.value})}/>
            {emp && std > 0 && <span className={`fhint${std > emp.std_hrs ? " y" : ""}`}>{std > emp.std_hrs ? "⚠️ Above standard" : "Within standard"}</span>}
          </div>
          <div className="fg">
            <label className="flbl">Overtime Hours <span style={{ color:C.yellow, fontSize:9.5 }}>×1.5</span></label>
            <input className="inp" type="number" placeholder="0" value={f.ot_hrs} onChange={e => setF({...f,ot_hrs:e.target.value})}/>
            {emp && ot > 0 && <span className="fhint y">OT pay: {money(effRate(emp)*OT_RATE*ot)}</span>}
          </div>
          <div className="fg">
            <label className="flbl">Weekend / PH Hours <span style={{ color:C.red, fontSize:9.5 }}>×1.75</span></label>
            <input className="inp" type="number" placeholder="0" value={f.wknd_hrs} onChange={e => setF({...f,wknd_hrs:e.target.value})}/>
            {emp && wknd > 0 && <span className="fhint r">PH pay: {money(effRate(emp)*WKND_RATE*wknd)}</span>}
          </div>
        </div>

        <div className="fg" style={{ marginTop:11 }}>
          <label className="flbl">Super Paid This Week?</label>
          <select className="sel" value={f.super_paid} onChange={e => setF({...f,super_paid:e.target.value})}>
            <option value="no">Not yet</option>
            <option value="yes">Yes — paid</option>
          </select>
        </div>

        {gross > 0 && (
          <div style={{ background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", marginTop:13 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", marginBottom:9 }}>This Week's Estimated Costs</div>
            <div className="frow4">
              {[
                { lbl:`Gross (${std+ot+wknd}h)`, val:money(gross),                            col:C.text   },
                { lbl:"PAYG (~19%)",              val:money(gross*PAYG_RATE),                  col:C.yellow },
                { lbl:"Super (11.5%)",            val:money(gross*SUPER_RATE),                 col:C.blue   },
                { lbl:"Total Labour",             val:money(gross*(1+PAYG_RATE+SUPER_RATE)),   col:C.accent },
              ].map((s,i) => (
                <div key={i}>
                  <div className="mono" style={{ fontSize:14, fontWeight:700, color:s.col }}>{s.val}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="fbtns" style={{ marginTop:17 }}>
          <button className="btn" onClick={save}>Log Hours</button>
          <button className="btn-g" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  STAFF & WAGES PAGE
// ════════════════════════════════════════════════════════════
function WagesPage({ employees, setEmployees, timesheets, setTimesheets, leave, setLeave, showToast }) {
  const [tab,      setTab]      = useState("profiles");
  const [empModal, setEmpModal] = useState(null);
  const [tsModal,  setTsModal]  = useState(false);
  // Leave form state
  const [lf, setLf] = useState({ eid:"", type:"annual", date:todayStr, hours:"", notes:"" });

  const rows       = annotateTimesheets(employees, timesheets);
  const totalGross = rows.reduce((s,t) => s + t.gross,  0);
  const totalSuper = rows.reduce((s,t) => s + t.super,  0);
  const totalLabour= rows.reduce((s,t) => s + t.labour, 0);
  const unpaidRows = timesheets.filter(t => !t.super_paid).length;

  const saveEmp = emp => {
    if (empModal === "add") { setEmployees(p => [...p, emp]); showToast(`${emp.name} added!`); }
    else { setEmployees(p => p.map(e => e.id === emp.id ? emp : e)); showToast(`${emp.name} updated!`); }
    setEmpModal(null);
  };
  const delEmp   = id  => { setEmployees(p => p.filter(e => e.id !== id)); setTimesheets(p => p.filter(t => t.eid !== id)); setLeave(p => p.filter(l => l.eid !== id)); showToast("Employee removed."); };
  const saveTs   = ts  => { setTimesheets(p => [...p, ts]); setTsModal(false); showToast("Hours logged!"); };
  const markSuper= id  => { setTimesheets(p => p.map(t => t.id === id ? {...t, super_paid:true} : t)); showToast("Super marked as paid!"); };

  const addLeave = () => {
    if (!lf.eid || !lf.hours) return;
    const emp = employees.find(e => e.id === parseInt(lf.eid));
    if (!emp) return;
    setLeave(p => [...p, { id:Date.now(), eid:parseInt(lf.eid), type:lf.type, date:lf.date, hours:parseFloat(lf.hours)||0, notes:lf.notes }]);
    setLf({ eid:lf.eid, type:lf.type, date:todayStr, hours:"", notes:"" });
    showToast("Leave logged!");
  };

  // Leave type labels/colours
  const LEAVE_CFG = {
    annual:   { lbl:"Annual Leave",        col:C.teal,   cls:"pl-t" },
    personal: { lbl:"Personal/Carer's",    col:C.blue,   cls:"pl-b" },
    lieu:     { lbl:"Day in Lieu",          col:C.purple, cls:"pl-p" },
  };

  return (
    <>
      {(empModal === "add" || empModal?.id) && (
        <EmployeeModal emp={empModal === "add" ? null : empModal} onSave={saveEmp} onClose={() => setEmpModal(null)}/>
      )}
      {tsModal && (
        <TimesheetModal employees={employees} onSave={saveTs} onClose={() => setTsModal(false)}/>
      )}

      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">Staff & Wages</div><div className="psub">Employee profiles, timesheets and labour cost estimates</div></div>
        <div className="hdr-right">
          {tab === "profiles"   && <button className="btn" onClick={() => setEmpModal("add")}>+ Add Employee</button>}
          {tab === "timesheets" && <button className="btn" onClick={() => setTsModal(true)}>+ Log Hours</button>}
        </div>
      </div>

      <div className="g4">
        {[
          { lbl:"Active Staff",       val:employees.length, cls:"t" },
          { lbl:"Total Gross Wages",  val:money(totalGross), cls:"" },
          { lbl:"Est. Super Owed",    val:money(totalSuper), cls:"b" },
          { lbl:"Unpaid Super Rows",  val:unpaidRows, cls:unpaidRows > 0 ? "r" : "g" },
        ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
      </div>

      <div className="tabs">
        {[["profiles","👤 Profiles"],["timesheets","🕐 Timesheets"],["summary","📊 Wage Summary"],["leave","🏖️ Leave & Lieu"]].map(([id,lbl]) => (
          <div key={id} className={`tab${tab===id?" on-a":""}`} onClick={() => setTab(id)}>{lbl}</div>
        ))}
      </div>

      {/* ── PROFILES ── */}
      {tab === "profiles" && (
        <>
          {employees.filter(e => !e.tfn).length > 0 && (
            <div className="alert al-r" style={{ marginBottom:13 }}>
              <span className="al-ico">⚠️</span>
              <div>
                <div className="al-ttl">{employees.filter(e=>!e.tfn).length} employee{employees.filter(e=>!e.tfn).length>1?"s":""} without TFN — withhold tax at 47%</div>
                <div className="al-msg">Must withhold at the top marginal rate until TFN is provided.</div>
              </div>
            </div>
          )}
          {employees.length === 0
            ? <div className="empty-state"><div className="empty-icon">👤</div><div className="empty-txt">No employees yet. Click "+ Add Employee" to get started.</div></div>
            : (
              <div className="emp-grid">
                {employees.map(emp => {
                  const er     = effRate(emp);
                  const wkGros = er * emp.std_hrs;
                  return (
                    <div key={emp.id} className="emp-card">
                      {/* Header row */}
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:13 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ width:38, height:38, borderRadius:"50%", background:avatarBg(emp.id), display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", flexShrink:0 }}>
                            {initials(emp.name)}
                          </div>
                          <div>
                            <div style={{ fontWeight:700, fontSize:14, letterSpacing:"-.3px" }}>{emp.name}</div>
                            <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>
                              {emp.role} ·{" "}
                              <span className={`pill ${emp.type==="casual"?"pl-y":emp.type==="part-time"?"pl-b":"pl-g"}`}>{emp.type}</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:5 }}>
                          <button className="btn-b" onClick={() => setEmpModal(emp)}>Edit</button>
                          <button className="btn-r" onClick={() => delEmp(emp.id)}>Remove</button>
                        </div>
                      </div>

                      {/* Personal details grid */}
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px 12px", fontSize:11.5, marginBottom:12 }}>
                        {[
                          { ico:"📧", lbl:"Email",        val:emp.email    || "—" },
                          { ico:"📱", lbl:"Phone",        val:emp.phone    || "—" },
                          { ico:"🎂", lbl:"Date of Birth",val:emp.dob ? `${emp.dob} (age ${calcAge(emp.dob)})` : "—" },
                          { ico:"📅", lbl:"Start Date",   val:emp.start    || "—" },
                          { ico:"🚨", lbl:"Next of Kin",  val:emp.nok_name || "—" },
                          { ico:"📞", lbl:"NOK Phone",    val:emp.nok_phone|| "—" },
                        ].map((r,i) => (
                          <div key={i} style={{ display:"flex", gap:5, alignItems:"flex-start" }}>
                            <span style={{ flexShrink:0, marginTop:1 }}>{r.ico}</span>
                            <div>
                              <div style={{ fontSize:9.5, color:C.dim, textTransform:"uppercase", letterSpacing:".4px" }}>{r.lbl}</div>
                              <div style={{ color:C.text, fontWeight:500, marginTop:1, wordBreak:"break-all" }}>{r.val}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Wages breakdown box */}
                      <div style={{ background:C.surfaceAlt, borderRadius:9, padding:"10px 11px" }}>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
                          {[
                            { lbl:"Base Rate",    val:`${money(emp.rate)}/hr` },
                            { lbl:"Eff. Rate",    val:`${money(er)}/hr` },
                            { lbl:"Std Hrs/wk",   val:`${emp.std_hrs}h` },
                            { lbl:"Wkly Gross",   val:money(wkGros) },
                            { lbl:"Wkly PAYG",    val:money(wkGros*PAYG_RATE),  col:C.yellow },
                            { lbl:"Wkly Super",   val:money(wkGros*SUPER_RATE), col:C.blue   },
                            { lbl:"Total Labour", val:money(wkGros*(1+PAYG_RATE+SUPER_RATE)), col:C.accent },
                            { lbl:"TFN",          val:emp.tfn?"✅ On file":"❌ Missing", col:emp.tfn?C.green:C.red },
                          ].map((s,i) => (
                            <div key={i}>
                              <div style={{ fontSize:9, color:C.dim, textTransform:"uppercase", letterSpacing:".4px" }}>{s.lbl}</div>
                              <div className="mono" style={{ fontSize:12, fontWeight:700, color:s.col||C.text, marginTop:2 }}>{s.val}</div>
                            </div>
                          ))}
                        </div>
                        {emp.superfund && (
                          <div style={{ marginTop:8, fontSize:11, color:C.muted, borderTop:`1px solid ${C.border}`, paddingTop:7 }}>
                            🏦 Super Fund: <strong style={{ color:C.text }}>{emp.superfund}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </>
      )}

      {/* ── TIMESHEETS ── */}
      {tab === "timesheets" && (
        <div className="bc">
          <div className="bctit">All Timesheet Entries<span style={{ fontSize:11, fontWeight:400, color:C.muted }}>{timesheets.length} entries</span></div>
          <table className="tbl">
            <thead>
              <tr><th>Employee</th><th>Week</th><th>Std Hrs</th><th>OT Hrs ×1.5</th><th>Wknd/PH ×1.75</th><th>Total Hrs</th><th>Gross</th><th>PAYG</th><th>Super</th><th>Labour</th><th>Super Paid</th><th></th></tr>
            </thead>
            <tbody>
              {rows.length === 0
                ? <tr><td colSpan={12}><div className="empty-state"><div className="empty-icon">🕐</div><div className="empty-txt">No entries. Click "+ Log Hours" to start.</div></div></td></tr>
                : rows.slice().reverse().map(t => (
                    <tr key={t.id}>
                      <td>
                        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                          <div style={{ width:24, height:24, borderRadius:"50%", background:avatarBg(t.emp.id), display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"#fff", flexShrink:0 }}>
                            {initials(t.emp.name)}
                          </div>
                          <div>
                            <div style={{ fontWeight:600, fontSize:12 }}>{t.emp.name}</div>
                            <div style={{ fontSize:10.5, color:C.muted }}>{t.emp.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="mono">{t.week}</td>
                      <td className="mono">{t.std_hrs}h</td>
                      <td className="mono" style={{ color:t.ot_hrs > 0 ? C.yellow : C.dim }}>{t.ot_hrs}h</td>
                      <td className="mono" style={{ color:t.wknd_hrs > 0 ? C.red : C.dim }}>{t.wknd_hrs}h</td>
                      <td className="mono" style={{ fontWeight:700 }}>{t.total_hrs}h</td>
                      <td style={{ fontWeight:700 }}>{money(t.gross)}</td>
                      <td style={{ color:C.yellow }}>{money(t.payg)}</td>
                      <td style={{ color:C.blue }}>{money(t.super)}</td>
                      <td style={{ color:C.accent, fontWeight:600 }}>{money(t.labour)}</td>
                      <td>{t.super_paid
                        ? <span className="pill pl-g">✅ Paid</span>
                        : <button className="btn-t" onClick={() => markSuper(t.id)}>Mark Paid</button>}
                      </td>
                      <td><button className="btn-ic" onClick={() => setTimesheets(p => p.filter(x => x.id !== t.id))}>🗑️</button></td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* ── WAGE SUMMARY ── */}
      {tab === "summary" && (
        <>
          <div className="bc">
            <div className="bctit">Per-Employee Summary</div>
            <table className="tbl">
              <thead>
                <tr><th>Employee</th><th>Type</th><th>Rate</th><th>Total Hrs</th><th>OT Hrs</th><th>Wknd Hrs</th><th>Gross</th><th>PAYG</th><th>Super</th><th>Total Labour</th><th>Super Status</th></tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const er   = rows.filter(t => t.eid === emp.id);
                  const hrs  = er.reduce((s,t) => s + t.total_hrs, 0);
                  const ot   = er.reduce((s,t) => s + t.ot_hrs,    0);
                  const wk   = er.reduce((s,t) => s + t.wknd_hrs,  0);
                  const gr   = er.reduce((s,t) => s + t.gross,     0);
                  const py   = er.reduce((s,t) => s + t.payg,      0);
                  const su   = er.reduce((s,t) => s + t.super,     0);
                  const la   = er.reduce((s,t) => s + t.labour,    0);
                  const unp  = er.filter(t => !t.super_paid).length;
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                          <div style={{ width:26, height:26, borderRadius:"50%", background:avatarBg(emp.id), display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#fff" }}>
                            {initials(emp.name)}
                          </div>
                          <div>
                            <div style={{ fontWeight:600 }}>{emp.name}</div>
                            <div style={{ fontSize:10.5, color:C.muted }}>{emp.role}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className={`pill ${emp.type==="casual"?"pl-y":emp.type==="part-time"?"pl-b":"pl-g"}`}>{emp.type}</span></td>
                      <td className="mono">{money(effRate(emp))}/hr</td>
                      <td className="mono" style={{ fontWeight:600 }}>{hrs}h</td>
                      <td className="mono" style={{ color:ot > 0 ? C.yellow : C.dim }}>{ot}h</td>
                      <td className="mono" style={{ color:wk > 0 ? C.red : C.dim }}>{wk}h</td>
                      <td style={{ fontWeight:700 }}>{money(gr)}</td>
                      <td style={{ color:C.yellow }}>{money(py)}</td>
                      <td style={{ color:C.blue }}>{money(su)}</td>
                      <td style={{ color:C.accent, fontWeight:600 }}>{money(la)}</td>
                      <td>{unp === 0 ? <span className="pill pl-g">✅ All paid</span> : <span className="pill pl-r">❌ {unp} unpaid</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>TOTALS</td>
                  <td className="mono">{rows.reduce((s,t)=>s+t.total_hrs,0)}h</td>
                  <td className="mono" style={{ color:C.yellow }}>{rows.reduce((s,t)=>s+t.ot_hrs,0)}h</td>
                  <td className="mono" style={{ color:C.red }}>{rows.reduce((s,t)=>s+t.wknd_hrs,0)}h</td>
                  <td>{money(totalGross)}</td>
                  <td style={{ color:C.yellow }}>{money(rows.reduce((s,t)=>s+t.payg,0))}</td>
                  <td style={{ color:C.blue }}>{money(totalSuper)}</td>
                  <td style={{ color:C.accent }}>{money(totalLabour)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="g4">
            {[
              { lbl:"Total Hours",       val:rows.reduce((s,t)=>s+t.total_hrs,0)+"h", cls:"t" },
              { lbl:"Overtime Hours",    val:rows.reduce((s,t)=>s+t.ot_hrs,0)+"h",    cls:"y" },
              { lbl:"Weekend/PH Hours",  val:rows.reduce((s,t)=>s+t.wknd_hrs,0)+"h",  cls:"r" },
              { lbl:"Total Labour Cost", val:money(totalLabour),                        cls:"" },
            ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
          </div>
        </>
      )}

      {/* ── LEAVE & LIEU ── */}
      {tab === "leave" && (
        <>
          {/* Leave balance cards per employee */}
          <div style={{ display:"flex", flexDirection:"column", gap:13, marginBottom:16 }}>
            {employees.map(emp => {
              const accrued = calcLeaveAccruals(emp, timesheets);
              const taken   = calcLeaveTaken(emp, leave);
              const isCasual= emp.type === "casual";
              const dpd     = hrsPerDay(emp); // hrs per day

              const leaveTypes = [
                { key:"annual",   ...LEAVE_CFG.annual,
                  accrued: accrued.annual,   taken: taken.annual,
                  balance: accrued.annual - taken.annual,
                  note: isCasual ? "Casuals not entitled to annual leave" : null },
                { key:"personal", ...LEAVE_CFG.personal,
                  accrued: accrued.personal, taken: taken.personal,
                  balance: accrued.personal - taken.personal,
                  note: isCasual ? "Casuals not entitled to personal leave" : null },
                { key:"lieu",     ...LEAVE_CFG.lieu,
                  accrued: accrued.lieu,     taken: taken.lieu,
                  balance: accrued.lieu - taken.lieu,
                  note: "Accrues hour-for-hour from OT & weekend/PH hours worked" },
              ];

              return (
                <div key={emp.id} className="bc" style={{ marginBottom:0 }}>
                  {/* Employee header */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                    <div style={{ width:34, height:34, borderRadius:"50%", background:avatarBg(emp.id), display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff", flexShrink:0 }}>
                      {initials(emp.name)}
                    </div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{emp.name}</div>
                      <div style={{ fontSize:11, color:C.muted }}>{emp.role} · <span className={`pill ${isCasual?"pl-y":emp.type==="part-time"?"pl-b":"pl-g"}`}>{emp.type}</span></div>
                    </div>
                  </div>

                  {/* Three leave type columns */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                    {leaveTypes.map(lt => {
                      const balDays = dpd > 0 ? (lt.balance / dpd).toFixed(1) : "—";
                      const takDays = dpd > 0 ? (lt.taken   / dpd).toFixed(1) : "—";
                      const accDays = dpd > 0 ? (lt.accrued / dpd).toFixed(1) : "—";
                      const isNeg   = lt.balance < 0;
                      const isNA    = isCasual && lt.key !== "lieu";
                      return (
                        <div key={lt.key} style={{ background:C.surfaceAlt, border:`1px solid ${isNeg ? "rgba(248,81,73,.3)" : C.border}`, borderRadius:10, padding:"13px 14px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:11 }}>
                            <div style={{ width:8, height:8, borderRadius:"50%", background:lt.col, flexShrink:0 }}/>
                            <span style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".7px" }}>{lt.lbl}</span>
                          </div>
                          {isNA ? (
                            <div style={{ fontSize:12, color:C.dim, fontStyle:"italic" }}>Not applicable — casual employees are not entitled to this leave type</div>
                          ) : (
                            <>
                              {/* Balance — big number */}
                              <div style={{ marginBottom:10 }}>
                                <div style={{ fontSize:9, color:C.dim, textTransform:"uppercase", letterSpacing:".5px" }}>Balance</div>
                                <div className="mono" style={{ fontSize:22, fontWeight:700, color:isNeg ? C.red : lt.col, lineHeight:1.1, marginTop:3 }}>
                                  {isNeg ? "−" : ""}{Math.abs(lt.balance).toFixed(1)}h
                                </div>
                                <div style={{ fontSize:11, color:isNeg ? C.red : C.muted, marginTop:2 }}>
                                  {dpd > 0 ? `${Math.abs(parseFloat(balDays))} days` : ""}
                                  {isNeg ? " — overdrawn" : ""}
                                </div>
                              </div>
                              {/* Accrued / Taken row */}
                              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                                <div>
                                  <div style={{ fontSize:9, color:C.dim, textTransform:"uppercase" }}>Accrued</div>
                                  <div className="mono" style={{ fontSize:13, fontWeight:600, color:C.text, marginTop:2 }}>{lt.accrued.toFixed(1)}h</div>
                                  <div style={{ fontSize:10.5, color:C.muted }}>{accDays} days</div>
                                </div>
                                <div>
                                  <div style={{ fontSize:9, color:C.dim, textTransform:"uppercase" }}>Taken</div>
                                  <div className="mono" style={{ fontSize:13, fontWeight:600, color:C.yellow, marginTop:2 }}>{lt.taken.toFixed(1)}h</div>
                                  <div style={{ fontSize:10.5, color:C.muted }}>{takDays} days</div>
                                </div>
                              </div>
                              {/* Accrual bar */}
                              {lt.accrued > 0 && (
                                <div style={{ marginTop:10 }}>
                                  <div style={{ height:5, background:C.border, borderRadius:3, overflow:"hidden" }}>
                                    <div style={{ height:"100%", borderRadius:3, background:isNeg ? C.red : lt.col, width:`${Math.min((lt.taken/lt.accrued)*100, 100)}%`, transition:"width .4s" }}/>
                                  </div>
                                  <div style={{ fontSize:9.5, color:C.dim, marginTop:3 }}>{lt.accrued > 0 ? `${((lt.taken/lt.accrued)*100).toFixed(0)}% used` : ""}</div>
                                </div>
                              )}
                              {lt.note && <div style={{ fontSize:10, color:C.dim, marginTop:8, borderTop:`1px solid ${C.border}`, paddingTop:6, lineHeight:1.5 }}>{lt.note}</div>}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Negative balance warning */}
                  {leaveTypes.some(lt => lt.balance < 0 && !(isCasual && lt.key !== "lieu")) && (
                    <div className="alert al-r" style={{ marginTop:12, marginBottom:0 }}>
                      <span className="al-ico">⚠️</span>
                      <div>
                        <div className="al-ttl">Overdrawn leave balance</div>
                        <div className="al-msg">This employee has taken more leave than they have accrued. Consider adjusting their leave records or discussing a repayment arrangement.</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {employees.length === 0 && (
              <div className="empty-state"><div className="empty-icon">🏖️</div><div className="empty-txt">No employees yet.</div></div>
            )}
          </div>

          {/* Log leave taken form */}
          <div className="fsec">
            <div className="ftit">Log Leave Taken</div>
            <div className="frow3" style={{ marginBottom:11 }}>
              <div className="fg">
                <label className="flbl">Employee *</label>
                <select className="sel" value={lf.eid} onChange={e => setLf({...lf,eid:e.target.value})}>
                  <option value="">— Select employee —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="flbl">Leave Type *</label>
                <select className="sel" value={lf.type} onChange={e => setLf({...lf,type:e.target.value})}>
                  <option value="annual">Annual Leave</option>
                  <option value="personal">Personal / Carer's Leave</option>
                  <option value="lieu">Day in Lieu</option>
                </select>
                {lf.eid && lf.type !== "lieu" && employees.find(e=>e.id===parseInt(lf.eid))?.type === "casual" && (
                  <span className="fhint r">⚠️ Casual employees are not entitled to this leave type</span>
                )}
              </div>
              <div className="fg">
                <label className="flbl">Date *</label>
                <input className="inp" type="date" value={lf.date} onChange={e => setLf({...lf,date:e.target.value})}/>
              </div>
              <div className="fg">
                <label className="flbl">Hours Taken *</label>
                <input className="inp" type="number" placeholder="e.g. 7.6" value={lf.hours} onChange={e => setLf({...lf,hours:e.target.value})}/>
                {lf.eid && lf.hours && (
                  <span className="fhint">
                    = {(parseFloat(lf.hours) / hrsPerDay(employees.find(e=>e.id===parseInt(lf.eid)) || {std_hrs:7.6})).toFixed(2)} days
                  </span>
                )}
              </div>
              <div className="fg" style={{ gridColumn:"span 2" }}>
                <label className="flbl">Notes (optional)</label>
                <input className="inp" placeholder="e.g. Annual leave — family holiday" value={lf.notes} onChange={e => setLf({...lf,notes:e.target.value})}/>
              </div>
            </div>
            <div className="fbtns">
              <button className="btn" onClick={addLeave}>Log Leave</button>
              <button className="btn-g" onClick={() => setLf({ eid:"", type:"annual", date:todayStr, hours:"", notes:"" })}>Clear</button>
            </div>
          </div>

          {/* Leave history table */}
          <div className="bc">
            <div className="bctit">Leave History<span style={{ fontSize:11, fontWeight:400, color:C.muted }}>{leave.length} records</span></div>
            <table className="tbl">
              <thead><tr><th>Employee</th><th>Leave Type</th><th>Date</th><th>Hours</th><th>Days</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                {leave.length === 0
                  ? <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">🏖️</div><div className="empty-txt">No leave records yet.</div></div></td></tr>
                  : leave.slice().sort((a,b) => b.date.localeCompare(a.date)).map(l => {
                      const emp = employees.find(e => e.id === l.eid);
                      if (!emp) return null;
                      const cfg = LEAVE_CFG[l.type] || LEAVE_CFG.lieu;
                      const days= (l.hours / hrsPerDay(emp)).toFixed(2);
                      return (
                        <tr key={l.id}>
                          <td>
                            <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                              <div style={{ width:22, height:22, borderRadius:"50%", background:avatarBg(emp.id), display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:700, color:"#fff" }}>
                                {initials(emp.name)}
                              </div>
                              <span style={{ fontWeight:500 }}>{emp.name}</span>
                            </div>
                          </td>
                          <td><span className={`pill ${cfg.cls}`}>{cfg.lbl}</span></td>
                          <td className="mono">{l.date}</td>
                          <td className="mono" style={{ fontWeight:600 }}>{l.hours}h</td>
                          <td className="mono" style={{ color:C.muted }}>{days}d</td>
                          <td style={{ color:C.muted, fontSize:12 }}>{l.notes || "—"}</td>
                          <td><button className="btn-ic" onClick={() => { setLeave(p => p.filter(x => x.id !== l.id)); showToast("Leave record removed."); }}>🗑️</button></td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>

          <div className="disc">
            <div className="d-ttl">⚠️ Leave Entitlement Disclaimer</div>
            <div className="d-txt">Leave accruals are estimated based on weeks worked in logged timesheets. <strong>Annual leave</strong> accrues at 4 weeks per year for FT/PT employees. <strong>Personal/Carer's leave</strong> accrues at 10 days per year for FT/PT employees. <strong>Casual employees</strong> are not entitled to paid annual or personal leave. <strong>Day in Lieu</strong> is calculated hour-for-hour from overtime and weekend/PH hours. Always confirm entitlements under the applicable Modern Award or Fair Work Act. These are estimates only — consult a registered payroll provider or Fair Work for accurate obligations.</div>
          </div>
        </>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  INSURANCE PAGE
// ════════════════════════════════════════════════════════════
const INS_COLORS = {
  "Workers Compensation": C.red,
  "Public Liability":     C.blue,
  "Equipment & Property": C.yellow,
  "Business Interruption":C.teal,
  "Product Liability":    C.purple,
  "Cyber Insurance":      C.green,
  "Other":                C.muted,
};

function InsurancePage({ insurance, setInsurance, employees, timesheets, showToast }) {
  const [f, setF]       = useState({ type:"Workers Compensation", annual:"", notes:"" });
  const [editId, setEditId] = useState(null);

  const rows   = annotateTimesheets(employees, timesheets);
  const weeks  = new Set(timesheets.map(t => t.week)).size || 1;
  const annualPayroll = rows.reduce((s,t) => s + t.gross, 0) / weeks * 52;
  const totalAnnual   = insurance.reduce((s,i) => s + i.annual, 0);

  const save = () => {
    if (!f.annual) return;
    const entry = { type:f.type, annual:parseFloat(f.annual)||0, notes:f.notes };
    if (editId) {
      setInsurance(p => p.map(i => i.id === editId ? {...i, ...entry} : i));
      showToast("Policy updated!");
    } else {
      setInsurance(p => [...p, { id:Date.now(), ...entry }]);
      showToast("Policy added!");
    }
    setF({ type:"Workers Compensation", annual:"", notes:"" });
    setEditId(null);
  };

  const startEdit = ins => { setF({ type:ins.type, annual:String(ins.annual), notes:ins.notes }); setEditId(ins.id); };
  const getCol    = type => INS_COLORS[type] || C.muted;

  return (
    <>
      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">Insurance Dashboard</div><div className="psub">Track insurance policies as a cost and % of payroll</div></div>
      </div>

      <div className="g4">
        {[
          { lbl:"Total Annual Premium", val:money(totalAnnual),       cls:"p" },
          { lbl:"Weekly Cost",          val:money(totalAnnual/52),    cls:"" },
          { lbl:"% of Payroll",         val:annualPayroll > 0 ? `${((totalAnnual/annualPayroll)*100).toFixed(1)}%` : "—", cls:"y" },
          { lbl:"Active Policies",      val:insurance.length,         cls:"t" },
        ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
      </div>

      <div className="g3">
        {insurance.map(ins => {
          const col  = getCol(ins.type);
          const pct  = annualPayroll > 0 ? (ins.annual / annualPayroll) * 100 : 0;
          const bar  = Math.min(pct / 10 * 100, 100); // 10% = full bar
          return (
            <div key={ins.id} className="ins-card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:9.5, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".7px", marginBottom:4 }}>{ins.type}</div>
                  <div className="mono" style={{ fontSize:22, fontWeight:700, color:col }}>{money(ins.annual)}</div>
                  <div style={{ fontSize:10.5, color:C.muted }}>/year</div>
                </div>
                <div style={{ display:"flex", gap:5 }}>
                  <button className="btn-b" onClick={() => startEdit(ins)}>Edit</button>
                  <button className="btn-r" onClick={() => { setInsurance(p => p.filter(x => x.id !== ins.id)); showToast("Policy removed."); }}>Remove</button>
                </div>
              </div>
              <div style={{ display:"flex", gap:16, marginBottom:9 }}>
                <div>
                  <div style={{ fontSize:9, color:C.dim, textTransform:"uppercase" }}>Weekly</div>
                  <div className="mono" style={{ fontWeight:700, fontSize:13, color:col, marginTop:2 }}>{money(ins.annual/52)}</div>
                </div>
                <div>
                  <div style={{ fontSize:9, color:C.dim, textTransform:"uppercase" }}>% of Payroll</div>
                  <div className="mono" style={{ fontWeight:700, fontSize:13, color:annualPayroll > 0 ? col : C.dim, marginTop:2 }}>
                    {annualPayroll > 0 ? `${pct.toFixed(2)}%` : "—"}
                  </div>
                </div>
              </div>
              <div className="ins-bar"><div className="ins-fill" style={{ width:`${bar}%`, background:col }}/></div>
              <div style={{ fontSize:9.5, color:C.dim }}>Bar shows % of annual payroll (10% = full)</div>
              {ins.notes && <div style={{ marginTop:8, fontSize:11, color:C.muted, borderTop:`1px solid ${C.border}`, paddingTop:7 }}>📝 {ins.notes}</div>}
            </div>
          );
        })}
        {insurance.length === 0 && (
          <div className="empty-state" style={{ gridColumn:"1/-1" }}>
            <div className="empty-icon">🛡️</div>
            <div className="empty-txt">No policies yet. Add your first one below.</div>
          </div>
        )}
      </div>

      {insurance.length > 0 && (
        <div className="bc">
          <div className="bctit">Breakdown by Type</div>
          {insurance.map(ins => {
            const pct = totalAnnual > 0 ? (ins.annual / totalAnnual) * 100 : 0;
            return (
              <div key={ins.id} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:12.5, fontWeight:500 }}>{ins.type}</span>
                  <span className="mono" style={{ fontSize:12.5, fontWeight:700 }}>
                    {money(ins.annual)} <span style={{ color:C.muted, fontSize:10.5 }}>({pct.toFixed(1)}%)</span>
                  </span>
                </div>
                <div style={{ height:7, background:C.border, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", borderRadius:3, background:getCol(ins.type), width:`${pct}%` }}/>
                </div>
              </div>
            );
          })}
          <div style={{ paddingTop:12, borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", marginTop:4 }}>
            <span style={{ fontWeight:700 }}>Total Annual Insurance</span>
            <span className="mono" style={{ fontWeight:700, fontSize:17, color:C.purple }}>{money(totalAnnual)}</span>
          </div>
          {annualPayroll > 0 && (
            <div style={{ fontSize:11.5, color:C.muted, marginTop:5 }}>
              ≈ {((totalAnnual/annualPayroll)*100).toFixed(2)}% of estimated annual payroll ({money(annualPayroll)})
            </div>
          )}
        </div>
      )}

      <div className="fsec">
        <div className="ftit">{editId ? "Edit Policy" : "Add Insurance Policy"}</div>
        <div className="frow3">
          <div className="fg">
            <label className="flbl">Insurance Type</label>
            <select className="sel" value={f.type} onChange={e => setF({...f,type:e.target.value})}>
              {INS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="flbl">Annual Premium ($)</label>
            <input className="inp" type="number" placeholder="0.00" value={f.annual} onChange={e => setF({...f,annual:e.target.value})}/>
            {f.annual && <span className="fhint">Weekly: {money((parseFloat(f.annual)||0)/52)} · Monthly: {money((parseFloat(f.annual)||0)/12)}</span>}
          </div>
          <div className="fg">
            <label className="flbl">Notes (optional)</label>
            <input className="inp" placeholder="e.g. Renewal due Oct 2025" value={f.notes} onChange={e => setF({...f,notes:e.target.value})}/>
          </div>
        </div>
        <div className="fbtns">
          <button className="btn" onClick={save}>{editId ? "Update Policy" : "Add Policy"}</button>
          {editId && <button className="btn-g" onClick={() => { setEditId(null); setF({type:"Workers Compensation",annual:"",notes:""}); }}>Cancel</button>}
        </div>
      </div>

      <div className="disc">
        <div className="d-ttl">⚠️ Insurance Disclaimer</div>
        <div className="d-txt">Insurance costs are shown for budgeting purposes only. Workers Compensation obligations are mandated by state law and vary by state, industry and payroll. Consult a licensed insurance broker to ensure adequate cover. Annual payroll shown is estimated from logged timesheets only.</div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  TAX SUMMARY
// ════════════════════════════════════════════════════════════
function TaxSummaryPage({ revenue, expenses, employees, timesheets }) {
  const rows       = annotateTimesheets(employees, timesheets);
  const totalRev   = revenue.reduce((s,r) => s + r.amount, 0);
  const gstColl    = totalRev / 11;
  const gstCreds   = expenses.filter(e => e.gst).reduce((s,e) => s + e.amount/11, 0);
  const gstPay     = gstColl - gstCreds;
  const totalWages = rows.reduce((s,t) => s + t.gross,  0);
  const totalPayg  = rows.reduce((s,t) => s + t.payg,   0);
  const totalSuper = rows.reduce((s,t) => s + t.super,  0);
  const estBAS     = gstPay + totalPayg;
  const wklyRes    = estBAS / 13;
  const status     = gstPay < gstColl*0.5 ? "g" : gstPay < gstColl*0.8 ? "y" : "r";

  return (
    <>
      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">Tax Summary</div><div className="psub">Estimated BAS for {quarter} — for planning only</div></div>
      </div>

      <div className={`banner ${status}`}>
        <div className={`bdot ${status}`}/>
        {status==="g" ? "✅ On track — reserves look healthy"
          : status==="y" ? "⚠️ Watch expenses — GST payable is growing"
          : "🔴 Tax shortfall risk — increase your weekly reserve"}
      </div>

      <div className="g2">
        <div className="bc">
          <div className="bctit" style={{ marginBottom:12 }}>GST Calculation</div>
          <div className="bas-row"><span className="bas-lbl">Total Revenue (incl. GST)</span><span className="bas-val">{money(totalRev)}</span></div>
          <div className="bas-row"><span className="bas-lbl">GST Collected (÷11)</span><span className="bas-val" style={{ color:C.red }}>+ {money(gstColl)}</span></div>
          <div className="bas-row"><span className="bas-lbl">GST Credits (expenses)</span><span className="bas-val" style={{ color:C.green }}>− {money(gstCreds)}</span></div>
          <div className="bas-tot"><span className="bas-tot-lbl">Net GST Payable</span><span className="bas-tot-val">{money(gstPay)}</span></div>
        </div>
        <div className="bc">
          <div className="bctit" style={{ marginBottom:12 }}>PAYG & Super</div>
          <div className="bas-row"><span className="bas-lbl">Total Gross Wages</span><span className="bas-val">{money(totalWages)}</span></div>
          <div className="bas-row"><span className="bas-lbl">Est. PAYG (~19%)</span><span className="bas-val" style={{ color:C.yellow }}>{money(totalPayg)}</span></div>
          <div className="bas-row"><span className="bas-lbl">Est. Super (11.5%)</span><span className="bas-val" style={{ color:C.blue }}>{money(totalSuper)}</span></div>
          <div className="bas-tot"><span className="bas-tot-lbl">Total Employment Cost</span><span className="bas-tot-val">{money(totalWages+totalPayg+totalSuper)}</span></div>
        </div>
      </div>

      <div className="bc">
        <div className="bctit" style={{ marginBottom:12 }}>Estimated Quarterly BAS — {quarter}</div>
        <div className="bas-row"><span className="bas-lbl">Net GST Payable</span><span className="bas-val">{money(gstPay)}</span></div>
        <div className="bas-row"><span className="bas-lbl">PAYG Withholding</span><span className="bas-val">{money(totalPayg)}</span></div>
        <div className="bas-tot"><span className="bas-tot-lbl">Total Estimated BAS</span><span className="bas-tot-val">{money(estBAS)}</span></div>
        <div style={{ background:C.surfaceAlt, borderRadius:9, padding:"9px 12px", marginTop:7, fontSize:11, color:C.muted, lineHeight:1.7 }}>
          ⚠️ <strong>Disclaimer:</strong> Estimate only. Always confirm with a registered tax agent before lodging your BAS.
        </div>
      </div>

      <div className="reserve">
        <div className="r-lbl">🏦 Recommended Weekly Tax Reserve</div>
        <div className="r-big">{money(wklyRes)}</div>
        <div className="r-sub">Set aside <strong>{money(wklyRes)}</strong>/week — over 13 weeks you'll have <strong>{money(wklyRes*13)}</strong> ready for your BAS.</div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  TAX SAVER
// ════════════════════════════════════════════════════════════
function TaxSaverPage({ expenses, setExpenses, employees, timesheets, setTimesheets, showToast }) {
  const [tab,      setTab]      = useState("overview");
  const [expanded, setExpanded] = useState(null);

  const analysed   = analyseExpenses(expenses);
  const rows       = annotateTimesheets(employees, timesheets);
  const missing    = analysed.filter(e => e.gstStatus === "missing-invoice").length;
  const review     = analysed.filter(e => e.gstStatus === "review").length;
  const suggestions= analysed.filter(e => e.suggestion).length;
  const entFlags   = analysed.filter(e => e.ent).length;
  const unpaidSup  = timesheets.filter(t => !t.super_paid).length;
  const claimable  = analysed.filter(e => e.gstStatus === "claimable").reduce((s,e) => s + e.amount/11, 0);
  const score      = Math.max(0, Math.min(100, 100 - missing*12 - suggestions*8 - entFlags*10 - unpaidSup*15));

  const gstCfg = {
    "claimable":       { cls:"pl-g", ico:"✅", lbl:"Claimable" },
    "missing-invoice": { cls:"pl-r", ico:"🧾", lbl:"Missing Invoice" },
    "review":          { cls:"pl-y", ico:"🔍", lbl:"Review" },
    "not-claimable":   { cls:"pl-gr",ico:"—",  lbl:"Not Claimable" },
  };

  const markInvoice = id => { setExpenses(p => p.map(e => e.id===id ? {...e,invoice:true,gst:true} : e)); showToast("Invoice marked!"); };
  const recode      = (id,cat) => { setExpenses(p => p.map(e => e.id===id ? {...e,cat} : e)); showToast("Re-categorised!"); };
  const markSuper   = id => { setTimesheets(p => p.map(t => t.id===id ? {...t,super_paid:true} : t)); showToast("Super marked as paid!"); };

  return (
    <>
      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">🔍 Tax Saver</div><div className="psub">Maximise legal deductions · Reduce BAS mistakes · Stay compliant</div></div>
        <div className="hdr-right">
          <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(57,211,187,.12)", border:"1px solid rgba(57,211,187,.3)", borderRadius:20, padding:"5px 13px", fontSize:12, fontWeight:600, color:C.teal }}>
            Health: <span className="mono" style={{ fontWeight:700 }}>{score}/100</span>
          </div>
          <div className="av">GD</div>
        </div>
      </div>

      <div className="tabs">
        {[["overview","🛡️ Overview"],["gst","📋 GST Credits"],["deductions","🏷️ Deductions"],["entertainment","🎉 Entertainment"],["payroll","👥 Payroll & Super"]].map(([id,lbl]) => (
          <div key={id} className={`tab${tab===id?" on-t":""}`} onClick={() => setTab(id)}>{lbl}</div>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <>
          <div className="ts-panel">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, flexWrap:"wrap" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>Tax Saver Overview</div>
                <div style={{ fontSize:12, color:C.muted }}>Snapshot of your tax health. Click each tab for details.</div>
                <div className="ts-sgrid">
                  {[
                    { val:money(claimable), cls:"t",   lbl:"Claimable GST Credits" },
                    { val:missing,          cls:missing?"y":"g",    lbl:"Missing Invoices" },
                    { val:entFlags+unpaidSup+missing, cls:(entFlags+unpaidSup+missing)?"r":"g", lbl:"Total Risk Flags" },
                    { val:suggestions,      cls:suggestions?"y":"g",lbl:"Recoding Suggestions" },
                  ].map((s,i) => (
                    <div key={i}>
                      <div className={`ts-sval ${s.cls}`}>{s.val}</div>
                      <div className="ts-slbl">{s.lbl}</div>
                    </div>
                  ))}
                </div>
              </div>
              <ScoreRing score={score}/>
            </div>
          </div>

          <div className="bc">
            <div className="bctit">✅ Tax Health Checklist</div>
            {[
              { lbl:"GST invoices on file",       ok:missing===0,     msg:missing>0?`${missing} missing`:"All clear" },
              { lbl:"Expenses well categorised",  ok:suggestions===0, msg:suggestions>0?`${suggestions} to fix`:"All clear" },
              { lbl:"No entertainment risks",     ok:entFlags===0,    msg:entFlags>0?`${entFlags} to review`:"All clear" },
              { lbl:"Super obligations paid",     ok:unpaidSup===0,   msg:unpaidSup>0?`${unpaidSup} unpaid`:"All clear" },
              { lbl:"GST review items resolved",  ok:review===0,      msg:review>0?`${review} to check`:"All clear" },
            ].map((c,i,arr) => (
              <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0", borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:18, height:18, borderRadius:9, background:c.ok?"rgba(63,185,80,.2)":"rgba(227,179,65,.2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:c.ok?C.green:C.yellow }}>
                    {c.ok ? "✓" : "!"}
                  </div>
                  <span style={{ fontSize:13, fontWeight:500 }}>{c.lbl}</span>
                </div>
                <span className={`pill ${c.ok?"pl-g":"pl-y"}`}>{c.msg}</span>
              </div>
            ))}
          </div>

          <div className="g2">
            <div className="card">
              <div className="clbl">💡 Quick Win</div>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>
                {missing>0 ? `Request ${missing} missing invoice${missing>1?"s":""}` : suggestions>0 ? `Re-categorise ${suggestions} expense${suggestions>1?"s":""}` : unpaidSup>0 ? "Pay outstanding super this week" : "You're up to date! 🎉"}
              </div>
              <div style={{ fontSize:11, color:C.muted }}>
                {missing>0 ? `Unlocks ${money(analysed.filter(e=>e.gstStatus==="missing-invoice").reduce((s,e)=>s+e.amount/11,0))} in GST credits` : unpaidSup>0 ? "Avoid SGC penalties — due 28 days after quarter end" : "Keep logging expenses and revenue regularly."}
              </div>
            </div>
            <div className="card">
              <div className="clbl">📆 Next Important Date</div>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>BAS Due: 28 October 2025</div>
              <div style={{ fontSize:11, color:C.muted }}>Q1 FY2026 BAS & Super due for the Jul–Sep 2025 quarter.</div>
            </div>
          </div>
        </>
      )}

      {/* GST CREDITS */}
      {tab === "gst" && (
        <>
          {missing>0 && <div className="alert al-r"><span className="al-ico">🧾</span><div><div className="al-ttl">{missing} expense{missing>1?"s":""} missing a tax invoice</div><div className="al-msg">ATO requires a valid tax invoice for purchases over $82.50 before you can claim GST credits.</div></div></div>}
          {review>0  && <div className="alert al-y"><span className="al-ico">🔍</span><div><div className="al-ttl">{review} expense{review>1?"s":""} to review for GST</div><div className="al-msg">These look like business purchases not marked as GST-applicable. Check receipts.</div></div></div>}
          {claimable>0 && <div className="alert al-t"><span className="al-ico">💡</span><div><div className="al-ttl">Estimated claimable GST credits: {money(claimable)}</div></div></div>}

          <div className="bc" style={{ marginTop:10 }}>
            <div className="bctit">All Expenses — GST Status</div>
            <table className="tbl">
              <thead><tr><th>Description</th><th>Amount</th><th>GST Credit</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {analysed.map(e => {
                  const cfg  = gstCfg[e.gstStatus];
                  const open = expanded === e.id;
                  return [
                    <tr key={e.id} style={{ cursor:"pointer" }} onClick={() => setExpanded(open ? null : e.id)}>
                      <td>
                        <div style={{ fontWeight:500 }}>{e.desc}</div>
                        <div style={{ fontSize:10.5, color:C.muted, marginTop:1 }}>{e.date} · {e.cat}</div>
                      </td>
                      <td className="mono" style={{ fontWeight:700 }}>{money(e.amount)}</td>
                      <td className="mono" style={{ color:C.teal }}>{e.gstStatus==="claimable" ? money(e.amount/11) : "—"}</td>
                      <td><span className={`pill ${cfg.cls}`}>{cfg.ico} {cfg.lbl}</span></td>
                      <td style={{ color:C.muted, fontSize:10.5 }}>{open?"▲":"▼"}</td>
                    </tr>,
                    open && (
                      <tr key={`${e.id}-x`}>
                        <td colSpan={5} style={{ padding:0 }}>
                          <div className="exp-detail">
                            {e.gstStatus==="missing-invoice" && (
                              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                                <div>
                                  <div style={{ fontWeight:600, fontSize:12.5, marginBottom:3 }}>⚠️ Tax invoice required for purchases over $82.50</div>
                                  <div style={{ fontSize:11.5, color:C.muted }}>Claim {money(e.amount/11)} GST credit once invoice is on file.</div>
                                </div>
                                <button className="btn-t" onClick={() => markInvoice(e.id)}>✅ Mark Invoice Received</button>
                              </div>
                            )}
                            {e.gstStatus==="review" && <div style={{ fontSize:11.5, color:C.muted }}>Not marked as GST — check receipt. If GST is shown, update this entry.</div>}
                            {e.gstStatus==="claimable" && <div style={{ fontSize:11.5, color:C.green }}>✅ GST credit of {money(e.amount/11)} is claimable. All good.</div>}
                            {e.gstStatus==="not-claimable" && <div style={{ fontSize:11.5, color:C.muted }}>No GST credit — GST-free or entertainment expense.</div>}
                          </div>
                        </td>
                      </tr>
                    )
                  ];
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* DEDUCTIONS */}
      {tab === "deductions" && (
        <>
          {suggestions > 0
            ? <div className="alert al-t"><span className="al-ico">💡</span><div><div className="al-ttl">{suggestions} expense{suggestions>1?"s":""} could be better categorised</div><div className="al-msg">Better categorisation ensures you don't miss deductions at tax time.</div></div></div>
            : <div className="alert al-g"><span className="al-ico">✅</span><div><div className="al-ttl">All expenses look well categorised</div></div></div>
          }

          {suggestions > 0 && (
            <div className="bc" style={{ marginTop:10 }}>
              <div className="bctit">Suggested Re-categorisations</div>
              {analysed.filter(e => e.suggestion).map(e => (
                <div key={e.id} style={{ background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:9, padding:13, marginBottom:9 }}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:12.5, marginBottom:3 }}>{e.desc} — {money(e.amount)}</div>
                      <div style={{ fontSize:11.5, color:C.muted }}>
                        Currently <span style={{ color:C.yellow }}>other</span> → suggest <span style={{ color:C.teal }}>{e.suggestion.label}</span>
                      </div>
                    </div>
                    <button className="btn-t" onClick={() => recode(e.id, e.suggestion.cat)}>Apply</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bc">
            <div className="bctit">📚 Common Restaurant Deduction Categories</div>
            <table className="tbl">
              <thead><tr><th>Category</th><th>Examples</th><th>GST Claimable?</th><th>Notes</th></tr></thead>
              <tbody>
                {[
                  { cat:"🥩 Ingredients", ex:"Produce, meat, dairy",   gst:"Usually yes", note:"Fresh unprocessed food may be GST-free" },
                  { cat:"📦 Packaging",   ex:"Containers, bags, wrap",  gst:"Yes",         note:"Cost of sale — fully deductible" },
                  { cat:"🧹 Cleaning",    ex:"Detergents, pest control",gst:"Yes",         note:"Essential operational expense" },
                  { cat:"🏠 Rent",        ex:"Restaurant lease",        gst:"Yes",         note:"Commercial rent includes GST" },
                  { cat:"⚡ Utilities",   ex:"Electricity, gas, water", gst:"Yes",         note:"Keep quarterly bills as invoices" },
                  { cat:"🔧 Equipment",   ex:"Fridges, ovens, POS",     gst:"Yes",         note:"Instant asset write-off may apply" },
                  { cat:"💻 Software",    ex:"Xero, MYOB, booking apps",gst:"Yes",         note:"Fully deductible subscription" },
                  { cat:"📣 Advertising", ex:"Facebook, Google, print", gst:"Yes",         note:"All marketing costs deductible" },
                  { cat:"🧮 Accounting",  ex:"BAS agent, bookkeeper",   gst:"Yes",         note:"Professional fees fully deductible" },
                ].map((r,i) => (
                  <tr key={i}>
                    <td style={{ fontWeight:600 }}>{r.cat}</td>
                    <td style={{ color:C.muted, fontSize:11.5 }}>{r.ex}</td>
                    <td><span className={`pill ${r.gst==="Yes"?"pl-g":"pl-y"}`}>{r.gst}</span></td>
                    <td style={{ color:C.muted, fontSize:11.5 }}>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ENTERTAINMENT */}
      {tab === "entertainment" && (
        <>
          {entFlags > 0
            ? <div className="alert al-y"><span className="al-ico">⚠️</span><div><div className="al-ttl">{entFlags} entertainment expense{entFlags>1?"s":""} detected</div><div className="al-msg">Entertainment has special ATO treatment — review before claiming.</div></div></div>
            : <div className="alert al-g"><span className="al-ico">✅</span><div><div className="al-ttl">No entertainment expenses detected</div></div></div>
          }

          {entFlags > 0 && (
            <div className="bc" style={{ marginTop:10 }}>
              <div className="bctit">⚠️ Entertainment Expenses to Review</div>
              {analysed.filter(e => e.entFlag).map(e => (
                <div key={e.id} style={{ padding:"11px 0", borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }}>{e.desc}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{e.date} · {money(e.amount)}</div>
                    </div>
                    <span className={`pill ${e.entFlag.level==="red"?"pl-r":"pl-y"}`}>
                      {e.entFlag.level==="red" ? "🔴 High Risk" : "🟡 Review"}
                    </span>
                  </div>
                  <div style={{ marginTop:7, fontSize:11.5, color:C.muted, background:C.surfaceAlt, borderRadius:7, padding:"8px 10px", lineHeight:1.5 }}>
                    {e.entFlag.msg}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bc">
            <div className="bctit">📖 Entertainment Rules (Australia)</div>
            {[
              { ico:"🍽️", cls:"y", ttl:"Staff meals",         txt:"Generally not deductible for income tax. GST credit may only be 50% claimable." },
              { ico:"🎉", cls:"r", ttl:"Customer entertainment",txt:"Not deductible for income tax. No GST credit can be claimed on customer entertaining." },
              { ico:"🎂", cls:"y", ttl:"Staff functions/parties",txt:"FBT may apply if over $300 per employee. Under $300/person may qualify as minor benefit exemption." },
              { ico:"☕", cls:"g", ttl:"Working meals (travel)", txt:"A portion may be deductible if travelling for business. Keep all receipts." },
            ].map((r,i) => (
              <div key={i} className={`alert al-${r.cls}`} style={{ marginBottom:7 }}>
                <span className="al-ico">{r.ico}</span>
                <div><div className="al-ttl">{r.ttl}</div><div className="al-msg">{r.txt}</div></div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* PAYROLL & SUPER */}
      {tab === "payroll" && (
        <>
          {unpaidSup > 0
            ? <div className="alert al-r"><span className="al-ico">🔴</span><div><div className="al-ttl">{unpaidSup} timesheet row{unpaidSup>1?"s":""} with unpaid super — {money(rows.filter(t=>!t.super_paid).reduce((s,t)=>s+t.super,0))} outstanding</div><div className="al-msg">Late super incurs SGC penalty — which is not tax-deductible. Pay within 28 days of quarter end.</div></div></div>
            : <div className="alert al-g"><span className="al-ico">✅</span><div><div className="al-ttl">All super marked as paid</div></div></div>
          }

          <div className="g2" style={{ marginTop:10 }}>
            <div className="card">
              <div className="clbl">Total Super Obligation</div>
              <div className="cval b">{money(rows.reduce((s,t)=>s+t.super,0))}</div>
              <div className="csub">11.5% of gross wages</div>
            </div>
            <div className="card">
              <div className="clbl">Unpaid Super</div>
              <div className={`cval ${unpaidSup?"r":"g"}`}>{money(rows.filter(t=>!t.super_paid).reduce((s,t)=>s+t.super,0))}</div>
              <div className="csub">{unpaidSup===0 ? "All clear" : `${unpaidSup} row${unpaidSup>1?"s":""} outstanding`}</div>
            </div>
          </div>

          <div className="bc">
            <div className="bctit">Super & PAYG by Employee & Week</div>
            <table className="tbl">
              <thead><tr><th>Employee</th><th>Week</th><th>Gross</th><th>Super (11.5%)</th><th>PAYG (~19%)</th><th>Total Labour</th><th>Super Paid?</th></tr></thead>
              <tbody>
                {rows.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                        <div style={{ width:22, height:22, borderRadius:"50%", background:avatarBg(t.emp.id), display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:700, color:"#fff" }}>
                          {initials(t.emp.name)}
                        </div>
                        <span style={{ fontWeight:500 }}>{t.emp.name}</span>
                      </div>
                    </td>
                    <td className="mono">{t.week}</td>
                    <td style={{ fontWeight:700 }}>{money(t.gross)}</td>
                    <td style={{ color:C.blue }}>{money(t.super)}</td>
                    <td style={{ color:C.yellow }}>{money(t.payg)}</td>
                    <td style={{ color:C.accent, fontWeight:600 }}>{money(t.labour)}</td>
                    <td>
                      {t.super_paid
                        ? <span className="pill pl-g">✅ Paid</span>
                        : <button className="btn-t" onClick={() => markSuper(t.id)}>Mark Paid</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="disc">
        <div className="d-ttl">⚖️ Disclaimer</div>
        <div className="d-txt">Tax Saver provides <strong>educational guidance only</strong> based on general ATO rules. It does not constitute financial, taxation, or legal advice. Always confirm with a <strong>registered tax agent or accountant</strong> before lodging your BAS or tax return. Visit <strong>ato.gov.au</strong> for official guidance.</div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════════
function SettingsPage() {
  const [saved, setSaved] = useState(false);
  return (
    <>
      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">Settings</div><div className="psub">Manage your restaurant and account</div></div>
      </div>

      <div className="fsec">
        <div className="ftit">Restaurant Details</div>
        <div className="frow2">
          <div className="fg"><label className="flbl">Restaurant Name</label><input className="inp" defaultValue="Golden Dragon Restaurant"/></div>
          <div className="fg"><label className="flbl">ABN</label><input className="inp" placeholder="12 345 678 901"/></div>
          <div className="fg"><label className="flbl">GST Registration Date</label><input className="inp" type="date" defaultValue="2022-01-01"/></div>
          <div className="fg"><label className="flbl">BAS Frequency</label><select className="sel"><option>Quarterly</option><option>Monthly</option><option>Annually</option></select></div>
          <div className="fg"><label className="flbl">Owner Email</label><input className="inp" type="email" defaultValue="owner@goldendragon.com.au"/></div>
          <div className="fg"><label className="flbl">State</label><select className="sel">{["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"].map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div className="fbtns">
          <button className="btn" onClick={() => setSaved(true)}>Save Changes</button>
          {saved && <span style={{ color:C.green, fontSize:12, fontWeight:600 }}>✅ Saved!</span>}
        </div>
      </div>

      <div className="fsec">
        <div className="ftit">Subscription</div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontWeight:600 }}>Free Plan</div>
            <div style={{ fontSize:12.5, color:C.muted, marginTop:3 }}>Upgrade for unlimited staff, insurance dashboard & Tax Saver</div>
          </div>
          <button className="btn">Upgrade to Pro — $29/mo</button>
        </div>
      </div>

      <div className="fsec">
        <div className="ftit" style={{ color:C.red }}>Danger Zone</div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontWeight:600 }}>Delete all data</div>
            <div style={{ fontSize:12.5, color:C.muted, marginTop:3 }}>Permanently removes all revenue, expenses, staff and timesheet entries</div>
          </div>
          <button className="btn-r" style={{ padding:"8px 16px", fontSize:13 }}>Delete Data</button>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  PRINT PREVIEW MODAL
// ════════════════════════════════════════════════════════════
function PrintModal({ title, children, onClose }) {
  return (
    <div className="pp-modal">
      <button className="pp-close" onClick={onClose}>✕ Close</button>
      <button className="pp-print" onClick={() => window.print()}>🖨️ Print / Save PDF</button>
      <div className="print-preview">
        {children}
      </div>
    </div>
  );
}

// Shared A4 print header
function PPHeader({ title, subtitle, quarter, fy }) {
  return (
    <div className="pp-hdr">
      <div className="pp-logo">
        <div className="pp-logo-box">T</div>
        <div>
          <div style={{ fontSize:15, fontWeight:700, letterSpacing:"-.3px" }}>TaxMate</div>
          <div style={{ fontSize:10, color:"#6B7280" }}>FOR RESTAURANTS</div>
        </div>
      </div>
      <div style={{ textAlign:"center", flex:1 }}>
        <div className="pp-title">{subtitle}</div>
        <div className="pp-name">{title}</div>
      </div>
      <div className="pp-meta">
        <div><strong>Golden Dragon Restaurant</strong></div>
        {quarter && <div>Period: {quarter}</div>}
        {fy      && <div>Financial Year: {fy}</div>}
        <div>Generated: {todayStr}</div>
        <div style={{ color:"#D1D5DB", marginTop:4 }}>MANAGEMENT SUMMARY ONLY</div>
      </div>
    </div>
  );
}

function PPDisclaimer() {
  return (
    <div className="pp-disc">
      <strong>⚠️ Important Disclaimer:</strong> This document is a <strong>management summary only</strong> generated by TaxMate for planning and review purposes. It does <strong>not</strong> constitute a formal BAS lodgment, tax return, or any other document lodged with the ATO. All figures are estimates based on data entered into TaxMate and have not been independently verified. This summary should be reviewed by a <strong>registered tax agent or accountant</strong> before any lodgment or financial decision is made. TaxMate accepts no liability for errors, omissions or decisions made based on this summary. For official lodgment obligations, visit <strong>ato.gov.au</strong> or contact your registered tax agent.
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  DOCUMENT HUB PAGE
// ════════════════════════════════════════════════════════════
function DocumentsPage({ documents, setDocuments, employees, showToast }) {
  const [tab,      setTab]    = useState("all");
  const [search,   setSearch] = useState("");
  const [filterQ,  setFilterQ]= useState("");
  const [filterCat,setFilterCat]=useState("");
  const [filterSt, setFilterSt]=useState("");
  const [drag,     setDrag]   = useState(false);
  const [editDoc,  setEditDoc] = useState(null); // document being tagged
  const [tagF,     setTagF]   = useState({});

  const fileRef = React.useRef();

  const handleFiles = files => {
    Array.from(files).forEach(f => {
      const reader = new FileReader();
      reader.onload = e => {
        const newDoc = {
          id: Date.now() + Math.random(),
          name: f.name, size: f.size, type: f.type,
          dataUrl: e.target.result,
          cat: "Invoice", supplier: "", emp_id: null,
          quarter: BAS_QUARTERS[0], fy: FIN_YEARS[0],
          gst: true, status: "pending", date: todayStr, notes: "",
        };
        setDocuments(p => {
          const updated = [...p, newDoc];
          return updated;
        });
        setEditDoc(newDoc);
        setTagF({ ...newDoc, gst: "yes" });
      };
      reader.readAsDataURL(f);
    });
    showToast(`${files.length} file${files.length>1?"s":""} uploaded!`);
  };

  const handleDrop = e => {
    e.preventDefault(); setDrag(false);
    handleFiles(e.dataTransfer.files);
  };

  const openTag = doc => { setEditDoc(doc); setTagF({ ...doc, gst: doc.gst ? "yes" : "no" }); };
  const saveTag = () => {
    setDocuments(p => p.map(d => d.id === editDoc.id ? { ...tagF, id:editDoc.id, gst:tagF.gst==="yes" } : d));
    setEditDoc(null); showToast("Document updated!");
  };

  // Filter
  const filtered = documents.filter(d => {
    const s = search.toLowerCase();
    const matchSearch = !s || d.name.toLowerCase().includes(s) || (d.supplier||"").toLowerCase().includes(s) || (d.notes||"").toLowerCase().includes(s);
    const matchQ   = !filterQ   || d.quarter === filterQ;
    const matchCat = !filterCat || d.cat === filterCat;
    const matchSt  = !filterSt  || d.status === filterSt;
    const matchTab = tab === "all" || d.status === tab;
    return matchSearch && matchQ && matchCat && matchSt && matchTab;
  });

  const counts = {
    all:      documents.length,
    verified: documents.filter(d=>d.status==="verified").length,
    pending:  documents.filter(d=>d.status==="pending").length,
    missing:  documents.filter(d=>d.status==="missing").length,
  };

  const ST_CFG = {
    verified: { cls:"pl-g", lbl:"Verified" },
    pending:  { cls:"pl-y", lbl:"Pending" },
    missing:  { cls:"pl-r", lbl:"Missing" },
  };

  return (
    <>
      {/* Tag/edit modal */}
      {editDoc && (
        <div className="overlay" onClick={e => { if (e.target===e.currentTarget) setEditDoc(null); }}>
          <div className="modal" style={{ maxWidth:560 }}>
            <div className="m-ttl">
              {docIcon(editDoc.type)} Tag Document
              <button className="btn-ic" style={{ fontSize:17 }} onClick={() => setEditDoc(null)}>✕</button>
            </div>
            <div className="m-sub" style={{ wordBreak:"break-all" }}>{editDoc.name} · {fmtSize(editDoc.size)}</div>

            <div className="frow2">
              <div className="fg">
                <label className="flbl">Document Category *</label>
                <select className="sel" value={tagF.cat||""} onChange={e => setTagF({...tagF,cat:e.target.value})}>
                  {DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="flbl">Status</label>
                <select className="sel" value={tagF.status||"pending"} onChange={e => setTagF({...tagF,status:e.target.value})}>
                  {Object.entries(DOC_STATUS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="flbl">Supplier / Vendor</label>
                <input className="inp" placeholder="e.g. Fresh Fields Markets" value={tagF.supplier||""} onChange={e => setTagF({...tagF,supplier:e.target.value})}/>
              </div>
              <div className="fg">
                <label className="flbl">Linked Employee (optional)</label>
                <select className="sel" value={tagF.emp_id||""} onChange={e => setTagF({...tagF,emp_id:e.target.value?parseInt(e.target.value):null})}>
                  <option value="">— None —</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="flbl">BAS Quarter</label>
                <select className="sel" value={tagF.quarter||BAS_QUARTERS[0]} onChange={e => setTagF({...tagF,quarter:e.target.value})}>
                  {BAS_QUARTERS.map(q => <option key={q}>{q}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="flbl">Financial Year</label>
                <select className="sel" value={tagF.fy||FIN_YEARS[0]} onChange={e => setTagF({...tagF,fy:e.target.value})}>
                  {FIN_YEARS.map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="flbl">Document Date</label>
                <input className="inp" type="date" value={tagF.date||todayStr} onChange={e => setTagF({...tagF,date:e.target.value})}/>
              </div>
              <div className="fg">
                <label className="flbl">GST Included?</label>
                <select className="sel" value={tagF.gst||"no"} onChange={e => setTagF({...tagF,gst:e.target.value})}>
                  <option value="yes">Yes — document includes GST</option>
                  <option value="no">No — GST-free or not applicable</option>
                </select>
              </div>
              <div className="fg" style={{ gridColumn:"span 2" }}>
                <label className="flbl">Notes</label>
                <input className="inp" placeholder="Brief description of this document..." value={tagF.notes||""} onChange={e => setTagF({...tagF,notes:e.target.value})}/>
              </div>
            </div>
            <div className="fbtns" style={{ marginTop:16 }}>
              <button className="btn" onClick={saveTag}>Save Tags</button>
              <button className="btn-g" onClick={() => setEditDoc(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">📁 Document Hub</div><div className="psub">Upload, tag and manage all your supporting business records</div></div>
        <div className="hdr-right">
          <button className="btn" onClick={() => fileRef.current.click()}>+ Upload Files</button>
          <input ref={fileRef} type="file" multiple style={{ display:"none" }} onChange={e => handleFiles(e.target.files)}/>
        </div>
      </div>

      {/* Stats */}
      <div className="g4">
        {[
          { lbl:"Total Documents",   val:counts.all,      cls:"b" },
          { lbl:"Verified",          val:counts.verified, cls:"g" },
          { lbl:"Pending Review",    val:counts.pending,  cls:"y" },
          { lbl:"Missing / Required",val:counts.missing,  cls:counts.missing>0?"r":"g" },
        ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
      </div>

      {/* Drop zone */}
      <div className="drop-zone" style={{ marginBottom:16 }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        className={`drop-zone${drag?" drag":""}`}
        onClick={() => fileRef.current.click()}>
        <div className="dz-ico">📂</div>
        <div className="dz-ttl">Drop files here or click to upload</div>
        <div className="dz-sub">Invoices, receipts, bank statements, BAS notices, payroll reports, insurance docs…</div>
      </div>

      {/* Tab filter */}
      <div className="tabs">
        {[["all","All"],["verified","✅ Verified"],["pending","⏳ Pending"],["missing","❌ Missing"]].map(([id,lbl]) => (
          <div key={id} className={`tab${tab===id?" on-a":""}`} onClick={() => setTab(id)}>
            {lbl} <span style={{ marginLeft:4, opacity:.7 }}>({counts[id]||0})</span>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="search-bar">
        <input className="inp" style={{ flex:1 }} placeholder="🔍  Search by name, supplier, notes..." value={search} onChange={e => setSearch(e.target.value)}/>
        <select className="sel" style={{ width:160 }} value={filterQ} onChange={e => setFilterQ(e.target.value)}>
          <option value="">All Quarters</option>
          {BAS_QUARTERS.map(q => <option key={q}>{q}</option>)}
        </select>
        <select className="sel" style={{ width:160 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select className="sel" style={{ width:140 }} value={filterSt} onChange={e => setFilterSt(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.entries(DOC_STATUS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(search||filterQ||filterCat||filterSt) && <button className="btn-g" onClick={() => { setSearch(""); setFilterQ(""); setFilterCat(""); setFilterSt(""); }}>Clear</button>}
      </div>

      {/* Document list */}
      <div className="bc">
        <div className="bctit">Documents <span style={{ fontSize:11, fontWeight:400, color:C.muted }}>{filtered.length} shown</span></div>
        <table className="tbl">
          <thead><tr><th>File</th><th>Category</th><th>Supplier / Employee</th><th>Quarter</th><th>Date</th><th>GST</th><th>Status</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            {filtered.length === 0
              ? <tr><td colSpan={9}><div className="empty-state"><div className="empty-icon">📁</div><div className="empty-txt">No documents found. Upload files or adjust filters.</div></div></td></tr>
              : filtered.map(d => {
                  const emp = d.emp_id ? employees.find(e=>e.id===d.emp_id) : null;
                  const sc  = ST_CFG[d.status] || ST_CFG.pending;
                  return (
                    <tr key={d.id}>
                      <td>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:17 }}>{docIcon(d.type)}</span>
                          <div>
                            <div style={{ fontWeight:600, fontSize:12, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.name}</div>
                            <div style={{ fontSize:10.5, color:C.muted }}>{fmtSize(d.size)}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className="pill pl-p" style={{ fontSize:10 }}>{d.cat}</span></td>
                      <td style={{ fontSize:11.5, color:C.muted }}>
                        {d.supplier && <div>{d.supplier}</div>}
                        {emp && <div style={{ color:C.blue }}>👤 {emp.name}</div>}
                        {!d.supplier && !emp && <span style={{ color:C.dim }}>—</span>}
                      </td>
                      <td className="mono" style={{ fontSize:11 }}>{d.quarter}</td>
                      <td className="mono" style={{ fontSize:11 }}>{d.date}</td>
                      <td>{d.gst ? <span className="pill pl-g" style={{ fontSize:10 }}>Yes</span> : <span className="pill pl-gr" style={{ fontSize:10 }}>No</span>}</td>
                      <td><span className={`pill ${sc.cls}`} style={{ fontSize:10 }}>{sc.lbl}</span></td>
                      <td style={{ fontSize:11.5, color:C.muted, maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.notes||"—"}</td>
                      <td>
                        <div style={{ display:"flex", gap:4 }}>
                          {d.dataUrl && d.type && d.type.startsWith("image/") && (
                            <button className="btn-b" style={{ fontSize:10, padding:"3px 8px" }}
                              onClick={() => { const w = window.open(); w.document.write(`<img src="${d.dataUrl}" style="max-width:100%"/>`); }}>
                              👁️ View
                            </button>
                          )}
                          {d.dataUrl && d.type === "application/pdf" && (
                            <button className="btn-b" style={{ fontSize:10, padding:"3px 8px" }}
                              onClick={() => { const w = window.open(); w.document.write(`<iframe src="${d.dataUrl}" style="width:100%;height:100vh;border:none"></iframe>`); }}>
                              👁️ View
                            </button>
                          )}
                          {d.dataUrl && (
                            <a href={d.dataUrl} download={d.name} style={{ textDecoration:"none" }}>
                              <button className="btn-b" style={{ fontSize:10, padding:"3px 8px" }}>⬇️ Download</button>
                            </a>
                          )}
                          {!d.dataUrl && (
                            <span style={{ fontSize:10, color:C.dim }}>Demo file</span>
                          )}
                          <button className="btn-b" style={{ fontSize:10, padding:"3px 8px" }} onClick={() => openTag(d)}>Tag</button>
                          <button className="btn-r" style={{ fontSize:10 }} onClick={() => { setDocuments(p=>p.filter(x=>x.id!==d.id)); showToast("Document removed."); }}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>

      {/* Missing record suggestions */}
      <div className="bc">
        <div className="bctit">📋 Document Checklist — {BAS_QUARTERS[0]}</div>
        {[
          { lbl:"Tax invoices for GST expenses over $82.50", req:true,  present: documents.filter(d=>d.cat==="Invoice"&&d.status==="verified").length > 0 },
          { lbl:"Bank statements for the quarter",           req:true,  present: documents.filter(d=>d.cat==="Bank Statement").length > 0 },
          { lbl:"POS / Sales export for the quarter",        req:true,  present: documents.filter(d=>d.cat==="POS Export").length > 0 },
          { lbl:"Payroll records / STP confirmation",        req:true,  present: documents.filter(d=>d.cat==="Payroll Report").length > 0 },
          { lbl:"Insurance policy documents",                req:false, present: documents.filter(d=>d.cat==="Insurance Document").length > 0 },
          { lbl:"Equipment purchase invoices (if any)",      req:false, present: documents.filter(d=>d.cat==="Invoice"&&(d.notes||"").toLowerCase().includes("equip")).length > 0 },
          { lbl:"Previous BAS notice / confirmation",        req:false, present: documents.filter(d=>d.cat==="BAS Notice").length > 0 },
          { lbl:"Accountant review notes",                   req:false, present: documents.filter(d=>d.cat==="Accountant Note").length > 0 },
        ].map((item,i,arr) => (
          <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 0", borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:15 }}>{item.present ? "✅" : item.req ? "❌" : "⬜"}</span>
              <span style={{ fontSize:13 }}>{item.lbl}</span>
              {item.req && <span className="pill pl-r" style={{ fontSize:9 }}>Required</span>}
            </div>
            <span className={`pill ${item.present?"pl-g":"pl-y"}`}>{item.present?"On file":"Not uploaded"}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  BAS SUMMARY GENERATOR PAGE
// ════════════════════════════════════════════════════════════
function BASSummaryPage({ revenue, expenses, timesheets, employees, insurance, documents, showToast }) {
  const [selQ,    setSelQ]    = useState(BAS_QUARTERS[0]);
  const [print,   setPrint]   = useState(false);

  const d = buildBASData(revenue, expenses, timesheets, employees, insurance, documents, selQ);

  const PrintContent = () => (
    <div className="pp-page">
      <PPHeader title="BAS Support Summary" subtitle="Quarterly BAS Management Summary" quarter={selQ}/>

      {d.warnings.length > 0 && (
        <div className="pp-sec">
          <div className="pp-sec-ttl">⚠️ Warnings & Missing Records</div>
          {d.warnings.map((w,i) => <div key={i} className="pp-warn">⚠️ {w}</div>)}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:22 }}>
        <div className="pp-sec" style={{ marginBottom:0 }}>
          <div className="pp-sec-ttl">GST Calculation</div>
          <div className="pp-row"><span className="pp-lbl">Total Sales (incl. GST)</span><span className="pp-val">{money(d.totalRev)}</span></div>
          <div className="pp-row"><span className="pp-lbl">GST on Sales (÷11)</span><span className="pp-val">{money(d.gstColl)}</span></div>
          <div className="pp-row"><span className="pp-lbl">GST Credits on Purchases</span><span className="pp-val">− {money(d.gstCreds)}</span></div>
          <div className="pp-tot"><span>Net GST Payable</span><span className="pp-tot-v">{money(d.netGST)}</span></div>
        </div>
        <div className="pp-sec" style={{ marginBottom:0 }}>
          <div className="pp-sec-ttl">Wages & PAYG</div>
          <div className="pp-row"><span className="pp-lbl">Total Gross Wages</span><span className="pp-val">{money(d.totalWages)}</span></div>
          <div className="pp-row"><span className="pp-lbl">Est. PAYG Withholding (~19%)</span><span className="pp-val">{money(d.totalPayg)}</span></div>
          <div className="pp-row"><span className="pp-lbl">Est. Super (11.5%)</span><span className="pp-val">{money(d.totalSuper)}</span></div>
          <div className="pp-tot"><span>Total Employment Cost</span><span className="pp-tot-v">{money(d.totalWages+d.totalPayg+d.totalSuper)}</span></div>
        </div>
      </div>

      <div className="pp-sec">
        <div className="pp-sec-ttl">BAS Estimate Summary</div>
        <div className="pp-row"><span className="pp-lbl">Net GST Payable</span><span className="pp-val">{money(d.netGST)}</span></div>
        <div className="pp-row"><span className="pp-lbl">PAYG Withholding</span><span className="pp-val">{money(d.totalPayg)}</span></div>
        <div className="pp-row"><span className="pp-lbl">Est. Quarterly Insurance</span><span className="pp-val">{money(d.totalIns)}</span></div>
        <div className="pp-tot"><span>Estimated Total BAS Obligation</span><span className="pp-tot-v">{money(d.estBAS)}</span></div>
      </div>

      <div className="pp-sec">
        <div className="pp-sec-ttl">Supporting Documents — {selQ}</div>
        <div className="pp-quarter-grid">
          {[
            { lbl:"Verified Documents",  val:d.verifiedDocs, ok:true  },
            { lbl:"Pending Review",       val:d.pendingDocs,  ok:d.pendingDocs===0 },
            { lbl:"Missing Documents",    val:d.missingDocs,  ok:d.missingDocs===0 },
            { lbl:"Missing Tax Invoices", val:d.missingInv,   ok:d.missingInv===0  },
          ].map((s,i) => (
            <div key={i} className="pp-q-card">
              <div className="pp-q-lbl">{s.lbl}</div>
              <div className="pp-q-val" style={{ color: s.ok ? "#059669" : "#DC2626" }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      <PPDisclaimer/>
    </div>
  );

  return (
    <>
      {print && <PrintModal title="BAS Support Summary" onClose={() => setPrint(false)}><PrintContent/></PrintModal>}

      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">📋 BAS Summary Generator</div><div className="psub">Quarterly BAS support summary — for review before lodgment</div></div>
        <div className="hdr-right">
          <select className="sel" value={selQ} onChange={e => setSelQ(e.target.value)} style={{ width:140 }}>
            {BAS_QUARTERS.map(q => <option key={q}>{q}</option>)}
          </select>
          <button className="btn" onClick={() => setPrint(true)}>🖨️ Print / PDF</button>
        </div>
      </div>

      {d.warnings.length > 0 && d.warnings.map((w,i) => (
        <div key={i} className="alert al-y"><span className="al-ico">⚠️</span><div><div className="al-msg">{w}</div></div></div>
      ))}

      <div className="g4">
        {[
          { lbl:"Total Sales",         val:money(d.totalRev),   cls:"b" },
          { lbl:"Net GST Payable",     val:money(d.netGST),     cls:"y" },
          { lbl:"Est. PAYG",           val:money(d.totalPayg),  cls:"" },
          { lbl:"Est. BAS Obligation", val:money(d.estBAS),     cls:"r" },
        ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
      </div>

      <div className="g2">
        <div className="bc">
          <div className="bctit">GST Position</div>
          <div className="bas-row"><span className="bas-lbl">Total Sales (incl. GST)</span><span className="bas-val">{money(d.totalRev)}</span></div>
          <div className="bas-row"><span className="bas-lbl">GST on Sales (÷11)</span><span className="bas-val" style={{ color:C.red }}>{money(d.gstColl)}</span></div>
          <div className="bas-row"><span className="bas-lbl">GST Credits on Purchases</span><span className="bas-val" style={{ color:C.green }}>− {money(d.gstCreds)}</span></div>
          <div className="bas-tot"><span className="bas-tot-lbl">Net GST Payable</span><span className="bas-tot-val">{money(d.netGST)}</span></div>
        </div>
        <div className="bc">
          <div className="bctit">Wages & Employment</div>
          <div className="bas-row"><span className="bas-lbl">Total Gross Wages</span><span className="bas-val">{money(d.totalWages)}</span></div>
          <div className="bas-row"><span className="bas-lbl">Est. PAYG Withholding (~19%)</span><span className="bas-val" style={{ color:C.yellow }}>{money(d.totalPayg)}</span></div>
          <div className="bas-row"><span className="bas-lbl">Est. Super (11.5%)</span><span className="bas-val" style={{ color:C.blue }}>{money(d.totalSuper)}</span></div>
          <div className="bas-row"><span className="bas-lbl">Quarterly Insurance</span><span className="bas-val" style={{ color:C.purple }}>{money(d.totalIns)}</span></div>
          <div className="bas-tot"><span className="bas-tot-lbl">Total Employment Cost</span><span className="bas-tot-val">{money(d.totalWages+d.totalPayg+d.totalSuper)}</span></div>
        </div>
      </div>

      <div className="bc">
        <div className="bctit">📄 Supporting Documents — {selQ}</div>
        <div className="g4">
          {[
            { lbl:"Verified Docs",       val:d.verifiedDocs, cls:"g" },
            { lbl:"Pending Review",      val:d.pendingDocs,  cls:d.pendingDocs?"y":"g" },
            { lbl:"Missing Docs",        val:d.missingDocs,  cls:d.missingDocs?"r":"g" },
            { lbl:"Missing Tax Invoices",val:d.missingInv,   cls:d.missingInv?"r":"g" },
          ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
        </div>
        {d.verifiedDocs === 0 && (
          <div className="alert al-y" style={{ marginBottom:0 }}>
            <span className="al-ico">📁</span>
            <div><div className="al-ttl">No verified documents for {selQ}</div><div className="al-msg">Upload and verify supporting documents in the Document Hub before generating your BAS summary.</div></div>
          </div>
        )}
      </div>

      <div className="bc">
        <div className="bctit">💰 Estimated BAS — {selQ}</div>
        <div className="bas-row"><span className="bas-lbl">Net GST Payable</span><span className="bas-val">{money(d.netGST)}</span></div>
        <div className="bas-row"><span className="bas-lbl">PAYG Withholding</span><span className="bas-val">{money(d.totalPayg)}</span></div>
        <div className="bas-tot"><span className="bas-tot-lbl">Estimated Total BAS</span><span className="bas-tot-val">{money(d.estBAS)}</span></div>
        <div className="disc" style={{ marginTop:12 }}>
          <div className="d-ttl">⚠️ Disclaimer</div>
          <div className="d-txt">This is an estimate for management planning purposes only. It does not constitute a lodged BAS. Review with a registered tax agent before lodging with the ATO.</div>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  ANNUAL ACCOUNTANT PACK PAGE
// ════════════════════════════════════════════════════════════
function AccountantPackPage({ revenue, expenses, timesheets, employees, insurance, documents, showToast }) {
  const [selFY,  setSelFY] = useState(FIN_YEARS[0]);
  const [print,  setPrint] = useState(false);

  const d = buildAnnualData(revenue, expenses, timesheets, employees, insurance, documents);

  const PrintContent = () => (
    <div className="pp-page">
      <PPHeader title="Annual Accountant Pack" subtitle="Financial Year Summary" fy={selFY}/>

      {d.warnings.length > 0 && (
        <div className="pp-sec">
          <div className="pp-sec-ttl">⚠️ Warnings & Flags</div>
          {d.warnings.map((w,i) => <div key={i} className="pp-warn">⚠️ {w}</div>)}
        </div>
      )}

      <div className="pp-sec">
        <div className="pp-sec-ttl">Revenue Summary</div>
        <div className="pp-row"><span className="pp-lbl">Total Revenue (incl. GST)</span><span className="pp-val">{money(d.totalRev)}</span></div>
        <div className="pp-row"><span className="pp-lbl">GST Collected (÷11)</span><span className="pp-val">{money(d.totalRev/11)}</span></div>
        <div className="pp-row"><span className="pp-lbl">Revenue ex-GST</span><span className="pp-val">{money(d.totalRev - d.totalRev/11)}</span></div>
      </div>

      <div className="pp-sec">
        <div className="pp-sec-ttl">Expenses by Category</div>
        <table className="pp-tbl">
          <thead><tr><th>Category</th><th style={{ textAlign:"right" }}>Amount</th><th style={{ textAlign:"right" }}>% of Total</th></tr></thead>
          <tbody>
            {EXP_CATEGORIES.filter(c => d.bycat[c] > 0).map((c,i) => (
              <tr key={i}>
                <td>{c.charAt(0).toUpperCase()+c.slice(1)}</td>
                <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(d.bycat[c])}</td>
                <td style={{ textAlign:"right", color:"#6B7280" }}>{d.totalExp > 0 ? `${((d.bycat[c]/d.totalExp)*100).toFixed(1)}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td><strong>Total Expenses</strong></td><td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(d.totalExp)}</td><td style={{ textAlign:"right" }}>100%</td></tr></tfoot>
        </table>
      </div>

      <div className="pp-sec">
        <div className="pp-sec-ttl">Wages & Employment Costs</div>
        <div className="pp-row"><span className="pp-lbl">Total Gross Wages</span><span className="pp-val">{money(d.totalWages)}</span></div>
        <div className="pp-row"><span className="pp-lbl">PAYG Withholding (~19%)</span><span className="pp-val">{money(d.totalPayg)}</span></div>
        <div className="pp-row"><span className="pp-lbl">Super (11.5%)</span><span className="pp-val">{money(d.totalSuper)}</span></div>
        <div className="pp-row"><span className="pp-lbl">Annual Insurance</span><span className="pp-val">{money(d.totalIns)}</span></div>
        <div className="pp-tot"><span>Total Labour + Insurance Cost</span><span className="pp-tot-v">{money(d.totalWages+d.totalPayg+d.totalSuper+d.totalIns)}</span></div>
      </div>

      <div className="pp-sec">
        <div className="pp-sec-ttl">Quarter-by-Quarter BAS Snapshots</div>
        <table className="pp-tbl">
          <thead><tr><th>Quarter</th><th style={{ textAlign:"right" }}>Revenue</th><th style={{ textAlign:"right" }}>GST Payable</th><th style={{ textAlign:"right" }}>PAYG</th><th style={{ textAlign:"right" }}>Est. BAS</th><th>Docs</th></tr></thead>
          <tbody>
            {d.qSnaps.map((q,i) => (
              <tr key={i}>
                <td style={{ fontWeight:600 }}>{q.q}</td>
                <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(q.totalRev)}</td>
                <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(q.netGST)}</td>
                <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(q.totalPayg)}</td>
                <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace", fontWeight:700 }}>{money(q.estBAS)}</td>
                <td><span className={`pp-badge ${q.verifiedDocs>0?"pp-b-g":"pp-b-y"}`}>{q.verifiedDocs} verified</span></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Annual Total</td>
              <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(d.totalRev)}</td>
              <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(d.totalRev/11 - d.totalExp/11)}</td>
              <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(d.totalPayg)}</td>
              <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(d.totalRev/11 - d.totalExp/11 + d.totalPayg)}</td>
              <td><span className="pp-badge pp-b-g">{d.verifiedDocs} total</span></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {d.assetPurch.length > 0 && (
        <div className="pp-sec">
          <div className="pp-sec-ttl">Asset Purchases — Equipment</div>
          <table className="pp-tbl">
            <thead><tr><th>Date</th><th>Description</th><th style={{ textAlign:"right" }}>Amount</th><th>Invoice</th></tr></thead>
            <tbody>
              {d.assetPurch.map((e,i) => (
                <tr key={i}>
                  <td style={{ fontFamily:"DM Mono,monospace" }}>{e.date}</td>
                  <td>{e.desc}</td>
                  <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(e.amount)}</td>
                  <td><span className={`pp-badge ${e.invoice?"pp-b-g":"pp-b-r"}`}>{e.invoice?"Yes":"Missing"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {d.missingInv.length > 0 && (
        <div className="pp-sec">
          <div className="pp-sec-ttl">Missing Tax Invoices ({d.missingInv.length})</div>
          <table className="pp-tbl">
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th style={{ textAlign:"right" }}>Amount</th><th style={{ textAlign:"right" }}>GST Credit at Risk</th></tr></thead>
            <tbody>
              {d.missingInv.map((e,i) => (
                <tr key={i}>
                  <td style={{ fontFamily:"DM Mono,monospace" }}>{e.date}</td>
                  <td>{e.desc}</td>
                  <td>{e.cat}</td>
                  <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(e.amount)}</td>
                  <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace", color:"#DC2626", fontWeight:700 }}>{money(e.amount/11)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total GST Credits at Risk</td>
                <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(d.missingInv.reduce((s,e)=>s+e.amount/11,0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <PPDisclaimer/>
    </div>
  );

  return (
    <>
      {print && <PrintModal title="Annual Accountant Pack" onClose={() => setPrint(false)}><PrintContent/></PrintModal>}

      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">📦 Annual Accountant Pack</div><div className="psub">Full financial year summary — accountant-ready for review</div></div>
        <div className="hdr-right">
          <select className="sel" value={selFY} onChange={e => setSelFY(e.target.value)} style={{ width:120 }}>
            {FIN_YEARS.map(y => <option key={y}>{y}</option>)}
          </select>
          <button className="btn" onClick={() => setPrint(true)}>🖨️ Print / PDF</button>
        </div>
      </div>

      {d.warnings.map((w,i) => (
        <div key={i} className="alert al-y"><span className="al-ico">⚠️</span><div><div className="al-msg">{w}</div></div></div>
      ))}

      <div className="g4">
        {[
          { lbl:"Total Revenue",    val:money(d.totalRev),   cls:"b" },
          { lbl:"Total Expenses",   val:money(d.totalExp),   cls:"r" },
          { lbl:"Total Wages",      val:money(d.totalWages), cls:"" },
          { lbl:"Annual Insurance", val:money(d.totalIns),   cls:"p" },
        ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
      </div>

      {/* Expenses by category */}
      <div className="bc">
        <div className="bctit">Expenses by Category — {selFY}</div>
        <table className="tbl">
          <thead><tr><th>Category</th><th>Amount</th><th>% of Total</th><th>Breakdown</th></tr></thead>
          <tbody>
            {EXP_CATEGORIES.map((cat,i) => {
              const v = d.bycat[cat] || 0;
              if (!v) return null;
              const pct = d.totalExp > 0 ? (v/d.totalExp)*100 : 0;
              return (
                <tr key={i}>
                  <td style={{ fontWeight:600 }}>{cat.charAt(0).toUpperCase()+cat.slice(1)}</td>
                  <td style={{ fontWeight:700 }}>{money(v)}</td>
                  <td style={{ color:C.muted }}>{pct.toFixed(1)}%</td>
                  <td style={{ width:140 }}>
                    <div style={{ height:6, background:C.border, borderRadius:3, overflow:"hidden" }}>
                      <div style={{ height:"100%", borderRadius:3, background:C.accent, width:`${pct}%` }}/>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td>{money(d.totalExp)}</td>
              <td>100%</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="g2">
        <div className="bc">
          <div className="bctit">Wages & Employment — {selFY}</div>
          <div className="bas-row"><span className="bas-lbl">Gross Wages</span><span className="bas-val">{money(d.totalWages)}</span></div>
          <div className="bas-row"><span className="bas-lbl">PAYG Withholding</span><span className="bas-val" style={{ color:C.yellow }}>{money(d.totalPayg)}</span></div>
          <div className="bas-row"><span className="bas-lbl">Superannuation</span><span className="bas-val" style={{ color:C.blue }}>{money(d.totalSuper)}</span></div>
          <div className="bas-row"><span className="bas-lbl">Annual Insurance</span><span className="bas-val" style={{ color:C.purple }}>{money(d.totalIns)}</span></div>
          <div className="bas-tot"><span className="bas-tot-lbl">Total Labour + Insurance</span><span className="bas-tot-val">{money(d.totalWages+d.totalPayg+d.totalSuper+d.totalIns)}</span></div>
        </div>
        <div className="bc">
          <div className="bctit">Document Register — {selFY}</div>
          {[
            { lbl:"Total Documents",  val:d.totalDocs,   cls:"b" },
            { lbl:"Verified",         val:d.verifiedDocs,cls:"g" },
            { lbl:"Assets on File",   val:d.assetPurch.length, cls:"t" },
            { lbl:"Missing Invoices", val:d.missingInv.length, cls:d.missingInv.length?"r":"g" },
          ].map((s,i,arr) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none" }}>
              <span style={{ fontSize:13, color:C.muted }}>{s.lbl}</span>
              <span className={`mono cval ${s.cls}`} style={{ fontSize:16 }}>{s.val}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bc">
        <div className="bctit">Quarter-by-Quarter BAS Snapshots</div>
        <table className="tbl">
          <thead><tr><th>Quarter</th><th>Revenue</th><th>GST Payable</th><th>PAYG</th><th>Est. BAS</th><th>Docs</th><th>Warnings</th></tr></thead>
          <tbody>
            {d.qSnaps.map((q,i) => (
              <tr key={i}>
                <td style={{ fontWeight:700 }}>{q.q}</td>
                <td>{money(q.totalRev)}</td>
                <td style={{ color:C.yellow }}>{money(q.netGST)}</td>
                <td>{money(q.totalPayg)}</td>
                <td style={{ fontWeight:700, color:C.accent }}>{money(q.estBAS)}</td>
                <td><span className={`pill ${q.verifiedDocs>0?"pl-g":"pl-y"}`}>{q.verifiedDocs} verified</span></td>
                <td>{q.warnings.length > 0 ? <span className="pill pl-r">{q.warnings.length} issue{q.warnings.length>1?"s":""}</span> : <span className="pill pl-g">All clear</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {d.missingInv.length > 0 && (
        <div className="bc">
          <div className="bctit" style={{ color:C.red }}>⚠️ Missing Tax Invoices ({d.missingInv.length}) — GST Credits at Risk</div>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>GST Credit at Risk</th></tr></thead>
            <tbody>
              {d.missingInv.map((e,i) => (
                <tr key={i}>
                  <td className="mono">{e.date}</td>
                  <td>{e.desc}</td>
                  <td><span className="pill pl-p">{e.cat}</span></td>
                  <td style={{ fontWeight:700 }}>{money(e.amount)}</td>
                  <td style={{ color:C.red, fontWeight:700 }}>{money(e.amount/11)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total at Risk</td>
                <td style={{ color:C.red }}>{money(d.missingInv.reduce((s,e)=>s+e.amount/11,0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  REPORTS PAGE
// ════════════════════════════════════════════════════════════
function ReportsPage({ revenue, expenses, timesheets, employees, insurance, documents }) {
  const [print,   setPrint]   = useState(null); // "bas"|"annual"|"payroll"|"docregister"
  const [selQ,    setSelQ]    = useState(BAS_QUARTERS[0]);
  const [selFY,   setSelFY]   = useState(FIN_YEARS[0]);

  const bas    = buildBASData(revenue, expenses, timesheets, employees, insurance, documents, selQ);
  const annual = buildAnnualData(revenue, expenses, timesheets, employees, insurance, documents);
  const rows   = annotateTimesheets(employees, timesheets);

  const BASPrint = () => (
    <div className="pp-page">
      <PPHeader title="BAS Support Summary" subtitle="Quarterly BAS Management Summary" quarter={selQ}/>
      {bas.warnings.map((w,i) => <div key={i} className="pp-warn">⚠️ {w}</div>)}
      <div className="pp-sec">
        <div className="pp-sec-ttl">GST Calculation</div>
        <div className="pp-row"><span className="pp-lbl">Total Sales (incl. GST)</span><span className="pp-val">{money(bas.totalRev)}</span></div>
        <div className="pp-row"><span className="pp-lbl">GST on Sales</span><span className="pp-val">{money(bas.gstColl)}</span></div>
        <div className="pp-row"><span className="pp-lbl">GST Credits</span><span className="pp-val">− {money(bas.gstCreds)}</span></div>
        <div className="pp-tot"><span>Net GST Payable</span><span className="pp-tot-v">{money(bas.netGST)}</span></div>
      </div>
      <div className="pp-sec">
        <div className="pp-sec-ttl">BAS Estimate</div>
        <div className="pp-row"><span className="pp-lbl">Net GST</span><span className="pp-val">{money(bas.netGST)}</span></div>
        <div className="pp-row"><span className="pp-lbl">PAYG Withholding</span><span className="pp-val">{money(bas.totalPayg)}</span></div>
        <div className="pp-tot"><span>Total Estimated BAS</span><span className="pp-tot-v">{money(bas.estBAS)}</span></div>
      </div>
      <PPDisclaimer/>
    </div>
  );

  const PayrollPrint = () => (
    <div className="pp-page">
      <PPHeader title="Payroll / STP Support Pack" subtitle="Wages & Super Summary" fy={selFY}/>
      <div className="pp-sec">
        <div className="pp-sec-ttl">Employee Summary</div>
        <table className="pp-tbl">
          <thead><tr><th>Name</th><th>Role</th><th>Type</th><th style={{ textAlign:"right" }}>Rate</th><th style={{ textAlign:"right" }}>Gross</th><th style={{ textAlign:"right" }}>PAYG</th><th style={{ textAlign:"right" }}>Super</th><th>TFN</th></tr></thead>
          <tbody>
            {employees.map(emp => {
              const er  = rows.filter(t=>t.eid===emp.id);
              const gr  = er.reduce((s,t)=>s+t.gross,0);
              const py  = er.reduce((s,t)=>s+t.payg,0);
              const su  = er.reduce((s,t)=>s+t.super,0);
              return (
                <tr key={emp.id}>
                  <td>{emp.name}</td><td>{emp.role}</td>
                  <td>{emp.type}</td>
                  <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(effRate(emp))}/hr</td>
                  <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(gr)}</td>
                  <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(py)}</td>
                  <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(su)}</td>
                  <td><span className={`pp-badge ${emp.tfn?"pp-b-g":"pp-b-r"}`}>{emp.tfn?"✓":"Missing"}</span></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>TOTALS</td>
              <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(rows.reduce((s,t)=>s+t.gross,0))}</td>
              <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(rows.reduce((s,t)=>s+t.payg,0))}</td>
              <td style={{ textAlign:"right", fontFamily:"DM Mono,monospace" }}>{money(rows.reduce((s,t)=>s+t.super,0))}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="pp-sec">
        <div className="pp-sec-ttl">⚠️ TFN Compliance</div>
        {employees.filter(e=>!e.tfn).length === 0
          ? <div style={{ color:"#059669", fontSize:13, padding:"8px 0" }}>✅ All employees have TFN on file.</div>
          : employees.filter(e=>!e.tfn).map(e => (
              <div key={e.id} className="pp-warn">⚠️ {e.name} — TFN not provided. Must withhold at 47%.</div>
            ))
        }
      </div>
      <PPDisclaimer/>
    </div>
  );

  const DocRegPrint = () => (
    <div className="pp-page">
      <PPHeader title="Document Register" subtitle="Supporting Records Register" fy={selFY}/>
      <div className="pp-sec">
        <div className="pp-sec-ttl">Document Summary</div>
        <div className="pp-quarter-grid">
          {[
            { lbl:"Total Documents", val:documents.length },
            { lbl:"Verified",        val:documents.filter(d=>d.status==="verified").length },
            { lbl:"Pending Review",  val:documents.filter(d=>d.status==="pending").length },
            { lbl:"Missing",         val:documents.filter(d=>d.status==="missing").length },
          ].map((s,i) => <div key={i} className="pp-q-card"><div className="pp-q-lbl">{s.lbl}</div><div className="pp-q-val">{s.val}</div></div>)}
        </div>
      </div>
      <div className="pp-sec">
        <div className="pp-sec-ttl">Full Document Register</div>
        <table className="pp-tbl">
          <thead><tr><th>Document Name</th><th>Category</th><th>Supplier</th><th>Quarter</th><th>Date</th><th>GST</th><th>Status</th></tr></thead>
          <tbody>
            {documents.map((d,i) => (
              <tr key={i}>
                <td style={{ fontSize:11 }}>{d.name}</td>
                <td>{d.cat}</td>
                <td style={{ fontSize:11 }}>{d.supplier||"—"}</td>
                <td style={{ fontFamily:"DM Mono,monospace", fontSize:11 }}>{d.quarter}</td>
                <td style={{ fontFamily:"DM Mono,monospace", fontSize:11 }}>{d.date}</td>
                <td>{d.gst?"Yes":"No"}</td>
                <td><span className={`pp-badge ${d.status==="verified"?"pp-b-g":d.status==="missing"?"pp-b-r":"pp-b-y"}`}>{d.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PPDisclaimer/>
    </div>
  );

  const reports = [
    {
      id:"bas", ico:"📋", ttl:"BAS Support Summary",
      dsc:"Quarterly GST, PAYG and super summary with document count and warnings. Review before lodging your BAS with the ATO.",
      ctrl: <select className="sel" value={selQ} onChange={e=>setSelQ(e.target.value)} style={{ width:140 }}>{BAS_QUARTERS.map(q=><option key={q}>{q}</option>)}</select>,
    },
    {
      id:"annual", ico:"📦", ttl:"Annual Accountant Pack",
      dsc:"Full financial year summary including revenue, expenses by category, wages, super, quarterly BAS snapshots, asset purchases and missing records.",
      ctrl: <select className="sel" value={selFY} onChange={e=>setSelFY(e.target.value)} style={{ width:120 }}>{FIN_YEARS.map(y=><option key={y}>{y}</option>)}</select>,
    },
    {
      id:"payroll", ico:"👥", ttl:"Payroll / STP Support Pack",
      dsc:"Per-employee gross wages, PAYG withholding, super obligations and TFN compliance summary for STP reconciliation.",
      ctrl: <select className="sel" value={selFY} onChange={e=>setSelFY(e.target.value)} style={{ width:120 }}>{FIN_YEARS.map(y=><option key={y}>{y}</option>)}</select>,
    },
    {
      id:"docregister", ico:"📂", ttl:"Document Register",
      dsc:"Full register of all uploaded supporting documents with category, supplier, quarter, status and GST tags — accountant-ready.",
      ctrl: null,
    },
  ];

  return (
    <>
      {print === "bas"         && <PrintModal onClose={()=>setPrint(null)}><BASPrint/></PrintModal>}
      {print === "annual"      && <PrintModal onClose={()=>setPrint(null)}><div className="pp-page"><PPHeader title="Annual Accountant Pack" subtitle="Financial Year Summary" fy={selFY}/>{annual.warnings.map((w,i)=><div key={i} className="pp-warn">⚠️ {w}</div>)}<div className="pp-sec"><div className="pp-sec-ttl">Expenses by Category</div><table className="pp-tbl"><thead><tr><th>Category</th><th style={{textAlign:"right"}}>Amount</th></tr></thead><tbody>{EXP_CATEGORIES.filter(c=>annual.bycat[c]>0).map((c,i)=><tr key={i}><td>{c}</td><td style={{textAlign:"right",fontFamily:"DM Mono,monospace"}}>{money(annual.bycat[c])}</td></tr>)}</tbody><tfoot><tr><td>Total</td><td style={{textAlign:"right",fontFamily:"DM Mono,monospace"}}>{money(annual.totalExp)}</td></tr></tfoot></table></div><PPDisclaimer/></div></PrintModal>}
      {print === "payroll"     && <PrintModal onClose={()=>setPrint(null)}><PayrollPrint/></PrintModal>}
      {print === "docregister" && <PrintModal onClose={()=>setPrint(null)}><DocRegPrint/></PrintModal>}

      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">🖨️ Reports & Exports</div><div className="psub">Generate and print accountant-ready reports — for review, not lodgment</div></div>
      </div>

      <div className="alert al-y">
        <span className="al-ico">⚠️</span>
        <div>
          <div className="al-ttl">Management Reports Only</div>
          <div className="al-msg">These reports are for planning and accountant review only. TaxMate does not lodge BAS or tax returns with the ATO. All figures must be verified by a registered tax agent before lodgment.</div>
        </div>
      </div>

      <div className="rep-grid">
        {reports.map(r => (
          <div key={r.id} className="rep-card">
            <div className="rep-ico">{r.ico}</div>
            <div className="rep-ttl">{r.ttl}</div>
            <div className="rep-dsc">{r.dsc}</div>
            {r.ctrl && <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:11, color:C.muted }}>Period:</span>
              {r.ctrl}
            </div>}
            <div className="rep-btns">
              <button className="btn" onClick={() => setPrint(r.id)}>🖨️ Preview &amp; Print</button>
              <button className="btn-g" onClick={() => setPrint(r.id)}>Generate PDF</button>
            </div>
          </div>
        ))}
      </div>

      <div className="bc">
        <div className="bctit">📐 Report Validation Status</div>
        <table className="tbl">
          <thead><tr><th>Report</th><th>Data Completeness</th><th>Warnings</th><th>Status</th></tr></thead>
          <tbody>
            {[
              { name:"BAS Summary",       data:revenue.length>0&&expenses.length>0, warn:bas.warnings.length,    warnOk:bas.warnings.length===0 },
              { name:"Annual Pack",        data:revenue.length>0,                   warn:annual.warnings.length,  warnOk:annual.warnings.length===0 },
              { name:"Payroll Pack",       data:employees.length>0&&timesheets.length>0, warn:employees.filter(e=>!e.tfn).length, warnOk:employees.filter(e=>!e.tfn).length===0 },
              { name:"Document Register",  data:documents.length>0,                 warn:documents.filter(d=>d.status==="missing").length, warnOk:documents.filter(d=>d.status==="missing").length===0 },
            ].map((r,i) => (
              <tr key={i}>
                <td style={{ fontWeight:600 }}>{r.name}</td>
                <td>{r.data ? <span className="pill pl-g">✅ Data present</span> : <span className="pill pl-r">❌ No data</span>}</td>
                <td>{r.warn === 0 ? <span className="pill pl-g">None</span> : <span className="pill pl-y">{r.warn} warning{r.warn>1?"s":""}</span>}</td>
                <td>{r.data && r.warnOk ? <span className="pill pl-g">Ready</span> : r.data ? <span className="pill pl-y">Ready with warnings</span> : <span className="pill pl-r">Incomplete</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="disc">
        <div className="d-ttl">⚖️ Report Disclaimer</div>
        <div className="d-txt">All reports generated by TaxMate are <strong>management summaries only</strong> intended to assist restaurant owners and their accountants in preparing for BAS lodgment and annual tax returns. They do not constitute a lodged BAS, tax return, or any document formally submitted to the ATO. All figures are estimates based on data entered into TaxMate and have not been audited or independently verified. Always engage a <strong>registered tax agent</strong> before lodging. Visit <strong>ato.gov.au</strong> for official guidance and lodgment obligations.</div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  ROOT APP
// ════════════════════════════════════════════════════════════
export default function App() {
  const [screen,     setScreen]     = useState("landing");
  const [page,       setPage]       = useState("dashboard");
  const [revenue,    setRevenue]    = useState(SEED_REVENUE);
  const [expenses,   setExpenses]   = useState(SEED_EXPENSES);
  const [employees,  setEmployees]  = useState(SEED_EMPLOYEES);
  const [timesheets, setTimesheets] = useState(SEED_TIMESHEETS);
  const [insurance,  setInsurance]  = useState(SEED_INSURANCE);
  const [leave,      setLeave]      = useState(SEED_LEAVE);
  const [documents,  setDocuments]  = useState(SEED_DOCUMENTS);
  const [toast,      setToast]      = useState(null);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  const analysed  = analyseExpenses(expenses);
  const flagCount = analysed.filter(e => e.gstStatus === "missing-invoice").length
                  + timesheets.filter(t => !t.super_paid).length
                  + analysed.filter(e => e.ent).length;

  if (screen === "landing") return (<><style>{CSS}</style><LandingPage onGo={() => setScreen("auth")}/></>);
  if (screen === "auth")    return (<><style>{CSS}</style><AuthPage onLogin={() => setScreen("app")}/></>);

  return (
    <>
      <style>{CSS}</style>
      <div className="layout">
        <Sidebar page={page} setPage={setPage} onLogout={() => setScreen("landing")} flagCount={flagCount}/>
        <main className="main">
          {page === "dashboard" && <DashboardPage revenue={revenue} expenses={expenses} employees={employees} timesheets={timesheets} insurance={insurance} setPage={setPage}/>}
          {page === "revenue"   && <RevenuePage   revenue={revenue}   setRevenue={setRevenue}     showToast={showToast}/>}
          {page === "expenses"  && <ExpensesPage  expenses={expenses} setExpenses={setExpenses}   showToast={showToast}/>}
          {page === "wages"     && <WagesPage     employees={employees} setEmployees={setEmployees} timesheets={timesheets} setTimesheets={setTimesheets} leave={leave} setLeave={setLeave} showToast={showToast}/>}
          {page === "insurance" && <InsurancePage insurance={insurance} setInsurance={setInsurance} employees={employees} timesheets={timesheets} showToast={showToast}/>}
          {page === "tax"       && <TaxSummaryPage revenue={revenue} expenses={expenses} employees={employees} timesheets={timesheets}/>}
          {page === "taxsaver"      && <TaxSaverPage  expenses={expenses} setExpenses={setExpenses} employees={employees} timesheets={timesheets} setTimesheets={setTimesheets} showToast={showToast}/>}
          {page === "documents"     && <DocumentsPage      documents={documents} setDocuments={setDocuments} employees={employees} showToast={showToast}/>}
          {page === "bassummary"    && <BASSummaryPage     revenue={revenue} expenses={expenses} timesheets={timesheets} employees={employees} insurance={insurance} documents={documents} showToast={showToast}/>}
          {page === "accountantpack"&& <AccountantPackPage revenue={revenue} expenses={expenses} timesheets={timesheets} employees={employees} insurance={insurance} documents={documents} showToast={showToast}/>}
          {page === "reports"       && <ReportsPage        revenue={revenue} expenses={expenses} timesheets={timesheets} employees={employees} insurance={insurance} documents={documents}/>}
          {page === "settings"      && <SettingsPage/>}
        </main>
        {toast && <Toast msg={toast} onDone={() => setToast(null)}/>}
      </div>
    </>
  );
}
