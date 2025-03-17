This project is based on "Capacitor Gallery Plus" by Stephan Fischer.  
该项目以 Stephan Fischer 的 “Capacitor Gallery Plus ”为基础。

Original repository: [https://github.com/stephan-fischer/capacitor-gallery-plus](https://github.com/stephan-fischer/capacitor-gallery-plus)  
原始仓库： [https://github.com/stephan-fischer/capacitor-gallery-plus](https://github.com/stephan-fischer/capacitor-gallery-plus) 

For commercial use, a license must be obtained from the original author:  
[https://github.com/stephan-fischer/capacitor-gallery-plus](https://github.com/stephan-fischer/capacitor-gallery-plus)

如需用于商业用途，必须从原作者处得到许可。
[https://github.com/stephan-fischer/capacitor-gallery-plus](https://github.com/stephan-fischer/capacitor-gallery-plus)

This project is dual-licensed under:  
- **MIT License** – For personal, educational, and open-source use.  
- **Commercial License** – Required for closed-source, proprietary, or commercial use.  
For commercial use, a license must be obtained from the original author:  
[https://github.com/stephan-fischer/capacitor-gallery-plus](https://github.com/stephan-fischer/capacitor-gallery-plus)  

本项目具有双重许可：
- **MIT 许可** - 用于个人、教育和开源用途。 
- **商业许可** - 闭源、专有或商业用途所需的许可。 
如需用于商业用途，必须从原作者处获得许可：
[https://github.com/stephan-fischer/capacitor-gallery-plus](https://github.com/stephan-fischer/capacitor-gallery-plus)  

# 毕业设计2025
## 基于VLM的手机图库分类搜索系统的设计与实现
系统概述

功能概述：

图库前端：实现一个跨平台端的（Android、IOS）图库前端界面[15]，用户将自己的照片放入图库，并上传到VLM服务器，获取关键词用于分类、计算图片数据用于检索。服务端应该具有用户隔离性，保障用户的隐私安全。

自动分类：目前使用百度AI开放平台物体和场景识别接口对图库中的照片标注关键词，然后按关键字（人物、风景、文档）进行排序、分类，确保分类清晰直观。

智能搜索：支持通过关键词或语义搜索快速找到目标图片，例如通过输入“会议”找到相关截图，或输入“金色祥云”找到对应照片，输入一段文本，搜索工具输入到语言模型，与每张图片的特征度进行对比，返回相关度高的图片结果，对结果按相关度进行排序。

重复检测：系统自动检测重复照片，并列举建议提供给用户，用户检查相似照片批量删除，以释放存储空间。

技术实现：

1. Ionic[16]：跨平台开发移动端应用的框架，Ionic 是一个开源 UI 工具包，用于使用 Web 技术（HTML、CSS 和 JavaScript）构建高性能、高质量的移动应用，并集成了 Angular、React 和 Vue 等流行框架。使用令牌对每个用户资源分配独立的访问权限。

2. 云服务：
目前拟采用云服务来实现图库客户端的分类和搜索功能，客户端完成前端展示、照片处理和压缩上传、查询文本、照片分类。服务端拟采用百度云API接口处理计算照片的关键词信息，客户端实现照片分类，VLM服务器计算图片和文本的相关度向量，返回给客户端。客户端计算相似度最高的若干照片，实现智能搜索。

2. VLM模型
在分类方面，目前拟在EasyDL平台上使用百度物体和场景识别VLM模型的API获取照片的关键词，按关键词进行分类。在检索方面，首先实现照片按类别全称和照片元数据（时间、地点、获取到的关键词）的检索，然后对于图片内容，先利用Transformer（需要训练）、EfficientNet（需要训练）或BriVL[17]（可用）提取照片和查询文本的特征向量，并利用欧氏距离算法计算文本特征[18]和图库里所有照片的相关度，返回最高相关度的若干照片。

3. 优化数据结构与并发处理：
考虑到本地图库照片上传是一个长时间的任务，而且用户可能更希望先上传经常浏览的照片，可以考虑用PriorityQueue处理上传队列，新浏览的照片加入队头优先上传[19]。而且单线程的上传、分类、检索效率并不高，所以考虑用并发处理技术[20]，提高检索速度与分类效率。

参考文献：

[1] 顾凯.手机拍摄在短视频平台中的表现特点与应用研究[D].上海音乐学院,2023.DOI:10.27319/d.cnki.gsyyy.2023.000142.

[2] 李同归. “知道感” 任务中的图片和字词的感受性和判断标准[J]. 心理学报, 2000, 3.

[3]Radford A, Kim J W, Hallacy C, et al. Learning transferable visual models from natural language supervision[C]//International conference on machine learning. PMLR, 2021: 8748-8763.

[4]Simonyan K, Zisserman A. Very deep convolutional networks for large-scale image recognition[J]. arXiv preprint arXiv:1409.1556, 2014.

[5]张焱鑫.基于PyQt5和百度AI开放平台的物体图像识别界面系统的设计与实现[J].软件,2021,42(09):58-60+134.

[6]Chen H, Han F X, Niu D, et al. Mix: Multi-channel information crossing for text matching[C]//Proceedings of the 24th ACM SIGKDD international conference on knowledge discovery & data mining. 2018: 110-119.

[7]Weng L, Preneel B. A secure perceptual hash algorithm for image content authentication[C]//IFIP International Conference on Communications and Multimedia Security. Berlin, Heidelberg: Springer Berlin Heidelberg, 2011: 108-121.

[8]米粒.借助腾讯手机管家清理相似照片[J].电脑迷,2015,(09):84.

[9]詹霑. 领域自适应的图像标注与分类研究与实现[D]. 四川:电子科技大学,2022.

[10]Huo Y, Zhang M, Liu G, et al. WenLan: Bridging vision and language by large-scale multi-modal pre-training[J]. arXiv preprint arXiv:2103.06561, 2021.

[11] 卢志武,金琴,宋睿华,等.悟道·文澜：超大规模多模态预训练模型带来了什么？[J].中兴通讯技术,2022,28(02):25-32.


[12]Ye T, Dong L, Xia Y, et al. Differential transformer[J]. arXiv preprint arXiv:2410.05258, 2024.

[13]Facebook批量优化360照片 - 腾讯云开发者社区-腾讯云.https://cloud.tencent.com/developer/article/1871574

[14]Schroff F, Kalenichenko D, Philbin J. Facenet: A unified embedding for face recognition and clustering[C]//Proceedings of the IEEE conference on computer vision and pattern recognition. 2015: 815-823.

[15]Liu Haohua. Design of Miss Photo album APP based on Long Tail theory[J]. Am Sci 2022;18(6):20-29

[16]徐明强.基于Ionic框架+MVC架构的图书馆盘库系统研究[J].电脑与电信,2023,(03):30-32.DOI:10.15966/j.cnki.dnydx.2023.03.011.

[17] Fei N, Lu Z, Gao Y, et al. Towards artificial general intelligence via a multimodal foundation model[J]. Nature Communications, 2022, 13(1): 3094.

[18] 秦钰淑,杨良怀,朱艳超,等.融合图像与文本特征的组合检索方法[J/OL].电子学报,1-10[2025-01-18].https://kns-cnki-net.webvpn.fjut.edu.cn/kcms/detail/11.2087.TN.20250113.1523.014.html.

[19] 陈杰,王俊昌,胡嘉晨,等.针对多样化网络需求下的优先级队列与流量调度算法[J/OL].计算机工程,1-11[2025-01-18].https://doi.org/10.19678/j.issn.1000-3428.0069824.

[20]张晓宇.基于并行处理的计算机图像检索技术[J].信息技术与信息化,2021,(05):95-97.
