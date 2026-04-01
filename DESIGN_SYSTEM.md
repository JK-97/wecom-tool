# 双域客户沟通平台设计系统 (Design System)

本系统基于已确认的 6 张核心界面（数据看板、客户列表、任务中心、客服指挥中心、策略中心、组织设置）反向整理，旨在确保后续页面开发与 UI 设计的高度一致性。

---

## 1. 视觉基调 (Visual Tone)

*   **风格关键词**：专业 (Professional)、高效 (Efficient)、AI 赋能 (AI-Enhanced)、严谨 (Rigorous)。
*   **气质定义**：典型的企业级 SaaS 风格。采用大面积的留白与浅灰色背景（`#F5F7FA` / `#F2F3F5`）来降低视觉疲劳，通过高饱和度的蓝色作为行动点，辅以 AI 特有的紫色/蓝色渐变点缀，传递“智能助手”的信任感。
*   **主页端与工具栏差异**：
    *   **主页端 (Main App)**：强调“管理与洞察”。布局疏朗，信息密度适中，使用 `rounded-xl` (12px) 圆角卡片，强调层级感。
    *   **工具栏 (Sidebar)**：强调“执行与响应”。布局紧凑，信息密度极高，背景色略深以区分聊天窗口，交互以“一键操作”为主。

---

## 2. 设计 Token (Design Tokens)

### 颜色体系 (Colors)
*   **主色 (Primary)**：`Blue-600` (`#2563EB`) - 用于主按钮、选中状态、关键链接。
*   **辅色 (Secondary)**：`Gray-500` (`#6B7280`) - 用于次要文字、图标。
*   **背景色**：
    *   主页背景：`Gray-50/30` (`#F9FAFB`)
    *   侧边栏背景：`#F2F3F5` 或 `#F5F7FA`
*   **状态色**：
    *   **成功 (Success)**：`Green-600` (`#16A34A`) / 背景 `Green-50`
    *   **警告 (Warning)**：`Orange-500` (`#F97316`) / 背景 `Orange-50`
    *   **错误/紧急 (Error/Urgent)**：`Red-600` (`#DC2626`) / 背景 `Red-50`
    *   **AI/智能 (AI/Smart)**：`Purple-500` (`#A855F7`) / 背景 `Blue-50`

### 字体体系 (Typography)
*   **字体**：`Inter`, `system-ui`, `sans-serif`
*   **字号层级**：
    *   `text-xl` (20px)：页面大标题
    *   `text-lg` (18px)：卡片标题、重要摘要
    *   `text-sm` (14px)：**标准正文**、按钮文字、表单 Label
    *   `text-xs` (12px)：辅助文字、标签文字、时间戳
    *   `text-[10px]`：极小标签（如 SLA 达标、活跃度）
*   **字重层级**：
    *   `font-bold` (700)：大标题
    *   `font-semibold` (600)：中标题、加粗正文
    *   `font-medium` (500)：按钮、导航项
    *   `font-normal` (400)：常规正文

### 物理特性 (Physicals)
*   **圆角体系**：
    *   `rounded-xl` (12px)：主页端大卡片、弹窗
    *   `rounded-lg` (8px)：侧边栏区块、警示块
    *   `rounded-md` (6px)：按钮、输入框、下拉框
*   **间距体系**：
    *   `p-6` / `gap-6` (24px)：主页端主要间距
    *   `p-4` / `gap-4` (16px)：卡片内边距、侧边栏主要间距
    *   `p-3` / `gap-3` (12px)：紧凑区块间距
*   **阴影体系**：
    *   `shadow-sm`：常规卡片
    *   `shadow-md`：悬浮状态、下拉菜单
    *   `shadow-2xl`：抽屉 (Drawer)、全局弹窗
*   **边框体系**：
    *   `border-gray-200` (`#E5E7EB`)：标准分割线、边框
    *   `border-gray-100` (`#F3F4F6`)：极淡分割线

---

## 3. 组件系统 (Component System)

### 按钮 (Buttons)
*   **主按钮**：`bg-blue-600 text-white`。用于“保存”、“提交”、“新建”。
*   **次按钮**：`variant="outline"`，`border-gray-200 text-gray-700`。用于“取消”、“导出”。
*   **功能按钮**：`variant="secondary"`，`bg-gray-100 text-gray-600`。用于侧边栏底部的“转交”、“结束”。
*   **AI 专用按钮**：带 `Bot` 图标，通常为 `variant="outline"` 配合紫色图标。

### 卡片 (Cards)
*   **标准卡片**：`bg-white border-gray-200 shadow-sm rounded-xl`。
*   **交互卡片**：在标准卡片基础上增加 `hover:border-blue-300 transition-all cursor-pointer`。

### 标签 (Badges)
*   **状态标签**：`variant="success/destructive/outline"`。
*   **业务标签**：`text-[10px] px-1.5 py-0.5`。如“高净值”、“视频号”。

### 警示块 (Alert Blocks)
*   **红色警示**：`bg-red-50 border-red-200`。用于待办任务、负面情绪预警。
*   **蓝色提示 (AI)**：`bg-blue-50 border-blue-100`。用于 AI 意图识别、话术建议。

### 列表项 (List Items)
*   **客户列表项**：高度固定，包含 Avatar、姓名、状态标签、最后跟进时间。
*   **任务列表项**：左侧包含 Checkbox，右侧包含优先级 Badge 和截止时间。

### 任务卡片 (Task Cards)
*   包含标题、截止时间（带 Clock 图标）、分配人、简短描述。

### 时间线区块 (Timeline)
*   左侧 `border-l-2 border-gray-200`，节点使用 `absolute -left-[9px]` 的圆点。

### 右侧 AI 摘要卡 (AI Summary Card)
*   位于侧边栏顶部，`bg-blue-50`，带 `Lightbulb` 图标，文字精炼。

### 输入/选择框 (Inputs/Selects)
*   `h-9` 或 `h-10`，`border-gray-200`，`text-sm`。

### 抽屉与弹窗 (Drawer & Dialog)
*   **抽屉**：从右侧滑出，宽度固定 `480px`（主页端）或 `100%`（侧边栏移动端适配）。
*   **弹窗**：居中，最大宽度 `320px` - `400px`，带遮罩层 `bg-black/40 backdrop-blur-sm`。

---

## 4. 约束规则 (Constraints)

*   **组件专用性**：
    *   **仅限工具栏**：`AI 建议回复卡片`、`一键发群按钮`、`升级为客户联系按钮`。
    *   **仅限主页端**：`数据看板 KPI 卡片`、`组织架构树`、`复杂的 Tab 切换`。
*   **按钮使用规则**：
    *   一个视图内只能有一个“最强”主按钮（Blue-600）。
    *   侧边栏底部操作区，主操作占满宽度的 100%，次操作平分下方空间。
*   **信息密度控制**：
    *   侧边栏内文字严禁超过 `text-sm`，辅助文字必须用 `text-xs`。
    *   主页端列表行高不低于 `64px`，侧边栏列表行高不低于 `48px`。
*   **避免混乱的原则**：
    *   **图标统一**：全部使用 `lucide-react`，禁止自定义 SVG。
    *   **颜色克制**：除状态色外，严禁引入新的色相。
    *   **层级清晰**：使用背景色区分（背景灰 vs 卡片白）来建立视觉层级，而非增加边框厚度。
