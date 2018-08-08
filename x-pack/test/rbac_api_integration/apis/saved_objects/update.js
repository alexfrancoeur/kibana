/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import expect from 'expect.js';
import { AUTHENTICATION } from '../lib/authentication';

export default function ({ getService }) {
  const supertest = getService('supertestWithoutAuth');
  const esArchiver = getService('esArchiver');

  describe('update', () => {
    const expectResults = resp => {
      // loose uuid validation
      expect(resp.body).to.have.property('id').match(/^[0-9a-f-]{36}$/);

      // loose ISO8601 UTC time with milliseconds validation
      expect(resp.body).to.have.property('updated_at').match(/^[\d-]{10}T[\d:\.]{12}Z$/);

      expect(resp.body).to.eql({
        id: resp.body.id,
        type: 'visualization',
        updated_at: resp.body.updated_at,
        version: 2,
        attributes: {
          title: 'My second favorite vis'
        }
      });
    };

    const expectNotFound = resp => {
      expect(resp.body).eql({
        statusCode: 404,
        error: 'Not Found',
        message: 'Saved object [visualization/not an id] not found'
      });
    };

    const expectRbacForbidden = resp => {
      expect(resp.body).to.eql({
        statusCode: 403,
        error: 'Forbidden',
        message: `Unable to update visualization, missing action:saved_objects/visualization/update`
      });
    };

    const createExpectLegacyForbidden = username => resp => {
      expect(resp.body).to.eql({
        statusCode: 403,
        error: 'Forbidden',
        //eslint-disable-next-line max-len
        message: `action [indices:data/write/update] is unauthorized for user [${username}]: [security_exception] action [indices:data/write/update] is unauthorized for user [${username}]`
      });
    };

    const updateTest = (description, { auth, tests }) => {
      describe(description, () => {
        before(() => esArchiver.load('saved_objects/spaces'));
        after(() => esArchiver.unload('saved_objects/spaces'));
        it(`should return ${tests.exists.statusCode}`, async () => {
          await supertest
            .put(`/api/saved_objects/visualization/dd7caf20-9efd-11e7-acb3-3dab96693fab`)
            .auth(auth.username, auth.password)
            .send({
              attributes: {
                title: 'My second favorite vis'
              }
            })
            .expect(tests.exists.statusCode)
            .then(tests.exists.response);
        });

        describe('unknown id', () => {
          it(`should return ${tests.doesntExist.statusCode}`, async () => {
            await supertest
              .put(`/api/saved_objects/visualization/not an id`)
              .auth(auth.username, auth.password)
              .send({
                attributes: {
                  title: 'My second favorite vis'
                }
              })
              .expect(tests.doesntExist.statusCode)
              .then(tests.doesntExist.response);
          });
        });
      });
    };

    updateTest(`not a kibana user`, {
      auth: {
        username: AUTHENTICATION.NOT_A_KIBANA_USER.USERNAME,
        password: AUTHENTICATION.NOT_A_KIBANA_USER.PASSWORD,
      },
      tests: {
        exists: {
          statusCode: 403,
          response: expectRbacForbidden,
        },
        doesntExist: {
          statusCode: 403,
          response: expectRbacForbidden,
        },
      }
    });

    updateTest(`superuser`, {
      auth: {
        username: AUTHENTICATION.SUPERUSER.USERNAME,
        password: AUTHENTICATION.SUPERUSER.PASSWORD,
      },
      tests: {
        exists: {
          statusCode: 200,
          response: expectResults,
        },
        doesntExist: {
          statusCode: 404,
          response: expectNotFound,
        },
      }
    });

    updateTest(`kibana legacy user`, {
      auth: {
        username: AUTHENTICATION.KIBANA_LEGACY_USER.USERNAME,
        password: AUTHENTICATION.KIBANA_LEGACY_USER.PASSWORD,
      },
      tests: {
        exists: {
          statusCode: 200,
          response: expectResults,
        },
        doesntExist: {
          statusCode: 404,
          response: expectNotFound,
        },
      }
    });

    updateTest(`kibana legacy dashboard only user`, {
      auth: {
        username: AUTHENTICATION.KIBANA_LEGACY_DASHBOARD_ONLY_USER.USERNAME,
        password: AUTHENTICATION.KIBANA_LEGACY_DASHBOARD_ONLY_USER.PASSWORD,
      },
      tests: {
        exists: {
          statusCode: 403,
          response: createExpectLegacyForbidden(AUTHENTICATION.KIBANA_LEGACY_DASHBOARD_ONLY_USER.USERNAME),
        },
        // We're executing the get before a delete here to ensure the object is in the right space, and it's
        // not found. This is somewhat confusing, but the user is authorized to GET objects so it's not disclosing
        // the existence of an object they shouldn't be able to see.
        doesntExist: {
          statusCode: 404,
          response: expectNotFound,
        },
      }
    });

    updateTest(`kibana dual-privileges user`, {
      auth: {
        username: AUTHENTICATION.KIBANA_DUAL_PRIVILEGES_USER.USERNAME,
        password: AUTHENTICATION.KIBANA_DUAL_PRIVILEGES_USER.PASSWORD,
      },
      tests: {
        exists: {
          statusCode: 200,
          response: expectResults,
        },
        doesntExist: {
          statusCode: 404,
          response: expectNotFound,
        },
      }
    });

    updateTest(`kibana dual-privileges dashboard only user`, {
      auth: {
        username: AUTHENTICATION.KIBANA_DUAL_PRIVILEGES_DASHBOARD_ONLY_USER.USERNAME,
        password: AUTHENTICATION.KIBANA_DUAL_PRIVILEGES_DASHBOARD_ONLY_USER.PASSWORD,
      },
      tests: {
        exists: {
          statusCode: 403,
          response: expectRbacForbidden,
        },
        doesntExist: {
          statusCode: 403,
          response: expectRbacForbidden,
        },
      }
    });

    updateTest(`kibana rbac user`, {
      auth: {
        username: AUTHENTICATION.KIBANA_RBAC_USER.USERNAME,
        password: AUTHENTICATION.KIBANA_RBAC_USER.PASSWORD,
      },
      tests: {
        exists: {
          statusCode: 200,
          response: expectResults,
        },
        doesntExist: {
          statusCode: 404,
          response: expectNotFound,
        },
      }
    });

    updateTest(`kibana rbac dashboard only user`, {
      auth: {
        username: AUTHENTICATION.KIBANA_RBAC_DASHBOARD_ONLY_USER.USERNAME,
        password: AUTHENTICATION.KIBANA_RBAC_DASHBOARD_ONLY_USER.PASSWORD,
      },
      tests: {
        exists: {
          statusCode: 403,
          response: expectRbacForbidden,
        },
        doesntExist: {
          statusCode: 403,
          response: expectRbacForbidden,
        },
      }
    });

  });
}
