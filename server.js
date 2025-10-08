require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve React build files
app.use(express.static(path.join(__dirname, 'client/build')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'));
    }
  }
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
});

// Helper function to extract text from different file types
async function extractTextFromFile(filePath, mimetype) {
  try {
    if (mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } else if (mimetype === 'text/plain') {
      return fs.readFileSync(filePath, 'utf8');
    } else {
      throw new Error('Unsupported file type');
    }
  } catch (error) {
    console.error('Error extracting text:', error);
    throw error;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Mode 1: CV Ranking
app.post('/api/rank-cvs', upload.fields([
  { name: 'cvs', maxCount: 10 },
  { name: 'jobDescription', maxCount: 1 }
]), async (req, res) => {
  try {
    const { cvs, jobDescription } = req.files;
    
    if (!cvs || cvs.length === 0) {
      return res.status(400).json({ error: 'No CV files uploaded' });
    }
    
    if (!jobDescription || jobDescription.length === 0) {
      return res.status(400).json({ error: 'No job description uploaded' });
    }

    // Extract text from job description
    const jobDescText = await extractTextFromFile(
      jobDescription[0].path, 
      jobDescription[0].mimetype
    );

    // Extract text from all CVs
    const cvTexts = [];
    for (const cv of cvs) {
      const text = await extractTextFromFile(cv.path, cv.mimetype);
      cvTexts.push({
        filename: cv.originalname,
        text: text
      });
    }

    // Prepare prompt for OpenAI
    const prompt = `You are an expert HR recruiter. Please analyze the following CVs against the job description and provide a ranking from 1-100 for each CV, along with detailed explanations, advantages, and disadvantages.

Job Description:
${jobDescText}

CVs to analyze:
${cvTexts.map((cv, index) => `CV ${index + 1} (${cv.filename}):\n${cv.text}\n---`).join('\n')}

Please provide your analysis in the following JSON format:
{
  "rankings": [
    {
      "filename": "cv1.pdf",
      "candidateName": "John Doe",
      "phone": "+1-555-123-4567",
      "email": "john.doe@email.com",
      "score": 85,
      "explanation": "Strong technical skills match...",
      "advantages": ["Relevant experience in...", "Strong educational background..."],
      "disadvantages": ["Lacks experience in...", "Could improve..."]
    }
  ]
}

IMPORTANT: Extract the candidate's full name, phone number, and email address from each CV. If any information is not available, use "Not provided" for that field.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    });

    const response = completion.choices[0].message.content;
    
    // Clean the response to remove control characters
    const cleanedResponse = response.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Clean up uploaded files
    [...cvs, ...jobDescription].forEach(file => {
      fs.unlinkSync(file.path);
    });

    try {
      const parsedData = JSON.parse(cleanedResponse);
      res.json({ 
        success: true, 
        data: parsedData 
      });
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Response content:', cleanedResponse);
      
      // Fallback: create a structured response from the raw text
      const fallbackData = {
        rankings: [{
          filename: "Error parsing AI response",
          score: 0,
          explanation: "There was an error parsing the AI response. Please try again.",
          advantages: [],
          disadvantages: []
        }]
      };
      
      res.json({ 
        success: true, 
        data: fallbackData 
      });
    }

  } catch (error) {
    console.error('Error in CV ranking:', error);
    res.status(500).json({ error: 'Failed to rank CVs: ' + error.message });
  }
});

// Mode 2: CV Generation
app.post('/api/generate-cvs', upload.single('baseData'), async (req, res) => {
  try {
    const { jobDescription, numberOfCVs, additionalData } = req.body;
    
    if (!jobDescription) {
      return res.status(400).json({ error: 'Job description is required' });
    }
    
    const numCVs = parseInt(numberOfCVs);
    if (!numCVs || numCVs < 1) {
      return res.status(400).json({ error: 'Number of CVs must be a positive integer' });
    }

    let baseDataText = additionalData || '';
    
    // If a file was uploaded, extract text from it
    if (req.file) {
      baseDataText = await extractTextFromFile(req.file.path, req.file.mimetype);
      fs.unlinkSync(req.file.path); // Clean up
    }

    const prompt = `You are an expert CV writer. Generate exactly ${numCVs} different CVs that would be strong matches for the following job description. Use the provided base data as a foundation for personal information and experience.

Job Description:
${jobDescription}

Base Data (use as foundation):
${baseDataText}

IMPORTANT: Generate exactly ${numCVs} different CVs, each with unique strengths and approaches. Each CV should be completely different from the others.

Format each CV as a structured document with clear sections and proper formatting:

# [CANDIDATE NAME]
## Personal Information
- Email: [email]
- Phone: [phone]
- Location: [location]
- LinkedIn: [linkedin]

## Professional Summary
[2-3 sentences highlighting key strengths and experience relevant to the job]

## Work Experience
### [Job Title] at [Company] | [Dates]
- [Achievement 1 with metrics]
- [Achievement 2 with metrics]
- [Achievement 3 with metrics]

### [Previous Job Title] at [Company] | [Dates]
- [Achievement 1 with metrics]
- [Achievement 2 with metrics]

## Education
### [Degree] in [Field] | [University] | [Year]
- [Relevant coursework or achievements]

## Skills
**Technical Skills:** [List relevant technical skills]
**Soft Skills:** [List relevant soft skills]
**Certifications:** [List relevant certifications]

## Additional Information
- [Any other relevant information]

Return the response in the following JSON format with exactly ${numCVs} CVs:
{
  "cvs": [
    {
      "title": "CV 1 - [Unique Focus/Approach]",
      "content": "Full CV content with proper formatting as shown above..."
    },
    {
      "title": "CV 2 - [Different Focus/Approach]",
      "content": "Full CV content with proper formatting as shown above..."
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    });

    const response = completion.choices[0].message.content;
    
    // Clean the response to remove control characters
    const cleanedResponse = response.replace(/[\x00-\x1F\x7F]/g, '');
    
    try {
      const parsedData = JSON.parse(cleanedResponse);
      res.json({ 
        success: true, 
        data: parsedData 
      });
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Response content:', cleanedResponse);
      
      // Fallback: create a structured response from the raw text
      const fallbackData = {
        cvs: [{
          title: "Generated CV",
          content: cleanedResponse
        }]
      };
      
      res.json({ 
        success: true, 
        data: fallbackData 
      });
    }

  } catch (error) {
    console.error('Error in CV generation:', error);
    res.status(500).json({ error: 'Failed to generate CVs: ' + error.message });
  }
});

// Download endpoints
app.post('/api/download-word', async (req, res) => {
  try {
    const { content, title } = req.body;
    
    // Create Word document
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: title,
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            text: content.replace(/\n/g, '\n\n'),
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error generating Word document:', error);
    res.status(500).json({ error: 'Failed to generate Word document' });
  }
});

app.post('/api/download-pdf', async (req, res) => {
  try {
    const { content, title } = req.body;
    
    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 {
            font-size: 28px;
            margin-top: 0;
            text-align: center;
            color: #1a252f;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-weight: 600;
          }
          h2 {
            font-size: 20px;
            color: #2c3e50;
            margin-top: 25px;
            margin-bottom: 15px;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 2px solid #3498db;
            padding-bottom: 5px;
            font-weight: 600;
          }
          h3 {
            font-size: 16px;
            color: #34495e;
            margin-top: 20px;
            margin-bottom: 10px;
            font-weight: 600;
          }
          ul, ol { 
            margin: 10px 0; 
            padding-left: 25px; 
          }
          li { 
            margin: 5px 0; 
          }
          strong { 
            color: #2c3e50; 
            font-weight: 600; 
          }
          .section {
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          @media print {
            body { margin: 0; padding: 15px; }
            h1, h2, h3 { page-break-after: avoid; }
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div>${content.replace(/\n/g, '<br>')}</div>
      </body>
      </html>
    `;

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(htmlContent);
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });
    
    await browser.close();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Make sure to set your OPENAI_API_KEY environment variable');
});
