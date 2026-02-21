'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

// TU BYŁ BRAK: Definicja typu musi mieć 'stock'
export type CartItem = {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  seller_id: string;
  quantity: number;
  stock: number; // <--- TO JEST KLUCZOWE
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  updateQuantity: (id: string, amount: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const savedCart = localStorage.getItem('printsi_cart');
    if (savedCart) setItems(JSON.parse(savedCart));
  }, []);

  useEffect(() => {
    localStorage.setItem('printsi_cart', JSON.stringify(items));
  }, [items]);

  const addItem = (newItem: Omit<CartItem, 'quantity'>, quantity: number = 1) => {
    setItems((prevItems) => {
      const existingItem = prevItems.find((i) => i.id === newItem.id);
      
      const currentQty = existingItem ? existingItem.quantity : 0;
      const availableStock = newItem.stock; 

      if (currentQty + quantity > availableStock) {
        alert(`Sorry, only ${availableStock} items available in stock.`);
        return prevItems;
      }

      if (existingItem) {
        return prevItems.map((i) => 
          i.id === newItem.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      } else {
        return [...prevItems, { ...newItem, quantity }];
      }
    });
  };

  const updateQuantity = (id: string, amount: number) => {
    setItems((prev) => prev.map((item) => {
      if (item.id === id) {
        const newQuantity = item.quantity + amount;
        
        if (newQuantity > item.stock) {
           alert(`Cannot add more. Only ${item.stock} available.`);
           return item;
        }
        if (newQuantity < 1) return item;

        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setItems([]);
  };

  const cartTotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);
  const cartCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clearCart, cartTotal, cartCount }}>
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