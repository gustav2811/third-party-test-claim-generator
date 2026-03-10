import { useState, useEffect } from 'react';
import { ApiKeyGate } from './components/ApiKeyGate';
import { DocumentWorkspace } from './components/DocumentWorkspace';
import { Settings } from './components/Settings';
import { Scenario, AppSettings, DEFAULT_SETTINGS } from './types';
import { generateScenario } from './services/geminiService';
import { Settings as SettingsIcon, Loader2, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [claimNumber, setClaimNumber] = useState('');
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [scenarioApproved, setScenarioApproved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('appSettings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
  }, [settings]);

  const handleGenerateScenario = async () => {
    if (!claimNumber) return;
    setIsGeneratingScenario(true);
    setScenarioApproved(false);
    try {
      const generated = await generateScenario(claimNumber, settings.defaults);
      setScenario(generated);
    } catch (error) {
      console.error(error);
      alert('Failed to generate scenario');
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  return (
    <ApiKeyGate>
      <div className="min-h-screen bg-grey-10 font-sans text-grey-800">
        <header className="px-6 py-8 lg:px-12 lg:py-12 flex justify-between items-center">
          <h1 className="text-3xl lg:text-5xl font-black leading-tighter text-grey-800 tracking-compact">
            Naked <span className="text-green-200">Claims</span>
          </h1>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-3 bg-white rounded-full shadow-button-hidden hover:shadow-button hover:-translate-y-1 transition-all duration-300 ease-out text-grey-800"
          >
            <SettingsIcon className="w-6 h-6" />
          </button>
        </header>

        <main className="px-4 lg:px-12 pb-24 space-y-8 lg:space-y-12">
          {/* Section 1: Input */}
          <section className="bg-white rounded-4xl lg:rounded-5xl p-8 lg:p-12 shadow-solid animate-fade-in-from-bottom">
            <h2 className="text-2xl lg:text-4xl font-black leading-tighter text-grey-800 mb-4">
              Generate a <span className="text-green-200">Scenario</span>
            </h2>
            <p className="text-grey-600 font-extralight tracking-compact leading-6 mb-8 max-w-2xl">
              Enter a first party claim number to generate a realistic third-party motor vehicle accident scenario.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 max-w-xl">
              <input
                type="text"
                value={claimNumber}
                onChange={(e) => setClaimNumber(e.target.value)}
                placeholder="e.g. CLM-12345"
                className="flex-1 rounded-full bg-grey-10 border-none px-6 py-4 text-lg text-grey-800 placeholder-grey-400 focus:ring-2 focus:ring-green-200 outline-none"
              />
              <button
                onClick={handleGenerateScenario}
                disabled={!claimNumber || isGeneratingScenario}
                className="px-8 py-4 bg-grey-800 text-white rounded-full font-bold shadow-button-hidden hover:shadow-button hover:-translate-y-1 transition-all duration-300 ease-out disabled:opacity-50 disabled:hover:shadow-button-hidden disabled:hover:translate-y-0 flex items-center justify-center"
              >
                {isGeneratingScenario ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generate'}
              </button>
            </div>
          </section>

          {/* Section 2: Scenario Details */}
          {scenario && (
            <section className="bg-grey-800 rounded-4xl lg:rounded-5xl p-8 lg:p-12 text-white shadow-solid animate-fade-in-from-bottom">
              <div className="flex flex-col lg:flex-row gap-12">
                <div className="flex-1 space-y-8">
                  <h2 className="text-2xl lg:text-4xl font-black leading-tighter text-white mb-8">
                    Scenario <span className="text-green-200">Details</span>
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-green-200 font-bold mb-2">First Party</h3>
                      <p className="font-extralight tracking-compact leading-6 text-grey-100">{scenario.firstPartyDescription}</p>
                      <h4 className="text-sm font-bold text-grey-300 mt-4 mb-1">Witnesses</h4>
                      <p className="font-extralight tracking-compact text-grey-100">{scenario.witnesses}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-green-200 font-bold mb-2">Third Party</h3>
                      <p className="font-bold text-white mb-1">{scenario.thirdPartyName} {scenario.thirdPartySurname}</p>
                      <p className="text-sm text-grey-400 mb-4">ID: {scenario.thirdPartyId}</p>
                      <h4 className="text-sm font-bold text-grey-300 mb-1">Version of Events</h4>
                      <p className="font-extralight tracking-compact leading-6 text-grey-100">{scenario.thirdPartyVersion}</p>
                    </div>
                  </div>
                </div>
                
                <div className="lg:w-1/3 flex flex-col justify-center">
                  {!scenarioApproved ? (
                    <button
                      onClick={() => setScenarioApproved(true)}
                      className="w-full py-6 bg-green-200 text-grey-900 rounded-full font-bold text-lg shadow-button-hidden hover:shadow-button hover:-translate-y-1 transition-all duration-300 ease-out flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-6 h-6 mr-2" />
                      Approve Scenario
                    </button>
                  ) : (
                    <div className="w-full py-6 bg-grey-700 text-green-200 rounded-full font-bold text-lg flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 mr-2" />
                      Scenario Approved
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Section 3: Document Workspace */}
          {scenarioApproved && scenario && (
            <section className="animate-fade-in-from-bottom">
              <DocumentWorkspace scenario={scenario} />
            </section>
          )}
        </main>
      </div>

      {showSettings && (
        <Settings
          settings={settings}
          onSave={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </ApiKeyGate>
  );
}
