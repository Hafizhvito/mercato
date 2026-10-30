import fs from "node:fs";
import path from "node:path";

const productsDir = path.resolve(process.cwd(), "public/images/products");
const collectionsDir = path.resolve(process.cwd(), "public/images/collections");

fs.mkdirSync(productsDir, { recursive: true });
fs.mkdirSync(collectionsDir, { recursive: true });

function renderSvg({ title, category, c1, c2, accent, width = 800, height = 800, badge = "MERCATO ORIGINAL" }) {
  const iconY = height === 800 ? 355 : 240;
  const circleY = height === 800 ? 340 : 230;
  const titleY = height === 800 ? 540 : 380;
  const catY = height === 800 ? 580 : 420;
  const badgeY = height === 800 ? 620 : 450;
  const badgeTextY = height === 800 ? 641 : 471;
  const badgeX = (width - 220) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}" />
      <stop offset="100%" stop-color="${c2}" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.3" />
      <stop offset="100%" stop-color="${accent}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#grad)" />
  <circle cx="${width / 2}" cy="${circleY}" r="220" fill="url(#glow)" />
  <circle cx="${width / 2}" cy="${circleY}" r="110" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-width="2" stroke-dasharray="6 6" />
  <text x="${width / 2}" y="${iconY}" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="bold" fill="${accent}" text-anchor="middle">✦</text>
  <text x="${width / 2}" y="${titleY}" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="700" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">${title}</text>
  <text x="${width / 2}" y="${catY}" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="500" fill="${accent}" text-anchor="middle" letter-spacing="3">${category.toUpperCase()}</text>
  <rect x="${badgeX}" y="${badgeY}" width="220" height="34" rx="17" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" stroke-width="1" />
  <text x="${width / 2}" y="${badgeTextY}" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#ffffff" text-anchor="middle" letter-spacing="2">${badge}</text>
