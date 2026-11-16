export function detectMedia(bytes){
 if(bytes.length<12)return null;
 if(bytes.subarray(0,3).equals(Buffer.from([255,216,255])))return {type:'image/jpeg',kind:'image'};
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {type:'image/png',kind:'image'};
 if(['GIF87a','GIF89a'].includes(bytes.subarray(0,6).toString()))return {type:'image/gif',kind:'image'};
 if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return {type:'image/webp',kind:'image'};
 if(bytes.subarray(0,4).equals(Buffer.from([26,69,223,163])))return {type:'audio/webm',kind:'audio'};
 if(bytes.subarray(0,4).toString()==='OggS')return {type:'audio/ogg',kind:'audio'};
 if(bytes.subarray(4,8).toString()==='ftyp'&&['M4A ','isom','mp42'].includes(bytes.subarray(8,12).toString()))return {type:'audio/mp4',kind:'audio'};
 return null;
}
