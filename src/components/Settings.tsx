import React, { useState, useEffect } from 'react';
import { AppSettings, ALL_DOCS } from '../types';
import { db } from '../services/db';
import { Upload, Trash2, Check, X } from 'lucide-react';

interface Props {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

export function Settings({ settings, onSave, onClose }: Props) {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [examples, setExamples] = useState<Record<string, string>>({});

  useEffect(() => {
    loadExamples();
  }, []);

  const loadExamples = async () => {
    const loaded: Record<string, string> = {};
    for (const doc of ALL_DOCS) {
      const data = await db.get(doc.id);
      if (data) loaded[doc.id] = data;
    }
    setExamples(loaded);
  };

  const handleDefaultChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSettings({
      ...localSettings,
      defaults: {
        ...localSettings.defaults,
        [e.target.name]: e.target.value
      }
    });
  };

  const handleFileUpload = async (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      await db.set(id, base64);
      setExamples(prev => ({ ...prev, [id]: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveExample = async (id: string) => {
    await db.remove(id);
    setExamples(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const saveAndClose = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-grey-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 lg:p-12 animate-fade-in">
      <div className="bg-white rounded-4xl lg:rounded-5xl shadow-surround-lg w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
        <div className="p-8 lg:p-10 border-b border-grey-50 flex justify-between items-center bg-grey-10">
          <h2 className="text-3xl font-black leading-tighter text-grey-800">
            App <span className="text-green-200">Settings</span>
          </h2>
          <button onClick={saveAndClose} className="p-3 bg-white text-grey-800 rounded-full shadow-button-hidden hover:shadow-button hover:-translate-y-1 transition-all duration-300 ease-out">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-8 lg:p-10 overflow-y-auto flex-1 space-y-12">
          <section>
            <h3 className="text-2xl font-bold text-grey-800 mb-6">Defaults</h3>
            <div className="max-w-md">
              <label className="block text-sm font-bold text-grey-600 mb-2">Third Party Driver ID</label>
              <input
                type="text"
                name="thirdPartyId"
                value={localSettings.defaults.thirdPartyId}
                onChange={handleDefaultChange}
                className="w-full rounded-full bg-grey-10 border-none px-6 py-4 text-grey-800 focus:ring-2 focus:ring-green-200 outline-none"
              />
            </div>
          </section>

          <section>
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-grey-800 mb-2">Document Configuration</h3>
              <p className="text-grey-600 font-extralight tracking-compact leading-6">
                Upload example documents to be used as templates for generation. These are saved locally in your browser.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ALL_DOCS.map(doc => (
                <div key={doc.id} className="bg-grey-10 rounded-3xl p-6 flex flex-col">
                  <div className="font-bold text-grey-800 mb-2">{doc.title}</div>
                  <div className="text-sm text-grey-600 font-extralight tracking-compact leading-6 mb-6 flex-1">{doc.description}</div>
                  
                  {examples[doc.id] ? (
                    <div className="flex items-center justify-between bg-green-100 rounded-full p-2 pl-4">
                      <div className="flex items-center text-green-600 font-bold text-sm">
                        <Check className="w-4 h-4 mr-2" /> Example Set
                      </div>
                      <button onClick={() => handleRemoveExample(doc.id)} className="p-2 bg-white text-grey-600 hover:text-red-500 rounded-full shadow-sm transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center w-full px-6 py-3 bg-white rounded-full cursor-pointer shadow-button-hidden hover:shadow-button hover:-translate-y-1 transition-all duration-300 ease-out">
                      <Upload className="w-4 h-4 mr-2 text-grey-800" />
                      <span className="font-bold text-grey-800 text-sm">Upload Example</span>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleFileUpload(doc.id, e.target.files[0]);
                        }}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
