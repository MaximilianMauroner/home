import Dexie, { type EntityTable } from 'dexie';

interface Chat {
    id: number;
    personId: number;  // Changed from person to personId
    time: string;
    date: string;
    text: string,
}

interface Person {
    id: number;
    name: string;
}

const whatsappDB = new Dexie('ChatsDatabase') as Dexie & {
    chats: EntityTable<Chat, 'id'>;
    persons: EntityTable<Person, 'id'>;
};

// Schema declaration:
whatsappDB.version(2).stores({
    chats: '++id, personId, time, date, text',
    persons: '++id, name'
});

export type { Chat, Person };
export { whatsappDB };