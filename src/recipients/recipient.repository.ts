import { prisma } from '../database/prisma';
import { Recipient } from '@prisma/client';

export class RecipientRepository {
  async create(data: { name: string; type: string; to: string; isActive?: boolean }): Promise<Recipient> {
    return prisma.recipient.create({
      data: {
        name: data.name,
        type: data.type,
        to: data.to,
        isActive: data.isActive ?? true,
      },
    });
  }

  async findById(id: string): Promise<Recipient | null> {
    return prisma.recipient.findUnique({
      where: { id },
    });
  }

  async findByTo(to: string): Promise<Recipient | null> {
    return prisma.recipient.findUnique({
      where: { to },
    });
  }

  async listAll(onlyActive: boolean = false): Promise<Recipient[]> {
    return prisma.recipient.findMany({
      where: onlyActive ? { isActive: true } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: string,
    data: Partial<Omit<Recipient, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<Recipient> {
    return prisma.recipient.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.recipient.delete({
      where: { id },
    });
  }
}

export const recipientRepository = new RecipientRepository();
