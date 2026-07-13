/**
 * 骑手数据导入脚本
 * 用法: node scripts/importRiders.js
 */
import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ 请先设置 DATABASE_URL')
  process.exit(1)
}

const CSV_PATH = path.resolve(__dirname, '../data/riders_full.csv')
if (!fs.existsSync(CSV_PATH)) {
  console.error(`❌ CSV 不存在: ${CSV_PATH}`)
  process.exit(1)
}

async function main() {
  const pool = new pg.Pool({ 
    connectionString: DATABASE_URL, 
    ssl: { rejectUnauthorized: false },
    max: 5
  })
  
  console.log('🚀 开始导入 27,186 骑手数据到 PostgreSQL...')
  const start = Date.now()
  
  // 1. 建表
  const schemaPath = path.resolve(__dirname, '../data/riders_schema.sql')
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8')
    await pool.query(schema)
    console.log('✅ 表结构已创建')
  }
  
  // 2. 解析 CSV
  const text = fs.readFileSync(CSV_PATH, 'utf-8')
  const lines = text.split('\n').filter(l => l.trim())
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  console.log(`📊 ${lines.length-1} 行 × ${headers.length} 列`)
  
  // 3. 批量插入（1000 一批）
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => {
        const clean = v.trim().replace(/^"|"$/g, '')
        return clean === '' ? null : clean
      })
      const placeholders = values.map((_, j) => `$${j+1}`).join(',')
      const sql = `INSERT INTO riders (${headers.join(',')}) VALUES (${placeholders})`
      await client.query(sql, values)
      
      if (i % 5000 === 0) console.log(`  ⏳ ${i}/${lines.length-1}`)
    }
    
    await client.query('COMMIT')
    console.log(`✅ 导入完成: ${lines.length-1} 行 (${(Date.now()-start)/1000}s)`)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
  
  // 4. 验证
  const r = await pool.query('SELECT COUNT(*) FROM riders')
  console.log(`✅ 数据库现存: ${r.rows[0].count} 条`)
  
  const stats = await pool.query(`SELECT city_name, COUNT(*)::int as cnt FROM riders GROUP BY city_name ORDER BY cnt DESC LIMIT 5`)
  console.log('Top 5 城市:', stats.rows.map(r => `${r.city_name}(${r.cnt})`).join(', '))
  
  await pool.end()
}

main().catch(e => { console.error('❌ 失败:', e.message); process.exit(1) })
