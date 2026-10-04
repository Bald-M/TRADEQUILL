# 电商数据接入与价格监控研究

核验日期：2026-10-04。需求来源：用户批准的研究与拆单计划。目标平台为 Amazon、eBay、Walmart；同时覆盖竞品价格监控、自有商品/价格/库存、订单及经营报表。首发国家和供应商尚未选定，先整理全球支持矩阵。

本次证据是官方文档和政策正文阅读，没有申请生产权限、采购服务、调用真实商品/订单接口或进行反爬实验。下文的“支持”表示文档声明；账号实际可用性、字段覆盖、延迟、授权合同及适用政策仍须验证。条款分析用于接口选型，不是对所有司法辖区作法律结论。

## 结论与项目边界

- 自有店铺优先使用卖家授权的官方接口；公开竞品采集分别验证生产准入、用途及历史保存权限。接口返回数据不等于允许任意复用。
- Amazon SP-API 可查询目录及竞争报价，并非只能查询自己的商品；但需要相应卖家授权和角色。Creators API 不作为桌面监价默认路线。[A1][A2][A6]
- Keepa 的历史价格能力与监价相符，但长期存储、桌面展示、导出以及与 SP-API 同用的政策兼容性未确认，保留为候选。[K1][K2][A7]
- eBay Buy 与 Sell 接口分开选型；Walmart 本店 Pricing Insights 不能外推为全站竞品接口。[E1][E2][W1]
- 监控仅在 TradeQuill 运行且电脑清醒时执行。退出、休眠、离线产生真实空档；恢复时限速刷新当前数据。付费只评估，不采购；本次不实现采集功能，不引入 AI、远端调度或自动定价。

