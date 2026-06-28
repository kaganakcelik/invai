import express from 'express';
import cors from 'cors';
import { config } from './config';
import { migrate } from './db/migrate';

import authRouter from './routes/auth';
import locationsRouter from './routes/locations';
import vendorsRouter from './routes/vendors';
import invoicesRouter from './routes/invoices';
import uploadRouter from './routes/upload';
import flagsRouter from './routes/flags';
import filesRouter from './routes/files';

migrate();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/flags', flagsRouter);
app.use('/api/files', filesRouter);

app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
});
