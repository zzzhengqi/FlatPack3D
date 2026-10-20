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
