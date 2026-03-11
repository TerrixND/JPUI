"use client";

import { useSyncExternalStore } from "react";

const CART_STORAGE_KEY = "jade-palace-cart-v1";
const CART_UPDATED_EVENT = "jade-palace-cart-updated";

export type CartItem = {
  id: string;
  name: string;
  sku: string | null;
  color: string | null;
  tier: string | null;
  status: string | null;
  imageId: string | null;
  imageUrl: string | null;
  detailHref: string;
  addedAt: string;
};

type CartStore = {
  items: CartItem[];
};

const EMPTY_CART: CartStore = {
  items: [],
};

let cachedCartStoreRaw: string | null | undefined;
let cachedCartStore: CartStore = EMPTY_CART;

const isBrowser = () => typeof window !== "undefined";

const normalizeCartItem = (value: Partial<CartItem> | null | undefined): CartItem | null => {
  const id = typeof value?.id === "string" ? value.id.trim() : "";
  if (!id) {
    return null;
  }

  const name = typeof value?.name === "string" ? value.name.trim() : "";
  if (!name) {
    return null;
  }

  const normalizedSku = typeof value?.sku === "string" ? value.sku.trim() : "";
  const normalizedColor = typeof value?.color === "string" ? value.color.trim() : "";
  const normalizedTier = typeof value?.tier === "string" ? value.tier.trim() : "";
  const normalizedStatus = typeof value?.status === "string" ? value.status.trim() : "";
  const normalizedImageId = typeof value?.imageId === "string" ? value.imageId.trim() : "";
  const normalizedImageUrl = typeof value?.imageUrl === "string" ? value.imageUrl.trim() : "";
  const normalizedDetailHref =
    typeof value?.detailHref === "string" && value.detailHref.trim()
      ? value.detailHref.trim()
      : `/products/${encodeURIComponent(id)}`;

  return {
    id,
    name,
    sku: normalizedSku || null,
    color: normalizedColor || null,
    tier: normalizedTier || null,
    status: normalizedStatus || null,
    imageId: normalizedImageId || null,
    imageUrl: normalizedImageUrl || null,
    detailHref: normalizedDetailHref,
    addedAt:
      typeof value?.addedAt === "string" && value.addedAt.trim()
        ? value.addedAt.trim()
        : new Date().toISOString(),
  };
};

const parseCartStore = (raw: string | null): CartStore => {
  if (!raw) {
    return EMPTY_CART;
  }

  try {
    const parsed = JSON.parse(raw) as { items?: unknown };
    const items = Array.isArray(parsed?.items)
      ? parsed.items
          .map((entry) => normalizeCartItem((entry ?? null) as Partial<CartItem> | null))
          .filter((entry): entry is CartItem => Boolean(entry))
      : [];

    return {
      items,
    };
  } catch {
    return EMPTY_CART;
  }
};

const readCartStore = (): CartStore => {
  if (!isBrowser()) {
    return EMPTY_CART;
  }

  const raw = window.localStorage.getItem(CART_STORAGE_KEY);

  if (raw === cachedCartStoreRaw) {
    return cachedCartStore;
  }

  cachedCartStoreRaw = raw;
  cachedCartStore = parseCartStore(raw);
  return cachedCartStore;
};

const writeCartStore = (store: CartStore) => {
  if (!isBrowser()) {
    return;
  }

  const serializedStore = JSON.stringify(store);
  cachedCartStoreRaw = serializedStore;
  cachedCartStore = parseCartStore(serializedStore);

  window.localStorage.setItem(CART_STORAGE_KEY, serializedStore);
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
};

export const getCartItems = () => readCartStore().items;

export const isProductInCart = (productId: string) =>
  getCartItems().some((item) => item.id === productId.trim());

export const addCartItem = (item: Partial<CartItem>) => {
  const normalizedItem = normalizeCartItem(item);
  if (!normalizedItem) {
    return false;
  }

  const currentItems = getCartItems();
  const nextItems = [
    normalizedItem,
    ...currentItems.filter((entry) => entry.id !== normalizedItem.id),
  ];

  writeCartStore({ items: nextItems });
  return true;
};

export const removeCartItem = (productId: string) => {
  const normalizedProductId = productId.trim();
  if (!normalizedProductId) {
    return;
  }

  writeCartStore({
    items: getCartItems().filter((item) => item.id !== normalizedProductId),
  });
};

export const clearCart = () => {
  writeCartStore(EMPTY_CART);
};

const subscribe = (onStoreChange: () => void) => {
  if (!isBrowser()) {
    return () => undefined;
  }

  const handleChange = () => onStoreChange();

  window.addEventListener(CART_UPDATED_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(CART_UPDATED_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
};

const getSnapshot = () => readCartStore().items;

const getServerSnapshot = () => EMPTY_CART.items;

export const useCart = () => {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    items,
    count: items.length,
    hasItems: items.length > 0,
    contains: (productId: string) => items.some((item) => item.id === productId.trim()),
    addItem: addCartItem,
    removeItem: removeCartItem,
    clear: clearCart,
  };
};
