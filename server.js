import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import seatsRouter from './routes/seats.js';
import checkoutRouter from './routes/checkout.js';
import testRouter from './routes/test.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// CORS configuration for production
const corsOptions = {
    origin: [
        'https://www.fashionweektelaviv.com',
        'https://fashionweektelaviv.com',
        'https://production-test--tlvfw.netlify.app', // Test domain
        'http://localhost:3000' // For development
    ],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Register routes BEFORE starting the server
app.use('/api/seats', seatsRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/test', testRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Fashion Show Ticket backend running on port ${PORT}`);
});

export default app; 