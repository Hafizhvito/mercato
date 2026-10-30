/**
 * Indonesian Administrative Regions Dataset (Wilayah Administrasi Indonesia)
 *
 * Source: Ministry of Home Affairs (Kemendagri) Open Administrative Codes
 * Dataset License: MIT License (https://github.com/cahyadsn/wilayah/blob/master/LICENSE)
 *
 * This dataset provides typed hierarchical lookups for Provinces, Cities/Regencies (Kabupaten/Kota),
 * Districts (Kecamatan), and primary Postal Codes across Indonesia.
 */

export interface Province {
  id: string;
  name: string;
}

export interface City {
  id: string;
  provinceId: string;
  name: string;
  type: "Kota" | "Kabupaten";
}

export interface District {
  id: string;
  cityId: string;
  name: string;
  postalCode: string;
}

export const INDONESIA_PROVINCES: Province[] = [
  { id: "31", name: "DKI Jakarta" },
  { id: "32", name: "Jawa Barat" },
  { id: "33", name: "Jawa Tengah" },
  { id: "34", name: "DI Yogyakarta" },
  { id: "35", name: "Jawa Timur" },
  { id: "36", name: "Banten" },
  { id: "51", name: "Bali" },
  { id: "11", name: "Aceh" },
  { id: "12", name: "Sumatera Utara" },
  { id: "13", name: "Sumatera Barat" },
  { id: "14", name: "Riau" },
  { id: "15", name: "Jambi" },
  { id: "16", name: "Sumatera Selatan" },
  { id: "18", name: "Lampung" },
  { id: "61", name: "Kalimantan Barat" },
  { id: "63", name: "Kalimantan Selatan" },
  { id: "64", name: "Kalimantan Timur" },
  { id: "73", name: "Sulawesi Selatan" },
  { id: "71", name: "Sulawesi Utara" },
  { id: "52", name: "Nusa Tenggara Barat" },
  { id: "53", name: "Nusa Tenggara Timur" },
];

export const INDONESIA_CITIES: City[] = [
  // DKI Jakarta
  { id: "3171", provinceId: "31", name: "Jakarta Pusat", type: "Kota" },
  { id: "3172", provinceId: "31", name: "Jakarta Utara", type: "Kota" },
  { id: "3173", provinceId: "31", name: "Jakarta Barat", type: "Kota" },
  { id: "3174", provinceId: "31", name: "Jakarta Selatan", type: "Kota" },
  { id: "3175", provinceId: "31", name: "Jakarta Timur", type: "Kota" },

  // Jawa Barat
  { id: "3273", provinceId: "32", name: "Bandung", type: "Kota" },
  { id: "3204", provinceId: "32", name: "Bandung", type: "Kabupaten" },
  { id: "3275", provinceId: "32", name: "Bekasi", type: "Kota" },
  { id: "3216", provinceId: "32", name: "Bekasi", type: "Kabupaten" },
  { id: "3271", provinceId: "32", name: "Bogor", type: "Kota" },
  { id: "3201", provinceId: "32", name: "Bogor", type: "Kabupaten" },
  { id: "3276", provinceId: "32", name: "Depok", type: "Kota" },
  { id: "3277", provinceId: "32", name: "Cimahi", type: "Kota" },

  // DI Yogyakarta
  { id: "3471", provinceId: "34", name: "Yogyakarta", type: "Kota" },
  { id: "3404", provinceId: "34", name: "Sleman", type: "Kabupaten" },
  { id: "3402", provinceId: "34", name: "Bantul", type: "Kabupaten" },

  // Jawa Tengah
  { id: "3374", provinceId: "33", name: "Semarang", type: "Kota" },
  { id: "3372", provinceId: "33", name: "Surakarta (Solo)", type: "Kota" },

  // Jawa Timur
  { id: "3578", provinceId: "35", name: "Surabaya", type: "Kota" },
  { id: "3573", provinceId: "35", name: "Malang", type: "Kota" },
  { id: "3515", provinceId: "35", name: "Sidoarjo", type: "Kabupaten" },

  // Bali
  { id: "5171", provinceId: "51", name: "Denpasar", type: "Kota" },
  { id: "5103", provinceId: "51", name: "Badung", type: "Kabupaten" },
  { id: "5104", provinceId: "51", name: "Gianyar", type: "Kabupaten" },
];

export const INDONESIA_DISTRICTS: District[] = [
  // Jakarta Pusat
  { id: "317101", cityId: "3171", name: "Gambir", postalCode: "10110" },
  { id: "317102", cityId: "3171", name: "Tanah Abang", postalCode: "10210" },
  { id: "317103", cityId: "3171", name: "Menteng", postalCode: "10310" },
  { id: "317104", cityId: "3171", name: "Senen", postalCode: "10410" },

  // Jakarta Selatan
  { id: "317401", cityId: "3174", name: "Kebayoran Baru", postalCode: "12110" },
  { id: "317402", cityId: "3174", name: "Kebayoran Lama", postalCode: "12210" },
  { id: "317404", cityId: "3174", name: "Cilandak", postalCode: "12410" },
  { id: "317407", cityId: "3174", name: "Setiabudi", postalCode: "12910" },

  // Bandung Kota
  { id: "327301", cityId: "3273", name: "Coblong", postalCode: "40132" },
  { id: "327302", cityId: "3273", name: "Sukajadi", postalCode: "40162" },
  { id: "327303", cityId: "3273", name: "Sumur Bandung", postalCode: "40111" },

  // Yogyakarta
  { id: "347101", cityId: "3471", name: "Danurejan", postalCode: "55211" },
  { id: "347102", cityId: "3471", name: "Gondomanan", postalCode: "55121" },
  { id: "347103", cityId: "3471", name: "Kraton", postalCode: "55131" },

  // Surabaya
  { id: "357801", cityId: "3578", name: "Genteng", postalCode: "60271" },
  { id: "357802", cityId: "3578", name: "Tegalsari", postalCode: "60261" },
  { id: "357803", cityId: "3578", name: "Wonokromo", postalCode: "60241" },

  // Denpasar
  { id: "517101", cityId: "5171", name: "Denpasar Selatan", postalCode: "80221" },
  { id: "517102", cityId: "5171", name: "Denpasar Barat", postalCode: "80119" },
];

export function getProvinces(): Province[] {
  return INDONESIA_PROVINCES;
}

export function getCitiesByProvince(provinceId: string): City[] {
  return INDONESIA_CITIES.filter((c) => c.provinceId === provinceId);
}

export function getDistrictsByCity(cityId: string): District[] {
  return INDONESIA_DISTRICTS.filter((d) => d.cityId === cityId);
}
