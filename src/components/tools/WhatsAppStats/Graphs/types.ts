import type { Message, Person } from "../db";

export interface GraphProps {
    messages: Message[];
    persons: Person[];
}

export interface TooltipState {
    text: string;
    x: number;
    y: number;
}
