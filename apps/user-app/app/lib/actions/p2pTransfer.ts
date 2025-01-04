"use server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth";
import prisma from "@repo/db/client";

export async function p2pTransfer(to: string, amount:number) {
    const session = await getServerSession(authOptions);
    const from = session?.user?.id;
    if (!from) {
        return {
            message:"Error while sending"
        }
    };

    const toUser = await prisma.user.findFirst({ where: { number: to } });
    if (!toUser) {
        return {
            message: "User Not Found"
        }
    }

    await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${Number(from)} FOR UPDATE`;
        const fromBalance = await prisma.balance.findFirst({
            where: {
                userId: Number(from)
            }
        });
        if (!fromBalance || fromBalance.amount < amount) {
            throw new Error("Insufficient Balance")
        }
        await tx.balance.update({
            where: { userId: Number(from) },
            data:{amount:{decrement:amount}}
        })

        await tx.balance.update({
            where: { userId: Number(toUser.id) },
            data:{amount:{increment:amount}}
        })
        
        await tx.p2pTransfer.create({
            data: {
                amount: amount,
                timestamp: new Date(),
                fromUserId: Number(from),
                toUserId: toUser.id
            }
        })
    })
}