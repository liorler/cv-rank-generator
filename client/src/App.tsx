import React, { useState } from 'react';
import './App.css';
import CVRanking from './components/CVRanking';
import CVGeneration from './components/CVGeneration';

type Mode = 'ranking' | 'generation';

function App() {
  const [currentMode, setCurrentMode] = useState<Mode>('ranking');
  const [generatedCVs, setGeneratedCVs] = useState<any[]>([]);
  const [jobDescription, setJobDescription] = useState('');
  const [shouldAutoRank, setShouldAutoRank] = useState(false);

  return (
    <div className="App">
      <header className="App-header">
        <h1>CV Rank Generator</h1>
        <p>AI-powered CV ranking and generation tool</p>
      </header>
      
      <nav className="mode-selector">
        <button 
          className={currentMode === 'ranking' ? 'active' : ''}
          onClick={() => setCurrentMode('ranking')}
        >
          CV Ranking
        </button>
        <button 
          className={currentMode === 'generation' ? 'active' : ''}
          onClick={() => setCurrentMode('generation')}
        >
          CV Generation
        </button>
      </nav>

      <main className="main-content">
        <div style={{ display: currentMode === 'ranking' ? 'block' : 'none' }}>
          <CVRanking 
            generatedCVs={generatedCVs}
            jobDescription={jobDescription}
            onGeneratedCVsChange={setGeneratedCVs}
            onJobDescriptionChange={setJobDescription}
            shouldAutoRank={shouldAutoRank}
            onAutoRankComplete={() => setShouldAutoRank(false)}
          />
        </div>
        <div style={{ display: currentMode === 'generation' ? 'block' : 'none' }}>
          <CVGeneration 
            onRankAllGeneratedCVs={() => {
              setShouldAutoRank(true);
              setCurrentMode('ranking');
            }}
            generatedCVs={generatedCVs}
            jobDescription={jobDescription}
            onGeneratedCVsChange={setGeneratedCVs}
            onJobDescriptionChange={setJobDescription}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
