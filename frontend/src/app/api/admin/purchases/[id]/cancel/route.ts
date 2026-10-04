import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin, userSubject } from "@/lib/server/api";
export const runtime="nodejs";
function getId(r:Request){const n=Number(new URL(r.url).pathname.split("/").filter(Boolean).at(-2));return Number.isSafeInteger(n)&&n>0?n:null;}
export async function POST(request:Request){
 const user=await authenticate(request); if(!user)return errorResponse("Authentication required",401); if(!isAdmin(user))return errorResponse("Administrator access required",403);
 const id=getId(request); if(!id)return errorResponse("Invalid purchase id",400); const actor=userSubject(user);
 try{const result=await prisma.$transaction(async tx=>{const p=await tx.purchase.findUnique({where:{id}});if(!p)throw new Error("NOT_FOUND");if(p.status==="RECEIVED")throw new Error("RECEIVED");if(p.status==="CANCELLED")return p;return tx.purchase.update({where:{id},data:{status:"CANCELLED",updatedBy:actor,events:{create:{actorExternalId:actor,eventType:"CANCELLED",payload:{reason:"admin_action"}}}}});});return Response.json({data:result});}catch(e){const m=e instanceof Error?e.message:"";if(m==="NOT_FOUND")return errorResponse("Purchase not found",404);if(m==="RECEIVED")return errorResponse("Não é possível cancelar uma compra já recebida.",409);return errorResponse("Unable to cancel purchase",503);}
}