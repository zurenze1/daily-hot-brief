# 配置与模型适配

## 人与 AI 的分工

使用者只需说明行业、受众、主题、数量和时刻。安装 AI 或网页表单把这些要求写成本人的配置，程序生成并保存新闻 JSON；用户无需手工准备数据。

行业不限定模板列表。栏目名称可以自定，ID 为英文字母开头的稳定标识；栏目目标合计为每日目标，总量1至100，零条栏目可保留。来源窗口1至168小时。时区设为 system 跟随系统，或明确的 IANA 时区；时间采用24小时制。

安装 AI 可以生成一份临时本人配置后执行：

```sh
npm run setup -- --file /path/to/recipient-config.json
npm run doctor
npm run collect
```

此文件是安装 AI 的中间配置，不是要求使用者准备新闻。它和 runtime 均不得提交。优先用网页设置查看、修改。

## 配置结构（全为格式示意）

```json
{
  "industry": "自定义行业",
  "positioning": "从具体变化解释消费者选择",
  "audience": "请填本人账号的具体受众",
  "topics": "请填希望关注的主题和排除项",
  "categories": [{"id": "industry", "label": "行业动态", "target": 10}],
  "queries": ["请由安装AI验证的行业检索词"],
  "feeds": [],
  "discover": true,
  "windowHours": 48,
  "model": {"provider": "codex", "name": ""},
  "schedule": {"enabled": false, "time": "09:00", "timezone": "system"}
}
```

首次运行保留自动日更关闭，由使用者确认时刻并启用。安装需求已明确要求定时时，可按该需求配置，不创建重复任务。不要抄作者的行业、固定数量、机器路径或账号。

## 其他 AI 适配器

内置模型是 Codex CLI。其他 AI 可读取安装说明并完成安装，但不能据此假设其聊天窗口能作为后台被调用。

已有可调用 CLI 或组织模型网关时，安装 AI 可以写一个**本人的本地适配器**。配置 model.provider=command，model.executable 为已核验的绝对可执行路径，model.args 是参数数组；程序不经过 Shell，不接受新闻内容改写命令。不要将密钥放参数或提交到仓库。

程序从 stdin 发一个 JSON 对象：

```json
{"stage":"analyze","prompt":"本轮完整提示","schema":{"type":"object"},"webSearch":false}
```

stdout 只返回满足 schema 的 JSON，或 {"output": ...}。日志写 stderr，失败用非零退出码。discover 阶段 webSearch=true，适配器需要真实检索能力并返回原文 URL；没有联网能力时，应禁用 discover 并验证足够的公开订阅源，不得编造搜索结果。

所有模型返回都经过相同的栏目、配额、重复和证据 ID 校验。首版没有内置 HTTP API 密钥配置；需要 OpenAI 等 API 时，由使用者的 AI 按该服务正常、安全地配置适配器，遵循自己的账号授权，不复制本仓库作者的认证。第三方适配器的功能、额度和联网能力必须独立实测，不能把 Codex 验收结果套给它。

## 来源和事实边界

模板不捆绑固定资讯源；安装时按本人的行业和来源条件选择并验证。可配置公开 RSS/Atom，也可以由内置 Codex 联网寻找公开原文。模型检索先发现候选，后台读取实际原文；来源受限时只在有真正 RSS 摘要的情况下保留“仅摘要”标识。不绕过登录、验证码或付费墙。未知日期留空，陈旧或未来日期不当作当日新闻。

编辑字段包含 judgement、audience、angle、opening、outline、needs、priority、reason、reviewedAt。原发时间、读取、生成和编辑时间分别保存。判断是创作建议，不等同原文事实。

## 版本恢复

更新代码先停止本工具后台，保留 runtime；只对将改的配置/数据库做备份，不复制别人整套素材。编辑与重新生成前的旧报在 versions/。恢复时先保留当前 edition，再核日期、版本和来源，把选定旧版本恢复到 editions/对应日期；不恢复旧登录文件，不把运行数据推到公共仓库。
