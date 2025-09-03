// Login API Backend Server
// Dependencies: express, bcryptjs, jsonwebtoken, joi, helmet, cors, morgan, express-rate-limit
// Run with: node server.js

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'],
    credentials: true
}));

// Rate limiting
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: {
        error: 'Too many login attempts, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// General rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(generalLimiter);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mock User Database (In production, use a real database)
class UserDatabase {
    constructor() {
        this.users = new Map();
        this.initializeUsers();
    }

    async initializeUsers() {
        // Pre-hash passwords for mock users
        const users = [
            {
                id: '1',
                email: 'demo@example.com',
                password: 'demo123',
                name: 'Demo User',
                role: 'user',
                createdAt: new Date('2024-01-01'),
                lastLogin: null,
                isActive: true
            },
            {
                id: '2',
                email: 'admin@test.com',
                password: 'admin123',
                name: 'Admin User',
                role: 'admin',
                createdAt: new Date('2024-01-01'),
                lastLogin: null,
                isActive: true
            },
            {
                id: '3',
                email: 'john.doe@company.com',
                password: 'password123',
                name: 'John Doe',
                role: 'user',
                createdAt: new Date('2024-02-01'),
                lastLogin: null,
                isActive: true
            },
            {
                id: '4',
                email: 'jane.smith@company.com',
                password: 'securepass456',
                name: 'Jane Smith',
                role: 'manager',
                createdAt: new Date('2024-02-15'),
                lastLogin: null,
                isActive: false // Inactive user for testing
            }
        ];

        // Hash passwords and store users
        for (const user of users) {
            const hashedPassword = await bcrypt.hash(user.password, 12);
            this.users.set(user.email.toLowerCase(), {
                ...user,
                password: hashedPassword
            });
        }

        console.log('✅ Mock database initialized with', this.users.size, 'users');
    }

    async findByEmail(email) {
        return this.users.get(email.toLowerCase()) || null;
    }

    async updateLastLogin(email) {
        const user = this.users.get(email.toLowerCase());
        if (user) {
            user.lastLogin = new Date();
            this.users.set(email.toLowerCase(), user);
        }
    }

    // Helper method to get all users (for debugging)
    getAllUsers() {
        return Array.from(this.users.values()).map(user => ({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin
        }));
    }
}

// Initialize database
const userDB = new UserDatabase();

// Validation Schemas
const loginSchema = Joi.object({
    email: Joi.string()
        .email({ minDomainSegments: 2 })
        .required()
        .max(255)
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required',
            'string.max': 'Email must be less than 255 characters'
        }),
    password: Joi.string()
        .min(6)
        .max(128)
        .required()
        .messages({
            'string.min': 'Password must be at least 6 characters long',
            'string.max': 'Password must be less than 128 characters',
            'any.required': 'Password is required'
        })
});

// Utility Functions
const generateJWT = (user) => {
    const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        iat: Math.floor(Date.now() / 1000)
    };

    return jwt.sign(payload, JWT_SECRET, { 
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'login-api',
        audience: 'client-app'
    });
};

const sanitizeUser = (user) => {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
};

// Error Handler Middleware
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            message: err.message,
            code: 'VALIDATION_ERROR'
        });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            error: 'Invalid token',
            code: 'INVALID_TOKEN'
        });
    }

    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        code: 'INTERNAL_ERROR'
    });
};

// Routes

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Get all users (for debugging - remove in production)
app.get('/api/users', (req, res) => {
    res.json({
        success: true,
        users: userDB.getAllUsers(),
        total: userDB.getAllUsers().length
    });
});


// Login Endpoint
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        console.log('🔐 Login attempt for:', req.body.email);

        // Validate request body
        const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
        
        if (error) {
            const errorMessages = error.details.map(detail => detail.message);
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                message: errorMessages[0],
                details: errorMessages,
                code: 'VALIDATION_ERROR'
            });
        }

        const { email, password } = value;

        // Find user by email
        const user = await userDB.findByEmail(email);
        
        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
                message: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
            });
        }

        // Check if user is active
        if (!user.isActive) {
            console.log('❌ User account disabled:', email);
            return res.status(401).json({
                success: false,
                error: 'Account disabled',
                message: 'Your account has been disabled. Please contact support.',
                code: 'ACCOUNT_DISABLED'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            console.log('❌ Invalid password for:', email);
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials',
                message: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
            });
        }

        // Update last login time
        await userDB.updateLastLogin(email);

        // Generate JWT token
        const token = generateJWT(user);

        console.log('✅ Login successful for:', email);

        // Return success response
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: sanitizeUser(user),
                expiresIn: JWT_EXPIRES_IN
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'An unexpected error occurred during login',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Token Verification Endpoint (Bonus)
app.post('/api/auth/verify', (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token required',
                code: 'TOKEN_REQUIRED'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        res.json({
            success: true,
            message: 'Token is valid',
            data: {
                user: {
                    id: decoded.id,
                    email: decoded.email,
                    name: decoded.name,
                    role: decoded.role
                },
                issuedAt: new Date(decoded.iat * 1000),
                expiresAt: new Date(decoded.exp * 1000)
            }
        });

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
                code: 'TOKEN_EXPIRED'
            });
        }

        res.status(401).json({
            success: false,
            error: 'Invalid token',
            code: 'INVALID_TOKEN'
        });
    }
});

// Logout Endpoint (Token Blacklist - Basic Implementation)
app.post('/api/auth/logout', (req, res) => {
    // In a real application, you'd blacklist the token
    // For now, just return success
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Root route - returns success true
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Welcome to the Login API Server!'
    });
});

// 404 Handler - Fixed for newer Express versions
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        message: `The endpoint ${req.originalUrl} does not exist`,
        code: 'NOT_FOUND'
    });
});

// Error Handler
app.use(errorHandler);

// Start Server
const server = app.listen(PORT, () => {
    console.log('\n🚀 Login API Server Started');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📍 Server URL: http://localhost:${PORT}`);
    console.log(`🔐 Login endpoint: POST /api/auth/login`);
    console.log(`🩺 Health check: GET /health`);
    console.log(`👥 Users endpoint: GET /api/users`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📧 Test Credentials:');
    console.log('   demo@example.com / demo123');
    console.log('   admin@test.com / admin123');
    console.log('   john.doe@company.com / password123');
    console.log('   jane.smith@company.com / securepass456 (inactive)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

module.exports = app;