#!/usr/bin/env node
// Aggregated test runner: runs all existing test scripts and reports summary.
import { spawnSync } from 'node:child_process'

const testScripts = [
  'smoke',
  'coretest',
  'forcestest',
  'centerstest',
  'centers-neg-test',
  'force-sym',
  'energy',
  'pairs',
  'persist',
  'engine-persist',
  'engine-diagnostics'
  , 'engine-config'
    , 'neighbor'
]

const results = []
for (const script of testScripts) {
  console.log(`\n=== Running: ${script} ===`)
  const r = spawnSync('npm', ['run', script, '--silent'], { 
    stdio: 'inherit',
    timeout: 60000 // 60 second timeout per test to prevent hanging
  })
  results.push({ script, code: r.status === null ? 1 : r.status })
}

const failed = results.filter(r => r.code !== 0)
console.log('\n=== Test Summary ===')
for (const r of results) console.log(`${r.code === 0 ? 'PASS' : 'FAIL'} - ${r.script}`)
if (failed.length) {
  console.error(`\n${failed.length} script(s) failed.`)
  process.exit(1)
} else {
  console.log('\nAll test scripts passed.')
}
