import { useState, useRef } from "react";
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
  { id:1, name:"Lilian",       email:"lilian@email.com",      phone:"0400 000 001",
    dob:"2000-04-10", nok_name:"", nok_phone:"",
    role:"Floor Staff",  type:"casual", rate:15.18, std_hrs:15,
    start:"2024-01-15", tfn:true,  superfund:"AustralianSuper" },
  { id:2, name:"Charlotte",    email:"charlotte@email.com",   phone:"0400 000 002",
    dob:"1999-08-22", nok_name:"", nok_phone:"",
    role:"Floor Staff",  type:"casual", rate:15.60, std_hrs:15,
    start:"2024-02-01", tfn:true,  superfund:"Hostplus" },
  { id:3, name:"Cohen",        email:"cohen@email.com",       phone:"0400 000 003",
    dob:"2001-11-30", nok_name:"", nok_phone:"",
    role:"Floor Staff",  type:"casual", rate:15.18, std_hrs:15,
    start:"2024-03-10", tfn:true,  superfund:"REST Super" },
  { id:4, name:"Niamh",        email:"niamh@email.com",       phone:"0400 000 004",
    dob:"2002-05-14", nok_name:"", nok_phone:"",
    role:"Floor Staff",  type:"casual", rate:15.18, std_hrs:15,
    start:"2024-04-01", tfn:true,  superfund:"AustralianSuper" },
  { id:5, name:"Maddy",        email:"maddy@email.com",       phone:"0400 000 005",
    dob:"2000-09-03", nok_name:"", nok_phone:"",
    role:"Floor Staff",  type:"casual", rate:15.18, std_hrs:15,
    start:"2024-05-20", tfn:true,  superfund:"Hostplus" },
  { id:6, name:"Zi Jun Fan",   email:"zijun.fan@email.com",   phone:"0400 000 006",
    dob:"1998-01-18", nok_name:"", nok_phone:"",
    role:"",           type:"casual", rate:0, std_hrs:15,
    start:"2024-06-01", tfn:true,  superfund:"" },
  { id:7, name:"Zhao Hui Lin", email:"zhaohui.lin@email.com", phone:"0400 000 007",
    dob:"1997-07-25", nok_name:"", nok_phone:"",
    role:"",           type:"casual", rate:0, std_hrs:15,
    start:"2024-07-15", tfn:true,  superfund:"" },
  { id:8, name:"Zhong Min Fan",email:"zhongmin.fan@email.com",phone:"0400 000 008",
    dob:"1999-03-08", nok_name:"", nok_phone:"",
    role:"",           type:"casual", rate:0, std_hrs:15,
    start:"2024-08-01", tfn:true,  superfund:"" },
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
  { id:1, type:"Workers Compensation", annual:3400, notes:"Renewal due Oct 2025" },
  { id:2, type:"Public Liability",     annual:1200, notes:"$10M cover" },
  { id:3, type:"Equipment & Property", annual:2100, notes:"Fitout & kitchen equipment" },
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

// ── PDF layout helpers ────────────────────────────────────────
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
  const ROW_H = 22;   // text size 9 baseline at y+5+9=y+14; separator at y+22; gap=8pt

  // Section titles: text baseline at startY+9; separator at startY+16; rows start at startY+24
  pdf.text(lx, startY, left.title,  {size:9, bold:true, color:'#6B7280'});
  pdf.line(lx, startY+16, lx+colW, startY+16, {color:'#E5E7EB', w:0.8});
  pdf.text(rx, startY, right.title, {size:9, bold:true, color:'#6B7280'});
  pdf.line(rx, startY+16, rx+colW,  startY+16, {color:'#E5E7EB', w:0.8});
  let ly=startY+24, ry=startY+24;

  left.rows.forEach(r=>{
    pdf.text(lx+4,       ly+5, r.lbl, {size:9, color:'#374151'});
    pdf.text(lx+colW-4,  ly+5, r.val, {size:9, bold:!!r.bold, color:r.color||'#111111', align:'right'});
    pdf.line(lx, ly+ROW_H, lx+colW, ly+ROW_H, {color:'#F3F4F6', w:0.5});
    ly+=ROW_H;
  });
  right.rows.forEach(r=>{
    pdf.text(rx+4,      ry+5, r.lbl, {size:9, color:'#374151'});
    pdf.text(rx+colW-4, ry+5, r.val, {size:9, bold:!!r.bold, color:r.color||'#111111', align:'right'});
    pdf.line(rx, ry+ROW_H, rx+colW, ry+ROW_H, {color:'#F3F4F6', w:0.5});
    ry+=ROW_H;
  });

  const maxY=Math.max(ly,ry)+8;
  // Total boxes side-by-side
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

const renderBASSummaryPDF = ({d, quarter}) => {
  const pdf=new MiniPDF();
  const W=pdf.W, M=pdf.M;
  let y=pdfHeader(pdf, 'BAS Support Summary', 'Quarterly BAS Management Summary', quarter);

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
        {lbl:'PAYG Withheld Withheld (ATO Scale 2)',val:`$${d.totalPayg.toFixed(2)}`},
        {lbl:'Super (SGC) (SGC)',          val:`$${d.totalSuper.toFixed(2)}`},
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
      e.gst?`$${(e.amount/11).toFixed(2)}`:'—',
      e.invoice?'Yes':{text:'No',color:'#DC2626'},
    ]),
    cols,
    { footerRow:['TOTAL','','',`$${totalExp.toFixed(2)}`,`$${gstCreds.toFixed(2)}`,''],
      numCols:[3,4] }
  );
  pdfDisclaimer(pdf, y);
  return pdf;
};

