import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { CartProvider } from '../context/CartContext'; 
// 1. IMPORTUJEMY CONTEXT WALUTOWY
import { CurrencyProvider } from '../context/CurrencyContext'; 

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Printsi - 3D Ecosystem',
  description: 'Future of Creation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <CartProvider>
          {/* 2. DODAJEMY PROVIDER TUTAJ */}
          <CurrencyProvider>
            {children}
          </CurrencyProvider>
        </CartProvider>
      </body>
    </html>
  );
}