# Aliyun DCDN Automated Let's Encrypt SSL Certificate

Due to Alibaba Cloud canceling the renewal of free SSL certificates and the high cost of paid certificates, I wrote this to automate the application and renewal of Let's Encrypt SSL certificates for DCDN using Alibaba Cloud's Function Compute service.

## Required RAM Permissions
* AliyunYundunCertFullAccess
* AliyunDNSFullAccess
* AliyunDCDNFullAccess

You can configure more granular permission policies if you prefer, but I didn't bother with that...

## Usage Instructions
1. Create an Alibaba Cloud function and import it from this repository.
2. After the function being created, run `npm install` in WebIDE.
2. Set up two environment variables: `ALIYUN_ACCESS_KEY_ID` and `ALIYUN_ACCESS_KEY_SECRET` (create these in RAM Access Control).
3. After deploying the code, create a `Time Trigger`. Set the interval based on your needs; I set mine to 86400 minutes, which runs every two months.
4. Trigger message (modify according to your needs):
   ```json
   {
        "domainName": "www.example.com",     // DCDN domain
        "emailAddress": "your@email.com",    // Your email address
        "env": "production"                  // Envrionment of Let's Encrypt，production/staging (optional, default is production)
   }
   ```