import { prisma } from "@/lib/server/prisma";
import { authenticate, errorResponse, isAdmin } from "@/lib/server/api";
export const runtime="nodejs";
export async function GET(request:Request){
 const user=await authenticate(request);if(!user)return errorResponse("Authentication required",401);if(!isAdmin(user))return errorResponse("Administrator access required",403);
 try{return Response.json({data:await prisma.supplier.findMany({where:{active:true},orderBy:{name:"asc"},select:{id:true,name:true,taxId:true}})});}catch(e){console.error(e);return errorResponse("Unable to load suppliers",503);}
}