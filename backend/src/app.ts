import './types/express'
import './types/csurf'
import { errors } from 'celebrate'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import 'dotenv/config'
import express, { json, urlencoded } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import mongoose from 'mongoose'
import path from 'path'
import { DB_ADDRESS } from './config'
import errorHandler from './middlewares/error-handler'
import serveStatic from './middlewares/serverStatic'
import routes from './routes'

const { PORT = 3000 } = process.env
const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use(cookieParser())
app.use(cors())

app.use(
    helmet({
        contentSecurityPolicy: false,
    })
)

app.use(
    rateLimit({
        windowMs: 60 * 1000,
        max: 60,
        standardHeaders: true,
        legacyHeaders: false,
    })
)

app.use(serveStatic(path.join(__dirname, 'public')))
app.use(urlencoded({ extended: true, limit: '10kb' }))
app.use(json({ limit: '10kb' }))

app.options('*', cors())
app.use(routes)
app.use(errors())
app.use(errorHandler)

app.listen(Number(PORT), () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on ${PORT}`)
})

mongoose
    .connect(DB_ADDRESS)
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.error('MongoDB connection error:', err))
