const fs = require('fs');

// 1. Get the source from upload page
const uploadContent = fs.readFileSync('c:/Printis/frontend/app/upload/page.tsx', 'utf8');

// 2. Transform uploadContent to editContent
let editContent = uploadContent;

// Fix imports
editContent = editContent.replace(
    "import { useRouter } from 'next/navigation';",
    "import { useRouter, useParams } from 'next/navigation';\nimport { ArrowLeft, Save, AlertTriangle, Ruler } from 'lucide-react';"
);

// Component name
editContent = editContent.replace(
    'export default function AddOfferPage() {',
    'export default function EditOfferPage() {\n  const params = useParams();'
);

// Loading & Saving states
editContent = editContent.replace(
    'const [loading, setLoading] = useState(false);',
    'const [loading, setLoading] = useState(true);\n  const [saving, setSaving] = useState(false);\n  const [offer, setOffer] = useState<any>(null);'
);

// Existing images state
editContent = editContent.replace(
    'const [previewImages, setPreviewImages] = useState<File[]>([]);',
    'const [previewImages, setPreviewImages] = useState<File[]>([]);\n  const [existingImages, setExistingImages] = useState<string[]>([]);'
);

// Update init useEffect
const oldEffectRegex = /useEffect\(\(\) => \{[\s\S]*?\}, \[router\]\);/m;
const newEffect = `useEffect(() => {
    const initData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);
      
      const { data: profile } = await supabase.from('profiles').select('roles').eq('id', user.id).single();
      const roles = profile?.roles || [];
      setUserRoles(roles);

      let activeFilaments: Filament[] = [];
      if (roles.includes('printer')) {
        const { data: fils } = await supabase.from('filaments').select('*')
          .eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false });
        activeFilaments = fils || [];
        setMyFilaments(activeFilaments);
      }

      const { data: offerData, error } = await supabase.from('offers').select('*').eq('id', params.id).single();
      if (error || !offerData) { alert('Not found'); router.push('/profile'); return; }
      if (offerData.user_id !== user.id) { alert('Unauthorized'); router.push('/profile'); return; }

      setOffer(offerData);
      setCategory(offerData.category);
      setTitle(offerData.title);
      setDescription(offerData.description || '');
      setExistingImages(offerData.image_urls || []);
      
      if (offerData.dimensions) {
        const parsed = offerData.dimensions.split(',').map((d: string) => {
          const match = d.match(/^(.*?):\\s*(.*?)\\s*mm$/);
          if (match) return { id: uid(), label: match[1].trim(), value: match[2].trim() };
          return null;
        }).filter(Boolean) as DimensionEntry[];
        if (parsed.length > 0) setDimensionEntries(parsed);
      }

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
             priceLocal: ((cv.priceEUR || 0) * (rates?.[currency] || 1)).toFixed(2),
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
             layers: (cv.layers || []).map((l: any) => ({
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
      setLoading(false);
    };
    if (currency) initData();
  }, [params.id, router, currency, rates]);`;

editContent = editContent.replace(oldEffectRegex, newEffect);

// Fix loading display
editContent = editContent.replace(
    'if (!user) return null;',
    `if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="animate-spin text-blue-600" size={40} />
    </div>
  );`
);

// Fix image upload logic in handleSubmit
const imageUploadSearch = `      for (const file of previewImages) {
        const ext = file.name.split('.').pop();
        const p = \`previews/\${Date.now()}-\${Math.random()}.\${ext}\`;
        const { error } = await supabase.storage.from(BUCKET_NAME).upload(p, file);
        if (error) throw error;
        imageUrls.push(supabase.storage.from(BUCKET_NAME).getPublicUrl(p).data.publicUrl);
      }
      if (imageUrls.length === 0 && category === 'job')
        imageUrls.push('https://via.placeholder.com/400x300?text=Print+Request');`;

const imageUploadReplace = `      for (const file of previewImages) {
        const ext = file.name.split('.').pop();
        const p = \`previews/\${Date.now()}-\${Math.random()}.\${ext}\`;
        const { error } = await supabase.storage.from(BUCKET_NAME).upload(p, file);
        if (error) throw error;
        imageUrls.push(supabase.storage.from(BUCKET_NAME).getPublicUrl(p).data.publicUrl);
      }
      const finalImages = [...existingImages, ...imageUrls];
      if (finalImages.length === 0 && category === 'job')
        finalImages.push('https://via.placeholder.com/400x300?text=Print+Request');`;

