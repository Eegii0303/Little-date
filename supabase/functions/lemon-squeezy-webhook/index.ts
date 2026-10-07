import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
function hex(bytes:ArrayBuffer){return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("")}
async function signatureIsValid(raw:string,signature:string,secret:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const digest=hex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(raw)));if(digest.length!==signature.length)return false;let mismatch=0;for(let i=0;i<digest.length;i++)mismatch|=digest.charCodeAt(i)^signature.charCodeAt(i);return mismatch===0}
async function sha256(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("")}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const emailRe=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendEmail(to:string,invitationUrl:string,viewUrl:string,sender:string,recipient:string){
  const apiKey=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("RESEND_FROM_EMAIL");
  if(!apiKey||!from)throw new Error("Resend is not configured.");
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${apiKey}`},body:JSON.stringify({from,to:[to],subject:`Your Little Date invitation is ready 💗`,html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#382333"><h1>Your invitation is ready 💌</h1><p>${sender} → ${recipient}</p><p>Your $1 Little Date invitation has been published.</p><p><a href="${invitationUrl}" style="display:inline-block;padding:12px 18px;background:#f45b91;color:#fff;text-decoration:none;border-radius:999px">Open invitation</a></p><p><a href="${viewUrl}">View response privately</a></p><p style="font-size:12px;color:#777">Keep the private response link for yourself. The links expire after 7 days.</p></div>`})});
  if(!response.ok)throw new Error(`Resend returned ${response.status}`);
}

Deno.serve(async req=>{
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  const secret=Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET"),signature=req.headers.get("x-signature")??"";
  if(!secret||!signature)return json({error:"Webhook signature is missing."},401);
  const raw=await req.text();
  if(!(await signatureIsValid(raw,signature,secret)))return json({error:"Invalid webhook signature."},401);
  try{
    const event=JSON.parse(raw);
    if(event?.meta?.event_name!=="order_created")return json({received:true,ignored:true});
    const order=event?.data,attributes=order?.attributes??{};
    if(attributes.status!=="paid")return json({received:true,ignored:true});
    const custom=event?.meta?.custom_data??{};
    if(custom.product!=="little-date-invitation"||typeof custom.slug!=="string"||!/^[a-f0-9]{20}$/.test(custom.slug)||!["custom","surprise"].includes(custom.mode)||typeof custom.sender!=="string"||typeof custom.recipient!=="string"||typeof custom.creator_email!=="string"||!emailRe.test(custom.creator_email)||typeof custom.manage_token!=="string"||custom.manage_token.length!==64||typeof custom.theme!=="string"||!["true","false"].includes(custom.no_dodge))return json({error:"Missing or invalid checkout metadata."},400);
    const expectedVariant=Deno.env.get("LEMONSQUEEZY_VARIANT_ID"),expectedStore=Deno.env.get("LEMONSQUEEZY_STORE_ID");
    const itemVariant=attributes.first_order_item?.variant_id;
    if(!expectedVariant||itemVariant==null||String(itemVariant)!==String(expectedVariant))return json({error:"Unexpected or missing purchased variant."},400);
    if(!expectedStore||String(attributes.store_id)!==String(expectedStore))return json({error:"Unexpected store."},400);
    const supabaseUrl=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!supabaseUrl||!serviceKey)return json({error:"Server database is not configured."},503);
    const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
    const paidAt=new Date().toISOString();
    const manageHash=await sha256(custom.manage_token);
    const record={slug:custom.slug,mode:custom.mode,sender:custom.sender.trim(),recipient:custom.recipient.trim(),creator_email:custom.creator_email.trim(),manage_token_hash:manageHash,place:custom.place||null,date:custom.date||null,time:custom.time||null,bring:custom.bring||null,then:custom.then||null,theme:custom.theme,no_dodge:custom.no_dodge==="true",status:"pending",response_date:null,response_time:null,response_place:null,response_bring:null,response_then:null,is_paid:true,payment_order_id:String(order.id),paid_at:paidAt,expires_at:new Date(new Date(paidAt).getTime()+7*24*60*60*1000).toISOString()};
    const {data:existing,error:lookupError}=await admin.from("invitations").select("payment_order_id").eq("slug",custom.slug).maybeSingle();
    if(lookupError)throw lookupError;
    if(existing){if(existing.payment_order_id===String(order.id))return json({received:true,fulfilled:true,duplicate:true});return json({error:"This invitation identifier has already been used."},409)}
    const {error}=await admin.from("invitations").insert(record);
    if(error){console.error("Could not fulfill paid order",error);return json({error:"Could not publish invitation."},500)}
    await admin.from("invitation_events").insert({slug:custom.slug,event_type:"created",metadata:{source:"payment_webhook"}});
    await admin.from("invitation_events").insert({slug:custom.slug,event_type:"payment_confirmed",metadata:{order_id:String(order.id)}});

    const siteUrl=Deno.env.get("SITE_URL")?.replace(/\/$/,"");
    const invitationUrl=`${siteUrl}/i/${encodeURIComponent(custom.slug)}`;
    const viewUrl=`${siteUrl}/v/${encodeURIComponent(custom.slug)}?token=${encodeURIComponent(custom.manage_token)}`;
    try{
      await sendEmail(custom.creator_email.trim(),invitationUrl,viewUrl,custom.sender,custom.recipient);
      await admin.from("invitations").update({email_sent_at:new Date().toISOString()}).eq("slug",custom.slug);
      await admin.from("invitation_events").insert({slug:custom.slug,event_type:"email_sent",metadata:{provider:"resend"}});
    }catch(emailError){
      console.error("Invitation email failed",emailError);
      await admin.from("invitation_events").insert({slug:custom.slug,event_type:"email_failed",metadata:{provider:"resend",error:String(emailError)}});
    }
    return json({received:true,fulfilled:true});
  }catch(error){console.error("Webhook processing failed",error);return json({error:"Webhook processing failed."},400)}
});
