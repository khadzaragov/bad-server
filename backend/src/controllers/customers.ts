import { NextFunction, Request, Response } from 'express'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import Order from '../models/order'
import User from '../models/user'
import escapeRegExp from '../utils/escapeRegExp'
import createSafeRegExp from '../utils/safeRegExp'
import { normalizeLimit } from '../utils/sanitize'

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
            page = 1,
            limit = 10,
            sortField = 'createdAt',
            sortOrder = 'desc',
            search,
            createdAtFrom,
            createdAtTo,
            totalAmountFrom,
            totalAmountTo,
            orderCountFrom,
            orderCountTo,
        } = req.query

        const normalizedLimit = normalizeLimit(limit, 10, 10)

        const filters: any = {}

        if (createdAtFrom || createdAtTo) {
            filters.createdAt = {}
            if (createdAtFrom) {
                filters.createdAt.$gte = new Date(createdAtFrom as string)
            }
            if (createdAtTo) {
                filters.createdAt.$lte = new Date(createdAtTo as string)
            }
        }

        if (totalAmountFrom || totalAmountTo) {
            filters.totalAmount = {}
            if (totalAmountFrom) {
                filters.totalAmount.$gte = Number(totalAmountFrom)
            }
            if (totalAmountTo) {
                filters.totalAmount.$lte = Number(totalAmountTo)
            }
        }

        if (orderCountFrom || orderCountTo) {
            filters.orderCount = {}
            if (orderCountFrom) {
                filters.orderCount.$gte = Number(orderCountFrom)
            }
            if (orderCountTo) {
                filters.orderCount.$lte = Number(orderCountTo)
            }
        }

        if (search) {
            const escapedSearch = escapeRegExp(search as string)
            const searchRegex = createSafeRegExp(escapedSearch, 'i', {
                timeout: 500,
                maxLength: 50,
                alreadyEscaped: true,
            })

            const orders = await Order.find(
                { $or: [{ deliveryAddress: searchRegex }] },
                '_id'
            )
            const orderIds = orders.map((o) => o._id)

            filters.$or = [
                { name: searchRegex },
                { lastOrder: { $in: orderIds } },
            ]
        }

        const allowedSortFields = [
            'createdAt',
            'name',
            'totalAmount',
            'orderCount',
            'lastOrderDate',
        ]
        const sort: any = {}
        if (
            typeof sortField === 'string' &&
            !allowedSortFields.includes(sortField)
        ) {
            return next(new BadRequestError('Недопустимое поле для сортировки'))
        }
        if (sortField && sortOrder) {
            sort[sortField as string] = sortOrder === 'desc' ? -1 : 1
        }

        const options = {
            sort,
            skip: (Number(page) - 1) * normalizedLimit,
            limit: normalizedLimit,
        }

        const users = await User.find(filters, null, options).populate([
            'orders',
            {
                path: 'lastOrder',
                populate: { path: 'products' },
            },
            {
                path: 'lastOrder',
                populate: { path: 'customer' },
            },
        ])

        const totalUsers = await User.countDocuments(filters)
        const totalPages = Math.ceil(totalUsers / normalizedLimit)

        res.status(200).json({
            customers: users,
            pagination: {
                totalUsers,
                totalPages,
                currentPage: Number(page),
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
