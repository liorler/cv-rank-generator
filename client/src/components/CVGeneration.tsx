import React, { useState, useCallback, useMemo } from 'react';
import axios from 'axios';

interface GeneratedCV {
  title: string;
  content: string;
  rankingResult?: {
    score: number;
    explanation: string;
    advantages: string[];
    disadvantages: string[];
  };
  isRanking?: boolean;
}

interface GenerationResponse {
  success: boolean;
  data: {
    cvs: GeneratedCV[];
  };
}

interface CVGenerationProps {
  onRankAllGeneratedCVs: () => void;
  generatedCVs: any[];
  jobDescription: string;
  onGeneratedCVsChange: (cvs: any[]) => void;
  onJobDescriptionChange: (desc: string) => void;
}

const CVGeneration: React.FC<CVGenerationProps> = ({
  onRankAllGeneratedCVs,
  generatedCVs: propGeneratedCVs,
  jobDescription: propJobDescription,
  onGeneratedCVsChange,
  onJobDescriptionChange
}) => {
  const [jobDescription, setJobDescription] = useState(propJobDescription);
  const [numberOfCVs, setNumberOfCVs] = useState(2);
  const [additionalData, setAdditionalData] = useState('');
  const [baseDataFile, setBaseDataFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedCVs, setGeneratedCVs] = useState<GeneratedCV[]>(propGeneratedCVs);
  const [error, setError] = useState<string>('');

  // Memoized score color function
  const getScoreColor = useCallback((score: number) => {
    if (score >= 80) return '#28a745';
    if (score >= 60) return '#ffc107';
    return '#dc3545';
  }, []);

  // Memoized CV content formatter to prevent re-formatting on every render
  const formatCVContent = useCallback((content: string) => {
    // Convert the text content to HTML with proper formatting
    let formatted = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic text
      .replace(/^# (.*$)/gm, '<h1>$1</h1>') // H1 headers
      .replace(/^## (.*$)/gm, '<h2>$1</h2>') // H2 headers
      .replace(/^### (.*$)/gm, '<h3>$1</h3>') // H3 headers
      .replace(/^- (.*$)/gm, '<li>$1</li>') // Dash points
      .replace(/^\* (.*$)/gm, '<li>$1</li>') // Star points
      .replace(/^• (.*$)/gm, '<li>$1</li>') // Bullet points
      .replace(/\n\n/g, '<br><br>') // Double line breaks
      .replace(/\n/g, '<br>'); // Single line breaks

    // Wrap consecutive list items in ul tags
    formatted = formatted.replace(/(<li>.*?<\/li>(?:<br>)*)+/g, (match) => {
      return '<ul>' + match.replace(/<br>/g, '') + '</ul>';
    });

    return formatted;
  }, []);

  const handleJobDescriptionChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setJobDescription(value);
    onJobDescriptionChange(value);
  }, [onJobDescriptionChange]);

  const handleNumberOfCVsChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    if (value > 0) {
      setNumberOfCVs(value);
    }
  }, []);

  const handleAdditionalDataChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAdditionalData(event.target.value);
  }, []);

  const handleBaseDataFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setBaseDataFile(file);
  }, []);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!jobDescription.trim()) {
      setError('Please enter a job description');
      return;
    }
    
    if (numberOfCVs < 1) {
      setError('Number of CVs must be at least 1');
      return;
    }

    setIsLoading(true);
    setError('');
    setGeneratedCVs([]);

    try {
      const formData = new FormData();
      formData.append('jobDescription', jobDescription);
      formData.append('numberOfCVs', numberOfCVs.toString());
      formData.append('additionalData', additionalData);
      
      if (baseDataFile) {
        formData.append('baseData', baseDataFile);
      }

      const response = await axios.post<GenerationResponse>('/api/generate-cvs', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const newCVs = response.data.data.cvs;
        setGeneratedCVs(newCVs);
        onGeneratedCVsChange(newCVs);
      } else {
        setError('Failed to generate CVs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while generating CVs');
    } finally {
      setIsLoading(false);
    }
  }, [jobDescription, numberOfCVs, additionalData, baseDataFile, onGeneratedCVsChange]);

  const downloadCV = useCallback(async (content: string, title: string, format: 'txt' | 'word' | 'pdf') => {
    if (format === 'txt') {
      const element = document.createElement('a');
      const file = new Blob([content], { type: 'text/plain' });
      element.href = URL.createObjectURL(file);
      element.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } else {
      try {
        const response = await axios.post(`/api/download-${format}`, {
          content,
          title
        }, {
          responseType: 'blob'
        });
        
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${format === 'word' ? 'docx' : 'pdf'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error(`Error downloading ${format}:`, error);
        setError(`Failed to download ${format.toUpperCase()} file`);
      }
    }
  }, []);

  const rankSingleCV = useCallback(async (cvIndex: number) => {
    if (!jobDescription.trim()) {
      setError('Job description is required for ranking');
      return;
    }

    setGeneratedCVs(prev => prev.map((cv, index) => 
      index === cvIndex ? { ...cv, isRanking: true } : cv
    ));

    try {
      const formData = new FormData();
      formData.append('cvs', new Blob([generatedCVs[cvIndex].content], { type: 'text/plain' }), 'cv.txt');
      formData.append('jobDescription', new Blob([jobDescription], { type: 'text/plain' }), 'job.txt');

      const response = await axios.post('/api/rank-cvs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success && response.data.data.rankings.length > 0) {
        const ranking = response.data.data.rankings[0];
        setGeneratedCVs(prev => prev.map((cv, index) => 
          index === cvIndex ? { 
            ...cv, 
            isRanking: false, 
            rankingResult: {
              score: ranking.score,
              explanation: ranking.explanation,
              advantages: ranking.advantages,
              disadvantages: ranking.disadvantages
            }
          } : cv
        ));
      }
    } catch (err) {
      setGeneratedCVs(prev => prev.map((cv, index) => 
        index === cvIndex ? { ...cv, isRanking: false } : cv
      ));
      setError('Failed to rank CV: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }, [jobDescription, generatedCVs]);

  const rankAllGeneratedCVs = useCallback(() => {
    if (!jobDescription.trim()) {
      setError('Job description is required for ranking');
      return;
    }
    onRankAllGeneratedCVs();
  }, [jobDescription, onRankAllGeneratedCVs]);

  const resetForm = useCallback(() => {
    setJobDescription('');
    setNumberOfCVs(2);
    setAdditionalData('');
    setBaseDataFile(null);
    setGeneratedCVs([]);
    setError('');
    onJobDescriptionChange('');
    onGeneratedCVsChange([]);
  }, [onJobDescriptionChange, onGeneratedCVsChange]);

  // Memoized generated CVs list to prevent unnecessary re-renders
  const memoizedGeneratedCVs = useMemo(() => generatedCVs, [generatedCVs]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-title">
          <h2>CV Generation Tool</h2>
          <p>Generate multiple CVs tailored to a specific job description using AI.</p>
        </div>
        <button
          onClick={resetForm}
          className="reset-btn"
          title="Reset form"
        >
          Reset
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="job-description">Job Description</label>
          <textarea
            id="job-description"
            className="textarea"
            value={jobDescription}
            onChange={handleJobDescriptionChange}
            placeholder="Enter the job description here..."
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="number-of-cvs">Number of CVs to Generate</label>
          <input
            type="number"
            id="number-of-cvs"
            className="number-input"
            value={numberOfCVs}
            onChange={handleNumberOfCVsChange}
            min="1"
            max="10"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="additional-data">Additional Base Data (Optional)</label>
          <textarea
            id="additional-data"
            className="textarea"
            value={additionalData}
            onChange={handleAdditionalDataChange}
            placeholder="Enter personal information, experience, skills, etc. that should be used as a base for the generated CVs..."
          />
        </div>

        <div className="form-group">
          <label htmlFor="base-data-file">Or Upload Base Data File (Optional)</label>
          <div className="file-input">
            <input
              type="file"
              id="base-data-file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleBaseDataFileChange}
            />
            <label htmlFor="base-data-file" className="file-input-label">
              Click to select base data file
            </label>
          </div>
          {baseDataFile && (
            <div className="file-list">
              <div className="file-item">
                <span>{baseDataFile.name}</span>
              </div>
            </div>
          )}
        </div>

        <button type="submit" className="submit-button" disabled={isLoading}>
          {isLoading ? 'Generating CVs...' : 'Generate CVs'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {isLoading && <div className="loading">Generating CVs with AI...</div>}

      {memoizedGeneratedCVs.length > 0 && (
        <div className="results">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>Generated CVs</h3>
            <button
              onClick={rankAllGeneratedCVs}
              className="rank-generated-btn"
            >
              Rank Generated CVs
            </button>
          </div>
          <div className="generated-cvs-container">
            {memoizedGeneratedCVs.map((cv, index) => (
              <div key={`${cv.title}-${index}`} className="result-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3>{cv.title}</h3>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => downloadCV(cv.content, cv.title, 'txt')}
                      className="submit-button"
                      style={{ margin: 0, padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#6c757d' }}
                    >
                      TXT
                    </button>
                    <button
                      onClick={() => downloadCV(cv.content, cv.title, 'word')}
                      className="submit-button"
                      style={{ margin: 0, padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#007bff' }}
                    >
                      Word
                    </button>
                    <button
                      onClick={() => downloadCV(cv.content, cv.title, 'pdf')}
                      className="submit-button"
                      style={{ margin: 0, padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#dc3545' }}
                    >
                      PDF
                    </button>
                  </div>
                </div>
                <div 
                  className="generated-cv"
                  dangerouslySetInnerHTML={{ __html: formatCVContent(cv.content) }}
                />
                <button
                  onClick={() => rankSingleCV(index)}
                  className="rank-cv-btn"
                  disabled={cv.isRanking}
                >
                  {cv.isRanking ? 'Ranking...' : 'Rank CV'}
                </button>
                
                {cv.isRanking && (
                  <div className="ranking-progress">
                    Analyzing CV with AI...
                  </div>
                )}
                
                {cv.rankingResult && (
                  <div className="ranking-result-mini">
                    <h4>Ranking Result</h4>
                    <div 
                      className="score" 
                      style={{ color: getScoreColor(cv.rankingResult.score) }}
                    >
                      {cv.rankingResult.score}/100
                    </div>
                    <p><strong>Analysis:</strong> {cv.rankingResult.explanation}</p>
                    
                    {cv.rankingResult.advantages.length > 0 && (
                      <div className="advantages">
                        <h5>Advantages</h5>
                        <ul>
                          {cv.rankingResult.advantages.map((advantage, idx) => (
                            <li key={idx}>{advantage}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {cv.rankingResult.disadvantages.length > 0 && (
                      <div className="disadvantages">
                        <h5>Areas for Improvement</h5>
                        <ul>
                          {cv.rankingResult.disadvantages.map((disadvantage, idx) => (
                            <li key={idx}>{disadvantage}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CVGeneration;