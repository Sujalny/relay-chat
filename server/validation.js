export const roomName = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,31}$/.test(value);
export const messageText = value => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 2000;
export const publicUser = user => ({id:String(user._id),name:user.name,...(user.avatar?{avatar:user.avatar}:{})});
