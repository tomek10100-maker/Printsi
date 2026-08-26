"use client";

import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CurrencyContextProps {
  rates: Record<string, number> | null;
  formatPrice: (amount: number, skipConversion?: boolean) => string;
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
      let savedCurrency = typeof window !== 'undefined' ? localStorage.getItem('printis_currency') : null;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('currency').eq('id', user.id).single();
          if (profile?.currency) {
            savedCurrency = profile.currency;
            if (typeof window !== 'undefined') localStorage.setItem('printis_currency', savedCurrency!);
          }
        }
      } catch (err) {
        console.warn('Silent auth error in currency context:', err);
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
      localStorage.setItem('printis_currency', newCurrency);
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
    } catch (error: any) {
      console.warn("Failed to fetch currency rates:", error?.message || error);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const formatPrice = (amount: number, skipConversion: boolean = false) => {
    let convertedAmount = amount;

    if (!skipConversion && currency !== 'EUR' && rates && rates[currency]) {
      convertedAmount = amount * rates[currency];
    }

    let roundedAmount = Math.round(convertedAmount * 100) / 100;

    // Smart integer-snapping: snap amounts within 0.02 of a whole number (e.g. 99.99 -> 100.00, 1000.01 -> 1000.00)
    const diffToInteger = Math.abs(roundedAmount - Math.round(roundedAmount));
    if (diffToInteger > 0 && diffToInteger <= 0.02) {
      roundedAmount = Math.round(roundedAmount);
    }

    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(roundedAmount);

    // Replace all commas and spaces with non-breaking spaces (\u00a0)
    // so currency symbols and amounts (e.g. PLN 2 949.84) never wrap onto multiple lines.
    return formatted.replace(/,/g, '\u00a0').replace(/\s/g, '\u00a0');
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