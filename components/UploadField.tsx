import React, { ChangeEvent } from 'react';

interface UploadFieldProps {
  label: string;
  subLabel?: string;
  id: string;
  previewUrl: string | null;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

export const UploadField: React.FC<UploadFieldProps> = ({ 
  label, 
  subLabel, 
  id, 
  previewUrl, 
  onChange,
  onClear
}) => {
  return (
    <div className="flex flex-col gap-2 mb-6">
      <label htmlFor={id} className="text-sm font-bold uppercase tracking-wide text-gray-300">
        {label}
      </label>
      {subLabel && <p className="text-xs text-gray-500 mb-1">{subLabel}</p>}
      
      <div className="relative group">
        {!previewUrl ? (
          <label 
            htmlFor={id} 
            className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer bg-zinc-900/50 hover:bg-zinc-800 hover:border-red-600 transition-colors"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg className="w-8 h-8 mb-4 text-gray-400 group-hover:text-red-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
              </svg>
              <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Kliknij</span> lub upuść zdjęcie</p>
              <p className="text-xs text-gray-500">PNG, JPG (MAX. 5MB)</p>
            </div>
            <input id={id} type="file" className="hidden" accept="image/*" onChange={onChange} />
          </label>
        ) : (
          <div className="relative w-full h-48 rounded-lg overflow-hidden border border-zinc-700 group-hover:border-red-600 transition-colors">
            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            <button 
              onClick={onClear}
              className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};