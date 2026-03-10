"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import NotificationBell from "@/components/NotificationBell";
import NotificationPreferences from "@/components/NotificationPreferences";
import {
  fetchPlatformTierConfig,
  getVisitRangeLabel,
  type VisitThreshold,
  type PlatformTierConfig,
  DEFAULT_VISIT_THRESHOLDS,
  DEFAULT_CASHBACK_BPS,
} from "@/lib/platformSettings";
import OnboardingTooltip from "@/components/OnboardingTooltip";
import { useOnboardingTour, type TourStep } from "@/lib/useOnboardingTour";
import { EarningsBannerAnim, ReceiptAnim, CashOutAnim, HeartAnim, TabSwitchAnim, PayoutTiersAnim, LevelUpAnim, MediaAnim, GameHistoryAnim, AnalyticsAnim, ProfileAnim, SupportAnim } from "@/components/TourIllustrations";

// ═══════════════════════════════════════════════════
// NEON PALETTE
// ═══════════════════════════════════════════════════
const NEON = {
  primary: "#00E5FF", primaryRGB: "0,229,255",
  pink: "#FF2D78", pinkRGB: "255,45,120",
  yellow: "#FFD600", yellowRGB: "255,214,0",
  green: "#00FF87", greenRGB: "0,255,135",
  purple: "#D050FF", purpleRGB: "208,80,255",
  orange: "#FF6B2D", orangeRGB: "255,107,45",
};
const LEVEL_COLORS = ["#FF2D78","#FF6B2D","#FFD600","#00FF87","#00E5FF","#D050FF","#FF2D78"];
const NEON_CYCLE = [NEON.yellow, NEON.orange, NEON.green, NEON.purple, NEON.pink, NEON.primary];

// ═══════════════════════════════════════════════════
// TYPESCRIPT INTERFACES
// ═══════════════════════════════════════════════════
interface ProfileData {
  id: string; full_name: string | null; first_name: string | null; last_name: string | null;
  username: string | null; email: string | null; bio: string | null; zip_code: string | null;
  phone: string | null; location: string | null; avatar_url: string | null; created_at: string | null;
  status: string | null; suspension_reason: string | null; lifetime_payout: number | null;
  available_balance: number | null; pending_payout: number | null; total_receipts: number | null;
  saved_places: number | null; payout_method: string | null; payout_identifier: string | null;
  payout_verified: boolean | null; preferences: Record<string, boolean> | null;
  referral_code: string | null; tax_id_on_file: boolean | null;
  w9_status: string | null; tax_1099_years: string[] | null;
  stripe_connect_account_id: string | null; stripe_connect_onboarding_complete: boolean | null;
}
interface ReceiptDisplay {
  id: string; business: string; businessId: string; date: string;
  amount: number; cashback: number; status: string; level: number; visitNum: number;
  photoUrl: string | null;
}
interface SavedPlace { id: string; name: string; type: string; neon: string; businessId: string; }
interface FriendData {
  friendshipId: string; id: string; name: string; username: string | null;
  avatarUrl: string | null; status: string; kind: "friend" | "pending" | "sent";
}
interface ExperienceData {
  id: string; businessName: string; caption: string | null; likes: number;
  date: string; mediaUrl: string | null; mediaType: string; storagePath: string;
}
interface PayoutBusiness {
  id: string; name: string; type: string; visits: number;
  level: number; rates: number[]; earned: number; balance: number;
}
interface CashoutRecord { id: string; date: string; amount: number; method: string; status: string; }
interface SearchUser { id: string; name: string; username: string | null; avatarUrl: string | null; }
interface CalcBizData { id: string; name: string; type: string; visits: number; level: number; rates: number[]; }
interface LevelUpData { business: string; newLevel: number; rate: number; }
interface RatingDisplay {
  id: string; businessId: string; businessName: string; businessType: string;
  stars: number; wouldGoAgain: boolean; privateNote: string | null; updatedAt: string;
}

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
function formatDate(d: string): string { const dt = new Date(d + "T12:00:00"); return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function formatMemberSince(d: string | null): string { if (!d) return "Member"; return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" }); }
function getInitials(f: string | null, l: string | null): string { return (((f||"")[0]||"")+((l||"")[0]||"")).toUpperCase() || "?"; }
function centsToDollars(c: number | null): number { return (c || 0) / 100; }
function getLevelForVisits(v: number, th: VisitThreshold[]): number { for (const t of th) { if (v >= t.min && (t.max === null || v <= t.max)) return t.level; } return 1; }
function getNeonRGB(n: string): string { if (n===NEON.pink) return NEON.pinkRGB; if (n===NEON.orange) return NEON.orangeRGB; if (n===NEON.yellow) return NEON.yellowRGB; if (n===NEON.green) return NEON.greenRGB; if (n===NEON.purple) return NEON.purpleRGB; return NEON.primaryRGB; }
async function getAuthToken(): Promise<string|null> { const{data:{session}}=await supabaseBrowser.auth.getSession(); return session?.access_token??null; }

// ═══════════════════════════════════════════════════
// REUSABLE UI COMPONENTS
// ═══════════════════════════════════════════════════
const NeonBorderCard = ({neon,neonRGB,children,style={},hoverLift=true,borderWidth=3,onClick}:{neon:string;neonRGB:string;children:React.ReactNode;style?:React.CSSProperties;hoverLift?:boolean;borderWidth?:number;onClick?:()=>void}) => {
  const [hovered, setHovered] = useState(false);
  const id = useRef(`nbc-${Math.random().toString(36).slice(2,8)}`).current;
  return (<>
    <style>{`@keyframes bt-${id}{0%{background-position:0% 50%}100%{background-position:300% 50%}}`}</style>
    <div onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onClick={onClick} style={{position:"relative",borderRadius:4,cursor:onClick?"pointer":"default",transition:"all 0.4s cubic-bezier(0.23,1,0.32,1)",transform:hoverLift&&hovered?"translateY(-3px)":"translateY(0)",...style}}>
      <div style={{position:"absolute",inset:-borderWidth,borderRadius:8,background:`linear-gradient(90deg,transparent,${neon},transparent,${neon},transparent)`,backgroundSize:"300% 100%",animation:`bt-${id} 10s linear infinite`,opacity:hovered?0.85:0.35,transition:"opacity 0.4s ease"}}/>
      <div style={{position:"relative",borderRadius:3,background:"#0C0C14",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,opacity:hovered?0.1:0.04,transition:"opacity 0.5s ease",backgroundImage:`radial-gradient(circle,${neon} 1px,transparent 1px)`,backgroundSize:"20px 20px",backgroundPosition:"10px 10px"}}/>
        <div style={{position:"absolute",bottom:-30,left:"50%",transform:"translateX(-50%)",width:"70%",height:80,background:`radial-gradient(ellipse,rgba(${neonRGB},${hovered?0.12:0.04}) 0%,transparent 70%)`,transition:"all 0.5s ease",filter:"blur(15px)"}}/>
        <div style={{position:"relative",zIndex:2}}>{children}</div>
      </div>
    </div>
  </>);
};
const NeonTag = ({neon,children,style={}}:{neon:string;neonRGB?:string;children:React.ReactNode;style?:React.CSSProperties}) => (<span style={{display:"inline-block",fontFamily:"'DM Sans',sans-serif",fontSize:9,fontWeight:700,letterSpacing:"0.18em",color:neon,textShadow:`0 0 8px ${neon}90,0 0 18px ${neon}40`,textTransform:"uppercase",...style}}>{children}</span>);
const SectionHeader = ({icon,label,neon,neonRGB,count,rightElement}:{icon:string;label:string;neon:string;neonRGB:string;count?:number;rightElement?:React.ReactNode}) => (<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:6,height:6,borderRadius:"50%",background:neon,boxShadow:`0 0 6px ${neon},0 0 12px ${neon}50`}}/><span style={{fontSize:10,fontWeight:700,color:neon,letterSpacing:"0.2em",textTransform:"uppercase",textShadow:`0 0 10px rgba(${neonRGB},0.3)`,fontFamily:"'DM Sans',sans-serif"}}>{icon} {label}</span>{count!==undefined&&<span style={{fontSize:10,color:"rgba(255,255,255,0.25)",fontWeight:500}}>({count})</span>}</div>{rightElement}</div>);
const GlassPill = ({active,onClick,children,neon,neonRGB}:{active:boolean;onClick:()=>void;children:React.ReactNode;neon:string;neonRGB:string}) => (<button onClick={onClick} style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",padding:"6px 16px",borderRadius:3,border:`1px solid ${active?`rgba(${neonRGB},0.5)`:"rgba(255,255,255,0.08)"}`,background:active?`rgba(${neonRGB},0.1)`:"transparent",color:active?neon:"rgba(255,255,255,0.35)",cursor:"pointer",transition:"all 0.3s ease",outline:"none"}}>{children}</button>);
const StatusBadge = ({status}:{status:string}) => { const m:Record<string,{color:string;label:string}>={approved:{color:NEON.green,label:"Approved"},pending:{color:NEON.yellow,label:"Pending"},rejected:{color:NEON.pink,label:"Rejected"},cancelled:{color:"rgba(255,255,255,0.2)",label:"Cancelled"}}; const s=m[status]||m.pending; return (<span style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:s.color,textShadow:`0 0 6px ${s.color}50`,display:"flex",alignItems:"center",gap:5}}><span style={{width:5,height:5,borderRadius:"50%",background:s.color,boxShadow:`0 0 4px ${s.color}`}}/>{s.label}</span>); };
const MarqueeText = ({text,speed=30}:{text:string;speed?:number}) => { const c=`${text}     \u2605     ${text}     \u2605     ${text}     \u2605     `; return (<div style={{overflow:"hidden",whiteSpace:"nowrap"}}><div style={{display:"inline-block",animation:`marqueeScroll ${speed}s linear infinite`}}><span>{c}</span><span>{c}</span></div></div>); };
const LevelProgressBar = ({currentLevel,visits,rates,thresholds}:{currentLevel:number;visits:number;rates:number[];neon?:string;thresholds:VisitThreshold[]}) => { const li=currentLevel-1; const t=thresholds[li]||thresholds[0]; const lo=t.min; const hi=t.max; const progress=hi===null?1:Math.min((visits-lo+1)/(hi-lo+1),1); return (<div><div style={{display:"flex",gap:3,marginBottom:8}}>{[1,2,3,4,5,6,7].map((lvl)=>{const active=lvl===currentLevel;const completed=lvl<currentLevel;const c=LEVEL_COLORS[lvl-1];return(<div key={lvl} style={{flex:1,height:4,borderRadius:2,background:completed?c:active?`${c}80`:"rgba(255,255,255,0.06)",position:"relative",overflow:"hidden"}}>{active&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:`${Math.min(progress*100,100)}%`,background:c,borderRadius:2,boxShadow:`0 0 6px ${c}60`}}/>}</div>);})}</div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:"0.05em"}}>Lvl {currentLevel} {"\u00b7"} {visits} visits {"\u00b7"} {rates[li]!==undefined?rates[li].toFixed(1):"?"}% back</span>{currentLevel<7&&hi!==null&&<span style={{fontSize:9,color:"rgba(255,255,255,0.2)"}}>{hi-visits+1} to next level</span>}</div></div>); };

