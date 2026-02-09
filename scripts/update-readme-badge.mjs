/**
 * Update the coverage badge in README.md
 *
 * This script reads the generated .badges/coverage.json file and updates
 * the coverage badge URL in README.md with the current percentage and color.
 *
 * Usage: node scripts/update-readme-badge.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

try {
  // Read the coverage badge data
  const badgePath = join(projectRoot, '.badges', 'coverage.json')
  const badge = JSON.parse(readFileSync(badgePath, 'utf8'))

  // Read README
  const readmePath = join(projectRoot, 'README.md')
  let readme = readFileSync(readmePath, 'utf8')

  // Extract percentage and color
  const percentage = badge.message
  const color = badge.color

  // Create the new badge URL (shields.io format)
  const newBadgeUrl = `https://img.shields.io/badge/coverage-${encodeURIComponent(percentage)}-${color}`

  // Update the badge in README (match the coverage badge line)
  const badgeRegex = /!\[Coverage\]\(https:\/\/img\.shields\.io\/badge\/coverage-[^)]+\)/

  if (badgeRegex.test(readme)) {
    readme = readme.replace(badgeRegex, `![Coverage](${newBadgeUrl})`)
    writeFileSync(readmePath, readme)
    console.log(`✓ README.md coverage badge updated to ${percentage}`)
  } else {
    console.error('⚠ Coverage badge not found in README.md')
    console.error('Please ensure the README has a line like:')
    console.error('![Coverage](https://img.shields.io/badge/coverage-XX.XX%25-color)')
    process.exit(1)
  }

  process.exit(0)
} catch (error) {
  console.error('Error updating README badge:', error.message)
  console.error('\nMake sure to run "npm run test:cov" first to generate coverage data.')
  process.exit(1)
}
