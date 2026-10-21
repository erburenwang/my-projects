import {EXERCISE_GUIDES} from './exercise-guides.mjs';

const guideEscape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const guideOffline=()=>typeof document!=='undefined'&&document.documentElement.dataset.offline==='true';
const guideLink=(url,label)=>`<a href="${guideEscape(url)}" target="_blank" rel="noopener noreferrer">${guideEscape(label)} ↗</a>`;
export function renderExerciseGuide(ex){
  const guide=EXERCISE_GUIDES[ex.id];if(!guide)return '';
  const video=guide.video,offline=guideOffline();
  const attribution=item=>`${guideEscape(item.author||'本项目原创')} · ${item.licenseUrl?guideLink(item.licenseUrl,item.license||'素材许可'):guideEscape(item.license||'原创辅助示意')}${item.sourceUrl?' · '+guideLink(item.sourceUrl,'原始来源'):''}${item.changes?' · '+guideEscape(item.changes):''}`;
  return `<details class="exercise-guide" data-guide="${ex.id}"><summary>看器械与动作教学 <span>图片 · 要领 · 示范</span></summary><div class="guide-body"><p class="guide-variant">${guideEscape(guide.variant)}</p><p>${guideEscape(guide.equipment)}</p><p class="guide-note">图示为常见版本。不同器械调节方式可能不同，首次请现场工作人员协助。</p>
  <div class="guide-gallery">${guide.images.map((img,i)=>`<button type="button" class="guide-image-button" data-action="guide-image" data-ex="${ex.id}" data-image="${i}" aria-label="放大${guideEscape(img.alt)}"><img loading="lazy" width="480" height="360" src="${guideEscape(img.src)}" alt="${guideEscape(img.alt)}"><span>${guideEscape(img.label||img.alt)} · 点击放大</span></button>`).join('')}</div>
  <h4>先调好，再开始</h4><ol>${guide.setup.map(s=>`<li>${guideEscape(s)}</li>`).join('')}</ol><h4>做的时候记住这3点</h4><ol>${guide.cues.map(s=>`<li>${guideEscape(s)}</li>`).join('')}</ol><h4>避开这2个常见错误</h4><ul>${guide.mistakes.map(s=>`<li>${guideEscape(s)}</li>`).join('')}</ul><p class="guide-recording"><strong>重量怎么记：</strong>${guideEscape(guide.recordingHint)}</p>
  ${video&&!offline?`<div class="guide-video-panel"><p><strong>真人动作示范</strong></p><video controls playsinline muted loop preload="none" ${video.poster?`poster="${guideEscape(video.poster)}"`:''} data-video-src="${guideEscape(video.src)}" aria-label="${guideEscape(ex.name)}真人动作示范"></video><button class="secondary" type="button" data-action="guide-play" data-ex="${ex.id}">播放／重播真人示范</button><p class="guide-media-message" role="status">点击后加载，可用播放器暂停；收起教学会停止播放。</p></div>`:`<p class="guide-fallback">${guideEscape(offline&&video?'离线版保留静态教学。真人示范需要联网，请打开下方教程。':guide.fallbackNote||'本动作提供起止姿势辅助示意；完整真人教学见下方来源。')}</p>`}
  <details class="guide-sources"><summary>教学与素材来源</summary><ul>${guide.sources.map(s=>`<li>${guideLink(s.url,s.title)}</li>`).join('')}${guide.images.map((img,i)=>`<li>图片${i+1}：${attribution(img)}</li>`).join('')}${video?`<li>真人示范：${attribution(video)}</li>`:''}</ul></details></div></details>`;
}
export function guideImageData(id,index){return EXERCISE_GUIDES[id]?.images?.[index]||null;}
