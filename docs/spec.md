# 装配数据 JSON 规范（v1）

一个 JSON 文件描述一件家具的一个装配范围。引擎 `index.html` 读取它，校验脚本 `scripts/validate.js` 拿它和分析报告比对。
样例：[`data/kallax-body.json`](../data/kallax-body.json)（由 `scripts/build-kallax-body.js` 生成）。

## 坐标与单位

- 单位：cm；角度：度。
- **装配坐标系**：以家具竖立后的外形中心为原点。x 向右，y 向上，z 朝前（开口一侧）。
- 零件和五金的 `position` 一律写**竖立后的最终位置**。组装过程中整体是平放还是竖立，由步骤的 `pose` 决定，引擎会对整体做旋转。

## 顶层字段

```jsonc
{
  "schema": "flatpack3d/assembly@1",
  "id": "kallax-body",
  "title": "KALLAX 置物架主体（5×5）",
  "scope": "说明这份数据覆盖哪些步骤、不含什么",
  "source": { "manual": "PDF 文件名", "docId": "AA-…", "analysis": "报告路径", "dimensions": "尺寸文档路径" },
  "manualPages": { "dir": "renders/shelf", "pattern": "p{NN}.png" },  // 左侧说明书页图片
  "meta": { "overall": [182, 182, 39], "grid": [5, 5], "approximate": ["…近似值说明…"] },
  "poses": { … },          // 整体姿态
  "partTypes": { … },      // 零件种类及数量（对应报告的板件清单）
  "parts": [ … ],          // 每块板一个实例
  "hardware": [ … ],       // 五金目录（对应报告的五金清单，包括本次不用的）
  "overview": { … },       // 第 0 步：清点零件
  "steps": [ … ]           // 第 1 步起
}
```

### poses

```jsonc
"poses": {
  "pivotLocal": [0, -91, -19.5],   // 翻转时绕的边（装配坐标）：底板后沿
  "pivotWorld": [0, 0.4, -19.5],   // 这条边在世界里固定的位置
  "flat":    { "tilt": -90, "label": "平放（背面朝下）" },
  "lift":    { "tilt": -72, "label": "抬起" },
  "upright": { "tilt": 0,   "label": "竖立" }
}
```
`tilt` 是整体绕 x 轴的转角。引擎会算出整体的位置，让 `pivotLocal` 这条边始终落在 `pivotWorld`。

### partTypes / parts

```jsonc
"partTypes": {
  "side": { "name": "侧板", "quantity": 2, "report": "厚长板，面上有成组孔位" }
},
"parts": [
  {
    "id": "side-left",
    "type": "side",            // 必须是 partTypes 的键
    "name": "左侧板",
    "size": [4, 174, 39],      // 竖立后沿 x/y/z 的尺寸
    "position": [-89, 0, 0],   // 竖立后的中心
    "faces": { "-y": "gray" }  // 可选：给某个面单独着色（+x -x +y -y +z -z）
  }
]
```

### hardware

```jsonc
{
  "id": "101339",           // 报告里的编号；多个编号共用一个图标时用 "/" 连接，不加空格
  "name": "木销",
  "quantity": 80,           // 报告五金清单里的数量
  "kind": "dowel",          // dowel | screw | pad | tool | other；决定 3D 外形
  "scope": "body",          // body = 本次用到；wall = 上墙固定，本次不做
  "shape": { "diameter": 0.8, "length": 4.0 }   // 近似值
}
```

### overview 与 steps

