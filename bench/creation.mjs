// Меряем стоимость СОЗДАНИЯ объекта разными способами.
// Это отдельная история от чтения поля: тут речь не про IC,
// а про boilerplate (запомненный V8 шаблон литерала) и transition tree.
//
// Ожидание: literal-форма должна быть быстрее, потому что V8
// аллоцирует объект сразу с готовым layout, минуя проход по дереву переходов.

import { run, bench, group, summary, do_not_optimize } from 'mitata'

group('object shape: creation', () => {
  summary(() => {
    bench('literal { id, name, age }', function* () {
      let i = 0
      yield () => {
        do_not_optimize({ id: i++, name: 'user', age: 30 })
      }
    })

    bench('stepwise (same order)', function* () {
      let i = 0
      yield () => {
        const o = {}
        o.id = i++
        o.name = 'user'
        o.age = 30
        do_not_optimize(o)
      }
    })

    bench('Object.create(null) + assign', function* () {
      let i = 0
      yield () => {
        const o = Object.create(null)
        o.id = i++
        o.name = 'user'
        o.age = 30
        do_not_optimize(o)
      }
    })

    bench('class instance', function* () {
      class User {
        constructor(id) {
          this.id = id
          this.name = 'user'
          this.age = 30
        }
      }
      let i = 0
      yield () => {
        do_not_optimize(new User(i++))
      }
    })

    bench('factory (closure)', function* () {
      const makeUser = (id) => ({ id, name: 'user', age: 30 })
      let i = 0
      yield () => {
        do_not_optimize(makeUser(i++))
      }
    })
  })
})

await run({ format: 'mitata', colors: Boolean(process.stdout.isTTY) })
