import React, { useState } from 'react';
import { ClaimType, INSURED_DOCS, UNINSURED_DOCS, Scenario } from '../types';
import { DocumentItem } from './DocumentItem';

export function DocumentWorkspace({ scenario }: { scenario: Scenario }) {
  const [activeTab, setActiveTab] = useState<ClaimType>('insured');

  const docs = activeTab === 'insured' ? INSURED_DOCS : UNINSURED_DOCS;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <h2 className="text-3xl lg:text-5xl font-black leading-tighter text-grey-800">
          Generate <span className="text-green-200">Documents</span>
        </h2>
        
        <div className="flex p-1 bg-white rounded-full shadow-sm self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('insured')}
            className={`px-6 py-3 rounded-full text-sm font-bold transition-all duration-300 ${
              activeTab === 'insured' ? 'bg-grey-800 text-white shadow-button' : 'text-grey-600 hover:text-grey-800'
            }`}
          >
            Insured Claim
          </button>
          <button
            onClick={() => setActiveTab('uninsured')}
            className={`px-6 py-3 rounded-full text-sm font-bold transition-all duration-300 ${
              activeTab === 'uninsured' ? 'bg-grey-800 text-white shadow-button' : 'text-grey-600 hover:text-grey-800'
            }`}
          >
            Uninsured Claim
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {docs.map(doc => (
          <DocumentItem key={doc.id} requirement={doc} scenario={scenario} />
        ))}
      </div>
    </div>
  );
}
