/** Synchronous trusted-gesture call is essential on Safari/WKWebView. A tiny guard stays
 * installed so a later OS interruption can be recovered without refreshing the page. */
export function bindAudioGestures(sound:{unlock():Promise<void>;isUnlocked():boolean},host:Window=window,doc:Document=document):()=>void {
 const unlock=()=>{if(!sound.isUnlocked())void sound.unlock().catch(()=>undefined);};
 const foreground=()=>{if(!doc.hidden)unlock();};
 const events=['pointerdown','pointerup','touchend','click','keydown'] as const;
 for(const name of events)host.addEventListener(name,unlock,{passive:false});
 doc.addEventListener('visibilitychange',foreground);
 return()=>{for(const name of events)host.removeEventListener(name,unlock);doc.removeEventListener('visibilitychange',foreground);};
}
