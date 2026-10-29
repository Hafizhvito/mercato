import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { catalogService } from "@/modules/catalog/service";

async function seedCatalog() {
  console.log("Starting Mercato Catalog Seed...");

  // 1. Resolve Primary Store
  let [store] = await db
    .select()
    .from(schema.stores)
    .where(eq(schema.stores.slug, "mercato-indonesia"))
    .limit(1);

  if (!store) {
    const [createdStore] = await db
      .insert(schema.stores)
      .values({
        name: "Mercato Indonesia",
        slug: "mercato-indonesia",
        currency: "IDR",
        locale: "id",
        description: "Toko resmi Mercato untuk pasar Indonesia.",
      })
      .returning();

    if (!createdStore) throw new Error("Failed to create default store");
    store = createdStore;
  }

  const storeId = store.id;
  console.log(`Using Store: ${store.name} (${storeId})`);

  // Clean existing store products to provide pristine, idempotent seed
  console.log("Cleaning previous catalog seed data for store...");
  await db.delete(schema.products).where(eq(schema.products.storeId, storeId));

  // 2. Categories
  const categoryData = [
    {
      name: "Pakaian Pria",
      slug: "pakaian-pria",
      description: "Koleksi busana pria elegan dan kasual",
    },
    {
      name: "Pakaian Wanita",
      slug: "pakaian-wanita",
      description: "Busana wanita modis dan busana muslim modern",
    },
    {
      name: "Kopi & Minuman",
      slug: "kopi-dan-minuman",
      description: "Kopi nusantara pilihan dan teh artisan",
    },
    {
      name: "Elektronik & Gadget",
      slug: "elektronik-dan-gadget",
      description: "Aksesoris pintar dan perangkat penunjang produktivitas",
    },
    {
      name: "Perawatan & Kecantikan",
      slug: "perawatan-dan-kecantikan",
      description: "Skincare ramah kulit dan produk perawatan diri",
    },
    {
      name: "Gaya Hidup & Rumah",
      slug: "gaya-hidup-dan-rumah",
      description: "Dekorasi estetik dan perlengkapan harian",
    },
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categoryData) {
    const [existing] = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(eq(schema.categories.slug, cat.slug))
      .limit(1);

    if (existing) {
      categoryMap.set(cat.slug, existing.id);
    } else {
      const [newCat] = await db
        .insert(schema.categories)
        .values({
          storeId,
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
        })
        .returning();
      if (newCat) categoryMap.set(cat.slug, newCat.id);
    }
  }

  // 3. Collections
  const collectionData = [
    {
      name: "Terlaris Minggu Ini",
      slug: "terlaris",
      description: "Produk paling diminati pelanggan dengan rating tertinggi",
      imageUrl:
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
    },
    {
      name: "Koleksi Batik Nusantara",
      slug: "batik-nusantara",
      description: "Sentuhan karya tradisional dengan siluet modern untuk segala suasana",
      imageUrl:
        "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=1200&q=80",
    },
    {
      name: "Gaya Hidup & Produktivitas",
      slug: "gaya-hidup-modern",
      description: "Peralatan esensial penunjang kenyamanan dan performa kerja",
      imageUrl:
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80",
    },
    {
      name: "Koleksi Ramadhan & Hari Raya",
      slug: "koleksi-hari-raya",
      description: "Pilihan busana santun dan hampers premium untuk momen istimewa",
      imageUrl:
        "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80",
    },
  ];

  const collectionMap = new Map<string, string>();
  for (const col of collectionData) {
    const [existing] = await db
      .select({ id: schema.collections.id })
      .from(schema.collections)
      .where(eq(schema.collections.slug, col.slug))
      .limit(1);

    if (existing) {
      collectionMap.set(col.slug, existing.id);
    } else {
      const [newCol] = await db
        .insert(schema.collections)
        .values({
          storeId,
          name: col.name,
          slug: col.slug,
          description: col.description,
          imageUrl: col.imageUrl,
        })
        .returning();
      if (newCol) collectionMap.set(col.slug, newCol.id);
    }
  }

  // 4. Seed 24 Realistic Products
  const seedProducts = [
    // Pakaian Pria
    {
      name: "Kemeja Batik Tulis Solo Slim Fit",
      categorySlug: "pakaian-pria",
      collectionSlugs: ["batik-nusantara", "terlaris"],
      description:
        "Kemeja batik pria bermotif parang modern yang dibuat dari katun primisima premium dengan lapisan furing lembut. Nyaman dikenakan untuk agenda formal maupun kasual.",
      images: [
        "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80",
      ],
      options: [
        { name: "Ukuran", values: ["M", "L", "XL"] },
        { name: "Warna", values: ["Navy", "Cokelat Klasik"] },
      ],
      basePrice: 385000,
      stock: 25,
      skuBase: "BTK-SOLO",
    },
    {
      name: "Celana Chino Stretch Slim Fit",
      categorySlug: "pakaian-pria",
      collectionSlugs: ["terlaris"],
      description:
        "Celana chino panjang pria dengan bahan cotton twill elastis. Desain potongan rapi yang fleksibel dan adem untuk dipakai seharian beraktivitas.",
      images: [
        "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=800&q=80",
      ],
      options: [
        { name: "Ukuran", values: ["30", "32", "34"] },
        { name: "Warna", values: ["Khaki", "Hitam", "Abu-Abu"] },
      ],
      basePrice: 249000,
      stock: 40,
      skuBase: "CHN-MALE",
    },
    {
      name: "Kaos Polos Heavyweight Cotton 24s",
      categorySlug: "pakaian-pria",
      collectionSlugs: [],
      description:
        "T-shirt basic pria menggunakan katun combed 24s berserat tebal dan tidak menerawang. Jahitan rantai standar distro di bagian bahu dan leher.",
      images: [
        "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80",
      ],
      options: [
        { name: "Ukuran", values: ["S", "M", "L", "XL"] },
        { name: "Warna", values: ["Putih", "Hitam", "Hijau Sage"] },
      ],
      basePrice: 89000,
      stock: 80,
      skuBase: "TSH-HVY",
    },
    {
      name: "Jaket Denim Trucker Vintage Washed",
      categorySlug: "pakaian-pria",
      collectionSlugs: ["terlaris"],
      description:
        "Jaket denim tebal 14oz dengan efek wash retro klasik. Dilengkapi saku fungsional ganda di dada dan saku samping.",
      images: [
        "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80",
      ],
      options: [{ name: "Ukuran", values: ["M", "L", "XL"] }],
      basePrice: 420000,
      stock: 18,
      skuBase: "JKT-DNM",
    },

    // Pakaian Wanita
    {
      name: "Gamis Tunik Silk Rayon Etnik",
      categorySlug: "pakaian-wanita",
      collectionSlugs: ["batik-nusantara", "koleksi-hari-raya"],
      description:
        "Tunik panjang wanita berbahan sutra rayon jatuh yang dingin dan berkilau mewah. Cocok untuk acara silaturahmi keluarga dan perayaan istimewa.",
      images: [
        "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80",
      ],
      options: [
        { name: "Ukuran", values: ["All Size", "Big Size"] },
        { name: "Warna", values: ["Emerald", "Dusty Pink", "Mocca"] },
      ],
      basePrice: 320000,
      stock: 30,
      skuBase: "TNK-SLK",
    },
    {
      name: "Blouse Linen Kerah Mandari",
      categorySlug: "pakaian-wanita",
      collectionSlugs: ["terlaris"],
      description:
        "Blouse lengan panjang wanita dengan kerah shanghai minimalis berbahan 100% linen alami yang berpori dan sejuk.",
      images: [
        "https://images.unsplash.com/photo-1551163943-3f6a855d1153?auto=format&fit=crop&w=800&q=80",
      ],
      options: [
        { name: "Ukuran", values: ["S/M", "L/XL"] },
        { name: "Warna", values: ["Broken White", "Terracotta"] },
      ],
      basePrice: 195000,
      stock: 35,
      skuBase: "BLS-LNN",
    },
    {
      name: "Rok Plisket Premium Silk Crepe",
      categorySlug: "pakaian-wanita",
      collectionSlugs: ["koleksi-hari-raya"],
      description:
        "Rok lipit plisket rapi yang tidak mudah pudar lipatannya meski sering dicuci. Dilengkapi ban karet pinggang elastis yang nyaman.",
      images: [
        "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=800&q=80",
      ],
      options: [{ name: "Warna", values: ["Hitam", "Choco", "Silver Grey"] }],
      basePrice: 145000,
      stock: 50,
      skuBase: "ROK-PLK",
    },
    {
      name: "Hijab Segiempat Paris Voal Ultrafine",
      categorySlug: "pakaian-wanita",
      collectionSlugs: ["koleksi-hari-raya"],
      description:
        "Jilbab segi empat berukuran 115x115 cm dengan tepian lasercut rapi. Serat voal premium yang mudah tegak di dahi dan tidak gerah.",
      images: [
        "https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=800&q=80",
      ],
      options: [{ name: "Warna", values: ["Oatmilk", "Army", "Soft Lilac", "Denim"] }],
      basePrice: 65000,
      stock: 120,
      skuBase: "HJB-VOL",
    },

    // Kopi & Minuman
    {
      name: "Kopi Arabika Aceh Gayo Specialty 250g",
      categorySlug: "kopi-dan-minuman",
      collectionSlugs: ["terlaris", "gaya-hidup-modern"],
      description:
        "Biji kopi single origin Arabika dari dataran tinggi Takengon Aceh. Profil rasa seimbang dengan keasaman citrus lembut dan aroma rempah alami manis.",
      images: [
        "https://images.unsplash.com/photo-1587734195503-904fca47e0e9?auto=format&fit=crop&w=800&q=80",
      ],
      options: [{ name: "Grind Size", values: ["Biji Utuh", "Giling Kasar", "Giling Halus"] }],
      basePrice: 95000,
      stock: 60,
      skuBase: "KOP-GYO",
    },
    {
      name: "Kopi Robusta Lampung Winey Process 250g",
      categorySlug: "kopi-dan-minuman",
      collectionSlugs: [],
      description:
        "Kopi robusta olahan pascapanen wine fermentation alami dengan body tebal, aroma cokelat pekat, dan aftertaste buah tropis manis.",
      images: [
        "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
      ],
      options: [{ name: "Grind Size", values: ["Biji Utuh", "Giling Halus (Espresso)"] }],
      basePrice: 75000,
      stock: 45,
      skuBase: "KOP-LMP",
    },
    {
      name: "Teh Melati Artisan Pekoe Loose Leaf 100g",
      categorySlug: "kopi-dan-minuman",
      collectionSlugs: ["gaya-hidup-modern"],
      description:
        "Daun teh hijau pucuk pekoe yang dicampur bunga melati segar dari kebun teh pegunungan Jawa Tengah. Harum semerbak dan menenangkan.",
      images: [
        "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80",
      ],
      options: [{ name: "Kemasan", values: ["Canister 100g", "Refill Pouch 200g"] }],
      basePrice: 68000,
      stock: 55,
      skuBase: "TEH-MLT",
    },
    {
      name: "Sirup Gula Aren Organik Organics 1 Liter",
      categorySlug: "kopi-dan-minuman",
      collectionSlugs: ["terlaris"],
      description:
        "Sirup pemanis gula aren cair alami tanpa bahan pengawet. Ideal untuk campuran kopi susu kekinian, es cendol, dan sajian kue.",
      images: [
        "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
      ],
      options: [],
      basePrice: 52000,
      stock: 90,
      skuBase: "SRP-ARN",
    },

    // Elektronik & Gadget
    {
      name: "TWS Earbuds Pro ANC Noise Cancelling",
      categorySlug: "elektronik-dan-gadget",
      collectionSlugs: ["gaya-hidup-modern", "terlaris"],
      description:
        "Earphone nirkabel Bluetooth 5.4 dengan teknologi Active Noise Cancelling hingga 38dB, driver dinamis 12mm, dan baterai tahan hingga 32 jam.",
      images: [
        "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80",
      ],
      options: [{ name: "Warna", values: ["Matte Black", "Glacier White"] }],
      basePrice: 549000,
      stock: 35,
      skuBase: "TWS-ANC",
    },
    {
      name: "Keyboard Mekanikal 75% Wireless Hot-Swap",
      categorySlug: "elektronik-dan-gadget",
      collectionSlugs: ["gaya-hidup-modern"],
      description:
        "Keyboard mekanik nirkabel dengan layout 75%, gasket mount hening, switch pre-lubed, dan koneksi triple-mode (Bluetooth, 2.4GHz, Type-C).",
      images: [
        "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
      ],
      options: [
        { name: "Switch", values: ["Linear Red", "Tactile Brown"] },
        { name: "Warna", values: ["Retro Grey", "Nordic Blue"] },
      ],
      basePrice: 899000,
      stock: 20,
      skuBase: "KBD-75P",
    },
    {
      name: "Charger GaN 65W Fast Charging 3-Port",
      categorySlug: "elektronik-dan-gadget",
      collectionSlugs: ["terlaris"],
      description:
        "Kepala charger berukuran mini berbasis Galium Nitrida (GaN) dengan dua port USB-C Power Delivery dan satu port USB-A. Mampu mengisi daya laptop dan ponsel bersamaan.",
      images: [
        "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=800&q=80",
      ],
      options: [{ name: "Warna", values: ["Hitam", "Putih"] }],
      basePrice: 285000,
      stock: 50,
      skuBase: "CHG-GAN65",
    },
    {
      name: "Smartwatch AMOLED GPS Tracker",
      categorySlug: "elektronik-dan-gadget",
      collectionSlugs: ["gaya-hidup-modern"],
      description:
        "Jam tangan pintar dengan layar sentuh AMOLED jernih, sensor detak jantung SpO2 24 jam, 100+ mode olahraga, dan ketahanan air 5 ATM.",
      images: [
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
      ],
      options: [{ name: "Warna Strap", values: ["Obsidian Black", "Midnight Blue"] }],
      basePrice: 1250000,
      stock: 15,
      skuBase: "SMW-AML",
    },

    // Perawatan & Kecantikan
    {
      name: "Serum Wajah Niacinamide 10% + Zinc 1%",
      categorySlug: "perawatan-dan-kecantikan",
      collectionSlugs: ["terlaris"],
      description:
        "Serum pencerah kulit yang membantu menyamarkan noda hitam, mengontrol produksi minyak berlebih, dan merawat kekuatan skin barrier.",
      images: [
        "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80",
      ],
      options: [{ name: "Ukuran", values: ["20ml", "50ml"] }],
      basePrice: 119000,
      stock: 65,
      skuBase: "SRM-NC10",
    },
    {
      name: "Sunscreen Gel UV Shield SPF 50+ PA++++",
      categorySlug: "perawatan-dan-kecantikan",
      collectionSlugs: ["terlaris"],
      description:
        "Tabir surya bertekstur gel air seringan embun yang cepat meresap tanpa meninggalkan rasa lengket atau whitecast pada kulit.",
      images: [
        "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
      ],
      options: [],
      basePrice: 85000,
      stock: 80,
      skuBase: "SNS-GEL50",
    },
    {
      name: "Gentle Low pH Facial Cleanser 100ml",
      categorySlug: "perawatan-dan-kecantikan",
      collectionSlugs: [],
      description:
        "Pembersih wajah dengan pH seimbang 5.5 yang diperkaya Centella Asiatica dan ceramide untuk membersihkan kotoran tanpa membuat kulit kering tertarik.",
      images: [
        "https://images.unsplash.com/photo-1556228722-d0b779a544f8?auto=format&fit=crop&w=800&q=80",
      ],
      options: [],
      basePrice: 79000,
      stock: 70,
      skuBase: "CLN-LPH",
    },
    {
      name: "Lip Tint Velvet Hydrating Gloss",
      categorySlug: "perawatan-dan-kecantikan",
      collectionSlugs: ["koleksi-hari-raya"],
      description:
        "Pewarna bibir tahan lama dengan formula melembabkan jojoba oil yang memberikan hasil akhir velvet natural lembut.",
      images: [
        "https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80",
      ],
      options: [{ name: "Shade", values: ["01 Berry Rose", "02 Sunset Peach", "03 Cherry Plum"] }],
      basePrice: 62000,
      stock: 95,
      skuBase: "LIP-VVT",
    },

    // Gaya Hidup & Rumah
    {
      name: "Lilin Aromaterapi Kedelai Soy Scented Candle",
      categorySlug: "gaya-hidup-dan-rumah",
      collectionSlugs: ["gaya-hidup-modern"],
      description:
        "Lilin wangi alami berbahan 100% soy wax dengan sumbu kayu bersuara gemeretak menenangkan. Aroma lavender vanila dan eucalyptus hutan.",
      images: [
        "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=800&q=80",
      ],
      options: [{ name: "Aroma", values: ["Lavender Vanilla", "Morning Eucalyptus"] }],
      basePrice: 125000,
      stock: 40,
      skuBase: "CDL-SOY",
    },
    {
      name: "Tumbler Stainless Steel Insulated 600ml",
      categorySlug: "gaya-hidup-dan-rumah",
      collectionSlugs: ["terlaris", "gaya-hidup-modern"],
      description:
        "Botol minum vakum dinding ganda yang menjaga minuman tetap dingin hingga 24 jam atau panas hingga 12 jam. Bebas BPA dan anti-bocor.",
      images: [
        "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80",
      ],
      options: [{ name: "Warna", values: ["Matte Army", "Stainless Steel", "Sakura Pink"] }],
      basePrice: 179000,
      stock: 55,
      skuBase: "TMB-600",
    },
    {
      name: "Diffuser Ultrasonic Keramik Minimalis 300ml",
      categorySlug: "gaya-hidup-dan-rumah",
      collectionSlugs: ["gaya-hidup-modern"],
      description:
        "Pengharum ruangan ultrasonik berlapis keramik matte dengan lampu LED ambient hangat dan timer otomatis mati saat air habis.",
      images: [
        "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=800&q=80",
      ],
      options: [{ name: "Warna", values: ["Chalk White", "Slate Grey"] }],
      basePrice: 310000,
      stock: 22,
      skuBase: "DFS-300",
    },
    {
      name: "Set Cangkir Keramik Buatan Tangan 2 Pcs",
      categorySlug: "gaya-hidup-dan-rumah",
      collectionSlugs: ["gaya-hidup-modern"],
      description:
        "Set cangkir kopi buatan tangan perajin lokal dengan tekstur glasir kasar natural yang unik pada tiap cangkir. Kapasitas 220ml.",
      images: [
        "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
      ],
      options: [],
      basePrice: 165000,
      stock: 30,
      skuBase: "CUP-HMD",
    },
  ];

  let seededCount = 0;

  for (const item of seedProducts) {
    const categoryId = categoryMap.get(item.categorySlug);
    const collectionIds = item.collectionSlugs
      .map((slug) => collectionMap.get(slug))
      .filter((id): id is string => Boolean(id));

    // Generate variants
    const generatedVariants = catalogService.generateVariantsFromOptions(
      item.options,
      item.skuBase,
      item.basePrice,
    );

    const variants = generatedVariants.map((gv) => ({
      sku: gv.sku,
      title: gv.title,
      price: gv.price,
      compareAtPrice: Math.round(gv.price * 1.15),
      costPrice: Math.round(gv.price * 0.65),
      stock: item.stock,
      weight: 300,
    }));

    const images = item.images.map((url, idx) => ({
      url,
      altText: item.name,
      position: idx,
    }));

    // Check if product already exists by exact name in store
    const [existingProd] = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.name, item.name))
      .limit(1);

    if (!existingProd) {
      await catalogService.createProductWithVariants(storeId, {
        name: item.name,
        description: item.description,
        categoryId,
        status: "published",
        seoTitle: `${item.name} | Mercato`,
        seoDescription: item.description.slice(0, 160),
        collectionIds,
        variants,
        images,
      });
      seededCount++;
    }
  }

  console.log(`Seeded ${seededCount} new products across ${categoryData.length} categories.`);
  console.log("Catalog seed completed successfully.");
  process.exit(0);
}

seedCatalog().catch((err) => {
  console.error("Fatal error during catalog seed:", err);
  process.exit(1);
});
