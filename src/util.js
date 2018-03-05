const pwrap = fn => (req, res, next) => fn(req, res, next).catch(next)

const only = (o, ...keys) => keys.reduce((r, k) => (r[k] = o[k], r), {})

const now = _ => Date.now() / 1000 | 0

module.exports = { pwrap, only, now }
