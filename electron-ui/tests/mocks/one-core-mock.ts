// Mock for @refinio/one.core
export const ensurePlatformLoaded = jest.fn()

export const getInstanceOwnerIdHash = jest.fn().mockReturnValue('mock-owner-id')

export const Person = {
  create: jest.fn().mockResolvedValue({
    id: 'person-1',
    uuid: 'uuid-1'
  })
}

export const Profile = {
  create: jest.fn().mockResolvedValue({
    id: 'profile-1',
    personId: 'person-1'
  })
}

export const Someone = {
  create: jest.fn().mockResolvedValue({
    id: 'someone-1',
    personId: 'person-1',
    idHash: 'hash-1'
  })
}

export class OEvent {
  listen = jest.fn()
  notify = jest.fn()
}