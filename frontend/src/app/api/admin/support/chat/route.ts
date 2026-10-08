import { authenticate, errorResponse, readJson, userSubject } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";
import { isAdminUser } from "@/lib/auth";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ conversationId: z.number().int().positive(), content: z.string().trim().min(1).max(4000), status: z.enum(["OPEN","IN_PROGRESS","WAITING_CUSTOMER","RESOLVED","CLOSED"]).optional() });
async function getAdmin(request: Request) {
 const auth = await authenticate(request); const subject = userSubject(auth); if (!subject) return null;
 const user = await prisma.user.findUnique({where:{externalId:subject},select:{id:true,name:true,email:true,accessRole:true}});
 if (!user || !isAdminUser(user)) return null; return user;
}
export async function GET(request: Request) {
 const admin=await getAdmin(request); if(!admin) return errorResponse("Sem permissão.",403);
 const url=new URL(request.url); const conversationId=Number(url.searchParams.get("conversationId")||0);
 if(conversationId){
  const conversation=await prisma.supportConversation.findUnique({where:{id:conversationId},include:{customer:{select:{id:true,name:true,email:true}},agent:{select:{id:true,name:true,email:true}},messages:{orderBy:{createdAt:"asc"},include:{sender:{select:{id:true,name:true}}}}}});
  if(!conversation)return errorResponse("Conversa não encontrada.",404);
  return Response.json({data:{id:conversation.id,status:conversation.status,subject:conversation.subject,customer:conversation.customer,agent:conversation.agent,messages:conversation.messages}});
 }
 const conversations=await prisma.supportConversation.findMany({orderBy:{updatedAt:"desc"},take:100,include:{customer:{select:{id:true,name:true,email:true}},agent:{select:{id:true,name:true,email:true}},messages:{orderBy:{createdAt:"desc"},take:1}}});
 return Response.json({data:conversations.map(c=>({id:c.id,status:c.status,subject:c.subject,updatedAt:c.updatedAt,lastMessage:c.messages[0]||null,customer:c.customer,guestName:c.guestName,guestEmail:c.guestEmail,agent:c.agent}))});
}
export async function POST(request: Request) {
 const admin=await getAdmin(request); if(!admin) return errorResponse("Sem permissão.",403);
 const parsed=schema.safeParse(await readJson(request)); if(!parsed.success) return errorResponse(parsed.error.issues[0]?.message||"Dados inválidos.",400);
 const conversation=await prisma.supportConversation.findUnique({where:{id:parsed.data.conversationId}});
 if(!conversation) return errorResponse("Conversa não encontrada.",404);
 const message=await prisma.$transaction(async tx=>{
  const created=await tx.supportMessage.create({data:{conversationId:conversation.id,senderId:admin.id,senderRole:"AGENT",content:parsed.data.content},include:{sender:{select:{id:true,name:true}}}});
  await tx.supportConversation.update({where:{id:conversation.id},data:{agentId:admin.id,lastMessageAt:created.createdAt,status:parsed.data.status||"WAITING_CUSTOMER"}});
  if (conversation.customerId) await tx.notification.create({data:{userId:conversation.customerId,type:"SUPPORT_CHAT",title:"Nova resposta do suporte",message:"A equipa de suporte respondeu ao seu pedido.",link:"/account/support",dedupeKey:"support-reply-"+conversation.id+"-"+created.id}});
  return created;
 });
 return Response.json({data:message},{status:201});
}
