'use strict';

import acme from 'acme-client';
import Alidns20150109 from '@alicloud/alidns20150109';
import Alidcdn20180115 from '@alicloud/dcdn20180115';
import Alicas20200407 from '@alicloud/cas20200407'
import OpenApi from '@alicloud/openapi-client';
import Util from '@alicloud/tea-util';

let ROOT_DOMAIN_NAME = '';
let ENV = 'production'

const createAlidnsClient = async () => {
  const config = new OpenApi.Config({
    accessKeyId: process.env['ALIYUN_ACCESS_KEY_ID'],
    accessKeySecret: process.env['ALIYUN_ACCESS_KEY_SECRET'],
    regionId: 'cn-hangzhou',
  })
  config.endpoint = `alidns.cn-hangzhou.aliyuncs.com`

  return new Alidns20150109.default(config)
}

const createAlidcdnClient = async () => {
  const config = new OpenApi.Config({
    accessKeyId: process.env['ALIYUN_ACCESS_KEY_ID'],
    accessKeySecret: process.env['ALIYUN_ACCESS_KEY_SECRET'],
    regionId: 'cn-hangzhou',
  })
  config.endpoint = `dcdn.aliyuncs.com`

  return new Alidcdn20180115.default(config);
}

const createAlicasClient = async () => {
  const config = new OpenApi.Config({
    accessKeyId: process.env['ALIYUN_ACCESS_KEY_ID'],
    accessKeySecret: process.env['ALIYUN_ACCESS_KEY_SECRET'],
    regionId: 'cn-hangzhou',
  });
  config.endpoint = `cas.aliyuncs.com`;

  return new Alicas20200407.default(config);
}

// Initialize clients
const alidnsClient = await createAlidnsClient()
const alidcdnClient = await createAlidcdnClient()
const alicasClient = await createAlicasClient()

const parseRootDomainName = async (domainName) => {
  const domainNameTokens = domainName.split('.');
  return `${domainNameTokens[domainNameTokens.length - 2]}.${domainNameTokens[domainNameTokens.length - 1]}`
}

const acmeChallengeCreateFn = async (authz, _challenge, keyAuthorization) => {
  console.log(`Addding TXT record key=_acme-challenge.${authz.identifier.value} value=${keyAuthorization}`)

  const addDomainRecordRequest = new Alidns20150109.AddDomainRecordRequest({
    domainName: authz.identifier.value,
    RR: '_acme-challenge',
    type: 'TXT',
    value: keyAuthorization,
  })
  const runtime = new Util.RuntimeOptions({ })

  const max_retries = 5
  let retries = max_retries
  let success = false
  while (!success && retries > 0) {
    retries--

    try {
      const resp = await alidnsClient.addDomainRecordWithOptions(addDomainRecordRequest, runtime)
      if (resp.statusCode != 200) {
        console.error(`Failed to add TXT record, retrying... (${max_retries - retries}/${max_retries})`)
        continue
      }
      console.log(`Successfully added TXT record key=_acme-challenge.${authz.identifier.value} value=${keyAuthorization}`)
  
      success = true
    } catch (e) {
      console.error(`Failed to add TXT record, error: ${e}`)
      continue
    }
  }
}

const acmeChallengeRemoveFn = async (authz, _challenge, keyAuthorization) => {
  console.log(`Removing TXT record key=_acme-challenge.${authz.identifier.value} value=${keyAuthorization}`)

  const describeDomainRecordsRequest = new Alidns20150109.DescribeDomainRecordsRequest({
    domainName: authz.identifier.value,
    RRKeyWord: '_acme-challenge',
    typeKeyWord: 'TXT',
  })
  const runtime = new Util.RuntimeOptions({ })

  const max_retries = 5
  let retries = max_retries
  let success = false
  while (!success && retries > 0) {
    retries--

    try {
      // Firstly, find the domain TXT record.
      let resp = await alidnsClient.describeDomainRecordsWithOptions(describeDomainRecordsRequest, runtime)
  
      if (resp.statusCode != 200) {
        console.warn(`Failed to find the TXT record, abort.`)
        return
      }
      
      const txtRecord = resp.body.domainRecords.record.find(record => record.RR === '_acme-challenge' && record.value === keyAuthorization)
      if (txtRecord === undefined) {
        console.warn(`Failed to find TXT record key=_acme-challenge.${authz.identifier.value} value=${keyAuthorization}, nothing need to be removed.`)
        return
      }
  
      // Found the domain TXT record, try to delete it.
      const deleteDomainRecordRequest = new Alidns20150109.DeleteDomainRecordRequest({
        recordId: txtRecord.recordId,
      })
      
      resp = await alidnsClient.deleteDomainRecordWithOptions(deleteDomainRecordRequest, runtime)
      if (resp.statusCode != 200) {
        console.error(`Failed to remove TXT record , retrying... (${max_retries - retries}/${max_retries})`)
        continue
      }
      console.log(`Successfully removed TXT record key=_acme-challenge.${authz.identifier.value} value=${keyAuthorization}`)

      success = true
    } catch (error) {
      console.error(`Failed to remove TXT record, error: ${e}`)
      continue
    }
  }

  if (!success) {
    console.error('Failed to remove TXT record!')
  }
}

