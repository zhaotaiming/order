import express from 'express';
import cors from 'cors';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3000;

// 上传目录
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer 上传设置
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

// 打开数据库
const db = await open({ filename: './db.sqlite', driver: sqlite3.Database });

// 建表 + 自动添加字段
await db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT,
    image TEXT,
    quantity INTEGER,
    group_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

try {
  await db.exec(`ALTER TABLE messages ADD COLUMN quantity INTEGER`);
} catch (e) {
  if (!e.message.includes('duplicate column')) {
    console.error('DB migration error:', e);
  }
}

const multiUpload = upload.fields([{ name: 'images' }]);

// 投稿保存
app.post('/api/messages', multiUpload, async (req, res) => {
  const messages = JSON.parse(req.body.messages || '[]');
  const files = req.files?.images || [];

  const date = new Date();
  const baseDate = date.toISOString().split('T')[0];

  const existing = await db.all(
    `SELECT DISTINCT group_id FROM messages WHERE group_id LIKE ?`,
    [`${baseDate}%`]
  );
  const nextGroupIndex = existing.length + 1;
  const groupId = `${baseDate}_${nextGroupIndex}`;

  try {
    for (let i = 0; i < messages.length; i++) {
      const { msg, qty } = messages[i];
      const file = files[i];
      const filename = file?.filename || null;
      await db.run(
        'INSERT INTO messages (message, image, quantity, group_id) VALUES (?, ?, ?, ?)',
        msg,
        filename,
        qty,
        groupId
      );
    }
    res.send({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'DB insert failed' });
  }
});

// 投稿一览获取
app.get('/api/messages', async (req, res) => {
  const rows = await db.all('SELECT * FROM messages ORDER BY created_at DESC');
  res.send(rows);
});

// Excel 导出（支持单个 group）
app.get('/api/export/excel', async (req, res) => {
  try {
    const groupId = req.query.group_id;
    const rows = groupId
      ? await db.all('SELECT * FROM messages WHERE group_id = ? ORDER BY created_at DESC', [groupId])
      : await db.all('SELECT * FROM messages ORDER BY created_at DESC');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Messages');

    worksheet.columns = [
      { header: '画像', key: 'image', width: 16 },
      { header: '内容', key: 'message', width: 60 },
      { header: '数量', key: 'quantity', width: 10 }
    ];

    for (const row of rows) {
      const imagePath = row.image ? path.join(__dirname, 'uploads', row.image) : null;
      const excelRow = worksheet.addRow({
        message: row.message,
        quantity: row.quantity || 0
      });

      worksheet.getRow(excelRow.number).alignment = { vertical: 'middle' };

      if (imagePath && fs.existsSync(imagePath)) {
        const imageId = workbook.addImage({
          filename: imagePath,
          extension: path.extname(imagePath).substring(1)
        });
        worksheet.getRow(excelRow.number).height = 120;
        worksheet.addImage(imageId, {
          tl: { col: 0, row: excelRow.number - 1 },
          ext: { width: 100, height: 100 }
        });
      }
    }

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${groupId || 'all'}_messages.xlsx"`
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel export failed', err);
    res.status(500).send('Excel export failed');
  }
});

// 启动服务
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
