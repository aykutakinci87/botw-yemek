/* Inventory scanner core: finds the 5x4 materials grid in a camera frame and matches cells to item icons.
   Works on plain {w,h,d} RGBA buffers so it runs the same in the browser and in node tests. */
(function(root){
const FS=18;
const MASK=[];for(let y=0;y<FS;y++)for(let x=0;x<FS;x++){if(y>=Math.round(FS*.76))continue;if(y<Math.round(FS*.27)&&x>=Math.round(FS*.73))continue;MASK.push(y*FS+x)}
const CW=0.7;

function sampleRect(img,x0,y0,rw,rh,n){
  const out=new Float32Array(n*n*3),{w,h,d}=img;
  for(let v=0;v<n;v++){const ya=Math.max(0,Math.floor(y0+v*rh/n)),yb=Math.min(h,Math.max(ya+1,Math.floor(y0+(v+1)*rh/n)));
    for(let u=0;u<n;u++){const xa=Math.max(0,Math.floor(x0+u*rw/n)),xb=Math.min(w,Math.max(xa+1,Math.floor(x0+(u+1)*rw/n)));
      let r=0,g=0,b=0,c=0;for(let y=ya;y<yb;y++){let i=(y*w+xa)*4;for(let x=xa;x<xb;x++,i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];c++}}
      const o=(v*n+u)*3;c=c||1;out[o]=r/c;out[o+1]=g/c;out[o+2]=b/c}}
  return out;
}
function featOf(px,o){o=o||{};const cw=o.cw!=null?o.cw:CW,rank=!!o.rank;
  const M=MASK.length,L=new Float32Array(M),A=new Float32Array(M),B=new Float32Array(M);
  let mL=0,mA=0,mB=0;
  for(let k=0;k<M;k++){const o=MASK[k]*3,r=px[o],g=px[o+1],b=px[o+2];L[k]=(r+g+b)/3;A[k]=r-g;B[k]=b-(r+g)/2;mL+=L[k];mA+=A[k];mB+=B[k]}
  mL/=M;mA/=M;mB/=M;let sL=0,sC=0;
  for(let k=0;k<M;k++){L[k]-=mL;A[k]-=mA;B[k]-=mB;sL+=L[k]*L[k];sC+=A[k]*A[k]+B[k]*B[k]}
  sL=Math.sqrt(sL/M)+1e-3;sC=Math.sqrt(sC/M)+1e-3;
  const f=new Float32Array(M*3);let n=0;
  if(rank){const ix=[...L.keys()].sort((a,b)=>L[a]-L[b]);ix.forEach((q,r)=>{L[q]=(r/(M-1)-0.5)*3.4*sL})}
  for(let k=0;k<M;k++){f[k]=L[k]/sL;f[M+k]=cw*A[k]/sC;f[2*M+k]=cw*B[k]/sC}
  for(let k=0;k<f.length;k++)n+=f[k]*f[k];n=Math.sqrt(n)||1;for(let k=0;k<f.length;k++)f[k]/=n;
  return {f,std:sL,chroma:sC,mean:mL};
}
/* reference features from the sprite: 14 columns of 96px icons, composited on a dark cell */
function buildRefs(sprite,count,opt){
  opt=opt||{};const k=opt.k||1.05,dy=opt.dy||0,bg=opt.bg||[30,32,32],S=96,C=Math.round(S/k);
  const refs=[];
  for(let j=0;j<count;j++){
    const sx=(j%14)*S,sy=Math.floor(j/14)*S,cell={w:C,h:C,d:new Uint8ClampedArray(C*C*4)};
    const ox=Math.round((C-S)/2),oy=Math.round((C-S)/2+dy*C);
    for(let y=0;y<C;y++)for(let x=0;x<C;x++){const o=(y*C+x)*4;let r=bg[0],g=bg[1],b=bg[2];const u=x-ox,v=y-oy;
      if(u>=0&&v>=0&&u<S&&v<S){const i=((sy+v)*sprite.w+sx+u)*4,a=sprite.d[i+3]/255;r=r*(1-a)+sprite.d[i]*a;g=g*(1-a)+sprite.d[i+1]*a;b=b*(1-a)+sprite.d[i+2]*a}
      cell.d[o]=r;cell.d[o+1]=g;cell.d[o+2]=b;cell.d[o+3]=255}
    refs.push(featOf(sampleRect(cell,0,0,C,C,FS),opt).f);
  }
  return refs;
}
function grayGrad(img){
  const {w,h,d}=img,g=new Float32Array(w*h),gx=new Float32Array(w*h),gy=new Float32Array(w*h);
  for(let i=0;i<w*h;i++)g[i]=(d[i*4]+d[i*4+1]+d[i*4+2])/3;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;gx[i]=Math.abs(g[i+1]-g[i-1]);gy[i]=Math.abs(g[i+w]-g[i-w])}
  return {g,gx,gy};
}
function hp(P,r){const n=P.length,o=new Float32Array(n);let s=0;const c=[0];for(let i=0;i<n;i++){s+=P[i];c.push(s)}
  for(let i=0;i<n;i++){const a=Math.max(0,i-r),b=Math.min(n,i+r+1);o[i]=P[i]-(c[b]-c[a])/(b-a)}return o}
