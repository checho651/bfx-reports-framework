'use strict'

const {
  DbMigrationVerCorrectnessError,
  DbVersionTypeError,
  MigrationLaunchingError
} = require('../../../errors')

const Migration = require('./migration')

const { decorateInjectable } = require('../../../di/utils')

class DbMigrator {
  constructor (
    migrationsFactory,
    TABLES_NAMES,
    syncSchema,
    logger,
    dbBackupManager,
    processMessageManager
  ) {
    this.migrationsFactory = migrationsFactory
    this.TABLES_NAMES = TABLES_NAMES
    this.syncSchema = syncSchema
    this.logger = logger
    this.dbBackupManager = dbBackupManager
    this.processMessageManager = processMessageManager
  }

  setDao (dao) {
    this.dao = dao
  }

  getSupportedDbVer () {
    return this.syncSchema.SUPPORTED_DB_VERSION
  }

  getMigrations (versions = [1]) {
    return this.migrationsFactory(versions)
  }

  range (start = 0, end) {
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end)
    ) {
      throw new DbVersionTypeError()
    }

    const isReverse = start > end
    const _start = isReverse
      ? end
      : start
    const _end = isReverse
      ? start
      : end
    const offset = _start + 1

    const range = Array(Math.abs(_end - _start))
      .fill()
      .map((item, i) => offset + i)

    return isReverse
      ? range.reverse()
      : range
  }

  async migrate (ver, isDown) {
    if (
      !Number.isInteger(ver) &&
      !Array.isArray(ver)
    ) {
      throw new DbMigrationVerCorrectnessError()
    }

    const versions = Array.isArray(ver)
      ? ver
      : [ver]
    this.logger.debug(`[Start of migrations]: ${versions.join(', ')}`)

    const migrations = this.getMigrations(versions)

    for (const migration of migrations) {
      if (!(migration instanceof Migration)) {
        continue
      }

      const ver = migration.getVersion()

      try {
        await migration.launch(isDown)
      } catch (err) {
        this.logger.debug(`[ERR_DB_MIGRATION_V${ver}_HAS_FAILED]`)
        this.logger.error(err)

        this.processMessageManager.sendState(
          this.processMessageManager.PROCESS_MESSAGES.ERROR_MIGRATIONS
        )

        throw new MigrationLaunchingError()
      }
    }

    this.logger.debug('[Migrations completed successfully]')
    this.processMessageManager.sendState(
      this.processMessageManager.PROCESS_MESSAGES.READY_MIGRATIONS
    )
  }

  /**
   * @abstract
   */
  async migrateFromCurrToSupportedVer () {
    const isDBEmpty = await this.dao.isDBEmpty()

    if (isDBEmpty) {
      return
    }

    const supportedVer = this.getSupportedDbVer()
    const currVer = await this.dao.getCurrDbVer()

    if (
      !Number.isInteger(supportedVer) ||
      !Number.isInteger(currVer)
    ) {
      throw new DbVersionTypeError()
    }
    if (currVer === supportedVer) {
      return
    }

    const isDown = currVer > supportedVer
    const versions = this.range(currVer, supportedVer)

    await this.dbBackupManager.backupDb({ currVer, supportedVer })
    await this.migrate(versions, isDown)
  }
}

decorateInjectable(DbMigrator)

module.exports = DbMigrator