// ═══════════════════════════════════════════════════
// MAIN COMPONENT MARKER - modals and main below
// ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════
// RECEIPT UPLOAD MODAL
// ═══════════════════════════════════════════════════
const ReceiptUploadModal = ({open,onClose,token,userId,onSuccess}:{open:boolean;onClose:()=>void;token:string|null;userId:string|null;onSuccess:(r:ReceiptDisplay)=>void}) => {
  const [dragOver,setDragOver]=useState(false);
  const [bizSearch,setBizSearch]=useState("");
  const [bizResults,setBizResults]=useState<{id:string;name:string}[]>([]);
  const [selectedBiz,setSelectedBiz]=useState<{id:string;name:string}|null>(null);
  const [subtotal,setSubtotal]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [submitting,setSubmitting]=useState(false);
  const [errMsg,setErrMsg]=useState("");
  const [confirmStep,setConfirmStep]=useState(false);
  const [showSubtotalHelp,setShowSubtotalHelp]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);
  const debounceRef=useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>{
    if(!bizSearch||selectedBiz){setBizResults([]);return;}
    if(debounceRef.current)clearTimeout(debounceRef.current);
    debounceRef.current=setTimeout(async()=>{
      const {data}=await supabaseBrowser.from("business").select("id,business_name,public_business_name").eq("is_active",true).ilike("business_name",`%${bizSearch}%`).limit(10);
      setBizResults((data||[]).map((b: Record<string, unknown>)=>({id:b.id as string,name:(b.public_business_name||b.business_name||"Business") as string})));
    },400);
  },[bizSearch,selectedBiz]);

  const handleReview = () => {
    if(!selectedBiz||!subtotal)return;
    const amt=parseFloat(subtotal);
    if(isNaN(amt)||amt<=0){setErrMsg("Enter a valid amount");return;}
    if(file&&file.size>10*1024*1024){setErrMsg("Receipt photo must be under 10MB");return;}
    setErrMsg("");
    setConfirmStep(true);
  };

  const handleSubmit = async () => {
    if(!token||!userId||!selectedBiz||!subtotal)return;
    const amt=parseFloat(subtotal);
    setSubmitting(true);setErrMsg("");
    try{
      let photoPath:string|null=null;
      if(file){
        const safeName=file.name.replace(/[^\w.\-]+/g,"_");
        const uid=(typeof crypto!=="undefined"&&typeof crypto.randomUUID==="function")?crypto.randomUUID():Date.now().toString();
        photoPath=`${userId}/receipts/${uid}-${safeName}`;
        const{error:storageErr}=await supabaseBrowser.storage.from("receipts").upload(photoPath,file,{upsert:false});
        if(storageErr){console.error("[receipt] Storage upload error:",storageErr);photoPath=null;}
      }
      const res=await fetch("/api/receipts",{
        method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({businessId:selectedBiz.id,userId,receiptTotalCents:Math.round(amt*100),visitDate:new Date().toISOString().split("T")[0],photoUrl:photoPath}),
      });
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Submit failed");
      let signedPhotoUrl:string|null=null;
      if(photoPath){
        const{data:signedData}=await supabaseBrowser.storage.from("receipts").createSignedUrl(photoPath,3600);
        signedPhotoUrl=signedData?.signedUrl||null;
      }
      onSuccess({id:data.receiptId||"new",business:selectedBiz.name,businessId:selectedBiz.id,date:formatDate(new Date().toISOString().split("T")[0]),amount:amt,cashback:centsToDollars(data.payoutCents||0),status:"pending",level:data.tier?.tier_index||1,visitNum:data.visitsThisWindow||1,photoUrl:signedPhotoUrl});
      onClose();setBizSearch("");setSelectedBiz(null);setSubtotal("");setFile(null);setConfirmStep(false);
    }catch(e){setErrMsg(e instanceof Error?e.message:"Submit failed");setConfirmStep(false);}finally{setSubmitting(false);}
  };

  const handleClose = () => { onClose(); setConfirmStep(false); setErrMsg(""); };

  if(!open)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",animation:"fadeIn 0.3s ease"}} onClick={handleClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:480,borderRadius:6,background:"#0C0C14",border:`1px solid rgba(${NEON.greenRGB},0.2)`,boxShadow:`0 0 60px rgba(${NEON.greenRGB},0.08)`,padding:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <NeonTag neon={NEON.green}>{confirmStep?"Confirm Receipt":"Upload Receipt"}</NeonTag>
          <div onClick={handleClose} style={{cursor:"pointer",width:28,height:28,borderRadius:3,border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.35)",fontSize:14}}>{"\u2715"}</div>
        </div>

        {confirmStep ? (
          <div style={{animation:"fadeIn 0.2s ease"}}>
            <div style={{fontSize:11,fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.25)",marginBottom:16}}>Please review your receipt details</div>
            <div style={{padding:"18px 20px",borderRadius:4,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,paddingBottom:12,borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                <span style={{fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.25)"}}>Business</span>
                <span style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.75)"}}>{selectedBiz?.name}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,paddingBottom:12,borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                <span style={{fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.25)"}}>Subtotal</span>
                <span style={{fontSize:16,fontWeight:700,color:NEON.green,fontFamily:"'Clash Display','DM Sans',sans-serif"}}>${parseFloat(subtotal).toFixed(2)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:file?12:0,paddingBottom:file?12:0,borderBottom:file?"1px solid rgba(255,255,255,0.04)":"none"}}>
                <span style={{fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.25)"}}>Date</span>
                <span style={{fontSize:12,color:"rgba(255,255,255,0.55)"}}>{new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</span>
              </div>
              {file&&(
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.25)"}}>Photo</span>
                  <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{file.name}</span>
                </div>
              )}
            </div>
            {errMsg&&<div style={{fontSize:11,color:NEON.pink,marginBottom:12}}>{errMsg}</div>}
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setConfirmStep(false)} style={{flex:1,padding:"12px 20px",borderRadius:3,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.35)",fontSize:11,fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Go Back</button>
              <button onClick={handleSubmit} disabled={submitting} style={{flex:1,padding:"12px 20px",borderRadius:3,border:`1px solid rgba(${NEON.greenRGB},0.5)`,background:`rgba(${NEON.greenRGB},0.12)`,color:NEON.green,fontSize:11,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textShadow:`0 0 8px ${NEON.green}60`,opacity:submitting?0.5:1}}>{submitting?"Submitting...":"Confirm & Submit"}</button>
            </div>
          </div>
        ) : (
          <>
            <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)setFile(f)}} onClick={()=>fileRef.current?.click()} style={{border:`2px dashed ${dragOver?NEON.green:"rgba(255,255,255,0.1)"}`,borderRadius:6,padding:"40px 20px",textAlign:"center",transition:"all 0.3s ease",background:dragOver?`rgba(${NEON.greenRGB},0.04)`:"transparent",cursor:"pointer",marginBottom:20}}>
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)setFile(f)}}/>
              <div style={{fontSize:36,marginBottom:12,opacity:0.5}}>{file?"\u2705":"\uD83D\uDCF7"}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",marginBottom:6,fontFamily:"'DM Sans',sans-serif"}}>{file?file.name:"Drag & drop your receipt photo"}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.2)"}}>{file?"Tap to change":"or tap to browse"}</div>
            </div>
            <div style={{marginBottom:16,position:"relative"}}>
              <label style={{display:"block",fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",marginBottom:6,fontFamily:"'DM Sans',sans-serif"}}>Select Business</label>
              {selectedBiz?(<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 14px",borderRadius:3,border:`1px solid rgba(${NEON.greenRGB},0.25)`,background:`rgba(${NEON.greenRGB},0.05)`}}><span style={{fontSize:13,color:"rgba(255,255,255,0.75)",fontWeight:600}}>{selectedBiz.name}</span><div onClick={()=>{setSelectedBiz(null);setBizSearch("")}} style={{cursor:"pointer",color:"rgba(255,255,255,0.25)",fontSize:12}}>{"\u2715"}</div></div>
              ):(
              <><input type="text" placeholder="Search a business..." value={bizSearch} onChange={e=>setBizSearch(e.target.value)} style={{width:"100%",padding:"9px 14px",borderRadius:3,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",color:"#fff",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",boxSizing:"border-box"}}/>
              {bizResults.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:4,zIndex:20,borderRadius:4,background:"#111120",border:`1px solid rgba(${NEON.greenRGB},0.2)`,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",overflow:"hidden"}}>{bizResults.map(b=>(<div key={b.id} onClick={()=>{setSelectedBiz(b);setBizSearch(b.name);setBizResults([])}} style={{padding:"10px 14px",cursor:"pointer",fontSize:12,color:"rgba(255,255,255,0.7)",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>{b.name}</div>))}</div>}</>
              )}
            </div>
            <div style={{marginBottom:20,position:"relative"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <label style={{fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",fontFamily:"'DM Sans',sans-serif"}}>Receipt Subtotal</label>
                <div onClick={e=>{e.stopPropagation();setShowSubtotalHelp(!showSubtotalHelp)}} style={{cursor:"pointer",width:16,height:16,borderRadius:"50%",border:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.3)",transition:"all 0.2s",background:showSubtotalHelp?"rgba(255,255,255,0.08)":"transparent"}} title="What is a subtotal?">?</div>
              </div>
              {showSubtotalHelp&&(
                <div style={{position:"absolute",top:-2,left:0,right:0,zIndex:30,borderRadius:6,background:"#111120",border:`1px solid rgba(${NEON.greenRGB},0.25)`,boxShadow:"0 12px 40px rgba(0,0,0,0.7)",padding:20,animation:"fadeIn 0.2s ease"}} onClick={e=>e.stopPropagation()}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:NEON.green}}>What is a subtotal?</div>
                    <div onClick={()=>setShowSubtotalHelp(false)} style={{cursor:"pointer",color:"rgba(255,255,255,0.3)",fontSize:12,marginTop:-2}}>{"\u2715"}</div>
                  </div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",lineHeight:1.6,marginBottom:16}}>
                    The <span style={{color:"#fff",fontWeight:600}}>subtotal</span> is the amount <span style={{color:"#fff",fontWeight:600}}>before tax</span> is added. Your cashback is calculated on the subtotal, not the total. Look for it on your receipt — it&apos;s usually listed right above the tax line.
                  </div>
                  {/* Mock receipt example */}
                  <div style={{borderRadius:4,background:"#faf8f4",padding:"16px 18px",fontFamily:"'Courier New',monospace",fontSize:11,color:"#222",lineHeight:1.8}}>
                    <div style={{textAlign:"center",fontWeight:700,fontSize:12,marginBottom:2}}>THE CORNER BISTRO</div>
                    <div style={{textAlign:"center",fontSize:9,color:"#888",marginBottom:8}}>123 Main St - (555) 867-5309</div>
                    <div style={{borderTop:"1px dashed #ccc",paddingTop:8,marginBottom:4}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span>Burger Deluxe</span><span>$14.50</span></div>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span>Caesar Salad</span><span>$11.00</span></div>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span>Iced Tea (2)</span><span>$7.00</span></div>
                      <div style={{display:"flex",justifyContent:"space-between"}}><span>Brownie Sundae</span><span>$9.50</span></div>
                    </div>
                    <div style={{borderTop:"1px dashed #ccc",paddingTop:8,marginTop:4}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,background:"rgba(0,255,135,0.18)",margin:"0 -6px",padding:"3px 6px",borderRadius:3,border:"1.5px solid #00CC6A"}}>
                        <span>SUBTOTAL</span><span>$42.00</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",color:"#888",marginTop:2}}><span>Tax (8.5%)</span><span>$3.57</span></div>
                      <div style={{display:"flex",justifyContent:"space-between",marginTop:2,paddingTop:6,borderTop:"1px dashed #ccc",fontWeight:700}}><span>TOTAL</span><span>$45.57</span></div>
                    </div>
                  </div>
                  <div style={{marginTop:12,display:"flex",alignItems:"center",gap:6}}>
                    <div style={{width:12,height:12,borderRadius:2,background:"rgba(0,255,135,0.18)",border:"1.5px solid #00CC6A"}}/>
                    <span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>Enter this amount — the subtotal before tax</span>
                  </div>
                </div>
              )}
              <input type="number" placeholder="0.00" value={subtotal} onChange={e=>setSubtotal(e.target.value)} style={{width:"100%",padding:"10px 14px",borderRadius:3,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",color:"#fff",fontSize:16,fontFamily:"'Clash Display','DM Sans',sans-serif",outline:"none",boxSizing:"border-box"}}/>
            </div>
            {errMsg&&<div style={{fontSize:11,color:NEON.pink,marginBottom:12}}>{errMsg}</div>}
            <button onClick={handleReview} disabled={!selectedBiz||!subtotal} style={{width:"100%",padding:"12px 20px",borderRadius:3,border:`1px solid rgba(${NEON.greenRGB},0.5)`,background:`rgba(${NEON.greenRGB},0.12)`,color:NEON.green,fontSize:11,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textShadow:`0 0 8px ${NEON.green}60`,opacity:(!selectedBiz||!subtotal)?0.4:1}}>Review Receipt</button>
          </>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// RECEIPT DETAIL MODAL
// ═══════════════════════════════════════════════════
const ReceiptDetailModal = ({receipt,open,onClose}:{receipt:ReceiptDisplay|null;open:boolean;onClose:()=>void}) => {
  if(!open||!receipt)return null;
  const statusColor=receipt.status==="approved"?NEON.green:receipt.status==="pending"?NEON.yellow:NEON.pink;
  const statusRGB=receipt.status==="approved"?NEON.greenRGB:receipt.status==="pending"?NEON.yellowRGB:NEON.pinkRGB;
  const gradient="linear-gradient(135deg, #0a1628 0%, #1a3a5c 50%, #4a90d9 100%)";
  return(
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",animation:"fadeIn 0.3s ease"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:540,borderRadius:6,background:"#0C0C14",border:`1px solid rgba(${statusRGB},0.2)`,boxShadow:`0 0 60px rgba(${statusRGB},0.08)`,overflow:"hidden"}}>
        <div style={{height:260,background:gradient,position:"relative",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
          {receipt.photoUrl ? (
            <img src={receipt.photoUrl} alt="Receipt photo" style={{width:"100%",height:"100%",objectFit:"contain",background:"#000"}} />
          ) : (
            <div style={{width:120,background:"rgba(255,255,255,0.92)",borderRadius:4,padding:"16px 14px",boxShadow:"0 4px 24px rgba(0,0,0,0.4)",transform:"rotate(-2deg)"}}>
              <div style={{fontSize:8,color:"#333",fontWeight:700,textAlign:"center",marginBottom:6,fontFamily:"monospace",textTransform:"uppercase",letterSpacing:"0.1em"}}>{receipt.business}</div>
              <div style={{borderTop:"1px dashed #ccc",margin:"4px 0"}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:7,color:"#555",fontFamily:"monospace",marginBottom:2}}><span>Subtotal</span><span>${receipt.amount.toFixed(2)}</span></div>
              <div style={{borderTop:"1px dashed #ccc",margin:"4px 0"}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:"#111",fontWeight:700,fontFamily:"monospace"}}><span>Total</span><span>${receipt.amount.toFixed(2)}</span></div>
              <div style={{textAlign:"center",fontSize:6,color:"#999",marginTop:6,fontFamily:"monospace"}}>{receipt.date}</div>
            </div>
          )}
          <div style={{position:"absolute",top:14,right:14,padding:"5px 12px",borderRadius:3,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",border:`1px solid ${statusColor}40`}}><StatusBadge status={receipt.status}/></div>
          <div onClick={onClose} style={{position:"absolute",top:14,left:14,width:30,height:30,borderRadius:4,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"rgba(255,255,255,0.6)",fontSize:14}}>{"\u2715"}</div>
        </div>
        <div style={{padding:"24px 28px"}}>
          <h3 style={{fontFamily:"'Clash Display','DM Sans',sans-serif",fontSize:22,fontWeight:700,color:"#fff",margin:0,lineHeight:1.2,marginBottom:4}}>{receipt.business}</h3>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",marginBottom:20}}>{receipt.date} {"\u00b7"} Receipt #{receipt.id.slice(0,8)}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
            {[{label:"Subtotal",value:`$${receipt.amount.toFixed(2)}`,color:"#fff"},{label:"Cashback Earned",value:`+$${receipt.cashback.toFixed(2)}`,color:NEON.green},{label:"Status",value:receipt.status.charAt(0).toUpperCase()+receipt.status.slice(1),color:statusColor}].map(d=>(<div key={d.label} style={{padding:"12px 14px",borderRadius:4,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.04)"}}><div style={{fontSize:9,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.2)",marginBottom:5}}>{d.label}</div><div style={{fontFamily:"'Clash Display','DM Sans',sans-serif",fontSize:17,fontWeight:700,color:d.color}}>{d.value}</div></div>))}
          </div>
          <div style={{display:"flex",gap:20,padding:"14px 16px",borderRadius:4,background:"rgba(255,255,255,0.015)",border:"1px solid rgba(255,255,255,0.04)"}}>
            <div><span style={{fontSize:10,color:"rgba(255,255,255,0.2)",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>Visit #</span><span style={{fontSize:13,color:"rgba(255,255,255,0.55)",fontWeight:600,marginLeft:8}}>{receipt.visitNum}</span></div>
            <div style={{width:1,background:"rgba(255,255,255,0.06)"}}/>
            <div><span style={{fontSize:10,color:"rgba(255,255,255,0.2)",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>Level</span><span style={{fontSize:13,color:LEVEL_COLORS[receipt.level-1],fontWeight:700,marginLeft:8}}>Level {receipt.level}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// LEVEL-UP CELEBRATION MODAL
// ═══════════════════════════════════════════════════
const LevelUpCelebration = ({data,onClose}:{data:LevelUpData|null;onClose:()=>void}) => {
  if(!data)return null;
  const color=LEVEL_COLORS[data.newLevel-1];
  const colorRGB=getNeonRGB(color);
  return(
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.9)",backdropFilter:"blur(16px)",animation:"fadeIn 0.3s ease"}} onClick={onClose}>
      <style>{`@keyframes levelBurst{0%{transform:scale(0.3);opacity:0}50%{transform:scale(1.1);opacity:1}100%{transform:scale(1);opacity:1}}@keyframes confettiFall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(120px) rotate(720deg);opacity:0}}@keyframes levelGlow{0%,100%{text-shadow:0 0 20px ${color}90,0 0 60px ${color}40,0 0 100px ${color}20}50%{text-shadow:0 0 30px ${color},0 0 80px ${color}60,0 0 120px ${color}30}}`}</style>
      <div onClick={e=>e.stopPropagation()} style={{textAlign:"center",animation:"levelBurst 0.6s cubic-bezier(0.34,1.56,0.64,1) both",position:"relative"}}>
        {Array.from({length:24}).map((_,i)=>(<div key={i} style={{position:"absolute",left:`${50+(Math.random()-0.5)*80}%`,top:`${50+(Math.random()-0.5)*40}%`,width:6,height:6,borderRadius:Math.random()>0.5?"50%":"1px",background:LEVEL_COLORS[i%7],animation:`confettiFall ${1.5+Math.random()*1.5}s ease-out ${Math.random()*0.5}s both`}}/>))}
        <div style={{fontFamily:"'Clash Display','DM Sans',sans-serif",fontSize:96,fontWeight:700,color,lineHeight:1,animation:"levelGlow 2s ease-in-out infinite",marginBottom:8}}>{data.newLevel}</div>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.25em",textTransform:"uppercase",color,marginBottom:16}}>{"\u2605"} Level Up {"\u2605"}</div>
        <h2 style={{fontFamily:"'Clash Display','DM Sans',sans-serif",fontSize:24,fontWeight:700,color:"#fff",marginBottom:8}}>{data.business}</h2>
        <p style={{fontSize:13,color:"rgba(255,255,255,0.45)",marginBottom:6,maxWidth:300,margin:"0 auto 6px"}}>You now earn <span style={{color,fontWeight:700}}>{data.rate}% back</span> on every visit!</p>
        <button onClick={onClose} style={{marginTop:20,padding:"10px 28px",borderRadius:3,border:`1px solid ${color}60`,background:`rgba(${colorRGB},0.12)`,color,fontSize:11,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textShadow:`0 0 8px ${color}50`}}>Keep Going</button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// CASH OUT MODAL (Dual Option: Venmo Instant + Bank Free)
// ═══════════════════════════════════════════════════
const CashOutModal = ({mode,onClose,onGoToSettings,amount,token,onSuccess,minCashoutCents=2000,profile}:{mode:string|null;onClose:()=>void;onGoToSettings:()=>void;amount:number;token:string|null;onSuccess:()=>void;minCashoutCents?:number;profile:ProfileData|null}) => {
  const [processing,setProcessing]=useState(false);
  const [errMsg,setErrMsg]=useState("");
  const [selectedMethod,setSelectedMethod]=useState<"venmo"|"bank">("bank");
  const [customAmount,setCustomAmount]=useState(amount.toFixed(2));

  const parsedAmount = Math.min(Math.max(0,parseFloat(customAmount)||0),amount);
  const amountCents = Math.round(parsedAmount*100);
  const feeCents = selectedMethod==="venmo"?Math.round(amountCents*0.03):0;
  const netCents = amountCents-feeCents;

  const hasVenmo = !!(profile?.payout_method==="venmo"&&profile?.payout_identifier);
  const hasBank = !!(profile?.stripe_connect_account_id&&profile?.stripe_connect_onboarding_complete);

  const canSubmit = selectedMethod==="venmo"?hasVenmo:(selectedMethod==="bank"?hasBank:false);

  const handleConfirm = async () => {
    if(!token||!canSubmit)return;
    setProcessing(true);setErrMsg("");
    try{
      const res=await fetch("/api/users/cashout",{
        method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({amountCents,method:selectedMethod}),
      });
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Cash out failed");
      onSuccess();onClose();
    }catch(e){setErrMsg(e instanceof Error?e.message:"Cash out failed");}finally{setProcessing(false);}
  };

  if(!mode)return null;

  // No payout method connected at all
  if(mode==="noPayment"){
    return(
      <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",animation:"fadeIn 0.3s ease"}} onClick={onClose}>
        <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:420,borderRadius:6,background:"#0C0C14",border:`1px solid rgba(${NEON.pinkRGB},0.2)`,boxShadow:`0 0 60px rgba(${NEON.pinkRGB},0.08)`,padding:28,textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:16}}>{"\uD83D\uDD17"}</div>
          <h3 style={{fontFamily:"'Clash Display','DM Sans',sans-serif",fontSize:20,fontWeight:700,color:"#fff",marginBottom:8}}>No Payment Account Connected</h3>
          <p style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginBottom:24,lineHeight:1.6,maxWidth:320,margin:"0 auto 24px"}}>Connect your Venmo or bank account in Settings to receive earnings.</p>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <button onClick={onClose} style={{padding:"10px 22px",borderRadius:3,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.35)",fontSize:10,fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Later</button>
            <button onClick={onGoToSettings} style={{padding:"10px 22px",borderRadius:3,border:`1px solid rgba(${NEON.primaryRGB},0.5)`,background:`rgba(${NEON.primaryRGB},0.12)`,color:NEON.primary,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textShadow:`0 0 8px ${NEON.primary}50`}}>Go to Settings</button>
          </div>
        </div>
      </div>
    );
  }

  // Dual option selector
  const cardStyle=(selected:boolean,rgb:string)=>({
    flex:1,padding:16,borderRadius:6,cursor:"pointer",textAlign:"center" as const,
    border:selected?`2px solid rgba(${rgb},0.6)`:"2px solid rgba(255,255,255,0.08)",
    background:selected?`rgba(${rgb},0.08)`:"rgba(255,255,255,0.02)",
    transition:"all 0.2s ease",
  });

  return(
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",animation:"fadeIn 0.3s ease",padding:"0 12px"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:460,borderRadius:6,background:"#0C0C14",border:`1px solid rgba(${NEON.yellowRGB},0.2)`,boxShadow:`0 0 60px rgba(${NEON.yellowRGB},0.08)`,padding:28}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:40,marginBottom:8}}>{"\uD83D\uDCB0"}</div>
          <h3 style={{fontFamily:"'Clash Display','DM Sans',sans-serif",fontSize:22,fontWeight:700,color:"#fff",margin:0}}>Cash Out</h3>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:4}}>Choose how you want to receive your money</p>
          <div style={{marginTop:12,display:"inline-flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:8,padding:"8px 16px",cursor:"text"}} onClick={()=>{const el=document.getElementById("cashout-amount");if(el)el.focus();}}>
            <span style={{fontSize:22,fontWeight:700,color:"rgba(255,255,255,0.5)"}}>$</span>
            <input id="cashout-amount" type="number" value={customAmount} onChange={e=>setCustomAmount(e.target.value)} onBlur={()=>{const v=parseFloat(customAmount)||0;setCustomAmount(Math.min(Math.max(0,v),amount).toFixed(2));}} onFocus={e=>e.target.select()} step="0.01" min="0" max={amount} style={{fontSize:22,fontWeight:700,color:"#fff",background:"transparent",border:"none",outline:"none",width:90,textAlign:"center",fontFamily:"'Clash Display','DM Sans',sans-serif"}} />
          </div>
          <p style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:6}}>Available: ${amount.toFixed(2)} — tap amount to edit</p>
        </div>

        <div style={{display:"flex",gap:10,marginBottom:20}}>
          {/* Venmo - Instant */}
          <div onClick={()=>setSelectedMethod("venmo")} style={cardStyle(selectedMethod==="venmo",NEON.yellowRGB)}>
            <div style={{fontSize:24,marginBottom:6}}>{"\u26A1"}</div>
            <div style={{fontSize:12,fontWeight:700,color:selectedMethod==="venmo"?NEON.yellow:"rgba(255,255,255,0.7)",marginBottom:2,fontFamily:"'DM Sans',sans-serif"}}>Instant</div>
            <div style={{fontSize:10,color:selectedMethod==="venmo"?NEON.yellow:"rgba(255,255,255,0.6)",fontWeight:600,marginBottom:8}}>Venmo</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",lineHeight:1.5}}>Arrives in minutes</div>
            <div style={{fontSize:10,color:NEON.orange,fontWeight:600,marginTop:4}}>3% fee ({`$${(feeCents/100).toFixed(2)}`})</div>
            <div style={{fontSize:11,color:"#fff",fontWeight:600,marginTop:6}}>You get ${selectedMethod==="venmo"?(netCents/100).toFixed(2):((amountCents-Math.round(amountCents*0.03))/100).toFixed(2)}</div>
            {!hasVenmo&&<div style={{fontSize:9,color:NEON.pink,marginTop:6}}>Not connected</div>}
          </div>

          {/* Bank - Free */}
          <div onClick={()=>setSelectedMethod("bank")} style={cardStyle(selectedMethod==="bank",NEON.greenRGB)}>
            <div style={{fontSize:24,marginBottom:6}}>{"\uD83C\uDFE6"}</div>
            <div style={{fontSize:12,fontWeight:700,color:selectedMethod==="bank"?NEON.green:"rgba(255,255,255,0.7)",marginBottom:2,fontFamily:"'DM Sans',sans-serif"}}>Standard</div>
            <div style={{fontSize:10,color:selectedMethod==="bank"?NEON.green:"rgba(255,255,255,0.6)",fontWeight:600,marginBottom:8}}>Bank Account</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.6)",lineHeight:1.5}}>2-3 business days</div>
            <div style={{fontSize:10,color:NEON.green,fontWeight:600,marginTop:4}}>FREE - no fees</div>
            <div style={{fontSize:11,color:"#fff",fontWeight:600,marginTop:6}}>You get ${parsedAmount.toFixed(2)}</div>
            {!hasBank&&<div style={{fontSize:9,color:NEON.pink,marginTop:6}}>Not connected</div>}
          </div>
        </div>

        {!canSubmit&&(
          <div style={{textAlign:"center",marginBottom:16}}>
            <p style={{fontSize:11,color:NEON.yellow,marginBottom:8}}>
              {selectedMethod==="venmo"?"Connect your Venmo in Settings to use instant payouts.":"Connect your bank account in Settings to use free transfers."}
            </p>
            <button onClick={onGoToSettings} style={{padding:"8px 18px",borderRadius:3,border:`1px solid rgba(${NEON.primaryRGB},0.4)`,background:`rgba(${NEON.primaryRGB},0.1)`,color:NEON.primary,fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Go to Settings</button>
          </div>
        )}

        {errMsg&&<div style={{fontSize:11,color:NEON.pink,marginBottom:12,textAlign:"center"}}>{errMsg}</div>}

        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <button onClick={onClose} style={{padding:"10px 22px",borderRadius:3,border:"1px solid rgba(255,255,255,0.2)",background:"transparent",color:"rgba(255,255,255,0.7)",fontSize:10,fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Cancel</button>
          {canSubmit&&<button onClick={handleConfirm} disabled={processing} style={{padding:"10px 22px",borderRadius:3,border:`1px solid rgba(${selectedMethod==="venmo"?NEON.yellowRGB:NEON.greenRGB},0.5)`,background:`rgba(${selectedMethod==="venmo"?NEON.yellowRGB:NEON.greenRGB},0.12)`,color:selectedMethod==="venmo"?NEON.yellow:NEON.green,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",opacity:processing?0.5:1}}>{processing?"Processing...":`Confirm ${selectedMethod==="venmo"?"Venmo":"Bank"} Cash Out`}</button>}
        </div>
        <div style={{marginTop:16,fontSize:9,color:"rgba(255,255,255,0.5)",letterSpacing:"0.05em",textAlign:"center"}}>*${(minCashoutCents/100).toFixed(2)} minimum to cash out</div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════
// BANK ACCOUNT SECTION (Stripe Connect)
// ═══════════════════════════════════════════════════
function useBankAccount(token:string|null,profile:ProfileData|null,onProfileSaved:(p:ProfileData)=>void) {
  const [loading,setLoading]=useState(false);
  const [statusMsg,setStatusMsg]=useState("");

  const hasAccount = !!profile?.stripe_connect_account_id;
  const isComplete = !!profile?.stripe_connect_onboarding_complete;

  const handleConnectBank = async () => {
    if(!token)return;
    setLoading(true);setStatusMsg("");
    try{
      const res=await fetch("/api/stripe/connect/onboard",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`}});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Failed to start bank connection");
      if(data.status==="complete"){
        setStatusMsg("Bank account already connected!");
        const pRes=await fetch("/api/users/profile",{headers:{Authorization:`Bearer ${token}`}});
        if(pRes.ok){const d=await pRes.json();onProfileSaved(d.profile);}
      } else if(data.url){
        window.location.href=data.url;
      }
    }catch(e){setStatusMsg(e instanceof Error?e.message:"Connection failed");}finally{setLoading(false);}
  };

  const handleManageBank = async () => {
    if(!token)return;
    setLoading(true);
    try{
      const res=await fetch("/api/stripe/connect/dashboard",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`}});
      const data=await res.json();
      if(!res.ok)throw new Error(data.error||"Failed to open dashboard");
      if(data.url)window.open(data.url,"_blank");
    }catch(e){setStatusMsg(e instanceof Error?e.message:"Failed to open dashboard");}finally{setLoading(false);}
  };

  return { loading, statusMsg, hasAccount, isComplete, handleConnectBank, handleManageBank };
}

// ═══════════════════════════════════════════════════
// SETTINGS MODAL
// ═══════════════════════════════════════════════════
const SettingsModal = ({open,onClose,profile,avatarUrl,onAvatarChange,onProfileSaved,token}:{
  open:boolean;onClose:()=>void;profile:ProfileData|null;avatarUrl:string|null;
  onAvatarChange:(url:string|null)=>void;onProfileSaved:(p:ProfileData)=>void;token:string|null;
}) => {
  const [activeTab,setActiveTab]=useState("profile");
  const settingsAvatarRef=useRef<HTMLInputElement>(null);
  const [payoutIdentifier,setPayoutIdentifier]=useState(profile?.payout_identifier||"");
  const [saving,setSaving]=useState(false);
  const [saveMsg,setSaveMsg]=useState("");
  const [formData,setFormData]=useState({first_name:"",last_name:"",username:"",email:"",zip_code:"",bio:""});
  const [blockedUsers,setBlockedUsers]=useState<FriendData[]>([]);
  const [supportMsg,setSupportMsg]=useState("");
  const [supportSent,setSupportSent]=useState(false);
  const [faqOpen,setFaqOpen]=useState<number|null>(null);
  const [notifPrefs,setNotifPrefs]=useState<Record<string,boolean>>({push_notifications:true,email_notifications:true,sms_notifications:false,marketing_emails:false});

  useEffect(()=>{if(profile){setFormData({first_name:profile.first_name||"",last_name:profile.last_name||"",username:profile.username||"",email:profile.email||"",zip_code:profile.zip_code||"",bio:profile.bio||""});setPayoutIdentifier(profile.payout_identifier||"");if(profile.preferences)setNotifPrefs(prev=>({...prev,...profile.preferences}));}},[profile]);

  useEffect(()=>{
    if(!open||!token||activeTab!=="notifications"||!profile?.id)return;
    (async()=>{const blocked:FriendData[]=[];const{data:rows}=await supabaseBrowser.from("user_friends").select("id,user_id,friend_id,status").or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`).eq("status","blocked");if(rows){for(const r of rows){const otherId=r.user_id===profile.id?r.friend_id:r.user_id;const{data:p}=await supabaseBrowser.from("profiles").select("id,full_name,first_name,last_name,username").eq("id",otherId).maybeSingle();if(p)blocked.push({friendshipId:r.id,id:p.id,name:p.full_name||[p.first_name,p.last_name].filter(Boolean).join(" ")||"Unknown",username:p.username,avatarUrl:null,status:"blocked",kind:"friend"});}}setBlockedUsers(blocked);})();
  },[open,token,activeTab,profile?.id]);

  const handleSaveProfile=async()=>{if(!token)return;if(!formData.first_name.trim()){setSaveMsg("First name is required");return;}if(!formData.last_name.trim()){setSaveMsg("Last name is required");return;}if(!formData.username.trim()){setSaveMsg("Username is required");return;}if(!formData.email.trim()){setSaveMsg("Email is required");return;}if(!formData.zip_code.trim()||!/^\d{5}$/.test(formData.zip_code.trim())){setSaveMsg("Zip code is required (5 digits)");return;}setSaving(true);setSaveMsg("");try{const res=await fetch("/api/users/profile",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({first_name:formData.first_name,last_name:formData.last_name,username:formData.username,zip_code:formData.zip_code.trim(),bio:formData.bio})});const data=await res.json();if(!res.ok){setSaveMsg(data.error||"Save failed");return;}onProfileSaved(data.profile);setSaveMsg("Saved!");setTimeout(()=>setSaveMsg(""),2000);}catch{setSaveMsg("Network error");}finally{setSaving(false);}};
  const handleAvatarUpload=async(file:File)=>{if(!token||!profile)return;const ext=file.name.split(".").pop()||"jpg";const path=`${profile.id}/avatar-${Date.now()}.${ext}`;const{error:upErr}=await supabaseBrowser.storage.from("avatars").upload(path,file,{upsert:true});if(upErr){setSaveMsg("Upload failed");return;}const{data:{publicUrl}}=supabaseBrowser.storage.from("avatars").getPublicUrl(path);const res=await fetch("/api/users/profile",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({avatar_url:publicUrl})});if(res.ok){const d=await res.json();onAvatarChange(publicUrl);onProfileSaved(d.profile);}};
  const handleConnectPayout=async()=>{if(!token||!payoutIdentifier.trim())return;setSaving(true);const res=await fetch("/api/users/profile",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({payout_method:"venmo",payout_identifier:payoutIdentifier.trim()})});if(res.ok){const d=await res.json();onProfileSaved(d.profile);}setSaving(false);};
  const handleDisconnectPayout=async()=>{if(!token)return;setSaving(true);const res=await fetch("/api/users/profile",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({payout_method:"",payout_identifier:""})});if(res.ok){const d=await res.json();onProfileSaved(d.profile);setPayoutIdentifier("");}setSaving(false);};
  const handleSaveNotifs=async()=>{if(!token)return;setSaving(true);const res=await fetch("/api/users/profile",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({preferences:notifPrefs})});if(res.ok){const d=await res.json();onProfileSaved(d.profile);setSaveMsg("Saved!");setTimeout(()=>setSaveMsg(""),2000);}setSaving(false);};
  const handleUnblock=async(fid:string)=>{if(!token)return;await fetch(`/api/friends/${fid}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});setBlockedUsers(prev=>prev.filter(u=>u.friendshipId!==fid));};
  const handleSendSupport=async()=>{if(!token||!supportMsg.trim())return;setSaving(true);const res=await fetch("/api/conversations",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({message:supportMsg.trim(),subject:"Support Request"})});if(res.ok){setSupportSent(true);setSupportMsg("");}setSaving(false);};
  const [settingPreferred,setSettingPreferred]=useState(false);
  const handleSetPreferred=async(method:"venmo"|"bank")=>{if(!token)return;setSettingPreferred(true);try{const res=await fetch("/api/users/profile",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({payout_method:method})});if(res.ok){const d=await res.json();onProfileSaved(d.profile);}}catch{}finally{setSettingPreferred(false);}};

  const hasVenmoConnected=!!(profile?.payout_identifier);
  const preferredMethod=profile?.payout_method||"";
  const bank=useBankAccount(token,profile,onProfileSaved);
  if(!open)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.85)",backdropFilter:"blur(12px)",animation:"fadeIn 0.3s ease",padding:"0 12px"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:640,maxHeight:"90vh",borderRadius:6,background:"#0C0C14",border:`1px solid rgba(${NEON.primaryRGB},0.2)`,boxShadow:`0 0 60px rgba(${NEON.primaryRGB},0.08)`,overflow:"auto"}}>
        <div style={{padding:"16px 16px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center"}}><NeonTag neon={NEON.primary}>Settings</NeonTag><div onClick={onClose} style={{cursor:"pointer",width:28,height:28,borderRadius:3,border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.35)",fontSize:14}}>{"\u2715"}</div></div>
        <div style={{display:"flex",gap:0,padding:"12px 16px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
          {(["profile","notifications","account","help"] as const).map(t=>(<button key={t} onClick={()=>setActiveTab(t)} style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase",padding:"8px 4px 10px",border:"none",background:"transparent",color:activeTab===t?NEON.primary:"rgba(255,255,255,0.25)",borderBottom:activeTab===t?`2px solid ${NEON.primary}`:"2px solid transparent",cursor:"pointer",flex:1,minWidth:0,textAlign:"center",whiteSpace:"nowrap"}}>{t==="help"?"Help":t}</button>))}
        </div>
        <div style={{padding:16}}>
          {activeTab==="profile"&&(<div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{display:"flex",alignItems:"center",gap:16,paddingBottom:16,borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
              <input ref={settingsAvatarRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const file=e.target.files?.[0];if(file)handleAvatarUpload(file);}}/>
              <div onClick={()=>settingsAvatarRef.current?.click()} style={{width:64,height:64,borderRadius:8,flexShrink:0,background:avatarUrl?`url(${avatarUrl}) center/cover no-repeat`:`linear-gradient(135deg,rgba(${NEON.primaryRGB},0.15),rgba(${NEON.purpleRGB},0.15))`,border:`2px solid rgba(${NEON.primaryRGB},0.25)`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Clash Display','DM Sans',sans-serif",fontSize:22,fontWeight:700,color:NEON.primary,cursor:"pointer"}}>{!avatarUrl&&getInitials(profile?.first_name??null,profile?.last_name??null)}</div>
              <div><button onClick={()=>settingsAvatarRef.current?.click()} style={{padding:"6px 14px",borderRadius:3,border:`1px solid rgba(${NEON.primaryRGB},0.3)`,background:`rgba(${NEON.primaryRGB},0.08)`,color:NEON.primary,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",marginBottom:4,display:"block"}}>{avatarUrl?"Change Photo":"Upload Photo"}</button>{avatarUrl&&<button onClick={()=>onAvatarChange(null)} style={{padding:"4px 10px",borderRadius:3,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"rgba(255,255,255,0.25)",fontSize:9,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>Remove</button>}</div>
            </div>
            {([{label:"First Name *",key:"first_name" as const,type:"text"},{label:"Last Name *",key:"last_name" as const,type:"text"},{label:"Username *",key:"username" as const,type:"text"},{label:"Email *",key:"email" as const,type:"email"},{label:"Zip Code *",key:"zip_code" as const,type:"text"},{label:"Bio",key:"bio" as const,type:"textarea"}]).map(field=>(<div key={field.label}><label style={{display:"block",fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",marginBottom:6,fontFamily:"'DM Sans',sans-serif"}}>{field.label}</label>{field.type==="textarea"?<textarea value={formData[field.key]} onChange={e=>setFormData({...formData,[field.key]:e.target.value})} rows={2} style={{width:"100%",padding:"10px 14px",borderRadius:3,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",color:"#fff",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",resize:"vertical"}}/>:<input value={formData[field.key]} onChange={e=>setFormData({...formData,[field.key]:e.target.value})} type={field.type} readOnly={field.key==="email"} style={{width:"100%",padding:"10px 14px",borderRadius:3,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",color:field.key==="email"?"rgba(255,255,255,0.3)":"#fff",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",boxSizing:"border-box"}}/>}</div>))}
            {saveMsg&&<div style={{fontSize:11,color:saveMsg==="Saved!"?NEON.green:NEON.pink}}>{saveMsg}</div>}
            <button onClick={handleSaveProfile} disabled={saving} style={{alignSelf:"flex-end",padding:"8px 20px",borderRadius:3,border:`1px solid rgba(${NEON.primaryRGB},0.4)`,background:`rgba(${NEON.primaryRGB},0.1)`,color:NEON.primary,fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",opacity:saving?0.5:1}}>{saving?"Saving...":"Save Changes"}</button>
          </div>)}
          {activeTab==="notifications"&&(<div style={{display:"flex",flexDirection:"column",gap:14}}>
            <NotificationPreferences />
            <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:16,marginTop:8}}>
              <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.2)",marginBottom:10}}>Blocked Users</div>
              {blockedUsers.length===0?<div style={{fontSize:11,color:"rgba(255,255,255,0.15)",padding:"12px 0"}}>No blocked users</div>:blockedUsers.map(u=>(<div key={u.friendshipId} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:4,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.04)"}}><div style={{width:28,height:28,borderRadius:"50%",background:"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.25)"}}>{getInitials(u.name.split(" ")[0],u.name.split(" ")[1]||null)}</div><div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.4)"}}>{u.name}</div></div><button onClick={()=>handleUnblock(u.friendshipId)} style={{padding:"4px 10px",borderRadius:2,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"rgba(255,255,255,0.2)",fontSize:8,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textTransform:"uppercase",letterSpacing:"0.08em"}}>Unblock</button></div>))}
            </div>
          </div>)}
          {activeTab==="account"&&(<div style={{display:"flex",flexDirection:"column",gap:20}}>
            {/* Security banner */}
            <div style={{background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:12,padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <div style={{fontSize:14,color:"rgba(255,255,255,0.85)",lineHeight:1.4}}>Your payout information is secure. Choose how you want to receive your cash outs.</div>
            </div>

            {/* Cash Out Methods container */}
            <div style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:24}}>
              <div style={{fontSize:18,fontWeight:900,display:"flex",alignItems:"center",gap:8,marginBottom:20,color:"#fff"}}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                Cash Out Methods
              </div>

              <div className="payout-grid">
                {/* Bank Account */}
                <div style={{padding:20,borderRadius:12,border:preferredMethod==="bank"?"2px solid #14b8a6":"1px solid rgba(255,255,255,0.12)",background:preferredMethod==="bank"?"rgba(20,184,166,0.08)":"rgba(255,255,255,0.03)",position:"relative"}}>
                  {preferredMethod==="bank"&&(
                    <span style={{position:"absolute",top:12,right:12,padding:"3px 8px",background:"rgba(16,185,129,0.2)",color:"#10b981",borderRadius:4,fontSize:11,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.05em"}}>Preferred</span>
                  )}
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={preferredMethod==="bank"?"#14b8a6":"rgba(255,255,255,0.5)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    <span style={{fontWeight:900,fontSize:15,color:"#fff"}}>Bank Account</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <div><div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:4}}>Status</div><div style={{fontWeight:900,fontSize:13,color:"#fff"}}>{bank.isComplete?"Connected via Stripe":bank.hasAccount?"Setup incomplete":"Not connected"}</div></div>
                    <div><div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:4}}>Fee</div><div style={{fontWeight:900,fontSize:13,color:"#10b981"}}>FREE</div></div>
                    <div><div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:4}}>Speed</div><div style={{fontWeight:900,fontSize:13,color:"#fff"}}>2-3 business days</div></div>
                  </div>
                  {preferredMethod!=="bank"&&bank.isComplete&&(
                    <button onClick={()=>handleSetPreferred("bank")} disabled={settingPreferred} style={{marginTop:12,width:"100%",padding:8,background:"rgba(20,184,166,0.1)",border:"1px solid rgba(20,184,166,0.4)",borderRadius:8,color:"#14b8a6",fontSize:12,fontWeight:900,cursor:settingPreferred?"wait":"pointer",opacity:settingPreferred?0.6:1}}>{settingPreferred?"Saving...":"Set as Preferred"}</button>
                  )}
                  {!bank.isComplete&&(
                    <button onClick={bank.handleConnectBank} disabled={bank.loading} style={{marginTop:12,width:"100%",padding:8,background:"rgba(20,184,166,0.1)",border:"1px solid rgba(20,184,166,0.4)",borderRadius:8,color:"#14b8a6",fontSize:12,fontWeight:900,cursor:bank.loading?"wait":"pointer",opacity:bank.loading?0.6:1}}>{bank.loading?"Loading...":(bank.hasAccount?"Complete Setup":"Connect Bank Account")}</button>
                  )}
                  {bank.statusMsg&&<div style={{fontSize:12,color:bank.statusMsg.includes("connected")?"#10b981":NEON.pink,marginTop:8}}>{bank.statusMsg}</div>}
                </div>

                {/* Venmo */}
                <div style={{padding:20,borderRadius:12,border:preferredMethod==="venmo"?"2px solid #14b8a6":"1px solid rgba(255,255,255,0.12)",background:preferredMethod==="venmo"?"rgba(20,184,166,0.08)":"rgba(255,255,255,0.03)",position:"relative"}}>
                  {preferredMethod==="venmo"&&(
                    <span style={{position:"absolute",top:12,right:12,padding:"3px 8px",background:"rgba(16,185,129,0.2)",color:"#10b981",borderRadius:4,fontSize:11,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.05em"}}>Preferred</span>
                  )}
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={preferredMethod==="venmo"?"#14b8a6":"rgba(255,255,255,0.5)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    <span style={{fontWeight:900,fontSize:15,color:"#fff"}}>Venmo</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    <div><div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:4}}>Account</div><div style={{fontWeight:900,fontSize:13,color:"#fff"}}>{hasVenmoConnected?profile?.payout_identifier:"Not set"}</div></div>
                    <div><div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:4}}>Fee</div><div style={{fontWeight:900,fontSize:13,color:"#f59e0b"}}>3% processing fee</div></div>
                    <div><div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:4}}>Speed</div><div style={{fontWeight:900,fontSize:13,color:"#fff"}}>Arrives in minutes</div></div>
                  </div>
                  {hasVenmoConnected&&preferredMethod!=="venmo"&&(
                    <button onClick={()=>handleSetPreferred("venmo")} disabled={settingPreferred} style={{marginTop:12,width:"100%",padding:8,background:"rgba(20,184,166,0.1)",border:"1px solid rgba(20,184,166,0.4)",borderRadius:8,color:"#14b8a6",fontSize:12,fontWeight:900,cursor:settingPreferred?"wait":"pointer",opacity:settingPreferred?0.6:1}}>{settingPreferred?"Saving...":"Set as Preferred"}</button>
                  )}
                  {!hasVenmoConnected&&(
                    <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:8}}>
                      <input type="text" placeholder="@yourusername" value={payoutIdentifier} onChange={e=>setPayoutIdentifier(e.target.value)} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.04)",color:"#fff",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",boxSizing:"border-box"}}/>
                      <button onClick={handleConnectPayout} disabled={saving||!payoutIdentifier.trim()} style={{width:"100%",padding:8,background:"rgba(20,184,166,0.1)",border:"1px solid rgba(20,184,166,0.4)",borderRadius:8,color:"#14b8a6",fontSize:12,fontWeight:900,cursor:saving||!payoutIdentifier.trim()?"default":"pointer",opacity:saving||!payoutIdentifier.trim()?0.4:1}}>Connect Venmo</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {bank.isComplete&&(
                <button onClick={bank.handleManageBank} disabled={bank.loading} style={{padding:"12px 20px",background:"rgba(6,182,212,0.12)",border:"1px solid #06b6d4",borderRadius:10,color:"#06b6d4",fontSize:14,fontWeight:900,cursor:bank.loading?"wait":"pointer",opacity:bank.loading?0.6:1,display:"flex",alignItems:"center",gap:8}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  {bank.loading?"Loading...":"Manage Bank"}
                </button>
              )}
              {hasVenmoConnected&&(
                <button onClick={handleDisconnectPayout} style={{padding:"12px 20px",background:"rgba(249,115,22,0.12)",border:"1px solid #f97316",borderRadius:10,color:"#f97316",fontSize:14,fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  Disconnect Venmo
                </button>
              )}
            </div>
          </div>)}
          {activeTab==="help"&&(<div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* FAQ Section */}
            <div>
              <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",marginBottom:12}}>Frequently Asked Questions</div>
              {([
                {q:"How do I connect my payment account to receive cash outs?",a:"Go to Settings → Account tab. You can connect your Venmo for instant payouts (3% fee) or link a bank account for free transfers (2-3 business days). You can connect both and choose at cash out time."},
                {q:"How do Progressive Payouts work?",a:"Every business has 7 payout tiers. The more you visit the same business, the higher your cash-back percentage goes — starting at 3% and potentially increasing up to as high as 50%. Each business tracks your visits independently over a 365-day rolling window. Only approved receipts count toward your visit total. Payout Tiers reset to 0 visits every anniversary."},
                {q:"How do I upload a receipt?",a:"From your Profile, tap the \"Add Receipt\" button. Search for the business you visited, upload a photo of your receipt, enter the subtotal amount and visit date, then submit. The receipt must be submitted within 7 days of your visit."},
                {q:"How long does receipt approval take?",a:"Most businesses review receipts within 24–48 hours. Some businesses have auto-approval enabled for smaller amounts. You'll receive a notification when your receipt is approved or rejected."},
                {q:"What is the minimum cash out amount?",a:"The minimum cash out is $20.00. Once your available balance reaches $20 or more, you can request a cash out from your Profile page."},
                {q:"How long does it take to receive my cash out?",a:"It depends on the method you choose. Venmo (Instant) arrives within minutes after admin approval, with a 3% processing fee. Bank Account (Standard) is free but takes 2-3 business days."},
                {q:"What are the payout tier levels?",a:"Most businesses use the Standard plan: Starter (visits 1–10, 5%), Regular (11–20, 7.5%), Favorite (21–30, 10%), VIP (31–40, 12.5%), Elite (41–50, 15%), Legend (51–60, 17.5%), and Ultimate (61+, 20%). Some businesses may use different percentages."},
                {q:"Why was my receipt rejected?",a:"Receipts can be rejected if the photo is blurry or unreadable, the receipt is from a different business, the date or amount doesn't match, or the receipt is older than 7 days. You can resubmit with a clearer photo if needed."},
                {q:"How does the 365-day rolling window work?",a:"Your visit count for each business is based on the last 365 days from the date of your signup (anniversary), not a calendar year. If you visited a business 25 times in the past year, you're at tier 3. Every year, on your anniversary, all of your Progressive Tiers will change to zero."},
                {q:"Can I earn rewards at multiple businesses?",a:"Yes! Each business tracks your visits and tiers independently. You could be a Starter at one place and a VIP at another. Visit more places to earn more cash back across the board."},
              ]).map((item,i)=>(
                <div key={i} style={{marginBottom:2}}>
                  <button onClick={()=>setFaqOpen(faqOpen===i?null:i)} style={{width:"100%",textAlign:"left",padding:"12px 14px",borderRadius:faqOpen===i?"4px 4px 0 0":"4px",border:`1px solid ${faqOpen===i?`rgba(${NEON.primaryRGB},0.2)`:"rgba(255,255,255,0.06)"}`,borderBottom:faqOpen===i?"none":`1px solid ${faqOpen===i?`rgba(${NEON.primaryRGB},0.2)`:"rgba(255,255,255,0.06)"}`,background:faqOpen===i?`rgba(${NEON.primaryRGB},0.05)`:"rgba(255,255,255,0.02)",color:faqOpen===i?NEON.primary:"rgba(255,255,255,0.5)",fontSize:12,fontWeight:600,fontFamily:"'DM Sans',sans-serif",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                    <span>{item.q}</span>
                    <span style={{fontSize:10,flexShrink:0,transition:"transform 0.2s",transform:faqOpen===i?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
                  </button>
                  {faqOpen===i&&(
                    <div style={{padding:"12px 14px",borderRadius:"0 0 4px 4px",border:`1px solid rgba(${NEON.primaryRGB},0.2)`,borderTop:"none",background:`rgba(${NEON.primaryRGB},0.03)`,fontSize:11,color:"rgba(255,255,255,0.45)",lineHeight:1.7,fontFamily:"'DM Sans',sans-serif"}}>{item.a}</div>
                  )}
                </div>
              ))}
            </div>
            {/* Live Support Chat */}
            <div style={{padding:16,borderRadius:4,background:`rgba(${NEON.primaryRGB},0.03)`,border:`1px solid rgba(${NEON.primaryRGB},0.1)`}}>
              <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",marginBottom:4}}>Still need help?</div>
              <div style={{fontSize:12,fontWeight:600,color:NEON.primary,marginBottom:10}}>Message Our Support Team</div>
              {supportSent?<div style={{fontSize:11,color:NEON.green}}>Message sent! Our team will respond soon.</div>:(<div style={{display:"flex",gap:8}}><input type="text" placeholder="Type your message..." value={supportMsg} onChange={e=>setSupportMsg(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&supportMsg.trim())handleSendSupport();}} style={{flex:1,padding:"9px 14px",borderRadius:3,border:`1px solid rgba(${NEON.primaryRGB},0.15)`,background:"rgba(255,255,255,0.03)",color:"#fff",fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:"none",boxSizing:"border-box"}}/><button onClick={handleSendSupport} disabled={saving||!supportMsg.trim()} style={{padding:"9px 18px",borderRadius:3,border:`1px solid rgba(${NEON.primaryRGB},0.4)`,background:`rgba(${NEON.primaryRGB},0.1)`,color:NEON.primary,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",textTransform:"uppercase",letterSpacing:"0.1em"}}>Send</button></div>)}
            </div>
          </div>)}
        </div>
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════

interface CalcBiz { id: string; name: string; type: string; visits: number; level: number; rates: number[]; earned: number; balance: number; }
interface CashoutDisplay { id: string; date: string; amount: number; method: string; status: string; fee_cents?: number; net_amount_cents?: number; breakdown?: { influencer_earnings_cents?: number; receipt_earnings_cents?: number; influencer_details?: { period: string; signups: number; amountCents: number }[] } | null; }
interface ExperienceDisplay { id: string; businessId: string; businessName: string; mediaUrl: string; mediaType: string; caption: string; status: string; createdAt: string; }

export default function LetsGoProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [receipts, setReceipts] = useState<ReceiptDisplay[]>([]);
  const [cashouts, setCashouts] = useState<CashoutDisplay[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [payoutBusinesses, setPayoutBusinesses] = useState<CalcBiz[]>([]);
  const [experiences, setExperiences] = useState<ExperienceDisplay[]>([]);
  const [tierConfig, setTierConfig] = useState<PlatformTierConfig>({visitThresholds: DEFAULT_VISIT_THRESHOLDS, presetBps: {standard: DEFAULT_CASHBACK_BPS}, defaultCashbackBps: DEFAULT_CASHBACK_BPS});
  const [ratings, setRatings] = useState<RatingDisplay[]>([]);

  // UI state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [receiptFilter, setReceiptFilter] = useState("all");
  const [receiptBusinessFilter, setReceiptBusinessFilter] = useState("");
  const [friendsTab, setFriendsTab] = useState("all");
  const [friendSearch, setFriendSearch] = useState("");
  const [payoutSearch, setPayoutSearch] = useState("");
  const [payoutSort, setPayoutSort] = useState("visits");
  const [expandedPayout, setExpandedPayout] = useState<string | null>(null);
  const [calcSearch, setCalcSearch] = useState("");
  const [calcSelectedBiz, setCalcSelectedBiz] = useState<CalcBiz | null>(null);
  const [calcSubtotal, setCalcSubtotal] = useState("");
  const [calcOpen, setCalcOpen] = useState(false);
  const [taxInfoOpen, setTaxInfoOpen] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<ReceiptDisplay | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState("receipts");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [experiencesOpen, setExperiencesOpen] = useState(false);
  const [savedPlacesOpen, setSavedPlacesOpen] = useState(false);
  const [progressiveOpen, setProgressiveOpen] = useState(false);
  const [cashOutModal, setCashOutModal] = useState<"confirm" | "noPayment" | null>(null);
  const [levelUpCelebration, setLevelUpCelebration] = useState<{business: string; newLevel: number; rate: number} | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [accountStatus, setAccountStatus] = useState("active");
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [heroFriendsOpen, setHeroFriendsOpen] = useState(false);
  const [addFriendSearch, setAddFriendSearch] = useState("");
  const [addFriendResults, setAddFriendResults] = useState<{id:string;name:string;username:string|null;avatarUrl:string|null}[]>([]);
  const [addFriendLoading, setAddFriendLoading] = useState(false);
  const [friendMenuOpen, setFriendMenuOpen] = useState<string | null>(null);
  const [expUploadOpen, setExpUploadOpen] = useState(false);
  const [expFile, setExpFile] = useState<File | null>(null);
  const [expCaption, setExpCaption] = useState("");
  const [expBizSearch, setExpBizSearch] = useState("");
  const [expBizResults, setExpBizResults] = useState<{id:string;name:string}[]>([]);
  const [expSelectedBiz, setExpSelectedBiz] = useState<{id:string;name:string} | null>(null);
  const [expUploading, setExpUploading] = useState(false);
  const [viewingExp, setViewingExp] = useState<ExperienceDisplay | null>(null);
  const expFileRef = useRef<HTMLInputElement>(null);
  const friendsPanelRef = useRef<HTMLDivElement>(null);
  const addFriendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [accountActionLoading, setAccountActionLoading] = useState(false);
  const [minCashoutCents, setMinCashoutCents] = useState(2000);
  const [ratingsOpen, setRatingsOpen] = useState(false);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [rateBusinessId, setRateBusinessId] = useState<string | null>(null);
  const [rateStars, setRateStars] = useState(0);
  const [rateNote, setRateNote] = useState("");
  const [rateWouldGoAgain, setRateWouldGoAgain] = useState(true);
  const [rateSaving, setRateSaving] = useState(false);
  const [editingRatingId, setEditingRatingId] = useState<string | null>(null);

  // Influencer dashboard
  const [influencerData, setInfluencerData] = useState<{
    influencer: {
      id: string; name: string; code: string; tier: string; status: string;
      totalSignups: number; totalClicks: number; totalPaidCents: number;
      ratePerThousandCents: number;
      instagramHandle: string | null; tiktokHandle: string | null;
      youtubeHandle: string | null; twitterHandle: string | null;
    };
    totalCreditedCents: number;
    uncreditedCents: number;
    rateTiers: { tierIndex: number; minSignups: number; maxSignups: number | null; rateCents: number; label: string | null }[];
    recentSignups: { userName: string; createdAt: string }[];
    payouts: { id: string; amountCents: number; signupsCount: number; periodStart: string; periodEnd: string; paid: boolean; paidAt: string | null; createdAt: string; creditedToBalance: boolean }[];
  } | null>(null);
  const [influencerLinkCopied, setInfluencerLinkCopied] = useState(false);

  // ─── Onboarding Tour ───
  const profileTourSteps: TourStep[] = useMemo(() => [
    { target: '[data-tour="earnings-banner"]', title: "Your Earnings at a Glance", description: "See how much you've earned and what's available to cash out. You earn cashback every time you visit a partner business.", position: "bottom" },
    { target: '[data-tour="upload-receipt-btn"]', title: "Upload Your Receipts", description: "Visited a partner spot? Tap here to snap a photo of your receipt and start earning cashback. Takes about 10 seconds.", position: "left" },
    { target: '[data-tour="cashout-btn"]', title: "Cash Out Anytime", description: "Once you hit the minimum, you can cash out directly to Venmo or PayPal. Your money, your way.", position: "top" },
    { target: '[data-tour="saved-places"]', title: "Your Saved Places", description: "All the spots you've hearted from the Explore feed show up here. Quick access to your favorites.", position: "top" },
    { target: '[data-tour="ratings-section"]', title: "Would Go Again", description: "Comment and rate the places you've visited to help with future visits. Your comments are private and not shared with anyone.", position: "top" },
    { target: '[data-tour="payout-calc"]', title: "Payout Calculator", description: "Curious how much you'd earn? Enter a receipt amount and business to see your cashback before you visit.", position: "top" },
    { target: '[data-tour="level-progress"]', title: "Level Up for Bigger Rewards", description: "The more you visit a place, the higher your cashback goes — from 5% up to 20%. Each business tracks separately.", position: "top" },
    { target: '[data-tour="experiences-section"]', title: "Share Your Experiences", description: "Upload photos and videos from your visits. Approved posts appear in the community feed for everyone to see.", position: "top" },
    { target: '[data-tour="history-section"]', title: "Receipt & Cash Out History", description: "View all your past receipts and cash outs. Filter by business or search for a specific visit.", position: "top" },
    { target: '[data-tour="tax-section"]', title: "Annual Earnings Summary", description: "Track your yearly earnings for tax purposes. If you earn over $600, you'll receive a 1099 from LetsGo.", position: "top" },
    { target: '[data-tour="settings-btn"]', title: "Your Settings", description: "Update your profile, name, zip code, avatar, and bio. This is also where you manage notifications and privacy.", position: "bottom" },
    { target: '[data-tour="settings-btn"]', title: "Connect Your Payment", description: "Don't forget to link your Venmo or PayPal in Settings so you can cash out your earnings. You'll find it under the Account tab.", position: "bottom" },
  ], []);
  const profileTourIllustrations: React.ReactNode[] = useMemo(() => [
    <EarningsBannerAnim key="eb" />,
    <ReceiptAnim key="r" />,
    <CashOutAnim key="co" />,
    <HeartAnim key="h" />,
    <TabSwitchAnim key="ts" />,
    <PayoutTiersAnim key="pt" />,
    <LevelUpAnim key="lu" />,
    <MediaAnim key="m" />,
    <GameHistoryAnim key="gh" />,
    <AnalyticsAnim key="aa" />,
    <ProfileAnim key="p" />,
    <SupportAnim key="s" />,
  ], []);
  const tour = useOnboardingTour("profile", profileTourSteps, 1000, !loading);

  // ─── Auth + Data Loading ───
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session?.access_token || !session?.user?.id) { router.replace("/welcome"); return; }
      const tk = session.access_token;
      const uid = session.user.id;
      if (cancelled) return;
      setToken(tk);

      // Parallel data fetches
      const [profileRes, tierCfg, psResult] = await Promise.all([
        fetch("/api/users/profile", { headers: { Authorization: `Bearer ${tk}` } }),
        fetchPlatformTierConfig(supabaseBrowser),
        supabaseBrowser.from("platform_settings").select("min_payout_cents").eq("id", 1).maybeSingle(),
      ]);
      if (cancelled) return;
      setTierConfig(tierCfg);
      if (psResult.data?.min_payout_cents) setMinCashoutCents(psResult.data.min_payout_cents);

      if (profileRes.ok) {
        const pData = await profileRes.json();
        const p: ProfileData = pData.profile;
        setProfile(p);
        setAvatarUrl(p.avatar_url || null);
        setAccountStatus(p.status === "on_hold" ? "held" : p.status === "deletion_requested" ? "deleted" : p.status === "suspended" ? "suspended" : "active");
      }

      // Fetch receipts
      const { data: receiptRows } = await supabaseBrowser
        .from("receipts")
        .select("id, business_id, visit_date, receipt_total_cents, payout_cents, payout_tier_index, status, photo_url, business:business(business_name, public_business_name)")
        .eq("user_id", uid)
        .order("visit_date", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (receiptRows) {
        // Generate signed URLs for receipt photos
        const receiptList = await Promise.all(receiptRows.map(async (r: Record<string, unknown>) => {
          const biz = r.business as Record<string, unknown> | null;
          const bizName = (biz?.public_business_name as string) || (biz?.business_name as string) || "Unknown";
          let photoUrl: string | null = null;
          const storagePath = r.photo_url as string | null;
          if (storagePath) {
            const { data: signedData, error: signedErr } = await supabaseBrowser.storage
              .from("receipts")
              .createSignedUrl(storagePath, 3600);
            if (signedErr) console.error("[receipt-photo] Signed URL error:", signedErr, "path:", storagePath);
            photoUrl = signedData?.signedUrl || null;
          }
          return {
            id: r.id as string,
            business: bizName,
            businessId: r.business_id as string,
            date: new Date(r.visit_date as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            amount: (r.receipt_total_cents as number) / 100,
            cashback: (r.payout_cents as number) / 100,
            status: (r.status as string) || "pending",
            level: (r.payout_tier_index as number) || 1,
            visitNum: (r.payout_tier_index as number) || 1,
            photoUrl,
          };
        }));
        setReceipts(receiptList);
      }

      // Fetch cashouts
      const { data: cashoutRows } = await supabaseBrowser
        .from("user_payouts")
        .select("id, amount_cents, fee_cents, net_amount_cents, method, status, requested_at, breakdown")
        .eq("user_id", uid)
        .order("requested_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (cashoutRows) {
        setCashouts(cashoutRows.map((c: Record<string, unknown>) => ({
          id: c.id as string,
          date: new Date(c.requested_at as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          amount: (c.amount_cents as number) / 100,
          method: ((c.method as string) === "bank" ? "Bank" : (c.method as string) === "venmo" ? "Venmo" : (c.method as string) === "paypal" ? "PayPal" : (c.method as string)) || "Venmo",
          status: (c.status as string) || "pending",
          fee_cents: (c.fee_cents as number) || 0,
          net_amount_cents: (c.net_amount_cents as number) || undefined,
          breakdown: c.breakdown as CashoutDisplay["breakdown"],
        })));
      }

      // Fetch saved/followed businesses
      const { data: followedRows } = await supabaseBrowser
        .from("user_followed_businesses")
        .select("business_id, business:business(id, business_name, public_business_name, category_main)")
        .eq("user_id", uid);
      if (cancelled) return;
      if (followedRows) {
        setSavedPlaces(followedRows.map((f: Record<string, unknown>, idx: number) => {
          const biz = f.business as Record<string, unknown> | null;
          return {
            id: (f.business_id as string) || String(idx),
            name: (biz?.public_business_name as string) || (biz?.business_name as string) || "Unknown",
            type: (biz?.category_main as string) || "Business",
            neon: NEON_CYCLE[idx % NEON_CYCLE.length],
            businessId: f.business_id as string,
          };
        }));
      }

      // Fetch user ratings ("Would Go Again")
      const ratingsRes = await fetch(`/api/ratings?userId=${uid}`, { headers: { Authorization: `Bearer ${tk}` } });
      if (cancelled) return;
      if (ratingsRes.ok) {
        const rData = await ratingsRes.json();
        setRatings((rData.ratings || []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          businessId: r.businessId as string,
          businessName: r.businessName as string,
          businessType: r.businessType as string,
          stars: r.stars as number,
          wouldGoAgain: r.wouldGoAgain as boolean,
          privateNote: r.privateNote as string | null,
          updatedAt: new Date(r.updatedAt as string).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        })));
      }

      // Fetch friends
      const friendsRes = await fetch("/api/friends", { headers: { Authorization: `Bearer ${tk}` } });
      if (cancelled) return;
      if (friendsRes.ok) {
        const fData = await friendsRes.json();
        const allFriends: FriendData[] = [];
        for (const f of (fData.friends || [])) {
          allFriends.push({ friendshipId: f.friendshipId, id: f.id, name: f.name, username: f.username, avatarUrl: f.avatarUrl, status: "accepted", kind: "friend" });
        }
        for (const f of (fData.pendingRequests || [])) {
          allFriends.push({ friendshipId: f.friendshipId, id: f.id, name: f.name, username: f.username, avatarUrl: f.avatarUrl, status: "pending", kind: "pending" });
        }
        for (const f of (fData.sentRequests || [])) {
          allFriends.push({ friendshipId: f.friendshipId, id: f.id, name: f.name, username: f.username, avatarUrl: f.avatarUrl, status: "sent", kind: "sent" });
        }
        setFriends(allFriends);
      }

      // Fetch user experiences via server API (signed URLs generated server-side)
      const expRes = await fetch("/api/users/experiences", { headers: { Authorization: `Bearer ${tk}` } });
      if (cancelled) return;
      if (expRes.ok) {
        const expJson = await expRes.json();
        const mapped: ExperienceDisplay[] = ((expJson.experiences || []) as Record<string, unknown>[]).map((e) => ({
          id: e.id as string,
          businessId: e.businessId as string,
          businessName: e.businessName as string,
          mediaUrl: e.mediaUrl as string,
          mediaType: e.mediaType as string,
          caption: e.caption as string,
          status: e.status as string,
          createdAt: new Date(e.createdAt as string).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        }));
        setExperiences(mapped);
      }

      // Fetch payout progress per business
      let bizVisitData: Record<string, unknown>[] | null = null;
      try {
        const { data: rpcData } = await supabaseBrowser.rpc("get_user_business_stats", { p_user_id: uid });
        if (Array.isArray(rpcData)) bizVisitData = rpcData as Record<string, unknown>[];
      } catch { /* RPC may not exist, fall back to receipt-based calculation */ }
      if (cancelled) return;
      if (bizVisitData && Array.isArray(bizVisitData)) {
        const payoutBizList: CalcBiz[] = [];
        for (const row of bizVisitData) {
          const r = row as Record<string, unknown>;
          const bizId = r.business_id as string;
          const visits = (r.visit_count as number) || 0;
          const earned = ((r.total_payout_cents as number) || 0) / 100;
          const balance = ((r.available_balance_cents as number) || 0) / 100;
          const bizName = (r.business_name as string) || "Unknown";
          const bizType = (r.category_main as string) || "Business";
          // Determine level from tier config
          let level = 1;
          for (const t of tierCfg.visitThresholds) { if (visits >= t.min) level = t.level; }
          const rates = tierCfg.defaultCashbackBps.map((b: number) => b / 100);
          payoutBizList.push({ id: bizId, name: bizName, type: bizType, visits, level, rates, earned, balance });
        }
        setPayoutBusinesses(payoutBizList);
      } else {
        // Fallback: build from receipts
        const bizMap = new Map<string, { visits: number; earned: number; name: string; type: string }>();
        if (receiptRows) {
          for (const r of receiptRows) {
            const rec = r as Record<string, unknown>;
            if (rec.status !== "approved") continue;
            const bizId = rec.business_id as string;
            const biz = rec.business as Record<string, unknown> | null;
            const bizName = (biz?.public_business_name as string) || (biz?.business_name as string) || "Unknown";
            const existing = bizMap.get(bizId) || { visits: 0, earned: 0, name: bizName, type: "Business" };
            existing.visits += 1;
            existing.earned += ((rec.payout_cents as number) || 0) / 100;
            bizMap.set(bizId, existing);
          }
        }
        const payoutBizList: CalcBiz[] = [];
        for (const [bizId, data] of bizMap) {
          let level = 1;
          for (const t of tierCfg.visitThresholds) { if (data.visits >= t.min) level = t.level; }
          const rates = tierCfg.defaultCashbackBps.map((b: number) => b / 100);
          payoutBizList.push({ id: bizId, name: data.name, type: data.type, visits: data.visits, level, rates, earned: data.earned, balance: 0 });
        }
        setPayoutBusinesses(payoutBizList);
      }

      // Fetch influencer dashboard data (if user is an influencer)
      try {
        const infRes = await fetch("/api/influencers/me", { headers: { Authorization: `Bearer ${tk}` } });
        if (cancelled) return;
        if (infRes.ok) {
          const infData = await infRes.json();
          if (infData.isInfluencer) {
            setInfluencerData({ influencer: infData.influencer, totalCreditedCents: infData.totalCreditedCents || 0, uncreditedCents: infData.uncreditedCents || 0, rateTiers: infData.rateTiers || [], recentSignups: infData.recentSignups, payouts: infData.payouts });
          }
        }
      } catch { /* influencer tables may not exist yet */ }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  // ─── Handle ?add=userId URL param ───
  useEffect(() => {
    if (!token || !profile) return;
    const params = new URLSearchParams(window.location.search);
    const addUserId = params.get("add");
    if (!addUserId) return;
    // Clear URL param
    window.history.replaceState({}, "", window.location.pathname);
    // Send friend request
    (async () => {
      await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ friendId: addUserId }),
      });
      // Refresh friends
      const res = await fetch("/api/friends", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const fData = await res.json();
        const allFriends: FriendData[] = [];
        for (const f of (fData.friends || [])) allFriends.push({ friendshipId: f.friendshipId, id: f.id, name: f.name, username: f.username, avatarUrl: f.avatarUrl, status: "accepted", kind: "friend" });
        for (const f of (fData.pendingRequests || [])) allFriends.push({ friendshipId: f.friendshipId, id: f.id, name: f.name, username: f.username, avatarUrl: f.avatarUrl, status: "pending", kind: "pending" });
        for (const f of (fData.sentRequests || [])) allFriends.push({ friendshipId: f.friendshipId, id: f.id, name: f.name, username: f.username, avatarUrl: f.avatarUrl, status: "sent", kind: "sent" });
        setFriends(allFriends);
      }
    })();
  }, [token, profile]);

  // ─── Handle Stripe Connect return ───
  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe_connected") || params.get("stripe_refresh")) {
      window.history.replaceState({}, "", window.location.pathname);
      // Check Stripe Connect status and refresh profile
      (async () => {
        await fetch("/api/stripe/connect/status", { headers: { Authorization: `Bearer ${token}` } });
        const res = await fetch("/api/users/profile", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) { const d = await res.json(); setProfile(d.profile); }
      })();
    }
  }, [token]);

  // ─── Add Friend Search (debounced) ───
  useEffect(() => {
    if (addFriendTimerRef.current) clearTimeout(addFriendTimerRef.current);
    if (addFriendSearch.length < 2) { setAddFriendResults([]); return; }
    addFriendTimerRef.current = setTimeout(async () => {
      if (!token) return;
      setAddFriendLoading(true);
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(addFriendSearch)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setAddFriendResults(data.users || []);
      }
      setAddFriendLoading(false);
    }, 400);
  }, [addFriendSearch, token]);

  // ─── Experience business search (debounced) ───
  useEffect(() => {
    if (expBizSearch.length < 2) { setExpBizResults([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabaseBrowser
        .from("business")
        .select("id, business_name, public_business_name")
        .or(`business_name.ilike.%${expBizSearch}%,public_business_name.ilike.%${expBizSearch}%`)
        .eq("is_active", true)
        .limit(8);
      if (data) {
        setExpBizResults(data.map((b: Record<string, unknown>) => ({
          id: b.id as string,
          name: (b.public_business_name as string) || (b.business_name as string) || "Unknown",
        })));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [expBizSearch]);

  // ─── Computed values ───
  const uniqueBusinesses = useMemo(() => [...new Set(receipts.map(r => r.business))], [receipts]);

  const calcSearchResults = useMemo(() => {
    if (!calcSearch || calcSelectedBiz) return [];
    return payoutBusinesses.filter(b => b.name.toLowerCase().includes(calcSearch.toLowerCase()));
  }, [calcSearch, calcSelectedBiz, payoutBusinesses]);

  const calcResult = useMemo(() => {
    if (!calcSelectedBiz || !calcSubtotal) return null;
    const amount = parseFloat(calcSubtotal);
    if (isNaN(amount) || amount <= 0) return null;
    const rate = calcSelectedBiz.rates[calcSelectedBiz.level - 1];
    const payout = (amount * rate) / 100;
    return { rate, payout, level: calcSelectedBiz.level };
  }, [calcSelectedBiz, calcSubtotal]);

  const pendingReceipts = useMemo(() => receipts.filter(r => r.status === "pending"), [receipts]);

  const filteredReceipts = useMemo(() => {
    if (receiptFilter === "all" || !receiptBusinessFilter) return receipts;
    return receipts.filter(r => r.business.toLowerCase().includes(receiptBusinessFilter.toLowerCase()));
  }, [receiptFilter, receiptBusinessFilter, receipts]);

  const filteredFriends = useMemo(() => {
    let f = [...friends];
    if (friendsTab === "friends") f = f.filter(x => x.kind === "friend");
    if (friendsTab === "pending") f = f.filter(x => x.kind === "pending" || x.kind === "sent");
    if (friendSearch) f = f.filter(x => x.name.toLowerCase().includes(friendSearch.toLowerCase()) || (x.username || "").toLowerCase().includes(friendSearch.toLowerCase()));
    return f;
  }, [friendsTab, friendSearch, friends]);

  const filteredPayouts = useMemo(() => {
    let p = [...payoutBusinesses];
    if (payoutSearch) p = p.filter(x => x.name.toLowerCase().includes(payoutSearch.toLowerCase()));
    if (payoutSort === "visits") p.sort((a, b) => b.visits - a.visits);
    else if (payoutSort === "earned") p.sort((a, b) => b.earned - a.earned);
    else if (payoutSort === "level") p.sort((a, b) => b.level - a.level);
    else if (payoutSort === "balance") p.sort((a, b) => b.balance - a.balance);
    return p;
  }, [payoutSearch, payoutSort, payoutBusinesses]);

  const yearlyEarnings = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;
    let thisYearTotal = 0;
    let lastYearTotal = 0;
    for (const r of receipts) {
      if (r.status !== "approved") continue;
      const d = new Date(r.date);
      if (d.getFullYear() === thisYear) thisYearTotal += r.cashback;
      if (d.getFullYear() === lastYear) lastYearTotal += r.cashback;
    }
    return { thisYear, lastYear, thisYearTotal, lastYearTotal };
  }, [receipts]);

  const hasVenmoConnected = !!profile?.payout_identifier;
  const hasBankConnected = !!(profile?.stripe_connect_account_id && profile?.stripe_connect_onboarding_complete);
  const paymentConnected = hasVenmoConnected || hasBankConnected;
  const referralCode = profile?.referral_code || "LETSGO";
  const totalEarned = (profile?.lifetime_payout || 0) / 100;
  const availableBalance = (profile?.available_balance || 0) / 100;
  const pendingPayout = (profile?.pending_payout || 0) / 100;
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";

  // ─── Friend action handlers ───
  const handleAcceptFriend = useCallback(async (friendshipId: string) => {
    if (!token) return;
    await fetch(`/api/friends/${friendshipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "accepted" }),
    });
    setFriends(prev => prev.map(f => f.friendshipId === friendshipId ? { ...f, status: "accepted", kind: "friend" as const } : f));
  }, [token]);

  const handleRemoveFriend = useCallback(async (friendshipId: string) => {
    if (!token) return;
    await fetch(`/api/friends/${friendshipId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setFriends(prev => prev.filter(f => f.friendshipId !== friendshipId));
    setFriendMenuOpen(null);
  }, [token]);

  const handleBlockFriend = useCallback(async (friendshipId: string) => {
    if (!token) return;
    await fetch(`/api/friends/${friendshipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "blocked" }),
    });
    setFriends(prev => prev.filter(f => f.friendshipId !== friendshipId));
    setFriendMenuOpen(null);
  }, [token]);

  const handleAddFriend = useCallback(async (friendId: string) => {
    if (!token) return;
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ friendId }),
    });
    if (res.ok) {
      setAddFriendResults(prev => prev.filter(u => u.id !== friendId));
      // Refresh friends list
      const fRes = await fetch("/api/friends", { headers: { Authorization: `Bearer ${token}` } });
      if (fRes.ok) {
        const fData = await fRes.json();
        const allFriends: FriendData[] = [];
        for (const f of (fData.friends || [])) allFriends.push({ friendshipId: f.friendshipId, id: f.id, name: f.name, username: f.username, avatarUrl: f.avatarUrl, status: "accepted", kind: "friend" });
        for (const f of (fData.pendingRequests || [])) allFriends.push({ friendshipId: f.friendshipId, id: f.id, name: f.name, username: f.username, avatarUrl: f.avatarUrl, status: "pending", kind: "pending" });
        for (const f of (fData.sentRequests || [])) allFriends.push({ friendshipId: f.friendshipId, id: f.id, name: f.name, username: f.username, avatarUrl: f.avatarUrl, status: "sent", kind: "sent" });
        setFriends(allFriends);
      }
    }
  }, [token]);

  // ─── Experience upload handler ───
  const handleExperienceUpload = useCallback(async () => {
    if (!token || !profile || !expFile || !expSelectedBiz) return;
    const maxSize = expFile.type.startsWith("video/") ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    const maxLabel = expFile.type.startsWith("video/") ? "50MB" : "10MB";
    if (expFile.size > maxSize) { alert(`File too large. Max ${maxLabel} for ${expFile.type.startsWith("video/") ? "videos" : "images"}.`); return; }
    setExpUploading(true);
    const ext = expFile.name.split(".").pop() || "jpg";
    const safeName = expFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueId = crypto.randomUUID();
    const storagePath = `${profile.id}/${uniqueId}-${safeName}`;
    const { error: upErr } = await supabaseBrowser.storage.from("user-experiences").upload(storagePath, expFile);
    if (upErr) { console.error("[exp upload] Storage error:", upErr); alert("Upload failed: " + upErr.message); setExpUploading(false); return; }
    const mediaType = expFile.type.startsWith("video/") ? "video" : "image";
    const res = await fetch("/api/experiences", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ businessId: expSelectedBiz.id, storagePath, mediaType, caption: expCaption }),
    });
    if (res.ok) {
      // Refresh experiences from server to get proper signed URLs
      const expRefresh = await fetch("/api/users/experiences", { headers: { Authorization: `Bearer ${token}` } });
      if (expRefresh.ok) {
        const expJson = await expRefresh.json();
        setExperiences(((expJson.experiences || []) as Record<string, unknown>[]).map((e) => ({
          id: e.id as string, businessId: e.businessId as string, businessName: e.businessName as string,
          mediaUrl: e.mediaUrl as string, mediaType: e.mediaType as string, caption: e.caption as string,
          status: e.status as string, createdAt: new Date(e.createdAt as string).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        })));
      }
      setExpUploadOpen(false);
      setExpFile(null);
      setExpCaption("");
      setExpSelectedBiz(null);
      setExpBizSearch("");
    }
    setExpUploading(false);
  }, [token, profile, expFile, expSelectedBiz, expCaption]);

  // ─── Account management handlers ───
  const handleAccountAction = useCallback(async (action: "hold" | "delete_request" | "reinstate") => {
    if (!token) return;
    setAccountActionLoading(true);
    const res = await fetch("/api/users/account", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      const data = await res.json();
      setAccountStatus(data.status === "on_hold" ? "held" : data.status === "deletion_requested" ? "deleted" : data.status === "active" ? "active" : accountStatus);
    }
    setAccountActionLoading(false);
  }, [token, accountStatus]);

  // ─── Receipt cancel handler ───
  const handleCancelReceipt = useCallback(async (receiptId: string) => {
    if (!token) return;
    // Update receipt status locally (actual cancel would need API)
    setReceipts(prev => prev.map(r => r.id === receiptId ? { ...r, status: "cancelled", cashback: 0 } : r));
    setCancelConfirmId(null);
  }, [token]);

  // ─── Avatar upload from hero ───
  const handleHeroAvatarUpload = useCallback(async (file: File) => {
    if (!token || !profile) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseBrowser.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) return;
    const { data: { publicUrl } } = supabaseBrowser.storage.from("avatars").getPublicUrl(path);
    const res = await fetch("/api/users/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ avatar_url: publicUrl }),
    });
    if (res.ok) {
      const d = await res.json();
      setAvatarUrl(publicUrl);
      setProfile(d.profile);
    }
  }, [token, profile]);

  // ─── Cash out after successful modal ───
  const handleCashOutDone = useCallback(() => {
    // Refresh profile to get updated balance
    if (!token) return;
    (async () => {
      const res = await fetch("/api/users/profile", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setProfile(d.profile);
      }
    })();
    setCashOutModal(null);
  }, [token]);

  // ─── Loading state ───
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#08080E", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, border: `2px solid ${NEON.primary}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 18, color: NEON.primary, background: `rgba(${NEON.primaryRGB},0.05)`, margin: "0 auto 16px", animation: "logoGlow 2s ease-in-out infinite" }}>LG</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.15em", textTransform: "uppercase" }}>Loading profile...</div>
        </div>
      </div>
    );
  }

  // ─── Suspended state ───
  if (profile?.status === "suspended") {
    return (
      <div style={{ minHeight: "100vh", background: "#08080E", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif", padding: 28 }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>{"\u26A0\uFE0F"}</div>
          <h2 style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 22, fontWeight: 700, color: NEON.pink, marginBottom: 8 }}>Account Suspended</h2>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, marginBottom: 8 }}>{profile.suspension_reason || "Your account has been suspended by an administrator."}</p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", lineHeight: 1.5 }}>Please contact support for more information.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=clash-display@700,600,500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes cardSlideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes marqueeScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes logoGlow {
          0%, 100% { filter: drop-shadow(0 0 10px #FF2D78) drop-shadow(0 0 25px #FF2D7850); }
          17% { filter: drop-shadow(0 0 10px #00E5FF) drop-shadow(0 0 25px #00E5FF50); }
          33% { filter: drop-shadow(0 0 10px #FFD600) drop-shadow(0 0 25px #FFD60050); }
          50% { filter: drop-shadow(0 0 10px #00FF87) drop-shadow(0 0 25px #00FF8750); }
          67% { filter: drop-shadow(0 0 10px #D050FF) drop-shadow(0 0 25px #D050FF50); }
          83% { filter: drop-shadow(0 0 10px #FF6B2D) drop-shadow(0 0 25px #FF6B2D50); }
        }
        @keyframes logoBorderCycle {
          0%, 100% { border-color: #FF2D78; }
          17% { border-color: #00E5FF; }
          33% { border-color: #FFD600; }
          50% { border-color: #00FF87; }
          67% { border-color: #D050FF; }
          83% { border-color: #FF6B2D; }
        }
        @keyframes pulseRing { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes neonFlicker { 0%, 100% { text-shadow: 0 0 8px ${NEON.primary}90, 0 0 20px ${NEON.primary}50; } 5% { text-shadow: 0 0 4px ${NEON.primary}40, 0 0 10px ${NEON.primary}20; } 6% { text-shadow: 0 0 8px ${NEON.primary}90, 0 0 20px ${NEON.primary}50; } 45% { text-shadow: 0 0 8px ${NEON.primary}90, 0 0 20px ${NEON.primary}50; } 46% { text-shadow: 0 0 2px ${NEON.primary}30, 0 0 6px ${NEON.primary}15; } 48% { text-shadow: 0 0 8px ${NEON.primary}90, 0 0 20px ${NEON.primary}50; } }
        body { background: #08080E; }
        .profile-scroll::-webkit-scrollbar { display: none; }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.18); }
        select option { background: #0C0C14; color: rgba(255,255,255,0.6); }

        .payout-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 640px) {
          .payout-grid { grid-template-columns: 1fr !important; }
          .profile-content { padding: 0 14px !important; }
          .profile-marquee { margin-left: -14px !important; margin-right: -14px !important; }
          .profile-hero { flex-direction: column !important; align-items: center !important; gap: 16px !important; padding: 20px 16px !important; }
          .profile-hero > div { text-align: center; }
          .hero-stats { justify-content: center !important; }
          .hero-actions { width: 100% !important; align-items: stretch !important; }
          .earnings-banner { flex-direction: column !important; gap: 16px !important; }
          .earnings-values { flex-direction: column !important; gap: 12px !important; align-items: stretch !important; }
          .earnings-divider { display: none !important; }
          .earnings-actions { width: 100% !important; flex-direction: column !important; gap: 8px !important; }
          .calc-row { flex-direction: column !important; gap: 12px !important; }
          .calc-row > div { flex: 1 1 100% !important; min-width: 0 !important; }
          .calc-arrow { display: none !important; }
          .receipt-search { width: 100% !important; }
          .receipt-status { display: none !important; }
          .receipt-amount { min-width: 60px !important; }
          .payout-search { flex: 1 1 100% !important; }
          .tier-chips { flex-wrap: wrap !important; }
          .tier-chips > div { flex: 1 1 calc(25% - 6px) !important; min-width: 70px !important; }
          .saved-grid { grid-template-columns: 1fr 1fr !important; }
          .friends-grid { grid-template-columns: 1fr !important; }
          .friends-spacer { display: none !important; }
          .friends-search { flex: 1 1 100% !important; min-width: 0 !important; }
        }
      `}</style>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} profile={profile} avatarUrl={avatarUrl} onAvatarChange={(url) => { setAvatarUrl(url); if (!url && token) { fetch("/api/users/profile", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ avatar_url: "" }) }); } }} onProfileSaved={(p) => setProfile(p)} token={token} />
      <ReceiptUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} token={token} userId={profile?.id||""} onSuccess={(r: ReceiptDisplay) => { setReceipts(prev => [r, ...prev]); setUploadOpen(false); }} />
      <ReceiptDetailModal receipt={viewingReceipt} open={!!viewingReceipt} onClose={() => setViewingReceipt(null)} />
      <LevelUpCelebration data={levelUpCelebration} onClose={() => setLevelUpCelebration(null)} />
      <CashOutModal mode={cashOutModal} amount={availableBalance} onClose={() => setCashOutModal(null)} onGoToSettings={() => { setCashOutModal(null); setSettingsOpen(true); }} token={token} onSuccess={handleCashOutDone} minCashoutCents={minCashoutCents} profile={profile} />

      {/* Experience Viewer Modal */}
      {viewingExp && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.92)", backdropFilter: "blur(16px)", animation: "fadeIn 0.2s ease" }} onClick={() => setViewingExp(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", borderRadius: 6, background: "#0C0C14", border: `1px solid rgba(${NEON.orangeRGB},0.2)`, boxShadow: `0 0 80px rgba(${NEON.orangeRGB},0.1)`, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{viewingExp.businessName}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{viewingExp.createdAt}{viewingExp.status !== "approved" && <span style={{ marginLeft: 8, color: viewingExp.status === "pending" ? NEON.yellow : NEON.pink, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{viewingExp.status}</span>}</div>
              </div>
              <div onClick={() => setViewingExp(null)} style={{ cursor: "pointer", width: 32, height: 32, borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.35)", fontSize: 14, flexShrink: 0 }}>{"\u2715"}</div>
            </div>
            {/* Media */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#000", minHeight: 300, maxHeight: "65vh", overflow: "hidden" }}>
              {viewingExp.mediaUrl ? (
                viewingExp.mediaType === "video" ? (
                  <video src={viewingExp.mediaUrl} controls autoPlay playsInline style={{ width: "100%", maxHeight: "65vh", objectFit: "contain" }} />
                ) : (
                  <img src={viewingExp.mediaUrl} alt={viewingExp.caption || "Experience"} style={{ width: "100%", maxHeight: "65vh", objectFit: "contain" }} />
                )
              ) : (
                <div style={{ padding: 40, color: "rgba(255,255,255,0.15)", fontSize: 12 }}>Media unavailable</div>
              )}
            </div>
            {/* Caption */}
            {viewingExp.caption && (
              <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{viewingExp.caption}</div>
            )}
          </div>
        </div>
      )}

      <div
        className="profile-scroll"
        onClick={() => { if (friendMenuOpen) setFriendMenuOpen(null); }}
        style={{ minHeight: "100vh", background: "#08080E", position: "relative", overflow: "hidden", fontFamily: "'DM Sans', sans-serif" }}
      >
        {/* Scanline */}
        <div style={{ position: "fixed", inset: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.008) 2px, rgba(255,255,255,0.008) 4px)", pointerEvents: "none", zIndex: 10 }} />

        {/* Top neon bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${NEON.primary}, ${NEON.pink}, ${NEON.yellow}, ${NEON.green}, ${NEON.purple}, ${NEON.orange}, ${NEON.primary})`, backgroundSize: "200% 100%", animation: "marqueeScroll 20s linear infinite", boxShadow: `0 0 20px rgba(${NEON.primaryRGB},0.4), 0 0 60px rgba(${NEON.primaryRGB},0.15)` }} />

        {/* Content */}
        <div className="profile-content" style={{ position: "relative", zIndex: 2, maxWidth: 920, margin: "0 auto", padding: "0 28px" }}>

          {/* HEADER */}
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "32px 0 20px", animation: "fadeIn 0.5s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ animation: "logoGlow 12s ease-in-out infinite" }}>
                <Image
                  src="/lg-logo.png"
                  alt="LetsGo"
                  width={42}
                  height={42}
                  style={{
                    borderRadius: 6,
                    border: "2px solid var(--logo-border-color, #FF2D78)",
                    background: "rgba(255,255,255,0.03)",
                    animation: "logoBorderCycle 12s linear infinite",
                  }}
                />
              </div>
              <div style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 17, color: "#fff", letterSpacing: "0.08em" }}>LetsGo</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <NotificationBell />
              <div onClick={() => router.push("/")} style={{ width: 38, height: 38, borderRadius: 4, border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h2" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div data-tour="settings-btn" onClick={() => setSettingsOpen(true)} style={{ width: 38, height: 38, borderRadius: 4, border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" /></svg>
              </div>
              <div
                style={{ width: 38, height: 38, borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s ease" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(${NEON.pinkRGB},0.3)`; e.currentTarget.style.background = `rgba(${NEON.pinkRGB},0.06)`; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "transparent"; }}
                onClick={async () => { await supabaseBrowser.auth.signOut(); router.push("/welcome"); }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><polyline points="16 17 21 12 16 7" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="21" y1="12" x2="9" y2="12" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          </header>

          {/* Marquee */}
          <div className="profile-marquee" style={{ margin: "0 -28px 30px", padding: "10px 0", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, animation: "fadeIn 0.5s ease 0.1s both" }}>
            <MarqueeText text="YOUR PROFILE · TRACK REWARDS · UPLOAD RECEIPTS · CASH OUT" speed={28} />
          </div>

          {/* 1) PROFILE HERO */}
          <div style={{ animation: "cardSlideUp 0.7s cubic-bezier(0.23, 1, 0.32, 1) 0.2s both", marginBottom: 28 }}>
            <NeonBorderCard neon={NEON.primary} neonRGB={NEON.primaryRGB}>
              <div className="profile-hero" style={{ padding: "28px 28px 24px", display: "flex", gap: 28, alignItems: "flex-start" }}>
                {/* Avatar */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleHeroAvatarUpload(file); }} />
                  <div onClick={() => avatarInputRef.current?.click()} style={{ width: 88, height: 88, borderRadius: 10, background: avatarUrl ? `url(${avatarUrl}) center/cover no-repeat` : `linear-gradient(135deg, rgba(${NEON.primaryRGB},0.15), rgba(${NEON.purpleRGB},0.15))`, border: `2px solid rgba(${NEON.primaryRGB},0.3)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 32, fontWeight: 700, color: NEON.primary, textShadow: `0 0 20px rgba(${NEON.primaryRGB},0.5)`, cursor: "pointer", position: "relative", overflow: "hidden" }}>
                    {!avatarUrl && getInitials(profile?.first_name??null, profile?.last_name??null)}
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.25s ease", borderRadius: 8 }} onMouseEnter={(e) => e.currentTarget.style.opacity = "1"} onMouseLeave={(e) => e.currentTarget.style.opacity = "0"}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="13" r="4" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5"/></svg>
                      <span style={{ fontSize: 8, color: "rgba(255,255,255,0.7)", marginTop: 4, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textShadow: "none" }}>{avatarUrl ? "Change" : "Upload"}</span>
                    </div>
                  </div>
                  <div style={{ position: "absolute", bottom: -2, right: -2, width: 16, height: 16, borderRadius: "50%", background: "#0C0C14", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: NEON.green, boxShadow: `0 0 6px ${NEON.green}` }} />
                  </div>
                </div>

                {/* Profile Info */}
                <div style={{ flex: 1 }}>
                  <h1 style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 26, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.15, letterSpacing: "-0.01em" }}>
                    {profile?.first_name && profile?.last_name ? `${profile.first_name} ${profile.last_name}` : profile?.full_name || "User"}
                  </h1>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4, marginBottom: 12 }}>
                    {profile?.username ? `@${profile.username}` : ""}{memberSince ? ` · Member since ${memberSince}` : ""}
                  </div>
                  <div className="hero-stats" style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                    {[
                      { label: "Zip", value: profile?.zip_code || "--", icon: "\uD83D\uDCCD" },
                      { label: "Receipts", value: receipts.length, icon: "\uD83E\uDDFE" },
                      { label: "Saved", value: savedPlaces.length, icon: "\u2661" },
                      { label: "Friends", value: friends.filter(f => f.kind === "friend").length, icon: "\uD83D\uDC65" },
                      { label: "Rated", value: ratings.length, icon: "\u2B50" },
                    ].map((s) => (
                      <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12 }}>{s.icon}</span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{s.value}</span>
                        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="hero-actions" style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                  <button onClick={() => setSettingsOpen(true)} style={{ padding: "7px 16px", borderRadius: 3, border: `1px solid rgba(${NEON.primaryRGB},0.3)`, background: `rgba(${NEON.primaryRGB},0.08)`, color: NEON.primary, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>Edit Profile</button>
                  <button onClick={() => { const opening = !heroFriendsOpen; setHeroFriendsOpen(opening); if (opening) { setAddFriendOpen(true); setTimeout(() => friendsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); } }} style={{ padding: "7px 16px", borderRadius: 3, border: `1px solid rgba(${NEON.purpleRGB},${heroFriendsOpen ? 0.5 : 0.3})`, background: heroFriendsOpen ? `rgba(${NEON.purpleRGB},0.12)` : `rgba(${NEON.purpleRGB},0.06)`, color: NEON.purple, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.2s ease" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={NEON.purple} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8.5" cy="7" r="4" stroke={NEON.purple} strokeWidth="2"/></svg>
                    Friends
                  </button>
                </div>
              </div>
            </NeonBorderCard>

            {/* FRIENDS PANEL (toggles from hero button) */}
            {heroFriendsOpen && (
              <div ref={friendsPanelRef} style={{ marginTop: 12, animation: "fadeIn 0.25s ease" }}>
                <NeonBorderCard neon={NEON.purple} neonRGB={NEON.purpleRGB}>
                  <div style={{ padding: "20px 24px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14 }}>{"\uD83D\uDC65"}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: NEON.purple }}>Friends ({friends.filter(f => f.kind === "friend").length})</span>
                      </div>
                    </div>

                    {/* Add Friend search */}
                    <div style={{ marginBottom: 14, padding: "14px 16px", borderRadius: 4, background: `rgba(${NEON.purpleRGB},0.03)`, border: `1px solid rgba(${NEON.purpleRGB},0.12)` }}>
                        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 10 }}>Find people on LetsGo</div>
                        <div style={{ position: "relative" }}>
                          <input type="text" placeholder="Search by name or @username..." value={addFriendSearch} onChange={(e) => setAddFriendSearch(e.target.value)} style={{ width: "100%", padding: "9px 14px 9px 34px", borderRadius: 3, border: `1px solid rgba(${NEON.purpleRGB},0.2)`, background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }} />
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8" stroke={`rgba(${NEON.purpleRGB},0.3)`} strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke={`rgba(${NEON.purpleRGB},0.3)`} strokeWidth="2" strokeLinecap="round" /></svg>
                        </div>
                        {addFriendSearch.length >= 2 && (
                          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                            {addFriendLoading && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", textAlign: "center", padding: 8 }}>Searching...</div>}
                            {!addFriendLoading && addFriendResults.length === 0 && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", textAlign: "center", padding: 8 }}>No users found</div>}
                            {!addFriendLoading && addFriendResults.map((u) => (
                              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", borderRadius: 4, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                                <div style={{ width: 32, height: 32, borderRadius: "50%", background: u.avatarUrl ? `url(${u.avatarUrl}) center/cover no-repeat` : `rgba(${NEON.purpleRGB},0.12)`, border: `1px solid rgba(${NEON.purpleRGB},0.2)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: NEON.purple, flexShrink: 0 }}>
                                  {!u.avatarUrl && getInitials(u.name.split(" ")[0] || null, u.name.split(" ")[1] || null)}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>{u.name}</div>
                                  {u.username && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>@{u.username}</div>}
                                </div>
                                <button onClick={() => handleAddFriend(u.id)} style={{ padding: "5px 12px", borderRadius: 3, border: `1px solid rgba(${NEON.purpleRGB},0.3)`, background: `rgba(${NEON.purpleRGB},0.08)`, color: NEON.purple, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Add</button>
                              </div>
                            ))}
                          </div>
                        )}
                        {addFriendSearch.length > 0 && addFriendSearch.length < 2 && (
                          <div style={{ marginTop: 10, fontSize: 10, color: "rgba(255,255,255,0.15)", textAlign: "center" }}>Type at least 2 characters to search...</div>
                        )}
                      </div>

                    {/* Filter bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                      <GlassPill active={friendsTab === "all"} onClick={() => setFriendsTab("all")} neon={NEON.purple} neonRGB={NEON.purpleRGB}>All</GlassPill>
                      <GlassPill active={friendsTab === "friends"} onClick={() => setFriendsTab("friends")} neon={NEON.purple} neonRGB={NEON.purpleRGB}>Friends</GlassPill>
                      <GlassPill active={friendsTab === "pending"} onClick={() => setFriendsTab("pending")} neon={NEON.purple} neonRGB={NEON.purpleRGB}>Pending</GlassPill>
                      <div style={{ flex: 1 }} />
                      <div style={{ position: "relative", flex: "0 1 160px", minWidth: 120 }}>
                        <input type="text" placeholder="Find friends..." value={friendSearch} onChange={(e) => setFriendSearch(e.target.value)} style={{ padding: "7px 12px 7px 30px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: 11, fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%", boxSizing: "border-box" }} />
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8" stroke="rgba(255,255,255,0.2)" strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" /></svg>
                      </div>
                    </div>

                    {/* Friends list */}
                    {filteredFriends.length === 0 && <div style={{ padding: "16px 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.15)" }}>No friends to show.</div>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {filteredFriends.map((f) => (
                        <div key={f.friendshipId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 4, background: "#0C0C14", border: "1px solid rgba(255,255,255,0.04)", transition: "border-color 0.2s ease", position: "relative" }} onMouseEnter={(e) => e.currentTarget.style.borderColor = `rgba(${NEON.purpleRGB},0.15)`} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)"; }}>
                          <div style={{ width: 36, height: 36, borderRadius: 6, background: f.avatarUrl ? `url(${f.avatarUrl}) center/cover no-repeat` : `linear-gradient(135deg, rgba(${NEON.purpleRGB},0.15), rgba(${NEON.primaryRGB},0.15))`, border: `1px solid rgba(${NEON.purpleRGB},0.25)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: NEON.purple }}>
                            {!f.avatarUrl && getInitials(f.name.split(" ")[0] || null, f.name.split(" ")[1] || null)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.65)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{f.username ? `@${f.username}` : ""}</div>
                          </div>
                          {f.kind === "pending" && (
                            <button onClick={() => handleAcceptFriend(f.friendshipId)} style={{ padding: "4px 10px", borderRadius: 2, border: `1px solid rgba(${NEON.greenRGB},0.3)`, background: `rgba(${NEON.greenRGB},0.08)`, color: NEON.green, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Accept</button>
                          )}
                          {f.kind === "sent" && (
                            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>Sent</span>
                          )}
                          <div onClick={(e) => { e.stopPropagation(); setFriendMenuOpen(friendMenuOpen === f.friendshipId ? null : f.friendshipId); }} style={{ width: 24, height: 24, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "background 0.2s ease" }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.5" fill="rgba(255,255,255,0.2)"/><circle cx="12" cy="12" r="1.5" fill="rgba(255,255,255,0.2)"/><circle cx="12" cy="19" r="1.5" fill="rgba(255,255,255,0.2)"/></svg>
                          </div>
                          {friendMenuOpen === f.friendshipId && (
                            <div style={{ position: "absolute", top: "100%", right: 8, marginTop: 4, zIndex: 20, minWidth: 150, borderRadius: 4, background: "#111118", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", overflow: "hidden", animation: "fadeIn 0.15s ease" }}>
                              <div onClick={() => handleRemoveFriend(f.friendshipId)} style={{ padding: "10px 14px", fontSize: 11, color: "rgba(255,255,255,0.45)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "background 0.15s ease" }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.04)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/><circle cx="8.5" cy="7" r="4" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/><line x1="18" y1="11" x2="23" y2="11" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                Remove Friend
                              </div>
                              <div style={{ height: 1, background: "rgba(255,255,255,0.04)" }} />
                              <div onClick={() => handleBlockFriend(f.friendshipId)} style={{ padding: "10px 14px", fontSize: 11, color: NEON.pink, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "background 0.15s ease" }} onMouseEnter={(e) => e.currentTarget.style.background = `rgba(${NEON.pinkRGB},0.06)`} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={NEON.pink} strokeWidth="1.5"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" stroke={NEON.pink} strokeWidth="1.5" strokeLinecap="round"/></svg>
                                Block User
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Invite / Referral */}
                    <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 4, background: `rgba(${NEON.purpleRGB},0.03)`, border: `1px solid rgba(${NEON.purpleRGB},0.1)`, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: `rgba(${NEON.purpleRGB},0.1)`, border: `1px solid rgba(${NEON.purpleRGB},0.2)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{"\uD83C\uDF89"}</div>
                      <div style={{ flex: "1 1 140px", minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.65)", marginBottom: 2 }}>Invite Friends to LetsGo</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", lineHeight: 1.4 }}>Share your referral code and earn rewards when friends sign up!</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
                        <div style={{ padding: "5px 12px", borderRadius: 3, background: "rgba(255,255,255,0.04)", border: `1px solid rgba(${NEON.purpleRGB},0.2)`, fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: NEON.purple, letterSpacing: "0.1em", textShadow: `0 0 8px rgba(${NEON.purpleRGB},0.3)` }}>{referralCode}</div>
                        <button onClick={() => { navigator.clipboard?.writeText(referralCode); setReferralCopied(true); setTimeout(() => setReferralCopied(false), 2000); }} style={{ padding: "5px 10px", borderRadius: 3, border: `1px solid rgba(${NEON.purpleRGB},${referralCopied ? 0.5 : 0.25})`, background: referralCopied ? `rgba(${NEON.greenRGB},0.1)` : `rgba(${NEON.purpleRGB},0.06)`, color: referralCopied ? NEON.green : NEON.purple, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s ease", whiteSpace: "nowrap" }}>{referralCopied ? "Copied!" : "Copy Code"}</button>
                        <button onClick={async () => { const url = `${window.location.origin}/profile?add=${profile?.id||""}`; if (navigator.share) { try { await navigator.share({ title: "Add me on LetsGo!", url }); } catch {} } else { navigator.clipboard?.writeText(url); setShareLinkCopied(true); setTimeout(() => setShareLinkCopied(false), 2000); } }} style={{ padding: "5px 10px", borderRadius: 3, border: `1px solid rgba(${NEON.purpleRGB},${shareLinkCopied ? 0.5 : 0.2})`, background: shareLinkCopied ? `rgba(${NEON.greenRGB},0.1)` : "transparent", color: shareLinkCopied ? NEON.green : "rgba(255,255,255,0.25)", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", transition: "all 0.2s ease" }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          {shareLinkCopied ? "Copied!" : "Share Link"}
                        </button>
                      </div>
                    </div>
                  </div>
                </NeonBorderCard>
              </div>
            )}
          </div>

          {/* INFLUENCER DASHBOARD (only if user is an influencer) */}
          {influencerData && (
            <div style={{ animation: "cardSlideUp 0.7s cubic-bezier(0.23, 1, 0.32, 1) 0.25s both", marginBottom: 32 }}>
              <NeonBorderCard neon={NEON.orange} neonRGB={NEON.orangeRGB}>
                <div style={{ padding: "20px 24px" }}>
                  <SectionHeader icon="⭐" label="Influencer Dashboard" neon={NEON.orange} neonRGB={NEON.orangeRGB} />

                  {/* Stat cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
                    <div style={{ padding: "12px 14px", borderRadius: 4, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", marginBottom: 4 }}>Signups</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: NEON.orange }}>{(influencerData.influencer.totalSignups || 0).toLocaleString()}</div>
                    </div>
                    <div style={{ padding: "12px 14px", borderRadius: 4, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", marginBottom: 4 }}>Credited</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: NEON.green }}>${((influencerData.totalCreditedCents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                    <div style={{ padding: "12px 14px", borderRadius: 4, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", marginBottom: 4 }}>Clicks</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: NEON.primary }}>{(influencerData.influencer.totalClicks || 0).toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Rate Tiers */}
                  {influencerData.rateTiers && influencerData.rateTiers.length > 0 && (() => {
                    const signups = influencerData.influencer.totalSignups || 0;
                    return (
                      <div style={{ padding: "10px 12px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 18 }}>
                        <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>Your Rate Tiers</div>
                        {influencerData.rateTiers.map((rt, i) => {
                          const isActive = signups >= rt.minSignups && (rt.maxSignups === null || signups <= rt.maxSignups);
                          return (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 11, color: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)" }}>
                              <span>
                                {isActive && <span style={{ color: "#39ff14", marginRight: 4 }}>●</span>}
                                {rt.label || `Tier ${rt.tierIndex}`}: {rt.minSignups}–{rt.maxSignups ?? "∞"}
                              </span>
                              <span style={{ fontWeight: 600, color: isActive ? "#ffff00" : "rgba(255,255,255,0.2)" }}>${(rt.rateCents / 100).toFixed(2)}/signup</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Referral Link */}
                  <div style={{ padding: "12px 14px", borderRadius: 4, background: `rgba(${NEON.orangeRGB},0.04)`, border: `1px solid rgba(${NEON.orangeRGB},0.12)`, marginBottom: 18 }}>
                    <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)", marginBottom: 8 }}>Your Referral Link</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', monospace", wordBreak: "break-all", marginBottom: 8 }}>
                      {typeof window !== "undefined" ? `${window.location.origin}/welcome?ref=${influencerData.influencer.code}` : `letsgo.app/welcome?ref=${influencerData.influencer.code}`}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => {
                        navigator.clipboard?.writeText(`${window.location.origin}/welcome?ref=${influencerData.influencer.code}`);
                        setInfluencerLinkCopied(true); setTimeout(() => setInfluencerLinkCopied(false), 2000);
                      }} style={{
                        padding: "5px 12px", borderRadius: 3,
                        border: `1px solid rgba(${NEON.orangeRGB},${influencerLinkCopied ? 0.5 : 0.25})`,
                        background: influencerLinkCopied ? `rgba(${NEON.greenRGB},0.1)` : `rgba(${NEON.orangeRGB},0.06)`,
                        color: influencerLinkCopied ? NEON.green : NEON.orange,
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                        cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s",
                      }}>{influencerLinkCopied ? "Copied!" : "Copy Link"}</button>
                      <button onClick={async () => {
                        const url = `${window.location.origin}/welcome?ref=${influencerData.influencer.code}`;
                        if (navigator.share) { try { await navigator.share({ title: "Join LetsGo!", text: `Sign up with my link and start earning cashback!`, url }); } catch {} }
                        else { navigator.clipboard?.writeText(url); setInfluencerLinkCopied(true); setTimeout(() => setInfluencerLinkCopied(false), 2000); }
                      }} style={{
                        padding: "5px 12px", borderRadius: 3,
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "transparent", color: "rgba(255,255,255,0.25)",
                        fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
                        cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Share
                      </button>
                    </div>
                  </div>

                  {/* Earnings History */}
                  {influencerData.payouts.length > 0 && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", marginBottom: 8 }}>Earnings History</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {influencerData.payouts.slice(0, 5).map(p => {
                          const statusColor = p.creditedToBalance ? NEON.green : NEON.yellow;
                          const statusLabel = p.creditedToBalance ? "In Balance" : "Pending";
                          const periodStart = new Date(p.periodStart + "T00:00:00");
                          const periodLabel = periodStart.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                          return (
                            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderRadius: 3, background: "rgba(255,255,255,0.02)" }}>
                              <div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>${((p.amountCents || 0) / 100).toFixed(2)}</span>
                                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", marginLeft: 6 }}>{p.signupsCount || 0} signups · {periodLabel}</span>
                              </div>
                              <span style={{ fontSize: 9, fontWeight: 600, color: statusColor, letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ width: 4, height: 4, borderRadius: "50%", background: statusColor, boxShadow: `0 0 4px ${statusColor}` }} />
                                {statusLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </NeonBorderCard>
            </div>
          )}

          {/* EARNINGS BANNER */}
          <div data-tour="earnings-banner" style={{ animation: "cardSlideUp 0.7s cubic-bezier(0.23, 1, 0.32, 1) 0.3s both", marginBottom: 32 }}>
            <NeonBorderCard neon={NEON.green} neonRGB={NEON.greenRGB}>
              <div className="earnings-banner" style={{ padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div className="earnings-values" style={{ display: "flex", gap: 40, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: 4 }}>Total Earned</div>
                    <div style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 28, fontWeight: 700, color: NEON.green, textShadow: `0 0 20px rgba(${NEON.greenRGB},0.4)` }}>${totalEarned.toFixed(2)}</div>
                  </div>
                  <div className="earnings-divider" style={{ width: 1, height: 40, background: "rgba(255,255,255,0.06)" }} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", marginBottom: 4 }}>Available to Cash Out<span style={{ color: NEON.yellow }}>*</span></div>
                    <div style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 28, fontWeight: 700, color: availableBalance >= 20 ? NEON.yellow : "rgba(255,255,255,0.3)", textShadow: availableBalance >= 20 ? `0 0 20px rgba(${NEON.yellowRGB},0.4)` : "none" }}>${availableBalance.toFixed(2)}</div>
                  </div>
                  <div className="earnings-divider" style={{ width: 1, height: 40, background: "rgba(255,255,255,0.06)" }} />
                  <button data-tour="cashout-btn" onClick={() => setCashOutModal(paymentConnected ? "confirm" : "noPayment")} style={{ padding: "10px 22px", borderRadius: 3, border: `1px solid rgba(${NEON.yellowRGB},0.5)`, background: `rgba(${NEON.yellowRGB},0.1)`, color: NEON.yellow, fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textShadow: `0 0 8px ${NEON.yellow}50` }}>Cash Out</button>
                </div>
                <div data-tour="upload-receipt-btn" className="earnings-actions" onClick={() => setUploadOpen(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 3, border: `1px solid rgba(${NEON.greenRGB},0.4)`, background: `rgba(${NEON.greenRGB},0.08)`, cursor: "pointer", transition: "all 0.3s ease" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={NEON.green} strokeWidth="2" strokeLinecap="round" /></svg>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: NEON.green, textTransform: "uppercase", textShadow: `0 0 8px ${NEON.green}50` }}>Upload Receipt</span>
                </div>
              </div>
            </NeonBorderCard>
          </div>

          {/* PENDING RECEIPTS */}
          {pendingReceipts.length > 0 && (
            <div style={{ marginBottom: 32, animation: "cardSlideUp 0.7s cubic-bezier(0.23, 1, 0.32, 1) 0.32s both" }}>
              <SectionHeader icon={"\u23F3"} label="Pending Receipts" neon={NEON.yellow} neonRGB={NEON.yellowRGB} count={pendingReceipts.length} />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pendingReceipts.map((r) => (
                  <div key={r.id} onClick={() => setViewingReceipt(r)} style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderRadius: 4, background: "#0C0C14", border: `1px solid rgba(${NEON.yellowRGB},0.1)`, transition: "all 0.2s ease", gap: 16, cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(${NEON.yellowRGB},0.25)`; e.currentTarget.style.background = "#0d0d16"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = `rgba(${NEON.yellowRGB},0.1)`; e.currentTarget.style.background = "#0C0C14"; }}>
                    {r.photoUrl ? (
                      <img src={r.photoUrl} alt="" style={{ width: 38, height: 38, borderRadius: 4, objectFit: "cover", flexShrink: 0, border: `1px solid rgba(${NEON.yellowRGB},0.15)` }} />
                    ) : (
                      <div style={{ width: 38, height: 38, borderRadius: 4, background: `rgba(${NEON.yellowRGB},0.08)`, border: `1px solid rgba(${NEON.yellowRGB},0.15)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{"\uD83E\uDDFE"}</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.business}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>{r.date} {"\u00b7"} Visit #{r.visitNum}</div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 60 }}>
                      <div style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: "#fff" }}>${r.amount.toFixed(2)}</div>
                      <div style={{ fontSize: 10, color: NEON.green, fontWeight: 600 }}>+${r.cashback.toFixed(2)}</div>
                    </div>
                    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: NEON.yellow, display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: NEON.yellow, boxShadow: `0 0 4px ${NEON.yellow}`, animation: "notifPulse 2s ease-in-out infinite" }} />
                      Pending
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); setCancelConfirmId(cancelConfirmId === r.id ? null : r.id); }} style={{ padding: "5px 12px", borderRadius: 3, flexShrink: 0, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "rgba(255,255,255,0.2)", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(${NEON.pinkRGB},0.25)`; e.currentTarget.style.color = NEON.pink; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.2)"; }}>Cancel</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SAVED PLACES */}
          <div data-tour="saved-places" style={{ marginBottom: 36, animation: "cardSlideUp 0.7s cubic-bezier(0.23, 1, 0.32, 1) 0.35s both" }}>
            <div onClick={() => setSavedPlacesOpen(!savedPlacesOpen)} style={{ cursor: "pointer" }}>
              <SectionHeader icon={"\u2661"} label="Saved Places" neon={NEON.pink} neonRGB={NEON.pinkRGB} count={savedPlaces.length} rightElement={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transition: "transform 0.2s ease", transform: savedPlacesOpen ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6" stroke={NEON.pink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              } />
            </div>
            {savedPlacesOpen && (<>
            {savedPlaces.length === 0 ? (
              <div style={{ padding: "30px 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.15)" }}>No saved places yet. Heart businesses on the Discovery page to save them here.</div>
            ) : (
              <div className="saved-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                {savedPlaces.map((place) => {
                  const neonRGBVal = place.neon === NEON.yellow ? NEON.yellowRGB : place.neon === NEON.orange ? NEON.orangeRGB : place.neon === NEON.green ? NEON.greenRGB : place.neon === NEON.purple ? NEON.purpleRGB : place.neon === NEON.pink ? NEON.pinkRGB : NEON.primaryRGB;
                  return (
                    <NeonBorderCard key={place.id} neon={place.neon} neonRGB={neonRGBVal} borderWidth={2} onClick={() => {}}>
                      <div style={{ padding: "16px 18px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>{place.name}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{place.type}</span>
                        </div>
                      </div>
                    </NeonBorderCard>
                  );
                })}
              </div>
            )}
            </>)}
          </div>

          {/* WOULD GO AGAIN (Ratings) */}
          <div style={{ marginBottom: 36, animation: "cardSlideUp 0.7s cubic-bezier(0.23, 1, 0.32, 1) 0.35s both" }}>
            <div data-tour="ratings-section" onClick={() => setRatingsOpen(!ratingsOpen)} style={{ cursor: "pointer" }}>
              <SectionHeader icon={"\u2B50"} label="Would Go Again" neon={NEON.yellow} neonRGB={NEON.yellowRGB} count={ratings.length} rightElement={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transition: "transform 0.2s ease", transform: ratingsOpen ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6" stroke={NEON.yellow} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              } />
            </div>
            {ratingsOpen && (<>
              {/* Add Rating button */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                <button onClick={() => { setRateModalOpen(!rateModalOpen); setRateStars(0); setRateNote(""); setRateWouldGoAgain(true); setRateBusinessId(null); setEditingRatingId(null); }} style={{ padding: "7px 16px", borderRadius: 3, border: `1px solid rgba(${NEON.yellowRGB},${rateModalOpen ? 0.4 : 0.2})`, background: rateModalOpen ? `rgba(${NEON.yellowRGB},0.08)` : "transparent", color: NEON.yellow, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.3s ease" }}>
                  {rateModalOpen ? "Cancel" : "+ Rate a Place"}
                </button>
              </div>

              {/* Rating form (inline) */}
              {rateModalOpen && (
                <NeonBorderCard neon={NEON.yellow} neonRGB={NEON.yellowRGB} borderWidth={2} style={{ marginBottom: 16 }}>
                  <div style={{ padding: "20px 22px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: NEON.yellow, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>{editingRatingId ? "Edit Rating" : "Rate a Business"}</div>

                    {/* Business picker (only businesses with approved receipts, not yet rated) */}
                    {!editingRatingId && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Business</div>
                        <select value={rateBusinessId || ""} onChange={(e) => setRateBusinessId(e.target.value || null)} style={{ width: "100%", padding: "10px 14px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none" }}>
                          <option value="" style={{ background: "#0C0C14" }}>Select a business you&apos;ve visited...</option>
                          {(() => {
                            const ratedBizIds = new Set(ratings.map(r => r.businessId));
                            const uniqueBiz = new Map<string, string>();
                            receipts.filter(r => r.status === "approved").forEach(r => { if (!ratedBizIds.has(r.businessId) && !uniqueBiz.has(r.businessId)) uniqueBiz.set(r.businessId, r.business); });
                            return Array.from(uniqueBiz.entries()).map(([id, name]) => (
                              <option key={id} value={id} style={{ background: "#0C0C14" }}>{name}</option>
                            ));
                          })()}
                        </select>
                      </div>
                    )}

                    {/* Star rating */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>Rating</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[1,2,3,4,5].map(s => (
                          <button key={s} onClick={() => setRateStars(s)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, transition: "transform 0.15s ease", transform: rateStars >= s ? "scale(1.15)" : "scale(1)" }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill={rateStars >= s ? NEON.yellow : "none"} stroke={rateStars >= s ? NEON.yellow : "rgba(255,255,255,0.15)"} strokeWidth="1.5" style={{ filter: rateStars >= s ? `drop-shadow(0 0 6px ${NEON.yellow})` : "none", transition: "all 0.2s ease" }}>
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Would go again toggle */}
                    <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
                      <button onClick={() => setRateWouldGoAgain(!rateWouldGoAgain)} style={{ width: 36, height: 20, borderRadius: 10, border: "none", background: rateWouldGoAgain ? NEON.green : "rgba(255,255,255,0.1)", cursor: "pointer", position: "relative", transition: "background 0.2s ease" }}>
                        <div style={{ width: 14, height: 14, borderRadius: 7, background: "#fff", position: "absolute", top: 3, left: rateWouldGoAgain ? 19 : 3, transition: "left 0.2s ease", boxShadow: rateWouldGoAgain ? `0 0 6px ${NEON.green}` : "none" }} />
                      </button>
                      <span style={{ fontSize: 12, color: rateWouldGoAgain ? NEON.green : "rgba(255,255,255,0.3)", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Would go again</span>
                    </div>

                    {/* Private note */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Private Note <span style={{ color: "rgba(255,255,255,0.15)", fontWeight: 400 }}>(only you can see this)</span></div>
                      <textarea value={rateNote} onChange={(e) => setRateNote(e.target.value)} placeholder="What did you think? Any favorites?" rows={2} style={{ width: "100%", padding: "10px 14px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: "none", resize: "vertical", lineHeight: 1.5 }} />
                    </div>

                    {/* Save button */}
                    <button disabled={rateSaving || rateStars === 0 || (!editingRatingId && !rateBusinessId)} onClick={async () => {
                      if (!token || !profile) return;
                      setRateSaving(true);
                      try {
                        const res = await fetch("/api/ratings", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ userId: profile.id, businessId: editingRatingId || rateBusinessId, stars: rateStars, wouldGoAgain: rateWouldGoAgain, privateNote: rateNote || null }),
                        });
                        if (res.ok) {
                          // Refresh ratings
                          const refreshRes = await fetch(`/api/ratings?userId=${profile.id}`, { headers: { Authorization: `Bearer ${token}` } });
                          if (refreshRes.ok) {
                            const rData = await refreshRes.json();
                            setRatings((rData.ratings || []).map((r: Record<string, unknown>) => ({
                              id: r.id as string, businessId: r.businessId as string, businessName: r.businessName as string,
                              businessType: r.businessType as string, stars: r.stars as number, wouldGoAgain: r.wouldGoAgain as boolean,
                              privateNote: r.privateNote as string | null,
                              updatedAt: new Date(r.updatedAt as string).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                            })));
                          }
                          setRateModalOpen(false); setRateStars(0); setRateNote(""); setRateBusinessId(null); setEditingRatingId(null);
                        }
                      } catch { /* ignore */ }
                      setRateSaving(false);
                    }} style={{ width: "100%", padding: "11px 0", borderRadius: 3, border: "none", background: rateStars === 0 || (!editingRatingId && !rateBusinessId) ? "rgba(255,255,255,0.05)" : `linear-gradient(135deg, ${NEON.yellow}, ${NEON.orange})`, color: rateStars === 0 || (!editingRatingId && !rateBusinessId) ? "rgba(255,255,255,0.15)" : "#000", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: rateStars === 0 || (!editingRatingId && !rateBusinessId) ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.3s ease" }}>
                      {rateSaving ? "Saving..." : editingRatingId ? "Update Rating" : "Save Rating"}
                    </button>
                  </div>
                </NeonBorderCard>
              )}

              {/* Ratings list */}
              {ratings.length === 0 && !rateModalOpen ? (
                <div style={{ padding: "30px 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.15)" }}>No ratings yet. Rate businesses you&apos;ve visited to track your favorites!</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {ratings.map((r) => {
                    const neonColor = r.wouldGoAgain ? NEON.green : NEON.orange;
                    const neonRGBVal = r.wouldGoAgain ? NEON.greenRGB : NEON.orangeRGB;
                    return (
                      <NeonBorderCard key={r.id} neon={neonColor} neonRGB={neonRGBVal} borderWidth={2}>
                        <div style={{ padding: "16px 20px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)", fontFamily: "'DM Sans', sans-serif" }}>{r.businessName}</div>
                              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{r.businessType} &middot; {r.updatedAt}</div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              {/* Edit button */}
                              <button onClick={() => { setEditingRatingId(r.businessId); setRateStars(r.stars); setRateNote(r.privateNote || ""); setRateWouldGoAgain(r.wouldGoAgain); setRateBusinessId(r.businessId); setRateModalOpen(true); }} style={{ padding: "4px 10px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "rgba(255,255,255,0.25)", fontSize: 9, fontWeight: 600, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(${NEON.yellowRGB},0.3)`; e.currentTarget.style.color = NEON.yellow; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}>Edit</button>
                              {/* Delete button */}
                              <button onClick={async () => {
                                if (!token || !profile) return;
                                await fetch("/api/ratings", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId: profile.id, businessId: r.businessId }) });
                                setRatings(prev => prev.filter(x => x.id !== r.id));
                              }} style={{ padding: "4px 10px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "rgba(255,255,255,0.15)", fontSize: 9, fontWeight: 600, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(${NEON.pinkRGB},0.3)`; e.currentTarget.style.color = NEON.pink; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.15)"; }}>&times;</button>
                            </div>
                          </div>
                          {/* Stars display */}
                          <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
                            {[1,2,3,4,5].map(s => (
                              <svg key={s} width="16" height="16" viewBox="0 0 24 24" fill={r.stars >= s ? NEON.yellow : "none"} stroke={r.stars >= s ? NEON.yellow : "rgba(255,255,255,0.1)"} strokeWidth="1.5" style={{ filter: r.stars >= s ? `drop-shadow(0 0 4px ${NEON.yellow})` : "none" }}>
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ))}
                            {r.wouldGoAgain && (
                              <span style={{ fontSize: 9, color: NEON.green, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginLeft: 8, display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ width: 4, height: 4, borderRadius: "50%", background: NEON.green, boxShadow: `0 0 4px ${NEON.green}` }} />
                                Would go again
                              </span>
                            )}
                          </div>
                          {/* Private note */}
                          {r.privateNote && (
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontStyle: "italic", marginTop: 4, lineHeight: 1.4 }}>
                              &ldquo;{r.privateNote}&rdquo;
                            </div>
                          )}
                          {/* Discovery link */}
                          <div onClick={() => router.push(`/swipe?spotlight=${r.businessId}`)} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, padding: "5px 12px", borderRadius: 3, border: `1px solid rgba(${NEON.primaryRGB},0.15)`, background: "transparent", color: NEON.primary, fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s ease" }}>
                            <span style={{ fontSize: 11 }}>🔍</span> View on Discovery
                          </div>
                        </div>
                      </NeonBorderCard>
                    );
                  })}
                </div>
              )}
            </>)}
          </div>

          {/* PAYOUT CALCULATOR */}
          <div data-tour="payout-calc" style={{ animation: "cardSlideUp 0.7s cubic-bezier(0.23, 1, 0.32, 1) 0.35s both", marginBottom: 32 }}>
            <SectionHeader icon={"\u26A1"} label="Payout Calculator" neon={NEON.primary} neonRGB={NEON.primaryRGB} rightElement={
              <div onClick={() => setCalcOpen(!calcOpen)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 3, border: `1px solid rgba(${NEON.primaryRGB},${calcOpen ? 0.3 : 0.12})`, background: calcOpen ? `rgba(${NEON.primaryRGB},0.06)` : "transparent", cursor: "pointer", transition: "all 0.3s ease" }}>
                <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: calcOpen ? NEON.primary : "rgba(255,255,255,0.25)", fontFamily: "'DM Sans', sans-serif", transition: "color 0.3s ease" }}>{calcOpen ? "Close" : "Open"}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ transition: "transform 0.3s ease", transform: calcOpen ? "rotate(180deg)" : "rotate(0)" }}><path d="M6 9l6 6 6-6" stroke={calcOpen ? NEON.primary : "rgba(255,255,255,0.25)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
            } />

            {calcOpen && (
            <NeonBorderCard neon={NEON.primary} neonRGB={NEON.primaryRGB} hoverLift={false}>
              <div style={{ padding: "22px 28px" }}>
                <div className="calc-row" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  {/* Business search */}
                  <div style={{ flex: "0 0 280px", position: "relative" }}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>Business</label>
                    {calcSelectedBiz ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderRadius: 3, border: `1px solid rgba(${NEON.primaryRGB},0.25)`, background: `rgba(${NEON.primaryRGB},0.05)` }}>
                        <div>
                          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>{calcSelectedBiz.name}</span>
                          <span style={{ fontSize: 10, color: LEVEL_COLORS[calcSelectedBiz.level - 1], marginLeft: 8, fontWeight: 700 }}>Lvl {calcSelectedBiz.level} {"\u00b7"} {calcSelectedBiz.rates[calcSelectedBiz.level - 1]}%</span>
                        </div>
                        <div onClick={() => { setCalcSelectedBiz(null); setCalcSearch(""); setCalcSubtotal(""); }} style={{ cursor: "pointer", color: "rgba(255,255,255,0.25)", fontSize: 12, lineHeight: 1 }}>{"\u2715"}</div>
                      </div>
                    ) : (
                      <>
                        <div style={{ position: "relative" }}>
                          <input type="text" placeholder="Search a business..." value={calcSearch} onChange={(e) => setCalcSearch(e.target.value)} style={{ width: "100%", padding: "9px 14px 9px 32px", borderRadius: 3, border: `1px solid rgba(${NEON.primaryRGB},0.15)`, background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }} />
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8" stroke={`rgba(${NEON.primaryRGB},0.3)`} strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke={`rgba(${NEON.primaryRGB},0.3)`} strokeWidth="2" strokeLinecap="round" /></svg>
                        </div>
                        {calcSearchResults.length > 0 && (
                          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 20, borderRadius: 4, background: "#111120", border: `1px solid rgba(${NEON.primaryRGB},0.2)`, boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(${NEON.primaryRGB},0.06)`, overflow: "hidden" }}>
                            {calcSearchResults.map((biz) => (
                              <div key={biz.id} onClick={() => { setCalcSelectedBiz(biz); setCalcSearch(biz.name); }} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background 0.15s ease", borderBottom: "1px solid rgba(255,255,255,0.04)" }} onMouseEnter={(e) => e.currentTarget.style.background = `rgba(${NEON.primaryRGB},0.06)`} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{biz.name}</div>
                                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 1 }}>{biz.type} {"\u00b7"} {biz.visits} visits</div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: LEVEL_COLORS[biz.level - 1] }}>Lvl {biz.level}</span>
                                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{biz.rates[biz.level - 1]}% back</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {calcSearch && calcSearchResults.length === 0 && (
                          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 20, borderRadius: 4, background: "#111120", border: "1px solid rgba(255,255,255,0.06)", padding: "14px", textAlign: "center" }}>
                            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>No businesses found</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Subtotal input */}
                  <div style={{ flex: "0 0 180px" }}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>Receipt Subtotal</label>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "rgba(255,255,255,0.2)", fontFamily: "'Clash Display', 'DM Sans', sans-serif" }}>$</span>
                      <input type="number" placeholder="0.00" value={calcSubtotal} onChange={(e) => setCalcSubtotal(e.target.value)} disabled={!calcSelectedBiz} style={{ width: "100%", padding: "9px 14px 9px 24px", borderRadius: 3, border: `1px solid ${calcSelectedBiz ? `rgba(${NEON.primaryRGB},0.15)` : "rgba(255,255,255,0.06)"}`, background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: 14, fontFamily: "'Clash Display', 'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", opacity: calcSelectedBiz ? 1 : 0.4 }} />
                    </div>
                  </div>

                  {/* Divider arrow */}
                  <div className="calc-arrow" style={{ display: "flex", alignItems: "center", paddingTop: 22 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.15 }}><path d="M5 12h14M12 5l7 7-7 7" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>

                  {/* Result */}
                  <div style={{ flex: 1, paddingTop: 0 }}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>Expected Payout</label>
                    <div style={{ padding: "8px 18px", borderRadius: 3, minHeight: 40, background: calcResult ? `rgba(${NEON.greenRGB},0.05)` : "rgba(255,255,255,0.02)", border: `1px solid ${calcResult ? `rgba(${NEON.greenRGB},0.15)` : "rgba(255,255,255,0.04)"}`, display: "flex", alignItems: "center", gap: 16, transition: "all 0.3s ease" }}>
                      {calcResult ? (
                        <>
                          <div>
                            <div style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 26, fontWeight: 700, color: NEON.green, textShadow: `0 0 15px rgba(${NEON.greenRGB},0.4)`, lineHeight: 1.1 }}>+${calcResult.payout.toFixed(2)}</div>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 3 }}>{calcResult.rate}% of ${parseFloat(calcSubtotal).toFixed(2)} at Level {calcResult.level}</div>
                          </div>
                          {calcSelectedBiz && calcSelectedBiz.level < 7 && (
                            <>
                              <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.06)" }} />
                              <div>
                                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>At Next Level</div>
                                <div style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.25)" }}>
                                  +${((parseFloat(calcSubtotal) * calcSelectedBiz.rates[calcSelectedBiz.level]) / 100).toFixed(2)}
                                  <span style={{ fontSize: 10, fontWeight: 500, marginLeft: 4, color: "rgba(255,255,255,0.15)" }}>({calcSelectedBiz.rates[calcSelectedBiz.level]}%)</span>
                                </div>
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.12)" }}>{calcSelectedBiz ? "Enter a subtotal..." : "Select a business to estimate your payout"}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </NeonBorderCard>
            )}
          </div>

          {/* PROGRESSIVE PAYOUTS BY PLACE */}
          <div data-tour="level-progress" style={{ marginBottom: 48, animation: "cardSlideUp 0.7s cubic-bezier(0.23, 1, 0.32, 1) 0.45s both" }}>
            <div onClick={() => setProgressiveOpen(!progressiveOpen)} style={{ cursor: "pointer" }}>
              <SectionHeader icon={"\u25C8"} label="Progressive Payouts by Place" neon={NEON.yellow} neonRGB={NEON.yellowRGB} count={payoutBusinesses.length} rightElement={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transition: "transform 0.2s ease", transform: progressiveOpen ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6" stroke={NEON.yellow} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              } />
            </div>

            {progressiveOpen && (<>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <div className="payout-search" style={{ position: "relative", flex: "0 0 240px" }}>
                <input type="text" placeholder="Search businesses..." value={payoutSearch} onChange={(e) => setPayoutSearch(e.target.value)} style={{ width: "100%", padding: "8px 14px 8px 32px", borderRadius: 3, border: `1px solid rgba(${NEON.yellowRGB},0.15)`, background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }} />
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8" stroke="rgba(255,255,255,0.15)" strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" /></svg>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {[{ key: "visits", label: "Most Visits" }, { key: "earned", label: "Most Earned" }, { key: "level", label: "Highest Level" }, { key: "balance", label: "Balance" }].map((s) => (
                  <GlassPill key={s.key} active={payoutSort === s.key} onClick={() => setPayoutSort(s.key)} neon={NEON.yellow} neonRGB={NEON.yellowRGB}>{s.label}</GlassPill>
                ))}
              </div>
            </div>

            {payoutBusinesses.length === 0 && <div style={{ padding: "30px 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.15)" }}>No payout data yet. Upload receipts to start building your levels!</div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredPayouts.map((biz) => {
                const isExpanded = expandedPayout === biz.id;
                const levelColor = LEVEL_COLORS[biz.level - 1] || NEON.primary;
                const levelColorRGB = levelColor === NEON.pink ? NEON.pinkRGB : levelColor === NEON.orange ? NEON.orangeRGB : levelColor === NEON.yellow ? NEON.yellowRGB : levelColor === NEON.green ? NEON.greenRGB : levelColor === NEON.primary ? NEON.primaryRGB : NEON.purpleRGB;

                return (
                  <NeonBorderCard key={biz.id} neon={levelColor} neonRGB={levelColorRGB} borderWidth={2} hoverLift={false} onClick={() => setExpandedPayout(isExpanded ? null : biz.id)}>
                    <div style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: isExpanded ? 16 : 0 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 6, flexShrink: 0, background: `rgba(${levelColorRGB},0.1)`, border: `1px solid ${levelColor}40`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 8, fontWeight: 700, color: levelColor, letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: 1 }}>LVL</span>
                          <span style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: levelColor, textShadow: `0 0 8px ${levelColor}50`, lineHeight: 1.1 }}>{biz.level}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.75)", fontFamily: "'DM Sans', sans-serif" }}>{biz.name}</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>{biz.type} {"\u00b7"} {biz.visits} visits {"\u00b7"} {biz.rates[biz.level - 1]}% back</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>Earned</div>
                          <div style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: NEON.green }}>${biz.earned.toFixed(2)}</div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, minWidth: 70 }}>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>Balance</div>
                          <div style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: biz.balance >= 20 ? NEON.yellow : "rgba(255,255,255,0.4)" }}>${biz.balance.toFixed(2)}</div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, transition: "transform 0.3s ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}><path d="M6 9l6 6 6-6" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </div>

                      {isExpanded && (
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
                          <div style={{ marginBottom: 16 }}>
                            <LevelProgressBar currentLevel={biz.level} visits={biz.visits} rates={biz.rates} neon={levelColor} thresholds={tierConfig.visitThresholds} />
                          </div>
                          <div className="tier-chips" style={{ display: "flex", gap: 6 }}>
                            {biz.rates.map((rate, idx) => {
                              const active = idx + 1 === biz.level;
                              const completed = idx + 1 < biz.level;
                              const c = LEVEL_COLORS[idx] || NEON.primary;
                              const cRGB = c === NEON.pink ? NEON.pinkRGB : c === NEON.orange ? NEON.orangeRGB : c === NEON.yellow ? NEON.yellowRGB : c === NEON.green ? NEON.greenRGB : c === NEON.primary ? NEON.primaryRGB : NEON.purpleRGB;
                              const thresholdLabel = tierConfig.visitThresholds[idx] ? getVisitRangeLabel(tierConfig.visitThresholds[idx]) : "";
                              return (
                                <div key={idx} style={{ flex: 1, padding: "10px 8px", borderRadius: 4, background: active ? `rgba(${cRGB},0.08)` : "rgba(255,255,255,0.02)", border: active ? `1px solid ${c}40` : "1px solid rgba(255,255,255,0.04)", textAlign: "center", transition: "all 0.3s ease", opacity: completed || active ? 1 : 0.45 }}>
                                  <div style={{ fontSize: 9, fontWeight: 700, color: active ? c : completed ? c : "rgba(255,255,255,0.3)", letterSpacing: "0.05em", marginBottom: 3 }}>Level {idx + 1}</div>
                                  <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", marginBottom: 4 }}>{thresholdLabel}</div>
                                  <div style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, color: active ? c : completed ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)", textShadow: active ? `0 0 8px ${c}50` : "none" }}>{rate.toFixed(2)}%</div>
                                </div>
                              );
                            })}
                          </div>
                          {biz.balance >= minCashoutCents / 100 && (
                            <div style={{ marginTop: 14, padding: "10px 16px", borderRadius: 4, background: `rgba(${NEON.yellowRGB},0.06)`, border: `1px solid rgba(${NEON.yellowRGB},0.15)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 11, color: NEON.yellow, fontWeight: 600, textShadow: `0 0 6px ${NEON.yellow}40` }}>{"\uD83D\uDCB0"} Balance of ${biz.balance.toFixed(2)} is ready to cash out!</span>
                              <button onClick={(e) => { e.stopPropagation(); setCashOutModal(paymentConnected ? "confirm" : "noPayment"); }} style={{ padding: "5px 14px", borderRadius: 3, border: `1px solid rgba(${NEON.yellowRGB},0.4)`, background: `rgba(${NEON.yellowRGB},0.1)`, color: NEON.yellow, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cash Out</button>
                            </div>
                          )}
                          {biz.balance < minCashoutCents / 100 && biz.balance > 0 && (
                            <div style={{ marginTop: 12, fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "center" }}>${(minCashoutCents / 100 - biz.balance).toFixed(2)} more to reach the ${(minCashoutCents/100).toFixed(0)} cash out minimum</div>
                          )}
                        </div>
                      )}
                    </div>
                  </NeonBorderCard>
                );
              })}
            </div>
            </>)}
          </div>

          {/* EXPERIENCES */}
          <div style={{ marginBottom: 36, animation: "cardSlideUp 0.7s cubic-bezier(0.23, 1, 0.32, 1) 0.6s both" }}>
            <div data-tour="experiences-section" onClick={() => setExperiencesOpen(!experiencesOpen)} style={{ cursor: "pointer" }}>
              <SectionHeader icon={"\u274B"} label="My Experiences" neon={NEON.orange} neonRGB={NEON.orangeRGB} count={experiences.length} rightElement={
                <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { if (!experiencesOpen) setExperiencesOpen(true); setExpUploadOpen(!expUploadOpen); }} style={{ padding: "6px 14px", borderRadius: 3, border: `1px solid rgba(${NEON.orangeRGB},0.3)`, background: `rgba(${NEON.orangeRGB},0.06)`, color: NEON.orange, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={NEON.orange} strokeWidth="2" strokeLinecap="round" /></svg>
                    Upload
                  </button>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transition: "transform 0.2s ease", transform: experiencesOpen ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6" stroke={NEON.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              } />
            </div>

            {experiencesOpen && (<>
            {/* Experience Upload Panel */}
            {expUploadOpen && (
              <div style={{ marginBottom: 14, padding: "18px 20px", borderRadius: 4, background: `rgba(${NEON.orangeRGB},0.03)`, border: `1px solid rgba(${NEON.orangeRGB},0.12)`, animation: "fadeIn 0.2s ease" }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 12 }}>Upload Photo or Video</div>
                <input ref={expFileRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) setExpFile(file); }} />
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <button onClick={() => expFileRef.current?.click()} style={{ padding: "10px 18px", borderRadius: 3, border: `1px solid rgba(${NEON.orangeRGB},0.25)`, background: "rgba(255,255,255,0.03)", color: NEON.orange, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", flex: 1, textAlign: "left" }}>{expFile ? expFile.name : "Choose file..."}</button>
                </div>
                {/* Business picker */}
                <div style={{ position: "relative", marginBottom: 12 }}>
                  {expSelectedBiz ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderRadius: 3, border: `1px solid rgba(${NEON.orangeRGB},0.2)`, background: `rgba(${NEON.orangeRGB},0.04)` }}>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>{expSelectedBiz.name}</span>
                      <div onClick={() => { setExpSelectedBiz(null); setExpBizSearch(""); }} style={{ cursor: "pointer", color: "rgba(255,255,255,0.25)", fontSize: 12 }}>{"\u2715"}</div>
                    </div>
                  ) : (
                    <>
                      <input type="text" placeholder="Search business..." value={expBizSearch} onChange={(e) => setExpBizSearch(e.target.value)} style={{ width: "100%", padding: "9px 14px", borderRadius: 3, border: `1px solid rgba(${NEON.orangeRGB},0.15)`, background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }} />
                      {expBizResults.length > 0 && (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, zIndex: 20, borderRadius: 4, background: "#111120", border: `1px solid rgba(${NEON.orangeRGB},0.2)`, boxShadow: "0 8px 32px rgba(0,0,0,0.6)", overflow: "hidden" }}>
                          {expBizResults.map(b => (
                            <div key={b.id} onClick={() => { setExpSelectedBiz(b); setExpBizSearch(b.name); setExpBizResults([]); }} style={{ padding: "10px 14px", cursor: "pointer", fontSize: 12, color: "rgba(255,255,255,0.6)", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s ease" }} onMouseEnter={(e) => e.currentTarget.style.background = `rgba(${NEON.orangeRGB},0.06)`} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>{b.name}</div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", marginTop: 4, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>
                    Can&apos;t find a business? They may not be on the app yet or may not have a LetsGo Premium account.
                  </div>
                </div>
                <input type="text" placeholder="Caption (optional)..." value={expCaption} onChange={(e) => setExpCaption(e.target.value)} style={{ width: "100%", padding: "9px 14px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: 12, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => { setExpUploadOpen(false); setExpFile(null); setExpCaption(""); setExpSelectedBiz(null); setExpBizSearch(""); }} style={{ padding: "8px 16px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.1em" }}>Cancel</button>
                  <button onClick={handleExperienceUpload} disabled={expUploading || !expFile || !expSelectedBiz} style={{ padding: "8px 16px", borderRadius: 3, border: `1px solid rgba(${NEON.orangeRGB},0.4)`, background: `rgba(${NEON.orangeRGB},0.1)`, color: NEON.orange, fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.1em", opacity: (expUploading || !expFile || !expSelectedBiz) ? 0.4 : 1 }}>{expUploading ? "Uploading..." : "Upload"}</button>
                </div>
              </div>
            )}

            {experiences.length === 0 ? (
              <div style={{ padding: "30px 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.15)" }}>No experiences yet. Upload photos or videos from your visits!</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {experiences.map((exp) => (
                  <NeonBorderCard key={exp.id} neon={NEON.orange} neonRGB={NEON.orangeRGB} borderWidth={2} onClick={() => setViewingExp(exp)}>
                    <div>
                      <div style={{ height: 160, background: `linear-gradient(135deg, rgba(${NEON.orangeRGB},0.1), rgba(${NEON.purpleRGB},0.1))`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                        {exp.mediaUrl ? (
                          exp.mediaType === "video" ? (
                            <video src={`${exp.mediaUrl}#t=0.1`} muted playsInline preload="metadata" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                          ) : (
                            <img src={exp.mediaUrl} alt={exp.caption || "Experience"} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                          )
                        ) : null}
                        {exp.mediaType === "video" && (
                          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", zIndex: 2 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M8 5v14l11-7L8 5z" fill="rgba(255,255,255,0.8)" /></svg>
                          </div>
                        )}
                        {exp.status !== "approved" && (
                          <div style={{ position: "absolute", top: 8, right: 8, padding: "3px 8px", borderRadius: 2, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", fontSize: 8, color: exp.status === "pending" ? NEON.yellow : NEON.pink, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", zIndex: 2 }}>{exp.status}</div>
                        )}
                      </div>
                      <div style={{ padding: "12px 14px" }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.4, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exp.caption || "No caption"}</div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{exp.businessName}</span>
                          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.15)" }}>{exp.createdAt}</span>
                        </div>
                      </div>
                    </div>
                  </NeonBorderCard>
                ))}
              </div>
            )}
            </>)}
          </div>

          {/* RECEIPT & CASHOUT HISTORY */}
          <div style={{ marginBottom: 36, animation: "cardSlideUp 0.7s cubic-bezier(0.23, 1, 0.32, 1) 0.4s both" }}>
            <div data-tour="history-section" onClick={() => setHistoryOpen(!historyOpen)} style={{ cursor: "pointer" }}>
              <SectionHeader icon={"\uD83E\uDDFE"} label="History" neon={NEON.orange} neonRGB={NEON.orangeRGB} rightElement={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transition: "transform 0.2s ease", transform: historyOpen ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6" stroke={NEON.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              } />
            </div>

            {historyOpen && (<>
            <div style={{ display: "flex", gap: 6, marginBottom: 14, animation: "fadeIn 0.2s ease" }}>
              <GlassPill active={historyTab === "receipts"} onClick={() => setHistoryTab("receipts")} neon={NEON.orange} neonRGB={NEON.orangeRGB}>Receipts ({receipts.length})</GlassPill>
              <GlassPill active={historyTab === "cashouts"} onClick={() => setHistoryTab("cashouts")} neon={NEON.orange} neonRGB={NEON.orangeRGB}>Cash Outs ({cashouts.length})</GlassPill>
            </div>

            {historyTab === "receipts" && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  <GlassPill active={receiptFilter === "all"} onClick={() => { setReceiptFilter("all"); setReceiptBusinessFilter(""); }} neon={NEON.orange} neonRGB={NEON.orangeRGB}>All Receipts</GlassPill>
                  <GlassPill active={receiptFilter === "business"} onClick={() => setReceiptFilter("business")} neon={NEON.orange} neonRGB={NEON.orangeRGB}>By Business</GlassPill>
                  {receiptFilter === "business" && (
                    <div style={{ position: "relative", marginLeft: 4 }}>
                      <input className="receipt-search" type="text" placeholder="Search business name..." value={receiptBusinessFilter} onChange={(e) => setReceiptBusinessFilter(e.target.value)} style={{ padding: "7px 12px 7px 30px", borderRadius: 3, border: `1px solid rgba(${NEON.orangeRGB},0.25)`, background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: 11, fontFamily: "'DM Sans', sans-serif", outline: "none", width: 220, boxSizing: "border-box" }} />
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8" stroke={`rgba(${NEON.orangeRGB},0.3)`} strokeWidth="2" /><path d="M21 21l-4.35-4.35" stroke={`rgba(${NEON.orangeRGB},0.3)`} strokeWidth="2" strokeLinecap="round" /></svg>
                      {receiptBusinessFilter && <div onClick={() => setReceiptBusinessFilter("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "rgba(255,255,255,0.25)", fontSize: 12, lineHeight: 1 }}>{"\u2715"}</div>}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {filteredReceipts.length === 0 && (
                    <div style={{ padding: "30px 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.15)" }}>No receipts yet. Upload your first receipt to start earning!</div>
                  )}
                  {filteredReceipts.map((r) => (
                    <div key={r.id} onClick={() => setViewingReceipt(r)} style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderRadius: 4, background: r.status === "cancelled" ? "rgba(255,255,255,0.01)" : "#0C0C14", border: "1px solid rgba(255,255,255,0.04)", transition: "all 0.2s ease", gap: 16, cursor: "pointer", opacity: r.status === "cancelled" ? 0.45 : 1 }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(${NEON.orangeRGB},0.15)`; e.currentTarget.style.background = r.status === "cancelled" ? "rgba(255,255,255,0.015)" : "#0d0d16"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)"; e.currentTarget.style.background = r.status === "cancelled" ? "rgba(255,255,255,0.01)" : "#0C0C14"; }}>
                      {r.photoUrl ? (
                        <img src={r.photoUrl} alt="" style={{ width: 38, height: 38, borderRadius: 4, objectFit: "cover", flexShrink: 0, border: `1px solid rgba(${NEON.orangeRGB},0.15)` }} />
                      ) : (
                        <div style={{ width: 38, height: 38, borderRadius: 4, background: `rgba(${NEON.orangeRGB},0.08)`, border: `1px solid rgba(${NEON.orangeRGB},0.15)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{"\uD83E\uDDFE"}</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: r.status === "cancelled" ? "line-through" : "none" }}>{r.business}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>{r.date} {"\u00b7"} Visit #{r.visitNum} {"\u00b7"} Lvl {r.level}</div>
                      </div>
                      <div className="receipt-amount" style={{ textAlign: "right", minWidth: 80 }}>
                        <div style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: r.status === "cancelled" ? "rgba(255,255,255,0.25)" : "#fff" }}>${r.amount.toFixed(2)}</div>
                        <div style={{ fontSize: 10, color: r.status === "cancelled" ? "rgba(255,255,255,0.15)" : NEON.green, fontWeight: 600 }}>{r.status === "cancelled" ? "\u2014" : `+$${r.cashback.toFixed(2)}`}</div>
                      </div>
                      <div className="receipt-status" style={{ minWidth: 80, textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}><StatusBadge status={r.status} /></div>
                      {r.status === "pending" ? (
                        cancelConfirmId === r.id ? (
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                            <button onClick={(e) => { e.stopPropagation(); setCancelConfirmId(null); }} style={{ padding: "5px 10px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Keep</button>
                            <button onClick={(e) => { e.stopPropagation(); handleCancelReceipt(r.id); }} style={{ padding: "5px 10px", borderRadius: 3, border: `1px solid rgba(${NEON.pinkRGB},0.4)`, background: `rgba(${NEON.pinkRGB},0.1)`, color: NEON.pink, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textShadow: `0 0 6px ${NEON.pink}40` }}>Confirm</button>
                          </div>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); setCancelConfirmId(r.id); }} style={{ padding: "5px 12px", borderRadius: 3, flexShrink: 0, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "rgba(255,255,255,0.2)", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s ease" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(${NEON.pinkRGB},0.25)`; e.currentTarget.style.color = NEON.pink; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.2)"; }}>Cancel</button>
                        )
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" stroke="rgba(255,255,255,0.12)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Cash Out History */}
            {historyTab === "cashouts" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {cashouts.map((c) => {
                  const bd = c.breakdown;
                  const hasBreakdown = bd && ((bd.influencer_earnings_cents || 0) > 0 || (bd.receipt_earnings_cents || 0) > 0);
                  return (
                    <div key={c.id} style={{ borderRadius: 4, background: "#0C0C14", border: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", gap: 16 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 4, background: `rgba(${NEON.yellowRGB},0.08)`, border: `1px solid rgba(${NEON.yellowRGB},0.15)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{"\uD83D\uDCB8"}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.75)", fontFamily: "'DM Sans', sans-serif" }}>Cash Out</div>
                          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 2 }}>{c.date} {"\u00b7"} {c.method}</div>
                        </div>
                        <div style={{ textAlign: "right", minWidth: 80 }}>
                          <div style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, color: NEON.yellow, textShadow: `0 0 8px rgba(${NEON.yellowRGB},0.25)` }}>${c.amount.toFixed(2)}</div>
                        </div>
                        <div style={{ minWidth: 80, textAlign: "right" }}>
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: c.status === "completed" ? NEON.green : NEON.yellow, display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.status === "completed" ? NEON.green : NEON.yellow, boxShadow: `0 0 4px ${c.status === "completed" ? NEON.green : NEON.yellow}` }} />
                            {c.status === "completed" ? "Completed" : "Processing"}
                          </span>
                        </div>
                      </div>
                      {hasBreakdown && (
                        <div style={{ padding: "0 18px 12px 72px", display: "flex", gap: 16, fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                          {(bd.receipt_earnings_cents || 0) > 0 && (
                            <span>Receipt Cashback: <span style={{ color: NEON.green }}>${((bd.receipt_earnings_cents || 0) / 100).toFixed(2)}</span></span>
                          )}
                          {(bd.influencer_earnings_cents || 0) > 0 && (
                            <span>Influencer Earnings: <span style={{ color: NEON.orange }}>${((bd.influencer_earnings_cents || 0) / 100).toFixed(2)}</span></span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {cashouts.length === 0 && (
                  <div style={{ padding: "30px 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.15)" }}>No cash outs yet. Reach ${(minCashoutCents/100).toFixed(0)} at any business to cash out!</div>
                )}
              </div>
            )}
            </>)}
          </div>

          {/* YEAR-END EARNINGS SUMMARY (1099) */}
          <div style={{ marginBottom: 32, animation: "fadeIn 0.6s ease 1s both" }}>
            <div data-tour="tax-section" onClick={() => setTaxInfoOpen(!taxInfoOpen)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderRadius: 4, background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", transition: "border-color 0.2s ease" }} onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"} onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.04)"}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"/><path d="M9 7h6M9 11h6M9 15h4" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.18)", fontFamily: "'DM Sans', sans-serif" }}>Annual Earnings Summary</span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ transition: "transform 0.3s ease", transform: taxInfoOpen ? "rotate(180deg)" : "rotate(0)" }}><path d="M6 9l6 6 6-6" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>

            {taxInfoOpen && (
              <div style={{ marginTop: 1, padding: "18px 20px", borderRadius: "0 0 4px 4px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)", borderTop: "none", animation: "fadeIn 0.2s ease" }}>
                <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
                  {[
                    { year: yearlyEarnings.thisYear, amount: yearlyEarnings.thisYearTotal },
                    { year: yearlyEarnings.lastYear, amount: yearlyEarnings.lastYearTotal },
                  ].map((y) => {
                    const hit = y.amount >= 600;
                    return (
                    <div key={y.year} style={{ flex: 1, padding: "14px 16px", borderRadius: 4, background: hit ? `rgba(${NEON.orangeRGB},0.06)` : "rgba(255,255,255,0.02)", border: `1px solid ${hit ? `rgba(${NEON.orangeRGB},0.3)` : "rgba(255,255,255,0.04)"}`, position: "relative", overflow: "hidden" }}>
                      {hit && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${NEON.orange}, ${NEON.yellow})` }} />}
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: hit ? NEON.orange : "rgba(255,255,255,0.2)", marginBottom: 6 }}>{y.year} Earnings</div>
                      <div style={{ fontFamily: "'Clash Display', 'DM Sans', sans-serif", fontSize: 20, fontWeight: 700, color: hit ? NEON.orange : "rgba(255,255,255,0.5)", textShadow: hit ? `0 0 12px rgba(${NEON.orangeRGB},0.5)` : "none" }}>${y.amount.toFixed(2)}</div>
                      {hit && (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", borderRadius: 3, background: `rgba(${NEON.orangeRGB},0.1)`, border: `1px solid rgba(${NEON.orangeRGB},0.2)` }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={NEON.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke={NEON.orange} strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke={NEON.orange} strokeWidth="2" strokeLinecap="round"/></svg>
                          <span style={{ fontSize: 10, fontWeight: 600, color: NEON.orange }}>1099 Threshold Reached</span>
                        </div>
                      )}
                      <div style={{ marginTop: hit ? 8 : 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 9, color: hit ? `rgba(${NEON.orangeRGB},0.7)` : "rgba(255,255,255,0.12)" }}>1099 threshold</span>
                          <span style={{ fontSize: 9, fontWeight: hit ? 700 : 400, color: hit ? NEON.orange : "rgba(255,255,255,0.12)" }}>${y.amount.toFixed(0)} / $600</span>
                        </div>
                        <div style={{ height: hit ? 5 : 3, borderRadius: 3, background: hit ? `rgba(${NEON.orangeRGB},0.15)` : "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: 3, width: `${Math.min((y.amount / 600) * 100, 100)}%`, background: hit ? `linear-gradient(90deg, ${NEON.orange}, ${NEON.yellow})` : "rgba(255,255,255,0.1)", boxShadow: hit ? `0 0 8px rgba(${NEON.orangeRGB},0.5)` : "none", transition: "width 0.5s ease" }} />
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>

                <div style={{ fontSize: 10, color: yearlyEarnings.thisYearTotal >= 600 ? `rgba(${NEON.orangeRGB},0.6)` : "rgba(255,255,255,0.12)", lineHeight: 1.6, maxWidth: 600 }}>
                  Earnings over $600 in a calendar year may require a 1099-NEC for tax reporting.
                  {yearlyEarnings.thisYearTotal >= 600
                    ? ` You've reached the threshold for ${yearlyEarnings.thisYear} \u2014 we'll provide your 1099 form by January 31, ${yearlyEarnings.thisYear + 1}.`
                    : ` You're $${(600 - yearlyEarnings.thisYearTotal).toFixed(2)} away from the reporting threshold for ${yearlyEarnings.thisYear}.`
                  }
                  {" "}If you have questions, we recommend consulting a tax professional.
                </div>
                {yearlyEarnings.lastYearTotal >= 600 && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <button style={{ padding: "6px 14px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.25)", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      Download {yearlyEarnings.lastYear} 1099
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ACCOUNT MANAGEMENT */}
          <div style={{ marginBottom: 32, animation: "fadeIn 0.6s ease 1.1s both" }}>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: 24 }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.1)", marginBottom: 14 }}>Account Management</div>

              {accountStatus === "active" && (
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => handleAccountAction("hold")} disabled={accountActionLoading} style={{ padding: "8px 18px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "rgba(255,255,255,0.18)", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s ease", opacity: accountActionLoading ? 0.5 : 1 }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(${NEON.yellowRGB},0.25)`; e.currentTarget.style.color = NEON.yellow; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.18)"; }}>Hold Account</button>
                  <button onClick={() => handleAccountAction("delete_request")} disabled={accountActionLoading} style={{ padding: "8px 18px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "rgba(255,255,255,0.18)", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s ease", opacity: accountActionLoading ? 0.5 : 1 }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(${NEON.pinkRGB},0.25)`; e.currentTarget.style.color = NEON.pink; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.18)"; }}>Delete Account</button>
                </div>
              )}

              {accountStatus === "held" && (
                <div style={{ padding: "16px 20px", borderRadius: 4, background: `rgba(${NEON.yellowRGB},0.03)`, border: `1px solid rgba(${NEON.yellowRGB},0.12)` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: NEON.yellow, boxShadow: `0 0 6px ${NEON.yellow}` }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: NEON.yellow, letterSpacing: "0.08em", textTransform: "uppercase" }}>Account On Hold</span>
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", lineHeight: 1.6, marginBottom: 14 }}>Your account is paused. You won&apos;t earn cashback or appear in friend searches. Your data and balances are preserved.</p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => handleAccountAction("reinstate")} disabled={accountActionLoading} style={{ padding: "8px 18px", borderRadius: 3, border: `1px solid rgba(${NEON.greenRGB},0.4)`, background: `rgba(${NEON.greenRGB},0.08)`, color: NEON.green, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textShadow: `0 0 6px ${NEON.green}40`, opacity: accountActionLoading ? 0.5 : 1 }}>Reinstate Account</button>
                    <button onClick={() => handleAccountAction("delete_request")} disabled={accountActionLoading} style={{ padding: "8px 18px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "rgba(255,255,255,0.18)", fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", opacity: accountActionLoading ? 0.5 : 1 }}>Delete Instead</button>
                  </div>
                </div>
              )}

              {accountStatus === "deleted" && (
                <div style={{ padding: "16px 20px", borderRadius: 4, background: `rgba(${NEON.pinkRGB},0.03)`, border: `1px solid rgba(${NEON.pinkRGB},0.12)` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: NEON.pink, boxShadow: `0 0 6px ${NEON.pink}` }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: NEON.pink, letterSpacing: "0.08em", textTransform: "uppercase" }}>Account Deletion Scheduled</span>
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", lineHeight: 1.6, marginBottom: 6 }}>Your account will be permanently deleted in 30 days. All data, balances, and history will be removed. This cannot be undone after the grace period.</p>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", marginBottom: 14 }}>Changed your mind? You can reinstate before the grace period ends.</p>
                  <button onClick={() => handleAccountAction("reinstate")} disabled={accountActionLoading} style={{ padding: "8px 18px", borderRadius: 3, border: `1px solid rgba(${NEON.greenRGB},0.4)`, background: `rgba(${NEON.greenRGB},0.08)`, color: NEON.green, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", textShadow: `0 0 6px ${NEON.green}40`, opacity: accountActionLoading ? 0.5 : 1 }}>Reinstate Account</button>
                </div>
              )}
            </div>
          </div>

          {/* FOOTER */}
          <div style={{ textAlign: "center", padding: "24px 0 12px", borderTop: "1px solid rgba(255,255,255,0.04)", animation: "fadeIn 0.6s ease 1.2s both" }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.15)", letterSpacing: "0.15em", textTransform: "uppercase" }}>{"\u2605"} Keep your receipts {"\u00b7"} Get paid to live your best life {"\u2605"}</p>
            <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 16, alignItems: "center" }}>
              <span onClick={() => router.push("/terms")} style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", cursor: "pointer", letterSpacing: "0.05em", transition: "color 0.2s ease" }} onMouseEnter={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.5)"} onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.25)"}>Terms of Service</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.12)" }}>{"\u00b7"}</span>
              <span onClick={() => router.push("/privacy")} style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", cursor: "pointer", letterSpacing: "0.05em", transition: "color 0.2s ease" }} onMouseEnter={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.5)"} onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.25)"}>Privacy Policy</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 7, color: "rgba(255,255,255,0.04)", letterSpacing: "0.08em" }}>LetsGo v1.0.2 (build 47)</div>
          </div>
        </div>

        {/* Bottom ambient bar */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, ${NEON.orange}, ${NEON.purple}, ${NEON.green}, ${NEON.yellow}, ${NEON.primary}, ${NEON.pink}, ${NEON.orange})`, backgroundSize: "200% 100%", animation: "marqueeScroll 24s linear infinite", boxShadow: `0 0 15px rgba(${NEON.purpleRGB},0.3), 0 0 40px rgba(${NEON.greenRGB},0.15)` }} />
      </div>

      {tour.isTouring && tour.currentStep && (
        <OnboardingTooltip
          step={tour.currentStep}
          stepIndex={tour.stepIndex}
          totalSteps={tour.totalSteps}
          onNext={tour.next}
          onBack={tour.back}
          onSkip={tour.skip}
          illustration={tour.stepIndex >= 0 ? profileTourIllustrations[tour.stepIndex] : undefined}
        />
      )}
    </>
  );
}
