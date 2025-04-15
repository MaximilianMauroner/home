import Dexie, { type EntityTable } from 'dexie';

interface Message {
    id: number;
    personId: number;
    chatId: number;
    time: string;
    date: string;
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
    messages: '++id, personId, chatId, time, date, text',
    persons: '++id, name, chatId',
    chats: '++id, name'
});

export type { Message, Person, Chat };
export { whatsappDB };