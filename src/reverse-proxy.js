#!/usr/bin/env node

const app    = require('express')()
    , config = require('js-yaml').safeLoad(require('fs').readFileSync(process.argv[2] || 'paypercall.yaml'))
    , proxy  = require('http-proxy').createProxyServer({ target: config.upstreamUrl || process.env.UPSTREAM_URL })

const pay = require('./paypercall')({
  chargeUrl:   process.env.CHARGE_URL     // optional, defaults to http://localhost:9112
, chargeToken: process.env.CHARGE_TOKEN   // required
, dbPath:      process.env.DB_PATH        // optional, defaults to ./paypercall.db
, currency:    process.env.CURRENCY       // optional, defaults to BTC
, secret:      process.env.TOKEN_SECRET   // optional, generated based on CHARGE_TOKEN by default
, invoiceExp:  process.env.INVOICE_EXPIRY // optional, defaults to 1 hour
, accessExp:   process.env.ACCESS_EXPIRY  // optional, defaults to 1 hour
, ...config // override with YAML config
})

app.set('port', config.port || process.env.PORT || 4000)
app.set('host', config.host || process.env.HOST || 'localhost')
app.set('trust proxy', config.proxied || process.env.PROXIED || 'loopback')

app.enable('strict routing')
app.enable('case sensitive routing')
app.disable('x-powered-by')
app.disable('etag')

app.use(require('morgan')('dev'))

const proxyweb = proxy.web.bind(proxy)

Object.keys(config.endpoints).forEach(ep => {
  const [ method, path ] = ep.split(' ', 2), price = ''+config.endpoints[ep]
  app[method.toLowerCase()](path, pay(...price.split(' ')), proxyweb)
})

app.listen(app.settings.port, app.settings.host, _ =>
  console.log(`HTTP server running on ${ app.settings.host }:${ app.settings.port }`))
