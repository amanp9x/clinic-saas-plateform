import type { ContactMessageInput } from '@clinic/shared';
import { prisma } from '../../config/database.js';

export const contactRepository = {
  create(input: ContactMessageInput) {
    return prisma.contactMessage.create({ data: input });
  },
};
