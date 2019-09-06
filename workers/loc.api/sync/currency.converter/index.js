'use strict'

const {
  decorate,
  injectable,
  inject
} = require('inversify')
const {
  FindMethodError
} = require('bfx-report/workers/loc.api/errors')

const { splitSymbolPairs } = require('../helpers')
const TYPES = require('../../di/types')

class CurrencyConverter {
  constructor (
    rService,
    dao,
    syncSchema,
    FOREX_SYMBS
  ) {
    this.rService = rService
    this.dao = dao
    this.syncSchema = syncSchema
    this.FOREX_SYMBS = FOREX_SYMBS

    this._COLL_NAMES = {
      PUBLIC_TRADES: 'publicTrades',
      CANDLES: 'candles'
    }
  }

  _isEmptyStr (str) {
    return (
      !str ||
      typeof str !== 'string'
    )
  }

  _getConvertingSymb (symbol) {
    if (typeof symbol !== 'string') {
      return ''
    }
    if (symbol.length < 4) {
      return symbol
    }

    return symbol.replace(/F0$/i, '')
  }

  _getPair (
    item,
    {
      convertTo,
      symbolFieldName
    }
  ) {
    const symbol = this._getConvertingSymb(item[symbolFieldName])
    const separator = symbol.length > 3
      ? ':'
      : ''

    return `t${symbol}${separator}${convertTo}`
  }

  _getPairFromPair (symbol) {
    if (typeof symbol !== 'string') {
      return ''
    }
    if (symbol.length < 8) {
      return symbol
    }
    if (
      symbol[0] !== 't' &&
      symbol[0] !== 'f'
    ) {
      return symbol
    }

    const flag = symbol[0]
    const [firstSymb, lastSymb] = splitSymbolPairs(symbol)
    const _firstSymb = this._getConvertingSymb(firstSymb)
    const _lastSymb = this._getConvertingSymb(lastSymb)
    const separator = (
      _firstSymb.length > 3 ||
      _lastSymb.length > 3
    )
      ? ':'
      : ''

    return `${flag}${_firstSymb}${separator}${_lastSymb}`
  }

  _isRequiredConvFromForex (
    item,
    {
      convertTo,
      symbolFieldName
    }
  ) {
    return this.FOREX_SYMBS
      .filter(s => s !== convertTo)
      .some(s => s === item[symbolFieldName])
  }

  _isRequiredConvToForex (convertTo) {
    return this.FOREX_SYMBS
      .some(s => s === convertTo)
  }

  async _getPublicTradesPrice (
    reqSymb,
    end
  ) {
    if (
      !reqSymb ||
      !Number.isInteger(end)
    ) {
      return null
    }

    const symbol = this._getPairFromPair(reqSymb)
    const { res } = await this.rService._getPublicTrades({
      params: {
        symbol,
        end,
        limit: 1,
        notThrowError: true,
        notCheckNextPage: true
      }
    })

    const publicTrade = Array.isArray(res)
      ? res[0]
      : res
    const { price } = { ...publicTrade }

    return price
  }

  async _getCandleClosedPrice (
    reqSymb,
    end
  ) {
    const candlesSchema = this.syncSchema.getMethodCollMap()
      .get('_getCandles')

    if (
      !reqSymb ||
      !Number.isInteger(end)
    ) {
      return null
    }

    const symbol = this._getPairFromPair(reqSymb)
    const candle = await this.dao.getElemInCollBy(
      candlesSchema.name,
      {
        [candlesSchema.symbolFieldName]: symbol,
        end,
        _dateFieldName: [candlesSchema.dateFieldName]
      },
      candlesSchema.sort
    )
    const { close } = { ...candle }

    return close
  }

  _getPriceMethodName (collName) {
    if (collName === this._COLL_NAMES.CANDLES) {
      return '_getCandleClosedPrice'
    }
    if (collName === this._COLL_NAMES.PUBLIC_TRADES) {
      return '_getPublicTradesPrice'
    }

    throw new FindMethodError()
  }

  _getPriceMethod (collName) {
    const name = this._getPriceMethodName(collName)

    return this[name].bind(this)
  }

