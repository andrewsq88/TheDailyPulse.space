// TheDailyPulse.space — Monitization Module v1.0
(function(){
  const PL='https://buy.stripe.com/YOUR_STRIPE_PAYMENT_LINK';
  function $(s){return document.querySelector(s);}
  function add(el,html){el.insertAdjacentHTML('beforeend',html);}
  
  function premium(){
    const a=$('aside .sticky');if(!a)return;
    add(a,'<div class="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-5 text-white shadow-xl my-4"><h3 class="font-bold text-lg mb-2">⭐ Go Premium</h3><p class="text-amber-100 text-sm mb-3">Ad-free + exclusive briefings + AI analysis.</p><a href="'+PL+'" target="_blank" class="block w-full bg-white text-amber-600 font-bold py-2 rounded-lg text-center text-sm">Upgrade $4.99/mo</a><p class="text-[10px] text-amber-200 text-center mt-2">7-day free trial</p></div>');
  }
  
  function sponsored(){
    const a=$('aside .sticky');if(!a)return;
    add(a,'<div class="bg-white rounded-xl border border-slate-200 my-4"><div class="bg-slate-50 px-4 py-2 border-b border-slate-200"><span class="text-xs font-semibold text-slate-500">Sponsored</span></div><div class="p-4"><a href="#s" class="block text-sm font-semibold text-slate-800 hover:text-rose-600">🚀 Crypto Portfolio Tracker</a><p class="text-xs text-slate-500">Track holdings in real-time</p></div></div>');
  }
  
  function affiliates(){
    const a=$('aside .sticky');if(!a)return;
    add(a,'<div class="bg-white rounded-xl border border-slate-200 my-4"><div class="bg-slate-50 px-4 py-2 border-b border-slate-200"><span class="text-xs font-semibold text-slate-500">🔧 Recommended</span></div><div class="p-4 space-y-2"><a href="#a" class="flex justify-between text-sm"><span class="font-semibold text-slate-800">Notion</span><span class="text-rose-600 text-xs">Try Free →</span></a><a href="#a" class="flex justify-between text-sm"><span class="font-semibold text-slate-800">CoinGecko</span><span class="text-rose-600 text-xs">Visit →</span></a><a href="#a" class="flex justify-between text-sm"><span class="font-semibold text-slate-800">NordVPN</span><span class="text-rose-600 text-xs">67% Off →</span></a></div><p class="text-[10px] text-slate-400 text-center px-4 py-2 bg-slate-50">May earn commission</p></div>');
  }
  
  function exitPopup(){
    let shown=false;
    document.addEventListener('mouseleave',function(e){
      if(e.clientY<10&&!shown){
        shown=true;
        const d=document.createElement('div');
        d.className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
        d.innerHTML='<div class="bg-white rounded-xl max-w-md w-full p-6"><h3 class="text-xl font-bold mb-2">Don\'t miss out</h3><p class="text-slate-600 text-sm mb-4">Join 2,000+ readers. Free Daily Briefing.</p><input type="email" placeholder="your@email.com" class="w-full px-4 py-2 border rounded-lg text-sm mb-3"><button class="w-full bg-rose-600 text-white font-bold py-2.5 rounded-lg text-sm">Get Free Briefing →</button></div>';
        document.body.appendChild(d);
      }
    });
  }
  
  document.addEventListener('DOMContentLoaded',function(){
    premium();sponsored();affiliates();exitPopup();
  });
})();