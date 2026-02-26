'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// Naprawiony import ikony:
import {
  UploadCloud, Loader2, FileText, Image as ImageIcon,
  Box, Layers, Printer, Tag, X, Trash2
} from 'lucide-react';

// --- KONFIGURACJA ---
const BUCKET_NAME = 'printsi-files1';
// --------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AddOfferPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  // --- 1. LISTING TYPE ---
  const [category, setCategory] = useState<'job' | 'digital' | 'physical'>('digital');
  const [userRoles, setUserRoles] = useState<string[]>([]);

  // --- 2. FORM FIELDS ---
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');

  // Physical Parameters
  const [material, setMaterial] = useState('');
  const [color, setColor] = useState('');
  const [weight, setWeight] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [tags, setTags] = useState('');

  // Files State
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [previewImages, setPreviewImages] = useState<File[]>([]);

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
        }
      }
    };
    checkUser();
  }, [router]);

  // Handle Image Selection
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
    console.log("🚀 ROZPOCZYNAMY WYSYŁANIE...");

    if (!title || !price) {
      alert("Title and Price are required.");
      return;
    }
    // Walidacja zdjęć (wymagane dla physical/digital, opcjonalne dla job)
    if (category !== 'job' && previewImages.length === 0) {
      alert("Please upload at least 1 photo.");
      return;
    }
    // Walidacja pliku 3D (wymagane tylko dla digital)
    if (category === 'digital' && !projectFile) {
      alert("3D File (.STL) is required for digital items.");
      return;
    }
    if (!user?.id) {
      alert("BŁĄD KRYTYCZNY: Brak ID użytkownika. Zaloguj się ponownie.");
      return;
    }

    setLoading(true);

    try {
      let projUrl = null;
      let uploadedImageUrls: string[] = [];

      // 1. Upload 3D File (jeśli jest)
      if (projectFile) {
        const fileExt = projectFile.name.split('.').pop();
        const projectPath = `projects/${Date.now()}-${Math.random()}.${fileExt}`;
        const { error: projErr } = await supabase.storage.from(BUCKET_NAME).upload(projectPath, projectFile);
        if (projErr) throw projErr;

        const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(projectPath);
        projUrl = data.publicUrl;
      }

      // 2. Upload Images
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
        // Fallback image dla zleceń bez zdjęcia
        uploadedImageUrls.push("https://via.placeholder.com/400x300?text=Print+Request");
      }

      const payload = {
        title,
        description,
        price: parseFloat(price),
        category: category,
        material: material || null,
        color: color || null,
        weight: weight || null,
        dimensions: dimensions || null,
        stock: parseInt(stock),
        file_url: projUrl,
        image_url: uploadedImageUrls[0] || null, // Główne zdjęcie
        image_urls: uploadedImageUrls,           // Wszystkie zdjęcia
        user_id: user.id,
        created_at: new Date()
      };

      const { error: dbErr } = await supabase.from('offers').insert(payload);

      if (dbErr) throw dbErr;

      alert("Success! Your listing has been published.");
      router.push('/gallery');

    } catch (err: any) {
      console.error("❌ BŁĄD:", err);
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center text-gray-900 font-sans relative">
      <div className="max-w-3xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 relative">
        <Link href="/" className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-10"><X size={24} /></Link>

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
                {userRoles.includes('printer') && (
                  <button type="button" onClick={() => { setCategory('job'); setPreviewImages([]); }} className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${category === 'job' ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-500 hover:border-blue-200'}`}>
                    <Printer size={32} />
                    <span className="font-black uppercase text-sm">Print Request</span>
                  </button>
                )}
                <button type="button" onClick={() => setCategory('digital')} className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${category === 'digital' ? 'border-purple-600 bg-purple-50 text-purple-800' : 'border-gray-200 text-gray-500 hover:border-purple-200'}`}>
                  <Layers size={32} />
                  <span className="font-black uppercase text-sm">Digital File</span>
                </button>
                <button type="button" onClick={() => setCategory('physical')} className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${category === 'physical' ? 'border-orange-600 bg-orange-50 text-orange-800' : 'border-gray-200 text-gray-500 hover:border-orange-200'}`}>
                  <Box size={32} />
                  <span className="font-black uppercase text-sm">Physical Item</span>
                </button>
              </div>
            </div>

            {/* STEP 2: DETAILS */}
            <div className="space-y-4">
              <label className="block text-xs font-black uppercase text-gray-400 tracking-widest">2. Basic Details</label>
              <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-600 focus:bg-white transition-all" required />

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs tracking-wider pointer-events-none">EUR</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="w-full p-4 pl-16 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-600 focus:bg-white transition-all"
                    required
                  />
                </div>

                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs tracking-wider pointer-events-none">QTY</span>
                  <input
                    type="number"
                    placeholder="1"
                    min="1"
                    value={stock}
                    onChange={e => setStock(e.target.value)}
                    className="w-full p-4 pl-16 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-600 focus:bg-white transition-all"
                    required
                  />
                </div>
              </div>

              <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:border-blue-600 focus:bg-white transition-all" rows={4} />

              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input type="text" placeholder="Tags (optional)" value={tags} onChange={e => setTags(e.target.value)} className="w-full p-4 pl-12 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm outline-none focus:border-blue-600 focus:bg-white transition-all" />
              </div>
            </div>

            {/* STEP 3: SPECS */}
            {category !== 'digital' && (
              <div className="space-y-4">
                <label className="block text-xs font-black uppercase text-gray-400 tracking-widest">3. Specs</label>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Material" value={material} onChange={e => setMaterial(e.target.value)} className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm focus:border-blue-600 focus:bg-white transition-all outline-none" />
                  <input type="text" placeholder="Color" value={color} onChange={e => setColor(e.target.value)} className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm focus:border-blue-600 focus:bg-white transition-all outline-none" />
                </div>
                {category === 'physical' && (
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Weight" value={weight} onChange={e => setWeight(e.target.value)} className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm focus:border-blue-600 focus:bg-white transition-all outline-none" />
                    <input type="text" placeholder="Dimensions" value={dimensions} onChange={e => setDimensions(e.target.value)} className="p-4 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm focus:border-blue-600 focus:bg-white transition-all outline-none" />
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: FILES */}
            <div className="space-y-4">
              <label className="block text-xs font-black uppercase text-gray-400 tracking-widest">4. Attachments</label>

              {/* Sekcja uploadu pliku 3D - tylko dla Digital */}
              {category === 'digital' && (
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group">
                  <FileText className={`mb-3 ${projectFile ? "text-green-600" : "text-gray-400 group-hover:text-blue-500"}`} size={32} />
                  <span className="text-xs font-black uppercase text-gray-500">{projectFile ? projectFile.name : "Upload 3D File (.STL)"}</span>
                  <input type="file" className="hidden" accept=".stl,.obj,.3mf,.zip" onChange={e => setProjectFile(e.target.files?.[0] || null)} />
                </label>
              )}

              {/* Sekcja uploadu zdjęć - dla wszystkich (oprócz Job, gdzie jest opcjonalne) */}
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