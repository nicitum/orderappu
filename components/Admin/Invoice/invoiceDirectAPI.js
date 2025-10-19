// API to create direct invoice and insert products into order_products table
router.post('/invoice_direct', async (req, res) => {
    try {
        const { 
            invoice_number, 
            products, 
            invoice_amount, 
            customer_id, 
            adjustments, 
            collections, 
            customer_name, 
            route, 
            placed_on, 
            billed_by,
            summary
        } = req.body;

        // Validate required fields
        if (!invoice_number) {
            return res.status(400).json({
                success: false,
                message: 'invoice_number is required in the request body'
            });
        }

        if (!customer_id) {
            return res.status(400).json({
                success: false,
                message: 'customer_id is required in the request body'
            });
        }

        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'products array is required and must not be empty'
            });
        }

        // Validate each product has required fields
        for (const product of products) {
            if (!product.product_id || !product.quantity || !product.price) {
                return res.status(400).json({
                    success: false,
                    message: 'Each product must have product_id, quantity, and price'
                });
            }
        }

        // Calculate total invoice amount using approved_qty * approved_price
        let totalAmount = invoice_amount;
        if (!totalAmount) {
            totalAmount = products.reduce((sum, product) => {
                const approvedQty = product.approved_qty || product.quantity;
                const approvedPrice = product.approved_price || product.price;
                return sum + (parseFloat(approvedPrice) * parseInt(approvedQty));
            }, 0);
        }

        // Process collections data - ensure it's properly formatted for database insertion
        let collectionsValue = null;
        if (collections !== undefined && collections !== null) {
            try {
                // If it's already a string, use it as is; otherwise stringify it
                collectionsValue = typeof collections === 'string' ? collections : JSON.stringify(collections);
            } catch (stringifyError) {
                console.warn('Failed to stringify collections data:', stringifyError);
                // If stringify fails, store as null
                collectionsValue = null;
            }
        }

        // Process summary data - ensure it's properly formatted for database insertion
        let summaryValue = null;
        if (summary !== undefined && summary !== null) {
            try {
                // If it's already a string, use it as is; otherwise stringify it
                summaryValue = typeof summary === 'string' ? summary : JSON.stringify(summary);
            } catch (stringifyError) {
                console.warn('Failed to stringify summary data:', stringifyError);
                // If stringify fails, store as null
                summaryValue = null;
            }
        }

        // 1. Insert into direct_invoice table
        const insertInvoiceQuery = `
            INSERT INTO direct_invoice (invoice_number, invoice_amount, customer_id, customer_name, route, created_at, adjustments, collections, billed_by, summary)
            VALUES (?, ?, ?, ?, ?, UNIX_TIMESTAMP(), ?, ?, ?, ?)
        `;
        await executeQuery(insertInvoiceQuery, [
            invoice_number, 
            totalAmount, 
            customer_id, 
            customer_name || null, 
            route || null, 
            adjustments || null, 
            collectionsValue, 
            billed_by || null,
            summaryValue
        ]);

        // 2. Insert products into order_products table
        // First, get product_code and hsn_code for each product from the products table
        const productIds = products.map(product => product.product_id);
        const productDataQuery = `SELECT id, product_code, hsn_code FROM products WHERE id IN (${productIds.map(() => '?').join(', ')})`;
        const productDataResults = await executeQuery(productDataQuery, productIds);
        
        // Create maps of product_id to product_code and hsn_code for easy lookup
        const productCodeMap = {};
        const hsnCodeMap = {};
        productDataResults.forEach(row => {
            productCodeMap[row.id] = row.product_code;
            hsnCodeMap[row.id] = row.hsn_code;
        });

        const productValues = products.map(product => {
            // Use same values for quantity and approved_qty, price and approved_price
            const quantity = product.quantity;
            const price = product.price;
            const approvedQty = product.approved_qty || quantity; // same as quantity if not provided
            const approvedPrice = product.approved_price || price; // same as price if not provided
            
            return [
                invoice_number, // order_id = invoice_number
                product.product_id,
                quantity,
                price,
                product.name || null,
                product.category || null,
                product.altered || null,
                product.quantity_change || null,
                product.gst_rate || null,
                approvedQty,
                approvedPrice,
                hsnCodeMap[product.product_id] || null,  // Add hsn_code from products table
                productCodeMap[product.product_id] || null,  // Add product_code from products table
                placed_on || null,  // Add placed_on
                customer_name || null,  // Add customer_name
                route || null  // Add route
            ];
        });

        // Build placeholders for each product (now 16 placeholders instead of 15)
        const placeholders = productValues.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const flattenedValues = productValues.flat();

        const insertProductsQuery = `
            INSERT INTO order_products (
                order_id, 
                product_id, 
                quantity, 
                price, 
                name, 
                category, 
                altered, 
                quantity_change, 
                gst_rate, 
                approved_qty, 
                approved_price,
                hsn_code,
                product_code,
                placed_on,
                customer_name,
                route
            )
            VALUES ${placeholders}
        `;

        await executeQuery(insertProductsQuery, flattenedValues);

        return res.status(201).json({
            success: true,
            message: 'Direct invoice created successfully',
            data: {
                invoice_number,
                invoice_amount: totalAmount,
                customer_id,
                customer_name: customer_name || null,
                route: route || null,
                products_count: products.length,
                collections: collections || null,
                billed_by: billed_by || null,
                summary: summary || null,
                created_at: Math.floor(Date.now() / 1000)
            }
        });

    } catch (error) {
        console.error('Error creating direct invoice:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// API to fetch direct invoice summary with items and customer details
router.get('/fetch_di_summary', async (req, res) => {
    try {
        const { invoice_number } = req.query;

        // Validate input parameter
        if (!invoice_number) {
            return res.status(400).json({
                success: false,
                message: 'invoice_number parameter is required'
            });
        }

        // Fetch direct invoice data
        const invoiceQuery = `
            SELECT *
            FROM direct_invoice 
            WHERE invoice_number = ?
        `;
        
        const invoiceResult = await executeQuery(invoiceQuery, [invoice_number]);

        // Check if invoice exists
        if (invoiceResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Direct invoice not found with the given invoice_number'
            });
        }

        const invoiceData = invoiceResult[0];

        // Fetch order items from order_products table using invoice_number as order_id
        const itemsQuery = `
            SELECT *
            FROM order_products 
            WHERE order_id = ?
        `;
        
        const itemsResult = await executeQuery(itemsQuery, [invoice_number]);

        // Process collections data, handling both string and object cases
        let collectionsData = null;
        if (invoiceData.collections) {
            try {
                // If it's already an object, use it as is
                if (typeof invoiceData.collections === 'object' && !Array.isArray(invoiceData.collections)) {
                    collectionsData = invoiceData.collections;
                } 
                // If it's a string, parse it
                else if (typeof invoiceData.collections === 'string') {
                    collectionsData = JSON.parse(invoiceData.collections);
                }
                // For any other case, keep it as is
                else {
                    collectionsData = invoiceData.collections;
                }
            } catch (parseError) {
                console.warn('Failed to parse collections data:', parseError);
                // If parsing fails, keep the original data
                collectionsData = invoiceData.collections;
            }
        }

        // Process summary data, handling both string and object cases
        let summaryData = null;
        if (invoiceData.summary) {
            try {
                // If it's already an object, use it as is
                if (typeof invoiceData.summary === 'object' && !Array.isArray(invoiceData.summary)) {
                    summaryData = invoiceData.summary;
                } 
                // If it's a string, parse it
                else if (typeof invoiceData.summary === 'string') {
                    summaryData = JSON.parse(invoiceData.summary);
                }
                // For any other case, keep it as is
                else {
                    summaryData = invoiceData.summary;
                }
            } catch (parseError) {
                console.warn('Failed to parse summary data:', parseError);
                // If parsing fails, keep the original data
                summaryData = invoiceData.summary;
            }
        }

        // Prepare response data
        const responseData = {
            invoice: {
                ...invoiceData,
                collections: collectionsData,
                summary: summaryData
            },
            items: itemsResult
        };

        // If customer_id exists, fetch customer details
        if (invoiceData.customer_id) {
            const customerQuery = `
                SELECT *
                FROM users 
                WHERE customer_id = ?
            `;
            
            const customerResult = await executeQuery(customerQuery, [invoiceData.customer_id]);
            
            if (customerResult.length > 0) {
                responseData.customer = customerResult[0];
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Direct invoice summary fetched successfully',
            data: responseData
        });

    } catch (error) {
        console.error('Error fetching direct invoice summary:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});