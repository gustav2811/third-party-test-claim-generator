import { useState, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { ApiKeyGate } from './components/ApiKeyGate';
import { DocumentWorkspace } from './components/DocumentWorkspace';
import { Settings } from './components/Settings';
import { Scenario, AppSettings, DEFAULT_SETTINGS } from './types';
import { getScenarioChat, generateInitialScenario, refineScenario, ProxyChat } from './services/geminiService';
import { Settings as SettingsIcon, Loader2, CheckCircle2, MessageSquare, Send, X } from 'lucide-react';

export default function App() {
  const [claimNumber, setClaimNumber] = useState('');
  const [initialGuidance, setInitialGuidance] = useState('');
  const [showGuidance, setShowGuidance] = useState(false);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [scenarioApproved, setScenarioApproved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [chatSession, setChatSession] = useState<ProxyChat | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  
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
    setIsEditing(false);
    try {
      const chat = getScenarioChat(claimNumber, settings.defaults);
      setChatSession(chat);
      const generated = await generateInitialScenario(chat, claimNumber, settings.defaults, initialGuidance);
      setScenario(generated);
    } catch (error) {
      console.error(error);
      alert('Failed to generate scenario');
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  const handleRefineScenario = async () => {
    if (!chatSession || !scenario || !editPrompt) return;
    setIsGeneratingScenario(true);
    try {
      const refined = await refineScenario(chatSession, scenario, editPrompt);
      setScenario(refined);
      setEditPrompt('');
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      alert('Failed to refine scenario');
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
            
            <div className="space-y-4 max-w-xl">
              <div className="flex flex-col sm:flex-row gap-4">
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
                  {isGeneratingScenario && !scenario ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Generate'}
                </button>
              </div>

              {!showGuidance ? (
                <button
                  onClick={() => setShowGuidance(true)}
                  className="text-grey-500 font-bold text-sm hover:text-grey-800 transition-colors flex items-center"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Customise the scenario
                </button>
              ) : (
                <div className="animate-fade-in space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-grey-600">Guidance (Optional)</label>
                    <button onClick={() => { setShowGuidance(false); setInitialGuidance(''); }} className="text-grey-400 hover:text-grey-800">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    value={initialGuidance}
                    onChange={(e) => setInitialGuidance(e.target.value)}
                    placeholder="e.g. The accident happened at a roundabout, or the third party was a taxi..."
                    className="w-full rounded-3xl bg-grey-10 border-none px-6 py-4 text-grey-800 placeholder-grey-400 focus:ring-2 focus:ring-green-200 outline-none resize-none h-24"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Section 2: Scenario Details */}
          {scenario && (
            <section className="bg-grey-800 rounded-4xl lg:rounded-5xl p-8 lg:p-12 text-white shadow-solid animate-fade-in-from-bottom relative overflow-hidden">
              {isGeneratingScenario && (
                <div className="absolute inset-0 bg-grey-800/50 backdrop-blur-sm flex items-center justify-center z-10">
                  <Loader2 className="w-12 h-12 text-green-200 animate-spin" />
                </div>
              )}
              
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
                
                <div className="lg:w-1/3 flex flex-col justify-center space-y-4">
                  {!scenarioApproved ? (
                    <>
                      <button
                        onClick={() => setScenarioApproved(true)}
                        className="w-full py-6 bg-green-200 text-grey-900 rounded-full font-bold text-lg shadow-button-hidden hover:shadow-button hover:-translate-y-1 transition-all duration-300 ease-out flex items-center justify-center"
                      >
                        <CheckCircle2 className="w-6 h-6 mr-2" />
                        Approve Scenario
                      </button>
                      
                      {!isEditing ? (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="w-full py-4 bg-grey-700 text-white rounded-full font-bold shadow-button-hidden hover:shadow-button hover:-translate-y-1 transition-all duration-300 ease-out flex items-center justify-center"
                        >
                          <MessageSquare className="w-5 h-5 mr-2" />
                          Edit Scenario
                        </button>
                      ) : (
                        <div className="space-y-4 animate-fade-in">
                          <div className="relative">
                            <textarea
                              value={editPrompt}
                              onChange={(e) => setEditPrompt(e.target.value)}
                              placeholder="Describe your changes..."
                              className="w-full rounded-3xl bg-grey-700 border-none px-6 py-4 text-white placeholder-grey-400 focus:ring-2 focus:ring-green-200 outline-none resize-none h-32"
                            />
                            <button
                              onClick={() => setIsEditing(false)}
                              className="absolute top-2 right-2 p-2 text-grey-400 hover:text-white"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          <button
                            onClick={handleRefineScenario}
                            disabled={!editPrompt || isGeneratingScenario}
                            className="w-full py-4 bg-green-200 text-grey-900 rounded-full font-bold shadow-button-hidden hover:shadow-button hover:-translate-y-1 transition-all duration-300 ease-out flex items-center justify-center disabled:opacity-50"
                          >
                            <Send className="w-5 h-5 mr-2" />
                            Update Scenario
                          </button>
                        </div>
                      )}
                    </>
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
      <Analytics />
    </ApiKeyGate>
  );
}
