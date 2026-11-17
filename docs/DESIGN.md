# 蓝白云层阅读界面

2026-11-17，v2.0.3。祖老大指定[这张Pinterest海报](https://www.pinterest.com/pin/629307747914144597/)为当前视觉方向，取代v2.0.2的立体期刊和蓝紫暖橙方案。

## 从参考到网页

实际查看了指定Pin的海报：深蓝天空、大面积柔软白云、克制的小字与空白。网页借鉴配色、云层边缘和安静的文字层级，不嵌入原海报、商标、日期或文案。

- 首屏采用横向蓝天白云背景与白色衬线标题，云在上方和右侧，文字在较暗的蓝色区域。
- 阅读区保持浅色底、白色卡片和海蓝控件，日期、栏目、搜索、编辑与日更沿用原功能。
- 手机单独调整裁切与文字位置，确保白字避开明亮的云，并保留可读的底部蓝色区域。
- 有真实新闻来源图时继续优先展示；缺图时用栏目文字与云层主题背景承接。装饰背景不对应真实新闻现场、地点或指标。
- 复用既有原生前端与本机后台，不增加框架、外部图片服务、模型接口或自动化。

## 云图与生成说明

项目文件：`web/assets/cloud-sky.jpg`，1672×941，192,332字节。由内置imagegen生成新的装饰背景，再转为网页JPEG。参考海报只用于风格研究，不随源码上传。背景随项目发布，页面无需连接图片生成服务。

生成提示词：

> Create an original photographic website hero BACKGROUND, wide landscape 16:9, 2048 by 1152. Premium minimalist Chinese summer editorial poster mood: saturated deep cobalt / Prussian blue clear sky, approximately #073B7C at bottom and left, subtly brighter sapphire near the cloud. A single immense, extremely soft natural white cumulus cloud enters from the TOP RIGHT, extending across the upper right half with an irregular diagonal fluffy edge and realistic delicate pale blue grey cloud volume, like cotton in clear daylight. Most of left half and lower half must remain clean uninterrupted deep blue negative space for white HTML typography. The cloud should take about 40 percent of the image, never cover the lower left. Calm, refined, unhurried, understated photographic quality and finely textured natural atmosphere, no dramatic storm, no purple, no peach. Only blue sky and white cloud, absolutely NO text, NO letters, NO logos, NO watermark, NO poster frame, NO magazine, NO spheres, NO objects, NO horizon or landscape. This is decorative artwork for a news reading app, not a photo of any news event.

提示目标与实际产出尺寸分别记录，以实际1672×941为准。网页字体、标题、日期及按钮均为HTML元素，可以选择、操作和随配置更新，不烧入图片。

## 已验证与边界

桌面1220px、手机390px初检及搜索/展开正常，整页无横向溢出；本机模式云图加载正常，JPEG返回image/jpeg；手机设置框352px且内部无横向溢出。24项业务检查通过。视觉初检和发布成功不等于使用者已认可审美；未在本轮重跑模型采集或跨系统安装。

历史版本与更早的MotionSites、Pinterest杂志、Recent参考记录留在Git历史。本轮按用户最新指定参考收敛，不混搭上版风格。
