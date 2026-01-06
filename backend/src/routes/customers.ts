import { Router } from 'express'
import {
    deleteCustomer,
    getCustomerById,
    getCustomers,
    updateCustomer,
} from '../controllers/customers'
import { roleGuardMiddleware } from '../middlewares/auth'
import { Role } from '../models/user'

const customerRouter = Router()

customerRouter.get('/', roleGuardMiddleware(Role.Admin), getCustomers)
customerRouter.get('/:id', roleGuardMiddleware(Role.Admin), getCustomerById)
customerRouter.patch(
    '/:id',
    roleGuardMiddleware(Role.Admin),
    updateCustomer
)
customerRouter.delete(
    '/:id',
    roleGuardMiddleware(Role.Admin),
    deleteCustomer
)

export default customerRouter
