[![Node](https://img.shields.io/badge/node-20%20%7C%2022%20%7C%2024-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/zerodeps-tech/object-shapes-bench/actions/workflows/bench.yml/badge.svg)](https://github.com/zerodeps-tech/object-shapes-bench/actions/workflows/bench.yml)

# object-shapes-bench

Бенчмарки к статье **«Объекты в JS не бесплатные»** из канала [@zero_deps](https://t.me/zero_deps).  
Меряем, сколько реально стоит читать поле объекта в зависимости от того, в каком состоянии находится V8 inline cache — и что происходит после `delete`, когда объект уезжает в dictionary mode.

## Запуск

```bash
git clone https://github.com/zerodeps-tech/object-shapes-bench
cd object-shapes-bench
npm install
npm run bench
```

Требует **Node.js 20+**.

## Что меряется

- **`bench/shapes.mjs`** — стоимость чтения поля (`obj.id`) при разных состояниях IC: monomorphic, polymorphic, megamorphic, dictionary mode.
- **`bench/creation.mjs`** — стоимость создания объекта: литерал, постепенная сборка, `Object.create(null)`, `class`, фабричная функция.
- **`bench/inspect.mjs`** — V8 intrinsics: `%HaveSameMap()`, `%HasFastProperties()`, `%DebugPrint()` — проверяем состояние объектов изнутри.

## Результаты

Полные данные с p75/p99 и гистограммами — в `results/`.

**Локально — Apple M4, arm64-darwin:**

```
• object shape: field read (avg ns/iter)

                               Node 20   Node 22   Node 24
  literal (1 shape, fast path)   1.11      1.10      1.04
  stepwise (same order)          1.07      1.05      1.07
  polymorphic IC (2 shapes)      1.16      1.16      1.13
  megamorphic IC (6 shapes)      3.21      3.13      3.17
  dictionary mode (after delete) 1.05 *   24.77     27.12

  * Node 20 / V8 11.3 — см. примечание ниже.
```

```
• object shape: creation (avg ns/iter)

                               Node 20   Node 22   Node 24
  literal { id, name, age }      3.97      3.62      3.70
  stepwise (same order)          4.83      4.18      4.25
  Object.create(null) + assign  24.29     21.74     21.66
  class instance                 3.88      3.58      3.95
  factory (closure)              3.89      3.58      2.63
```

Абсолютные значения зависят от железа и архитектуры — CI-замеры (x64-linux) доступны в артефактах каждого [Actions run](https://github.com/zerodeps-tech/object-shapes-bench/actions).

## Как читать

- **literal vs stepwise** — почти не отличаются по скорости: финальный layout эквивалентен, хотя формально hidden class разный. Литерал идёт через boilerplate (V8 запоминает «шаблон» и аллоцирует объект сразу с готовым layout), stepwise — через transitions. На скорости чтения это не сказывается, `%HaveSameMap()` возвращает `false`.
- **polymorphic IC до 4 shapes** — мелкий оверхед (~10%), V8 спокойно тянет.
- **megamorphic** (4+ shapes на одном call site) — **~3x** к стоимости чтения.
- **dictionary mode после `delete`** — **~6x–10x медленнее** на современном V8 (Node 22+), точная цифра зависит от железа; обратно объект не вернётся.
- **`Object.create(null)`** — V8 инициализирует объект в dictionary mode сразу, без прохода через transition tree: **6–8x** дороже литерала при создании.

### Примечание про Node 20: `delete` вёл себя иначе

На Node 20 / V8 11.3 dict-mode bench показывает ~1 ns — как literal. С версии node 22 были изменения в поведении V8.

`%HasFastProperties()` показывает поведение в каждой версии:

```
                                    Node 20  Node 22  Node 24
delete последнего поля (o.tmp):      true     false    false
delete среднего поля (o.name):       false    false    false
```

На V8 11.3 удаление **последнего добавленного** поля оставляло объект на fast path — V8 откатывал hidden class по back pointer к предыдущему состоянию. На **V8 12.4 эту оптимизацию убрали полностью**: любой `delete` теперь переводит объект в dictionary mode.

## Trace deopts и inspect IC state

```bash
# Деоптимизации и оптимизации TurboFan
npm run bench:trace 2>&1 | grep -E 'opt|deopt' | head -50

# Прямая проверка hidden classes через V8 intrinsics
npm run bench:inspect
```

`bench/inspect.mjs` использует `%HaveSameMap()`, `%HasFastProperties()` и `%DebugPrint()` чтобы показать:
- два литерала `{a, b, c}` шарят один hidden class (ожидаемо)
- литерал и stepwise при том же порядке полей — **разные** hidden class, хотя layout эквивалентен
- объект после `delete` физически в `[DictionaryProperties]`-режиме (см. stderr `%DebugPrint`)
- свойства уехали в `NameDictionary` вместо in-object слотов
- `back pointer: undefined` — объект выпал из transition tree, обратной дороги нет

Примечание: Проверяем IC косвенно — через бенч, а состояние объектов — через intrinsics.

## Воспроизводимость

| | Версия |
|---|---|
| Node.js | 20.20.2 / 22.18.0 / 24.14.1 |
| V8 | 11.3.244.8 / 12.4.254.21 / 13.6.233.17 |
| mitata | 1.0.34 |
| CPU (локально) | Apple M4, arm64-darwin |
| CPU (CI) | AMD EPYC 7763 / 9V74, Intel Xeon Platinum 8370C, x64-linux |

Методология:
- **mitata** прогревает каждый бенч до стабильного состояния (Sparkplug → Maglev → TurboFan).
- `do_not_optimize()` оборачивает результат чтения — V8 не выпиливает код через DCE.
- Объекты **предсозданы** до начала замеров — в hot loop только чтение поля, без аллокаций.
- Считаются p50/p75/p99 — `avg` сам по себе не показателен на шумных CPU.

Сырые результаты по версиям — в `results/node-NN.txt`.

## Ссылки

- Статья: _[ссылка появится после публикации]_ — [@zero_deps](https://t.me/zero_deps)
- Слайды: _[ссылка появится после митапа]_
- Канал: [t.me/zero_deps](https://t.me/zero_deps) — Node.js perf, V8 internals, highload.

---

MIT © [VaskoDeGama](https://github.com/VaskoDeGama) / zero_deps
