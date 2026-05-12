import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(import.meta.url), '../..')
mkdirSync(join(root, 'results'), { recursive: true })

const header = `Node: ${process.version} | V8: ${process.versions.v8} | ${new Date().toISOString()}\n`
const out = [header]

for (const bench of ['shapes', 'creation']) {
  const result = execFileSync(process.execPath, ['--expose-gc', `bench/${bench}.mjs`], { cwd: root, encoding: 'utf8' })
  out.push(result)
}

const dest = join(root, 'results', 'latest.txt')
writeFileSync(dest, out.join('\n'))
console.log(`Saved → ${dest}`)
