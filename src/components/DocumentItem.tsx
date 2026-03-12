import React, { useState } from 'react';
import { DocumentRequirement, Scenario, AppSettings } from '../types';
import { generateDocumentImage, generateClaimFormPdf } from '../services/geminiService';
import { Loader2, Download, MessageSquare, X, FileDown } from 'lucide-react';

interface Props {
  key?: React.Key;
  requirement: DocumentRequirement;
  scenario: Scenario;
  settings: AppSettings;
}

export function DocumentItem({ requirement, scenario, settings }: Props) {
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuidance, setShowGuidance] = useState(false);
  const [documentGuidance, setDocumentGuidance] = useState('');

  const isClaimForm = requirement.id === 'claim_form';
  const requirementWithGuidance: DocumentRequirement = {
    ...requirement,
    ...(documentGuidance.trim() ? { documentGuidelines: documentGuidance.trim() } : {}),
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      if (isClaimForm) {
        const blob = await generateClaimFormPdf(scenario, settings);
        const url = URL.createObjectURL(blob);
        setGeneratedPdfUrl(url);
      } else {
        const result = await generateDocumentImage(scenario, requirementWithGuidance);
        setGeneratedImage(result);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate document';
      setError(msg);
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

      {!showGuidance ? (
        <button
          type="button"
          onClick={() => setShowGuidance(true)}
          className="text-grey-500 font-bold text-sm hover:text-grey-800 transition-colors flex items-center mb-6 group"
        >
          <div className="bg-grey-10 p-2 rounded-full mr-3 group-hover:bg-green-100 group-hover:text-green-600 transition-colors">
            <MessageSquare className="w-4 h-4" />
          </div>
          Add specific document instructions
        </button>
      ) : (
        <div className="animate-fade-in mb-6 bg-grey-10 p-1 rounded-3xl border border-grey-50 focus-within:ring-2 focus-within:ring-green-200 transition-all">
          <div className="flex justify-between items-center px-4 pt-3 pb-1">
            <label className="text-xs font-bold text-grey-600 uppercase tracking-wider">
              Additional Instructions
            </label>
            <button
              type="button"
              onClick={() => { setShowGuidance(false); setDocumentGuidance(''); }}
              className="text-grey-400 hover:text-grey-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <textarea
            value={documentGuidance}
            onChange={(e) => setDocumentGuidance(e.target.value)}
            placeholder="e.g. Make the document look old and crumpled, or specify a certain detail..."
            className="w-full bg-transparent border-none px-4 py-2 text-grey-800 placeholder-grey-400 focus:outline-none resize-none h-20 text-sm"
          />
        </div>
      )}

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
        ) : generatedPdfUrl ? (
          <div className="rounded-2xl overflow-hidden bg-grey-10 border border-grey-50">
            <div className="p-3 bg-white border-b border-grey-50 flex justify-between items-center">
              <span className="text-sm font-bold text-grey-600">Generated PDF</span>
              <a
                href={generatedPdfUrl}
                download={`third-party-claim-form-${scenario.claimNumber}.pdf`}
                className="text-grey-800 hover:text-green-400 p-2 bg-grey-10 rounded-full transition-colors"
                title="Download PDF"
              >
                <Download className="w-5 h-5" />
              </a>
            </div>
            <div className="p-4 flex justify-center bg-grey-10">
              <a
                href={generatedPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-grey-800 hover:text-green-400 font-bold text-sm"
              >
                <FileDown className="w-5 h-5" />
                Open PDF in new tab
              </a>
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
            ) : isClaimForm ? (
              'Generate PDF'
            ) : (
              'Generate Document'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
