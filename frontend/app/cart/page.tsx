'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '../../context/CartContext';
import { useCurrency } from '../../context/CurrencyContext'; // Import Currency Context
import { Trash2, ArrowRight, ShoppingBag, X, Package, Plus, Minus } from 'lucide-react';

export default function CartPage() {
  const { items, updateQuantity, removeItem, cartTotal, cartCount } = useCart();
  const { formatPrice } = useCurrency(); // Use the global formatter

  return (
    <main className="min-h-screen bg-gray-50 font-sans text-gray-900">
      
      {/* NAVBAR */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
            <img src="/logo.jpg" alt="Printsi" className="h-8 w-auto" />
        </Link>
        <Link href="/gallery" className="p-2 rounded-full hover:bg-gray-100 transition text-gray-500">
          <X size={24} />
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black uppercase tracking-tight mb-8 flex items-center gap-3">
          Your Cart <span className="text-gray-400 text-lg font-medium normal-case">({cartCount} items)</span>
        </h1>

        {items.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-300">
            <ShoppingBag size={32} className="mx-auto mb-4 text-gray-300"/>
            <h2 className="text-xl font-bold uppercase mb-2">Cart is empty</h2>
            <Link href="/gallery" className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-xl font-bold uppercase tracking-widest mt-4 hover:bg-blue-600 transition-all">
              Go Shopping
            </Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-12">
            
            {/* CART ITEMS LIST */}
            <div className="flex-1 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-6">
                  
                  <div className="w-24 h-24 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><Package size={20}/></div>
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-bold text-lg leading-tight mb-1">{item.title}</h3>
                    {/* Fixed: Use formatPrice for unit price */}
                    <p className="text-sm font-bold text-gray-500">
                      {formatPrice(item.price)} <span className="text-[10px] font-normal text-gray-400">/ each</span>
                    </p>
                    
                    {item.stock !== undefined && (
                      <p className="text-[10px] text-gray-400 mt-1 font-bold uppercase tracking-wider">
                        Stock: {item.stock}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-1">
                    <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm hover:bg-gray-100 transition"><Minus size={12}/></button>
                    <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, 1)} 
                      className={`w-8 h-8 flex items-center justify-center rounded-md shadow-sm transition ${item.stock !== undefined && item.quantity >= item.stock ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-100'}`}
                      disabled={item.stock !== undefined && item.quantity >= item.stock}
                    >
                      <Plus size={12}/>
                    </button>
                  </div>

                  <div className="text-right min-w-[80px]">
                    {/* Fixed: Use formatPrice for total item price */}
                    <p className="font-black text-xl">{formatPrice(item.price * item.quantity)}</p>
                    <button onClick={() => removeItem(item.id)} className="mt-2 text-[10px] font-bold text-red-400 hover:text-red-600 uppercase flex items-center gap-1 ml-auto transition">
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>

                </div>
              ))}
            </div>

            {/* SUMMARY */}
            <div className="w-full lg:w-96">
              <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl sticky top-24">
                <h3 className="text-lg font-black uppercase tracking-widest mb-6">Summary</h3>
                <div className="flex justify-between text-xl font-black mb-6">
                  <span>Total</span>
                  {/* Fixed: Use formatPrice for Cart Total */}
                  <span>{formatPrice(cartTotal)}</span>
                </div>
                <Link href="/checkout" className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2">
                  Checkout <ArrowRight size={18} />
                </Link>
                <div className="mt-4 text-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Free Shipping & Secure Payment</span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}