function at(P,x){const i=Math.round(x);if(i<1||i>=P.length-1)return null;return Math.max(P[i-1],P[i],P[i+1])}
function fit1(P,p,r,lo,hi,minN){
  let best=-1e9,ph=0;
  for(let f=0;f<p;f+=1){let s=0,c=0;for(let x=lo+f;x+r*p<hi;x+=p){const a=at(P,x),b=at(P,x+r*p);if(a===null||b===null)continue;s+=a+b;c+=2}
    if(c>=2*minN&&s/c>best){best=s/c;ph=lo+f}}
  return {s:best,ph};
}
/* global periodic fit: square pitch p, border ratio r, phases for x and y */
function findGrid(img,G,roi){
  const {w,h}=img;roi=roi||{x0:0,y0:0,x1:w,y1:h};
  const Px=new Float32Array(w),Py=new Float32Array(h);
  for(let y=roi.y0;y<roi.y1;y++)for(let x=roi.x0;x<roi.x1;x++){const i=y*w+x;Px[x]+=G.gx[i];Py[y]+=G.gy[i]}
  const Hx=hp(Px,12),Hy=hp(Py,12);
  const rw=roi.x1-roi.x0,rh=roi.y1-roi.y0,pmin=Math.max(20,rw/9),pmax=Math.min(rw/4.2,rh/3.1);
  let best=null;
  for(let p=pmin;p<=pmax;p+=0.5)for(const r of [0.83,0.855,0.88,0.905]){
    const fx=fit1(Hx,p,r,roi.x0,roi.x1,4),fy=fit1(Hy,p,r,roi.y0,roi.y1,3);
    const s=fx.s/(rh)+fy.s/(rw);
    if(!best||s>best.s)best={s,p,r,x:fx.ph,y:fy.ph};
  }
  return best;
}
function edgeScore(G,w,h,x,y,c){
  const x0=Math.round(x),y0=Math.round(y),x1=Math.round(x+c),y1=Math.round(y+c);
  if(x0<1||y0<1||x1>=w-1||y1>=h-1)return -1;
  let s=0,n=0;
  for(let yy=y0+2;yy<y1-2;yy++){s+=Math.max(G.gx[yy*w+x0-1],G.gx[yy*w+x0],G.gx[yy*w+x0+1])+Math.max(G.gx[yy*w+x1-1],G.gx[yy*w+x1],G.gx[yy*w+x1+1]);n+=2}
  for(let xx=x0+2;xx<x1-2;xx++){s+=Math.max(G.gy[(y0-1)*w+xx],G.gy[y0*w+xx],G.gy[(y0+1)*w+xx])+Math.max(G.gy[(y1-1)*w+xx],G.gy[y1*w+xx],G.gy[(y1+1)*w+xx]);n+=2}
  return s/n;
}
/* cells of the detected grid, each refined locally, weak or clipped ones dropped */
function cells(img,G,grid,roi){
  const {w,h}=img,{p,r}=grid,c=r*p,out=[];
  roi=roi||{x0:0,y0:0,x1:w,y1:h};
  const i0=Math.ceil((roi.x0-grid.x)/p-0.15),i1=Math.floor((roi.x1-grid.x-c)/p+0.15),j0=Math.ceil((roi.y0-grid.y)/p-0.15),j1=Math.floor((roi.y1-grid.y-c)/p+0.15);
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
    const bx=grid.x+i*p,by=grid.y+j*p;let b=null;const R=Math.max(2,Math.round(p*.1));
    for(let dy=-R;dy<=R;dy+=1)for(let dx=-R;dx<=R;dx+=1)for(const sc of [0.97,1,1.03]){const cc=c*sc,e=edgeScore(G,w,h,bx+dx,by+dy,cc);if(e>0&&(!b||e>b.e))b={x:bx+dx,y:by+dy,c:cc,e,i,j}}
    if(b)out.push(b);
  }
  if(!out.length)return out;
  const es=out.map(o=>o.e).sort((a,b)=>a-b),med=es[Math.floor(es.length*0.6)];
  let L=out.filter(o=>o.e>med*0.55);
  /* a page is 5 columns x 4 rows: keep the strongest window, neighbour-page slivers fall outside it */
  const win=(key,n)=>{const v=L.map(o=>o[key]),lo=Math.min(...v),hi=Math.max(...v);if(hi-lo<n)return;let b=null;
    for(let s=lo;s+n-1<=hi;s++){const m=L.filter(o=>o[key]>=s&&o[key]<s+n).reduce((a,o)=>a+o.e,0);if(!b||m>b.m)b={m,s}}
    L=L.filter(o=>o[key]>=b.s&&o[key]<b.s+n)};
  win('i',5);win('j',4);
  return L.sort((a,b)=>a.j-b.j||a.i-b.i);
}
function classify(img,cell,refs,o){
  o=o||{};const sh=o.shift||0,sc=new Float32Array(refs.length).fill(-1);let F0=null;
  const offs=sh?[[0,0,1],[-sh,0,1],[sh,0,1],[0,-sh,1],[0,sh,1],[0,0,1-sh],[0,0,1+sh]]:[[0,0,1]];
  for(const [ox,oy,z] of offs){const cc=cell.c*z,m=cc*0.05,x=cell.x+(cell.c-cc)/2+ox*cell.c,y=cell.y+(cell.c-cc)/2+oy*cell.c;
    const F=featOf(sampleRect(img,x+m,y+m,cc-2*m,cc-2*m,FS),o);if(!F0)F0=F;
    for(let k=0;k<refs.length;k++){const R=refs[k];let s=0;for(let t=0;t<R.length;t++)s+=R[t]*F.f[t];if(s>sc[k])sc[k]=s}}
  return {sc,std:F0.std,chroma:F0.chroma,mean:F0.mean};
}
/* items sit in the game's own order (refs are indexed in that order), except that new item types are
   appended at the end until the player sorts: allow a few breaks in the order, each one costs `pen` */
