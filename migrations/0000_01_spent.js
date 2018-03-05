exports.up = db =>
  db.schema.createTable('spent', t => {
    t.string ('invid').primary()
    t.integer('paid_at').notNullable()
    t.enum   ('status', [ 'processing', 'done' ]).default('processing').notNullable()
    t.string ('res').nullable()
  })

exports.down = db => db.schema.dropTable('spent')

