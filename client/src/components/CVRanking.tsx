import React, { useState } from 'react';
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

interface RankingResponse {
  success: boolean;
  data: {
    rankings: RankingResult[];
  };
}

interface CVRankingProps {
  generatedCVs: any[];
  jobDescription: string;
  onGeneratedCVsChange: (cvs: any[]) => void;
  onJobDescriptionChange: (desc: string) => void;
  shouldAutoRank?: boolean;
  onAutoRankComplete?: () => void;
}

const CVRanking: React.FC<CVRankingProps> = ({
  generatedCVs: propGeneratedCVs,
  jobDescription: propJobDescription,
  onGeneratedCVsChange,
  onJobDescriptionChange,
  shouldAutoRank = false,
  onAutoRankComplete
}) => {
  const [cvFiles, setCvFiles] = useState<File[]>([]);
  const [jobDescriptionFile, setJobDescriptionFile] = useState<File | null>(null);
  const [jobDescriptionText, setJobDescriptionText] = useState(propJobDescription);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<RankingResult[]>([]);
  const [error, setError] = useState<string>('');

  // Auto-rank generated CVs when shouldAutoRank is true
  React.useEffect(() => {
    if (shouldAutoRank && propGeneratedCVs.length > 0 && propJobDescription.trim()) {
      // Copy job description to text area
      setJobDescriptionText(propJobDescription);
      handleAutoRank();
    }
  }, [shouldAutoRank, propGeneratedCVs, propJobDescription]);

  const handleAutoRank = async () => {
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

      const response = await axios.post<RankingResponse>('/api/rank-cvs', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setResults(response.data.data.rankings);
        onAutoRankComplete?.();
      } else {
        setError('Failed to rank generated CVs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while ranking CVs');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setCvFiles([]);
    setJobDescriptionFile(null);
    setJobDescriptionText('');
    setResults([]);
    setError('');
    onJobDescriptionChange('');
  };

  const handleCvFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setCvFiles(prev => [...prev, ...files]);
  };

  const handleJobDescriptionFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setJobDescriptionFile(file);
    if (file) {
      setJobDescriptionText(''); // Clear text when file is selected
    }
  };

  const handleJobDescriptionTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setJobDescriptionText(value);
    onJobDescriptionChange(value);
    if (value.trim()) {
      setJobDescriptionFile(null); // Clear file when text is entered
    }
  };

  const removeCvFile = (index: number) => {
    setCvFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (cvFiles.length === 0) {
      setError('Please upload at least one CV file');
      return;
    }
    
    if (!jobDescriptionFile && !jobDescriptionText.trim()) {
      setError('Please provide a job description either by uploading a file or entering text');
      return;
    }

    setIsLoading(true);
    setError('');
    setResults([]);

    try {
      const formData = new FormData();
      
      cvFiles.forEach(file => {
        formData.append('cvs', file);
      });
      
      if (jobDescriptionFile) {
        formData.append('jobDescription', jobDescriptionFile);
      } else {
        // Create a text file from the text input
        const textBlob = new Blob([jobDescriptionText], { type: 'text/plain' });
        formData.append('jobDescription', textBlob, 'job-description.txt');
      }

      const response = await axios.post<RankingResponse>('/api/rank-cvs', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setResults(response.data.data.rankings);
      } else {
        setError('Failed to rank CVs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while ranking CVs');
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#28a745';
    if (score >= 60) return '#ffc107';
    return '#dc3545';
  };

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
          <label htmlFor="cv-files">Upload CV Files (PDF, DOC, DOCX, TXT)</label>
          <div className="file-input">
            <input
              type="file"
              id="cv-files"
              multiple
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleCvFileChange}
            />
            <label htmlFor="cv-files" className="file-input-label">
              Click to select CV files or drag and drop
            </label>
          </div>
          {cvFiles.length > 0 && (
            <div className="file-list">
              {cvFiles.map((file, index) => (
                <div key={index} className="file-item">
                  <span>{file.name}</span>
                  <button
                    type="button"
                    className="remove-file"
                    onClick={() => removeCvFile(index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="job-description-text">Job Description</label>
          <textarea
            id="job-description-text"
            className="textarea"
            value={jobDescriptionText}
            onChange={handleJobDescriptionTextChange}
            placeholder="Enter job description here or upload a file below..."
            rows={6}
          />
        </div>

        <div className="form-group">
          <label htmlFor="job-description-file">Or Upload Job Description File</label>
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
                <button
                  type="button"
                  className="remove-file"
                  onClick={() => setJobDescriptionFile(null)}
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>

        <button type="submit" className="submit-button" disabled={isLoading}>
          {isLoading ? 'Ranking CVs...' : 'Rank CVs'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}

      {isLoading && <div className="loading">Analyzing CVs with AI...</div>}

      {results.length > 0 && (
        <div className="results">
          <h3>Ranking Results</h3>
          <div className="ranking-results">
            {results
              .sort((a, b) => b.score - a.score)
              .map((result, index) => (
                <div key={index} className="ranking-card">
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
