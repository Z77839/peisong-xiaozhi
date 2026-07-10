<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const activeTab = ref('account')

const accountInfo = ref({
  org: '配送小智运营中心',
  admin: '管理员',
  email: 'admin@jiuxiaozhi.com',
  phone: '+86 138-0000-0000',
  plan: '企业版',
  expireDate: '2025-07-31'
})

const aiSettings = ref({
  predictionModel: 'transformer-v2',
  autoRunAgents: true,
  streamOutput: true,
  confidenceThreshold: 85,
  notifyChannels: ['email', 'im']
})

const handleSave = () => {
  ElMessage.success('设置已保存')
}
</script>

<template>
  <div class="page-container">
    <el-tabs v-model="activeTab" type="border-card" class="settings-tabs">
      <el-tab-pane label="账号信息" name="account">
        <div class="settings-content">
          <h3>基础信息</h3>
          <el-form :model="accountInfo" label-width="120px" style="max-width: 600px">
            <el-form-item label="组织名称">
              <el-input v-model="accountInfo.org" />
            </el-form-item>
            <el-form-item label="管理员">
              <el-input v-model="accountInfo.admin" />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input v-model="accountInfo.email" />
            </el-form-item>
            <el-form-item label="手机">
              <el-input v-model="accountInfo.phone" />
            </el-form-item>
            <el-form-item label="套餐">
              <el-tag type="primary">{{ accountInfo.plan }}</el-tag>
              <span class="hint"> 到期时间：{{ accountInfo.expireDate }}</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSave">保存修改</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <el-tab-pane label="AI 模型配置" name="ai">
        <div class="settings-content">
          <h3>智能体参数</h3>
          <el-form :model="aiSettings" label-width="180px" style="max-width: 600px">
            <el-form-item label="预测模型">
              <el-select v-model="aiSettings.predictionModel" style="width: 100%">
                <el-option label="Transformer v2 (推荐)" value="transformer-v2" />
                <el-option label="LSTM v1" value="lstm-v1" />
                <el-option label="Prophet 经典" value="prophet" />
              </el-select>
            </el-form-item>
            <el-form-item label="自动调度 Agent">
              <el-switch v-model="aiSettings.autoRunAgents" />
              <span class="hint"> 在异常时自动触发决策流</span>
            </el-form-item>
            <el-form-item label="流式输出">
              <el-switch v-model="aiSettings.streamOutput" />
            </el-form-item>
            <el-form-item label="置信度阈值">
              <el-slider v-model="aiSettings.confidenceThreshold" :min="50" :max="99" />
            </el-form-item>
            <el-form-item label="通知渠道">
              <el-checkbox-group v-model="aiSettings.notifyChannels">
                <el-checkbox value="email">邮件</el-checkbox>
                <el-checkbox value="im">飞书/钉钉</el-checkbox>
                <el-checkbox value="sms">短信</el-checkbox>
                <el-checkbox value="wechat">企业微信</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSave">保存设置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <el-tab-pane label="权限管理" name="perm">
        <div class="settings-content">
          <h3>角色与权限</h3>
          <el-table :data="[
              { name: '超级管理员', count: 2, perms: '全部' },
              { name: '运营经理', count: 8, perms: '运营+决策' },
              { name: '数据分析师', count: 12, perms: '查看+导出' },
              { name: '调度员', count: 24, perms: '运力调度' },
              { name: '访客', count: 5, perms: '仅查看' }
            ]">
            <el-table-column label="角色" prop="name" />
            <el-table-column label="人数" prop="count" align="right" />
            <el-table-column label="权限" prop="perms" />
            <el-table-column label="操作" width="180">
              <el-button link type="primary" size="small">编辑</el-button>
              <el-button link type="primary" size="small">分配</el-button>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane label="API 接入" name="api">
        <div class="settings-content">
          <h3>Coze Bot 对接</h3>
          <el-form label-width="160px" style="max-width: 700px">
            <el-form-item label="Bot ID">
              <el-input value="7445xxxxxxxxxxxx" />
            </el-form-item>
            <el-form-item label="API Key">
              <el-input value="pat_xxxxxxxxxxxxx" type="password" show-password />
            </el-form-item>
            <el-form-item label="工作流版本">
              <el-input value="v2.6" />
            </el-form-item>
            <el-form-item label="端点地址">
              <el-input value="https://api.coze.cn/v3/chat" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary">保存并测试连接</el-button>
              <el-button>查看对接文档</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>

      <el-tab-pane label="操作日志" name="log">
        <div class="settings-content">
          <el-table :data="[
              { time: '2024-07-07 14:32', user: 'admin', action: '生成运营日报', ip: '192.168.1.10' },
              { time: '2024-07-07 14:18', user: 'admin', action: '修改 AI 模型参数', ip: '192.168.1.10' },
              { time: '2024-07-07 13:42', user: 'operator01', action: '触发运力调度', ip: '192.168.1.22' },
              { time: '2024-07-07 11:05', user: 'admin', action: '登录系统', ip: '192.168.1.10' }
            ]">
            <el-table-column label="时间" prop="time" width="180" />
            <el-table-column label="用户" prop="user" width="120" />
            <el-table-column label="操作" prop="action" />
            <el-table-column label="IP" prop="ip" width="140" />
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style lang="scss" scoped>
@use "@/assets/styles/variables.scss" as *;

</style>
