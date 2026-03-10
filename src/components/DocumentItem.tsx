import React, { useState } from 'react';
import { DocumentRequirement, Scenario } from '../types';
import { generateDocumentImage } from '../services/geminiService';
import { Loader2, Download } from 'lucide-react';

interface Props {
  key?: React.Key;
  requirement: DocumentRequirement;
  scenario: Scenario;
}

export function DocumentItem({ requirement, scenario }: Props) {
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateDocumentImage(scenario, requirement);
      setGeneratedImage(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate document');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-card flex flex-col h-full transition-all duration-300 hover:shadow-surround">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-grey-800 mb-2">{requirement.title}</h3>
        <p className="text-grey-600 font-extralight tracking-compact leading-6">{requirement.description}</p>
      </div>

      <div className="mt-auto flex flex-col space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</p>}

        {generatedImage ? (
          <div className="rounded-2xl overflow-hidden bg-grey-10 border border-grey-50">
            <div className="p-3 bg-white border-b border-grey-50 flex justify-between items-center">
              <span className="text-sm font-bold text-grey-600">Generated Result</span>
              <a
                href={generatedImage}
                download={`${requirement.id}.png`}
                className="text-grey-800 hover:text-green-400 p-2 bg-grey-10 rounded-full transition-colors"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </a>
            </div>
            <div className="p-4 flex justify-center bg-grey-10">
              <img src={generatedImage} alt="Generated Document" className="max-h-64 object-contain rounded-xl shadow-sm" />
            </div>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-4 bg-grey-800 text-white rounded-full font-bold shadow-button-hidden hover:shadow-button hover:-translate-y-1 transition-all duration-300 ease-out disabled:opacity-50 disabled:hover:shadow-button-hidden disabled:hover:translate-y-0 flex items-center justify-center"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate Document'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
