'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { useCart } from '../../context/CartContext';
import { useCurrency } from '../../context/CurrencyContext';
import { Trash2, ArrowRight, ShoppingBag, X, Package, Plus, Minus, Wallet, CreditCard, Loader2 } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CartPage() {
  const { items, updateQuantity, removeItem, cartTotal, cartCount } = useCart();
  const { formatPrice } = useCurrency();

  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

  useEffect(() => {
    const fetchBalance = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBalanceLoading(false);
        return;
      }

      // Calculate balance: earnings from selling - spending from buying
      const { data: sales } = await supabase
        .from('order_items')
        .select('price_at_purchase, quantity')
        .eq('seller_id', user.id);

      const totalEarned = sales?.reduce(
        (acc, s) => acc + (s.price_at_purchase * (s.quantity || 1)), 0
      ) || 0;

      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('buyer_id', user.id);

      const totalSpent = orders?.reduce(
        (acc, o) => acc + Number(o.total_amount), 0
      ) || 0;

      // Balance can never go below 0
      setUserBalance(Math.max(0, totalEarned - totalSpent));
      setBalanceLoading(false);
    };

    fetchBalance();
  }, []);

  // Smart payment logic
  const canPayWithBalance = userBalance !== null && userBalance >= cartTotal;

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
            <ShoppingBag size={32} className="mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-bold uppercase mb-2">Cart is empty</h2>
            <Link href="/gallery" className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-xl font-bold uppercase tracking-widest mt-4 hover:bg-blue-600 transition-all">
              Go Shopping
            </Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-12">

            {/* CART ITEMS */}
            <div className="flex-1 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-6">

                  <div className="w-24 h-24 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><Package size={20} /></div>
                    )}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-bold text-lg leading-tight mb-1">{item.title}</h3>
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
                    <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-md shadow-sm hover:bg-gray-100 transition"><Minus size={12} /></button>
                    <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className={`w-8 h-8 flex items-center justify-center rounded-md shadow-sm transition ${item.stock !== undefined && item.quantity >= item.stock ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-100'}`}
                      disabled={item.stock !== undefined && item.quantity >= item.stock}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <div className="text-right min-w-[80px]">
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

                <div className="flex justify-between text-xl font-black mb-4">
                  <span>Total</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>

                {/* BALANCE INFO */}
                <div className={`rounded-xl p-4 mb-6 border ${balanceLoading
                    ? 'bg-gray-50 border-gray-200'
                    : canPayWithBalance
                      ? 'bg-green-50 border-green-200'
                      : 'bg-orange-50 border-orange-200'
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet size={16} className={balanceLoading ? 'text-gray-400' : canPayWithBalance ? 'text-green-600' : 'text-orange-500'} />
                    <span className="text-xs font-black uppercase tracking-widest text-gray-600">Printsi Balance</span>
                  </div>

                  {balanceLoading ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Loader2 size={14} className="animate-spin text-gray-400" />
                      <span className="text-xs text-gray-400">Loading balance...</span>
                    </div>
                  ) : userBalance === null ? (
                    <p className="text-xs text-gray-500 mt-1">Log in to use your balance</p>
                  ) : (
                    <>
                      <p className={`text-xl font-black mt-1 ${canPayWithBalance ? 'text-green-700' : 'text-orange-600'}`}>
                        {formatPrice(userBalance)}
                      </p>
                      <p className="text-[11px] mt-1 font-medium text-gray-500">
                        {canPayWithBalance
                          ? '✅ Enough to cover this order!'
                          : `❌ Not enough — need ${formatPrice(cartTotal - userBalance)} more`}
                      </p>
                    </>
                  )}
                </div>

                {/* SMART PAYMENT BUTTON */}
                {balanceLoading ? (
                  <div className="w-full py-4 bg-gray-100 rounded-xl flex items-center justify-center gap-2 text-gray-400 font-black uppercase tracking-widest">
                    <Loader2 size={18} className="animate-spin" /> Loading...
                  </div>
                ) : canPayWithBalance ? (
                  <Link
                    href="/checkout?method=balance"
                    className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <Wallet size={18} /> Pay with Balance
                  </Link>
                ) : (
                  <Link
                    href="/checkout?method=stripe"
                    className="w-full py-4 bg-gray-900 hover:bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <CreditCard size={18} /> Pay with Card <ArrowRight size={18} />
                  </Link>
                )}

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