```jsonc
{
  "n": 6,                    // 说明书上的步骤号
  "pages": [13],             // 对应 PDF 页码（可以多页）
  "title": "第 2 排木销",
  "hint": "一句提示",
  "pose": "flat",            // 可选：这一步结束时的整体姿态，不写就沿用上一步
  "tools": ["锤子"],         // 工具；五金目录里的工具写编号，如 "100001"
  "parts": ["shelf-1"],      // 这一步放入的零件 id
  "approach": [0, 0, 1],     // 可选：零件最后一段从哪个方向靠近（装配坐标），默认 +z
  "hardware": [
    {
      "id": "101339",
      "count": 8,            // 必须等于 placements 的条数
      "placements": [
        { "position": [-53.48, 52.68, 10], "axis": "y", "attachTo": "shelf-1" }
      ]
    }
  ]
}
```
- `axis`：五金的长轴方向（x/y/z）。
- `attachTo`：可选，五金装到哪块零件上，之后跟着这块零件一起动。零件还没就位时也可以装（例如第 2 步先给隔板装木销，第 3 步再把隔板装上去）。
- 每块零件只能在一个步骤里出现一次。

## 第二期新增字段（嵌件与全套）

都是可选字段，主体数据不用也照样有效。

| 位置 | 字段 | 含义 |
|---|---|---|
| 顶层 | `variants` | 路线，如 `{ "left": { "label": "左开", "default": true }, "right": {…} }`；页面上显示成切换开关 |
| 顶层 | `defaultPose` | 第 1 步之前的整体姿态（主体默认 `flat`，嵌件用 `upright`） |
| 顶层 | `host` | 示意用的格子：`{ "cell": [内宽, 内高, 深], "wall": 隔板厚 }`，校验时也检查零件不与它重叠 |
| 顶层 | `staging` | 备料区 `{ "origin": [x, z], "width": 宽 }`（世界坐标） |
| 顶层 | `explodeScale`、`placeApproach`、`approachDist` | 爆炸视图倍数、零件放入时默认从哪个方向来、来向距离 |
| `meta` | `drawerCount` | 抽屉数；报告里"每个抽屉 N 块"的板件和 `repeat` 步骤按它换算 |
| `source` | `reportSection` | 对应报告的哪一节，如 `"## 2."` |
| `partTypes.*` | `report`、`perDrawer` | 报告板件表"图示"一列的原文；每个抽屉几块 |
| `parts[]` | `rotation` | 最终姿态（度，XYZ 顺序） |
| `parts[]` | `variants` | 按路线覆盖 `position` / `rotation` |
| `parts[]` | `pieces` | 由多段组成的零件（折叠外框）：`[{ id, size, offset, unfolded: { offset, rotation } }]`，`unfolded` 是展开时的样子 |
| `hardware[]` | `pieces`、`unit` | 一个计数单位有几件实物（如 1 片 107091 = 2 个圆垫），单位名 |
| `hardware[]` | `members` | 成套五金的成员编号（如 `123801+123802`） |
| `hardware[].shape` | `type` | `screw`（杆 + 头）、`cylinder`、`box`（配 `size`） |
| `steps[]` | `variant` | 只属于某条路线的步骤；不写表示各路线共用 |
| `steps[]` | `repeat` | 这一步要按几个抽屉各做一遍；`count` 写的是总数 |
| `steps[]` | `bench` | 这一步放入的零件先放在"工作台"位置（最终位置 + 这个偏移） |
| `steps[]` | `install` | 把之前放在工作台上的零件推到最终位置 |
| `steps[]` | `fold` | 这一步把哪些零件从展开状态折好 |
| `steps[]` | `marks` | 铅笔线 `[{ position, size }]` |
| placement | `dir` | 五金钉头朝向 / 打入的来向（单位向量）；不写时沿用 `axis` |
| placement | `member` | 成套五金里这一件是哪个编号 |

`attachTo` 的 `position` 一律写在零件**基准姿态**（`part.position`、不旋转）下；零件按路线换了姿态，附着的五金跟着走。

### 全套数据（`flatpack3d/set@1`）

```jsonc
{
  "schema": "flatpack3d/set@1",
  "body": "data/kallax-body.json",
  "layoutSource": "排布依据（商品图）",
  "references": ["refs/…png"],
  "inserts": [
    { "id": "door", "data": "data/kallax-door.json", "variant": "left",
      "placements": [{ "cell": [1, 3], "origin": [-70.24, 0, 0] }] }   // cell = [列, 行]，都从 1 起，行从上数；origin = 格子内腔中心
  ]
}
```
引擎把每份嵌件的成品状态算一次，按 `placements` 用 `InstancedMesh` 复制，不会为每个格子单独建几何体。

