import React,{useEffect,useRef,useState} from 'react';

export function Attachment({item,token,avatar=false}){
 const [url,setUrl]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{let live=true,object;setUrl('');setError(false);if(!item?.id)return;
 fetch('/api/media/'+item.id,{headers:{Authorization:`Bearer ${token}`}}).then(r=>{if(!r.ok)throw Error();return r.blob();}).then(blob=>{object=URL.createObjectURL(blob);if(live)setUrl(object);else URL.revokeObjectURL(object);}).catch(()=>{if(live)setError(true);});return()=>{live=false;if(object)URL.revokeObjectURL(object);};},[item?.id,token]);
 const source=item?.kind==='gif'?item.url:url;
 if(error)return <span className="media-error">Media unavailable</span>;
 if(!source)return <span className="media-loading">…</span>;
 if(item.kind==='audio')return <div className="voice-card"><span>🎙️ Voice note</span><audio controls preload="metadata" src={source}/></div>;
 return <img className={avatar?'avatar-photo':'message-photo'} src={source} alt={avatar?'Profile photo':item.name||'Shared image'} loading="lazy" referrerPolicy="no-referrer" onError={()=>setError(true)}/>;
}

export function Avatar({user,token}){return <span className="avatar sage">{user.avatar?<Attachment item={{id:user.avatar}} token={token} avatar/>:user.name?.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}</span>;}

