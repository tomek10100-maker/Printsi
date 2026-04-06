const fs = require('fs');

const uploadTxt = fs.readFileSync('c:/Printis/frontend/app/upload/page.tsx', 'utf8');

// We want to transform uploadTxt into editTxt.

let editTxt = uploadTxt;

// 1. Imports
editTxt = editTxt.replace(
  `import { useRouter } from 'next/navigation';`,
  `import { useRouter, useParams } from 'next/navigation';\nimport { ArrowLeft } from 'lucide-react';`
);

// 2. Component Name
editTxt = editTxt.replace(
  `export default function AddOfferPage() {`,
  `export default function EditOfferPage() {`
);

// 3. Hooks
editTxt = editTxt.replace(
  `const router = useRouter();`,
  `const router = useRouter();\n  const params = useParams();\n  const [offer, setOffer] = useState<any>(null);`
);

// 4. Initial useEffect replacement
// Find the useEffect that has supabase.auth.getUser()
const initUploadEffect = `  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUser(user);
      const { data: profile } = await supabase.from('profiles').select('roles').eq('id', user.id).single();
      if (profile?.roles) {
        setUserRoles(profile.roles);
        if (profile.roles.includes('printer')) {
          const { data: fils } = await supabase.from('filaments').select('*')
            .eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false });
          setMyFilaments(fils || []);
        }
      }
    });
  }, [router]);`;

const initEditEffect = `  useEffect(() => {
    const initData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);
      const { data: profile } = await supabase.from('profiles').select('roles').eq('id', user.id).single();
      const roles = profile?.roles || [];
      setUserRoles(roles);

      let activeFilaments: Filament[] = [];
      if (roles.includes('printer')) {
        const { data: fils } = await supabase
          .from('filaments').select('*')
          .eq('user_id', user.id).eq('is_active', true)
          .order('created_at', { ascending: false });
        activeFilaments = fils || [];
        setMyFilaments(activeFilaments);
      }

      const { data: offerData, error } = await supabase.from('offers').select('*').eq('id', params.id).single();
      if (error || !offerData) { alert('Offer not found'); router.push('/profile'); return; }
      if (offerData.user_id !== user.id) { alert('Unauthorized'); router.push('/profile'); return; }

      setOffer(offerData);
      setCategory(offerData.category);
      setTitle(offerData.title);
      setDescription(offerData.description || '');
      
      if (offerData.dimensions) {
        const parsed = offerData.dimensions.split(',').map((d: string) => {
          const m = d.match(/^(.*?):\\s*(.*?)\\s*mm$/);
          if (m) return { id: uid(), label: m[1].trim(), value: m[2].trim() };
          return null;
        }).filter(Boolean);
        if (parsed.length > 0) setDimensionEntries(parsed);
      }

      setExistingImages(offerData.image_urls || []);
      
      if (offerData.color_variants && offerData.color_variants.length > 0) {
        if (offerData.color_variants[0].manual) {
           setPricingMode('manual');
           setManualVariants(offerData.color_variants.map((cv: any) => ({
             id: cv.variantId || uid(),
             layers: (cv.layers || []).map((l: any) => ({
               id: uid(),
               material: l.plastic_type || '',
               colorName: l.color_name || '',
               colorHex: l.color_hex || '#888888',
               weight: l.grams?.toString() || ''
             })),
             priceLocal: ((cv.priceEUR || 0) * ((currency !== 'EUR' && rates?.[currency]) ? rates[currency] : 1)).toFixed(2),
             stock: cv.stock?.toString() || '1',
             expanded: false
           })));
        } else if (roles.includes('printer')) {
           setPricingMode('auto');
           const savedFilamentIds = new Set<string>();
           for (const cv of offerData.color_variants) {
             for (const l of cv.layers || []) { if (l.filament_id) savedFilamentIds.add(l.filament_id); }
           }
           const activeById = new Map(activeFilaments.map(f => [f.id, f]));
           const missingIds = Array.from(savedFilamentIds).filter(id => !activeById.has(id));
           
           let allFilaments = [...activeFilaments];
           if (missingIds.length > 0) {
             const { data: extra } = await supabase.from('filaments').select('*').in('id', missingIds);
             if (extra) allFilaments = [...extra, ...allFilaments];
             setMyFilaments(allFilaments.filter((f, i, a) => a.findIndex(x => x.id === f.id) === i));
           }

           const filamentMap = new Map<string, Filament>();
           for (const f of allFilaments) filamentMap.set(f.id, f);

           const restored = offerData.color_variants.map((cv: any, idx: number) => ({
             variantId: cv.variantId || uid(),
             layers: (cv.layers && cv.layers.length > 0 ? cv.layers : [{ filament_id: null, grams: '0' }]).map((l: any) => ({
               layerId: uid(),
               filament: l.filament_id ? (filamentMap.get(l.filament_id) ?? null) : null,
               grams: l.grams?.toString() || ''
             })),
             markupType: cv.markupType || 'percent',
             markupValue: cv.markupValue?.toString() || '',
             stock: cv.stock?.toString() || '1',
             stockTracking: cv.stockTracking || 'auto',
             expanded: idx === 0,
             openDropdownLayerId: null
           }));
           setVariants(restored);
        }
      } else {
        setPricingMode('manual');
        const rate = (currency !== 'EUR' && rates?.[currency]) ? rates[currency] : 1;
        setManualPriceLocal((offerData.price * rate).toFixed(2));
        setManualStock(offerData.stock?.toString() || '1');
        setManualMaterial(offerData.material || '');
        setManualColor(offerData.color_name || '');
        setManualColorHex(offerData.color || '#888888');
        setManualWeight(offerData.weight || '');
      }
    };
    if (currency) initData();
  }, [params.id, router, currency, rates]);`;