## 第三期新增：页码与文案文件

| 位置 | 字段 | 含义 |
|---|---|---|
| `manualPages` | `count` | 说明书总页数；左侧可翻页浏览，页码校验以它为上限 |
| `steps[]` | `figure` | 这一步的步骤图在 `pages[0]` 上的竖直范围 `[y0, y1]`（0 = 页顶，1 = 页底）；同页两步必须写且不重叠，一页一步可省略（整页） |

文字一律不写在代码里：

- `data/site.json`：语言、界面文案文件、产品文案文件、默认件、"件"列表（`pieces`：key、label、数据文件）。
- `data/ui.zh.json`：界面上的所有文字，`{name}` 为占位符；`shortcutList` 是快捷键说明。换语言就换这个文件。
- `data/kallax-product.json`：换家具时要改的文案。
  - `share`：分享标题、描述、图片、图片说明、站点地址；`scripts/build-meta.js` 把它写进 index.html 的 `<head>`，`scripts/make-og-image.js` 生成分享图。
  - `about`：精确/近似说明（近似清单从 `approximate.source` 的 `approximate.heading` 一节原样读取）、注意事项、商标声明、官方 PDF 链接（`links.items`：label、article、docId、url）。
  - `explainers`：讲解卡片。

## 第四期新增：多语言、深链接、取景

### 站点文件与语言

- `?lang=en` 读 `data/site.en.json`，不写读 `data/site.json`。站点文件新增 `langCode`（本语言代码）和 `languages`（右上角切换列表：`[{ code, label }]`）。
- 各语言的 `ui`、`product` 指向本语言的文案文件；`pieces[]` 可加 `i18n`，指向装配数据的译文覆盖文件。
- 装配数据本身（数量、坐标、步骤结构）只有一份；译文只覆盖要显示的文字：

```jsonc
{
  "title": "…", "scope": "…",                 // 全套数据用 title、layoutSource
  "overview": { "title": "…", "hint": "…" },
  "variants": { "left": { "label": "…", "note": "…" } },
  "poses": { "flat": { "label": "…" } },
  "partTypes": { "side": { "name": "…" } },
  "parts": { "side-left": "…" },              // 零件 id → 名称
  "hardware": { "101339": { "name": "…", "unit": "…" } },
  "tools": { "锤子": "Hammer" },              // 步骤 tools 里的非编号文字
  "steps": { "12": { "title": "…", "hint": "…" }, "left:3": { … } }   // 有路线的步骤写 路线:步骤号
}
```

- 近似清单的英文在 `docs/dimensions.en.md` 的 `## Guess list` 一节，编号与中文 `## 猜测清单` 一一对应。

### 深链接

地址栏 `?piece=…&variant=…&step=说明书步骤号&lang=…`；打开时直接定位（不播放动画），切换步骤时用 `history.replaceState` 更新。

### 取景

每次切步骤，先把场景摆到"这一步完成后"的样子，量出包围盒（第 0 步是全部零件含备料区；之后是格子示意、已放入的零件和不在备料区的五金），
再在画布里避开步骤卡、五金卡、底部按钮条（截图模式下还有标题）找出最大的空白矩形，让包围盒正好落在里面（相机方向保持用户当前的视角）。
`scripts/check-framing.js` 用无头浏览器对每个件、每条路线、每一步在桌面 1280×800、笔记本 1024×680、手机 390×844 下截图，检查包围盒没有超出画布、没有被面板挡住、也不至于太小。

## 第四期第二批新增：上墙固定与 Room

