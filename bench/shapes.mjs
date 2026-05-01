// Меряем влияние shape объекта на скорость чтения поля в hot path.
//
// Что меряется:
//   - literal           — все поля сразу в литерале, один hidden class
//   - stepwise          — постепенная сборка в том же порядке
//   - polymorphic (2)   — два разных порядка полей, IC становится polymorphic
//   - megamorphic (6)   — шесть разных порядков, IC сваливается в megamorphic
//   - dictionary mode   — литерал + delete лишнего поля -> объект уезжает в dict mode
//
// mitata 1.0+ сам:
//   - прогревает каждый бенч до стабильного состояния
//   - запускает много батчей и считает p50/p75/p99
//   - предупреждает если код выпилило DCE
//   - переключает GC между прогонами
//
// Чтобы V8 не выпилил чтение поля, оборачиваем его в do_not_optimize().

import { run, bench, group, summary, do_not_optimize } from 'mitata'

const N = 100_000

// ---- factories -------------------------------------------------------------

function makeLiteral(i) {
  return { id: i, name: 'user', age: 30 }
}

function makeStepwise(i) {
  const o = {}
  o.id = i
  o.name = 'user'
  o.age = 30
  return o
}

// 2 разных порядка -> 2 hidden class -> polymorphic IC
function makePoly(i) {
  if (i & 1) {
    const o = {}
    o.id = i; o.name = 'user'; o.age = 30
    return o
  } else {
    const o = {}
    o.name = 'user'; o.age = 30; o.id = i
    return o
  }
}

// 6 разных порядков -> megamorphic IC (V8 сдаётся при > 4)
function makeMega(i) {
  const o = {}
  switch (i % 6) {
    case 0: o.id = i; o.name = 'u'; o.age = 30; break
    case 1: o.name = 'u'; o.id = i; o.age = 30; break
    case 2: o.name = 'u'; o.age = 30; o.id = i; break
    case 3: o.age = 30; o.id = i; o.name = 'u'; break
    case 4: o.age = 30; o.name = 'u'; o.id = i; break
    case 5: o.id = i; o.age = 30; o.name = 'u'; break
  }
  return o
}

// delete -> dictionary mode (slow properties)
function makeDict(i) {
  const o = { id: i, name: 'user', age: 30, tmp: 1 }
  delete o.tmp
  return o
}

// ---- pre-built arrays ------------------------------------------------------
// Создаём объекты ДО бенча, чтобы мерить только чтение,
// без аллокаций и работы GC внутри hot loop.

const arrLiteral = Array.from({ length: N }, (_, i) => makeLiteral(i))
const arrStepwise = Array.from({ length: N }, (_, i) => makeStepwise(i))
const arrPoly = Array.from({ length: N }, (_, i) => makePoly(i))
const arrMega = Array.from({ length: N }, (_, i) => makeMega(i))
const arrDict = Array.from({ length: N }, (_, i) => makeDict(i))

// ---- benchmarks ------------------------------------------------------------
// Каждый бенч читает поле .id у случайного объекта из своего массива.
// do_not_optimize защищает результат от dead-code elimination.

group('object shape: field read', () => {
  summary(() => {
    bench('literal (1 shape, fast path)', function* (state) {
      let i = 0
      yield () => {
        do_not_optimize(arrLiteral[i++ % N].id)
      }
    })

    bench('stepwise (same order)', function* (state) {
      let i = 0
      yield () => {
        do_not_optimize(arrStepwise[i++ % N].id)
      }
    })

    bench('polymorphic IC (2 shapes)', function* (state) {
      let i = 0
      yield () => {
        do_not_optimize(arrPoly[i++ % N].id)
      }
    })

    bench('megamorphic IC (6 shapes)', function* (state) {
      let i = 0
      yield () => {
        do_not_optimize(arrMega[i++ % N].id)
      }
    })

    bench('dictionary mode (after delete)', function* (state) {
      let i = 0
      yield () => {
        do_not_optimize(arrDict[i++ % N].id)
      }
    })
  })
})

await run({
  format: 'mitata',
  colors: Boolean(process.stdout.isTTY),
})