if (editTxt.includes(initUploadEffect)) {
    editTxt = editTxt.replace(initUploadEffect, initEditEffect);
} else {
    // If exact block not found, we'll replace broadly with regex
    editTxt = editTxt.replace(/useEffect\(\(\) => \{\s*supabase\.auth\.getUser\(\)[\s\S]*?\}, \[router\]\);/, initEditEffect);
}


// 5. Image States
const imagesState = `  const [previewImages, setPreviewImages] = useState<File[]>([]);`;
const imagesStateNew = `  const [existingImages, setExistingImages] = useState<string[]>([]);\n  const [previewImages, setPreviewImages] = useState<File[]>([]);`;
editTxt = editTxt.replace(imagesState, imagesStateNew);

const handleImageChange = `  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (newFiles.length + previewImages.length > 6) {
        setFormError('Max 6 photos allowed.');
        return;
      }
      setPreviewImages(prev => [...prev, ...newFiles]);
      setFormError('');
    }
  };`;
const handleImageChangeNew = `  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (newFiles.length + previewImages.length + existingImages.length > 6) {
        setFormError('Max 6 photos allowed.');
        return;
      }
      setPreviewImages(prev => [...prev, ...newFiles]);
      setFormError('');
    }
  };`;
editTxt = editTxt.replace(handleImageChange, handleImageChangeNew);

