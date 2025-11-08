import type { Message, Person } from "@/components/tools/WhatsAppStats/db";

export interface GraphProps {
    messages: Message[];
    persons: Person[];
}

export interface TooltipState {
    text: string;
    x: number;
    y: number;
}
