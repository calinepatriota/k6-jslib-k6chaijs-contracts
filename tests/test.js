import { describe, expect, chai } from 'https://jslib.k6.io/k6chaijs/4.3.4.0/index.js';
import { initContractPlugin } from '../build/k6chaijs-contracts.min.js';

import { Httpx, Get } from 'https://jslib.k6.io/httpx/0.0.4/index.js';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.0.0/index.js';

import { 
  registerAPIcontract,
  crocodileAPIContract, 
  crocodileListAPIcontract,
  registerAPIResponseContract,
  tokenAuthResponseAPIcontract,
  tokenAuthRequestAPIcontract} from './api_contracts/contracts.js'


initContractPlugin(chai)


export let options = {
  thresholds: {
    // fail the test if any checks fail or any requests fail
    checks: [{ threshold: 'rate == 1.00', abortOnFail: true }],
    http_req_failed: [{ threshold: 'rate == 0.00', abortOnFail: true }],
  },
};

let session = new Httpx();
session.setBaseUrl('https://test-api.k6.io');

function validateContractsPublicCrocodileService(){

  describe('[Crocs service] Fetch public crocs', () => {
    let responses = session.batch([
      new Get('/public/crocodiles/1/'),
      new Get('/public/crocodiles/2/'),
    ]);

    responses.forEach(response => {
      expect(response.status, "response status").to.equal(200);
      expect(response, "My response 1").to.have.validJsonBody()
      expect(response.json(), "Croc API schema").to.matchSchema(crocodileAPIContract)
    });
  });

  describe('[Crocs service] Fetch list of crocs', () => {
    let response = session.get('/public/crocodiles');

    expect(response.status, "response status").to.equal(200)
    expect(response).to.have.validJsonBody()
    expect(response.json(), "Croc List schema").to.matchSchema(crocodileListAPIcontract)
  })
}

function validateAuthService(){

  const USERNAME = `${randomString(10)}@example.com`;
  const PASSWORD = 'superCroc2021';

  describe("[Registration service] user registration", () => {
    let sampleUser = {
      'username': USERNAME,
      'password': PASSWORD,
      'email': USERNAME,
      'first_name': 'John',
      'last_name': 'Smith'
    };

    expect(sampleUser, "user registration").to.matchSchema(registerAPIcontract);

    let response = session.post(`/user/register/`, sampleUser);

    expect(response.status, "status").to.equal(201);
    expect(response).to.have.validJsonBody()
    expect(response.json(), "registration response").to.matchSchema(registerAPIResponseContract);
  });

  describe("[Auth service] user authentication", () => {
    let authData = {
      username: USERNAME,
      password: PASSWORD
    };

    expect(authData, "Auth data payload").to.matchSchema(tokenAuthRequestAPIcontract);

    let resp = session.post(`/auth/token/login/`, authData);

    expect(resp.status, "Auth status").to.be.within(200, 204)
    expect(resp).to.have.validJsonBody()
    expect(resp.json(), "Auth response").to.matchSchema(tokenAuthResponseAPIcontract) // did they reply with the right format?
    expect(resp.json('access'), "auth token").anonymize().to.be.a('string');

    let authToken = resp.json('access');
    // set the authorization header on the session for the subsequent requests.
    session.addHeader('Authorization', `Bearer ${authToken}`);


  });
}

function validateContractCreateCrocodileService(){
  // authentication happened before this call.

  describe('[Croc service] Create a new crocodile', () => {
    let payload = {
      name: `Croc Name`,
      sex: "M",
      date_of_birth: '2019-01-01',
    };

    let resp = session.post(`/my/crocodiles/`, payload);

    expect(resp.status, "Croc creation status").to.equal(201)
    expect(resp).to.have.validJsonBody()
    expect(resp.json()).to.matchSchema(crocodileAPIContract);

    session.newCrocId = resp.json('id'); // caching croc ID for the future.
  });

  describe('[Croc service] Fetch private crocs', () => {
    let response = session.get('/my/crocodiles/');

    expect(response.status, "response status").to.equal(200)
    expect(response).to.have.validJsonBody()
    expect(response).to.matchSchema(crocodileListAPIcontract)
    expect(response.json().length, "number of crocs").to.equal(1);
  })
}

export default function testSuite() {
  validateContractsPublicCrocodileService();
  validateAuthService();
  validateContractCreateCrocodileService();
}
