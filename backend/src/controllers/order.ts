import { NextFunction, Request, Response } from 'express'
import { FilterQuery, Error as MongooseError, Types } from 'mongoose'
import BadRequestError from '../errors/bad-request-error'
import NotFoundError from '../errors/not-found-error'
import Order, { IOrder, StatusType } from '../models/order'
import Product, { IProduct } from '../models/product'
import User from '../models/user'
import escapeHtml from '../utils/escapeHtml'
import escapeRegExp from '../utils/escapeRegExp'

const MAX_PAGE_SIZE = 10
const DEFAULT_PAGE_SIZE = 10
const ORDER_SORT_FIELDS = new Set([
    'createdAt',
    'totalAmount',
    'orderNumber',
    'status',
])
const ORDER_SORT_ORDERS = new Set(['asc', 'desc'])

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

// eslint-disable-next-line max-len
// GET /orders?page=2&limit=5&sort=totalAmount&order=desc&orderDateFrom=2024-07-01&orderDateTo=2024-08-01&status=delivering&totalAmountFrom=100&totalAmountTo=1000&search=%2B1

export const getOrders = async (
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
            status,
            totalAmountFrom,
            totalAmountTo,
            orderDateFrom,
            orderDateTo,
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
        if (status !== undefined && typeof status !== 'string') {
            return next(new BadRequestError('Invalid status'))
        }
        if (
            totalAmountFrom !== undefined &&
            typeof totalAmountFrom !== 'string'
        ) {
            return next(new BadRequestError('Invalid totalAmountFrom'))
        }
        if (totalAmountTo !== undefined && typeof totalAmountTo !== 'string') {
            return next(new BadRequestError('Invalid totalAmountTo'))
        }
        if (orderDateFrom !== undefined && typeof orderDateFrom !== 'string') {
            return next(new BadRequestError('Invalid orderDateFrom'))
        }
        if (orderDateTo !== undefined && typeof orderDateTo !== 'string') {
            return next(new BadRequestError('Invalid orderDateTo'))
        }
        if (search !== undefined && typeof search !== 'string') {
            return next(new BadRequestError('Invalid search'))
        }

        const rawPage = parseNumberParam(page, 1)
        if (rawPage === null) {
            return next(new BadRequestError('Invalid page'))
        }
        const rawLimit = parseNumberParam(limit, 5)
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

        if (!ORDER_SORT_FIELDS.has(normalizedSortField)) {
            return next(new BadRequestError('Invalid sortField'))
        }
        if (!ORDER_SORT_ORDERS.has(normalizedSortOrder)) {
            return next(new BadRequestError('Invalid sortOrder'))
        }

        const filters: FilterQuery<Partial<IOrder>> = {}

        // Защита от NoSQL-инъекции: принимаем только строковый status
        if (typeof status === 'string' && status) {
            if (!Object.values(StatusType).includes(status as StatusType)) {
                return next(new BadRequestError('Invalid status'))
            }
            filters.status = status
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

        if (orderDateFrom) {
            filters.createdAt = {
                ...filters.createdAt,
                $gte: new Date(orderDateFrom as string),
            }
        }

        if (orderDateTo) {
            filters.createdAt = {
                ...filters.createdAt,
                $lte: new Date(orderDateTo as string),
            }
        }

        const aggregatePipeline: any[] = [
            { $match: filters },
            {
                $lookup: {
                    from: 'products',
                    localField: 'products',
                    foreignField: '_id',
                    as: 'products',
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'customer',
                    foreignField: '_id',
                    as: 'customer',
                },
            },
            { $unwind: '$customer' },
            { $unwind: '$products' },
        ]

        if (search) {
            const rawSearch = search.trim()

            if (rawSearch.length > 50) {
                return res
                    .status(400)
                    .json({ message: 'Search query is too long' })
            }

            const safeSearch = escapeRegExp(rawSearch)
            const searchRegex = new RegExp(safeSearch, 'i')
            const searchNumber = Number(rawSearch)

            const searchConditions: any[] = [{ 'products.title': searchRegex }]

            if (!Number.isNaN(searchNumber)) {
                searchConditions.push({ orderNumber: searchNumber })
            }

            aggregatePipeline.push({
                $match: {
                    $or: searchConditions,
                },
            })

            filters.$or = searchConditions
        }

        const sort: { [key: string]: any } = {}

        sort[normalizedSortField] =
            normalizedSortOrder === 'desc' ? -1 : 1

        aggregatePipeline.push(
            { $sort: sort },
            { $skip: (normalizedPage - 1) * normalizedLimit },
            { $limit: normalizedLimit },
            {
                $group: {
                    _id: '$_id',
                    orderNumber: { $first: '$orderNumber' },
                    status: { $first: '$status' },
                    totalAmount: { $first: '$totalAmount' },
                    products: { $push: '$products' },
                    customer: { $first: '$customer' },
                    createdAt: { $first: '$createdAt' },
                },
            }
        )

        const orders = await Order.aggregate(aggregatePipeline)
        const totalOrders = await Order.countDocuments(filters)
        const totalPages = Math.ceil(totalOrders / normalizedLimit)

        res.status(200).json({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: normalizedPage,
                pageSize: normalizedLimit,
            },
        })
    } catch (error) {
        next(error)
    }
}

