'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2, FileText, Image as ImageIcon,
  Box, Layers, Printer, Tag, X, Trash2, ChevronDown,
  EyeOff, Info, Calculator
} from 'lucide-react';
import { useCurrency } from '../../context/CurrencyContext';

const BUCKET_NAME = 'printsi-files1';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Filament = {
  id: string;
  plastic_type: string;
  color_name: string;
  color_hex: string;
  brand: string | null;
  price_per_gram: number;
  price_unit: string;
};

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

export default function AddOfferPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { currency, rates } = useCurrency();

  const [category, setCategory] = useState<'job' | 'digital' | 'physical'>('digital');
  const [userRoles, setUserRoles] = useState<string[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');

  const [material, setMaterial] = useState('');
  const [color, setColor] = useState('');
  const [weight, setWeight] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [tags, setTags] = useState('');

  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [previewImages, setPreviewImages] = useState<File[]>([]);

  // === FILAMENT PICKER ===
  const [myFilaments, setMyFilaments] = useState<Filament[]>([]);
  const [selectedFilament, setSelectedFilament] = useState<Filament | null>(null);
  const [filamentWeight, setFilamentWeight] = useState('');
  const [markupType, setMarkupType] = useState<'fixed' | 'percent'>('fixed');
  const [markupValue, setMarkupValue] = useState('');
  const [showMarkupInfo, setShowMarkupInfo] = useState(false);
  const [showFilamentDropdown, setShowFilamentDropdown] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
        const { data: profile } = await supabase.from('profiles').select('roles').eq('id', user.id).single();
        if (profile && profile.roles) {
          setUserRoles(profile.roles);
          if (profile.roles.includes('printer')) {
            const { data: fils } = await supabase
              .from('filaments')
              .select('*')
              .eq('user_id', user.id)
              .eq('is_active', true)
              .order('created_at', { ascending: false });
            setMyFilaments(fils || []);
          }
        }
      }
    };
    checkUser();
  }, [router]);

  const filamentCostEUR = (() => {
    if (!selectedFilament || !filamentWeight) return null;
    const grams = parseFloat(filamentWeight);
    if (isNaN(grams) || grams <= 0) return null;
    return grams * selectedFilament.price_per_gram;
  })();

  const calculatedPriceEUR = (() => {
    if (filamentCostEUR === null) return null;
    const markup = parseFloat(markupValue) || 0;
    if (markupType === 'fixed') return filamentCostEUR + markup;
    return filamentCostEUR * (1 + markup / 100);
  })();

  useEffect(() => {
    if (calculatedPriceEUR !== null && selectedFilament) {
      if (currency !== 'EUR' && rates && rates[currency]) {
        setPrice((calculatedPriceEUR * rates[currency]).toFixed(2));
      } else {
        setPrice(calculatedPriceEUR.toFixed(2));
      }
    }
  }, [calculatedPriceEUR, currency, rates, selectedFilament]);

  const handleFilamentSelect = (fil: Filament) => {
    setSelectedFilament(fil);
    setMaterial(fil.plastic_type);
    setColor(fil.color_name);
    setShowFilamentDropdown(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (newFiles.length + previewImages.length > 6) {
        alert("Max 6 photos allowed.");
        return;
      }
      setPreviewImages([...previewImages, ...newFiles]);
    }
  };

  const removeImage = (index: number) => {
    setPreviewImages(previewImages.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price) { alert("Title and Price are required."); return; }
    if (category !== 'job' && previewImages.length === 0) { alert("Please upload at least 1 photo."); return; }
    if (category === 'digital' && !projectFile) { alert("3D File (.STL) is required for digital items."); return; }
    if (!user?.id) { alert("Critical error: no user ID."); return; }

    setLoading(true);
    try {
      let projUrl = null;
      let uploadedImageUrls: string[] = [];

      if (projectFile) {
        const fileExt = projectFile.name.split('.').pop();
        const projectPath = `projects/${Date.now()}-${Math.random()}.${fileExt}`;
        const { error: projErr } = await supabase.storage.from(BUCKET_NAME).upload(projectPath, projectFile);
        if (projErr) throw projErr;
        const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(projectPath);
        projUrl = data.publicUrl;
      }

      if (previewImages.length > 0) {
        for (const file of previewImages) {
          const fileExt = file.name.split('.').pop();
          const imagePath = `previews/${Date.now()}-${Math.random()}.${fileExt}`;
          const { error: imgErr } = await supabase.storage.from(BUCKET_NAME).upload(imagePath, file);
          if (imgErr) throw imgErr;
          const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(imagePath);
          uploadedImageUrls.push(data.publicUrl);
        }
      } else if (category === 'job') {
        uploadedImageUrls.push("https://via.placeholder.com/400x300?text=Print+Request");
      }

      let finalPrice = parseFloat(price);
      if (currency !== 'EUR' && rates && rates[currency]) {
        finalPrice = finalPrice / rates[currency];
      }

      const payload = {
        title,
        description,
        price: finalPrice,
        category,
        material: material || null,
        color: selectedFilament ? selectedFilament.color_hex : (color || null),
        color_name: selectedFilament ? selectedFilament.color_name : (color || null),
        weight: filamentWeight || weight || null,
        dimensions: dimensions || null,
        stock: parseInt(stock),
        file_url: projUrl,
        image_url: uploadedImageUrls[0] || null,
        image_urls: uploadedImageUrls,
        user_id: user.id,
        filament_id: selectedFilament?.id || null,
        created_at: new Date()
      };

      const { error: dbErr } = await supabase.from('offers').insert(payload);
      if (dbErr) throw dbErr;

      alert("Success! Your listing has been published.");
      router.push('/gallery');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center text-gray-900 font-sans relative">
      <div className="max-w-3xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 relative">
        <Link href="/" className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-10">
          <X size={24} />
        </Link>

        <div className="bg-gray-900 p-8 text-white relative">
          <h1 className="text-3xl font-black uppercase tracking-wide">Create Listing</h1>
          <p className="text-gray-400 mt-2 text-sm font-medium">Choose your role and intent.</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-8">

            {/* STEP 1: CATEGORY */}
            <div>
              <label className="block text-xs font-black uppercase text-gray-400 mb-4 tracking-widest">1. Select Listing Type</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button type="button" onClick={() => { setCategory('job'); setPreviewImages([]); }}
                  className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${category === 'job' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-500 hover:border-blue-200'}`}>
                  <Printer size={32} />
                  <span className="font-black uppercase text-sm">Print Request</span>
                </button>

                <button type="button" onClick={() => setCategory('digital')}
                  className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${category === 'digital' ? 'border-purple-600 bg-purple-50 text-purple-800' : 'border-gray-200 text-gray-500 hover:border-purple-200'}`}>
                  <Layers size={32} />
                  <span className="font-black uppercase text-sm">Digital File</span>
                </button>

                <button type="button" onClick={() => setCategory('physical')} disabled={!userRoles.includes('printer')}
                  className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all relative ${!userRoles.includes('printer') ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed' : category === 'physical' ? 'border-orange-600 bg-orange-50 text-orange-800' : 'border-gray-200 text-gray-500 hover:border-orange-200'}`}>
                  <Box size={32} />
                  <span className={`font-black uppercase text-sm ${!userRoles.includes('printer') ? 'mb-2' : ''}`}>Physical Item</span>
                  {!userRoles.includes('printer') && (
                    <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest absolute bottom-2 left-0 right-0 text-center px-1">Printer role required</span>
                  )}
                </button>
              </div>
            </div>

            {/* FILAMENT PICKER – only for physical + printer */}
            {category === 'physical' && userRoles.includes('printer') && (
              <div className="space-y-4">
                <label className="block text-xs font-black uppercase text-gray-400 tracking-widest">2. Select Filament</label>

                {myFilaments.length === 0 ? (
                  <div className="p-5 bg-orange-50 border-2 border-dashed border-orange-200 rounded-2xl text-center">
                    <p className="text-sm font-bold text-orange-600 mb-2">No filaments saved yet</p>
                    <Link href="/profile/filaments" className="text-xs font-black text-orange-700 underline hover:no-underline">
                      Go to My Filaments to add some →
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Dropdown */}
                    <div className="relative">
                      <button type="button" onClick={() => setShowFilamentDropdown(!showFilamentDropdown)}
                        className="w-full flex items-center gap-3 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl hover:border-orange-400 transition-all text-left group">
                        {selectedFilament ? (
                          <>
                            <div className="w-8 h-8 rounded-lg flex-shrink-0 border border-gray-200 shadow-sm" style={{ backgroundColor: selectedFilament.color_hex }} />
                            <div className="flex-1">
                              <p className="font-black text-gray-900 text-sm">{selectedFilament.color_name}</p>
                              <p className="text-xs text-gray-500 font-medium">
                                {selectedFilament.plastic_type}{selectedFilament.brand ? ` · ${selectedFilament.brand}` : ''} · €{(selectedFilament.price_per_gram * 1000).toFixed(2)}/kg
                              </p>
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400 font-bold text-sm flex-1">Choose from your filaments...</span>
                        )}
                        <ChevronDown size={18} className="text-gray-400 group-hover:text-orange-500 transition" />
                      </button>

                      {showFilamentDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-20 overflow-hidden max-h-64 overflow-y-auto">
                          {myFilaments.map(fil => (
                            <button key={fil.id} type="button" onClick={() => handleFilamentSelect(fil)}
                              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 transition-all text-left ${selectedFilament?.id === fil.id ? 'bg-orange-50' : ''}`}>
                              <div className="w-8 h-8 rounded-lg flex-shrink-0 border border-gray-200 shadow-sm" style={{ backgroundColor: fil.color_hex }} />
                              <div className="flex-1">
                                <p className="font-bold text-gray-900 text-sm">{fil.color_name}</p>
                                <p className="text-xs text-gray-500">{fil.plastic_type}{fil.brand ? ` · ${fil.brand}` : ''}</p>
                              </div>
                              <span className="text-xs font-bold text-gray-500">€{(fil.price_per_gram * 1000).toFixed(2)}/kg</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected filament preview badge */}
                    {selectedFilament && (
                      <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ backgroundColor: selectedFilament.color_hex + '18', borderColor: selectedFilament.color_hex + '60' }}>
                        <div className="w-10 h-10 rounded-lg flex-shrink-0 shadow-md" style={{ backgroundColor: selectedFilament.color_hex }} />
                        <div>
                          <p className="font-black text-sm text-gray-900">{selectedFilament.color_name}</p>
                          <p className="text-xs text-gray-500 font-medium">{selectedFilament.plastic_type} · Color preview shown on product page</p>
                        </div>
                      </div>
                    )}

                    {/* WEIGHT */}
                    {selectedFilament && (
                      <div>
                        <label className="block text-xs font-black uppercase text-gray-400 tracking-widest mb-2">Weight of print (grams)</label>
                        <div className="relative">
                          <input type="number" step="0.1" min="0" value={filamentWeight} onChange={e => setFilamentWeight(e.target.value)} placeholder="e.g. 85"
                            className="w-full p-4 pr-16 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-orange-400 transition-all" />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">g</span>
                        </div>
                      </div>
                    )}

                    {/* MARKUP */}
                    {selectedFilament && filamentWeight && (
                      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calculator size={16} className="text-gray-500" />
                            <span className="text-xs font-black uppercase text-gray-500 tracking-widest">Your Markup</span>
                            <button type="button" onClick={() => setShowMarkupInfo(!showMarkupInfo)} className="text-gray-400 hover:text-gray-600 transition">
                              <Info size={13} />
                            </button>
                          </div>
                          <div className="flex rounded-lg overflow-hidden border border-gray-200">
                            {(['fixed', 'percent'] as const).map(t => (
                              <button key={t} type="button" onClick={() => setMarkupType(t)}
                                className={`px-3 py-1.5 text-xs font-black transition-all ${markupType === t ? 'bg-gray-800 text-white' : 'bg-white text-gray-500'}`}>
                                {t === 'fixed' ? '+ EUR' : '+ %'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {showMarkupInfo && (
                          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <EyeOff size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700 font-medium">
                              <strong>Hidden for customer.</strong> Your markup is not shown. Customers only see the final price.
                            </p>
                          </div>
                        )}

                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">{markupType === 'fixed' ? 'EUR' : '%'}</span>
                          <input type="number" step="0.01" min="0" value={markupValue} onChange={e => setMarkupValue(e.target.value)} placeholder={markupType === 'fixed' ? '0.00' : '0'}
                            className="w-full p-3 pl-14 bg-white border border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-gray-400 transition-all" />
                        </div>

                        {filamentCostEUR !== null && (
                          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                            <div className="flex justify-between text-xs font-medium text-gray-500">
                              <span>Filament cost ({filamentWeight}g)</span>
                              <span>€{filamentCostEUR.toFixed(2)}</span>
                            </div>
                            {parseFloat(markupValue) > 0 && (
                              <div className="flex justify-between text-xs font-medium text-gray-500">
                                <span>Your markup</span>
                                <span>
                                  {markupType === 'fixed'
                                    ? `+€${parseFloat(markupValue).toFixed(2)}`
                                    : `+${markupValue}% (€${(filamentCostEUR * parseFloat(markupValue) / 100).toFixed(2)})`}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between text-sm font-black text-gray-900 border-t border-gray-100 pt-2 mt-1">
                              <span>Final price</span>
                              <span className="text-green-600">€{calculatedPriceEUR?.toFixed(2)}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 font-medium">Price auto-filled below in your selected currency</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* DETAILS */}
            <div className="space-y-4">
              <label className="block text-xs font-black uppercase text-gray-400 tracking-widest">
                {category === 'physical' ? '3.' : '2.'} Basic Details
              </label>
              <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-600 focus:bg-white transition-all" required />

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-black text-[10px] tracking-wider pointer-events-none">{currency}</span>
                  <input type="number" step="0.01" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)}
                    className="w-full p-4 pl-16 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-600 focus:bg-white transition-all" required />
                </div>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs tracking-wider pointer-events-none">QTY</span>
                  <input type="number" placeholder="1" min="1" value={stock} onChange={e => setStock(e.target.value)}
                    className="w-full p-4 pl-16 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-600 focus:bg-white transition-all" required />
                </div>
              </div>

              <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:border-blue-600 focus:bg-white transition-all" rows={4} />

              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="text" placeholder="Tags (optional)" value={tags} onChange={e => setTags(e.target.value)} className="w-full p-4 pl-12 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm outline-none focus:border-blue-600 focus:bg-white transition-all" />
              </div>
            </div>

            {/* SPECS */}
            {category !== 'digital' && (
              <div className="space-y-4">
                <label className="block text-xs font-black uppercase text-gray-400 tracking-widest">
                  {category === 'physical' ? '4.' : '3.'} Specs
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Material" value={material} onChange={e => setMaterial(e.target.value)} readOnly={!!selectedFilament}
                    className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm focus:border-blue-600 focus:bg-white transition-all outline-none" />
                  <input type="text" placeholder="Color" value={selectedFilament ? selectedFilament.color_name : color} onChange={e => !selectedFilament && setColor(e.target.value)} readOnly={!!selectedFilament}
                    className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm focus:border-blue-600 focus:bg-white transition-all outline-none" />
                </div>
                {category === 'physical' && (
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Weight (g)" value={filamentWeight || weight} onChange={e => !filamentWeight && setWeight(e.target.value)} readOnly={!!filamentWeight}
                      className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm focus:border-blue-600 focus:bg-white transition-all outline-none" />
                    <input type="text" placeholder="Dimensions" value={dimensions} onChange={e => setDimensions(e.target.value)}
                      className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm focus:border-blue-600 focus:bg-white transition-all outline-none" />
                  </div>
                )}
              </div>
            )}

            {/* ATTACHMENTS */}
            <div className="space-y-4">
              <label className="block text-xs font-black uppercase text-gray-400 tracking-widest">
                {category === 'physical' ? '5.' : '3.'} Attachments
              </label>

              {category === 'digital' && (
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group">
                  <FileText className={`mb-3 ${projectFile ? "text-green-600" : "text-gray-400 group-hover:text-blue-500"}`} size={32} />
                  <span className="text-xs font-black uppercase text-gray-500">{projectFile ? projectFile.name : "Upload 3D File (.STL)"}</span>
                  <input type="file" className="hidden" accept=".stl,.obj,.3mf,.zip" onChange={e => setProjectFile(e.target.files?.[0] || null)} />
                </label>
              )}

              <div className="space-y-4">
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group">
                  <ImageIcon className="mb-3 text-gray-400 group-hover:text-blue-500" size={32} />
                  <span className="text-xs font-black uppercase text-gray-500">Upload Photos (Max 6)</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                </label>

                {previewImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {previewImages.map((file, idx) => (
                      <div key={idx} className="relative h-20 w-full rounded-lg overflow-hidden group">
                        <img src={URL.createObjectURL(file)} className="h-full w-full object-cover" alt="preview" />
                        <button type="button" onClick={() => removeImage(idx)} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button disabled={loading} className="w-full py-5 bg-gray-900 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl flex justify-center items-center gap-3 text-sm">
              {loading ? <Loader2 className="animate-spin" /> : 'Publish Listing'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}