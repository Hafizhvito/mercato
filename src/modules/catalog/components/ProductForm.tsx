"use client";

import { ArrowLeft, Loader2, Plus, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import { createProductAction, deleteProductAction, updateProductAction } from "../actions";
import type { Category, Collection, ProductDetail } from "../repository";

interface OptionState {
  name: string;
  valueInput: string;
  values: string[];
}

interface VariantState {
  sku: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
}

interface ImageState {
  url: string;
  altText: string;
  position: number;
}

interface ProductFormProps {
  initialProduct?: ProductDetail;
  categories: Category[];
  collections: Collection[];
}

export function ProductForm({ initialProduct, categories, collections }: ProductFormProps) {
  const router = useRouter();
  const isEditing = Boolean(initialProduct);

  const [name, setName] = useState(initialProduct?.name ?? "");
  const [description, setDescription] = useState(initialProduct?.description ?? "");
  const [categoryId, setCategoryId] = useState(initialProduct?.categoryId ?? "");
  const [status, setStatus] = useState<"draft" | "published" | "archived">(
    initialProduct?.status ?? "draft",
  );
  const [seoTitle, setSeoTitle] = useState(initialProduct?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(initialProduct?.seoDescription ?? "");
  const [selectedCollections, setSelectedCollections] = useState<string[]>(
    initialProduct?.collections?.map((c) => c.id) ?? [],
  );

  // Options & Variants
  const [options, setOptions] = useState<OptionState[]>([]);
  const [variants, setVariants] = useState<VariantState[]>(
    initialProduct?.variants.map((v) => ({
      sku: v.sku,
      title: v.title,
      price: v.price,
      compareAtPrice: v.compareAtPrice ?? undefined,
      stock: v.stock,
    })) ?? [
      {
        sku: "PROD-DEF",
        title: "Default Variant",
        price: 150000,
        stock: 10,
      },
    ],
  );

  // Images
  const [images, setImages] = useState<ImageState[]>(
    initialProduct?.images.map((img) => ({
      url: img.url,
      altText: img.altText ?? "",
      position: img.position,
    })) ?? [],
  );

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Add an option row
  const handleAddOption = () => {
    setOptions([...options, { name: "", valueInput: "", values: [] }]);
  };

  // Add value to option tag list
  const handleAddOptionValue = (index: number) => {
    const opt = options[index];
    if (!opt?.valueInput.trim()) return;

    const val = opt.valueInput.trim();
    if (opt.values.includes(val)) return;

    const updatedOptions = [...options];
    const targetOpt = updatedOptions[index];
    if (targetOpt) {
      targetOpt.values = [...targetOpt.values, val];
      targetOpt.valueInput = "";
      setOptions(updatedOptions);
      regenerateVariants(updatedOptions);
    }
  };

  const handleRemoveOptionValue = (optIndex: number, valIndex: number) => {
    const updatedOptions = [...options];
    const targetOpt = updatedOptions[optIndex];
    if (targetOpt) {
      targetOpt.values = targetOpt.values.filter((_, i) => i !== valIndex);
      setOptions(updatedOptions);
      regenerateVariants(updatedOptions);
    }
  };

  const handleRemoveOption = (index: number) => {
    const updatedOptions = options.filter((_, i) => i !== index);
    setOptions(updatedOptions);
    regenerateVariants(updatedOptions);
  };

  // Cartesian product variant generator
  const regenerateVariants = (currentOptions: OptionState[]) => {
    const valid = currentOptions.filter((o) => o.name.trim() && o.values.length > 0);

    if (valid.length === 0) {
      setVariants([
        {
          sku: `${name ? name.slice(0, 4).toUpperCase() : "PROD"}-DEF`,
          title: "Default Variant",
          price: variants[0]?.price ?? 100000,
          stock: variants[0]?.stock ?? 0,
        },
      ]);
      return;
    }

    const cartesian = (arr: string[][]): string[][] => {
      return arr.reduce<string[][]>(
        (acc, curr) => acc.flatMap((c) => curr.map((n) => [...c, n])),
        [[]],
      );
    };

    const valueArrays = valid.map((o) => o.values);
    const combinations = cartesian(valueArrays);

    const basePrefix = name ? name.replace(/[^\w]/g, "").slice(0, 4).toUpperCase() : "PROD";

    const seenSkus = new Set<string>();
    const newVariants: VariantState[] = combinations.map((combo, idx) => {
      const title = combo.join(" / ");
      const rawSuffix = combo
        .map((c) =>
          c
            .trim()
            .split(/\s+/)
            .map((w) => w.slice(0, 3).toUpperCase())
            .join(""),
        )
        .join("-");

      let finalSku = `${basePrefix}-${rawSuffix}`;
      if (seenSkus.has(finalSku)) {
        finalSku = `${finalSku}-${idx + 1}`;
      }
      seenSkus.add(finalSku);

      return {
        sku: finalSku,
        title,
        price: variants[0]?.price ?? 100000,
        stock: 0,
      };
    });

    setVariants(newVariants);
  };

  // Direct image upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setErrorMsg(null);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Upload failed");
        }

        const data = await res.json();
        setImages((prev) => [
          ...prev,
          {
            url: data.url,
            altText: name || "Product image",
            position: prev.length,
          },
        ]);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (!name.trim()) throw new Error("Product name is required");
      if (variants.length === 0) throw new Error("At least one variant is required");

      if (isEditing && initialProduct) {
        await updateProductAction({
          id: initialProduct.id,
          name,
          description,
          categoryId: categoryId || null,
          status,
          seoTitle: seoTitle || name,
          seoDescription: seoDescription || description.slice(0, 160),
        });
        router.push("/admin/products");
      } else {
        await createProductAction({
          name,
          description,
          categoryId: categoryId || undefined,
          status,
          seoTitle: seoTitle || name,
          seoDescription: seoDescription || description.slice(0, 160),
          collectionIds: selectedCollections,
          variants: variants.map((v) => ({
            sku: v.sku,
            title: v.title,
            price: Number(v.price),
            compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : undefined,
            stock: Number(v.stock),
          })),
          images: images.map((img, idx) => ({
            url: img.url,
            altText: img.altText,
            position: idx,
          })),
        });
        router.push("/admin/products");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save product");
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialProduct) return;
    if (!confirm("Are you sure you want to soft delete this product?")) return;

    setIsSubmitting(true);
    try {
      await deleteProductAction(initialProduct.id);
      router.push("/admin/products");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete product");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950">
              {isEditing ? `Edit: ${initialProduct?.name}` : "Create Product"}
            </h1>
            <p className="text-sm text-zinc-500">
              {isEditing
                ? "Update product attributes, variants, and SEO."
                : "Configure product details and pricing."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEditing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3.5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? "Save Changes" : "Create Product"}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column (2/3): General Info, Images, Variants */}
        <div className="space-y-6 lg:col-span-2">
          {/* General Information Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-base font-semibold text-zinc-900">General Information</h2>

            <div>
              <label
                htmlFor="prod-name-input"
                className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5"
              >
                Product Title *
              </label>
              <input
                id="prod-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kemeja Batik Modern Slim Fit"
                required
                className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label
                htmlFor="prod-desc-input"
                className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5"
              >
                Description
              </label>
              <textarea
                id="prod-desc-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Product description, materials, specifications, and care instructions..."
                className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Media / Images Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-base font-semibold text-zinc-900">Media</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {images.map((img, idx) => (
                <div
                  key={img.url}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
                >
                  <SafeImage
                    src={img.url}
                    fallbackSrc="/images/placeholder.svg"
                    alt={img.altText}
                    fill
                    sizes="160px"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-2 right-2 rounded-md bg-white/90 p-1 text-zinc-700 shadow-xs opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600 z-10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-2 left-2 rounded-md bg-zinc-900/80 px-2 py-0.5 text-[10px] font-medium text-white z-10">
                      Primary
                    </span>
                  )}
                </div>
              ))}

              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50/50 p-4 text-center transition hover:bg-zinc-50">
                <Upload className="h-6 w-6 text-zinc-400 mb-1" />
                <span className="text-xs font-medium text-zinc-700">
                  {isUploading ? "Uploading..." : "Add Images"}
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5">JPEG, PNG, WEBP</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Options & Variants Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Options & Variants</h2>
                <p className="text-xs text-zinc-500">
                  Configure options like Size and Color to automatically generate variants.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddOption}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Option
              </button>
            </div>

            {/* Options List */}
            {options.map((opt, optIdx) => (
              <div
                key={opt.name || `opt-${optIdx}`}
                className="rounded-lg border border-zinc-100 bg-zinc-50/60 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <input
                    type="text"
                    value={opt.name}
                    onChange={(e) => {
                      const updated = [...options];
                      const target = updated[optIdx];
                      if (target) {
                        target.name = e.target.value;
                        setOptions(updated);
                        regenerateVariants(updated);
                      }
                    }}
                    placeholder="Option Name (e.g. Size, Color)"
                    className="w-1/3 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(optIdx)}
                    className="text-zinc-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Values input & tags */}
                <div className="flex flex-wrap items-center gap-2">
                  {opt.values.map((val, valIdx) => (
                    <span
                      key={val}
                      className="inline-flex items-center gap-1.5 rounded-md bg-white border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-800 shadow-2xs"
                    >
                      {val}
                      <button
                        type="button"
                        onClick={() => handleRemoveOptionValue(optIdx, valIdx)}
                        className="text-zinc-400 hover:text-zinc-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={opt.valueInput}
                      onChange={(e) => {
                        const updated = [...options];
                        const target = updated[optIdx];
                        if (target) {
                          target.valueInput = e.target.value;
                          setOptions(updated);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddOptionValue(optIdx);
                        }
                      }}
                      placeholder="Add value (press Enter)"
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddOptionValue(optIdx)}
                      className="rounded-lg bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-300"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Generated Variants Table */}
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-200 bg-zinc-50 font-semibold text-zinc-600">
                  <tr>
                    <th className="px-4 py-2.5">Variant</th>
                    <th className="px-4 py-2.5">SKU *</th>
                    <th className="px-4 py-2.5">Price (IDR) *</th>
                    <th className="px-4 py-2.5">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {variants.map((v, vIdx) => (
                    <tr key={v.sku || `variant-${vIdx}`} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-2.5 font-medium text-zinc-900">{v.title}</td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={v.sku}
                          onChange={(e) => {
                            const updated = [...variants];
                            const target = updated[vIdx];
                            if (target) {
                              target.sku = e.target.value;
                              setVariants(updated);
                            }
                          }}
                          required
                          className="w-32 rounded border border-zinc-200 px-2 py-1 text-xs focus:border-zinc-900 focus:outline-hidden"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          value={v.price}
                          onChange={(e) => {
                            const updated = [...variants];
                            const target = updated[vIdx];
                            if (target) {
                              target.price = Number(e.target.value);
                              setVariants(updated);
                            }
                          }}
                          required
                          min={0}
                          className="w-32 rounded border border-zinc-200 px-2 py-1 text-xs focus:border-zinc-900 focus:outline-hidden"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          value={v.stock}
                          onChange={(e) => {
                            const updated = [...variants];
                            const target = updated[vIdx];
                            if (target) {
                              target.stock = Number(e.target.value);
                              setVariants(updated);
                            }
                          }}
                          min={0}
                          className="w-24 rounded border border-zinc-200 px-2 py-1 text-xs focus:border-zinc-900 focus:outline-hidden"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (1/3): Organization & Status */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-base font-semibold text-zinc-900">Publishing Status</h2>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "draft" | "published" | "archived")}
              className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden capitalize"
            >
              <option value="draft">Draft (Hidden)</option>
              <option value="published">Published (Visible in Storefront)</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Categorization Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-base font-semibold text-zinc-900">Category & Collections</h2>

            <div>
              <label
                htmlFor="prod-cat-select"
                className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5"
              >
                Primary Category
              </label>
              <select
                id="prod-cat-select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              >
                <option value="">No Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                Collections
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto pt-1">
                {collections.map((col) => {
                  const isChecked = selectedCollections.includes(col.id);
                  return (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedCollections(
                              selectedCollections.filter((id) => id !== col.id),
                            );
                          } else {
                            setSelectedCollections([...selectedCollections, col.id]);
                          }
                        }}
                        className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                      />
                      <span>{col.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Search Engine Optimization (SEO) */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
            <h2 className="text-base font-semibold text-zinc-900">Search Engine Listing</h2>
            <div>
              <label
                htmlFor="prod-seo-title-input"
                className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5"
              >
                SEO Page Title
              </label>
              <input
                id="prod-seo-title-input"
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder={name || "Product Page Title"}
                className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
            <div>
              <label
                htmlFor="prod-seo-desc-input"
                className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1.5"
              >
                SEO Meta Description
              </label>
              <textarea
                id="prod-seo-desc-input"
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={3}
                placeholder={description.slice(0, 160) || "Meta description for Google search..."}
                className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
