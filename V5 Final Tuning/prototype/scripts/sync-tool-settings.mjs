import {readFile, writeFile} from 'node:fs/promises'
import {defaults, sections} from '../../../5 screen Tool/src/settings.js'
const source = new URL('../../../5 screen Tool/src/base-settings.json', import.meta.url)
const destination = new URL('../src/components/PhysicsBehaviorSection/toolBaseSettings.json', import.meta.url)
const saved = JSON.parse(await readFile(source, 'utf8'))
if(saved.scenes?.length !== 3) throw new Error('Expected three saved tool scenes')
const scenes = defaults().map((preset, index) => ({...preset, ...saved.scenes[index]}))
for(const [index, scene] of scenes.entries()) {
  for(const [, controls] of sections) for(const [key] of controls) {
    if(scene[key] === undefined) throw new Error(`Missing ${key} in scene ${index+1}`)
  }
}
const snapshot = {version: saved.version ?? 1, scenes}
if(process.argv.includes('--check')) {
  const current = JSON.parse(await readFile(destination, 'utf8'))
  if(JSON.stringify(current.scenes) !== JSON.stringify(scenes)) throw new Error('Website settings differ from saved tool baseline; run sync-tool-settings.mjs')
  console.log(`All ${Object.keys(scenes[0]).length} settings match in all three scenes.`)
} else {
  await writeFile(destination, JSON.stringify(snapshot, null, 2)+'\n')
  console.log('Copied complete saved tool settings for all three scenes.')
}
