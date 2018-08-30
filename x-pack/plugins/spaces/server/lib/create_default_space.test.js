/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import Boom from 'boom';
import { getClient } from '../../../../server/lib/get_client_shield';
import { createDefaultSpace } from './create_default_space';

jest.mock('../../../../server/lib/get_client_shield', () => ({
  getClient: jest.fn()
}));

let mockCallWithRequest;
beforeEach(() => {
  mockCallWithRequest = jest.fn();
  getClient.mockReturnValue({
    callWithRequest: mockCallWithRequest
  });
});

const createMockServer = (settings = {}) => {

  const {
    defaultExists = false,
    simulateErrorCondition = false
  } = settings;

  const mockGet = jest.fn().mockImplementation(() => {
    if (simulateErrorCondition) {
      throw new Error('unit test: unexpected exception condition');
    }

    if (defaultExists) {
      return;
    }
    throw Boom.notFound('unit test: default space not found');
  });

  const mockCreate = jest.fn().mockReturnValue();

  const mockServer = {
    config: jest.fn().mockReturnValue({
      get: jest.fn()
    }),
    savedObjects: {
      SavedObjectsClient: {
        errors: {
          isNotFoundError: (e) => e.message === 'unit test: default space not found'
        }
      },
      getSavedObjectsRepository: jest.fn().mockImplementation(() => {
        return {
          get: mockGet,
          create: mockCreate,
        };
      })
    }
  };

  mockServer.config().get.mockImplementation(key => {
    return settings[key];
  });

  return mockServer;
};

test(`it creates the default space when one does not exist`, async () => {
  const server = createMockServer({
    defaultExists: false
  });

  await createDefaultSpace(server);

  const repository = server.savedObjects.getSavedObjectsRepository();

  expect(repository.get).toHaveBeenCalledTimes(1);
  expect(repository.create).toHaveBeenCalledTimes(1);
  expect(repository.create).toHaveBeenCalledWith(
    'space',
    { "_reserved": true, "description": "This is your Default Space!", "name": "Default Space" },
    { "id": "default" }
  );
});

test(`it does not attempt to recreate the default space if it already exists`, async () => {
  const server = createMockServer({
    defaultExists: true
  });

  await createDefaultSpace(server);

  const repository = server.savedObjects.getSavedObjectsRepository();

  expect(repository.get).toHaveBeenCalledTimes(1);
  expect(repository.create).toHaveBeenCalledTimes(0);
});

test(`it throws all other errors from the saved objects client`, async () => {
  const server = createMockServer({
    defaultExists: true,
    simulateErrorCondition: true,
  });

  try {
    await createDefaultSpace(server);
    throw new Error(`Expected error to be thrown!`);
  } catch (e) {
    expect(e.message).toEqual('unit test: unexpected exception condition');
  }
});
