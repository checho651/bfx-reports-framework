'use strict'

const TABLES_NAMES = require('./tables-names')

module.exports = {
  ALL: '_ALL',
  PUBLIC: '_PUBLIC',
  PRIVATE: '_PRIVATE',
  LEDGERS: TABLES_NAMES.LEDGERS,
  TRADES: TABLES_NAMES.TRADES,
  FUNDING_TRADES: TABLES_NAMES.FUNDING_TRADES,
  PUBLIC_TRADES: TABLES_NAMES.PUBLIC_TRADES,
  ORDERS: TABLES_NAMES.ORDERS,
  MOVEMENTS: TABLES_NAMES.MOVEMENTS,
  FUNDING_OFFER_HISTORY: TABLES_NAMES.FUNDING_OFFER_HISTORY,
  FUNDING_LOAN_HISTORY: TABLES_NAMES.FUNDING_LOAN_HISTORY,
  FUNDING_CREDIT_HISTORY: TABLES_NAMES.FUNDING_CREDIT_HISTORY,
  TICKERS_HISTORY: TABLES_NAMES.TICKERS_HISTORY,
  POSITIONS_HISTORY: TABLES_NAMES.POSITIONS_HISTORY,
  POSITIONS_SNAPSHOT: TABLES_NAMES.POSITIONS_SNAPSHOT,
  SYMBOLS: TABLES_NAMES.SYMBOLS,
  MAP_SYMBOLS: TABLES_NAMES.MAP_SYMBOLS,
  INACTIVE_CURRENCIES: TABLES_NAMES.INACTIVE_CURRENCIES,
  INACTIVE_SYMBOLS: TABLES_NAMES.INACTIVE_SYMBOLS,
  FUTURES: TABLES_NAMES.FUTURES,
  CURRENCIES: TABLES_NAMES.CURRENCIES,
  CANDLES: TABLES_NAMES.CANDLES,
  STATUS_MESSAGES: TABLES_NAMES.STATUS_MESSAGES,
  LOGINS: TABLES_NAMES.LOGINS,
  CHANGE_LOGS: TABLES_NAMES.CHANGE_LOGS,
  PAY_INVOICE_LIST: TABLES_NAMES.PAY_INVOICE_LIST
}