function orderDP(list,o){
  o=o||{};const m=list.length;if(!m)return {items:[],total:0,breaks:0};
  const n=list[0].sc.length,B=o.breaks!=null?o.breaks:4,pen=o.pen!=null?o.pen:0.3;
  const dp=[],bk=[];
  for(let t=0;t<m;t++){dp.push([]);bk.push([]);for(let b=0;b<=B;b++){dp[t].push(new Float32Array(n).fill(-1e9));bk[t].push(new Int32Array(n).fill(-1))}}
  for(let q=0;q<n;q++)dp[0][0][q]=list[0].sc[q];
  for(let t=1;t<m;t++){const sc=list[t].sc;
    for(let b=0;b<=B;b++){
      let gv=-1e9,gq=-1;if(b>0){const P=dp[t-1][b-1];for(let q=0;q<n;q++)if(P[q]>gv){gv=P[q];gq=q}}
      const P=dp[t-1][b];let bv=-1e9,bq=-1;
      for(let q=0;q<n;q++){if(q>0&&P[q-1]>bv){bv=P[q-1];bq=q-1}
        let v=bv,from=bq>=0?b*n+bq:-1;if(gq>=0&&gv-pen>v){v=gv-pen;from=(b-1)*n+gq}
        if(from>=0){dp[t][b][q]=v+sc[q];bk[t][b][q]=from}}}}
  let bb=0,q=0,best=-1e9;for(let b=0;b<=B;b++)for(let z=0;z<n;z++)if(dp[m-1][b][z]>best){best=dp[m-1][b][z];bb=b;q=z}
  const res=new Array(m),breaks=bb;
  for(let t=m-1;t>=0;t--){res[t]=q;const f=bk[t][bb][q];if(t>0){bb=Math.floor(f/n);q=f%n}}
  return {items:res,total:best,breaks};
}
/* the count printed at the cell's bottom left ("x12"): returns digit glyph bitmaps */
function countGlyphs(hi,cell,s,o){
  o=o||{};const c=cell.c*s,x0=Math.round(cell.x*s+(o.ax!=null?o.ax:0.04)*c),y0=Math.round(cell.y*s+(o.ay!=null?o.ay:0.71)*c),W=Math.round((o.aw||0.6)*c),Hh=Math.round((o.ah||0.28)*c),{w,h,d}=hi;
  if(x0<0||y0<0||x0+W>=w||y0+Hh>=h)return {n:-1,gl:[]};
  const L=new Float32Array(W*Hh),hist=new Float32Array(256);
  for(let y=0;y<Hh;y++)for(let x=0;x<W;x++){const i=((y0+y)*w+x0+x)*4,v=(d[i]+d[i+1]+d[i+2])/3;L[y*W+x]=v;hist[v|0]++}
  /* Otsu threshold */
  let tot=W*Hh,sum=0;for(let k=0;k<256;k++)sum+=k*hist[k];let sB=0,wB=0,best=0,T=128;
  for(let k=0;k<256;k++){wB+=hist[k];if(!wB)continue;const wF=tot-wB;if(!wF)break;sB+=k*hist[k];const mB=sB/wB,mF=(sum-sB)/wF,v=wB*wF*(mB-mF)**2;if(v>best){best=v;T=k}}
  const B=new Uint8Array(W*Hh);for(let k=0;k<B.length;k++)B[k]=L[k]>T?1:0;
  const lab=new Int32Array(W*Hh),comps=[];let id=0;
  for(let k=0;k<B.length;k++){if(!B[k]||lab[k])continue;id++;const st=[k];lab[k]=id;let u=1e9,v=-1,t=1e9,b=-1,n=0;
    while(st.length){const q=st.pop(),x=q%W,y=(q-x)/W;n++;if(x<u)u=x;if(x>v)v=x;if(y<t)t=y;if(y>b)b=y;
      for(const z of [q-1,q+1,q-W,q+W]){if(z<0||z>=B.length||!B[z]||lab[z])continue;if((z===q-1&&x===0)||(z===q+1&&x===W-1))continue;lab[z]=id;st.push(z)}}
    comps.push({id,u,v,t,b,n,h:b-t+1,wd:v-u+1})}
  /* the "x" is the anchor: leftmost squarish glyph; digits share its baseline and are ~1.55x taller */
  const xs=comps.filter(g=>g.t>0&&g.n>=12&&g.wd/g.h>0.65&&g.wd/g.h<1.45&&g.h>=Hh*0.25&&g.h<=Hh*0.6&&g.u<W*0.4).sort((a,b)=>a.u-b.u);
  const dbg=o.v?{T,Hh,W,x:xs[0]&&[xs[0].u,xs[0].t,xs[0].wd,xs[0].h]}:null;
  if(!xs.length)return {n:0,gl:[],dbg};
  const X=xs[0],yb=X.b,yt=Math.max(0,yb-Math.round((o.bf||0.7)*X.h)),xa=X.v+2,dh=1.55*X.h;
  const BW=W-xa,BH=yb-yt+1;if(BW<4||BH<4)return {n:0,gl:[],dbg};
  const lab2=new Int32Array(BW*BH),cs=[];let id2=0;
  for(let y=0;y<BH;y++)for(let x=0;x<BW;x++){const k0=(yt+y)*W+xa+x;if(!B[k0]||lab2[y*BW+x])continue;id2++;const st=[y*BW+x];lab2[y*BW+x]=id2;let u=1e9,v=-1,t=1e9,bb=-1,n=0;
    while(st.length){const q=st.pop(),qx=q%BW,qy=(q-qx)/BW;n++;if(qx<u)u=qx;if(qx>v)v=qx;if(qy<t)t=qy;if(qy>bb)bb=qy;
      for(const [zx,zy] of [[qx-1,qy],[qx+1,qy],[qx,qy-1],[qx,qy+1]]){if(zx<0||zy<0||zx>=BW||zy>=BH)continue;const z=zy*BW+zx;if(lab2[z]||!B[(yt+zy)*W+xa+zx])continue;lab2[z]=id2;st.push(z)}}
    cs.push({id:id2,u,v,t,b:bb,n,h:bb-t+1,wd:v-u+1})}
  const dig=cs.filter(g=>g.h>=BH*0.8&&g.b>=BH-1-Math.max(2,X.h*0.2)&&g.n>=8&&g.u<X.wd*4.5&&g.wd<=X.wd*1.6).sort((a,b)=>a.u-b.u);
  if(dbg)dbg.d=dig.map(g=>[g.u,g.t,g.wd,g.h]);
  const top=Math.max(0,Math.round(yb-dh+1));
  return {n:dig.length,dbg,gl:dig.map(g=>{const u0=xa+g.u,u1=xa+g.v,f=new Float32Array(7*11),gw=u1-u0+1,gh=yb-top+1;
    for(let yy=0;yy<11;yy++)for(let xx=0;xx<7;xx++){let a=0,m=0;
      const x0=u0+Math.floor(xx*gw/7),x1=Math.max(x0+1,u0+Math.floor((xx+1)*gw/7)),y0=top+Math.floor(yy*gh/11),y1=Math.max(y0+1,top+Math.floor((yy+1)*gh/11));
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){a+=B[y*W+x];m++}f[yy*7+xx]=a/m}
    return {f,ar:gw/gh}})};
}
/* single digit from glyph bitmap by nearest labelled samples; 0 means "5 or more" */
function readDigit(g,samples){
  let best=null;for(const s of samples){let e=0;for(let k=0;k<77;k++)e+=(s.f[k]-g.f[k])**2;e+=4*(s.ar-g.ar)**2;if(!best||e<best.e)best={e,d:s.d}}
  return best;
}
function readCount(hi,cell,s,samples){
  const r=countGlyphs(hi,cell,s);
  if(r.n>=2)return {v:5,sure:true};
  if(r.n===1){const b=readDigit(r.gl[0],samples);if(!b)return {v:0,sure:false};return {v:Math.min(5,b.d),sure:b.e<6,d:b.d}}
  return {v:0,sure:false};
}
root.SCAN={FS,sampleRect,featOf,buildRefs,grayGrad,findGrid,cells,classify,orderDP,countGlyphs,readDigit,readCount};
})(typeof module!=='undefined'?module.exports:window);
