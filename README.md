# CV Rank Generator

A web application for AI-powered CV ranking and generation using ChatGPT Plus.

## Features

### Mode 1: CV Ranking
- Upload multiple CV files (PDF, DOC, DOCX, TXT)
- Upload a job description file
- Get AI-powered rankings (1-100) for each CV
- Receive detailed analysis, advantages, and areas for improvement

### Mode 2: CV Generation
- Enter a job description
- Specify number of CVs to generate (1-10)
- Optionally provide base data (personal info, experience, etc.)
- Generate multiple tailored CVs using AI

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- OpenAI API key (ChatGPT Plus subscription)

### Installation

1. **Install dependencies:**
   ```bash
   npm run install-all
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Build the React client:**
   ```bash
   npm run build
   ```

4. **Start the application:**
   ```bash
   npm start
   ```

   Or for development (with hot reload):
   ```bash
   npm run dev
   ```

### Development Mode

For development with hot reload:
- Backend runs on `http://localhost:3001`
- React frontend runs on `http://localhost:3000`
- The React app proxies API calls to the backend

### Production Mode

- Everything runs on `http://localhost:3001`
- React build files are served by Express

## API Endpoints

- `POST /api/rank-cvs` - Rank CVs against job description
- `POST /api/generate-cvs` - Generate CVs based on job description

## File Support

- **CV Files:** PDF, DOC, DOCX, TXT
- **Job Description:** PDF, DOC, DOCX, TXT
- **Base Data:** PDF, DOC, DOCX, TXT

## Technology Stack

- **Backend:** Node.js, Express.js
- **Frontend:** React, TypeScript
- **AI:** OpenAI GPT-4
- **File Processing:** pdf-parse, mammoth
- **Styling:** CSS3

## Usage

1. **CV Ranking:**
   - Select "CV Ranking" mode
   - Upload CV files and job description
   - Click "Rank CVs" to get AI analysis

2. **CV Generation:**
   - Select "CV Generation" mode
   - Enter job description and number of CVs
   - Optionally provide base data
   - Click "Generate CVs" to create tailored CVs

## Notes

- Make sure your OpenAI API key has sufficient credits
- Large files may take longer to process
- Generated CVs can be downloaded as text files
