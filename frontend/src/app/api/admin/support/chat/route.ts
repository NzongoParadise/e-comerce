import { authenticate, errorResponse, userSubject } from "@/lib/server/api";
import { prisma } from "@/lib/server/prisma";
import { isAdminUser } from "@/lib/auth";
import { notificationMessagePreview } from "@/lib/server/notifications";
import { z } from "zod";
import { readSupportChatRequest, serializeSupportAttachment } from "@/lib/server/supportAttachments";
import { Buffer } from "node:buffer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ conversationId: z.coerce.number().int().positive(), content: z.string().trim().max(4000).optional(), status: z.enum(["OPEN","IN_PROGRESS","WAITING_CUSTOMER","RESOLVED","CLOSED"]).optional() });
async function getAdmin(request: Request) {
 const auth = await authenticate(request); const subject = userSubject(auth); if (!subject) return null;
 const user = await prisma.user.findUnique({where:{externalId:subject},select:{id:true,name:true,email:true,accessRole:true}});
 if (!user || !isAdminUser(user)) return null; return user;
}
export async function GET(request: Request) {
 const admin=await getAdmin(request); if(!admin) return errorResponse("Sem permissão.",403);
 const url=new URL(request.url); const conversationId=Number(url.searchParams.get("conversationId")||0);
 if(conversationId){
  const conversation=await prisma.supportConversation.findUnique({where:{id:conversationId},include:{customer:{select:{id:true,name:true,email:true}},agent:{select:{id:true,name:true,email:true}},messages:{orderBy:{createdAt:"asc"},select:{id:true,content:true,senderId:true,senderRole:true,createdAt:true,attachmentName:true,attachmentType:true,attachmentSize:true,sender:{select:{id:true,name:true}}}}}});
  if(!conversation)return errorResponse("Conversa não encontrada.",404);
  return Response.json({data:{id:conversation.id,status:conversation.status,subject:conversation.subject,customer:conversation.customer,agent:conversation.agent,messages:conversation.messages.map((message)=>({...message,...serializeSupportAttachment(message)}))}});
 }
 const conversations=await prisma.supportConversation.findMany({orderBy:{updatedAt:"desc"},take:100,include:{customer:{select:{id:true,name:true,email:true}},agent:{select:{id:true,name:true,email:true}},messages:{orderBy:{createdAt:"desc"},take:1,select:{id:true,content:true,senderId:true,senderRole:true,createdAt:true,attachmentName:true,attachmentType:true,attachmentSize:true}}}});
 return Response.json({data:conversations.map(c=>({id:c.id,status:c.status,subject:c.subject,updatedAt:c.updatedAt,lastMessage:c.messages[0]?{...c.messages[0],...serializeSupportAttachment(c.messages[0])}:null,customer:c.customer,guestName:c.guestName,guestEmail:c.guestEmail,agent:c.agent}))});
}
export async function POST(request: Request) {
 const admin=await getAdmin(request); if(!admin) return errorResponse("Sem permissão.",403);
 const payload=await readSupportChatRequest(request); if(payload.error) return errorResponse(payload.error,400);
 const fields={...payload.fields}; if(fields.conversationId==="") delete fields.conversationId;
 const parsed=schema.safeParse(fields); if(!parsed.success) return errorResponse(parsed.error.issues[0]?.message||"Dados inválidos.",400);
 if(!parsed.data.content&&!payload.attachment) return errorResponse("Escreva uma mensagem ou anexe um ficheiro.",400);
 const conversation=await prisma.supportConversation.findUnique({where:{id:parsed.data.conversationId}});
 if(!conversation) return errorResponse("Conversa não encontrada.",404);
 const message=await prisma.$transaction(async tx=>{
  const created=await tx.supportMessage.create({data:{conversationId:conversation.id,senderId:admin.id,senderRole:"AGENT",content:parsed.data.content||"",...(payload.attachment?{attachmentName:payload.attachment.name,attachmentType:payload.attachment.type,attachmentSize:payload.attachment.size,attachmentData:Buffer.from(payload.attachment.data)}:{})},select:{id:true,content:true,senderId:true,senderRole:true,createdAt:true,attachmentName:true,attachmentType:true,attachmentSize:true}});
  await tx.supportConversation.update({where:{id:conversation.id},data:{agentId:admin.id,lastMessageAt:created.createdAt,status:parsed.data.status||"WAITING_CUSTOMER"}});
  return created;
 });
 if (conversation.customerId) {
  await prisma.notification.create({
   data:{
    userId:conversation.customerId,
    type:"SUPPORT_CHAT",
    title:"Nova resposta do suporte",
    message:`Suporte: "${notificationMessagePreview(message.content || (message.attachmentName ? `📎 ${message.attachmentName}` : ""))}"`,
    link:"/account/support",
    dedupeKey:`support-reply-${conversation.id}-${message.id}`,
   },
  }).catch((notificationError)=>{
   console.error("Unable to notify customer about support chat reply:",notificationError);
  });
 }
 return Response.json({data:{...message,sender:{id:admin.id,name:admin.name},...serializeSupportAttachment(message)}},{status:201});
}
