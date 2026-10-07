import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Content-Type":"application/json",
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:corsHeaders});
const themes=new Set(["midnight","pastel","rose","minimal","starlight"]);
const choices=new Set(["Flowers","Something sweet","A playlist","Just me"]);
const activities=new Set(["Dessert","Stargazing","A drive","Not going home"]);
const emailRe=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validText(v:unknown,max:number,required=true){return typeof v==="string"&&v.trim().length<=max&&(!required||v.trim().length>0)}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  try{
    const {invitation}=await req.json();
    if(!invitation||typeof invitation!=="object")return json({error:"Invitation draft is required."},400);
    const {slug,mode,sender,recipient,creator_email,manage_token,place,date,time,bring,then:activity,theme,no_dodge}=invitation;
    if(typeof slug!=="string"||!/^[a-f0-9]{20}$/.test(slug))return json({error:"Invalid invitation identifier."},400);
    if(!["custom","surprise"].includes(mode))return json({error:"Invalid invitation type."},400);
    if(!validText(sender,60)||!validText(recipient,60)||!validText(creator_email,120)||!emailRe.test(creator_email)||typeof manage_token!=="string"||manage_token.length!==64||!themes.has(theme)||typeof no_dodge!=="boolean")return json({error:"Please check the invitation details."},400);
    if(mode==="custom"&&(!validText(place,100)||!validText(date,10)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||!validText(time,30)||!choices.has(bring)||!activities.has(activity)))return json({error:"Please complete the custom date details."},400);

    const siteUrl=Deno.env.get("SITE_URL"),apiKey=Deno.env.get("LEMONSQUEEZY_API_KEY"),storeId=Deno.env.get("LEMONSQUEEZY_STORE_ID"),variantId=Deno.env.get("LEMONSQUEEZY_VARIANT_ID");
    if(!siteUrl||!apiKey||!storeId||!variantId)return json({error:"Payment service is not configured yet."},503);

    const customData:Record<string,string>={
      product:"little-date-invitation",slug,mode,sender:sender.trim(),recipient:recipient.trim(),creator_email:creator_email.trim(),manage_token,theme,no_dodge:String(no_dodge)
    };
    for(const [key,value] of [["place",place],["date",date],["time",time],["bring",bring],["then",activity]] as const){if(typeof value==="string"&&value.trim())customData[key]=value.trim()}

    const redirect=`${siteUrl.replace(/\/$/,"")}/?payment=success&slug=${encodeURIComponent(slug)}`;
    const checkoutResponse=await fetch("https://api.lemonsqueezy.com/v1/checkouts",{
      method:"POST",
      headers:{"Accept":"application/vnd.api+json","Content-Type":"application/vnd.api+json","Authorization":`Bearer ${apiKey}`},
      body:JSON.stringify({data:{type:"checkouts",attributes:{checkout_options:{embed:false},checkout_data:{email:creator_email.trim(),custom:customData},test_mode:Deno.env.get("LEMONSQUEEZY_TEST_MODE")==="true",product_options:{enabled_variants:[Number(variantId)],redirect_url:redirect}},relationships:{store:{data:{type:"stores",id:String(storeId)}},variant:{data:{type:"variants",id:String(variantId)}}}}})
    });
    const result=await checkoutResponse.json();
    if(!checkoutResponse.ok){console.error("Lemon Squeezy checkout error",checkoutResponse.status,result);return json({error:"Could not create checkout. Verify your Lemon Squeezy store and variant settings."},502)}
    const url=result?.data?.attributes?.url;
    if(typeof url!=="string"||!url.startsWith("https://"))return json({error:"Payment provider returned an invalid checkout URL."},502);

    const supabaseUrl=Deno.env.get("SUPABASE_URL"),serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(supabaseUrl&&serviceKey){
      const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false}});
      await admin.from("invitation_events").insert({slug,event_type:"checkout_started",metadata:{mode,theme}});
    }
    return json({url});
  }catch(error){console.error("create-checkout failed",error);return json({error:"Unable to start checkout. Please try again."},400)}
});
