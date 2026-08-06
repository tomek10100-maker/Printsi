export type CountryDisplay = {
  code: string;
  name: string;
  flag: string;
};

export function getCountryDisplay(countryInput?: string): CountryDisplay {
  const raw = (countryInput || 'PL').trim();
  const upper = raw.toUpperCase();

  if (upper === 'PL' || upper === 'POLAND' || upper === 'POLSKA') {
    return { code: 'PL', name: 'Poland', flag: '🇵🇱' };
  }
  if (upper === 'DE' || upper === 'GERMANY' || upper === 'DEUTSCHLAND') {
    return { code: 'DE', name: 'Germany', flag: '🇩🇪' };
  }
  if (upper === 'US' || upper === 'USA' || upper === 'UNITED STATES') {
    return { code: 'US', name: 'United States', flag: '🇺🇸' };
  }
  if (upper === 'UK' || upper === 'GB' || upper === 'UNITED KINGDOM' || upper === 'GREAT BRITAIN') {
    return { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' };
  }
  if (upper === 'FR' || upper === 'FRANCE') {
    return { code: 'FR', name: 'France', flag: '🇫🇷' };
  }
  if (upper === 'IT' || upper === 'ITALY') {
    return { code: 'IT', name: 'Italy', flag: '🇮🇹' };
  }
  if (upper === 'ES' || upper === 'SPAIN') {
    return { code: 'ES', name: 'Spain', flag: '🇪🇸' };
  }
  if (upper === 'NL' || upper === 'NETHERLANDS') {
    return { code: 'NL', name: 'Netherlands', flag: '🇳🇱' };
  }
  if (upper === 'CZ' || upper === 'CZECH REPUBLIC' || upper === 'CZECHIA') {
    return { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' };
  }
  if (upper === 'SK' || upper === 'SLOVAKIA') {
    return { code: 'SK', name: 'Slovakia', flag: '🇸🇰' };
  }
  if (upper === 'UA' || upper === 'UKRAINE') {
    return { code: 'UA', name: 'Ukraine', flag: '🇺🇦' };
  }

  if (upper.length === 2) {
    try {
      const flag = String.fromCodePoint(...upper.split('').map(c => 127397 + c.charCodeAt(0)));
      return { code: upper, name: upper, flag };
    } catch {
      return { code: upper, name: upper, flag: '🌐' };
    }
  }

  return { code: 'PL', name: raw || 'Poland', flag: '🇵🇱' };
}
