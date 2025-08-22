// Mock for @refinio/one.models
export default class MultiUser {
  loginOrRegister = jest.fn().mockResolvedValue(true)
  logout = jest.fn().mockResolvedValue(true)
  
  constructor(config: any) {
    // Mock constructor
  }
}

export class LeuteModel {
  init = jest.fn().mockResolvedValue(true)
  shutdown = jest.fn().mockResolvedValue(true)
  getSomeone = jest.fn()
  addSomeoneElse = jest.fn()
  
  constructor() {}
}

export class ChannelManager {
  init = jest.fn().mockResolvedValue(true)
  shutdown = jest.fn().mockResolvedValue(true)
  channels = []
  onUpdated = {
    listen: jest.fn()
  }
  
  constructor() {}
}

export class StateMachine {
  state = 'Uninitialised'
  
  constructor() {}
  
  transitionTo = jest.fn()
  waitFor = jest.fn().mockResolvedValue(true)
}

export const RecipesStable = []
export const RecipesExperimental = []