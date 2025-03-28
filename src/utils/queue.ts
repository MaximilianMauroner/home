export class Queue<T> {
    private items: T[];

    constructor() {
        this.items = [];
    }

    // Add an element to the end of the queue
    enqueue(element: T): void {
        this.items.push(element);
    }

    // Remove and return the first element from the queue
    dequeue(): T | undefined {
        return this.items.shift();
    }

    // Return the first element without removing it
    peek(): T | undefined {
        return this.items[0];
    }

    // Check if queue is empty
    isEmpty(): boolean {
        return this.items.length === 0;
    }

    // Get the size of the queue
    size(): number {
        return this.items.length;
    }

    // Clear the queue
    clear(): void {
        this.items = [];
    }

    toArray = (): T[] => this.items;

}