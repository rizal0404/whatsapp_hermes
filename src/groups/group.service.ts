import { sessionManager } from '../sessions/session.manager';
import { SessionNotConnectedError } from '../common/errors';
import { logger } from '../common/logger';

export interface GroupSummary {
  jid: string;
  subject: string;
  participantCount: number;
  creation: number | undefined;
}

export interface GroupDetail {
  jid: string;
  subject: string;
  description: string | null;
  owner: string | undefined;
  creation: number | undefined;
  participantCount: number;
  participants: Array<{
    jid: string;
    admin: string | null;
  }>;
}

class GroupService {
  async listGroups(sessionId: string): Promise<GroupSummary[]> {
    const client = sessionManager.getClient(sessionId);
    const socket = client.socket;

    if (!socket) {
      throw new SessionNotConnectedError(sessionId, 'NO_SOCKET');
    }

    logger.info({ sessionId }, 'Fetching all participating groups');

    const groups = await socket.groupFetchAllParticipating();

    const result: GroupSummary[] = Object.entries(groups).map(([jid, metadata]) => ({
      jid,
      subject: metadata.subject,
      participantCount: metadata.participants.length,
      creation: metadata.creation,
    }));

    // Sort by subject alphabetically
    result.sort((a, b) => a.subject.localeCompare(b.subject));

    logger.info({ sessionId, groupCount: result.length }, 'Groups fetched successfully');

    return result;
  }

  async getGroupDetail(sessionId: string, groupJid: string): Promise<GroupDetail> {
    const client = sessionManager.getClient(sessionId);
    const socket = client.socket;

    if (!socket) {
      throw new SessionNotConnectedError(sessionId, 'NO_SOCKET');
    }

    // Ensure the JID ends with @g.us
    const normalizedJid = groupJid.endsWith('@g.us') ? groupJid : `${groupJid}@g.us`;

    logger.info({ sessionId, groupJid: normalizedJid }, 'Fetching group detail');

    const metadata = await socket.groupMetadata(normalizedJid);

    return {
      jid: metadata.id,
      subject: metadata.subject,
      description: metadata.desc || null,
      owner: metadata.owner,
      creation: metadata.creation,
      participantCount: metadata.participants.length,
      participants: metadata.participants.map((p) => ({
        jid: p.id,
        admin: p.admin || null,
      })),
    };
  }
}

export const groupService = new GroupService();