export async function upload(file,token){if(file.size>8*1024*1024)throw Error('Choose a file smaller than 8 MB.');const res=await fetch('/api/media',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream','X-File-Name':encodeURIComponent(file.name||'Voice note')},body:file});const data=await res.json();if(!res.ok)throw Error(data.error||'Upload failed.');return data;}

const emojis='😀 😃 😊 😂 🥹 😎 🤩 🥳 🫶 ❤️ 🧡 💛 💚 💙 💜 🔥 ✨ 🎉 🙌 👏 👍 👀 🤔 💯 🚀 🌈 ☕ 🌻 🐈 🎵 💡 ✅ 👋 🤝'.split(' ');
export function Composer({token,room,joined,busy,text,setText,onSend,onTyping,onError}){
 const [panel,setPanel]=useState(''),[attachment,setAttachment]=useState(null),[uploading,setUploading]=useState(false),[gif,setGif]=useState(''),[recording,setRecording]=useState(false),[seconds,setSeconds]=useState(0),[starting,setStarting]=useState(false);
 const file=useRef(null),recorder=useRef(null),stream=useRef(null),cancelled=useRef(false),active=useRef(true),input=useRef(null);
 useEffect(()=>()=>{active.current=false;cancelled.current=true;if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());},[]);
 useEffect(()=>{if(!recording)return;const id=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(id);},[recording]);
 useEffect(()=>{if(seconds>=120&&recording)recorder.current?.stop();},[seconds,recording]);
 async function attach(value){setUploading(true);try{const data=await upload(value,token);if(active.current){setAttachment(data);setPanel('');}}catch(e){onError(e.message);}finally{if(active.current)setUploading(false);}}
 async function record(){if(recording){recorder.current?.stop();return;}setStarting(true);cancelled.current=false;try{
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Voice recording is unavailable in this browser. Try Chrome on localhost or HTTPS.');
 const media=await navigator.mediaDevices.getUserMedia({audio:true});if(!active.current){media.getTracks().forEach(t=>t.stop());return;}stream.current=media;
 const type=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
 const rec=new MediaRecorder(media,type?{mimeType:type}:undefined);recorder.current=rec;const chunks=[];
 rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};rec.onerror=()=>{cancelled.current=true;onError('Recording failed. Please try again.');media.getTracks().forEach(t=>t.stop());setRecording(false);};
 rec.onstop=()=>{media.getTracks().forEach(t=>t.stop());if(active.current){setRecording(false);if(!cancelled.current&&chunks.length)attach(new File(chunks,'Voice note',{type:rec.mimeType}));}};
 rec.start();setSeconds(0);setRecording(true);setPanel('');
 }catch(e){stream.current?.getTracks().forEach(t=>t.stop());onError(e.name==='NotAllowedError'?'Allow microphone access in your browser to record a voice note.':e.message);}finally{setStarting(false);}}
 function submit(e){e.preventDefault();if(recording||uploading||(!text.trim()&&!attachment))return;onSend(attachment,()=>setAttachment(null));}
 function addGif(){try{const url=new URL(gif);if(url.protocol!=='https:'||!url.pathname.toLowerCase().endsWith('.gif'))throw Error();setAttachment({kind:'gif',url:url.href,name:'GIF'});setPanel('');setGif('');}catch{onError('Paste a direct HTTPS image link ending in .gif, or upload a GIF file.');}}
 return <div className="rich-composer">
 {panel&&<section className="picker"><div className="picker-heading"><b>{panel==='emoji'?'A little more expression':'Say it with a GIF'}</b><button type="button" onClick={()=>setPanel('')} aria-label="Close picker">×</button></div>{panel==='emoji'?<div className="emoji-grid">{emojis.map(e=><button type="button" key={e} onClick={()=>{const pos=input.current?.selectionStart??text.length;setText(text.slice(0,pos)+e+text.slice(pos));input.current?.focus();}}>{e}</button>)}</div>:<><p>Upload your favorite GIF or paste its direct image link.</p><div className="gif-input"><input aria-label="GIF URL" type="url" placeholder="https://…/celebration.gif" value={gif} onChange={e=>setGif(e.target.value)}/><button type="button" onClick={addGif}>Add GIF</button></div><button className="gif-upload" type="button" onClick={()=>{file.current.accept='image/gif';file.current.click();}}>↑ Upload a GIF</button><small>Linked GIFs load from their external host.</small></>}</section>}
 {attachment&&<div className="attachment-preview"><Attachment item={attachment} token={token}/><div><b>{attachment.kind==='audio'?'Voice note ready':attachment.name}</b><small>Ready to send</small></div><button onClick={()=>setAttachment(null)} aria-label="Remove attachment">×</button></div>}
 {recording&&<div className="recording-bar"><span className="record-dot"/><b>Recording {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</b><div className="wave">▂ ▅ ▃ █ ▅ ▂ ▆ ▃ ▅ ▂</div><button onClick={()=>{cancelled.current=true;recorder.current?.stop();}}>Discard</button><button onClick={()=>recorder.current?.stop()}>Stop & preview</button></div>}
 <form className="composer" onSubmit={submit}><textarea ref={input} aria-label="Message" maxLength={2000} placeholder={`Something to share with #${room}?`} value={text} disabled={recording} onChange={e=>{setText(e.target.value);onTyping(!!e.target.value);}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();submit(e);}}}/><div className="composer-toolbar"><div className="tool-group"><button type="button" title="Add emoji" aria-label="Add emoji" className={panel==='emoji'?'tool active':'tool'} onClick={()=>setPanel(panel==='emoji'?'':'emoji')}>☺</button><button type="button" title="Add GIF" aria-label="Add GIF" className="tool gif-tool" onClick={()=>setPanel(panel==='gif'?'':'gif')}>GIF</button><button type="button" title="Upload photo" aria-label="Upload photo" className="tool" disabled={uploading||recording} onClick={()=>{file.current.accept='image/jpeg,image/png,image/webp,image/gif';file.current.click();}}>▧</button><span className="tool-divider"/><button type="button" title="Record voice note" aria-label={recording?'Stop recording':'Record voice note'} className={'tool mic '+(recording?'record-active':'')} disabled={starting||uploading} onClick={record}>🎙</button><span className="upload-label" aria-live="polite">{uploading?'Uploading…':starting?'Opening microphone…':''}</span></div><button className="send" disabled={(!text.trim()&&!attachment)||!joined||busy||uploading||recording} aria-label="Send message">{busy?'…':'↑'}</button></div></form><input hidden ref={file} type="file" onChange={e=>{if(e.target.files[0])attach(e.target.files[0]);e.target.value='';}}/>
 </div>;
}
