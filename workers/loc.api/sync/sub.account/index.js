'use strict'

const {
  isSubAccountApiKeys,
  getSubAccountAuthFromAuth
} = require('../../helpers')
const {
  SubAccountCreatingError,
  SubAccountRemovingError
} = require('../../errors')

const {
  decorate,
  injectable,
  inject
} = require('inversify')

const TYPES = require('../../di/types')

class SubAccount {
  constructor (
    dao,
    TABLES_NAMES,
    rService
  ) {
    this.dao = dao
    this.TABLES_NAMES = TABLES_NAMES
    this.rService = rService
  }

  async createSubAccount (args) {
    const { params } = { ...args }
    const { subAccountApiKeys } = { ...params }

    const masterUser = await this.dao.checkAuthInDb(args)

    if (
      !Array.isArray(subAccountApiKeys) ||
      subAccountApiKeys.length === 0
    ) {
      throw new SubAccountCreatingError()
    }

    const apiUsersPromises = subAccountApiKeys.map((auth) => {
      return this.rService._checkAuthInApi({ auth })
    })

    const apiUsers = await Promise.all(apiUsersPromises)
    const subUsers = apiUsers.map((apiUser, i) => {
      const {
        apiKey,
        apiSecret
      } = { ...subAccountApiKeys[i] }

      return {
        ...apiUser,
        apiKey,
        apiSecret
      }
    })

    await this.dao.createSubAccount(
      masterUser,
      subUsers
    )
  }

  async removeSubAccount (args) {
    const { auth } = { ...args }

    if (isSubAccountApiKeys(auth)) {
      throw new SubAccountRemovingError()
    }

    const user = await this.dao.checkAuthInDb(args)
    const masterUserAuth = getSubAccountAuthFromAuth(user)
    const masterUser = await this.dao.checkAuthInDb(
      { auth: masterUserAuth },
      false
    )

    await this.dao.removeSubAccount(masterUser)
  }
}

decorate(injectable(), SubAccount)
decorate(inject(TYPES.DAO), SubAccount, 0)
decorate(inject(TYPES.TABLES_NAMES), SubAccount, 1)
decorate(inject(TYPES.RService), SubAccount, 2)

module.exports = SubAccount
