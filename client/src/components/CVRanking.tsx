import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';

interface RankingResult {
  filename: string;
  candidateName: string;
  phone: string;
  email: string;
  score: number;
  explanation: string;
  advantages: string[];
  disadvantages: string[];
}

interface CVRankingProps {
  onRankAllGeneratedCVs: () => void;
  generatedCVs: any[];
  jobDescription: string;
  shouldAutoRank: boolean;
  onAutoRankComplete: () => void;
  onJobDescriptionChange: (desc: string) => void;
}

// Simple utility function - no need for useCallback
const getScoreColor = (score: number) => {
  if (score >= 80) return '#28a745';
  if (score >= 60) return '#ffc107';
  return '#dc3545';
};

const CVRanking: React.FC<CVRankingProps> = ({
  onRankAllGeneratedCVs,
  generatedCVs: propGeneratedCVs,
  jobDescription: propJobDescription,
  shouldAutoRank,
  onAutoRankComplete,
  onJobDescriptionChange
}) => {
  const [cvs, setCvs] = useState<File[]>([]);
  const [jobDescriptionFile, setJobDescriptionFile] = useState<File | null>(null);
  const [jobDescriptionText, setJobDescriptionText] = useState(propJobDescription);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<RankingResult[]>([]);
  const [error, setError] = useState<string>('');

  // Memoized sorted results to prevent unnecessary re-sorting
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => b.score - a.score);
  }, [results]);

  const handleAutoRank = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setResults([]);

    try {
      const formData = new FormData();
      
      // Add generated CVs as files
      propGeneratedCVs.forEach((cv, index) => {
        formData.append('cvs', new Blob([cv.content], { type: 'text/plain' }), `cv_${index + 1}.txt`);
      });
      
      // Add job description
      formData.append('jobDescription', new Blob([propJobDescription], { type: 'text/plain' }), 'job.txt');

      const response = await axios.post('/api/rank-cvs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setResults(response.data.data.rankings);
        onAutoRankComplete();
      } else {
        setError('Failed to rank CVs');
      }
    } catch (err) {
      setError('Error ranking CVs: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [propGeneratedCVs, propJobDescription, onAutoRankComplete]);

  // Auto-rank generated CVs when shouldAutoRank is true
  useEffect(() => {
    if (shouldAutoRank && propGeneratedCVs.length > 0 && propJobDescription.trim()) {
      // Copy job description to text area
      setJobDescriptionText(propJobDescription);
      handleAutoRank();
    }
  }, [shouldAutoRank, propGeneratedCVs, propJobDescription, handleAutoRank]);

  const handleCVChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setCvs(files);
  }, []);

  const handleJobDescriptionFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setJobDescriptionFile(file);
    if (file) {
      setJobDescriptionText('');
    }
  }, []);

  const handleJobDescriptionTextChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setJobDescriptionText(value);
    onJobDescriptionChange(value);
    if (value) {
      setJobDescriptionFile(null);
    }
  }, [onJobDescriptionChange]);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (cvs.length === 0) {
      setError('Please select at least one CV file');
      return;
    }
    
    if (!jobDescriptionFile && !jobDescriptionText.trim()) {
      setError('Please provide a job description');
      return;
    }

    setIsLoading(true);
    setError('');
    setResults([]);

    try {
      const formData = new FormData();
      
      // Add CV files
      cvs.forEach(cv => {
        formData.append('cvs', cv);
      });
      
      // Add job description
      if (jobDescriptionFile) {
        formData.append('jobDescription', jobDescriptionFile);
      } else {
        formData.append('jobDescription', new Blob([jobDescriptionText], { type: 'text/plain' }), 'job.txt');
      }

      const response = await axios.post('/api/rank-cvs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setResults(response.data.data.rankings);
      } else {
        setError('Failed to rank CVs');
      }
    } catch (err) {
      setError('Error ranking CVs: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [cvs, jobDescriptionFile, jobDescriptionText]);

  const resetForm = useCallback(() => {
    setCvs([]);
    setJobDescriptionFile(null);
    setJobDescriptionText('');
    setResults([]);
    setError('');
    onJobDescriptionChange('');
  }, [onJobDescriptionChange]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-title">
          <h2>CV Ranking Tool</h2>
          <p>Upload CV files and a job description to get AI-powered rankings and analysis.</p>
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
          <label htmlFor="cvs">CV Files</label>
          <div className="file-input">
            <input
              type="file"
              id="cvs"
              multiple
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleCVChange}
            />
            <label htmlFor="cvs" className="file-input-label">
              Click to select CV files
            </label>
          </div>
          {cvs.length > 0 && (
            <div className="file-list">
              {cvs.map((cv, index) => (
                <div key={index} className="file-item">
                  <span>{cv.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="job-description-file">Job Description File</label>
          <div className="file-input">
            <input
              type="file"
              id="job-description-file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleJobDescriptionFileChange}
            />
            <label htmlFor="job-description-file" className="file-input-label">
              Click to select job description file
            </label>
          </div>
          {jobDescriptionFile && (
            <div className="file-list">
              <div className="file-item">
                <span>{jobDescriptionFile.name}</span>
              </div>
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="job-description-text">Or Enter Job Description as Text</label>
          <textarea
            id="job-description-text"
            className="textarea"
            value={jobDescriptionText}
            onChange={handleJobDescriptionTextChange}
            placeholder="Enter the job description here..."
          />
        </div>

        <button type="submit" className="submit-button" disabled={isLoading}>
          {isLoading ? 'Ranking CVs...' : 'Rank CVs'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {isLoading && <div className="loading">Analyzing CVs with AI...</div>}

      {sortedResults.length > 0 && (
        <div className="results">
          <h3>Ranking Results</h3>
          <div className="ranking-results">
            {sortedResults.map((result, index) => (
              <div key={`${result.filename}-${index}`} className="ranking-card">
                <h3>{result.filename}</h3>
                <div className="candidate-info">
                  <p><strong>Name:</strong> {result.candidateName || 'Not provided'}</p>
                  <p><strong>Phone:</strong> {result.phone || 'Not provided'}</p>
                  <p><strong>Email:</strong> {result.email || 'Not provided'}</p>
                </div>
                <div 
                  className="score" 
                  style={{ color: getScoreColor(result.score) }}
                >
                  {result.score}/100
                </div>
                <p><strong>Analysis:</strong> {result.explanation}</p>
                
                {result.advantages.length > 0 && (
                  <div className="advantages">
                    <h4>Advantages</h4>
                    <ul>
                      {result.advantages.map((advantage, idx) => (
                        <li key={idx}>{advantage}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {result.disadvantages.length > 0 && (
                  <div className="disadvantages">
                    <h4>Areas for Improvement</h4>
                    <ul>
                      {result.disadvantages.map((disadvantage, idx) => (
                        <li key={idx}>{disadvantage}</li>
                      ))}
                    </ul>
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

export default CVRanking;