const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Load env vars
dotenv.config();

const app = express();

const allowedOrigins = [
    'https://jspcorporation-eedc8.web.app',

    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
].filter(Boolean);

// Middleware
app.use(cors({
    origin: (origin, callback) => {
        // Allow non-browser requests (mobile apps, Postman, curl — no Origin header)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/services', require('./routes/services'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/deliveries', require('./routes/deliveries'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/customer-auth', require('./routes/customerAuth'));
app.use('/api/customer-portal', require('./routes/customerPortal'));
app.use('/api/refunds', require('./routes/refunds'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'CLSPBS API is running', timestamp: new Date() });
});

// Error handler
app.use(errorHandler);

const { initCron } = require('./cron/invoiceReminders');

const PORT = process.env.PORT || 5000;

// Start server only after DB is connected
const startServer = async () => {
    try {
        await connectDB();
        
        app.listen(PORT, () => {
            console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
            initCron();
        });
    } catch (error) {
        console.error('💀 Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();
