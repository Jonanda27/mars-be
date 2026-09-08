const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Import routes & middlewares
const routes = require('./src/routes');
const cronRoutes = require('./src/routes/cronRoutes');
const errorHandler = require('./src/middlewares/errorHandler');
const { initCronJobs: initContractMonitor } = require('./src/workers/contractMonitor');
const { initCronJobs: initBillingCron } = require('./src/workers/billingCron');
const { initPenaltyCron } = require('./src/workers/penaltyCron');

// Initialize cron jobs
initContractMonitor();
initBillingCron();
initPenaltyCron();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); // Logging middleware

// Use routes
app.use('/api', routes);
app.use('/api/cron', cronRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to MARS Backend API' });
});

// Handle 404
app.use((req, res, next) => {
  const error = new Error('Endpoint Not Found');
  error.statusCode = 404;
  next(error);
});

// Global Error Handler (must be the last middleware)
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Backend server is running on port ${port}`);
});