const renderAccountantPackPDF = ({d, selFY}) => {
  const pdf=new MiniPDF();
  const W=pdf.W, M=pdf.M;
  let y=pdfHeader(pdf, 'Annual Accountant Pack', 'Financial Year Summary', selFY);

  if(d.warnings.length>0){
    d.warnings.forEach(w=>{ y=pdfWarn(pdf, y, w); });
    y+=4;
  }

  // Annual summary — two column: Revenue/Expenses | Wages/Obligations
  y=pdfTwoSec(pdf, y,
    { title:'REVENUE & EXPENSES',
      rows:[
        {lbl:'Total Revenue',   val:`$${d.totalRev.toFixed(2)}`},
        {lbl:'Total Expenses',  val:`$${d.totalExp.toFixed(2)}`},
        {lbl:'Insurance',       val:`$${d.totalIns.toFixed(2)}`},
      ],
      total:{lbl:'Gross Profit', val:`$${(d.totalRev-d.totalExp).toFixed(2)}`, color:'#8FCB72'},
    },
    { title:'WAGES & OBLIGATIONS',
      rows:[
        {lbl:'Total Wages Paid',     val:`$${d.totalWages.toFixed(2)}`},
        {lbl:'Total PAYG Withheld',  val:`$${d.totalPayg.toFixed(2)}`},
        {lbl:'Total Super (SGC)',  val:`$${d.totalSuper.toFixed(2)}`},
      ],
      total:{lbl:'Total Labour Cost', val:`$${(d.totalWages+d.totalSuper).toFixed(2)}`, color:'#8FCB72'},
    }
  );
  y+=8;

  // Expenses by category
  y=pdfSecTitle(pdf, y, 'EXPENSES BY CATEGORY');
  const catRows=EXP_CATEGORIES.filter(c=>d.bycat[c]>0).map(c=>{
    const cfg=CAT_CONFIG[c];
    return [cfg?`${cfg.label}`:c, `$${d.bycat[c].toFixed(2)}`];
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

const renderPayslipPDF = ({emp, rows, totals, payPeriodLabel, bizName, bizABN}) => {
  const pdf=new MiniPDF();
  const W=pdf.W, M=pdf.M;
  let y=pdfHeader(pdf, 'Employee Payslip', 'Payslip & Wage Summary', payPeriodLabel, bizName||'My Restaurant');

  if(bizABN) {
    pdf.text(W-M, 35, `ABN: ${bizABN}`, {size:8, color:'#6B7280', align:'right'});
  }

  // Employee info + period side-by-side
  const effR=effRate(emp);
  y=pdfTwoSec(pdf, y,
    { title:'EMPLOYEE DETAILS',
      rows:[
        {lbl:'Name',            val:emp.name},
        {lbl:'Role',            val:emp.role||'—'},
        {lbl:'Employment Type', val:emp.type?emp.type.charAt(0).toUpperCase()+emp.type.slice(1):'—'},
        {lbl:'Base Rate',       val:`$${parseFloat(emp.rate).toFixed(2)}/hr`},
        {lbl:'Effective Rate',  val:`$${effR.toFixed(2)}/hr`},
        {lbl:'Super Fund',      val:emp.superfund||'Not specified'},
        {lbl:'TFN Provided',    val:emp.tfn?'Yes':'No', color:emp.tfn?'#16A34A':'#DC2626'},
      ],
      total:null
    },
    { title:'PAY PERIOD',
      rows:[
        {lbl:'Period',            val:payPeriodLabel},
        {lbl:'Standard Hours',    val:`${totals.std_hrs}h`},
        {lbl:'Overtime Hours',    val:`${totals.ot_hrs}h`},
        {lbl:'Weekend / PH Hrs',  val:`${totals.wknd_hrs}h`},
        {lbl:'Total Hours',       val:`${(totals.std_hrs+totals.ot_hrs+totals.wknd_hrs)}h`, bold:true},
        {lbl:'Gross Pay',         val:`$${totals.gross.toFixed(2)}`, bold:true},
      ],
      total:null
    }
  );
  y+=4;

  // Hours breakdown table
  y=pdfSecTitle(pdf, y, 'HOURS & EARNINGS BREAKDOWN');
  const cols=[100,50,50,50,75,75,75,0];
  cols[7]=W-M*2-cols.slice(0,7).reduce((s,c)=>s+c,0);
  y=pdfTable(pdf, y,
    ['Pay Week','Std Hrs','OT Hrs','Wknd Hrs','Std Pay','OT Pay','Wknd Pay','Gross'],
    rows.map(r=>[
      r.week, `${r.std_hrs}h`, `${r.ot_hrs}h`, `${r.wknd_hrs}h`,
      `$${(effR*r.std_hrs).toFixed(2)}`,
      r.ot_hrs>0?`$${(effR*OT_RATE*r.ot_hrs).toFixed(2)}`:'—',
      r.wknd_hrs>0?`$${(effR*WKND_RATE*r.wknd_hrs).toFixed(2)}`:'—',
      `$${r.gross.toFixed(2)}`,
    ]),
    cols,
    { footerRow:['TOTAL',`${totals.std_hrs}h`,`${totals.ot_hrs}h`,`${totals.wknd_hrs}h`,'','','',`$${totals.gross.toFixed(2)}`],
      numCols:[4,5,6,7] }
  );
  y+=4;

  // Pay summary
  y=pdfSecTitle(pdf, y, 'PAY SUMMARY');
  y=pdfRow(pdf, y, 'Gross Pay', `$${totals.gross.toFixed(2)}`);
  y=pdfRow(pdf, y, `PAYG Withheld (ATO${emp.tfn?' Scale 2':' — no TFN 47%'})`, `- $${totals.payg.toFixed(2)}`, {valColor:'#DC2626'});
  y+=2;
  y=pdfTotRow(pdf, y, 'Net Pay (Take-Home)', `$${totals.net.toFixed(2)}`);
  y+=4;

  // Super info box — rate is period-aware (11.5% pre-Jul 2025, 12% from Jul 2025)
  const superRateDisplay = totals.superR ? `${(totals.superR*100).toFixed(1)}%` : `${(getSuperRate(todayWeekStr)*100).toFixed(1)}%`;
  pdf.rect(M, y, W-M*2, 40, {fill:'#EFF6FF', stroke:'#BFDBFE'});
  pdf.text(M+10, y+10, `Super (${superRateDisplay}): $${totals.super.toFixed(2)} to be paid to ${emp.superfund||'nominated fund'} within 28 days of quarter end.`, {size:8.5, color:'#1D4ED8'});
  pdf.text(M+10, y+26, 'Late super payments attract the SGC — not tax deductible.', {size:8, color:'#3B82F6'});
  y+=48;

  if(!emp.tfn){
    y=pdfWarn(pdf, y, `No TFN on file — PAYG withheld at 47%. Ask ${emp.name} to provide their TFN.`);
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
  pdf.text(M+10, y+10, `ℹ  Employer super obligation (not IAS): $${d.autoSuper.toFixed(2)} — due to funds within 28 days of quarter end.`, {size:8.5, color:'#1D4ED8'});
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
    const superR = getSuperRate(ts.week);          // 11.5% pre-Jul 2025, 12% from Jul 2025
    const super_ = gross * superR;
    const payg   = calcWeeklyPAYG(gross, emp.tfn); // ATO 2024-25 Scale 2 progressive
    return { ...ts, emp, gross, super: super_, superR, payg,
             labour: gross + super_,               // labour cost = gross + super (PAYG is employee's)
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
        <div style={{ display:"flex", gap:9 }}>
          <button className="btn-g" onClick={onGo}>Log In</button>
          <button className="btn"   onClick={onGo}>Get Started Free</button>
        </div>
      </nav>

      <div className="hero">
        <div className="h-badge">🇦🇺 Built for Australian Hospitality & Food Business</div>
        <h1 className="h-ttl">Your business finances,<br/><span>everything in its place.</span></h1>
        <p className="h-sub">Mise handles GST, wages, super, expenses and BAS — built specifically for how Australian hospitality businesses actually operate. Restaurants, cafés, bars, takeaways and food businesses.</p>
        <div className="h-btns">
          <button className="h-btn"   onClick={onGo}>Start for Free →</button>
          <button className="h-btn-g" onClick={onGo}>See How It Works</button>
        </div>
      </div>

      {/* Industry pills */}
      <div style={{ textAlign:"center", padding:"4px 0 28px" }}>
        <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginBottom:12 }}>
          {["🍽️ Restaurants","☕ Cafés","🍺 Bars & Pubs","🥡 Takeaways","🍕 Food Trucks","✂️ Hair & Beauty","🏪 Retail"].map((l,i) => (
            <span key={i} style={{ fontSize:11.5, padding:"4px 12px", borderRadius:20, background:C.surfaceAlt, border:`1px solid ${C.border}`, color:C.muted }}>{l}</span>
          ))}
        </div>
        <div style={{ fontSize:11.5, color:C.dim, letterSpacing:".4px" }}>GST · BAS · PAYG · Super · Wages · Leave · Insurance · Documents</div>
      </div>

      <div className="feat-grid">
        {[
          { ico:"💵", ttl:"Revenue Tracking",       dsc:"Log daily takings in seconds. GST collected calculated automatically — cash, card or online orders." },
          { ico:"🧾", ttl:"Expense Management",     dsc:"Categorise every expense, flag missing invoices, and never lose a GST credit at BAS time." },
          { ico:"👥", ttl:"Staff & Wages",           dsc:"Full employee records with automatic casual loading, OT, weekend rates, and super calculations." },
          { ico:"⚡", ttl:"Day Workers",             dsc:"Quick-entry for casual staff who work one or two shifts. Pay, super and PAYG calculated instantly." },
          { ico:"🛡️", ttl:"Insurance Dashboard",    dsc:"Workers Comp, Public Liability, Equipment — tracked against your payroll with renewal reminders." },
          { ico:"📦", ttl:"Accountant Pack",         dsc:"Generate a complete financial year summary and BAS support pack, ready to hand to your accountant." },
          { ico:"📁", ttl:"Document Hub",            dsc:"Upload invoices, bank statements and BAS notices. Tagged by quarter, supplier or employee." },
          { ico:"✅", ttl:"Audit Ready",             dsc:"Scans your records for missing invoices, compliance gaps and super issues — so the ATO never catches you off guard." },
        ].map((f,i) => (
          <div key={i} className="feat-card">
            <div className="feat-ico">{f.ico}</div>
            <div className="feat-ttl">{f.ttl}</div>
            <div className="feat-dsc">{f.dsc}</div>
          </div>
        ))}
      </div>

      {/* Why Mise over Xero section */}
      <div style={{ padding:"48px 40px", maxWidth:900, margin:"0 auto" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:10.5, fontWeight:700, color:C.accent, textTransform:"uppercase", letterSpacing:"1px", marginBottom:8 }}>Why Mise</div>
          <div style={{ fontSize:26, fontWeight:700, letterSpacing:"-1px", fontFamily:"'Fraunces', serif" }}>Built for hospitality. Not accountants.</div>
          <div style={{ fontSize:13.5, color:C.muted, marginTop:10, lineHeight:1.7 }}>Xero and MYOB are powerful — but they're built for accountants, not for the person standing behind a counter at 11pm.</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
          {[
            { ico:"⚡", ttl:"Up in 5 minutes", dsc:"No chart of accounts. No reconciliation setup. Just open it and start entering your takings." },
            { ico:"🇦🇺", ttl:"Australian GST & BAS", dsc:"Every calculation is built around Australian tax law — GST, PAYG, Super, BAS quarters and ATO thresholds." },
            { ico:"👷", ttl:"Casual staff made easy", dsc:"Casual loading, weekend rates, day workers, super for one-shift staff — all handled automatically." },
            { ico:"📊", ttl:"Know your BAS before it arrives", dsc:"See your estimated BAS liability every week. No surprises when the quarter ends." },
            { ico:"🔍", ttl:"ATO compliance built in", dsc:"Audit Ready scans your records for the exact issues ATO looks for — missing invoices, cash discrepancies, super gaps." },
            { ico:"💰", ttl:"A fraction of the cost", dsc:"Mise starts free. Even our Pro plan is a fraction of what you'd pay a bookkeeper to do the same work." },
          ].map((f,i) => (
            <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 18px" }}>
              <div style={{ fontSize:20, marginBottom:8 }}>{f.ico}</div>
              <div style={{ fontWeight:700, fontSize:13, marginBottom:5 }}>{f.ttl}</div>
              <div style={{ fontSize:12, color:C.muted, lineHeight:1.65 }}>{f.dsc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="price-sec">
        <div className="price-lbl">Simple Pricing</div>
        <div className="price-ttl">No surprises. Just like your BAS should be.</div>
        <div className="price-grid">
          {[
            { tier:"Starter", price:"$0",  per:"/month", hi:false,
              feats:["Revenue & expense tracking","Up to 3 staff profiles","Basic BAS estimate","Monthly summaries","All business types"] },
            { tier:"Pro",     price:"$29", per:"/month", hi:true,
              feats:["Everything in Starter","Unlimited staff profiles","Timesheets & labour costs","Day Worker quick entry","Insurance dashboard","Audit Ready alerts","Document Hub"] },
            { tier:"Studio",  price:"$79", per:"/month", hi:false,
              feats:["Everything in Pro","Annual Accountant Pack","BAS support summaries","Payroll STP pack","Priority support"] },
          ].map((p,i) => (
            <div key={i} className={`price-card${p.hi?" hi":""}`}>
              <div className="p-tier">{p.tier}</div>
              <div><span className="p-amt">{p.price}</span><span className="p-per">{p.per}</span></div>
              <ul className="p-list">{p.feats.map((f,j) => <li key={j}>{f}</li>)}</ul>
              <button className="btn" style={{ marginTop:14, width:"100%" }} onClick={onGo}>
                {p.tier === "Starter" ? "Get Started Free" : `Choose ${p.tier}`}
              </button>
            </div>
          ))}
        </div>
        <p style={{ fontSize:10.5, color:C.dim, marginTop:16 }}>
          ⚠️ Mise generates management summaries only. Not a substitute for a registered tax agent or accountant.
        </p>
      </div>

      <div style={{ textAlign:"center", padding:"32px 40px 48px", borderTop:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:9, marginBottom:10 }}>
          <div className="logo-box" style={{ width:28, height:28, fontSize:13 }}>M</div>
          <span style={{ fontWeight:700, fontSize:14, letterSpacing:"-.3px" }}>Mise</span>
          <span style={{ color:C.dim, fontSize:12 }}>· Hospitality Finance</span>
        </div>
        <p style={{ fontSize:11, color:C.dim }}>Built in Australia for Australian hospitality and food businesses.</p>
        <p style={{ fontSize:10.5, color:C.dim, marginTop:6 }}>
          Mise is not a registered tax agent. Always consult a professional before lodging with the ATO.
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
          <div className="logo-box">M</div>
          <div><div className="logo-name">Mise</div><div className="logo-sub">HOSPITALITY FINANCE</div></div>
        </div>
        <div className="a-ttl">{mode === "login" ? "Welcome back" : "Create account"}</div>
        <div className="a-sub">{mode === "login" ? "Log in to your dashboard" : "Start your free trial"}</div>
        <div className="a-form">
          {mode === "signup" && (
            <div className="fg">
              <label className="flbl">Business Name</label>
              <input className="inp" placeholder="e.g. The Local Café"/>
            </div>
          )}
          <div className="fg"><label className="flbl">Email</label><input className="inp" type="email" defaultValue="demo@mise.com.au"/></div>
          <div className="fg"><label className="flbl">Password</label><input className="inp" type="password" defaultValue="demo1234"/></div>
          <button className="btn" style={{ width:"100%", padding:11 }} onClick={onLogin}>
            {mode === "login" ? "Log In \u2192" : "Create Account \u2192"}
          </button>
        </div>
        <div className="a-sw">
          {mode === "login"
            ? <><span>No account? </span><a onClick={() => setMode("signup")}>Sign up free</a></>
            : <><span>Have account? </span><a onClick={() => setMode("login")}>Log in</a></>}
        </div>
        <p style={{ fontSize:10.5, color:C.dim, textAlign:"center", marginTop:12 }}>
          Demo account — click Log In to explore
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
    { id:"taxsaver",  ico:"🔍", lbl:"Audit Ready", badge: flagCount > 0 ? `${flagCount} flags` : "PRO" },
    { id:"ias",       ico:"🧾", lbl:"Monthly IAS" },
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
        <div className="logo-box">M</div>
        <div><div className="logo-name">Mise</div><div className="logo-sub">HOSPITALITY FINANCE</div></div>
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
          <div className="psub">My Business · {today.toLocaleString("default",{month:"long"})} {today.getFullYear()}</div>
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
          { lbl:"Super Owed (SGC)",    val:money(rows.reduce((s,t)=>s+t.super,0)), cls:"b", sub:"SGC rate on gross wages" },
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
            <div className="al-ttl">Audit Ready found {flags} issue{flags>1?"s":""} to review</div>
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
function ExpensesPage({ expenses, setExpenses, showToast, industry = "restaurant", dismissed = [], setDismissed }) {
  const [f, setF] = useState({ date:todayStr, cat:"ingredients", amount:"", desc:"", gst:"yes", invoice:"yes" });
  const [search,    setSearch]    = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterGst, setFilterGst] = useState("all");
  const [filterInv, setFilterInv] = useState("all");
  const [filterFrom,setFilterFrom]= useState("");
  const [filterTo,  setFilterTo]  = useState("");
  const [tab,       setTab]       = useState("list");

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
  const sortedCats   = INDUSTRY_MAP[industry] || EXP_CATEGORIES;
  const PINNED_COUNT = { restaurant:4, café:4, bar:6, other:0 }[industry] || 0;
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
    return cfg ? `${cfg.emoji} ${cfg.label}` : cat.charAt(0).toUpperCase()+cat.slice(1);
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
    setF(p => ({...p, cat:id}));
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
      gst:f.gst==="yes", invoice:f.invoice==="yes"
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

    setF({ date:todayStr, cat: personalSortedCats[0] || "ingredients", amount:"", desc:"", gst:"yes", invoice:"yes" });
    setSelCat(null); setSupplier(""); setCatQuery("");
    setAutoSuggest(null); setSuggestDismissed(false);
    setTeachPrompt(null); setManualCat(false);
    setSavingTemplate(false); setTemplateName("");
    showToast("Expense added!");
    catSearchRef.current?.focus();
  };

  // ── Stats ────────────────────────────────────────────────
  const totalExp    = expenses.reduce((s,e) => s + e.amount, 0);
  const gstCreds    = expenses.filter(e => e.gst && e.invoice).reduce((s,e) => s + e.amount/11, 0);
  const missingInv  = expenses.filter(e => e.gst && !e.invoice);
  const missingCred = missingInv.reduce((s,e) => s + e.amount/11, 0);
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
  }).slice().reverse();

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
      ...filtered.map(e => [e.date, e.cat, `"${e.desc}"`, e.amount.toFixed(2), e.gst ? (e.amount/11).toFixed(2) : "0.00", e.invoice ? "Yes" : "No"])
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
              <td style={{textAlign:"right",fontFamily:"DM Mono,monospace",color: e.gst && e.invoice ? "#16A34A" : "#9CA3AF"}}>{e.gst ? money(e.amount/11) : "—"}</td>
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
                    {CAT_CONFIG[rule.cat]?.label} · Last: {money(rule.amount)}
                    {" · "}GST: {rule.gst?"yes":"no"} · Invoice: {rule.invoice?"yes":"no"}
                  </div>
                </div>
                {confirmingRule?.fp === rule.fp ? (
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:11, color:C.dim }}>Amount $</span>
                    <input type="number" id="recur-confirm-amt"
                      value={confirmingRule.amount}
                      onChange={e => setConfirmingRule(r => ({...r, amount: e.target.value}))}
                      onKeyDown={e => { if(e.key==="Enter") { applyRecurringRule({...rule, amount: parseFloat(confirmingRule.amount)||rule.amount}); } if(e.key==="Escape") setConfirmingRule(null); }}
                      style={{ width:80, padding:"4px 8px", borderRadius:6, border:`1px solid ${C.border}`, background:C.surfaceAlt, color:C.text, fontSize:13, fontFamily:"DM Mono,monospace" }}
                      autoFocus/>
                    <button onClick={() => applyRecurringRule({...rule, amount: parseFloat(confirmingRule.amount)||rule.amount})}
                      style={{ background:"#3DC9A0", color:"#0C0F0D", border:"none", borderRadius:7, padding:"6px 13px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                      Fill form ↵
                    </button>
                    <button onClick={() => setConfirmingRule(null)}
                      style={{ background:"none", border:"none", fontSize:12, color:C.muted, cursor:"pointer" }}>✕</button>
                  </div>
                ) : (
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={() => { setConfirmingRule({ fp:rule.fp, amount: String(rule.amount) }); }}
                      style={{ background:"rgba(61,201,160,.12)", color:"#3DC9A0", border:"1px solid rgba(61,201,160,.35)", borderRadius:7, padding:"6px 13px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                      ✓ Log now
                    </button>
                    <button onClick={() => saveRecurringRules(recurringRules.map(r => r.fp===rule.fp ? {...r, active:false} : r))}
                      style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"6px 9px", fontSize:11, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}>
                      Pause
                    </button>
                  </div>
                )}
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

        {/* ── Favourites quick bar (top 4 recently used) ── */}
        {recentTemplates.length > 0 && !showAllTemplates && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:".6px", marginBottom:7 }}>⭐ Quick-add favourites</div>
            <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
              {recentTemplates.map(tpl => (
                <button key={tpl.id} onClick={() => applyTemplate(tpl)}
                  style={{ border:`1.5px solid rgba(212,168,67,.4)`, background:"rgba(212,168,67,.07)", color:C.text, borderRadius:9, padding:"7px 13px", fontSize:12, fontFamily:"inherit", cursor:"pointer", display:"flex", alignItems:"center", gap:6, maxWidth:220, transition:"all .15s", position:"relative" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor=C.yellow; e.currentTarget.style.background="rgba(212,168,67,.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(212,168,67,.4)"; e.currentTarget.style.background="rgba(212,168,67,.07)"; }}>
                  <span style={{ fontSize:16 }}>{CAT_CONFIG[tpl.cat]?.emoji}</span>
                  <div style={{ textAlign:"left" }}>
                    <div style={{ fontWeight:700, fontSize:12, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:140 }}>{tpl.name}</div>
                    <div style={{ fontSize:10, color:C.dim, marginTop:1 }}>
                      {tpl.amount ? `$${tpl.amount} · ` : "variable · "}{CAT_CONFIG[tpl.cat]?.label}
                    </div>
                  </div>
                </button>
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
            <select className="sel" value={f.gst} onChange={e => setF({...f,gst:e.target.value})}>
              <option value="yes">Yes — includes GST</option>
              <option value="no">No — GST-free</option>
            </select>
            {selCat === "liquor_license" && <span className="fhint" style={{color:C.yellow}}>⚠️ Liquor licence has no GST</span>}
            {selCat === "ingredients"    && <span className="fhint" style={{color:C.yellow}}>⚠️ Fresh food may be GST-free</span>}
          </div>
          <div className="fg"><label className="flbl">Tax Invoice on File?</label>
            <select className="sel" value={f.invoice} onChange={e => setF({...f,invoice:e.target.value})}>
              <option value="yes">Yes — received</option>
              <option value="no">No — not yet</option>
            </select>
            {f.invoice==="no" && parseFloat(f.amount)>=82.5 && <span className="fhint" style={{color:C.red}}>⚠️ Over $82.50 — ATO requires invoice!</span>}
          </div>
        </div>

        {/* GST live preview */}
        {parseFloat(f.amount) > 0 && f.gst === "yes" && (
          <div style={{ background:"rgba(61,201,160,.06)", border:"1px solid rgba(61,201,160,.2)", borderRadius:10, padding:"11px 15px", margin:"12px 0", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
            <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
              {[
                { lbl:"Total (incl. GST)",  val:money(parseFloat(f.amount)||0) },
                { lbl:"GST component",       val:money((parseFloat(f.amount)||0)/11) },
                { lbl:"Net (ex-GST)",        val:money((parseFloat(f.amount)||0)/11*10) },
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
        )}

        <div className="fbtns">
          <button className="btn" onClick={add}>+ Add Expense</button>
          <button className="btn-g" onClick={() => { setF({date:todayStr,cat:personalSortedCats[0]||"ingredients",amount:"",desc:"",gst:"yes",invoice:"yes"}); setSelCat(null); setSupplier(""); setCatQuery(""); setAutoSuggest(null); setSuggestDismissed(false); setTeachPrompt(null); setManualCat(false); setSavingTemplate(false); setTemplateName(""); }}>Clear</button>
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

      {/* ── Tabs ── */}
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {[["list","📋 List"],["charts","📊 Charts"]].map(([t,lbl]) => (
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

          <table className="tbl">
            <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>GST Credit</th><th>Invoice</th><th></th></tr></thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">🧾</div><div className="empty-txt">{hasFilters ? "No expenses match your filters." : "No expenses yet."}</div></div></td></tr>
                : filtered.map(e => {
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
                          {e.gst ? (e.invoice ? money(e.amount/11) : <span style={{ color:C.red }}>Need invoice</span>) : "—"}
                        </td>
                        <td>{e.invoice ? <span className="pill pl-g">✅ Yes</span> : <span className="pill pl-r">❌ No</span>}</td>
                        <td><button className="btn-ic" onClick={() => { setExpenses(p => p.filter(x => x.id !== e.id)); showToast("Expense deleted"); }}>🗑️</button></td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
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
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", marginBottom:10 }}>Weekly Cost Preview</div>
            <div className="frow4">
              {(() => {
                const wkPayg  = calcWeeklyPAYG(wkGross, f.tfn === "yes");
                const superR  = getSuperRate(todayWeekStr);
                const wkSuper = wkGross * superR;
                return [
                  { lbl:"Gross Wages",                          val:money(wkGross),          col:C.text   },
                  { lbl:`PAYG (ATO Scale 2${f.tfn==="no"?" 47%":""})`, val:money(wkPayg), col:C.yellow },
                  { lbl:`Super (SGC ${(superR*100).toFixed(1)}%)`,      val:money(wkSuper),  col:C.blue   },
                  { lbl:"Total Labour Cost",                    val:money(wkGross+wkSuper),  col:C.accent },
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
            <div style={{ fontSize:10, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".8px", marginBottom:9 }}>This Week's Costs</div>
            <div className="frow4">
              {(() => {
                const tsPayg  = calcWeeklyPAYG(gross, emp?.tfn === "yes");
                const superR  = getSuperRate(f.week || todayWeekStr);
                const tsSuper = gross * superR;
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
          <button className="btn" onClick={save}>Log Hours</button>
          <button className="btn-g" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  SHIFT MODAL
// ════════════════════════════════════════════════════════════
function ShiftModal({ employees, initial, onSave, onClose }) {
  const [f, setF] = useState({
    id:         initial.id         || null,
    eid:        initial.eid        || (employees[0]?.id || ""),
    date:       initial.date       || todayStr,
    start:      initial.start      || "09:00",
    end:        initial.end        || "17:00",
    break_mins: initial.break_mins != null ? initial.break_mins : 30,
    note:       initial.note       || "",
  });
  const upd = k => e => setF(p => ({...p, [k]: e.target.value}));

  const netMins = () => {
    const [sh,sm] = f.start.split(":").map(Number);
    const [eh,em] = f.end.split(":").map(Number);
    return Math.max(0, (eh*60+em) - (sh*60+sm) - (parseInt(f.break_mins)||0));
  };
  const hrs = (netMins() / 60);
  const emp = employees.find(e => e.id === parseInt(f.eid));
  const er  = emp ? effRate(emp) : 0;
  const day = (() => { const [y,m,d] = f.date.split('-').map(Number); return new Date(y,m-1,d).getDay(); })();
  const isWknd = day === 0 || day === 6;
  const rate = isWknd ? er * WKND_RATE : er;
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
            <div className="fg">
              <label className="flbl">Start Time</label>
              <input type="time" className="inp" value={f.start} onChange={upd("start")}/>
            </div>
            <div className="fg">
              <label className="flbl">End Time</label>
              <input type="time" className="inp" value={f.end} onChange={upd("end")}/>
            </div>
          </div>
          {hrs > 0 && emp && (
            <div style={{background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 13px",fontSize:12,lineHeight:1.7,marginTop:2}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{color:C.muted}}>Net hours</span>
                <span className="mono" style={{fontWeight:700}}>{hrs.toFixed(2)}h</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{color:C.muted}}>Rate {isWknd ? <span style={{background:"#FEF3C7",borderRadius:4,padding:"1px 5px",fontSize:10,color:"#92400E"}}>Weekend ×1.75</span> : "Weekday"}</span>
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
            if (!f.eid || !f.date || !f.start || !f.end) return;
            onSave({...f, eid:parseInt(f.eid), break_mins:parseInt(f.break_mins)||0});
          }}>{f.id ? "Save Changes" : "Add Shift"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Roster PDF renderer — LANDSCAPE, employee-facing ─────
const renderRosterPDF = ({ employees, weekShifts, weekDays, weekStart, weekEnd, isoDate, shiftHrs }) => {
  const pdf = new MiniPDF(true);   // landscape: 842 × 595
  const W = pdf.W, H = pdf.H, M = pdf.M;
  const DAY_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  // ASCII-safe — MiniPDF drops anything above 0x7E
  const safe    = str => String(str||'').replace(/[\u2013\u2014]/g,'-').replace(/[^\x20-\x7E]/g,'');
  const safeDt  = d   => {
    const dd = String(d.getDate()).padStart(2,'0');
    const mo  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    return `${dd} ${mo}`;
  };

  // ── Compact landscape header ───────────────────────────
  // Logo block (left)
  pdf.rect(M, 14, 28, 28, { fill:'#8FCB72' });
  pdf.text(M+5, 17, 'M', { size:14, bold:true, color:'#0C0F0D' });
  pdf.text(M+34, 17, 'Mise', { size:11, bold:true, color:'#0C0F0D' });
  pdf.text(M+34, 29, 'HOSPITALITY FINANCE', { size:6, color:'#9CA3AF' });
  // Centre title
  pdf.text(W/2, 14, 'STAFF SCHEDULE', { size:7.5, color:'#9CA3AF', align:'center' });
  pdf.text(W/2, 25, 'Weekly Roster', { size:16, bold:true, color:'#111111', align:'center' });
  // Right: week + date
  pdf.text(W-M, 14, safe(`${weekStart} - ${weekEnd}`), { size:9,   bold:true, color:'#111111', align:'right' });
  pdf.text(W-M, 26, `Generated: ${todayStr}`,           { size:7,   color:'#9CA3AF',           align:'right' });
  // Separator
  pdf.line(M, 48, W-M, 48, { color:'#E5E7EB', w:1.2 });
  let y = 56;

  // ── Table layout ────────────────────────────────────────
  // nameW wide enough for name + role; dayW fills the rest evenly across 7 days
  const nameW = 110;
  const usable = W - M*2 - nameW;
  const dayW   = Math.floor(usable / 7);
  const tableW = nameW + dayW * 7;

  // Estimate row heights to see if everything fits on one page
  const rowHeights = employees.map(emp => {
    const max = Math.max(1, ...weekDays.map(d =>
      weekShifts.filter(s => s.eid===emp.id && s.date===isoDate(d)).length
    ));
    return Math.max(44, max * 36 + 10);
  });
  const hdrH   = 32;
  const totalTblH = hdrH + rowHeights.reduce((s,h) => s+h, 0);
  // If it all fits in remaining space, keep y; else scale row heights down
  const availH  = H - y - 40; // leave 40pt for disclaimer
  const scale   = totalTblH > availH ? availH / totalTblH : 1;
  const scaledRows = rowHeights.map(h => Math.max(30, Math.round(h * scale)));

  // ── Table header ────────────────────────────────────────
  pdf.rect(M, y, tableW, hdrH, { fill:'#111827' });
  pdf.text(M+8, y+11, 'Staff', { size:9, bold:true, color:'#FFFFFF' });

  weekDays.forEach((d, i) => {
    const cx   = M + nameW + i * dayW;
    const wknd = d.getDay()===0 || d.getDay()===6;
    if (wknd) pdf.rect(cx, y, dayW, hdrH, { fill:'#78350F' });
    pdf.text(cx + dayW/2, y+8,  DAY_SHORT[i], { size:9,   bold:true, color: wknd?'#FDE68A':'#FFFFFF', align:'center' });
    pdf.text(cx + dayW/2, y+20, safeDt(d),    { size:7.5,            color:'#9CA3AF',                  align:'center' });
  });
  y += hdrH;

  // ── Employee rows ────────────────────────────────────────
  employees.forEach((emp, ei) => {
    const rH        = scaledRows[ei];
    const empShifts = weekShifts.filter(s => s.eid === emp.id);

    // Alternating row bg
    if (ei % 2 === 1) pdf.rect(M, y, tableW, rH, { fill:'#F8FAFC' });

    // Left border
    pdf.line(M, y, M, y+rH, { color:'#CBD5E1', w:0.5 });

    // Name + role — vertically centred
    const nameMid = y + rH/2;
    pdf.text(M+8,  nameMid-5, safe(emp.name),    { size:10,  bold:true, color:'#111111' });
    pdf.text(M+8,  nameMid+7, safe(emp.role||''), { size:7.5,            color:'#94A3B8' });

    // Day cells
    weekDays.forEach((d, di) => {
      const cx        = M + nameW + di * dayW;
      const wknd      = d.getDay()===0 || d.getDay()===6;
      const dayShifts = empShifts.filter(s => s.date === isoDate(d));

      pdf.line(cx, y, cx, y+rH, { color:'#CBD5E1', w:0.4 });
      if (wknd) pdf.rect(cx, y, dayW, rH, { fill: ei%2===1 ? '#FEF9EC' : '#FFFBEB' });

      if (dayShifts.length === 0) {
        // subtle dash
        pdf.text(cx + dayW/2, y + rH/2 - 4, '-', { size:10, color:'#CBD5E1', align:'center' });
      } else {
        const slotH   = rH / dayShifts.length;
        dayShifts.forEach((sh, si) => {
          const sy      = y + si * slotH;
          const hrs     = shiftHrs(sh);
          const timeStr = safe(`${sh.start}-${sh.end}`);
          const hrsStr  = `${hrs.toFixed(1)}h`;
          const fillC   = wknd ? '#FEF3C7' : '#F0FDF4';
          const bordC   = wknd ? '#F59E0B' : '#34D399';
          const timeC   = wknd ? '#92400E' : '#065F46';
          const hrsC    = wknd ? '#B45309' : '#059669';
          // Pill — 4pt inset all sides
          const pH = Math.max(22, slotH - 8);
          const py = sy + (slotH - pH) / 2;
          pdf.rect(cx+4, py, dayW-8, pH, { fill:fillC, stroke:bordC });
          // Time — bigger, prominent
          pdf.text(cx + dayW/2, py + pH*0.32, timeStr, { size:9,   bold:true, color:timeC, align:'center' });
          // Hours — smaller, below
          pdf.text(cx + dayW/2, py + pH*0.68, hrsStr,  { size:7.5,            color:hrsC,  align:'center' });
        });
      }
    });

    // Right border
    pdf.line(M+tableW, y, M+tableW, y+rH, { color:'#CBD5E1', w:0.5 });
    // Row bottom
    pdf.line(M, y+rH, M+tableW, y+rH, { color:'#CBD5E1', w: ei===employees.length-1 ? 1 : 0.5 });
    y += rH;
  });

  // ── Footer disclaimer (minimal — this is for employees) ──
  y += 10;
  pdf.text(M, y, 'This roster is subject to change. Contact your manager with any queries.', { size:7, color:'#9CA3AF' });
  pdf.text(W-M, y, `Mise Hospitality Finance  |  ${todayStr}`, { size:7, color:'#CBD5E1', align:'right' });

  return pdf;
};

// ════════════════════════════════════════════════════════════
//  ROSTER TAB
// ════════════════════════════════════════════════════════════
function RosterTab({ employees, roster, setRoster, showToast }) {
  // ── Week navigation ───────────────────────────────────────
  const [viewMonday, setViewMonday] = useState(() => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); // back to Monday
    d.setHours(0,0,0,0);
    return d;
  });
  const [shiftModal, setShiftModal] = useState(null); // null | {date,eid?} | shift

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
      if (isWeekend(sh.date)) {
        // Weekend: always WKND_RATE, not counted toward weekday OT threshold
        result.set(sh.id, {
          stdHrs:0, otHrs:0, wkndHrs:hrs,
          stdPay:0, otPay:0, wkndPay: er * WKND_RATE * hrs,
          gross: er * WKND_RATE * hrs,
          isOT: false, isWknd: true,
        });
      } else {
        // Weekday: split at threshold
        const alreadyUsed = weekdayBucket;
        const stdPortion  = Math.max(0, Math.min(hrs, threshold - alreadyUsed));
        const otPortion   = hrs - stdPortion;
        weekdayBucket    += hrs;
        const stdPay  = er          * stdPortion;
        const otPay   = er * OT_RATE * otPortion;
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
  const empColor = emp => avatarBg(emp.id);

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

  const empSummary = employees.map(emp => {
    const shifts    = weekShifts.filter(s => s.eid === emp.id);
    const bd        = empBreakdowns.get(emp.id) || new Map();
    const totalHrs  = shifts.reduce((s,sh) => s + shiftHrs(sh), 0);
    const stdHrs    = [...bd.values()].reduce((s,v) => s + v.stdHrs,  0);
    const otHrs     = [...bd.values()].reduce((s,v) => s + v.otHrs,   0);
    const wkndHrs   = [...bd.values()].reduce((s,v) => s + v.wkndHrs, 0);
    const gross     = [...bd.values()].reduce((s,v) => s + v.gross,    0);
    const super_    = gross * superR;
    const payg      = calcWeeklyPAYG(gross, emp.tfn);
    const net       = gross - payg;
    const labour    = gross + super_;
    return { emp, shifts, totalHrs, stdHrs, otHrs, wkndHrs, gross, super:super_, payg, net, labour };
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

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      {shiftModal && (
        <ShiftModal employees={employees} initial={shiftModal} onSave={saveShift} onClose={() => setShiftModal(null)}/>
      )}

      {/* ── Week navigator ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,gap:8}}>
        <div style={{display:"flex",gap:6}}>
          <button className="btn-b" onClick={prevWeek}>← Prev</button>
          <button className="btn-b" onClick={thisWeek}>Today</button>
          <button className="btn-b" onClick={nextWeek}>Next →</button>
        </div>
        <div style={{fontWeight:700,fontSize:15,letterSpacing:"-.3px"}}>
          📅 Week of {weekStart} – {weekEnd}
        </div>
        <div style={{display:"flex",gap:6}}>
          <button className="btn-b" onClick={exportRosterPDF}>⬇️ Export PDF</button>
          <button className="btn" onClick={() => setShiftModal({date:isoDate(weekDays[0])})}>
            + Add Shift
          </button>
        </div>
      </div>

      {/* ── Roster Grid ── */}
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
            {employees.map((emp,ei) => {
              const col = empColor(emp);
              const empWeekShifts = weekShifts.filter(s => s.eid===emp.id);
              const empHrs  = empWeekShifts.reduce((s,sh) => s+shiftHrs(sh), 0);
              const empCost = empWeekShifts.reduce((s,sh) => s+shiftCost(sh), 0);
              const empOTHrs = [...(empBreakdowns.get(emp.id)||new Map()).values()].reduce((s,v)=>s+v.otHrs,0);
              return (
                <tr key={emp.id} style={{background: ei%2===0 ? C.surface : C.surfaceAlt}}>
                  {/* Employee name cell */}
                  <td style={{padding:"8px 10px",borderBottom:`1px solid ${C.border}`,verticalAlign:"middle"}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:col,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",flexShrink:0}}>
                        {initials(emp.name)}
                      </div>
                      <div>
                        <div style={{fontWeight:600,fontSize:11.5,letterSpacing:"-.2px"}}>{emp.name}</div>
                        <div style={{fontSize:9.5,color:C.muted}}>{money(effRate(emp))}/hr · {emp.std_hrs}h/wk</div>
                        {empOTHrs > 0 && <div style={{fontSize:9,fontWeight:700,color:"#DC2626",marginTop:1}}>⚡ {empOTHrs.toFixed(1)}h OT</div>}
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
                          return (
                            <div key={sh.id} style={{
                              background: (hasOT ? "#DC2626" : isWknd ? "#D97706" : col)+"18",
                              borderLeft: `3px solid ${borderC}`,
                              borderRadius:5,
                              padding:"4px 6px",
                              marginBottom:3,
                              cursor:"pointer",
                              position:"relative",
                            }}
                              onClick={() => setShiftModal(sh)}
                            >
                              <div style={{fontSize:10,fontWeight:700,color:borderC,lineHeight:1.2}}>{sh.start}–{sh.end}</div>
                              <div style={{fontSize:9,color:C.muted,marginTop:1}}>
                                {shiftHrs(sh).toFixed(1)}h
                              </div>
                              {/* OT / Weekend rate badge */}
                              {hasOT && (
                                <div style={{fontSize:8,fontWeight:700,color:"#DC2626",marginTop:1}}>
                                  ⚡ {sd.otHrs.toFixed(1)}h OT ×1.5
                                </div>
                              )}
                              {isWknd && (
                                <div style={{fontSize:8,fontWeight:700,color:"#D97706",marginTop:1}}>
                                  ×1.75 Wknd
                                </div>
                              )}
                              {sh.note && <div style={{fontSize:8.5,color:C.dim,marginTop:1,fontStyle:"italic",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:85}}>{sh.note}</div>}
                              <button
                                style={{position:"absolute",top:2,right:3,background:"none",border:"none",cursor:"pointer",fontSize:9,color:"#DC2626",padding:0,lineHeight:1,opacity:.7}}
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
            <tr style={{background:"#F3F4F6"}}>
              <td style={{padding:"7px 10px",fontWeight:700,fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:".4px"}}>Day Total</td>
              {weekDays.map((d,di) => {
                const date = isoDate(d);
                const dayShifts = weekShifts.filter(s => s.date===date);
                const dayHrs  = dayShifts.reduce((s,sh)=>s+shiftHrs(sh), 0);
                const dayCost = dayShifts.reduce((s,sh)=>s+shiftCost(sh), 0);
                return (
                  <td key={di} style={{padding:"7px 4px",textAlign:"center",borderLeft:`1px solid ${C.border}`}}>
                    <div className="mono" style={{fontWeight:700,fontSize:11,color:dayHrs>0?C.text:C.dim}}>{dayHrs>0?`${dayHrs.toFixed(1)}h`:"—"}</div>
                  </td>
                );
              })}
              <td style={{padding:"7px 10px",textAlign:"right",borderLeft:`1px solid ${C.border}`}}>
                <div className="mono" style={{fontWeight:700,fontSize:12}}>{totHrs.toFixed(1)}h</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Labour Cost Summary ── */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:"18px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:14}}>💰 Labour Cost Summary — {weekStart} to {weekEnd}</div>
          <div style={{fontSize:10,color:C.muted}}>Super @ {(superR*100).toFixed(1)}% · ATO 2024-25 progressive PAYG</div>
        </div>

        {/* Stat cards — now includes OT hours */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:16}}>
          {[
            {lbl:"Total Hours",    val:`${totHrs.toFixed(1)}h`,                                           cls:"",  ico:"🕐"},
            {lbl:"Std Hours",      val:`${empSummary.reduce((s,e)=>s+e.stdHrs,0).toFixed(1)}h`,           cls:"",  ico:"📋"},
            {lbl:"OT Hours ×1.5",  val:`${empSummary.reduce((s,e)=>s+e.otHrs,0).toFixed(1)}h`,           cls:empSummary.some(e=>e.otHrs>0)?"r":"", ico:"⚡"},
            {lbl:"Wknd Hrs ×1.75", val:`${empSummary.reduce((s,e)=>s+e.wkndHrs,0).toFixed(1)}h`,         cls:"y", ico:"📅"},
            {lbl:"Total Labour",   val:money(totLabour),                                                  cls:"g", ico:"📊"},
          ].map((c,i) => (
            <div key={i} className="card" style={{display:"flex",flexDirection:"column",gap:4}}>
              <div className="clbl">{c.ico} {c.lbl}</div>
              <div className={`cval ${c.cls}`}>{c.val}</div>
            </div>
          ))}
        </div>

        {/* Per-employee breakdown table */}
        {totHrs > 0 ? (
          <div style={{overflowX:"auto"}}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{textAlign:"left"}}>Employee</th>
                  <th style={{textAlign:"right"}}>Std Hrs</th>
                  <th style={{textAlign:"right",color:"#DC2626"}}>OT Hrs ×1.5</th>
                  <th style={{textAlign:"right",color:"#D97706"}}>Wknd Hrs ×1.75</th>
                  <th style={{textAlign:"right"}}>Gross Pay</th>
                  <th style={{textAlign:"right"}}>PAYG (ATO)</th>
                  <th style={{textAlign:"right"}}>Super ({(superR*100).toFixed(1)}%)</th>
                  <th style={{textAlign:"right"}}>Labour Cost</th>
                </tr>
              </thead>
              <tbody>
                {empSummary.filter(e => e.shifts.length > 0).map(({emp,shifts,totalHrs,stdHrs,otHrs,wkndHrs,gross,super:sup,payg,net,labour}) => (
                  <tr key={emp.id}>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <div style={{width:22,height:22,borderRadius:"50%",background:empColor(emp),display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff",flexShrink:0}}>
                          {initials(emp.name)}
                        </div>
                        <div>
                          <div style={{fontWeight:600,fontSize:12}}>{emp.name}</div>
                          <div style={{fontSize:9.5,color:C.muted}}>{emp.role} · {emp.std_hrs}h threshold</div>
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
function WagesPage({ employees, setEmployees, timesheets, setTimesheets, roster, setRoster, leave, setLeave, showToast }) {
  const [tab,        setTab]        = useState("roster");
  const [empModal,   setEmpModal]   = useState(null);
  const [tsModal,    setTsModal]    = useState(false);
  const [dayWorkers, setDayWorkers] = useState([]);
  const [bizName,    setBizName]    = useState("My Restaurant");
  const [bizABN,     setBizABN]     = useState("");
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
          {tab === "timesheets" && <button className="btn" onClick={() => setTsModal(true)}>+ Log Hours</button>}        </div>
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
        <RosterTab employees={employees} roster={roster} setRoster={setRoster} showToast={showToast}/>
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
  const [selEmp,    setSelEmp]    = useState("");
  const [selWeek,   setSelWeek]   = useState("");
  const [showPrint, setShowPrint] = useState(false);

  // Build week options from existing timesheets
  const weeks = [...new Set(timesheets.map(t => t.week))].sort().reverse();

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
    const super_  = gross * superR;
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
            {infoRow("Overtime Hours", `${totals.ot_hrs}h`)}
            {infoRow("Weekend/PH Hours", `${totals.wknd_hrs}h`)}
            {infoRow("Total Hours", `${totals.std_hrs+totals.ot_hrs+totals.wknd_hrs}h`)}
          </div>
        </div>

        {/* Hours table */}
        <div className="pp-sec-ttl" style={{marginBottom:8}}>Hours &amp; Earnings Breakdown</div>
        <table className="pp-tbl" style={{marginBottom:20}}>
          <thead><tr>
            <th>Pay Week</th><th style={{textAlign:"right"}}>Std Hrs</th><th style={{textAlign:"right"}}>OT Hrs</th><th style={{textAlign:"right"}}>Wknd Hrs</th>
            <th style={{textAlign:"right"}}>Std Pay</th><th style={{textAlign:"right"}}>OT Pay</th><th style={{textAlign:"right"}}>Wknd Pay</th><th style={{textAlign:"right"}}>Gross</th>
          </tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{fontSize:11}}>{r.week}</td>
                <td style={{textAlign:"right"}}>{r.std_hrs}h</td>
                <td style={{textAlign:"right"}}>{r.ot_hrs}h</td>
                <td style={{textAlign:"right"}}>{r.wknd_hrs}h</td>
                <td style={{textAlign:"right",fontFamily:"DM Mono,monospace"}}>{money(effR * r.std_hrs)}</td>
                <td style={{textAlign:"right",fontFamily:"DM Mono,monospace"}}>{r.ot_hrs > 0 ? money(effR * OT_RATE * r.ot_hrs) : "—"}</td>
                <td style={{textAlign:"right",fontFamily:"DM Mono,monospace"}}>{r.wknd_hrs > 0 ? money(effR * WKND_RATE * r.wknd_hrs) : "—"}</td>
                <td style={{textAlign:"right",fontFamily:"DM Mono,monospace",fontWeight:700}}>{money(r.gross)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td style={{fontWeight:700}}>TOTAL</td>
              <td style={{textAlign:"right",fontWeight:700}}>{totals.std_hrs}h</td>
              <td style={{textAlign:"right",fontWeight:700}}>{totals.ot_hrs}h</td>
              <td style={{textAlign:"right",fontWeight:700}}>{totals.wknd_hrs}h</td>
              <td colSpan={3}></td>
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
          💡 <strong>Super note:</strong> {money(totals.super)} (@ {(totals.superR*100).toFixed(1)}%) must be paid to {emp.superfund || "the nominated fund"} within 28 days of quarter end. Late payments attract the Super Guarantee Charge (SGC) — not tax deductible.
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
              <div style={{ width:44, height:44, borderRadius:"50%", background:avatarBg(emp.id), display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:"#fff" }}>
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
                <div style={{ fontSize:11.5, color:C.muted, marginTop:2 }}>Pay to {emp.superfund || "nominated fund"} within 28 days of quarter end</div>
              </div>
              <span className="mono" style={{ fontSize:17, fontWeight:700, color:C.teal }}>{money(totals.super)}</span>
            </div>
            {!emp.tfn && (
              <div style={{ marginTop:10, padding:"10px 14px", background:"rgba(212,168,67,.1)", border:"1px solid rgba(212,168,67,.3)", borderRadius:9, fontSize:12, color:C.yellow }}>
                ⚠️ <strong>No TFN on file</strong> — PAYG withheld at 47%. Ask employee to provide their TFN to apply ATO Scale 2 progressive rates.
              </div>
            )}
          </div>

          {/* Generate button */}
          <div style={{ display:"flex", gap:10 }}>
            <button className="btn" style={{ fontSize:14, padding:"12px 28px" }} onClick={() => { setShowPrint(true); showToast(`Payslip ready for ${emp.name} ✅`); }}>
              🖨️ Generate & Print Payslip
            </button>
            <button className="btn-g" onClick={() => { setSelEmp(""); setSelWeek(""); }}>
              Clear
            </button>
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

      <div className="disc">
        <div className="d-ttl">⚠️ Payslip Disclaimer</div>
        <div className="d-txt">Payslips are generated from timesheet data entered in Mise. PAYG withholding uses ATO 2024-25 progressive Scale 2 rates for employees with a TFN on file, and 47% flat for employees without a TFN (ATO statutory no-TFN rate). These payslips are for internal record-keeping and employee reference only. For STP lodgement and ATO-certified payroll reporting, consult a registered BAS agent or use ATO-approved payroll software. Retain payslip records for 7 years as required by the ATO.</div>
      </div>

      {showPrint && emp && (
        <PrintModal title={`Payslip — ${emp.name}`} onClose={() => setShowPrint(false)}
          onExport={() => renderPayslipPDF({emp, rows, totals, payPeriodLabel, bizName, bizABN})}>
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
              { icon:"💰", title:"Superannuation", col:C.blue, text:"Since 2022, there is NO minimum earnings threshold. Even $50 of wages requires Super at the current SGC rate. You must pay it within 28 days of the end of each quarter." },
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
            Super must be paid to each worker's fund within 28 days of the end of each quarter. 
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
          {insurance.map(ins => {
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
          <div className="bas-row"><span className="bas-lbl">PAYG Withheld (ATO Scale 2)</span><span className="bas-val" style={{ color:C.yellow }}>{money(totalPayg)}</span></div>
          <div className="bas-row"><span className="bas-lbl">Super (SGC) (SGC)</span><span className="bas-val" style={{ color:C.blue }}>{money(totalSuper)}</span></div>
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
            <div className="bctit">📚 Common Business Deduction Categories</div>
            <table className="tbl">
              <thead><tr><th>Category</th><th>Examples</th><th>GST Claimable?</th><th>Industry</th><th>Notes</th></tr></thead>
              <tbody>
                {[
                  // ── Universal ──
                  { cat:"🥩 Ingredients / Food",   ex:"Produce, meat, dairy, dry goods",       gst:"Usually yes", ind:"All",   note:"Fresh unprocessed food may be GST-free" },
                  { cat:"📦 Packaging",             ex:"Containers, bags, wrap",                gst:"Yes",         ind:"All",   note:"Cost of sale — fully deductible" },
                  { cat:"♻️ Eco-Packaging",         ex:"Compostable cups, biodegradable wrap",  gst:"Yes",         ind:"Café",  note:"Same treatment as standard packaging" },
                  { cat:"🧹 Cleaning & Hygiene",    ex:"Detergents, sanitiser, pest control",   gst:"Yes",         ind:"All",   note:"Essential operational expense" },
                  { cat:"🏠 Rent",                  ex:"Commercial lease payments",             gst:"Yes",         ind:"All",   note:"Commercial rent includes GST" },
                  { cat:"⚡ Utilities",             ex:"Electricity, gas, water",               gst:"Yes",         ind:"All",   note:"Keep quarterly bills as invoices" },
                  { cat:"🔧 Equipment",             ex:"Fridges, ovens, POS systems",           gst:"Yes",         ind:"All",   note:"Instant asset write-off may apply" },
                  { cat:"🔨 Repairs & Maintenance", ex:"Plumber, electrician, general repairs", gst:"Yes",         ind:"All",   note:"Ongoing maintenance fully deductible" },
                  { cat:"💻 Software & POS",        ex:"Xero, MYOB, booking & POS apps",       gst:"Yes",         ind:"All",   note:"Fully deductible subscription" },
                  { cat:"📣 Advertising",           ex:"Facebook, Google, print, signage",      gst:"Yes",         ind:"All",   note:"All marketing costs deductible" },
                  { cat:"📋 Accounting",            ex:"BAS agent, bookkeeper, tax agent",      gst:"Yes",         ind:"All",   note:"Professional fees fully deductible" },
                  { cat:"👕 Staff Uniforms",        ex:"Aprons, caps, branded workwear",        gst:"Yes",         ind:"All",   note:"Must be distinctive/compulsory to claim" },
                  { cat:"🛵 Delivery Platform Fees",ex:"Uber Eats, DoorDash, Menulog fees",     gst:"Yes",         ind:"All",   note:"Commission fees are a deductible expense" },
                  { cat:"🎵 Music & Entertainment", ex:"Spotify, APRA/PPCA licence, DJ",        gst:"Yes",         ind:"All",   note:"APRA/PPCA licence required to play music" },
                  { cat:"🍽️ Smallwares & Crockery", ex:"Plates, cutlery, trays, ramekins",      gst:"Yes",         ind:"All",   note:"Replace regularly — keep receipts" },
                  // ── Bar / Pub ──
                  { cat:"📜 Liquor License",        ex:"Liquor licence fee, annual levy",       gst:"No",          ind:"Bar",   note:"Government fees — no GST, still deductible" },
                  { cat:"🥃 Spirit Stock",          ex:"Whisky, vodka, gin, rum, liqueurs",     gst:"Yes",         ind:"Bar",   note:"Stock on hand is not deductible until sold" },
                  { cat:"🍺 Beer & Wine Stock",     ex:"Kegs, bottled beer, wine, cider",       gst:"Yes",         ind:"Bar",   note:"Stock on hand is not deductible until sold" },
                  { cat:"🍷 Glassware",             ex:"Pint glasses, wine glasses, tumblers",  gst:"Yes",         ind:"Bar",   note:"Replace regularly — keep receipts" },
                  { cat:"🸹 Bar Equipment",         ex:"Ice machine, shakers, bar fridges",     gst:"Yes",         ind:"Bar",   note:"Instant asset write-off may apply" },
                  { cat:"🪪 RSA Training",          ex:"Responsible service of alcohol course", gst:"Yes",         ind:"Bar",   note:"Staff training — fully deductible" },
                  // ── Café ──
                  { cat:"☕ Coffee Supplies",       ex:"Beans, milk, oat milk, filters",        gst:"Yes",         ind:"Café",  note:"Milk may vary — check GST-free rules" },
                  { cat:"⚙️ Machine Maintenance",  ex:"Espresso machine service, descaling",   gst:"Yes",         ind:"Café",  note:"Keep service records as invoices" },
                  { cat:"🥐 Bakery Supplies",       ex:"Flour, sugar, butter, pastry items",    gst:"Usually yes", ind:"Café",  note:"Unprocessed food ingredients may be GST-free" },
                ].map((r,i) => (
                  <tr key={i}>
                    <td style={{ fontWeight:600 }}>{r.cat}</td>
                    <td style={{ color:C.muted, fontSize:11.5 }}>{r.ex}</td>
                    <td><span className={`pill ${r.gst==="Yes"?"pl-g":r.gst==="No"?"pl-r":"pl-y"}`}>{r.gst}</span></td>
                    <td><span style={{ fontSize:10, padding:"2px 7px", borderRadius:10, background:r.ind==="Bar"?"rgba(91,159,212,.12)":r.ind==="Café"?"rgba(212,168,67,.12)":"rgba(143,203,114,.1)", color:r.ind==="Bar"?C.blue:r.ind==="Café"?C.yellow:C.green, fontWeight:600 }}>{r.ind}</span></td>
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
        <div className="d-txt">Audit Ready provides <strong>educational guidance only</strong> based on general ATO rules. It does not constitute financial, taxation, or legal advice. Always confirm with a <strong>registered tax agent or accountant</strong> before lodging your BAS or tax return. Visit <strong>ato.gov.au</strong> for official guidance.</div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════════
function SettingsPage({ industry, setIndustry, showToast }) {
  const [saved, setSaved] = useState(false);

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

      {/* ── Industry Selector ── */}
      <div className="fsec">
        <div className="ftit">Business Type</div>
        <div style={{ fontSize:12.5, color:C.muted, marginBottom:14, lineHeight:1.6 }}>
          Tell Mise what kind of business you run. Your expense categories, Audit Ready tips and deduction guides will automatically adjust to match your industry.
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
          {INDUSTRIES.map(ind => {
            const active = industry === ind.id;
            return (
              <button key={ind.id} onClick={() => { setIndustry(ind.id); showToast(`Switched to ${ind.label} mode ✅`); }}
                style={{
                  background: active ? "rgba(143,203,114,.12)" : C.surface,
                  border: `2px solid ${active ? C.accent : C.border}`,
                  borderRadius: 12, padding:"16px 12px", cursor:"pointer",
                  fontFamily:"inherit", textAlign:"center", transition:"all .2s",
                  transform: active ? "scale(1.02)" : "scale(1)",
                }}>
                <div style={{ fontSize:28, marginBottom:8 }}>{ind.emoji}</div>
                <div style={{ fontWeight:700, fontSize:13, color: active ? C.accent : C.text, marginBottom:4 }}>{ind.label}</div>
                <div style={{ fontSize:10.5, color:C.muted, lineHeight:1.4 }}>{ind.desc}</div>
                {active && <div style={{ marginTop:8, fontSize:10, fontWeight:700, color:C.accent }}>✓ ACTIVE</div>}
              </button>
            );
          })}
        </div>

        {/* What changes panel */}
        <div style={{ marginTop:14, background:C.surfaceAlt, borderRadius:10, padding:"13px 15px", fontSize:12, color:C.muted, lineHeight:1.8 }}>
          <div style={{ fontWeight:700, color:C.text, marginBottom:6 }}>
            {INDUSTRIES.find(i=>i.id===industry)?.emoji} Currently set to: <span style={{color:C.accent}}>{INDUSTRIES.find(i=>i.id===industry)?.label}</span>
          </div>
          {industry === "restaurant" && <>
            <div>✅ Expense categories show <strong style={{color:C.text}}>Ingredients, Packaging, Cleaning</strong> first</div>
            <div>✅ Audit Ready tips focus on <strong style={{color:C.text}}>food GST rules</strong> and cash revenue</div>
          </>}
          {industry === "café" && <>
            <div>✅ Expense categories show <strong style={{color:C.text}}>Coffee Supplies, Machine Maintenance, Eco-Packaging</strong> first</div>
            <div>✅ Bakery Supplies and takeaway packaging highlighted</div>
            <div>✅ Audit Ready tips include <strong style={{color:C.text}}>GST-free fresh food rules</strong></div>
          </>}
          {industry === "bar" && <>
            <div>✅ Expense categories show <strong style={{color:C.text}}>Spirit Stock, Beer & Wine, Glassware, Liquor License</strong> first</div>
            <div>✅ RSA Training and bar equipment highlighted</div>
            <div>✅ Audit Ready flags <strong style={{color:C.text}}>Liquor License (no GST)</strong> automatically</div>
          </>}
          {industry === "other" && <>
            <div>✅ Standard expense categories shown</div>
            <div>✅ All hospitality categories still available</div>
          </>}
        </div>
      </div>

      <div className="fsec">
        <div className="ftit">Business Details</div>
        <div className="frow2">
          <div className="fg"><label className="flbl">Business Name</label><input className="inp" defaultValue="My Business"/></div>
          <div className="fg"><label className="flbl">ABN</label><input className="inp" placeholder="12 345 678 901"/></div>
          <div className="fg"><label className="flbl">GST Registration Date</label><input className="inp" type="date" defaultValue="2022-01-01"/></div>
          <div className="fg"><label className="flbl">BAS Frequency</label><select className="sel"><option>Quarterly</option><option>Monthly</option><option>Annually</option></select></div>
          <div className="fg"><label className="flbl">Owner Email</label><input className="inp" type="email" defaultValue="owner@goldendragon.com.au"/></div>
          <div className="fg"><label className="flbl">State</label><select className="sel">{["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"].map(s => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div className="fbtns">
          <button className="btn" onClick={() => { setSaved(true); showToast("Settings saved!"); }}>Save Changes</button>
          {saved && <span style={{ color:C.green, fontSize:12, fontWeight:600 }}>✅ Saved!</span>}
        </div>
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
//  MONTHLY IAS PAGE
// ════════════════════════════════════════════════════════════
function IASPage({ timesheets, employees, ias, setIas, showToast }) {
  const [selMonth, setSelMonth] = useState(IAS_MONTHS[0]);
  const [tab,      setTab]      = useState("statement");
  const [bizName,  setBizName]  = useState("My Restaurant");
  const [bizABN,   setBizABN]   = useState("");

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
                          <div style={{width:22,height:22,borderRadius:"50%",background:avatarBg(emp.id),display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff",flexShrink:0}}>{initials(emp.name)}</div>
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
          <div className="pp-row"><span className="pp-lbl">PAYG Withheld Withheld (ATO Scale 2)</span><span className="pp-val">{money(d.totalPayg)}</span></div>
          <div className="pp-row"><span className="pp-lbl">Super (SGC) (SGC)</span><span className="pp-val">{money(d.totalSuper)}</span></div>
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
      {print && <PrintModal title="BAS Support Summary" onClose={() => setPrint(false)}
        onExport={() => renderBASSummaryPDF({d, quarter:selQ})}><PrintContent/></PrintModal>}

      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">📋 BAS Summary Generator</div><div className="psub">Quarterly BAS support summary — for review before lodgment</div></div>
        <div className="hdr-right">
          <select className="sel" value={selQ} onChange={e => setSelQ(e.target.value)} style={{ width:140 }}>
            {BAS_QUARTERS.map(q => <option key={q}>{q}</option>)}
          </select>
          <button className="btn" onClick={() => setPrint(true)}>⬇️ Export PDF</button>
        </div>
      </div>

      {d.warnings.length > 0 && d.warnings.map((w,i) => (
        <div key={i} className="alert al-y"><span className="al-ico">⚠️</span><div><div className="al-msg">{w}</div></div></div>
      ))}

      <div className="g4">
        {[
          { lbl:"Total Sales",         val:money(d.totalRev),   cls:"b" },
          { lbl:"Net GST Payable",     val:money(d.netGST),     cls:"y" },
          { lbl:"PAYG Withheld",           val:money(d.totalPayg),  cls:"" },
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
          <div className="bas-row"><span className="bas-lbl">PAYG Withheld Withheld (ATO Scale 2)</span><span className="bas-val" style={{ color:C.yellow }}>{money(d.totalPayg)}</span></div>
          <div className="bas-row"><span className="bas-lbl">Super (SGC) (SGC)</span><span className="bas-val" style={{ color:C.blue }}>{money(d.totalSuper)}</span></div>
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
                <td>{(CAT_CONFIG[c]?.emoji ? CAT_CONFIG[c].emoji + ' ' : '') + (CAT_CONFIG[c]?.label || c.charAt(0).toUpperCase()+c.slice(1))}</td>
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
        <div className="pp-row"><span className="pp-lbl">PAYG Withheld (ATO Scale 2)</span><span className="pp-val">{money(d.totalPayg)}</span></div>
        <div className="pp-row"><span className="pp-lbl">Super (SGC)</span><span className="pp-val">{money(d.totalSuper)}</span></div>
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
      {print && <PrintModal title="Annual Accountant Pack" onClose={() => setPrint(false)}
        onExport={() => renderAccountantPackPDF({d, selFY})}><PrintContent/></PrintModal>}

      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">📦 Annual Accountant Pack</div><div className="psub">Full financial year summary — accountant-ready for review</div></div>
        <div className="hdr-right">
          <select className="sel" value={selFY} onChange={e => setSelFY(e.target.value)} style={{ width:120 }}>
            {FIN_YEARS.map(y => <option key={y}>{y}</option>)}
          </select>
          <button className="btn" onClick={() => setPrint(true)}>⬇️ Export PDF</button>
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
                  <td style={{ fontWeight:600 }}>{(CAT_CONFIG[cat]?.emoji ? CAT_CONFIG[cat].emoji + ' ' : '') + (CAT_CONFIG[cat]?.label || cat.charAt(0).toUpperCase()+cat.slice(1))}</td>
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
      {print === "bas"         && <PrintModal title="BAS Support Summary"    onClose={()=>setPrint(null)}
        onExport={() => renderBASSummaryPDF({d:bas, quarter:selQ})}><BASPrint/></PrintModal>}
      {print === "annual"      && <PrintModal title="Annual Accountant Pack"  onClose={()=>setPrint(null)}
        onExport={() => renderAccountantPackPDF({d:annual, selFY})}><div className="pp-page"><PPHeader title="Annual Accountant Pack" subtitle="Financial Year Summary" fy={selFY}/>{annual.warnings.map((w,i)=><div key={i} className="pp-warn">⚠️ {w}</div>)}<div className="pp-sec"><div className="pp-sec-ttl">Expenses by Category</div><table className="pp-tbl"><thead><tr><th>Category</th><th style={{textAlign:"right"}}>Amount</th></tr></thead><tbody>{EXP_CATEGORIES.filter(c=>annual.bycat[c]>0).map((c,i)=><tr key={i}><td>{c}</td><td style={{textAlign:"right",fontFamily:"DM Mono,monospace"}}>{money(annual.bycat[c])}</td></tr>)}</tbody><tfoot><tr><td>Total</td><td style={{textAlign:"right",fontFamily:"DM Mono,monospace"}}>{money(annual.totalExp)}</td></tr></tfoot></table></div><PPDisclaimer/></div></PrintModal>}
      {print === "payroll"     && <PrintModal title="Payroll Summary"         onClose={()=>setPrint(null)}
        onExport={() => renderPayrollPDF({employees, allRows:rows, selFY})}><PayrollPrint/></PrintModal>}
      {print === "docregister" && <PrintModal title="Document Register"       onClose={()=>setPrint(null)}
        onExport={() => renderDocRegisterPDF({documents, selFY})}><DocRegPrint/></PrintModal>}

      <div className="hdr">
        <div className="hdr-left"><div className="ptitle">🖨️ Reports & Exports</div><div className="psub">Generate and print accountant-ready reports — for review, not lodgment</div></div>
      </div>

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
              <button className="btn-g" onClick={() => setPrint(r.id)}>⬇️ Export PDF</button>
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
        <div className="d-txt">All reports generated by Mise are <strong>management summaries only</strong> intended to assist business owners and their accountants in preparing for BAS lodgment and annual tax returns. They do not constitute a lodged BAS, tax return, or any document formally submitted to the ATO. All figures are estimates based on data entered into Mise and have not been audited or independently verified. Always engage a <strong>registered tax agent</strong> before lodging. Visit <strong>ato.gov.au</strong> for official guidance and lodgment obligations.</div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  ROOT APP
// ════════════════════════════════════════════════════════════

export default function App() {
  const [screen,          setScreen]          = useState("landing");
  const [page,            setPage]            = useState("dashboard");
  const [industry,        setIndustry]        = useState("restaurant"); // restaurant | café | bar | other
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [revenue,    setRevenue]    = useState(SEED_REVENUE);
  const [expenses,   setExpenses]   = useState(SEED_EXPENSES);
  const [employees,  setEmployees]  = useState(SEED_EMPLOYEES);
  const [timesheets, setTimesheets] = useState(SEED_TIMESHEETS);
  const [roster,     setRoster]     = useState(SEED_ROSTER);
  const [insurance,  setInsurance]  = useState(SEED_INSURANCE);
  const [leave,      setLeave]      = useState(SEED_LEAVE);
  const [ias,        setIas]        = useState(SEED_IAS);
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
        <Sidebar page={page} setPage={setPage} onLogout={() => setScreen("landing")} flagCount={flagCount} industry={industry}/>
        <main className="main">
          {page === "dashboard"      && <DashboardPage revenue={revenue} expenses={expenses} employees={employees} timesheets={timesheets} insurance={insurance} setPage={setPage}/>}
          {page === "revenue"        && <RevenuePage   revenue={revenue}   setRevenue={setRevenue}   showToast={showToast}/>}
          {page === "expenses"       && <ExpensesPage  expenses={expenses} setExpenses={setExpenses} showToast={showToast} industry={industry} dismissed={dismissedAlerts} setDismissed={setDismissedAlerts}/>}
          {page === "wages"          && <WagesPage     employees={employees} setEmployees={setEmployees} timesheets={timesheets} setTimesheets={setTimesheets} roster={roster} setRoster={setRoster} leave={leave} setLeave={setLeave} showToast={showToast}/>}
          {page === "insurance"      && <InsurancePage insurance={insurance} setInsurance={setInsurance} employees={employees} timesheets={timesheets} showToast={showToast}/>}
          {page === "tax"            && <TaxSummaryPage revenue={revenue} expenses={expenses} employees={employees} timesheets={timesheets}/>}
          {page === "taxsaver"       && <TaxSaverPage  expenses={expenses} setExpenses={setExpenses} employees={employees} timesheets={timesheets} setTimesheets={setTimesheets} showToast={showToast}/>}
          {page === "ias"            && <IASPage        timesheets={timesheets} employees={employees} ias={ias} setIas={setIas} showToast={showToast}/>}
          {page === "documents"      && <DocumentsPage documents={documents} setDocuments={setDocuments} employees={employees} showToast={showToast}/>}
          {page === "bassummary"     && <BASSummaryPage revenue={revenue} expenses={expenses} timesheets={timesheets} employees={employees} insurance={insurance} documents={documents} showToast={showToast}/>}
          {page === "accountantpack" && <AccountantPackPage revenue={revenue} expenses={expenses} timesheets={timesheets} employees={employees} insurance={insurance} documents={documents} showToast={showToast}/>}
          {page === "reports"        && <ReportsPage revenue={revenue} expenses={expenses} timesheets={timesheets} employees={employees} insurance={insurance} documents={documents}/>}
          {page === "settings"       && <SettingsPage industry={industry} setIndustry={setIndustry} showToast={showToast}/>}
        </main>
        {toast && <Toast msg={toast} onDone={() => setToast(null)}/>}
      </div>
    </>
  );
}
