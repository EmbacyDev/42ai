import assert from 'node:assert/strict'
import test from 'node:test'
import {chapterValue, chapterPosition, CHAPTER_SCROLL_SPAN, range} from '../src/components/NativeScroll/progress.js'

test('native timeline is continuous, bounded and visits every authored pose',()=>{
  assert.equal(chapterValue(-10),0)
  assert.equal(chapterValue(10),7)
  assert.ok(CHAPTER_SCROLL_SPAN > 7)
  assert.equal(chapterValue(CHAPTER_SCROLL_SPAN - .1),7)
  let previous=0
  for(let i=0;i<=Math.ceil(CHAPTER_SCROLL_SPAN*2000);i++){
    const value=chapterValue(i/2000)
    assert.ok(value>=previous && value<=7)
    assert.ok(value-previous<.002)
    previous=value
  }
  for(let pose=0;pose<7;pose++){
    assert.equal(chapterValue(chapterPosition(pose)),pose)
    assert.equal(chapterValue(chapterPosition(pose)+.2),pose)
    assert.ok(chapterValue(chapterPosition(pose)+(chapterPosition(pose+1)-chapterPosition(pose))*.7)>pose)
    assert.ok(chapterValue(chapterPosition(pose)+(chapterPosition(pose+1)-chapterPosition(pose))*.7)<pose+1)
  }
})

test('revisiting a scroll position produces the same pose without gesture state',()=>{
  const positions=[0,.5,1.2,2.7,4,5.8,7]
  const forward=positions.map(p=>chapterValue(p))
  assert.deepEqual([...positions].reverse().map(p=>chapterValue(p)).reverse(),forward)
  assert.equal(range(-1,0,1),0)
  assert.equal(range(2,0,1),1)
})