export const getOrdersCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = res.locals.user._id
        const { search, page, limit } = req.query

        if (page !== undefined && typeof page !== 'string') {
            return next(new BadRequestError('Invalid page'))
        }
        if (limit !== undefined && typeof limit !== 'string') {
            return next(new BadRequestError('Invalid limit'))
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
        const options = {
            skip: (normalizedPage - 1) * normalizedLimit,
            limit: normalizedLimit,
        }

        const user = await User.findById(userId)
            .populate({
                path: 'orders',
                populate: [
                    {
                        path: 'products',
                    },
                    {
                        path: 'customer',
                    },
                ],
            })
            .orFail(
                () =>
                    new NotFoundError(
                        'Пользователь по заданному id отсутствует в базе'
                    )
            )

        let orders = user.orders as unknown as IOrder[]

        if (search) {
            const rawSearch = search.trim()

            if (rawSearch.length > 50) {
                return res
                    .status(400)
                    .json({ message: 'Search query is too long' })
            }

            // если не экранировать то получаем Invalid regular expression: /+1/i: Nothing to repeat
            const safeSearch = escapeRegExp(rawSearch)
            const searchRegex = new RegExp(safeSearch, 'i')
            const searchNumber = Number(rawSearch)

            const products = await Product.find({ title: searchRegex })
            const productIds = products.map((product) => product._id)

            orders = orders.filter((order) => {
                // eslint-disable-next-line max-len
                const matchesProductTitle = order.products.some((product) =>
                    productIds.some((id) => id.equals(product._id))
                )
                // eslint-disable-next-line max-len
                const matchesOrderNumber =
                    !Number.isNaN(searchNumber) &&
                    order.orderNumber === searchNumber

                return matchesOrderNumber || matchesProductTitle
            })
        }

        const totalOrders = orders.length
        const totalPages = Math.ceil(totalOrders / normalizedLimit)

        orders = orders.slice(options.skip, options.skip + options.limit)

        return res.send({
            orders,
            pagination: {
                totalOrders,
                totalPages,
                currentPage: normalizedPage,
                pageSize: normalizedLimit,
            },
        })
    } catch (error) {
        next(error)
    }
}

// Get order by ID
export const getOrderByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const order = await Order.findOne({
            orderNumber: req.params.orderNumber,
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

export const getOrderCurrentUserByNumber = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const userId = res.locals.user._id
    try {
        const order = await Order.findOne({
            orderNumber: req.params.orderNumber,
        })
            .populate(['customer', 'products'])
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
        if (!order.customer._id.equals(userId)) {
            // Если нет доступа не возвращаем 403, а отдаем 404
            return next(
                new NotFoundError('Заказ по заданному id отсутствует в базе')
            )
        }
        return res.status(200).json(order)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

// POST /product
export const createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const basket: IProduct[] = []
        const products = await Product.find<IProduct>({})
        const userId = res.locals.user._id
        const { address, payment, phone, total, email, items, comment } =
            req.body
        const safeComment =
            typeof comment === 'string' ? escapeHtml(comment) : ''

        items.forEach((id: Types.ObjectId) => {
            const product = products.find((p) => p._id.equals(id))
            if (!product) {
                throw new BadRequestError(`Товар с id ${id} не найден`)
            }
            if (product.price === null) {
                throw new BadRequestError(`Товар с id ${id} не продается`)
            }
            return basket.push(product)
        })
        const totalBasket = basket.reduce((a, c) => a + c.price, 0)
        if (totalBasket !== total) {
            return next(new BadRequestError('Неверная сумма заказа'))
        }

        const newOrder = new Order({
            totalAmount: total,
            products: items,
            payment,
            phone,
            email,
            comment: safeComment,
            customer: userId,
            deliveryAddress: address,
        })
        const populateOrder = await newOrder.populate(['customer', 'products'])
        await populateOrder.save()

        return res.status(200).json(populateOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        return next(error)
    }
}

// Update an order
export const updateOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { status } = req.body
        if (status !== undefined) {
            if (
                typeof status !== 'string' ||
                !Object.values(StatusType).includes(status as StatusType)
            ) {
                return next(new BadRequestError('Invalid status'))
            }
        }
        const updatedOrder = await Order.findOneAndUpdate(
            { orderNumber: req.params.orderNumber },
            { status },
            { new: true, runValidators: true }
        )
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])
        return res.status(200).json(updatedOrder)
    } catch (error) {
        if (error instanceof MongooseError.ValidationError) {
            return next(new BadRequestError(error.message))
        }
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}

// Delete an order
export const deleteOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const deletedOrder = await Order.findByIdAndDelete(req.params.id)
            .orFail(
                () =>
                    new NotFoundError(
                        'Заказ по заданному id отсутствует в базе'
                    )
            )
            .populate(['customer', 'products'])
        return res.status(200).json(deletedOrder)
    } catch (error) {
        if (error instanceof MongooseError.CastError) {
            return next(new BadRequestError('Передан не валидный ID заказа'))
        }
        return next(error)
    }
}
