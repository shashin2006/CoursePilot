// server.js - Resume OCR & Analysis Backend
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const pdf = require('pdf-parse');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Tesseract = require('tesseract.js');

// Initialize Express app
const app = express();
const PORT = 3001; // Hardcoded port

// Hardcoded Gemini API Key - REPLACE WITH YOUR ACTUAL API KEY
const GEMINI_API_KEY = ""; // ← REPLACE THIS

// CORS configuration specifically for your frontend
app.use(cors({
    origin: [
        'http://127.0.0.1:5501',
        'http://localhost:5501',
        'http://127.0.0.1:5500', 
        'http://localhost:5500'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF and images are allowed.'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Initialize Google Gemini AI with hardcoded API key
let genAI;
try {
    if (GEMINI_API_KEY && GEMINI_API_KEY !== "AIzaSyCxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        console.log('✅ Gemini AI initialized successfully');
    } else {
        console.warn('⚠️ Please update the GEMINI_API_KEY in server.js');
    }
} catch (error) {
    console.error('❌ Error initializing Gemini AI:', error.message);
}

// Utility function to extract text from PDF
async function extractTextFromPDF(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            throw new Error('PDF file not found');
        }

        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        
        if (!data.text || data.text.trim().length === 0) {
            throw new Error('No extractable text found in PDF');
        }
        
        return data.text;
    } catch (error) {
        console.error('PDF extraction error:', error);
        throw new Error(`PDF processing failed: ${error.message}`);
    }
}

// Utility function to extract text from image using OCR
async function extractTextFromImage(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            throw new Error('Image file not found');
        }

        console.log('Starting OCR processing...');
        const result = await Tesseract.recognize(
            filePath,
            'eng',
            { 
                logger: progress => {
                    if (progress.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(progress.progress * 100)}%`);
                    }
                }
            }
        );

        console.log('OCR completed successfully');
        
        if (!result.data.text || result.data.text.trim().length === 0) {
            throw new Error('No text could be extracted from the image');
        }

        return result.data.text;
    } catch (error) {
        console.error('OCR extraction error:', error);
        throw new Error(`OCR processing failed: ${error.message}`);
    }
}

// Function to get career suggestions from Gemini AI
async function getCareerSuggestions(resumeText) {
    if (!genAI) {
        return `
        **Career Analysis & Suggestions**

        **Identified Skills:**
        - Resume parsing completed successfully
        - Skills analysis requires Gemini AI configuration

        **Career Path Recommendations:**
        - Full AI-powered career suggestions available with API key setup
        - Consider roles matching your technical background

        **Skill Gaps & Improvements:**
        - Update the GEMINI_API_KEY in server.js for detailed analysis
        - Focus on in-demand technologies in your field

        **Course Recommendations:**
        - Online platforms: Coursera, Udemy, edX
        - Technical certifications relevant to your field
        - Soft skills development courses

        **Actionable Next Steps:**
        1. Update the API key in server.js for personalized suggestions
        2. Update your LinkedIn profile with current skills
        3. Network with professionals in your target industry
        4. Consider contributing to open-source projects

        *Note: Update the GEMINI_API_KEY variable in server.js for personalized AI-powered career advice.*
        `;
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `
        You are an experienced career counselor and HR specialist. Analyze the following resume text and provide comprehensive career suggestions.

        RESUME TEXT:
        ${resumeText.substring(0, 15000)} // Limit text to avoid token limits

        Please provide your analysis and suggestions in the following format:

        **Career Analysis & Suggestions**

        **Identified Skills:**
        - List the main technical and soft skills found in the resume
        - Rate the proficiency level for each key skill

        **Career Path Recommendations:**
        - Suggest 2-3 ideal career paths based on the skills and experience
        - Include specific job titles that would be a good fit

        **Skill Gaps & Improvements:**
        - Identify any missing skills for the recommended career paths
        - Suggest specific technologies or competencies to learn

        **Course Recommendations:**
        - Recommend 3-5 online courses or certifications to enhance skills
        - Focus on practical, in-demand skills

        **Actionable Next Steps:**
        - Provide 4-5 immediate actions the person can take
        - Include networking suggestions and portfolio improvements

        Keep the response professional, encouraging, and actionable. Focus on practical advice that can be implemented immediately.
        Format the response with clear sections and bullet points for easy reading.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        console.log("✅ Gemini AI generated content successfully");
        console.log("AI Response Preview:", response.text().substring(0, 4000));
        return response.text();
    } catch (error) {
        console.error('Gemini AI error:', error);
        throw new Error(`AI analysis failed: ${error.message}`);
    }
}

// Main endpoint for resume processing and career suggestions
app.post('/career-suggestion', upload.single('resume'), async (req, res) => {
    let filePath = null;
    
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded. Please select a PDF or image file.'
            });
        }

        filePath = req.file.path;
        const fileType = req.file.mimetype;
        let extractedText = '';

        console.log(`Processing file: ${req.file.originalname}, Type: ${fileType}`);
        console.log(`Frontend origin: ${req.get('origin')}`);

        // Extract text based on file type
        if (fileType === 'application/pdf') {
            extractedText = await extractTextFromPDF(filePath);
        } else if (fileType.startsWith('image/')) {
            extractedText = await extractTextFromImage(filePath);
        } else {
            throw new Error('Unsupported file type');
        }

        if (!extractedText || extractedText.trim().length < 50) {
            throw new Error('Insufficient text extracted from the document. Please ensure the file contains readable text.');
        }

        console.log(`Successfully extracted ${extractedText.length} characters from resume`);

        // Get career suggestions from Gemini AI
        const suggestions = await getCareerSuggestions(extractedText);

        // Return successful response
        res.json({
            success: true,
            extractedText: extractedText.substring(0, 2000) + (extractedText.length > 2000 ? '...' : ''), // Limit text for response
            suggestion: suggestions,
            fileType: fileType,
            textLength: extractedText.length
        });

    } catch (error) {
        console.error('Error processing resume:', error);
        
        res.status(500).json({
            success: false,
            error: error.message || 'An unexpected error occurred while processing your resume.'
        });
    } finally {
        // Clean up uploaded file
        if (filePath && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log('Cleaned up temporary file');
            } catch (cleanupError) {
                console.error('Error cleaning up file:', cleanupError);
            }
        }
    }
});

