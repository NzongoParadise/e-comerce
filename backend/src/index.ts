import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { jwtAuth } from './authMiddleware';
import categoryRouter from './routes/categories';
import brandRouter from './routes/brands';
import productRouter from './routes/products';
import authRouter from './routes/auth';
import orderRouter from './routes/orders';
import usersRouter from './routes/users';
import quotesRouter from './routes/quotes';
import returnsRouter from './routes/returns';
import paymentsRouter, { handleMulticaixaWebhook, handleStripeWebhook } from './routes/payments';
import checkoutRouter from './routes/checkout';
import newsletterRouter from './routes/newsletter';
import locationRouter from './routes/location';
import testimonialRouter from './routes/testimonials';
import recommendationsRouter from './routes/recommendations';
import accountCommerceRouter from './routes/accountCommerce';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), handleMulticaixaWebhook);
app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/orders', jwtAuth, orderRouter);
app.use('/api/payments', jwtAuth, paymentsRouter);
app.use('/api/checkout', jwtAuth, checkoutRouter);
app.use('/api/users', jwtAuth, usersRouter);
app.use('/api/quotes', jwtAuth, quotesRouter);
app.use('/api/returns', jwtAuth, returnsRouter);
app.use('/api/account', jwtAuth, accountCommerceRouter);

// Register API routes (protected)
app.use('/api/categories', categoryRouter);
app.use('/api/brands', brandRouter);
app.use('/api/products', productRouter);
app.use('/api/newsletter', newsletterRouter);
app.use('/api/location', locationRouter);
app.use('/api/testimonials', testimonialRouter);
app.use('/api/recommendations', recommendationsRouter);

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'TechGlobal API is running' });
});

// Vercel uses the exported Express app as a serverless function.
// Only start a local listener outside Vercel.
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

export default app;