// 6. Submit logic - replacing the whole insert block
// We need to replace the BUCKET_NAME block
const submitRegex = /const handleSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?setSubmitSuccess\(true\);\s*\/\/ Removed automatic redirect to let user choose\s*\} catch \(err: any\) \{/m;

const newSubmit = `const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!title) { setFormError('Title is required.'); return; }
    if (category !== 'job' && previewImages.length === 0 && existingImages.length === 0) { setFormError('Please upload at least 1 photo.'); return; }
    if (!user?.id) return;

    if (category === 'physical') {
      const dimStr = serializeDimensions();
      if (!dimStr) { setFormError('Please enter at least one dimension.'); return; }
      if (pricingMode === 'auto') {
        for (const v of variants) {
          if (!computeVariantEUR(v)) { setFormError('Complete all filament & weight fields in every variant.'); return; }
        }
      } else {
        for (const v of manualVariants) {
          if (!v.priceLocal || parseFloat(v.priceLocal) <= 0) { setFormError('Each variant must have a valid price.'); return; }
          for (const l of v.layers) {
            if (!l.colorHex) { setFormError('Complete all color fields in every layer.'); return; }
          }
        }
      }
    } else {
      if (!manualPriceLocal) { setFormError('Price is required.'); return; }
    }

    setLoading(true);
    try {
      let projUrl: string | null = offer.file_url || null;
      const uploadedUrls: string[] = [];

      if (projectFile) {
        const ext = projectFile.name.split('.').pop();
        const p = \`projects/\${Date.now()}-\${Math.random()}.\${ext}\`;
        const { error } = await supabase.storage.from(BUCKET_NAME).upload(p, projectFile);
        if (error) throw error;
        projUrl = supabase.storage.from(BUCKET_NAME).getPublicUrl(p).data.publicUrl;
      }
      for (const file of previewImages) {
        const ext = file.name.split('.').pop();
        const p = \`previews/\${Date.now()}-\${Math.random()}.\${ext}\`;
        const { error } = await supabase.storage.from(BUCKET_NAME).upload(p, file);
        if (error) throw error;
        uploadedUrls.push(supabase.storage.from(BUCKET_NAME).getPublicUrl(p).data.publicUrl);
      }
      
      const finalImages = [...existingImages, ...uploadedUrls];
      if (finalImages.length === 0 && category === 'job') finalImages.push('https://via.placeholder.com/400x300?text=Print+Request');

      let dbPrice: number, dbMaterial: string | null = null, dbColor: string | null = null,
          dbColorName: string | null = null, dbWeight: string | null = null, dbFilamentId: string | null = null,
          dbStock = 1;
      let colorVariantsPayload: any[] | undefined;

      if (category === 'physical') {
        if (pricingMode === 'auto') {
          const prices = variants.map(v => computeVariantEUR(v)!);
          const resolveStock = (v: ColorVariant) => {
            if (v.stockTracking === 'manual') return parseInt(v.stock) || 0;
            let maxP = Infinity; let ok = false;
            for (const l of v.layers) {
              if (l.filament && l.filament.stock_grams !== null && l.grams) {
                const g = parseFloat(l.grams);
                if (g > 0) { maxP = Math.min(maxP, Math.floor(l.filament.stock_grams / g)); ok = true; }
                else { ok = false; break; }
              } else { ok = false; break; }
            }
            return ok && maxP !== Infinity ? Math.max(0, maxP) : 0;
          };

          dbPrice = Math.min(...prices.map(p => p.totalEUR));
          dbStock = variants.reduce((s, v) => s + resolveStock(v), 0);
          const fl = variants[0].layers[0];
          dbMaterial = fl.filament?.plastic_type || null;
          dbColor = fl.filament?.color_hex || null;
          dbColorName = fl.filament?.color_name || null;
          dbWeight = variants[0].layers.reduce((s, l) => s + (parseFloat(l.grams) || 0), 0).toString();
          dbFilamentId = fl.filament?.id || null;
          colorVariantsPayload = variants.map((v, i) => ({
            variantId: v.variantId, label: v.layers.map(l => l.filament?.color_name || '').filter(Boolean).join(' + ') || \`Variant \${i + 1}\`,
            color_name: v.layers[0]?.filament?.color_name || null, plastic_type: v.layers[0]?.filament?.plastic_type || null,
            layers: v.layers.map(l => ({ filament_id: l.filament?.id, color_hex: l.filament?.color_hex, color_name: l.filament?.color_name, plastic_type: l.filament?.plastic_type, grams: l.grams })),
            priceEUR: prices[i].totalEUR, markupType: v.markupType, markupValue: v.markupValue, stock: resolveStock(v),
            stockTracking: v.stockTracking, primaryColor: v.layers[0]?.filament?.color_hex || '#888', isMultiColor: v.layers.length > 1,
          }));
        } else {
          const pricesEUR = manualVariants.map(v => (parseFloat(v.priceLocal) || 0) / (rates?.[currency] || 1));
          dbPrice = Math.min(...pricesEUR);
          dbStock = manualVariants.reduce((s, v) => s + (parseInt(v.stock) || 0), 0);
          const v0 = manualVariants[0], l0 = v0.layers[0];
          dbMaterial = l0.material || null; dbColor = l0.colorHex || null; dbColorName = l0.colorName || null;
          dbWeight = v0.layers.reduce((s, l) => s + (parseFloat(l.weight) || 0), 0).toString();
          colorVariantsPayload = manualVariants.map((v, i) => ({
            variantId: v.id, label: v.layers.map(l => l.colorName).filter(Boolean).join(' + ') || \`Variant \${i + 1}\`,
            color_name: v.layers[0]?.colorName || null, plastic_type: v.layers[0]?.material || null,
            layers: v.layers.map(l => ({ color_hex: l.colorHex, color_name: l.colorName, plastic_type: l.material, grams: l.weight })),
            priceEUR: pricesEUR[i], stock: parseInt(v.stock) || 0, weight: v.layers.reduce((s, l) => s + (parseFloat(l.weight) || 0), 0).toString(),
            primaryColor: v.layers[0]?.colorHex || '#888', isMultiColor: v.layers.length > 1, manual: true,
          }));
        }
      } else {
        dbPrice = manualPriceEUR!; dbMaterial = manualMaterial || null; dbColor = manualColorHex || null;
        dbColorName = manualColor || null; dbWeight = manualWeight || null; dbStock = category === 'digital' ? 999999 : (parseInt(manualStock) || 1);
      }

      const finalDimensions = (category === 'physical' || category === 'job') ? serializeDimensions() || null : null;
      const basePayload = {
        title, description, price: dbPrice, category, material: dbMaterial, color: dbColor, color_name: dbColorName,
        weight: dbWeight, dimensions: finalDimensions, stock: dbStock, file_url: projUrl,
        image_url: finalImages[0] || null, image_urls: finalImages, filament_id: dbFilamentId,
      };

      const { error: dbErr } = await supabase.from('offers').update({
        ...basePayload, ...(colorVariantsPayload ? { color_variants: colorVariantsPayload } : {}),
      }).eq('id', params.id);

      if (dbErr && dbErr.message?.includes('color_variants')) {
        const { error: retryErr } = await supabase.from('offers').update(basePayload).eq('id', params.id);
        if (retryErr) throw retryErr;
      } else if (dbErr) { throw dbErr; }

      router.push(\`/offer/\${params.id}\`);
      return; // Skip success state since we navigate
    } catch (err: any) {`;

editTxt = editTxt.replace(submitRegex, newSubmit);


// 7. Update UI to add back buttons and existing images
editTxt = editTxt.replace(
  `<h1 className="text-3xl font-black uppercase tracking-wide">Create Listing</h1>
          <p className="text-gray-400 mt-1 text-sm font-medium">Configure your new offer step by step.</p>`,
  `<Link href={\`/offer/\${params.id}\`} className="flex items-center gap-2 text-gray-400 hover:text-white transition text-xs font-bold uppercase tracking-widest mb-4">
            <ArrowLeft size={14} /> Back to Listing
          </Link>
          <h1 className="text-3xl font-black uppercase tracking-wide">Edit Listing</h1>
          <p className="text-gray-400 mt-1 text-sm font-medium truncate">Editing: <span className="text-white font-bold">"{title}"</span></p>`
);

const oldImagesSection = `{previewImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {previewImages.map((file, idx) => (`;
const newImagesSection = `{existingImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {existingImages.map((url, idx) => (
                    <div key={\`old-\${idx}\`} className="relative h-24 rounded-xl overflow-hidden group">
                      <img src={url} className="h-full w-full object-cover" alt="" />
                      <button type="button" onClick={() => setExistingImages(prev => prev.filter((_, i) => i !== idx))} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white transition-all"><Trash2 size={16} /></button>
                      {idx === 0 && <span className="absolute bottom-1 left-1 text-[8px] font-black bg-black/70 text-white px-1.5 py-0.5 rounded-full uppercase">Main</span>}
                    </div>
                  ))}
                </div>
              )}
              {previewImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {previewImages.map((file, idx) => (`;
editTxt = editTxt.replace(oldImagesSection, newImagesSection);

// Update category disabled state so they can't change it easily on edit, it's safer.
editTxt = editTxt.replace(
  `onClick={() => { if (!disabled) { setCategory(key); setPreviewImages([]); } }}`,
  `onClick={() => { if (!disabled) {/* setCategory(key) disabled in edit mode */} }}`
);

fs.writeFileSync('c:/Printis/frontend/app/edit/[id]/page.tsx', editTxt);
console.log('done generating edit page from upload page');
