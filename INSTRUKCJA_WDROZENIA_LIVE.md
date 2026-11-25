# 🚀 PRINTIS.STORE — INSTRUKCJA WDROŻENIA LIVE (100% PRODUKCJA)

**Autor:** Antigravity Assistant dla **Tomasza Szmala** (Założyciel & Twórca Printis)  
**Data aktualizacji:** Listopad 2026  
**Status:** Gotowy do wdrożenia produkcyjnego  

---

## 📋 Spis treści
1. [Vercel — Zmienne środowiskowe do podmiany (Jakie konta i jakie wartości)](#1-vercel--zmienne-środowiskowe-do-podmiany)
2. [Supabase — Token Furgonetki & Procedura czyszczenia bazy (SQL)](#2-supabase--token-furgonetki--czyszczenie-bazy-przed-startem)
3. [Kod źródłowy — Jak usunąć czerwony baner BETA przed samym startem](#3-kod-źródłowy--usunięcie-czerwonego-baneru-beta)
4. [Wisienka na torcie — Integracje zewnętrzne i formalności (Stripe, Furgonetka, Resend, DNS)](#4-wisienka-na-torcie--integracje-zewnętrzne-i-formalności)
5. [Dodatkowe wskazówki i ostateczny test (Sanity Check)](#5-dodatkowe-wskazówki-i-ostateczny-test-sanity-check)

---

## 1. Vercel — Zmienne środowiskowe do podmiany

> **Ścieżka:** Vercel Dashboard ➔ Twój Projekt (`Printis`) ➔ **Settings** ➔ **Environment Variables**  
> **Wskazówka:** Upewnij się, że zaznaczone jest środowisko **Production** (po zapisaniu zrób *Redeploy*).

### [A] Kurier & Logistyka: Furgonetka.pl
*Konto: Prawdziwe, aktywne konto biznesowe na [furgonetka.pl](https://furgonetka.pl) (nie sandbox!)*

| Zmienna | Obecna wartość | Nowa wartość LIVE | Opis / Skąd wziąć |
| :--- | :--- | :--- | :--- |
| `FURGONETKA_FORCE_PRODUCTION` | *(brak lub false)* | **`true`** | **KRYTYCZNE!** Bez tej zmiennej backend zawsze wymusi tryb testowy sandbox. |
| `FURGONETKA_ENV` | `sandbox` | **`production`** | Przełącza API na `https://api.furgonetka.pl`. |
| `FURGONETKA_CLIENT_ID` | `printsi-5ad4...` | **Twój produkcyjny Client ID** | *Furgonetka.pl ➔ Ustawienia konta ➔ Integracje ➔ API*. |
| `FURGONETKA_CLIENT_SECRET` | `899069...` | **Twój produkcyjny Client Secret** | Wygenerowany razem z Client ID w panelu Furgonetka.pl. |
| `FURGONETKA_WEBHOOK_SECRET` | `printsi2026` | **Silny token (np. 32 znaki hex)** | Taki sam wpisz na Vercelu i w panelu Furgonetki w Webhookach. |
| `NEXT_PUBLIC_FURGONETKA_MAP_API_KEY` | Klucz dev | **Produkcyjny klucz widgetu mapy** | *Furgonetka.pl ➔ Integracje ➔ Widget Mapy Paczkomatów*. |
| `FURGONETKA_PICKUP_POINT` | `WAW01M` | **Twój domyślny Paczkomat/Punkt** | Np. paczkomat w Krakowie, skąd nadawane są paczki domyślnie. |

---

### [B] Płatności: Stripe Live
*Konto: Prawdziwe konto firmowe na [dashboard.stripe.com](https://dashboard.stripe.com) z wyłączonym "Test Mode"*

| Zmienna | Obecna wartość | Nowa wartość LIVE | Opis / Skąd wziąć |
| :--- | :--- | :--- | :--- |
| `STRIPE_SECRET_KEY` | `sk_test_...` | **`sk_live_...`** | *Stripe Dashboard ➔ Developers ➔ API keys ➔ Secret key*. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | **`pk_live_...`** | *Stripe Dashboard ➔ Developers ➔ API keys ➔ Publishable key*. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_test...` | **`whsec_...`** | *Stripe ➔ Developers ➔ Webhooks ➔ Add Endpoint*: URL: `https://printis.store/api/webhook`. |

---

### [C] E-maile transakcyjne: Resend
*Konto: [resend.com](https://resend.com) z potwierdzoną domeną `printis.store`*

| Zmienna | Obecna wartość | Nowa wartość LIVE | Opis / Skąd wziąć |
| :--- | :--- | :--- | :--- |
| `RESEND_API_KEY` | `re_...` | **Produkcyjny klucz API** | *Resend Dashboard ➔ API Keys ➔ Create API Key*. Domena musi mieć status *Verified*. |

---

### [D] Bezpieczeństwo i URL
| Zmienna | Wartość LIVE | Znaczenie |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | `https://printis.store` | Bez ukośnika na końcu (`/`). |
| `NEXT_PUBLIC_BASE_URL` | `https://printis.store` | Bez ukośnika na końcu (`/`). |
| `CRON_SECRET` | Losowy silny hash | Zabezpiecza codzienny cron sprawdzający 4-dniowy termin wysyłki (`/api/cron/shipping-deadlines`). |
| `ADMIN_SECRET_KEY` | Losowy silny hash | Zabezpiecza wewnętrzny endpoint admina `/api/admin/transfer`. |

---

## 2. Supabase — Token Furgonetki & Czyszczenie bazy przed startem

### Krok 1: Wygenerowanie nowego produkcyjnego tokena Furgonetki
1. Otwórz **Supabase SQL Editor** i usuń stary token testowy:
   ```sql
   TRUNCATE TABLE furgonetka_tokens;
   ```
2. Wejdź w przeglądarce pod adres:
   👉 **`https://printis.store/api/furgonetka/auth`**
3. Zaloguj się Twoim **prawdziwym kontem Furgonetka.pl** i kliknij **Autoryzuj**.
4. Zostaniesz automatycznie przekierowany z powrotem na `printis.store` z potwierdzeniem sukcesu. Nowy token produkcyjny jest natychmiast aktywny i samoodnawialny w bazie!

### Krok 2: Czyszczenie danych testowych przed oficjalnym startem
Wklej poniższy skrypt w **Supabase SQL Editor**:

```sql
-- 1. Usunięcie testowych zamówień i ich pozycji
DELETE FROM order_items;
DELETE FROM orders;

-- 2. Usunięcie testowych czatów i wiadomości
DELETE FROM messages;
DELETE FROM chats;

-- 3. Usunięcie testowych sporów, powiadomień, recenzji i wypłat
DELETE FROM disputes;
DELETE FROM notifications;
DELETE FROM reviews;
DELETE FROM payouts;

-- 4. Wyzerowanie wirtualnych sald testowych użytkowników
UPDATE profiles SET 
  total_sales_value = 0,
  pending_funds = 0,
  account_balance = 0;

-- 5. Usunięcie testowych ofert
DELETE FROM offers WHERE title ILIKE '%ELLLLLLOOO%' OR title ILIKE '%test%';
```

---

## 3. Kod źródłowy — Usunięcie czerwonego baneru BETA

Czerwony pasek na samej górze zostawiliśmy w kodzie, dopóki sprawdzasz platformę.

Przed samym publicznym ogłoszeniem startu:
- **Plik:** `frontend/app/layout.tsx`
- **Linie 40-42:**
  ```tsx
  <div className="bg-red-600 text-white text-center py-2 px-4 text-xs sm:text-sm font-black uppercase tracking-widest sticky top-0 z-[100] shadow-md">
    🚧 We are currently in beta testing. Please do not make any real purchases! 🚧
  </div>
  ```
- **Akcja:** Usuń te 3 linijki, zrób `git commit` i `git push` — baner natychmiast zniknie ze strony.

---

## 4. Wisienka na torcie — Integracje zewnętrzne i formalności

### 💳 Stripe (Płatności)
1. **Weryfikacja tożsamości (KYC):** Uzupełnij w Stripe Dashboard dane osobowe, PESEL, adres w Krakowie oraz numer rachunku bankowego do wypłat.
2. **Stripe Connect Express:** Upewnij się, że Express Dashboard jest włączony. Twórcy na platformie samodzielnie przechodzą proces onboardingu Stripe i otrzymują wypłaty bezpośrednio na swoje konta bankowe.
3. **Webhook:** Ustaw endpoint `https://printis.store/api/webhook` z subskrypcją zdarzeń: `checkout.session.completed`, `account.updated`, `transfer.created`, `charge.refunded`.

### 📦 Furgonetka.pl (Kurierzy)
1. **Saldo prepaid / Karta:** Furgonetka wymaga dodatniego salda (np. 100 zł na start) lub podpiętej karty płatniczej, by móc generować i pobierać etykiety PDF w locie przez API.
   *(Jeśli środki się skończą, Printis zabezpiecza sytuację: tworzy przesyłkę roboczą DRAFT i wysyła sprzedawcy link do opłacenia w panelu Furgonetki).*
2. **Regulaminy przewoźników:** Zaloguj się na Furgonetka.pl i zaakceptuj regulaminy (InPost Paczkomaty, InPost Kurier, DPD, DHL).
3. **Webhook statusów:** Wpisz adres `https://printis.store/api/furgonetka/callback` z Twoim tajnym kluczem.

### ✉️ Resend & DNS (E-maile)
1. W panelu Resend dodaj domenę `printis.store`.
2. U rejestratora domeny dodaj rekordy DNS:
   - **SPF:** `v=spf1 include:amazonses.com ~all`
   - **DKIM:** Rekord TXT wygenerowany przez Resend
   - **DMARC:** `_dmarc.printis.store` ➔ `v=DMARC1; p=none;`
3. Gdy Resend wyświetli status **Verified**, maile z potwierdzeniem zakupu i linkami do plików STL będą lądować prosto w skrzynkach odbiorczych (nie w Spamie).

### 🔍 Google Search Console & SEO
1. Wejdź na [Google Search Console](https://search.google.com/search-console) i dodaj domenę `https://printis.store`.
2. Zgłoś mapę witryny: `https://printis.store/sitemap.xml`.
3. Google automatycznie rozpocznie indeksowanie Twojego sklepu i ofert twórców.

---

## 5. Dodatkowe wskazówki i ostateczny test (Sanity Check)

1. **Test 1 EUR przed startem:**
   Wystaw ze swojego konta mały przedmiot lub plik STL za 1 EUR i kup go używając innego urządzenia i prawdziwej karty / Blika.
   - Sprawdź, czy płatność się powiodła.
   - Sprawdź, czy przyszedł mail z `support@printis.store` / `noreply@printis.store`.
   - Sprawdź, czy w czacie pojawiła się etykieta kurierska Furgonetki w formacie PDF.
2. **Przekierowanie skrzynki Support:**
   Skonfiguruj skrzynkę `support@printis.store` tak, aby przychodzące wiadomości natychmiast trafiały na Twój telefon (np. forward na Gmail).
3. **Prawne bezpieczeństwo:**
   Strona `/about`, Regulamin (`/terms`) oraz Polityka Prywatności (`/privacy-policy`) zawierają już pełne, zgodne z polskim prawem zapisy o działalności nierejestrowanej (Tomasz Szmal, Kraków, Art. 5 Prawa przedsiębiorców), z jednoczesnym zapewnieniem 100% ochrony kupujących (Escrow i gwarancja satysfakcji).

---
🎉 **Wszystko gotowe — życzymy udanego startu Printis!**