const deleteExistingSslCerts = async () => {
  console.log('Deleting existing SSL certificates')

  const listUserCertificateOrderRequest = new Alicas20200407.ListUserCertificateOrderRequest({
    keyword: ROOT_DOMAIN_NAME,
    orderType: 'UPLOAD',
  });
  try {
    const resp = await alicasClient.listUserCertificateOrderWithOptions(listUserCertificateOrderRequest, new Util.RuntimeOptions({ }));
    resp.body.certificateOrderList.forEach(async cert => {
      const deleteUserCertificateRequest = new Alicas20200407.DeleteUserCertificateRequest({
        certId: cert.certificateId,
      });

      const respDel = await alicasClient.deleteUserCertificateWithOptions(deleteUserCertificateRequest, new Util.RuntimeOptions({ }))
      if (respDel.statusCode != 200) {
        console.warn(`Failed to delete certificate: ${cert}`)
      } else {
        console.log(`Successfully deleted certificate: ${cert.name}`)
      }
    })

  } catch (error) {
    console.log(error);
  }
}

const deploySslCert = async (domainName, privateKey, cert) => {
  console.log('Deploying SSL certificate')

  await deleteExistingSslCerts()

  const setDcdnDomainSSLCertificateRequest = new Alidcdn20180115.SetDcdnDomainSSLCertificateRequest({
    SSLProtocol: 'on',
    SSLPub: cert,
    SSLPri: `${privateKey}`,
    domainName: domainName,
    certName: `letsencrypt.${ROOT_DOMAIN_NAME}`,
    certType: 'upload',
  });
  const runtime = new Util.RuntimeOptions({ });
  try {
    const resp = await alidcdnClient.setDcdnDomainSSLCertificateWithOptions(setDcdnDomainSSLCertificateRequest, runtime);
    if (resp.statusCode != 200) {
      console.error('Failed to deploy SSL certificate!')
      return
    }
  } catch (e) {
    console.error(e);
    return
  }

  console.log(`Successfully deployed the SLL certificate for ${ROOT_DOMAIN_NAME}`)
}

const requestSslCert = async (domainName, emailAddress) => {
  /**
   * Initialize ACME client
   */

  console.log('Initializing ACME client');
  const letsencryptEndpoint = ENV == 'production' ? acme.directory.letsencrypt.production : acme.directory.letsencrypt.staging
  const acmeClient = new acme.Client({
      directoryUrl: letsencryptEndpoint,
      accountKey: await acme.crypto.createPrivateKey(),
  })

  /**
   * Order wildcard certificate
   */

  console.log(`Creating CSR for ${ROOT_DOMAIN_NAME} and *.${ROOT_DOMAIN_NAME}`)
  const [key, csr] = await acme.crypto.createCsr({
      altNames: [ROOT_DOMAIN_NAME, `*.${ROOT_DOMAIN_NAME}`],
  })

  console.log(`Ordering certificate for ${ROOT_DOMAIN_NAME}`);
  const cert = await acmeClient.auto({
      csr,
      email: emailAddress,
      termsOfServiceAgreed: true,
      challengePriority: ['dns-01'],
      challengeCreateFn: acmeChallengeCreateFn,
      challengeRemoveFn: acmeChallengeRemoveFn,
  });

  console.log(`Certificate for ${ROOT_DOMAIN_NAME} created successfully`)

  await deploySslCert(domainName, key, cert)
}

export const handler = async (eventBuf, _context) => {
  const event = JSON.parse(eventBuf.toString())
  const eventPayload = JSON.parse(event.payload)
  
  if (eventPayload.domainName === undefined) {
    console.error('domainName should not be empty!')
    return 'Operation failed!'
  }

  if (eventPayload.emailAddress == undefined) {
    console.error('emailAddress should not be empty!')
    return 'Operation failed!'
  }

  if (eventPayload.env != undefined) {
    ENV = eventPayload.env
  }
  console.log(`The Let's Encrypt environment: ${ENV}`)

  ROOT_DOMAIN_NAME = await parseRootDomainName(eventPayload.domainName)
  console.log(`ROOT_DOMAIN_NAME: ${ROOT_DOMAIN_NAME}`)

  try {
    await requestSslCert(eventPayload.domainName, eventPayload.emailAddress)
  } catch (e) {
    console.error(e)
    return 'Operation failed!'
  }

  return 'Operation successful!'
}