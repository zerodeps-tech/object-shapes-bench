// Прямая проверка V8-internals: какие у объектов hidden classes,
// шарят ли они один Map, в каком они режиме (fast properties vs dictionary).
//
// Запускать с: node --allow-natives-syntax bench/inspect.mjs
//
//   %HaveSameMap(a, b)       — true если у объектов один и тот же hidden class
//   %HasFastProperties(obj)  — true если объект на fast path (не в dict mode)
//   %DebugPrint(obj)         — печатает Map и описание объекта в stderr
//
// noinspection BadExpressionStatementJS,JSVoidFunctionReturnValueUsed

console.log('=== V8 INTERNALS (--allow-natives-syntax) ===')
console.log(`Node: ${process.version} | V8: ${process.versions.v8}`)
console.log('==============================================\n')

console.log('--- 1) literal vs literal: ожидаем один hidden class ---')
const a = { id: 1, name: 'a', age: 10 }
const b = { id: 2, name: 'b', age: 20 }
console.log('  same map:        ', % HaveSameMap(a, b)
)
console.log('  a fast props:    ', % HasFastProperties(a)
)

console.log('\n--- 2) literal vs stepwise (same order): один shape или нет? ---')
const c = { id: 1, name: 'c', age: 10 }
const d = {}
d.id = 2
d.name = 'd'
d.age = 20
console.log('  same map:        ', % HaveSameMap(c, d)
)

console.log('\n--- 3) stepwise разный порядок: точно разные hidden class ---')
const e = {}
e.id = 1
e.name = 'e'
e.age = 10
const f = {}
f.name = 'f'
f.id = 2
f.age = 20
console.log('  same map:        ', % HaveSameMap(e, f)
)

console.log('\n--- 4) delete переводит в dictionary mode ---')
const g = { id: 1, name: 'g', tmp: 99 }
console.log('  before delete fast:', % HasFastProperties(g)
)
delete g.tmp
console.log('  after delete fast: ', % HasFastProperties(g)
)

const h = { id: 2, name: 'h' }
console.log('  clean obj same map as deleted?', % HaveSameMap(g, h)
)

console.log('\n--- 5) DebugPrint объекта в dict mode (см. stderr) ---')
console.log('  ищи в выводе [DictionaryProperties] в строке map')
void % DebugPrint(g)

console.log('\n--- 6) DebugPrint обычного объекта для сравнения ---')
console.log('  ищи [FastProperties]')
void % DebugPrint(h)