</svg>`;
}

const products = [
  { slug: "kemeja-batik-solo", title: "Kemeja Batik Solo Slim Fit", category: "Pakaian Pria", c1: "#1e293b", c2: "#0f172a", accent: "#f59e0b" },
  { slug: "celana-chino-stretch", title: "Celana Chino Stretch", category: "Pakaian Pria", c1: "#334155", c2: "#1e293b", accent: "#d97706" },
  { slug: "kaos-polos-cotton", title: "Kaos Polos Heavyweight 24s", category: "Pakaian Pria", c1: "#475569", c2: "#334155", accent: "#38bdf8" },
  { slug: "jaket-denim-trucker", title: "Jaket Denim Trucker Vintage", category: "Pakaian Pria", c1: "#1e3a8a", c2: "#172554", accent: "#60a5fa" },
  { slug: "gamis-tunik-silk", title: "Gamis Tunik Silk Rayon Etnik", category: "Pakaian Wanita", c1: "#831843", c2: "#500724", accent: "#f472b6" },
  { slug: "blouse-linen-mandari", title: "Blouse Linen Kerah Mandari", category: "Pakaian Wanita", c1: "#701a75", c2: "#4a044e", accent: "#e879f9" },
  { slug: "rok-plisket-silk", title: "Rok Plisket Premium Crepe", category: "Pakaian Wanita", c1: "#9d174d", c2: "#700732", accent: "#fb7185" },
  { slug: "hijab-paris-voal", title: "Hijab Segiempat Paris Voal", category: "Pakaian Wanita", c1: "#881337", c2: "#4c0519", accent: "#fda4af" },
  { slug: "kopi-arabika-gayo", title: "Kopi Arabika Aceh Gayo", category: "Kopi &amp; Minuman", c1: "#451a03", c2: "#270d02", accent: "#f59e0b" },
  { slug: "kopi-robusta-lampung", title: "Kopi Robusta Lampung Winey", category: "Kopi &amp; Minuman", c1: "#581c87", c2: "#3b0764", accent: "#c084fc" },
  { slug: "teh-melati-pekoe", title: "Teh Melati Artisan Pekoe", category: "Kopi &amp; Minuman", c1: "#064e3b", c2: "#022c22", accent: "#34d399" },
  { slug: "sirup-gula-aren", title: "Sirup Gula Aren Organik 1L", category: "Kopi &amp; Minuman", c1: "#78350f", c2: "#451a03", accent: "#fbbf24" },
  { slug: "tws-earbuds-anc", title: "TWS Earbuds Pro ANC", category: "Elektronik &amp; Gadget", c1: "#0f172a", c2: "#020617", accent: "#38bdf8" },
  { slug: "keyboard-mekanikal-75", title: "Keyboard Mekanikal 75%", category: "Elektronik &amp; Gadget", c1: "#1e1b4b", c2: "#0f0d2d", accent: "#818cf8" },
  { slug: "charger-gan-65w", title: "Charger GaN 65W 3-Port", category: "Elektronik &amp; Gadget", c1: "#111827", c2: "#030712", accent: "#a855f7" },
  { slug: "smartwatch-amoled-gps", title: "Smartwatch AMOLED GPS", category: "Elektronik &amp; Gadget", c1: "#0c4a6e", c2: "#082f49", accent: "#38bdf8" },
  { slug: "serum-wajah-niacinamide", title: "Serum Wajah Niacinamide 10%", category: "Perawatan &amp; Kecantikan", c1: "#042f2e", c2: "#011b1a", accent: "#2dd4bf" },
  { slug: "sunscreen-gel-uv-shield", title: "Sunscreen Gel UV Shield SPF50+", category: "Perawatan &amp; Kecantikan", c1: "#9a3412", c2: "#7c2d12", accent: "#fed7aa" },
  { slug: "facial-cleanser-low-ph", title: "Gentle Low pH Facial Cleanser", category: "Perawatan &amp; Kecantikan", c1: "#0f766e", c2: "#115e59", accent: "#99f6e4" },
  { slug: "lip-tint-velvet-hydrating", title: "Lip Tint Velvet Hydrating Gloss", category: "Perawatan &amp; Kecantikan", c1: "#be123c", c2: "#881337", accent: "#fecdd3" },
  { slug: "lilin-aromaterapi-soy", title: "Lilin Aromaterapi Soy Wax", category: "Gaya Hidup &amp; Rumah", c1: "#713f12", c2: "#422006", accent: "#fde047" },
  { slug: "tumbler-stainless-steel", title: "Tumbler Stainless Steel 600ml", category: "Gaya Hidup &amp; Rumah", c1: "#374151", c2: "#1f2937", accent: "#e5e7eb" },
  { slug: "diffuser-ultrasonic-keramik", title: "Diffuser Ultrasonic Keramik", category: "Gaya Hidup &amp; Rumah", c1: "#3f3f46", c2: "#27272a", accent: "#d4d4d8" },
  { slug: "cangkir-keramik-handmade", title: "Set Cangkir Keramik Handmade", category: "Gaya Hidup &amp; Rumah", c1: "#7c2d12", c2: "#431407", accent: "#fdba74" }
];

const collections = [
  { slug: "terlaris", title: "Terlaris Minggu Ini", category: "Koleksi Pilihan", c1: "#1e1b4b", c2: "#0f0d2d", accent: "#a855f7" },
  { slug: "batik-nusantara", title: "Koleksi Batik Nusantara", category: "Koleksi Tradisi", c1: "#78350f", c2: "#451a03", accent: "#fbbf24" },
  { slug: "gaya-hidup-modern", title: "Gaya Hidup &amp; Produktivitas", category: "Koleksi Modern", c1: "#0f172a", c2: "#020617", accent: "#38bdf8" },
  { slug: "koleksi-hari-raya", title: "Koleksi Ramadhan &amp; Hari Raya", category: "Koleksi Festive", c1: "#064e3b", c2: "#022c22", accent: "#34d399" }
];

for (const p of products) {
  const filePath = path.join(productsDir, `${p.slug}.svg`);
  fs.writeFileSync(filePath, renderSvg({ ...p, width: 800, height: 800 }));
}
console.log(`Generated ${products.length} product SVGs in ${productsDir}`);

for (const c of collections) {
  const filePath = path.join(collectionsDir, `${c.slug}.svg`);
  fs.writeFileSync(filePath, renderSvg({ ...c, width: 1200, height: 800, badge: "MERCATO COLLECTION" }));
}
console.log(`Generated ${collections.length} collection SVGs in ${collectionsDir}`);