// Simple test endpoint
app.post('/process-file', (req, res) => {
    res.json({
        success: true,
        message: 'Resume processing server is working!',
        timestamp: new Date().toISOString(),
        frontend: 'http://127.0.0.1:5501'
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Resume OCR & Analysis API',
        timestamp: new Date().toISOString(),
        geminiConfigured: !!genAI,
        port: PORT,
        allowedOrigins: ['http://127.0.0.1:5501', 'http://localhost:5501']
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Resume OCR & Analysis API Server',
        frontend: 'http://127.0.0.1:5501',
        endpoints: {
            'POST /career-suggestion': 'Process resume and get career suggestions',
            'POST /process-file': 'Test endpoint',
            'GET /health': 'Health check'
        },
        version: '1.0.0'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large. Please upload a file smaller than 10MB.'
            });
        }
    }
    
    console.error('Server error:', error);
    res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎯 Resume OCR Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving frontend: http://127.0.0.1:5501`);
    console.log(`📁 Upload directory: ${uploadsDir}`);
    
    if (genAI) {
        console.log('✅ Gemini AI initialized with hardcoded API key');
    } else {
        console.log('⚠️  Please update the GEMINI_API_KEY variable in server.js');
        console.log('💡 Replace: "AIzaSyB6gVn-dn3LwOzePtUjKulD8yJ6QewlKDc" with your actual API key');
    }
    
    console.log('\n🚀 Ready to receive requests from your frontend!');
});

module.exports = app;