| 位置 | 字段 | 含义 |
|---|---|---|
| 顶层 | `variantTitle` | 路线切换的标题（门："铰链位置"；主体和 Room："上墙方案"） |
| `variants.*` | `report` | 报告里这条路线的表格标题关键字（如"方案 A"）；校验只拿标题含它的表和不属于任何路线的表来比 |
| `poses.*` | `shift` | 姿态平移 `[x, y, z]`（如方案 B 第 26 步把柜体从墙边移开） |
| 顶层 | `room` | `{ fromStep, walls: { 路线: { center, size } } }`：从第几步起显示墙，墙按路线放在哪里（装配坐标，柜体竖立后） |
| 顶层 | `extras` | 不随包装提供、说明书要求另购的东西（墙用螺钉），`notIncluded: true`，不计入五金清单 |
| `hardware[]` | `variants` | 只在这些路线里用的五金；其他路线里用量必须为 0 |
| `hardware[].shape` | `type: "plates"` | 由几块板组成的固定件：`plates: [{ size, offset }]`，定位点为原点 |
| `steps[]` | `extras` | 这一步用到的另购件：`[{ id, placements }]` |
| `steps[].hardware[]` | `action: "remove"` | 拧出：位置必须是之前步骤装上的同一种五金；计数时减去 |
| placement / mark | `frame: "wall"` | 放在"墙组"里（柜体最终竖立位置的坐标系），柜体平移时不动 |
| placement | `mirrorX` | 左右镜像（右侧的墙固定件） |

全套数据新增 `notes`（显示在全套说明里）。Room 数据（`flatpack3d/room@1`）：`set`（全套数据）、`variants`（与主体的上墙方案同名）、`outlines`（每条路线一组青色轮廓：`{ kind: cabinet | fixing, plane: z | x, at, rect: [a0, y0, a1, y1] }`，画在墙面上）、`eyeHeight`、`note`。

校验新增：报告按方案分表核对页码与用量；拧出位置；墙钉（不含）与报告一致；Room 轮廓在墙面上、柜体轮廓与柜体外形一致、每个固定件都有轮廓；中英文页面头部与文案一致；安全提示存在；页面在任何尺寸下不横向溢出（取景检查）。

## 第五期新增：动作、放大圆圈

### 步骤字段

| 字段 | 含义 |
|---|---|
| `motions` | 本步的动作，按顺序播放。**只加说明书画了箭头的**；每个动作的 `page` 必须是本步的页 |
| `motionNote` | 动作依据：写明是哪一页的哪个箭头（显示在步骤卡上，译文也要点名同样的页） |
| `zoomFocus` | `{ index, page }`：放大圆圈对准本步那种五金的第几个（从 0 数），依据页必须是本步的页 |

动作类型：

| type | 对象 | 动作 |
|---|---|---|
| `screw` | 本步装的 `id`（五金）或 `extra`（另购件），必须是螺钉 | 先飞到"钉尖刚进孔"处，再边转边拧到底；`tool` 同步转动 |
| `unscrew` | 本步拧出（`action: "remove"`）的 `id` | 边转边退出，再抽走 |
| `turn` | 本步装的偏心件 `id`，`angle` 度 | 原地转 |
| `slide` | `target: { step, id }`：之前某步装的五金 | 沿 `axis` 先正后负各走 `amount`，回到原位 |
| `tighten` | `target: { step, id 或 extra }` | 原地转紧；`tool` 同步转动 |

`tool` 是本步 `tools` 里的一项：`100001` 显示 Z 形扳手，其他（螺丝刀）显示螺丝刀。转向：从钉头一侧看拧入顺时针、拧出逆时针（p35 与 p33 的箭头相反）。

### 高亮、慢放、停留

- 本步放上的板件用琥珀色，本步在动的五金和另购件用琥珀色自发光加琥珀色描边；动画期间一明一暗闪烁，之后保持高亮。尺寸不变。
- 五金飞入 1.1 秒，拧螺钉 2 秒；连播（C）等本步动画播完再停 1.5 秒才进下一步。

### 放大圆圈（阈值）

