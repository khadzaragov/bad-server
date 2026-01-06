import crypto from 'crypto'
import { NextFunction, Request, Response } from 'express'
import { REFRESH_TOKEN } from '../config'
import ForbiddenError from '../errors/forbidden-error'

const CSRF_COOKIE_NAME = 'csrfToken'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export const issueCsrfToken = (_req: Request, res: Response) => {
    const token = crypto.randomBytes(32).toString('hex')
    res.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
    })
    res.json({ csrfToken: token })
}

export const csrfProtection = (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    if (SAFE_METHODS.has(req.method)) {
        return next()
    }

    const authHeader = req.header('authorization')
    if (authHeader?.startsWith('Bearer ')) {
        return next()
    }

    const refreshToken = req.cookies?.[REFRESH_TOKEN.cookie.name]
    if (!refreshToken) {
        return next()
    }

    const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME]
    const csrfHeader =
        req.header('x-csrf-token') || req.header('x-xsrf-token')

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return next(new ForbiddenError('Invalid CSRF token'))
    }

    return next()
}
