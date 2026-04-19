require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// hien trang thai trong termaial
app.use((req, res, next) => {
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode}`);
  });
  next();
});


app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is running'
  });
});
//  test data
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS server_time');
    res.json({
      message: 'Database connected successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Database connection failed',
      error: error.message
    });
  }
});



// GET /api/categories -phía người dùng ko phải dmin 
// user lay danh sach danh muc dang hoat dong
app.get('/api/categories', async (req, res) => {
  try {
    const sql = `
      SELECT id, name, description, slug, display_order
      FROM categories
      WHERE is_active = TRUE
      ORDER BY display_order ASC, id ASC
    `;

    const result = await pool.query(sql);
    /*bất đồng bộ await chờ đợi xủ lý  */

    return res.status(200).json({
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('GET /api/categories error:', error);

    return res.status(500).json({
      message: 'Internal Server Error'
    });
  }
});




// GET /api/products
//GET products
app.get('/api/products', async (req, res) => {
  try {
    const { search } = req.query;

    let sql = `
      SELECT
        p.id,
        p.name,
        p.price,
        c.name AS category_name
      FROM products p
      JOIN categories c ON p.category_id = c.id
    `;

    const values = [];

    if (search && search.trim() !== '') {
      sql += ` WHERE p.name ILIKE $1`;
      values.push(`%${search.trim()}%`);
    }

    sql += ` ORDER BY p.id ASC`;

    const result = await pool.query(sql, values);

    return res.status(200).json({
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('GET /api/products error:', error);

    return res.status(500).json({
      message: 'Internal Server Error'
    });
  }
});





// post 
app.post('/api/products', async (req, res) => {
  try {
    const { name, price, category_id } = req.body;
     console.log({name, price, category_id});
    if (!name || price == null || !category_id) {
      return res.status(400).json({
        message: 'name, price, category_id are required'
      });
    }

    const sql = `
      INSERT INTO products (name, price, category_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const values = [name, price, category_id];
    const result = await pool.query(sql, values);

    res.status(201).json({
      message: 'Product created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message
    });
  }
});

 

// put 
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;

    if (price == null) {
      return res.status(400).json({
        message: 'price is required'
      });
    }

    const sql = `
      UPDATE products
      SET price = $1
      WHERE id = $2
      RETURNING *
    `;

    const values = [price, id];
    const result = await pool.query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }

    res.status(200).json({
      message: 'Product updated successfully',
      data: result.rows[0]
    });
  } catch (error) {

    console.error(error);
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message
    });
  }
});

// DELETE 
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `
      DELETE FROM products
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }

    res.status(200).json({
      message: 'Product deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Internal Server Error',
      error: error.message
    });
  }
});


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});