- **屏幕面积**：零件包围盒 8 个角投到画面上的包围矩形的面积（CSS 像素²，裁到画面内）。
- **阈值 `AREA_MIN` = 1600 px²（约 40×40 CSS 像素）**。
- 量法：本步放上的板件合成一组，按合起来的包围盒算（翻转、移开柜体时整个柜体算一组），在放大圆圈里按其中最大的一块算；五金和另购件按种类分组，取画面上最大的那一个。
- 本步有任何一组在主画面上低于阈值，就显示放大圆圈：对准面积最小的那一组的第 1 个（第一个圆圈可由 `zoomFocus` 指定），把 12 cm 以内的其他小零件和要拧的螺钉在孔外那段路一起放进去。没被这个圆圈覆盖的小零件再开第二个圆圈（最多两个，例如抽屉第 9 步拉手在面板中间、防撞垫在上角）。
- 圈里最小的那种零件不到阈值的 1.3 倍时，特写范围按面积与半径平方成反比缩小并往它挪（范围半径下限 1.5 cm）。
- 圆圈直径取画布短边的 36%（120–230 px），放不下时缩小到 96 px；位置在 8 px 网格上找，不压步骤卡、五金卡、按钮条和另一个圆圈，不盖住任何引线终点，尽量少挡柜体、离零件近。
- 第二个相机的视角方向跟着主相机；如果主相机是从孔的背面看，就转到螺钉侧面并偏向孔口；如果焦点和相机之间（近裁剪面以内）有板挡着，依次试放平视角、绕孔口方向左右上下偏斜，取第一个没挡住的。近裁剪面切掉焦点前方 1.6 倍范围半径以外的东西。
- 爆炸视图打开时圆圈隐藏。

### 取景检查新增

- 每一步、每一组在动的零件：主画面或放大圆圈里的屏幕面积不低于 `AREA_MIN`，否则报"本步在动的零件太小"。
- 放大圆圈不出画布、不压面板、两个圆圈不重叠。
- 页面加 `?zoom=0` 会关掉放大圆圈（用来确认检查能报错）。

## 校验规则（scripts/validate.js）

1. 每种零件的实例数等于报告板件清单里的数量，零件总数等于报告合计。
2. 五金目录与报告五金清单一一对应，编号和数量都一致。
3. 报告范围内的每一步都有对应步骤：页码一致，每种五金的用量一致，用到的五金工具编号一致。
4. `scope = body` 的消耗型五金，各步用量加起来等于清单数量；`scope = wall` 的五金在本数据里用量为 0。
5. 每块零件恰好放入一次；`attachTo` 指向的零件存在；`count` 等于 `placements` 的条数。
6. 几何：所有零件的外包盒等于 `meta.overall`；任意两块零件不重叠；有 `host` 时也不与格子隔板重叠。
7. 有 `variants` 时，第 3–6 条对每条路线分别检查。报告里只写了编号、没写数量的五金按 1 件算；成套五金列出成员就算 1 套；工具型五金只核对编号。
8. 有 `meta.drawerCount` 时：只在 `repeat` 步骤里用到的五金，清单数 ÷ 报告里每个抽屉的用量，必须等于抽屉数。
9. 全套：嵌件数量为门 5、双抽屉 5；每格最多一个；嵌件不与主体板件重叠、彼此不重叠、不超出主体外形。
10. 每一步（含第 0 步）都有页码，且在 1–`manualPages.count` 之内；`figure` 有效；同一路线里同页两步的 `figure` 不重叠。
11. 每块零件都有名称和编号（`id`，小写字母、数字、连字符，不重复）；每种五金都有名称和编号；`member` 在 `members` 里。
12. 站点文案：index.html 用到的文案键都在界面文案里；每份说明书都有官方 PDF 链接且文档号一致；分享图存在，index.html 的分享信息与文案一致；近似清单能取到；有商标声明。
13. 其他语言的站点文案与 `data/site.json` 逐项对齐：界面文案键和占位符相同、快捷键条数相同、产品文案的条目数和链接相同、近似清单编号相同、件列表相同；每份装配数据译文覆盖所有要显示的名称和说明，且没有数据里不存在的键。
14. 取景截图检查（不带文件参数运行时默认执行，`--no-framing` 跳过）：中文三种尺寸、英文桌面和手机，每张都要合格。
