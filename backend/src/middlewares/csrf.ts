import csrf from 'csurf'
import { Request } from 'express'

export const csrfProtection = csrf({
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
    },
    value: (req: Request) => {
        if (!req.headers['x-csrf-token'] && !req.headers['x-xsrf-token']) {
            return ''
        }
        return req.headers['x-csrf-token'] as string
    },
})
