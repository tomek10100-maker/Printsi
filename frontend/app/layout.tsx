import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { CartProvider } from '../context/CartContext';
import { CurrencyProvider } from '../context/CurrencyContext';
import { ThemeProvider } from '../context/ThemeContext';
import NotificationToast from './components/NotificationToast';
import GlobalToast from './components/GlobalToast';
import { AuthGuard } from './components/AuthGuard';
import { ErrorSuppressor } from './components/ErrorSuppressor';
import CookieConsent from './components/CookieConsent';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Printis - 3D Ecosystem',
  description: 'Future of Creation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="midnight">
      <body className={inter.className}>
        <ErrorSuppressor />
        <ThemeProvider>
          <CartProvider>
            <CurrencyProvider>
              <AuthGuard />
              <div className="bg-red-600 text-white text-center py-2 px-4 text-xs sm:text-sm font-black uppercase tracking-widest sticky top-0 z-[100] shadow-md">
                🚧 We are currently in beta testing. Please do not make any real purchases! 🚧
              </div>
              {children}
              {/* Global real-time notification toasts */}
              <NotificationToast />
              {/* Global application alert toasts */}
              <GlobalToast />
              {/* Cookie consent banner */}
              <CookieConsent />
            </CurrencyProvider>
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}