研究基线为远端 `main` 的 `24a5ebe45055189cf2fb1e9de21f77f4d6a51377`，其已有客户/询盘与跟进业务，尚无本需求的数据连接器。其他功能分支的产品档案和知识库不视为此基线已交付能力。现有 [#18](https://github.com/Bald-M/TRADEQUILL/issues/18) 可关联服务配置经验，[#25](https://github.com/Bald-M/TRADEQUILL/issues/25) 可消费未来获准的来源；本研究不改变它们的范围，也不将 AI 设为采集前置。

## 数据源与能力矩阵

| 平台/用途                | 官方能力与主要字段                                                                                                                                  | 准入、时效及主要缺口                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Amazon 目录/竞品基础资料 | Catalog Items：ASIN、属性、图片、分类、尺寸、关系和排名。[A1]                                                                                       | Product Listing 角色；目录不是完整评论或真实销量数据源。                                                                                                    |
| Amazon 竞争报价          | Product Pricing `getCompetitiveSummary`：Featured Offer、最低报价、参考价、卖家、成色和配送等；每批最多 20 个 ASIN/站点请求。[A2]                   | 当前报价，不是历史数据库；默认 0.033 请求/秒、burst 1，实际额度以账号响应为准。地理位置、Prime 和优惠条件会影响口径。[A3]                                   |
| Amazon 自有店铺          | 授权商品/库存、Orders、Reports；订单可按需获取金额/履约数据；销售流量报表按日期/ASIN 聚合。[A4][A5]                                                 | 私有自用与公共应用授权不同，私有卖家开发资格要求 Professional Selling Account。[A8] 指定销售流量报表要求 Brand Analytics 角色，最长回看两年；报表异步生成。 |
| Amazon 评论              | Customer Feedback 返回主题、趋势与片段。[A9]                                                                                                        | 每周更新、仅英文，支持 US/UK/FR/IT/DE/ES/JP；角色受限，不能承诺完整逐条评论。                                                                               |
| eBay 公开商品            | Browse 的搜索/详情：价格、卖家、配送、可购买状态。[E1]                                                                                              | Buy 生产准入需申请，获批不保证；可购买状态不等于精确库存。Marketplace Insights 不向新用户开放。[E2][E3]                                                     |
| eBay 自有店铺            | Inventory/offer、Trading/Sell Feed 等读取刊登；Sell Fulfillment 读订单；Analytics 提供流量与卖家指标；Finances 提供交易/费用/打款。[E4][E5][E6][E7] | 需卖家 OAuth。Inventory 不保证覆盖所有历史刊登路径。Finances 的 EU/UK 居民卖家请求额外要求数字签名；不能把 Buy 准入套用于全部 Sell API。                    |
| Walmart 目录/竞争信息    | Item Search 查询公开目录；Pricing Insights 返回本店 SKU 价格、Buy Box、竞争价格。[W1][W2]                                                           | 面向卖家业务；搜索最多 40 个匹配项。Pricing Insights 不保证覆盖任意竞品。                                                                                   |
| Walmart 自有店铺         | Items、Inventory、Orders；Item Performance 包括销量、GMV、转化等。[W3][W4][W10][W11]                                                                | 需卖家/服务商授权；报表异步、v3 支持期间及聚合粒度，最长回看两年。US 能力不能自动推广到其他市场。                                                           |
| Keepa / Amazon 历史      | 商品、价格历史、报价、卖家、tracking；Product 最多 100 个 ASIN/请求。[K1][K2]                                                                       | 第三方付费；不能追踪 Amazon Fresh。默认约一小时刷新阈值，offers 更新独立且不规律；刷新失败仍可能 HTTP 200 返回旧资料。不是 15 分钟新鲜度保证。              |

Amazon 的 `ANY_OFFER_CHANGED` 仅覆盖授权卖家有 active offers 的商品，使用 SQS 工作流，不代表任意竞品实时推送。[A10] 本地运行模式优先评估有界拉取，不把远端通知设施列为第一阶段前置。

### 全球支持矩阵

站点存在、接口列出该站点、账号具有访问资格是三件不同的事。下表不承诺所有字段在所有站点可用。

| 能力                            | 官方列出的市场                                                                                    | 尚需逐站确认                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Amazon SP-API marketplace ID    | CA、US、MX、BR；IE、ES、UK、FR、BE、NL、DE、IT、SE、ZA、PL、EG、TR、SA、AE、IN；SG、AU、JP。[A11] | 该表仅表示站点标识；Pricing、库存、Orders、Reports 的具体角色/端点/字段及卖家资格各自核对。                                |
| Keepa Product domain            | US、UK、DE、FR、JP、CA、IT、ES、IN、MX、BR。[K2]                                                  | 与 SP-API 站点不等同；商品、历史区间和报价覆盖须抽样。                                                                     |
| eBay Browse item / item_summary | AT、AU、BE、CA、CH、DE、ES、FR、GB、HK、IE、IT、NL、PL、SG、US。[E3]                              | API/方法有子集差异；例如图片搜索仅 US/DE/GB/AU。                                                                           |
| eBay Sell Analytics             | 客服指标/卖家等级：AU、CA、FR、DE、GB、IT、ES、US；Traffic 为上述范围去掉 CA。[E6]                | Inventory/Fulfillment 的完整逐站范围本次未核实；Finances 主要接口不按 marketplace 限制，但特定金融产品及签名另有规则。[E7] |
| Walmart Marketplace             | US 使用 US API；CA、MX、CL 使用 Global API。[W5]                                                  | “Global”不是全球所有国家；US Pricing Insights、报表及授权方式不得照搬到其他三国。                                          |

## 许可、授权与保留边界

### Amazon

PA-API 5 已弃用；官方公告称旧调用返回 403，迁移目标为 Creators API。[A12] Creators API 所属的 2026-04-14 Associates 政策默认限制价格跟踪/提醒、安装于用户设备的客户端使用、未经书面批准的聚合分析/卖家工具及客户端缓存；其他允许场景也有缓存时限。因此“获得凭证”不足以批准本项目的桌面长期监价用途。[A6]

SP-API AUP §4.3 对受其约束的开发者使用、提供或推广贩售从 Amazon 网站获取数据的外部服务有禁止条款。必须核对供应商的数据来源、合同、身份和政策适用性；不能仅将 SP-API 与 Keepa 分成两个模块就认定兼容。[A7] Keepa 本次仅作为技术候选，未验证本项目的长期落库/展示/导出许可。

SP-API DPP 要求按授权目的保留数据，并规定撤权等情形的删除要求；PII 有更严格的用途、期限和保护条件，不能将全部原始响应永久保存。[A13] Orders v2026-01-01 改为受限角色控制 PII，不再要求 RDT，不能沿用旧版“所有 PII 都需 RDT”的表述。[A14] 首期经营分析按白名单保存订单标识、商品、数量、状态、时间和金额；不请求非必要 BUYER/RECIPIENT 信息，清理响应中夹带的姓名、电话、地址、邮箱。

### eBay 与 Walmart

eBay API License 对 listing 展示新鲜度（不超过六小时滞后）、其他内容（24 小时）、停止公开后的删除、某些衍生分析及 Restricted API 定价用途设有限制。是否可保存历史和提供跨平台竞品分析须结合具体用途获确认；自有经营报表与公开竞品分析不能混判。[E8]

Walmart 美国卖家可直连自己的凭据；新美国 Solution Provider 需要获批并使用 OAuth 2.0，Global 文档仍有不同的 delegated credentials 流程。[W5][W6] 美国 API 条款限制 Approved Purposes 以外的数据再利用/组合；长期历史和跨平台分析需要按适用合同确认。[W7]

eBay 与 Walmart 网站使用条款对自动化采集要求事先许可。[E9][W8] AUP 新入口若无法读取，可使用[官方旧入口](https://sellercentral.amazon.com/mws/static/policy?documentType=AUP&locale=en_US)，本次会重定向至现行正文。本次未稳定取得 Amazon 零售站通用条款正文，不借用其 Shipping/Business 条款作全站结论。`robots.txt` 是抓取规则，不是访问或内容使用授权。[R1]

### 桌面授权

首发需要确认“用户自己的私有集成”还是“分发给其他卖家的服务商应用”，以及平台是否允许该桌面流程。不能把共享 client secret 打包进所有桌面安装包；原生应用内静态共享秘密不能视为保密。[R2] 个人凭据也应使用操作系统安全存储，不写入普通 SQLite、localStorage、日志或错误回显。若平台要求无法在本地模式下满足的服务端流程，该路线保持未通过，不擅自增加远端代理。

## 成本、配额与新鲜度测算

以下是容量估算，不是报价或实测吞吐。一个“商品—站点组合”计一个观察对象；同一商品的不同站点/变体/指定卖家需按实际查询口径计数。每天运行 8 小时，每月 30 天：

`每日观察量 = 对象数 × 每天运行小时数 × 60 / 间隔分钟数`

`每月观察量 = 每日观察量 × 运行天数`

| 对象数 | 间隔    | 观察量/日 | 观察量/月 |
| ------ | ------- | --------: | --------: |
| 100    | 60 分钟 |       800 |    24,000 |
| 100    | 15 分钟 |     3,200 |    96,000 |
| 1,000  | 60 分钟 |     8,000 |   240,000 |
| 1,000  | 15 分钟 |    32,000 |   960,000 |

若按相同分布每日运行 24 小时，各值乘三；首轮加载、睡眠恢复、手动刷新、店铺同步和失败重试另计，不通过集中补请求伪装全天监控。

- **SP-API Pricing**：每批最多 20 个；只有同一合法请求分组及实际支持批量时，才可按 `ceil(该组对象数/20) × 轮数` 算请求量。默认 0.033 请求/秒约每 30 秒一批，1,000 个对象一轮 50 批约需 25 分钟，默认额度下不能承诺完整 15 分钟更新；还未计延迟与其他调用。[A2] Catalog 默认账号/应用 2 请求/秒，另有应用级限制，不适用于 Pricing。[A15]
- **SP-API 费用**：最新官方声明取消此前计划的 SP-API 按量费和年费；这不是永久免费承诺，卖家计划及配套服务另计。[A16]
- **eBay**：Browse 非 getItems 方法合计默认 5,000/日，getItems 另列 5,000/日；若按一商品一次详情请求，两个 1,000 对象情景均超前者默认日额。Sell Inventory 默认 200 万/日，Fulfillment Order 10 万/日，Analytics 的 traffic/seller standards 为 100/日，不能混用配额。[E10] 加入开发者计划免费不等于所有生产用途和额度免费。[E11]
- **Walmart US**：Pricing Insights 默认 2/分钟，Item Search 200/分钟（SPEC 1,000/日），相关库存读取 200/分钟，按卖家及直连/服务商分配。分页、批量和突发限制独立测算。[W9] API 协议保留按 Pricing Exhibit/另行通知计费的条款，公开资料没有可据以承诺的具体单价。[W7]
- **Keepa**：基本 Product 请求通常每 ASIN 1 token，因此仅基础字段时四档约为 24,000/96,000/240,000/960,000 token/月。强制刷新、Buy Box、评分、库存与 offers 改变成本；offers 按找到的报价页计费且替代基础计费，不能统一写成“每次 HTTP 请求 1 token”。[K2] 月付预付订阅按每分钟 token 生成量限流，未用 token 60 分钟过期；不能只比较整月总量，还要检查运行期间速率和启动突发。套餐实际金额在账号页面确认，文档中的金额示例不当报价。[K3]

最终费用表应分别列固定订阅、按条/按 token 用量、生产许可、刷新/重试和可能的配套服务费用；本次无法获得的报价标记未知，不填写猜测金额。付费或升级须另行获得用户授权。

## 路线取舍与失败行为

| 路线              | 优点                                     | 持续成本与采用条件                                                                                                       |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 平台官方 API      | 结构化、授权边界明确，适合自有业务数据   | 准入/角色、接口升级、限流及许可管理；竞品覆盖和历史许可单独验证。                                                        |
| 第三方数据 API    | 可能提供历史与跨页面整理，减少自维护解析 | 订阅与 token、字段/站点覆盖、时效、供应商合同和平台政策兼容性；服务商声称可采集不等于平台授权。                          |
| 直接网页采集      | 可读取获准页面中存在的信息               | 页面/地区/变体变化、动态渲染、验证码、封禁、缺失价格和运维成本；需先获准、限速并识别挑战页。没有本次成功率或稳定性实验。 |
| 人工材料/平台导出 | 可作为接口未获批时的后续替代方案         | 来源、时间、使用权和字段映射仍需记录；不提供持续监控。本次不增加第七条导入任务。                                         |

检测到登录、验证码、403 或挑战页面时标记不可访问，不把页面当商品数据，不升级为代理池/指纹伪装/账号轮换。401/授权失效进入重授权状态；429 遵循 Retry-After/额度退避；超时和 5xx 有界重试。取消后停止后续请求，迟到响应不得覆盖新任务，局部失败保留其他成功结果。

保存快照时区分平台、站点、商品/变体、卖家、成色、币种、税费、运费、数量单位、地区/优惠条件、采集时间与源更新时间；未知保持未知，缺货/下架/抓取失败不能记作零元。观察形成的历史和供应商提供的既有历史分别标记；跨币种/条件不同的价格不作未经说明的排名。保存期限、撤权删除和历史展示规则由该来源许可决定，不能统一设为永久缓存。

## 后续验证与拆单

数据源验证对竞品监价、自有商品、订单和报表分别给出可用/不可用/待确认结论，选择首个获准来源和站点。任一路线未通过时，其下游仍保持未就绪；前置 Issue 关闭不代表全部路线通过。

验证需要：实际账号身份/资格、生产权限、公开或脱敏样本、许可依据、首发国家及字段、保留期限、历史回看窗口、实测来源时间/延迟、接口预算和可接受费用。eBay 订单旧指南的 90 天与新版发布说明的两年窗口有差异，应以选定端点/版本实测，不将旧指南直接当当前保证。[E5]

功能子单分别覆盖监控、自有商品/价格/库存、订单、经营报表的界面→明确 Rust 业务 IPC→本地持久化路径；不暴露任意 SQL、路径或网络代理。订单按店铺/站点/外部 ID 幂等保存，报表按任务状态处理异步失败与重试；平台同步数据不自动改本方报价/订单或向外写价格。

验收包含离线、无效/撤销授权、限流、超时、缺失与陈旧字段、局部失败、取消、变体/卖家误配、币种/税运口径、分页、重复同步、状态更正、重启和休眠恢复。数据库验证事务迁移、保留既有数据及高版本拒绝降级；UI 验证明暗主题、900 × 600 和键盘。Windows/macOS 桌面与真实选定服务的结果分别记录，mock 或浏览器预览不替代生产接口与桌面证据。

## 一手来源

下列链接是本次研究依据；网页读取或引用不表示目标账号已获生产使用许可。页面内容会变化，实施时须重新核对相关版本和合同。

[A1]: https://developer-docs.amazon/sp-api/docs/catalog-items-api
[A2]: https://developer-docs.amazon/sp-api/lang-en_US/reference/getcompetitivesummary
[A3]: https://developer-docs.amazon/sp-api/lang-en_en/docs/retrieve-featured-offers-batch-asins
[A4]: https://developer-docs.amazon/sp-api/lang-us/docs/get-order-information
[A5]: https://developer-docs.amazon/sp-api/docs/report-type-values-analytics
[A6]: https://affiliate-program.amazon.com/help/operating/policies
[A7]: https://sellercentral.amazon.com/solution-provider/policy?policyType=AUP&locale=en_US
[A8]: https://developer.amazonservices.com/start/getting-started-for-private-developers
[A9]: https://developer-docs.amazon/sp-api/docs/customer-feedback-api
[A10]: https://developer-docs.amazon.com/sp-api/docs/notification-type-values
[A11]: https://developer-docs.amazon/sp-api/docs/marketplace-ids
[A12]: https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation
[A13]: https://sellercentral.amazon.com/solution-provider/policy?policyType=DPP&locale=en_US
[A14]: https://developer-docs.amazon/sp-api/docs/orders-api-migration-guide
[A15]: https://developer-docs.amazon/sp-api/docs/catalog-items-api-rate-limits
[A16]: https://developer.amazonservices.com/cancellation-of-sp-api-fees
[K1]: https://keepa.com/api-docs/
[K2]: https://keepa.com/api-docs/product.html
[K3]: https://keepa.com/api-docs/plans-tokens.html
[E1]: https://developer.ebay.com/api-docs/buy/api-browse.html
[E2]: https://developer.ebay.com/api-docs/buy/static/buy-requirements.html
[E3]: https://www.developer.ebay.com/api-docs/buy/static/ref-marketplace-supported.html
[E4]: https://developer.ebay.com/develop/guides/sell/listing-management
[E5]: https://www.developer.ebay.com/api-docs/sell/fulfillment/static/release-notes.html
[E6]: https://developer.ebay.com/api-docs/sell/analytics/static/overview.html
[E7]: https://developer.ebay.com/api-docs/sell/static/finances/finances-landing.html
[E8]: https://developer.ebay.com/join/api-license-agreement
[E9]: https://www.ebay.com/help/policies/member-behavior-policies/user-agreement?id=5414
[E10]: https://www.developer.ebay.com/develop/get-started/api-call-limits
[E11]: https://developer.ebay.com/
[W1]: https://developer.walmart.com/us-marketplace/docs/get-pricing-insights
[W2]: https://developer.walmart.com/us-marketplace/reference/getsearchresult
[W3]: https://developer.walmart.com/us-marketplace/docs/get-all-orders
[W4]: https://developer.walmart.com/us-marketplace/docs/request-an-item-performance-report
[W5]: https://developer.walmart.com/global-marketplace/docs/global-marketplace-apis
[W6]: https://developer.walmart.com/us-marketplace/docs/authentication-authorization
[W7]: https://developer.walmart.com/us-marketplace/page/terms-and-conditions
[W8]: https://www.walmart.com/help/article/walmart-com-terms-of-use/3b75080af40340d6bbd596f116fae5a0
[W9]: https://developer.walmart.com/us-marketplace/docs/rate-limiting
[R1]: https://www.rfc-editor.org/rfc/rfc9309.html
[R2]: https://www.rfc-editor.org/rfc/rfc8252.html
[W10]: https://developer.walmart.com/us-marketplace/reference/getallitems
[W11]: https://developer.walmart.com/us-marketplace/docs/retrieve-inventory-data
