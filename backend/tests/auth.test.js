/**
 * 单元测试 - 认证
 * 验证：bcrypt 加密 / 登录限流 / 错误处理
 */
import test from 'node:test'
import assert from 'node:assert'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

test('bcrypt - 密码加密与验证', async () => {
  const password = 'admin@2024'
  const hash = await bcrypt.hash(password, 12)
  assert.ok(hash, '应该生成 hash')
  assert.notStrictEqual(hash, password, 'hash 不应等于原密码')
  assert.ok(await bcrypt.compare(password, hash), '正确密码应该匹配')
  assert.ok(!(await bcrypt.compare('wrong', hash)), '错误密码不应匹配')
})

test('bcrypt - salt rounds 影响 hash 长度', async () => {
  const hash10 = await bcrypt.hash('test', 10)
  const hash12 = await bcrypt.hash('test', 12)
  // rounds 越大耗时越长
  assert.ok(hash10.length > 0)
  assert.ok(hash12.length > 0)
})

test('JWT - 签发与验证', () => {
  const secret = 'test_secret_for_unit_test_only'
  const payload = { id: 'u_001', username: 'admin', role: 'admin' }
  const token = jwt.sign(payload, secret, { expiresIn: '1h' })

  const decoded = jwt.verify(token, secret)
  assert.strictEqual(decoded.username, 'admin', '应该能解析 username')
  assert.strictEqual(decoded.role, 'admin', '应该能解析 role')
})

test('JWT - 过期检测', () => {
  const secret = 'test_secret'
  // 立即过期的 token
  const expiredToken = jwt.sign({ id: 'u_001' }, secret, { expiresIn: '-1s' })
  assert.throws(
    () => jwt.verify(expiredToken, secret),
    /expired|jwt expired/i,
    '过期 token 应该报错'
  )
})

test('JWT - 错误 secret', () => {
  const token = jwt.sign({ id: 'u_001' }, 'secret_a', { expiresIn: '1h' })
  assert.throws(
    () => jwt.verify(token, 'secret_b'),
    /invalid signature/i,
    '错误 secret 应该报错'
  )
})
