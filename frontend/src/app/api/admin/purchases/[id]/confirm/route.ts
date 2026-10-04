import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, userSubject } from "@/lib/server/api";
export const runtime="nodejs";
function getId(r:Request){const n=Number(new URL(r.url).pathname.split("/").filter(Boolean).at(-2));return Number.isSafeInteger(n)&&n>0?n:null;}
export async function POST(request:Request){
 const user=await authenticate(request); if(!user)return errorResponse("Authentication required",401); if(!isAdmin(user))return errorResponse("Administrator access required",403);
 const id=getId(request); if(!id)return errorResponse("Invalid purchase id",400); const actor=userSubject(user);
 try{
  const result=await prisma.$transaction(async tx=>{
   const p=await tx.purchase.findUnique({where:{id},include:{items:true,financeEntry:true}}); if(!p)throw new Error("NOT_FOUND"); if(p.status==="RECEIVED")return p; if(p.status==="CANCELLED")throw new Error("CANCELLED"); if(p.financeEntryId)throw new Error("ALREADY_FINANCED");
   const finance=await tx.financeEntry.create({data:{type:"EXPENSE",description:`Compra de mercadoria · ${p.purchaseNumber}`,category:"Compras de mercadoria",amount:p.total,currency:p.currency,status:"CONFIRMED",transactionDate:p.transactionDate,reference:p.purchaseNumber,notes:p.notes||null,createdBy:actor,updatedBy:actor,events:{create:{actorExternalId:actor,eventType:"CREATED_FROM_PURCHASE",payload:{purchaseId:p.id,purchaseNumber:p.purchaseNumber}}}}});
   for(const item of p.items) await tx.product.update({where:{id:item.productId},data:{stock:{increment:item.quantity}}});
   return tx.purchase.update({where:{id},data:{status:"RECEIVED",paymentStatus:"PENDING",financeEntryId:finance.id,updatedBy:actor,events:{create:{actorExternalId:actor,eventType:"CONFIRMED",payload:{financeEntryId:finance.id,stockUpdated:true}}}},include:{items:true,financeEntry:true}});
  },{isolationLevel:"Serializable"});
  return Response.json({data:result});
 }catch(e){const m=e instanceof Error?e.message:"";if(m==="NOT_FOUND")return errorResponse("Purchase not found",404);if(m==="CANCELLED")return errorResponse("A compra está cancelada.",409);if(m==="ALREADY_FINANCED")return errorResponse("A compra já foi processada.",409);console.error(e);return errorResponse("Unable to confirm purchase",503);}
}