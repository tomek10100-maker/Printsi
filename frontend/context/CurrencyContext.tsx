"use client";

import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CurrencyContextProps {
  rates: Record<string, number> | null;
  formatPrice: (amount: number) => string;
  currency: string;
  setCurrency: (currency: string) => void;
}

export const CurrencyContext = createContext<CurrencyContextProps>({
  rates: null,
  formatPrice: (amount: number) => `${amount} €`,
  currency: 'EUR',
  setCurrency: () => { }
});

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [currency, setCurrencyState] = useState('EUR');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initCurrency = async () => {
      let savedCurrency = typeof window !== 'undefined' ? localStorage.getItem('printsi_currency') : null;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('currency').eq('id', user.id).single();
        if (profile?.currency) {
          savedCurrency = profile.currency;
          if (typeof window !== 'undefined') localStorage.setItem('printsi_currency', savedCurrency!);
        }
      }

      if (savedCurrency) {
        setCurrencyState(savedCurrency);
      }
      setInitialized(true);
    };

    initCurrency();
  }, []);

  const setCurrency = async (newCurrency: string) => {
    setCurrencyState(newCurrency);
    if (typeof window !== 'undefined') {
      localStorage.setItem('printsi_currency', newCurrency);
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ currency: newCurrency }).eq('id', user.id);
    }
  };

  const fetchRates = async () => {
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/EUR');

      if (!res.ok) {
        throw new Error(`Network response was not ok: ${res.status}`);
      }

      const data = await res.json();

      if (data && data.rates) {
        setRates(data.rates);
      }
    } catch (error) {
      console.error("Failed to fetch currency rates:", error);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const formatPrice = (amount: number) => {
    let convertedAmount = amount;

    if (currency !== 'EUR' && rates && rates[currency]) {
      convertedAmount = amount * rates[currency];
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(convertedAmount);
  };

  return (
    <CurrencyContext.Provider value={{ rates, formatPrice, currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);

  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }

  return context;
};