import { useState, useEffect, useRef } from "react";
import React from "react";

// ════════════════════════════════════════════════════════════
//  THEME — MISE
// ════════════════════════════════════════════════════════════
const C = {
  bg:         "#0C0F0D",
  surface:    "#131A14",
  surfaceAlt: "#192110",
  border:     "#253320",
  text:       "#E4EDE6",
  muted:      "#7A9A78",
  dim:        "#435540",
  green:      "#52C97A",
  yellow:     "#D4A843",
  red:        "#E06060",
  blue:       "#5B9FD4",
  accent:     "#8FCB72",
  teal:       "#3DC9A0",
  purple:     "#A882D4",
};

// ════════════════════════════════════════════════════════════
//  CONSTANTS
// ════════════════════════════════════════════════════════════
const SUPER_RATE      = 0.115;   // pre-1 Jul 2025; budget/summary estimate only
const PAYG_RATE       = 0.19;    // flat estimate used in budget/summary views only
const CASUAL_LOADING  = 0.25;
const OT_RATE         = 1.5;
const WKND_RATE       = 1.75;
const GST_THRESHOLD   = 82.50;

// ── ATO Superannuation rate — date-aware (SGC schedule) ──────
// 11.5% to 30 Jun 2025 → 12.0% from 1 Jul 2025
// ── Tax rate versioning ────────────────────────────────────────
// Bump this string when any rate changes (SGC, PAYG brackets, etc.)
// App compares against localStorage to detect "user hasn't seen new rates"
const TAX_RATE_VERSION  = "2025-07-01"; // SGC → 12.0%, Stage 3 PAYG cuts active
const TAX_RATE_NOTES    = "SGC rate increased to 12.0% from 1 Jul 2025. PAYG Stage 3 tax cuts applied.";
const checkRateVersion  = () => localStorage.getItem("mise_rate_version") === TAX_RATE_VERSION;
const dismissRateAlert  = () => localStorage.setItem("mise_rate_version", TAX_RATE_VERSION);

const getSuperRate = (weekStr) => {
  if (!weekStr) return 0.12;
  const [yr, wk] = weekStr.split('-W').map(Number);
  // ISO week: Jan 4 is always in week 1
  const jan4 = new Date(Date.UTC(yr, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (wk - 1) * 7);
  return monday >= new Date(Date.UTC(2025, 6, 1)) ? 0.12 : 0.115;
};

// ── ATO 2024-25 Progressive PAYG Withholding ─────────────────
// "Calculated" method: annualise → brackets → LITO → Medicare → divide by 52
// Ref: NAT 3539 / ATO Tax Withheld Calculator 2024-25

// Tax brackets 2024-25 (Stage 3 cuts applied)
const _annualTax = (income) => {
  if (income <= 18200)   return 0;
  if (income <= 45000)   return (income - 18200) * 0.19;
  if (income <= 135000)  return 5092 + (income - 45000) * 0.325;
  if (income <= 190000)  return 34162 + (income - 135000) * 0.37;
  return 54532 + (income - 190000) * 0.45;
};

// Low Income Tax Offset (LITO) 2024-25
const _lito = (income) => {
  if (income <= 37500)  return 700;
  if (income <= 45000)  return 700 - (income - 37500) * 0.05;
  if (income <= 66667)  return 325 - (income - 45000) * 0.015;
  return 0;
};

// Medicare Levy 2% — shade-in $26,000–$33,333, full 2% above
const _medicare = (income) => {
  if (income <= 26000)  return 0;
  if (income <= 33333)  return (income - 26000) * 0.1;
  return income * 0.02;
};

// Weekly PAYG — Scale 2 (resident with TFN + tax-free threshold)
// hasTFN=false → 47% flat (ATO no-TFN rule)
// Returns whole dollars (ATO: truncate, not round)
const calcWeeklyPAYG = (weeklyGross, hasTFN) => {
  if (!hasTFN) return Math.floor(weeklyGross * 0.47);
  const annual = weeklyGross * 52;
  const tax = Math.max(0, _annualTax(annual) - _lito(annual) + _medicare(annual));
  return Math.floor(tax / 52);
};

const ENTERTAINMENT_KW = [
  "lunch","dinner","drinks","meal","cafe","café","restaurant",
  "bar","party","event","celebration","function","coffee","breakfast",
];
const DEDUCTION_MAP = {
  // ── Universal ─────────────────────────────────────────────
  packaging:         { kw: ["packaging","box","bag","container","wrap"],                                    label: "Packaging" },
  cleaning:          { kw: ["clean","sanitise","sanitize","mop","detergent","hygiene","pest"],              label: "Cleaning & Hygiene" },
  software:          { kw: ["xero","myob","software","app","subscription","saas","pos"],                    label: "Software & Subscriptions" },
  advertising:       { kw: ["ads","advertising","marketing","facebook","google","instagram","flyer"],       label: "Advertising" },
  accounting:        { kw: ["accountant","bookkeeper","tax agent","bas agent"],                             label: "Accounting & Professional Fees" },
  staff_uniforms:    { kw: ["uniform","apron","workwear","shoes","hat","cap"],                              label: "Staff Uniforms" },
  repairs:           { kw: ["repair","maintenance","fix","service","plumber","electrician"],                label: "Repairs & Maintenance" },
  // ── Bar / Pub / Venue ─────────────────────────────────────
  liquor_license:    { kw: ["liquor licence","liquor license","liquor levy","dine&discover","gaming levy"], label: "Liquor License & Levies" },
  spirit_stock:      { kw: ["spirits","whisky","whiskey","vodka","gin","rum","tequila","brandy","liqueur"], label: "Spirit Stock" },
  beer_wine_stock:   { kw: ["beer","wine","cider","keg","tap","cellar","bottle","champagne","prosecco"],    label: "Beer & Wine Stock" },
  glassware:         { kw: ["glass","glassware","stemware","pint","rocks glass","flute","tumbler"],         label: "Glassware" },
  bar_equipment:     { kw: ["shaker","jigger","bar tool","ice machine","bar fridge","tap system"],         label: "Bar Equipment" },
  rsa_training:      { kw: ["rsa","responsible service","liquor training","rwb"],                          label: "RSA Training" },
  // ── Café / Coffee ─────────────────────────────────────────
  coffee_supplies:   { kw: ["coffee bean","coffee beans","espresso","milk","oat milk","almond milk","soy milk","filter","portafilter","tamper","grinder"], label: "Coffee Supplies" },
  machine_maintenance:{ kw: ["coffee machine","machine service","descale","group head","espresso machine"], label: "Machine Maintenance" },
  eco_packaging:     { kw: ["eco","biodegradable","compostable","reusable","keep cup","eco cup","paper cup","takeaway cup"], label: "Eco-Packaging" },
  bakery_supplies:   { kw: ["flour","sugar","butter","yeast","baking","pastry","bread","cake","muffin"],   label: "Bakery Supplies" },
  // ── General Food & Hospitality ────────────────────────────
  food_stock:        { kw: ["produce","meat","seafood","dairy","dry goods","grocery","food stock","pantry"], label: "Food & Produce" },
  smallwares:        { kw: ["crockery","cutlery","plate","bowl","tray","ramekin","chopping board","knife"], label: "Smallwares & Crockery" },
  linen:             { kw: ["linen","tablecloth","napkin","towel","cloth"],                                 label: "Linen & Napery" },
  delivery_fees:     { kw: ["uber eats","doordash","menulog","deliveroo","delivery fee","platform fee"],    label: "Delivery Platform Fees" },
  music_ent:         { kw: ["spotify","music license","apra","ppca","dj","band","entertainment"],           label: "Music & Entertainment" },
};

// Category display config — emoji + label + industry tag
const CAT_CONFIG = {
  // ── Universal ──────────────────────────────
  ingredients:          { emoji:"🥩", label:"Raw Ingredients",           industry:"all",  tags:["food","meat","produce","dairy","seafood","fresh","raw material","cogs","cost of goods"] },
  food_stock:           { emoji:"🛒", label:"Food & Produce",            industry:"all",  tags:["grocery","pantry","dry goods","stock","tinned","cost of goods","cogs"] },
  rent:                 { emoji:"🏠", label:"Rent",                      industry:"all",  tags:["lease","commercial","property","premises","shop rent"] },
  utilities:            { emoji:"⚡", label:"Utilities",                 industry:"all",  tags:["electricity","gas","water","power","agl","energy","light","heating","hot water"] },
  equipment:            { emoji:"🔧", label:"Equipment",                 industry:"all",  tags:["oven","fridge","pos","machine","tools","purchase","appliance"] },
  packaging:            { emoji:"📦", label:"Packaging",                 industry:"all",  tags:["box","bag","container","wrap","takeaway"] },
  eco_packaging:        { emoji:"♻️", label:"Eco-Packaging",             industry:"café", tags:["compostable","biodegradable","paper cup","reusable","keep cup"] },
  cleaning:             { emoji:"🧹", label:"Cleaning & Hygiene",        industry:"all",  tags:["detergent","sanitiser","pest","hygiene","mop","clean"] },
  software:             { emoji:"💻", label:"Software & Subscriptions",  industry:"all",  tags:["xero","myob","app","subscription","saas","pos","booking"] },
  advertising:          { emoji:"📣", label:"Advertising",               industry:"all",  tags:["facebook","google","marketing","social","print","instagram","promotion","campaign"] },
  accounting:           { emoji:"📋", label:"Accounting & Consulting",   industry:"all",  tags:["bookkeeper","tax agent","bas","accountant","consulting","adviser","professional"] },
  staff_uniforms:       { emoji:"👕", label:"Staff Uniforms",            industry:"all",  tags:["apron","workwear","cap","branded","shirt","uniform"] },
  repairs:              { emoji:"🔨", label:"Repairs & Maintenance",     industry:"all",  tags:["plumber","electrician","fix","service","maintenance","repair"] },
  delivery_fees:        { emoji:"🛵", label:"Delivery Platform Fees",    industry:"all",  tags:["uber eats","doordash","menulog","deliveroo","commission"] },
  music_ent:            { emoji:"🎵", label:"Music & Entertainment",     industry:"all",  tags:["spotify","apra","ppca","dj","band","licence","music"] },
  smallwares:           { emoji:"🍽️", label:"Smallwares & Crockery",    industry:"all",  tags:["plates","cutlery","bowl","tray","ramekin","knife"] },
  linen:                { emoji:"🪣", label:"Linen & Napery",            industry:"all",  tags:["tablecloth","napkin","towel","cloth","linen"] },
  // ── Finance & Admin (ATO-aligned) ─────────
  bank_fees:            { emoji:"🏦", label:"Bank Fees & Charges",       industry:"all",  tags:["bank","bank charge","account fee","transaction fee","monthly fee","bsb"] },
  merchant_fees:        { emoji:"💳", label:"Merchant & EFTPOS Fees",    industry:"all",  tags:["merchant","eftpos","card fee","stripe","tyro","square fee","surcharge","terminal"] },
  interest_expense:     { emoji:"💸", label:"Interest Expense",          industry:"all",  tags:["interest","loan interest","overdraft","finance charge","bank interest","credit"] },
  loan_repayment:       { emoji:"💰", label:"Loan Repayment",            industry:"all",  tags:["loan","repayment","principal","finance","borrowing","line of credit","lump sum"] },
  motor_vehicle:        { emoji:"🚗", label:"Motor Vehicle Expenses",    industry:"all",  tags:["car","vehicle","petrol","fuel","rego","registration","car loan","car repayment","toll","parking","logbook"] },
  insurance_expense:    { emoji:"🛡️", label:"Insurance Premium",         industry:"all",  tags:["insurance","premium","public liability","workers comp","policy","cover","indemnity"] },
  legal:                { emoji:"⚖️", label:"Legal Expenses",            industry:"all",  tags:["legal","lawyer","solicitor","barrister","legal fee","contract","dispute","conveyancing"] },
  license_fees:         { emoji:"📜", label:"License & Permit Fees",     industry:"all",  tags:["licence","license","permit","registration fee","government fee","certification","annual fee","council permit"] },
  council_rates:        { emoji:"🏛️", label:"Council Rates",             industry:"all",  tags:["council","rates","local government","municipal","land rates","shire","strata"] },
  freight:              { emoji:"📮", label:"Freight & Courier",         industry:"all",  tags:["freight","courier","postage","delivery","shipping","dhl","auspost","toll ipec","startrack"] },
  telephone_internet:   { emoji:"📱", label:"Telephone & Internet",      industry:"all",  tags:["phone","telephone","mobile","internet","broadband","nbn","telstra","optus","iinet","vodafone","data"] },
  travel:               { emoji:"✈️", label:"Travel & Accommodation",    industry:"all",  tags:["travel","flight","hotel","accommodation","airbnb","uber","taxi","cab","conference","motel","train"] },
  printing:             { emoji:"🖨️", label:"Printing & Stationery",     industry:"all",  tags:["printing","print","stationery","paper","ink","toner","photocopying","office supplies","pens"] },
  office_expenses:      { emoji:"🖥️", label:"Office Expenses",           industry:"all",  tags:["office","desk","chair","filing","postage","office supply","calculator","whiteboard"] },
  supplies:             { emoji:"🧰", label:"Supplies",                  industry:"all",  tags:["supplies","consumables","materials","items","hardware","stock","raw","general supply"] },
  fees_charges:         { emoji:"🔖", label:"Fees & Charges",            industry:"all",  tags:["fee","charge","service fee","one-off","admin fee","application fee","membership"] },
  depreciation:         { emoji:"📉", label:"Depreciation (< $20k)",     industry:"all",  tags:["depreciation","write off","instant asset write-off","small business","shopfitting","fit-out","fitout","deduction"] },
  fixed_assets:         { emoji:"🏗️", label:"Fixed Assets (> $20k)",     industry:"all",  tags:["fixed asset","capital","major purchase","building","fitout","renovation","construction","property improvement"] },
  general_expenses:     { emoji:"🗂️", label:"General Expenses",          industry:"all",  tags:["general","miscellaneous","misc","sundry","general expense","catch-all"] },
  // ── Bar / Pub ──────────────────────────────
  liquor_license:       { emoji:"📜", label:"Liquor License & Levies",  industry:"bar",  tags:["liquor","licence","levy","gaming","permit","annual"] },
  spirit_stock:         { emoji:"🥃", label:"Spirit Stock",             industry:"bar",  tags:["whisky","vodka","gin","rum","tequila","spirit","brandy"] },
  beer_wine_stock:      { emoji:"🍺", label:"Beer & Wine Stock",        industry:"bar",  tags:["beer","wine","keg","cider","tap","cellar","bottle","champagne"] },
  glassware:            { emoji:"🍷", label:"Glassware",                industry:"bar",  tags:["glass","pint","flute","tumbler","rocks","stemware"] },
  bar_equipment:        { emoji:"🍸", label:"Bar Equipment",            industry:"bar",  tags:["shaker","jigger","ice machine","bar fridge","tap system"] },
  rsa_training:         { emoji:"🪪", label:"RSA Training",             industry:"bar",  tags:["rsa","responsible service","alcohol training","liquor training"] },
  // ── Café ───────────────────────────────────
  coffee_supplies:      { emoji:"☕", label:"Coffee Supplies",          industry:"café", tags:["bean","milk","oat","almond","soy","filter","grind","espresso"] },
  machine_maintenance:  { emoji:"⚙️", label:"Machine Maintenance",      industry:"café", tags:["espresso machine","descale","service","group head","coffee machine"] },
  bakery_supplies:      { emoji:"🥐", label:"Bakery Supplies",          industry:"café", tags:["flour","sugar","butter","yeast","pastry","bread","cake","muffin"] },
  // ── Catch-all ──────────────────────────────
  other:                { emoji:"📎", label:"Other",                    industry:"all",  tags:["misc","other","general","sundry"] },
};

const COMMON_SUPPLIERS = {
  ingredients:        ["Bidfood","PFD Food Services","Costco","Aldi","Local market"],
  food_stock:         ["Bidfood","PFD Food Services","Costco","Aldi"],
  coffee_supplies:    ["Campos","Seven Seeds","Toby's Estate","Di Bella","Allpress"],
  spirit_stock:       ["ALM","Treasury Wine","Diageo","Pernod Ricard"],
  beer_wine_stock:    ["Lion","CUB","Coopers","Dan Murphy's","ALM"],
  utilities:          ["AGL","Origin Energy","EnergyAustralia","Sydney Water"],
  telephone_internet: ["Telstra","Optus","Vodafone","iiNet","TPG","Aussie Broadband"],
  advertising:        ["Meta Ads","Google Ads","Instagram","Local printer"],
  accounting:         ["Local bookkeeper","Xero","MYOB","BAS Agent"],
  software:           ["Xero","MYOB","Square","Lightspeed","Doshii"],
  delivery_fees:      ["Uber Eats","DoorDash","Menulog","Deliveroo"],
  music_ent:          ["APRA AMCOS","Spotify","PPCA"],
  repairs:            ["Local tradesperson","Airtasker"],
  bank_fees:          ["ANZ","Commonwealth Bank","Westpac","NAB","Bendigo Bank"],
  merchant_fees:      ["Tyro","Square","Stripe","Commonwealth Bank","ANZ eBusiness"],
  insurance_expense:  ["QBE","Allianz","CGU","Suncorp","Steadfast"],
  legal:              ["Local solicitor","Maurice Blackburn","Slater & Gordon"],
  freight:            ["AusPost","DHL","TNT","Startrack","Toll IPEC","Sendle"],
  motor_vehicle:      ["BP","Shell","Caltex","7-Eleven","Ampol"],
  printing:           ["Officeworks","Vistaprint","Snap Printing","Kwik Kopy"],
  office_expenses:    ["Officeworks","Staples","Harvey Norman","JB Hi-Fi"],
  travel:             ["Qantas","Virgin Australia","Airbnb","Booking.com","Uber"],
};

// ── Smart Auto-Categorisation keyword dictionary ──────────────
// Each entry: keyword (lowercase) → category id.
// Longer/more-specific phrases take priority over short ones.
const SMART_KEYWORDS = {
  // ── Ingredients / fresh produce ──────────────────────────
  beef:         "ingredients", lamb:         "ingredients", pork:         "ingredients",
  chicken:      "ingredients", veal:         "ingredients", duck:         "ingredients",
  turkey:       "ingredients", venison:      "ingredients", brisket:      "ingredients",
  tenderloin:   "ingredients", sirloin:      "ingredients", rump:         "ingredients",
  mince:        "ingredients", salmon:       "ingredients", tuna:         "ingredients",
  barramundi:   "ingredients", snapper:      "ingredients", prawn:        "ingredients",
  lobster:      "ingredients", crab:         "ingredients", scallop:      "ingredients",
  squid:        "ingredients", octopus:      "ingredients", oyster:       "ingredients",
  mussel:       "ingredients", fish:         "ingredients", seafood:      "ingredients",
  tomato:       "ingredients", onion:        "ingredients", potato:       "ingredients",
  carrot:       "ingredients", broccoli:     "ingredients", spinach:      "ingredients",
  lettuce:      "ingredients", capsicum:     "ingredients", zucchini:     "ingredients",
  mushroom:     "ingredients", eggplant:     "ingredients", corn:         "ingredients",
  avocado:      "ingredients", cucumber:     "ingredients", celery:       "ingredients",
  leek:         "ingredients", garlic:       "ingredients", ginger:       "ingredients",
  lemon:        "ingredients", lime:         "ingredients", orange:       "ingredients",
  apple:        "ingredients", herbs:        "ingredients", basil:        "ingredients",
  parsley:      "ingredients", coriander:    "ingredients", thyme:        "ingredients",
  rosemary:     "ingredients", cheese:       "ingredients", milk:         "ingredients",
  cream:        "ingredients", butter:       "ingredients", egg:          "ingredients",
  eggs:         "ingredients", produce:      "ingredients", butcher:      "ingredients",
  bidfood:      "ingredients", pfd:          "ingredients", vegies:       "ingredients",

  // ── Food & Pantry stock ───────────────────────────────────
  rice:         "food_stock",  pasta:        "food_stock",  noodle:       "food_stock",
  noodles:      "food_stock",  oil:          "food_stock",  olive:        "food_stock",
  vinegar:      "food_stock",  soy:          "food_stock",  sauce:        "food_stock",
  condiment:    "food_stock",  spice:        "food_stock",  salt:         "food_stock",
  pepper:       "food_stock",  stock:        "food_stock",  tinned:       "food_stock",
  canned:       "food_stock",  grocery:      "food_stock",  pantry:       "food_stock",
  costco:       "food_stock",  aldi:         "food_stock",  "dry goods":  "food_stock",
  "food stock": "food_stock",

  // ── Coffee supplies ───────────────────────────────────────
  coffee:       "coffee_supplies", bean:     "coffee_supplies", espresso:  "coffee_supplies",
  latte:        "coffee_supplies", cappuccino:"coffee_supplies", flat:     "coffee_supplies",
  "oat milk":   "coffee_supplies", barista:  "coffee_supplies", grind:    "coffee_supplies",
  grounds:      "coffee_supplies", decaf:    "coffee_supplies", campos:   "coffee_supplies",
  "seven seeds":"coffee_supplies", "di bella":"coffee_supplies", allpress:"coffee_supplies",
  "toby's estate":"coffee_supplies",

  // ── Bakery ───────────────────────────────────────────────
  flour:        "bakery_supplies", bread:    "bakery_supplies", yeast:    "bakery_supplies",
  croissant:    "bakery_supplies", pastry:   "bakery_supplies", cake:     "bakery_supplies",
  muffin:       "bakery_supplies", scone:    "bakery_supplies", baking:   "bakery_supplies",
  dough:        "bakery_supplies", icing:    "bakery_supplies", frosting: "bakery_supplies",
  sugar:        "bakery_supplies", vanilla:  "bakery_supplies",

  // ── Beer & Wine ───────────────────────────────────────────
  beer:         "beer_wine_stock", wine:     "beer_wine_stock", keg:      "beer_wine_stock",
  cider:        "beer_wine_stock", champagne:"beer_wine_stock", prosecco: "beer_wine_stock",
  sparkling:    "beer_wine_stock", ale:      "beer_wine_stock", lager:    "beer_wine_stock",
  ipa:          "beer_wine_stock", stout:    "beer_wine_stock", sauvignon:"beer_wine_stock",
  chardonnay:   "beer_wine_stock", shiraz:   "beer_wine_stock", pinot:    "beer_wine_stock",
  "dan murphy": "beer_wine_stock", lion:     "beer_wine_stock", cub:      "beer_wine_stock",
  coopers:      "beer_wine_stock", alm:      "beer_wine_stock", cellar:   "beer_wine_stock",

  // ── Spirits ──────────────────────────────────────────────
  whisky:       "spirit_stock",    whiskey:  "spirit_stock",    bourbon:  "spirit_stock",
  vodka:        "spirit_stock",    gin:      "spirit_stock",    rum:      "spirit_stock",
  tequila:      "spirit_stock",    brandy:   "spirit_stock",    kahlua:   "spirit_stock",
  baileys:      "spirit_stock",    cointreau:"spirit_stock",    aperol:   "spirit_stock",
  campari:      "spirit_stock",    midori:   "spirit_stock",    spirit:   "spirit_stock",
  spirits:      "spirit_stock",    liqueur:  "spirit_stock",

  // ── Delivery platforms ───────────────────────────────────
  "uber eats":  "delivery_fees",   ubereats: "delivery_fees",   doordash: "delivery_fees",
  menulog:      "delivery_fees",   deliveroo:"delivery_fees",   "door dash":"delivery_fees",
  commission:   "delivery_fees",   "delivery commission":"delivery_fees",
  "platform fee":"delivery_fees",  eatnow:   "delivery_fees",

  // ── Utilities ────────────────────────────────────────────
  electricity:  "utilities",       electric: "utilities",       gas:      "utilities",
  "gas bill":   "utilities",       water:    "utilities",       "water bill":"utilities",
  power:        "utilities",       internet: "utilities",       broadband:"utilities",
  wifi:         "utilities",       agl:      "utilities",       origin:   "utilities",
  "energy australia":"utilities",  "sydney water":"utilities",  telstra:  "utilities",
  optus:        "utilities",       "nbn":    "utilities",

  // ── Rent ─────────────────────────────────────────────────
  rent:         "rent",            lease:    "rent",            "commercial rent":"rent",
  landlord:     "rent",            "shop rent":"rent",          premises: "rent",
  "office rent":"rent",            "monthly rent":"rent",

  // ── Cleaning ─────────────────────────────────────────────
  cleaning:     "cleaning",        sanitiser:"cleaning",        detergent:"cleaning",
  bleach:       "cleaning",        "hand wash":"cleaning",      soap:     "cleaning",
  mop:          "cleaning",        broom:    "cleaning",        hygiene:  "cleaning",
  pest:         "cleaning",        "pest control":"cleaning",   disinfect:"cleaning",
  gloves:       "cleaning",        "paper towel":"cleaning",

  // ── Packaging ─────────────────────────────────────────────
  container:    "packaging",       takeaway: "packaging",       "takeaway box":"packaging",
  "takeaway bag":"packaging",      "brown bag":"packaging",     "paper bag":"packaging",
  napkin:       "packaging",       straw:    "packaging",       lid:      "packaging",
  foil:         "packaging",       "glad wrap":"packaging",     wrap:     "packaging",
  "cling wrap": "packaging",

  // ── Eco packaging ─────────────────────────────────────────
  compostable:  "eco_packaging",   biodegradable:"eco_packaging", "paper cup":"eco_packaging",
  "keep cup":   "eco_packaging",   "reusable cup":"eco_packaging", bamboo:  "eco_packaging",
  "eco bag":    "eco_packaging",   "sugarcane":  "eco_packaging",

  // ── Equipment ─────────────────────────────────────────────
  oven:         "equipment",       fridge:   "equipment",       freezer:  "equipment",
  dishwasher:   "equipment",       blender:  "equipment",       mixer:    "equipment",
  printer:      "equipment",       screen:   "equipment",       display:  "equipment",
  "pos system": "equipment",       "cash register":"equipment", tablet:   "equipment",
  ipad:         "equipment",       laptop:   "equipment",       computer: "equipment",
  "coffee machine":"machine_maintenance", grinder: "coffee_supplies",

  // ── Repairs & maintenance ─────────────────────────────────
  repair:       "repairs",         service:  "repairs",         plumber:  "repairs",
  electrician:  "repairs",         "air con":"repairs",         aircon:   "repairs",
  hvac:         "repairs",         maintenance:"repairs",       fix:      "repairs",
  airtasker:    "repairs",

  // ── Machine maintenance (café) ────────────────────────────
  descale:      "machine_maintenance", "group head":"machine_maintenance",
  "espresso machine":"machine_maintenance", "coffee service":"machine_maintenance",

  // ── Software ─────────────────────────────────────────────
  xero:         "software",        myob:     "software",        square:   "software",
  lightspeed:   "software",        doshii:   "software",        kounta:   "software",
  deputy:       "software",        tanda:    "software",        "google workspace":"software",
  microsoft:    "software",        adobe:    "software",        dropbox:  "software",
  canva:        "software",        slack:    "software",        zoom:     "software",
  shopify:      "software",        "point of sale":"software",

  // ── Advertising ──────────────────────────────────────────
  facebook:     "advertising",     instagram:"advertising",     "google ads":"advertising",
  "meta ads":   "advertising",     tiktok:   "advertising",     flyer:    "advertising",
  "flyer print":"advertising",     letterbox:"advertising",     signage:  "advertising",
  banner:       "advertising",     brochure: "advertising",     "social media":"advertising",

  // ── Accounting / professional ─────────────────────────────
  accountant:   "accounting",      bookkeeper:"accounting",     "bas agent":"accounting",
  "tax agent":  "accounting",      "tax return":"accounting",   bas:      "accounting",
  "legal fee":  "accounting",      lawyer:   "accounting",      solicitor:"accounting",
  "financial advisor":"accounting",

  // ── Staff uniforms ────────────────────────────────────────
  uniform:      "staff_uniforms",  apron:    "staff_uniforms",  shirt:    "staff_uniforms",
  "work shirt": "staff_uniforms",  polo:     "staff_uniforms",  cap:      "staff_uniforms",
  hat:          "staff_uniforms",  "work pants":"staff_uniforms", "non-slip":"staff_uniforms",
  workwear:     "staff_uniforms",  "staff shirt":"staff_uniforms",

  // ── Smallwares & crockery ─────────────────────────────────
  plate:        "smallwares",      plates:   "smallwares",      bowl:     "smallwares",
  cutlery:      "smallwares",      fork:     "smallwares",      knife:    "smallwares",
  spoon:        "smallwares",      tray:     "smallwares",      ramekin:  "smallwares",
  "salt shaker":"smallwares",      pepper:   "smallwares",      crockery: "smallwares",

  // ── Glassware ─────────────────────────────────────────────
  glass:        "glassware",       pint:     "glassware",       flute:    "glassware",
  tumbler:      "glassware",       stemware: "glassware",       decanter: "glassware",

  // ── Bar equipment ─────────────────────────────────────────
  shaker:       "bar_equipment",   jigger:   "bar_equipment",   "ice machine":"bar_equipment",
  "bar fridge": "bar_equipment",   "tap system":"bar_equipment", strainer: "bar_equipment",
  "bar tool":   "bar_equipment",   "cocktail":"bar_equipment",

  // ── Linen ─────────────────────────────────────────────────
  tablecloth:   "linen",           "table cloth":"linen",        towel:   "linen",
  "cloth napkin":"linen",          "tea towel":  "linen",        linen:   "linen",

  // ── Liquor licence ────────────────────────────────────────
  "liquor licence":"liquor_license","liquor license":"liquor_license",
  "gaming permit":"liquor_license", "permit":     "liquor_license",
  "annual licence":"liquor_license",

  // ── RSA ───────────────────────────────────────────────────
  rsa:          "rsa_training",    "responsible service":"rsa_training",
  "alcohol training":"rsa_training","liquor training":"rsa_training",

  // ── Music & entertainment ─────────────────────────────────
  apra:         "music_ent",       ppca:     "music_ent",       "apra amcos":"music_ent",
  spotify:      "music_ent",       dj:       "music_ent",       band:     "music_ent",
  "live music": "music_ent",       "music licence":"music_ent",

  // ── Bank fees ─────────────────────────────────────────────
  "bank fee":   "bank_fees",       "bank charge":"bank_fees",   "account fee":"bank_fees",
  "monthly fee":"bank_fees",       "bank charges":"bank_fees",  "account keeping":"bank_fees",
  "transaction fee":"bank_fees",   anz:      "bank_fees",       westpac:  "bank_fees",
  nab:          "bank_fees",       "commonwealth bank":"bank_fees",

  // ── Merchant / EFTPOS fees ────────────────────────────────
  eftpos:       "merchant_fees",   tyro:     "merchant_fees",   "merchant fee":"merchant_fees",
  "card fee":   "merchant_fees",   "stripe fee":"merchant_fees","terminal fee":"merchant_fees",
  surcharge:    "merchant_fees",   "pos fee":    "merchant_fees",

  // ── Interest expense ──────────────────────────────────────
  interest:     "interest_expense","loan interest":"interest_expense",
  overdraft:    "interest_expense","finance charge":"interest_expense",
  "credit interest":"interest_expense",

  // ── Loan repayment ────────────────────────────────────────
  "loan repayment":"loan_repayment","loan payment":"loan_repayment",
  "line of credit":"loan_repayment","principal repayment":"loan_repayment",
  borrowing:    "loan_repayment",

  // ── Motor vehicle ─────────────────────────────────────────
  petrol:       "motor_vehicle",   fuel:     "motor_vehicle",   rego:     "motor_vehicle",
  "car rego":   "motor_vehicle",   "car loan":"motor_vehicle",  "vehicle loan":"motor_vehicle",
  "car repayment":"motor_vehicle", toll:     "motor_vehicle",   "e-toll": "motor_vehicle",
  parking:      "motor_vehicle",   "logbook":"motor_vehicle",   "vehicle expense":"motor_vehicle",
  "motor vehicle":"motor_vehicle",

  // ── Insurance ─────────────────────────────────────────────
  "insurance premium":"insurance_expense", "public liability":"insurance_expense",
  "workers comp":"insurance_expense",      "workers compensation":"insurance_expense",
  "business insurance":"insurance_expense","professional indemnity":"insurance_expense",
  qbe:          "insurance_expense",       allianz:  "insurance_expense",
  suncorp:      "insurance_expense",

  // ── Legal ─────────────────────────────────────────────────
  "legal fee":  "legal",           lawyer:   "legal",           solicitor:"legal",
  barrister:    "legal",           "legal expense":"legal",     litigation:"legal",
  conveyancing: "legal",           contract: "legal",

  // ── License & permit fees ─────────────────────────────────
  "license fee":  "license_fees",  "licence fee": "license_fees",
  "government fee":"license_fees", "council permit":"license_fees",
  "registration fee":"license_fees","certification fee":"license_fees",
  "annual registration":"license_fees","food safety":"license_fees",
  "trade license":"license_fees",

  // ── Council rates ─────────────────────────────────────────
  "council rates":"council_rates", "council rate":"council_rates",
  rates:        "council_rates",   "land rates":  "council_rates",
  "strata levy":"council_rates",   strata:       "council_rates",
  municipal:    "council_rates",   "local government":"council_rates",

  // ── Freight & courier ─────────────────────────────────────
  freight:      "freight",         courier:  "freight",         postage:  "freight",
  shipping:     "freight",         dhl:      "freight",         auspost:  "freight",
  startrack:    "freight",         sendle:   "freight",         "toll ipec":"freight",
  "express post":"freight",

  // ── Telephone & internet ──────────────────────────────────
  "phone bill":     "telephone_internet", "mobile bill":"telephone_internet",
  "internet bill":  "telephone_internet", "broadband bill":"telephone_internet",
  "nbn bill":       "telephone_internet", "telstra bill":"telephone_internet",
  "optus bill":     "telephone_internet", "phone plan":  "telephone_internet",
  "mobile plan":    "telephone_internet", "data plan":   "telephone_internet",
  "telephone":      "telephone_internet",

  // ── Travel ───────────────────────────────────────────────
  flight:       "travel",          flights:  "travel",          hotel:    "travel",
  accommodation:"travel",          airbnb:   "travel",          "booking.com":"travel",
  conference:   "travel",          motel:    "travel",          "travel expense":"travel",
  qantas:       "travel",          "virgin australia":"travel", "business travel":"travel",

  // ── Printing & stationery ─────────────────────────────────
  "printing cost":"printing",      "print job": "printing",
  stationery:   "printing",        "office paper":"printing",   toner:    "printing",
  "ink cartridge":"printing",      photocopying:"printing",     officeworks:"printing",
  vistaprint:   "printing",

  // ── Office expenses ───────────────────────────────────────
  "office expense":"office_expenses","office supply":"office_expenses",
  "desk supplies":"office_expenses","whiteboard":  "office_expenses",
  "office furniture":"office_expenses","calculator":"office_expenses",

  // ── Supplies ─────────────────────────────────────────────
  consumables:  "supplies",        "general supplies":"supplies",
  "kitchen supplies":"supplies",   hardware:     "supplies",
  "bar supplies":   "supplies",    "cleaning supplies":"cleaning",

  // ── Fees & charges ────────────────────────────────────────
  "service charge":"fees_charges", "one-off fee": "fees_charges",
  "admin fee":  "fees_charges",    "application fee":"fees_charges",
  "membership fee":"fees_charges", "subscription fee":"software",

  // ── Depreciation ─────────────────────────────────────────
  depreciation: "depreciation",    "instant asset":"depreciation",
  "write-off":  "depreciation",    "write off":   "depreciation",
  "asset write":"depreciation",    shopfitting:   "depreciation",
  "small business deduction":"depreciation",

  // ── Fixed assets ─────────────────────────────────────────
  "fixed asset": "fixed_assets",   "capital purchase":"fixed_assets",
  renovation:   "fixed_assets",    "major renovation":"fixed_assets",
  "fitout":     "fixed_assets",    "fit out":    "fixed_assets",
  "leasehold improvement":"fixed_assets","construction":"fixed_assets",

  // ── General expenses ─────────────────────────────────────
  "general expense":"general_expenses","sundry expense":"general_expenses",
  miscellaneous:"general_expenses","misc expense": "general_expenses",
};

// ── Smart category detection ──────────────────────────────────
// Returns { cat, keyword, confidence } or null
const detectCategory = (text, customMappings = {}) => {
  if (!text || text.trim().length < 2) return null;
  const lower = text.toLowerCase().trim();

  // 1. Check custom mappings first (user-taught, highest priority)
  for (const [kw, cat] of Object.entries(customMappings)) {
    if (lower.includes(kw.toLowerCase())) {
      return { cat, keyword: kw, confidence: "custom" };
    }
  }

  // 2. Multi-word phrases (longer match wins)
  const phrases = Object.entries(SMART_KEYWORDS)
    .filter(([kw]) => kw.includes(" "))
    .sort((a, b) => b[0].length - a[0].length);
  for (const [kw, cat] of phrases) {
    if (lower.includes(kw)) return { cat, keyword: kw, confidence: "high" };
  }

  // 3. Single-word exact match
  const words = lower.split(/[\s\-,./]+/).filter(w => w.length > 2);
  for (const word of words) {
    if (SMART_KEYWORDS[word]) return { cat: SMART_KEYWORDS[word], keyword: word, confidence: "high" };
  }

  // 4. Partial / fuzzy (word starts-with match)
  for (const word of words) {
    const match = Object.entries(SMART_KEYWORDS).find(([kw]) => !kw.includes(" ") && kw.startsWith(word) && word.length >= 4);
    if (match) return { cat: match[1], keyword: match[0], confidence: "medium" };
  }

  return null;
};

const EXP_CATEGORIES = Object.keys(CAT_CONFIG);
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

// ATO quarter date ranges (Australian financial year: Jul–Jun)
// Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun
const QUARTER_DATES = {
  "Q1 FY2026": { from:"2025-07-01", to:"2025-09-30" },
  "Q2 FY2026": { from:"2025-10-01", to:"2025-12-31" },
  "Q3 FY2026": { from:"2026-01-01", to:"2026-03-31" },
  "Q4 FY2026": { from:"2026-04-01", to:"2026-06-30" },
  "Q1 FY2025": { from:"2024-07-01", to:"2024-09-30" },
  "Q2 FY2025": { from:"2024-10-01", to:"2024-12-31" },
  "Q3 FY2025": { from:"2025-01-01", to:"2025-03-31" },
  "Q4 FY2025": { from:"2025-04-01", to:"2025-06-30" },
};
const FY_DATES = {
  "FY2026": { from:"2025-07-01", to:"2026-06-30" },
  "FY2025": { from:"2024-07-01", to:"2025-06-30" },
  "FY2024": { from:"2023-07-01", to:"2024-06-30" },
};

// Human-friendly quarter label with month range, e.g. "Q1 FY2026 (Jul – Sep 2025)".
// Helps owners instantly see which months a quarter covers.
const quarterLabel = (q) => {
  const d = QUARTER_DATES[q];
  if (!d) return q;
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const fromD = new Date(d.from + "T00:00:00");
  const toD   = new Date(d.to   + "T00:00:00");
  const fromMon = MON[fromD.getMonth()];
  const toMon   = MON[toD.getMonth()];
  // Q2 spans two calendar years (Oct–Dec) — show end year; otherwise show the from-year
  const yr = toD.getFullYear();
  return `${q} (${fromMon} – ${toMon} ${yr})`;
};

// Categories that represent Cost of Goods Sold (COGS)
// These are direct costs that move with revenue — not operating expenses
// GST default by category — most business costs in Australia are GST-inclusive
// Exceptions: wages (no GST), bank interest (input-taxed), council rates (no GST)
// Used to suggest correct GST selection when adding expenses
const CAT_GST_DEFAULT = {
  ingredients: true,  food_stock: true,   coffee_supplies: true,  bakery_supplies: true,
  spirit_stock: true, beer_wine_stock: true, eco_packaging: true, packaging: true,
  delivery_fees: true, cleaning: true,     software: true,        advertising: true,
  accounting: true,   staff_uniforms: true, repairs: true,        equipment: true,
  smallwares: true,   linen: true,         music_ent: true,       rent: true,
  utilities: true,    motor_vehicle: true, insurance_expense: true, legal: true,
  license_fees: true, freight: true,       merchant_fees: true,   telephone_internet: true,
  // No GST / input-taxed:
  bank_fees: false,   interest_expense: false, loan_repayment: false, council_rates: false,
  entertainment: false, // often no GST on entertainment cap
  other: true, // default to yes — safer to flag than miss
};

const COGS_CATS = new Set([
  "ingredients","food_stock","coffee_supplies","bakery_supplies",
  "spirit_stock","beer_wine_stock","eco_packaging","packaging","delivery_fees",
]);

// Helper: filter by date range
const inRange = (dateStr, from, to) => dateStr >= from && dateStr <= to;

// ────────────────────────────────────────────────────────────
// Unified sales channel model (v2): one revenue record has a
// `channels` array of { name, amount, gstInclusive }.
//
// getChannels(r) normalises all historical shapes into v2:
//   v0 legacy:   { amount }
//   v1 split:    { dine_in, takeaway, delivery, other_sales[] }
//   v2 channels: { channels[] }
// Old rows are translated on read — no SQL migration needed.
// ────────────────────────────────────────────────────────────
const CHANNEL_PRESETS = [
  // Owner collects GST (declare ÷11)
  { name: "Dine-in",            gstInclusive: true  },
  { name: "Takeaway",           gstInclusive: true  },
  { name: "Catering",           gstInclusive: true  },
  { name: "Walk-in",            gstInclusive: true  },
  // Platform remits GST (nothing to declare)
  { name: "Uber Eats",          gstInclusive: false },
  { name: "DoorDash",           gstInclusive: false },
  { name: "Menulog",            gstInclusive: false },
  { name: "Deliveroo",          gstInclusive: false },
  { name: "Shopify",            gstInclusive: false },
  { name: "eBay",               gstInclusive: false },
  { name: "Amazon",             gstInclusive: false },
  { name: "Etsy",               gstInclusive: false },
  { name: "Delivery Platform",  gstInclusive: false }, // legacy label
];
const PLATFORM_KEYWORDS = [
  "uber eats","ubereats","doordash","menulog","deliveroo","grubhub",
  "shopify","ebay","amazon","etsy",
];
const inferGstInclusive = name => {
  const n = (name || "").toLowerCase().trim();
  const preset = CHANNEL_PRESETS.find(p => p.name.toLowerCase() === n);
  if (preset) return preset.gstInclusive;
  if (PLATFORM_KEYWORDS.some(k => n.includes(k))) return false;
  return true; // default: owner-collected
};

const getChannels = r => {
  if (!r) return [];
  if (Array.isArray(r.channels)) return r.channels.filter(c => c && c.name);
  // v1 split
  const out = [];
  if ((r.dine_in  || 0) > 0) out.push({ name:"Dine-in",           amount:r.dine_in,  gstInclusive:true  });
  if ((r.takeaway || 0) > 0) out.push({ name:"Takeaway",          amount:r.takeaway, gstInclusive:true  });
  if ((r.delivery || 0) > 0) out.push({ name:"Delivery Platform", amount:r.delivery, gstInclusive:false });
  (r.other_sales || []).forEach(o => {
    if (o && o.name && (o.amount || 0) > 0) {
      out.push({ name:o.name, amount:o.amount, gstInclusive: inferGstInclusive(o.name) });
    }
  });
  // v0 legacy flat amount — only if nothing else matched
  if (out.length === 0 && (r.amount || 0) > 0) {
    out.push({ name:"Sales", amount:r.amount, gstInclusive:true });
  }
  return out;
};

// Revenue total — sums every channel regardless of GST treatment
const revTotal = r => getChannels(r).reduce((s,c) => s + (c.amount || 0), 0);

// GST-taxable revenue — only channels the owner collects GST on
const revGSTTaxable = r => getChannels(r).reduce((s,c) => s + (c.gstInclusive ? (c.amount || 0) : 0), 0);

// ASCII sanitiser for MiniPDF output — user-defined channel names may contain Unicode (中文 etc.)
const pdfSafeName = s => {
  const a = (s || "").replace(/[^\x20-\x7E]/g, "").trim();
  return a || "Other Channel";
};

// ────────────────────────────────────────────────────────────
// Expense GST — supports partial GST amounts on mixed invoices.
//   • e.gst_amount (number): explicit GST value from invoice → use as-is
//   • e.gst (boolean, no gst_amount): full GST → amount/11
//   • e.gst === false: no GST → 0
// Backward compatible: old records without gst_amount fall through to /11.
// ────────────────────────────────────────────────────────────
const expGST = e => {
  if (!e) return 0;
  if (e.gst_amount != null && e.gst_amount !== "") {
    const n = Number(e.gst_amount);
    return isNaN(n) ? 0 : n;
  }
  if (e.gst) return (e.amount || 0) / 11;
  return 0;
};

// Timesheets use ISO week — convert week to a date (Monday of that week)
const weekToDate = w => {
  if (!w) return "";
  const [yr, wk] = w.split("-W").map(Number);
  const jan4 = new Date(yr, 0, 4);
  const mon = new Date(jan4);
  mon.setDate(jan4.getDate() - ((jan4.getDay()+6)%7) + (wk-1)*7);
  return mon.toISOString().slice(0,10);
};

// IAS: generate rolling 18-month list (current month back 17)
const IAS_MONTHS = Array.from({length:18}, (_,i) => {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
});
// "2025-07" → "July 2025"
const fmtIASMonth = m => {
  const [y,mo] = m.split('-').map(Number);
  return new Date(y, mo-1, 1).toLocaleDateString('en-AU',{month:'long',year:'numeric'});
};
// ISO week string "YYYY-WNN" → "YYYY-MM" (using Monday of that week as proxy pay date)
const weekToMonth = weekStr => {
  const [yearPart, weekPart] = weekStr.split('-W');
  const year = parseInt(yearPart), week = parseInt(weekPart);
  const jan4 = new Date(year, 0, 4);
  const jan4dow = jan4.getDay() || 7; // Mon=1..Sun=7
  const w1Mon = new Date(year, 0, 4 - (jan4dow - 1));
  const targetMon = new Date(w1Mon.getTime() + (week - 1) * 7 * 86400000);
  return `${targetMon.getFullYear()}-${String(targetMon.getMonth()+1).padStart(2,'0')}`;
};
const IAS_STATUS_CFG = {
  draft:      { lbl:"Draft",      col:"#D97706", bg:"#FFFBEB", border:"#FDE68A" },
  finalised:  { lbl:"Finalised",  col:"#2563EB", bg:"#EFF6FF", border:"#BFDBFE" },
  lodged:     { lbl:"Lodged ✓",   col:"#059669", bg:"#ECFDF5", border:"#A7F3D0" },
};
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
  { id:1, date:"2025-07-01", channels:[
    { name:"Dine-in",           amount:1400, gstInclusive:true  },
    { name:"Takeaway",          amount:820,  gstInclusive:true  },
    { name:"Delivery Platform", amount:450,  gstInclusive:false },
  ]},
  { id:2, date:"2025-07-02", channels:[
    { name:"Dine-in",           amount:980,  gstInclusive:true  },
    { name:"Takeaway",          amount:960,  gstInclusive:true  },
    { name:"Delivery Platform", amount:570,  gstInclusive:false },
  ]},
  { id:3, date:"2025-07-03", channels:[
    { name:"Dine-in",           amount:1650, gstInclusive:true  },
    { name:"Takeaway",          amount:740,  gstInclusive:true  },
    { name:"Delivery Platform", amount:330,  gstInclusive:false },
  ]},
  { id:4, date:"2025-07-04", channels:[
    { name:"Dine-in",           amount:2100, gstInclusive:true  },
    { name:"Takeaway",          amount:890,  gstInclusive:true  },
    { name:"Delivery Platform", amount:730,  gstInclusive:false },
  ]},
  { id:5, date:"2025-07-05", channels:[
    { name:"Dine-in",           amount:1820, gstInclusive:true  },
    { name:"Takeaway",          amount:1040, gstInclusive:true  },
    { name:"Delivery Platform", amount:430,  gstInclusive:false },
  ]},
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
  { id:1, name:"Lilian",       email:"lilian@email.com",      phone:"0400 000 001",
    dob:"2000-04-10", nok_name:"", nok_phone:"",
    role:"Floor Staff",  type:"part-time", rate:15.18, std_hrs:15,
    start:"2024-01-15", tfn:true,  superfund:"AustralianSuper" },
  { id:2, name:"Charlotte",    email:"charlotte@email.com",   phone:"0400 000 002",
    dob:"1999-08-22", nok_name:"", nok_phone:"",
    role:"Floor Staff",  type:"part-time", rate:15.60, std_hrs:15,
    start:"2024-02-01", tfn:true,  superfund:"Hostplus" },
  { id:3, name:"Cohen",        email:"cohen@email.com",       phone:"0400 000 003",
    dob:"2001-11-30", nok_name:"", nok_phone:"",
    role:"Floor Staff",  type:"part-time", rate:15.18, std_hrs:15,
    start:"2024-03-10", tfn:true,  superfund:"REST Super" },
  { id:4, name:"Niamh",        email:"niamh@email.com",       phone:"0400 000 004",
    dob:"2002-05-14", nok_name:"", nok_phone:"",
    role:"Floor Staff",  type:"part-time", rate:15.18, std_hrs:15,
    start:"2024-04-01", tfn:true,  superfund:"AustralianSuper" },
  { id:5, name:"Maddy",        email:"maddy@email.com",       phone:"0400 000 005",
    dob:"2000-09-03", nok_name:"", nok_phone:"",
    role:"Floor Staff",  type:"part-time", rate:15.18, std_hrs:15,
    start:"2024-05-20", tfn:true,  superfund:"Hostplus" },
  { id:6, name:"Zi Jun Fan",   email:"zijun.fan@email.com",   phone:"0400 000 006",
    dob:"1998-01-18", nok_name:"", nok_phone:"",
    role:"Floor Staff",  type:"part-time", rate:0, std_hrs:15,
    start:"2024-06-01", tfn:true,  superfund:"AustralianSuper" },
  { id:7, name:"Zhao Hui Lin", email:"zhaohui.lin@email.com", phone:"0400 000 007",
    dob:"1997-07-25", nok_name:"", nok_phone:"",
    role:"Floor Staff",  type:"part-time", rate:0, std_hrs:15,
    start:"2024-07-15", tfn:true,  superfund:"REST Super" },
  { id:8, name:"Zhong Min Fan",email:"zhongmin.fan@email.com",phone:"0400 000 008",
    dob:"1999-03-08", nok_name:"", nok_phone:"",
    role:"Floor Staff",  type:"part-time", rate:0, std_hrs:15,
    start:"2024-08-01", tfn:true,  superfund:"Hostplus" },
];

// Timesheet: one row = one employee × one week
// std_hrs = standard hours worked, ot_hrs = overtime, wknd_hrs = weekend/PH
const SEED_TIMESHEETS = [
  // ── Week 26 ──
  { id:1,  eid:1, week:"2025-W26", std_hrs:15, ot_hrs:0, wknd_hrs:4, super_paid:true  },
  { id:2,  eid:2, week:"2025-W26", std_hrs:15, ot_hrs:0, wknd_hrs:0, super_paid:true  },
  { id:3,  eid:3, week:"2025-W26", std_hrs:12, ot_hrs:0, wknd_hrs:4, super_paid:true  },
  { id:4,  eid:4, week:"2025-W26", std_hrs:15, ot_hrs:0, wknd_hrs:0, super_paid:true  },
  { id:5,  eid:5, week:"2025-W26", std_hrs:10, ot_hrs:0, wknd_hrs:4, super_paid:true  },
  { id:6,  eid:6, week:"2025-W26", std_hrs:15, ot_hrs:0, wknd_hrs:0, super_paid:true  },
  { id:7,  eid:7, week:"2025-W26", std_hrs:12, ot_hrs:0, wknd_hrs:4, super_paid:true  },
  { id:8,  eid:8, week:"2025-W26", std_hrs:15, ot_hrs:0, wknd_hrs:0, super_paid:true  },
  // ── Week 27 ──
  { id:9,  eid:1, week:"2025-W27", std_hrs:15, ot_hrs:0, wknd_hrs:4, super_paid:false },
  { id:10, eid:2, week:"2025-W27", std_hrs:15, ot_hrs:0, wknd_hrs:4, super_paid:false },
  { id:11, eid:3, week:"2025-W27", std_hrs:15, ot_hrs:0, wknd_hrs:0, super_paid:false },
  { id:12, eid:4, week:"2025-W27", std_hrs:12, ot_hrs:0, wknd_hrs:4, super_paid:false },
  { id:13, eid:5, week:"2025-W27", std_hrs:15, ot_hrs:0, wknd_hrs:0, super_paid:false },
  { id:14, eid:6, week:"2025-W27", std_hrs:10, ot_hrs:0, wknd_hrs:4, super_paid:false },
  { id:15, eid:7, week:"2025-W27", std_hrs:15, ot_hrs:0, wknd_hrs:0, super_paid:false },
  { id:16, eid:8, week:"2025-W27", std_hrs:12, ot_hrs:0, wknd_hrs:4, super_paid:false },
  // ── Week 28 ──
  { id:17, eid:1, week:"2025-W28", std_hrs:15, ot_hrs:0, wknd_hrs:4, super_paid:false },
  { id:18, eid:2, week:"2025-W28", std_hrs:12, ot_hrs:0, wknd_hrs:0, super_paid:false },
  { id:19, eid:3, week:"2025-W28", std_hrs:15, ot_hrs:0, wknd_hrs:4, super_paid:false },
  { id:20, eid:4, week:"2025-W28", std_hrs:15, ot_hrs:0, wknd_hrs:0, super_paid:false },
  { id:21, eid:5, week:"2025-W28", std_hrs:12, ot_hrs:0, wknd_hrs:4, super_paid:false },
  { id:22, eid:6, week:"2025-W28", std_hrs:15, ot_hrs:0, wknd_hrs:0, super_paid:false },
  { id:23, eid:7, week:"2025-W28", std_hrs:15, ot_hrs:0, wknd_hrs:4, super_paid:false },
  { id:24, eid:8, week:"2025-W28", std_hrs:12, ot_hrs:0, wknd_hrs:0, super_paid:false },
];

const SEED_INSURANCE = [
  { id:1, type:"Workers Compensation", annual:3400, notes:"Annual Workers Comp renewal", renewal:"2026-04-01" },
  { id:2, type:"Public Liability",     annual:1200, notes:"$10M cover",                  renewal:"2026-05-15" },
  { id:3, type:"Equipment & Property", annual:2100, notes:"Fitout & kitchen equipment",  renewal:"2026-06-30" },
];

// Leave taken records  { eid, type: "annual"|"personal"|"lieu", date, hours, notes }
// Leave accruals are computed from timesheets — only stored data is leave *taken*
const SEED_LEAVE = [
  { id:1, eid:1, type:"annual",   date:"2025-06-15", hours:15, notes:"Annual leave" },
  { id:2, eid:3, type:"personal", date:"2025-06-20", hours:8,  notes:"Sick day" },
  { id:3, eid:2, type:"lieu",     date:"2025-07-01", hours:7.5,notes:"Lieu for weekend shift" },
];

// IAS per-month adjustment & status records
// adjustW1/adjustW2 = manual additions on top of timesheet-auto-calc (e.g. cash wages, contractor payments)
const SEED_IAS = [
  { id:1, month:"2025-07", adjustW1:0,   adjustW2:0,  notes:"", status:"draft",     lodgedDate:null },
  { id:2, month:"2025-06", adjustW1:250, adjustW2:48, notes:"Included $250 cash wages paid to kitchen hand (no timesheet).", status:"finalised", lodgedDate:null },
  { id:3, month:"2025-05", adjustW1:0,   adjustW2:0,  notes:"", status:"lodged",    lodgedDate:"2025-06-28" },
];

// Roster shifts: one shift per employee per day
// { id, eid, date:"YYYY-MM-DD", start:"HH:MM", end:"HH:MM", break_mins, note }
const SEED_ROSTER = [
  // Monday 7 Jul
  { id:1,  eid:1, date:"2025-07-07", start:"09:00", end:"15:00", break_mins:30, note:"Lunch service" },
  { id:2,  eid:2, date:"2025-07-07", start:"09:00", end:"15:00", break_mins:30, note:"Lunch service" },
  { id:3,  eid:6, date:"2025-07-07", start:"16:00", end:"22:00", break_mins:0,  note:"Dinner service" },
  // Tuesday 8 Jul
  { id:4,  eid:3, date:"2025-07-08", start:"09:00", end:"15:00", break_mins:30, note:"" },
  { id:5,  eid:4, date:"2025-07-08", start:"16:00", end:"22:00", break_mins:0,  note:"Dinner service" },
  // Wednesday 9 Jul
  { id:6,  eid:5, date:"2025-07-09", start:"09:00", end:"15:00", break_mins:30, note:"" },
  { id:7,  eid:7, date:"2025-07-09", start:"16:00", end:"22:00", break_mins:0,  note:"" },
  // Thursday 10 Jul
  { id:8,  eid:1, date:"2025-07-10", start:"09:00", end:"15:00", break_mins:30, note:"" },
  { id:9,  eid:8, date:"2025-07-10", start:"16:00", end:"22:00", break_mins:0,  note:"" },
  // Friday 11 Jul
  { id:10, eid:2, date:"2025-07-11", start:"09:00", end:"15:00", break_mins:30, note:"" },
  { id:11, eid:3, date:"2025-07-11", start:"16:00", end:"22:00", break_mins:0,  note:"Busy Friday night" },
  { id:12, eid:6, date:"2025-07-11", start:"16:00", end:"22:00", break_mins:0,  note:"Busy Friday night" },
  // Saturday 12 Jul (weekend ×1.75)
  { id:13, eid:4, date:"2025-07-12", start:"10:00", end:"16:00", break_mins:30, note:"Weekend lunch" },
  { id:14, eid:5, date:"2025-07-12", start:"10:00", end:"16:00", break_mins:30, note:"Weekend lunch" },
  { id:15, eid:7, date:"2025-07-12", start:"16:00", end:"22:00", break_mins:0,  note:"Weekend dinner" },
  // Sunday 13 Jul (weekend ×1.75)
  { id:16, eid:8, date:"2025-07-13", start:"10:00", end:"16:00", break_mins:30, note:"Sunday brunch" },
  { id:17, eid:1, date:"2025-07-13", start:"10:00", end:"16:00", break_mins:30, note:"Sunday brunch" },
];

const SEED_DOCUMENTS = [
  { id:1,  name:"July_Produce_Invoice.pdf",    size:184320, type:"application/pdf",   cat:"Invoice",           supplier:"Fresh Fields Markets",  emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:true,  status:"verified", date:"2025-07-01", notes:"Weekly produce delivery" },
  { id:2,  name:"Monthly_Rent_Invoice.pdf",    size:98304,  type:"application/pdf",   cat:"Invoice",           supplier:"Harbour Property Mgmt", emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:true,  status:"verified", date:"2025-07-01", notes:"Monthly premises rent" },
  { id:3,  name:"Gas_Electricity_Jul.pdf",     size:72192,  type:"application/pdf",   cat:"Receipt",           supplier:"AGL Energy",            emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:true,  status:"pending",  date:"2025-07-02", notes:"Utilities bill — invoice missing" },
  { id:4,  name:"Blender_Equipment.pdf",       size:156672, type:"application/pdf",   cat:"Invoice",           supplier:"Kitchen Pro Supplies",   emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:true,  status:"verified", date:"2025-07-03", notes:"Commercial blender purchase" },
  { id:5,  name:"Workers_Comp_Policy.pdf",     size:512000, type:"application/pdf",   cat:"Insurance Document",supplier:"Allianz Australia",      emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:false, status:"verified", date:"2025-07-01", notes:"Annual Workers Comp renewal" },
  { id:6,  name:"Jul_POS_Export.csv",          size:24576,  type:"text/csv",          cat:"POS Export",        supplier:"Square POS",            emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:false, status:"verified", date:"2025-07-05", notes:"July daily sales export" },
  { id:7,  name:"BAS_Q4FY25_Notice.pdf",       size:203776, type:"application/pdf",   cat:"BAS Notice",        supplier:"ATO",                   emp_id:null, quarter:"Q4 FY2025", fy:"FY2025", gst:false, status:"verified", date:"2025-07-28", notes:"Q4 FY2025 BAS lodgment confirmation" },
  { id:8,  name:"Payroll_Lilian_Jun.xlsx",      size:40960,  type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", cat:"Payroll Report", supplier:null, emp_id:1, quarter:"Q4 FY2025", fy:"FY2025", gst:false, status:"verified", date:"2025-06-28", notes:"Lilian June payroll" },
  { id:9,  name:"Accountant_FY25_Notes.pdf",   size:311296, type:"application/pdf",   cat:"Accountant Note",   supplier:"Smith & Co Accountants",emp_id:null, quarter:"Q4 FY2025", fy:"FY2025", gst:false, status:"verified", date:"2025-07-15", notes:"Year-end review notes" },
  { id:10, name:"Facebook_Ads_Receipt.pdf",    size:61440,  type:"application/pdf",   cat:"Receipt",           supplier:"Meta Platforms",        emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:true,  status:"missing",  date:"2025-07-08", notes:"Facebook ads — invoice not yet received" },
  { id:11, name:"Jul_Bank_Statement.pdf",      size:425984, type:"application/pdf",   cat:"Bank Statement",    supplier:"Commonwealth Bank",     emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:false, status:"verified", date:"2025-07-31", notes:"July business account statement" },
  { id:12, name:"Xero_Subscription.pdf",       size:32768,  type:"application/pdf",   cat:"Invoice",           supplier:"Xero",                  emp_id:null, quarter:"Q1 FY2026", fy:"FY2026", gst:true,  status:"verified", date:"2025-07-07", notes:"Monthly subscription" },
];

// Stock takes — opening/closing inventory per quarter for true COGS calculation
// COGS = opening_stock + purchases_in_period - closing_stock
const SEED_INVENTORY = [
  { id:1, quarter:"Q1 FY2026", opening:4200, closing:3800, notes:"End of July stocktake" },
  { id:2, quarter:"Q4 FY2025", opening:3900, closing:4200, notes:"End of June stocktake" },
];

// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════
const today    = new Date();
const todayStr = today.toISOString().split("T")[0];
// ISO week string for today — used for date-aware super/PAYG in modals without a specific week
const todayWeekStr = (() => {
  const d = new Date(); const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day); // shift to nearest Thursday
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const wk = Math.ceil((((d - jan1) / 86400000) + 1) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2,'0')}`;
})();
const quarter  = `Q${Math.ceil((today.getMonth()+1)/3)} ${today.getFullYear()}`;

const money = n =>
  "$" + Math.abs(n).toLocaleString("en-AU",{ minimumFractionDigits:2, maximumFractionDigits:2 });

// ════════════════════════════════════════════════════════════
//  AUDIT TRAIL — per-record metadata (Approach A)
//  Each audited record carries a _meta field:
//    _meta: {
//      createdBy, createdAt,          // who first created it + when
//      editedBy,  editedAt,           // who last edited + when
//      history: [{ ts, by, action, changes:[{field, from, to}] }]  // immutable log
//    }
//  Audit logs are append-only by convention — we never rewrite history entries,
//  only push new ones. View-only roles are blocked upstream in usePersisted.
// ════════════════════════════════════════════════════════════

// Tables that get audit trails (full names as passed to usePersisted)
const AUDITED_TABLES = ["mise_revenue", "mise_expenses"];

// Fields we don't diff (internal/derived) — avoids noise in the timeline
const AUDIT_IGNORE_FIELDS = ["_meta", "id"];

const nowISO = () => new Date().toISOString();

// Human-readable value for the timeline (numbers as money, booleans as Yes/No)
const auditFmtValue = (field, v) => {
  if (v === undefined || v === null || v === "") return "(empty)";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") {
    // channels array etc — summarise rather than dump JSON
    if (Array.isArray(v)) return `${v.length} item${v.length===1?"":"s"}`;
    return "(updated)";
  }
  // money-ish fields
  if (/amount|gross|rate|total|pay|wage|gst/i.test(field) && !isNaN(parseFloat(v))) {
    return money(parseFloat(v));
  }
  return String(v);
};

// Compute field-level changes between two record versions
const auditDiff = (oldRec, newRec) => {
  const changes = [];
  const keys = new Set([...Object.keys(oldRec||{}), ...Object.keys(newRec||{})]);
  keys.forEach(k => {
    if (AUDIT_IGNORE_FIELDS.includes(k)) return;
    const a = oldRec ? oldRec[k] : undefined;
    const b = newRec ? newRec[k] : undefined;
    // Compare via JSON for objects/arrays; primitives compare directly
    const aS = typeof a === "object" ? JSON.stringify(a) : a;
    const bS = typeof b === "object" ? JSON.stringify(b) : b;
    if (aS !== bS) changes.push({ field: k, from: auditFmtValue(k, a), to: auditFmtValue(k, b) });
  });
  return changes;
};

// Stamp a brand-new record with creation metadata
const auditStampCreate = (rec, who) => ({
  ...rec,
  _meta: {
    createdBy: who || "Unknown",
    createdAt: nowISO(),
    editedBy:  who || "Unknown",
    editedAt:  nowISO(),
    history: [{ ts: nowISO(), by: who || "Unknown", action: "created", changes: [] }],
  },
});

// Stamp an edited record — appends a history entry with field changes
const auditStampEdit = (oldRec, newRec, who) => {
  const changes = auditDiff(oldRec, newRec);
  const prevMeta = oldRec?._meta || {
    createdBy: who || "Unknown", createdAt: nowISO(),
    editedBy: who || "Unknown", editedAt: nowISO(), history: [],
  };
  // No real change → keep meta as-is (don't pollute history)
  if (changes.length === 0) return { ...newRec, _meta: prevMeta };
  return {
    ...newRec,
    _meta: {
      ...prevMeta,
      editedBy: who || "Unknown",
      editedAt: nowISO(),
      history: [...(prevMeta.history || []), { ts: nowISO(), by: who || "Unknown", action: "edited", changes }],
    },
  };
};

// Diff two arrays of records (by id) and apply create/edit stamps.
// Returns the new array with audit metadata applied to changed records.
const auditReconcile = (oldArr, newArr, who) => {
  if (!Array.isArray(newArr)) return newArr;
  const oldById = {};
  (oldArr || []).forEach(r => { if (r && r.id != null) oldById[r.id] = r; });
  return newArr.map(rec => {
    if (!rec || rec.id == null) return rec;
    const prev = oldById[rec.id];
    if (!prev) {
      // New record — but only stamp if not already stamped (avoid double-stamp on reload)
      return rec._meta ? rec : auditStampCreate(rec, who);
    }
    // Existing record — diff & stamp if changed
    return auditStampEdit(prev, rec, who);
  });
};

// ── Pure-JS PDF Generator — no external dependencies ────────
class MiniPDF {
  constructor(landscape=false) {
    this.W = landscape ? 842 : 595;
    this.H = landscape ? 595 : 842;
    this.M = landscape ? 30  : 40;
    this.pages=[[]];
  }
  get ops(){ return this.pages[this.pages.length-1]; }
  addPage(){ this.pages.push([]); return this; }
  _py(y){ return this.H-y; }
  _esc(s){ return String(s??'').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[^\x20-\x7E]/g,'?'); }
  _col(c,t='rg'){
    if(!c) return `0 0 0 ${t}`;
    if(typeof c==='string'&&c[0]==='#'){
      const r=parseInt(c.slice(1,3),16),g=parseInt(c.slice(3,5),16),b=parseInt(c.slice(5,7),16);
      return `${(r/255).toFixed(2)} ${(g/255).toFixed(2)} ${(b/255).toFixed(2)} ${t}`;
    }
    return `${c.map(v=>(v/255).toFixed(2)).join(' ')} ${t}`;
  }
  _tw(s,sz){ return String(s??'').length*sz*0.52; }

  text(x,y,str,{size=10,bold=false,color='#111111',align='left'}={}){
    const s=String(str??'');
    if(align==='right') x=x-this._tw(s,size);
    else if(align==='center') x=x-this._tw(s,size)/2;
    const font=bold?'F2':'F1';
    this.ops.push(`BT /${font} ${size} Tf ${this._col(color)} ${x.toFixed(1)} ${(this._py(y+size)).toFixed(1)} Td (${this._esc(s)}) Tj ET`);
    return this;
  }

  rect(x,y,w,h,{fill,stroke,sw=0.5}={}){
    let s='';
    if(fill) s+=`${this._col(fill)} `;
    if(stroke) s+=`${this._col(stroke,'RG')} ${sw} w `;
    s+=`${x.toFixed(1)} ${(this._py(y+h)).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re `;
    s+=fill&&stroke?'B':fill?'f':'S';
    this.ops.push(s); return this;
  }

  line(x1,y1,x2,y2,{color='#E5E7EB',w=0.5}={}){
    this.ops.push(`${w} w ${this._col(color,'RG')} ${x1.toFixed(1)} ${this._py(y1).toFixed(1)} m ${x2.toFixed(1)} ${this._py(y2).toFixed(1)} l S`);
    return this;
  }

  // Check if we need a new page
  checkPage(y,needed=20){ if(y+needed>this.H-this.M){ this.addPage(); return this.M+10; } return y; }

  build(){
    const nP=this.pages.length;
    const pIds=Array.from({length:nP},(_,i)=>3+i);
    const sIds=Array.from({length:nP},(_,i)=>3+nP+i);
    const f1=3+nP*2, f2=3+nP*2+1, total=f2;
    const defs=Array(total).fill('');
    defs[0]=`<< /Type /Catalog /Pages 2 0 R >>`;
    defs[1]=`<< /Type /Pages /Kids [${pIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${nP} >>`;
    this.pages.forEach((ops,i)=>{
      const s=ops.join('\n');
      defs[pIds[i]-1]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Contents ${sIds[i]} 0 R /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> >>`;
      defs[sIds[i]-1]=`<< /Length ${s.length} >>\nstream\n${s}\nendstream`;
    });
    defs[f1-1]=`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;
    defs[f2-1]=`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`;
    let out='%PDF-1.4\n', offs=[];
    defs.forEach((d,i)=>{ offs.push(out.length); out+=`${i+1} 0 obj\n${d}\nendobj\n`; });
    const xref=out.length;
    out+=`xref\n0 ${total+1}\n0000000000 65535 f \n`;
    offs.forEach(o=>{ out+=`${String(o).padStart(10,'0')} 00000 n \n`; });
    out+=`trailer\n<< /Size ${total+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return out;
  }

  toBlob(){
    const s=this.build();
    const bytes=new Uint8Array(s.length);
    for(let i=0;i<s.length;i++) bytes[i]=s.charCodeAt(i)&0xff;
    return new Blob([bytes],{type:'application/pdf'});
  }
}

// ── Minimal ZIP builder (PKZIP 2.0, no compression — store only) ─
// Builds a valid .zip from an array of {name, blob} entries
const buildZip = async (files) => {
  // Helper: 4-byte little-endian
  const u32 = n => { const b=new Uint8Array(4); new DataView(b.buffer).setUint32(0,n,true); return b; };
  const u16 = n => { const b=new Uint8Array(2); new DataView(b.buffer).setUint16(0,n,true); return b; };

  // Simple CRC-32
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let i=0; i<256; i++) {
      let c=i;
      for (let k=0; k<8; k++) c = c&1 ? 0xEDB88320^(c>>>1) : c>>>1;
      t[i]=c;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c=0xFFFFFFFF;
    for (let i=0; i<buf.length; i++) c = crcTable[(c^buf[i])&0xff]^(c>>>8);
    return (c^0xFFFFFFFF)>>>0;
  };

  const enc = new TextEncoder();
  const parts = [];
  const centralDir = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = enc.encode(f.name);
    const data    = new Uint8Array(await f.blob.arrayBuffer());
    const crc     = crc32(data);
    const size    = data.length;

    // Local file header
    const local = new Uint8Array([
      0x50,0x4B,0x03,0x04, // signature
      20,0,                 // version needed
      0,0,                  // flags
      0,0,                  // compression (store)
      0,0,0,0,              // mod time/date
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBuf.length),
      0,0,                  // extra length
      ...nameBuf,
    ]);
    parts.push(local, data);

    // Central directory entry
    centralDir.push({ nameBuf, crc, size, offset });
    offset += local.length + size;
  }

  // Write central directory
  let cdSize = 0;
  const cdParts = [];
  for (const e of centralDir) {
    const cd = new Uint8Array([
      0x50,0x4B,0x01,0x02, // signature
      20,0,                 // version made by
      20,0,                 // version needed
      0,0,                  // flags
      0,0,                  // compression
      0,0,0,0,              // mod time/date
      ...u32(e.crc),
      ...u32(e.size),
      ...u32(e.size),
      ...u16(e.nameBuf.length),
      0,0,                  // extra
      0,0,                  // comment
      0,0,                  // disk start
      0,0,                  // internal attr
      0,0,0,0,              // external attr
      ...u32(e.offset),
      ...e.nameBuf,
    ]);
    cdParts.push(cd);
    cdSize += cd.length;
  }

  // End of central directory
  const eocd = new Uint8Array([
    0x50,0x4B,0x05,0x06,
    0,0,0,0,
    ...u16(files.length),
    ...u16(files.length),
    ...u32(cdSize),
    ...u32(offset),
    0,0,
  ]);

  const totalLen = parts.reduce((s,p)=>s+p.length,0)
                 + cdParts.reduce((s,p)=>s+p.length,0)
                 + eocd.length;
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of [...parts, ...cdParts, eocd]) { out.set(p, pos); pos += p.length; }
  return new Blob([out], { type:'application/zip' });
};

const zipDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
const pdfDownload = (pdf, filename) => {
  // Use Blob + createObjectURL — avoids Chrome's data:application/pdf CSP block
  const blob = pdf.toBlob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

// ── PDF layout primitives matching app's pp-* classes ─────────

// Header — three vertical zones that never overlap:
//   Zone 1 (y=10–22): Logo | subtitle centre | biz name right
//   Zone 2 (y=28–50): large title centre ONLY — right column is blank here
//   Zone 3 (y=54–76): period / generated / mgmt summary right ONLY
//   Separator y=82, return 96
const pdfHeader = (pdf, title, subtitle, period='', bizName='My Business') => {
  const W=pdf.W, M=pdf.M, cx=W/2;

  // Zone 1 — logo strip
  pdf.rect(M, 10, 32, 32, {fill:'#8FCB72'});
  pdf.text(M+8, 13, 'M', {size:18, bold:true, color:'#0C0F0D'});
  pdf.text(M+40, 13, 'Mise', {size:13, bold:true, color:'#0C0F0D'});
  pdf.text(M+40, 27, 'HOSPITALITY FINANCE', {size:7, color:'#6B7280'});
  // subtitle (small caps) centre
  pdf.text(cx, 10, subtitle.toUpperCase(), {size:8, color:'#9CA3AF', align:'center'});
  // biz name right — baseline = 10+10 = 20, well above title zone
  pdf.text(W-M, 10, bizName, {size:10, bold:true, color:'#111111', align:'right'});

  // Zone 2 — large title, centre ONLY
  // title baseline = 28+17 = 45; visual top ≈ 28+17×0.3 = 33
  pdf.text(cx, 28, title, {size:17, bold:true, color:'#111111', align:'center'});

  // Zone 3 — right-aligned meta, BELOW title baseline (45)
  // period  visual top = 52+8×0.3 = 54.4  >  45 ✓
  if(period) pdf.text(W-M, 52, `Period: ${period}`, {size:8, color:'#6B7280', align:'right'});
  pdf.text(W-M, 63, `Generated: ${todayStr}`, {size:7.5, color:'#9CA3AF', align:'right'});
  pdf.text(W-M, 73, 'MANAGEMENT SUMMARY ONLY', {size:7, color:'#D1D5DB', align:'right'});
  // separator — below mgmt summary baseline (73+7=80) by 2pt
  pdf.line(M, 82, W-M, 82, {color:'#E5E7EB', w:1.5});
  return 96;
};

// Section header — matches .pp-sec-ttl
const pdfSecTitle = (pdf, y, title) => {
  // title baseline = y+9; separator at y+16 (7pt gap); next content at y+24
  pdf.text(pdf.M, y, title, {size:9, bold:true, color:'#6B7280'});
  pdf.line(pdf.M, y+16, pdf.W-pdf.M, y+16, {color:'#E5E7EB', w:0.8});
  return y+24;
};

// KV row — matches .pp-row
// text at y+5 (size 9.5 → baseline y+14.5); separator at y+20; row height 22
const pdfRow = (pdf, y, label, value, {valColor='#111111', valBold=false, valSize=10, lx, rx}={}) => {
  const left  = lx ?? pdf.M;
  const right = rx ?? pdf.W - pdf.M;
  pdf.text(left+4,  y+5, label, {size:9.5, color:'#374151'});
  pdf.text(right-4, y+5, value, {size:valSize, bold:valBold, color:valColor, align:'right'});
  pdf.line(left, y+20, right, y+20, {color:'#F3F4F6', w:0.5});
  return y+22;
};

// Total row — matches .pp-tot (gray bg, bold value in green)
// box height 32; label at y+10 (baseline y+20); value at y+9 (baseline y+23)
const pdfTotRow = (pdf, y, label, value, {valColor='#8FCB72', lx, rw}={}) => {
  const x  = lx ?? pdf.M;
  const bw = rw ?? (pdf.W - pdf.M*2);
  pdf.rect(x, y, bw, 32, {fill:'#F9FAFB', stroke:'#E5E7EB'});
  pdf.text(x+10,    y+10, label, {size:10, bold:true, color:'#111111'});
  pdf.text(x+bw-10, y+9,  value, {size:14, bold:true, color:valColor, align:'right'});
  return y+40;
};

// Warning row — matches .pp-warn (yellow bg, border)
// box height 28; text at y+10 (baseline y+18.5)
const pdfWarn = (pdf, y, msg) => {
  const bw=pdf.W-pdf.M*2;
  pdf.rect(pdf.M, y, bw, 28, {fill:'#FEFCE8', stroke:'#FDE047'});
  pdf.text(pdf.M+8, y+10, msg, {size:8.5, color:'#854D0E'});
  return y+36;
};

// Two-column section (like the GST | Wages grid in app)
const pdfTwoSec = (pdf, startY, left, right) => {
  const M=pdf.M, W=pdf.W, gap=14;
  const colW=(W-M*2-gap)/2;
  const lx=M, rx=M+colW+gap;
  const ROW_H = 22;
  const MAX_VAL_CHARS = 28; // max chars before truncation
  const truncate = s => s && s.length > MAX_VAL_CHARS ? s.slice(0, MAX_VAL_CHARS-1)+'.' : s;

  // Section titles
  pdf.text(lx, startY, left.title,  {size:9, bold:true, color:'#6B7280'});
  pdf.line(lx, startY+16, lx+colW, startY+16, {color:'#E5E7EB', w:0.8});
  pdf.text(rx, startY, right.title, {size:9, bold:true, color:'#6B7280'});
  pdf.line(rx, startY+16, rx+colW,  startY+16, {color:'#E5E7EB', w:0.8});
  let ly=startY+24, ry=startY+24;

  left.rows.forEach(r=>{
    pdf.text(lx+4,       ly+5, r.lbl,           {size:9, color:'#374151'});
    pdf.text(lx+colW-4,  ly+5, truncate(r.val), {size:9, bold:!!r.bold, color:r.color||'#111111', align:'right'});
    pdf.line(lx, ly+ROW_H, lx+colW, ly+ROW_H, {color:'#F3F4F6', w:0.5});
    ly+=ROW_H;
  });
  right.rows.forEach(r=>{
    pdf.text(rx+4,      ry+5, r.lbl,           {size:9, color:'#374151'});
    pdf.text(rx+colW-4, ry+5, truncate(r.val), {size:9, bold:!!r.bold, color:r.color||'#111111', align:'right'});
    pdf.line(rx, ry+ROW_H, rx+colW, ry+ROW_H, {color:'#F3F4F6', w:0.5});
    ry+=ROW_H;
  });

  const maxY=Math.max(ly,ry)+8;
  if(left.total){
    pdf.rect(lx, maxY, colW, 32, {fill:'#F9FAFB', stroke:'#E5E7EB'});
    pdf.text(lx+8,      maxY+10, left.total.lbl,  {size:9.5, bold:true, color:'#111111'});
    pdf.text(lx+colW-8, maxY+9,  left.total.val,  {size:14,  bold:true, color:left.total.color||'#8FCB72', align:'right'});
  }
  if(right.total){
    pdf.rect(rx, maxY, colW, 32, {fill:'#F9FAFB', stroke:'#E5E7EB'});
    pdf.text(rx+8,      maxY+10, right.total.lbl, {size:9.5, bold:true, color:'#111111'});
    pdf.text(rx+colW-8, maxY+9,  right.total.val, {size:14,  bold:true, color:right.total.color||'#8FCB72', align:'right'});
  }
  return maxY + (left.total||right.total ? 32+14 : 8);
};

// Mini stat card grid (like .pp-quarter-grid) — n cards in a row
const pdfStatCards = (pdf, y, cards) => {
  const M=pdf.M, W=pdf.W, n=cards.length, gap=8;
  const cw=(W-M*2-(n-1)*gap)/n;
  cards.forEach((c,i)=>{
    const cx=M+i*(cw+gap);
    pdf.rect(cx, y, cw, 50, {fill:'#F9FAFB', stroke:'#E5E7EB'});
    pdf.text(cx+8, y+10,  String(c.lbl), {size:8,   color:'#9CA3AF'});
    pdf.text(cx+8, y+24,  String(c.val), {size:15,  bold:true, color:c.color||'#111111'});
    if(c.sub) pdf.text(cx+8, y+40, c.sub, {size:7.5, color:'#9CA3AF'});
  });
  return y+58;
};

// Table helper
// rowH=22: text at y+6 (size 9 → baseline y+15); separator at y+22; gap to next text = 6+9×0.3=8.7pt
const pdfTable = (pdf, y, headers, rows, colWidths, {rowH=22,hdrH=26,fontSize=9,footerRow=null,numCols=[]}={}) => {
  const M=pdf.M, totalW=colWidths.reduce((s,w)=>s+w,0);
  pdf.rect(M, y, totalW, hdrH, {fill:'#111827'});
  let cx=M;
  headers.forEach((h,i)=>{
    const isNum=numCols.includes(i)||(i>0&&i>=headers.length-2);
    const align=isNum?'right':'left';
    pdf.text(cx+(align==='right'?colWidths[i]-5:5), y+8, h, {size:fontSize-1, bold:true, color:'#FFFFFF', align});
    cx+=colWidths[i];
  });
  y+=hdrH;

  rows.forEach((row,ri)=>{
    y=pdf.checkPage(y, rowH+6);
    if(ri%2===1) pdf.rect(M, y, totalW, rowH, {fill:'#F9FAFB'});
    cx=M;
    row.forEach((cell,ci)=>{
      const isNum=numCols.includes(ci)||(ci>0&&ci>=row.length-2&&typeof(cell?.text||cell)==='string'&&String(cell?.text||cell).startsWith('$'));
      const align=isNum?'right':'left';
      const col=cell?.color||'#374151';
      const txt=String(cell?.text||cell||'');
      pdf.text(cx+(align==='right'?colWidths[ci]-4:4), y+7, txt, {size:fontSize, color:col, align});
      cx+=colWidths[ci];
    });
    pdf.line(M, y+rowH, M+totalW, y+rowH, {color:'#E5E7EB', w:0.5});
    y+=rowH;
  });

  if(footerRow){
    pdf.rect(M, y, totalW, hdrH, {fill:'#F3F4F6', stroke:'#E5E7EB'});
    cx=M;
    footerRow.forEach((cell,ci)=>{
      const isNum=numCols.includes(ci)||(ci>0&&ci>=footerRow.length-2);
      const align=isNum?'right':'left';
      pdf.text(cx+(align==='right'?colWidths[ci]-4:4), y+8, String(cell||''), {size:fontSize, bold:true, color:'#111111', align});
      cx+=colWidths[ci];
    });
    y+=hdrH;
  }
  return y+12;
};

// Disclaimer footer — matches .pp-disc
const pdfDisclaimer = (pdf, y) => {
  y=pdf.checkPage(y, 50);
  pdf.line(pdf.M, y, pdf.W-pdf.M, y, {color:'#E5E7EB', w:0.8});
  y+=10;
  pdf.text(pdf.M, y,    'Important: This document is a management summary only generated by Mise for planning and review purposes.', {size:7.5, color:'#9CA3AF'});
  y+=13;
  pdf.text(pdf.M, y,    'Not a substitute for a registered tax agent, BAS agent or accountant. All figures are estimates based on data entered into Mise.', {size:7.5, color:'#9CA3AF'});
  y+=13;
  pdf.text(pdf.M, y,    `Generated ${new Date().toLocaleDateString('en-AU',{day:'2-digit',month:'long',year:'numeric'})}   |   Retain records for 7 years (ATO requirement)   |   ato.gov.au`, {size:7.5, color:'#9CA3AF'});
};

// ── PDF render functions ──────────────────────────────────────

const renderPnLPDF = ({ bizName, bizABN, label, period,
  plRev, plGST, plRevExGST,
  openingStock, plPurchases, closingStock, trueCOGS,
  grossProfit, grossMargin,
  plWages, plSuper, plInsQ, plOpExp, totalOpex,
  operatingProfit, operatingMargin,
  plExpByCat
}) => {
  const pdf = new MiniPDF();
  const W=pdf.W, M=pdf.M;
  let y = pdfHeader(pdf, bizName||'Profit & Loss Statement', `Period: ${label}`, bizABN||'');

  // ── Revenue ──
  y = pdfSecTitle(pdf, y, 'REVENUE');
  y = pdfTwoSec(pdf, y,
    { title:'REVENUE BREAKDOWN',
      rows:[
        {lbl:'Total Sales (incl. GST)',     val:`$${plRev.toFixed(2)}`},
        {lbl:'Less GST Collected (1/11)',   val:`-$${plGST.toFixed(2)}`},
      ],
      total:{lbl:'Net Revenue (ex-GST)',    val:`$${plRevExGST.toFixed(2)}`, color:'#3DD3C8'},
    },
    { title:'COST OF GOODS SOLD',
      rows:[
        ...(openingStock>0 ? [{lbl:'Opening Stock',val:`$${openingStock.toFixed(2)}`}] : []),
        {lbl:'Purchases (food/packaging/delivery)', val:`$${plPurchases.toFixed(2)}`},
        ...(closingStock>0 ? [{lbl:'Less Closing Stock',val:`-$${closingStock.toFixed(2)}`}] : []),
      ],
      total:{lbl:'Total COGS', val:`$${trueCOGS.toFixed(2)}`, color:'#D97706'},
    }
  );
  y += 8;

  // ── Gross Profit ──
  y = pdfSecTitle(pdf, y, 'GROSS PROFIT');
  y = pdfStatCards(pdf, y, [
    {lbl:'Net Revenue (ex-GST)', val:`$${plRevExGST.toFixed(2)}`,   color:'#3DD3C8'},
    {lbl:'Total COGS',           val:`$${trueCOGS.toFixed(2)}`,     color:'#D97706'},
    {lbl:'Gross Profit',         val:`$${grossProfit.toFixed(2)}`,  color:grossProfit>=0?'#16A34A':'#DC2626'},
    {lbl:'Gross Margin',         val:`${grossMargin.toFixed(1)}%`,  color:grossMargin>=50?'#16A34A':grossMargin>=30?'#D97706':'#DC2626'},
  ]);
  y += 6;

  // ── Operating Expenses ──
  y = pdfSecTitle(pdf, y, 'OPERATING EXPENSES');
  y = pdfTwoSec(pdf, y,
    { title:'LABOUR & FIXED',
      rows:[
        {lbl:'Gross Wages',           val:`$${plWages.toFixed(2)}`},
        {lbl:'Superannuation (SGC)',  val:`$${plSuper.toFixed(2)}`},
        {lbl:'Insurance (quarterly)', val:`$${plInsQ.toFixed(2)}`},
        {lbl:'Other Operating Exp',   val:`$${plOpExp.toFixed(2)}`},
      ],
      total:{lbl:'Total OPEX', val:`$${totalOpex.toFixed(2)}`, color:'#DC2626'},
    },
    { title:'EXPENSE BY CATEGORY',
      rows: plExpByCat.slice(0,6).map(c=>({
        lbl: `${c.cfg?.label||c.cat}${c.isCOGS?' (COGS)':''}`,
        val: `$${c.amount.toFixed(2)}`
      })),
      total: plExpByCat.length>6 ? {lbl:`+ ${plExpByCat.length-6} more categories`,val:''} : undefined,
    }
  );
  y += 10;

  // ── Operating Profit (EBIT) ──
  y = pdfSecTitle(pdf, y, 'OPERATING PROFIT (EBIT)');
  y = pdfStatCards(pdf, y, [
    {lbl:'Gross Profit',       val:`$${grossProfit.toFixed(2)}`,      color:grossProfit>=0?'#16A34A':'#DC2626'},
    {lbl:'Total OPEX',         val:`$${totalOpex.toFixed(2)}`,        color:'#DC2626'},
    {lbl:'Operating Profit',   val:`$${operatingProfit.toFixed(2)}`,  color:operatingProfit>=0?'#16A34A':'#DC2626'},
    {lbl:'Operating Margin',   val:`${operatingMargin.toFixed(1)}%`,  color:operatingMargin>=15?'#16A34A':operatingMargin>=5?'#D97706':'#DC2626'},
  ]);

  pdfDisclaimer(pdf, y+10);
  return pdf;
};

const renderBASSummaryPDF = ({d, quarter, bizName, bizABN}) => {
  const pdf=new MiniPDF();
  const W=pdf.W, M=pdf.M;
  let y=pdfHeader(pdf, bizName||'BAS Support Summary', 'Quarterly BAS Management Summary', quarter);

  // Warnings
  if(d.warnings.length>0){
    y=pdfSecTitle(pdf, y, 'WARNINGS & MISSING RECORDS');
    d.warnings.forEach(w=>{ y=pdfWarn(pdf, y, w); });
    y+=4;
  }

  // Two-column: GST | Wages
  y=pdfTwoSec(pdf, y,
    { title:'GST CALCULATION',
      rows:[
        {lbl:'Total Sales (incl. GST)', val:`$${d.totalRev.toFixed(2)}`},
        {lbl:'GST on Sales (÷11)',      val:`$${d.gstColl.toFixed(2)}`},
        {lbl:'GST Credits on Purchases',val:`- $${d.gstCreds.toFixed(2)}`, color:'#16A34A'},
      ],
      total:{lbl:'Net GST Payable', val:`$${d.netGST.toFixed(2)}`, color:'#8FCB72'},
    },
    { title:'WAGES & PAYG',
      rows:[
        {lbl:'Total Gross Wages',          val:`$${d.totalWages.toFixed(2)}`},
        {lbl:'PAYG Withheld (ATO Scale 2)',val:`$${d.totalPayg.toFixed(2)}`},
        {lbl:'Super (SGC)',          val:`$${d.totalSuper.toFixed(2)}`},
      ],
      total:{lbl:'Total Employment Cost', val:`$${(d.totalWages+d.totalPayg+d.totalSuper).toFixed(2)}`, color:'#8FCB72'},
    }
  );
  y+=8;

  // BAS Estimate Summary
  y=pdfSecTitle(pdf, y, 'BAS ESTIMATE SUMMARY');
  y=pdfRow(pdf, y, 'Net GST Payable',        `$${d.netGST.toFixed(2)}`);
  y=pdfRow(pdf, y, 'PAYG Withholding',        `$${d.totalPayg.toFixed(2)}`);
  y=pdfRow(pdf, y, 'Est. Quarterly Insurance',`$${d.totalIns.toFixed(2)}`);
  y+=2;
  y=pdfTotRow(pdf, y, 'Estimated Total BAS Obligation', `$${d.estBAS.toFixed(2)}`);
  y+=8;

  // Supporting documents
  y=pdfSecTitle(pdf, y, `SUPPORTING DOCUMENTS — ${quarter}`);
  y=pdfStatCards(pdf, y, [
    {lbl:'Verified Documents',  val:d.verifiedDocs, color:'#16A34A'},
    {lbl:'Pending Review',      val:d.pendingDocs,  color:d.pendingDocs>0?'#D97706':'#16A34A'},
    {lbl:'Missing Documents',   val:d.missingDocs,  color:d.missingDocs>0?'#DC2626':'#16A34A'},
    {lbl:'Missing Tax Invoices',val:d.missingInv,   color:d.missingInv>0?'#DC2626':'#16A34A'},
  ]);

  pdfDisclaimer(pdf, y);
  return pdf;
};

const renderExpenseReportPDF = ({filtered, totalExp, gstCreds, missingCred, hasFilters}) => {
  const pdf=new MiniPDF();
  const W=pdf.W, M=pdf.M;
  let y=pdfHeader(pdf, 'Expense Report', hasFilters?'Filtered View — Expense Report':'All Expenses Report');

  // Summary stat cards
  y=pdfStatCards(pdf, y, [
    {lbl:'Total Expenses',          val:`$${totalExp.toFixed(2)}`},
    {lbl:'GST Credits (with inv.)', val:`$${gstCreds.toFixed(2)}`,   color:'#16A34A'},
    {lbl:'Missing Invoice Credits', val:`$${missingCred.toFixed(2)}`,color: missingCred>0?'#DC2626':'#111111'},
    {lbl:'Total Entries',           val:String(filtered.length)},
  ]);

  y=pdfSecTitle(pdf, y, 'EXPENSE DETAIL');
  const cols=[58,75,0,64,64,42];
  cols[2]=W-M*2-cols.filter((_,i)=>i!==2).reduce((s,c)=>s+c,0);
  y=pdfTable(pdf, y,
    ['Date','Category','Description','Amount','GST Credit','Invoice'],
    filtered.map(e=>[
      e.date, e.cat,
      e.desc.length>26?e.desc.slice(0,26)+'…':e.desc,
      `$${e.amount.toFixed(2)}`,
      e.gst?`$${expGST(e).toFixed(2)}`:'—',
      e.invoice?'Yes':{text:'No',color:'#DC2626'},
    ]),
    cols,
    { footerRow:['TOTAL','','',`$${totalExp.toFixed(2)}`,`$${gstCreds.toFixed(2)}`,''],
      numCols:[3,4] }
  );
  pdfDisclaimer(pdf, y);
  return pdf;
};

// ── Revenue Report PDF ────────────────────────────────────────────
// Generates a PDF for a date range showing daily sales with channel breakdown.
const renderRevenueReportPDF = ({filtered, totalAll, totalGST, fromDate, toDate, bizName, bizABN}) => {
  const pdf = new MiniPDF();
  const W   = pdf.W, M = pdf.M;
  const rangeLabel = (fromDate && toDate)
    ? `${fromDate} to ${toDate}`
    : (fromDate ? `From ${fromDate}` : (toDate ? `Until ${toDate}` : 'All-time'));
  let y = pdfHeader(pdf, bizName || 'Revenue Report', `Sales Summary — ${rangeLabel}`, bizABN || '');

  // ── Stat cards ──────────────────────────────────────────────────
  // Compute channel totals across the filtered range
  const channelTotals = {};
  filtered.forEach(r => {
    getChannels(r).forEach(c => {
      const amt = parseFloat(c.amount) || 0;
      channelTotals[c.name] = (channelTotals[c.name] || 0) + amt;
    });
  });
  const topChannels = Object.entries(channelTotals)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 3);
  const topLabel = topChannels.length === 0
    ? '—'
    : topChannels.map(([n, v]) => `${n}: $${v.toFixed(0)}`).join(' / ');

  y = pdfStatCards(pdf, y, [
    { lbl:'Total Sales',     val:`$${totalAll.toFixed(2)}` },
    { lbl:'GST Collected',   val:`$${totalGST.toFixed(2)}`, color:'#D97706' },
    { lbl:'Total Entries',   val:String(filtered.length) },
    { lbl:'Avg per Entry',   val: filtered.length > 0 ? `$${(totalAll/filtered.length).toFixed(2)}` : '—' },
  ]);

  // ── Top channels summary ──
  if (topChannels.length > 0) {
    y = pdfSecTitle(pdf, y, 'TOP CHANNELS');
    const chCols = [W * 0.5, W * 0.25, W * 0.25];
    chCols[0] = W - M*2 - chCols[1] - chCols[2];
    y = pdfTable(pdf, y,
      ['Channel', 'Total ($)', '% of Sales'],
      topChannels.map(([name, total]) => [
        name,
        `$${total.toFixed(2)}`,
        totalAll > 0 ? `${((total/totalAll)*100).toFixed(1)}%` : '—',
      ]),
      chCols,
      { numCols:[1,2] }
    );
  }

  // ── Daily detail ──
  y = pdfSecTitle(pdf, y, 'DAILY DETAIL');
  // Sort by date ascending so PDF reads naturally top-to-bottom (oldest → newest)
  const detailRows = filtered.slice().sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const cols = [70, 0, 70, 60];
  cols[1] = W - M*2 - cols[0] - cols[2] - cols[3];
  y = pdfTable(pdf, y,
    ['Date', 'Channels', 'Total', 'GST'],
    detailRows.map(r => {
      const chs   = getChannels(r);
      const total = revTotal(r);
      const gst   = revGSTTaxable(r) / 11;
      const summary = chs.length === 0
        ? '—'
        : chs.length <= 3
          ? chs.map(c => `${c.name}: $${(parseFloat(c.amount)||0).toFixed(0)}`).join(' / ')
          : chs.slice(0,2).map(c => `${c.name}: $${(parseFloat(c.amount)||0).toFixed(0)}`).join(' / ') + ` +${chs.length-2}`;
      return [
        r.date,
        summary.length > 50 ? summary.slice(0, 50) + '…' : summary,
        `$${total.toFixed(2)}`,
        gst > 0 ? `$${gst.toFixed(2)}` : '—',
      ];
    }),
    cols,
    { footerRow:['TOTAL', '', `$${totalAll.toFixed(2)}`, `$${totalGST.toFixed(2)}`],
      numCols:[2,3] }
  );

  pdfDisclaimer(pdf, y);
  return pdf;
};

const renderAccountantPackPDF = ({d, selFY, revenue, expenses, timesheets, employees, bizName, bizABN}) => {
  const pdf=new MiniPDF();
  const W=pdf.W, M=pdf.M;
  let y=pdfHeader(pdf, bizName||'Annual Accountant Pack', `Financial Year Summary — ${selFY}`, bizABN||'');

  if(d.warnings.length>0){
    d.warnings.forEach(w=>{ y=pdfWarn(pdf, y, w); });
    y+=4;
  }

  // ── P&L Summary ─────────────────────────────────────────
  const revExGST = d.totalRev - d.totalRev/11;
  const cogsPurch= d.totalExp > 0
    ? EXP_CATEGORIES.filter(c=>COGS_CATS.has(c)).reduce((s,c)=>s+d.bycat[c],0)
    : 0;
  const grossProfit  = revExGST - cogsPurch;
  const opex         = d.totalExp - cogsPurch;
  const operProfit   = grossProfit - opex - d.totalWages - d.totalSuper - d.totalIns;
  const grossMargin  = revExGST>0 ? (grossProfit/revExGST*100) : 0;

  y=pdfTwoSec(pdf, y,
    { title:'P&L SUMMARY',
      rows:[
        {lbl:'Total Revenue (incl. GST)',   val:`$${d.totalRev.toFixed(2)}`},
        {lbl:'GST Collected (1/11)',         val:`-$${(d.totalRev/11).toFixed(2)}`},
        {lbl:'Net Revenue (ex-GST)',         val:`$${revExGST.toFixed(2)}`, bold:true},
        {lbl:'COGS (food/packaging/delivery)',val:`-$${cogsPurch.toFixed(2)}`},
        {lbl:'Gross Profit',                 val:`$${grossProfit.toFixed(2)}`, bold:true},
        {lbl:'Gross Margin',                 val:`${grossMargin.toFixed(1)}%`, color:grossMargin>=50?'#16A34A':'#D97706'},
      ],
      total:{lbl:'Operating Profit (EBIT)', val:`$${operProfit.toFixed(2)}`, color:operProfit>=0?'#16A34A':'#DC2626'},
    },
    { title:'WAGES & OBLIGATIONS',
      rows:[
        {lbl:'Total Gross Wages',    val:`$${d.totalWages.toFixed(2)}`},
        {lbl:'Total PAYG Withheld',  val:`$${d.totalPayg.toFixed(2)}`},
        {lbl:'Total Super (SGC)',     val:`$${d.totalSuper.toFixed(2)}`},
        {lbl:'Annual Insurance',     val:`$${d.totalIns.toFixed(2)}`},
        {lbl:'Total Operating Exp',  val:`$${opex.toFixed(2)}`},
      ],
      total:{lbl:'Total Labour Cost', val:`$${(d.totalWages+d.totalSuper).toFixed(2)}`},
    }
  );
  y+=8;

  // ── Monthly Revenue Breakdown ─────────────────────────
  const fyDates = FY_DATES[selFY] || {};
  const months12 = Array.from({length:12},(_,i)=>{
    const base = new Date(fyDates.from||'2025-07-01');
    const d2   = new Date(base.getFullYear(), base.getMonth()+i, 1);
    const key  = `${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}`;
    const lbl  = d2.toLocaleString('en-AU',{month:'short',year:'2-digit'});
    const rev  = revenue.filter(r=>r.date.slice(0,7)===key).reduce((s,r)=>s+revTotal(r),0);
    const exp  = expenses.filter(e=>e.date.slice(0,7)===key).reduce((s,e)=>s+e.amount,0);
    const ts   = annotateTimesheets(employees,timesheets.filter(t=>weekToMonth(t.week)===key));
    const wg   = ts.reduce((s,t)=>s+t.gross,0);
    return {lbl, rev, exp, wg, net:rev-exp-wg};
  }).filter(m=>m.rev>0||m.exp>0||m.wg>0);

  if(months12.length>0){
    pdf.checkPage && (y=pdf.checkPage(y,60)||y);
    y=pdfSecTitle(pdf, y, 'MONTHLY BREAKDOWN');
    const mCols=[50,75,75,75,0];
    mCols[4]=W-M*2-mCols.slice(0,4).reduce((s,c)=>s+c,0);
    y=pdfTable(pdf, y,
      ['Month','Revenue','Expenses','Wages','Net'],
      months12.map(m=>[m.lbl,`$${m.rev.toFixed(0)}`,`$${m.exp.toFixed(0)}`,`$${m.wg.toFixed(0)}`,
        {text:`$${m.net.toFixed(0)}`,color:m.net>=0?'#16A34A':'#DC2626'}]),
      mCols,
      { rowH:16, footerRow:['TOTAL',
          `$${months12.reduce((s,m)=>s+m.rev,0).toFixed(0)}`,
          `$${months12.reduce((s,m)=>s+m.exp,0).toFixed(0)}`,
          `$${months12.reduce((s,m)=>s+m.wg,0).toFixed(0)}`,
          `$${months12.reduce((s,m)=>s+m.net,0).toFixed(0)}`],
        numCols:[1,2,3,4] }
    );
    y+=8;
  }

  // ── Revenue channel split (dynamic — aggregated by channel name) ────
  const channelAgg = new Map();
  revenue.forEach(r => {
    getChannels(r).forEach(c => {
      channelAgg.set(c.name, (channelAgg.get(c.name) || 0) + (c.amount || 0));
    });
  });
  const channelRows = [...channelAgg.entries()]
    .sort((a,b) => b[1] - a[1])
    .map(([name, amt]) => [
      pdfSafeName(name),
      `$${amt.toFixed(2)}`,
      `${d.totalRev > 0 ? (amt / d.totalRev * 100).toFixed(1) : 0}%`,
    ]);
  if (channelRows.length > 0) {
    y = pdfSecTitle(pdf, y, 'REVENUE BY CHANNEL');
    y = pdfTable(pdf, y,
      ['Channel','Amount (AUD)','% of Total'],
      channelRows,
      [W-M*2-180, 90, 90],
      { rowH:14, footerRow:['TOTAL', `$${d.totalRev.toFixed(2)}`, '100%'], numCols:[1,2] }
    );
    y += 8;
  }

  // ── Expenses by category ──────────────────────────────
  y=pdfSecTitle(pdf, y, 'EXPENSES BY CATEGORY');
  const catRows=EXP_CATEGORIES.filter(c=>d.bycat[c]>0).map(c=>{
    const cfg=CAT_CONFIG[c];
    const isCOGS=COGS_CATS.has(c);
    return [`${cfg?.label||c}${isCOGS?' (COGS)':''}`, `$${d.bycat[c].toFixed(2)}`];
  });
  y=pdfTable(pdf, y, ['Category','Amount (AUD)'], catRows, [W-M*2-90,90],
    { rowH:14, footerRow:['TOTAL',`$${d.totalExp.toFixed(2)}`], numCols:[1] }
  );

  pdfDisclaimer(pdf, y);
  return pdf;
};

const renderPayrollPDF = ({employees, allRows, selFY}) => {
  const pdf=new MiniPDF();
  const W=pdf.W, M=pdf.M;
  let y=pdfHeader(pdf, 'Payroll Summary', 'Wages & Super STP Support Pack', selFY);

  y=pdfSecTitle(pdf, y, 'EMPLOYEE PAYROLL SUMMARY');
  const cols=[110,80,65,55,55,55,55,0];
  cols[7]=W-M*2-cols.slice(0,7).reduce((s,c)=>s+c,0);
  const tableRows=employees.map(emp=>{
    const er=allRows.filter(t=>t.eid===emp.id);
    return [emp.name, emp.role, emp.type,
      `$${effRate(emp).toFixed(2)}/hr`,
      `$${er.reduce((s,t)=>s+t.gross,0).toFixed(2)}`,
      `$${er.reduce((s,t)=>s+t.payg,0).toFixed(2)}`,
      `$${er.reduce((s,t)=>s+t.super,0).toFixed(2)}`,
      emp.tfn?{text:'Yes',color:'#16A34A'}:{text:'Missing',color:'#DC2626'}];
  });
  const tGross=allRows.reduce((s,t)=>s+t.gross,0);
  const tPayg =allRows.reduce((s,t)=>s+t.payg,0);
  const tSuper=allRows.reduce((s,t)=>s+t.super,0);
  y=pdfTable(pdf, y,
    ['Name','Role','Type','Rate','Gross','PAYG','Super','TFN'],
    tableRows, cols,
    { footerRow:['TOTALS','','','',`$${tGross.toFixed(2)}`,`$${tPayg.toFixed(2)}`,`$${tSuper.toFixed(2)}`,''],
      numCols:[4,5,6] }
  );
  y+=8;

  // Summary totals
  y=pdfSecTitle(pdf, y, 'PAYROLL TOTALS');
  y=pdfTwoSec(pdf, y,
    { title:'GROSS & PAYG',
      rows:[
        {lbl:'Total Gross Wages',    val:`$${tGross.toFixed(2)}`},
        {lbl:'Total PAYG Withheld',  val:`$${tPayg.toFixed(2)}`},
      ],
      total:{lbl:'Total Net (take-home est.)', val:`$${(tGross-tPayg).toFixed(2)}`},
    },
    { title:'SUPER',
      rows:[
        {lbl:'Total Super Obligation (SGC)', val:`$${tSuper.toFixed(2)}`},
        {lbl:'Total Labour Cost',              val:`$${(tGross+tSuper).toFixed(2)}`},
      ],
      total:{lbl:'SGC Due This Quarter', val:`$${(tSuper/4).toFixed(2)}`},
    }
  );

  const noTFN=employees.filter(e=>!e.tfn);
  if(noTFN.length>0){
    y+=8;
    y=pdfSecTitle(pdf, y, 'TFN COMPLIANCE ISSUES');
    noTFN.forEach(e=>{ y=pdfWarn(pdf, y, `${e.name} (${e.role}) — TFN not on file. Must withhold PAYG at 47%.`); });
  }
  pdfDisclaimer(pdf, y);
  return pdf;
};

const renderDocRegisterPDF = ({documents, selFY}) => {
  const pdf=new MiniPDF();
  const W=pdf.W, M=pdf.M;
  let y=pdfHeader(pdf, 'Document Register', 'Supporting Records Register', selFY);

  y=pdfStatCards(pdf, y, [
    {lbl:'Total Documents', val:documents.length},
    {lbl:'Verified',        val:documents.filter(d=>d.status==='verified').length, color:'#16A34A'},
    {lbl:'Pending Review',  val:documents.filter(d=>d.status==='pending').length,  color:'#D97706'},
    {lbl:'Missing',         val:documents.filter(d=>d.status==='missing').length,  color:'#DC2626'},
  ]);

  y=pdfSecTitle(pdf, y, 'FULL DOCUMENT REGISTER');
  const cols=[0,70,65,55,50,50];
  cols[0]=W-M*2-cols.slice(1).reduce((s,c)=>s+c,0);
  y=pdfTable(pdf, y,
    ['Document Name','Category','Supplier','Quarter','FY','Status'],
    documents.map(d=>[
      d.name.length>30?d.name.slice(0,30)+'…':d.name,
      d.cat||'—', d.supplier||'—', d.quarter||'—', d.fy||'—',
      {text:(d.status||'').charAt(0).toUpperCase()+(d.status||'').slice(1),
       color:d.status==='verified'?'#16A34A':d.status==='missing'?'#DC2626':'#D97706'},
    ]),
    cols
  );
  pdfDisclaimer(pdf, y);
  return pdf;
};

const renderPayslipPDF = ({emp, rows, totals, payPeriodLabel, bizName, bizABN, showOTWknd=true}) => {
  const pdf=new MiniPDF();
  const W=pdf.W, M=pdf.M;

  // PDF period label — must be short and ASCII-only (MiniPDF strips non-ASCII)
  const safePeriodLabel = (() => {
    if (!payPeriodLabel) return '-';
    // Strip all non-ASCII chars first
    const ascii = payPeriodLabel.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
    // If short enough, use as-is
    if (ascii.length <= 36) return ascii;
    // Multiple weeks — show compact week range
    if (rows.length > 1) {
      const first = rows[rows.length-1]?.week || '';
      const last  = rows[0]?.week || '';
      return `${first} to ${last} (${rows.length} weeks)`;
    }
    // Single week — use the week string directly
    return rows[0]?.week || ascii.slice(0, 36);
  })();

  let y=pdfHeader(pdf, 'Employee Payslip', 'Payslip & Wage Summary', safePeriodLabel, bizName||'My Restaurant');

  // Employer ABN — Fair Work Act requires ABN on payslips (Fair Work Regulations r.3.47)
  if(bizABN) {
    pdf.text(W-M, 21, `ABN: ${bizABN}`, {size:7.5, color:'#6B7280', align:'right'});
  }

  // Employee info + period side-by-side
  const effR=effRate(emp);
  y=pdfTwoSec(pdf, y,
    { title:'EMPLOYEE DETAILS',
      rows:[
        {lbl:'Name',            val:emp.name},
        {lbl:'Role',            val:emp.role||'-'},
        {lbl:'Employment Type', val:emp.type?emp.type.charAt(0).toUpperCase()+emp.type.slice(1):'-'},
        {lbl:'Base Rate',       val:`$${parseFloat(emp.rate).toFixed(2)}/hr`},
        {lbl:'Effective Rate',  val:`$${effR.toFixed(2)}/hr`},
        {lbl:'Super Fund',      val:emp.superfund||'Not specified'},
        {lbl:'TFN Provided',    val:emp.tfn?'Yes':'No', color:emp.tfn?'#16A34A':'#DC2626'},
      ],
      total:null
    },
    { title:'PAY PERIOD',
      rows:[
        {lbl:'Period',            val:safePeriodLabel},
        {lbl:'Standard Hours',    val:`${totals.std_hrs}h`},
        ...(showOTWknd ? [{lbl:'Overtime Hours',   val:`${totals.ot_hrs}h`}]   : []),
        ...(showOTWknd ? [{lbl:'Weekend / PH Hrs', val:`${totals.wknd_hrs}h`}] : []),
        {lbl:'Total Hours',       val:`${(totals.std_hrs+totals.ot_hrs+totals.wknd_hrs)}h`, bold:true},
        {lbl:'Gross Pay',         val:`$${totals.gross.toFixed(2)}`, bold:true},
      ],
      total:null
    }
  );
  y+=4;

  // Hours breakdown table — only show OT/Wknd columns if any hours were actually logged AND showOTWknd is on
  y=pdfSecTitle(pdf, y, 'HOURS & EARNINGS BREAKDOWN');
  const hasOT   = showOTWknd && rows.some(r => r.ot_hrs   > 0);
  const hasWknd = showOTWknd && rows.some(r => r.wknd_hrs > 0);

  // Build headers and column widths dynamically
  const hdrs = ['Pay Week', 'Std Hrs'];
  if (hasOT)   hdrs.push('OT Hrs');
  if (hasWknd) hdrs.push('Wknd Hrs');
  hdrs.push('Std Pay');
  if (hasOT)   hdrs.push('OT Pay');
  if (hasWknd) hdrs.push('Wknd Pay');
  hdrs.push('Gross');

  // Fixed widths for each possible column
  const W_WEEK=100, W_HRS=50, W_PAY=72;
  const colsFixed = [W_WEEK, W_HRS];
  if (hasOT)   colsFixed.push(W_HRS);
  if (hasWknd) colsFixed.push(W_HRS);
  colsFixed.push(W_PAY);
  if (hasOT)   colsFixed.push(W_PAY);
  if (hasWknd) colsFixed.push(W_PAY);
  colsFixed.push(0); // Gross fills remainder
  colsFixed[colsFixed.length-1] = W-M*2 - colsFixed.slice(0,-1).reduce((s,c)=>s+c,0);

  const numColsIdx = [];
  hdrs.forEach((h,i) => { if(['Std Pay','OT Pay','Wknd Pay','Gross'].includes(h)) numColsIdx.push(i); });

  const footerRow = ['TOTAL', `${totals.std_hrs}h`];
  if (hasOT)   footerRow.push(`${totals.ot_hrs}h`);
  if (hasWknd) footerRow.push(`${totals.wknd_hrs}h`);
  footerRow.push('');
  if (hasOT)   footerRow.push('');
  if (hasWknd) footerRow.push('');
  footerRow.push(`$${totals.gross.toFixed(2)}`);

  y=pdfTable(pdf, y, hdrs,
    rows.map(r=>{
      const stdPay  = effR * r.std_hrs;
      const otPay   = r.ot_hrs   > 0 ? effR * OT_RATE   * r.ot_hrs   : 0;
      const wkndPay = r.wknd_hrs > 0 ? effR * WKND_RATE * r.wknd_hrs : 0;
      const row = [r.week, `${r.std_hrs}h`];
      if (hasOT)   row.push(`${r.ot_hrs}h`);
      if (hasWknd) row.push(`${r.wknd_hrs}h`);
      row.push(`$${stdPay.toFixed(2)}`);
      if (hasOT)   row.push(otPay   > 0 ? `$${otPay.toFixed(2)}`   : '-');
      if (hasWknd) row.push(wkndPay > 0 ? `$${wkndPay.toFixed(2)}` : '-');
      row.push(`$${r.gross.toFixed(2)}`);
      return row;
    }),
    colsFixed,
    { footerRow, numCols:numColsIdx }
  );
  y+=4;

  // Pay summary
  y=pdfSecTitle(pdf, y, 'PAY SUMMARY');
  y=pdfRow(pdf, y, 'Gross Pay', `$${totals.gross.toFixed(2)}`);
  y=pdfRow(pdf, y, `PAYG Withheld (ATO${emp.tfn?' Scale 2':' - no TFN 47%'})`, `- $${totals.payg.toFixed(2)}`, {valColor:'#DC2626'});
  y+=2;
  y=pdfTotRow(pdf, y, 'Net Pay (Take-Home)', `$${totals.net.toFixed(2)}`);
  y+=4;

  // Super info box — rate is period-aware (11.5% pre-Jul 2025, 12% from Jul 2025)
  const superRateDisplay = totals.superR ? `${(totals.superR*100).toFixed(1)}%` : `${(getSuperRate(todayWeekStr)*100).toFixed(1)}%`;
  pdf.rect(M, y, W-M*2, 40, {fill:'#EFF6FF', stroke:'#BFDBFE'});
  pdf.text(M+10, y+10, `Super (${superRateDisplay}): $${totals.super.toFixed(2)} to be paid to ${emp.superfund||'nominated fund'} with each pay run (Payday Super from 1 Jul 2026).`, {size:8.5, color:'#1D4ED8'});
  pdf.text(M+10, y+26, 'Late super attracts the SGC - not tax deductible. From Jul 2026, super must be paid each payday.', {size:8, color:'#3B82F6'});
  y+=48;

  if(!emp.tfn){
    y=pdfWarn(pdf, y, `No TFN on file - PAYG withheld at 47%. Ask ${emp.name} to provide their TFN.`);
  }

  pdfDisclaimer(pdf, y);
  return pdf;
};

const renderIASPDF = ({ d, month, bizName, bizABN, adjustment, status }) => {
  const pdf  = new MiniPDF();
  const W = pdf.W, M = pdf.M;
  const finalW1 = d.autoW1 + (adjustment?.adjustW1 || 0);
  const finalW2 = d.autoW2 + (adjustment?.adjustW2 || 0);
  const cfg     = IAS_STATUS_CFG[status] || IAS_STATUS_CFG.draft;

  let y = pdfHeader(pdf, 'Monthly IAS', 'PAYG Withholding — Instalment Activity Statement', fmtIASMonth(month), bizName || 'My Business');

  // Statement info box
  pdf.rect(M, y, W-M*2, 48, {fill:'#F9FAFB', stroke:'#E5E7EB'});
  const col2 = M + (W-M*2)/2 + 8;
  pdf.text(M+10, y+10, 'Business Name:', {size:8.5, color:'#6B7280'});
  pdf.text(M+10, y+22, bizName || 'My Business', {size:9.5, bold:true, color:'#111111'});
  pdf.text(M+10, y+35, `ABN: ${bizABN || 'Not provided'}`, {size:8.5, color:'#6B7280'});
  pdf.text(col2, y+10, 'Period:', {size:8.5, color:'#6B7280'});
  pdf.text(col2, y+22, fmtIASMonth(month), {size:9.5, bold:true, color:'#111111'});
  pdf.text(col2, y+35, `Due: ${d.dueDate}  |  Status: ${cfg.lbl}`, {size:8.5, color:cfg.col});
  y += 60;

  // ATO W fields — large display boxes
  y = pdfSecTitle(pdf, y, 'ATO PAYG WITHHOLDING FIELDS (IAS)');
  const boxW = (W - M*2 - 10) / 2;

  // W1 box
  pdf.rect(M,          y, boxW, 56, {fill:'#F0FDF4', stroke:'#BBF7D0'});
  pdf.text(M+10,       y+10, 'W1', {size:18, bold:true, color:'#16A34A'});
  pdf.text(M+10,       y+30, 'Total Gross Salaries & Wages', {size:8.5, color:'#374151'});
  pdf.text(M+boxW-10,  y+12, `$${finalW1.toFixed(2)}`, {size:16, bold:true, color:'#111111', align:'right'});
  if (adjustment?.adjustW1) {
    pdf.text(M+10, y+46, `Incl. $${adjustment.adjustW1.toFixed(2)} manual adjustment`, {size:7.5, color:'#16A34A'});
  }

  // W2 box
  pdf.rect(M+boxW+10,  y, boxW, 56, {fill:'#FFF7ED', stroke:'#FED7AA'});
  pdf.text(M+boxW+20,  y+10, 'W2', {size:18, bold:true, color:'#EA580C'});
  pdf.text(M+boxW+20,  y+30, 'PAYG Withheld from Wages', {size:8.5, color:'#374151'});
  pdf.text(M+boxW*2,   y+12, `$${finalW2.toFixed(2)}`, {size:16, bold:true, color:'#111111', align:'right'});
  if (adjustment?.adjustW2) {
    pdf.text(M+boxW+20, y+46, `Incl. $${adjustment.adjustW2.toFixed(2)} manual adjustment`, {size:7.5, color:'#EA580C'});
  }
  y += 68;

  // Net payable total box
  y = pdfTotRow(pdf, y, 'W2 — Net PAYG Payable to ATO this month', `$${finalW2.toFixed(2)}`, {valColor:'#EA580C'});
  y += 6;

  // Super info (informational, not an IAS W field)
  pdf.rect(M, y, W-M*2, 28, {fill:'#EFF6FF', stroke:'#BFDBFE'});
  pdf.text(M+10, y+10, `i  Employer super obligation (not IAS): $${d.autoSuper.toFixed(2)} — from 1 Jul 2026, must be paid each payday under Payday Super rules.`, {size:8.5, color:'#1D4ED8'});
  y += 40;

  // Per-employee breakdown
  y = pdfSecTitle(pdf, y, 'EMPLOYEE PAYG BREAKDOWN');
  const totalW = W - M*2;
  const cols   = [120, 55, 50, 0, 70, 70];
  cols[3]      = totalW - cols.slice(0,3).reduce((s,c)=>s+c,0) - cols[4] - cols[5];
  y = pdfTable(pdf, y,
    ['Employee', 'Role', 'Weeks', 'Type', 'W1 Gross', 'W2 PAYG'],
    d.empData.map(e => [
      e.emp.name,
      e.emp.role || '—',
      String(e.weeks),
      e.emp.type ? e.emp.type.charAt(0).toUpperCase()+e.emp.type.slice(1) : '—',
      `$${e.gross.toFixed(2)}`,
      e.noTFN
        ? {text:`$${e.payg.toFixed(2)} (47%)`, color:'#DC2626'}
        : `$${e.payg.toFixed(2)}`,
    ]),
    cols,
    { footerRow: ['TOTALS (auto)', '', '', '',
        `$${d.autoW1.toFixed(2)}`,
        `$${d.autoW2.toFixed(2)}`],
      numCols: [4, 5] }
  );

  // Manual adjustments
  if (adjustment && (adjustment.adjustW1 !== 0 || adjustment.adjustW2 !== 0 || adjustment.notes)) {
    y = pdfSecTitle(pdf, y, 'MANUAL ADJUSTMENTS');
    if (adjustment.adjustW1) y = pdfRow(pdf, y, 'Additional W1 Gross (manual)', `$${adjustment.adjustW1.toFixed(2)}`, {valColor:'#16A34A'});
    if (adjustment.adjustW2) y = pdfRow(pdf, y, 'Additional W2 PAYG (manual)',  `$${adjustment.adjustW2.toFixed(2)}`, {valColor:'#EA580C'});
    if (adjustment.notes)    y = pdfRow(pdf, y, 'Notes', adjustment.notes.slice(0,80));
    y += 4;
    y = pdfTotRow(pdf, y, 'Final W1 (Total Gross)', `$${finalW1.toFixed(2)}`, {valColor:'#16A34A'});
    y = pdfTotRow(pdf, y, 'Final W2 (PAYG Payable)', `$${finalW2.toFixed(2)}`, {valColor:'#EA580C'});
  }

  if (d.noTFNCount > 0) {
    y = pdfWarn(pdf, y, `${d.noTFNCount} employee(s) without TFN — PAYG withheld at 47% flat rate. Obtain TFN declarations ASAP.`);
  }

  pdfDisclaimer(pdf, y);
  return pdf;
};

const calcAge = dob => {
  if (!dob) return null;
  const b = new Date(dob), now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) a--;
  return a;
};

// Effective hourly rate
// Casual employees get +25% loading UNLESS rate_includes_loading is true (all-in rate already set)
const effRate = emp => {
  if (emp.type !== "casual") return emp.rate;
  return emp.rate_includes_loading ? emp.rate : emp.rate * (1 + CASUAL_LOADING);
};

// Helper: is this employee on fixed-weekly pay mode?
const isFixedPay = emp => emp && emp.pay_mode === "fixed" && parseFloat(emp.fixed_weekly_gross) > 0;

// Helper: does this employee have a manual PAYG override?
const hasPaygOverride = emp =>
  emp && emp.payg_override !== undefined && emp.payg_override !== "" && emp.payg_override !== null;

// Helper: does this employee have a manual super override?
const hasSuperOverride = emp =>
  emp && emp.super_override !== undefined && emp.super_override !== "" && emp.super_override !== null;

// Gross wages for a single timesheet row
// Fixed-pay employees get their fixed weekly gross regardless of hours worked.
const calcGross = (emp, ts) => {
  if (isFixedPay(emp)) return parseFloat(emp.fixed_weekly_gross) || 0;
  return effRate(emp) * ts.std_hrs
       + effRate(emp) * OT_RATE  * ts.ot_hrs
       + effRate(emp) * WKND_RATE * ts.wknd_hrs;
};

// Annotate timesheets with computed wages.
// IMPORTANT: This first augments the timesheet list with synthetic rows for
// fixed-pay employees so they appear paid every week even if the employer
// never opened a timesheet. Hourly employees are unaffected.
const annotateTimesheets = (employees, timesheets) => {
  const augmented = injectFixedEmployeeTimesheets(employees, timesheets);
  return augmented.map(ts => {
    const emp = employees.find(e => e.id === ts.eid);
    if (!emp) return null;
    const gross  = calcGross(emp, ts);
    const superR = getSuperRate(ts.week);

    // ── OTE (Ordinary Time Earnings) for SGC super ────────────
    // Per ATO SGAA s.6: OTE excludes overtime penalty payments.
    // For fixed-pay employees, OTE = full gross (no OT concept — it's a salary).
    let ote, superOTE;
    if (isFixedPay(emp)) {
      ote      = gross;
      superOTE = ote * superR;
    } else {
      // OT hours use ×1.5 rate — the ORDINARY component of OT is at base rate (×1.0)
      // Super is only owed on the base-rate component, not the 0.5x OT penalty loading
      // weekend/PH hours: rostered ordinary shifts for casuals, so base rate applies
      const oteEarnings = effRate(emp) * ts.std_hrs          // ordinary hours at base rate
                        + effRate(emp) * ts.wknd_hrs;        // weekend/PH = ordinary shift
      const oteOT       = effRate(emp) * ts.ot_hrs;           // base component of OT
      ote               = oteEarnings + oteOT;
      superOTE          = ote * superR;                       // SGC on OTE only
    }
    // ── No $450/month OTE minimum — threshold removed 1 Jul 2022 ──
    // Ref: ATO — Changes to super for low income employees (ato.gov.au/superchanges2022)

    // Apply super override if set (including 0 — "no super" for family employees)
    const super_ = hasSuperOverride(emp)
      ? (parseFloat(emp.super_override) || 0)
      : superOTE;

    // Apply PAYG override if set (including 0 — "no tax withheld")
    const payg = hasPaygOverride(emp)
      ? (parseFloat(emp.payg_override) || 0)
      : calcWeeklyPAYG(gross, emp.tfn);

    return { ...ts, emp, gross, super: super_, superOTE, superR, payg,
             ote, labour: gross + super_,
             total_hrs: ts.std_hrs + ts.ot_hrs + ts.wknd_hrs };
  }).filter(Boolean);
};

// ── Fixed-pay virtual timesheet injection ──────────────────────────
// Fixed-pay employees are paid a flat weekly gross regardless of hours.
// Their pay must appear in BAS, Wages, P&L, Cash Flow and IAS even if the
// employer never opens a timesheet. This injects one synthetic timesheet
// per (fixed-employee × ISO-week) covering the range of actual timesheet weeks.
//
// Rules:
//   - Only fires for employees where isFixedPay(emp) === true
//   - Start week = employee's start date; End week = latest of (today, latest real timesheet week)
//   - Skipped if exitDate is set and week > exit week (no pay after employment ends)
//   - Hours show as 0 so Leave accrual formulas correctly see "no ordinary hours"
//     (Fixed employees typically have track_leave=false too, but not required)
//   - If a real timesheet ALREADY exists for that (emp, week), we keep the real one and skip
//
// Date → ISO week string (YYYY-Www)
const dateToWeek = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  // ISO week: Thursday in current week decides the year.
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;     // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const weekNum = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay()+6)%7)) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2,'0')}`;
};

// Generate list of ISO week strings from startWeek to endWeek (inclusive)
const weeksBetween = (startWeek, endWeek) => {
  if (!startWeek || !endWeek) return [];
  if (startWeek > endWeek) return [];
  const weeks = [];
  let curDate = new Date(weekToDate(startWeek));
  const endDate = new Date(weekToDate(endWeek));
  let safety = 600; // Max ~11 years of weeks — plenty, prevents infinite loops
  while (curDate <= endDate && safety-- > 0) {
    const w = dateToWeek(curDate.toISOString().slice(0,10));
    if (w) weeks.push(w);
    curDate.setDate(curDate.getDate() + 7);
  }
  return weeks;
};

// Returns timesheets array augmented with synthetic rows for fixed-pay employees
const injectFixedEmployeeTimesheets = (employees, timesheets) => {
  const fixedEmps = employees.filter(isFixedPay);
  if (fixedEmps.length === 0) return timesheets;

  // Determine the week range we need to fill.
  // End = max of (today, latest timesheet week present).
  const todayWeek = dateToWeek(todayStr);
  const latestTsWeek = timesheets.reduce((m, t) =>
    (t.week && t.week > m) ? t.week : m, todayWeek || "2025-W01");
  const endWeek = latestTsWeek;

  const synthetic = [];
  let syntheticIdBase = 90000000; // high enough to not collide with real timesheet ids

  fixedEmps.forEach(emp => {
    const startWeek = emp.start ? dateToWeek(emp.start) : todayWeek;
    if (!startWeek) return;

    // If employee has exited, cap at exit week
    const capWeek = emp.exitDate ? dateToWeek(emp.exitDate) : null;
    const effectiveEndWeek = (capWeek && capWeek < endWeek) ? capWeek : endWeek;

    const allWeeks = weeksBetween(startWeek, effectiveEndWeek);
    // Find weeks where we already have a real timesheet for this employee
    const existingWeeks = new Set(
      timesheets.filter(t => t.eid === emp.id).map(t => t.week)
    );
    allWeeks.forEach(w => {
      if (existingWeeks.has(w)) return; // real timesheet wins
      synthetic.push({
        id: syntheticIdBase++,
        eid: emp.id,
        week: w,
        std_hrs: 0,
        ot_hrs: 0,
        wknd_hrs: 0,
        super_paid: false,
        _synthetic: true, // marker — UI / PDFs can show "Fixed pay" label
      });
    });
  });

  return [...timesheets, ...synthetic];
};

// ── Leave accrual — Fair Work Act compliant ────────────────
// Annual leave:   FT/PT — accrues at rate of 4 weeks per year of ordinary HOURS WORKED
//                = (hours_worked / std_annual_hours) * 152 hrs
//                Fair Work: s.87 — "4 weeks of paid annual leave"
// Personal leave: FT/PT — 10 days per year of ordinary hours worked
//                = (hours_worked / std_annual_hours) * 76 hrs
// Day in Lieu:    All — hour-for-hour from OT + weekend/PH hours actually worked
// Casual:         NOT entitled to annual or personal leave (s.87, s.96 Fair Work Act)
// Part-time:      Pro-rated — same formula, naturally scales with actual hours worked

function calcLeaveAccruals(emp, timesheets) {
  const empTs    = timesheets.filter(t => t.eid === emp.id);
  const isCasual = emp.type === "casual";

  // "Track leave" opt-out — family / owner-operator employees don't accrue leave.
  // We still let them record manual leave days in the Leave page if needed,
  // but automatic accrual is disabled.
  if (emp.track_leave === false) {
    return { annual:0, personal:0, lieu:0 };
  }

  if (isCasual) {
    // Casuals accrue no annual or personal leave
    const lieu = empTs.reduce((s,t) => s + (t.ot_hrs||0) + (t.wknd_hrs||0), 0);
    return { annual:0, personal:0, lieu };
  }

  // Sum actual ordinary hours worked from timesheets
  // Timesheets store std_hrs (ordinary hours for that week), ot_hrs, wknd_hrs
  // Ordinary hours = std_hrs from each timesheet row (this IS the actual ordinary hours worked)
  // ot_hrs and wknd_hrs are penalty-rate hours, NOT ordinary hours for leave purposes
  const ordinaryHrsWorked = empTs.reduce((s,t) => {
    const hrs = t.std_hrs != null
      ? t.std_hrs                              // use actual ordinary hours from timesheet
      : (emp.std_hrs || 38);                   // fallback to contracted weekly hours
    return s + hrs;
  }, 0);

  // Annual hours in a full year for this employee
  const stdAnnualHrs = (emp.std_hrs || 38) * 52;

  // Accrue proportionally to hours worked
  const annual   = (ordinaryHrsWorked / stdAnnualHrs) * 152;  // 4 weeks = 152 hrs/yr
  const personal = (ordinaryHrsWorked / stdAnnualHrs) * 76;   // 10 days = 76 hrs/yr

  // Day in Lieu: hour-for-hour from OT + weekend/PH
  const lieu = empTs.reduce((s,t) => s + (t.ot_hrs||0) + (t.wknd_hrs||0), 0);

  return { annual, personal, lieu };
}

// hrs per working day for this employee (std_hrs ÷ 5 days/week)
const hrsPerDay = emp => (emp.std_hrs || 38) / 5;

function calcLeaveTaken(emp, leaveRecords) {
  const el = leaveRecords.filter(l => l.eid === emp.id);
  return {
    annual:   el.filter(l => l.type==="annual").reduce((s,l) => s+l.hours, 0),
    personal: el.filter(l => l.type==="personal").reduce((s,l) => s+l.hours, 0),
    lieu:     el.filter(l => l.type==="lieu").reduce((s,l) => s+l.hours, 0),
  };
}

// Analyse expenses for Audit Ready
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
    // GST mismatch: category default says GST should apply but user marked none (or vice versa)
    const catGstExpected = CAT_GST_DEFAULT[e.cat];
    const gstMismatch = catGstExpected != null && catGstExpected !== e.gst && e.amount > GST_THRESHOLD;
    const entFlag = ent
      ? (e.amount >= 300
          ? { level:"red",    msg:"High-value entertainment — FBT may apply. Review with your accountant." }
          : { level:"yellow", msg:"Entertainment expenses have limited GST and income tax deductibility." })
      : null;
    return { ...e, gstStatus, suggestion, ent, entFlag, gstMismatch };
  });

// Avatar
const AVATAR_COLORS = ["#E05D44","#F0A500","#3B82F6","#10B981","#8B5CF6","#EC4899","#F97316","#06B6D4"];
const avatarBg = (id, color) => color || AVATAR_COLORS[(id - 1) % AVATAR_COLORS.length];

// Preset palette for employee color picker
const EMP_COLOR_PALETTE = [
  { col:"#E05D44", lbl:"Red"    },
  { col:"#F97316", lbl:"Orange" },
  { col:"#F0A500", lbl:"Amber"  },
  { col:"#10B981", lbl:"Green"  },
  { col:"#06B6D4", lbl:"Cyan"   },
  { col:"#3B82F6", lbl:"Blue"   },
  { col:"#6366F1", lbl:"Indigo" },
  { col:"#8B5CF6", lbl:"Purple" },
  { col:"#EC4899", lbl:"Pink"   },
  { col:"#64748B", lbl:"Slate"  },
  { col:"#0D9488", lbl:"Teal"   },
  { col:"#D97706", lbl:"Gold"   },
];
const initials  = name => name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

// ── Report data builders ──────────────────────────────────
// ── IAS month data builder ────────────────────────────────
// Uses ATO-correct calcWeeklyPAYG (not flat PAYG_RATE) since IAS is a formal ATO document
function buildIASMonthData(timesheets, employees, month) {
  const empData = employees.map(emp => {
    const empTs = timesheets.filter(ts => ts.eid === emp.id && weekToMonth(ts.week) === month);
    if (empTs.length === 0) return null;
    const gross  = empTs.reduce((s,ts) => s + calcGross(emp, ts), 0);
    const payg   = empTs.reduce((s,ts) => s + calcWeeklyPAYG(calcGross(emp, ts), emp.tfn), 0);
    const super_ = empTs.reduce((s,ts) => s + calcGross(emp, ts) * getSuperRate(ts.week), 0);
    return { emp, weeks: empTs.length, gross, payg, super: super_, noTFN: !emp.tfn };
  }).filter(Boolean);

  const autoW1    = empData.reduce((s,e) => s + e.gross, 0);
  const autoW2    = empData.reduce((s,e) => s + e.payg,  0);
  const autoSuper = empData.reduce((s,e) => s + e.super, 0);
  const weekCount = timesheets.filter(ts => weekToMonth(ts.week) === month).length;
  const noTFNCount = empData.filter(e => e.noTFN).length;

  // Due date = 28th of following month
  const [y,m] = month.split('-').map(Number);
  const dueDate = new Date(m === 12 ? y+1 : y, m === 12 ? 0 : m, 28)
    .toLocaleDateString('en-AU',{day:'2-digit',month:'long',year:'numeric'});

  return { empData, autoW1, autoW2, autoSuper, weekCount, noTFNCount, dueDate };
}

function buildBASData(revenue, expenses, timesheets, employees, insurance, docs, quarter, ias = []) {
  const ts   = annotateTimesheets(employees, timesheets);
  const qd   = QUARTER_DATES[quarter] || {};
  const { from="", to="9999-99-99" } = qd;

  const qRev = revenue.filter(r => inRange(r.date, from, to));
  const qExp = expenses.filter(e => inRange(e.date, from, to));
  const qTs  = ts.filter(t => { const d = weekToDate(t.week); return d && inRange(d, from, to); });

  const totalRev   = qRev.reduce((s,r) => s + revTotal(r), 0);
  const gstTaxable = qRev.reduce((s,r) => s + revGSTTaxable(r), 0);
  const gstColl    = gstTaxable / 11;
  const gstCreds   = qExp.filter(e => e.gst).reduce((s,e) => s + expGST(e), 0);
  const netGST     = gstColl - gstCreds;
  const totalWages = qTs.reduce((s,t) => s + t.gross,  0);
  const totalPayg  = qTs.reduce((s,t) => s + t.payg,   0);
  const totalSuper = qTs.reduce((s,t) => s + t.superOTE, 0); // OTE-based super
  const totalIns   = insurance.reduce((s,i) => s + i.annual/4, 0);
  const totalExp   = qExp.reduce((s,e) => s + e.amount, 0);
  const missingInv = qExp.filter(e => e.gst && !e.invoice && e.amount > GST_THRESHOLD).length;
  const missingDocs= docs.filter(d => d.status === "missing" && d.quarter === quarter).length;
  const pendingDocs= docs.filter(d => d.status === "pending" && d.quarter === quarter).length;
  const verifiedDocs=docs.filter(d => d.status === "verified" && d.quarter === quarter).length;

  // ── IAS bridge: subtract PAYG already lodged via Monthly IAS ──
  const qMonths = [];
  if (from) {
    const d = new Date(from); d.setDate(1);
    const end = new Date(to);
    while (d <= end) { qMonths.push(d.toISOString().slice(0,7)); d.setMonth(d.getMonth()+1); }
  }
  const iasPrePaidPAYG = ias
    .filter(r => qMonths.includes(r.month) && r.status === "lodged")
    .reduce((s,r) => s + (r.adjustW2 || 0), 0);
  const basPayg = Math.max(0, totalPayg - iasPrePaidPAYG);
  const estBAS  = netGST + basPayg;

  const warnings = [];
  if (missingInv > 0)   warnings.push(`${missingInv} expense${missingInv>1?"s":""} missing a tax invoice — GST credits may be reduced.`);
  if (missingDocs > 0)  warnings.push(`${missingDocs} document${missingDocs>1?"s":""} marked as missing for this quarter.`);
  if (pendingDocs > 0)  warnings.push(`${pendingDocs} document${pendingDocs>1?"s":""} awaiting review.`);
  if (qTs.filter(t=>!t.super_paid).length > 0) warnings.push("Some super contributions have not been marked as paid.");
  if (totalRev === 0)   warnings.push("No revenue has been entered for this period.");
  if (iasPrePaidPAYG > 0) warnings.push(`${money(iasPrePaidPAYG)} PAYG already lodged via Monthly IAS — deducted from BAS PAYG.`);

  return { totalRev, gstColl, gstCreds, netGST, totalWages, totalPayg, basPayg,
           iasPrePaidPAYG, totalSuper, totalIns, totalExp, missingInv, missingDocs,
           pendingDocs, verifiedDocs, estBAS, warnings, docCount: verifiedDocs, from, to };
}

function buildAnnualData(revenue, expenses, timesheets, employees, insurance, docs) {
  const ts       = annotateTimesheets(employees, timesheets);
  const totalRev = revenue.reduce((s,r) => s + revTotal(r), 0);
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
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: ${C.bg}; color: ${C.text}; font-family: 'DM Sans', sans-serif; min-height: 100vh; }
::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: ${C.bg}; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }

/* ── Layout ── */
.layout   { display: flex; min-height: 100vh; }
.sidebar  { width: 220px; background: ${C.surface}; border-right: 1px solid ${C.border}; display: flex; flex-direction: column; padding: 20px 12px; position: fixed; inset: 0 auto 0 0; overflow-y: auto; z-index: 50; }
.main     { margin-left: 220px; flex: 1; padding: 28px 32px; }

/* ── Sidebar ── */
.logo     { display: flex; align-items: center; gap: 9px; margin-bottom: 26px; padding: 0 6px; }
.logo-box { width: 32px; height: 32px; background: linear-gradient(135deg, ${C.accent}, ${C.teal}); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; color: #0C0F0D; flex-shrink: 0; }
.logo-name { font-size: 14px; font-weight: 700; }
.logo-sub  { font-size: 9.5px; color: ${C.muted}; }
.nav-sec  { font-size: 9.5px; font-weight: 700; color: ${C.dim}; text-transform: uppercase; letter-spacing: 1.2px; padding: 0 8px; margin: 12px 0 4px; }
.nav-item { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 7px; cursor: pointer; font-size: 12.5px; font-weight: 500; color: ${C.muted}; margin-bottom: 1px; transition: all .15s; border: 1px solid transparent; }
.nav-item:hover { background: ${C.surfaceAlt}; color: ${C.text}; }
.nav-item.on-a  { background: rgba(143,203,114,.12); color: ${C.accent}; border-color: rgba(143,203,114,.2); }
.nav-item.on-t  { background: rgba(57,211,187,.10); color: ${C.teal};   border-color: rgba(57,211,187,.2); }
.nav-ico  { font-size: 14px; width: 17px; text-align: center; flex-shrink: 0; }
.nav-badge { margin-left: auto; background: rgba(57,211,187,.15); color: ${C.teal}; border-radius: 20px; padding: 1px 6px; font-size: 9px; font-weight: 700; }
.sidebar-footer { margin-top: auto; padding-top: 12px; }
.plan-box   { background: ${C.surfaceAlt}; border: 1px solid ${C.border}; border-radius: 10px; padding: 11px; }
.plan-tier  { font-size: 11px; font-weight: 700; color: ${C.accent}; margin-bottom: 3px; }
.plan-desc  { font-size: 10.5px; color: ${C.muted}; line-height: 1.5; }
.plan-btn   { display: block; width: 100%; margin-top: 9px; padding: 6px; background: linear-gradient(135deg, ${C.accent}, ${C.teal}); color: #0C0F0D; border: none; border-radius: 6px; font-size: 10.5px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; text-align: center; }

/* ── Header ── */
.hdr      { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; }
.hdr-left .ptitle { font-size: 21px; font-weight: 700; letter-spacing: -.5px; }
.hdr-left .psub   { font-size: 12.5px; color: ${C.muted}; margin-top: 2px; }
.hdr-right { display: flex; align-items: center; gap: 9px; }
.chip  { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 20px; padding: 5px 13px; font-size: 11.5px; color: ${C.muted}; }
.av    { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, ${C.accent}, ${C.teal}); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #0C0F0D; flex-shrink: 0; }

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

/* ── Mobile responsive ── */
.btab { display: none; }
@media (max-width: 720px) {
  .sidebar { display: none; }
  .main    { margin-left: 0; padding: 14px 12px 80px; }
  .g2, .g3, .g4 { grid-template-columns: repeat(2, 1fr); gap: 9px; }
  .hdr-left .ptitle { font-size: 16px; }
  .hdr { margin-bottom: 14px; }
  /* Compress large banners on mobile */
  .mob-compress { flex-direction: column !important; gap: 8px !important; padding: 14px 14px !important; }
  .mob-compress .mono { font-size: 26px !important; }
  .mob-hide { display: none !important; }
  .mob-full { width: 100% !important; flex: 1 1 100% !important; }
  /* iOS keyboard safe area — prevents keyboard covering form buttons */
  .fsec, .bc { padding-bottom: max(16px, env(safe-area-inset-bottom)); }
  .fbtns { padding-top: 10px; padding-bottom: max(10px, env(safe-area-inset-bottom)); }
  /* Bottom tab bar */
  .btab {
    display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
    background: ${C.surface}; border-top: 1px solid ${C.border};
    padding: 6px 0 max(6px, env(safe-area-inset-bottom));
    box-shadow: 0 -4px 16px rgba(0,0,0,.12);
  }
  .btab-item {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    gap: 2px; padding: 4px 0; cursor: pointer; border: none; background: none;
    font-family: inherit;
  }
  .btab-ico  { font-size: 20px; line-height: 1; }
  .btab-lbl  { font-size: 9px; font-weight: 600; color: ${C.muted}; text-transform: uppercase; letter-spacing: .4px; }
  .btab-item.on .btab-lbl  { color: ${C.accent}; }
}

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
.inp   { background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 7px; padding: 8px 11px; color: ${C.text}; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; width: 100%; transition: border-color .15s; }
.inp:focus { border-color: ${C.accent}; }
.inp::placeholder { color: ${C.dim}; }
.inp:disabled, .sel:disabled { opacity: .55; cursor: not-allowed; background: ${C.surface}; }
.sel   { background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 7px; padding: 8px 11px; color: ${C.text}; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; width: 100%; cursor: pointer; }
.fbtns { display: flex; gap: 9px; margin-top: 14px; align-items: center; }

/* ── Buttons ── */
.btn    { background: linear-gradient(135deg, ${C.accent}, ${C.teal}); color: #fff; border: none; border-radius: 8px; padding: 8px 17px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: opacity .15s; white-space: nowrap; }
.btn:hover { opacity: .87; }
.btn-g  { background: transparent; border: 1px solid ${C.border}; border-radius: 8px; padding: 8px 17px; color: ${C.muted}; font-size: 12.5px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; }
.btn-g:hover { border-color: ${C.muted}; color: ${C.text}; }
.btn-t  { background: rgba(57,211,187,.1); border: 1px solid rgba(57,211,187,.25); color: ${C.teal}; border-radius: 7px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
.btn-b  { background: rgba(56,139,253,.12); border: 1px solid rgba(56,139,253,.25); color: ${C.blue}; border-radius: 7px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
.btn-r  { background: rgba(248,81,73,.12); color: ${C.red}; border: none; border-radius: 7px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'DM Sans', sans-serif; }
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
.reserve { background: linear-gradient(135deg, rgba(143,203,114,.08), rgba(61,201,160,.03)); border: 1px solid rgba(143,203,114,.2); border-radius: 13px; padding: 20px; margin-bottom: 16px; }
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
.ts-panel { background: linear-gradient(135deg, rgba(57,211,187,.06), rgba(143,203,114,.03)); border: 1px solid rgba(57,211,187,.2); border-radius: 13px; padding: 20px; margin-bottom: 16px; }
.ts-sgrid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-top: 13px; }
.ts-sval  { font-size: 20px; font-weight: 700; font-family: 'DM Mono', monospace; }
.ts-slbl  { font-size: 10px; color: ${C.muted}; margin-top: 3px; }

/* ── Toast ── */
.toast { position: fixed; bottom: 18px; right: 18px; background: ${C.surfaceAlt}; border: 1px solid ${C.border}; border-radius: 11px; padding: 11px 16px; font-size: 12.5px; font-weight: 500; box-shadow: 0 8px 28px rgba(0,0,0,.4); z-index: 999; display: flex; align-items: center; gap: 8px; animation: up .25s ease; }
@keyframes up { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

/* ── Landing ── */
.land    { min-height: 100vh; background: ${C.bg}; }
.lnav    { display: flex; align-items: center; justify-content: space-between; padding: 17px 40px; border-bottom: 1px solid ${C.border}; }
.hero    { text-align: center; padding: 80px 40px 36px; max-width: 760px; margin: 0 auto; }
.h-badge { display: inline-block; background: rgba(143,203,114,.12); border: 1px solid rgba(143,203,114,.3); border-radius: 20px; padding: 5px 13px; font-size: 11.5px; font-weight: 600; color: ${C.accent}; margin-bottom: 20px; }
.h-ttl   { font-size: 48px; font-weight: 700; letter-spacing: -2px; line-height: 1.08; margin-bottom: 18px; font-family: 'Fraunces', serif; }
.h-ttl span { background: linear-gradient(135deg, ${C.accent}, ${C.teal}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-style: italic; }
.h-sub   { font-size: 15.5px; color: ${C.muted}; line-height: 1.7; margin-bottom: 28px; }
.h-btns  { display: flex; align-items: center; justify-content: center; gap: 10px; }
.h-btn   { background: linear-gradient(135deg, ${C.accent}, ${C.teal}); color: #0C0F0D; border: none; border-radius: 11px; padding: 12px 28px; font-size: 14.5px; font-weight: 700; cursor: pointer; font-family: 'DM Sans', sans-serif; }
.h-btn-g { background: transparent; color: ${C.text}; border: 1px solid ${C.border}; border-radius: 11px; padding: 12px 22px; font-size: 14.5px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; }
.feat-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; padding: 0 40px 28px; max-width: 1080px; margin: 0 auto; }
.feat-card { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 14px; padding: 18px; }
.feat-ico  { font-size: 22px; margin-bottom: 10px; }
.feat-ttl  { font-size: 13.5px; font-weight: 600; margin-bottom: 5px; }
.feat-dsc  { font-size: 12px; color: ${C.muted}; line-height: 1.6; }
.price-sec { padding: 48px 40px; text-align: center; max-width: 860px; margin: 0 auto; }
.price-lbl { font-size: 10.5px; font-weight: 700; color: ${C.accent}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
.price-ttl { font-size: 26px; font-weight: 700; letter-spacing: -1px; margin-bottom: 28px; font-family: 'Fraunces', serif; }
.price-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
.price-card { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 14px; padding: 22px; text-align: left; }
.price-card.hi { border-color: ${C.accent}; background: rgba(143,203,114,.05); }
.p-tier { font-size: 10px; font-weight: 700; color: ${C.muted}; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 7px; }
.p-amt  { font-size: 28px; font-weight: 700; font-family: 'DM Mono', monospace; }
.p-per  { font-size: 11.5px; color: ${C.muted}; }
.p-list { list-style: none; margin-top: 14px; display: flex; flex-direction: column; gap: 6px; }
.p-list li { font-size: 11.5px; color: ${C.muted}; display: flex; gap: 6px; }
.p-list li::before { content: '✓'; color: ${C.green}; font-weight: 700; }

/* ── Landing v2: warm glow + dashboard preview + lang toggle ── */
.hero-wrap { position: relative; overflow: hidden; }
.hero-glow {
  position: absolute; top: -180px; left: 50%; transform: translateX(-50%);
  width: 900px; height: 520px; pointer-events: none; z-index: 0;
  background: radial-gradient(ellipse at center,
    rgba(212,168,67,.10) 0%, rgba(143,203,114,.07) 38%, transparent 70%);
  filter: blur(8px);
}
.lang-btn {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer;
  padding: 7px 13px; border-radius: 8px;
  background: ${C.surfaceAlt}; border: 1px solid ${C.border}; color: ${C.text};
  transition: border-color .15s;
}
.lang-btn:hover { border-color: ${C.accent}; }
/* Fake dashboard preview */
.dash-preview {
  max-width: 720px; margin: 36px auto 0; position: relative; z-index: 1;
  background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 16px;
  box-shadow: 0 24px 60px -20px rgba(0,0,0,.55), 0 0 0 1px rgba(143,203,114,.06);
  overflow: hidden; text-align: left;
}
.dp-bar { display: flex; align-items: center; gap: 7px; padding: 11px 15px; border-bottom: 1px solid ${C.border}; background: ${C.surfaceAlt}; }
.dp-dot { width: 10px; height: 10px; border-radius: 50%; }
.dp-body { padding: 18px; }
.dp-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 11px; margin-bottom: 13px; }
.dp-card { background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 11px; padding: 13px 15px; }
.dp-lbl { font-size: 9px; color: ${C.muted}; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 6px; }
.dp-val { font-size: 18px; font-weight: 800; font-family: 'DM Mono', monospace; letter-spacing: -.5px; }
.dp-bars { display: flex; align-items: flex-end; gap: 5px; height: 60px; padding: 12px 15px; background: ${C.bg}; border: 1px solid ${C.border}; border-radius: 11px; }
.dp-bars > div { flex: 1; border-radius: 3px 3px 0 0; }
@media (max-width: 560px) {
  .h-ttl { font-size: 34px; }
  .dp-row { grid-template-columns: 1fr 1fr; }
}

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
.drop-zone:hover, .drop-zone.drag { border-color: ${C.accent}; background: rgba(143,203,114,.04); }
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
.print-preview { background: #fff; color: #111; font-family: 'DM Sans',sans-serif; padding: 0; }
.pp-page   { width: 100%; max-width: 780px; margin: 0 auto; padding: 32px 36px; }
.pp-hdr    { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 26px; padding-bottom: 16px; border-bottom: 2px solid #E5E7EB; }
.pp-logo   { display: flex; align-items: center; gap: 10px; }
.pp-logo-box { width: 36px; height: 36px; background: #8FCB72; border-radius: 8px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:700; font-size:16px; }
.pp-title  { font-size: 11px; color: #6B7280; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; }
.pp-name   { font-size: 18px; font-weight: 700; letter-spacing: -.3px; margin-top: 3px; }
.pp-meta   { text-align: right; font-size: 11px; color: #6B7280; line-height: 1.8; }
.pp-sec    { margin-bottom: 22px; }
.pp-sec-ttl { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #E5E7EB; }
.pp-row    { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #F3F4F6; font-size: 13px; }
.pp-row:last-child { border-bottom: none; }
.pp-box    { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 14px 16px; }
.pp-lbl    { color: #374151; }
.pp-val    { font-family: 'DM Mono',monospace; font-weight: 600; color: #111; }
.pp-tot    { display: flex; justify-content: space-between; padding: 11px 13px; background: #F9FAFB; border-radius: 8px; margin-top: 8px; font-weight: 700; }
.pp-tot-v  { font-family: 'DM Mono',monospace; font-size: 17px; color: #8FCB72; }
.pp-warn   { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 10px 13px; font-size: 12px; color: #92400E; margin-bottom: 8px; }
.pp-tbl    { width: 100%; border-collapse: collapse; font-size: 12px; }
.pp-tbl th { background: #F3F4F6; padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #6B7280; }
.pp-tbl td { padding: 8px 10px; border-bottom: 1px solid #F3F4F6; }
.pp-tbl tr:last-child td { border-bottom: none; }
.pp-tbl tfoot td { font-weight: 700; border-top: 2px solid #E5E7EB; border-bottom: none; }
.pp-disc   { background: #F9FAFB; border: 1px solid #E5E7EB; border-left: 3px solid #8FCB72; border-radius: 8px; padding: 12px 14px; margin-top: 22px; font-size: 11px; color: #6B7280; line-height: 1.7; }
.pp-quarter-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; }
.pp-q-card { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 13px; }
.pp-q-lbl  { font-size: 10px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; margin-bottom: 6px; }
.pp-q-val  { font-family: 'DM Mono',monospace; font-size: 16px; font-weight: 700; }
.pp-badge  { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 20px; font-size: 10.5px; font-weight: 600; }
.pp-b-g  { background: #D1FAE5; color: #065F46; }
.pp-b-y  { background: #FEF3C7; color: #92400E; }
.pp-b-r  { background: #FEE2E2; color: #991B1B; }
.pp-modal { position: fixed; inset: 0; background: rgba(0,0,0,.75); z-index: 300; overflow-y: auto; }
.pp-close  { position: fixed; top: 16px; right: 16px; background: #fff; border: 1px solid #E5E7EB; border-radius: 8px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'DM Sans',sans-serif; z-index: 301; display: flex; gap: 6px; align-items: center; }
.pp-print  { position: fixed; top: 16px; right: 120px; background: #8FCB72; color: #fff; border: none; border-radius: 8px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'DM Sans',sans-serif; z-index: 301; }
@keyframes spin { to { transform: rotate(360deg); } }

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
  // ── Bilingual content (EN / 中文) ──
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("mise_lang") || "en"; } catch { return "en"; }
  });
  const toggleLang = () => {
    const next = lang === "en" ? "zh" : "en";
    setLang(next);
    try { localStorage.setItem("mise_lang", next); } catch {}
  };
  const zh = lang === "zh";

  const t = {
    login:      zh ? "登录" : "Log In",
    getStarted: zh ? "免费开始" : "Get Started Free",
    badge:      zh ? "🇦🇺 为澳洲餐厅、咖啡馆和酒吧打造" : "🇦🇺 Built for Australian Restaurants, Cafés & Bars",
    heroA:      zh ? "你管前厅，" : "Run your floor.",
    heroB:      zh ? "记账交给我们。" : "We'll run the books.",
    heroSub:    zh
      ? "排班、记录营业额、看懂盈亏、放心报 BAS。Mise 是唯一按餐饮业真实运作方式设计的财务工具 —— 而不是按会计师的想象。"
      : "Roster your staff. Track your takings. Know your P&L. Lodge your BAS with confidence. Mise is the only finance tool built around how hospitality actually works — not how accountants think it should.",
    ctaStart:   zh ? "免费开始 →" : "Start for Free →",
    ctaDemo:    zh ? "看演示" : "See a Demo",
    stats: zh
      ? [{ val:"5 分钟", lbl:"完成设置" },{ val:"$0", lbl:"开始使用" },{ val:"一键", lbl:"BAS 汇总" },{ val:"随时", lbl:"符合 ATO" }]
      : [{ val:"5 min", lbl:"to set up" },{ val:"$0", lbl:"to start" },{ val:"1 click", lbl:"BAS summary" },{ val:"ATO-ready", lbl:"at all times" }],
    pills: zh
      ? ["🍽️ 餐厅","☕ 咖啡馆","🍺 酒吧","🥡 外卖店","🍕 餐车","🏪 食品零售"]
      : ["🍽️ Restaurants","☕ Cafés","🍺 Bars & Pubs","🥡 Takeaways","🍕 Food Trucks","🏪 Food Retail"],
    featLbl:    zh ? "Mise 能做什么" : "What Mise Does",
    featTtl:    zh ? "餐饮老板真正需要的，全都有。" : "Everything a hospitality owner actually needs.",
    whyLbl:     zh ? "为什么选 Mise" : "Why Mise",
    whyTtl:     zh ? "为站在传菜口后面的人而造。" : "Built for the person behind the pass.",
    whySub:     zh
      ? "Xero 是给会计师的。Mise 是给那个周四营业前、半夜还在算工资的老板的。"
      : "Xero is great for accountants. Mise is for the owner doing payroll at midnight before a Thursday service.",
    priceLbl:   zh ? "简单定价" : "Simple Pricing",
    priceTtl:   zh ? "没有意外。就像你的 BAS 该有的样子。" : "No surprises. Just like your BAS should be.",
    perMonth:   zh ? "/月" : "/month",
    chooseStart:zh ? "免费开始" : "Get Started Free",
    choose:     (tier) => zh ? `选择 ${tier}` : `Choose ${tier}`,
    disclaimer: zh
      ? "⚠️ Mise 仅生成管理汇总，不能替代注册税务代理或会计师。"
      : "⚠️ Mise generates management summaries only. Not a substitute for a registered tax agent or accountant.",
    dpTitle:    zh ? "概览 · 本月" : "Dashboard · This Month",
    dpRevenue:  zh ? "本月营业额" : "Monthly Revenue",
    dpExpenses: zh ? "本月支出" : "Monthly Expenses",
    dpTax:      zh ? "预估季度税" : "Est. Quarterly Tax",
    dpHealth:   zh ? "✅ 经营健康：稳健" : "✅ Business Health: Safe",
  };

  const features = zh ? [
    { ico:"📅", ttl:"排班与人力成本", dsc:"几分钟排好周班表。发布前就看到总人力成本、每位员工工资和加班提示 —— 发薪时没有意外。" },
    { ico:"💵", ttl:"按渠道记营业额", dsc:"堂食、外卖、配送分开记录。每个渠道的 GST 自动正确计算 —— 配送平台自动排除。" },
    { ico:"📊", ttl:"损益表", dsc:"真实的毛利、成本和息税前利润 —— 不只是收入减支出。按季度或财年看你的实际利润率。" },
    { ico:"💸", ttl:"现金流视图", dsc:"每日进账、出账和预估工资一起显示。发薪日前就知道这周会不会紧张。" },
    { ico:"🏛️", ttl:"实时 ATO 税负", dsc:"实时看到你现在欠 ATO 多少 GST + PAYG —— 随你录入营业额每日更新，不用等季末。" },
    { ico:"🧾", ttl:"支出管理", dsc:"分类每一笔成本，自动标记缺失发票，BAS 时不漏任何 GST 抵扣。常用支出自动记住。" },
    { ico:"👤", ttl:"工资单与工时", dsc:"一键生成合规工资单。临时工津贴、加班、周末费率、PAYG 和养老金全部按 ATO 标准计算。" },
    { ico:"📥", ttl:"POS CSV 导入", dsc:"从 Square、Lightspeed、Kounta 或任何 POS 导出。Mise 自动映射列 —— 30 秒导入一个月数据。" },
    { ico:"📋", ttl:"BAS 汇总", dsc:"季度 BAS 数字精确筛选到 ATO 日期范围。见税务代理前先审一遍 —— 不再临时手忙脚乱对账。" },
    { ico:"🔔", ttl:"提醒", dsc:"BAS 截止、未付养老金、即将到期的保险、未结清的离职 —— 全在一处，不让任何事漏掉。" },
    { ico:"🔍", ttl:"审计就绪", dsc:"在 ATO 之前先扫描你的记录，找出缺失发票、娱乐支出和养老金缺口。19 类抵扣清单。" },
    { ico:"📦", ttl:"会计师资料包", dsc:"一键 PDF：损益表、月营业额明细、渠道拆分、按类别支出和成本标注 —— 直接交给会计师。" },
  ] : [
    { ico:"📅", ttl:"Roster & Labour Cost",  dsc:"Build your weekly roster in minutes. See total labour cost, per-employee wages and OT flags before you publish — no surprises at payrun." },
    { ico:"💵", ttl:"Revenue by Channel",    dsc:"Log dine-in, takeaway and delivery separately. GST calculated correctly for each — delivery platforms excluded automatically." },
    { ico:"📊", ttl:"P&L Statement",         dsc:"Real gross profit, COGS and EBIT — not just revenue minus expenses. See your actual margin by quarter or financial year." },
    { ico:"💸", ttl:"Cash Flow View",        dsc:"Daily money-in, money-out, and estimated wages shown together. Know before payday if the week is going to be tight." },
    { ico:"🏛️", ttl:"Live ATO Liability",    dsc:"See exactly how much GST + PAYG you owe the ATO right now — updated daily as you enter revenue, not just at quarter end." },
    { ico:"🧾", ttl:"Expense Management",    dsc:"Categorise every cost, flag missing invoices automatically, and never lose a GST credit at BAS time. Recurring expenses remembered." },
    { ico:"👤", ttl:"Payslips & Timesheets", dsc:"Generate compliant payslips with one click. Casual loading, OT, weekend rates, PAYG and super all calculated to ATO spec." },
    { ico:"📥", ttl:"POS CSV Import",        dsc:"Export from Square, Lightspeed, Kounta or any POS. Mise maps your columns automatically — import a month of data in 30 seconds." },
    { ico:"📋", ttl:"BAS Summary",           dsc:"Quarterly BAS figures filtered to the exact ATO date range. Review before you meet your tax agent — no more rushed reconciliation." },
    { ico:"🔔", ttl:"Reminders",             dsc:"BAS deadlines, unpaid super, expiring insurance, unsettled staff exits — all in one place so nothing falls through the cracks." },
    { ico:"🔍", ttl:"Audit Ready",           dsc:"Scans your records for missing invoices, entertainment expenses and super gaps before the ATO does. 19-category deduction checklist." },
    { ico:"📦", ttl:"Accountant Pack",       dsc:"One-click PDF with P&L, monthly revenue breakdown, channel split, expenses by category and COGS labelled — ready to hand to your accountant." },
  ];

  const whys = zh ? [
    { ico:"⚡", ttl:"5 分钟上手", dsc:"没有会计科目表，没有银行对账设置。打开它，录入营业额，就完成了。" },
    { ico:"🇦🇺", ttl:"内置澳洲税法", dsc:"GST 渠道、PAYG Scale 2、养老金费率、ATO 季度日期和 BAS 结构 —— 开箱即正确。" },
    { ico:"📅", ttl:"排班到工资单一站搞定", dsc:"排班、确认工时、生成工资单、导出养老金义务 —— 无需切换工具。" },
    { ico:"📊", ttl:"你的损益，不只是 GST", dsc:"了解毛利率、成本和息税前利润 —— 会计师评估业务健康用的数字。" },
    { ico:"🔔", ttl:"没有遗漏", dsc:"BAS 截止、养老金、保险续期、未结离职的提醒 —— 在它们变成问题前就提醒。" },
    { ico:"💰", ttl:"只需记账员的零头", dsc:"Mise 免费起步。Pro 每月比一小时记账费还低 —— 而且你始终掌控。" },
  ] : [
    { ico:"⚡", ttl:"Up in 5 minutes",           dsc:"No chart of accounts. No bank reconciliation setup. Open it, enter your takings, and you're done." },
    { ico:"🇦🇺", ttl:"Australian tax law built in",dsc:"GST channels, PAYG Scale 2, SGC super rates, ATO quarter dates and BAS structure — all correct out of the box." },
    { ico:"📅", ttl:"Roster → payslip in one app", dsc:"Roster your staff, confirm hours, generate payslips and export super obligations — without switching tools." },
    { ico:"📊", ttl:"Your P&L, not just your GST", dsc:"Know your gross margin, COGS and EBIT — the numbers your accountant uses to assess business health." },
    { ico:"🔔", ttl:"Nothing slips through",      dsc:"Reminders for BAS deadlines, super payments, insurance renewals and unsettled staff exits — before they become problems." },
    { ico:"💰", ttl:"A fraction of a bookkeeper", dsc:"Mise starts free. Pro is less per month than one hour of bookkeeping time — and you stay in control." },
  ];

  const plans = zh ? [
    { tier:"Starter", price:"$0",  hi:false, feats:["营业额追踪（渠道 + CSV 导入）","支出管理 + 自动分类","基础 BAS 预估","最多 3 名员工档案","损益表","所有业务类型"] },
    { tier:"Pro",     price:"$29", hi:true,  feats:["包含 Starter 全部","无限员工 + 工时","排班含人力成本视图","工资单 + 批量 ZIP 导出","实时 ATO 税负看板","现金流视图","提醒与警示","保险看板","审计就绪扫描","文档中心"] },
    { tier:"Studio",  price:"$79", hi:false, feats:["包含 Pro 全部","会计师资料包 PDF","BAS 历史 + 报税流程","月度 IAS","年度损益导出","优先支持"] },
  ] : [
    { tier:"Starter", price:"$0",  hi:false, feats:["Revenue tracking (channels + CSV import)","Expense management + auto-categorisation","Basic BAS estimate","Up to 3 staff profiles","P&L Statement","All business types"] },
    { tier:"Pro",     price:"$29", hi:true,  feats:["Everything in Starter","Unlimited staff + timesheets","Roster with labour cost view","Payslips + batch ZIP export","Live ATO liability dashboard","Cash Flow view","Reminders & alerts","Insurance dashboard","Audit Ready scanner","Document Hub"] },
    { tier:"Studio",  price:"$79", hi:false, feats:["Everything in Pro","Accountant Pack PDF","BAS history + lodge workflow","Monthly IAS","Annual P&L export","Priority support"] },
  ];

  return (
    <div className="land">
      <nav className="lnav">
        <div className="logo" style={{ margin:0 }}>
          <div className="logo-box">M</div>
          <div>
            <div className="logo-name">Mise</div>
            <div className="logo-sub">HOSPITALITY FINANCE</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:9, alignItems:"center" }}>
          <button className="lang-btn" onClick={toggleLang}>🌐 {zh ? "EN" : "中文"}</button>
          <button className="btn-g" onClick={onGo}>{t.login}</button>
          <button className="btn"   onClick={onGo}>{t.getStarted}</button>
        </div>
      </nav>

      {/* Hero with warm glow + dashboard preview */}
      <div className="hero-wrap">
        <div className="hero-glow"/>
        <div className="hero" style={{ position:"relative", zIndex:1 }}>
          <div className="h-badge">{t.badge}</div>
          <h1 className="h-ttl">{t.heroA}<br/><span>{t.heroB}</span></h1>
          <p className="h-sub">{t.heroSub}</p>
          <div className="h-btns">
            <button className="h-btn"   onClick={onGo}>{t.ctaStart}</button>
            <button className="h-btn-g" onClick={onGo}>{t.ctaDemo}</button>
          </div>
        </div>

        {/* Fake dashboard preview — CSS only, no image dependency */}
        <div className="dash-preview" style={{ marginBottom:36 }}>
          <div className="dp-bar">
            <div className="dp-dot" style={{ background:"#E06060" }}/>
            <div className="dp-dot" style={{ background:"#D4A843" }}/>
            <div className="dp-dot" style={{ background:"#52C97A" }}/>
            <div style={{ marginLeft:10, fontSize:11, color:C.muted }}>{t.dpTitle}</div>
          </div>
          <div className="dp-body">
            <div className="dp-row">
              <div className="dp-card">
                <div className="dp-lbl">{t.dpRevenue}</div>
                <div className="dp-val" style={{ color:C.accent }}>$48,250</div>
              </div>
              <div className="dp-card">
                <div className="dp-lbl">{t.dpExpenses}</div>
                <div className="dp-val" style={{ color:C.text }}>$31,900</div>
              </div>
              <div className="dp-card">
                <div className="dp-lbl">{t.dpTax}</div>
                <div className="dp-val" style={{ color:C.yellow }}>$5,420</div>
              </div>
            </div>
            <div className="dp-bars">
              {[42,55,38,63,71,49,80,58,66,74,52,68].map((h,i) => (
                <div key={i} style={{ height:`${h}%`, background:i%3===0?C.accent:`${C.teal}88` }}/>
              ))}
            </div>
            <div style={{ marginTop:13, display:"flex", alignItems:"center", gap:8, background:"rgba(82,201,122,.08)", border:`1px solid rgba(82,201,122,.25)`, borderRadius:10, padding:"10px 14px" }}>
              <span style={{ fontSize:13, fontWeight:700, color:C.green }}>{t.dpHealth}</span>
            </div>
          </div>
        </div>

        {/* Live stat bar */}
        <div style={{ display:"flex", gap:0, borderRadius:12, overflow:"hidden", border:`1px solid ${C.border}`, maxWidth:700, margin:"0 auto 0", position:"relative", zIndex:1 }}>
          {t.stats.map((s,i) => (
            <div key={i} style={{ flex:1, padding:"13px 0", textAlign:"center", background:i%2===0?C.surface:C.surfaceAlt, borderRight:i<3?`1px solid ${C.border}`:"none" }}>
              <div style={{ fontSize:16, fontWeight:800, color:C.accent, fontFamily:"'DM Mono',monospace", letterSpacing:"-1px" }}>{s.val}</div>
              <div style={{ fontSize:10, color:C.muted, marginTop:2, textTransform:"uppercase", letterSpacing:".5px" }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Industry pills */}
      <div style={{ textAlign:"center", padding:"28px 0 32px" }}>
        <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginBottom:10 }}>
          {t.pills.map((l,i) => (
            <span key={i} style={{ fontSize:11.5, padding:"4px 12px", borderRadius:20, background:C.surfaceAlt, border:`1px solid ${C.border}`, color:C.muted }}>{l}</span>
          ))}
        </div>
      </div>

      {/* Feature grid */}
      <div style={{ padding:"8px 40px 40px", maxWidth:960, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:C.accent, textTransform:"uppercase", letterSpacing:"1px", marginBottom:8 }}>{t.featLbl}</div>
          <div style={{ fontSize:24, fontWeight:700, letterSpacing:"-1px", fontFamily:"'Fraunces', serif" }}>{t.featTtl}</div>
        </div>
        <div className="feat-grid">
          {features.map((f,i) => (
            <div key={i} className="feat-card">
              <div className="feat-ico">{f.ico}</div>
              <div className="feat-ttl">{f.ttl}</div>
              <div className="feat-dsc">{f.dsc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Why Mise */}
      <div style={{ padding:"40px 40px 48px", maxWidth:900, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:C.accent, textTransform:"uppercase", letterSpacing:"1px", marginBottom:8 }}>{t.whyLbl}</div>
          <div style={{ fontSize:24, fontWeight:700, letterSpacing:"-1px", fontFamily:"'Fraunces', serif" }}>{t.whyTtl}</div>
          <div style={{ fontSize:13, color:C.muted, marginTop:10, lineHeight:1.7 }}>{t.whySub}</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
          {whys.map((f,i) => (
            <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 18px" }}>
              <div style={{ fontSize:22, marginBottom:9 }}>{f.ico}</div>
              <div style={{ fontWeight:700, fontSize:13, marginBottom:6 }}>{f.ttl}</div>
              <div style={{ fontSize:12, color:C.muted, lineHeight:1.65 }}>{f.dsc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div className="price-sec">
        <div className="price-lbl">{t.priceLbl}</div>
        <div className="price-ttl">{t.priceTtl}</div>
        <div className="price-grid">
          {plans.map((p,i) => (
            <div key={i} className={`price-card${p.hi?" hi":""}`}>
              <div className="p-tier">{p.tier}</div>
              <div><span className="p-amt">{p.price}</span><span className="p-per">{t.perMonth}</span></div>
              <ul className="p-list">{p.feats.map((f,j) => <li key={j}>{f}</li>)}</ul>
              <button className="btn" style={{ marginTop:14, width:"100%" }} onClick={onGo}>
                {p.tier === "Starter" ? t.chooseStart : t.choose(p.tier)}
              </button>
            </div>
          ))}
        </div>
        <p style={{ fontSize:10.5, color:C.dim, marginTop:16 }}>{t.disclaimer}</p>
      </div>


      <div style={{ textAlign:"center", padding:"32px 40px 48px", borderTop:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:9, marginBottom:10 }}>
          <div className="logo-box" style={{ width:28, height:28, fontSize:13 }}>M</div>
          <span style={{ fontWeight:700, fontSize:14, letterSpacing:"-.3px" }}>Mise</span>
          <span style={{ color:C.dim, fontSize:12 }}>· Hospitality Finance</span>
        </div>
        <p style={{ fontSize:11, color:C.dim }}>Built in Australia for Australian hospitality and food businesses.</p>
        <p style={{ fontSize:10.5, color:C.dim, marginTop:6 }}>Mise is not a registered tax agent. Always consult a professional before lodging with the ATO.</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════════
function AuthPage({ onLogin }) {
  const [mode,    setMode]    = useState("login");   // "login" | "signup" | "magic" | "sent"
  const [email,   setEmail]   = useState("");
  const [password,setPassword]= useState("");
  const [bizName, setBizName] = useState("");
  const [accountType, setAccountType] = useState("owner"); // "owner" | "accountant"
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleAuth = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "magic") {
        const { error } = await window._supabase.auth.signInWithOtp({
          email, options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;
        setMode("sent");
      } else if (mode === "signup") {
        const { data, error } = await window._supabase.auth.signUp({
          email, password,
          options: { data: {
            account_type: accountType,
            // Owner's chosen business name — bootFromSession Step B uses this when
            // it creates BOTH the businesses row AND the business_access row together.
            // (Creating only the businesses row here caused "No active business":
            //  fetchAccessibleBusinesses reads business_access, which stayed empty.)
            biz_name: accountType === "owner" ? (bizName || "My Restaurant") : "",
          } },
        });
        if (error) throw error;
        // NOTE: we intentionally do NOT insert into `businesses` here.
        // bootFromSession creates business + business_access atomically so the
        // two tables never get out of sync.
        onLogin();
      } else {
        const { error } = await window._supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLogin();
      }
    } catch(e) {
      setError(e.message || "Something went wrong");
    } finally { setLoading(false); }
  };

  if (mode === "sent") return (
    <div className="auth-pg"><div className="auth-box" style={{ textAlign:"center" }}>
      <div style={{ fontSize:48, marginBottom:16 }}>📬</div>
      <div className="a-ttl">Check your email</div>
      <div className="a-sub" style={{ marginBottom:20 }}>We sent a magic link to <strong>{email}</strong>. Click it to sign in.</div>
      <button className="btn-g" onClick={() => setMode("magic")}>Send again</button>
    </div></div>
  );

  return (
    <div className="auth-pg">
      <div className="auth-box">
        <div className="logo" style={{ marginBottom:20 }}>
          <div className="logo-box">M</div>
          <div><div className="logo-name">Mise</div><div className="logo-sub">HOSPITALITY FINANCE</div></div>
        </div>
        <div className="a-ttl">{mode === "signup" ? "Create account" : mode === "magic" ? "Magic link sign in" : "Welcome back"}</div>
        <div className="a-sub">{mode === "signup" ? "Start your free trial" : mode === "magic" ? "No password needed" : "Log in to your dashboard"}</div>

        {error && <div style={{ background:"rgba(220,38,38,.1)", border:"1px solid rgba(220,38,38,.3)", borderRadius:8, padding:"9px 13px", fontSize:12, color:C.red, marginBottom:12 }}>{error}</div>}

        <div className="a-form">
          {mode === "signup" && (
            <>
              {/* Account type selector */}
              <div className="fg">
                <label className="flbl">I am a…</label>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <button type="button" onClick={() => setAccountType("owner")} style={{
                    padding:"12px 10px", borderRadius:10, cursor:"pointer", fontFamily:"inherit", textAlign:"center",
                    border:`2px solid ${accountType==="owner"?C.accent:C.border}`,
                    background: accountType==="owner" ? "rgba(143,203,114,.10)" : C.surface, transition:"all .15s",
                  }}>
                    <div style={{ fontSize:22, marginBottom:4 }}>🏪</div>
                    <div style={{ fontWeight:700, fontSize:12.5, color: accountType==="owner"?C.accent:C.text }}>Business Owner</div>
                    <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>I run a venue</div>
                  </button>
                  <button type="button" onClick={() => setAccountType("accountant")} style={{
                    padding:"12px 10px", borderRadius:10, cursor:"pointer", fontFamily:"inherit", textAlign:"center",
                    border:`2px solid ${accountType==="accountant"?C.blue:C.border}`,
                    background: accountType==="accountant" ? "rgba(64,156,255,.10)" : C.surface, transition:"all .15s",
                  }}>
                    <div style={{ fontSize:22, marginBottom:4 }}>📊</div>
                    <div style={{ fontWeight:700, fontSize:12.5, color: accountType==="accountant"?C.blue:C.text }}>Accountant</div>
                    <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>I manage clients</div>
                  </button>
                </div>
              </div>
              {accountType === "owner" ? (
                <div className="fg">
                  <label className="flbl">Business Name</label>
                  <input className="inp" placeholder="e.g. The Local Café" value={bizName} onChange={e => setBizName(e.target.value)}/>
                </div>
              ) : (
                <div style={{ background:"rgba(64,156,255,.08)", border:`1px solid rgba(64,156,255,.25)`, borderRadius:9, padding:"11px 13px", fontSize:11.5, color:C.muted, lineHeight:1.6 }}>
                  📋 As an accountant, you don't create a business. Your restaurant clients will invite you to view their data. Once invited, their venues appear here automatically.
                </div>
              )}
            </>
          )}
          <div className="fg">
            <label className="flbl">Email</label>
            <input className="inp" type="email" placeholder="you@yourbiz.com.au" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key==="Enter" && handleAuth()}/>
          </div>
          {mode !== "magic" && (
            <div className="fg">
              <label className="flbl">Password</label>
              <input className="inp" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key==="Enter" && handleAuth()}/>
            </div>
          )}
          <button className="btn" style={{ width:"100%", padding:11, opacity:loading?0.7:1 }} onClick={handleAuth} disabled={loading}>
            {loading ? "Please wait…" : mode === "magic" ? "Send Magic Link →" : mode === "signup" ? "Create Account →" : "Log In →"}
          </button>
          {mode !== "magic" && (
            <button onClick={() => { setMode("magic"); setError(""); }}
              style={{ width:"100%", marginTop:8, padding:"9px", borderRadius:9, border:`1px solid ${C.border}`, background:"none", color:C.muted, cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>
              ✉️ Sign in with Magic Link (no password)
            </button>
          )}
        </div>
        <div className="a-sw">
          {mode === "login"
            ? <><span>No account? </span><a onClick={() => { setMode("signup"); setError(""); }}>Sign up free</a></>
            : <><span>Have account? </span><a onClick={() => { setMode("login"); setError(""); }}>Log in</a></>}
        </div>
      </div>
    </div>
  );
}



// ════════════════════════════════════════════════════════════
//  SIDEBAR
// ════════════════════════════════════════════════════════════
function Sidebar({ page, setPage, onLogout, flagCount, companyName }) {
  const nav = [
    { sec:"Overview" },
    { id:"dashboard", ico:"📊", lbl:"Dashboard" },
    { sec:"Tracking" },
    { id:"revenue",   ico:"💵", lbl:"Sales" },
    { id:"expenses",  ico:"🧾", lbl:"Expenses" },
    { sec:"People" },
    { id:"wages",     ico:"👤", lbl:"Staff & Wages" },
    { id:"dayworkers",ico:"⚡", lbl:"Day Workers", badge:"Quick" },
    { id:"insurance", ico:"🛡️", lbl:"Insurance" },
    { sec:"Tax & Compliance" },
    { id:"taxsaver",  ico:"🔍", lbl:"Audit Ready", badge: flagCount > 0 ? `${flagCount} flags` : null },
    { id:"ias",       ico:"🧾", lbl:"Monthly IAS" },
    { id:"bassummary",ico:"📋", lbl:"BAS Summary" },
    { sec:"Reports" },
    { id:"documents", ico:"📁", lbl:"Document Hub" },
    { id:"reports",   ico:"🖨️", lbl:"Reports & P&L" },
    { sec:"Account" },
    { id:"settings",  ico:"⚙️", lbl:"Settings" },
  ];
  return (
    <div className="sidebar">
      <div className="logo">
        <div className="logo-box">{(companyName || "Mise").trim().charAt(0).toUpperCase() || "M"}</div>
        <div>
          <div className="logo-name">{companyName || "Mise"}</div>
          <div className="logo-sub">{companyName ? "POWERED BY MISE" : "HOSPITALITY FINANCE"}</div>
        </div>
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
          <div className="plan-desc">Upgrade for unlimited staff, insurance & Audit Ready</div>
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
function DashboardPage({ revenue, expenses, employees, timesheets, insurance, setPage, roster = [], bizSettings = {}, updateSetting = () => {} }) {
  const [selMonth, setSelMonth] = useState(() => todayStr.slice(0,7));
  const [dashTab,  setDashTab]  = useState("today"); // "today" | "overview" | "cashflow" | "reminders"
  const [y, m] = selMonth.split("-").map(Number);

  const prevMonth = () => { const d = new Date(y,m-2,1); setSelMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };
  const nextMonth = () => { const d = new Date(y,m,  1); setSelMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); };
  const isCurrentMonth = selMonth === todayStr.slice(0,7);
  const monthLabel = new Date(y,m-1,1).toLocaleString("en-AU",{month:"long",year:"numeric"});

  // ── Data for selected month ───────────────────────────────
  const revMonth  = revenue.filter(r  => r.date.slice(0,7) === selMonth);
  const expMonth  = expenses.filter(e => e.date.slice(0,7) === selMonth);
  const tsMonth   = annotateTimesheets(employees, timesheets.filter(t => weekToMonth(t.week) === selMonth));

  const totalRev   = revMonth.reduce((s,r) => s+revTotal(r), 0);
  const totalExp   = expMonth.reduce((s,e) => s+e.amount, 0);
  const gstTaxable = revMonth.reduce((s,r) => s+revGSTTaxable(r), 0);
  const gstColl    = gstTaxable / 11;
  const gstCreds   = expMonth.filter(e=>e.gst).reduce((s,e)=>s+expGST(e), 0);
  const gstPay     = gstColl - gstCreds;
  const totalWages = tsMonth.reduce((s,t)=>s+t.gross, 0);
  const totalPayg  = tsMonth.reduce((s,t)=>s+t.payg,  0);
  const totalSuper = tsMonth.reduce((s,t)=>s+t.super,  0);
  const totalIns   = insurance.reduce((s,i)=>s+i.annual/12, 0); // monthly share
  const estBAS     = gstPay + totalPayg;
  const wklyRes    = estBAS / 4.33;

  // ── NET PROFIT (the big number) ───────────────────────────
  const revExGST      = totalRev - gstColl;
  const cogsPurchases = expMonth.filter(e => COGS_CATS.has(e.cat)).reduce((s,e)=>s+e.amount, 0);
  const opexTotal     = expMonth.filter(e => !COGS_CATS.has(e.cat)).reduce((s,e)=>s+e.amount, 0);
  const totalCosts    = cogsPurchases + opexTotal + totalWages + totalSuper + totalIns;
  const netProfit     = revExGST - totalCosts;
  const netMargin     = revExGST > 0 ? (netProfit / revExGST * 100) : 0;

  // ── Last month comparison ─────────────────────────────────
  const prevMonthStr = (() => { const d=new Date(y,m-2,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; })();
  const revPrev   = revenue.filter(r=>r.date.slice(0,7)===prevMonthStr).reduce((s,r)=>s+revTotal(r),0);
  const wagesPrev = annotateTimesheets(employees, timesheets.filter(t=>weekToMonth(t.week)===prevMonthStr)).reduce((s,t)=>s+t.gross,0);
  const delta = (cur,prev) => { if(!prev) return null; const pct=((cur-prev)/prev*100).toFixed(1); const up=cur>=prev; return {pct,up,label:`${up?"+":""}${pct}% vs last month`}; };
  const revDelta   = delta(totalRev, revPrev);
  const wagesDelta = delta(totalWages, wagesPrev);

  // ── Cash flow — daily view (includes wages) ──────────────
  const daysInMonth = new Date(y,m,0).getDate();
  // Wages shown on payday — default Thursday (day 4, Mon=1), stored in localStorage
  const payDayOfWeek = parseInt(bizSettings.payday || "4"); // 1=Mon…7=Sun
  const wagesByDate = {};
  tsMonth.forEach(t => {
    const wd = weekToDate(t.week); // Monday of the week
    if (!wd) return;
    // Find the payday for this week (Mon + offset)
    const payDate = new Date(wd);
    payDate.setDate(payDate.getDate() + (payDayOfWeek - 1));
    const ds = payDate.toISOString().slice(0,10);
    if (ds.slice(0,7) === selMonth) {
      wagesByDate[ds] = (wagesByDate[ds] || 0) + t.gross + t.super;
    }
  });

  const cashflowDays = Array.from({length:daysInMonth},(_,i)=>{
    const day   = String(i+1).padStart(2,"0");
    const date  = `${selMonth}-${day}`;
    const dayRev   = revMonth.filter(r=>r.date===date).reduce((s,r)=>s+revTotal(r),0);
    const dayExp   = expMonth.filter(e=>e.date===date).reduce((s,e)=>s+e.amount,0);
    const dayWages = wagesByDate[date] || 0;
    const net   = dayRev - dayExp - dayWages;
    return {date, day:i+1, dayRev, dayExp, dayWages, net};
  });
  let running = 0;
  const cashflowWithBalance = cashflowDays.map(d => { running += d.net; return {...d, balance:running}; });
  const maxFlow = Math.max(...cashflowDays.map(d=>Math.max(d.dayRev, d.dayExp+d.dayWages)), 1);

  // ── Reminders ────────────────────────────────────────────
  const reminders = [];
  // BAS due dates (28th after quarter end). agent_lodge persists in business settings.
  const agentLodge = bizSettings.agent_lodge === true || bizSettings.agent_lodge === "yes";
  const toggleAgentLodge = () => { updateSetting("agent_lodge", !agentLodge); };

  // BAS due dates — self: 28th after quarter end; agent: 28th of month after that
  const BAS_DUES = [
    { q:"Q1 FY2026", selfDue:"2025-10-28", agentDue:"2025-11-28", label:"Q1 FY2026 BAS" },
    { q:"Q2 FY2026", selfDue:"2026-02-28", agentDue:"2026-03-28", label:"Q2 FY2026 BAS" },
    { q:"Q3 FY2026", selfDue:"2026-04-28", agentDue:"2026-05-28", label:"Q3 FY2026 BAS" },
    { q:"Q4 FY2026", selfDue:"2026-07-28", agentDue:"2026-08-28", label:"Q4 FY2026 BAS" },
  ];
  BAS_DUES.forEach(b => {
    const due  = agentLodge ? b.agentDue : b.selfDue;
    const days = Math.ceil((new Date(due)-new Date())/86400000);
    if (days >= 0 && days <= 45) reminders.push({
      type:"bas", ico:"📋", col:days<=14?"r":"y",
      title:`${b.label} due ${agentLodge?"(via agent)":"(self-lodged)"}`,
      sub:`Due ${due} — ${days} days away`,
      action:()=>setPage("bassummary")
    });
  });
  // Super unpaid
  const unpaidSuper = timesheets.filter(t=>!t.super_paid).length;
  if (unpaidSuper > 0) {
    const amt = annotateTimesheets(employees,timesheets.filter(t=>!t.super_paid)).reduce((s,t)=>s+t.super,0);
    reminders.push({ type:"super", ico:"💰", col:"y", title:`${unpaidSuper} super payment${unpaidSuper>1?"s":""} outstanding`, sub:`${money(amt)} owed — mark paid in Staff & Wages`, action:()=>setPage("wages") });
  }
  // Insurance expiring — use 30-day threshold in reminders (60-day shown in quick alert below tabs)
  const insuranceReminders = insurance.filter(i=>{ if(!i.renewal) return false; const d=Math.ceil((new Date(i.renewal)-new Date())/86400000); return d>=0&&d<=30; });
  insuranceReminders.forEach(i=>{
    const days=Math.ceil((new Date(i.renewal)-new Date())/86400000);
    reminders.push({ type:"insurance", ico:"🛡️", col:days<=14?"r":"y", title:`${i.type} renewal — ${days} days`, sub:`Renews ${i.renewal}`, action:()=>setPage("insurance") });
  });
  // expiringPolicies (60-day, shown only in quick alert, NOT reminders)
  const expiringPolicies = insurance.filter(i=>{if(!i.renewal)return false;const d=Math.ceil((new Date(i.renewal)-new Date())/86400000);return d<=60&&d>=31;});
  // Employees with unsettled exit
  employees.filter(e=>e.exitDate&&!e.leaveSettled).forEach(e=>{
    reminders.push({ type:"offboard", ico:"🚪", col:"r", title:`${e.name} — leave balance not settled`, sub:`Exited ${e.exitDate}. Outstanding leave must be paid out.`, action:()=>setPage("wages") });
  });
  // Missing invoices
  const missingInv = analyseExpenses(expenses).filter(e=>e.gstStatus==="missing-invoice").length;
  if (missingInv > 0) reminders.push({ type:"invoice", ico:"🧾", col:"y", title:`${missingInv} expense${missingInv>1?"s":""} missing invoices`, sub:"GST credits at risk — add invoices in Expenses", action:()=>setPage("expenses") });

  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const monthOptions = Array.from({length:18},(_,i)=>{ const d=new Date(today.getFullYear(),today.getMonth()-i,1); const val=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; return {val,lbl:d.toLocaleString("en-AU",{month:"short"}),yr:d.getFullYear()}; }).reverse();

  const status    = gstPay < gstColl*0.5 ? "g" : gstPay < gstColl*0.8 ? "y" : "r";
  const statusMsg = { g:"Tracking well — tax reserves look healthy.", y:"Watch expenses — GST payable is growing.", r:"Tax shortfall risk — increase your weekly reserve." };
  const expiringPolicies60 = insurance.filter(i=>{if(!i.renewal)return false;const d=Math.ceil((new Date(i.renewal)-new Date())/86400000);return d<=60&&d>=0;});

  const colCls = { r:"r", y:"y", g:"g" };
  const remColBg = { r:"rgba(220,38,38,.08)", y:"rgba(217,119,6,.08)" };
  const remColBd = { r:"rgba(220,38,38,.25)", y:"rgba(217,119,6,.25)" };
  const remColTxt= { r:C.red, y:C.yellow };

  return (
    <>
      {/* ── HEADER ── */}
      <div className="hdr">
        <div className="hdr-left">
          <div className="ptitle">Dashboard</div>
          <div className="psub">{monthLabel}</div>
        </div>
        <div className="hdr-right">
          <div className="chip">📅 {quarter}</div>
        </div>
      </div>

      {/* ── MONTH PICKER ── */}
      <div style={{marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:showMonthPicker?10:0}}>
          <button onClick={prevMonth} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,fontSize:15,padding:"5px 10px",cursor:"pointer",lineHeight:1}}>‹</button>
          <button onClick={()=>setShowMonthPicker(v=>!v)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"space-between",background:C.surface,border:`1px solid ${showMonthPicker?C.accent:C.border}`,borderRadius:9,padding:"8px 14px",cursor:"pointer",fontFamily:"inherit"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16}}>📅</span>
              <div style={{textAlign:"left"}}>
                <div style={{fontSize:14,fontWeight:700,color:C.text}}>{monthLabel}</div>
                <div style={{fontSize:10,color:C.muted}}>{isCurrentMonth?"Current month":"Viewing past data"}</div>
              </div>
            </div>
            <span style={{color:C.muted,fontSize:11}}>{showMonthPicker?"▲ Close":"▼ Change"}</span>
          </button>
          <button onClick={nextMonth} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,fontSize:15,padding:"5px 10px",cursor:"pointer",lineHeight:1}}>›</button>
          {!isCurrentMonth&&<button onClick={()=>{setSelMonth(todayStr.slice(0,7));setShowMonthPicker(false);}} style={{background:"rgba(143,203,114,.12)",border:`1px solid ${C.accent}`,borderRadius:7,color:C.accent,fontSize:11,fontWeight:700,padding:"7px 12px",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>Today</button>}
        </div>
        {showMonthPicker&&(
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:11,padding:"14px 16px"}}>
            {[...new Set(monthOptions.map(o=>o.yr))].map(yr=>(
              <div key={yr} style={{marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:C.muted,letterSpacing:".8px",textTransform:"uppercase",marginBottom:7}}>{yr}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {monthOptions.filter(o=>o.yr===yr).map(o=>{
                    const isSel=o.val===selMonth,isCur=o.val===todayStr.slice(0,7),hasData=revenue.some(r=>r.date.slice(0,7)===o.val);
                    return(<button key={o.val} onClick={()=>{setSelMonth(o.val);setShowMonthPicker(false);}} style={{padding:"6px 12px",borderRadius:7,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:isSel?700:500,border:isSel?`1px solid ${C.accent}`:isCur?`1px solid ${C.border}`:"1px solid transparent",background:isSel?"rgba(143,203,114,.18)":isCur?C.surfaceAlt:"transparent",color:isSel?C.accent:C.text,position:"relative"}}>
                      {o.lbl}{hasData&&!isSel&&<span style={{position:"absolute",top:3,right:3,width:4,height:4,borderRadius:"50%",background:C.accent}}/>}
                    </button>);
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          LAYER 1 — THE 5 NUMBERS EVERY OWNER NEEDS
      ══════════════════════════════════════════════════════ */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:16}}>
        {/* Revenue */}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px"}}>
          <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:8}}>Monthly Revenue</div>
          <div className="mono" style={{fontSize:26,fontWeight:800,color:C.accent,lineHeight:1,marginBottom:6}}>{money(totalRev)}</div>
          <div style={{fontSize:11,color:C.muted}}>
            {revDelta
              ? <span style={{color:revDelta.up?C.accent:"rgba(220,38,38,.8)"}}>{revDelta.label}</span>
              : `${revMonth.length} entries this month`}
          </div>
        </div>

        {/* Expenses */}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px"}}>
          <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:8}}>Monthly Expenses</div>
          <div className="mono" style={{fontSize:26,fontWeight:800,color:C.text,lineHeight:1,marginBottom:6}}>{money(totalExp + totalWages)}</div>
          <div style={{fontSize:11,color:C.muted}}>Bills {money(totalExp)} · Wages {money(totalWages)}</div>
        </div>

        {/* Estimated quarterly tax */}
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px"}}>
          <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:8}}>Estimated Quarterly Tax</div>
          <div className="mono" style={{fontSize:26,fontWeight:800,color:estBAS>0?C.yellow:C.muted,lineHeight:1,marginBottom:6}}>{money(estBAS)}</div>
          <div style={{fontSize:11,color:C.muted}}>GST owed + employee tax withheld</div>
        </div>

        {/* Cash available (net of tax reserve) */}
        {(() => {
          const taxReserve = wklyRes * 4.33;
          const cashAvail  = netProfit - taxReserve;
          return (
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px"}}>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:8}}>Cash Available</div>
              <div className="mono" style={{fontSize:26,fontWeight:800,color:cashAvail>=0?C.green:C.text,lineHeight:1,marginBottom:6}}>{money(Math.max(0,netProfit))}</div>
              <div style={{fontSize:11,color:C.muted}}>Set aside {money(wklyRes)}/wk for BAS</div>
            </div>
          );
        })()}

        {/* Next BAS due */}
        {(() => {
          const upcoming = BAS_DUES
            .map(b => ({ ...b, due: agentLodge ? b.agentDue : b.selfDue }))
            .map(b => ({ ...b, days: Math.ceil((new Date(b.due) - new Date()) / 86400000) }))
            .filter(b => b.days >= 0)
            .sort((a,b) => a.days - b.days)[0];
          const urgent = upcoming && upcoming.days <= 14;
          const soon   = upcoming && upcoming.days <= 28;
          return (
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 20px",cursor:"pointer"}} onClick={()=>setPage("bassummary")}>
              <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:8}}>Next BAS Due Date</div>
              {upcoming ? <>
                <div className="mono" style={{fontSize:26,fontWeight:800,color:urgent?C.yellow:C.text,lineHeight:1,marginBottom:6}}>{upcoming.days}d</div>
                <div style={{fontSize:11,color:C.muted}}>{upcoming.due} · {upcoming.label}</div>
              </> : <>
                <div style={{fontSize:16,fontWeight:700,color:C.muted,marginBottom:6}}>No deadline soon</div>
                <div style={{fontSize:11,color:C.dim}}>All BAS lodgements up to date</div>
              </>}
            </div>
          );
        })()}
      </div>

      {/* ══════════════════════════════════════════════════════
          LAYER 2 — BUSINESS HEALTH CARD
      ══════════════════════════════════════════════════════ */}
      {(() => {
        // Health scoring — plain English, no jargon
        const margin = netMargin;
        const hasData = totalRev > 0;
        let health, healthCol, healthBg, healthBd, advice;
        if (!hasData) {
          health = "Getting Started"; healthCol = C.muted;
          healthBg = "transparent"; healthBd = C.border;
          advice   = "Add your first sale to start seeing your business health.";
        } else if (margin >= 15 && gstPay < gstColl * 0.6) {
          health = "Safe"; healthCol = C.green;
          healthBg = "rgba(5,150,105,.08)"; healthBd = "rgba(5,150,105,.25)";
          advice   = `Your business is tracking well. Profit margin is ${margin.toFixed(1)}% — healthy for hospitality.`;
        } else if (margin >= 5) {
          health = "Watch"; healthCol = C.yellow;
          healthBg = "rgba(217,119,6,.08)"; healthBd = "rgba(217,119,6,.25)";
          advice   = `Margin is ${margin.toFixed(1)}% — workable but tight. Keep an eye on expenses this month.`;
        } else {
          health = "Needs Attention"; healthCol = "rgba(220,120,38,1)";
          healthBg = "rgba(220,100,38,.08)"; healthBd = "rgba(220,100,38,.25)";
          advice   = margin < 0
            ? `Spending more than you're earning this month (${margin.toFixed(1)}% margin). Review your biggest costs.`
            : `Margin is below 5% (${margin.toFixed(1)}%). Consider where costs can be reduced.`;
        }
        return (
          <div style={{background:healthBg,border:`1.5px solid ${healthBd}`,borderRadius:14,padding:"18px 22px",marginBottom:16,display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"}}>
            <div style={{width:48,height:48,borderRadius:"50%",background:healthBg,border:`2px solid ${healthCol}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>
              {health==="Safe"?"✅":health==="Watch"?"👀":health==="Needs Attention"?"⚠️":"🚀"}
            </div>
            <div style={{flex:1,minWidth:200}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                <span style={{fontSize:16,fontWeight:800,color:healthCol}}>{health}</span>
                <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".6px"}}>Business Health · {monthLabel}</span>
              </div>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.6}}>{advice}</div>
            </div>
            {hasData && (
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <div style={{textAlign:"center",padding:"8px 14px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10}}>
                  <div className="mono" style={{fontSize:15,fontWeight:700,color:netProfit>=0?C.green:"rgba(220,100,38,1)"}}>{money(netProfit)}</div>
                  <div style={{fontSize:9.5,color:C.muted,marginTop:2}}>Net Profit</div>
                </div>
                <div style={{textAlign:"center",padding:"8px 14px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:10}}>
                  <div className="mono" style={{fontSize:15,fontWeight:700,color:netProfit>=0?C.green:"rgba(220,100,38,1)"}}>{margin.toFixed(1)}%</div>
                  <div style={{fontSize:9.5,color:C.muted,marginTop:2}}>Margin</div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════
          BAS SAFE ZONE — am I ready for my next tax bill?
      ══════════════════════════════════════════════════════ */}
      {(() => {
        // ── Quarter-to-date BAS estimate (the real bill, not just this month) ──
        const viewDate  = new Date(y, m-1, 1);
        const qNum      = Math.floor(viewDate.getMonth()/3);
        const qStart    = new Date(viewDate.getFullYear(), qNum*3, 1);
        const qEndFull  = new Date(viewDate.getFullYear(), qNum*3+3, 0);
        const isCurrentQ= today >= qStart && today <= qEndFull;
        const qEndStr   = isCurrentQ ? todayStr : qEndFull.toISOString().slice(0,10);
        const qStartStr = qStart.toISOString().slice(0,10);

        const qRevAll = revenue.filter(r => r.date >= qStartStr && r.date <= qEndStr);
        const qExpAll = expenses.filter(e => e.date >= qStartStr && e.date <= qEndStr);
        const qTsAll  = annotateTimesheets(employees, timesheets.filter(t => {
          const d = weekToDate(t.week); return d && d >= qStartStr && d <= qEndStr;
        }));
        const qGST    = qRevAll.reduce((s,r)=>s+revGSTTaxable(r),0)/11;
        const qCreds  = qExpAll.filter(e=>e.gst).reduce((s,e)=>s+expGST(e),0);
        const qNetGST = Math.max(0, qGST - qCreds);
        const qPAYG   = qTsAll.reduce((s,t)=>s+t.payg,0);
        const estBill = qNetGST + qPAYG; // the full estimated quarterly tax bill

        // ── How much has the owner set aside? ──
        // Stored reserve (manually tracked by owner) + this quarter's accumulated profit buffer.
        // We use a pragmatic proxy: the owner's saved reserve target if set, else
        // we estimate from the recommended weekly set-aside × weeks elapsed this quarter.
        const savedReserve = parseFloat(bizSettings.bas_reserve || "0") || 0;
        // Recommended total reserve = the full estimated bill (you should have 100% by due date)
        const recommendedReserve = estBill;
        // Weeks elapsed in quarter (for "on track" pacing)
        const daysIntoQ  = Math.max(0, Math.ceil((today - qStart)/86400000));
        const daysInQ    = Math.ceil((qEndFull - qStart)/86400000);
        const qProgress  = Math.min(100, Math.round((daysIntoQ/daysInQ)*100));

        // Coverage = how much of the estimated bill the reserve currently covers
        const coverage = estBill > 0 ? Math.round((savedReserve / estBill) * 100) : 100;

        // ── Status logic ──
        // SAFE  = reserve comfortably exceeds bill (≥100%)
        // WATCH = reserve is close (60–99%)
        // RISK  = insufficient (<60%)
        let status, statusCol, statusBg, statusBd, statusIco, statusMsg;
        if (estBill === 0) {
          status="SAFE"; statusCol=C.green; statusBg="rgba(5,150,105,.08)"; statusBd="rgba(5,150,105,.25)"; statusIco="✅";
          statusMsg="No tax owing this quarter yet. Nothing to set aside right now.";
        } else if (coverage >= 100) {
          status="SAFE"; statusCol=C.green; statusBg="rgba(5,150,105,.08)"; statusBd="rgba(5,150,105,.25)"; statusIco="✅";
          statusMsg=`Your tax reserve covers ${coverage}% of your estimated bill. You're well prepared.`;
        } else if (coverage >= 60) {
          status="WATCH"; statusCol=C.yellow; statusBg="rgba(217,119,6,.08)"; statusBd="rgba(217,119,6,.25)"; statusIco="👀";
          statusMsg=`Your reserve covers ${coverage}% of your estimated bill. Keep setting money aside to close the gap.`;
        } else {
          status="RISK"; statusCol="rgba(220,100,38,1)"; statusBg="rgba(220,100,38,.08)"; statusBd="rgba(220,100,38,.25)"; statusIco="⚠️";
          statusMsg=`Your reserve only covers ${coverage}% of your estimated bill. Start putting money aside now to avoid a shortfall.`;
        }

        // ── Next BAS due date ──
        const upcoming = BAS_DUES
          .map(b => ({ ...b, due: agentLodge ? b.agentDue : b.selfDue }))
          .map(b => ({ ...b, days: Math.ceil((new Date(b.due) - new Date())/86400000) }))
          .filter(b => b.days >= 0)
          .sort((a,b)=>a.days-b.days)[0];

        const weeksLeft = upcoming ? Math.max(1, Math.ceil(upcoming.days/7)) : 4;
        const gap       = Math.max(0, recommendedReserve - savedReserve);
        const perWeek   = gap / weeksLeft;

        return (
          <div style={{background:statusBg,border:`1.5px solid ${statusBd}`,borderRadius:14,padding:"20px 22px",marginBottom:16}}>
            {/* Header row */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:22}}>{statusIco}</span>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".8px"}}>BAS Safe Zone</span>
                    <span style={{fontSize:11,fontWeight:800,color:statusCol,background:C.surface,padding:"2px 10px",borderRadius:20,border:`1px solid ${statusBd}`}}>{status}</span>
                  </div>
                  <div style={{fontSize:13,color:C.muted,marginTop:5,lineHeight:1.5,maxWidth:480}}>{statusMsg}</div>
                </div>
              </div>
            </div>

            {/* Coverage bar */}
            {estBill > 0 && (
              <div style={{marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:5}}>
                  <span>Reserve covers <strong style={{color:statusCol}}>{coverage}%</strong> of your bill</span>
                  <span>{money(savedReserve)} / {money(estBill)}</span>
                </div>
                <div style={{height:10,background:C.border,borderRadius:5,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(100,coverage)}%`,background:statusCol,borderRadius:5,transition:"width .4s"}}/>
                </div>
              </div>
            )}

            {/* Key numbers */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:6}}>Estimated tax bill</div>
                <div className="mono" style={{fontSize:18,fontWeight:700,color:C.text}}>{money(estBill)}</div>
                <div style={{fontSize:9.5,color:C.dim,marginTop:3}}>This quarter</div>
              </div>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:6}}>You've set aside</div>
                <div className="mono" style={{fontSize:18,fontWeight:700,color:savedReserve>0?C.green:C.muted}}>{money(savedReserve)}</div>
                <div style={{fontSize:9.5,color:C.dim,marginTop:3}}>Current reserve</div>
              </div>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:6}}>Set aside per week</div>
                <div className="mono" style={{fontSize:18,fontWeight:700,color:C.teal}}>{money(perWeek)}</div>
                <div style={{fontSize:9.5,color:C.dim,marginTop:3}}>For {weeksLeft} weeks → covered</div>
              </div>
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:6}}>BAS due in</div>
                <div className="mono" style={{fontSize:18,fontWeight:700,color:upcoming&&upcoming.days<=14?C.yellow:C.text}}>{upcoming?`${upcoming.days} days`:"—"}</div>
                <div style={{fontSize:9.5,color:C.dim,marginTop:3}}>{upcoming?upcoming.due:"No deadline soon"}</div>
              </div>
            </div>

            {/* Quarter progress */}
            <div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:5}}>
                <span>Quarter progress</span>
                <span>{qProgress}% through{isCurrentQ?` · ${daysInQ-daysIntoQ} days left`:""}</span>
              </div>
              <div style={{height:6,background:C.border,borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${qProgress}%`,background:C.muted,borderRadius:3}}/>
              </div>
            </div>

            {/* Update reserve button */}
            <div style={{marginTop:16,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <button
                onClick={() => {
                  const cur = parseFloat(bizSettings.bas_reserve || "0") || 0;
                  const input = window.prompt("How much have you set aside for your BAS tax bill?\n\nEnter the total amount currently saved in your tax reserve account:", cur || "");
                  if (input !== null) {
                    const val = parseFloat(input) || 0;
                    updateSetting("bas_reserve", val); // persists to Supabase + re-renders
                  }
                }}
                style={{fontSize:12,fontWeight:700,fontFamily:"inherit",cursor:"pointer",padding:"8px 16px",borderRadius:9,border:`1px solid ${statusCol}`,background:C.surface,color:statusCol}}>
                💰 Update my reserve amount
              </button>
              <span style={{fontSize:11,color:C.dim}}>Tell Mise how much you've actually saved to see your true safe zone.</span>
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════
          LABOUR COST % — are my staffing costs efficient?
      ══════════════════════════════════════════════════════ */}
      {(() => {
        // ── This week (Mon–Sun containing today) ──
        const todayD = new Date(todayStr + "T00:00:00");
        const dow = (todayD.getDay() + 6) % 7; // Mon=0
        const monday = new Date(todayD); monday.setDate(todayD.getDate() - dow);
        const weekDatesArr = Array.from({length:7}, (_,i) => {
          const d = new Date(monday); d.setDate(monday.getDate()+i);
          return d.toISOString().slice(0,10);
        });
        const weekRev = revenue.filter(r => weekDatesArr.includes(r.date)).reduce((s,r)=>s+revTotal(r),0);
        const weekTs  = annotateTimesheets(employees, timesheets.filter(t => {
          const d = weekToDate(t.week); return d && weekDatesArr.includes(d);
        }));
        const weekWages = weekTs.reduce((s,t)=>s+t.gross,0) + weekTs.reduce((s,t)=>s+t.super,0);
        const weekPct   = weekRev > 0 ? (weekWages/weekRev)*100 : null;

        // ── This month (uses existing dashboard totals) ──
        const monthLabour = totalWages + totalSuper;
        const monthPct    = totalRev > 0 ? (monthLabour/totalRev)*100 : null;

        // ── Last month (for trend) ──
        const superPrev   = annotateTimesheets(employees, timesheets.filter(t=>weekToMonth(t.week)===prevMonthStr)).reduce((s,t)=>s+t.super,0);
        const prevLabour  = wagesPrev + superPrev;
        const prevPct     = revPrev > 0 ? (prevLabour/revPrev)*100 : null;

        // Nothing to show yet
        if (monthPct === null && weekPct === null) {
          return (
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 22px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:22}}>👥</span>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>Labour Cost %</div>
                <div style={{fontSize:12,color:C.muted,marginTop:3}}>Log sales and staff hours to see how efficient your staffing is.</div>
              </div>
            </div>
          );
        }

        const statusOf = (pct) => {
          if (pct === null)    return { st:"—",             col:C.muted };
          if (pct <= 30)       return { st:"Healthy",        col:C.green };
          if (pct <= 38)       return { st:"Slightly High",  col:C.yellow };
          return                      { st:"Critical",       col:"rgba(220,100,38,1)" };
        };
        const monthStatus = statusOf(monthPct);

        // Trend: compare this month vs last month (lower is better)
        let trend, trendCol, trendIco;
        if (monthPct !== null && prevPct !== null) {
          const diff = monthPct - prevPct;
          if (diff < -1.5)      { trend="Improving"; trendCol=C.green;  trendIco="↓"; }
          else if (diff > 1.5)  { trend="Rising";    trendCol="rgba(220,100,38,1)"; trendIco="↑"; }
          else                  { trend="Stable";    trendCol=C.muted;  trendIco="→"; }
        } else { trend=null; }

        const explain = monthPct === null ? ""
          : monthPct <= 30 ? "Your staffing costs are within the healthy restaurant range."
          : monthPct <= 38 ? "Labour is a little above the healthy range — keep an eye on rostered hours."
          : "Labour cost is above the healthy restaurant range. Look for shifts you can trim.";

        return (
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"20px 22px",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:20}}>👥</span>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".8px"}}>Labour Cost %</div>
                  <div style={{fontSize:12,color:C.muted,marginTop:3,maxWidth:420,lineHeight:1.5}}>{explain}</div>
                </div>
              </div>
              {trend && (
                <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                  <span style={{fontSize:14,fontWeight:800,color:trendCol}}>{trendIco}</span>
                  <span style={{fontSize:11,fontWeight:700,color:trendCol}}>{trend}</span>
                </div>
              )}
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
              {/* This week */}
              <div style={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 15px"}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:6}}>This week</div>
                <div className="mono" style={{fontSize:22,fontWeight:800,color:statusOf(weekPct).col}}>{weekPct!==null?`${weekPct.toFixed(1)}%`:"—"}</div>
                <div style={{fontSize:10,color:statusOf(weekPct).col,marginTop:3,fontWeight:600}}>{statusOf(weekPct).st}</div>
              </div>
              {/* This month */}
              <div style={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 15px"}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:6}}>This month</div>
                <div className="mono" style={{fontSize:22,fontWeight:800,color:monthStatus.col}}>{monthPct!==null?`${monthPct.toFixed(1)}%`:"—"}</div>
                <div style={{fontSize:10,color:monthStatus.col,marginTop:3,fontWeight:600}}>{monthStatus.st}</div>
              </div>
              {/* Benchmark */}
              <div style={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 15px"}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:6}}>Healthy range</div>
                <div className="mono" style={{fontSize:22,fontWeight:800,color:C.green}}>25–30%</div>
                <div style={{fontSize:10,color:C.muted,marginTop:3}}>Restaurant benchmark</div>
              </div>
              {/* Last month */}
              <div style={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:10,padding:"13px 15px"}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:6}}>Last month</div>
                <div className="mono" style={{fontSize:22,fontWeight:800,color:C.muted}}>{prevPct!==null?`${prevPct.toFixed(1)}%`:"—"}</div>
                <div style={{fontSize:10,color:C.dim,marginTop:3}}>For comparison</div>
              </div>
            </div>
            <div style={{fontSize:10,color:C.dim,marginTop:12}}>
              Labour cost = wages + super. Includes fixed-salary staff. {monthPct!==null && `This month: ${money(monthLabour)} labour ÷ ${money(totalRev)} sales.`}
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════
          SETUP PROGRESS (shown until complete)
      ══════════════════════════════════════════════════════ */}
      {(() => {
        const steps = [
          { id:"revenue",   lbl:"First revenue entry",  done: revenue.length > 0,   page:"revenue",    ico:"💵" },
          { id:"expense",   lbl:"First expense entry",  done: expenses.length > 0,  page:"expenses",   ico:"🧾" },
          { id:"employee",  lbl:"Add an employee",      done: employees.length > 0, page:"wages",      ico:"👤" },
          { id:"timesheet", lbl:"Log first timesheet",  done: timesheets.length > 0,page:"wages",      ico:"🕐" },
          { id:"bas",       lbl:"Review your BAS",      done: false,                page:"bassummary", ico:"📋" },
        ];
        const doneCount = steps.filter(s=>s.done).length;
        if (doneCount === steps.length) return null;
        const pct = Math.round((doneCount/steps.length)*100);
        return (
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:700}}>🚀 Getting set up — {doneCount}/{steps.length} done</div>
              <div style={{fontSize:11,color:C.muted}}>{pct}%</div>
            </div>
            <div style={{height:5,background:C.border,borderRadius:3,marginBottom:12,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pct}%`,background:C.accent,borderRadius:3,transition:"width .4s"}}/>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {steps.map(s=>(
                <button key={s.id} onClick={()=>!s.done&&setPage(s.page)}
                  style={{display:"flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:8,cursor:s.done?"default":"pointer",fontFamily:"inherit",fontSize:11.5,
                    border:`1px solid ${s.done?"rgba(5,150,105,.30)":C.border}`,
                    background:s.done?"rgba(5,150,105,.08)":"transparent",
                    color:s.done?C.green:C.muted}}>
                  <span>{s.done?"✅":s.ico}</span>{s.lbl}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ══════════════════════════════════════════════════════
          QUICK ACTIONS
      ══════════════════════════════════════════════════════ */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
        {[
          { ico:"⚡", lbl:"Pay a Casual",    sub:"Day Worker — 30 seconds", col:C.teal,   page:"dayworkers" },
          { ico:"🧾", lbl:"Log a Receipt",   sub:"Add expense now",          col:C.yellow, page:"expenses" },
          { ico:"📋", lbl:"Review BAS",      sub:"Check your tax estimate",  col:C.blue,   page:"bassummary" },
          { ico:"💵", lbl:"Record Sales",    sub:"Add today's takings",      col:C.accent, page:"revenue" },
        ].map(a=>(
          <button key={a.lbl} onClick={()=>setPage(a.page)}
            style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:11,cursor:"pointer",fontFamily:"inherit",textAlign:"left",background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
            <span style={{fontSize:22,flexShrink:0}}>{a.ico}</span>
            <div>
              <div style={{fontSize:12.5,fontWeight:700,color:C.text}}>{a.lbl}</div>
              <div style={{fontSize:10.5,color:a.col,marginTop:1}}>{a.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          LAYER 3 — COLLAPSIBLE ADVANCED SECTIONS
      ══════════════════════════════════════════════════════ */}
      {[
        {
          id:"gst",
          label:"GST Breakdown",
          emoji:"🟡",
          summary:`GST owed to ATO this month: ${money(gstPay)}`,
          content: (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,paddingTop:14}}>
              {[
                {lbl:"GST collected from customers", val:money(gstColl),  col:C.yellow, note:"1/11 of taxable sales"},
                {lbl:"GST credits on purchases",     val:"− "+money(gstCreds), col:C.green,  note:"From receipts with GST"},
                {lbl:"GST owed to ATO",              val:money(gstPay),   col:gstPay>1500?C.yellow:C.muted, note:"Collected minus credits"},
              ].map((s,i)=>(
                <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                  <div style={{fontSize:10,color:C.muted,marginBottom:6,lineHeight:1.4}}>{s.lbl}</div>
                  <div className="mono" style={{fontSize:16,fontWeight:700,color:s.col}}>{s.val}</div>
                  <div style={{fontSize:9.5,color:C.dim,marginTop:4}}>{s.note}</div>
                </div>
              ))}
            </div>
          )
        },
        {
          id:"payg",
          label:"Employee Tax Withheld",
          emoji:"👷",
          summary:`Withheld from staff pay this month: ${money(totalPayg)}`,
          content: (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,paddingTop:14}}>
              {[
                {lbl:"Gross wages paid",             val:money(totalWages), col:C.text,   note:"Before tax deductions"},
                {lbl:"Employee tax withheld (PAYG)", val:money(totalPayg),  col:C.yellow, note:"Sent to ATO in BAS"},
                {lbl:"Super (SGC 12%)",              val:money(totalSuper), col:C.blue,   note:"Paid to super funds — not in BAS"},
              ].map((s,i)=>(
                <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                  <div style={{fontSize:10,color:C.muted,marginBottom:6,lineHeight:1.4}}>{s.lbl}</div>
                  <div className="mono" style={{fontSize:16,fontWeight:700,color:s.col}}>{s.val}</div>
                  <div style={{fontSize:9.5,color:C.dim,marginTop:4}}>{s.note}</div>
                </div>
              ))}
            </div>
          )
        },
        {
          id:"taxliability",
          label:"Full Tax Liabilities",
          emoji:"🏛️",
          summary:(()=>{
            const viewDate=new Date(y,m-1,1);
            const qNum=Math.floor(viewDate.getMonth()/3);
            const qStart=new Date(viewDate.getFullYear(),qNum*3,1);
            const qEndFull=new Date(viewDate.getFullYear(),qNum*3+3,0);
            const isCurrentQ=today>=qStart&&today<=qEndFull;
            const qEndStr=isCurrentQ?todayStr:qEndFull.toISOString().slice(0,10);
            const qStartStr=qStart.toISOString().slice(0,10);
            const qRevAll=revenue.filter(r=>r.date>=qStartStr&&r.date<=qEndStr);
            const qExpAll=expenses.filter(e=>e.date>=qStartStr&&e.date<=qEndStr);
            const qTsAll=annotateTimesheets(employees,timesheets.filter(t=>{const d=weekToDate(t.week);return d&&d>=qStartStr&&d<=qEndStr;}));
            const qGST=qRevAll.reduce((s,r)=>s+revGSTTaxable(r),0)/11;
            const qCreds=qExpAll.filter(e=>e.gst).reduce((s,e)=>s+expGST(e),0);
            const qNetGST=Math.max(0,qGST-qCreds);
            const qPAYG=qTsAll.reduce((s,t)=>s+t.payg,0);
            return `Estimated quarterly tax bill: ${money(qNetGST+qPAYG)}`;
          })(),
          content: (()=>{
            const viewDate=new Date(y,m-1,1);
            const qNum=Math.floor(viewDate.getMonth()/3);
            const qLabels=["Jul–Sep","Oct–Dec","Jan–Mar","Apr–Jun"];
            const qFY=viewDate.getMonth()>=6?viewDate.getFullYear()+1:viewDate.getFullYear();
            const qLabel=`Q${qNum+1} FY${qFY} (${qLabels[qNum]})`;
            const qStart=new Date(viewDate.getFullYear(),qNum*3,1);
            const qEndFull=new Date(viewDate.getFullYear(),qNum*3+3,0);
            const isCurrentQ=today>=qStart&&today<=qEndFull;
            const qEndStr=isCurrentQ?todayStr:qEndFull.toISOString().slice(0,10);
            const qStartStr=qStart.toISOString().slice(0,10);
            const qRevAll=revenue.filter(r=>r.date>=qStartStr&&r.date<=qEndStr);
            const qExpAll=expenses.filter(e=>e.date>=qStartStr&&e.date<=qEndStr);
            const qTsAll=annotateTimesheets(employees,timesheets.filter(t=>{const d=weekToDate(t.week);return d&&d>=qStartStr&&d<=qEndStr;}));
            const qRev=qRevAll.reduce((s,r)=>s+revTotal(r),0);
            const qGSTTaxable=qRevAll.reduce((s,r)=>s+revGSTTaxable(r),0);
            const qGST=qGSTTaxable/11;
            const qCreds=qExpAll.filter(e=>e.gst).reduce((s,e)=>s+expGST(e),0);
            const qNetGST=Math.max(0,qGST-qCreds);
            const qPAYG=qTsAll.reduce((s,t)=>s+t.payg,0);
            const qSuper=qTsAll.reduce((s,t)=>s+t.super,0);
            const qOwed=qNetGST+qPAYG;
            const daysLeft=Math.ceil((qEndFull-today)/86400000);
            const daysTotal=Math.ceil((qEndFull-qStart)/86400000);
            const progress=Math.round((1-daysLeft/daysTotal)*100);
            return (
              <div style={{paddingTop:14}}>
                <div style={{fontSize:11,color:C.muted,marginBottom:12}}>
                  {qLabel} — {isCurrentQ?"in progress":"completed"}
                  {isCurrentQ&&<span style={{marginLeft:8,color:C.dim}}>({daysLeft} days left in quarter)</span>}
                </div>
                {isCurrentQ&&(
                  <div style={{marginBottom:14}}>
                    <div style={{height:6,background:C.border,borderRadius:3,overflow:"hidden",marginBottom:4}}>
                      <div style={{height:"100%",width:`${progress}%`,background:progress>80?C.yellow:C.accent,borderRadius:3}}/>
                    </div>
                    <div style={{fontSize:10.5,color:C.muted}}>{progress}% of quarter done</div>
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
                  {[
                    {lbl:"GST owed to ATO",             val:money(qNetGST), col:C.yellow},
                    {lbl:"Employee tax withheld",        val:money(qPAYG),   col:C.yellow},
                    {lbl:"Total estimated tax bill",     val:money(qOwed),   col:C.accent},
                    {lbl:"Super owed (not in BAS)",      val:money(qSuper),  col:C.blue},
                    {lbl:"Weekly amount to set aside",   val:money(wklyRes), col:C.teal},
                  ].map((s,i)=>(
                    <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                      <div style={{fontSize:10,color:C.muted,marginBottom:6,lineHeight:1.4}}>{s.lbl}</div>
                      <div className="mono" style={{fontSize:16,fontWeight:700,color:s.col}}>{s.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginTop:14,padding:"12px 14px",background:"rgba(57,211,187,.06)",border:`1px solid rgba(57,211,187,.20)`,borderRadius:10,fontSize:12,color:C.muted}}>
                  💡 Set aside <strong style={{color:C.teal}}>{money(wklyRes)}</strong> every week and you'll have <strong style={{color:C.teal}}>{money(wklyRes*4.33)}</strong> ready by BAS due date.
                </div>
              </div>
            );
          })()
        },
        {
          id:"cashflow",
          label:"Daily Cash Flow",
          emoji:"📈",
          summary:`${monthLabel} — ${cashflowDays.filter(d=>d.dayRev>0||d.dayExp>0).length} days with activity`,
          content: cashflowDays.every(d=>d.dayRev===0&&d.dayExp===0)
            ? <div style={{padding:"20px 0",color:C.muted,fontSize:13}}>No transactions logged for {monthLabel}.</div>
            : (
              <div style={{paddingTop:14}}>
                <div style={{display:"flex",alignItems:"flex-end",gap:3,height:72,marginBottom:14,paddingBottom:4,borderBottom:`1px solid ${C.border}`}}>
                  {cashflowDays.map((d,i)=>(
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:1,height:"100%",justifyContent:"flex-end"}}>
                      {d.dayRev>0&&<div style={{width:"100%",background:C.accent+"88",borderRadius:"2px 2px 0 0",height:`${(d.dayRev/maxFlow)*55}px`,minHeight:2}}/>}
                      {(d.dayExp+d.dayWages)>0&&<div style={{width:"100%",background:C.muted+"55",borderRadius:"2px 2px 0 0",height:`${((d.dayExp+d.dayWages)/maxFlow)*55}px`,minHeight:2}}/>}
                    </div>
                  ))}
                </div>
                <table className="tbl">
                  <thead><tr><th>Date</th><th style={{textAlign:"right"}}>Revenue</th><th style={{textAlign:"right"}}>Out</th><th style={{textAlign:"right"}}>Day Net</th><th style={{textAlign:"right"}}>Running</th></tr></thead>
                  <tbody>
                    {cashflowWithBalance.filter(d=>d.dayRev>0||d.dayExp>0||d.dayWages>0).map((d,i)=>(
                      <tr key={i}>
                        <td className="mono" style={{fontSize:11}}>{d.date}</td>
                        <td className="mono" style={{textAlign:"right",color:C.accent}}>{d.dayRev>0?money(d.dayRev):"—"}</td>
                        <td className="mono" style={{textAlign:"right",color:C.muted}}>{(d.dayExp+d.dayWages)>0?money(d.dayExp+d.dayWages):"—"}</td>
                        <td className="mono" style={{textAlign:"right",fontWeight:700,color:d.net>=0?C.accent:C.muted}}>{money(d.net)}</td>
                        <td className="mono" style={{textAlign:"right",fontWeight:700,color:d.balance>=0?C.text:C.muted}}>{money(d.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{fontWeight:700}}>TOTAL</td>
                      <td className="mono" style={{textAlign:"right",fontWeight:700,color:C.accent}}>{money(totalRev)}</td>
                      <td className="mono" style={{textAlign:"right",fontWeight:700,color:C.muted}}>{money(totalExp+totalWages+totalSuper)}</td>
                      <td className="mono" style={{textAlign:"right",fontWeight:700,color:netProfit>=0?C.accent:C.muted}}>{money(netProfit)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
        },
      ].map(section => {
        const isOpen = dashTab === section.id;
        return (
          <div key={section.id} style={{marginBottom:10,background:C.surface,border:`1px solid ${isOpen?C.border+"88":C.border}`,borderRadius:13,overflow:"hidden"}}>
            <button
              onClick={() => setDashTab(isOpen ? "closed" : section.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 18px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
              <span style={{fontSize:18,flexShrink:0}}>{section.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>{section.label}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:1}}>{section.summary}</div>
              </div>
              <span style={{fontSize:14,color:C.muted,flexShrink:0,transition:"transform .2s",transform:isOpen?"rotate(180deg)":"none"}}>▼</span>
            </button>
            {isOpen && (
              <div style={{padding:"0 18px 18px"}}>
                <div style={{height:1,background:C.border,marginBottom:14}}/>
                {section.content}
              </div>
            )}
          </div>
        );
      })}

      {/* ══════════════════════════════════════════════════════
          CONTEXTUAL REMINDERS (calm, not alarming)
      ══════════════════════════════════════════════════════ */}
      {reminders.length > 0 && (
        <div style={{marginTop:10,background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,overflow:"hidden"}}>
          <button
            onClick={()=>setDashTab(dashTab==="reminders"?"closed":"reminders")}
            style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 18px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
            <span style={{fontSize:18}}>🔔</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>
                Action Items
                <span style={{marginLeft:8,fontSize:11,fontWeight:600,color:C.muted,background:C.surfaceAlt,padding:"2px 8px",borderRadius:10}}>{reminders.length}</span>
              </div>
              <div style={{fontSize:11,color:C.muted,marginTop:1}}>BAS deadlines, super, insurance</div>
            </div>
            <span style={{fontSize:14,color:C.muted,transform:dashTab==="reminders"?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
          </button>
          {dashTab === "reminders" && (
            <div style={{padding:"0 18px 18px"}}>
              <div style={{height:1,background:C.border,marginBottom:14}}/>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {reminders.map((r,i)=>(
                  <div key={i} onClick={r.action} style={{
                    display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
                    background:C.surfaceAlt,border:`1px solid ${C.border}`,
                    borderLeft:`3px solid ${remColTxt[r.col]}`,
                    borderRadius:10,cursor:"pointer"
                  }}>
                    <span style={{fontSize:18,flexShrink:0}}>{r.ico}</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12.5,fontWeight:600,color:C.text,marginBottom:2}}>{r.title}</div>
                      <div style={{fontSize:11,color:C.muted}}>{r.sub}</div>
                    </div>
                    <span style={{fontSize:11,color:C.dim}}>→</span>
                  </div>
                ))}
              </div>
              {/* Toggle tax agent */}
              <div style={{marginTop:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:11,color:C.muted}}>Lodging via tax agent?</span>
                <button onClick={toggleAgentLodge} style={{fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:`1px solid ${agentLodge?C.teal:C.border}`,borderRadius:7,padding:"4px 12px",background:agentLodge?"rgba(57,211,187,.12)":"none",color:agentLodge?C.teal:C.muted}}>
                  {agentLodge?"Yes — via agent":"No — self-lodged"}
                </button>
              </div>
              {/* Key ATO dates */}
              <div style={{marginTop:16,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:8}}>📅 Key ATO Dates</div>
                {[
                  {lbl:"Q2 FY2026 BAS",     date:"28 Feb 2026"},
                  {lbl:"Q3 FY2026 BAS",     date:"28 Apr 2026"},
                  {lbl:"Q4 FY2026 BAS",     date:"28 Jul 2026"},
                  {lbl:"Payday Super",       date:"1 Jul 2026"},
                ].map((d,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                    <span style={{color:C.muted}}>{d.lbl}</span>
                    <span className="mono" style={{fontWeight:600,color:C.text}}>{d.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Insurance soft alert — calm */}
      {expiringPolicies60.length > 0 && (
        <div onClick={()=>setPage("insurance")} style={{cursor:"pointer",marginTop:10,display:"flex",alignItems:"center",gap:12,padding:"12px 16px",background:C.surfaceAlt,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.yellow}`,borderRadius:10}}>
          <span style={{fontSize:18}}>🛡️</span>
          <div style={{flex:1}}>
            <div style={{fontSize:12.5,fontWeight:600,color:C.text}}>Insurance renewal coming up</div>
            <div style={{fontSize:11,color:C.muted}}>{expiringPolicies60.map(i=>{const d=Math.ceil((new Date(i.renewal)-new Date())/86400000);return `${i.type} — ${d} days`;}).join(" · ")}</div>
          </div>
          <span style={{fontSize:11,color:C.dim}}>→</span>
        </div>
      )}
    </>
  );
}
// ════════════════════════════════════════════════════════════
//  REVENUE PAGE
// ════════════════════════════════════════════════════════════
function RevenuePage({ revenue, setRevenue, showToast }) {
  // ── PDF Export state ──────────────────────────────────────
  const [showRevPrint, setShowRevPrint] = useState(false);
  const [pdfFromDate,  setPdfFromDate]  = useState("");
  const [pdfToDate,    setPdfToDate]    = useState("");

  // ── Pagination state ──────────────────────────────────────
  const [revPage,     setRevPage]     = useState(1);
  const [revPageSize, setRevPageSize] = useState(25);

  // ── Last-used channel template (localStorage) ─────────────
  const LAST_CHANNELS_KEY = "mise_last_channels";
  const DEFAULT_CHANNELS = [
    { name:"Dine-in",  amount:"", gstInclusive:true },
    { name:"Takeaway", amount:"", gstInclusive:true },
  ];
  const getStoredChannels = () => {
    try {
      const raw = localStorage.getItem(LAST_CHANNELS_KEY);
      if (!raw) return null;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length === 0) return null;
      return arr.map(c => ({ name:c.name || "", amount:"", gstInclusive:c.gstInclusive !== false }));
    } catch { return null; }
  };
  const saveChannelTemplate = channels => {
    try {
      const tpl = channels.filter(c => c.name).map(c => ({ name:c.name, gstInclusive: !!c.gstInclusive }));
      if (tpl.length > 0) localStorage.setItem(LAST_CHANNELS_KEY, JSON.stringify(tpl));
    } catch {}
  };
  const makeBlank = () => ({
    date: todayStr,
    channels: (getStoredChannels() || DEFAULT_CHANNELS).map(c => ({...c})),
  });

  const [f,        setF]        = useState(makeBlank);
  const [editId,   setEditId]   = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [historyRec, setHistoryRec] = useState(null); // record whose audit trail is being viewed
  const [showImport,  setShowImport]  = useState(false);
  const [csvRaw,      setCsvRaw]      = useState("");
  const [csvHeaders,  setCsvHeaders]  = useState([]);
  const [csvMapping,  setCsvMapping]  = useState({});
  const [csvPreview,  setCsvPreview]  = useState([]);
  const [csvError,    setCsvError]    = useState("");
  const [csvStep,     setCsvStep]     = useState("upload");

  // ── CSV mapping memory — remember by header fingerprint ──
  const csvMapKey    = hdrs => "mise_csv_" + hdrs.slice().sort().join("|").slice(0,100);
  const recallMap    = hdrs => { try { return JSON.parse(localStorage.getItem(csvMapKey(hdrs))||"{}"); } catch { return {}; } };
  const saveMap      = (hdrs, m) => { try { localStorage.setItem(csvMapKey(hdrs), JSON.stringify(m)); } catch {} };

  // ── Step 1: detect headers from raw CSV ──────────────────
  const detectHeaders = text => {
    setCsvError(""); setCsvPreview([]); setCsvRaw(text);
    try {
      const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { setCsvError("CSV must have a header row and at least one data row."); return; }
      const headers = lines[0].split(",").map(h => h.replace(/"/g,"").trim());
      setCsvHeaders(headers);

      const recalled = recallMap(headers);
      const guess = (keys, hdrs) => hdrs.find(h => keys.some(k => h.toLowerCase().includes(k))) || "";
      const autoMap = Object.keys(recalled).length > 0 ? recalled : {
        date:     guess(["date","day","transaction","sale date"], headers),
        dine_in:  guess(["dine","dine-in","eat in","table","in store","instore","restaurant","indoor"], headers),
        takeaway: guess(["takeaway","take away","pickup","pick up","counter","takeout"], headers),
        delivery: guess(["delivery","deliver","online","uber","doordash","menulog","3rd party","platform"], headers),
        total:    guess(["total sales","total revenue","gross sales","net sales","total","amount","sales","revenue","gross"], headers),
      };
      const wasRecalled = Object.keys(recalled).length > 0;
      setCsvMapping(autoMap);
      setCsvStep("map");
      if (wasRecalled) showToast("✅ Column mapping recalled from last import");
    } catch(e) { setCsvError("Could not read file: " + e.message); }
  };

  // ── Step 2: apply mapping and parse rows (outputs channels[] format) ──
  const applyMapping = () => {
    setCsvError("");
    try {
      const lines = csvRaw.trim().split(/\r?\n/).filter(l => l.trim());
      const hdrs  = lines[0].split(",").map(h => h.replace(/"/g,"").trim());
      const idx   = k => csvMapping[k] ? hdrs.indexOf(csvMapping[k]) : -1;
      const dateIdx = idx("date");
      if (dateIdx === -1) { setCsvError("Please select a Date column."); return; }
      saveMap(hdrs, csvMapping);

      const parseAmt = (cols, i) => i >= 0 ? (parseFloat(String(cols[i]||"0").replace(/[$,\s]/g,"")) || 0) : 0;
      const parseDate = raw => {
        if (!raw) return "";
        const s = raw.replace(/"/g,"").trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
        if (/\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) { const [d,mo,yr]=s.split("/"); return `${yr}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}`; }
        if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s)) { const p=s.split("/"); const yr=p[2].length===2?"20"+p[2]:p[2]; return `${yr}-${p[0].padStart(2,"0")}-${p[1].padStart(2,"0")}`; }
        return "";
      };

      const dineIdx = idx("dine_in"), takeIdx = idx("takeaway"), delivIdx = idx("delivery"), totIdx = idx("total");
      const rows = [];
      for (let i=1; i<lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.replace(/"/g,"").trim());
        const parsedDate = parseDate(cols[dateIdx]);
        if (!parsedDate || isNaN(new Date(parsedDate))) continue;

        const channels = [];
        if (dineIdx>=0 || takeIdx>=0 || delivIdx>=0) {
          const d = parseAmt(cols, dineIdx);
          const t = parseAmt(cols, takeIdx);
          const v = parseAmt(cols, delivIdx);
          if (d > 0) channels.push({ name:"Dine-in",           amount:d, gstInclusive:true  });
          if (t > 0) channels.push({ name:"Takeaway",          amount:t, gstInclusive:true  });
          if (v > 0) channels.push({ name:"Delivery Platform", amount:v, gstInclusive:false });
        } else if (totIdx >= 0) {
          const a = parseAmt(cols, totIdx);
          if (a > 0) channels.push({ name:"Sales", amount:a, gstInclusive:true });
        }
        if (channels.length === 0) continue;
        const total = channels.reduce((s,c) => s+c.amount, 0);
        rows.push({ date:parsedDate, channels, total });
      }
      if (rows.length===0) { setCsvError("No valid rows found after applying this mapping. Check your column selections."); return; }
      setCsvPreview(rows);
      setCsvStep("preview");
    } catch(e) { setCsvError("Parse error: " + e.message); }
  };

  const importCSV = () => {
    const existing = new Set(revenue.map(r => r.date));
    const toAdd    = csvPreview.filter(r => !existing.has(r.date));
    const dupes    = csvPreview.length - toAdd.length;
    setRevenue(p => [...p, ...toAdd.map(r => ({ id:Date.now()+Math.random(), date:r.date, channels:r.channels }))]);
    showToast(`✅ Imported ${toAdd.length} rows${dupes ? ` (${dupes} skipped — date exists)` : ""}`);
    setCsvRaw(""); setCsvHeaders([]); setCsvMapping({}); setCsvPreview([]);
    setCsvStep("upload"); setShowImport(false);
  };

  const resetImport = () => { setCsvRaw(""); setCsvHeaders([]); setCsvMapping({}); setCsvPreview([]); setCsvError(""); setCsvStep("upload"); };

  // ── Form channel mutators ───────────────────────────────
  const updateChannel = (i, patch) => {
    setF(prev => {
      const next = [...prev.channels];
      next[i] = { ...next[i], ...patch };
      return { ...prev, channels: next };
    });
  };
  const updateChannelName = (i, name) => {
    // Auto-infer GST based on name, but only if user hasn't explicitly set it this session
    setF(prev => {
      const next = [...prev.channels];
      next[i] = { ...next[i], name, gstInclusive: inferGstInclusive(name) };
      return { ...prev, channels: next };
    });
  };
  const removeChannel = i => {
    setF(prev => ({ ...prev, channels: prev.channels.filter((_, j) => j !== i) }));
  };
  const addEmptyChannel = () => {
    setF(prev => ({ ...prev, channels: [...prev.channels, { name:"", amount:"", gstInclusive:true }] }));
  };
  const addPresetChannel = preset => {
    setF(prev => ({ ...prev, channels: [...prev.channels, { name:preset.name, amount:"", gstInclusive:preset.gstInclusive }] }));
  };

  // Totals for form
  const formTotal       = (f.channels || []).reduce((s,c) => s + (parseFloat(c.amount) || 0), 0);
  const formGSTTaxable  = (f.channels || []).reduce((s,c) => s + (c.gstInclusive ? (parseFloat(c.amount) || 0) : 0), 0);

  const save = () => {
    const cleanChannels = (f.channels || [])
      .filter(c => c.name && c.name.trim() && parseFloat(c.amount) > 0)
      .map(c => ({
        name: c.name.trim(),
        amount: parseFloat(c.amount) || 0,
        gstInclusive: !!c.gstInclusive,
      }));
    if (cleanChannels.length === 0) { showToast("Add at least one channel with an amount."); return; }
    const entry = { date:f.date, channels:cleanChannels };
    if (editId) {
      // Preserve record identity but drop any legacy v1 fields by replacing fully
      setRevenue(p => p.map(r => r.id === editId ? { id:r.id, ...entry } : r));
      showToast("Entry updated!"); setEditId(null);
    } else {
      setRevenue(p => [...p, { id:Date.now(), ...entry }]);
      showToast("Sales added!");
    }
    saveChannelTemplate(cleanChannels);
    setF(makeBlank());
  };

  const startEdit = r => {
    setEditId(r.id);
    const chs = getChannels(r);
    setF({
      date: r.date,
      channels: chs.length > 0
        ? chs.map(c => ({ name:c.name, amount:String(c.amount || ""), gstInclusive: c.gstInclusive !== false }))
        : DEFAULT_CHANNELS.map(c => ({...c})),
    });
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const cancelEdit = () => { setEditId(null); setF(makeBlank()); };
  const clearForm  = () => { setF(makeBlank()); };
  const del_ = id => { setRevenue(p => p.filter(x => x.id !== id)); if (editId===id) cancelEdit(); if (expandedId===id) setExpandedId(null); showToast("Deleted."); };

  // ── Aggregated totals for overview cards & history footer ──
  const totalAll = revenue.reduce((s,r) => s + revTotal(r), 0);
  const totalGST = revenue.reduce((s,r) => s + revGSTTaxable(r), 0) / 11;

  // Top channels by volume — for the 3 overview slots next to Total
  const channelTotalsMap = new Map();
  revenue.forEach(r => {
    getChannels(r).forEach(c => {
      channelTotalsMap.set(c.name, (channelTotalsMap.get(c.name) || 0) + (c.amount || 0));
    });
  });
  const topChannels = [...channelTotalsMap.entries()].sort((a,b) => b[1] - a[1]).slice(0, 3);
  const cardTone = ["t", "", "p"]; // matches original colour scheme

  // ── "Repeat last" button ────────────────────────────────
  const lastEntry = revenue.length > 0
    ? [...revenue].sort((a,b) => b.date.localeCompare(a.date))[0]
    : null;
  const yesterdayStr = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })();
  const repeatEntry = !editId && lastEntry ? lastEntry : null;

  // ── Preset chips that aren't already in the form ────────
  const usedNames = new Set((f.channels || []).map(c => (c.name || "").toLowerCase()));
  const availablePresets = CHANNEL_PRESETS.filter(p => !usedNames.has(p.name.toLowerCase()));

  return (
    <>
      <div className="hdr">
        <div className="hdr-left">
          <div className="ptitle">Revenue Tracking</div>
          <div className="psub">Log daily sales by channel — or import from your POS</div>
        </div>
        <div className="hdr-right">
          <button className="btn-g" onClick={() => setShowRevPrint(true)}>⬇️ Export PDF</button>
          <button className="btn-g" onClick={() => { setShowImport(v=>!v); setCsvPreview([]); setCsvError(""); }}>
            {showImport ? "✕ Close Import" : "📥 Import CSV"}
          </button>
        </div>
      </div>

      {/* ── Overview cards: Total + top 3 channels ── */}
      <div className="g4">
        <div className="card">
          <div className="clbl">Total Sales</div>
          <div className="cval b">{money(totalAll)}</div>
        </div>
        {topChannels.map(([name, amt], i) => (
          <div key={name} className="card">
            <div className="clbl" title={name}>{name.length > 18 ? name.slice(0,16) + "…" : name}</div>
            <div className={`cval ${cardTone[i] || ""}`}>{money(amt)}</div>
          </div>
        ))}
        {Array.from({ length: Math.max(0, 3 - topChannels.length) }).map((_,i) => (
          <div key={`empty-${i}`} className="card" style={{ opacity:.35 }}>
            <div className="clbl">—</div>
            <div className="cval">$0.00</div>
          </div>
        ))}
      </div>

      {/* ── CSV Import Panel ── */}
      {showImport && (
        <div className="bc" style={{ marginBottom:14, border:`1px solid ${C.teal}44` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
            <div className="bctit" style={{ margin:0 }}>📥 Import from POS / CSV</div>
            <div style={{ marginLeft:"auto", display:"flex", gap:6, fontSize:10, fontWeight:700 }}>
              {["1 Upload","2 Map Columns","3 Confirm"].map((s,i)=>{
                const step = i===0?"upload":i===1?"map":"preview";
                const active = csvStep===step;
                const done = (csvStep==="map"&&i===0)||(csvStep==="preview"&&i<=1);
                return <span key={i} style={{ padding:"3px 8px", borderRadius:10, background:active?"rgba(57,211,187,.2)":done?"rgba(143,203,114,.15)":C.surfaceAlt, color:active?C.teal:done?C.green:C.dim, border:`1px solid ${active?C.teal:done?C.green:C.border}` }}>{done?"✓ "+s:s}</span>;
              })}
            </div>
          </div>

          {csvError && <div className="alert al-r" style={{ marginBottom:10 }}><span className="al-ico">❌</span><div><div className="al-ttl">Error</div><div className="al-msg">{csvError}</div></div></div>}

          {/* STEP 1: Upload */}
          {csvStep === "upload" && (
            <>
              <div style={{ fontSize:12, color:C.muted, marginBottom:12, lineHeight:1.7 }}>
                Export a daily sales report from your POS as CSV (Square, Lightspeed, Kounta, Impos, Hike, or any system). Mise will show you a column mapper so you can confirm which column is which.
              </div>
              <div style={{ background:C.surfaceAlt, borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:11, fontFamily:"DM Mono,monospace", color:C.muted }}>
                <div style={{ fontWeight:700, color:C.text, marginBottom:4, fontFamily:"inherit" }}>Any format works — e.g.:</div>
                <div>Date, Net Sales, Dine-in, Takeaway, Delivery</div>
                <div>01/07/2025, 2670, 1400, 820, 450</div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                <textarea style={{ flex:1, minHeight:110, background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", color:C.text, fontSize:12, fontFamily:"DM Mono,monospace", resize:"vertical" }}
                  placeholder={"Paste CSV here...\nDate,Total Sales\n01/07/2025,2670"}
                  value={csvRaw} onChange={e => setCsvRaw(e.target.value)}/>
                <label style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:8, padding:"12px 16px", cursor:"pointer", fontSize:11, color:C.muted, whiteSpace:"nowrap" }}>
                  📁 Or upload file
                  <input type="file" accept=".csv,.txt" style={{display:"none"}}
                    onChange={e => { const file = e.target.files?.[0]; if (!file) return; const r = new FileReader(); r.onload = ev => detectHeaders(String(ev.target?.result || "")); r.readAsText(file); }}/>
                </label>
              </div>
              <div style={{ display:"flex", gap:10, marginTop:10 }}>
                <button className="btn" disabled={!csvRaw.trim()} onClick={() => detectHeaders(csvRaw)}>Detect columns →</button>
                <button className="btn-g" onClick={() => { setShowImport(false); resetImport(); }}>Cancel</button>
              </div>
            </>
          )}

          {/* STEP 2: Map columns */}
          {csvStep === "map" && (
            <>
              <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
                We detected <b style={{color:C.text}}>{csvHeaders.length}</b> columns. Confirm which maps to what — we'll remember your choices for next time.
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"140px 1fr", gap:"8px 12px", marginBottom:12, fontSize:12, alignItems:"center" }}>
                {[
                  ["date",     "📅 Date",            true],
                  ["dine_in",  "🍽️ Dine-in",         false],
                  ["takeaway", "🥡 Takeaway",        false],
                  ["delivery", "🛵 Delivery",        false],
                  ["total",    "💵 Total (fallback)",false],
                ].map(([k,lbl,req]) => (
                  <React.Fragment key={k}>
                    <div style={{ fontWeight:600, color: req ? C.text : C.muted }}>{lbl}{req && <span style={{color:C.red,marginLeft:4}}>*</span>}</div>
                    <select className="inp" value={csvMapping[k] || ""} onChange={e => setCsvMapping({...csvMapping, [k]:e.target.value})}>
                      <option value="">— none —</option>
                      {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </React.Fragment>
                ))}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button className="btn" onClick={applyMapping}>Preview Import →</button>
                <button className="btn-g" onClick={() => setCsvStep("upload")}>← Back</button>
              </div>
            </>
          )}

          {/* STEP 3: Preview & Confirm */}
          {csvStep === "preview" && csvPreview.length > 0 && (
            <>
              <div style={{ fontSize:12, fontWeight:700, color:C.teal, marginBottom:8 }}>
                ✅ {csvPreview.length} rows ready to import — review below:
              </div>
              <div style={{ maxHeight:220, overflowY:"auto", marginBottom:12 }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Channels</th>
                      <th style={{textAlign:"right"}}>Total</th>
                      <th style={{textAlign:"right"}}>GST (taxable)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((r,i) => {
                      const taxable = r.channels.filter(c => c.gstInclusive).reduce((s,c) => s+c.amount, 0);
                      const exists = revenue.some(x => x.date === r.date);
                      return (
                        <tr key={i} style={{ background: exists ? "rgba(212,168,67,.07)" : undefined }}>
                          <td className="mono">{r.date}{exists && <span style={{ fontSize:9, color:C.yellow, marginLeft:6 }}>exists</span>}</td>
                          <td style={{ fontSize:11, color:C.muted }}>
                            {r.channels.map(c => `${c.name} ${money(c.amount)}`).join(" · ")}
                          </td>
                          <td className="mono" style={{textAlign:"right",fontWeight:700}}>{money(r.total)}</td>
                          <td className="mono" style={{textAlign:"right",color:C.yellow}}>{taxable>0?money(taxable/11):"—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {csvPreview.some(r => revenue.some(x=>x.date===r.date)) && (
                <div style={{ fontSize:11, color:C.yellow, marginBottom:10 }}>⚠️ Highlighted rows already exist — they will be skipped.</div>
              )}
              <div style={{ display:"flex", gap:10 }}>
                <button className="btn" onClick={importCSV}>⬇️ Import {csvPreview.filter(r=>!revenue.some(x=>x.date===r.date)).length} new rows</button>
                <button className="btn-g" onClick={() => setCsvStep("map")}>← Back to mapping</button>
                <button className="btn-g" onClick={() => { setShowImport(false); resetImport(); }}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── GST note ── */}
      <div className="alert al-t" style={{ marginBottom:14 }}>
        <span className="al-ico">💡</span>
        <div>
          <div className="al-ttl">Channel GST note</div>
          <div className="al-msg">Toggle <b>GST inc.</b> per channel. Owner-collected channels (Dine-in, Takeaway, Catering) remit GST at ÷11. Platform-remitted channels (Uber Eats, DoorDash, Shopify etc.) have nothing to declare — the platform handles GST.</div>
        </div>
      </div>

      {/* ── Add / Edit form ── */}
      <div className="fsec" style={{ border: editId ? `1px solid ${C.yellow}` : undefined }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:10 }}>
          <div className="ftit" style={{ marginBottom:0 }}>{editId ? "✏️ Edit Entry" : "Add Sales"}</div>
          {repeatEntry && (
            <button onClick={() => {
                const chs = getChannels(repeatEntry);
                setF({
                  date: todayStr,
                  channels: chs.map(c => ({ name:c.name, amount:String(c.amount || ""), gstInclusive: c.gstInclusive !== false })),
                });
              }}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:8, cursor:"pointer", fontFamily:"inherit", fontSize:11.5, fontWeight:700, flexShrink:0,
                background:"rgba(143,203,114,.12)", border:`1px solid rgba(143,203,114,.35)`, color:C.accent }}>
              🔁 Repeat {repeatEntry.date === yesterdayStr ? "Yesterday" : "Last Entry"}
              <span style={{ fontWeight:400, color:C.muted, fontSize:10.5 }}>({money(revTotal(repeatEntry))})</span>
            </button>
          )}
        </div>
        {editId && <div style={{ fontSize:11, color:C.yellow, marginBottom:10, background:"rgba(212,168,67,.08)", borderRadius:6, padding:"6px 10px" }}>Editing existing entry — make your changes and click Save.</div>}

        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:12 }}>
          <div className="fg">
            <label className="flbl">Date</label>
            <input className="inp" type="date" value={f.date} onChange={e => setF({...f,date:e.target.value})}/>
          </div>

          {/* Unified Sales Channels list */}
          <div className="fg">
            <label className="flbl" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span>Sales Channels</span>
              <button onClick={addEmptyChannel}
                style={{background:"none",border:`1px dashed ${C.border}`,borderRadius:6,padding:"2px 10px",fontSize:11,color:C.accent,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>
                + Add Channel
              </button>
            </label>

            {availablePresets.length > 0 && (
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6,marginBottom:2}}>
                {availablePresets.map(p => (
                  <button key={p.name} onClick={() => addPresetChannel(p)}
                    title={p.gstInclusive ? "Owner collects GST (÷11)" : "Platform remits GST"}
                    style={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:20,padding:"3px 10px",fontSize:11,color:C.muted,cursor:"pointer",fontFamily:"inherit"}}>
                    + {p.name}
                  </button>
                ))}
              </div>
            )}

            {(f.channels || []).length === 0 && (
              <div style={{fontSize:11,color:C.muted,padding:"12px 0"}}>No channels yet — add one above or tap a preset.</div>
            )}

            {(f.channels || []).map((c, i) => {
              const amtNum = parseFloat(c.amount) || 0;
              return (
                <div key={i} style={{display:"flex",gap:6,marginTop:8,alignItems:"center",flexWrap:"wrap"}}>
                  <input className="inp" placeholder="Channel name (e.g. Dine-in)" value={c.name}
                    onChange={e => updateChannelName(i, e.target.value)}
                    style={{flex:"2 1 140px", minWidth:"120px"}}/>
                  <input className="inp" type="number" placeholder="0.00" value={c.amount} inputMode="decimal"
                    onChange={e => updateChannel(i, { amount:e.target.value })}
                    style={{flex:"1 1 100px", minWidth:"90px"}}/>
                  <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,cursor:"pointer",whiteSpace:"nowrap",padding:"6px 8px",borderRadius:6,
                    background: c.gstInclusive ? "rgba(212,168,67,.08)" : "rgba(57,211,187,.08)",
                    border: `1px solid ${c.gstInclusive ? "rgba(212,168,67,.3)" : "rgba(57,211,187,.3)"}`,
                    color: c.gstInclusive ? C.yellow : C.teal }}>
                    <input type="checkbox" checked={c.gstInclusive}
                      onChange={e => updateChannel(i, { gstInclusive:e.target.checked })} style={{margin:0}}/>
                    GST inc.
                  </label>
                  <button onClick={() => removeChannel(i)}
                    style={{background:"none",border:"none",color:C.dim,cursor:"pointer",fontSize:16,padding:"0 4px",lineHeight:1}}>✕</button>
                  {amtNum > 0 && (
                    <span style={{fontSize:10, width:"100%", paddingLeft:2, marginTop:-2,
                      color: c.gstInclusive ? C.yellow : C.teal}}>
                      {c.gstInclusive ? `GST: ${money(amtNum/11)}` : "Platform remits GST — nothing to declare"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="fbtns">
          <button className="btn" onClick={save}>{editId ? "Save Changes" : "Add Entry"}</button>
          {editId
            ? <button className="btn-g" onClick={cancelEdit}>Cancel</button>
            : <button className="btn-g" onClick={clearForm}>Clear</button>}
          {formTotal > 0 && (
            <div style={{ marginLeft:"auto", textAlign:"right" }}>
              <div className="clbl">Total today</div>
              <div className="mono" style={{ fontSize:20, fontWeight:700, color:C.green }}>{money(formTotal)}</div>
              <div style={{ fontSize:10, color:C.muted }}>
                GST: {money(formGSTTaxable/11)}{formGSTTaxable < formTotal && <span style={{color:C.teal, marginLeft:4}}>(excl. platform-remitted)</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sales History (expandable rows, paginated) ── */}
      <div className="bc">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:6}}>
          <div className="bctit" style={{margin:0}}>Sales History</div>
          {revenue.length > 0 && (
            <div style={{fontSize:11,color:C.muted}}>{revenue.length} {revenue.length===1?"entry":"entries"}</div>
          )}
        </div>
        {(() => {
          // Sort whole list by date desc (cached for both display and totals)
          const sortedRev  = [...revenue].sort((a,b) => b.date.localeCompare(a.date));
          const totalRows  = sortedRev.length;
          const pageSize   = revPageSize === 0 ? Math.max(totalRows, 1) : revPageSize; // 0 = "All"
          const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
          const safePage   = Math.min(Math.max(1, revPage), totalPages);
          const startIdx   = (safePage - 1) * pageSize;
          const endIdx     = startIdx + pageSize;
          const pageRows   = revPageSize === 0 ? sortedRev : sortedRev.slice(startIdx, endIdx);
          return (
            <>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{width:32}}></th>
              <th>Date</th>
              <th>Channels</th>
              <th style={{textAlign:"right"}}>Total</th>
              <th style={{textAlign:"right"}}>GST</th>
              <th style={{textAlign:"center"}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {revenue.length === 0
              ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">📭</div><div className="empty-txt">No entries yet. Add manually above or import a CSV from your POS.</div></div></td></tr>
              : pageRows.map(r => {
                  const chs   = getChannels(r);
                  const total = revTotal(r);
                  const gst   = revGSTTaxable(r) / 11;
                  const isExpanded = expandedId === r.id;
                  const summary = chs.length === 0 ? "—"
                    : chs.length <= 2 ? chs.map(c => c.name).join(", ")
                    : `${chs.slice(0,2).map(c => c.name).join(", ")} +${chs.length - 2}`;
                  return (
                    <React.Fragment key={r.id}>
                      <tr style={{
                        background: editId===r.id ? "rgba(212,168,67,.07)" : (isExpanded ? "rgba(57,211,187,.04)" : undefined),
                        cursor:"pointer"
                      }} onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                        <td style={{textAlign:"center",color:C.muted,userSelect:"none",fontSize:10}}>
                          {isExpanded ? "▼" : "▶"}
                        </td>
                        <td className="mono">{r.date}</td>
                        <td style={{fontSize:11, color:C.muted}}>
                          <span style={{fontWeight:600, color:C.text, marginRight:8}}>
                            {chs.length} {chs.length === 1 ? "channel" : "channels"}
                          </span>
                          <span>{summary}</span>
                        </td>
                        <td className="mono" style={{textAlign:"right",fontWeight:700}}>{money(total)}</td>
                        <td className="mono" style={{textAlign:"right",color:C.yellow}}>{gst > 0 ? money(gst) : "—"}</td>
                        <td style={{textAlign:"center",whiteSpace:"nowrap"}} onClick={e => e.stopPropagation()}>
                          <button className="btn-ic" title="Edit" onClick={() => startEdit(r)}>✏️</button>
                          <button className="btn-ic" title="History" onClick={() => setHistoryRec(r)}>📋</button>
                          <button className="btn-ic" title="Delete" onClick={() => del_(r.id)}>🗑️</button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ background:"rgba(57,211,187,.04)" }}>
                          <td></td>
                          <td colSpan={5} style={{padding:"6px 12px 12px"}}>
                            {chs.length === 0 ? (
                              <div style={{fontSize:11, color:C.muted}}>No channels recorded for this day.</div>
                            ) : (
                              <table style={{width:"100%", fontSize:12, borderCollapse:"collapse"}}>
                                <thead>
                                  <tr style={{color:C.muted, fontSize:10, textTransform:"uppercase", letterSpacing:".5px"}}>
                                    <th style={{textAlign:"left", padding:"4px 8px", fontWeight:600}}>Channel</th>
                                    <th style={{textAlign:"right", padding:"4px 8px", fontWeight:600}}>Amount</th>
                                    <th style={{textAlign:"right", padding:"4px 8px", fontWeight:600}}>GST Treatment</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {chs.map((c, i) => (
                                    <tr key={i}>
                                      <td style={{padding:"4px 8px"}}>{c.name}</td>
                                      <td className="mono" style={{padding:"4px 8px", textAlign:"right"}}>{money(c.amount)}</td>
                                      <td className="mono" style={{padding:"4px 8px", textAlign:"right", fontSize:11, color: c.gstInclusive ? C.yellow : C.teal}}>
                                        {c.gstInclusive ? `GST ${money(c.amount/11)} (÷11)` : "Platform remits"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
            }
          </tbody>
          {revenue.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} style={{fontWeight:700}}>TOTAL</td>
                <td className="mono" style={{textAlign:"right",fontWeight:700}}>{money(totalAll)}</td>
                <td className="mono" style={{textAlign:"right",fontWeight:700,color:C.yellow}}>{money(totalGST)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
        {/* Pagination controls */}
        {revenue.length > 0 && (totalPages > 1 || revenue.length > 25) && (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            pageSize={revPageSize}
            totalRows={totalRows}
            startIdx={startIdx}
            endIdx={Math.min(endIdx, totalRows)}
            onPageChange={setRevPage}
            onPageSizeChange={(n) => { setRevPageSize(n); setRevPage(1); }}/>
        )}
            </>
          );
        })()}
      </div>

      {/* ── Revenue PDF Export Modal ── */}
      {historyRec && <HistoryModal record={historyRec} label={`Sales — ${historyRec.date}`} onClose={() => setHistoryRec(null)}/>}

      {showRevPrint && (() => {
        // Filter revenue by selected range; empty values = no bound
        const filteredRev = revenue.filter(r => {
          if (pdfFromDate && r.date < pdfFromDate) return false;
          if (pdfToDate   && r.date > pdfToDate)   return false;
          return true;
        });
        const fTotal = filteredRev.reduce((s,r) => s + revTotal(r), 0);
        const fGST   = filteredRev.reduce((s,r) => s + revGSTTaxable(r)/11, 0);

        // Quick presets
        const setPreset = (preset) => {
          const today = new Date(todayStr);
          const Y = today.getFullYear(), M = today.getMonth();
          const isoOf = d => d.toISOString().slice(0,10);
          if (preset === "this-month") {
            setPdfFromDate(isoOf(new Date(Y, M, 1)));
            setPdfToDate(isoOf(new Date(Y, M+1, 0)));
          } else if (preset === "last-month") {
            setPdfFromDate(isoOf(new Date(Y, M-1, 1)));
            setPdfToDate(isoOf(new Date(Y, M, 0)));
          } else if (preset === "this-quarter") {
            const qStart = Math.floor(M/3)*3;
            setPdfFromDate(isoOf(new Date(Y, qStart, 1)));
            setPdfToDate(isoOf(new Date(Y, qStart+3, 0)));
          } else if (preset === "fy-to-date") {
            // Australian FY: 1 Jul → 30 Jun
            const fyStart = M >= 6 ? new Date(Y, 6, 1) : new Date(Y-1, 6, 1);
            setPdfFromDate(isoOf(fyStart));
            setPdfToDate(todayStr);
          } else if (preset === "all") {
            setPdfFromDate(""); setPdfToDate("");
          }
        };

        return (
          <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setShowRevPrint(false); }}>
            <div className="modal" style={{maxWidth:560}}>
              <div className="m-ttl">
                Export Revenue PDF
                <button className="btn-ic" style={{fontSize:17}} onClick={() => setShowRevPrint(false)}>✕</button>
              </div>
              <div className="m-sub">Choose a date range. Leave blank for all-time.</div>

              {/* Quick presets */}
              <div className="fg" style={{marginBottom:14}}>
                <label className="flbl">Quick Range</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
                  {[
                    {k:"this-month",   l:"This Month"},
                    {k:"last-month",   l:"Last Month"},
                    {k:"this-quarter", l:"This Quarter"},
                    {k:"fy-to-date",   l:"FY to Date"},
                    {k:"all",          l:"All Time"},
                  ].map(p => (
                    <button key={p.k} className="btn-g" style={{fontSize:11,padding:"6px 11px"}} onClick={() => setPreset(p.k)}>{p.l}</button>
                  ))}
                </div>
              </div>

              {/* Date range pickers */}
              <div className="frow2">
                <div className="fg">
                  <label className="flbl">From Date</label>
                  <input className="inp" type="date" value={pdfFromDate} onChange={e => setPdfFromDate(e.target.value)}/>
                </div>
                <div className="fg">
                  <label className="flbl">To Date</label>
                  <input className="inp" type="date" value={pdfToDate} onChange={e => setPdfToDate(e.target.value)}/>
                </div>
              </div>

              {/* Preview */}
              <div style={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px",marginTop:6}}>
                <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:8}}>Preview</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                  <div>
                    <div className="mono" style={{fontSize:15,fontWeight:700,color:C.text}}>{filteredRev.length}</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>Entries</div>
                  </div>
                  <div>
                    <div className="mono" style={{fontSize:15,fontWeight:700,color:C.accent}}>{money(fTotal)}</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>Total Sales</div>
                  </div>
                  <div>
                    <div className="mono" style={{fontSize:15,fontWeight:700,color:C.yellow}}>{money(fGST)}</div>
                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>GST Collected</div>
                  </div>
                </div>
              </div>

              <div className="fbtns" style={{marginTop:18}}>
                <button
                  className="btn"
                  disabled={filteredRev.length === 0}
                  style={{opacity: filteredRev.length === 0 ? 0.5 : 1}}
                  onClick={() => {
                    const pdf = renderRevenueReportPDF({
                      filtered: filteredRev,
                      totalAll: fTotal,
                      totalGST: fGST,
                      fromDate: pdfFromDate,
                      toDate: pdfToDate,
                      bizName: localStorage.getItem("mise_biz_name") || "",
                      bizABN: localStorage.getItem("mise_biz_abn")  || "",
                    });
                    const fname = `Revenue_${pdfFromDate||"all"}_to_${pdfToDate||"now"}.pdf`;
                    pdfDownload(pdf, fname);
                    showToast("Revenue PDF downloaded!");
                    setShowRevPrint(false);
                  }}>
                  ⬇️ Download PDF
                </button>
                <button className="btn-g" onClick={() => setShowRevPrint(false)}>Cancel</button>
              </div>
              {filteredRev.length === 0 && (
                <div style={{fontSize:11,color:C.muted,marginTop:8,textAlign:"center"}}>No entries in selected range. Pick a different range or "All Time".</div>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}


// ════════════════════════════════════════════════════════════
//  EXPENSES PAGE
// ════════════════════════════════════════════════════════════
function ExpensesPage({ expenses, setExpenses, showToast, industry = "restaurant", dismissed = [], setDismissed }) {
  const [f, setF] = useState({ date:todayStr, cat:"ingredients", amount:"", desc:"", gst:"yes", gst_amount:"", invoice:"yes", invoice_date:"" });
  const [search,    setSearch]    = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterGst, setFilterGst] = useState("all");
  const [filterInv, setFilterInv] = useState("all");
  const [filterFrom,setFilterFrom]= useState("");
  const [filterTo,  setFilterTo]  = useState("");
  const [tab,       setTab]       = useState("list");
  const [historyRec, setHistoryRec] = useState(null); // expense whose audit trail is viewed

  // ── Pagination state ─────────────────────────────────────
  const [expPage,     setExpPage]     = useState(1);
  const [expPageSize, setExpPageSize] = useState(25);

  // ── Quick-entry search state ─────────────────────────────
  const [catQuery,   setCatQuery]   = useState("");
  const [showCatDrop,setShowCatDrop]= useState(false);
  const [dropFocus,  setDropFocus]  = useState(0);
  const [selCat,     setSelCat]     = useState(null);
  const [supplier,   setSupplier]   = useState("");
  const catSearchRef = useRef(null);

  // ── Smart auto-categorisation ────────────────────────────
  // customMappings: { [keyword]: categoryId } — user-taught rules
  const [customMappings, setCustomMappings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mise_cat_rules") || "{}"); } catch { return {}; }
  });
  const saveCustomMapping = (keyword, cat) => {
    const updated = { ...customMappings, [keyword.toLowerCase().trim()]: cat };
    setCustomMappings(updated);
    localStorage.setItem("mise_cat_rules", JSON.stringify(updated));
  };
  const deleteCustomMapping = (keyword) => {
    const updated = { ...customMappings };
    delete updated[keyword];
    setCustomMappings(updated);
    localStorage.setItem("mise_cat_rules", JSON.stringify(updated));
  };

  // autoSuggest: shown when desc typed and no cat manually selected
  const [autoSuggest,   setAutoSuggest]   = useState(null);  // { cat, keyword, confidence }
  const [suggestDismissed, setSuggestDismissed] = useState(false);
  // teachPrompt: "remember this?" shown after user picks cat from typed query
  const [teachPrompt,   setTeachPrompt]   = useState(null);  // { keyword, cat } or null
  // show/hide custom rules manager
  const [showRules,     setShowRules]     = useState(false);
  // track if user manually picked category (suppresses autoSuggest)
  const [manualCat,     setManualCat]     = useState(false);

  // ── Favourites / Quick-add Templates ─────────────────────
  // Template: { id, name, cat, amount, desc, supplier, gst, invoice, usageCount, lastUsed }
  const [templates, setTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mise_fav_templates") || "[]"); } catch { return []; }
  });
  const [savingTemplate,  setSavingTemplate]  = useState(false);  // show save-name input
  const [templateName,    setTemplateName]    = useState("");
  const [showAllTemplates,setShowAllTemplates]= useState(false);
  const [editingTplId,    setEditingTplId]    = useState(null);    // id of template being renamed
  const [editingTplName,  setEditingTplName]  = useState("");

  const saveTemplates = updated => {
    setTemplates(updated);
    localStorage.setItem("mise_fav_templates", JSON.stringify(updated));
  };

  const addTemplate = () => {
    if (!templateName.trim()) return;
    const tpl = {
      id: Date.now(),
      name: templateName.trim(),
      cat: f.cat,
      amount: f.amount,          // may be "" = variable
      desc: f.desc,
      supplier,
      gst: f.gst,
      invoice: f.invoice,
      usageCount: 0,
      lastUsed: null,
    };
    saveTemplates([tpl, ...templates]);
    setSavingTemplate(false);
    setTemplateName("");
    showToast(`⭐ Saved template: "${tpl.name}"`);
  };

  const applyTemplate = tpl => {
    // Fill entire form from template
    setF({ date:todayStr, cat:tpl.cat, amount:tpl.amount||"", desc:tpl.desc, gst:tpl.gst, invoice:tpl.invoice });
    setSelCat(tpl.cat);
    setManualCat(true);
    setSupplier(tpl.supplier || "");
    setCatQuery("");
    setAutoSuggest(null);
    setSuggestDismissed(true);
    setTeachPrompt(null);
    // Update usage stats
    const updated = templates.map(t => t.id === tpl.id
      ? { ...t, usageCount: (t.usageCount||0)+1, lastUsed: todayStr }
      : t
    );
    saveTemplates(updated);
    // Focus amount if it's blank (variable amount template)
    setTimeout(() => {
      if (!tpl.amount) document.getElementById("exp-amount-input")?.focus();
    }, 50);
  };

  const deleteTemplate = id => {
    saveTemplates(templates.filter(t => t.id !== id));
    showToast("Template removed");
  };

  const renameTemplate = id => {
    if (!editingTplName.trim()) return;
    saveTemplates(templates.map(t => t.id === id ? {...t, name: editingTplName.trim()} : t));
    setEditingTplId(null);
    setEditingTplName("");
  };

  // Most-recently-used templates (top 4 for the quick bar)
  const recentTemplates = [...templates]
    .sort((a,b) => {
      if (b.lastUsed && a.lastUsed) return b.lastUsed.localeCompare(a.lastUsed);
      if (b.lastUsed) return 1;
      if (a.lastUsed) return -1;
      return (b.usageCount||0) - (a.usageCount||0);
    })
    .slice(0, 4);

  // ── Recurring Expense Detector ────────────────────────────
  const thisMonthKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  const lastMonthKey = (() => {
    const d = new Date(today.getFullYear(), today.getMonth()-1, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })();

  // Normalize a description for fingerprinting — strip " — Supplier" suffix
  const fpDesc = desc => desc.replace(/\s*—\s*.+$/, '').toLowerCase().replace(/\s+/g,' ').trim().slice(0, 40);
  const makeFP  = (desc, cat) => fpDesc(desc) + "||" + cat;

  // Detect patterns: desc+cat appearing in ≥2 distinct calendar months
  const detectPatterns = expList => {
    const groups = {};
    expList.forEach(e => {
      const fp = makeFP(e.desc, e.cat);
      if (!groups[fp]) groups[fp] = [];
      groups[fp].push(e);
    });
    return Object.entries(groups)
      .filter(([, list]) => new Set(list.map(e => e.date.slice(0,7))).size >= 2)
      .map(([fp, list]) => {
        const sorted = [...list].sort((a,b) => b.date.localeCompare(a.date));
        const latest = sorted[0];
        const amounts = list.map(e => e.amount);
        const avgAmount = amounts.reduce((s,v)=>s+v,0) / amounts.length;
        return {
          fp, cat: latest.cat,
          label: fpDesc(latest.desc),
          latestAmount: latest.amount,
          avgAmount: Math.round(avgAmount * 100) / 100,
          gst: latest.gst, invoice: latest.invoice,
          lastDate: latest.date,
          monthsSeen: [...new Set(list.map(e=>e.date.slice(0,7)))].sort().reverse(),
        };
      });
  };

  // recurringRules: user-confirmed recurring items
  // { fp, cat, label, amount, gst, invoice, active, createdAt }
  const [recurringRules,    setRecurringRules]    = useState(() => {
    try { return JSON.parse(localStorage.getItem("mise_recurring") || "[]"); } catch { return []; }
  });
  const [dismissedNudges,   setDismissedNudges]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("mise_recur_dismissed") || "[]"); } catch { return []; }
  });
  const [postAddNudge,      setPostAddNudge]      = useState(null); // { fp, cat, label, amount }
  const [showRecurMgr,      setShowRecurMgr]      = useState(false);
  const [confirmingRule,    setConfirmingRule]     = useState(null); // rule being confirmed — { rule, amount }

  const saveRecurringRules = updated => {
    setRecurringRules(updated);
    localStorage.setItem("mise_recurring", JSON.stringify(updated));
  };
  const saveDismissedNudges = updated => {
    setDismissedNudges(updated);
    localStorage.setItem("mise_recur_dismissed", JSON.stringify(updated));
  };

  const addRecurringRule = (pattern, overrideAmount) => {
    const rule = {
      fp:       pattern.fp,
      cat:      pattern.cat,
      label:    pattern.label,
      amount:   overrideAmount ?? pattern.latestAmount,
      gst:      pattern.gst,
      invoice:  pattern.invoice,
      active:   true,
      createdAt: todayStr,
    };
    saveRecurringRules([rule, ...recurringRules.filter(r => r.fp !== pattern.fp)]);
    setPostAddNudge(null);
    showToast(`🔁 Recurring: "${rule.label}" added`);
  };

  // Confirmed fps
  const confirmedFPs = new Set(recurringRules.map(r => r.fp));

  // Auto-detected patterns not yet confirmed or dismissed
  const detectedPatterns = detectPatterns(expenses)
    .filter(p => !confirmedFPs.has(p.fp) && !dismissedNudges.includes(p.fp));

  // Rules due this month (active, no matching expense this month)
  const recurringDue = recurringRules.filter(rule => {
    if (!rule.active) return false;
    return !expenses.some(e => e.date.startsWith(thisMonthKey) && makeFP(e.desc, e.cat) === rule.fp);
  });

  // Apply a recurring rule → fill the form
  const applyRecurringRule = rule => {
    setF({ date: todayStr, cat: rule.cat, amount: String(rule.amount), desc: rule.label, gst: rule.gst ? "yes":"no", invoice: rule.invoice ? "yes":"no" });
    setSelCat(rule.cat);
    setManualCat(true);
    setAutoSuggest(null); setSuggestDismissed(true);
    setTeachPrompt(null);
    setConfirmingRule(null);
    setTimeout(() => document.getElementById("exp-amount-input")?.focus(), 60);
  };

  // ── Industry-aware category sorting ─────────────────────
  // Shared finance/admin tail — all industries
  const FINANCE_CATS = ["bank_fees","merchant_fees","telephone_internet","insurance_expense","interest_expense","loan_repayment","motor_vehicle","legal","license_fees","council_rates","freight","travel","printing","office_expenses","supplies","fees_charges","depreciation","fixed_assets","general_expenses"];

  const INDUSTRY_MAP = {
    restaurant: ["ingredients","food_stock","packaging","cleaning","rent","utilities","equipment","repairs","staff_uniforms","delivery_fees","smallwares","linen","software","advertising","accounting","music_ent",...FINANCE_CATS,"other"],
    café:       ["coffee_supplies","machine_maintenance","eco_packaging","bakery_supplies","food_stock","packaging","cleaning","rent","utilities","equipment","repairs","staff_uniforms","delivery_fees","smallwares","software","advertising","accounting",...FINANCE_CATS,"other"],
    bar:        ["spirit_stock","beer_wine_stock","glassware","bar_equipment","liquor_license","rsa_training","cleaning","rent","utilities","equipment","repairs","staff_uniforms","music_ent","software","advertising","accounting",...FINANCE_CATS,"other"],
    other:      EXP_CATEGORIES,
  };
  // Infer a known industry bucket from free-text business type (keyword match).
  // This lets owners type "Hot Pot Restaurant" or "火锅店" and still get the
  // restaurant category ordering, while unmatched text falls back to "other".
  const inferIndustryBucket = (raw) => {
    if (raw === "restaurant" || raw === "café" || raw === "bar" || raw === "other") return raw;
    const t = (raw || "").toLowerCase();
    if (/caf[eé]|咖啡|coffee|bakery|烘焙|面包|dessert|甜/.test(t))                  return "café";
    if (/bar|酒吧|pub|brewery|tavern|liquor|wine|啤酒/.test(t))                     return "bar";
    if (/restaurant|餐厅|餐館|餐馆|diner|eatery|hot ?pot|火锅|noodle|面|grill|food/.test(t)) return "restaurant";
    return "other";
  };
  const industryBucket = inferIndustryBucket(industry);
  const sortedCats   = INDUSTRY_MAP[industryBucket] || EXP_CATEGORIES;
  const PINNED_COUNT = { restaurant:4, café:4, bar:6, other:0 }[industryBucket] || 0;
  const pinnedCats   = sortedCats.slice(0, PINNED_COUNT);

  // ── Usage-based personalised sorting ─────────────────────
  // catUsage: { [catId]: count } — incremented on every Add Expense
  const [catUsage, setCatUsage] = useState(() => {
    try { return JSON.parse(localStorage.getItem("mise_cat_usage") || "{}"); } catch { return {}; }
  });

  const trackCatUsage = cat => {
    const updated = { ...catUsage, [cat]: (catUsage[cat] || 0) + 1 };
    setCatUsage(updated);
    localStorage.setItem("mise_cat_usage", JSON.stringify(updated));
  };

  // Re-rank industry order by usage. Ties preserve industry position.
  const personalSortedCats = [...sortedCats].sort((a, b) => {
    const ua = catUsage[a] || 0;
    const ub = catUsage[b] || 0;
    if (ub !== ua) return ub - ua;
    return sortedCats.indexOf(a) - sortedCats.indexOf(b);
  });

  // Has the user added at least one expense? (gate for "Your top picks" label)
  const hasPersonalData = Object.values(catUsage).some(v => v > 0);

  // Top 5 personal picks (or fall back to industry pins before first use)
  const TOP_PICKS_COUNT = 5;
  const topPickCats = hasPersonalData
    ? personalSortedCats.slice(0, TOP_PICKS_COUNT)
    : pinnedCats.slice(0, TOP_PICKS_COUNT);

  // Rank map for the top 3 — used for badges in dropdown
  const catRank = {};
  if (hasPersonalData) {
    personalSortedCats.slice(0, 3).forEach((id, i) => { catRank[id] = i + 1; });
  }

  const catLabel = cat => {
    const cfg = CAT_CONFIG[cat];
    const isCOGS = COGS_CATS.has(cat);
    const base = cfg ? `${cfg.emoji} ${cfg.label}` : cat.charAt(0).toUpperCase()+cat.slice(1);
    return isCOGS ? `${base} · COGS` : base;
  };

  // ── Category search (with smart keyword boost + usage rank) ──
  const catResults = catQuery.trim().length === 0 ? [] : (() => {
    const q = catQuery.toLowerCase().trim();
    const smart = detectCategory(q, customMappings);
    const seen  = new Set();
    const results = [];

    // 1. Smart / custom match first
    if (smart && !seen.has(smart.cat)) {
      seen.add(smart.cat);
      results.push({ id: smart.cat, c: CAT_CONFIG[smart.cat], smartMatch: smart });
    }

    // 2. Label / tag matches, ordered by usage rank (personalSortedCats)
    personalSortedCats.forEach(id => {
      if (seen.has(id)) return;
      const c = CAT_CONFIG[id];
      if (!c) return;
      const match = c.label.toLowerCase().includes(q)
        || id.includes(q)
        || (c.tags || []).some(t => t.includes(q));
      if (match) { seen.add(id); results.push({ id, c, smartMatch: null }); }
    });

    return results.slice(0, 8);
  })();

  const pickCat = (id, fromQuery) => {
    setSelCat(id);
    setManualCat(true);
    // Auto-apply GST default for this category
    const gstDefault = CAT_GST_DEFAULT[id];
    setF(p => ({...p, cat:id, gst: gstDefault != null ? (gstDefault ? "yes" : "no") : p.gst }));
    const query = fromQuery ?? catQuery;
    setCatQuery("");
    setShowCatDrop(false);
    setDropFocus(0);
    setSupplier("");
    setAutoSuggest(null);
    setSuggestDismissed(false);

    // Offer to teach if the user typed something that isn't already in tags for this cat
    if (query && query.trim().length > 2) {
      const q = query.toLowerCase().trim();
      const cfg = CAT_CONFIG[id];
      const alreadyKnown = cfg && ((cfg.tags||[]).some(t => t.includes(q)) || id.includes(q) || cfg.label.toLowerCase().includes(q));
      const alreadyCustom = Object.keys(customMappings).some(k => k === q);
      if (!alreadyKnown && !alreadyCustom && !SMART_KEYWORDS[q]) {
        setTeachPrompt({ keyword: query.trim(), cat: id });
      } else {
        setTeachPrompt(null);
      }
    } else {
      setTeachPrompt(null);
    }
  };

  const catKeyDown = e => {
    if (!showCatDrop || catResults.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setDropFocus(f => Math.min(f+1, catResults.length-1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setDropFocus(f => Math.max(f-1, 0)); }
    if (e.key === "Enter")     { e.preventDefault(); pickCat(catResults[dropFocus].id); }
    if (e.key === "Escape")    { setShowCatDrop(false); setCatQuery(""); }
  };

  const catSuppliers = selCat ? (COMMON_SUPPLIERS[selCat] || []) : [];
  const selCatCfg    = selCat ? CAT_CONFIG[selCat] : null;

  // ── Smart description detection ──────────────────────────
  const handleDescChange = val => {
    setF(p => ({...p, desc:val}));
    if (!manualCat && !suggestDismissed && val.trim().length > 3) {
      const detected = detectCategory(val, customMappings);
      if (detected && detected.cat !== selCat) setAutoSuggest(detected);
      else setAutoSuggest(null);
    } else {
      setAutoSuggest(null);
    }
  };

  const acceptSuggest = () => {
    if (!autoSuggest) return;
    pickCat(autoSuggest.cat, autoSuggest.keyword);
  };

  const add = () => {
    if (!f.amount || !f.desc) return;
    const fullDesc = f.desc + (supplier ? ` — ${supplier}` : "");
    const fp = makeFP(fullDesc, f.cat);

    // Check BEFORE setExpenses (expenses still = current list)
    const seenLastMonth  = expenses.some(e => e.date.startsWith(lastMonthKey) && makeFP(e.desc, e.cat) === fp);
    const alreadyRule    = confirmedFPs.has(fp);
    const alreadyDismiss = dismissedNudges.includes(fp);

    setExpenses(p => [...p, {
      id:Date.now(), date:f.date, cat:f.cat,
      amount:parseFloat(f.amount)||0,
      desc: fullDesc,
      gst: f.gst !== "no",
      ...(f.gst === "partial" ? { gst_amount: parseFloat(f.gst_amount)||0 } : {}),
      invoice:f.invoice==="yes"
    }]);
    trackCatUsage(f.cat);

    // Fire post-add nudge if pattern seen last month and not already tracked
    if (seenLastMonth && !alreadyRule && !alreadyDismiss) {
      setPostAddNudge({
        fp, cat: f.cat,
        label: fpDesc(fullDesc),
        latestAmount: parseFloat(f.amount)||0,
        avgAmount: parseFloat(f.amount)||0,
        gst: f.gst === "yes", invoice: f.invoice === "yes",
        monthsSeen: [lastMonthKey, thisMonthKey],
        lastDate: f.date,
      });
    }

    setF({ date:todayStr, cat: personalSortedCats[0] || "ingredients", amount:"", desc:"", gst:"yes", gst_amount:"", invoice:"yes" });
    setSelCat(null); setSupplier(""); setCatQuery("");
    setAutoSuggest(null); setSuggestDismissed(false);
    setTeachPrompt(null); setManualCat(false);
    setSavingTemplate(false); setTemplateName("");
    showToast("Expense added!");
    catSearchRef.current?.focus();
  };

  // One-click direct add — bypasses form, used by templates & recurring with fixed amounts
  const addDirect = ({ cat, amount, desc, gst, invoice }) => {
    if (!amount || !desc) return;
    setExpenses(p => [...p, {
      id:Date.now(), date:todayStr, cat,
      amount:parseFloat(amount)||0,
      desc, gst:!!gst, invoice:!!invoice,
    }]);
    trackCatUsage(cat);
    showToast(`✓ Added: ${desc} — ${money(parseFloat(amount)||0)}`);
  };

  // ── Stats ────────────────────────────────────────────────
  const totalExp    = expenses.reduce((s,e) => s + e.amount, 0);
  const gstCreds    = expenses.filter(e => e.gst && e.invoice).reduce((s,e) => s + expGST(e), 0);
  const missingInv  = expenses.filter(e => e.gst && !e.invoice);
  const missingCred = missingInv.reduce((s,e) => s + expGST(e), 0);
  const entFlag     = expenses.filter(e => ["entertainment","meals"].includes(e.cat));
  const largeNoInv  = expenses.filter(e => e.amount >= 82.50 && !e.invoice);

  // ── Alerts ───────────────────────────────────────────────
  const alerts = [
    missingInv.length > 0 && {
      id:"missing-inv", level:"red",
      title:`${missingInv.length} expense${missingInv.length>1?"s":""} missing a tax invoice`,
      body:`You may lose ${money(missingCred)} in GST credits. ATO requires a tax invoice for any GST claim over $82.50.`,
      action:"Filter Missing Invoices", actionFn:() => { setFilterInv("no"); setTab("list"); }
    },
    largeNoInv.length > 0 && {
      id:"large-no-inv", level:"yellow",
      title:`${largeNoInv.length} expense${largeNoInv.length>1?"s":""} over $82.50 without invoice`,
      body:`These expenses exceed the ATO invoice threshold. Get invoices ASAP or you cannot claim GST credits.`,
      action:"Show These", actionFn:() => { setFilterInv("no"); setTab("list"); }
    },
    entFlag.length > 0 && {
      id:"entertainment", level:"yellow",
      title:`${entFlag.length} entertainment/meal expense${entFlag.length>1?"s":""} flagged`,
      body:`Entertainment expenses are only 50% tax deductible. Make sure these are genuine business entertainment, not personal meals.`,
      action:null, actionFn:null
    },
  ].filter(Boolean).filter(a => !dismissed.includes(a.id));

  // ── Filtering ────────────────────────────────────────────
  const filtered = expenses.filter(e => {
    if (search    && !e.desc.toLowerCase().includes(search.toLowerCase()) && !e.cat.includes(search.toLowerCase())) return false;
    if (filterCat !== "all" && e.cat !== filterCat) return false;
    if (filterGst !== "all" && String(e.gst) !== filterGst) return false;
    if (filterInv !== "all" && String(e.invoice) !== filterInv) return false;
    if (filterFrom && e.date < filterFrom) return false;
    if (filterTo   && e.date > filterTo)   return false;
    return true;
  }).slice().sort((a,b) => (b.date||"").localeCompare(a.date||""));

  const hasFilters = search || filterCat !== "all" || filterGst !== "all" || filterInv !== "all" || filterFrom || filterTo;
  const clearFilters = () => { setSearch(""); setFilterCat("all"); setFilterGst("all"); setFilterInv("all"); setFilterFrom(""); setFilterTo(""); };

  // ── Chart data ───────────────────────────────────────────
  const byCat = EXP_CATEGORIES.map(cat => ({
    label: (CAT_CONFIG[cat]?.emoji ? CAT_CONFIG[cat].emoji + ' ' : '') + (CAT_CONFIG[cat]?.label || cat.charAt(0).toUpperCase()+cat.slice(1)),
    v: expenses.filter(e => e.cat === cat).reduce((s,e) => s+e.amount, 0)
  })).filter(d => d.v > 0).sort((a,b) => b.v - a.v);

  // Monthly trend (last 6 months)
  const now = new Date();
  const months = Array.from({length:6}, (_,i) => {
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
    return { label: d.toLocaleString('en-AU',{month:'short'}), key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` };
  });
  const monthlyData = months.map(m => ({
    label: m.label,
    v: expenses.filter(e => e.date.startsWith(m.key)).reduce((s,e) => s+e.amount, 0)
  }));

  // ── CSV Export ───────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ["Date","Category","Description","Amount","GST Credit","Invoice on File"],
      ...filtered.map(e => [e.date, e.cat, `"${e.desc}"`, e.amount.toFixed(2), expGST(e).toFixed(2), e.invoice ? "Yes" : "No"])
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const a   = document.createElement("a");
    a.href     = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `mise-expenses-${todayStr}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast("CSV exported!");
  };

  // ── Export PDF ───────────────────────────────────────────
  const [showExpPrint, setShowExpPrint] = useState(false);
  const ExpensePrintContent = () => (
    <div className="pp-page">
      <PPHeader title="Expense Report" subtitle={hasFilters ? "Filtered View" : "All Expenses"}/>
      <div style={{ display:"flex", gap:20, flexWrap:"wrap", marginBottom:20 }}>
        {[
          { lbl:"Total Expenses",           val:money(totalExp),    col:"#111" },
          { lbl:"GST Credits (with invoice)",val:money(gstCreds),   col:"#16A34A" },
          { lbl:"Missing Invoice Credits",   val:money(missingCred),col:"#DC2626" },
          { lbl:"Entries",                   val:String(filtered.length), col:"#111" },
        ].map((s,i) => (
          <div key={i} style={{ background:"#F9FAFB", border:"1px solid #E5E7EB", borderRadius:8, padding:"10px 16px", minWidth:130 }}>
            <div style={{ fontSize:9.5, color:"#9CA3AF", textTransform:"uppercase", fontWeight:700, letterSpacing:".5px" }}>{s.lbl}</div>
            <div style={{ fontFamily:"DM Mono,monospace", fontSize:17, fontWeight:700, color:s.col, marginTop:3 }}>{s.val}</div>
          </div>
        ))}
      </div>
      <table className="pp-tbl">
        <thead><tr><th>Date</th><th>Category</th><th>Description</th><th style={{textAlign:"right"}}>Amount</th><th style={{textAlign:"right"}}>GST Credit</th><th>Invoice</th></tr></thead>
        <tbody>
          {filtered.map(e => (
            <tr key={e.id}>
              <td style={{fontSize:11}}>{e.date}</td>
              <td>{e.cat}</td>
              <td style={{color:"#6B7280"}}>{e.desc}</td>
              <td style={{textAlign:"right",fontFamily:"DM Mono,monospace",fontWeight:600}}>{money(e.amount)}</td>
              <td style={{textAlign:"right",fontFamily:"DM Mono,monospace",color: e.gst && e.invoice ? "#16A34A" : "#9CA3AF"}}>{e.gst ? money(expGST(e)) : "—"}</td>
              <td>{e.invoice ? "✅ Yes" : "❌ No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <PPDisclaimer/>
    </div>
  );

  const ALERT_COLORS = { red:{ bg:"rgba(224,96,96,.1)", border:"rgba(224,96,96,.3)", dot:C.red }, yellow:{ bg:"rgba(212,168,67,.1)", border:"rgba(212,168,67,.3)", dot:C.yellow } };

  return (
    <>
      {historyRec && <HistoryModal record={historyRec} label={`Expense — ${historyRec.desc || historyRec.date}`} onClose={() => setHistoryRec(null)}/>}
      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">Expense Tracking</div><div className="psub">Track business expenses, GST credits and deductions</div></div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn-g" onClick={exportCSV}>⬇️ Export CSV</button>
          <button className="btn-g" onClick={() => setShowExpPrint(true)}>⬇️ Export PDF</button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {alerts.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
          {alerts.map(a => {
            const col = ALERT_COLORS[a.level];
            return (
              <div key={a.id} style={{ background:col.bg, border:`1px solid ${col.border}`, borderRadius:11, padding:"12px 15px", display:"flex", alignItems:"flex-start", gap:12 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:col.dot, marginTop:4, flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:13, marginBottom:3 }}>{a.title}</div>
                  <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>{a.body}</div>
                  {a.action && <button onClick={a.actionFn} style={{ marginTop:7, fontSize:11, fontWeight:700, color:col.dot, background:"none", border:`1px solid ${col.border}`, borderRadius:6, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit" }}>{a.action} →</button>}
                </div>
                <button onClick={() => setDismissed(p => [...p, a.id])} style={{ background:"none", border:"none", color:C.dim, cursor:"pointer", fontSize:14, padding:"0 2px", lineHeight:1 }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="g3" style={{ gridTemplateColumns:"repeat(4,1fr)" }}>
        {[
          { lbl:"Total Expenses",        val:money(totalExp),      cls:"r" },
          { lbl:"GST Credits (invoiced)",val:money(gstCreds),      cls:"g" },
          { lbl:"Credits at Risk",       val:money(missingCred),   cls:"y" },
          { lbl:"Entries",               val:expenses.length,      cls:"b" },
        ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
      </div>

      {/* ── Industry mode banner ── */}
      {industry !== "other" && (
        <div style={{ background:"rgba(143,203,114,.08)", border:"1px solid rgba(143,203,114,.2)", borderRadius:10, padding:"10px 14px", marginBottom:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:12, color:C.muted }}>
            <span style={{ fontWeight:700, color:C.accent }}>
              {{ restaurant:"🍽️ Restaurant", café:"☕ Café", bar:"🍺 Bar / Pub" }[industry]} mode
            </span>
            {" — "}
            {{ restaurant:"Food & kitchen categories pinned to top", café:"Coffee & bakery categories pinned to top", bar:"Liquor & bar categories pinned to top" }[industry]}
          </div>
          <span style={{ fontSize:10, color:C.dim }}>Change in Settings →</span>
        </div>
      )}

      {/* ── Recurring: First-time discovery prompt ── */}
      {recurringRules.length === 0 && expenses.length >= 3 && (
        <div style={{ background:"rgba(143,203,114,.05)", border:"1px dashed rgba(143,203,114,.4)", borderRadius:11, padding:"12px 15px", marginBottom:12, display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:22, flexShrink:0 }}>🔁</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12.5, fontWeight:700, color:C.accent, marginBottom:3 }}>Set up recurring expenses</div>
            <div style={{ fontSize:11.5, color:C.muted }}>Rent, utilities, coffee supplies — add them once and Mise reminds you every month with one-click logging.</div>
          </div>
          <button onClick={() => {
            // Pre-fill form with the most recent expense as a starting point
            const last = expenses[expenses.length - 1];
            if (last) setF(f => ({...f, cat:last.cat, desc:last.desc, amount:String(last.amount), gst:last.gst?"yes":"no", invoice:last.invoice?"yes":"no"}));
            window.scrollTo({ top: document.body.scrollHeight, behavior:"smooth" });
          }} style={{ background:"rgba(143,203,114,.15)", border:`1px solid rgba(143,203,114,.4)`, borderRadius:8, padding:"7px 13px", fontSize:11.5, fontWeight:700, color:C.accent, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
            Set up →
          </button>
        </div>
      )}

      {/* ── Recurring: Due This Month panel ── */}
      {recurringDue.length > 0 && (
        <div style={{ background:"rgba(61,201,160,.05)", border:"1px solid rgba(61,201,160,.3)", borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#3DC9A0" }}>🔁 Recurring expenses due this month</div>
            <div style={{ fontSize:11, color:C.dim }}>{recurringDue.length} item{recurringDue.length>1?"s":""} not yet logged</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            {recurringDue.map(rule => (
              <div key={rule.fp} style={{ display:"flex", alignItems:"center", gap:10, background:C.surface, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 13px" }}>
                <span style={{ fontSize:17 }}>{CAT_CONFIG[rule.cat]?.emoji}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, textTransform:"capitalize" }}>{rule.label}</div>
                  <div style={{ fontSize:11, color:C.dim, marginTop:1 }}>
                    {CAT_CONFIG[rule.cat]?.label} · {money(rule.amount)} · GST: {rule.gst?"yes":"no"} · Invoice: {rule.invoice?"yes":"no"}
                  </div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  {/* ⚡ One-click: add directly with last amount */}
                  <button onClick={() => addDirect({ cat:rule.cat, amount:rule.amount, desc:rule.label, gst:rule.gst, invoice:rule.invoice })}
                    style={{ background:"rgba(61,201,160,.15)", color:"#3DC9A0", border:"1px solid rgba(61,201,160,.45)", borderRadius:7, padding:"6px 13px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                    ⚡ {money(rule.amount)}
                  </button>
                  {/* Fill form: use different amount */}
                  <button onClick={() => applyRecurringRule(rule)}
                    style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"6px 10px", fontSize:11, color:C.muted, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                    Edit →
                  </button>
                  <button onClick={() => saveRecurringRules(recurringRules.map(r => r.fp===rule.fp ? {...r, active:false} : r))}
                    style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"6px 9px", fontSize:11, color:C.dim, cursor:"pointer", fontFamily:"inherit" }}>
                    Pause
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Auto-detected patterns: subtle banner ── */}
      {detectedPatterns.length > 0 && !detectedPatterns.every(p => dismissedNudges.includes(p.fp)) && (
        <div style={{ background:"rgba(143,203,114,.05)", border:"1px solid rgba(143,203,114,.25)", borderRadius:11, padding:"11px 15px", marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.accent, marginBottom:8 }}>
            🔁 Mise noticed {detectedPatterns.length} recurring pattern{detectedPatterns.length>1?"s":""}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {detectedPatterns.slice(0,3).map(p => (
              <div key={p.fp} style={{ display:"flex", alignItems:"center", gap:9, flexWrap:"wrap" }}>
                <span style={{ fontSize:15 }}>{CAT_CONFIG[p.cat]?.emoji}</span>
                <div style={{ flex:1, minWidth:120 }}>
                  <span style={{ fontSize:12, fontWeight:600, textTransform:"capitalize" }}>{p.label}</span>
                  <span style={{ fontSize:11, color:C.dim }}> · seen in {p.monthsSeen.length} months · avg {money(p.avgAmount)}</span>
                </div>
                <div style={{ display:"flex", gap:5 }}>
                  <button onClick={() => addRecurringRule(p)}
                    style={{ fontSize:11, fontWeight:700, background:"rgba(143,203,114,.15)", color:C.accent, border:`1px solid rgba(143,203,114,.4)`, borderRadius:6, padding:"4px 11px", cursor:"pointer", fontFamily:"inherit" }}>
                    Track it 🔁
                  </button>
                  <button onClick={() => { const u=[...dismissedNudges,p.fp]; saveDismissedNudges(u); }}
                    style={{ fontSize:11, color:C.muted, background:"none", border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 8px", cursor:"pointer", fontFamily:"inherit" }}>
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Entry Form ── */}
      <div className="fsec">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div className="ftit" style={{ marginBottom:0 }}>Add Expense</div>
          {templates.length > 0 && (
            <button onClick={() => setShowAllTemplates(v=>!v)}
              style={{ fontSize:11, fontWeight:700, color:C.accent, background:"none", border:`1px solid rgba(143,203,114,.4)`, borderRadius:7, padding:"4px 11px", cursor:"pointer", fontFamily:"inherit" }}>
              ⭐ {templates.length} template{templates.length>1?"s":""}  {showAllTemplates?"▲":"▼"}
            </button>
          )}
        </div>

        {/* ── Recent expenses quick-reuse bar ── */}
        {(() => {
          const recent = expenses.slice().reverse().filter((e,i,arr) =>
            arr.findIndex(x => x.cat===e.cat && x.desc===e.desc) === i
          ).slice(0, 5);
          if (recent.length === 0) return null;
          return (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:".6px", marginBottom:7 }}>
                🕐 Recent — tap to reuse
              </div>
              <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                {recent.map((e,i) => {
                  const cfg = CAT_CONFIG[e.cat];
                  return (
                    <button key={i} onClick={() => setF(f => ({
                      ...f, cat:e.cat, desc:e.desc, amount:String(e.amount),
                      gst: e.gst_amount != null ? "partial" : (e.gst ? "yes" : "no"),
                      gst_amount: e.gst_amount != null ? String(e.gst_amount) : "",
                      invoice: e.invoice ? "yes" : "no"
                    }))}
                      style={{
                        display:"flex", alignItems:"center", gap:6, padding:"6px 11px",
                        background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:9,
                        cursor:"pointer", fontFamily:"inherit", fontSize:11, color:C.text,
                        transition:"all .15s",
                      }}>
                      <span style={{ fontSize:13 }}>{cfg?.emoji||"📎"}</span>
                      <div style={{ textAlign:"left" }}>
                        <div style={{ fontWeight:600, lineHeight:1.2 }}>{e.desc?.slice(0,22)||(cfg?.label||e.cat)}</div>
                        <div style={{ fontSize:9.5, color:C.muted }}>{money(e.amount)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Templates quick bar — all templates, sorted by recent use ── */}
        {templates.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
              <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:".6px" }}>⭐ Templates — click to fill form, ⚡ to add instantly</div>
              <button onClick={() => setShowAllTemplates(v=>!v)}
                style={{ fontSize:10, color:C.muted, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>
                {showAllTemplates ? "▲ less" : `▼ ${templates.length > 4 ? `show all ${templates.length}` : ""}`}
              </button>
            </div>
            <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
              {(showAllTemplates ? templates : [...templates].sort((a,b) => {
                if (b.lastUsed && a.lastUsed) return b.lastUsed.localeCompare(a.lastUsed);
                if (b.lastUsed) return 1; if (a.lastUsed) return -1;
                return (b.usageCount||0)-(a.usageCount||0);
              }).slice(0,8)).map(tpl => (
                <div key={tpl.id} style={{ display:"flex", borderRadius:9, border:`1.5px solid rgba(212,168,67,.4)`, overflow:"hidden" }}>
                  {/* Fill form button */}
                  <button onClick={() => applyTemplate(tpl)}
                    style={{ background:"rgba(212,168,67,.07)", color:C.text, border:"none", padding:"7px 11px", fontSize:12, fontFamily:"inherit", cursor:"pointer", display:"flex", alignItems:"center", gap:6, transition:"all .15s" }}
                    onMouseEnter={e => e.currentTarget.style.background="rgba(212,168,67,.15)"}
                    onMouseLeave={e => e.currentTarget.style.background="rgba(212,168,67,.07)"}>
                    <span style={{ fontSize:15 }}>{CAT_CONFIG[tpl.cat]?.emoji}</span>
                    <div style={{ textAlign:"left" }}>
                      <div style={{ fontWeight:700, fontSize:11, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:120 }}>{tpl.name}</div>
                      <div style={{ fontSize:9.5, color:C.dim, marginTop:1 }}>
                        {tpl.amount ? `$${tpl.amount}` : "variable"} · {CAT_CONFIG[tpl.cat]?.label}
                      </div>
                    </div>
                  </button>
                  {/* ⚡ One-click add (only for fixed amount templates) */}
                  {tpl.amount && (
                    <button onClick={() => addDirect({ cat:tpl.cat, amount:tpl.amount, desc:tpl.desc||(tpl.name), gst:tpl.gst==="yes", invoice:tpl.invoice==="yes" })}
                      title={`Add ${tpl.name} — $${tpl.amount} directly`}
                      style={{ background:"rgba(212,168,67,.18)", color:C.yellow, border:"none", borderLeft:`1px solid rgba(212,168,67,.35)`, padding:"7px 10px", fontSize:13, cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}
                      onMouseEnter={e => e.currentTarget.style.background="rgba(212,168,67,.32)"}
                      onMouseLeave={e => e.currentTarget.style.background="rgba(212,168,67,.18)"}>
                      ⚡
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Full templates manager (expanded) ── */}
        {showAllTemplates && (
          <div style={{ marginBottom:16, background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:".6px", marginBottom:12 }}>⭐ All Templates</div>
            {templates.length === 0 && (
              <div style={{ fontSize:13, color:C.dim, textAlign:"center", padding:"16px 0" }}>No templates yet — fill the form and click "Save as Template"</div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {templates.map(tpl => (
                <div key={tpl.id} style={{ display:"flex", alignItems:"center", gap:10, background:C.surface, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 13px" }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>{CAT_CONFIG[tpl.cat]?.emoji}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    {editingTplId === tpl.id ? (
                      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                        <input className="inp" value={editingTplName} onChange={e => setEditingTplName(e.target.value)}
                          onKeyDown={e => { if(e.key==="Enter") renameTemplate(tpl.id); if(e.key==="Escape") setEditingTplId(null); }}
                          style={{ flex:1, fontSize:12, padding:"4px 8px" }} autoFocus/>
                        <button onClick={() => renameTemplate(tpl.id)}
                          style={{ fontSize:11, fontWeight:700, color:C.accent, background:"none", border:`1px solid rgba(143,203,114,.4)`, borderRadius:6, padding:"3px 9px", cursor:"pointer", fontFamily:"inherit" }}>Save</button>
                        <button onClick={() => setEditingTplId(null)}
                          style={{ fontSize:11, color:C.muted, background:"none", border:"none", cursor:"pointer" }}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontWeight:700, fontSize:12.5 }}>{tpl.name}</div>
                        <div style={{ fontSize:11, color:C.dim, marginTop:2 }}>
                          {CAT_CONFIG[tpl.cat]?.label}
                          {tpl.amount ? ` · $${tpl.amount}` : " · variable amount"}
                          {tpl.supplier ? ` · ${tpl.supplier}` : ""}
                          {" · "}GST: {tpl.gst==="yes"?"yes":"no"}
                          {" · "}Invoice: {tpl.invoice==="yes"?"yes":"no"}
                          {tpl.usageCount > 0 && <span style={{ color:C.accent }}> · used {tpl.usageCount}×</span>}
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                    <button onClick={() => { applyTemplate(tpl); setShowAllTemplates(false); }}
                      style={{ fontSize:11, fontWeight:700, background:C.accent, color:"#0C0F0D", border:"none", borderRadius:6, padding:"5px 11px", cursor:"pointer", fontFamily:"inherit" }}>
                      Use ↵
                    </button>
                    <button onClick={() => { setEditingTplId(tpl.id); setEditingTplName(tpl.name); }}
                      style={{ fontSize:11, color:C.muted, background:"none", border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 8px", cursor:"pointer", fontFamily:"inherit" }}>
                      ✎
                    </button>
                    <button onClick={() => deleteTemplate(tpl.id)}
                      style={{ fontSize:11, color:C.red, background:"none", border:`1px solid rgba(224,96,96,.3)`, borderRadius:6, padding:"5px 8px", cursor:"pointer", fontFamily:"inherit" }}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category search */}
        <div style={{ position:"relative", marginBottom: selCat ? 10 : 14 }}>
          <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:C.muted, fontSize:14, pointerEvents:"none" }}>🔍</span>
          <input
            ref={catSearchRef}
            className="inp"
            style={{ paddingLeft:36, paddingRight: catQuery ? 36 : 14 }}
            placeholder={`Search category… try "coffee", "keg", "uber eats", "rsa"…`}
            value={catQuery}
            onChange={e => { setCatQuery(e.target.value); setShowCatDrop(true); setDropFocus(0); }}
            onFocus={() => setShowCatDrop(true)}
            onBlur={() => setTimeout(() => setShowCatDrop(false), 150)}
            onKeyDown={catKeyDown}
            autoComplete="off"
          />
          {catQuery && (
            <button onClick={() => { setCatQuery(""); setSelCat(null); setF(p=>({...p,cat:personalSortedCats[0]||"ingredients"})); }}
              style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:15, padding:"2px 6px" }}>✕</button>
          )}

          {/* Dropdown */}
          {showCatDrop && catResults.length > 0 && (
            <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, zIndex:50, overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,.5)" }}>
              {catResults.map(({id, c, smartMatch}, i) => (
                <div key={id}
                  onMouseDown={() => pickCat(id)}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", cursor:"pointer", borderBottom:`1px solid ${C.border}`, background: i===dropFocus ? C.surfaceAlt : selCat===id ? "rgba(143,203,114,.08)" : "transparent", transition:"background .1s" }}>
                  <span style={{ fontSize:18, width:24, textAlign:"center" }}>{c.emoji}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>{c.label}</div>
                    <div style={{ fontSize:10.5, color:C.dim, marginTop:1 }}>{(c.tags||[]).slice(0,4).join(" · ")}</div>
                  </div>
                  <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                    {smartMatch?.confidence === "custom" && <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10, background:"rgba(61,201,160,.15)", color:"#3DC9A0" }}>★ Your rule</span>}
                    {smartMatch?.confidence === "high" && <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10, background:"rgba(143,203,114,.18)", color:C.accent }}>✦ Smart match</span>}
                    {!smartMatch && catRank[id] === 1 && <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10, background:"rgba(143,203,114,.22)", color:C.accent }}>⚡ #1</span>}
                    {!smartMatch && catRank[id] === 2 && <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10, background:"rgba(143,203,114,.14)", color:C.accent }}>#2</span>}
                    {!smartMatch && catRank[id] === 3 && <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10, background:"rgba(143,203,114,.09)", color:C.dim }}>#3</span>}
                    {!smartMatch && !catRank[id] && pinnedCats.includes(id) && !hasPersonalData && <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:10, background:"rgba(143,203,114,.15)", color:C.accent }}>★ Top</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {showCatDrop && catQuery.trim().length > 1 && catResults.length === 0 && (
            <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, zIndex:50, padding:"14px", boxShadow:"0 8px 24px rgba(0,0,0,.5)" }}>
              <div style={{ fontSize:13, color:C.dim, marginBottom:8 }}>No category found for "<strong style={{color:C.text}}>{catQuery}</strong>"</div>
              <div style={{ fontSize:11.5, color:C.muted }}>💡 Pick a category below, then Mise will ask to remember "{catQuery}" for next time.</div>
            </div>
          )}
        </div>

        {/* ── Your top picks (usage-personalised, fallback to industry pins) ── */}
        {!selCat && topPickCats.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
              <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:".6px" }}>
                {hasPersonalData ? "⚡ Your top picks" : `★ Quick picks for ${{ restaurant:"Restaurant", café:"Café", bar:"Bar", other:"You" }[industry] || "You"}`}
              </div>
              {hasPersonalData && (
                <div style={{ fontSize:10, color:C.dim }}>
                  based on your {Object.values(catUsage).reduce((s,v)=>s+v,0)} expenses
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
              {topPickCats.map((id, idx) => {
                const c = CAT_CONFIG[id]; if (!c) return null;
                const count = catUsage[id] || 0;
                const isTop = hasPersonalData && idx === 0;
                return (
                  <button key={id} onClick={() => pickCat(id)}
                    style={{
                      border:`1.5px solid ${isTop ? "rgba(143,203,114,.6)" : C.border}`,
                      background: isTop ? "rgba(143,203,114,.1)" : C.surfaceAlt,
                      color:C.text, borderRadius:8, padding:"7px 12px", fontSize:12,
                      fontFamily:"inherit", cursor:"pointer", display:"flex",
                      alignItems:"center", gap:5, transition:"all .15s", position:"relative"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.color=C.accent; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor=isTop?"rgba(143,203,114,.6)":C.border; e.currentTarget.style.color=C.text; }}>
                    {c.emoji} {c.label}
                    {hasPersonalData && count > 0 && (
                      <span style={{ fontSize:9.5, fontWeight:700, color: isTop ? C.accent : C.dim,
                        background: isTop ? "rgba(143,203,114,.15)" : "transparent",
                        borderRadius:8, padding: isTop ? "1px 5px" : "0" }}>
                        {isTop ? `⚡ ${count}×` : `${count}×`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected category badge */}
        {selCat && selCatCfg && (
          <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(143,203,114,.08)", border:"1px solid rgba(143,203,114,.25)", borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
            <span style={{ fontSize:20 }}>{selCatCfg.emoji}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:13, color:C.accent }}>{selCatCfg.label}</div>
              <div style={{ fontSize:11, color:C.dim, marginTop:1 }}>{(selCatCfg.tags||[]).slice(0,4).join(" · ")}</div>
            </div>
            <button onClick={() => { setSelCat(null); setF(p=>({...p,cat:personalSortedCats[0]||"ingredients"})); setSupplier(""); }}
              style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:12 }}>change ✕</button>
          </div>
        )}

        {/* Supplier chips */}
        {selCat && catSuppliers.length > 0 && (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:10.5, color:C.dim, marginBottom:5 }}>Common suppliers — tap to fill:</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {catSuppliers.map(s => (
                <button key={s} onClick={() => setSupplier(s)}
                  style={{ background: supplier===s ? "rgba(143,203,114,.12)" : C.surfaceAlt, border:`1px solid ${supplier===s ? C.accent : C.border}`, color: supplier===s ? C.accent : C.muted, borderRadius:6, padding:"3px 9px", fontSize:11.5, fontFamily:"inherit", cursor:"pointer", transition:"all .12s" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fields — only show once category is selected */}
        <div className="frow2">
          <div className="fg"><label className="flbl">Amount ($)</label>
            <input id="exp-amount-input" className="inp" type="number" placeholder="0.00" value={f.amount} onChange={e => setF({...f,amount:e.target.value})}/>
          </div>
          <div className="fg"><label className="flbl">Date</label>
            <input className="inp" type="date" value={f.date} onChange={e => setF({...f,date:e.target.value})}/>
          </div>
          <div className="fg" style={{ gridColumn:"1/-1" }}><label className="flbl">Description
            <span style={{ float:"right", fontSize:10, color:C.dim, fontWeight:400 }}>Type a description and Mise will suggest a category</span>
          </label>
            <input className="inp" placeholder="e.g. beef tenderloin, weekly gas bill, Uber Eats commission…" value={f.desc}
              onChange={e => handleDescChange(e.target.value)}
              onKeyDown={e => e.key==="Enter" && add()}/>
            {supplier && <span className="fhint">Supplier: {supplier}</span>}

            {/* Smart auto-suggest banner */}
            {autoSuggest && !manualCat && (
              <div style={{ marginTop:8, background:"rgba(143,203,114,.07)", border:"1px solid rgba(143,203,114,.3)", borderRadius:9, padding:"9px 13px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                <span style={{ fontSize:16 }}>{CAT_CONFIG[autoSuggest.cat]?.emoji}</span>
                <div style={{ flex:1, minWidth:120 }}>
                  <span style={{ fontSize:12, color:C.muted }}>
                    {autoSuggest.confidence === "custom" ? "Your rule: " : "Looks like "}
                  </span>
                  <strong style={{ fontSize:12.5, color:C.accent }}>{CAT_CONFIG[autoSuggest.cat]?.label}</strong>
                  <span style={{ fontSize:11, color:C.dim }}> — based on "{autoSuggest.keyword}"</span>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={acceptSuggest}
                    style={{ background:C.accent, color:"#0C0F0D", border:"none", borderRadius:6, padding:"5px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    Yes, use this
                  </button>
                  <button onClick={() => { setAutoSuggest(null); setSuggestDismissed(true); }}
                    style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 10px", fontSize:12, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}>
                    No thanks
                  </button>
                </div>
              </div>
            )}

            {/* Teach prompt */}
            {teachPrompt && (
              <div style={{ marginTop:8, background:"rgba(61,201,160,.06)", border:"1px solid rgba(61,201,160,.25)", borderRadius:9, padding:"9px 13px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                <span style={{ fontSize:14 }}>💾</span>
                <div style={{ flex:1, minWidth:120 }}>
                  <span style={{ fontSize:12, color:C.muted }}>Remember "</span>
                  <strong style={{ fontSize:12, color:C.teal }}>{teachPrompt.keyword}</strong>
                  <span style={{ fontSize:12, color:C.muted }}>" → {CAT_CONFIG[teachPrompt.cat]?.label}?</span>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => { saveCustomMapping(teachPrompt.keyword, teachPrompt.cat); setTeachPrompt(null); showToast(`✅ Taught: "${teachPrompt.keyword}" → ${CAT_CONFIG[teachPrompt.cat]?.label}`); }}
                    style={{ background:"rgba(61,201,160,.15)", color:"#3DC9A0", border:"1px solid rgba(61,201,160,.3)", borderRadius:6, padding:"5px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    Save rule
                  </button>
                  <button onClick={() => setTeachPrompt(null)}
                    style={{ background:"none", border:"none", fontSize:12, color:C.muted, cursor:"pointer", padding:"5px 8px" }}>
                    Skip
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="fg"><label className="flbl">GST Applicable?</label>
            <select className="sel" value={f.gst} onChange={e => {
              const v = e.target.value;
              setF(prev => ({
                ...prev,
                gst: v,
                // Pre-fill partial GST with the /11 estimate when first switching to it
                gst_amount: v === "partial" && !prev.gst_amount
                  ? ((parseFloat(prev.amount) || 0) / 11).toFixed(2)
                  : (v === "partial" ? prev.gst_amount : "")
              }));
            }}>
              <option value="yes">Yes — full GST (÷11)</option>
              <option value="partial">Yes — partial GST (enter amount)</option>
              <option value="no">No — GST-free</option>
            </select>
            {f.gst === "partial" && (
              <div style={{marginTop:8, display:"flex", alignItems:"center", gap:8, padding:"8px 10px", background:"rgba(61,201,160,.05)", border:`1px solid rgba(61,201,160,.2)`, borderRadius:7}}>
                <span style={{fontSize:11.5, color:C.muted, whiteSpace:"nowrap", fontWeight:600}}>GST on invoice ($):</span>
                <input className="inp" type="number" placeholder="e.g. 12.34" value={f.gst_amount}
                  onChange={e => setF({...f, gst_amount:e.target.value})} inputMode="decimal"
                  style={{flex:1, minWidth:0, margin:0}}/>
              </div>
            )}
            {f.gst === "partial" && parseFloat(f.amount) > 0 && parseFloat(f.gst_amount) > parseFloat(f.amount) && (
              <span className="fhint" style={{color:C.red}}>⚠️ GST can't exceed total amount</span>
            )}
            {selCat === "liquor_license" && <span className="fhint" style={{color:C.yellow}}>⚠️ Liquor licence has no GST</span>}
            {selCat === "ingredients"    && <span className="fhint" style={{color:C.yellow}}>⚠️ Fresh food may be GST-free — use "partial GST" if mixed</span>}
          </div>
          <div className="fg"><label className="flbl">Tax Invoice on File?</label>
            <select className="sel" value={f.invoice} onChange={e => setF({...f,invoice:e.target.value})}>
              <option value="yes">Yes — received</option>
              <option value="no">No — not yet</option>
            </select>
            {f.invoice==="no" && parseFloat(f.amount)>=82.5 && <span className="fhint" style={{color:C.red}}>⚠️ Over $82.50 — ATO requires invoice!</span>}
          </div>
          {/* Invoice date — collapsed by default, only show when dates differ */}
          {f.invoice === "yes" && (
            f.invoice_date
            ? (
              <div className="fg">
                <label className="flbl">Invoice Date <span style={{fontWeight:400,color:C.dim}}>(accrual date)</span></label>
                <input className="inp" type="date" value={f.invoice_date} onChange={e => setF({...f,invoice_date:e.target.value})}/>
                <button onClick={() => setF({...f,invoice_date:""})} style={{background:"none",border:"none",color:C.dim,fontSize:10.5,cursor:"pointer",fontFamily:"inherit",marginTop:3}}>✕ Remove — use payment date</button>
              </div>
            ) : (
              <div className="fg">
                <button onClick={() => setF({...f,invoice_date:f.date})}
                  style={{background:"none",border:`1px dashed ${C.border}`,borderRadius:7,padding:"6px 12px",fontSize:11,color:C.dim,cursor:"pointer",fontFamily:"inherit",width:"100%",textAlign:"left"}}>
                  + Add accrual date (if invoice date differs from payment date)
                </button>
              </div>
            )
          )}
        </div>

        {/* GST live preview — works for both full and partial GST */}
        {parseFloat(f.amount) > 0 && f.gst !== "no" && (() => {
          const total = parseFloat(f.amount) || 0;
          const gstVal = f.gst === "partial"
            ? Math.min(parseFloat(f.gst_amount) || 0, total)
            : total / 11;
          const net = total - gstVal;
          return (
            <div style={{ background:"rgba(61,201,160,.06)", border:"1px solid rgba(61,201,160,.2)", borderRadius:10, padding:"11px 15px", margin:"12px 0", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
              <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
                {[
                  { lbl:"Total (incl. GST)",                                    val: money(total) },
                  { lbl: f.gst === "partial" ? "GST (from invoice)" : "GST component", val: money(gstVal) },
                  { lbl:"Net (ex-GST)",                                         val: money(net) },
                ].map((s,i) => (
                  <div key={i}>
                    <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:".5px" }}>{s.lbl}</div>
                    <div style={{ fontFamily:"'DM Mono',monospace", fontSize:15, fontWeight:600, color:C.teal, marginTop:2 }}>{s.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:11, color: f.invoice==="yes" ? C.teal : C.yellow }}>
                {f.invoice==="yes" ? "✅ Claimable on BAS" : "⚠️ Get invoice to claim"}
              </div>
            </div>
          );
        })()}

        <div className="fbtns">
          <button className="btn" onClick={add}>+ Add Expense</button>
          <button className="btn-g" onClick={() => { setF({date:todayStr,cat:personalSortedCats[0]||"ingredients",amount:"",desc:"",gst:"yes",gst_amount:"",invoice:"yes"}); setSelCat(null); setSupplier(""); setCatQuery(""); setAutoSuggest(null); setSuggestDismissed(false); setTeachPrompt(null); setManualCat(false); setSavingTemplate(false); setTemplateName(""); }}>Clear</button>
          {/* Save as template — only offer when desc is filled */}
          {f.desc.trim() && !savingTemplate && (
            <button onClick={() => { setSavingTemplate(true); setTemplateName(f.desc.trim().slice(0,40)); }}
              style={{ marginLeft:"auto", fontSize:11.5, fontWeight:700, color:C.yellow, background:"rgba(212,168,67,.08)", border:`1px solid rgba(212,168,67,.35)`, borderRadius:7, padding:"6px 13px", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:5 }}>
              ⭐ Save as template
            </button>
          )}
        </div>

        {/* Save-template name input */}
        {savingTemplate && (
          <div style={{ marginTop:10, display:"flex", gap:8, alignItems:"center", background:"rgba(212,168,67,.07)", border:`1px solid rgba(212,168,67,.3)`, borderRadius:9, padding:"10px 13px" }}>
            <span style={{ fontSize:14 }}>⭐</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>Template name — how you'll recognise it later:</div>
              <input className="inp" value={templateName} onChange={e => setTemplateName(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter") addTemplate(); if(e.key==="Escape") setSavingTemplate(false); }}
                placeholder="e.g. Weekly veggie order, Monthly gas bill…"
                style={{ fontSize:12.5, padding:"6px 10px" }} autoFocus/>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              <button onClick={addTemplate}
                style={{ fontSize:12, fontWeight:700, background:C.yellow, color:"#0C0F0D", border:"none", borderRadius:7, padding:"7px 14px", cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                Save ⭐
              </button>
              <button onClick={() => setSavingTemplate(false)}
                style={{ fontSize:11, color:C.muted, background:"none", border:"none", cursor:"pointer", textAlign:"center" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Post-add recurring nudge */}
        {postAddNudge && (
          <div style={{ marginTop:12, background:"rgba(61,201,160,.07)", border:"1px solid rgba(61,201,160,.35)", borderRadius:10, padding:"12px 14px" }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
              <span style={{ fontSize:20, marginTop:1 }}>🔁</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#3DC9A0", marginBottom:3 }}>
                  You added this last month too
                </div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
                  <strong style={{ color:C.text, textTransform:"capitalize" }}>{postAddNudge.label}</strong>
                  {" "}({CAT_CONFIG[postAddNudge.cat]?.label}) — want Mise to remind you every month?
                </div>
                <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                  <button onClick={() => addRecurringRule(postAddNudge)}
                    style={{ background:"#3DC9A0", color:"#0C0F0D", border:"none", borderRadius:7, padding:"7px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    Yes, make it recurring 🔁
                  </button>
                  <button onClick={() => { setPostAddNudge(null); }}
                    style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"7px 12px", fontSize:12, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}>
                    Not now
                  </button>
                  <button onClick={() => { const u=[...dismissedNudges, postAddNudge.fp]; saveDismissedNudges(u); setPostAddNudge(null); }}
                    style={{ background:"none", border:"none", fontSize:11, color:C.dim, cursor:"pointer", padding:"7px 4px" }}>
                    Don't ask again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* My Smart Rules manager */}
        {Object.keys(customMappings).length > 0 && (
          <div style={{ marginTop:16, borderTop:`1px solid ${C.border}`, paddingTop:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.dim, textTransform:"uppercase", letterSpacing:".6px" }}>
                💾 Your Smart Rules ({Object.keys(customMappings).length})
              </div>
              <button onClick={() => setShowRules(r=>!r)}
                style={{ fontSize:11, color:C.muted, background:"none", border:"none", cursor:"pointer", padding:"2px 6px" }}>
                {showRules ? "Hide ▲" : "Show ▼"}
              </button>
            </div>
            {showRules && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {Object.entries(customMappings).map(([kw, cat]) => (
                  <div key={kw} style={{ display:"flex", alignItems:"center", gap:5, background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:7, padding:"4px 10px", fontSize:11.5 }}>
                    <span style={{ color:C.teal, fontWeight:600 }}>"{kw}"</span>
                    <span style={{ color:C.dim }}>→</span>
                    <span>{CAT_CONFIG[cat]?.emoji} {CAT_CONFIG[cat]?.label || cat}</span>
                    <button onClick={() => { deleteCustomMapping(kw); showToast(`Removed rule: "${kw}"`); }}
                      style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:12, padding:"0 2px", lineHeight:1 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manage Recurring — collapsible at bottom of form */}
        {recurringRules.length > 0 && (
          <div style={{ marginTop:14, borderTop:`1px solid ${C.border}`, paddingTop:13 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: showRecurMgr ? 10 : 0 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#3DC9A0", textTransform:"uppercase", letterSpacing:".6px" }}>
                🔁 Recurring rules ({recurringRules.filter(r=>r.active).length} active)
              </div>
              <button onClick={() => setShowRecurMgr(v=>!v)}
                style={{ fontSize:11, color:C.muted, background:"none", border:"none", cursor:"pointer", padding:"2px 6px" }}>
                {showRecurMgr ? "Hide ▲" : "Manage ▼"}
              </button>
            </div>
            {showRecurMgr && (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {recurringRules.map(rule => (
                  <div key={rule.fp} style={{ display:"flex", alignItems:"center", gap:9, background: rule.active ? "rgba(61,201,160,.05)" : C.surfaceAlt, border:`1px solid ${rule.active ? "rgba(61,201,160,.25)" : C.border}`, borderRadius:8, padding:"9px 12px", opacity: rule.active ? 1 : 0.6 }}>
                    <span style={{ fontSize:16 }}>{CAT_CONFIG[rule.cat]?.emoji}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12.5, fontWeight:600, textTransform:"capitalize" }}>{rule.label}</div>
                      <div style={{ fontSize:11, color:C.dim, marginTop:1 }}>
                        {CAT_CONFIG[rule.cat]?.label} · {money(rule.amount)}
                        {rule.active ? <span style={{ color:"#3DC9A0", marginLeft:6 }}>● Active</span> : <span style={{ color:C.dim, marginLeft:6 }}>● Paused</span>}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:5 }}>
                      <button onClick={() => saveRecurringRules(recurringRules.map(r => r.fp===rule.fp ? {...r, active:!r.active} : r))}
                        style={{ fontSize:11, color: rule.active ? C.yellow : "#3DC9A0", background:"none", border:`1px solid ${rule.active ? "rgba(212,168,67,.4)" : "rgba(61,201,160,.4)"}`, borderRadius:6, padding:"4px 9px", cursor:"pointer", fontFamily:"inherit" }}>
                        {rule.active ? "Pause" : "Resume"}
                      </button>
                      <button onClick={() => { saveRecurringRules(recurringRules.filter(r => r.fp !== rule.fp)); showToast("Recurring rule removed"); }}
                        style={{ fontSize:11, color:C.red, background:"none", border:`1px solid rgba(224,96,96,.3)`, borderRadius:6, padding:"4px 8px", cursor:"pointer", fontFamily:"inherit" }}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Monthly trend + category split — always visible ── */}
      {expenses.length > 0 && (
        <div className="g2" style={{ marginBottom:16 }}>
          {/* Monthly spend bar chart */}
          <div className="bc" style={{ marginBottom:0 }}>
            <div className="bctit">Monthly Spend — Last 6 Months</div>
            {monthlyData.every(m => m.v === 0)
              ? <div style={{ fontSize:12, color:C.dim, padding:"16px 0", textAlign:"center" }}>No data in this period yet.</div>
              : (
                <>
                  <BarChart data={monthlyData}/>
                  <div style={{ display:"flex", gap:10, marginTop:12, flexWrap:"wrap" }}>
                    {[
                      { lbl:"Highest",  val:money(Math.max(...monthlyData.map(m=>m.v))),                                                               col:C.red   },
                      { lbl:"Lowest",   val:money(Math.min(...monthlyData.filter(m=>m.v>0).map(m=>m.v)) || 0),                                         col:C.green },
                      { lbl:"Avg/month",val:money(monthlyData.filter(m=>m.v>0).reduce((s,m)=>s+m.v,0) / (monthlyData.filter(m=>m.v>0).length||1)),    col:C.blue  },
                    ].map((s,i) => (
                      <div key={i} style={{ background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", flex:"1 1 80px" }}>
                        <div style={{ fontSize:9.5, color:C.muted, textTransform:"uppercase", letterSpacing:".6px", marginBottom:3 }}>{s.lbl}</div>
                        <div className="mono" style={{ fontSize:15, fontWeight:700, color:s.col }}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                </>
              )
            }
          </div>

          {/* Top categories donut */}
          <div className="bc" style={{ marginBottom:0 }}>
            <div className="bctit">Top Categories</div>
            {byCat.length === 0
              ? <div style={{ fontSize:12, color:C.dim, padding:"16px 0", textAlign:"center" }}>No data yet.</div>
              : (
                <>
                  <DonutChart data={byCat.slice(0,5).map((d,i) => ({ label:d.label, v:d.v, c:[C.accent,C.teal,C.blue,C.yellow,C.red][i] }))}/>
                  <div style={{ display:"flex", flexDirection:"column", gap:5, marginTop:10 }}>
                    {byCat.slice(0,5).map((d,i) => {
                      const pct  = totalExp > 0 ? (d.v/totalExp*100) : 0;
                      const cols = [C.accent,C.teal,C.blue,C.yellow,C.red];
                      return (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:cols[i], flexShrink:0 }}/>
                          <div style={{ fontSize:11, color:C.muted, flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.label}</div>
                          <div className="mono" style={{ fontSize:11, fontWeight:700, flexShrink:0 }}>{money(d.v)}</div>
                          <div style={{ fontSize:10, color:C.dim, width:32, flexShrink:0, textAlign:"right" }}>{pct.toFixed(0)}%</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )
            }
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {[["list","📋 List"],["charts","📊 Full Charts"]].map(([t,lbl]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding:"7px 16px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
            background: tab===t ? C.accent : C.surface,
            color: tab===t ? "#0C0F0D" : C.muted,
            border: `1px solid ${tab===t ? C.accent : C.border}`
          }}>{lbl}</button>
        ))}
      </div>

      {tab === "list" && (
        <div className="bc">
          {/* Search + Filters */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14, alignItems:"center" }}>
            <input className="inp" style={{ flex:"1 1 180px", minWidth:160 }} placeholder="🔍 Search description or category…" value={search} onChange={e => setSearch(e.target.value)}/>
            <select className="sel" style={{ flex:"0 0 170px" }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="all">All Categories</option>
              {topPickCats.length > 0 && (
                <optgroup label={hasPersonalData ? "── Your Most Used ──" : `── ${{ restaurant:"Restaurant", café:"Café", bar:"Bar" }[industry] || ""} Essentials ──`}>
                  {topPickCats.map(c => <option key={c} value={c}>{catLabel(c)}{hasPersonalData && catUsage[c] ? ` (${catUsage[c]}×)` : " ★"}</option>)}
                </optgroup>
              )}
              <optgroup label="── All ──">
                {personalSortedCats.filter(c => !topPickCats.includes(c)).map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
              </optgroup>
            </select>
            <select className="sel" style={{ flex:"0 0 120px" }} value={filterGst} onChange={e => setFilterGst(e.target.value)}>
              <option value="all">Any GST</option>
              <option value="true">GST Yes</option>
              <option value="false">GST No</option>
            </select>
            <select className="sel" style={{ flex:"0 0 140px" }} value={filterInv} onChange={e => setFilterInv(e.target.value)}>
              <option value="all">Any Invoice</option>
              <option value="true">Invoice ✅</option>
              <option value="false">Missing ❌</option>
            </select>
            <input className="inp" type="date" style={{ flex:"0 0 130px" }} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} title="From date"/>
            <input className="inp" type="date" style={{ flex:"0 0 130px" }} value={filterTo}   onChange={e => setFilterTo(e.target.value)}   title="To date"/>
            {hasFilters && <button className="btn-g" style={{ fontSize:11, padding:"6px 12px" }} onClick={clearFilters}>✕ Clear</button>}
          </div>

          {/* Results count */}
          <div style={{ fontSize:11, color:C.dim, marginBottom:10 }}>
            Showing {filtered.length} of {expenses.length} entries
            {hasFilters && <span style={{ color:C.accent }}> · Filtered</span>}
            {filtered.length > 0 && <span> · Total: <strong style={{ color:C.text }}>{money(filtered.reduce((s,e)=>s+e.amount,0))}</strong></span>}
          </div>

          {(() => {
            const totalRows  = filtered.length;
            const pageSize   = expPageSize === 0 ? Math.max(totalRows, 1) : expPageSize;
            const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
            const safePage   = Math.min(Math.max(1, expPage), totalPages);
            const startIdx   = (safePage - 1) * pageSize;
            const endIdx     = startIdx + pageSize;
            const pageRows   = expPageSize === 0 ? filtered : filtered.slice(startIdx, endIdx);
            return (
              <>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>GST Credit</th><th>Invoice</th><th></th></tr></thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">🧾</div><div className="empty-txt">{hasFilters ? "No expenses match your filters." : "No expenses yet."}</div></div></td></tr>
                : pageRows.map(e => {
                    const isLargeNoInv = e.amount >= 82.50 && !e.invoice && e.gst;
                    const isEnt = ["entertainment","meals"].includes(e.cat);
                    return (
                      <tr key={e.id} style={{ background: isLargeNoInv ? "rgba(224,96,96,.05)" : "transparent" }}>
                        <td className="mono">{e.date}</td>
                        <td>
                          <span className="pill pl-p">{e.cat}</span>
                          {isEnt && <span style={{ marginLeft:5, fontSize:10, color:C.yellow }}>⚠️ 50%</span>}
                        </td>
                        <td style={{ color:C.muted }}>{e.desc}</td>
                        <td style={{ fontWeight:700 }}>{money(e.amount)}</td>
                        <td style={{ color: e.gst && e.invoice ? C.green : C.dim }}>
                          {e.gst ? (e.invoice ? money(expGST(e)) : <span style={{ color:C.red }}>Need invoice</span>) : "—"}
                        </td>
                        <td>{e.invoice ? <span className="pill pl-g">✅ Yes</span> : <span className="pill pl-r">❌ No</span>}</td>
                        <td style={{whiteSpace:"nowrap"}}>
                          <button className="btn-ic" title="History" onClick={() => setHistoryRec(e)}>📋</button>
                          <button className="btn-ic" title="Delete" onClick={() => { setExpenses(p => p.filter(x => x.id !== e.id)); showToast("Expense deleted"); }}>🗑️</button>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
          {filtered.length > 0 && (totalPages > 1 || filtered.length > 25) && (
            <Pagination
              page={safePage}
              totalPages={totalPages}
              pageSize={expPageSize}
              totalRows={totalRows}
              startIdx={startIdx}
              endIdx={Math.min(endIdx, totalRows)}
              onPageChange={setExpPage}
              onPageSizeChange={(n) => { setExpPageSize(n); setExpPage(1); }}/>
          )}
              </>
            );
          })()}
        </div>
      )}

      {tab === "charts" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* Spending by category */}
          <div className="bc">
            <div className="bctit">Spending by Category</div>
            {byCat.length === 0
              ? <div className="empty-state"><div className="empty-icon">📊</div><div className="empty-txt">No data yet.</div></div>
              : (
                <>
                  <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:18 }}>
                    <DonutChart data={byCat.slice(0,6).map((d,i) => ({ label:d.label, v:d.v, c:[C.accent,C.teal,C.blue,C.yellow,C.purple,C.red][i] }))}/>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {byCat.map((d,i) => {
                      const pct = totalExp > 0 ? (d.v/totalExp*100) : 0;
                      const cols = [C.accent,C.teal,C.blue,C.yellow,C.purple,C.red];
                      return (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ width:90, fontSize:11, color:C.muted, textAlign:"right", flexShrink:0 }}>{d.label}</div>
                          <div style={{ flex:1, height:8, background:C.border, borderRadius:4, overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${pct}%`, background:cols[i%6], borderRadius:4, transition:"width .3s" }}/>
                          </div>
                          <div className="mono" style={{ fontSize:12, fontWeight:700, width:80, flexShrink:0 }}>{money(d.v)}</div>
                          <div style={{ fontSize:11, color:C.dim, width:36, flexShrink:0 }}>{pct.toFixed(0)}%</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )
            }
          </div>

          {/* Monthly trend */}
          <div className="bc">
            <div className="bctit">Monthly Spend — Last 6 Months</div>
            {monthlyData.every(m => m.v === 0)
              ? <div className="empty-state"><div className="empty-icon">📈</div><div className="empty-txt">Not enough data yet.</div></div>
              : (
                <>
                  <BarChart data={monthlyData}/>
                  <div style={{ display:"flex", gap:16, marginTop:14, flexWrap:"wrap" }}>
                    {[
                      { lbl:"Highest Month", val: money(Math.max(...monthlyData.map(m=>m.v))), col:C.red },
                      { lbl:"Lowest Month",  val: money(Math.min(...monthlyData.filter(m=>m.v>0).map(m=>m.v)) || 0), col:C.green },
                      { lbl:"Monthly Avg",   val: money(monthlyData.filter(m=>m.v>0).reduce((s,m)=>s+m.v,0) / (monthlyData.filter(m=>m.v>0).length||1)), col:C.blue },
                    ].map((s,i) => (
                      <div key={i} style={{ background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px" }}>
                        <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:".7px", marginBottom:4 }}>{s.lbl}</div>
                        <div className="mono" style={{ fontSize:17, fontWeight:700, color:s.col }}>{s.val}</div>
                      </div>
                    ))}
                  </div>
                </>
              )
            }
          </div>

          {/* GST breakdown */}
          <div className="bc">
            <div className="bctit">GST Credits Breakdown</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
              {[
                { lbl:"Claimable (with invoice)",  val:money(gstCreds),    col:C.green,  icon:"✅" },
                { lbl:"At Risk (no invoice)",       val:money(missingCred), col:C.red,    icon:"❌" },
                { lbl:"Not Applicable (GST-free)",  val:money(expenses.filter(e=>!e.gst).reduce((s,e)=>s+e.amount/11,0)), col:C.dim, icon:"—" },
              ].map((s,i) => (
                <div key={i} style={{ background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:9, padding:"12px 15px" }}>
                  <div style={{ fontSize:18, marginBottom:6 }}>{s.icon}</div>
                  <div className="mono" style={{ fontSize:18, fontWeight:700, color:s.col, marginBottom:3 }}>{s.val}</div>
                  <div style={{ fontSize:10.5, color:C.muted }}>{s.lbl}</div>
                </div>
              ))}
            </div>
            {missingCred > 0 && (
              <div style={{ background:"rgba(224,96,96,.08)", border:"1px solid rgba(224,96,96,.25)", borderRadius:9, padding:"10px 14px", fontSize:12, color:C.muted }}>
                💡 <strong style={{ color:C.text }}>Tip:</strong> Chase up the missing invoices — you're leaving {money(missingCred)} in GST credits on the table this period.
              </div>
            )}
          </div>

        </div>
      )}

      {showExpPrint && (
        <PrintModal title="Expense Report" onClose={() => setShowExpPrint(false)}
          onExport={() => renderExpenseReportPDF({filtered, totalExp, gstCreds, missingCred, hasFilters})}>
          <ExpensePrintContent/>
        </PrintModal>
      )}
    </>
  );
}
// ════════════════════════════════════════════════════════════
//  Pagination — reusable component for large lists
//  Used by RevenuePage (Sales History) and ExpensesPage.
// ════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
//  HistoryModal — view a record's audit trail (change timeline)
//  Accountant-friendly: shows who, when, and what changed.
// ════════════════════════════════════════════════════════════
function HistoryModal({ record, label, onClose }) {
  if (!record) return null;
  const meta = record._meta || null;
  const history = meta?.history || [];
  // Newest first
  const timeline = [...history].reverse();

  const fmtTs = (ts) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString("en-AU", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
    } catch { return ts; }
  };

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="m-ttl">
          Change History
          <button className="btn-ic" style={{ fontSize: 17 }} onClick={onClose}>✕</button>
        </div>
        <div className="m-sub">{label || "Record"} audit trail</div>

        {!meta ? (
          <div style={{ padding:"24px 0", textAlign:"center", color:C.muted, fontSize:13 }}>
            No history recorded for this entry yet.<br/>
            <span style={{ fontSize:11, color:C.dim }}>History is tracked from the next edit onward.</span>
          </div>
        ) : (
          <>
            {/* Summary row */}
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
              <div style={{ flex:1, minWidth:140, background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:10, padding:"11px 14px" }}>
                <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>Created by</div>
                <div style={{ fontSize:12.5, fontWeight:600, color:C.text, wordBreak:"break-all" }}>{meta.createdBy}</div>
                <div style={{ fontSize:10, color:C.dim, marginTop:3 }}>{fmtTs(meta.createdAt)}</div>
              </div>
              <div style={{ flex:1, minWidth:140, background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:10, padding:"11px 14px" }}>
                <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>Last edited by</div>
                <div style={{ fontSize:12.5, fontWeight:600, color:C.text, wordBreak:"break-all" }}>{meta.editedBy}</div>
                <div style={{ fontSize:10, color:C.dim, marginTop:3 }}>{fmtTs(meta.editedAt)}</div>
              </div>
            </div>

            {/* Timeline */}
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", marginBottom:10 }}>
              Timeline ({timeline.length})
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:0, maxHeight:340, overflowY:"auto" }}>
              {timeline.map((entry, i) => (
                <div key={i} style={{ display:"flex", gap:12, paddingBottom:14 }}>
                  {/* Rail */}
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background: entry.action==="created"?C.accent:C.blue, marginTop:3 }}/>
                    {i < timeline.length-1 && <div style={{ width:2, flex:1, background:C.border, marginTop:2 }}/>}
                  </div>
                  {/* Content */}
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span style={{ fontSize:12.5, fontWeight:700, color: entry.action==="created"?C.accent:C.blue }}>
                        {entry.action === "created" ? "Created" : "Edited"}
                      </span>
                      <span style={{ fontSize:11, color:C.muted }}>by {entry.by}</span>
                    </div>
                    <div style={{ fontSize:10.5, color:C.dim, marginTop:1, marginBottom:6 }}>{fmtTs(entry.ts)}</div>
                    {entry.changes && entry.changes.length > 0 && (
                      <div style={{ background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px" }}>
                        {entry.changes.map((c, j) => (
                          <div key={j} style={{ fontSize:11.5, marginBottom: j<entry.changes.length-1?6:0, lineHeight:1.5 }}>
                            <span style={{ color:C.muted, fontWeight:600 }}>{c.field}:</span>{" "}
                            <span style={{ color:C.dim, textDecoration:"line-through" }}>{c.from}</span>
                            <span style={{ color:C.muted }}> → </span>
                            <span style={{ color:C.text, fontWeight:600 }}>{c.to}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${C.border}`, fontSize:10.5, color:C.dim, display:"flex", alignItems:"center", gap:6 }}>
          <span>🔒</span> Audit history is append-only and cannot be edited.
        </div>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, pageSize, totalRows, startIdx, endIdx, onPageChange, onPageSizeChange }) {
  const [jumpVal, setJumpVal] = useState("");
  const handleJump = () => {
    const n = parseInt(jumpVal, 10);
    if (!isNaN(n) && n >= 1 && n <= totalPages) {
      onPageChange(n);
      setJumpVal("");
    }
  };
  // Build a compact page button list: always show 1, last, current and ±1 around current; ellipses elsewhere
  const buildPageButtons = () => {
    if (totalPages <= 7) return Array.from({length: totalPages}, (_,i) => i+1);
    const pages = new Set([1, totalPages, page, page-1, page+1]);
    const sorted = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a,b) => a-b);
    const out = [];
    let prev = 0;
    for (const p of sorted) {
      if (prev && p - prev > 1) out.push("…");
      out.push(p);
      prev = p;
    }
    return out;
  };

  return (
    <div style={{
      display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between",
      gap:12, padding:"12px 4px 4px", borderTop:`1px solid ${C.border}`, marginTop:8
    }}>
      {/* Left: row range */}
      <div style={{fontSize:11, color:C.muted}}>
        {totalRows === 0
          ? "No rows"
          : pageSize === 0
            ? `Showing all ${totalRows} ${totalRows === 1 ? "row" : "rows"}`
            : `Showing ${startIdx+1}–${endIdx} of ${totalRows} ${totalRows === 1 ? "row" : "rows"}`
        }
      </div>

      {/* Center: page nav buttons */}
      <div style={{display:"flex", alignItems:"center", gap:4, flexWrap:"wrap"}}>
        <button
          className="btn-g"
          style={{padding:"5px 10px", fontSize:11, opacity: page <= 1 ? 0.4 : 1}}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}>
          ← Prev
        </button>
        {buildPageButtons().map((p, i) => p === "…"
          ? <span key={`e${i}`} style={{padding:"0 4px", color:C.muted, fontSize:11}}>…</span>
          : <button
              key={p}
              className={p === page ? "btn" : "btn-g"}
              style={{padding:"5px 10px", fontSize:11, minWidth:32}}
              onClick={() => onPageChange(p)}>
              {p}
            </button>
        )}
        <button
          className="btn-g"
          style={{padding:"5px 10px", fontSize:11, opacity: page >= totalPages ? 0.4 : 1}}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}>
          Next →
        </button>
      </div>

      {/* Right: jump + page size */}
      <div style={{display:"flex", alignItems:"center", gap:8}}>
        {totalPages > 5 && (
          <>
            <span style={{fontSize:11, color:C.muted}}>Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              placeholder={String(page)}
              value={jumpVal}
              onChange={e => setJumpVal(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleJump()}
              style={{
                width:55, padding:"5px 7px", fontSize:11,
                background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:6,
                color:C.text, fontFamily:"inherit"
              }}/>
            <button className="btn-g" style={{padding:"5px 9px", fontSize:11}} onClick={handleJump}>Go</button>
          </>
        )}
        <span style={{fontSize:11, color:C.muted, marginLeft:6}}>Per page:</span>
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(parseInt(e.target.value, 10))}
          style={{
            padding:"5px 7px", fontSize:11,
            background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:6,
            color:C.text, fontFamily:"inherit", cursor:"pointer"
          }}>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={0}>All</option>
        </select>
      </div>
    </div>
  );
}
// ════════════════════════════════════════════════════════════
const BLANK_EMP = {
  name:"", email:"", phone:"", dob:"", nok_name:"", nok_phone:"",
  role:"", type:"full-time", rate:"", std_hrs:"38",
  start:todayStr, tfn:"yes", superfund:"", color:"",
  rate_includes_loading: false, // casual: false = auto-add 25%, true = rate already all-in
  // ── Flexible pay model (for family / owner-operator employees) ──
  pay_mode: "hourly",          // "hourly" | "fixed"
  fixed_weekly_gross: "",      // gross weekly amount when pay_mode === "fixed"
  track_leave: true,           // false = don't accrue annual/personal leave (family mode)
  payg_override: "",           // "" = auto-calc; number = manual weekly PAYG amount
  super_override: "",          // "" = auto-calc; number = manual weekly super (0 = no super)
  // Offboarding fields
  active: true, exitDate:"", exitReason:"", leaveSettled: false, exitNotes:"",
};

function EmployeeModal({ emp, onSave, onClose }) {
  const isEdit = !!emp;
  const [f, setF] = useState(
    emp ? { ...emp, rate:String(emp.rate), std_hrs:String(emp.std_hrs), tfn:emp.tfn?"yes":"no" }
        : BLANK_EMP
  );
  const rate    = parseFloat(f.rate) || 0;
  const stdHrs  = parseFloat(f.std_hrs) || 0;
  const effR    = f.type === "casual" && !f.rate_includes_loading
    ? rate * (1 + CASUAL_LOADING)
    : rate;
  const fixedWeekly = parseFloat(f.fixed_weekly_gross) || 0;
  const isFixed = f.pay_mode === "fixed";
  // Gross shown in the Weekly Cost Preview: fixed amount for fixed mode, else rate × std hrs
  const wkGross = isFixed ? fixedWeekly : effR * stdHrs;

  const save = () => {
    if (!f.name.trim()) return;
    onSave({
      ...f,
      id: emp?.id || Date.now(),
      rate,
      std_hrs: stdHrs,
      tfn: f.tfn === "yes",
      // Coerce new flexible-pay fields — keep as string when empty, number otherwise
      fixed_weekly_gross: f.pay_mode === "fixed"
        ? (parseFloat(f.fixed_weekly_gross) || 0)
        : "",
      payg_override:  f.payg_override  === "" ? "" : (parseFloat(f.payg_override)  || 0),
      super_override: f.super_override === "" ? "" : (parseFloat(f.super_override) || 0),
    });
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

        {/* Avatar colour picker */}
        <div className="fg" style={{ marginBottom:14 }}>
          <label className="flbl">Avatar Colour</label>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginTop:6 }}>
            {/* Preview */}
            <div style={{ width:36, height:36, borderRadius:"50%", background: f.color || avatarBg(emp?.id||1, ''), display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", flexShrink:0, boxShadow:"0 0 0 2px rgba(255,255,255,.15)" }}>
              {f.name ? f.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() : "?"}
            </div>
            {/* Colour swatches */}
            <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
              {EMP_COLOR_PALETTE.map(({ col, lbl }) => (
                <button key={col} title={lbl} onClick={() => setF({...f, color: f.color===col ? "" : col})}
                  style={{ width:26, height:26, borderRadius:"50%", background:col, border: f.color===col ? "2.5px solid #fff" : "2px solid transparent", outline: f.color===col ? `2px solid ${col}` : "none", cursor:"pointer", transition:"all .12s", padding:0 }}/>
              ))}
              {/* Custom colour input */}
              <label title="Custom colour" style={{ width:26, height:26, borderRadius:"50%", background: f.color && !EMP_COLOR_PALETTE.find(p=>p.col===f.color) ? f.color : "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)", border:`2px solid ${C.border}`, cursor:"pointer", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <input type="color" value={f.color||"#3B82F6"} onChange={e => setF({...f,color:e.target.value})} style={{ opacity:0, position:"absolute", width:0, height:0 }}/>
              </label>
            </div>
            {f.color && (
              <button onClick={() => setF({...f,color:""})} style={{ fontSize:10, color:C.muted, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>
                Reset
              </button>
            )}
          </div>
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
            <select className="sel" value={f.type} onChange={e => setF({...f, type:e.target.value, rate_includes_loading: false })}>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="casual">Casual</option>
            </select>
          </div>
          <div className="fg">
            <label className="flbl">Base Hourly Rate ($)</label>
            <input className="inp" type="number" placeholder="0.00" value={f.rate} onChange={e => setF({...f,rate:e.target.value})}/>
            {rate > 0 && (
              <span className="fhint">
                {f.type === "casual"
                  ? f.rate_includes_loading
                    ? <>All-in rate (loading already included) — <strong style={{color:C.teal}}>{money(rate)}/hr</strong></>
                    : <>Base rate + 25% loading = <strong style={{color:C.accent}}>{money(effR)}/hr</strong> effective</>
                  : <>{money(rate)}/hr</>
                }
              </span>
            )}
            {/* Casual loading mode toggle */}
            {f.type === "casual" && rate > 0 && (
              <div style={{ marginTop:8, display:"flex", gap:0, background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
                <button type="button" onClick={() => setF(p=>({...p, rate_includes_loading:false}))}
                  style={{ flex:1, padding:"7px 10px", fontSize:11, fontWeight:600, fontFamily:"inherit", cursor:"pointer", border:"none",
                    background: !f.rate_includes_loading ? C.accent : "transparent",
                    color: !f.rate_includes_loading ? "#0C0F0D" : C.muted }}>
                  ➕ Auto-add 25% loading
                </button>
                <button type="button" onClick={() => setF(p=>({...p, rate_includes_loading:true}))}
                  style={{ flex:1, padding:"7px 10px", fontSize:11, fontWeight:600, fontFamily:"inherit", cursor:"pointer", border:"none",
                    background: f.rate_includes_loading ? C.teal : "transparent",
                    color: f.rate_includes_loading ? "#0C0F0D" : C.muted }}>
                  ✅ Rate already all-in
                </button>
              </div>
            )}
            {f.type === "casual" && rate > 0 && (
              <span className="fhint" style={{marginTop:4}}>
                {f.rate_includes_loading
                  ? `You entered the all-in rate. Mise will use ${money(rate)}/hr as-is.`
                  : `You entered the base rate. Mise adds 25% → pays ${money(effR)}/hr.`}
              </span>
            )}
          </div>
          <div className="fg">
            <label className="flbl">Standard Weekly Hours</label>
            <input className="inp" type="number" placeholder="e.g. 38" value={f.std_hrs} onChange={e => setF({...f,std_hrs:e.target.value})}/>
            {wkGross > 0 && <span className="fhint">Est. weekly gross: {money(wkGross)}</span>}
          </div>
          <div className="fg"><label className="flbl">Start Date</label><input className="inp" type="date" value={f.start} onChange={e => setF({...f,start:e.target.value})}/></div>
        </div>

        <div className="m-sec">Pay Model</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:12, marginTop:-4 }}>
          Hourly mode pays based on timesheets. Fixed mode pays the same weekly amount no matter how many hours are worked — useful for owner-operators, family members, or salaried staff.
        </div>

        {/* Pay mode toggle */}
        <div style={{ display:"flex", gap:0, background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:9, overflow:"hidden", marginBottom:14 }}>
          <button type="button" onClick={() => setF(p => ({...p, pay_mode:"hourly"}))}
            style={{ flex:1, padding:"10px 14px", fontSize:12.5, fontWeight:700, fontFamily:"inherit", cursor:"pointer", border:"none",
              background: f.pay_mode !== "fixed" ? C.accent : "transparent",
              color: f.pay_mode !== "fixed" ? "#0C0F0D" : C.muted }}>
            ⏱ Hourly (by timesheet)
          </button>
          <button type="button" onClick={() => setF(p => ({...p, pay_mode:"fixed"}))}
            style={{ flex:1, padding:"10px 14px", fontSize:12.5, fontWeight:700, fontFamily:"inherit", cursor:"pointer", border:"none",
              background: f.pay_mode === "fixed" ? C.teal : "transparent",
              color: f.pay_mode === "fixed" ? "#0C0F0D" : C.muted }}>
            💵 Fixed weekly amount
          </button>
        </div>

        {/* Fixed weekly gross input — only shown in fixed mode */}
        {f.pay_mode === "fixed" && (
          <div className="frow2" style={{ marginBottom:14 }}>
            <div className="fg">
              <label className="flbl">Fixed Weekly Gross ($)</label>
              <input className="inp" type="number" placeholder="e.g. 1500.00" value={f.fixed_weekly_gross}
                onChange={e => setF({...f, fixed_weekly_gross:e.target.value})}/>
              {fixedWeekly > 0 && (
                <span className="fhint">
                  Pays <strong style={{color:C.teal}}>{money(fixedWeekly)}</strong> per week regardless of hours worked.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Track leave toggle */}
        <div className="fg" style={{ marginBottom:14 }}>
          <label className="flbl" style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}>
            <input type="checkbox" checked={f.track_leave !== false}
              onChange={e => setF({...f, track_leave:e.target.checked})}
              style={{ cursor:"pointer", width:16, height:16 }}/>
            Track annual & personal leave for this employee
          </label>
          <span className="fhint" style={{ marginTop:4 }}>
            {f.track_leave !== false
              ? "Leave accrues automatically based on hours worked (Fair Work Act)."
              : "Leave accrual disabled. Manual leave entries are still allowed in the Leave page."}
          </span>
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

        {/* PAYG / Super manual override */}
        <div className="frow2" style={{ marginTop:10 }}>
          <div className="fg">
            <label className="flbl">
              Weekly PAYG Withholding
              {f.payg_override === "" ? <span style={{color:C.muted, fontWeight:400}}> — auto</span> : <span style={{color:C.yellow, fontWeight:400}}> — manual</span>}
            </label>
            <input className="inp" type="number" placeholder="Auto (leave blank)"
              value={f.payg_override}
              onChange={e => setF({...f, payg_override:e.target.value})}/>
            <span className="fhint">
              Blank = calculated from ATO Scale 2. Enter a number (e.g. 0) to override for family / contractor scenarios.
            </span>
          </div>
          <div className="fg">
            <label className="flbl">
              Weekly Super Contribution
              {f.super_override === "" ? <span style={{color:C.muted, fontWeight:400}}> — auto</span> : <span style={{color:C.blue, fontWeight:400}}> — manual</span>}
            </label>
            <input className="inp" type="number" placeholder="Auto (leave blank)"
              value={f.super_override}
              onChange={e => setF({...f, super_override:e.target.value})}/>
            <span className="fhint">
              Blank = calculated at current SGC rate. Enter a number (e.g. 0) for family / owner scenarios.
            </span>
          </div>
        </div>

        {wkGross > 0 && (
          <div style={{ background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:10, padding:"13px 15px", marginTop:14 }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", marginBottom:10 }}>Weekly Cost Preview</div>
            <div className="frow4">
              {(() => {
                const hasPaygOv  = f.payg_override  !== "" && f.payg_override  != null;
                const hasSuperOv = f.super_override !== "" && f.super_override != null;
                const wkPayg   = hasPaygOv  ? (parseFloat(f.payg_override)  || 0) : calcWeeklyPAYG(wkGross, f.tfn === "yes");
                const superR   = getSuperRate(todayWeekStr);
                const wkSuper  = hasSuperOv ? (parseFloat(f.super_override) || 0) : wkGross * superR;
                const paygLbl  = hasPaygOv  ? "PAYG (manual)"  : `PAYG (ATO Scale 2${f.tfn==="no"?" 47%":""})`;
                const superLbl = hasSuperOv ? "Super (manual)" : `Super (SGC ${(superR*100).toFixed(1)}%)`;
                return [
                  { lbl: isFixed ? "Gross Wages (fixed)" : "Gross Wages",  val:money(wkGross),          col: isFixed ? C.teal : C.text },
                  { lbl: paygLbl,                                          val:money(wkPayg),           col: C.yellow },
                  { lbl: superLbl,                                         val:money(wkSuper),          col: C.blue   },
                  { lbl: "Total Labour Cost",                              val:money(wkGross+wkSuper),  col: C.accent },
                ];
              })().map((s,i) => (
                <div key={i}>
                  <div className="mono" style={{ fontSize:15, fontWeight:700, color:s.col }}>{s.val}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Offboarding (edit only) ── */}
        {isEdit && (
          <>
            <div className="m-sec" style={{ color: f.exitDate ? C.red : C.muted }}>
              {f.exitDate ? "🚪 Offboarding Record" : "🚪 Offboarding (optional)"}
            </div>
            <div className="frow2">
              <div className="fg">
                <label className="flbl">Exit Date</label>
                <input className="inp" type="date" value={f.exitDate||""} onChange={e => setF({...f, exitDate:e.target.value, active: !e.target.value})}/>
                {f.exitDate && <span className="fhint r">Employee will be marked inactive from this date.</span>}
              </div>
              <div className="fg">
                <label className="flbl">Reason for Leaving</label>
                <select className="sel" value={f.exitReason||""} onChange={e => setF({...f,exitReason:e.target.value})}>
                  <option value="">— Select if applicable —</option>
                  <option value="resignation">Resignation</option>
                  <option value="end-of-contract">End of Contract</option>
                  <option value="redundancy">Redundancy</option>
                  <option value="dismissal">Dismissal</option>
                  <option value="retirement">Retirement</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="fg">
                <label className="flbl">Leave Balance Settled?</label>
                <select className="sel" value={f.leaveSettled?"yes":"no"} onChange={e => setF({...f,leaveSettled:e.target.value==="yes"})}>
                  <option value="no">No — outstanding leave entitlements</option>
                  <option value="yes">Yes — all leave paid out</option>
                </select>
              </div>
              <div className="fg">
                <label className="flbl">Exit Notes</label>
                <input className="inp" placeholder="e.g. Final payslip issued, super paid" value={f.exitNotes||""} onChange={e => setF({...f,exitNotes:e.target.value})}/>
              </div>
            </div>
            {f.exitDate && !f.leaveSettled && (
              <div className="alert al-y" style={{ marginTop:8, marginBottom:0 }}>
                <span className="al-ico">⚠️</span>
                <div><div className="al-ttl">Outstanding leave balance not settled</div>
                <div className="al-msg">Unused annual leave must be paid out on termination. Mark as settled once the final payment is made.</div></div>
              </div>
            )}
          </>
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
function TimesheetModal({ employees, onSave, onClose, initial }) {
  const isEdit = !!(initial?.id);
  const [f, setF] = useState(() => ({
    eid:       String(initial?.eid  || ""),
    week:      initial?.week        || "2025-W29",
    std_hrs:   String(initial?.std_hrs  ?? ""),
    ot_hrs:    String(initial?.ot_hrs   ?? "0"),
    wknd_hrs:  String(initial?.wknd_hrs ?? "0"),
    super_paid: initial?.super_paid ? "yes" : "no",
  }));
  const emp   = employees.find(e => e.id === parseInt(f.eid));
  const std   = parseFloat(f.std_hrs)  || 0;
  const ot    = parseFloat(f.ot_hrs)   || 0;
  const wknd  = parseFloat(f.wknd_hrs) || 0;
  const gross = emp ? calcGross(emp, { std_hrs:std, ot_hrs:ot, wknd_hrs:wknd }) : 0;

  const save = () => {
    if (!f.eid || !std) return;
    onSave({
      id:        isEdit ? initial.id : Date.now(),
      eid:       parseInt(f.eid),
      week:      f.week,
      std_hrs:   std,
      ot_hrs:    ot,
      wknd_hrs:  wknd,
      super_paid: f.super_paid === "yes",
    });
  };

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth:520 }}>
        <div className="m-ttl">
          {isEdit ? "✏️ Edit Timesheet Entry" : "Log Weekly Hours"}
          <button className="btn-ic" style={{ fontSize:17 }} onClick={onClose}>✕</button>
        </div>
        <div className="m-sub">{isEdit ? "Update hours for this entry." : "Record hours for one employee for the selected week."}</div>

        <div className="frow2" style={{ marginBottom:11 }}>
          <div className="fg">
            <label className="flbl">Employee *</label>
            <select className="sel" value={f.eid} onChange={e => setF({...f,eid:e.target.value})} disabled={isEdit}>
              <option value="">— Select employee —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.role})</option>)}
            </select>
            {emp && <span className="fhint">{emp.type} · {money(effRate(emp))}/hr{emp.type==="casual" ? (emp.rate_includes_loading ? " (all-in rate)" : " (incl. 25% loading)") : ""}</span>}
          </div>
          <div className="fg">
            <label className="flbl">Week *</label>
            <input className="inp" type="week" value={f.week} onChange={e => setF({...f,week:e.target.value})} readOnly={isEdit}/>
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
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", marginBottom:9 }}>This Week's Costs</div>
            <div className="frow4">
              {(() => {
                const tsPayg  = calcWeeklyPAYG(gross, emp?.tfn === "yes");
                const superR  = getSuperRate(f.week || todayWeekStr);
                const oteBase = (std + wknd) * (emp ? effRate(emp) : 0) + ot * (emp ? effRate(emp) : 0);
                const tsSuper = oteBase * superR;
                return [
                  { lbl:`Gross (${std+ot+wknd}h)`,                     val:money(gross),         col:C.text   },
                  { lbl:`PAYG (ATO Scale 2${emp?.tfn==="no"?" 47%":""})`, val:money(tsPayg),      col:C.yellow },
                  { lbl:`Super (SGC ${(superR*100).toFixed(1)}%)`,        val:money(tsSuper),     col:C.blue   },
                  { lbl:"Total Labour Cost",                             val:money(gross+tsSuper), col:C.accent },
                ];
              })().map((s,i) => (
                <div key={i}>
                  <div className="mono" style={{ fontSize:14, fontWeight:700, color:s.col }}>{s.val}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="fbtns" style={{ marginTop:17 }}>
          <button className="btn" onClick={save}>{isEdit ? "Save Changes" : "Log Hours"}</button>
          <button className="btn-g" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  SHIFT MODAL
// ════════════════════════════════════════════════════════════
// Convert "HH:MM" 24h → "9:00am" / "1:30pm"
const fmt12 = t => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2,"0")}${ampm}`;
};

function TimePicker({ label, value, onChange }) {
  // value is "HH:MM" 24h, internally converts to/from 12h AM/PM
  const [h24, m] = (value || "09:00").split(":").map(Number);
  const isPM  = h24 >= 12;
  const h12   = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;

  const emit = (newH12, newM, newIsPM) => {
    let h = newH12 % 12;
    if (newIsPM) h += 12;
    onChange(`${String(h).padStart(2,"0")}:${String(newM).padStart(2,"0")}`);
  };

  const hours   = [12,1,2,3,4,5,6,7,8,9,10,11];
  const minutes = [0,5,10,15,20,25,30,35,40,45,50,55];

  const selStyle = {
    background: C.surfaceAlt, border: `1px solid ${C.border}`,
    borderRadius: 7, color: C.text, fontSize: 14, fontWeight: 600,
    padding: "7px 8px", cursor: "pointer", fontFamily: "inherit",
    appearance: "none", WebkitAppearance: "none", textAlign: "center",
  };
  const ampmBtn = active => ({
    flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 700,
    borderRadius: 6, cursor: "pointer", border: "none", fontFamily: "inherit",
    background: active ? C.accent : C.surfaceAlt,
    color: active ? "#000" : C.muted,
    transition: "all .12s",
  });

  return (
    <div className="fg">
      <label className="flbl">{label}</label>
      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
        <select style={{...selStyle, flex:"0 0 60px"}} value={h12}
          onChange={e => emit(parseInt(e.target.value), m, isPM)}>
          {hours.map(h => <option key={h} value={h}>{String(h).padStart(2,"0")}</option>)}
        </select>
        <span style={{ color:C.muted, fontWeight:700, fontSize:16 }}>:</span>
        <select style={{...selStyle, flex:"0 0 60px"}} value={m}
          onChange={e => emit(h12, parseInt(e.target.value), isPM)}>
          {minutes.map(mn => <option key={mn} value={mn}>{String(mn).padStart(2,"0")}</option>)}
        </select>
        <div style={{ display:"flex", gap:3, flex:1 }}>
          <button style={ampmBtn(!isPM)} onClick={() => emit(h12, m, false)}>AM</button>
          <button style={ampmBtn(isPM)}  onClick={() => emit(h12, m, true)}>PM</button>
        </div>
      </div>
    </div>
  );
}

function ShiftModal({ employees, initial, onSave, onClose, applyOT, applyWknd }) {
  const [f, setF] = useState({
    id:         initial.id         || null,
    eid:        initial.eid        || (employees[0]?.id || ""),
    date:       initial.date       || todayStr,
    start:      initial.start      || "09:00",
    end:        initial.end        || "17:00",
    openEnd:    initial.openEnd    || false,
    break_mins: initial.break_mins != null ? initial.break_mins : 30,
    note:       initial.note       || "",
  });
  const upd = k => e => setF(p => ({...p, [k]: e.target.value}));

  const netMins = () => {
    if (f.openEnd) return 0;
    const [sh,sm] = f.start.split(":").map(Number);
    const [eh,em] = f.end.split(":").map(Number);
    return Math.max(0, (eh*60+em) - (sh*60+sm) - (parseInt(f.break_mins)||0));
  };
  const hrs = (netMins() / 60);
  const emp = employees.find(e => e.id === parseInt(f.eid));
  const er  = emp ? effRate(emp) : 0;
  const day = (() => { const [y,m,d] = f.date.split('-').map(Number); return new Date(y,m-1,d).getDay(); })();
  const isWknd = day === 0 || day === 6;
  const wkndMulti = (isWknd && applyWknd) ? WKND_RATE : 1;
  const rate = er * wkndMulti;
  const gross = rate * hrs;

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal" style={{maxWidth:440}} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <div className="modal-ttl">{f.id ? "✏️ Edit Shift" : "➕ Add Shift"}</div>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="fg">
            <label className="flbl">Employee</label>
            <select className="sel" value={f.eid} onChange={upd("eid")}>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} · {e.role}</option>)}
            </select>
          </div>
          <div className="frow2">
            <div className="fg">
              <label className="flbl">Date</label>
              <input type="date" className="inp" value={f.date} onChange={upd("date")}/>
            </div>
            <div className="fg">
              <label className="flbl">Break (mins)</label>
              <input type="number" className="inp" value={f.break_mins} onChange={upd("break_mins")} min={0} max={120} step={5}/>
            </div>
          </div>
          <div className="frow2">
            <TimePicker label="Start Time" value={f.start} onChange={v => setF(p=>({...p,start:v}))}/>
            {f.openEnd
              ? <div className="fg">
                  <label className="flbl">End Time</label>
                  <div style={{background:C.surfaceAlt,border:`1px dashed ${C.border}`,borderRadius:7,padding:"9px 12px",fontSize:12,color:C.muted,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:14}}>🔓</span> Open — no fixed end
                  </div>
                </div>
              : <TimePicker label="End Time" value={f.end} onChange={v => setF(p=>({...p,end:v}))}/>
            }
          </div>
          {/* Open end time toggle */}
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:2,padding:"6px 0"}}>
            <div onClick={() => setF(p=>({...p,openEnd:!p.openEnd}))} style={{
              width:34, height:18, borderRadius:9, cursor:"pointer",
              background: f.openEnd ? C.yellow : C.dim,
              position:"relative", transition:"background .2s", flexShrink:0,
            }}>
              <div style={{
                position:"absolute", top:2, left: f.openEnd ? 18 : 2,
                width:14, height:14, borderRadius:"50%", background:"#fff",
                transition:"left .2s",
              }}/>
            </div>
            <span style={{fontSize:11,color:f.openEnd ? C.yellow : C.muted}}>
              Open end time <span style={{color:C.dim,fontSize:10}}>(employee reports when finished)</span>
            </span>
          </div>
          {hrs > 0 && emp && (
            <div style={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 13px",fontSize:12,lineHeight:1.7,marginTop:2}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{color:C.muted}}>Net hours</span>
                <span className="mono" style={{fontWeight:700}}>{hrs.toFixed(2)}h</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{color:C.muted}}>Rate {isWknd
                  ? <span style={{background:"#FEF3C7",borderRadius:4,padding:"1px 5px",fontSize:10,color:"#92400E"}}>
                      {applyWknd ? "Weekend ×1.75" : "Weekend (flat rate)"}
                    </span>
                  : "Weekday"}</span>
                <span className="mono">{money(rate)}/hr</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",borderTop:`1px solid ${C.border}`,paddingTop:6,marginTop:4}}>
                <span style={{fontWeight:600}}>Shift cost</span>
                <span className="mono" style={{fontWeight:700,color:C.accent}}>{money(gross)}</span>
              </div>
            </div>
          )}
          <div className="fg">
            <label className="flbl">Note (optional)</label>
            <input className="inp" value={f.note} onChange={upd("note")} placeholder="e.g. covering for James, dinner service"/>
          </div>
        </div>
        <div className="modal-footer" style={{display:"flex",justifyContent:"space-between",gap:8}}>
          <button className="btn-b" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={() => {
            if (!f.eid || !f.date || !f.start) return;
            if (!f.openEnd && !f.end) return;
            onSave({...f, eid:parseInt(f.eid), break_mins:parseInt(f.break_mins)||0});
          }}>{f.id ? "Save Changes" : "Add Shift"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Roster PDF renderer — LANDSCAPE, employee-facing ─────
const renderRosterPDF = ({ employees, weekShifts, weekDays, weekStart, weekEnd, isoDate, shiftHrs }) => {
  const pdf = new MiniPDF(true);   // landscape: 842 x 595
  const W = pdf.W, H = pdf.H, M = pdf.M;

  // ── Helpers ───────────────────────────────────────────────
  const DAY_CAPS = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
  const safe = str => String(str||'').replace(/[\u2013\u2014]/g,'-').replace(/[^\x20-\x7E]/g,'');
  const safeDt = d => {
    const dd = String(d.getDate()).padStart(2,'0');
    const mo = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()];
    return dd+' '+mo;
  };
  const p12 = t => {
    if (!t) return '';
    const [h,m] = t.split(':').map(Number);
    const ap = h>=12?'pm':'am';
    const h12 = h===0?12:h>12?h-12:h;
    return h12+':'+String(m).padStart(2,'0')+ap;
  };

  // ── Palette: B (notice board) + C (engineering grid) ─────
  const INK       = '#0A0A0A';
  const RULE      = '#1A1A1A';
  const RULE_LT   = '#C8C8C8';
  const HDR_FG    = '#FFFFFF';
  const WKND_FG   = '#F5C518';
  const WKND_COL  = '#FFFBEB';
  const WKND_COL2 = '#FFF7D6';
  const ROW_ALT   = '#F5F5F5';
  const PILL_WD_BG  = '#FEF08A'; PILL_WK_BG  = '#DCFCE7';
  const PILL_WD_BD  = '#CA8A04'; PILL_WK_BD  = '#16A34A';
  const PILL_WD_TXT = '#713F12'; PILL_WK_TXT = '#14532D';
  const OPEN_BG   = '#F1F5F9';
  const OPEN_BD   = '#475569';
  const OPEN_TXT  = '#1E3A5F';
  const OPEN_LINE = '#94A3B8';

  // ── Full-width black header bar ───────────────────────────
  pdf.rect(0, 0, W, 60, {fill:'#111111'});
  // Green logo block
  pdf.rect(M, 11, 38, 38, {fill:'#8FCB72'});
  pdf.text(M+7, 15, 'M', {size:22, bold:true, color:'#0A0A0A'});
  // Centre title
  pdf.text(W/2, 10, 'WEEKLY STAFF ROSTER',              {size:8.5, color:'#9CA3AF', align:'center'});
  pdf.text(W/2, 22, safe(weekStart+' - '+weekEnd),      {size:19, bold:true, color:'#FFFFFF', align:'center'});
  pdf.text(W/2, 44, 'Generated: '+todayStr,              {size:7.5, color:'#6B7280', align:'center'});
  // Right wordmark
  pdf.text(W-M, 18, 'Mise',                {size:16, bold:true, color:'#8FCB72', align:'right'});
  pdf.text(W-M, 36, 'HOSPITALITY FINANCE', {size:6.5,           color:'#4B5563', align:'right'});

  let y = 64;

  // ── Table layout ─────────────────────────────────────────
  const nameW  = 110;
  const usable = W - M*2 - nameW;
  const dayW   = Math.floor(usable / 7);
  const tableW = nameW + dayW * 7;

  // Row heights — open-end rows get extra room for handwriting
  const rowHeights = employees.map(emp => {
    const maxSlots = Math.max(1, ...weekDays.map(d =>
      weekShifts.filter(s => s.eid===emp.id && s.date===isoDate(d)).length
    ));
    const hasOpen = weekShifts.some(s => s.eid===emp.id && s.openEnd);
    const base = hasOpen ? 68 : 58;
    return Math.max(base, maxSlots * 56 + 10);
  });
  const hdrH      = 44;
  const totalTblH = hdrH + rowHeights.reduce((s,h)=>s+h,0);
  const availH    = H - y - 32;
  const scale     = totalTblH > availH ? availH/totalTblH : 1;
  const scaledRows = rowHeights.map(h => Math.max(50, Math.round(h*scale)));

  // ── Table header ─────────────────────────────────────────
  pdf.rect(M, y, tableW, hdrH, {fill:'#222222'});
  pdf.text(M+14, y+18, 'STAFF', {size:8, bold:true, color:'#9CA3AF'});

  weekDays.forEach((d,i) => {
    const cx   = M + nameW + i*dayW;
    const wknd = d.getDay()===0 || d.getDay()===6;
    const isSat = d.getDay()===6;
    const isSun = d.getDay()===0;
    if (wknd) {
      pdf.rect(cx, y, dayW, hdrH, {fill:'#1C1C1C'});
      // Amber top accent bar
      pdf.rect(cx, y, dayW, 4, {fill:WKND_FG});
    }
    if (isSat) pdf.line(cx, y, cx, y+hdrH, {color:WKND_FG, w:2});
    else        pdf.line(cx, y, cx, y+hdrH, {color:'#444444', w:0.5});
    if (isSun)  pdf.line(cx+dayW, y, cx+dayW, y+hdrH, {color:WKND_FG, w:2});
    pdf.text(cx+dayW/2, y+13, DAY_CAPS[i], {size:13, bold:true, color:wknd?WKND_FG:HDR_FG, align:'center'});
    pdf.text(cx+dayW/2, y+30, safeDt(d),   {size:9,           color:wknd?'#FCD34D':'#9CA3AF', align:'center'});
  });
  pdf.line(M, y+hdrH, M+tableW, y+hdrH, {color:RULE, w:1.5});
  y += hdrH;

  // ── Employee rows ─────────────────────────────────────────
  employees.forEach((emp, ei) => {
    const rH        = scaledRows[ei];
    const empShifts = weekShifts.filter(s => s.eid===emp.id);
    const rowBg     = ei%2===1 ? ROW_ALT : '#FFFFFF';

    pdf.rect(M, y, tableW, rH, {fill:rowBg});

    // Left colour stripe (engineering: precision accent)
    pdf.rect(M, y, 4, rH, {fill: ei%2===0 ? '#8FCB72' : '#BBF7D0'});

    // Name — large, vertically centred
    const mid = y + rH/2;
    pdf.text(M+14, mid-9,  safe(emp.name),     {size:14, bold:true, color:INK});
    pdf.text(M+14, mid+8,  safe(emp.role||''), {size:8,             color:'#64748B'});

    weekDays.forEach((d, di) => {
      const cx        = M + nameW + di*dayW;
      const wknd      = d.getDay()===0 || d.getDay()===6;
      const isSat     = d.getDay()===6;
      const isSun     = d.getDay()===0;
      const dayShifts = empShifts.filter(s => s.date===isoDate(d));

      if (wknd) pdf.rect(cx, y, dayW, rH, {fill: ei%2===1 ? WKND_COL2 : WKND_COL});

      // Grid lines
      if (isSat) pdf.line(cx, y, cx, y+rH, {color:WKND_FG, w:2});
      else        pdf.line(cx, y, cx, y+rH, {color:RULE_LT, w:0.5});
      if (isSun)  pdf.line(cx+dayW, y, cx+dayW, y+rH, {color:WKND_FG, w:2});

      if (dayShifts.length === 0) {
        pdf.text(cx+dayW/2, y+rH/2-5, '-', {size:15, color:'#D1D5DB', align:'center'});
      } else {
        const slotH = rH / dayShifts.length;
        dayShifts.forEach((sh, si) => {
          const sy  = y + si*slotH;
          const hrs = shiftHrs(sh);

          if (sh.openEnd) {
            // Open-end: start time left + double-ruled handwriting zone right
            const pH = Math.max(44, slotH-8);
            const py = sy + (slotH-pH)/2;
            // Outer pill — light slate
            pdf.rect(cx+4, py, dayW-8, pH, {fill:OPEN_BG, stroke:OPEN_BD});
            // Inner precision border
            pdf.rect(cx+6, py+2, dayW-12, pH-4, {stroke:'#CBD5E1'});
            // Start time — large bold left
            pdf.text(cx+12, py+12, p12(sh.start), {size:14, bold:true, color:OPEN_TXT});
            pdf.text(cx+12, py+27, '->', {size:9, color:'#64748B'});
            // FINISH zone — right 55%
            const zx = cx + Math.round(dayW*0.44);
            const zw = dayW - Math.round(dayW*0.44) - 10;
            pdf.text(zx+zw/2, py+10, 'FINISH', {size:6.5, bold:true, color:'#94A3B8', align:'center'});
            // Double ruled lines for handwriting
            pdf.line(zx, py+pH-16, zx+zw, py+pH-16, {color:OPEN_LINE, w:1.0});
            pdf.line(zx, py+pH-7,  zx+zw, py+pH-7,  {color:OPEN_LINE, w:0.4});
          } else {
            // Regular shift pill
            const pH = Math.max(36, slotH-10);
            const py = sy + (slotH-pH)/2;
            const bg  = wknd ? PILL_WD_BG  : PILL_WK_BG;
            const bd  = wknd ? PILL_WD_BD  : PILL_WK_BD;
            const tc  = wknd ? PILL_WD_TXT : PILL_WK_TXT;
            pdf.rect(cx+5, py, dayW-10, pH, {fill:bg, stroke:bd});
            pdf.text(cx+dayW/2, py+pH*0.28, safe(p12(sh.start)+'-'+p12(sh.end)), {size:12, bold:true, color:tc, align:'center'});
            pdf.text(cx+dayW/2, py+pH*0.68, hrs.toFixed(1)+'h',                  {size:9,             color:tc, align:'center'});
          }
        });
      }
    });

    // Row dividers
    pdf.line(M, y+rH, M+tableW, y+rH, {color: ei===employees.length-1 ? RULE : RULE_LT, w: ei===employees.length-1 ? 1.5 : 0.5});
    y += rH;
  });

  // Outer vertical borders
  pdf.line(M,          64, M,          y, {color:RULE, w:1.5});
  pdf.line(M+tableW,   64, M+tableW,   y, {color:RULE, w:1.5});

  // ── Footer ────────────────────────────────────────────────
  y += 9;
  pdf.text(M,   y, 'Roster subject to change. Contact your manager with any queries.', {size:7.5, color:'#6B7280'});
  pdf.text(W-M, y, 'Mise Hospitality Finance  |  '+todayStr, {size:7.5, color:'#9CA3AF', align:'right'});

  return pdf;
};

// ════════════════════════════════════════════════════════════
//  ROSTER TAB
// ════════════════════════════════════════════════════════════
function BudgetBar({ total, budget, onEdit }) {
  const pct       = Math.min((total / budget) * 100, 100);
  const over      = total > budget;
  const barCol    = over ? C.red : pct > 85 ? C.yellow : C.green;
  const remaining = budget - total;
  return (
    <div style={{ marginBottom:12, background:C.surfaceAlt, border:`1px solid ${over?"rgba(220,38,38,.3)":C.border}`, borderRadius:9, padding:"10px 14px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <div style={{ fontSize:11.5, fontWeight:700, color: over ? C.red : C.text }}>
          {over ? `⚠️ Over budget by ${money(total - budget)}` : `💰 Budget: ${money(remaining)} remaining`}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:10.5, color:C.muted }}>{money(total)} / {money(budget)} ({pct.toFixed(0)}%)</span>
          <button onClick={onEdit} style={{ fontSize:10, color:C.dim, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", padding:"2px 6px" }}>Edit</button>
        </div>
      </div>
      <div style={{ height:8, background:C.border, borderRadius:4, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:barCol, borderRadius:4, transition:"width .4s" }}/>
      </div>
    </div>
  );
}

function RosterTab({ employees, roster, setRoster, showToast, revenue = [] }) {
  // ── Week navigation ───────────────────────────────────────
  const [viewMonday, setViewMonday] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0,0,0,0);
    return d;
  });
  const [shiftModal, setShiftModal] = useState(null);
  const [applyOT,    setApplyOT]   = useState(true);
  const [applyWknd,  setApplyWknd] = useState(true);
  // ── Weekly budget ─────────────────────────────────────────
  const [weekBudget, setWeekBudget] = useState(() =>
    parseFloat(localStorage.getItem("mise_week_budget") || "0")
  );
  const [editBudget, setEditBudget] = useState(false);
  // ── Employee sort order — persisted ──────────────────────
  const [empOrder, setEmpOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mise_roster_order") || "[]");
      return saved.length > 0 ? saved : employees.map(e => e.id);
    } catch { return employees.map(e => e.id); }
  });
  const [draggingId, setDraggingId] = useState(null);

  const saveOrder = order => {
    setEmpOrder(order);
    localStorage.setItem("mise_roster_order", JSON.stringify(order));
  };

  // Sorted employees — new employees appended to end
  const sortedEmployees = [
    ...empOrder.map(id => employees.find(e => e.id === id)).filter(Boolean),
    ...employees.filter(e => !empOrder.includes(e.id)),
  ];

  const addDays = (base, n) => { const d = new Date(base); d.setDate(d.getDate()+n); return d; };
  // Use LOCAL date parts — toISOString() returns UTC which shifts date by timezone offset
  const isoDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const prevWeek = () => setViewMonday(d => addDays(d,-7));
  const nextWeek = () => setViewMonday(d => addDays(d, 7));
  const thisWeek = () => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0,0,0,0);
    setViewMonday(d);
  };

  // 7 days Mon → Sun
  const weekDays  = Array.from({length:7}, (_,i) => addDays(viewMonday, i));
  const weekDates = weekDays.map(isoDate);
  const weekStart = weekDays[0].toLocaleDateString("en-AU",{day:"2-digit",month:"short"});
  const weekEnd   = weekDays[6].toLocaleDateString("en-AU",{day:"2-digit",month:"short",year:"numeric"});
  const weekShifts = roster.filter(s => weekDates.includes(s.date));

  const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  // ── Shift helpers ─────────────────────────────────────────
  const shiftNetMins = s => {
    if (s.openEnd) return 0;
    const [sh,sm] = s.start.split(":").map(Number);
    const [eh,em] = s.end.split(":").map(Number);
    return Math.max(0, (eh*60+em)-(sh*60+sm)-(s.break_mins||0));
  };
  const shiftHrs  = s => shiftNetMins(s) / 60;
  // Parse "YYYY-MM-DD" as LOCAL date to avoid UTC midnight → wrong-day-of-week bug
  const isWeekend = dateStr => {
    const [y,m,d] = dateStr.split('-').map(Number);
    const day = new Date(y, m-1, d).getDay(); // local-time constructor, no UTC shift
    return day === 0 || day === 6;
  };

  // ── OT-aware per-employee weekly breakdown ─────────────────
  // Rules (Fair Work / Hospitality Industry Award):
  //   • Weekend / PH shifts → ×1.75 always (not counted toward OT threshold)
  //   • Weekday shifts      → accumulate; once total weekday hrs > emp.std_hrs → ×1.5
  //   • Casual employees    → effective rate already includes 25% loading; OT still at ×1.5 of effective rate
  // Returns Map<shiftId, { stdHrs, otHrs, wkndHrs, stdPay, otPay, wkndPay, gross, isOT }>
  const calcEmpWeekBreakdown = (emp, shifts) => {
    const er         = effRate(emp);
    const threshold  = emp.std_hrs || 38; // contracted weekly hours
    let weekdayBucket = 0;               // running weekday hours this week
    const result = new Map();

    // Process weekday shifts first (chronological), then weekends
    const sorted = [...shifts].sort((a,b) => {
      const aWknd = isWeekend(a.date) ? 1 : 0;
      const bWknd = isWeekend(b.date) ? 1 : 0;
      if (aWknd !== bWknd) return aWknd - bWknd; // weekdays first
      return a.date < b.date ? -1 : a.date > b.date ? 1 : a.start.localeCompare(b.start);
    });

    sorted.forEach(sh => {
      const hrs = shiftHrs(sh);
      const wkndMulti = applyWknd ? WKND_RATE : 1;
      const otMulti   = applyOT   ? OT_RATE   : 1;
      if (isWeekend(sh.date)) {
        // Weekend: apply wkndMulti (1.75 or 1.0), not counted toward weekday OT threshold
        result.set(sh.id, {
          stdHrs:0, otHrs:0, wkndHrs:hrs,
          stdPay:0, otPay:0, wkndPay: er * wkndMulti * hrs,
          gross: er * wkndMulti * hrs,
          isOT: false, isWknd: true,
        });
      } else {
        // Weekday: split at threshold
        const alreadyUsed = weekdayBucket;
        const stdPortion  = Math.max(0, Math.min(hrs, threshold - alreadyUsed));
        const otPortion   = hrs - stdPortion;
        weekdayBucket    += hrs;
        const stdPay  = er              * stdPortion;
        const otPay   = er * otMulti    * otPortion;
        result.set(sh.id, {
          stdHrs: stdPortion, otHrs: otPortion, wkndHrs: 0,
          stdPay, otPay, wkndPay: 0,
          gross: stdPay + otPay,
          isOT: otPortion > 0, isWknd: false,
          otHrsLabel: otPortion > 0 ? otPortion.toFixed(1) : null,
        });
      }
    });
    return result;
  };

  // Build full breakdown for all employees this week
  const empBreakdowns = new Map(
    employees.map(emp => [
      emp.id,
      calcEmpWeekBreakdown(emp, weekShifts.filter(s => s.eid === emp.id))
    ])
  );

  // Convenience: get one shift's breakdown entry
  const shiftData = (sh) => empBreakdowns.get(sh.eid)?.get(sh.id) ?? null;
  // For grid display: cost of one shift
  const shiftCost = (sh) => shiftData(sh)?.gross ?? 0;

  // Unique avatar colours per employee
  const empColor = emp => avatarBg(emp.id, emp.color);

  // ── Save / delete ─────────────────────────────────────────
  const saveShift  = sh => {
    if (sh.id) { setRoster(p => p.map(s => s.id===sh.id ? sh : s)); showToast("Shift updated!"); }
    else        { setRoster(p => [...p, {...sh, id:Date.now()}]);      showToast("Shift added!"); }
    setShiftModal(null);
  };
  const deleteShift = id => { setRoster(p => p.filter(s => s.id!==id)); showToast("Shift removed."); };

  // ── Labour cost summary ───────────────────────────────────
  // Use getSuperRate keyed to the Monday of the viewed week
  const [wkYr, wkNum] = (() => {
    // Get ISO week number of viewMonday
    const d = new Date(Date.UTC(viewMonday.getFullYear(), viewMonday.getMonth(), viewMonday.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const wk = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    return [d.getUTCFullYear(), wk];
  })();
  const weekStr = `${wkYr}-W${String(wkNum).padStart(2,"0")}`;
  const superR  = getSuperRate(weekStr);

  const empSummary = sortedEmployees.map(emp => {
    const shifts    = weekShifts.filter(s => s.eid === emp.id);
    const bd        = empBreakdowns.get(emp.id) || new Map();
    const totalHrs  = shifts.reduce((s,sh) => s + shiftHrs(sh), 0);
    const stdHrs    = [...bd.values()].reduce((s,v) => s + v.stdHrs,  0);
    const otHrs     = [...bd.values()].reduce((s,v) => s + v.otHrs,   0);
    const wkndHrs   = [...bd.values()].reduce((s,v) => s + v.wkndHrs, 0);

    // ── Fixed-pay employees: gross is the fixed weekly amount regardless of rostered hours ──
    // Hours are still displayed (for labour-efficiency insight), but cost = fixed.
    const isFixed = isFixedPay(emp);
    const gross   = isFixed
      ? (parseFloat(emp.fixed_weekly_gross) || 0)
      : [...bd.values()].reduce((s,v) => s + v.gross, 0);

    // OTE for super: for fixed, treat full gross as ordinary; for hourly use the roster breakdown
    const oteRoster = isFixed
      ? gross
      : (stdHrs + wkndHrs + otHrs) * effRate(emp); // OTE: base rate on all ordinary + OT base

    // Super: respect super_override if set, else SGC on OTE
    const super_ = hasSuperOverride(emp)
      ? (parseFloat(emp.super_override) || 0)
      : oteRoster * superR;

    // PAYG: respect payg_override if set, else ATO Scale 2
    const payg = hasPaygOverride(emp)
      ? (parseFloat(emp.payg_override) || 0)
      : calcWeeklyPAYG(gross, emp.tfn);

    const net       = gross - payg;
    const labour    = gross + super_;
    return { emp, shifts, totalHrs, stdHrs, otHrs, wkndHrs, gross, super:super_, payg, net, labour, isFixed };
  });

  const totHrs    = empSummary.reduce((s,e) => s + e.totalHrs, 0);
  const totGross  = empSummary.reduce((s,e) => s + e.gross,    0);
  const totSuper  = empSummary.reduce((s,e) => s + e.super,    0);
  const totPAYG   = empSummary.reduce((s,e) => s + e.payg,     0);
  const totLabour = empSummary.reduce((s,e) => s + e.labour,   0);

  const exportRosterPDF = () => {
    const pdf = renderRosterPDF({ employees, weekShifts, weekDays, weekStart, weekEnd, isoDate, shiftHrs, isWeekend });
    pdfDownload(pdf, `Roster_${isoDate(weekDays[0])}_to_${isoDate(weekDays[6])}.pdf`);
    showToast("Roster PDF downloaded!");
  };

  // Copy last week's shifts into the current week (+7 days each)
  const copyLastWeek = () => {
    const lastWeekDates = weekDays.map(d => isoDate(addDays(d, -7)));
    const lastWeekShifts = roster.filter(s => lastWeekDates.includes(s.date));
    if (lastWeekShifts.length === 0) {
      showToast("No shifts found in the previous week.");
      return;
    }
    // Check if current week already has shifts
    if (weekShifts.length > 0) {
      if (!window.confirm(`This week already has ${weekShifts.length} shift(s). Copy last week on top?`)) return;
    }
    const copied = lastWeekShifts.map(s => ({
      ...s,
      id:   Date.now() + Math.random(),
      date: isoDate(addDays(new Date(s.date + "T00:00:00"), 7)),
    }));
    setRoster(p => [...p, ...copied]);
    showToast(`Copied ${copied.length} shift${copied.length>1?"s":""} from last week!`);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      {shiftModal && (
        <ShiftModal employees={employees} initial={shiftModal} onSave={saveShift} onClose={() => setShiftModal(null)} applyOT={applyOT} applyWknd={applyWknd}/>
      )}

      {/* ── Week navigator ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:8,flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:6}}>
          <button className="btn-b" onClick={prevWeek}>← Prev</button>
          <button className="btn-b" onClick={thisWeek}>Today</button>
          <button className="btn-b" onClick={nextWeek}>Next →</button>
        </div>
        <div style={{fontWeight:700,fontSize:15,letterSpacing:"-.3px"}}>
          📅 Week of {weekStart} – {weekEnd}
        </div>
        <div style={{display:"flex",gap:6}}>
          <button className="btn-b" title="Copy all shifts from last week into this week" onClick={copyLastWeek}>📋 Copy Last Week</button>
          <button className="btn-b" onClick={exportRosterPDF}>⬇️ Export PDF</button>
          <button className="btn" onClick={() => setShiftModal({date:isoDate(weekDays[0])})}>
            + Add Shift
          </button>
        </div>
      </div>

      {/* ── Weekly cost banner + budget bar ── */}
      {totLabour > 0 && (
        <>
        <div style={{
          display:"flex", gap:0, marginBottom:12, borderRadius:11, overflow:"hidden",
          border:`1px solid ${C.border}`,
        }}>
          {[
            { lbl:"Staff Rostered", val:`${empSummary.filter(e=>e.totalHrs>0).length} of ${employees.length}`, col:C.teal,     bg:"rgba(61,211,187,.06)" },
            { lbl:"Total Hours",    val:`${totHrs.toFixed(1)}h`,                                               col:C.blue,     bg:"rgba(96,165,250,.06)" },
            { lbl:"Gross Wages",    val:money(totGross),                                                       col:C.text,     bg:C.surface             },
            { lbl:"Super (SGC)",    val:money(totSuper),                                                       col:C.blue,     bg:C.surfaceAlt          },
            { lbl:"Total Labour Cost", val:money(totLabour),                                                   col:C.red,      bg:"rgba(220,38,38,.06)" },
          ].map((s,i) => (
            <div key={i} style={{flex:1, padding:"11px 14px", background:s.bg, borderRight:i<4?`1px solid ${C.border}`:"none"}}>
              <div style={{fontSize:9.5,color:C.dim,textTransform:"uppercase",letterSpacing:".6px",marginBottom:4}}>{s.lbl}</div>
              <div className="mono" style={{fontSize:15,fontWeight:700,color:s.col}}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* ── Labour Cost % (this rostered week) ── */}
        {(() => {
          // Revenue logged for the same week as the roster being viewed
          const weekRev = revenue
            .filter(r => weekDates.includes(r.date))
            .reduce((s,r) => s + revTotal(r), 0);
          if (weekRev <= 0) {
            return (
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"10px 14px",background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:9,fontSize:11.5,color:C.muted}}>
                <span style={{fontSize:15}}>📊</span>
                <span>Log this week's sales to see your labour cost percentage. Labour cost includes wages + super.</span>
              </div>
            );
          }
          const labourPct = (totLabour / weekRev) * 100;
          // Healthy 25–30% per hospitality benchmark
          let st, col, bg, msg;
          if (labourPct <= 30)      { st="Healthy";       col=C.green;  bg="rgba(5,150,105,.08)";  msg="Within the healthy restaurant range (25–30%)."; }
          else if (labourPct <= 38) { st="Slightly High"; col=C.yellow; bg="rgba(217,119,6,.08)";   msg="A little above the healthy range. Watch your rostered hours."; }
          else                      { st="Critical";      col="rgba(220,100,38,1)"; bg="rgba(220,100,38,.08)"; msg="Labour cost is above the healthy restaurant range. Consider trimming shifts."; }
          return (
            <div style={{background:bg,border:`1px solid ${col}33`,borderRadius:11,padding:"14px 16px",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{fontSize:24,fontWeight:800,color:col,fontFamily:"var(--mono)"}} className="mono">{labourPct.toFixed(1)}%</div>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:12,fontWeight:700,color:col}}>{st}</span>
                      <span style={{fontSize:10,color:C.muted}}>Labour Cost % · this week</span>
                    </div>
                    <div style={{fontSize:11,color:C.muted,marginTop:3,maxWidth:380,lineHeight:1.5}}>{msg}</div>
                  </div>
                </div>
                <div style={{textAlign:"right",fontSize:10.5,color:C.muted,lineHeight:1.6}}>
                  <div>Labour {money(totLabour)} ÷ Sales {money(weekRev)}</div>
                  <div style={{color:C.dim}}>Healthy range: 25–30%</div>
                </div>
              </div>
              {/* Benchmark bar */}
              <div style={{marginTop:12,position:"relative",height:8,background:C.border,borderRadius:4,overflow:"visible"}}>
                {/* healthy zone band 25-30% (of a 0-50% scale) */}
                <div style={{position:"absolute",left:"50%",width:"10%",height:"100%",background:"rgba(5,150,105,.35)",borderRadius:2}}/>
                {/* current marker */}
                <div style={{position:"absolute",left:`${Math.min(100,(labourPct/50)*100)}%`,top:-3,width:3,height:14,background:col,borderRadius:2,transform:"translateX(-50%)"}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.dim,marginTop:4}}>
                <span>0%</span><span>25–30% healthy</span><span>50%+</span>
              </div>
            </div>
          );
        })()}

        {/* ── Weekly budget bar ── */}
        {editBudget ? (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 14px" }}>
            <span style={{ fontSize:12, fontWeight:700, color:C.muted, whiteSpace:"nowrap" }}>Weekly Labour Budget $</span>
            <input className="inp" type="number" placeholder="e.g. 4000" style={{ flex:1, maxWidth:140 }}
              defaultValue={weekBudget || ""} autoFocus
              onBlur={e => { const v = parseFloat(e.target.value)||0; setWeekBudget(v); localStorage.setItem("mise_week_budget",v); setEditBudget(false); }}
              onKeyDown={e => { if(e.key==="Enter"){ const v=parseFloat(e.target.value)||0; setWeekBudget(v); localStorage.setItem("mise_week_budget",v); setEditBudget(false); } if(e.key==="Escape") setEditBudget(false); }}/>
            <button className="btn-g" onClick={() => setEditBudget(false)}>Cancel</button>
          </div>
        ) : weekBudget > 0 ? (
          <BudgetBar total={totLabour} budget={weekBudget} onEdit={() => setEditBudget(true)}/>
        ) : (
          <button onClick={() => setEditBudget(true)}
            style={{ display:"flex", alignItems:"center", gap:7, marginBottom:12, padding:"8px 14px", borderRadius:9, cursor:"pointer", fontFamily:"inherit", fontSize:11.5, fontWeight:600, background:"none", border:`1px dashed ${C.border}`, color:C.dim, width:"100%" }}>
            <span style={{ fontSize:14 }}>💰</span> Set weekly labour budget (optional)
          </button>
        )}
        </>
      )}
      <div style={{overflowX:"auto",marginBottom:20,border:`1px solid ${C.border}`,borderRadius:13,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:820}}>
          <thead>
            <tr>
              <th style={{background:"#111827",color:"#fff",padding:"10px 12px",textAlign:"left",fontSize:11,fontWeight:700,width:130,whiteSpace:"nowrap"}}>
                Staff
              </th>
              {weekDays.map((d,i) => {
                const wknd = d.getDay()===0||d.getDay()===6;
                const isToday = isoDate(d)===isoDate(new Date());
                return (
                  <th key={i} style={{background:isToday?"#1C4532":wknd?"#78350F":"#111827",color:isToday?"#86EFAC":wknd?"#FDE68A":"#fff",padding:"8px 4px",textAlign:"center",fontSize:11,fontWeight:700,minWidth:100,position:"relative"}}>
                    <div>{DAY_LABELS[i]}</div>
                    <div style={{fontSize:9.5,fontWeight:400,opacity:.8}}>
                      {d.toLocaleDateString("en-AU",{day:"2-digit",month:"short"})}
                      {wknd && <span style={{marginLeft:4,fontSize:8.5,opacity:.7}}>×1.75</span>}
                    </div>
                  </th>
                );
              })}
              <th style={{background:"#1F2937",color:"#9CA3AF",padding:"10px 8px",textAlign:"right",fontSize:10,fontWeight:700,whiteSpace:"nowrap"}}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedEmployees.map((emp,ei) => {
              const col = empColor(emp);
              const empWeekShifts = weekShifts.filter(s => s.eid===emp.id);
              const empHrs  = empWeekShifts.reduce((s,sh) => s+shiftHrs(sh), 0);
              const empCost = empWeekShifts.reduce((s,sh) => s+shiftCost(sh), 0);
              const empOTHrs = [...(empBreakdowns.get(emp.id)||new Map()).values()].reduce((s,v)=>s+v.otHrs,0);
              const isDragging = draggingId === emp.id;
              return (
                <tr key={emp.id}
                  draggable
                  onDragStart={() => setDraggingId(emp.id)}
                  onDragOver={e => { e.preventDefault(); }}
                  onDrop={() => {
                    if (!draggingId || draggingId === emp.id) return;
                    const order = sortedEmployees.map(e => e.id);
                    const from = order.indexOf(draggingId);
                    const to   = order.indexOf(emp.id);
                    if (from < 0 || to < 0) return;
                    const next = [...order];
                    next.splice(from, 1);
                    next.splice(to, 0, draggingId);
                    saveOrder(next);
                    setDraggingId(null);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  style={{background: isDragging ? "rgba(143,203,114,.08)" : ei%2===0 ? C.surface : C.surfaceAlt, opacity: isDragging ? 0.5 : 1, cursor:"grab"}}>
                  {/* Employee name cell */}
                  <td style={{padding:"8px 10px",borderBottom:`1px solid ${C.border}`,verticalAlign:"middle"}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      {/* Drag handle */}
                      <span style={{color:C.dim,fontSize:12,cursor:"grab",flexShrink:0,lineHeight:1}}>⠿</span>
                      <div style={{width:28,height:28,borderRadius:"50%",background:col,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",flexShrink:0}}>
                        {initials(emp.name)}
                      </div>
                      <div>
                        <div style={{fontWeight:600,fontSize:12}}>{emp.name}</div>
                        {empHrs > 0
                          ? <div style={{fontSize:9.5,color:C.muted}}>{empHrs.toFixed(1)}h · <span style={{color:C.yellow,fontWeight:600}}>{money(empCost)}</span></div>
                          : <div style={{fontSize:9.5,color:C.dim}}>No shifts</div>
                        }
                      </div>
                    </div>
                  </td>
                  {/* Day cells */}
                  {weekDays.map((d,di) => {
                    const date = isoDate(d);
                    const dayShifts = empWeekShifts.filter(s => s.date===date);
                    const wknd = d.getDay()===0||d.getDay()===6;
                    return (
                      <td key={di} style={{
                        padding:"4px 3px",
                        borderBottom:`1px solid ${C.border}`,
                        borderLeft:`1px solid ${C.border}`,
                        verticalAlign:"top",
                        background: wknd ? "rgba(251,191,36,.06)" : undefined,
                        minWidth:100,
                      }}>
                        {dayShifts.map(sh => {
                          const sd = shiftData(sh);
                          const hasOT   = sd?.isOT;
                          const isWknd  = sd?.isWknd;
                          const borderC = hasOT ? "#DC2626" : isWknd ? "#D97706" : col;

                          if (sh.openEnd) {
                            // ── Open-end pill: start time + ruled handwriting zone ──
                            return (
                              <div key={sh.id} style={{
                                background: "#F8FAFC",
                                border: `1.5px solid #64748B`,
                                borderRadius: 6,
                                marginBottom: 3,
                                cursor: "pointer",
                                position: "relative",
                                overflow: "hidden",
                              }} onClick={() => setShiftModal(sh)}>
                                {/* Top: start time */}
                                <div style={{
                                  padding: "5px 8px 3px 8px",
                                  borderBottom: "1px solid #CBD5E1",
                                  display: "flex", alignItems: "center", gap: 4,
                                }}>
                                  <span style={{ fontSize:12, fontWeight:800, color:"#1E3A5F", letterSpacing:"-.3px" }}>
                                    {fmt12(sh.start)}
                                  </span>
                                  <span style={{ fontSize:10, color:"#64748B" }}>→</span>
                                </div>
                                {/* Bottom: handwriting zone */}
                                <div style={{ padding:"4px 8px 5px 8px" }}>
                                  <div style={{ fontSize:7, fontWeight:700, color:"#94A3B8", letterSpacing:".8px", textTransform:"uppercase", marginBottom:3 }}>Finish</div>
                                  {/* Ruled lines for writing */}
                                  <div style={{ borderBottom:"1px solid #94A3B8", height:14, marginBottom:2 }}/>
                                </div>
                                <button
                                  style={{position:"absolute",top:2,right:3,background:"none",border:"none",cursor:"pointer",fontSize:9,color:"#DC2626",padding:0,lineHeight:1,opacity:.6}}
                                  onClick={e => { e.stopPropagation(); deleteShift(sh.id); }}
                                  title="Remove shift"
                                >✕</button>
                              </div>
                            );
                          }

                          // ── Regular shift pill ──
                          return (
                            <div key={sh.id} style={{
                              background: (hasOT ? "#DC2626" : isWknd ? "#D97706" : col)+"18",
                              border: `1.5px solid ${borderC}`,
                              borderRadius: 6,
                              padding: "5px 7px 4px 7px",
                              marginBottom: 3,
                              cursor: "pointer",
                              position: "relative",
                              overflow: "hidden",
                            }}
                              onClick={() => setShiftModal(sh)}
                            >
                              {/* Time — large, constrained, no wrap */}
                              <div style={{
                                fontSize: 11, fontWeight: 800, color: borderC,
                                lineHeight: 1.15, letterSpacing: "-.3px",
                                whiteSpace: "nowrap", overflow: "hidden",
                                textOverflow: "ellipsis", maxWidth: "100%",
                              }}>
                                {fmt12(sh.start)}–{fmt12(sh.end)}
                              </div>
                              {/* Hours + cost */}
                              <div style={{ fontSize:9, color:C.muted, marginTop:2, lineHeight:1.3 }}>
                                {shiftHrs(sh).toFixed(1)}h
                                {shiftCost(sh) > 0 && <span style={{color:C.dim}}> · {money(shiftCost(sh))}</span>}
                              </div>
                              {/* OT / Weekend rate badges */}
                              {hasOT && applyOT && (
                                <div style={{fontSize:8,fontWeight:700,color:"#DC2626",marginTop:1,lineHeight:1}}>
                                  ⚡ {sd.otHrs.toFixed(1)}h OT ×1.5
                                </div>
                              )}
                              {isWknd && applyWknd && (
                                <div style={{fontSize:8,fontWeight:700,color:"#D97706",marginTop:1,lineHeight:1}}>
                                  ×1.75 Wknd
                                </div>
                              )}
                              {sh.note && (
                                <div style={{fontSize:8,color:C.dim,marginTop:1,fontStyle:"italic",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}>
                                  {sh.note}
                                </div>
                              )}
                              <button
                                style={{position:"absolute",top:2,right:3,background:"none",border:"none",cursor:"pointer",fontSize:9,color:"#DC2626",padding:0,lineHeight:1,opacity:.6}}
                                onClick={e => { e.stopPropagation(); deleteShift(sh.id); }}
                                title="Remove shift"
                              >✕</button>
                            </div>
                          );
                        })}
                        <button
                          style={{width:"100%",background:"none",border:`1px dashed ${C.border}`,borderRadius:5,color:C.dim,fontSize:9.5,padding:"3px 0",cursor:"pointer",marginTop:dayShifts.length?1:0}}
                          onClick={() => setShiftModal({date, eid:emp.id})}
                        >+ shift</button>
                      </td>
                    );
                  })}
                  {/* Row total */}
                  <td style={{padding:"8px 10px",borderBottom:`1px solid ${C.border}`,borderLeft:`1px solid ${C.border}`,textAlign:"right",verticalAlign:"middle"}}>
                    <div className="mono" style={{fontWeight:700,fontSize:12,color: empHrs>0?C.text:C.dim}}>{empHrs>0?`${empHrs.toFixed(1)}h`:"—"}</div>
                    {empOTHrs > 0 && <div style={{fontSize:9,fontWeight:700,color:"#DC2626"}}>⚡ {empOTHrs.toFixed(1)}h OT</div>}
                  </td>
                </tr>
              );
            })}
            {/* Daily totals row */}
            <tr style={{background:C.surfaceAlt, borderTop:`2px solid ${C.border}`}}>
              <td style={{padding:"8px 10px",fontWeight:700,fontSize:10,color:C.accent,textTransform:"uppercase",letterSpacing:".6px"}}>DAY TOTAL</td>
              {weekDays.map((d,di) => {
                const date = isoDate(d);
                const dayShifts = weekShifts.filter(s => s.date===date);
                const dayHrs  = dayShifts.reduce((s,sh)=>s+shiftHrs(sh), 0);
                const dayCost = dayShifts.reduce((s,sh)=>s+shiftCost(sh), 0);
                const isWkndCol = d.getDay()===0 || d.getDay()===6;
                return (
                  <td key={di} style={{padding:"8px 4px",textAlign:"center",borderLeft:`1px solid ${C.border}`, background: isWkndCol ? "rgba(212,168,67,0.08)" : "transparent"}}>
                    <div className="mono" style={{fontWeight:700,fontSize:12,color:dayHrs>0 ? C.text : C.dim}}>{dayHrs>0?`${dayHrs.toFixed(1)}h`:"—"}</div>
                  </td>
                );
              })}
              <td style={{padding:"8px 10px",textAlign:"right",borderLeft:`1px solid ${C.border}`}}>
                <div className="mono" style={{fontWeight:700,fontSize:13,color:C.accent}}>{totHrs.toFixed(1)}h</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Labour Cost Summary ── */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:"18px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
          <div style={{fontWeight:700,fontSize:14}}>💰 Labour Cost Summary — {weekStart} to {weekEnd}</div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {/* OT toggle */}
            <div style={{display:"flex",alignItems:"center",gap:6,background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 10px"}}>
              <span style={{fontSize:11,color:C.muted,whiteSpace:"nowrap"}}>OT ×1.5</span>
              <div onClick={() => setApplyOT(v => !v)} style={{
                width:34, height:18, borderRadius:9, cursor:"pointer",
                background: applyOT ? C.accent : "#4B5563",
                position:"relative", transition:"background .2s", flexShrink:0,
              }}>
                <div style={{
                  position:"absolute", top:2, left: applyOT ? 18 : 2,
                  width:14, height:14, borderRadius:"50%", background:"#fff",
                  transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,.3)",
                }}/>
              </div>
            </div>
            {/* Weekend penalty toggle */}
            <div style={{display:"flex",alignItems:"center",gap:6,background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 10px"}}>
              <span style={{fontSize:11,color:C.muted,whiteSpace:"nowrap"}}>Wknd ×1.75</span>
              <div onClick={() => setApplyWknd(v => !v)} style={{
                width:34, height:18, borderRadius:9, cursor:"pointer",
                background: applyWknd ? C.accent : "#4B5563",
                position:"relative", transition:"background .2s", flexShrink:0,
              }}>
                <div style={{
                  position:"absolute", top:2, left: applyWknd ? 18 : 2,
                  width:14, height:14, borderRadius:"50%", background:"#fff",
                  transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,.3)",
                }}/>
              </div>
            </div>
            <div style={{fontSize:10,color:C.muted}}>Super @ {(superR*100).toFixed(1)}% · ATO 2024-25 PAYG</div>
          </div>
        </div>

        {/* Stat cards — now includes OT hours */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16}}>
          {[
            {lbl:"Total Hours",    val:`${totHrs.toFixed(1)}h`,                                           cls:"",  ico:"🕐"},
            {lbl:"Std Hours",      val:`${empSummary.reduce((s,e)=>s+e.stdHrs,0).toFixed(1)}h`,           cls:"",  ico:"📋"},
            {lbl:"OT Hours",       val:`${empSummary.reduce((s,e)=>s+e.otHrs,0).toFixed(1)}h`,  cls:empSummary.some(e=>e.otHrs>0)?"r":"", ico:"⚡", sub: applyOT?"×1.5":"flat rate"},
            {lbl:"Wknd Hours",     val:`${empSummary.reduce((s,e)=>s+e.wkndHrs,0).toFixed(1)}h`, cls:"y", ico:"📅", sub: applyWknd?"×1.75":"flat rate"},
            {lbl:"Total Labour",   val:money(totLabour),                                                  cls:"g", ico:"📊"},
          ].map((c,i) => (
            <div key={i} className="card" style={{display:"flex",flexDirection:"column",gap:4}}>
              <div className="clbl">{c.ico} {c.lbl}</div>
              <div className={`cval ${c.cls}`}>{c.val}</div>
              {c.sub && <div style={{fontSize:9,color:C.muted}}>{c.sub}</div>}
            </div>
          ))}
        </div>

        {/* Per-employee breakdown table */}
        {(totHrs > 0 || empSummary.some(e => e.isFixed)) ? (
          <div style={{overflowX:"auto"}}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{textAlign:"left"}}>Employee</th>
                  <th style={{textAlign:"right"}}>Std Hrs</th>
                  <th style={{textAlign:"right",color:"#DC2626"}}>OT Hrs {applyOT?"×1.5":"(flat)"}</th>
                  <th style={{textAlign:"right",color:"#D97706"}}>Wknd Hrs {applyWknd?"×1.75":"(flat)"}</th>
                  <th style={{textAlign:"right"}}>Gross Pay</th>
                  <th style={{textAlign:"right"}}>PAYG (ATO)</th>
                  <th style={{textAlign:"right"}}>Super ({(superR*100).toFixed(1)}%)</th>
                  <th style={{textAlign:"right"}}>Labour Cost</th>
                </tr>
              </thead>
              <tbody>
                {empSummary.filter(e => e.shifts.length > 0 || e.isFixed).map(({emp,shifts,totalHrs,stdHrs,otHrs,wkndHrs,gross,super:sup,payg,net,labour,isFixed}) => (
                  <tr key={emp.id}>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <div style={{width:22,height:22,borderRadius:"50%",background:empColor(emp),display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff",flexShrink:0}}>
                          {initials(emp.name)}
                        </div>
                        <div>
                          <div style={{fontWeight:600,fontSize:12,display:"flex",alignItems:"center",gap:6}}>
                            {emp.name}
                            {isFixed && <span style={{fontSize:9,fontWeight:600,color:"#0C0F0D",background:C.teal,padding:"1.5px 6px",borderRadius:4,whiteSpace:"nowrap"}}>FIXED</span>}
                          </div>
                          <div style={{fontSize:9.5,color:C.muted}}>
                            {isFixed
                              ? <>{emp.role} · {money(parseFloat(emp.fixed_weekly_gross)||0)}/wk</>
                              : <>{emp.role} · {emp.std_hrs}h threshold</>
                            }
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="mono" style={{textAlign:"right"}}>{stdHrs.toFixed(1)}h</td>
                    <td className="mono" style={{textAlign:"right",fontWeight: otHrs>0?700:400, color: otHrs>0?"#DC2626":C.dim}}>
                      {otHrs>0 ? `⚡ ${otHrs.toFixed(1)}h` : "—"}
                    </td>
                    <td className="mono" style={{textAlign:"right",color: wkndHrs>0?"#D97706":C.dim}}>
                      {wkndHrs>0 ? `${wkndHrs.toFixed(1)}h` : "—"}
                    </td>
                    <td className="mono" style={{textAlign:"right",fontWeight:600}}>{money(gross)}</td>
                    <td className="mono" style={{textAlign:"right",color:C.yellow}}>−{money(payg)}</td>
                    <td className="mono" style={{textAlign:"right",color:C.blue}}>{money(sup)}</td>
                    <td className="mono" style={{textAlign:"right",fontWeight:700,color:C.accent}}>{money(labour)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th style={{textAlign:"left"}}>TOTAL</th>
                  <th className="mono" style={{textAlign:"right"}}>{empSummary.reduce((s,e)=>s+e.stdHrs,0).toFixed(1)}h</th>
                  <th className="mono" style={{textAlign:"right",color:"#DC2626"}}>
                    {empSummary.reduce((s,e)=>s+e.otHrs,0)>0 ? `⚡ ${empSummary.reduce((s,e)=>s+e.otHrs,0).toFixed(1)}h` : "—"}
                  </th>
                  <th className="mono" style={{textAlign:"right",color:"#D97706"}}>
                    {empSummary.reduce((s,e)=>s+e.wkndHrs,0)>0 ? `${empSummary.reduce((s,e)=>s+e.wkndHrs,0).toFixed(1)}h` : "—"}
                  </th>
                  <th className="mono" style={{textAlign:"right"}}>{money(totGross)}</th>
                  <th className="mono" style={{textAlign:"right",color:C.yellow}}>−{money(totPAYG)}</th>
                  <th className="mono" style={{textAlign:"right",color:C.blue}}>{money(totSuper)}</th>
                  <th className="mono" style={{textAlign:"right",color:C.accent,fontWeight:700}}>{money(totLabour)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <div className="empty-txt">No shifts this week. Click "+ Add Shift" or click any "+ shift" cell above to start rostering.</div>
          </div>
        )}

        <div style={{fontSize:10.5,color:C.muted,marginTop:12,paddingTop:10,borderTop:`1px solid ${C.border}`,lineHeight:1.6}}>
          💡 <strong>OT detection:</strong> Weekday hours beyond each employee's contracted hours (e.g. 38h/wk) are automatically charged at ×1.5. Weekend/PH shifts are ×1.75 regardless of weekly total. <strong>Labour Cost</strong> = Gross + Employer Super (PAYG is the employee's tax, not your cost). ATO 2024-25 progressive PAYG rates applied. Estimates only — consult your accountant.
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  STAFF & WAGES PAGE
// ════════════════════════════════════════════════════════════
function WagesPage({ employees, setEmployees, timesheets, setTimesheets, roster, setRoster, leave, setLeave, showToast, bizName, setBizName, bizABN, setBizABN, initialTab, dayWorkers = [], setDayWorkers, revenue = [] }) {
  const [tab, setTab] = useState(initialTab || "roster");
  const [empModal,   setEmpModal]   = useState(null);
  const [tsModal,    setTsModal]    = useState(null);
  // Leave form state
  const [lf, setLf] = useState({ eid:"", type:"annual", date:todayStr, hours:"", notes:"", editId:null });

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
  const saveTs = ts => {
    if (ts.id && timesheets.find(x => x.id === ts.id)) {
      setTimesheets(p => p.map(x => x.id === ts.id ? ts : x));
      showToast("Timesheet updated!");
    } else {
      setTimesheets(p => [...p, ts]);
      showToast("Hours logged!");
    }
    setTsModal(null);
  };
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

  // ── Leave Balance PDF — clean light theme ─────────────────
  const exportLeavePDF = () => {
    const pdf = new MiniPDF();
    const W = pdf.W, M = pdf.M;
    const safe = s => String(s||'').replace(/[^\x20-\x7E]/g,'');

    // Palette — light professional
    const INK    = '#1A1A1A';  // main text
    const SUB    = '#6B7280';  // subtext / labels
    const RULE   = '#E5E7EB';  // dividers
    const STRIPE = '#F9FAFB';  // alternating table row
    const HDR_BG = '#1F2937';  // employee name bar (dark navy, not green)
    const HDR_FG = '#FFFFFF';
    const HDR_SUB= '#9CA3AF';
    const BOX_BG = '#F8FAFC';  // leave box background (near-white)
    const BOX_BDR= '#E2E8F0';  // box border
    const C_ANN  = '#0D9488';  // teal — Annual
    const C_PER  = '#2563EB';  // blue — Personal
    const C_LIU  = '#7C3AED';  // purple — Lieu
    const C_NEG  = '#DC2626';  // red — overdrawn
    const C_DIM  = '#9CA3AF';

    // ── Header ────────────────────────────────────────────
    pdf.rect(M, 16, 30, 30, { fill:'#8FCB72' });
    pdf.text(M+5,  20, 'M',                    { size:15, bold:true, color:'#0C0F0D' });
    pdf.text(M+38, 19, 'Mise',                 { size:13, bold:true, color:INK });
    pdf.text(M+38, 34, 'HOSPITALITY FINANCE',  { size:6,             color:C_DIM });
    pdf.text(W/2,  17, 'LEAVE & ENTITLEMENTS', { size:7.5,           color:C_DIM, align:'center' });
    pdf.text(W/2,  29, 'Leave Balance Report', { size:17, bold:true, color:INK,   align:'center' });
    pdf.text(W-M,  19, `Generated: ${todayStr}`,{ size:7.5,          color:C_DIM, align:'right' });
    pdf.line(M, 56, W-M, 56, { color:RULE, w:1 });
    let y = 68;

    employees.forEach((emp, ei) => {
      const accrued  = calcLeaveAccruals(emp, timesheets);
      const taken    = calcLeaveTaken(emp, leave);
      const isCasual = emp.type === 'casual';
      const dpd      = hrsPerDay(emp) || 1;

      if (y > 670) { pdf.addPage(); y = 30; }

      // ── Employee name bar (dark navy) ──────────────────
      pdf.rect(M, y, W-M*2, 34, { fill:HDR_BG });
      pdf.text(M+12, y+8,  safe(emp.name),                         { size:12, bold:true, color:HDR_FG });
      pdf.text(M+12, y+24, safe(`${emp.role||''}  |  ${emp.type}`),{ size:8,             color:HDR_SUB });
      y += 38;

      // ── Three leave boxes (light background) ───────────
      const gap  = 8;
      const boxW = Math.floor((W - M*2 - gap*2) / 3);
      const boxH = 100;
      const types = [
        { lbl:'Annual Leave',     col:C_ANN,  accrued:accrued.annual,   taken:taken.annual,   na:isCasual },
        { lbl:"Personal/Carer's", col:C_PER,  accrued:accrued.personal, taken:taken.personal, na:isCasual },
        { lbl:'Day in Lieu',      col:C_LIU,  accrued:accrued.lieu,     taken:taken.lieu,     na:false    },
      ];

      types.forEach((lt, i) => {
        const bx  = M + i * (boxW + gap);
        const bal = lt.accrued - lt.taken;
        const isNeg = bal < 0;
        const accentCol = isNeg ? C_NEG : lt.col;

        // Box: light bg, coloured left accent bar
        pdf.rect(bx,   y,  4,    boxH, { fill:accentCol });        // left accent
        pdf.rect(bx+4, y,  boxW-4, boxH, { fill:BOX_BG, stroke:BOX_BDR }); // content area

        // Label (8pt) at y+10
        pdf.text(bx+14, y+10, lt.lbl, { size:8, bold:true, color:accentCol });

        if (lt.na) {
          pdf.text(bx+14, y+34, 'Not applicable',    { size:9,   color:C_DIM });
          pdf.text(bx+14, y+48, '(casual employee)', { size:7.5, color:C_DIM });
        } else {
          const balDays = (Math.abs(bal)/dpd).toFixed(1);
          // Balance big number (18pt) at y+24 → ends ~y+42
          pdf.text(bx+14, y+24, `${isNeg?'-':''}${Math.abs(bal).toFixed(1)}h`, { size:18, bold:true, color:accentCol });
          // Days (8pt) at y+50 — safely below
          pdf.text(bx+14, y+50, `${balDays} days balance`, { size:8, color:SUB });
          // Divider at y+63
          pdf.line(bx+14, y+63, bx+boxW-8, y+63, { color:RULE, w:0.5 });
          // Accrued at y+71, Taken at y+85
          pdf.text(bx+14, y+71, `Accrued:`, { size:7.5, color:SUB });
          pdf.text(bx+boxW-8, y+71, `${lt.accrued.toFixed(1)}h`, { size:7.5, bold:true, color:INK, align:'right' });
          pdf.text(bx+14, y+85, `Taken:`,   { size:7.5, color:SUB });
          pdf.text(bx+boxW-8, y+85, `${lt.taken.toFixed(1)}h`,   { size:7.5, bold:true, color:C_NEG, align:'right' });
        }
      });
      y += boxH + 12;

      // ── Leave history ──────────────────────────────────
      const empLeave = leave
        .filter(l => l.eid === emp.id)
        .sort((a,b) => b.date.localeCompare(a.date));

      if (empLeave.length > 0) {
        if (y > 720) { pdf.addPage(); y = 30; }
        // Column header row
        pdf.rect(M, y, W-M*2, 18, { fill:'#F1F5F9' });
        pdf.line(M, y,      W-M, y,      { color:BOX_BDR, w:0.5 });
        pdf.line(M, y+18,   W-M, y+18,   { color:BOX_BDR, w:0.5 });
        pdf.text(M+8,   y+5, 'Date',        { size:7.5, bold:true, color:SUB });
        pdf.text(M+76,  y+5, 'Type',        { size:7.5, bold:true, color:SUB });
        pdf.text(M+200, y+5, 'Hours',       { size:7.5, bold:true, color:SUB });
        pdf.text(M+248, y+5, 'Days',        { size:7.5, bold:true, color:SUB });
        pdf.text(M+288, y+5, 'Notes',       { size:7.5, bold:true, color:SUB });
        y += 20;

        empLeave.forEach((l, li) => {
          if (y > 750) { pdf.addPage(); y = 30; }
          const rowH = 17;
          const typeLabel = { annual:'Annual Leave', personal:"Personal/Carer's", lieu:'Day in Lieu' }[l.type] || l.type;
          const days = (l.hours / dpd).toFixed(1);
          if (li % 2 === 0) pdf.rect(M, y, W-M*2, rowH, { fill:STRIPE });
          pdf.line(M, y+rowH, W-M, y+rowH, { color:BOX_BDR, w:0.3 });
          pdf.text(M+8,   y+5, safe(l.date),       { size:8,   color:SUB  });
          pdf.text(M+76,  y+5, safe(typeLabel),     { size:8,   color:INK  });
          pdf.text(M+200, y+5, `${l.hours}h`,       { size:8,   bold:true, color:INK });
          pdf.text(M+248, y+5, `${days}d`,          { size:8,   color:SUB  });
          pdf.text(M+288, y+5, safe(l.notes||'—'), { size:7.5, color:SUB  });
          y += rowH;
        });
        y += 8;
      }

      // Separator
      if (ei < employees.length - 1) {
        if (y > 740) { pdf.addPage(); y = 30; }
        else { pdf.line(M, y+6, W-M, y+6, { color:RULE, w:0.7 }); y += 20; }
      }
    });

    // ── Footer ──────────────────────────────────────────
    const fy = Math.min(y + 20, 820);
    pdf.line(M, fy-6, W-M, fy-6, { color:RULE, w:0.5 });
    pdf.text(M,   fy, 'Leave balances are estimates from timesheet data. Confirm entitlements under the Fair Work Act or applicable Modern Award.', { size:6.5, color:C_DIM });
    pdf.text(W-M, fy, `Mise Hospitality Finance  |  ${todayStr}`, { size:7, color:C_DIM, align:'right' });

    pdfDownload(pdf, `Leave_Balances_${todayStr}.pdf`);
    showToast('Leave PDF downloaded!');
  };

  return (
    <>
      {(empModal === "add" || empModal?.id) && (
        <EmployeeModal emp={empModal === "add" ? null : empModal} onSave={saveEmp} onClose={() => setEmpModal(null)}/>
      )}
      {tsModal && (
        <TimesheetModal employees={employees} onSave={saveTs} onClose={() => setTsModal(null)} initial={tsModal === true ? {} : tsModal}/>
      )}

      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">Staff & Wages</div><div className="psub">Employee profiles, timesheets and labour cost estimates</div></div>
        <div className="hdr-right">
          {tab === "profiles"   && <button className="btn" onClick={() => setEmpModal("add")}>+ Add Employee</button>}
          {tab === "timesheets" && <button className="btn" onClick={() => setTsModal(true)}>+ Log Hours</button>}
          {tab === "leave"      && <button className="btn-b" onClick={exportLeavePDF}>⬇️ Export Leave PDF</button>}</div>
      </div>

      <div className="g4">
        {[
          { lbl:"Active Staff",       val:employees.length, cls:"t" },
          { lbl:"Total Gross Wages",  val:money(totalGross), cls:"" },
          { lbl:"Super Owed (SGC)",    val:money(totalSuper), cls:"b" },
          { lbl:"Unpaid Super Rows",  val:unpaidRows, cls:unpaidRows > 0 ? "r" : "g" },
        ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
      </div>

      <div className="tabs">
        {[["roster","📅 Roster"],["profiles","👤 Profiles"],["timesheets","🕐 Timesheets"],["summary","📊 Wage Summary"],["leave","🏖️ Leave & Lieu"],["dayworkers","⚡ Day Workers"],["payslip","🧾 Payslips"]].map(([id,lbl]) => (
          <div key={id} className={`tab${tab===id?" on-a":""}`} onClick={() => setTab(id)}>{lbl}</div>
        ))}
      </div>

      {/* ── ROSTER ── */}
      {tab === "roster" && (
        <RosterTab employees={employees} roster={roster} setRoster={setRoster} showToast={showToast} revenue={revenue}/>
      )}

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
                          <div style={{ width:38, height:38, borderRadius:"50%", background:avatarBg(emp.id, emp.color), display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:"#fff", flexShrink:0 }}>
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
                : rows.slice().sort((a,b) => {
                    // Primary: week desc (latest first); Secondary: employee name asc
                    const w = (b.week||"").localeCompare(a.week||"");
                    if (w !== 0) return w;
                    return (a.emp?.name||"").localeCompare(b.emp?.name||"");
                  }).map(t => (
                    <tr key={t.id}>
                      <td>
                        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                          <div style={{ width:24, height:24, borderRadius:"50%", background:avatarBg(t.emp.id, t.emp.color), display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"#fff", flexShrink:0 }}>
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
                      <td style={{whiteSpace:"nowrap"}}>
                        <button className="btn-ic" title="Edit" onClick={() => setTsModal(timesheets.find(x => x.id === t.id))}>✏️</button>
                        <button className="btn-ic" title="Delete" onClick={() => setTimesheets(p => p.filter(x => x.id !== t.id))}>🗑️</button>
                      </td>
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
                          <div style={{ width:26, height:26, borderRadius:"50%", background:avatarBg(emp.id, emp.color), display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#fff" }}>
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
              const empRate = effRate(emp); // $/hr incl. casual loading if applicable

              return (
                <div key={emp.id} className="bc" style={{ marginBottom:0 }}>
                  {/* Employee header */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                    <div style={{ width:34, height:34, borderRadius:"50%", background:avatarBg(emp.id, emp.color), display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:"#fff", flexShrink:0 }}>
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
                                {/* Monetary value — for payouts and liability reporting */}
                                {!isNA && lt.balance !== 0 && empRate > 0 && !isCasual && (
                                  <div style={{ marginTop:6, padding:"4px 8px", borderRadius:6, background: isNeg ? "rgba(220,38,38,.08)" : "rgba(143,203,114,.08)", display:"inline-block" }}>
                                    <span style={{ fontSize:10, color:C.dim }}>Value: </span>
                                    <span className="mono" style={{ fontSize:11, fontWeight:700, color: isNeg ? C.red : C.green }}>
                                      {money(Math.abs(lt.balance) * empRate)}
                                    </span>
                                    <span style={{ fontSize:9.5, color:C.dim, marginLeft:3 }}>@ {money(empRate)}/hr</span>
                                  </div>
                                )}
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

          {/* Log / Edit leave form */}
          <div className="fsec" style={{ border: lf.editId ? `1px solid ${C.yellow}` : undefined }}>
            <div className="ftit">{lf.editId ? "✏️ Edit Leave Record" : "Log Leave Taken"}</div>
            {lf.editId && <div style={{ fontSize:11, color:C.yellow, marginBottom:10, background:"rgba(212,168,67,.08)", borderRadius:6, padding:"6px 10px" }}>Editing record — make your changes and click Save.</div>}
            <div className="frow3" style={{ marginBottom:11 }}>
              <div className="fg">
                <label className="flbl">Employee *</label>
                <select className="sel" value={lf.eid} onChange={e => setLf({...lf,eid:e.target.value})} disabled={!!lf.editId}>
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
                  <span className="fhint">= {(parseFloat(lf.hours) / hrsPerDay(employees.find(e=>e.id===parseInt(lf.eid)) || {std_hrs:7.6})).toFixed(2)} days</span>
                )}
              </div>
              <div className="fg" style={{ gridColumn:"span 2" }}>
                <label className="flbl">Notes (optional)</label>
                <input className="inp" placeholder="e.g. Annual leave — family holiday" value={lf.notes} onChange={e => setLf({...lf,notes:e.target.value})}/>
              </div>
            </div>
            <div className="fbtns">
              <button className="btn" onClick={() => {
                if (!lf.eid || !lf.hours) return;
                if (lf.editId) {
                  setLeave(p => p.map(x => x.id === lf.editId ? {...x, type:lf.type, date:lf.date, hours:parseFloat(lf.hours)||0, notes:lf.notes} : x));
                  showToast("Leave record updated!");
                } else {
                  addLeave();
                  return;
                }
                setLf({ eid:"", type:"annual", date:todayStr, hours:"", notes:"", editId:null });
              }}>{lf.editId ? "Save Changes" : "Log Leave"}</button>
              <button className="btn-g" onClick={() => setLf({ eid:"", type:"annual", date:todayStr, hours:"", notes:"", editId:null })}>
                {lf.editId ? "Cancel" : "Clear"}
              </button>
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
                              <div style={{ width:22, height:22, borderRadius:"50%", background:avatarBg(emp.id, emp.color), display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:700, color:"#fff" }}>
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
                          <td style={{ whiteSpace:"nowrap" }}>
                            <button className="btn-ic" title="Edit" onClick={() => setLf({ eid:String(l.eid), type:l.type, date:l.date, hours:String(l.hours), notes:l.notes||"", editId:l.id })}>✏️</button>
                            <button className="btn-ic" onClick={() => { setLeave(p => p.filter(x => x.id !== l.id)); showToast("Leave record removed."); }}>🗑️</button>
                          </td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>

          <div className="disc">
            <div className="d-ttl">⚠️ Leave Entitlement Disclaimer</div>
            <div className="d-txt">Leave accruals are calculated based on <strong>actual ordinary hours worked</strong> as recorded in timesheets — in accordance with the Fair Work Act 2009. <strong>Annual leave</strong> accrues at 152 hours per year of full hours worked (s.87). <strong>Personal/Carer's leave</strong> accrues at 76 hours per year (s.96). <strong>Casual employees</strong> are not entitled to paid annual or personal leave. <strong>Day in Lieu</strong> accrues hour-for-hour from overtime and weekend/PH hours worked. Part-time employees are automatically pro-rated based on their standard hours. Always confirm entitlements under the applicable Modern Award. These are estimates only — consult a registered payroll provider or Fair Work for accurate obligations.</div>
          </div>
        </>
      )}

      {/* ════ DAY WORKERS TAB ════ */}
      {tab === "dayworkers" && (
        <DayWorkersTab showToast={showToast} workers={dayWorkers} setWorkers={setDayWorkers}/>
      )}

      {tab === "payslip" && (
        <PayslipTab employees={employees} timesheets={timesheets} showToast={showToast} bizName={bizName} setBizName={setBizName} bizABN={bizABN} setBizABN={setBizABN}/>
      )}
    </>
  );
}

// ── Payslip Tab ──────────────────────────────────────────────
function PayslipTab({ employees, timesheets, showToast, bizName, setBizName, bizABN, setBizABN }) {
  const [selEmp,      setSelEmp]      = useState("");
  const [selWeek,     setSelWeek]     = useState("");
  const [showPrint,   setShowPrint]   = useState(false);
  const [batchWeek,   setBatchWeek]   = useState("");
  const [batchExporting, setBatchExporting] = useState(false);
  const [showOTWknd,  setShowOTWknd]  = useState(true);

  // Build week options from existing timesheets — must be before exportBatch and batchEligible
  const weeks = [...new Set(timesheets.map(t => t.week))].sort().reverse();

  // ── Batch export — individual PDFs bundled into one ZIP ──────
  const exportBatch = async () => {
    if (!batchWeek) return;
    setBatchExporting(true);
    const zipFiles = [];
    for (const e of employees) {
      const empTs = timesheets.filter(t => t.eid === e.id && t.week === batchWeek);
      if (empTs.length === 0) continue;
      const empRows = empTs.map(ts => {
        const gross  = calcGross(e, ts);
        const superR = getSuperRate(ts.week);
        const payg   = calcWeeklyPAYG(gross, e.tfn);
        const net    = gross - payg;
        return { ...ts, gross, super: (effRate(e)*(ts.std_hrs+ts.wknd_hrs+ts.ot_hrs))*superR, superR, payg, net };
      });
      const empTotals = {
        std_hrs:  empRows.reduce((s,r) => s + r.std_hrs,  0),
        ot_hrs:   empRows.reduce((s,r) => s + r.ot_hrs,   0),
        wknd_hrs: empRows.reduce((s,r) => s + r.wknd_hrs, 0),
        gross:    empRows.reduce((s,r) => s + r.gross,     0),
        super:    empRows.reduce((s,r) => s + r.super,     0),
        payg:     empRows.reduce((s,r) => s + r.payg,      0),
        net:      empRows.reduce((s,r) => s + r.net,       0),
        superR:   empRows[empRows.length-1]?.superR || getSuperRate(batchWeek),
      };
      const label = weekLabel(batchWeek);
      const pdf   = renderPayslipPDF({ emp:e, rows:empRows, totals:empTotals, payPeriodLabel:label, bizName, bizABN, showOTWknd });
      const safeName = e.name.replace(/[^a-zA-Z0-9 _-]/g,'').replace(/\s+/g,'_');
      zipFiles.push({ name:`Payslip_${safeName}_${batchWeek}.pdf`, blob: pdf.toBlob() });
    }
    if (zipFiles.length === 0) {
      setBatchExporting(false);
      showToast("No timesheets found for this week.");
      return;
    }
    const zip = await buildZip(zipFiles);
    zipDownload(zip, `Payslips_${batchWeek}_${zipFiles.length}_employees.zip`);
    setBatchExporting(false);
    showToast(`✅ ${zipFiles.length} payslip${zipFiles.length!==1?'s':''} downloaded as ZIP!`);
  };

  const batchEligible = batchWeek
    ? employees.filter(e => timesheets.some(t => t.eid === e.id && t.week === batchWeek))
    : [];

  // Get timesheets for selected employee (optionally filtered by week)
  const empTs = timesheets.filter(t =>
    t.eid === parseInt(selEmp) && (selWeek === "" || t.week === selWeek)
  );
  const emp = employees.find(e => e.id === parseInt(selEmp));

  // ── Calculations — ATO-compliant ──────────────────────────
  // PAYG: ATO 2024-25 progressive withholding (calcWeeklyPAYG), whole dollars
  // Super: date-aware SGC rate (11.5% pre-Jul 2025, 12% from Jul 2025)
  const rows = empTs.map(ts => {
    const gross   = calcGross(emp, ts);
    const superR  = getSuperRate(ts.week);
    const otePs   = effRate(emp) * (ts.std_hrs + ts.wknd_hrs + ts.ot_hrs);
    const super_  = otePs * superR;
    const payg    = calcWeeklyPAYG(gross, emp?.tfn);
    const net     = gross - payg;
    const effR    = effRate(emp);
    return { ...ts, gross, super:super_, superR, payg, net, effR };
  });

  const totals = {
    std_hrs:  rows.reduce((s,r) => s + r.std_hrs,  0),
    ot_hrs:   rows.reduce((s,r) => s + r.ot_hrs,   0),
    wknd_hrs: rows.reduce((s,r) => s + r.wknd_hrs, 0),
    gross:    rows.reduce((s,r) => s + r.gross,     0),
    super:    rows.reduce((s,r) => s + r.super,     0),
    payg:     rows.reduce((s,r) => s + r.payg,      0),
    net:      rows.reduce((s,r) => s + r.net,       0),
    // display: show the effective super rate (latest week's rate, or avg if mixed)
    superR:   rows.length > 0 ? rows[rows.length-1].superR : getSuperRate(null),
  };

  // ── Week label helper ─────────────────────────────────────
  const weekLabel = w => {
    if (!w) return "";
    const [yr, wk] = w.split("-W");
    const d = new Date(parseInt(yr), 0, 1 + (parseInt(wk)-1)*7);
    const mon = new Date(d.setDate(d.getDate() - d.getDay() + 1));
    const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
    const fmt = d => d.toLocaleDateString("en-AU",{day:"2-digit",month:"short",year:"numeric"});
    return `${fmt(mon)} – ${fmt(sun)}`;
  };

  const payPeriodLabel = selWeek
    ? weekLabel(selWeek)
    : weeks.length > 0
      ? `${weekLabel(weeks[weeks.length-1])} to ${weekLabel(weeks[0])}`
      : "All periods";

  // ── Payslip print content (JSX, uses existing pp-* classes) ──
  const PayslipPrint = () => {
    if (!emp) return null;
    const effR = effRate(emp);
    const issued = new Date().toLocaleDateString("en-AU",{day:"2-digit",month:"long",year:"numeric"});
    const infoRow = (lbl, val) => (
      <div className="pp-row"><span>{lbl}</span><span style={{fontWeight:600,textAlign:"right"}}>{val}</span></div>
    );
    return (
      <div className="pp-page">
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",paddingBottom:20,borderBottom:"2px solid #0C0F0D",marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#8FCB72,#3DC9A0)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:20,color:"#0C0F0D"}}>M</div>
            <div>
              <div style={{fontSize:17,fontWeight:700,letterSpacing:"-.3px"}}>{bizName}</div>
              <div style={{fontSize:10,color:"#6B7280",textTransform:"uppercase",letterSpacing:".5px"}}>{bizABN ? `ABN: ${bizABN}` : "Generated by Mise"}</div>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:22,fontWeight:700,letterSpacing:"-.5px"}}>PAYSLIP</div>
            <div style={{fontSize:11,color:"#6B7280",marginTop:3}}>Period: {payPeriodLabel}</div>
            <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>Issued: {issued}</div>
          </div>
        </div>

        {/* Two-col info */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
          <div className="pp-box">
            <div className="pp-sec-ttl">Employee Details</div>
            {infoRow("Name", emp.name)}
            {infoRow("Role", emp.role)}
            {infoRow("Type", emp.type.charAt(0).toUpperCase()+emp.type.slice(1))}
            {infoRow("Base Rate", `$${emp.rate.toFixed(2)}/hr`)}
            {infoRow("Effective Rate", `$${effR.toFixed(2)}/hr`)}
            {infoRow("Super Fund", emp.superfund || "—")}
            {infoRow("TFN Provided", emp.tfn ? "Yes ✓" : "No — 47% withholding")}
          </div>
          <div className="pp-box">
            <div className="pp-sec-ttl">Pay Period Summary</div>
            {infoRow("Period", payPeriodLabel)}
            {infoRow("Weeks", String(rows.length))}
            {infoRow("Standard Hours", `${totals.std_hrs}h`)}
            {showOTWknd && infoRow("Overtime Hours", `${totals.ot_hrs}h`)}
            {showOTWknd && infoRow("Weekend/PH Hours", `${totals.wknd_hrs}h`)}
            {infoRow("Total Hours", `${totals.std_hrs+totals.ot_hrs+totals.wknd_hrs}h`)}
          </div>
        </div>

        {/* Hours table */}
        <div className="pp-sec-ttl" style={{marginBottom:8}}>Hours &amp; Earnings Breakdown</div>
        <table className="pp-tbl" style={{marginBottom:20}}>
          <thead><tr>
            <th>Pay Week</th>
            <th style={{textAlign:"right"}}>Std Hrs</th>
            {showOTWknd && <th style={{textAlign:"right"}}>OT Hrs</th>}
            {showOTWknd && <th style={{textAlign:"right"}}>Wknd Hrs</th>}
            <th style={{textAlign:"right"}}>Std Pay</th>
            {showOTWknd && <th style={{textAlign:"right"}}>OT Pay</th>}
            {showOTWknd && <th style={{textAlign:"right"}}>Wknd Pay</th>}
            <th style={{textAlign:"right"}}>Gross</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{fontSize:11}}>{r.week}</td>
                <td style={{textAlign:"right"}}>{r.std_hrs}h</td>
                {showOTWknd && <td style={{textAlign:"right"}}>{r.ot_hrs}h</td>}
                {showOTWknd && <td style={{textAlign:"right"}}>{r.wknd_hrs}h</td>}
                <td style={{textAlign:"right",fontFamily:"DM Mono,monospace"}}>{money(effR * r.std_hrs)}</td>
                {showOTWknd && <td style={{textAlign:"right",fontFamily:"DM Mono,monospace"}}>{r.ot_hrs > 0 ? money(effR * OT_RATE * r.ot_hrs) : "—"}</td>}
                {showOTWknd && <td style={{textAlign:"right",fontFamily:"DM Mono,monospace"}}>{r.wknd_hrs > 0 ? money(effR * WKND_RATE * r.wknd_hrs) : "—"}</td>}
                <td style={{textAlign:"right",fontFamily:"DM Mono,monospace",fontWeight:700}}>{money(r.gross)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td style={{fontWeight:700}}>TOTAL</td>
              <td style={{textAlign:"right",fontWeight:700}}>{totals.std_hrs}h</td>
              {showOTWknd && <td style={{textAlign:"right",fontWeight:700}}>{totals.ot_hrs}h</td>}
              {showOTWknd && <td style={{textAlign:"right",fontWeight:700}}>{totals.wknd_hrs}h</td>}
              <td colSpan={showOTWknd ? 3 : 1}></td>
              <td style={{textAlign:"right",fontFamily:"DM Mono,monospace",fontWeight:700,fontSize:14}}>{money(totals.gross)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Pay summary */}
        <div className="pp-sec-ttl" style={{marginBottom:8}}>Pay Summary</div>
        <div className="pp-box" style={{marginBottom:16}}>
          {[
            {lbl:"Gross Pay",                                                         val:money(totals.gross),       col:"#111"},
            {lbl:`PAYG Withheld (ATO${emp.tfn?" scale 2":" — no TFN 47%"})`,         val:`− ${money(totals.payg)}`, col:"#DC2626"},
            {lbl:"Net Pay (Take-Home)",                                                val:money(totals.net),         col:"#16A34A", bold:true},
          ].map((r,i) => (
            <div key={i} className="pp-row" style={{borderBottom: i<2 ? "1px solid #E5E7EB" : "none", paddingTop: r.bold ? 10 : undefined, marginTop: r.bold ? 4 : undefined}}>
              <span style={{fontWeight:r.bold?700:500,fontSize:r.bold?15:13}}>{r.lbl}</span>
              <span style={{fontFamily:"DM Mono,monospace",fontWeight:700,fontSize:r.bold?17:13,color:r.col}}>{r.val}</span>
            </div>
          ))}
        </div>

        {/* Super + net highlight */}
        <div style={{background:"#0C0F0D",borderRadius:12,padding:"18px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",color:"#fff",marginBottom:14}}>
          <div>
            <div style={{fontSize:10,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".5px"}}>Net Pay — Take Home</div>
            <div style={{fontFamily:"DM Mono,monospace",fontSize:28,fontWeight:700,color:"#8FCB72",marginTop:4}}>{money(totals.net)}</div>
            <div style={{fontSize:11,color:"#9CA3AF",marginTop:4}}>After PAYG withholding</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:".5px"}}>Super — Employer Contribution</div>
            <div style={{fontFamily:"DM Mono,monospace",fontSize:22,fontWeight:700,color:"#3DC9A0",marginTop:4}}>{money(totals.super)}</div>
            <div style={{fontSize:11,color:"#9CA3AF",marginTop:4}}>To {emp.superfund || "nominated fund"}</div>
          </div>
        </div>

        {!emp.tfn && (
          <div className="pp-warn" style={{marginBottom:10}}>⚠️ No TFN on file — PAYG withheld at 47%. Ask employee to provide their TFN.</div>
        )}
        {emp.tfn && (
          <div style={{background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:8,padding:"9px 14px",fontSize:11,color:"#166534",marginBottom:12}}>
            ℹ️ PAYG calculated using ATO 2024-25 Scale 2 (resident, tax-free threshold). Assumes employee has claimed the tax-free threshold on their TFN declaration.
          </div>
        )}
        <div style={{background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,padding:"11px 14px",fontSize:11.5,color:"#1D4ED8",marginBottom:20}}>
          💡 <strong>Super note:</strong> {money(totals.super)} (@ {(totals.superR*100).toFixed(1)}%) should be paid to {emp.superfund || "the nominated fund"} with each pay run. From 1 July 2026, the ATO <strong>Payday Super</strong> reform requires super to be paid on every payday — not quarterly. Late payments attract the Super Guarantee Charge (SGC) — not tax deductible.
        </div>

        <PPDisclaimer/>
        <div style={{marginTop:20,paddingTop:14,borderTop:"1px solid #E5E7EB",display:"flex",justifyContent:"space-between",fontSize:10.5,color:"#9CA3AF"}}>
          <span>Generated by Mise — Australian Hospitality Finance</span>
          <span>Issued {issued} · Retain for 7 years (ATO)</span>
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"16px 20px", marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>🧾 Generate Payslip</div>
        <div style={{ fontSize:12, color:C.muted, lineHeight:1.7 }}>
          Select an employee and pay period to generate an ATO-compliant payslip. Includes gross pay, PAYG withholding, super, and take-home breakdown.
        </div>
      </div>

      {/* ── Config ── */}
      <div className="fsec">
        <div className="ftit">Business & Period</div>
        <div className="frow2">
          <div className="fg">
            <label className="flbl">Business Name</label>
            <input className="inp" value={bizName} onChange={e => setBizName(e.target.value)} placeholder="Your Restaurant Name"/>
          </div>
          <div className="fg">
            <label className="flbl">ABN (optional)</label>
            <input className="inp" value={bizABN} onChange={e => setBizABN(e.target.value)} placeholder="12 345 678 901"/>
          </div>
          <div className="fg">
            <label className="flbl">Employee *</label>
            <select className="sel" value={selEmp} onChange={e => { setSelEmp(e.target.value); setSelWeek(""); }}>
              <option value="">— Select employee —</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name} · {e.role} · {e.type}</option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label className="flbl">Pay Period</label>
            <select className="sel" value={selWeek} onChange={e => setSelWeek(e.target.value)}>
              <option value="">All periods (YTD)</option>
              {weeks.map(w => (
                <option key={w} value={w}>{weekLabel(w)} ({w})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Preview ── */}
      {emp && rows.length > 0 && (
        <>
          {/* Employee header */}
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"16px 20px", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:avatarBg(emp.id, emp.color), display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:"#fff" }}>
                {initials(emp.name)}
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>{emp.name}</div>
                <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{emp.role} · {emp.type} · {money(effRate(emp))}/hr</div>
                <div style={{ fontSize:11.5, color:emp.tfn ? C.green : C.red, marginTop:2 }}>
                  {emp.tfn ? "✅ TFN on file" : "⚠️ No TFN — 47% withholding applies"}
                </div>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:11, color:C.dim, marginBottom:3 }}>Pay period</div>
              <div style={{ fontWeight:600, fontSize:12 }}>{payPeriodLabel}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{rows.length} week{rows.length>1?"s":""} included</div>
            </div>
          </div>

          {/* Summary cards */}
          <div className="g4" style={{ marginBottom:12 }}>
            {[
              { lbl:"Gross Pay",      val:money(totals.gross), cls:"" },
              { lbl:"PAYG Withheld",  val:money(totals.payg),  cls:"r" },
              { lbl:"Net Pay",        val:money(totals.net),   cls:"g" },
              { lbl:"Super (SGC)",  val:money(totals.super), cls:"b" },
            ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
          </div>

          {/* Hours breakdown table */}
          <div className="bc" style={{ marginBottom:12 }}>
            <div className="bctit">Hours & Earnings Breakdown</div>
            <table className="tbl">
              <thead><tr>
                <th>Pay Week</th><th>Std Hrs</th><th>OT Hrs</th><th>Wknd Hrs</th>
                <th>Std Pay</th><th>OT Pay</th><th>Wknd Pay</th><th>Gross</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="mono" style={{ fontSize:11 }}>{r.week}</td>
                    <td className="mono">{r.std_hrs}h</td>
                    <td className="mono" style={{ color: r.ot_hrs > 0 ? C.yellow : C.dim }}>{r.ot_hrs}h</td>
                    <td className="mono" style={{ color: r.wknd_hrs > 0 ? C.teal : C.dim }}>{r.wknd_hrs}h</td>
                    <td className="mono">{money(r.effR * r.std_hrs)}</td>
                    <td className="mono" style={{ color: r.ot_hrs > 0 ? C.yellow : C.dim }}>{r.ot_hrs > 0 ? money(r.effR * OT_RATE * r.ot_hrs) : "—"}</td>
                    <td className="mono" style={{ color: r.wknd_hrs > 0 ? C.teal : C.dim }}>{r.wknd_hrs > 0 ? money(r.effR * WKND_RATE * r.wknd_hrs) : "—"}</td>
                    <td className="mono" style={{ fontWeight:700 }}>{money(r.gross)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop:`2px solid ${C.border}` }}>
                  <td style={{ fontWeight:700, padding:"10px 12px" }}>TOTAL</td>
                  <td className="mono" style={{ fontWeight:700 }}>{totals.std_hrs}h</td>
                  <td className="mono" style={{ fontWeight:700 }}>{totals.ot_hrs}h</td>
                  <td className="mono" style={{ fontWeight:700 }}>{totals.wknd_hrs}h</td>
                  <td colSpan={3}></td>
                  <td className="mono" style={{ fontWeight:700, fontSize:14, color:C.accent }}>{money(totals.gross)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pay summary */}
          <div className="bc" style={{ marginBottom:14 }}>
            <div className="bctit">Pay Summary</div>
            {[
              { lbl:"Gross Pay",                                      val:money(totals.gross),  col:C.text },
              { lbl:`PAYG Withheld (ATO Scale 2${emp.tfn ? "" : " — no TFN 47%"})`, val:`− ${money(totals.payg)}`, col:C.red },
              { lbl:"Net Pay (Take-Home)",                            val:money(totals.net),    col:C.green, bold:true },
            ].map((r,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:`1px solid ${C.border}`, alignItems:"center" }}>
                <span style={{ fontSize: r.bold ? 14 : 13, fontWeight: r.bold ? 700 : 500, color:C.text }}>{r.lbl}</span>
                <span className="mono" style={{ fontSize: r.bold ? 16 : 14, fontWeight:700, color:r.col }}>{r.val}</span>
              </div>
            ))}
            <div style={{ marginTop:12, padding:"12px 14px", background:"rgba(61,201,160,.06)", border:"1px solid rgba(61,201,160,.2)", borderRadius:9, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:".5px" }}>Super — Employer Contribution</div>
                <div style={{ fontSize:11.5, color:C.muted, marginTop:2 }}>Pay with each pay run · Payday Super from 1 Jul 2026</div>
              </div>
              <span className="mono" style={{ fontSize:17, fontWeight:700, color:C.teal }}>{money(totals.super)}</span>
            </div>
            {!emp.tfn && (
              <div style={{ marginTop:10, padding:"10px 14px", background:"rgba(212,168,67,.1)", border:"1px solid rgba(212,168,67,.3)", borderRadius:9, fontSize:12, color:C.yellow }}>
                ⚠️ <strong>No TFN on file</strong> — PAYG withheld at 47%. Ask employee to provide their TFN to apply ATO Scale 2 progressive rates.
              </div>
            )}
          </div>

          {/* Generate button + options */}
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
            <button className="btn" style={{ fontSize:14, padding:"12px 28px" }} onClick={() => { setShowPrint(true); showToast(`Payslip ready for ${emp.name} ✅`); }}>
              🖨️ Generate & Print Payslip
            </button>
            <button className="btn-g" onClick={() => { setSelEmp(""); setSelWeek(""); }}>
              Clear
            </button>
            {/* OT/Weekend toggle */}
            <div style={{ display:"flex", alignItems:"center", gap:7, marginLeft:"auto", background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:8, padding:"7px 12px" }}>
              <span style={{ fontSize:11, color:C.muted, whiteSpace:"nowrap" }}>Show OT & Weekend rows</span>
              <div onClick={() => setShowOTWknd(v => !v)} style={{
                width:34, height:18, borderRadius:9, cursor:"pointer",
                background: showOTWknd ? C.accent : C.dim,
                position:"relative", transition:"background .2s", flexShrink:0,
              }}>
                <div style={{
                  position:"absolute", top:2, left: showOTWknd ? 18 : 2,
                  width:14, height:14, borderRadius:"50%", background:"#fff",
                  transition:"left .2s",
                }}/>
              </div>
            </div>
          </div>
        </>
      )}

      {emp && rows.length === 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"28px", textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>📋</div>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>No timesheets found</div>
          <div style={{ fontSize:12, color:C.muted }}>No timesheet records for {emp.name} in the selected period. Log hours in the Timesheets tab first.</div>
        </div>
      )}

      {!selEmp && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"28px", textAlign:"center" }}>
          <div style={{ fontSize:36, marginBottom:10 }}>🧾</div>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>Select an employee to begin</div>
          <div style={{ fontSize:12, color:C.muted, maxWidth:400, margin:"0 auto", lineHeight:1.7 }}>
            Choose an employee and pay period above. Mise will generate a complete payslip with PAYG, Super, and take-home breakdown — ready to print or save as PDF.
          </div>
        </div>
      )}

      {/* ── Batch Export ── */}
      <div className="bc" style={{ marginBottom:0 }}>
        <div className="bctit">📦 Batch Payslip Export
          <span style={{ fontSize:11, fontWeight:400, color:C.muted, marginLeft:8 }}>Generate all employee payslips for one week in one click</span>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <div className="fg" style={{ flex:"1 1 200px", minWidth:180 }}>
            <label className="flbl">Select Week</label>
            <select className="sel" value={batchWeek} onChange={e => setBatchWeek(e.target.value)}>
              <option value="">— Select a week —</option>
              {weeks.map(w => <option key={w} value={w}>{weekLabel(w)} ({w})</option>)}
            </select>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <button className="btn" disabled={!batchWeek || batchExporting || batchEligible.length === 0}
              onClick={exportBatch}
              style={{ padding:"10px 22px", fontSize:13, opacity: (!batchWeek || batchEligible.length === 0) ? 0.5 : 1 }}>
              {batchExporting ? "⏳ Generating..." : `⬇️ Export ${batchEligible.length > 0 ? batchEligible.length : ""} Payslip${batchEligible.length !== 1 ? "s" : ""}`}
            </button>
            {batchWeek && batchEligible.length === 0 && (
              <span style={{ fontSize:11, color:C.red }}>No timesheets found for this week</span>
            )}
            {batchWeek && batchEligible.length > 0 && (
              <span style={{ fontSize:11, color:C.muted }}>
                {batchEligible.map(e => e.name).join(", ")}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="disc">
        <div className="d-ttl">⚠️ Payslip Disclaimer</div>
        <div className="d-txt">Payslips are generated from timesheet data entered in Mise. PAYG withholding uses ATO 2024-25 progressive Scale 2 rates for employees with a TFN on file, and 47% flat for employees without a TFN (ATO statutory no-TFN rate). These payslips are for internal record-keeping and employee reference only. For STP lodgement and ATO-certified payroll reporting, consult a registered BAS agent or use ATO-approved payroll software. Retain payslip records for 7 years as required by the ATO.</div>
      </div>

      {showPrint && emp && (
        <PrintModal title={`Payslip — ${emp.name}`} onClose={() => setShowPrint(false)}
          onExport={() => renderPayslipPDF({emp, rows, totals, payPeriodLabel, bizName, bizABN, showOTWknd})}>
          <PayslipPrint/>
        </PrintModal>
      )}
    </>
  );
}


function DayWorkersTab({ showToast, workers, setWorkers }) {
  const blankDW = { name:"", date:todayStr, hours:"", rate:"", isWeekend:false, hasTFN:true, notes:"" };
  const [f,        setF]        = useState(blankDW);
  const [showHelp, setShowHelp] = useState(false);

  // ── Calculations — ATO-accurate ──────────────────────────
  const calc = (hours, rate, isWeekend, hasTFN, date) => {
    const h    = parseFloat(hours) || 0;
    const r    = parseFloat(rate)  || 0;
    const effR = isWeekend ? r * WKND_RATE : r * (1 + CASUAL_LOADING);
    const gross = effR * h;
    // Date → week string for date-aware super rate
    const [y,m,d] = (date||todayStr).split('-').map(Number);
    const dt = new Date(y,m-1,d);
    const day = dt.getDay()||7; dt.setDate(dt.getDate()+4-day);
    const jan1 = new Date(dt.getFullYear(),0,1);
    const wk = Math.ceil((((dt-jan1)/86400000)+1)/7);
    const wkStr = `${dt.getFullYear()}-W${String(wk).padStart(2,'0')}`;
    const superR  = getSuperRate(wkStr);
    const super_  = gross * superR;
    const payg    = calcWeeklyPAYG(gross, hasTFN);  // ATO Scale 2 or 47% no-TFN
    return { gross, super:super_, superR, payg, effR };
  };

  const preview = calc(f.hours, f.rate, f.isWeekend, f.hasTFN, f.date);

  const add = () => {
    if (!f.name.trim() || !f.hours || !f.rate) return;
    const c = calc(f.hours, f.rate, f.isWeekend, f.hasTFN, f.date);
    setWorkers(p => [...p, {
      id: Date.now(),
      name: f.name.trim(),
      date: f.date,
      hours: parseFloat(f.hours),
      rate: parseFloat(f.rate),
      isWeekend: f.isWeekend,
      notes: f.notes,
      ...c,
    }]);
    setF({ ...blankDW, date: f.date }); // keep date for fast entry
    showToast(`${f.name} added!`);
  };

  // ── Totals ───────────────────────────────────────────────
  const totalGross = workers.reduce((s,w) => s + w.gross, 0);
  const totalSuper = workers.reduce((s,w) => s + w.super, 0);
  const totalPayg  = workers.reduce((s,w) => s + w.payg,  0);
  const totalHours = workers.reduce((s,w) => s + w.hours, 0);

  // ── CSV Export ───────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ["Name","Date","Hours","Base Rate","Weekend?","Effective Rate","Gross Pay","Super","PAYG","Notes"],
      ...workers.map(w => [
        `"${w.name}"`, w.date, w.hours, w.rate.toFixed(2),
        w.isWeekend?"Yes":"No", w.effR.toFixed(2),
        w.gross.toFixed(2), w.super.toFixed(2), w.payg.toFixed(2), `"${w.notes}"`
      ])
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const a   = document.createElement("a");
    a.href     = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `mise-dayworkers-${todayStr}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    showToast("CSV exported!");
  };

  return (
    <>
      {/* ── Header info ── */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"16px 20px", marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>⚡ Day Worker Quick Entry</div>
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.7, maxWidth:560 }}>
              For staff who work one or two shifts and don't need a full employee profile.
              Mise calculates their pay, Super and PAYG instantly — and keeps a record for your Workers Comp audit.
            </div>
          </div>
          <button onClick={() => setShowHelp(h => !h)} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 12px", fontSize:11, color:C.muted, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
            {showHelp ? "Hide" : "💡 Legal obligations"}
          </button>
        </div>

        {showHelp && (
          <div style={{ marginTop:14, borderTop:`1px solid ${C.border}`, paddingTop:14, display:"flex", flexDirection:"column", gap:10 }}>
            {[
              { icon:"🦺", title:"Workers Compensation", col:C.red, text:"Covered automatically under your existing policy. Their wages count towards your annual payroll figure used to calculate your Workers Comp premium. No separate policy needed." },
              { icon:"💰", title:"Superannuation", col:C.blue, text:"Since 2022, there is NO minimum earnings threshold. Even $50 of wages requires Super at the current SGC rate. From 1 July 2026 (Payday Super reform), super must be paid on each payday — not quarterly." },
              { icon:"📋", title:"PAYG Withholding", col:C.yellow, text:"If the day worker has provided a TFN, withhold using ATO 2024-25 progressive Scale 2 rates. If no TFN, withhold at 47%. You must report this to the ATO." },
              { icon:"📁", title:"Record Keeping", col:C.teal, text:"ATO requires you to keep all wage records for 7 years — including one-day workers. This page gives you a downloadable CSV for your records." },
            ].map((item, i) => (
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <div style={{ fontSize:18, flexShrink:0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontWeight:700, fontSize:12.5, color:item.col, marginBottom:2 }}>{item.title}</div>
                  <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>{item.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Summary cards ── */}
      {workers.length > 0 && (
        <div className="g4">
          {[
            { lbl:"Day Workers Recorded", val:workers.length,       cls:"t" },
            { lbl:"Total Hours",          val:`${totalHours.toFixed(1)}h`, cls:"" },
            { lbl:"Total Gross Pay",      val:money(totalGross),    cls:"" },
            { lbl:"Total Super Owed",     val:money(totalSuper),    cls:"b" },
          ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
        </div>
      )}

      {/* ── Quick entry form ── */}
      <div className="fsec">
        <div className="ftit">Add Day Worker</div>
        <div className="frow2">
          <div className="fg">
            <label className="flbl">Worker Name *</label>
            <input className="inp" placeholder="e.g. Tom Chen" value={f.name} onChange={e => setF({...f,name:e.target.value})}/>
          </div>
          <div className="fg">
            <label className="flbl">Date Worked *</label>
            <input className="inp" type="date" value={f.date} onChange={e => setF({...f,date:e.target.value})}/>
          </div>
          <div className="fg">
            <label className="flbl">Hours Worked *</label>
            <input className="inp" type="number" placeholder="e.g. 6" value={f.hours} onChange={e => setF({...f,hours:e.target.value})}/>
          </div>
          <div className="fg">
            <label className="flbl">Base Hourly Rate ($) *</label>
            <input className="inp" type="number" placeholder="e.g. 24.00" value={f.rate} onChange={e => setF({...f,rate:e.target.value})}/>
            <span className="fhint">Min. casual rate 2025: $24.10/hr (FWC)</span>
          </div>
          <div className="fg">
            <label className="flbl">Shift Type</label>
            <select className="sel" value={f.isWeekend ? "weekend" : "weekday"} onChange={e => setF({...f,isWeekend:e.target.value==="weekend"})}>
              <option value="weekday">Weekday — Casual (+25% loading)</option>
              <option value="weekend">Weekend / Public Holiday (×1.75)</option>
            </select>
          </div>
          <div className="fg">
            <label className="flbl">TFN Provided?</label>
            <select className="sel" value={f.hasTFN ? "yes" : "no"} onChange={e => setF({...f,hasTFN:e.target.value==="yes"})}>
              <option value="yes">Yes — TFN on file</option>
              <option value="no">No TFN — withhold at 47%</option>
            </select>
            {!f.hasTFN && <span className="fhint r">⚠️ ATO requires 47% withholding until TFN provided</span>}
          </div>
          <div className="fg">
            <label className="flbl">Notes (optional)</label>
            <input className="inp" placeholder="e.g. Kitchen hand, lunch service" value={f.notes} onChange={e => setF({...f,notes:e.target.value})} onKeyDown={e => e.key==="Enter" && add()}/>
          </div>
        </div>

        {/* Live preview */}
        {f.hours && f.rate && (
          <div style={{ background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 16px", margin:"12px 0" }}>
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".7px", marginBottom:10 }}>
              Live Pay Preview
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
              {[
                { lbl:"Effective Rate",                                      val:`${money(preview.effR)}/hr`, col:C.text,   sub: f.isWeekend ? "×1.75 weekend" : "+25% casual" },
                { lbl:"Gross Pay",                                           val:money(preview.gross),        col:C.accent, sub:`${f.hours}h × ${money(preview.effR)}` },
                { lbl:`Super (SGC ${(preview.superR*100).toFixed(1)}%)`,     val:money(preview.super),        col:C.blue,   sub:"Must be paid quarterly" },
                { lbl:`PAYG (ATO Scale 2${!f.hasTFN?" — 47%":""})`,         val:money(preview.payg),         col:C.yellow, sub:"Withhold from gross pay" },
              ].map((s,i) => (
                <div key={i}>
                  <div className="mono" style={{ fontSize:16, fontWeight:700, color:s.col }}>{s.val}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{s.lbl}</div>
                  <div style={{ fontSize:9.5, color:C.dim, marginTop:1 }}>{s.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:12, paddingTop:10, borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:12, color:C.muted }}>Total cost to employer (gross + super)</span>
              <span className="mono" style={{ fontSize:16, fontWeight:700, color:C.accent }}>{money(preview.gross + preview.super)}</span>
            </div>
          </div>
        )}

        <div className="fbtns">
          <button className="btn" onClick={add}>Add Day Worker</button>
          <button className="btn-g" onClick={() => setF(blankDW)}>Clear</button>
        </div>
      </div>

      {/* ── Records table ── */}
      <div className="bc">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div className="bctit" style={{ marginBottom:0 }}>Day Worker Records <span style={{ fontSize:11, fontWeight:400, color:C.muted }}>{workers.length} entries</span></div>
          {workers.length > 0 && (
            <button className="btn-g" onClick={exportCSV} style={{ fontSize:11 }}>⬇️ Export CSV</button>
          )}
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th><th>Date</th><th>Hours</th><th>Shift</th>
              <th>Gross Pay</th><th>Super</th><th>PAYG</th><th>Notes</th><th></th>
            </tr>
          </thead>
          <tbody>
            {workers.length === 0
              ? <tr><td colSpan={9}><div className="empty-state"><div className="empty-icon">⚡</div><div className="empty-txt">No day workers recorded yet. Use the form above for quick entry.</div></div></td></tr>
              : workers.slice().sort((a,b) => b.date.localeCompare(a.date)).map(w => (
                <tr key={w.id}>
                  <td style={{ fontWeight:600 }}>{w.name}</td>
                  <td className="mono">{w.date}</td>
                  <td className="mono">{w.hours}h</td>
                  <td>
                    <span className={`pill ${w.isWeekend ? "pl-r" : "pl-y"}`}>
                      {w.isWeekend ? "Weekend" : "Casual"}
                    </span>
                  </td>
                  <td className="mono" style={{ fontWeight:700 }}>{money(w.gross)}</td>
                  <td className="mono" style={{ color:C.blue }}>{money(w.super)}</td>
                  <td className="mono" style={{ color:C.yellow }}>{money(w.payg)}</td>
                  <td style={{ color:C.muted, fontSize:12 }}>{w.notes || "—"}</td>
                  <td><button className="btn-ic" onClick={() => { setWorkers(p => p.filter(x => x.id !== w.id)); showToast("Record removed."); }}>🗑️</button></td>
                </tr>
              ))
            }
          </tbody>
          {workers.length > 0 && (
            <tfoot>
              <tr style={{ borderTop:`2px solid ${C.border}` }}>
                <td colSpan={2} style={{ fontWeight:700, padding:"10px 12px" }}>TOTAL</td>
                <td className="mono" style={{ fontWeight:700 }}>{totalHours.toFixed(1)}h</td>
                <td></td>
                <td className="mono" style={{ fontWeight:700 }}>{money(totalGross)}</td>
                <td className="mono" style={{ fontWeight:700, color:C.blue }}>{money(totalSuper)}</td>
                <td className="mono" style={{ fontWeight:700, color:C.yellow }}>{money(totalPayg)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>

        {workers.length > 0 && (
          <div style={{ marginTop:14, padding:"12px 15px", background:"rgba(91,159,212,.08)", border:"1px solid rgba(91,159,212,.2)", borderRadius:9, fontSize:12, color:C.muted, lineHeight:1.7 }}>
            💡 <strong style={{color:C.text}}>Super reminder:</strong> Total Super owed for these day workers is <strong style={{color:C.blue}}>{money(totalSuper)}</strong>. 
            From 1 July 2026, super must be paid on each payday (Payday Super). Currently due within 28 days of quarter end. 
            Missing super payments attract a <strong style={{color:C.red}}>Super Guarantee Charge (SGC)</strong> which is not tax deductible.
          </div>
        )}
      </div>

      <div className="disc">
        <div className="d-ttl">⚠️ Day Worker Disclaimer</div>
        <div className="d-txt">Pay calculations use standard casual loading (25%) and weekend/PH rates (×1.75). Actual rates may vary under the applicable Modern Award. Super is calculated at the current SGC rate on ordinary time earnings. PAYG uses ATO 2024-25 progressive Scale 2 rates (or 47% flat if no TFN provided). Always issue a payslip and report wages to the ATO. Consult a registered payroll provider for full compliance.</div>
      </div>
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
  const [f, setF]       = useState({ type:"Workers Compensation", annual:"", notes:"", renewal:"", hasGst:"auto" });
  const [editId, setEditId] = useState(null);

  // ── Insurance knowledge base ─────────────────────────────
  const INS_INFO = {
    "Workers Compensation": {
      required: true,
      emoji: "🦺",
      what: "Covers your employees if they get injured or sick at work. Required by law in every Australian state.",
      whoNeeds: "Every employer with staff — no exceptions.",
      typicalCost: "1%–3% of annual payroll",
      gst: false,
      tip: "Your premium is calculated based on your total wages. As you hire more staff, this cost goes up automatically.",
    },
    "Public Liability": {
      required: false,
      emoji: "🤝",
      what: "Covers you if a customer, supplier or member of the public is injured at your premises or makes a claim against you.",
      whoNeeds: "Any business with customers on-site. Landlords often require it in your lease.",
      typicalCost: "$500–$2,500/year for a small hospitality business",
      gst: true,
      tip: "Most commercial leases require at least $10–$20 million in Public Liability cover. Check your lease agreement.",
    },
    "Equipment & Property": {
      required: false,
      emoji: "🍳",
      what: "Covers your kitchen equipment, fit-out, furniture and stock if damaged by fire, flood, theft or accident.",
      whoNeeds: "Any business with significant equipment investment.",
      typicalCost: "$800–$3,000/year depending on equipment value",
      gst: true,
      tip: "Make sure your policy covers replacement cost, not just market value. Commercial kitchen equipment depreciates quickly.",
    },
    "Business Interruption": {
      required: false,
      emoji: "🚪",
      what: "Covers lost income if you have to close temporarily due to fire, flood or other insured events.",
      whoNeeds: "Businesses heavily dependent on a single location.",
      typicalCost: "$600–$2,500/year",
      gst: true,
      tip: "COVID-19 taught many businesses this lesson the hard way. Check exactly what events are covered.",
    },
    "Product Liability": {
      required: false,
      emoji: "🍽️",
      what: "Covers claims from customers who get sick or injured from your food or products.",
      whoNeeds: "All food businesses. Often bundled with Public Liability.",
      typicalCost: "Usually bundled with Public Liability",
      gst: true,
      tip: "Often sold as a bundle with Public Liability. Ask your broker if it's already included.",
    },
    "Cyber Insurance": {
      required: false,
      emoji: "💻",
      what: "Covers you if customer data is stolen, your POS system is hacked, or you suffer a ransomware attack.",
      whoNeeds: "Businesses storing customer data, using online ordering or loyalty apps.",
      typicalCost: "$500–$1,500/year",
      gst: true,
      tip: "Increasingly important as businesses use more digital tools. OAIC requires you to notify customers of data breaches.",
    },
    "Other": {
      required: false,
      emoji: "🛡️",
      what: "Any other insurance policy relevant to your business.",
      whoNeeds: "Varies by policy.",
      typicalCost: "Varies",
      gst: true,
      tip: "Ask your insurance broker to review your full coverage annually.",
    },
  };

  // ── Calculations ─────────────────────────────────────────
  const rows         = annotateTimesheets(employees, timesheets);
  const weeks        = new Set(timesheets.map(t => t.week)).size || 1;
  const annualPayroll= rows.reduce((s,t) => s + t.gross, 0) / weeks * 52;
  const totalAnnual  = insurance.reduce((s,i) => s + i.annual, 0);
  const insGstCreds  = insurance.filter(i => {
    const info = INS_INFO[i.type];
    return info ? info.gst : true;
  }).reduce((s,i) => s + i.annual/11, 0);

  // Benchmark: industry healthy range 3–8% of payroll
  const insPct       = annualPayroll > 0 ? (totalAnnual / annualPayroll) * 100 : 0;
  const benchStatus  = insPct === 0 ? "none" : insPct < 3 ? "low" : insPct <= 8 ? "good" : "high";
  const benchMsg = {
    none: { label:"No data", col:C.dim,    icon:"—",  msg:"Add your payroll data in Staff & Wages to see your benchmark." },
    low:  { label:"Below average", col:C.yellow, icon:"⚠️", msg:`Your insurance is ${insPct.toFixed(1)}% of payroll, which is below the typical 3–8% range for Australian hospitality businesses. You may be underinsured.` },
    good: { label:"Healthy range", col:C.green,  icon:"✅", msg:`Your insurance is ${insPct.toFixed(1)}% of payroll — within the healthy 3–8% range for Australian hospitality businesses.` },
    high: { label:"Above average", col:C.yellow, icon:"⚠️", msg:`Your insurance is ${insPct.toFixed(1)}% of payroll, above the typical 3–8%. Consider reviewing your policies with a broker.` },
  }[benchStatus];

  // Check for missing required insurance
  const hasWorkersComp = insurance.some(i => i.type === "Workers Compensation");
  const hasPublicLiab  = insurance.some(i => i.type === "Public Liability");

  const save = () => {
    if (!f.annual) return;
    const entry = { type:f.type, annual:parseFloat(f.annual)||0, notes:f.notes, renewal:f.renewal };
    if (editId) {
      setInsurance(p => p.map(i => i.id === editId ? {...i,...entry} : i));
      showToast("Policy updated!");
    } else {
      setInsurance(p => [...p, { id:Date.now(), ...entry }]);
      showToast("Policy added!");
    }
    setF({ type:"Workers Compensation", annual:"", notes:"", renewal:"" });
    setEditId(null);
  };

  const startEdit = ins => {
    setF({ type:ins.type, annual:String(ins.annual), notes:ins.notes||"", renewal:ins.renewal||"" });
    setEditId(ins.id);
  };

  const getCol = type => INS_COLORS[type] || C.muted;
  const info   = INS_INFO[f.type] || INS_INFO["Other"];
  const [expandedId, setExpandedId] = useState(null);

  // Days until renewal
  const daysUntil = dateStr => {
    if (!dateStr) return null;
    const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
    return diff;
  };

  return (
    <>
      <div className="hdr">
        <div className="hdr-left">
          <div className="ptitle">Insurance Dashboard</div>
          <div className="psub">Track your policies, costs and compliance</div>
        </div>
      </div>

      {/* ── Alerts for missing required insurance ── */}
      {(!hasWorkersComp || !hasPublicLiab) && (
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
          {!hasWorkersComp && (
            <div style={{ background:"rgba(224,96,96,.1)", border:"1px solid rgba(224,96,96,.3)", borderRadius:11, padding:"12px 16px", display:"flex", gap:12, alignItems:"flex-start" }}>
              <div style={{ fontSize:20 }}>🦺</div>
              <div>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:3 }}>Workers Compensation not recorded</div>
                <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>Workers Compensation is <strong style={{color:C.text}}>legally required</strong> in every Australian state for any employer with staff. If you have employees, you must have this cover. Add it below.</div>
              </div>
            </div>
          )}
          {!hasPublicLiab && (
            <div style={{ background:"rgba(212,168,67,.1)", border:"1px solid rgba(212,168,67,.3)", borderRadius:11, padding:"12px 16px", display:"flex", gap:12, alignItems:"flex-start" }}>
              <div style={{ fontSize:20 }}>🤝</div>
              <div>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:3 }}>Public Liability not recorded</div>
                <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>Most commercial leases require Public Liability insurance. It protects you if a customer is injured on your premises.</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="g4">
        {[
          { lbl:"Total Annual Premium",  val:money(totalAnnual),    cls:"p" },
          { lbl:"Monthly Cost",          val:money(totalAnnual/12), cls:"" },
          { lbl:"Weekly Cost",           val:money(totalAnnual/52), cls:"" },
          { lbl:"GST Credits (claimable)", val:money(insGstCreds),  cls:"g" },
        ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
      </div>

      {/* ── Benchmark panel ── */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"16px 20px", marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:10.5, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".7px", marginBottom:6 }}>Industry Benchmark</div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:22 }}>{benchMsg.icon}</span>
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:benchMsg.col }}>{benchMsg.label}</div>
                <div style={{ fontSize:12, color:C.muted, marginTop:2, maxWidth:500, lineHeight:1.6 }}>{benchMsg.msg}</div>
              </div>
            </div>
          </div>
          {annualPayroll > 0 && (
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:10, color:C.dim, marginBottom:4 }}>Insurance as % of payroll</div>
              <div className="mono" style={{ fontSize:28, fontWeight:700, color:benchMsg.col }}>{insPct.toFixed(1)}%</div>
              <div style={{ fontSize:10.5, color:C.dim }}>Healthy range: 3%–8%</div>
            </div>
          )}
        </div>
        {annualPayroll > 0 && (
          <div style={{ marginTop:14 }}>
            <div style={{ height:8, background:C.border, borderRadius:4, overflow:"hidden", position:"relative" }}>
              {/* Healthy zone highlight */}
              <div style={{ position:"absolute", left:"30%", width:"50%", height:"100%", background:"rgba(82,201,122,.15)", borderRadius:4 }}/>
              <div style={{ height:"100%", width:`${Math.min(insPct/10*100,100)}%`, background:benchMsg.col, borderRadius:4, transition:"width .4s" }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:9.5, color:C.dim, marginTop:4 }}>
              <span>0%</span><span style={{color:C.green}}>← Healthy 3–8% →</span><span>10%+</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Policy cards ── */}
      {insurance.length > 0 && (
        <div className="g3">
          {insurance.slice().sort((a,b) => {
            // Ascending by renewal — most urgent (soonest expiring) first.
            // Policies with no renewal date sink to the bottom.
            if (!a.renewal && !b.renewal) return 0;
            if (!a.renewal) return 1;
            if (!b.renewal) return -1;
            return a.renewal.localeCompare(b.renewal);
          }).map(ins => {
            const col      = getCol(ins.type);
            const insInfo  = INS_INFO[ins.type] || INS_INFO["Other"];
            const days     = daysUntil(ins.renewal);
            const expanded = expandedId === ins.id;
            const renewalUrgent = days !== null && days <= 30;
            const renewalSoon   = days !== null && days <= 60 && days > 30;

            return (
              <div key={ins.id} className="ins-card" style={{ cursor:"default" }}>
                {/* Header */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                    <div style={{ fontSize:22 }}>{insInfo.emoji}</div>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                        <div style={{ fontSize:9.5, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".7px" }}>{ins.type}</div>
                        {insInfo.required && <span style={{ fontSize:9, fontWeight:700, background:"rgba(224,96,96,.15)", color:C.red, padding:"1px 6px", borderRadius:10 }}>REQUIRED BY LAW</span>}
                        {!insInfo.required && <span style={{ fontSize:9, fontWeight:700, background:C.surfaceAlt, color:C.dim, padding:"1px 6px", borderRadius:10 }}>OPTIONAL</span>}
                      </div>
                      <div className="mono" style={{ fontSize:22, fontWeight:700, color:col }}>{money(ins.annual)}<span style={{ fontSize:11, fontWeight:400, color:C.muted }}>/year</span></div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{money(ins.annual/12)}/month · {money(ins.annual/52)}/week</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:5 }}>
                    <button className="btn-b" onClick={() => startEdit(ins)}>Edit</button>
                    <button className="btn-r" onClick={() => { setInsurance(p => p.filter(x => x.id !== ins.id)); showToast("Policy removed."); }}>Remove</button>
                  </div>
                </div>

                {/* Renewal date */}
                {ins.renewal && (
                  <div style={{ marginTop:10, padding:"7px 11px", background: renewalUrgent ? "rgba(224,96,96,.1)" : renewalSoon ? "rgba(212,168,67,.1)" : C.surfaceAlt, borderRadius:8, display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:14 }}>{renewalUrgent ? "🚨" : renewalSoon ? "⏰" : "📅"}</span>
                    <div style={{ fontSize:11.5 }}>
                      <span style={{ color:C.muted }}>Renewal: </span>
                      <span style={{ fontWeight:700 }}>{ins.renewal}</span>
                      {days !== null && (
                        <span style={{ color: renewalUrgent ? C.red : renewalSoon ? C.yellow : C.muted, marginLeft:8 }}>
                          {days < 0 ? `⚠️ Expired ${Math.abs(days)} days ago` : days === 0 ? "Due today!" : `${days} days away`}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* GST info */}
                <div style={{ marginTop:10, display:"flex", gap:8, flexWrap:"wrap" }}>
                  <span style={{ fontSize:10.5, padding:"2px 8px", borderRadius:10, background: insInfo.gst ? "rgba(82,201,122,.12)" : C.surfaceAlt, color: insInfo.gst ? C.green : C.dim }}>
                    {insInfo.gst ? `✅ GST credit: ${money(ins.annual/11)}/yr` : "❌ No GST (not claimable)"}
                  </span>
                  {annualPayroll > 0 && (
                    <span style={{ fontSize:10.5, padding:"2px 8px", borderRadius:10, background:C.surfaceAlt, color:C.muted }}>
                      {((ins.annual/annualPayroll)*100).toFixed(2)}% of payroll
                    </span>
                  )}
                </div>

                {/* Expandable info */}
                <button onClick={() => setExpandedId(expanded ? null : ins.id)} style={{ marginTop:10, width:"100%", background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"6px 10px", fontSize:11, color:C.muted, cursor:"pointer", fontFamily:"inherit", textAlign:"left", display:"flex", justifyContent:"space-between" }}>
                  <span>💡 What is this insurance for?</span>
                  <span>{expanded ? "▲" : "▼"}</span>
                </button>
                {expanded && (
                  <div style={{ marginTop:8, padding:"12px 14px", background:C.surfaceAlt, borderRadius:9, fontSize:12, lineHeight:1.7, color:C.muted }}>
                    <div style={{ marginBottom:7 }}><strong style={{color:C.text}}>What it covers:</strong> {insInfo.what}</div>
                    <div style={{ marginBottom:7 }}><strong style={{color:C.text}}>Who needs it:</strong> {insInfo.whoNeeds}</div>
                    <div style={{ marginBottom:7 }}><strong style={{color:C.text}}>Typical cost:</strong> {insInfo.typicalCost}</div>
                    <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:7, color:C.accent }}>💡 {insInfo.tip}</div>
                  </div>
                )}

                {ins.notes && <div style={{ marginTop:8, fontSize:11, color:C.muted, borderTop:`1px solid ${C.border}`, paddingTop:7 }}>📝 {ins.notes}</div>}
              </div>
            );
          })}
        </div>
      )}

      {insurance.length === 0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"32px 24px", textAlign:"center", marginBottom:16 }}>
          <div style={{ fontSize:36, marginBottom:12 }}>🛡️</div>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:8 }}>No policies recorded yet</div>
          <div style={{ fontSize:12, color:C.muted, lineHeight:1.7, maxWidth:420, margin:"0 auto" }}>
            Add your insurance policies below. Start with <strong style={{color:C.text}}>Workers Compensation</strong> — it's required by law for any business with employees in Australia.
          </div>
        </div>
      )}

      {/* ── Add / Edit form ── */}
      <div className="fsec">
        <div className="ftit">{editId ? "Edit Policy" : "Add Insurance Policy"}</div>

        {/* Info card for selected type */}
        <div style={{ background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 15px", marginBottom:14, display:"flex", gap:12, alignItems:"flex-start" }}>
          <div style={{ fontSize:24, flexShrink:0 }}>{info.emoji}</div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4, flexWrap:"wrap" }}>
              <div style={{ fontWeight:700, fontSize:13 }}>{f.type}</div>
              {info.required
                ? <span style={{ fontSize:9.5, fontWeight:700, background:"rgba(224,96,96,.15)", color:C.red, padding:"1px 7px", borderRadius:10 }}>LEGALLY REQUIRED</span>
                : <span style={{ fontSize:9.5, fontWeight:700, background:C.surface, color:C.dim, padding:"1px 7px", borderRadius:10 }}>OPTIONAL</span>}
              <span style={{ fontSize:9.5, padding:"1px 7px", borderRadius:10, background: info.gst ? "rgba(82,201,122,.12)" : C.surface, color: info.gst ? C.green : C.dim }}>
                {info.gst ? "GST applicable" : "No GST"}
              </span>
            </div>
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>{info.what}</div>
            <div style={{ fontSize:11.5, color:C.muted, marginTop:4 }}>📊 Typical cost: <strong style={{color:C.text}}>{info.typicalCost}</strong></div>
          </div>
        </div>

        <div className="frow2">
          <div className="fg">
            <label className="flbl">Insurance Type</label>
            <select className="sel" value={f.type} onChange={e => setF({...f,type:e.target.value})}>
              {INS_TYPES.map(t => <option key={t} value={t}>{INS_INFO[t]?.emoji} {t}{INS_INFO[t]?.required ? " ★" : ""}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="flbl">Annual Premium ($)</label>
            <input className="inp" type="number" placeholder="0.00" value={f.annual} onChange={e => setF({...f,annual:e.target.value})}/>
            {f.annual && (
              <span className="fhint">
                Monthly: {money((parseFloat(f.annual)||0)/12)} · Weekly: {money((parseFloat(f.annual)||0)/52)}
                {info.gst && ` · GST credit: ${money((parseFloat(f.annual)||0)/11)}/yr`}
              </span>
            )}
          </div>
          <div className="fg">
            <label className="flbl">Renewal Date (optional)</label>
            <input className="inp" type="date" value={f.renewal} onChange={e => setF({...f,renewal:e.target.value})}/>
            {f.renewal && <span className="fhint">Mise will flag this policy when renewal is approaching.</span>}
          </div>
          <div className="fg">
            <label className="flbl">Notes (optional)</label>
            <input className="inp" placeholder="e.g. Policy #, insurer name, broker contact" value={f.notes} onChange={e => setF({...f,notes:e.target.value})}/>
          </div>
        </div>
        <div className="fbtns">
          <button className="btn" onClick={save}>{editId ? "Update Policy" : "Add Policy"}</button>
          {editId && <button className="btn-g" onClick={() => { setEditId(null); setF({type:"Workers Compensation",annual:"",notes:"",renewal:""}); }}>Cancel</button>}
        </div>
      </div>

      {/* ── Summary breakdown ── */}
      {insurance.length > 1 && (
        <div className="bc">
          <div className="bctit">Cost Breakdown</div>
          {insurance.map(ins => {
            const pct = totalAnnual > 0 ? (ins.annual/totalAnnual)*100 : 0;
            return (
              <div key={ins.id} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:12.5, fontWeight:500 }}>{INS_INFO[ins.type]?.emoji} {ins.type}</span>
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
            <span style={{ fontWeight:700 }}>Total Annual</span>
            <span className="mono" style={{ fontWeight:700, fontSize:17, color:C.purple }}>{money(totalAnnual)}</span>
          </div>
          <div style={{ fontSize:11.5, color:C.muted, marginTop:5 }}>
            GST credits you can claim: <strong style={{color:C.green}}>{money(insGstCreds)}/year</strong>
            {annualPayroll > 0 && <span> · {insPct.toFixed(1)}% of estimated annual payroll</span>}
          </div>
        </div>
      )}

      <div className="disc">
        <div className="d-ttl">⚠️ Insurance Disclaimer</div>
        <div className="d-txt">Insurance information shown is for budgeting and awareness purposes only. Workers Compensation obligations are mandated by state law and premiums vary by state, industry and payroll. Consult a licensed insurance broker to ensure you have adequate and compliant cover. Annual payroll shown is estimated from logged timesheets only and may not reflect your actual insurable wages.</div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  TAX SUMMARY
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
  const claimable  = analysed.filter(e => e.gstStatus === "claimable").reduce((s,e) => s + expGST(e), 0);
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
        <div className="hdr-left"><div className="ptitle">✅ Audit Ready</div><div className="psub">Identify compliance risks · Catch missing invoices · Be audit ready</div></div>
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

      {/* ── Payday Super Reform Banner ── */}
      <div style={{
        background: "linear-gradient(135deg, rgba(37,99,235,.12), rgba(124,58,237,.10))",
        border: "1.5px solid rgba(37,99,235,.35)",
        borderRadius: 12,
        padding: "14px 18px",
        marginBottom: 16,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}>
        <div style={{ fontSize:22, flexShrink:0, marginTop:1 }}>📢</div>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:"#2563EB", marginBottom:4 }}>
            ATO Reform: Payday Super — effective 1 July 2026
          </div>
          <div style={{ fontSize:12, color:C.muted, lineHeight:1.65 }}>
            From <strong style={{color:C.text}}>1 July 2026</strong>, employers must pay superannuation <strong style={{color:C.text}}>with every pay run</strong> — not quarterly.
            This means each time you pay wages, super must be sent to the employee's fund on the <strong style={{color:C.text}}>same day or next business day</strong>.
            Late payments will attract the <strong style={{color:"#DC2626"}}>Super Guarantee Charge (SGC)</strong>, which is not tax deductible.
          </div>
          <div style={{ fontSize:11, color:C.dim, marginTop:6 }}>
            💡 Action now: Get into the habit of marking super paid with each weekly payrun. Mise tracks this per timesheet — use the Payroll &amp; Super tab to stay on top of it.
          </div>
        </div>
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <>
          <div className="ts-panel">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, flexWrap:"wrap" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>Audit Ready Overview</div>
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
                {missing>0 ? `Unlocks ${money(analysed.filter(e=>e.gstStatus==="missing-invoice").reduce((s,e)=>s+expGST(e),0))} in GST credits` : unpaidSup>0 ? "Avoid SGC penalties — from Jul 2026 super is due each payday (Payday Super)" : "Keep logging expenses and revenue regularly."}
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
                      <td className="mono" style={{ color:C.teal }}>{e.gstStatus==="claimable" ? money(expGST(e)) : "—"}</td>
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
                                  <div style={{ fontSize:11.5, color:C.muted }}>Claim {money(expGST(e))} GST credit once invoice is on file.</div>
                                </div>
                                <button className="btn-t" onClick={() => markInvoice(e.id)}>✅ Mark Invoice Received</button>
                              </div>
                            )}
                            {e.gstStatus==="review" && <div style={{ fontSize:11.5, color:C.muted }}>Not marked as GST — check receipt. If GST is shown, update this entry.</div>}
                            {e.gstMismatch && <div style={{ fontSize:11.5, color:C.yellow, marginTop:3 }}>⚠️ GST mismatch — <strong>{CAT_CONFIG[e.cat]?.label || e.cat}</strong> expenses are usually {CAT_GST_DEFAULT[e.cat]?"GST-inclusive":"GST-free"}. Check this entry.</div>}
                            {e.gstStatus==="claimable" && <div style={{ fontSize:11.5, color:C.green }}>✅ GST credit of {money(expGST(e))} is claimable. All good.</div>}
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
      {tab === "deductions" && (() => {
        // ── Scanner: find miscoded expenses ─────────────────────
        const miscoded = analysed.filter(e => e.suggestion);

        // ── Also scan all expenses for potential cross-category issues ──
        // e.g. "uber eats" logged as "other" or ingredients
        const SCAN_RULES = [
          { kw:["uber eats","doordash","menulog","deliveroo","menulog"],   cat:"delivery_fees",  label:"Delivery Platform Fees",    emoji:"🛵", reason:"Platform commission fees are 100% deductible as a business expense — not food stock." },
          { kw:["spotify","apra","ppca","music licence","music license"],  cat:"music_ent",      label:"Music & Entertainment",     emoji:"🎵", reason:"Music licences are a separate operating expense — not software or other." },
          { kw:["xero","myob","simpro","deputy","tanda","lightspeed"],     cat:"software",       label:"Software & Subscriptions",  emoji:"💻", reason:"SaaS subscriptions belong in Software — deductible in full." },
          { kw:["stripe","tyro","eftpos","square","merchant fee"],         cat:"merchant_fees",  label:"Merchant & EFTPOS Fees",    emoji:"💳", reason:"Card processing fees are bank charges — not advertising or other." },
          { kw:["facebook","instagram","google ads","tiktok","meta ads"],  cat:"advertising",    label:"Advertising",               emoji:"📣", reason:"Digital ad spend is advertising — deductible in full." },
          { kw:["rsa","responsible service","alcohol training"],           cat:"rsa_training",   label:"RSA Training",              emoji:"🪪", reason:"Staff training costs are fully deductible." },
          { kw:["apron","uniform","workwear","branded shirt","chef white"], cat:"staff_uniforms", label:"Staff Uniforms",           emoji:"👕", reason:"Compulsory/distinctive work clothing is deductible." },
          { kw:["pest","pest control","fumigat"],                          cat:"cleaning",       label:"Cleaning & Hygiene",        emoji:"🧹", reason:"Pest control is a cleaning/hygiene cost — not repairs." },
          { kw:["insurance","premium","liability","workers comp","policy"], cat:"insurance_expense", label:"Insurance Premium",     emoji:"🛡️", reason:"Business insurance premiums are fully deductible." },
          { kw:["accountant","bookkeeper","bas agent","tax agent"],        cat:"accounting",     label:"Accounting & Consulting",   emoji:"📋", reason:"Professional fees are fully deductible." },
          { kw:["interest","loan interest","overdraft"],                   cat:"interest_expense",label:"Interest Expense",         emoji:"💸", reason:"Business loan interest is deductible — not a general expense." },
          { kw:["phone","mobile","internet","broadband","nbn","telstra"],  cat:"telephone_internet", label:"Telephone & Internet",  emoji:"📱", reason:"Business phone/internet is fully deductible." },
        ];

        const additionalFinds = expenses
          .filter(e => {
            // Only scan if NOT already correctly categorised
            const desc = e.desc.toLowerCase();
            return SCAN_RULES.some(r =>
              r.kw.some(k => desc.includes(k)) && e.cat !== r.cat
            );
          })
          .map(e => {
            const desc = e.desc.toLowerCase();
            const rule = SCAN_RULES.find(r => r.kw.some(k => desc.includes(k)) && e.cat !== r.cat);
            return { ...e, scanCat: rule.cat, scanLabel: rule.label, scanEmoji: rule.emoji, scanReason: rule.reason };
          });

        // Combine: miscoded (from analyseExpenses) + additional scanner hits
        const allMiscoded = [
          ...miscoded.map(e => ({
            ...e,
            scanCat:    e.suggestion.cat,
            scanLabel:  e.suggestion.label,
            scanEmoji:  CAT_CONFIG[e.suggestion.cat]?.emoji || "🏷️",
            scanReason: `This expense looks like ${e.suggestion.label} based on its description. Better categorisation means clearer records at tax time.`,
          })),
          ...additionalFinds.filter(af => !miscoded.find(m => m.id === af.id)),
        ];

        // ── Checklist: which categories are claimed vs missing ───
        const HOSPITALITY_CHECKLIST = [
          { cat:"ingredients",        must:true,  tip:"Your biggest deduction — keep all supplier invoices." },
          { cat:"food_stock",         must:true,  tip:"Dry goods, pantry staples — separate from fresh produce." },
          { cat:"rent",               must:true,  tip:"Commercial lease — keep monthly statements as invoices." },
          { cat:"utilities",          must:true,  tip:"Electricity, gas, water — quarterly bills count as invoices." },
          { cat:"equipment",          must:false, tip:"Fridges, ovens, POS. Instant asset write-off may apply under $20k." },
          { cat:"repairs",            must:false, tip:"Plumber, electrician, kitchen repairs — keep all receipts." },
          { cat:"cleaning",           must:true,  tip:"Sanitiser, pest control, hygiene supplies — operational must." },
          { cat:"packaging",          must:true,  tip:"Takeaway containers, bags — every purchase deductible." },
          { cat:"software",           must:false, tip:"Xero, POS, booking systems — 100% deductible subscriptions." },
          { cat:"advertising",        must:false, tip:"Facebook/Google ads, print, signage — all deductible." },
          { cat:"accounting",         must:false, tip:"BAS agent, bookkeeper, accountant — professional fees." },
          { cat:"staff_uniforms",     must:false, tip:"Aprons, branded shirts — must be distinctive or compulsory." },
          { cat:"delivery_fees",      must:false, tip:"Uber Eats, DoorDash commission — separate from food costs." },
          { cat:"merchant_fees",      must:false, tip:"Stripe, Tyro, Square, EFTPOS fees — bank charges category." },
          { cat:"telephone_internet", must:false, tip:"Business phone and internet — keep monthly bills." },
          { cat:"insurance_expense",  must:true,  tip:"Workers comp, public liability — premiums fully deductible." },
          { cat:"music_ent",          must:false, tip:"APRA/PPCA licence required if playing music — deductible." },
          { cat:"smallwares",         must:false, tip:"Plates, cutlery, ramekins — replace regularly, keep receipts." },
        ];

        const thisQuarter = (() => {
          const n = new Date();
          const qStart = new Date(n.getFullYear(), Math.floor(n.getMonth()/3)*3, 1);
          return expenses.filter(e => new Date(e.date) >= qStart);
        })();

        const checklist = HOSPITALITY_CHECKLIST.map(item => {
          const cfg      = CAT_CONFIG[item.cat];
          const allTime  = expenses.filter(e => e.cat === item.cat);
          const quarter  = thisQuarter.filter(e => e.cat === item.cat);
          const hasInv   = allTime.filter(e => e.invoice).length;
          const total    = allTime.reduce((s,e) => s+e.amount, 0);
          const qTotal   = quarter.reduce((s,e) => s+e.amount, 0);
          const status   = allTime.length === 0 ? "never"
                         : hasInv < allTime.length * 0.5 ? "partial"
                         : "claimed";
          return { ...item, cfg, allTime: allTime.length, quarter: quarter.length, total, qTotal, hasInv, status };
        });

        const neverClaimed = checklist.filter(c => c.status === "never");
        const partial      = checklist.filter(c => c.status === "partial");
        const claimed      = checklist.filter(c => c.status === "claimed");
        const totalFindable = allMiscoded.length + neverClaimed.filter(c=>c.must).length;

        return (
          <>
            {/* Summary banner */}
            <div style={{ background:"linear-gradient(135deg,rgba(234,179,8,.08),rgba(16,185,129,.06))", border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px", marginBottom:16, display:"flex", gap:24, flexWrap:"wrap" }}>
              {[
                { val: allMiscoded.length,                     lbl:"Miscoded expenses",         col: allMiscoded.length   ? C.yellow : C.green, ico:"🏷️" },
                { val: neverClaimed.length,                    lbl:"Categories never used",     col: neverClaimed.length  ? C.red    : C.green, ico:"❌" },
                { val: partial.length,                         lbl:"Missing invoices",          col: partial.length       ? C.yellow : C.green, ico:"🧾" },
                { val: claimed.length,                         lbl:"Categories claimed",        col: C.green,                                   ico:"✅" },
              ].map((s,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:20 }}>{s.ico}</span>
                  <div>
                    <div className="mono" style={{ fontSize:22, fontWeight:800, color:s.col, lineHeight:1 }}>{s.val}</div>
                    <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{s.lbl}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── SCANNER ── */}
            <div className="bc" style={{ marginBottom:14 }}>
              <div className="bctit">🔍 Miscoding Scanner
                <span style={{ fontSize:11, fontWeight:400, color:C.muted, marginLeft:8 }}>expenses that could be better categorised</span>
              </div>
              {allMiscoded.length === 0 ? (
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 0", color:C.green }}>
                  <span style={{ fontSize:18 }}>✅</span>
                  <span style={{ fontSize:13, fontWeight:600 }}>All expenses look correctly categorised — great work.</span>
                </div>
              ) : allMiscoded.map(e => (
                <div key={e.id} style={{ background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px", marginBottom:8 }}>
                  <div style={{ display:"flex", gap:12, alignItems:"flex-start", flexWrap:"wrap" }}>
                    <div style={{ flex:1, minWidth:200 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontSize:11, padding:"2px 8px", background:`${C.yellow}18`, color:C.yellow, borderRadius:20, fontWeight:700, border:`1px solid ${C.yellow}44` }}>
                          {CAT_CONFIG[e.cat]?.emoji} {CAT_CONFIG[e.cat]?.label || e.cat}
                        </span>
                        <span style={{ fontSize:11, color:C.dim }}>→</span>
                        <span style={{ fontSize:11, padding:"2px 8px", background:`${C.teal}14`, color:C.teal, borderRadius:20, fontWeight:700, border:`1px solid ${C.teal}44` }}>
                          {e.scanEmoji} {e.scanLabel}
                        </span>
                      </div>
                      <div style={{ fontWeight:700, fontSize:13, marginBottom:3 }}>{e.desc}</div>
                      <div style={{ fontSize:11, color:C.muted }}>{e.date} · {money(e.amount)}</div>
                      <div style={{ fontSize:11, color:C.dim, marginTop:5, fontStyle:"italic" }}>{e.scanReason}</div>
                    </div>
                    <button className="btn-t" style={{ whiteSpace:"nowrap", alignSelf:"center" }}
                      onClick={() => { recode(e.id, e.scanCat); }}>
                      ✓ Apply Fix
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── CHECKLIST ── */}
            <div className="bc">
              <div className="bctit">📋 Deduction Checklist
                <span style={{ fontSize:11, fontWeight:400, color:C.muted, marginLeft:8 }}>every hospitality category — what you've claimed vs what's missing</span>
              </div>

              {/* Never claimed — biggest opportunity */}
              {neverClaimed.length > 0 && (
                <>
                  <div style={{ fontSize:10, fontWeight:700, color:C.red, textTransform:"uppercase", letterSpacing:".8px", marginBottom:8, marginTop:4 }}>
                    ❌ Never Claimed — Check if applicable
                  </div>
                  {neverClaimed.map(c => (
                    <div key={c.cat} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 12px", background:"rgba(220,38,38,.04)", border:"1px solid rgba(220,38,38,.15)", borderRadius:8, marginBottom:6 }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>{c.cfg?.emoji || "📎"}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:12.5 }}>{c.cfg?.label || c.cat}</div>
                        <div style={{ fontSize:11, color:C.dim, marginTop:2 }}>{c.tip}</div>
                      </div>
                      {c.must && <span style={{ fontSize:9.5, fontWeight:700, color:C.red, background:"rgba(220,38,38,.1)", padding:"2px 7px", borderRadius:10, flexShrink:0 }}>COMMON</span>}
                    </div>
                  ))}
                  <div style={{ height:12 }}/>
                </>
              )}

              {/* Partial — have some but missing invoices */}
              {partial.length > 0 && (
                <>
                  <div style={{ fontSize:10, fontWeight:700, color:C.yellow, textTransform:"uppercase", letterSpacing:".8px", marginBottom:8 }}>
                    ⚠️ Claimed but missing invoices
                  </div>
                  {partial.map(c => (
                    <div key={c.cat} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 12px", background:"rgba(217,119,6,.04)", border:"1px solid rgba(217,119,6,.2)", borderRadius:8, marginBottom:6 }}>
                      <span style={{ fontSize:18, flexShrink:0 }}>{c.cfg?.emoji || "📎"}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:12.5 }}>{c.cfg?.label || c.cat}</div>
                        <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{c.allTime} expense{c.allTime!==1?"s":""} · {money(c.total)} total · {c.hasInv}/{c.allTime} invoices on file</div>
                      </div>
                      <span className="mono" style={{ fontSize:13, fontWeight:700, color:C.yellow, flexShrink:0 }}>{money(c.total)}</span>
                    </div>
                  ))}
                  <div style={{ height:12 }}/>
                </>
              )}

              {/* Fully claimed */}
              {claimed.length > 0 && (
                <>
                  <div style={{ fontSize:10, fontWeight:700, color:C.green, textTransform:"uppercase", letterSpacing:".8px", marginBottom:8 }}>
                    ✅ Claimed &amp; documented
                  </div>
                  {claimed.map(c => (
                    <div key={c.cat} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 12px", background:"rgba(5,150,105,.04)", border:"1px solid rgba(5,150,105,.15)", borderRadius:8, marginBottom:5 }}>
                      <span style={{ fontSize:16, flexShrink:0 }}>{c.cfg?.emoji || "📎"}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:12 }}>{c.cfg?.label || c.cat}</div>
                        <div style={{ fontSize:10.5, color:C.dim, marginTop:1 }}>{c.allTime} expense{c.allTime!==1?"s":""} · {c.hasInv}/{c.allTime} invoices</div>
                      </div>
                      <span className="mono" style={{ fontSize:13, fontWeight:700, color:C.green, flexShrink:0 }}>{money(c.total)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        );
      })()}

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
            ? <div className="alert al-r"><span className="al-ico">🔴</span><div><div className="al-ttl">{unpaidSup} timesheet row{unpaidSup>1?"s":""} with unpaid super — {money(rows.filter(t=>!t.super_paid).reduce((s,t)=>s+t.super,0))} outstanding</div><div className="al-msg">Late super incurs the SGC — not tax deductible. From 1 Jul 2026 (Payday Super), super must be paid with every pay run.</div></div></div>
            : <div className="alert al-g"><span className="al-ico">✅</span><div><div className="al-ttl">All super marked as paid</div></div></div>
          }

          <div className="g2" style={{ marginTop:10 }}>
            <div className="card">
              <div className="clbl">Total Super Obligation</div>
              <div className="cval b">{money(rows.reduce((s,t)=>s+t.super,0))}</div>
              <div className="csub">SGC rate on gross wages</div>
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
              <thead><tr><th>Employee</th><th>Week</th><th>Gross</th><th>Super (SGC)</th><th>PAYG (ATO Scale 2)</th><th>Total Labour</th><th>Super Paid?</th></tr></thead>
              <tbody>
                {rows.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                        <div style={{ width:22, height:22, borderRadius:"50%", background:avatarBg(t.emp.id, t.emp.color), display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, fontWeight:700, color:"#fff" }}>
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
        <div className="d-txt">Audit Ready provides <strong>educational guidance only</strong> based on general ATO rules. It does not constitute financial, taxation, or legal advice. Always confirm with a <strong>registered tax agent or accountant</strong> before lodging your BAS or tax return. Visit <strong>ato.gov.au</strong> for official guidance.</div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════════
function SettingsPage({ industry, setIndustry, showToast, bizName, setBizName, bizABN, setBizABN, bizId, currentRole, companyName = "", setCompanyName = () => {}, bizSettings = {}, updateSetting = () => {} }) {
  const [saved, setSaved] = useState(false);
  // Accountant (view or edit) — business identity fields are read-only and
  // owner-only sections (Team Access, Subscription, Danger Zone) are hidden.
  const isAccountant = currentRole !== "owner";

  // ── Change Password state ──────────────────────────────────────
  const [pwExpanded,   setPwExpanded]   = useState(false);
  const [pwNew,        setPwNew]        = useState("");
  const [pwConfirm,    setPwConfirm]    = useState("");
  const [pwSaving,     setPwSaving]     = useState(false);
  const [pwError,      setPwError]      = useState("");

  const handleChangePassword = async () => {
    setPwError("");
    if (pwNew.length < 6) {
      setPwError("Password must be at least 6 characters");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError("Passwords don't match");
      return;
    }
    setPwSaving(true);
    try {
      const { error } = await window._supabase.auth.updateUser({ password: pwNew });
      if (error) throw error;
      showToast("Password updated ✅");
      setPwNew(""); setPwConfirm(""); setPwExpanded(false);
    } catch (e) {
      setPwError(e.message || "Failed to update password");
    } finally {
      setPwSaving(false);
    }
  };

  // ── Team Access state (Phase 1 Step 3 v2 — defensive) ──
  // Defensive design:
  //   - All state safe-defaulted (no undefined)
  //   - currentRole defaults to "owner" if undefined (matches App state)
  //   - Skip load entirely if bizId or window._supabase is missing
  //   - All RPC calls wrapped in try/catch; never bubble up to render
  const isOwner = (currentRole || "owner") === "owner";
  const [accessList,    setAccessList]    = useState([]);
  const [accessLoaded,  setAccessLoaded]  = useState(false);
  const [accessLoadErr, setAccessLoadErr] = useState("");
  const [inviteEmail,   setInviteEmail]   = useState("");
  const [inviteRole,    setInviteRole]    = useState("accountant_view");
  const [inviteBusy,    setInviteBusy]    = useState(false);
  const [inviteError,   setInviteError]   = useState("");

  const loadAccessList = async () => {
    setAccessLoadErr("");
    if (!bizId) { setAccessList([]); setAccessLoaded(true); return; }
    if (!window._supabase) { setAccessLoadErr("Database not available"); setAccessLoaded(true); return; }
    try {
      const { data, error } = await window._supabase.rpc("list_business_access", { p_business_id: bizId });
      if (error) {
        console.warn("loadAccessList error:", error);
        setAccessLoadErr(error.message || "Could not load access list");
        setAccessList([]);
      } else {
        // Defensive: filter out any malformed rows
        const clean = (data || []).filter(r => r && r.user_id);
        setAccessList(clean);
      }
    } catch (e) {
      console.warn("loadAccessList exception:", e);
      setAccessLoadErr(e.message || "Could not load access list");
      setAccessList([]);
    } finally {
      setAccessLoaded(true);
    }
  };

  useEffect(() => { loadAccessList(); }, [bizId]);

  const handleInvite = async () => {
    setInviteError("");
    const email = (inviteEmail || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setInviteError("Please enter a valid email address");
      return;
    }
    if (!bizId) {
      setInviteError("No active business");
      return;
    }
    setInviteBusy(true);
    try {
      const { data: result, error } = await window._supabase.rpc("invite_accountant", {
        p_business_id: bizId,
        p_email:       email,
        p_role:        inviteRole,
      });
      if (error) {
        setInviteError(error.message || "Invitation failed");
        return;
      }
      const msg = {
        "ok": null,
        "not_registered": `No Mise account found for "${email}". Ask them to sign up first at tax-mate-phi.vercel.app, then come back here to invite.`,
        "already_has_access": `${email} already has access to this business.`,
        "self_invite": "You can't invite yourself.",
        "not_owner": "Only the business owner can invite accountants.",
        "invalid_role": "Invalid role selected.",
      };
      if (result === "ok") {
        showToast("Accountant invited ✅");
        setInviteEmail("");
        await loadAccessList();
      } else {
        setInviteError(msg[result] || `Unknown response: ${result}`);
      }
    } catch (e) {
      setInviteError(e.message || "Invitation failed");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRevoke = async (userId, email) => {
    if (!userId) return;
    if (!window.confirm(`Revoke access for ${email || "this user"}? They will no longer be able to see this business's data.`)) return;
    try {
      // Use SECURITY DEFINER RPC — a direct DELETE is silently blocked by RLS
      // (the SELECT policy hides the owner's own verification row from the subquery),
      // which causes "0 rows deleted" with no error — a false success.
      const { data: result, error } = await window._supabase
        .rpc("revoke_access", { p_business_id: bizId, p_user_id: userId });
      if (error) {
        showToast("Revoke failed: " + (error.message || ""));
        return;
      }
      if (result === "ok") {
        showToast("Access revoked");
        await loadAccessList();
      } else if (result === "not_owner") {
        showToast("Only the owner can revoke access");
      } else if (result === "cannot_revoke_owner") {
        showToast("Cannot revoke an owner");
      } else if (result === "not_found") {
        showToast("Access already removed");
        await loadAccessList();
      } else {
        showToast("Revoke failed: " + result);
      }
    } catch (e) {
      showToast("Revoke failed: " + (e.message || ""));
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    if (!userId || !newRole) return;
    try {
      const { data: result, error } = await window._supabase
        .rpc("update_access_role", { p_business_id: bizId, p_user_id: userId, p_role: newRole });
      if (error) {
        showToast("Update failed: " + (error.message || ""));
        return;
      }
      if (result === "ok") {
        showToast("Permission updated");
        await loadAccessList();
      } else if (result === "not_owner") {
        showToast("Only the owner can change permissions");
      } else if (result === "cannot_change_owner") {
        showToast("Cannot change the owner's role");
      } else {
        showToast("Update failed: " + result);
      }
    } catch (e) {
      showToast("Update failed: " + (e.message || ""));
    }
  };

  // Safe label resolver — never returns undefined
  const roleLabel = (r) => {
    if (r === "owner")            return { lbl:"Owner",     col:C.accent, desc:"Full control"      };
    if (r === "accountant_edit")  return { lbl:"Editor",    col:C.teal,   desc:"Can view and edit" };
    if (r === "accountant_view")  return { lbl:"View only", col:C.blue,   desc:"Read-only access"  };
    return                                { lbl:r || "?",   col:C.muted,  desc:""                  };
  };

  const INDUSTRIES = [
    { id:"restaurant", emoji:"🍽️", label:"Restaurant",   desc:"Full-service dining, takeaway" },
    { id:"café",       emoji:"☕", label:"Café",          desc:"Coffee shop, bakery, brunch" },
    { id:"bar",        emoji:"🍺", label:"Bar / Pub",     desc:"Licensed venue, cocktail bar" },
    { id:"other",      emoji:"🏪", label:"Other Business",desc:"Retail, beauty, services" },
  ];

  return (
    <>
      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">Settings</div><div className="psub">Manage your business and account</div></div>
      </div>

      {/* ── Business Identity — persisted ── */}
      <div className="fsec">
        <div className="ftit">Business Details</div>
        {isAccountant ? (
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(64,156,255,.08)", border:`1px solid rgba(64,156,255,.25)`, borderRadius:9, padding:"10px 13px", marginBottom:14, fontSize:12, color:C.muted }}>
            <span style={{ fontSize:15 }}>🔒</span>
            <span>These details are <strong style={{color:C.text}}>managed by the business owner</strong>. You can view them for reference, but only the owner can make changes.</span>
          </div>
        ) : (
          <div style={{ fontSize:12.5, color:C.muted, marginBottom:14 }}>Your <strong style={{color:C.text}}>Business Name</strong> appears on all exported PDFs — payslips, BAS summaries, rosters and accountant packs. Your <strong style={{color:C.text}}>Company Name</strong> is your brand, shown in the top-left of the app.</div>
        )}
        <div className="frow2">
          <div className="fg">
            <label className="flbl">Business / Restaurant Name *</label>
            <input className="inp" disabled={isAccountant} value={bizName} onChange={e => setBizName(e.target.value)} placeholder="e.g. The Local Bistro"/>
            <span className="fhint">Trading name — appears on all PDFs, BAS & payslips</span>
          </div>
          <div className="fg">
            <label className="flbl">Company / Brand Name</label>
            <input className="inp" disabled={isAccountant} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Hui Wang Da PTY LTD"/>
            <span className="fhint">Shown top-left in the app. Leave blank to show "Mise".</span>
          </div>
          <div className="fg">
            <label className="flbl">ABN</label>
            <input className="inp" disabled={isAccountant} value={bizABN} onChange={e => setBizABN(e.target.value)} placeholder="12 345 678 901"/>
            <span className="fhint">11-digit Australian Business Number</span>
          </div>
          <div className="fg">
            <label className="flbl">GST Registration Date</label>
            <input className="inp" type="date" disabled={isAccountant}
              value={bizSettings.gst_reg || ""}
              onChange={e => { updateSetting("gst_reg", e.target.value); showToast("Saved!"); }}/>
          </div>
          <div className="fg">
            <label className="flbl">BAS Lodgment Frequency</label>
            <select className="sel" disabled={isAccountant}
              value={bizSettings.bas_freq || "quarterly"}
              onChange={e => { updateSetting("bas_freq", e.target.value); showToast("Saved!"); }}>
              <option value="quarterly">Quarterly (most common)</option>
              <option value="monthly">Monthly</option>
              <option value="annual">Annually</option>
            </select>
          </div>
          <div className="fg">
            <label className="flbl">Payday (for Cash Flow view)</label>
            <select className="sel" disabled={isAccountant}
              value={bizSettings.payday || "4"}
              onChange={e => { updateSetting("payday", e.target.value); showToast("Saved!"); }}>
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday (most common)</option>
              <option value="5">Friday</option>
            </select>
            <span className="fhint">Wages appear on this day in Cash Flow</span>
          </div>
          <div className="fg">
            <label className="flbl">Owner / Contact Email</label>
            <input className="inp" type="email" placeholder="owner@mybistro.com.au" disabled={isAccountant}
              value={bizSettings.owner_email || ""}
              onChange={e => { updateSetting("owner_email", e.target.value); showToast("Saved!"); }}/>
          </div>
          <div className="fg">
            <label className="flbl">State</label>
            <select className="sel" disabled={isAccountant}
              value={bizSettings.state || "NSW"}
              onChange={e => { updateSetting("state", e.target.value); showToast("Saved!"); }}>
              {["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {bizName && bizName !== "My Restaurant" && (
          <div style={{ fontSize:11, color:C.green, marginTop:8 }}>✅ Saved — will appear on all future PDF exports</div>
        )}
      </div>
      <div className="fsec">
        <div className="ftit">Business Type</div>
        <div style={{ fontSize:12.5, color:C.muted, marginBottom:14, lineHeight:1.6 }}>
          Describe your business in your own words (e.g. "Hot Pot Restaurant", "Bubble Tea Shop", "火锅店"). If it matches a known hospitality type, expense categories and Audit Ready tips will auto-adjust.
        </div>

        <div className="fg">
          <label className="flbl">Business Type</label>
          <input
            className="inp"
            type="text"
            disabled={isAccountant}
            placeholder="e.g. Hot Pot Restaurant, Café, Bakery, Bar…"
            value={industry === "restaurant" || industry === "café" || industry === "bar" || industry === "other" ? "" : industry}
            onChange={e => setIndustry(e.target.value)}
            onBlur={e => { if (e.target.value.trim()) showToast("Business type saved ✅"); }}/>
          <span className="fhint">
            {isAccountant ? "Managed by the business owner." : "Free text — type anything. Common types (restaurant, café, bar, bakery, takeaway) unlock tailored expense sorting."}
          </span>
        </div>

        {/* What changes panel — infers from keywords in the free text */}
        {(() => {
          const t = (industry || "").toLowerCase();
          const isRestaurant = /restaurant|餐厅|餐館|餐馆|diner|eatery|hot ?pot|火锅|noodle|面|grill/.test(t);
          const isCafe       = /caf[eé]|咖啡|coffee|bakery|烘焙|面包|dessert|甜/.test(t);
          const isBar        = /bar|酒吧|pub|brewery|tavern|liquor|wine|啤酒/.test(t);
          const matched = isRestaurant || isCafe || isBar;
          return (
            <div style={{ marginTop:14, background:C.surfaceAlt, borderRadius:10, padding:"13px 15px", fontSize:12, color:C.muted, lineHeight:1.8 }}>
              <div style={{ fontWeight:700, color:C.text, marginBottom:6 }}>
                {matched ? "🎯" : "📋"} {industry && !["restaurant","café","bar","other"].includes(industry)
                  ? <>Currently set to: <span style={{color:C.accent}}>{industry}</span></>
                  : "Enter your business type above"}
              </div>
              {isRestaurant && <>
                <div>✅ Expense categories show <strong style={{color:C.text}}>Ingredients, Packaging, Cleaning</strong> first</div>
                <div>✅ Audit Ready tips focus on <strong style={{color:C.text}}>food GST rules</strong> and cash revenue</div>
              </>}
              {isCafe && <>
                <div>✅ Coffee Supplies, Bakery Supplies and takeaway packaging highlighted</div>
                <div>✅ Audit Ready tips include <strong style={{color:C.text}}>GST-free fresh food rules</strong></div>
              </>}
              {isBar && <>
                <div>✅ Spirit Stock, Beer &amp; Wine, Glassware, Liquor License highlighted</div>
                <div>✅ Audit Ready flags <strong style={{color:C.text}}>Liquor License (no GST)</strong> automatically</div>
              </>}
              {!matched && (
                <>
                  <div>✅ Standard hospitality expense categories shown</div>
                  <div>✅ All categories remain available — nothing is hidden</div>
                </>
              )}
            </div>
          );
        })()}
      </div>

      <div className="fsec">
        <div className="ftit">Security</div>
        <div style={{ fontSize:12.5, color:C.muted, marginBottom:14 }}>Update your account password. Use at least 6 characters — a mix of letters, numbers and symbols is strongest.</div>

        {!pwExpanded ? (
          <button
            className="btn-g"
            style={{ padding:"9px 16px" }}
            onClick={() => { setPwError(""); setPwExpanded(true); }}>
            🔒 Change Password
          </button>
        ) : (
          <div style={{ maxWidth:420 }}>
            {pwError && (
              <div style={{ background:"rgba(220,38,38,.1)", border:"1px solid rgba(220,38,38,.3)", borderRadius:8, padding:"9px 13px", fontSize:12, color:C.red, marginBottom:12 }}>
                {pwError}
              </div>
            )}
            <div className="fg">
              <label className="flbl">New Password</label>
              <input
                className="inp"
                type="password"
                placeholder="••••••••"
                value={pwNew}
                onChange={e => setPwNew(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleChangePassword()}
                autoFocus/>
            </div>
            <div className="fg">
              <label className="flbl">Confirm New Password</label>
              <input
                className="inp"
                type="password"
                placeholder="••••••••"
                value={pwConfirm}
                onChange={e => setPwConfirm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleChangePassword()}/>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:4 }}>
              <button
                className="btn"
                style={{ padding:"9px 16px", opacity: pwSaving ? 0.7 : 1 }}
                onClick={handleChangePassword}
                disabled={pwSaving}>
                {pwSaving ? "Saving…" : "Save New Password"}
              </button>
              <button
                className="btn-g"
                style={{ padding:"9px 16px" }}
                onClick={() => { setPwExpanded(false); setPwNew(""); setPwConfirm(""); setPwError(""); }}
                disabled={pwSaving}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Owner-only sections: Team Access, Subscription, Danger Zone ── */}
      {!isAccountant && (<>
      {/* ── Team Access (Phase 1 Step 3 v2 — defensive) ── */}
      <div className="fsec">
        <div className="ftit">Team Access</div>
        <div style={{ fontSize:12.5, color:C.muted, marginBottom:14 }}>
          {isOwner
            ? "Invite your accountant to access this business's data."
            : "Contact the owner to change permissions."}
        </div>

        {/* Access list — minimal rendering, max defensiveness */}
        {!accessLoaded ? (
          <div style={{ fontSize:12, color:C.muted }}>Loading…</div>
        ) : accessLoadErr ? (
          <div style={{ fontSize:12, color:C.red, marginBottom:10 }}>⚠️ {accessLoadErr}</div>
        ) : accessList.length === 0 ? (
          <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>No team members yet.</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
            {accessList.map(a => {
              const safeRole  = a && a.role  ? a.role  : "?";
              const safeEmail = a && a.email ? a.email : "(unknown)";
              const safeId    = a && a.user_id ? a.user_id : Math.random().toString();
              const rl = roleLabel(safeRole);
              return (
                <div key={safeId} style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"10px 13px", background:C.surfaceAlt,
                  border:`1px solid ${C.border}`, borderRadius:9
                }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {safeEmail}
                    </div>
                    <div style={{ fontSize:11, marginTop:2 }}>
                      <span style={{ color:rl.col, fontWeight:600 }}>{rl.lbl}</span>
                      {rl.desc ? <span style={{ color:C.muted, marginLeft:6 }}>· {rl.desc}</span> : null}
                    </div>
                  </div>
                  {isOwner && safeRole !== "owner" && (
                    <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                      <select
                        value={safeRole}
                        onChange={e => handleChangeRole(safeId, e.target.value)}
                        style={{
                          fontSize:11, padding:"5px 7px",
                          background:C.bg, border:`1px solid ${C.border}`, borderRadius:6,
                          color:C.text, fontFamily:"inherit", cursor:"pointer"
                        }}>
                        <option value="accountant_view">View only</option>
                        <option value="accountant_edit">Full edit</option>
                      </select>
                      <button
                        className="btn-g"
                        style={{ fontSize:11, padding:"6px 11px" }}
                        onClick={() => handleRevoke(safeId, safeEmail)}>
                        Revoke
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Invite form — owner only */}
        {isOwner && (
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14, marginTop:8 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", marginBottom:10 }}>
              Invite Accountant
            </div>
            {inviteError ? (
              <div style={{ background:"rgba(220,38,38,.1)", border:"1px solid rgba(220,38,38,.3)", borderRadius:8, padding:"9px 13px", fontSize:12, color:C.red, marginBottom:12 }}>
                {inviteError}
              </div>
            ) : null}
            <div className="frow2" style={{ marginBottom:10 }}>
              <div className="fg">
                <label className="flbl">Accountant Email</label>
                <input
                  className="inp"
                  type="email"
                  placeholder="accountant@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}/>
              </div>
              <div className="fg">
                <label className="flbl">Permission</label>
                <select
                  className="inp"
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}>
                  <option value="accountant_view">View only — read &amp; download</option>
                  <option value="accountant_edit">Full edit — add and modify</option>
                </select>
              </div>
            </div>
            <button
              className="btn"
              style={{ padding:"9px 16px", opacity: inviteBusy ? 0.7 : 1 }}
              onClick={handleInvite}
              disabled={inviteBusy}>
              {inviteBusy ? "Inviting…" : "📨 Invite Accountant"}
            </button>
            <div style={{ fontSize:11, color:C.muted, marginTop:10, lineHeight:1.5 }}>
              <strong>Note:</strong> the accountant must first register a free Mise account, then come back here to invite.
            </div>
          </div>
        )}
      </div>

      <div className="fsec">
        <div className="ftit">Subscription</div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontWeight:600 }}>Free Plan</div>
            <div style={{ fontSize:12.5, color:C.muted, marginTop:3 }}>Upgrade for unlimited staff, insurance dashboard & Audit Ready</div>
          </div>
          <button className="btn">Upgrade to Pro — $29/mo</button>
        </div>
      </div>

      <div className="fsec">
        <div className="ftit" style={{ color:C.red }}>Danger Zone</div>
        {/* Storage status */}
        {(() => {
          try {
            const keys = ["mise_revenue","mise_expenses","mise_employees","mise_timesheets","mise_roster","mise_insurance","mise_leave","mise_ias","mise_bashistory","mise_documents","mise_inventory","mise_dayworkers"];
            const stored = keys.filter(k => localStorage.getItem(k));
            const totalBytes = keys.reduce((s,k) => s + (localStorage.getItem(k)||"").length, 0);
            const kb = (totalBytes/1024).toFixed(1);
            if(stored.length > 0) return (
              <div style={{ background:"rgba(5,150,105,.06)", border:`1px solid rgba(5,150,105,.2)`, borderRadius:9, padding:"10px 14px", marginBottom:14, fontSize:12 }}>
                <span style={{ color:C.green, fontWeight:700 }}>✅ Data saved locally</span>
                <span style={{ color:C.muted, marginLeft:10 }}>{stored.length} datasets · ~{kb} KB stored in browser</span>
              </div>
            );
          } catch {}
          return null;
        })()}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontWeight:600 }}>Reset all data to demo</div>
            <div style={{ fontSize:12.5, color:C.muted, marginTop:3 }}>Clears all saved revenue, expenses, staff and timesheets — reloads with sample data. Cannot be undone.</div>
          </div>
          <button className="btn-r" style={{ padding:"8px 16px", fontSize:13 }} onClick={() => {
            if (!window.confirm("This will delete ALL your data and reset to demo. Are you sure?")) return;
            const keys = ["mise_revenue","mise_expenses","mise_employees","mise_timesheets","mise_roster","mise_insurance","mise_leave","mise_ias","mise_bashistory","mise_documents","mise_inventory","mise_dayworkers","mise_biz_name","mise_biz_abn","mise_industry"];
            keys.forEach(k => localStorage.removeItem(k));
            showToast("Data reset — reloading…");
            setTimeout(() => window.location.reload(), 1200);
          }}>Reset Data</button>
        </div>
      </div>
      </>)}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  PRINT PREVIEW MODAL
// ════════════════════════════════════════════════════════════
function PrintModal({ title, children, onExport, onClose }) {
  const [status, setStatus] = useState("idle"); // idle | busy | done | error
  const safeTitle = (title || "mise-export").replace(/[^a-z0-9\-_ ]/gi,"").replace(/\s+/g,"-").toLowerCase();
  const filename  = `${safeTitle}-${todayStr}.pdf`;

  const handleExport = () => {
    if (status === "busy") return;
    setStatus("busy");
    try {
      const pdf = onExport();           // returns MiniPDF instance
      pdfDownload(pdf, filename);       // Blob + createObjectURL — no CSP issues
      setStatus("done");
      setTimeout(() => setStatus("idle"), 3000);
    } catch(err) {
      console.error("PDF export:", err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const btnLabel = { idle:"⬇️ Download PDF", busy:"⏳ Generating…", done:"✅ Downloaded!", error:"❌ Try again" }[status];
  const btnBg    = { idle:C.accent, busy:C.accent, done:"#16A34A", error:"#DC2626" }[status];

  return (
    <div className="pp-modal">
      <div style={{ position:"fixed", top:12, right:12, display:"flex", gap:8, zIndex:302 }}>
        {onExport && (
          <button onClick={handleExport} disabled={status==="busy"}
            style={{ background:btnBg, color:"#0C0F0D", border:"none", borderRadius:8,
              padding:"8px 16px", fontSize:13, fontWeight:700, cursor:status==="busy"?"wait":"pointer",
              fontFamily:"'DM Sans',sans-serif", display:"flex", alignItems:"center", gap:6 }}>
            {status==="busy" && <span style={{ width:11,height:11,border:"2px solid #0C0F0D",borderTopColor:"transparent",borderRadius:"50%",display:"inline-block",animation:"spin .7s linear infinite" }}/>}
            {btnLabel}
          </button>
        )}
        <button onClick={onClose}
          style={{ background:"#fff", border:"1px solid #E5E7EB", borderRadius:8, padding:"8px 14px",
            fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>
          ✕ Close
        </button>
      </div>
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
        <div className="pp-logo-box">M</div>
        <div>
          <div style={{ fontSize:15, fontWeight:700, letterSpacing:"-.3px" }}>Mise</div>
          <div style={{ fontSize:10, color:"#6B7280" }}>HOSPITALITY FINANCE</div>
        </div>
      </div>
      <div style={{ textAlign:"center", flex:1 }}>
        <div className="pp-title">{subtitle}</div>
        <div className="pp-name">{title}</div>
      </div>
      <div className="pp-meta">
        <div><strong>My Business</strong></div>
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
      <strong>⚠️ Important Disclaimer:</strong> This document is a <strong>management summary only</strong> generated by Mise for planning and review purposes. It does <strong>not</strong> constitute a formal BAS lodgment, tax return, or any other document lodged with the ATO. All figures are estimates based on data entered into Mise and have not been independently verified. This summary should be reviewed by a <strong>registered tax agent or accountant</strong> before any lodgment or financial decision is made. Mise accepts no liability for errors, omissions or decisions made based on this summary. For official lodgment obligations, visit <strong>ato.gov.au</strong> or contact your registered tax agent.
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
  const [editDoc,  setEditDoc] = useState(null);
  const [tagF,     setTagF]   = useState({});
  // Camera capture state
  const [photoDoc, setPhotoDoc] = useState(null); // doc just captured — awaiting quick-tag

  const fileRef   = React.useRef();
  const cameraRef = React.useRef();

  const handleFiles = (files, fromCamera = false) => {
    Array.from(files).forEach(f => {
      const reader = new FileReader();
      reader.onload = e => {
        const newDoc = {
          id: Date.now() + Math.random(),
          name: fromCamera ? `photo_${todayStr}_${Date.now()}.jpg` : f.name,
          size: f.size, type: f.type,
          dataUrl: e.target.result,
          cat: "Invoice", supplier: "", emp_id: null,
          quarter: BAS_QUARTERS[0], fy: FIN_YEARS[0],
          gst: true, status: "pending", date: todayStr, notes: "",
          fromCamera: fromCamera,
        };
        setDocuments(p => [...p, newDoc]);
        if (fromCamera) {
          // Show quick-tag modal instead of full tag modal
          setPhotoDoc(newDoc);
        } else {
          setEditDoc(newDoc);
          setTagF({ ...newDoc, gst: "yes" });
        }
      };
      reader.readAsDataURL(f);
    });
    if (!fromCamera) showToast(`${files.length} file${files.length>1?"s":""} uploaded!`);
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

  // Quick-tag: save category + status from photo modal
  const savePhotoTag = (cat, status="pending") => {
    setDocuments(p => p.map(d => d.id === photoDoc.id ? { ...d, cat, status } : d));
    setPhotoDoc(null);
    showToast(`📷 Photo saved as ${cat}`);
  };

  // Quick category options for camera capture
  const QUICK_CATS = [
    { cat:"Invoice",         ico:"🧾", lbl:"Supplier Invoice",  sub:"Food, packaging, supplies" },
    { cat:"Receipt",         ico:"🏧", lbl:"Receipt",           sub:"Cash or card purchase"     },
    { cat:"Bank Statement",  ico:"🏦", lbl:"Bank Statement",    sub:"Monthly statement"         },
    { cat:"Payroll",         ico:"👤", lbl:"Payroll Record",    sub:"Pay run, payslip"          },
    { cat:"Insurance",       ico:"🛡️", lbl:"Insurance",         sub:"Policy, renewal notice"   },
    { cat:"BAS / ATO",       ico:"📋", lbl:"BAS / ATO Notice",  sub:"ATO correspondence"        },
    { cat:"Other",           ico:"📄", lbl:"Other",             sub:"Everything else"           },
  ];

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
      {/* ── Photo quick-tag modal ── */}
      {photoDoc && (
        <div className="overlay" onClick={e => { if(e.target===e.currentTarget){ savePhotoTag("Invoice"); } }}>
          <div className="modal" style={{ maxWidth:420 }}>
            <div className="m-ttl" style={{ fontSize:17 }}>
              📷 Photo captured
              <button className="btn-ic" style={{ fontSize:17 }} onClick={() => { savePhotoTag("Invoice"); }}>✕</button>
            </div>
            <div style={{ fontSize:12.5, color:C.muted, marginBottom:16 }}>What kind of document is this?</div>

            {/* Photo preview thumbnail */}
            {photoDoc.dataUrl && (
              <div style={{ marginBottom:16, borderRadius:10, overflow:"hidden", maxHeight:180, display:"flex", alignItems:"center", justifyContent:"center", background:C.surfaceAlt, border:`1px solid ${C.border}` }}>
                <img src={photoDoc.dataUrl} alt="capture" style={{ maxWidth:"100%", maxHeight:180, objectFit:"contain" }}/>
              </div>
            )}

            {/* Category tiles — big tap targets for mobile */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginBottom:16 }}>
              {QUICK_CATS.map(qc => (
                <button key={qc.cat} onClick={() => savePhotoTag(qc.cat)}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 13px", borderRadius:11, cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                    border:`1.5px solid ${C.border}`, background:C.surfaceAlt, transition:"all .12s" }}
                  onMouseOver={e => e.currentTarget.style.borderColor=C.accent}
                  onMouseOut={e => e.currentTarget.style.borderColor=C.border}>
                  <span style={{ fontSize:22, flexShrink:0 }}>{qc.ico}</span>
                  <div>
                    <div style={{ fontSize:12.5, fontWeight:700, color:C.text, lineHeight:1.2 }}>{qc.lbl}</div>
                    <div style={{ fontSize:10.5, color:C.muted, marginTop:2 }}>{qc.sub}</div>
                  </div>
                </button>
              ))}
            </div>

            <button className="btn-g" style={{ width:"100%", fontSize:12 }}
              onClick={() => { setPhotoDoc(null); setEditDoc(photoDoc); setTagF({...photoDoc, gst:"yes"}); }}>
              Fill in full details instead →
            </button>
          </div>
        </div>
      )}

      {/* ── Full tag/edit modal ── */}
      {editDoc && (
        <div className="overlay" onClick={e => { if (e.target===e.currentTarget) setEditDoc(null); }}>
          <div className="modal" style={{ maxWidth:560 }}>
            <div className="m-ttl">
              {docIcon(editDoc.type)} Tag Document
              <button className="btn-ic" style={{ fontSize:17 }} onClick={() => setEditDoc(null)}>✕</button>
            </div>
            <div className="m-sub" style={{ wordBreak:"break-all" }}>{editDoc.name} · {fmtSize(editDoc.size)}</div>

            {/* Photo preview in full modal */}
            {editDoc.fromCamera && editDoc.dataUrl && (
              <div style={{ marginBottom:14, borderRadius:9, overflow:"hidden", maxHeight:160, display:"flex", alignItems:"center", justifyContent:"center", background:C.surfaceAlt, border:`1px solid ${C.border}` }}>
                <img src={editDoc.dataUrl} alt="capture" style={{ maxWidth:"100%", maxHeight:160, objectFit:"contain" }}/>
              </div>
            )}

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
                  {BAS_QUARTERS.map(q => <option key={q} value={q}>{quarterLabel(q)}</option>)}
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
          {/* Camera button — mobile-first, triggers rear camera */}
          <button className="btn" style={{ background:"rgba(57,211,187,.15)", border:`1px solid rgba(57,211,187,.4)`, color:C.teal }}
            onClick={() => cameraRef.current.click()}>
            📷 Take Photo
          </button>
          <button className="btn" onClick={() => fileRef.current.click()}>+ Upload Files</button>
          <input ref={fileRef}   type="file" multiple accept="image/*,application/pdf,.xlsx,.csv,.docx" style={{ display:"none" }} onChange={e => handleFiles(e.target.files)}/>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={e => { if(e.target.files[0]) handleFiles(e.target.files, true); e.target.value=""; }}/>
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

      {/* Drop zone + camera CTA */}
      <div style={{ marginBottom:16 }}>
        <div className="drop-zone"
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          className={`drop-zone${drag?" drag":""}`}
          onClick={() => fileRef.current.click()}>
          <div className="dz-ico">📂</div>
          <div className="dz-ttl">Drop files here or click to upload</div>
          <div className="dz-sub">Invoices, receipts, bank statements, BAS notices, payroll reports, insurance docs…</div>
        </div>
        {/* Mobile camera shortcut — big tappable area */}
        <button onClick={() => cameraRef.current.click()}
          style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, width:"100%", marginTop:8, padding:"14px", borderRadius:11, cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:700,
            background:"rgba(57,211,187,.08)", border:`1.5px dashed rgba(57,211,187,.5)`, color:C.teal }}>
          <span style={{ fontSize:24 }}>📷</span>
          Take a photo of a receipt or invoice
        </button>
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
        <select className="sel" style={{ width:210 }} value={filterQ} onChange={e => setFilterQ(e.target.value)}>
          <option value="">All Quarters</option>
          {BAS_QUARTERS.map(q => <option key={q} value={q}>{quarterLabel(q)}</option>)}
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
              : filtered.slice().sort((a,b) => (b.date||"").localeCompare(a.date||"")).map(d => {
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
//  MONTHLY IAS PAGE
// ════════════════════════════════════════════════════════════
function IASPage({ timesheets, employees, ias, setIas, showToast, bizName, bizABN }) {
  const [selMonth, setSelMonth] = useState(IAS_MONTHS[0]);
  const [tab,      setTab]      = useState("statement");

  // Find or default adjustment record for selected month
  const adj = ias.find(r => r.month === selMonth) || { month:selMonth, adjustW1:0, adjustW2:0, notes:"", status:"draft", lodgedDate:null };
  const [localAdj, setLocalAdj] = useState(adj);

  // Re-sync localAdj when month changes
  const changeMonth = m => {
    setSelMonth(m);
    const found = ias.find(r => r.month === m) || { month:m, adjustW1:0, adjustW2:0, notes:"", status:"draft", lodgedDate:null };
    setLocalAdj(found);
  };

  const d = buildIASMonthData(timesheets, employees, selMonth);
  const finalW1 = d.autoW1 + (localAdj.adjustW1 || 0);
  const finalW2 = d.autoW2 + (localAdj.adjustW2 || 0);

  const saveAdj = (patch) => {
    const updated = {...localAdj, ...patch};
    setLocalAdj(updated);
    setIas(prev => {
      const exists = prev.find(r => r.month === selMonth);
      if (exists) return prev.map(r => r.month === selMonth ? {...r,...patch} : r);
      return [...prev, {...updated, id: Date.now()}];
    });
  };

  const setStatus = st => {
    const patch = { status: st, lodgedDate: st === "lodged" ? todayStr : localAdj.lodgedDate };
    saveAdj(patch);
    showToast(`IAS ${IAS_STATUS_CFG[st].lbl} for ${fmtIASMonth(selMonth)}`);
  };

  const cfg = IAS_STATUS_CFG[localAdj.status] || IAS_STATUS_CFG.draft;

  const exportPDF = () => {
    const pdf = renderIASPDF({ d, month:selMonth, bizName, bizABN, adjustment:localAdj, status:localAdj.status });
    pdfDownload(pdf, `IAS_${selMonth}_PAYG_${todayStr}.pdf`);
    showToast("PDF downloaded!");
  };

  return (
    <>
      {/* ── Header ── */}
      <div className="hdr">
        <div className="hdr-left">
          <div className="ptitle">📋 Monthly IAS</div>
          <div className="psub">PAYG Withholding — Instalment Activity Statement · Medium withholder</div>
        </div>
        <div className="hdr-right">
          <select className="sel" value={selMonth} onChange={e => changeMonth(e.target.value)} style={{width:160}}>
            {IAS_MONTHS.map(m => <option key={m} value={m}>{fmtIASMonth(m)}</option>)}
          </select>
          <button className="btn" onClick={exportPDF}>⬇️ Export PDF</button>
        </div>
      </div>

      {/* ── ATO info bar ── */}
      <div className="alert al-b" style={{marginBottom:14}}>
        <span className="al-ico">ℹ️</span>
        <div>
          <div className="al-ttl">IAS due: 28 {(() => { const [y,m]=selMonth.split('-').map(Number); return new Date(m===12?y+1:y,m===12?0:m,1).toLocaleDateString('en-AU',{month:'long',year:'numeric'}); })()} · W2 is your payment obligation to ATO</div>
          <div className="al-msg">Medium withholder = $25,000–$1M annual PAYG. Lodge and pay monthly via ATO Business Portal or tax agent. This summary is auto-calculated from your timesheets — review and adjust before lodging.</div>
        </div>
      </div>

      {/* ── Status banner ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:cfg.bg,border:`1px solid ${cfg.border}`,borderRadius:10,padding:"12px 18px",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontWeight:700,fontSize:13,color:cfg.col}}>● {cfg.lbl}</div>
          <div style={{fontSize:12,color:"#6B7280"}}>{fmtIASMonth(selMonth)}</div>
          {localAdj.lodgedDate && <div style={{fontSize:11,color:"#059669"}}>Lodged {localAdj.lodgedDate}</div>}
        </div>
        <div style={{display:"flex",gap:6}}>
          {localAdj.status === "draft"     && <button className="btn-b" onClick={() => setStatus("finalised")}>Mark as Finalised</button>}
          {localAdj.status === "finalised" && <><button className="btn-b" onClick={() => setStatus("draft")}>Back to Draft</button><button className="btn" onClick={() => setStatus("lodged")}>Mark as Lodged ✓</button></>}
          {localAdj.status === "lodged"    && <button className="btn-b" onClick={() => setStatus("draft")}>Re-open</button>}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="g4" style={{marginBottom:16}}>
        {[
          {lbl:"W1 — Gross Wages",      val:money(finalW1),      cls:""},
          {lbl:"W2 — PAYG to ATO",      val:money(finalW2),      cls:"y"},
          {lbl:"Super (informational)", val:money(d.autoSuper),  cls:"b"},
          {lbl:"Due Date",              val:d.dueDate,           cls:localAdj.status==="lodged"?"g":"r"},
        ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        {[["statement","📄 Statement"],["adjustments","✏️ Adjustments"],["settings","🏢 Business Details"],["history","📅 History"]].map(([id,lbl]) => (
          <div key={id} className={`tab${tab===id?" on-a":""}`} onClick={() => setTab(id)}>{lbl}</div>
        ))}
      </div>

      {/* ── STATEMENT TAB ── */}
      {tab === "statement" && (
        <>
          {d.weekCount === 0 && (
            <div className="alert al-y">
              <span className="al-ico">⚠️</span>
              <div><div className="al-ttl">No timesheet data for {fmtIASMonth(selMonth)}</div>
              <div className="al-msg">Log timesheets under Staff & Wages → Timesheets to populate this IAS automatically. You can still add manual adjustments.</div></div>
            </div>
          )}
          {d.noTFNCount > 0 && (
            <div className="alert al-r">
              <span className="al-ico">⚠️</span>
              <div><div className="al-ttl">{d.noTFNCount} employee(s) without TFN — withholding at 47%</div>
              <div className="al-msg">Obtain TFN declarations immediately. 47% withholding rate applies until TFN is provided.</div></div>
            </div>
          )}

          {/* W fields */}
          <div className="g2" style={{marginBottom:14}}>
            <div className="bc" style={{border:`2px solid #BBF7D0`,background:"#F0FDF4"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:24,fontWeight:900,color:"#16A34A",lineHeight:1}}>W1</div>
                  <div style={{fontSize:11,color:"#374151",marginTop:4}}>Total gross salaries, wages &amp; other payments</div>
                  <div style={{fontSize:10,color:"#6B7280",marginTop:3}}>Auto: {money(d.autoW1)}{localAdj.adjustW1 ? ` + adj: ${money(localAdj.adjustW1)}` : ""}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div className="mono" style={{fontSize:22,fontWeight:800,color:"#111111"}}>{money(finalW1)}</div>
                  <div style={{fontSize:10,color:"#6B7280",marginTop:2}}>{d.weekCount} week{d.weekCount!==1?"s":""} · {d.empData.length} employee{d.empData.length!==1?"s":""}</div>
                </div>
              </div>
            </div>
            <div className="bc" style={{border:`2px solid #FED7AA`,background:"#FFF7ED"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:24,fontWeight:900,color:"#EA580C",lineHeight:1}}>W2</div>
                  <div style={{fontSize:11,color:"#374151",marginTop:4}}>PAYG withheld from salaries &amp; wages</div>
                  <div style={{fontSize:10,color:"#6B7280",marginTop:3}}>Auto: {money(d.autoW2)}{localAdj.adjustW2 ? ` + adj: ${money(localAdj.adjustW2)}` : ""}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div className="mono" style={{fontSize:22,fontWeight:800,color:"#111111"}}>{money(finalW2)}</div>
                  <div style={{fontSize:10,color:"#EA580C",fontWeight:600,marginTop:2}}>← Pay this to ATO</div>
                </div>
              </div>
            </div>
          </div>

          {/* Total due box */}
          <div className="bc" style={{background:"#111827",border:"none",marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{color:"#9CA3AF",fontSize:11}}>NET W2 PAYABLE TO ATO</div>
                <div style={{color:"#D1D5DB",fontSize:10,marginTop:3}}>{fmtIASMonth(selMonth)} · Due {d.dueDate}</div>
              </div>
              <div className="mono" style={{fontSize:26,fontWeight:800,color:"#FBBF24"}}>{money(finalW2)}</div>
            </div>
          </div>

          {/* Per-employee table */}
          {d.empData.length > 0 && (
            <div className="bc">
              <div className="bctit">Employee PAYG Breakdown — {fmtIASMonth(selMonth)}</div>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{textAlign:"left"}}>Employee</th>
                    <th>Role</th>
                    <th>Type</th>
                    <th style={{textAlign:"center"}}>Weeks</th>
                    <th style={{textAlign:"right"}}>W1 Gross</th>
                    <th style={{textAlign:"right"}}>W2 PAYG</th>
                    <th style={{textAlign:"right"}}>Super (info)</th>
                    <th style={{textAlign:"right"}}>Eff. Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {d.empData.map(({emp,weeks,gross,payg,super:sup,noTFN}) => (
                    <tr key={emp.id}>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:7}}>
                          <div style={{width:22,height:22,borderRadius:"50%",background:avatarBg(emp.id, emp.color),display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff",flexShrink:0}}>{initials(emp.name)}</div>
                          <span style={{fontWeight:600,fontSize:12}}>{emp.name}</span>
                          {noTFN && <span className="pill pl-r" style={{fontSize:9}}>No TFN</span>}
                        </div>
                      </td>
                      <td style={{color:"#6B7280",fontSize:11}}>{emp.role}</td>
                      <td><span className={`pill ${emp.type==="casual"?"pl-y":emp.type==="part-time"?"pl-b":"pl-g"}`}>{emp.type}</span></td>
                      <td style={{textAlign:"center"}}>{weeks}</td>
                      <td className="mono" style={{textAlign:"right",fontWeight:600}}>{money(gross)}</td>
                      <td className="mono" style={{textAlign:"right",color:noTFN?"#DC2626":"#EA580C",fontWeight:600}}>{money(payg)}{noTFN && <span style={{fontSize:9,marginLeft:3}}>(47%)</span>}</td>
                      <td className="mono" style={{textAlign:"right",color:"#2563EB"}}>{money(sup)}</td>
                      <td className="mono" style={{textAlign:"right",color:"#6B7280"}}>{money(effRate(emp))}/hr</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={4} style={{textAlign:"left"}}>AUTO-CALCULATED TOTAL</th>
                    <th className="mono" style={{textAlign:"right"}}>{money(d.autoW1)}</th>
                    <th className="mono" style={{textAlign:"right",color:"#EA580C"}}>{money(d.autoW2)}</th>
                    <th className="mono" style={{textAlign:"right",color:"#2563EB"}}>{money(d.autoSuper)}</th>
                    <th></th>
                  </tr>
                  {(localAdj.adjustW1 || localAdj.adjustW2) && (
                    <tr style={{background:"#F0FDF4"}}>
                      <th colSpan={4} style={{textAlign:"left",color:"#16A34A"}}>+ MANUAL ADJUSTMENTS</th>
                      <th className="mono" style={{textAlign:"right",color:"#16A34A"}}>{localAdj.adjustW1 ? `+ ${money(localAdj.adjustW1)}` : "—"}</th>
                      <th className="mono" style={{textAlign:"right",color:"#16A34A"}}>{localAdj.adjustW2 ? `+ ${money(localAdj.adjustW2)}` : "—"}</th>
                      <th colSpan={2}></th>
                    </tr>
                  )}
                  <tr style={{background:"#111827"}}>
                    <th colSpan={4} style={{textAlign:"left",color:"#fff"}}>FINAL W1 / W2</th>
                    <th className="mono" style={{textAlign:"right",color:"#86EFAC"}}>{money(finalW1)}</th>
                    <th className="mono" style={{textAlign:"right",color:"#FDE68A"}}>{money(finalW2)}</th>
                    <th colSpan={2}></th>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div style={{fontSize:10.5,color:"#9CA3AF",marginTop:12,lineHeight:1.6,padding:"10px 0",borderTop:`1px solid #E5E7EB`}}>
            💡 <strong>PAYG calculation:</strong> ATO 2024-25 progressive Scale 2 rates (resident, tax-free threshold). Employees without TFN withheld at 47% flat. Super is <em>informational only</em> — it's not an IAS obligation but is due quarterly to super funds. Figures are estimates — verify with your registered tax agent before lodging.
          </div>
        </>
      )}

      {/* ── ADJUSTMENTS TAB ── */}
      {tab === "adjustments" && (
        <div className="bc">
          <div className="bctit">✏️ Manual Adjustments — {fmtIASMonth(selMonth)}</div>
          <div className="alert al-b" style={{marginBottom:14}}>
            <span className="al-ico">ℹ️</span>
            <div><div className="al-msg">Use adjustments to add wages <strong>not captured in timesheets</strong> — e.g. cash payments, contractor PAYG, corrections from prior periods. Adjustments are added on top of auto-calculated figures.</div></div>
          </div>
          <div className="frow2" style={{marginBottom:14}}>
            <div className="fg">
              <label className="flbl">Additional W1 Gross ($)</label>
              <input type="number" className="inp" min={0} step={0.01}
                value={localAdj.adjustW1 || ""}
                onChange={e => saveAdj({adjustW1: parseFloat(e.target.value)||0})}
                placeholder="0.00"/>
              <div style={{fontSize:10,color:"#9CA3AF",marginTop:4}}>Extra gross wages not in timesheets</div>
            </div>
            <div className="fg">
              <label className="flbl">Additional W2 PAYG ($)</label>
              <input type="number" className="inp" min={0} step={0.01}
                value={localAdj.adjustW2 || ""}
                onChange={e => saveAdj({adjustW2: parseFloat(e.target.value)||0})}
                placeholder="0.00"/>
              <div style={{fontSize:10,color:"#9CA3AF",marginTop:4}}>Extra PAYG withheld on those wages</div>
            </div>
          </div>
          <div className="fg" style={{marginBottom:14}}>
            <label className="flbl">Notes / Reason for Adjustment</label>
            <textarea className="inp" rows={4} style={{resize:"vertical"}}
              value={localAdj.notes || ""}
              onChange={e => saveAdj({notes: e.target.value})}
              placeholder="e.g. Included $500 cash wages for kitchen hand + 47% PAYG ($235) — no TFN on file."/>
          </div>
          {/* Live preview */}
          <div style={{background:"#F9FAFB",border:"1px solid #E5E7EB",borderRadius:9,padding:"14px 16px"}}>
            <div style={{fontWeight:700,fontSize:12,marginBottom:10}}>Preview after adjustments</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[
                {lbl:"W1 Auto",   val:money(d.autoW1),        cls:""},
                {lbl:"W2 Auto",   val:money(d.autoW2),        cls:""},
                {lbl:"W1 Adj",    val:`+ ${money(localAdj.adjustW1||0)}`, cls:"g"},
                {lbl:"W2 Adj",    val:`+ ${money(localAdj.adjustW2||0)}`, cls:"g"},
                {lbl:"W1 FINAL",  val:money(finalW1),         cls:"b"},
                {lbl:"W2 FINAL",  val:money(finalW2),         cls:"y"},
              ].map((c,i) => (
                <div key={i} className="card" style={{padding:"8px 12px"}}>
                  <div className="clbl">{c.lbl}</div>
                  <div className={`cval ${c.cls}`} style={{fontSize:16}}>{c.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── BUSINESS DETAILS TAB ── */}
      {tab === "settings" && (
        <div className="bc">
          <div className="bctit">🏢 Business Details for IAS PDF</div>
          <div className="frow2">
            <div className="fg">
              <label className="flbl">Business / Trading Name</label>
              <input className="inp" value={bizName} onChange={e => setBizName(e.target.value)} placeholder="My Restaurant Pty Ltd"/>
            </div>
            <div className="fg">
              <label className="flbl">ABN</label>
              <input className="inp" value={bizABN} onChange={e => setBizABN(e.target.value)} placeholder="12 345 678 901"/>
            </div>
          </div>
          <div style={{fontSize:11,color:"#9CA3AF",marginTop:8}}>These details appear on your exported IAS PDF. They are not saved between sessions — set them in Settings for persistence.</div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <div className="bc">
          <div className="bctit">📅 IAS History — Last 18 Months</div>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{textAlign:"left"}}>Month</th>
                <th style={{textAlign:"right"}}>W1 Gross</th>
                <th style={{textAlign:"right"}}>W2 PAYG</th>
                <th style={{textAlign:"right"}}>Employees</th>
                <th style={{textAlign:"center"}}>Status</th>
                <th style={{textAlign:"center"}}>Lodged Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {IAS_MONTHS.map(m => {
                const md   = buildIASMonthData(timesheets, employees, m);
                const mrec = ias.find(r => r.month === m);
                const st   = mrec?.status || "draft";
                const scfg = IAS_STATUS_CFG[st];
                const fw1  = md.autoW1 + (mrec?.adjustW1 || 0);
                const fw2  = md.autoW2 + (mrec?.adjustW2 || 0);
                const hasData = md.weekCount > 0 || (mrec && (mrec.adjustW1||mrec.adjustW2));
                return (
                  <tr key={m} style={{opacity: hasData ? 1 : 0.4}}>
                    <td style={{fontWeight: m===selMonth ? 700 : 400}}>{fmtIASMonth(m)}{m===selMonth && <span style={{marginLeft:6,fontSize:10,color:"#2563EB"}}>← current</span>}</td>
                    <td className="mono" style={{textAlign:"right"}}>{hasData ? money(fw1) : "—"}</td>
                    <td className="mono" style={{textAlign:"right",color:"#EA580C"}}>{hasData ? money(fw2) : "—"}</td>
                    <td style={{textAlign:"right"}}>{hasData ? md.empData.length : "—"}</td>
                    <td style={{textAlign:"center"}}>
                      <span style={{background:scfg.bg,border:`1px solid ${scfg.border}`,color:scfg.col,borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:600}}>
                        {scfg.lbl}
                      </span>
                    </td>
                    <td style={{textAlign:"center",fontSize:11,color:"#6B7280"}}>{mrec?.lodgedDate || "—"}</td>
                    <td>
                      <button className="btn-b" style={{fontSize:10,padding:"3px 8px"}} onClick={() => changeMonth(m) || setTab("statement")}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  BAS SUMMARY GENERATOR PAGE
// ════════════════════════════════════════════════════════════
function BASSummaryPage({ revenue, expenses, timesheets, employees, insurance, documents, basHistory, setBasHistory, showToast, bizName, bizABN, ias = [] }) {
  const [selQ,    setSelQ]    = useState(BAS_QUARTERS[0]);
  const [print,   setPrint]   = useState(false);
  const [tab,     setTab]     = useState("summary"); // "summary" | "history"
  const [editNotes, setEditNotes] = useState(""); // notes when saving
  const [editAgent, setEditAgent] = useState(""); // reviewed-by field

  const d = buildBASData(revenue, expenses, timesheets, employees, insurance, documents, selQ, ias);

  // ── History helpers ────────────────────────────────────────
  const STATUS_CFG = {
    draft:     { lbl:"Draft",     col:"#D97706", bg:"rgba(217,119,6,.1)",   border:"rgba(217,119,6,.3)"   },
    finalised: { lbl:"Finalised", col:"#2563EB", bg:"rgba(37,99,235,.1)",   border:"rgba(37,99,235,.3)"   },
    lodged:    { lbl:"Lodged ✓",  col:"#059669", bg:"rgba(5,150,105,.1)",   border:"rgba(5,150,105,.3)"   },
  };

  const existingEntry = basHistory.find(h => h.quarter === selQ);

  const saveToHistory = () => {
    const entry = {
      id:          existingEntry?.id || Date.now(),
      quarter:     selQ,
      status:      existingEntry?.status || "draft",
      savedDate:   todayStr,
      reviewedBy:  editAgent || existingEntry?.reviewedBy || "",
      reviewedAt:  editAgent ? todayStr : existingEntry?.reviewedAt || null,
      lodgedDate:  existingEntry?.lodgedDate || null,
      lodgedBy:    existingEntry?.lodgedBy || "",
      notes:       editNotes || existingEntry?.notes || "",
      // Full figure snapshot — accountant-ready
      totalRev:    d.totalRev,
      gstColl:     d.gstColl,
      gstCreds:    d.gstCreds,
      netGST:      d.netGST,
      totalPayg:   d.totalPayg,
      totalSuper:  d.totalSuper,
      totalWages:  d.totalWages,
      estBAS:      d.estBAS,
    };
    setBasHistory(p => existingEntry
      ? p.map(h => h.id === existingEntry.id ? entry : h)
      : [entry, ...p]
    );
    setEditNotes(""); setEditAgent("");
    showToast(`BAS ${selQ} saved to history!`);
  };

  const updateStatus = (id, status) => {
    setBasHistory(p => p.map(h => h.id === id
      ? {
          ...h, status,
          lodgedDate: status === "lodged" ? todayStr : h.lodgedDate,
          lodgedBy:   status === "lodged" ? (h.lodgedBy || "") : h.lodgedBy,
        }
      : h
    ));
    showToast(`Status updated to ${STATUS_CFG[status].lbl}`);
  };

  const deleteEntry = id => {
    setBasHistory(p => p.filter(h => h.id !== id));
    showToast("BAS history entry removed.");
  };

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
          <div className="pp-row"><span className="pp-lbl">Total Sales incl. GST (G1)</span><span className="pp-val">{money(d.totalRev)}</span></div>
          <div className="pp-row"><span className="pp-lbl">GST on Sales ÷11 (1A)</span><span className="pp-val">{money(d.gstColl)}</span></div>
          <div className="pp-row"><span className="pp-lbl">GST Credits on Purchases (1B)</span><span className="pp-val">− {money(d.gstCreds)}</span></div>
          <div className="pp-tot"><span>Net GST Payable (1A − 1B)</span><span className="pp-tot-v">{money(d.netGST)}</span></div>
        </div>
        <div className="pp-sec" style={{ marginBottom:0 }}>
          <div className="pp-sec-ttl">Wages & PAYG</div>
          <div className="pp-row"><span className="pp-lbl">Total Salary & Wages (W1)</span><span className="pp-val">{money(d.totalWages)}</span></div>
          <div className="pp-row"><span className="pp-lbl">PAYG Withheld (W2)</span><span className="pp-val">{money(d.totalPayg)}</span></div>
          {d.iasPrePaidPAYG > 0 && <div className="pp-row" style={{color:"#059669"}}><span className="pp-lbl">Less: Pre-paid via Monthly IAS</span><span className="pp-val">− {money(d.iasPrePaidPAYG)}</span></div>}
          <div className="pp-row"><span className="pp-lbl">Super (SGC — OTE basis)</span><span className="pp-val">{money(d.totalSuper)}</span></div>
          <div className="pp-tot"><span>Total Employment Cost</span><span className="pp-tot-v">{money(d.totalWages+d.totalPayg+d.totalSuper)}</span></div>
        </div>
      </div>
      <div className="pp-sec">
        <div className="pp-sec-ttl">BAS Estimate Summary</div>
        <div className="pp-row"><span className="pp-lbl">Net GST Payable (1A − 1B)</span><span className="pp-val">{money(d.netGST)}</span></div>
        <div className="pp-row"><span className="pp-lbl">PAYG Withholding (W2)</span><span className="pp-val">{money(d.totalPayg)}</span></div>
        {d.iasPrePaidPAYG > 0 && <div className="pp-row" style={{color:"#059669"}}><span className="pp-lbl">Less: Pre-paid via Monthly IAS</span><span className="pp-val">− {money(d.iasPrePaidPAYG)}</span></div>}
        {d.iasPrePaidPAYG > 0 && <div className="pp-row"><span className="pp-lbl">PAYG remaining for BAS</span><span className="pp-val">{money(d.basPayg)}</span></div>}
        <div className="pp-tot"><span>Estimated Total BAS Obligation</span><span className="pp-tot-v">{money(d.estBAS)}</span></div>
      </div>
      <PPDisclaimer/>
    </div>
  );

  return (
    <>
      {print && <PrintModal title="BAS Support Summary" onClose={() => setPrint(false)}
        onExport={() => renderBASSummaryPDF({d, quarter:selQ})}><PrintContent/></PrintModal>}

      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">📋 BAS Summary</div><div className="psub">Quarterly BAS support summary — for review before lodgment</div></div>
        <div className="hdr-right">
          <select className="sel" value={selQ} onChange={e => setSelQ(e.target.value)} style={{ width:210 }}>
            {BAS_QUARTERS.map(q => <option key={q} value={q}>{quarterLabel(q)}</option>)}
          </select>
          <button className="btn-b" onClick={() => setPrint(true)}>⬇️ Export PDF</button>
          <button className="btn" onClick={saveToHistory}>
            {existingEntry ? "💾 Update History" : "💾 Save to History"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:16, borderBottom:`1px solid ${C.border}`, paddingBottom:0 }}>
        {[["summary","📊 Summary"],["history","🕐 History"]].map(([id,lbl]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding:"8px 16px", fontSize:12, fontWeight:600, fontFamily:"inherit", cursor:"pointer", border:"none", borderBottom: tab===id ? `2px solid ${C.accent}` : "2px solid transparent", background:"none", color: tab===id ? C.accent : C.muted, transition:"all .15s" }}>
            {lbl}
            {id==="history" && basHistory.length>0 && (
              <span style={{ marginLeft:6, background:C.accent, color:"#000", borderRadius:10, padding:"1px 7px", fontSize:10 }}>{basHistory.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── SUMMARY TAB ── */}
      {tab === "summary" && (
        <>
          {d.warnings.length > 0 && d.warnings.map((w,i) => (
            <div key={i} className="alert al-y"><span className="al-ico">⚠️</span><div><div className="al-msg">{w}</div></div></div>
          ))}

          {/* Status badge if already in history */}
          {existingEntry && (() => {
            const sc = STATUS_CFG[existingEntry.status];
            return (
              <div style={{ background:sc.bg, border:`1px solid ${sc.border}`, borderRadius:9, padding:"9px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:11, fontWeight:700, color:sc.col }}>{sc.lbl}</span>
                <span style={{ fontSize:11, color:C.muted }}>Saved {existingEntry.savedDate}{existingEntry.lodgedDate ? ` · Lodged ${existingEntry.lodgedDate}` : ""}</span>
                {existingEntry.notes && <span style={{ fontSize:11, color:C.muted, fontStyle:"italic" }}>· {existingEntry.notes}</span>}
              </div>
            );
          })()}

          <div className="g4">
            {[
              { lbl:"Total Sales",         val:money(d.totalRev),   cls:"b" },
              { lbl:"Net GST Payable",     val:money(d.netGST),     cls:"y" },
              { lbl:"PAYG Withheld",       val:money(d.totalPayg),  cls:""  },
              { lbl:"Est. BAS Obligation", val:money(d.estBAS),     cls:"r" },
            ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
          </div>

          <div className="g2">
            <div className="bc">
              <div className="bctit">GST Position</div>
              <div className="bas-row"><span className="bas-lbl">Total Sales (incl. GST) <span style={{color:C.dim,fontSize:10}}>(G1)</span></span><span className="bas-val">{money(d.totalRev)}</span></div>
              <div className="bas-row"><span className="bas-lbl">GST on Sales (÷11) <span style={{color:C.dim,fontSize:10}}>(1A)</span></span><span className="bas-val" style={{ color:C.red }}>{money(d.gstColl)}</span></div>
              <div className="bas-row"><span className="bas-lbl">GST Credits on Purchases <span style={{color:C.dim,fontSize:10}}>(1B)</span></span><span className="bas-val" style={{ color:C.green }}>− {money(d.gstCreds)}</span></div>
              <div className="bas-tot"><span className="bas-tot-lbl">Net GST Payable <span style={{color:C.dim,fontSize:10,fontWeight:400}}>(1A − 1B)</span></span><span className="bas-tot-val">{money(d.netGST)}</span></div>
            </div>
            <div className="bc">
              <div className="bctit">Wages & Employment</div>
              <div className="bas-row"><span className="bas-lbl">Total Gross Wages <span style={{color:C.dim,fontSize:10}}>(W1)</span></span><span className="bas-val">{money(d.totalWages)}</span></div>
              <div className="bas-row"><span className="bas-lbl">PAYG Withheld (ATO Scale 2) <span style={{color:C.dim,fontSize:10}}>(W2)</span></span><span className="bas-val" style={{ color:C.yellow }}>{money(d.totalPayg)}</span></div>
              {d.iasPrePaidPAYG > 0 && (
                <div className="bas-row"><span className="bas-lbl" style={{color:C.green}}>Less: Pre-paid via Monthly IAS</span><span className="bas-val" style={{color:C.green}}>− {money(d.iasPrePaidPAYG)}</span></div>
              )}
              <div className="bas-row"><span className="bas-lbl">Super (SGC — OTE basis)</span><span className="bas-val" style={{ color:C.blue }}>{money(d.totalSuper)}</span></div>
              <div className="bas-row"><span className="bas-lbl">Quarterly Insurance</span><span className="bas-val" style={{ color:C.purple }}>{money(d.totalIns)}</span></div>
              <div className="bas-tot"><span className="bas-tot-lbl">Total Employment Cost</span><span className="bas-tot-val">{money(d.totalWages+d.totalPayg+d.totalSuper)}</span></div>
            </div>
          </div>

          <div className="bc">
            <div className="bctit">📄 Supporting Documents — {selQ}</div>
            <div className="g4">
              {[
                { lbl:"Verified Docs",        val:d.verifiedDocs, cls:"g" },
                { lbl:"Pending Review",       val:d.pendingDocs,  cls:d.pendingDocs?"y":"g" },
                { lbl:"Missing Docs",         val:d.missingDocs,  cls:d.missingDocs?"r":"g" },
                { lbl:"Missing Tax Invoices", val:d.missingInv,   cls:d.missingInv?"r":"g" },
              ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
            </div>
          </div>

          <div className="bc">
            <div className="bctit">💰 Estimated BAS — {selQ}</div>
            <div className="bas-row"><span className="bas-lbl">Net GST Payable <span style={{color:C.dim,fontSize:10}}>(1A−1B)</span></span><span className="bas-val">{money(d.netGST)}</span></div>
            <div className="bas-row"><span className="bas-lbl">PAYG Withholding (total) <span style={{color:C.dim,fontSize:10}}>(W2)</span></span><span className="bas-val">{money(d.totalPayg)}</span></div>
            {d.iasPrePaidPAYG > 0 && (
              <div className="bas-row"><span className="bas-lbl" style={{color:C.green}}>Less: Pre-paid via Monthly IAS</span><span className="bas-val" style={{color:C.green}}>− {money(d.iasPrePaidPAYG)}</span></div>
            )}
            {d.iasPrePaidPAYG > 0 && (
              <div className="bas-row"><span className="bas-lbl">PAYG remaining for BAS</span><span className="bas-val">{money(d.basPayg)}</span></div>
            )}
            <div className="bas-tot"><span className="bas-tot-lbl">Estimated Total BAS</span><span className="bas-tot-val">{money(d.estBAS)}</span></div>

            {/* Save to history form */}
            <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".6px", marginBottom:10 }}>Save to BAS History</div>
              <div className="frow2" style={{ marginBottom:10 }}>
                <div className="fg">
                  <label className="flbl">Reviewed by (tax agent / accountant)</label>
                  <input className="inp" placeholder="e.g. Smith & Co Accountants"
                    value={editAgent} onChange={e => setEditAgent(e.target.value)}/>
                </div>
                <div className="fg">
                  <label className="flbl">Notes</label>
                  <input className="inp" placeholder="e.g. Lodged via ATO business portal"
                    value={editNotes} onChange={e => setEditNotes(e.target.value)}/>
                </div>
              </div>
              <button className="btn" onClick={saveToHistory}>
                {existingEntry ? "💾 Update History" : "💾 Save to History"}
              </button>
            </div>

            <div className="disc" style={{ marginTop:12 }}>
              <div className="d-ttl">⚠️ Disclaimer</div>
              <div className="d-txt">This is an estimate for management planning purposes only. It does not constitute a lodged BAS. Review with a registered tax agent before lodging with the ATO.</div>
            </div>
          </div>
        </>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <div className="bc">
          <div className="bctit">BAS History
            <span style={{ fontSize:11, fontWeight:400, color:C.muted, marginLeft:8 }}>{basHistory.length} quarter{basHistory.length!==1?"s":""} recorded</span>
          </div>

          {basHistory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-txt">No BAS history yet.</div>
              <div style={{ fontSize:12, color:C.dim, marginTop:6 }}>Go to the Summary tab, review a quarter, then click "Save to History".</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {[...basHistory].sort((a,b) => BAS_QUARTERS.indexOf(a.quarter) - BAS_QUARTERS.indexOf(b.quarter)).map(h => {
                const sc = STATUS_CFG[h.status] || STATUS_CFG.draft;
                return (
                  <div key={h.id} style={{ border:`1px solid ${sc.border}`, borderLeft:`4px solid ${sc.col}`, borderRadius:10, padding:"14px 16px", background:sc.bg }}>
                    {/* Header row */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:12 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <span style={{ fontWeight:800, fontSize:15 }}>{h.quarter}</span>
                        <select value={h.status} onChange={e => updateStatus(h.id, e.target.value)}
                          style={{ background:sc.bg, color:sc.col, border:`1px solid ${sc.border}`, borderRadius:6, padding:"3px 8px", fontSize:11, fontWeight:700, fontFamily:"inherit", cursor:"pointer" }}>
                          <option value="draft">Draft</option>
                          <option value="finalised">Finalised</option>
                          <option value="lodged">Lodged ✓</option>
                        </select>
                      </div>
                      <div style={{ display:"flex", gap:6 }}>
                        <button className="btn-ic" title="View quarter" onClick={() => { setSelQ(h.quarter); setTab("summary"); }}>👁️</button>
                        <button className="btn-ic" title="Delete" onClick={() => deleteEntry(h.id)}>🗑️</button>
                      </div>
                    </div>

                    {/* Figure snapshot — 5 columns */}
                    <div style={{ display:"flex", gap:0, marginBottom:12, borderRadius:8, overflow:"hidden", border:`1px solid ${C.border}` }}>
                      {[
                        { lbl:"Total Sales",  val:money(h.totalRev  || 0) },
                        { lbl:"Net GST",      val:money(h.netGST    || 0) },
                        { lbl:"PAYG",         val:money(h.totalPayg || 0) },
                        { lbl:"Super (SGC)",  val:money(h.totalSuper|| 0) },
                        { lbl:"Est. BAS",     val:money(h.estBAS    || 0), highlight:true },
                      ].map((s,i) => (
                        <div key={i} style={{ flex:1, padding:"8px 10px", background:s.highlight?"rgba(220,38,38,.06)":C.surface, borderRight:i<4?`1px solid ${C.border}`:"none" }}>
                          <div style={{ fontSize:9, color:C.dim, textTransform:"uppercase", letterSpacing:".5px", marginBottom:3 }}>{s.lbl}</div>
                          <div className="mono" style={{ fontSize:12, fontWeight:700, color:s.highlight?C.red:C.text }}>{s.val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Audit trail row */}
                    <div style={{ display:"flex", gap:16, flexWrap:"wrap", fontSize:11, color:C.muted }}>
                      <span>💾 Saved {h.savedDate}</span>
                      {h.reviewedBy && <span>👤 Reviewed by <strong style={{ color:C.text }}>{h.reviewedBy}</strong>{h.reviewedAt ? ` on ${h.reviewedAt}` : ""}</span>}
                      {h.lodgedDate && <span>✅ Lodged {h.lodgedDate}{h.lodgedBy ? ` by ${h.lodgedBy}` : ""}</span>}
                      {h.notes && <span style={{ fontStyle:"italic" }}>📝 {h.notes}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  ANNUAL ACCOUNTANT PACK PAGE
// ════════════════════════════════════════════════════════════
function ReportsPage({ revenue, expenses, timesheets, employees, insurance, documents, inventory, setInventory, bizName, bizABN }) {
  const [print,   setPrint]   = useState(null);
  const [selQ,    setSelQ]    = useState(BAS_QUARTERS[0]);
  const [selFY,   setSelFY]   = useState(FIN_YEARS[0]);
  const [tab,     setTab]     = useState("pl"); // "pl" | "reports"
  const [plPeriod, setPlPeriod] = useState("quarter"); // "quarter" | "fy"
  const [plQ,     setPlQ]     = useState(BAS_QUARTERS[0]);
  const [plFY,    setPlFY]    = useState(FIN_YEARS[0]);
  const [stockForm, setStockForm] = useState({ quarter: BAS_QUARTERS[0], opening:"", closing:"", notes:"" });

  const bas    = buildBASData(revenue, expenses, timesheets, employees, insurance, documents, selQ);
  const annual = buildAnnualData(revenue, expenses, timesheets, employees, insurance, documents);
  const rows   = annotateTimesheets(employees, timesheets);

  // ── P&L calculation ────────────────────────────────────────
  const [plDateMode, setPlDateMode] = useState("payment"); // "payment" | "invoice"

  const plRange = plPeriod === "quarter"
    ? QUARTER_DATES[plQ] || {}
    : FY_DATES[plFY]     || {};
  const { from: plFrom = "", to: plTo = "9999-99-99" } = plRange;
  const plLabel = plPeriod === "quarter" ? plQ : plFY;

  // Date mode: "payment" uses e.date, "invoice" uses e.invoice_date || e.date (accrual basis)
  const expDateFor = e => plDateMode === "invoice" ? (e.invoice_date || e.date) : e.date;

  const plRev  = revenue.filter(r => inRange(r.date, plFrom, plTo)).reduce((s,r) => s+revTotal(r), 0);
  const plGSTTaxable = revenue.filter(r => inRange(r.date, plFrom, plTo)).reduce((s,r) => s+revGSTTaxable(r), 0);
  const plGST  = plGSTTaxable / 11;
  const plRevExGST = plRev - plGST;

  // COGS = opening stock + purchases in period - closing stock
  const plPurchases = expenses
    .filter(e => inRange(expDateFor(e), plFrom, plTo) && COGS_CATS.has(e.cat))
    .reduce((s,e) => s+e.amount, 0);

  const stockEntry  = inventory.find(i => i.quarter === (plPeriod === "quarter" ? plQ : null));
  const openingStock = stockEntry?.opening || 0;
  const closingStock = stockEntry?.closing || 0;
  const trueCOGS    = openingStock + plPurchases - closingStock;
  const grossProfit = plRevExGST - trueCOGS;
  const grossMargin = plRevExGST > 0 ? (grossProfit / plRevExGST) * 100 : 0;

  // Operating expenses (non-COGS)
  const plOpExp = expenses
    .filter(e => inRange(expDateFor(e), plFrom, plTo) && !COGS_CATS.has(e.cat))
    .reduce((s,e) => s+e.amount, 0);

  // Wages (filter by week date)
  const plTs    = annotateTimesheets(employees, timesheets)
    .filter(t => { const d = weekToDate(t.week); return d && inRange(d, plFrom, plTo); });
  const plWages = plTs.reduce((s,t) => s+t.gross, 0);
  const plSuper = plTs.reduce((s,t) => s+t.super, 0);
  const plInsQ  = insurance.reduce((s,i) => s+i.annual/4, 0);

  const totalOpex    = plOpExp + plWages + plSuper + plInsQ;
  const operatingProfit = grossProfit - totalOpex;
  const operatingMargin = plRevExGST > 0 ? (operatingProfit / plRevExGST) * 100 : 0;

  // Expense breakdown for P&L
  const plExpByCat = EXP_CATEGORIES.map(cat => ({
    cat,
    cfg: CAT_CONFIG[cat],
    amount: expenses.filter(e => inRange(e.date, plFrom, plTo) && e.cat === cat).reduce((s,e)=>s+e.amount,0),
    isCOGS: COGS_CATS.has(cat),
  })).filter(c => c.amount > 0).sort((a,b) => b.amount - a.amount);

  const saveStock = () => {
    const entry = {
      id: stockEntry?.id || Date.now(),
      quarter: stockForm.quarter,
      opening: parseFloat(stockForm.opening) || 0,
      closing: parseFloat(stockForm.closing) || 0,
      notes: stockForm.notes,
    };
    setInventory(p => stockEntry
      ? p.map(i => i.id === stockEntry.id ? entry : i)
      : [...p, entry]
    );
    setStockForm({ quarter: BAS_QUARTERS[0], opening:"", closing:"", notes:"" });
  };

  // Margin colour helper
  const marginCol = m => m >= 60 ? C.green : m >= 40 ? C.yellow : C.red;

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
            {documents.slice().sort((a,b) => (b.date||"").localeCompare(a.date||"")).map((d,i) => (
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
      ctrl: <select className="sel" value={selQ} onChange={e=>setSelQ(e.target.value)} style={{ width:210 }}>{BAS_QUARTERS.map(q=><option key={q} value={q}>{quarterLabel(q)}</option>)}</select>,
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

  const plRow = (lbl, val, opts={}) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${opts.last?'transparent':C.border}`, ...(opts.indent?{paddingLeft:16}:{}) }}>
      <span style={{ fontSize: opts.big?14:12.5, fontWeight: opts.bold||opts.big?700:400, color: opts.dim?C.dim:C.text }}>{lbl}</span>
      <span className="mono" style={{ fontSize: opts.big?16:13, fontWeight: opts.bold||opts.big?800:600, color: opts.col||C.text }}>{val}</span>
    </div>
  );

  return (
    <>
      {print === "bas"         && <PrintModal title="BAS Support Summary"    onClose={()=>setPrint(null)} onExport={() => renderBASSummaryPDF({d:bas, quarter:selQ, bizName, bizABN})}><BASPrint/></PrintModal>}
      {print === "annual"      && <PrintModal title="Annual Accountant Pack"  onClose={()=>setPrint(null)} onExport={() => renderAccountantPackPDF({d:annual, selFY, revenue, expenses, timesheets, employees, bizName, bizABN})}><div className="pp-page"><PPHeader title="Annual Accountant Pack" subtitle="Financial Year Summary" fy={selFY}/>{annual.warnings.map((w,i)=><div key={i} className="pp-warn">⚠️ {w}</div>)}<div className="pp-sec"><div className="pp-sec-ttl">Expenses by Category</div><table className="pp-tbl"><thead><tr><th>Category</th><th style={{textAlign:"right"}}>Amount</th></tr></thead><tbody>{EXP_CATEGORIES.filter(c=>annual.bycat[c]>0).map((c,i)=><tr key={i}><td>{c}</td><td style={{textAlign:"right",fontFamily:"DM Mono,monospace"}}>{money(annual.bycat[c])}</td></tr>)}</tbody><tfoot><tr><td>Total</td><td style={{textAlign:"right",fontFamily:"DM Mono,monospace"}}>{money(annual.totalExp)}</td></tr></tfoot></table></div><PPDisclaimer/></div></PrintModal>}
      {print === "payroll"     && <PrintModal title="Payroll Summary"         onClose={()=>setPrint(null)} onExport={() => renderPayrollPDF({employees, allRows:rows, selFY})}><PayrollPrint/></PrintModal>}
      {print === "docregister" && <PrintModal title="Document Register"       onClose={()=>setPrint(null)} onExport={() => renderDocRegisterPDF({documents, selFY})}><DocRegPrint/></PrintModal>}

      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">🖨️ Reports & P&L</div><div className="psub">Profit & Loss · Exports · Accountant-ready reports</div></div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:16, borderBottom:`1px solid ${C.border}`, paddingBottom:0 }}>
        {[["pl","📊 P&L Statement"],["reports","🖨️ Reports & Exports"]].map(([id,lbl]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding:"8px 16px", fontSize:12, fontWeight:600, fontFamily:"inherit", cursor:"pointer", border:"none", borderBottom: tab===id ? `2px solid ${C.accent}` : "2px solid transparent", background:"none", color: tab===id ? C.accent : C.muted, transition:"all .15s" }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── P&L TAB ── */}
      {tab === "pl" && (
        <>
          {/* Period selector + export */}
          <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:16, flexWrap:"wrap" }}>
            <div style={{ display:"flex", background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
              {[["quarter","By Quarter"],["fy","By Financial Year"]].map(([v,l]) => (
                <button key={v} onClick={() => setPlPeriod(v)} style={{ padding:"7px 14px", fontSize:11.5, fontWeight:600, fontFamily:"inherit", cursor:"pointer", border:"none", background: plPeriod===v ? C.accent : "transparent", color: plPeriod===v ? "#0C0F0D" : C.muted, transition:"all .15s" }}>{l}</button>
              ))}
            </div>
            {plPeriod === "quarter"
              ? <select className="sel" style={{ width:210 }} value={plQ} onChange={e => setPlQ(e.target.value)}>{BAS_QUARTERS.map(q => <option key={q} value={q}>{quarterLabel(q)}</option>)}</select>
              : <select className="sel" style={{ width:120 }} value={plFY} onChange={e => setPlFY(e.target.value)}>{FIN_YEARS.map(y => <option key={y}>{y}</option>)}</select>
            }
            {/* Expense date mode — cash vs accrual */}
            <div style={{ display:"flex", background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden" }}>
              {[["payment","Cash (payment date)"],["invoice","Accrual (invoice date)"]].map(([v,l]) => (
                <button key={v} onClick={() => setPlDateMode(v)}
                  style={{ padding:"7px 12px", fontSize:11, fontWeight:600, fontFamily:"inherit", cursor:"pointer", border:"none",
                    background: plDateMode===v ? (v==="invoice"?C.teal:C.accent) : "transparent",
                    color: plDateMode===v ? "#0C0F0D" : C.muted, transition:"all .15s" }}>{l}</button>
              ))}
            </div>
            {plDateMode === "invoice" && (
              <span style={{ fontSize:10.5, color:C.teal, background:"rgba(57,211,187,.08)", border:"1px solid rgba(57,211,187,.25)", borderRadius:6, padding:"3px 8px" }}>
                Using invoice dates where available
              </span>
            )}
            <button className="btn" style={{ marginLeft:"auto" }} onClick={() => {
              const pdf = renderPnLPDF({
                bizName, bizABN, label:plLabel, period:plPeriod,
                plRev, plGST, plRevExGST,
                openingStock, plPurchases, closingStock, trueCOGS,
                grossProfit, grossMargin,
                plWages, plSuper, plInsQ, plOpEx:plOpExp, plOpExp, totalOpex,
                operatingProfit, operatingMargin,
                plExpByCat,
              });
              pdfDownload(pdf, `PnL_${plLabel.replace(/\s/g,'_')}.pdf`);
            }}>⬇️ Export PDF</button>
          </div>

          {/* KPI cards */}
          <div className="g4" style={{ marginBottom:14 }}>
            {[
              { lbl:"Revenue (ex-GST)", val:money(plRevExGST), cls:"b" },
              { lbl:"Gross Profit",     val:money(grossProfit), cls: grossProfit>=0?"g":"r" },
              { lbl:"Gross Margin",     val:`${grossMargin.toFixed(1)}%`, cls: grossMargin>=60?"g":grossMargin>=40?"y":"r" },
              { lbl:"Operating Profit", val:money(operatingProfit), cls: operatingProfit>=0?"g":"r" },
            ].map((c,i) => <div key={i} className="card"><div className="clbl">{c.lbl}</div><div className={`cval ${c.cls}`}>{c.val}</div></div>)}
          </div>

          <div className="g2">
            {/* P&L Statement */}
            <div className="bc" style={{ marginBottom:0 }}>
              <div className="bctit">P&L Statement — {plLabel}</div>

              {/* Revenue */}
              <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", marginBottom:4, marginTop:4 }}>Revenue</div>
              {plRow("Total Sales (incl. GST)", money(plRev), { dim:true })}
              {plRow("Less: GST Collected (÷11)", `− ${money(plGST)}`, { dim:true })}
              {plRow("Net Revenue (ex-GST)", money(plRevExGST), { bold:true, col:C.blue })}

              {/* COGS */}
              <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", marginBottom:4, marginTop:14 }}>Cost of Goods Sold (COGS)</div>
              {/* Stocktake warning */}
              {!stockEntry && plPurchases > 0 && (
                <div style={{ background:"rgba(217,119,6,.07)", border:"1px solid rgba(217,119,6,.25)", borderRadius:7, padding:"7px 11px", marginBottom:8, fontSize:11, color:C.yellow, display:"flex", gap:7, alignItems:"center" }}>
                  <span>⚠️</span>
                  <span><strong>No stocktake for {plLabel}.</strong> COGS = purchases only — may be overstated. Add opening &amp; closing stock below for accurate gross margin.</span>
                </div>
              )}
              {openingStock > 0 && plRow("Opening Stock", money(openingStock), { indent:true, dim:true })}
              {plRow("Purchases (food, packaging, delivery)", money(plPurchases), { indent:true, dim:true })}
              {closingStock > 0 && plRow("Less: Closing Stock", `− ${money(closingStock)}`, { indent:true, dim:true })}
              {plRow("Total COGS", money(trueCOGS), { bold:true, col:C.yellow })}

              {/* Gross Profit */}
              <div style={{ background: grossProfit>=0 ? "rgba(5,150,105,.06)" : "rgba(220,38,38,.06)", border:`1px solid ${grossProfit>=0?C.green:C.red}30`, borderRadius:8, padding:"10px 12px", margin:"10px 0" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:13, fontWeight:700 }}>Gross Profit</span>
                  <span className="mono" style={{ fontSize:15, fontWeight:800, color: grossProfit>=0?C.green:C.red }}>{money(grossProfit)}</span>
                </div>
                <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>Gross Margin: <strong style={{ color:marginCol(grossMargin) }}>{grossMargin.toFixed(1)}%</strong> {grossMargin >= 60 ? "✅ Healthy" : grossMargin >= 40 ? "⚠️ Watch" : "🔴 At Risk"}</div>
              </div>

              {/* Operating expenses */}
              <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", marginBottom:4, marginTop:14 }}>Operating Expenses</div>
              {plRow("Gross Wages", money(plWages), { indent:true, dim:true })}
              {plRow("Superannuation (SGC)", money(plSuper), { indent:true, dim:true })}
              {plRow(`Insurance (quarterly share)`, money(plInsQ), { indent:true, dim:true })}
              {plRow("Other Operating Expenses", money(plOpExp), { indent:true, dim:true })}
              {plRow("Total Operating Expenses", money(totalOpex), { bold:true, col:C.red })}

              {/* Operating Profit */}
              <div style={{ background: operatingProfit>=0 ? "rgba(5,150,105,.08)" : "rgba(220,38,38,.08)", border:`1px solid ${operatingProfit>=0?C.green:C.red}40`, borderRadius:8, padding:"10px 12px", marginTop:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:14, fontWeight:700 }}>Operating Profit (EBIT)</span>
                  <span className="mono" style={{ fontSize:17, fontWeight:800, color: operatingProfit>=0?C.green:C.red }}>{money(operatingProfit)}</span>
                </div>
                <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>Operating Margin: <strong style={{ color:marginCol(operatingMargin) }}>{operatingMargin.toFixed(1)}%</strong></div>
              </div>
            </div>

            {/* Right column: Expense breakdown + stock take */}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {/* Expense breakdown */}
              <div className="bc" style={{ marginBottom:0 }}>
                <div className="bctit">Expense Breakdown</div>
                {plExpByCat.length === 0
                  ? <div style={{ fontSize:12, color:C.dim, padding:"12px 0" }}>No expenses in this period.</div>
                  : plExpByCat.map((c,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:14, flexShrink:0 }}>{c.cfg?.emoji || "📎"}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:11.5, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.cfg?.label || c.cat}</div>
                        {c.isCOGS && <div style={{ fontSize:9.5, color:C.yellow, fontWeight:700 }}>COGS</div>}
                      </div>
                      <span className="mono" style={{ fontSize:12, fontWeight:700, flexShrink:0 }}>{money(c.amount)}</span>
                    </div>
                  ))
                }
              </div>

              {/* Stock take input */}
              <div className="bc" style={{ marginBottom:0 }}>
                <div className="bctit">📦 Stock Take
                  <span style={{ fontSize:11, fontWeight:400, color:C.muted, marginLeft:8 }}>for accurate COGS calculation</span>
                </div>
                <div style={{ fontSize:11.5, color:C.muted, marginBottom:12, lineHeight:1.6 }}>
                  COGS = Opening Stock + Purchases − Closing Stock.<br/>
                  Enter stocktake values per quarter to get true gross profit.
                </div>
                <div className="frow2" style={{ marginBottom:10 }}>
                  <div className="fg">
                    <label className="flbl">Quarter</label>
                    <select className="sel" value={stockForm.quarter} onChange={e => setStockForm({...stockForm, quarter:e.target.value})}>
                      {BAS_QUARTERS.map(q => <option key={q} value={q}>{quarterLabel(q)}</option>)}
                    </select>
                  </div>
                  <div className="fg">
                    <label className="flbl">Opening Stock ($)</label>
                    <input className="inp" type="number" placeholder="0.00" value={stockForm.opening} onChange={e => setStockForm({...stockForm,opening:e.target.value})}/>
                  </div>
                  <div className="fg">
                    <label className="flbl">Closing Stock ($)</label>
                    <input className="inp" type="number" placeholder="0.00" value={stockForm.closing} onChange={e => setStockForm({...stockForm,closing:e.target.value})}/>
                  </div>
                  <div className="fg">
                    <label className="flbl">Notes</label>
                    <input className="inp" placeholder="e.g. End of quarter stocktake" value={stockForm.notes} onChange={e => setStockForm({...stockForm,notes:e.target.value})}/>
                  </div>
                </div>
                <button className="btn" onClick={saveStock} style={{ marginBottom:14 }}>💾 Save Stock Take</button>
                {inventory.length > 0 && (
                  <table className="tbl">
                    <thead><tr><th>Quarter</th><th style={{textAlign:"right"}}>Opening</th><th style={{textAlign:"right"}}>Closing</th><th style={{textAlign:"right"}}>Movement</th><th>Notes</th></tr></thead>
                    <tbody>
                      {inventory.slice().sort((a,b) => (b.quarter||"").localeCompare(a.quarter||"")).map(inv => (
                        <tr key={inv.id}>
                          <td style={{ fontWeight:700 }}>{inv.quarter}</td>
                          <td className="mono" style={{ textAlign:"right" }}>{money(inv.opening)}</td>
                          <td className="mono" style={{ textAlign:"right" }}>{money(inv.closing)}</td>
                          <td className="mono" style={{ textAlign:"right", color: inv.closing > inv.opening ? C.red : C.green }}>
                            {inv.closing > inv.opening ? "+" : ""}{money(inv.closing - inv.opening)}
                          </td>
                          <td style={{ fontSize:11, color:C.muted }}>{inv.notes || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── REPORTS TAB ── */}
      {tab === "reports" && (
        <>
          <div className="alert al-y">
            <span className="al-ico">⚠️</span>
            <div>
              <div className="al-ttl">Management Reports Only</div>
              <div className="al-msg">These reports are for planning and accountant review only. Mise does not lodge BAS or tax returns with the ATO. All figures must be verified by a registered tax agent before lodgment.</div>
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
                  <button className="btn" onClick={() => setPrint(r.id)}>⬇️ Export PDF</button>
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
            <div className="d-txt">All reports generated by Mise are <strong>management summaries only</strong> intended to assist business owners and their accountants in preparing for BAS lodgment and annual tax returns. They do not constitute a lodged BAS, tax return, or any document formally submitted to the ATO. All figures are estimates based on data entered into Mise and have not been audited or independently verified. Always engage a <strong>registered tax agent</strong> before lodging.</div>
          </div>
        </>
      )}
    </>
  );
}

// ── Mobile bottom tab bar ─────────────────────────────────────
function BottomTabBar({ page, setPage, flagCount }) {
  const [showMore, setShowMore] = useState(false);

  const tabs = [
    { id:"dashboard", ico:"📊", lbl:"Home"     },
    { id:"revenue",   ico:"💵", lbl:"Sales"  },
    { id:"wages",     ico:"👤", lbl:"Staff"    },
    { id:"documents", ico:"📁", lbl:"Docs"     },
    { id:"more",      ico:"⋯",  lbl:"More"     },
  ];

  const morePages = [
    { id:"expenses",   ico:"🧾", lbl:"Expenses"      },
    { id:"bassummary", ico:"📋", lbl:"BAS Summary"   },
    { id:"reports",    ico:"🖨️", lbl:"Reports & P&L" },
    { id:"insurance",  ico:"🛡️", lbl:"Insurance"     },
    { id:"taxsaver",   ico:"🔍", lbl:"Audit Ready", badge: flagCount > 0 ? `${flagCount}` : null },
    { id:"ias",        ico:"🧾", lbl:"Monthly IAS"   },
    { id:"dayworkers", ico:"⚡", lbl:"Day Workers"   },
    { id:"settings",   ico:"⚙️", lbl:"Settings"      },
  ];

  const isMoreActive = morePages.some(p => p.id === page);

  return (
    <>
      {/* More drawer */}
      {showMore && (
        <div style={{ position:"fixed", bottom:64, left:0, right:0, zIndex:99, background:C.surface, borderTop:`1px solid ${C.border}`, padding:"12px 16px", display:"flex", flexWrap:"wrap", gap:8 }}>
          {morePages.map(p => (
            <button key={p.id} onClick={() => { setPage(p.id); setShowMore(false); }}
              style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 14px", borderRadius:10, cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:600,
                border:`1px solid ${page===p.id?C.accent:C.border}`,
                background: page===p.id ? "rgba(143,203,114,.12)" : C.surfaceAlt,
                color: page===p.id ? C.accent : C.text, flex:"1 1 140px", position:"relative" }}>
              <span style={{ fontSize:18 }}>{p.ico}</span>
              {p.lbl}
              {p.badge && <span style={{ marginLeft:"auto", background:C.red, color:"#fff", borderRadius:10, padding:"1px 6px", fontSize:10, fontWeight:700 }}>{p.badge}</span>}
            </button>
          ))}
        </div>
      )}
      {/* Backdrop */}
      {showMore && <div onClick={() => setShowMore(false)} style={{ position:"fixed", inset:0, zIndex:98 }}/>}

      <div className="btab">
        {tabs.map(t => {
          const isMore = t.id === "more";
          const active = isMore ? (showMore || isMoreActive) : page === t.id;
          return (
            <button key={t.id} className={`btab-item${active?" on":""}`}
              onClick={() => {
                if (isMore) { setShowMore(v => !v); }
                else { setPage(t.id); setShowMore(false); }
              }}>
              <span className="btab-ico" style={{ fontSize: isMore ? 22 : 20, fontWeight: isMore ? 700 : 400 }}>{t.ico}</span>
              <span className="btab-lbl">{t.lbl}</span>
              {isMore && flagCount > 0 && (
                <span style={{ position:"absolute", top:4, right:"calc(50% - 14px)", background:C.red, color:"#fff", borderRadius:8, padding:"0 5px", fontSize:9, fontWeight:700 }}>{flagCount}</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── Onboarding modal — shown when bizName is still default ─────
function OnboardingModal({ onDone, setBizName, setBizABN, setIndustry }) {
  const [step, setStep]   = useState(0); // 0=name, 1=abn, 2=type
  const [name, setName]   = useState("");
  const [abn,  setAbn]    = useState("");
  const [ind,  setInd]    = useState("restaurant");

  const INDUSTRIES = [
    { id:"restaurant", emoji:"🍽️", label:"Restaurant",    desc:"Full-service dining, takeaway" },
    { id:"café",       emoji:"☕",  label:"Café",           desc:"Coffee, bakery, brunch" },
    { id:"bar",        emoji:"🍺",  label:"Bar / Pub",      desc:"Licensed venue, cocktail bar" },
    { id:"other",      emoji:"🏪",  label:"Other",          desc:"Retail, food truck, other" },
  ];

  const finish = () => {
    if (name.trim()) setBizName(name.trim());
    if (abn.trim())  setBizABN(abn.trim());
    setIndustry(ind);
    onDone();
  };

  const stepContent = [
    /* Step 0 – Name */
    <>
      <div style={{ fontSize:28, marginBottom:12 }}>🏪</div>
      <div style={{ fontSize:20, fontWeight:700, marginBottom:6, letterSpacing:"-.4px", fontFamily:"'Fraunces',serif" }}>What's your business called?</div>
      <div style={{ fontSize:12.5, color:C.muted, marginBottom:20, lineHeight:1.6 }}>This appears on all your payslips, BAS summaries and PDF exports.</div>
      <input className="inp" style={{ fontSize:16, padding:"12px 14px" }} placeholder="e.g. The Local Bistro" value={name} onChange={e => setName(e.target.value)} autoFocus
        onKeyDown={e => e.key==="Enter" && name.trim() && setStep(1)}/>
      <div className="fbtns" style={{ marginTop:16 }}>
        <button className="btn" disabled={!name.trim()} onClick={() => setStep(1)} style={{ width:"100%", opacity:name.trim()?1:.5 }}>Next →</button>
      </div>
      <button onClick={finish} style={{ marginTop:10, background:"none", border:"none", color:C.dim, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>Skip setup — I'll do this in Settings</button>
    </>,

    /* Step 1 – ABN */
    <>
      <div style={{ fontSize:28, marginBottom:12 }}>🔢</div>
      <div style={{ fontSize:20, fontWeight:700, marginBottom:6, letterSpacing:"-.4px", fontFamily:"'Fraunces',serif" }}>What's your ABN?</div>
      <div style={{ fontSize:12.5, color:C.muted, marginBottom:20, lineHeight:1.6 }}>Your 11-digit Australian Business Number. Appears on BAS summaries and accountant reports. You can skip this and add it later.</div>
      <input className="inp" style={{ fontSize:16, padding:"12px 14px" }} placeholder="12 345 678 901" value={abn} onChange={e => setAbn(e.target.value)}
        onKeyDown={e => e.key==="Enter" && setStep(2)}/>
      <div className="fbtns" style={{ marginTop:16 }}>
        <button className="btn" onClick={() => setStep(2)} style={{ flex:1 }}>Next →</button>
        <button className="btn-g" onClick={() => setStep(2)} style={{ flex:1 }}>Skip</button>
      </div>
    </>,

    /* Step 2 – Industry */
    <>
      <div style={{ fontSize:28, marginBottom:12 }}>🎯</div>
      <div style={{ fontSize:20, fontWeight:700, marginBottom:6, letterSpacing:"-.4px", fontFamily:"'Fraunces',serif" }}>What kind of venue?</div>
      <div style={{ fontSize:12.5, color:C.muted, marginBottom:18, lineHeight:1.6 }}>Mise adjusts expense categories, GST rules and Audit Ready checks based on your business type.</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
        {INDUSTRIES.map(i => (
          <button key={i.id} onClick={() => setInd(i.id)} style={{
            padding:"14px 10px", borderRadius:12, cursor:"pointer", fontFamily:"inherit", textAlign:"center",
            border:`2px solid ${ind===i.id?C.accent:C.border}`,
            background: ind===i.id ? "rgba(143,203,114,.10)" : C.surface,
            transition:"all .15s",
          }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{i.emoji}</div>
            <div style={{ fontWeight:700, fontSize:12.5, color: ind===i.id ? C.accent : C.text }}>{i.label}</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>{i.desc}</div>
          </button>
        ))}
      </div>
      <button className="btn" onClick={finish} style={{ width:"100%", fontSize:14, padding:"12px" }}>Let's go →</button>
    </>,
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:18, padding:"32px 28px", maxWidth:420, width:"100%", position:"relative" }}>
        {/* Step dots */}
        <div style={{ display:"flex", gap:6, justifyContent:"center", marginBottom:24 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: i===step?20:6, height:6, borderRadius:3, background:i===step?C.accent:C.border, transition:"all .2s" }}/>
          ))}
        </div>
        {stepContent[step]}
      </div>
    </div>
  );
}



export default function App() {
  const [screen,          setScreen]          = useState("landing");
  const [page,            setPage]            = useState("dashboard");
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [toast,           setToast]           = useState(null);
  const [dbReady,         setDbReady]         = useState(false); // true once initial load done
  const [bizId,           setBizId]           = useState(null);  // UUID of business row

  // ── Master Account state (Phase 1) ────────────────────────
  // Feature flag — set to false to revert to single-business behaviour
  const MASTER_ACCOUNT_ENABLED = true;
  // userBusinesses: array of { id, name, abn, industry, role } for all businesses
  // this user has access to (as owner or accountant). One entry for single-tenant users.
  const [userBusinesses,  setUserBusinesses]  = useState([]);
  // currentRole: role string for the currently-active bizId ('owner' | 'accountant_view' | 'accountant_edit')
  const [currentRole,     setCurrentRole]     = useState("owner");
  // Current logged-in user's email — used to stamp audit trail (who created/edited)
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  // Derived: is the current user view-only (no write permission)?
  const isViewOnly = currentRole === "accountant_view";

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2800); };

  // ── Supabase client (injected via index.html script tag) ────
  const sb = () => window._supabase;

  // ── Supabase-backed usePersisted ────────────────────────────
  // Interface identical to the old localStorage version:
  //   const [val, setVal] = usePersisted("table_name", seedData)
  //
  // Storage strategy: ONE ROW per table per business (UNIQUE on business_id).
  //   The entire array is stored as a single JSONB value.
  //   Fallback: if Supabase unavailable, silently falls back to localStorage.
  const usePersisted = (table, seed) => {
    // ── localStorage key MUST be scoped by business ──
    // Without bizId in the key, logging out of account A and into account B
    // makes B read A's cached data on first render (cross-account leak).
    // We compute the key from the CURRENT bizId at access time, not once.
    const lsKeyFor = (id) => id ? `mise_${table}_${id}` : `mise_${table}__none`;
    const [val, setVal] = useState(() => {
      // On first render bizId may not be known yet — start from seed empty,
      // never from a stale global cache. Supabase load (below) fills real data.
      const emptySeed = Array.isArray(seed) ? [] : (typeof seed === "string" ? seed : {});
      try {
        const k = lsKeyFor(bizId);
        const r = bizId ? localStorage.getItem(k) : null;
        return r ? JSON.parse(r) : emptySeed;
      } catch { return emptySeed; }
    });
    // Use a ref so the setter always has the latest bizId without stale closure
    const bizIdRef = React.useRef(bizId);
    React.useEffect(() => { bizIdRef.current = bizId; }, [bizId]);

    // Ref to current user's email for audit stamping (avoids stale closure)
    const userEmailRef = React.useRef(currentUserEmail);
    React.useEffect(() => { userEmailRef.current = currentUserEmail; }, [currentUserEmail]);

    // ── View-only guard ref (Step 5 layer 3 — hard write block) ──
    // Without this, RLS rejects the upsert but React state already updated,
    // causing the "ghost entries that disappear on logout" UX bug.
    const isViewOnlyRef = React.useRef(false);
    React.useEffect(() => { isViewOnlyRef.current = currentRole === "accountant_view"; }, [currentRole]);

    // Load from Supabase whenever bizId changes (login, account switch).
    // CRITICAL: clear stale state immediately when bizId changes, then load fresh,
    // so a new account never momentarily shows the previous account's data.
    React.useEffect(() => {
      const emptySeed = Array.isArray(seed) ? [] : (typeof seed === "string" ? seed : {});
      if (!bizId) { setVal(emptySeed); return; }
      // Reset to empty before the async load resolves (prevents flash of old data)
      const cachedKey = lsKeyFor(bizId);
      try {
        const cached = localStorage.getItem(cachedKey);
        setVal(cached ? JSON.parse(cached) : emptySeed);
      } catch { setVal(emptySeed); }

      sb().from(table).select("data").eq("business_id", bizId).limit(1)
        .then(({ data, error }) => {
          if (error) { console.warn("Supabase read error:", table, error.message); return; }
          if (data && data.length > 0) {
            setVal(data[0].data);
            try { localStorage.setItem(cachedKey, JSON.stringify(data[0].data)); } catch {}
          } else {
            // No data for this business — start fresh
            setVal(emptySeed);
            try { localStorage.setItem(cachedKey, JSON.stringify(emptySeed)); } catch {}
          }
        });
    }, [bizId]);

    const set = v => {
      // ── HARD GUARD: view-only accountants cannot write ──
      if (isViewOnlyRef.current) {
        showToast("View only — ask the owner to make changes");
        return;
      }
      setVal(prev => {
        let next = typeof v === "function" ? v(prev) : v;
        // ── Audit trail: stamp create/edit metadata on audited tables ──
        if (AUDITED_TABLES.includes(table) && Array.isArray(next)) {
          next = auditReconcile(prev, next, userEmailRef.current);
        }
        // Write localStorage immediately (scoped by current bizId)
        const currentBizId = bizIdRef.current;
        try { localStorage.setItem(lsKeyFor(currentBizId), JSON.stringify(next)); } catch {}
        // Write Supabase
        if (currentBizId && window._supabase) {
          sb().from(table)
            .upsert({ business_id: currentBizId, data: next }, { onConflict: "business_id" })
            .then(({ error }) => {
              if (error) console.warn("Supabase write error:", table, error.message);
            });
        }
        return next;
      });
    };

    return [val, set];
  };

  // ── Persisted state ───────────────────────────────────────
  const [revenue,    setRevenue]    = usePersisted("mise_revenue",    SEED_REVENUE);
  const [expenses,   setExpenses]   = usePersisted("mise_expenses",   SEED_EXPENSES);
  const [employees,  setEmployees]  = usePersisted("mise_employees",  SEED_EMPLOYEES);
  const [timesheets, setTimesheets] = usePersisted("mise_timesheets", SEED_TIMESHEETS);
  const [roster,     setRoster]     = usePersisted("mise_roster",     SEED_ROSTER);
  const [insurance,  setInsurance]  = usePersisted("mise_insurance",  SEED_INSURANCE);
  const [leave,      setLeave]      = usePersisted("mise_leave",      SEED_LEAVE);
  const [ias,        setIas]        = usePersisted("mise_ias",        SEED_IAS);
  const [basHistory, setBasHistory] = usePersisted("mise_bashistory", []);
  const [documents,  setDocuments]  = usePersisted("mise_documents",  SEED_DOCUMENTS);
  const [inventory,  setInventory]  = usePersisted("mise_inventory",  SEED_INVENTORY);
  const [industry,   setIndustryRaw]= usePersisted("mise_industry",   "restaurant");
  const [dayWorkers, setDayWorkers] = usePersisted("mise_dayworkers", []);
  const setIndustry = v => { setIndustryRaw(v); };

  // ── Business identity ─────────────────────────────────────
  const [bizName, setBizNameRaw] = useState(() => localStorage.getItem("mise_biz_name") || "My Restaurant");
  const [bizABN,  setBizABNRaw]  = useState(() => localStorage.getItem("mise_biz_abn")  || "");
  // ── Business settings (stored in businesses.settings JSONB, scoped per-business) ──
  // All loose Settings fields live here so they follow the ACCOUNT (via Supabase),
  // not the browser (localStorage). This is what makes settings persist for the
  // same account and stay isolated between accounts — no cache-clearing tricks.
  // Fields: company_name, gst_reg, bas_freq, payday, agent_lodge, owner_email, state,
  //         bas_reserve, week_budget
  const [bizSettings, setBizSettings] = useState({});
  // companyName is derived from settings for convenience (used by Sidebar)
  const companyName = bizSettings.company_name || "";

  // Update a single setting → optimistic state + persist whole JSONB to Supabase
  const updateSetting = (key, value) => {
    setBizSettings(prev => {
      const next = { ...prev, [key]: value };
      if (bizId && window._supabase) {
        sb().from("businesses").update({ settings: next }).eq("id", bizId)
          .then(({ error }) => { if (error) console.warn("settings save error:", error.message); });
      }
      return next;
    });
  };

  const setBizName = v => {
    setBizNameRaw(v); localStorage.setItem("mise_biz_name", v);
    if (bizId) sb().from("businesses").update({ name: v }).eq("id", bizId).then(() => {});
  };
  const setBizABN = v => {
    setBizABNRaw(v); localStorage.setItem("mise_biz_abn", v);
    if (bizId) sb().from("businesses").update({ abn: v }).eq("id", bizId).then(() => {});
  };
  const setCompanyName = v => updateSetting("company_name", v);

  // ── Auth: detect session on load, handle deep-link magic-link ──
  React.useEffect(() => {
    if (!window._supabase) return; // Supabase not configured yet

    // Handle magic link callback (URL contains #access_token)
    sb().auth.getSession().then(({ data: { session } }) => {
      if (session) bootFromSession(session);
    });

    const { data: { subscription } } = sb().auth.onAuthStateChange((_event, session) => {
      if (session) bootFromSession(session);
      else {
        // Clear all cached business data on logout so the next account starts clean
        try { Object.keys(localStorage).forEach(k => { if (k.startsWith("mise_")) localStorage.removeItem(k); }); } catch {}
        setScreen("landing"); setBizId(null); setCurrentUserEmail(""); setUserBusinesses([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

const bootFromSession = async (session) => {
    // Reset in-memory settings so the previous account's values never flash.
    // Real values load from businesses.settings (Supabase) in Step C below.
    setBizSettings({});
    setBizNameRaw("My Restaurant");
    setBizABNRaw("");

    // Stamp the current user's email for audit trail (who created/edited records)
    if (session?.user?.email) setCurrentUserEmail(session.user.email);
    // ── Phase 1 Master Account: load businesses via business_access table ──
    // Strategy:
    //   1. SELECT all businesses this user has access to (owner or accountant)
    //   2. If 0 → first-time user; create their first business with owner role
    //   3. If 1+ → load them all into userBusinesses, activate the first one
    //   4. (Future Step 4: top-bar dropdown to switch between them)
    //
    // Backward compat:
    //   - Existing owners still see their single business (Step 1 SQL migrated their access rows)
    //   - The race-condition INSERT guard from Layer 2 is preserved for new sign-ups
    //   - All downstream code (usePersisted, BAS, etc.) sees bizId exactly as before

    if (!MASTER_ACCOUNT_ENABLED) {
      // ── Legacy single-business path (preserved as escape hatch) ──
      let biz = null;
      const tryFetchOwn = async () => {
        const { data, error } = await sb().from("businesses")
          .select("id,name,abn,industry")
          .eq("owner_id", session.user.id)
          .limit(1);
        if (error) { console.warn("bootFromSession: legacy fetch failed", error); return null; }
        return (data && data.length > 0) ? data[0] : null;
      };
      biz = await tryFetchOwn();
      if (!biz) {
        const { data: newBiz, error: ie } = await sb().from("businesses")
          .insert({ owner_id: session.user.id, name: "My Restaurant" })
          .select().single();
        if (newBiz) biz = newBiz;
        else if (ie?.code === "23505") biz = await tryFetchOwn();
      }
      if (biz && biz.id) {
        setBizId(biz.id);
        setBizNameRaw(biz.name || "My Restaurant");
        setBizABNRaw(biz.abn  || "");
        setIndustryRaw(biz.industry || "restaurant");
        setUserBusinesses([{ ...biz, role: "owner" }]);
        setCurrentRole("owner");
        localStorage.setItem("mise_biz_name", biz.name || "My Restaurant");
        localStorage.setItem("mise_biz_abn",  biz.abn  || "");
      }
      setDbReady(true);
      setScreen("app");
      return;
    }

    // ── Multi-tenant path via business_access ──
    // Step A: fetch all businesses user has access to
    const fetchAccessibleBusinesses = async () => {
      // Inner select pulls business details via FK; outer join needed because
      // RLS will already constrain access rows to this user
      const { data, error } = await sb().from("business_access")
        .select("role, business_id, businesses!inner(id, name, abn, industry, settings)")
        .order("granted_at", { ascending: true });
      if (error) {
        console.warn("bootFromSession: fetchAccessible failed", error);
        return null;
      }
      // Normalise shape: [{id, name, abn, industry, role, settings}, ...]
      return (data || []).map(row => ({
        id:       row.businesses.id,
        name:     row.businesses.name,
        abn:      row.businesses.abn,
        industry: row.businesses.industry,
        settings: row.businesses.settings || {},
        role:     row.role,
      }));
    };

    let businesses = await fetchAccessibleBusinesses();

    // Account type from signup metadata — accountants never auto-create a business.
    const accountType = session?.user?.user_metadata?.account_type || "owner";

    // Step B: first-time OWNER → create their first business.
    // Accountants intentionally start with no business; they gain access via invitations only.
    if (accountType !== "accountant" && businesses !== null && businesses.length === 0) {
      const signupBizName = session?.user?.user_metadata?.biz_name || "My Restaurant";
      // Use a SECURITY DEFINER RPC that creates the business AND the owner
      // business_access row atomically (bypasses RLS). The old approach used two
      // separate front-end inserts; the business_access insert could be silently
      // rejected by RLS, leaving an owner with a business but no owner access row —
      // which made invite_accountant return "not_owner". This RPC is idempotent and
      // also self-heals accounts that are already in that broken state.
      const { data: newBizId, error: rpcErr } = await sb().rpc("create_owner_business", { p_name: signupBizName });
      if (rpcErr) {
        console.error("bootFromSession: create_owner_business failed", rpcErr);
      } else if (newBizId) {
        businesses = await fetchAccessibleBusinesses();
      }
    }

    // Step C: activate first business (or null if still empty after all attempts)
    if (businesses && businesses.length > 0) {
      const first = businesses[0];
      setUserBusinesses(businesses);
      setCurrentRole(first.role || "owner");
      setBizId(first.id);
      setBizNameRaw(first.name || "My Restaurant");
      setBizABNRaw(first.abn  || "");
      setIndustryRaw(first.industry || "restaurant");
      setBizSettings(first.settings || {});  // load this business's settings from Supabase
      localStorage.setItem("mise_biz_name", first.name || "My Restaurant");
      localStorage.setItem("mise_biz_abn",  first.abn  || "");
      // Persist the active bizId so next-load uses the same one (Step 4 will let user pick)
      localStorage.setItem("mise_active_biz_id", first.id);
    } else {
      // No business available. For accountants this is the normal "awaiting invitation"
      // state; for owners it's an error (their auto-create failed).
      if (accountType === "accountant") {
        setUserBusinesses([]);
        setBizId(null);
        setCurrentRole("accountant_view");
        setDbReady(true);
        setScreen("accountant-empty");
        return;
      }
      console.error("bootFromSession: could not resolve any business for user", session.user.id);
    }
    setDbReady(true);
    setScreen("app");
  };

  // ── Switch active business (Phase 1 Step 4 — Client Switcher) ──
  // Used by accountants/multi-tenant users to switch which client's data they view.
  // CRITICAL: This MUST clear all in-memory state and localStorage caches before
  // setting the new bizId, otherwise old business data leaks to the new business view.
  const switchBusiness = (targetBizId) => {
    const target = userBusinesses.find(b => b.id === targetBizId);
    if (!target) {
      console.warn("switchBusiness: target not found", targetBizId);
      return;
    }
    // Clear ALL mise_* localStorage keys so the new business loads fresh from Supabase
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith("mise_") && k !== "mise_active_biz_id" && k !== "mise_biz_name" && k !== "mise_biz_abn") {
          localStorage.removeItem(k);
        }
      });
    } catch {}
    // Apply new business context
    setBizId(target.id);
    setCurrentRole(target.role || "owner");
    setBizNameRaw(target.name || "");
    setBizABNRaw(target.abn || "");
    setIndustryRaw(target.industry || "restaurant");
    setBizSettings(target.settings || {});  // load target business's settings
    localStorage.setItem("mise_active_biz_id", target.id);
    localStorage.setItem("mise_biz_name", target.name || "");
    localStorage.setItem("mise_biz_abn",  target.abn  || "");
    showToast(`Switched to ${target.name || "business"}`);
  };
  // ── Show onboarding when bizName is still default ────────
  const [showOnboarding, setShowOnboarding] = useState(
    () => (localStorage.getItem("mise_biz_name") || "My Restaurant") === "My Restaurant"
  );
  const [showRateAlert, setShowRateAlert] = useState(() => !checkRateVersion());

  const analysed  = analyseExpenses(expenses);
  const insExpiring = insurance.filter(i => {
    if (!i.renewal) return false;
    const days = Math.ceil((new Date(i.renewal) - new Date()) / 86400000);
    return days <= 60 && days >= 0;
  }).length;
  const flagCount = analysed.filter(e => e.gstStatus === "missing-invoice").length
                  + timesheets.filter(t => !t.super_paid).length
                  + analysed.filter(e => e.ent).length
                  + insExpiring;

  if (screen === "landing") return (<><style>{CSS}</style><LandingPage onGo={() => setScreen("auth")}/></>);
  if (screen === "auth")    return (<><style>{CSS}</style><AuthPage onLogin={() => {}}/></>);
  // Accountant with no client invitations yet — friendly waiting state
  if (screen === "accountant-empty") return (
    <><style>{CSS}</style>
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg, padding:20 }}>
      <div style={{ maxWidth:440, width:"100%", textAlign:"center", background:C.surface, border:`1px solid ${C.border}`, borderRadius:18, padding:"40px 32px" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>📊</div>
        <div style={{ fontSize:22, fontWeight:700, marginBottom:10, fontFamily:"'Fraunces',serif", color:C.text }}>Welcome to Mise</div>
        <div style={{ fontSize:13.5, color:C.muted, lineHeight:1.7, marginBottom:24 }}>
          Your accountant account is ready. You don't have any clients yet — when a restaurant owner invites you to view their books, their business will appear here automatically.
        </div>
        <div style={{ background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:11, padding:"16px 18px", textAlign:"left", marginBottom:24 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", marginBottom:10 }}>How to get access</div>
          <div style={{ fontSize:12.5, color:C.text, lineHeight:1.9 }}>
            1. Ask your client to log in to Mise<br/>
            2. They go to <strong>Settings → Team Access</strong><br/>
            3. They enter <strong style={{ color:C.blue }}>{currentUserEmail || "your email"}</strong><br/>
            4. Refresh this page — their venue appears
          </div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <button className="btn-g" style={{ flex:1 }} onClick={() => window.location.reload()}>↻ Refresh</button>
          <button className="btn-g" style={{ flex:1 }} onClick={async () => {
            if (window._supabase) await sb().auth.signOut();
            try { Object.keys(localStorage).forEach(k => { if (k.startsWith("mise_")) localStorage.removeItem(k); }); } catch {}
            setScreen("landing"); setBizId(null); setCurrentUserEmail(""); setUserBusinesses([]);
          }}>Log out</button>
        </div>
      </div>
    </div></>
  );
  // Loading screen while Supabase fetches data
  if (!dbReady && bizId) return (
    <><style>{CSS}</style>
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg, flexDirection:"column", gap:16 }}>
      <div style={{ width:40, height:40, border:`3px solid ${C.border}`, borderTop:`3px solid ${C.accent}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <div style={{ fontSize:13, color:C.muted }}>Loading your data…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div></>
  );

  return (
    <>
      <style>{CSS}</style>
      {showOnboarding && screen === "app" && (
        <OnboardingModal
          onDone={() => setShowOnboarding(false)}
          setBizName={setBizName}
          setBizABN={setBizABN}
          setIndustry={setIndustry}
        />
      )}
      {/* ── Tax rate update alert ── */}
      {showRateAlert && screen === "app" && (
        <div style={{ position:"fixed", bottom: showOnboarding ? 0 : 70, left:0, right:0, zIndex:150,
          background:"linear-gradient(90deg,rgba(37,99,235,.95),rgba(37,99,235,.88))",
          padding:"12px 20px", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
          <span style={{ fontSize:18 }}>📢</span>
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ fontSize:12.5, fontWeight:700, color:"#fff" }}>Tax rate update — {TAX_RATE_VERSION}</div>
            <div style={{ fontSize:11.5, color:"rgba(255,255,255,.8)", marginTop:2 }}>{TAX_RATE_NOTES}</div>
          </div>
          <button onClick={() => { dismissRateAlert(); setShowRateAlert(false); }}
            style={{ background:"rgba(255,255,255,.2)", border:"1px solid rgba(255,255,255,.4)", borderRadius:8, padding:"7px 14px", fontSize:12, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
            Got it ✓
          </button>
        </div>
      )}
      <div className="layout">
        <Sidebar page={page} setPage={setPage} onLogout={async () => { if(window._supabase) await sb().auth.signOut(); try { Object.keys(localStorage).forEach(k => { if (k.startsWith("mise_")) localStorage.removeItem(k); }); } catch {} setScreen("landing"); setBizId(null); setCurrentUserEmail(""); setUserBusinesses([]); }} flagCount={flagCount} industry={industry} companyName={companyName}/>
        <main className="main">
          {/* ── Phase 1 Step 4: Client Switcher (only for users with ≥2 businesses) ── */}
          {userBusinesses.length > 1 && (
            <div style={{
              display:"flex", alignItems:"center", gap:10, flexWrap:"wrap",
              background:"linear-gradient(135deg, rgba(57,211,187,.10), rgba(64,156,255,.08))",
              border:`1px solid ${C.teal}`, borderRadius:10,
              padding:"10px 14px", marginBottom:16
            }}>
              <span style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", fontWeight:700 }}>
                Currently viewing
              </span>
              <select
                value={bizId || ""}
                onChange={e => switchBusiness(e.target.value)}
                style={{
                  flex:1, minWidth:200,
                  padding:"7px 11px", fontSize:13, fontWeight:600,
                  background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:8,
                  color:C.text, fontFamily:"inherit", cursor:"pointer"
                }}>
                {userBusinesses.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name || "(unnamed)"} {b.role === "owner" ? "— Owner" : b.role === "accountant_edit" ? "— Editor" : "— View only"}
                  </option>
                ))}
              </select>
              <span style={{
                fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:5, whiteSpace:"nowrap",
                color: "#0C0F0D",
                background: currentRole === "owner" ? C.accent
                          : currentRole === "accountant_edit" ? C.teal
                          : C.blue
              }}>
                {currentRole === "owner" ? "OWNER"
                  : currentRole === "accountant_edit" ? "EDITOR"
                  : "VIEW ONLY"}
              </span>
            </div>
          )}

          {/* ── Phase 1 Step 5 Layer 1: View-only banner ── */}
          {currentRole === "accountant_view" && (
            <div style={{
              display:"flex", alignItems:"center", gap:10,
              background:"rgba(64,156,255,.10)",
              border:`1px solid ${C.blue}`, borderRadius:10,
              padding:"10px 14px", marginBottom:16,
              fontSize:12.5, color:C.text
            }}>
              <span style={{ fontSize:16 }}>👁️</span>
              <div style={{ flex:1 }}>
                <strong style={{ color:C.blue }}>View-only access.</strong>
                <span style={{ color:C.muted, marginLeft:6 }}>
                  You can browse and download reports. Changes are not saved — ask the owner to make edits.
                </span>
              </div>
            </div>
          )}

          {page === "dashboard"      && <DashboardPage revenue={revenue} expenses={expenses} employees={employees} timesheets={timesheets} insurance={insurance} setPage={setPage} bizName={bizName} roster={roster} bizSettings={bizSettings} updateSetting={updateSetting}/>}
          {page === "revenue"        && <RevenuePage   revenue={revenue}   setRevenue={setRevenue}   showToast={showToast}/>}
          {page === "expenses"       && <ExpensesPage  expenses={expenses} setExpenses={setExpenses} showToast={showToast} industry={industry} dismissed={dismissedAlerts} setDismissed={setDismissedAlerts}/>}
          {page === "wages"          && <WagesPage     employees={employees} setEmployees={setEmployees} timesheets={timesheets} setTimesheets={setTimesheets} roster={roster} setRoster={setRoster} leave={leave} setLeave={setLeave} showToast={showToast} bizName={bizName} setBizName={setBizName} bizABN={bizABN} setBizABN={setBizABN} dayWorkers={dayWorkers} setDayWorkers={setDayWorkers} revenue={revenue}/>}
          {page === "dayworkers"     && <WagesPage     employees={employees} setEmployees={setEmployees} timesheets={timesheets} setTimesheets={setTimesheets} roster={roster} setRoster={setRoster} leave={leave} setLeave={setLeave} showToast={showToast} bizName={bizName} setBizName={setBizName} bizABN={bizABN} setBizABN={setBizABN} dayWorkers={dayWorkers} setDayWorkers={setDayWorkers} initialTab="dayworkers" revenue={revenue}/>}
          {page === "insurance"      && <InsurancePage insurance={insurance} setInsurance={setInsurance} employees={employees} timesheets={timesheets} showToast={showToast}/>}
          {page === "taxsaver"       && <TaxSaverPage  expenses={expenses} setExpenses={setExpenses} employees={employees} timesheets={timesheets} setTimesheets={setTimesheets} showToast={showToast}/>}
          {page === "ias"            && <IASPage        timesheets={timesheets} employees={employees} ias={ias} setIas={setIas} showToast={showToast} bizName={bizName} bizABN={bizABN}/>}
          {page === "documents"      && <DocumentsPage documents={documents} setDocuments={setDocuments} employees={employees} showToast={showToast}/>}
          {page === "bassummary"     && <BASSummaryPage revenue={revenue} expenses={expenses} timesheets={timesheets} employees={employees} insurance={insurance} documents={documents} basHistory={basHistory} setBasHistory={setBasHistory} showToast={showToast} bizName={bizName} bizABN={bizABN} ias={ias}/>}
          {page === "reports"        && <ReportsPage revenue={revenue} expenses={expenses} timesheets={timesheets} employees={employees} insurance={insurance} documents={documents} inventory={inventory} setInventory={setInventory} bizName={bizName} bizABN={bizABN}/>}
          {page === "settings"       && <SettingsPage industry={industry} setIndustry={setIndustry} showToast={showToast} bizName={bizName} setBizName={setBizName} bizABN={bizABN} setBizABN={setBizABN} bizId={bizId} currentRole={currentRole} companyName={companyName} setCompanyName={setCompanyName} bizSettings={bizSettings} updateSetting={updateSetting}/>}
        </main>
        <BottomTabBar page={page} setPage={setPage} flagCount={flagCount}/>
        {toast && <Toast msg={toast} onDone={() => setToast(null)}/>}
      </div>
    </>
  );
}
