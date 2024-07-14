# 阿里云DCDN自动化Let's Encrypt SSL 证书
> [English version](./README_EN.md)

由于最近阿里云取消了免费SSL证书的续签，收费的证书又太贵，生活所迫，写了这个基于阿里云函数计算功能实现DCDN自动化的Let's Encrypt SSL 证书申请和续签。

## 所需RAM权限
* AliyunYundunCertFullAccess
* AliyunDNSFullAccess
* AliyunDCDNFullAccess

也可以自行配置更细颗粒度的权限策略，但是我懒得弄了...

## 使用方法
1. 创建一个阿里云函数，上传本仓库所有文件。
2. 创建完毕函数之后，在WebIDE里运行`npm install`
3. 配置好两个环境变量：`ALIYUN_ACCESS_KEY_ID` 和 `ALIYUN_ACCESS_KEY_SECRET`（在RAM访问控制里创建）。
4. 部署代码后，创建一个`定时触发器`, 时间间隔自己根据需要定，我设定的是 86400 分钟，每两个月运行一次。
5. 触发消息（根据自己的情况修改）：
   ```json
   {
        "domainName": "www.example.com",     // DCND域名
        "emailAddress": "your@email.com",    // 你自己的电子邮箱地址
        "env": "production"                  // Let's Encrypt 环境，production/staging （选填，默认 production）
   }
   ```