editContent = editContent.replace(imageUploadSearch, imageUploadReplace);

// Update basePayload to use finalImages and image_url: finalImages[0]
editContent = editContent.replace('image_url: imageUrls[0] || null, image_urls: imageUrls,', 'image_url: finalImages[0] || null, image_urls: finalImages,');

// Change insert to update
editContent = editContent.replace(
    /const \{ error: dbErr \} = await supabase\.from\('offers'\)\.insert\(\{[\s\S]*?\}\);/m,
    `const { error: dbErr } = await supabase.from('offers').update({
        ...basePayload,
        ...(colorVariantsPayload ? { color_variants: colorVariantsPayload } : {}),
      }).eq('id', params.id);`
);

editContent = editContent.replace(
    /const \{ error: retryErr \} = await supabase\.from\('offers'\)\.insert\(basePayload\);/m,
    `const { error: retryErr } = await supabase.from('offers').update(basePayload).eq('id', params.id);`
);

// Redirect after success
editContent = editContent.replace('setSubmitSuccess(true);', 'router.push(`/offer/${params.id}`);');

// Header UI updates
editContent = editContent.replace(
    `<h1 className="text-3xl font-black uppercase tracking-wide">Create Listing</h1>
          <p className="text-gray-400 mt-1 text-sm font-medium">Configure your new offer step by step.</p>`,
    `<Link href={\`/offer/\${params.id}\`} className="flex items-center gap-2 text-gray-400 hover:text-white transition text-xs font-bold uppercase tracking-widest mb-4">
            <ArrowLeft size={14} /> Back to Listing
          </Link>
          <h1 className="text-3xl font-black uppercase tracking-wide">Edit Listing</h1>
          <p className="text-gray-400 mt-1 text-sm font-medium truncate">Editing: <span className="text-white font-bold">"{title}"</span></p>`
);

// Photo gallery with existing and new
const oldPhotoSection = `<ImageIcon className="mb-3 text-gray-400 group-hover:text-blue-500" size={32} />
                <span className="text-xs font-black uppercase text-gray-500">Upload Photos {category === 'job' ? '(Optional)' : '(Max 6)'}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
              </label>
              {previewImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {previewImages.map((file, idx) => (
                    <div key={idx} className="relative h-24 rounded-xl overflow-hidden group">
                      <img src={URL.createObjectURL(file)} className="h-full w-full object-cover" alt="" />
                      <button type="button" onClick={() => removeImage(idx)}
                        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}`;

const newPhotoSection = `<ImageIcon className="mb-3 text-gray-400 group-hover:text-blue-500" size={32} />
                <span className="text-xs font-black uppercase text-gray-500">Add Photo {category === 'job' ? '(Optional)' : '(Max 6 Total)'}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
              </label>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {existingImages.map((url, idx) => (
                    <div key={\`old-\${idx}\`} className="relative h-24 rounded-xl overflow-hidden group border border-gray-200">
                      <img src={url} className="h-full w-full object-cover" alt="" />
                      <button type="button" onClick={() => setExistingImages(prev => prev.filter((_, i) => i !== idx))} className="absolute inset-0 bg-red-600/80 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white transition-all"><Trash2 size={18} /></button>
                      {idx === 0 && <span className="absolute bottom-1 left-1 text-[8px] font-black bg-black/70 text-white px-1.5 py-0.5 rounded-full uppercase">Main</span>}
                    </div>
                  ))}
                {previewImages.map((file, idx) => (
                    <div key={\`new-\${idx}\`} className="relative h-24 rounded-xl overflow-hidden group border-2 border-blue-400">
                      <img src={URL.createObjectURL(file)} className="h-full w-full object-cover" alt="" />
                      <button type="button" onClick={() => removeImage(idx)}
                        className="absolute inset-0 bg-red-600/80 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white transition-all">
                        <Trash2 size={18} />
                      </button>
                    </div>
                ))}
              </div>`;

editContent = editContent.replace(oldPhotoSection, newPhotoSection);

// Disable category changing in edit mode
editContent = editContent.replace(
    "onClick={() => { if (!disabled) { setCategory(key); setPreviewImages([]); } }}",
    "onClick={() => { /* category change disabled during edit for safety */ }}"
);

// Submit button text
editContent = editContent.replace("'Publish Listing'", "'Save Changes'");

fs.writeFileSync('c:/Printis/frontend/app/edit/[id]/page.tsx', editContent);
console.log('done syncing complete upload features to edit page');
