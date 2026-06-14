// server.js - Complete Backend for CoursePilot
// Resume OCR, Career Analysis, User Management, and Freelancer Management

const express = require('express');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const pdf = require('pdf-parse');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Tesseract = require('tesseract.js');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Hardcoded Gemini API Key - REPLACE WITH YOUR ACTUAL API KEY
const GEMINI_API_KEY = "AIzaSyAYWdOAwBV8flYToKI1JU5u3pZpxIzRw4U";

// ==================== IN-MEMORY DATA STORAGE ====================
// In a production app, use a real database (MongoDB, PostgreSQL, etc)
const users = new Map(); // Store user credentials {email: {name, email, password}}
const freelancers = new Map(); // Store freelancer profiles {id: {name, email, skills, ...}}

// ==================== CORS CONFIGURATION ====================
app.use(cors({
    origin: [
        'http://127.0.0.1:5501',
        'http://localhost:5501',
        'http://127.0.0.1:5500',
        'http://localhost:5500',
        'http://127.0.0.1:3000',
        'http://localhost:3000',
        'http://127.0.0.1:3001',
        'http://localhost:3001'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ==================== MIDDLEWARE ====================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Origin: ${req.get('origin')}`);
    next();
});

// ==================== FILE UPLOAD CONFIGURATION ====================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

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

// ==================== GEMINI AI INITIALIZATION ====================
let genAI;
try {
    if (GEMINI_API_KEY && GEMINI_API_KEY !== "AIzaSyB6gVn-dn3LwOzePtUjKulD8yJ6QewlKDc") {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        console.log('✅ Gemini AI initialized successfully');
    } else {
        console.warn('⚠️ Please update the GEMINI_API_KEY in server.js');
    }
} catch (error) {
    console.error('❌ Error initializing Gemini AI:', error.message);
}

// ==================== UTILITY FUNCTIONS ====================

// Extract text from PDF
async function extractTextFromPDF(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            throw new Error('PDF file not found');
        }

        const dataBuffer = fs.readFileSync(filePath);

        try {
            const data = await pdf(dataBuffer, {
                max: 0,
                version: 'v2.0.550'
            });

            if (data.text && data.text.trim().length > 0) {
                console.log('✅ pdf-parse succeeded');
                return data.text;
            }
        } catch (primaryError) {
            console.warn('⚠️ pdf-parse failed, trying pdfjs-dist fallback:', primaryError.message);
        }

        try {
            const uint8Array = new Uint8Array(dataBuffer);

            const loadingTask = pdfjsLib.getDocument({
                data: uint8Array,
                useWorkerFetch: false,
                isEvalSupported: false,
                useSystemFonts: true,
                stopAtErrors: false,
            });

            const pdfDoc = await loadingTask.promise;
            const numPages = pdfDoc.numPages;
            let fullText = '';

            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                const page = await pdfDoc.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map(item => item.str)
                    .join(' ');
                fullText += pageText + '\n';
            }

            if (fullText.trim().length === 0) {
                throw new Error('No extractable text found in PDF (pdfjs-dist)');
            }

            console.log('✅ pdfjs-dist fallback succeeded');
            return fullText;

        } catch (fallbackError) {
            console.error('❌ pdfjs-dist fallback also failed:', fallbackError.message);
            throw new Error(`PDF processing failed: ${fallbackError.message}`);
        }

    } catch (error) {
        console.error('PDF extraction error:', error);
        throw new Error(`PDF processing failed: ${error.message}`);
    }
}

// Extract text from image using OCR
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

// Get career suggestions from Gemini AI
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
${resumeText.substring(0, 15000)}

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
        return response.text();
    } catch (error) {
        console.error('Gemini AI error:', error);
        throw new Error(`AI analysis failed: ${error.message}`);
    }
}

// ==================== AUTHENTICATION ENDPOINTS ====================

// User Registration (Signup)
app.post('/signup', (req, res) => {
    try {
        const { name, mail, password } = req.body;

        // Validation
        if (!name || !mail || !password) {
            return res.status(400).json({
                success: false,
                msg: 'Please provide name, email, and password'
            });
        }

        // Check if user already exists
        if (users.has(mail)) {
            return res.status(400).json({
                success: false,
                msg: 'User already exists with this email'
            });
        }

        // Store user
        users.set(mail, {
            name: name,
            email: mail,
            password: password,
            createdAt: new Date().toISOString()
        });

        console.log(`✅ New user registered: ${mail}`);
        
        res.status(201).json({
            success: true,
            msg: 'Account created successfully! Please login.',
            statusCode: 201
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            msg: 'Error creating account',
            error: error.message
        });
    }
});

// User Login
app.post('/login', (req, res) => {
    try {
        const { mail, password } = req.body;

        // Validation
        if (!mail || !password) {
            return res.status(400).json({
                success: false,
                msg: 'Please provide email and password'
            });
        }

        // Check if user exists
        const user = users.get(mail);
        if (!user) {
            return res.status(401).json({
                success: false,
                msg: 'User not found. Please signup first.',
                pass: null
            });
        }

        // Check password
        if (user.password !== password) {
            return res.status(401).json({
                success: false,
                msg: 'Incorrect password',
                pass: null
            });
        }

        console.log(`✅ User logged in: ${mail}`);

        res.status(200).json({
            success: true,
            msg: 'Login successful',
            pass: password,
            statusCode: 200
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            msg: 'Error during login',
            error: error.message
        });
    }
});

// ==================== FREELANCER ENDPOINTS ====================

// Freelancer Login
app.post('/flogin', (req, res) => {
    try {
        const { mail, password } = req.body;

        // Validation
        if (!mail || !password) {
            return res.status(400).json({
                success: false,
                msg: 'Please provide email and password'
            });
        }

        // Check if freelancer exists (using same user store for simplicity)
        const freelancer = users.get(mail);
        if (!freelancer) {
            return res.status(401).json({
                success: false,
                msg: 'Freelancer not found. Please signup first.',
                pass: null
            });
        }

        // Check password
        if (freelancer.password !== password) {
            return res.status(401).json({
                success: false,
                msg: 'Incorrect password',
                pass: null
            });
        }

        console.log(`✅ Freelancer logged in: ${mail}`);

        res.status(200).json({
            success: true,
            msg: 'Freelancer login successful',
            pass: password,
            statusCode: 200
        });
    } catch (error) {
        console.error('Freelancer login error:', error);
        res.status(500).json({
            success: false,
            msg: 'Error during freelancer login',
            error: error.message
        });
    }
});

// Save Freelancer Details
app.post('/fdetails', (req, res) => {
    try {
        const {
            name, phnum, field, course, skill, explvl, costr, 
            duration, pace, lang, bio
        } = req.body;

        // Validation
        if (!name || !phnum) {
            return res.status(400).json({
                success: false,
                msg: 'Please provide name and phone number'
            });
        }

        // Generate unique ID for freelancer
        const freelancerId = Date.now().toString();

        // Store freelancer data
        freelancers.set(freelancerId, {
            id: freelancerId,
            name: name,
            phone: phnum,
            field: field,
            course: course,
            skills: skill,
            experienceLevel: explvl,
            costRange: costr,
            duration: duration,
            learningPace: pace,
            language: lang,
            bio: bio,
            registeredAt: new Date().toISOString()
        });

        console.log(`✅ Freelancer details saved: ${freelancerId} - ${name}`);

        res.status(200).json({
            success: true,
            msg: 'Freelancer profile created successfully!',
            statusCode: 200,
            freelancerId: freelancerId
        });
    } catch (error) {
        console.error('Error saving freelancer details:', error);
        res.status(500).json({
            success: false,
            msg: 'Error saving freelancer details',
            error: error.message
        });
    }
});

// ==================== RESUME & CAREER SUGGESTION ENDPOINTS ====================

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
            extractedText: extractedText.substring(0, 2000) + (extractedText.length > 2000 ? '...' : ''),
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

// ==================== TEST ENDPOINTS ====================

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
        service: 'CoursePilot Complete API Server',
        timestamp: new Date().toISOString(),
        geminiConfigured: !!genAI,
        port: PORT,
        endpoints: {
            auth: ['/login', '/signup', '/flogin'],
            freelancer: ['/fdetails'],
            career: ['/career-suggestion', '/process-file'],
            health: ['/health', '/']
        }
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'CoursePilot Complete API Server',
        version: '2.0.0',
        status: 'running',
        port: PORT,
        endpoints: {
            'POST /login': 'User login',
            'POST /signup': 'User registration',
            'POST /flogin': 'Freelancer login',
            'POST /fdetails': 'Save freelancer details',
            'POST /career-suggestion': 'Process resume and get career suggestions (multipart/form-data)',
            'POST /process-file': 'Test endpoint',
            'GET /health': 'Health check'
        }
    });
});

// ==================== ERROR HANDLING ====================

// Handle multer errors
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
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        availableEndpoints: {
            'POST /login': 'User login',
            'POST /signup': 'User registration',
            'POST /flogin': 'Freelancer login',
            'POST /fdetails': 'Save freelancer details',
            'POST /career-suggestion': 'Process resume',
            'GET /health': 'Health check'
        }
    });
});

// ==================== SERVER STARTUP ====================

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 CoursePilot API Server Started Successfully!');
    console.log('='.repeat(60));
    console.log(`📡 Server running on http://localhost:${PORT}`);
    console.log(`🌐 Allowed Origins: 5500, 5501, 3000, 3001`);
    console.log(`📁 Upload directory: ${uploadsDir}`);
    console.log(`💾 In-Memory Data Storage: ${users.size} users, ${freelancers.size} freelancers`);
    
    if (genAI) {
        console.log('✅ Gemini AI initialized with API key');
    } else {
        console.log('⚠️  Gemini AI not configured - Update GEMINI_API_KEY for full features');
    }
    
    console.log('\n📚 Available Endpoints:');
    console.log('   Authentication:');
    console.log('   - POST /signup         : Create new user account');
    console.log('   - POST /login          : User login');
    console.log('   - POST /flogin         : Freelancer login');
    console.log('   Freelancer:');
    console.log('   - POST /fdetails       : Save freelancer profile');
    console.log('   Career:');
    console.log('   - POST /career-suggestion : Process resume & get suggestions');
    console.log('   - POST /process-file   : Test endpoint');
    console.log('   - GET  /health         : Server health check');
    console.log('   - GET  /               : Server info');
    console.log('\n🚀 Ready to accept requests!');
    console.log('='.repeat(60) + '\n');
});

module.exports = app;
