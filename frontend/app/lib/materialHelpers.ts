export type MaterialProperties = {
  strength?: string;
  heatResistance?: string;
  flexibility?: string;
  uvResistance?: string;
};

export type MaterialInfo = {
  name: string;
  fullName: string;
  desc: string;
  icon?: string;
  tags?: string[];
  properties?: MaterialProperties;
};

export const POPULAR_MATERIALS: MaterialInfo[] = [
  { 
    name: 'PLA', 
    fullName: 'Polylactic Acid',
    icon: '🌱',
    tags: ['Eco-Friendly', 'Easy Print', 'High Detail'],
    desc: 'Great for decorative models and prototypes that don\'t need to withstand heat. Provides a smooth, colorful finish with sharp details.',
    properties: {
      strength: 'Medium',
      heatResistance: 'Low (~60°C)',
      flexibility: 'Rigid',
      uvResistance: 'Low'
    }
  },
  { 
    name: 'PLA+', 
    fullName: 'Tough PLA / PLA+',
    icon: '💪',
    tags: ['Impact Resistant', 'Durable', 'Smooth Finish'],
    desc: 'A more durable version of PLA that is less likely to break if dropped. Offers better impact resistance for functional handled parts.',
    properties: {
      strength: 'High',
      heatResistance: 'Low (~60°C)',
      flexibility: 'Slight Flex',
      uvResistance: 'Low'
    }
  },
  { 
    name: 'PETG', 
    fullName: 'Polyethylene Terephthalate Glycol',
    icon: '💧',
    tags: ['Water Resistant', 'Durable', 'Chemical Resistant'],
    desc: 'Excellent for durable parts that might contact water or mild chemicals. Heat resistant and non-brittle, ideal for functional & outdoor use.',
    properties: {
      strength: 'High',
      heatResistance: 'Medium (~85°C)',
      flexibility: 'Slight Flex',
      uvResistance: 'Medium'
    }
  },
  { 
    name: 'ABS', 
    fullName: 'Acrylonitrile Butadiene Styrene',
    icon: '🔥',
    tags: ['Heat Resistant', 'Impact Tough', 'Sandable'],
    desc: 'Rugged, industrial plastic that survives higher temperatures and impacts. Feels solid and high quality; easy to sand and paint.',
    properties: {
      strength: 'High',
      heatResistance: 'High (~100°C)',
      flexibility: 'Rigid',
      uvResistance: 'Low'
    }
  },
  { 
    name: 'ASA', 
    fullName: 'Acrylonitrile Styrene Acrylate',
    icon: '☀️',
    tags: ['UV Resistant', 'Weatherproof', 'Outdoor Heavy'],
    desc: 'The best choice for permanent outdoor placement. Offers ABS strength with maximum UV and weather resistance so parts won\'t yellow in the sun.',
    properties: {
      strength: 'High',
      heatResistance: 'High (~100°C)',
      flexibility: 'Rigid',
      uvResistance: 'Excellent'
    }
  },
  { 
    name: 'TPU', 
    fullName: 'Thermoplastic Polyurethane / Flexible',
    icon: '🌓',
    tags: ['Highly Flexible', 'Shock Absorbing', 'Indestructible'],
    desc: 'Unique rubber-like material that is virtually indestructible and highly flexible. Parts can be squeezed and stretched without breaking.',
    properties: {
      strength: 'Very High',
      heatResistance: 'Medium (~80°C)',
      flexibility: 'Highly Flexible',
      uvResistance: 'Medium'
    }
  },
  { 
    name: 'PA', 
    fullName: 'Nylon / Polyamide',
    icon: '⚙️',
    tags: ['Low Friction', 'High Wear', 'Mechanical'],
    desc: 'Ultra-tough engineering plastic exceptionally resistant to wear and friction. Top choice for moving mechanical parts like gears.',
    properties: {
      strength: 'Very High',
      heatResistance: 'High (~120°C)',
      flexibility: 'Tough & Flexible',
      uvResistance: 'Medium'
    }
  },
  { 
    name: 'PC', 
    fullName: 'Polycarbonate',
    icon: '⚡',
    tags: ['Extreme Strength', 'High Heat', 'Structural'],
    desc: 'Ultimate polymer for impact resistance and extreme heat. Nearly as strong as metal; perfect for high-performance structural parts.',
    properties: {
      strength: 'Extreme',
      heatResistance: 'Very High (~140°C)',
      flexibility: 'Rigid',
      uvResistance: 'Medium'
    }
  },
  { 
    name: 'Resin (Std)', 
    fullName: 'Standard Resin',
    icon: '💎',
    tags: ['Ultra High Detail', 'Smooth Finish', 'Miniatures'],
    desc: 'Provides unmatched detail and surface smoothness. Captures the finest textures and sharpest edges, gold standard for miniatures.',
    properties: {
      strength: 'Medium',
      heatResistance: 'Low (~50°C)',
      flexibility: 'Brittle',
      uvResistance: 'Low'
    }
  },
  { 
    name: 'Carbon Fiber', 
    fullName: 'Carbon Fiber Composite',
    icon: '⚡',
    tags: ['High Stiffness', 'Lightweight', 'Engineering'],
    desc: 'Polymer matrix reinforced with micro-carbon fibers for enhanced dimensional stability, extreme rigidity, and sleek matte finish.',
    properties: {
      strength: 'Very High',
      heatResistance: 'High (~110°C)',
      flexibility: 'Ultra Rigid',
      uvResistance: 'High'
    }
  },
  { 
    name: 'Wood', 
    fullName: 'Wood Composite Filament',
    icon: '🪵',
    tags: ['Natural Feel', 'Real Wood Grain', 'Decorative'],
    desc: 'PLA blended with real wood fibers. Can be sanded, stained, and finished like natural wood. Perfect for aesthetic decor.',
    properties: {
      strength: 'Medium',
      heatResistance: 'Low (~60°C)',
      flexibility: 'Rigid',
      uvResistance: 'Low'
    }
  }
];

