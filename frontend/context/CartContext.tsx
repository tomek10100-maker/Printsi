'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type CartItem = {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  seller_id: string;
  quantity: number;
  stock: number;
  is_custom?: boolean;
  variant_name?: string;
  variant_color?: string;
  variant_layers?: { filament_id: string; grams: string | number; color_hex?: string; color_name?: string }[];
  category: string;
  material?: string;
  color?: string;
  dimensions?: string;
  weight?: string;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  updateQuantity: (id: string, amount: number, variant_name?: string) => void;
  removeItem: (id: string, variant_name?: string) => void;
  removeSellerItems: (sellerId: string) => void;
  removeItemsByIds: (ids: string[]) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('printis_cart');
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        const cleaned = Array.isArray(parsed) ? parsed.map((item: CartItem) => {
          if (item.category === 'digital') {
            return {
              ...item,
              variant_name: undefined,
              variant_color: undefined,
              variant_layers: undefined,
              material: undefined,
              color: undefined,
              weight: undefined,
            };
          }
          if (item.variant_name && item.variant_name.startsWith('#')) {
            return {
              ...item,
              variant_name: undefined,
              variant_color: item.variant_color || item.variant_name,
            };
          }
          return item;
        }) : [];
        setItems(cleaned);
      }
    } catch (e) {
      console.warn("Failed to parse cart JSON. Resetting cart.", e);
      localStorage.removeItem('printis_cart');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('printis_cart', JSON.stringify(items));
  }, [items]);

  const addItem = (newItem: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
    if (currentUserId && newItem.seller_id === currentUserId) {
      alert("You cannot purchase your own listing.");
      return;
    }

    const isDigital = newItem.category === 'digital';
    const sanitizedItem: Omit<CartItem, 'quantity'> = isDigital
      ? {
          ...newItem,
          variant_name: undefined,
          variant_color: undefined,
          variant_layers: undefined,
          material: undefined,
          color: undefined,
          weight: undefined,
        }
      : (newItem.variant_name && newItem.variant_name.startsWith('#'))
      ? {
          ...newItem,
          variant_name: undefined,
          variant_color: newItem.variant_color || newItem.variant_name,
        }
      : newItem;

    const existingItem = items.find((i) =>
        i.id === sanitizedItem.id && i.variant_name === sanitizedItem.variant_name
    );

    const currentQty = existingItem ? existingItem.quantity : 0;
    const availableStock = sanitizedItem.stock;

    if (currentQty + quantity > availableStock) {
        alert(`Sorry, only ${availableStock} items available in stock.`);
        return;
    }

    setItems((prevItems) => {
      if (existingItem) {
        return prevItems.map((i) =>
          (i.id === sanitizedItem.id && i.variant_name === sanitizedItem.variant_name) ? { ...i, quantity: i.quantity + quantity } : i
        );
      } else {
        return [...prevItems, { ...sanitizedItem, quantity: isDigital ? 1 : quantity }];
      }
    });
  };

  const updateQuantity = (id: string, amount: number, variant_name?: string) => {
    const item = items.find(i => i.id === id && i.variant_name === variant_name);
    if (!item) return;

    if (item.is_custom) {
        alert("Cannot modify quantity of an accepted custom proposal.");
        return;
    }

    const newQuantity = item.quantity + amount;

    if (newQuantity > item.stock) {
        alert(`Cannot add more. Only ${item.stock} available.`);
        return;
    }
    
    if (newQuantity < 1) return;

    setItems((prev) => prev.map((item) => {
      if (item.id === id && item.variant_name === variant_name) {
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const removeItem = (id: string, variant_name?: string) => {
    setItems((prev) => prev.filter((item) => !(item.id === id && item.variant_name === variant_name)));
  };

  const removeSellerItems = (sellerId: string) => {
    setItems((prev) => prev.filter((item) => item.seller_id !== sellerId));
  };

  const removeItemsByIds = (ids: string[]) => {
    const idSet = new Set(ids);
    setItems((prev) => prev.filter((item) => !idSet.has(item.id)));
  };

  const clearCart = () => {
    setItems([]);
  };

  const cartTotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);
  const cartCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, removeSellerItems, removeItemsByIds, clearCart, cartTotal, cartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}