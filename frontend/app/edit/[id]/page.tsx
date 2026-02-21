'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter, useParams } from 'next/navigation';
import { 
  UploadCloud, Loader2, FileText, Image as ImageIcon, 
  Box, Layers, Printer, Tag, X, Trash2, Save
} from 'lucide-react';
// Import Contextu
import { useCurrency } from '../../../context/CurrencyContext';

const BUCKET_NAME = 'printsi-files1'; 

// Musimy mieć te same kursy tutaj, żeby przeliczyć cenę PRZED wysłaniem do bazy
const EXCHANGE_RATES: Record<string, number> = {
  EUR: 1,       
  USD: 1.08,    
  GBP: 0.85,    
  PLN: 4.30,    
  SEK: 11.20,   
  NOK: 11.30,   
  DKK: 7.45,    
  CHF: 0.95,    
  CZK: 25.20,   
  HUF: 390.0,   
  RON: 4.97     
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EditOfferPage() {
  const router = useRouter();
  const params = useParams();
  
  // Pobieramy walutę i symbol z Contextu
  const { currency, symbol } = useCurrency();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);

  // --- FORM FIELDS ---
  const [category, setCategory] = useState<'job' | 'digital' | 'physical'>('job'); 
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState(''); // To będzie cena w Twojej walucie (np. PLN)
  const [stock, setStock] = useState('1'); 
  const [material, setMaterial] = useState('');
  const [color, setColor] = useState('');
  const [weight, setWeight] = useState('');
  const [dimensions, setDimensions] = useState('');

  // Files State
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);

  useEffect(() => {
    const initData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      const { data: offer, error } = await supabase
        .from('offers')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error || !offer) {
        alert("Offer not found");
        router.push('/profile');
        return;
      }

      if (offer.user_id !== user.id) {
        alert("You can only edit your own offers.");
        router.push('/profile');
        return;
      }

      setCategory(offer.category);
      setTitle(offer.title);
      setDescription(offer.description || '');
      
      // --- PRZELICZANIE WALUTY (EUR -> Twoja waluta) ---
      const rate = EXCHANGE_RATES[currency] || 1;
      const localPrice = (offer.price * rate).toFixed(2); // Przeliczamy np. 10 EUR * 4.3 = 43.00 PLN
      setPrice(localPrice);
      // -------------------------------------------------

      setStock(offer.stock.toString());
      setMaterial(offer.material || '');
      setColor(offer.color || '');
      setWeight(offer.weight || '');
      setDimensions(offer.dimensions || '');
      setExistingImages(offer.image_urls || []);
      setExistingFileUrl(offer.file_url);
      
      setLoading(false);
    };

    // Dodajemy 'currency' do zależności, żeby przeliczyło się poprawnie po załadowaniu
    if (currency) {
        initData();
    }
  }, [params.id, router, currency]); 

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      if (files.length + newImages.length + existingImages.length > 6) {
        alert("Max 6 photos allowed (total).");
        return;
      }
      setNewImages([...newImages, ...files]);
    }
  };

  const removeExistingImage = (indexToRemove: number) => {
    setExistingImages(existingImages.filter((_, i) => i !== indexToRemove));
  };

  const removeNewImage = (indexToRemove: number) => {
    setNewImages(newImages.filter((_, i) => i !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let uploadedImageUrls: string[] = [];

      // 1. Upload NOWYCH zdjęć
      if (newImages.length > 0) {
        for (const file of newImages) {
          const fileExt = file.name.split('.').pop();
          const imagePath = `previews/${Date.now()}-${Math.random()}.${fileExt}`;
          const { error: imgErr } = await supabase.storage.from(BUCKET_NAME).upload(imagePath, file);
          if (imgErr) throw imgErr;
          const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(imagePath);
          uploadedImageUrls.push(data.publicUrl);
        }
      }

      const finalImages = [...existingImages, ...uploadedImageUrls];

      if (category !== 'job' && finalImages.length === 0) {
          alert("You must have at least one photo.");
          setSaving(false);
          return;
      }

      // --- PRZELICZANIE ZWROTNE (Twoja waluta -> EUR) ---
      // Baza danych zawsze przechowuje EUR.
      // Jeśli wpisałeś 43 PLN, a kurs to 4.3, to do bazy trafi 10 EUR.
      const rate = EXCHANGE_RATES[currency] || 1;
      const priceInEur = parseFloat(price) / rate;
      // --------------------------------------------------

      const updates = {
        title,
        description,
        price: priceInEur, // Zapisujemy przeliczoną cenę w EUR
        stock: parseInt(stock),
        material: material || null,
        color: color || null,
        weight: weight || null,
        dimensions: dimensions || null,
        image_urls: finalImages,
        image_url: finalImages[0] || null,
        updated_at: new Date()
      };

      const { error: updateError } = await supabase
        .from('offers')
        .update(updates)
        .eq('id', params.id);

      if (updateError) throw updateError;

      alert("Offer updated successfully!");
      router.push('/profile');

    } catch (err: any) {
      console.error("Update Error:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600"/></div>;

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="max-w-3xl w-full bg-white rounded-3xl shadow-xl border border-gray-200 relative">
        <div className="flex justify-between items-center mb-8 bg-gray-900 p-8 rounded-t-3xl text-white">
          <div>
             <h1 className="text-2xl font-black uppercase tracking-tight">Edit Listing</h1>
             <p className="text-gray-400 text-xs mt-1">Update details for "{title}"</p>
          </div>
          <button onClick={() => router.back()} className="p-2 hover:bg-white/20 rounded-full transition"><X/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3 text-blue-800 font-bold uppercase text-xs">
             <Layers size={16}/> 
             Category: {category === 'job' ? 'Print Request' : category === 'digital' ? '3D File' : 'Physical Item'}
             <span className="ml-auto text-blue-500 font-normal normal-case">(Cannot be changed)</span>
          </div>

          <div className="space-y-4">
            <label className="block text-xs font-black uppercase text-gray-600 tracking-widest">Basic Details</label>
            <input 
              type="text" 
              placeholder="Title" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="w-full p-4 bg-white border border-gray-300 rounded-xl font-bold text-gray-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-gray-400" 
              required 
            />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                {/* TUTAJ WYŚWIETLAMY SYMBOL TWOJEJ WALUTY */}
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 font-black text-xs tracking-wider pointer-events-none">
                  {symbol || currency}
                </span>
                <input 
                  type="number" 
                  step="0.01" 
                  value={price} 
                  onChange={e => setPrice(e.target.value)} 
                  className="w-full p-4 pl-16 bg-white border border-gray-300 rounded-xl font-bold text-gray-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-gray-400" 
                  required 
                />
              </div>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 font-black text-xs tracking-wider pointer-events-none">QTY</span>
                <input 
                  type="number" 
                  min="0" 
                  value={stock} 
                  onChange={e => setStock(e.target.value)} 
                  className="w-full p-4 pl-16 bg-white border border-gray-300 rounded-xl font-bold text-gray-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-gray-400" 
                  required 
                />
              </div>
            </div>

            <textarea 
              placeholder="Description" 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              className="w-full p-4 bg-white border border-gray-300 rounded-xl font-medium text-gray-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all placeholder:text-gray-400" 
              rows={4} 
            />
          </div>

          {/* SPECS (Optional) */}
          {category !== 'digital' && (
            <div className="space-y-4">
              <label className="block text-xs font-black uppercase text-gray-600 tracking-widest">Specs</label>
              <div className="grid grid-cols-2 gap-4">
                 <input 
                   type="text" 
                   placeholder="Material" 
                   value={material} 
                   onChange={e => setMaterial(e.target.value)} 
                   className="p-4 bg-white border border-gray-300 rounded-xl font-medium text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all outline-none placeholder:text-gray-400" 
                 />
                 <input 
                   type="text" 
                   placeholder="Color" 
                   value={color} 
                   onChange={e => setColor(e.target.value)} 
                   className="p-4 bg-white border border-gray-300 rounded-xl font-medium text-sm text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all outline-none placeholder:text-gray-400" 
                 />
              </div>
            </div>
          )}

          {/* IMAGES MANAGEMENT */}
          {category !== 'job' && (
            <div className="space-y-4">
              <label className="block text-xs font-black uppercase text-gray-600 tracking-widest">Photos</label>
              
              <div className="grid grid-cols-3 gap-4">
                {/* Existing Images */}
                {existingImages.map((url, idx) => (
                  <div key={`old-${idx}`} className="relative h-24 w-full rounded-xl overflow-hidden group border border-gray-200 shadow-sm">
                    <img src={url} className="h-full w-full object-cover" alt="existing" />
                    <button type="button" onClick={() => removeExistingImage(idx)} className="absolute inset-0 bg-red-600/90 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white transition-all cursor-pointer">
                      <Trash2 size={24} />
                    </button>
                  </div>
                ))}
                
                {/* New Images */}
                {newImages.map((file, idx) => (
                  <div key={`new-${idx}`} className="relative h-24 w-full rounded-xl overflow-hidden group border-2 border-blue-500 shadow-sm">
                    <img src={URL.createObjectURL(file)} className="h-full w-full object-cover" alt="new" />
                    <button type="button" onClick={() => removeNewImage(idx)} className="absolute inset-0 bg-red-600/90 flex items-center justify-center opacity-0 group-hover:opacity-100 text-white transition-all cursor-pointer">
                      <Trash2 size={24} />
                    </button>
                  </div>
                ))}

                {/* Upload Button */}
                {(existingImages.length + newImages.length < 6) && (
                   <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-400 rounded-xl cursor-pointer hover:border-blue-600 hover:bg-blue-50 transition-all text-gray-500 hover:text-blue-600 bg-gray-50">
                     <ImageIcon size={24} />
                     <span className="text-[10px] font-bold uppercase mt-1">Add Photo</span>
                     <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
                   </label>
                )}
              </div>
            </div>
          )}

          <button disabled={saving} className="w-full py-5 bg-gray-900 text-white rounded-xl font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl flex justify-center items-center gap-3 text-sm hover:shadow-2xl transform active:scale-[0.99]">
            {saving ? <Loader2 className="animate-spin" /> : <><Save size={18}/> Save Changes</>}
          </button>
        </form>
      </div>
    </main>
  );
}