  async _getPrice (
    collName = this._COLL_NAMES.CANDLES,
    item,
    {
      convertTo,
      symbolFieldName,
      dateFieldName,
      mts
    }
  ) {
    if (!this._isRequiredConvToForex(convertTo)) {
      return null
    }

    const end = Number.isInteger(mts)
      ? mts
      : item[dateFieldName]
    const isRequiredConvFromForex = this._isRequiredConvFromForex(
      item,
      {
        convertTo,
        symbolFieldName
      }
    )
    const _getPrice = this._getPriceMethod(collName)

    if (isRequiredConvFromForex) {
      const btcPriseIn = await _getPrice(
        `tBTC${item[symbolFieldName]}`,
        end
      )
      const btcPriseOut = await _getPrice(
        `tBTC${convertTo}`,
        end
      )

      if (
        !btcPriseIn ||
        !btcPriseOut ||
        !Number.isFinite(btcPriseIn) ||
        !Number.isFinite(btcPriseOut)
      ) {
        return null
      }

      return btcPriseOut / btcPriseIn
    }

    const price = await _getPrice(
      this._getPair(
        item,
        {
          convertTo,
          symbolFieldName
        }
      ),
      end
    )

    return Number.isFinite(price)
      ? price
      : null
  }

  async _convertBy (
    collName,
    data,
    convSchema
  ) {
    const _convSchema = {
      convertTo: 'USD',
      symbolFieldName: '',
      dateFieldName: '',
      convFields: [{ inputField: '', outputField: '' }],
      ...convSchema
    }
    const {
      convertTo,
      symbolFieldName,
      convFields
    } = _convSchema
    const isArr = Array.isArray(data)
    const elems = isArr
      ? data
      : [data]
    const res = []

    for (const obj of elems) {
      const isNotObj = !obj || typeof obj !== 'object'
      const item = isNotObj ? obj : { ...obj }

      res.push(item)

      if (
        isNotObj ||
        this._isEmptyStr(convertTo) ||
        this._isEmptyStr(symbolFieldName) ||
        this._isEmptyStr(item[symbolFieldName]) ||
        !Array.isArray(convFields) ||
        convFields.length === 0
      ) {
        continue
      }

      const symbol = this._getConvertingSymb(item[symbolFieldName])
      const isSameSymb = convertTo === symbol
      const price = isSameSymb
        ? 1
        : await this._getPrice(
          collName,
          item,
          _convSchema
        )

      if (!Number.isFinite(price)) {
        continue
      }

      convFields.forEach(({ inputField, outputField }) => {
        if (
          this._isEmptyStr(inputField) ||
          this._isEmptyStr(outputField) ||
          !Number.isFinite(item[inputField])
        ) {
          return
        }

        item[outputField] = item[inputField] * price
      })
    }

    return isArr ? res : res[0]
  }

  convertByCandles (data, convSchema) {
    return this._convertBy(
      this._COLL_NAMES.CANDLES,
      data,
      convSchema
    )
  }

  convertByPublicTrades (data, convSchema) {
    return this._convertBy(
      this._COLL_NAMES.PUBLIC_TRADES,
      data,
      convSchema
    )
  }

  /**
   * if api is not available convert by candles
   */
  convert (data, convSchema) {
    try {
      return this.convertByPublicTrades(data, convSchema)
    } catch (err) {
      return this.convertByCandles(data, convSchema)
    }
  }

  /**
   * if api is not available get price from candles
   */
  getPrice (
    reqSymb,
    end
  ) {
    try {
      return this._getPublicTradesPrice(
        reqSymb,
        end
      )
    } catch (err) {
      return this._getCandleClosedPrice(
        reqSymb,
        end
      )
    }
  }
}

decorate(injectable(), CurrencyConverter)
decorate(inject(TYPES.RService), CurrencyConverter, 0)
decorate(inject(TYPES.DAO), CurrencyConverter, 1)
decorate(inject(TYPES.SyncSchema), CurrencyConverter, 2)
decorate(inject(TYPES.FOREX_SYMBS), CurrencyConverter, 3)

module.exports = CurrencyConverter
