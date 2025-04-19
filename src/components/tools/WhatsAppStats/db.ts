import Dexie, { type EntityTable } from 'dexie';
import { atom } from 'jotai';

interface Message {
    id: number;
    personId: number;
    chatId: number;
    time: string;
    date: string;
    year: number;
    text: string,
}

interface Chat {
    id: number;
    name: string;
}

interface Person {
    id: number;
    chatId: number;
    name: string;
}

const whatsappDB = new Dexie('ChatsDatabase') as Dexie & {
    messages: EntityTable<Message, 'id'>;
    persons: EntityTable<Person, 'id'>;
    chats: EntityTable<Chat, 'id'>;
};

// Schema declaration:
whatsappDB.version(3).stores({
    messages: '++id, personId, chatId, year, [chatId+year]',
    persons: '++id, name, chatId',
    chats: '++id, name'
});

export type { Message, Person, Chat };
export { whatsappDB };




export const isClearedAtom = atom(false);
export const isDataUploadedAtom = atom(false);
export const showNamesAtom = atom(false);