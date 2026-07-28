export type MaterialInfo = {
  name: string;
  fullName: string;
  desc: string;
};

export const POPULAR_MATERIALS: MaterialInfo[] = [
  { 
    name: 'PLA', 
    fullName: 'Polylactic Acid',
    desc: 'Great for decorative models and prototypes that don\'t need to withstand heat. It provides a smooth, colorful finish with sharp details, but may warp if left in a hot car. Safe for indoor use and eco-friendly.' 
  },
  { 
    name: 'PLA+', 
    fullName: 'Tough PLA / PLA+',
    desc: 'A more durable version of PLA that is less likely to break if dropped. It maintains the beautiful surface finish of standard PLA while offering better impact resistance for functional parts that will be handled frequently.' 
  },
  { 
    name: 'PETG', 
    fullName: 'Polyethylene Terephthalate Glycol',
    desc: 'Excellent for durable parts that might come into contact with water or mild chemicals. It is much more heat-resistant than PLA and won\'t become brittle over time, making it ideal for kitchen items or light outdoor use.' 
  },
  { 
    name: 'ABS', 
    fullName: 'Acrylonitrile Butadiene Styrene',
    desc: 'A rugged, industrial plastic that can take a beating and survive high temperatures. It feels solid and high-quality, similar to LEGO bricks, and can be sanded or painted easily. Best for mechanical parts facing moderate heat.' 
  },
  { 
    name: 'ASA', 
    fullName: 'Acrylonitrile Styrene Acrylate',
    desc: 'The best choice for anything that will live permanently outdoors. It offers the same strength as ABS but is exceptionally resistant to sunlight, ensuring your parts won\'t turn yellow or become brittle in the sun. Tough and weather-proof.' 
  },
  { 
    name: 'TPU', 
    fullName: 'Thermoplastic Polyurethane / Flexible',
    desc: 'A unique rubber-like material that is virtually indestructible and highly flexible. Parts can be squeezed and stretched without breaking, offering excellent grip and shock absorption. Ideal for phone cases, gaskets, or wearable items.' 
  },
  { 
    name: 'PA', 
    fullName: 'Nylon / Polyamide',
    desc: 'An ultra-tough engineering plastic exceptionally resistant to wear and friction. It feels slightly slippery and is very hard to break, making it the top choice for moving parts like gears or sliders. Built for intense, long-term use.' 
  },
  { 
    name: 'PC', 
    fullName: 'Polycarbonate',
    desc: 'The ultimate material for impact resistance and extreme heat. It is nearly as strong as metal and can withstand very high temperatures without losing its shape. Perfect for safety equipment or high-performance structural parts.' 
  },
  { 
    name: 'Resin (Std)', 
    fullName: 'Standard Resin',
    desc: 'Provides a level of detail and surface smoothness that is unmatched by other methods. It captures the finest textures and sharpest edges, making it the gold standard for miniatures and jewelry. Note that it can be brittle if dropped.' 
  },
  { 
    name: 'Other', 
    fullName: 'Custom / Other Material',
    desc: 'Select this if your project requires a specialized material like wood-fill, glow-in-the-dark, or high-performance carbon-fiber. This allows for unique aesthetic effects or specific properties not covered by standard options.' 
  }
];

export function getMaterialInfo(materialName?: string): MaterialInfo | undefined {
  if (!materialName) return undefined;
  const clean = materialName.trim().toLowerCase();
  return POPULAR_MATERIALS.find(
    m => m.name.toLowerCase() === clean || m.fullName.toLowerCase().includes(clean) || clean.includes(m.name.toLowerCase())
  );
}
