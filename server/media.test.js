import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectMedia} from './media.js';
test('recognizes supported media signatures independently of claimed filename',()=>{
 assert.equal(detectMedia(Buffer.from('89504e470d0a1a0a00000000','hex')).type,'image/png');
 assert.equal(detectMedia(Buffer.from('GIF89a123456789')).type,'image/gif');
 assert.equal(detectMedia(Buffer.from('1a45dfa30000000000000000','hex')).type,'audio/webm');
 assert.equal(detectMedia(Buffer.from('OggS123456789')).type,'audio/ogg');
 assert.equal(detectMedia(Buffer.from('<svg><script>bad</script></svg>')),null);
 assert.equal(detectMedia(Buffer.from('tiny')),null);
});
