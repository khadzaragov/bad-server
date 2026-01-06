import { NextFunction, Request, Response } from 'express'
import { FilterQuery } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import User, { IUser } from '../models/user'
import escapeRegExp from '../utils/escapeRegExp'

const MAX_PAGE_SIZE = 10
const DEFAULT_PAGE_SIZE = 10
const CUSTOMER_SORT_FIELDS = new Set([
    'createdAt',
    'totalAmount',
    'orderCount',
    'lastOrderDate',
    'name',
])
const CUSTOMER_SORT_ORDERS = new Set(['asc', 'desc'])

const parseNumberParam = (value: unknown, fallback: number) => {
    if (value === undefined) {
        return fallback
    }
    if (typeof value !== 'string') {
        return null
    }
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
        return fallback
    }
    return parsed
}

// TODO: Добавить guard admin
// eslint-disable-next-line max-len
// Get GET /customers?page=2&limit=5&sort=totalAmount&order=desc&registrationDateFrom=2023-01-01&registrationDateTo=2023-12-31&lastOrderDateFrom=2023-01-01&lastOrderDateTo=2023-12-31&totalAmountFrom=100&totalAmountTo=1000&orderCountFrom=1&orderCountTo=10
export const getCustomers = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            page,
            limit,
            sortField,
            sortOrder,
            registrationDateFrom,
            registrationDateTo,
            lastOrderDateFrom,
            lastOrderDateTo,
            totalAmountFrom,
            totalAmountTo,
            orderCountFrom,
            orderCountTo,
            search,
        } = req.query

        if (page !== undefined && typeof page !== 'string') {
            return next(new BadRequestError('Invalid page'))
        }
        if (limit !== undefined && typeof limit !== 'string') {
            return next(new BadRequestError('Invalid limit'))
        }
        if (sortField !== undefined && typeof sortField !== 'string') {
            return next(new BadRequestError('Invalid sortField'))
        }
        if (sortOrder !== undefined && typeof sortOrder !== 'string') {
            return next(new BadRequestError('Invalid sortOrder'))
        }
        if (
            registrationDateFrom !== undefined &&
            typeof registrationDateFrom !== 'string'
        ) {
            return next(new BadRequestError('Invalid registrationDateFrom'))
        }
        if (
            registrationDateTo !== undefined &&
            typeof registrationDateTo !== 'string'
        ) {
            return next(new BadRequestError('Invalid registrationDateTo'))
        }
        if (
            lastOrderDateFrom !== undefined &&
            typeof lastOrderDateFrom !== 'string'
        ) {
            return next(new BadRequestError('Invalid lastOrderDateFrom'))
        }
        if (
            lastOrderDateTo !== undefined &&
            typeof lastOrderDateTo !== 'string'
        ) {
            return next(new BadRequestError('Invalid lastOrderDateTo'))
        }
        if (
            totalAmountFrom !== undefined &&
            typeof totalAmountFrom !== 'string'
        ) {
            return next(new BadRequestError('Invalid totalAmountFrom'))
        }
        if (
            totalAmountTo !== undefined &&
            typeof totalAmountTo !== 'string'
        ) {
            return next(new BadRequestError('Invalid totalAmountTo'))
        }
        if (
            orderCountFrom !== undefined &&
            typeof orderCountFrom !== 'string'
        ) {
            return next(new BadRequestError('Invalid orderCountFrom'))
        }
        if (
            orderCountTo !== undefined &&
            typeof orderCountTo !== 'string'
        ) {
            return next(new BadRequestError('Invalid orderCountTo'))
        }
        if (search !== undefined && typeof search !== 'string') {
            return next(new BadRequestError('Invalid search'))
        }

        const rawPage = parseNumberParam(page, 1)
        if (rawPage === null) {
            return next(new BadRequestError('Invalid page'))
        }
        const rawLimit = parseNumberParam(limit, DEFAULT_PAGE_SIZE)
        if (rawLimit === null) {
            return next(new BadRequestError('Invalid limit'))
        }
        const normalizedPage = Math.max(1, Math.floor(rawPage))
        const normalizedLimit = Math.min(
            MAX_PAGE_SIZE,
            Math.max(1, Math.floor(rawLimit))
        )

        const normalizedSortField = sortField || 'createdAt'
        const normalizedSortOrder = sortOrder || 'desc'

        if (!CUSTOMER_SORT_FIELDS.has(normalizedSortField)) {
            return next(new BadRequestError('Invalid sortField'))
        }
        if (!CUSTOMER_SORT_ORDERS.has(normalizedSortOrder)) {
            return next(new BadRequestError('Invalid sortOrder'))
        }

        const filters: FilterQuery<Partial<IUser>> = {}

        if (registrationDateFrom) {
            filters.createdAt = {
                ...filters.createdAt,
                $gte: new Date(registrationDateFrom as string),
            }
        }

        if (registrationDateTo) {
            const endOfDay = new Date(registrationDateTo as string)
            endOfDay.setHours(23, 59, 59, 999)
            filters.createdAt = {
                ...filters.createdAt,
                $lte: endOfDay,
            }
        }

        if (lastOrderDateFrom) {
            filters.lastOrderDate = {
                ...filters.lastOrderDate,
                $gte: new Date(lastOrderDateFrom as string),
            }
        }

        if (lastOrderDateTo) {
            const endOfDay = new Date(lastOrderDateTo as string)
            endOfDay.setHours(23, 59, 59, 999)
            filters.lastOrderDate = {
                ...filters.lastOrderDate,
                $lte: endOfDay,
            }
        }

        if (totalAmountFrom) {
            filters.totalAmount = {
                ...filters.totalAmount,
                $gte: Number(totalAmountFrom),
            }
        }

        if (totalAmountTo) {
            filters.totalAmount = {
                ...filters.totalAmount,
                $lte: Number(totalAmountTo),
            }
        }

        if (orderCountFrom) {
            filters.orderCount = {
                ...filters.orderCount,
                $gte: Number(orderCountFrom),
            }
        }

        if (orderCountTo) {
            filters.orderCount = {
                ...filters.orderCount,
                $lte: Number(orderCountTo),
            }
        }

        if (search) {
            const rawSearch = search.trim()

            if (rawSearch.length > 50) {
                return res
                    .status(400)
                    .json({ message: 'Search query is too long' })
            }

            const safeSearch = escapeRegExp(rawSearch)
            const searchRegex = new RegExp(safeSearch, 'i')

            filters.$or = [
                { name: searchRegex },
                { email: searchRegex },
                { phone: searchRegex },
            ]
        }

        const sort: { [key: string]: any } = {}

        sort[normalizedSortField] =
            normalizedSortOrder === 'desc' ? -1 : 1

        const options = {
            sort,
            skip: (normalizedPage - 1) * normalizedLimit,
            limit: normalizedLimit,
        }

        const [users, totalUsers] = await Promise.all([
            User.find(filters, null, options)
                .select('-orders -tokens -password -roles')
                .lean()
                .maxTimeMS(2000),
            User.countDocuments(filters).maxTimeMS(2000),
        ])
        const totalPages = Math.ceil(totalUsers / normalizedLimit)

        res.status(200).json({
            customers: users,
            pagination: {
                totalUsers,
                totalPages,
                currentPage: normalizedPage,
                pageSize: normalizedLimit,
            },
        })
    } catch (error) {
        next(error)
    }
}

// TODO: Добавить guard admin
// Get /customers/:id
export const getCustomerById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const user = await User.findById(req.params.id).populate([
            'orders',
            'lastOrder',
        ])
        res.status(200).json(user)
    } catch (error) {
        next(error)
    }
}

// TODO: Добавить guard admin
// Patch /customers/:id
export const updateCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Whitelist разрешённых к обновлению полей
        const allowedFields = [
            'name',
            'email',
            'phone',
            'deliveryAddress',
        ] as const

        const updateData = Object.fromEntries(
            Object.entries(req.body).filter(([key]) =>
                allowedFields.includes(key as any)
            )
        )

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            {
                new: true,
                runValidators: true,
            }
        )
            .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )
            .populate(['orders', 'lastOrder'])

        res.status(200).json(updatedUser)
    } catch (error) {
        next(error)
    }
}

// TODO: Добавить guard admin
// Delete /customers/:id
export const deleteCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id).orFail(
            () =>
                new NotFoundError(
                    'Пользователь по заданному id отсутствует в базе'
                )
        )
        res.status(200).json(deletedUser)
    } catch (error) {
        next(error)
    }
}