export function getMaterialInfo(materialName?: string): MaterialInfo | undefined {
  if (!materialName) return undefined;
  const clean = materialName.trim().toLowerCase();
  
  if (!clean || ['other', 'custom', 'custom / other', 'n/a', 'unknown', 'none'].includes(clean)) {
    return undefined;
  }

  // 1. Exact match on name
  let found = POPULAR_MATERIALS.find(m => m.name.toLowerCase() === clean);
  if (found) return found;

  // 2. Exact match on fullName
  found = POPULAR_MATERIALS.find(m => m.fullName.toLowerCase() === clean);
  if (found) return found;

  // 3. Alias / keyword matches
  if (clean === 'nylon' || clean.includes('nylon') || clean === 'polyamide') {
    return POPULAR_MATERIALS.find(m => m.name === 'PA');
  }
  if (clean === 'polycarbonate') {
    return POPULAR_MATERIALS.find(m => m.name === 'PC');
  }
  if (clean.includes('tpu') || clean.includes('flexible')) {
    return POPULAR_MATERIALS.find(m => m.name === 'TPU');
  }
  if (clean.includes('resin') || clean.includes('sla')) {
    return POPULAR_MATERIALS.find(m => m.name === 'Resin (Std)');
  }
  if (clean.includes('pla+') || clean.includes('tough pla')) {
    return POPULAR_MATERIALS.find(m => m.name === 'PLA+');
  }
  if (clean === 'pla' || clean.includes('pla')) {
    return POPULAR_MATERIALS.find(m => m.name === 'PLA');
  }

  // 4. Substring fallback (sorted by length desc so longer names match first)
  const sorted = [...POPULAR_MATERIALS].sort((a, b) => b.name.length - a.name.length);
  return sorted.find(m => {
    const matName = m.name.toLowerCase();
    const fullName = m.fullName.toLowerCase();
    return clean.includes(matName) || clean.includes(fullName) || matName.includes(clean);
  });
}
