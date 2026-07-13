<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/user'

const router = useRouter()
const userStore = useUserStore()

const form = ref({
  account: 'admin',
  password: 'admin@2024'
})
const remember = ref(true)
const loading = ref(false)

const handleLogin = async () => {
  if (!form.value.account || !form.value.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  loading.value = true
  try {
    await userStore.login(form.value.account, form.value.password)
    ElMessage.success('登录成功，欢迎回来！')
    router.push('/dashboard')
  } catch (e) {
    ElMessage.error('登录失败')
  } finally {
    loading.value = false
  }
}

const handleQuickFill = (account: string) => {
  form.value.account = account
  form.value.password = 'demo'
}
</script>

<template>
  <div class="login-page">
    <!-- 左侧品牌区 -->
    <div class="login-brand">
      <div class="brand-bg"></div>
      <div class="brand-content">
        <div class="brand-logo">
          <svg viewBox="0 0 32 32" width="40" height="40">
            <defs>
              <linearGradient id="bl" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#4080ff"/>
                <stop offset="100%" stop-color="#1f6feb"/>
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="7" fill="url(#bl)"/>
            <path d="M9 10h3v5h8v-5h3v12h-3v-5h-8v5H9z" fill="#fff"/>
            <circle cx="22" cy="22" r="2" fill="#00d4aa"/>
          </svg>
          <h1 class="brand-title">配送小智</h1>
        </div>
        <h2 class="brand-tagline">AI 配送运营<br/>智能决策系统</h2>
        <p class="brand-desc">
          多 Agent 协同 · 实时预测 · 智能调度<br/>
          让每一份订单，交付更精准
        </p>

        <div class="brand-features">
          <div class="feature-item">
            <el-icon><CircleCheckFilled /></el-icon>
            <span>订单预测准确率 94.2%</span>
          </div>
          <div class="feature-item">
            <el-icon><CircleCheckFilled /></el-icon>
            <span>运力调度效率提升 32%</span>
          </div>
          <div class="feature-item">
            <el-icon><CircleCheckFilled /></el-icon>
            <span>单均成本下降 18%</span>
          </div>
        </div>

        <div class="brand-footer">© 2024 配送小智 · 第 N 届算法大赛</div>
      </div>
    </div>

    <!-- 右侧表单区 -->
    <div class="login-form-wrap">
      <div class="login-form-inner">
        <h2 class="form-title">欢迎回来 👋</h2>
        <p class="form-subtitle">请使用您的账号登录到配送小智运营平台</p>

        <el-form class="login-form" @submit.prevent="handleLogin">
          <el-form-item>
            <label class="form-label">账号</label>
            <el-input
              v-model="form.account"
              placeholder="请输入账号"
              size="large"
              :prefix-icon="'User'"
              clearable
            />
          </el-form-item>

          <el-form-item>
            <label class="form-label">密码</label>
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              size="large"
              :prefix-icon="'Lock'"
              show-password
              @keyup.enter="handleLogin"
            />
          </el-form-item>

          <div class="form-row">
            <el-checkbox v-model="remember">记住我</el-checkbox>
            <a href="javascript:;" class="forgot-link">忘记密码？</a>
          </div>

          <el-button
            type="primary"
            size="large"
            class="submit-btn"
            :loading="loading"
            @click="handleLogin"
          >
            {{ loading ? '登录中...' : '登录' }}
          </el-button>

          <div class="quick-fill">
            <span class="quick-label">演示账号：</span>
            <el-button link type="primary" @click="handleQuickFill('admin')">admin</el-button>
            <el-button link type="primary" @click="handleQuickFill('operator')">operator</el-button>
            <el-button link type="primary" @click="handleQuickFill('analyst')">analyst</el-button>
          </div>
        </el-form>

        <div class="form-footer">
          登录即代表您同意<a>《服务协议》</a>和<a>《隐私政策》</a>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;
.login-page {
  display: flex;
  width: 100vw;
  height: 100vh;
  background: #0a1929;
  overflow: hidden;
}

/* ===== 左侧品牌区 ===== */
.login-brand {
  flex: 1.1;
  position: relative;
  background: linear-gradient(135deg, #0a1929 0%, #0f2942 50%, #1a3a5f 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.brand-bg {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 30% 20%, rgba(31, 111, 235, 0.3), transparent 40%),
    radial-gradient(circle at 70% 70%, rgba(0, 212, 170, 0.2), transparent 40%);
  animation: bgMove 20s ease-in-out infinite;
}

.brand-bg::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(64, 128, 255, 0.04) 1px, transparent 1px) 0 0 / 40px 40px,
    linear-gradient(90deg, rgba(64, 128, 255, 0.04) 1px, transparent 1px) 0 0 / 40px 40px;
}

/* 城市夜景光点 */
.brand-bg::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 50%;
  background:
    radial-gradient(circle 2px at 10% 80%, rgba(64, 158, 255, 0.6), transparent),
    radial-gradient(circle 2px at 25% 75%, rgba(64, 158, 255, 0.4), transparent),
    radial-gradient(circle 2px at 40% 85%, rgba(0, 212, 170, 0.5), transparent),
    radial-gradient(circle 2px at 60% 78%, rgba(64, 158, 255, 0.5), transparent),
    radial-gradient(circle 2px at 80% 82%, rgba(64, 158, 255, 0.4), transparent),
    radial-gradient(circle 2px at 95% 70%, rgba(0, 212, 170, 0.5), transparent),
    linear-gradient(180deg, transparent 50%, rgba(31, 111, 235, 0.1) 100%);
  background-size: 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%, 100% 100%;
  animation: cityLights 6s ease-in-out infinite alternate;
}

@keyframes bgMove {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes cityLights {
  from { opacity: 0.7; }
  to { opacity: 1; }
}

.brand-content {
  position: relative;
  z-index: 2;
  color: #fff;
  max-width: 480px;
  padding: 0 40px;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 60px;
}

.brand-title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 2px;
}

.brand-tagline {
  font-size: 36px;
  font-weight: 700;
  line-height: 1.4;
  margin-bottom: 20px;
  background: linear-gradient(180deg, #fff 30%, rgba(255, 255, 255, 0.6) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.brand-desc {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.8;
  margin-bottom: 32px;
}

.brand-features {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 80px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);

  .el-icon {
    color: #00d4aa;
    font-size: 18px;
  }
}

.brand-footer {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 16px;
}

/* ===== 右侧表单区 ===== */
.login-form-wrap {
  flex: 1;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.login-form-inner {
  width: 100%;
  max-width: 380px;
}

.form-title {
  font-size: 28px;
  font-weight: 700;
  color: $text-primary;
  margin-bottom: 8px;
}

.form-subtitle {
  font-size: 14px;
  color: $text-secondary;
  margin-bottom: 36px;
}

.login-form {
  .form-label {
    display: block;
    font-size: 13px;
    color: $text-regular;
    margin-bottom: 6px;
    font-weight: 500;
  }
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.forgot-link {
  font-size: 13px;
  color: $primary;
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 15px;
  letter-spacing: 2px;
}

.quick-fill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 20px;
  font-size: 12px;
  color: $text-secondary;
}

.quick-label {
  margin-right: 6px;
}

.form-footer {
  margin-top: 32px;
  font-size: 12px;
  color: $text-placeholder;
  text-align: center;

  a { margin: 0 4px; }
}

@media (max-width: 900px) {
  .login-brand { display: none; }
}
</style>
