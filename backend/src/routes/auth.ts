import { Router } from 'express'
import auth from '../middlewares/auth'
import {
    getCurrentUser,
    getCurrentUserRoles,
    login,
    logout,
    refreshAccessToken,
    register,
    updateCurrentUser,
} from '../controllers/auth'
import { csrfProtection } from '../middlewares/csrf'

const router = Router()

router.post('/login', login)
router.post('/register', register)

router.get('/csrf', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() })
})

router.get('/user', auth, getCurrentUser)

router.get('/logout', auth, logout)
router.get('/token', refreshAccessToken)

router.patch('/user', auth, csrfProtection, updateCurrentUser)

router.get('/roles', auth, getCurrentUserRoles)

export default router
