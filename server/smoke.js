// Explicit integration check: creates two temporary accounts and removes its data.
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { io } from 'socket.io-client';
const base='http://127.0.0.1:3001';
const suffix=randomBytes(6).toString('hex');
const emails=[`smoke-a-${suffix}@example.test`,`smoke-b-${suffix}@example.test`];
const sockets=[];
async function request(route,token,body){const res=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await res.json();assert.ok(res.ok,JSON.stringify(value));return value;}
async function connect(token){const s=io(base,{auth:{token},autoConnect:false,reconnection:false});sockets.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);s.connect();});return s;}
async function event(s,name,value){const result=await s.timeout(5000).emitWithAck(name,value);assert.ok(result.ok,JSON.stringify(result));}
try{
 const users=[];for(let i=0;i<2;i++)users.push(await request('/auth/register',null,{name:`Smoke ${i}`,email:emails[i],password:randomBytes(24).toString('hex')}));
 const [a,b]=await Promise.all(users.map(u=>connect(u.token)));
 await Promise.all([event(a,'room:join','general'),event(b,'room:join','general')]);
 const text=`Integration check ${suffix}`;
 const received=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Message delivery timed out')),5000);b.on('message:new',m=>{if(m.text===text){clearTimeout(timer);resolve(m);}});});
 await event(a,'message:send',{room:'general',text});const message=await received;assert.equal(message.user.id,users[0].user.id);
 const history=await request('/rooms/general/messages',users[1].token);assert.ok(history.some(m=>m._id===message._id));
 const denied=await fetch(base+'/api/rooms');assert.equal(denied.status,401);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG3cAAAAASUVORK5CYII=','base64');
 const uploaded=await fetch(base+'/api/media',{method:'POST',headers:{Authorization:`Bearer ${users[0].token}`,'Content-Type':'application/octet-stream','X-File-Name':'test.png'},body:png});assert.equal(uploaded.status,201);const attachment=await uploaded.json();
 const downloaded=await fetch(base+'/api/media/'+attachment.id,{headers:{Authorization:`Bearer ${users[1].token}`}});assert.equal(downloaded.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),png);
 const protectedMedia=await fetch(base+'/api/media/'+attachment.id);assert.equal(protectedMedia.status,401);
 const profile=await fetch(base+'/api/me',{method:'PATCH',headers:{Authorization:`Bearer ${users[0].token}`,'Content-Type':'application/json'},body:JSON.stringify({avatar:attachment.id})});assert.equal((await profile.json()).avatar,attachment.id);
 await new Promise(resolve=>setTimeout(resolve,550));await event(a,'message:send',{room:'general',text:'',attachment});
 const mediaHistory=await request('/rooms/general/messages',users[1].token);assert.ok(mediaHistory.some(m=>m.attachment?.id===attachment.id));
 const rejected=await b.timeout(5000).emitWithAck('message:send',{room:'general',text:'',attachment});assert.ok(rejected.error);
 const badUpload=await fetch(base+'/api/media',{method:'POST',headers:{Authorization:`Bearer ${users[0].token}`,'Content-Type':'application/octet-stream'},body:'<svg>unsupported</svg>'});assert.equal(badUpload.status,400);
 console.log('PASS: photo upload/download, authenticated media, profile photo, attachment history, ownership validation, unsupported file rejection.');
 console.log('PASS: registration, authenticated sockets, cross-client delivery, MongoDB history, unauthorized access rejection.');
}finally{
 sockets.forEach(s=>s.disconnect());
 await mongoose.connect(process.env.MONGODB_URI||'mongodb://127.0.0.1:27017/relay_chat');
 const users=await mongoose.connection.collection('users').find({email:{$in:emails}}).toArray();
 await mongoose.connection.collection('messages').deleteMany({'user.id':{$in:users.map(u=>String(u._id))}});
 await mongoose.connection.collection('media').deleteMany({owner:{$in:users.map(u=>String(u._id))}});
 await mongoose.connection.collection('users').deleteMany({email:{$in:emails}});
 await mongoose.disconnect();
}
