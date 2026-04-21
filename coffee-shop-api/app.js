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


/* GET /api/admin/categories
admin lay toan bo danh muc
*/
app.get('/api/admin/categories', async (req, res) => {
  try {
    const sql = `
      SELECT id, name, description, slug, display_order, is_active
      FROM categories
      ORDER BY display_order ASC, id ASC
    `;

    const result = await pool.query(sql);

    return res.status(200).json({
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('GET /api/admin/categories error:', error);

    return res.status(500).json({
      message: 'Internal Server Error'
    });
  }
});

/* GET /api/admin/categories/:id
 admin lay chi tiet 1 danh muc
 admin bấm nút sửa-> frontend admin cần lấy dữ liệu hiện tại để đổ vào form edit

*/
 app.get('/api/admin/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (isNaN(id)) {
      return res.status(400).json({
        message: 'Category id must be a number'
      });
    }

    const sql = `
      SELECT id, name, description, slug, display_order, is_active
      FROM categories
      WHERE id = $1
    `;

    const result = await pool.query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Category not found'
      });
    }

    return res.status(200).json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('GET /api/admin/categories/:id error:', error);

    return res.status(500).json({
      message: 'Internal Server Error'
    });
  }
});



/*
POST /api/admin/categories
admin tao moi danh muc

*/
app.post('/api/admin/categories', async (req, res) => {
  try {
    const { name, description, slug, display_order, is_active } = req.body;

    if (!name || !slug) //Vì đây là 2 trường tối thiểu để category có thể dùng được: 
     {
      return res.status(400).json({
        message: 'name and slug are required'
      });
    }

    const checkSlugSql = `
      SELECT id
      FROM categories
      WHERE slug = $1
    `;

    const checkSlugResult = await pool.query(checkSlugSql, [slug]);

    if (checkSlugResult.rows.length > 0) {
      return res.status(400).json({
        message: 'Slug already exists'
      });
    }

    const sql = `
      INSERT INTO categories (name, description, slug, display_order, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      name,
      description || null, //description không bắt buộc.
      slug,
      display_order ?? 0, //Nếu frontend không gửi, mình cho mặc định = 0.
      is_active ?? true //Nếu không gửi, category mới tạo sẽ hoạt động luôn.
    ];

    const result = await pool.query(sql, values);

    return res.status(201).json({
      message: 'Category created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('POST /api/admin/categories error:', error);

    return res.status(500).json({
      message: 'Internal Server Error',
      error: error.message
    });
  }
});



/*
PUT : admin cap nhat danh muc 
- sua : ten - mo ta - slug - thứ tự hiển thị - trạng thái hoạt động 
*/

app.put('/api/admin/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, slug, display_order, is_active } = req.body;

    if (isNaN(id)) // check id là số vì phải chặn sớm trường hợp gọi sai 
      { 
      return res.status(400).json({
        message: 'Category id must be a number'
      });
    }

    if (!name || !slug) {
      return res.status(400).json({
        message: 'name and slug are required'
      });
    }

    const checkSlugSql = `
      SELECT id
      FROM categories
      WHERE slug = $1 AND id <> $2
    `;
// slug này là để check update phải loại bản chính hiện tại ra 
    const checkSlugResult = await pool.query(checkSlugSql, [slug, id]);

    if (checkSlugResult.rows.length > 0) {
      return res.status(400).json({
        message: 'Slug already exists'
      });
    }

    const sql = `
      UPDATE categories
      SET name = $1,
          description = $2,
          slug = $3,
          display_order = $4,
          is_active = $5
      WHERE id = $6
      RETURNING *
    `;

    const values = [
      name,
      description || null,
      slug,
      display_order ?? 0,
      is_active ?? true,
      id
    ];

    const result = await pool.query(sql, values);

    if (result.rows.length === 0) // update ko ra dòng nào thường là id ko tồn tại 
      {
      return res.status(404).json({
        message: 'Category not found'
      });
    }

    return res.status(200).json({
      message: 'Category updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('PUT /api/admin/categories/:id error:', error);

    return res.status(500).json({
      message: 'Internal Server Error',
      error: error.message
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