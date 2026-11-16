import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { Server } from 'socket.io';
import { roomName, messageText, publicUser } from './validation.js';
import { detectMedia } from './media.js';

const secret=process.env.JWT_SECRET || randomBytes(48).toString('hex');
if(!process.env.JWT_SECRET) console.warn('JWT_SECRET unset: sessions will expire when the server restarts.');
const User=mongoose.model('User',new mongoose.Schema({name:String,avatar:String,email:{type:String,unique:true},password:String}));
const Room=mongoose.model('Room',new mongoose.Schema({name:{type:String,unique:true},description:String}));
const AttachmentSchema=new mongoose.Schema({id:String,kind:String,type:String,name:String,url:String},{_id:false});
const Message=mongoose.model('Message',new mongoose.Schema({room:{type:String,index:true},text:String,attachment:{type:AttachmentSchema,default:undefined},user:{id:String,name:String,avatar:String}},{timestamps:true}));
const Media=mongoose.model('Media',new mongoose.Schema({owner:String,type:String,kind:String,name:String,data:Buffer},{timestamps:true}));
Message.schema.index({room:1,createdAt:-1});
const app=express(); const http=createServer(app); const io=new Server(http,{maxHttpBufferSize:16000});
app.disable('x-powered-by'); app.use(express.json({limit:'16kb'}));
app.use('/api',rateLimit({windowMs:60000,limit:180}));
app.get('/api/health',(_,res)=>res.json({ok:mongoose.connection.readyState===1}));
app.use('/api/auth',rateLimit({windowMs:15*60000,limit:30}));
app.post('/api/auth/:action',async(req,res)=>{
 try{
  const {action}=req.params; let {name,email,password}=req.body;
  if(!['login','register'].includes(action))return res.sendStatus(404);
  if(typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||typeof password!=='string'||password.length<8||password.length>72)return res.status(400).json({error:'Use a valid email and a password of 8–72 characters.'});
  email=email.trim().toLowerCase(); let user;
  if(action==='register'){
   if(typeof name!=='string'||!name.trim()||name.trim().length>40)return res.status(400).json({error:'Name must be between 1 and 40 characters.'});
   user=await User.create({name:name.trim(),email,password:await bcrypt.hash(password,12)});
  }else{
   user=await User.findOne({email});
   if(!user||!await bcrypt.compare(password,user.password))return res.status(401).json({error:'Email or password is incorrect.'});
  }
  res.json({token:jwt.sign({sub:String(user._id)},secret,{expiresIn:'7d'}),user:publicUser(user)});
 }catch(e){res.status(e.code===11000?409:500).json({error:e.code===11000?'An account already uses that email.':'Unable to sign in. Please try again.'});}
});
async function authenticate(token){const claims=jwt.verify(token,secret);const user=await User.findById(claims.sub);if(!user)throw Error('Invalid account');return publicUser(user);}
app.use('/api',async(req,res,next)=>{try{req.user=await authenticate(req.headers.authorization?.replace(/^Bearer /,''));next();}catch{res.status(401).json({error:'Please sign in again.'});}});
app.get('/api/me',(req,res)=>res.json(req.user));
app.post('/api/media',express.raw({type:'application/octet-stream',limit:'8mb'}),async(req,res,next)=>{try{
 if(!Buffer.isBuffer(req.body))return res.status(400).json({error:'Select a photo, GIF or voice recording.'});
 const info=detectMedia(req.body);if(!info)return res.status(400).json({error:'Supported: JPEG, PNG, GIF, WebP, WebM, Ogg or M4A.'});
 const name=decodeURIComponent(req.headers['x-file-name']||'Attachment').slice(0,120);
 const item=await Media.create({owner:req.user.id,...info,name,data:req.body});res.status(201).json({id:String(item._id),...info,name});
}catch(e){next(e);}});
app.get('/api/media/:id',async(req,res,next)=>{try{if(!mongoose.isValidObjectId(req.params.id))return res.sendStatus(404);const item=await Media.findById(req.params.id);if(!item)return res.sendStatus(404);res.set({'Content-Type':item.type,'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=3600'}).send(item.data);}catch(e){next(e);}});
app.patch('/api/me',async(req,res,next)=>{try{const item=mongoose.isValidObjectId(req.body.avatar)?await Media.findOne({_id:req.body.avatar,owner:req.user.id,kind:'image'}):null;if(!item)return res.status(400).json({error:'Upload a photo first.'});const u=await User.findByIdAndUpdate(req.user.id,{avatar:String(item._id)},{new:true});const result=publicUser(u);for(const s of io.sockets.sockets.values())if(s.data.user.id===req.user.id){s.data.user=result;online.set(s.id,result);}presence();io.emit('profile:update',result);res.json(result);}catch(e){next(e);}});
app.get('/api/rooms',async(_,res,next)=>{try{res.json(await Room.find().sort({name:1}).lean());}catch(e){next(e);}});
app.post('/api/rooms',async(req,res,next)=>{try{if(!roomName(req.body.name))return res.status(400).json({error:'Use 1–32 lowercase letters, numbers, or hyphens.'});const room=await Room.create({name:req.body.name,description:'A place for your next conversation.'});io.emit('room:new',room);res.status(201).json(room);}catch(e){if(e.code===11000)return res.status(409).json({error:'That channel already exists.'});next(e);}});
app.get('/api/rooms/:room/messages',async(req,res,next)=>{try{if(!await Room.exists({name:req.params.room}))return res.sendStatus(404);res.json((await Message.find({room:req.params.room}).sort({createdAt:-1,_id:-1}).limit(100).lean()).reverse());}catch(e){next(e);}});
const online=new Map();
const presence=()=>io.emit('presence',[...online.values()].reduce((a,u)=>a.some(x=>x.id===u.id)?a:[...a,u],[]));
io.use(async(socket,next)=>{try{socket.data.user=await authenticate(socket.handshake.auth.token);const claims=jwt.verify(socket.handshake.auth.token,secret);socket.data.exp=claims.exp;next();}catch{next(Error('Please sign in again.'));}});
io.on('connection',socket=>{
 online.set(socket.id,socket.data.user);presence();let lastMessage=0,lastTyping=0;
 const expiry=setTimeout(()=>socket.disconnect(true),Math.max(0,socket.data.exp*1000-Date.now()));
 socket.on('room:join',async(room,ack=()=>{})=>{try{if(!roomName(room)||!await Room.exists({name:room}))return ack({error:'Channel not found.'});if(socket.data.room){socket.to(socket.data.room).emit('typing',{user:socket.data.user,active:false});socket.leave(socket.data.room);}socket.data.room=room;socket.join(room);ack({ok:true});}catch{ack({error:'Unable to join channel.'});}});
 socket.on('message:send',async(payload,ack=()=>{})=>{try{if(!payload||payload.room!==socket.data.room||(!messageText(payload.text)&&!payload.attachment)||typeof payload.text!=='string'||payload.text.length>2000)return ack({error:'Choose a channel and write a message (up to 2,000 characters).'});if(Date.now()-lastMessage<500)return ack({error:'Please wait a moment before sending again.'});lastMessage=Date.now();let attachment;
if(payload.attachment?.id){if(!mongoose.isValidObjectId(payload.attachment.id))return ack({error:'Invalid attachment.'});const item=await Media.findOne({_id:payload.attachment.id,owner:socket.data.user.id});if(!item)return ack({error:'Attachment not found.'});attachment={id:String(item._id),kind:item.kind,type:item.type,name:item.name};}
else if(payload.attachment?.kind==='gif'){let url;try{url=new URL(payload.attachment.url);}catch{return ack({error:'Use a valid HTTPS GIF URL.'});}if(url.protocol!=='https:'||url.username||url.password||!url.pathname.toLowerCase().endsWith('.gif')||url.href.length>2000)return ack({error:'Use a direct HTTPS link ending in .gif.'});attachment={kind:'gif',url:url.href,name:'GIF'};}
if(!messageText(payload.text)&&!attachment)return ack({error:'Add a message or attachment.'});
const message=await Message.create({room:payload.room,text:payload.text.trim(),attachment,user:socket.data.user});io.to(payload.room).emit('message:new',message);socket.to(payload.room).emit('typing',{user:socket.data.user,active:false});ack({ok:true});}catch{ack({error:'Message was not sent. Please retry.'});}});
 socket.on('typing',active=>{if(socket.data.room&&typeof active==='boolean'&&Date.now()-lastTyping>400){lastTyping=Date.now();socket.to(socket.data.room).emit('typing',{user:socket.data.user,active});}});
 socket.on('disconnect',()=>{clearTimeout(expiry);online.delete(socket.id);presence();if(socket.data.room)socket.to(socket.data.room).emit('typing',{user:socket.data.user,active:false});});
});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
app.use(express.static(root));app.get('/{*path}',(_,res)=>res.sendFile(path.join(root,'index.html')));
app.use((err,req,res,next)=>{console.error(err.message);if(err.type==='entity.too.large')return res.status(413).json({error:'File too large. Maximum size is 8 MB.'});res.status(500).json({error:'Something went wrong. Please try again.'});});
try{await mongoose.connect(process.env.MONGODB_URI||'mongodb://127.0.0.1:27017/relay_chat',{serverSelectionTimeoutMS:5000});await Promise.all(['general','introductions','ideas','random'].map(name=>Room.updateOne({name},{$setOnInsert:{name,description:name==='general'?'The place for everyday conversations.':'Make yourself at home.'}},{upsert:true})));http.listen(process.env.PORT||3001,'127.0.0.1',()=>console.log(`Relay API: http://127.0.0.1:${process.env.PORT||3001}`));}catch(e){console.error('MongoDB connection failed. Set MONGODB_URI in .env and start MongoDB.',e.message);process.exitCode=1;}
