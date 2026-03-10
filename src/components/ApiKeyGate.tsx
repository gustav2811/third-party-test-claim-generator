import React, { useState, useEffect } from 'react';

export function ApiKeyGate({ children }: { children: React.ReactNode }) {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkKey();
  }, []);

  const checkKey = async () => {
    if (window.aistudio?.hasSelectedApiKey) {
      try {
        const result = await window.aistudio.hasSelectedApiKey();
        setHasKey(result);
      } catch (e) {
        console.error(e);
        setHasKey(false);
      }
    } else {
      setHasKey(true);
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        setHasKey(true);
        setError(null);
      } catch (e: any) {
        console.error(e);
        if (e?.message?.includes('Requested entity was not found')) {
          setError('Key selection failed. Please try again.');
          setHasKey(false);
        } else {
           setHasKey(true);
        }
      }
    }
  };

  if (hasKey === null) {
    return <div className="flex items-center justify-center min-h-screen bg-grey-10 text-grey-500 font-sans">Loading...</div>;
  }

  if (!hasKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-grey-10 p-4 font-sans">
        <div className="max-w-lg w-full bg-white rounded-4xl shadow-solid p-10 text-center animate-fade-in-from-bottom">
          <h2 className="text-3xl font-black leading-tighter text-grey-800 mb-4">
            API Key <span className="text-green-200">Required</span>
          </h2>
          <p className="text-grey-600 font-extralight tracking-compact leading-6 mb-8">
            This application uses advanced image generation models that require a paid Google Cloud API key.
          </p>
          {error && <p className="text-red-500 mb-6 font-medium">{error}</p>}
          <button
            onClick={handleSelectKey}
            className="w-full py-4 bg-grey-800 text-white rounded-full font-bold shadow-button-hidden hover:shadow-button hover:-translate-y-1 transition-all duration-300 ease-out"
          >
            Select API Key
          </button>
          <p className="mt-6 text-sm text-grey-500">
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-grey-800 hover:text-green-400 underline transition-colors">
              Learn more about billing
            </a>
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
