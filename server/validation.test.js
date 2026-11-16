import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roomName,messageText,publicUser} from './validation.js';
test('channel names cannot inject paths or exceed limits',()=>{for(const name of ['general','a','team-42'])assert.ok(roomName(name));for(const name of ['',null,{},'../admin','Hello','-test','a'.repeat(33)])assert.equal(roomName(name),false);});
test('message boundaries reject empty and malformed payloads',()=>{for(const text of ['hello',' x ','a'.repeat(2000)])assert.ok(messageText(text));for(const text of ['',null,{},'   ','a'.repeat(2001)])assert.equal(messageText(text),false);});
test('public user payload does not expose account secrets',()=>assert.deepEqual(publicUser({_id:123,name:'Alex',email:'private',password:'secret'}),{id:'123',name:'Alex'}));
