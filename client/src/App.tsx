import React, { useState, useCallback } from 'react';
import './App.css';
import CVRanking from './components/CVRanking';
import CVGeneration from './components/CVGeneration';

type Mode = 'ranking' | 'generation';

function App() {
  const [currentMode, setCurrentMode] = useState<Mode>('ranking');
  const [generatedCVs, setGeneratedCVs] = useState<any[]>([]);
  const [jobDescription, setJobDescription] = useState('');
  const [shouldAutoRank, setShouldAutoRank] = useState(false);

  const handleRankAllGeneratedCVs = useCallback(() => {
    setShouldAutoRank(true);
    setCurrentMode('ranking');
  }, []);

  const handleAutoRankComplete = useCallback(() => {
    setShouldAutoRank(false);
  }, []);

  const handleGeneratedCVsChange = useCallback((cvs: any[]) => {
    setGeneratedCVs(cvs);
  }, []);

  const handleJobDescriptionChange = useCallback((desc: string) => {
    setJobDescription(desc);
  }, []);

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
            onRankAllGeneratedCVs={handleRankAllGeneratedCVs}
            generatedCVs={generatedCVs}
            jobDescription={jobDescription}
            shouldAutoRank={shouldAutoRank}
            onAutoRankComplete={handleAutoRankComplete}
            onJobDescriptionChange={handleJobDescriptionChange}
          />
        </div>
        <div style={{ display: currentMode === 'generation' ? 'block' : 'none' }}>
          <CVGeneration 
            onRankAllGeneratedCVs={handleRankAllGeneratedCVs}
            generatedCVs={generatedCVs}
            jobDescription={jobDescription}
            onGeneratedCVsChange={handleGeneratedCVsChange}
            onJobDescriptionChange={handleJobDescriptionChange}
          />
        </div>
      </main>
    </div>
  );
}

export default App;